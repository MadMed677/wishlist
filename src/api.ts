import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Query,
} from 'firebase/firestore';
import { db } from './firebase';
import type { GiftData, GuestGift, Item, ItemData, Reservation, ReservationDetail, Wishlist } from './types';

// ---------- пути ----------

const listDoc = (listId: string) => doc(db, 'wishlists', listId);
const sub = (listId: string, name: string) => collection(db, 'wishlists', listId, name);

// ---------- realtime-хуки ----------

export interface Live<T> {
  data: T;
  loading: boolean;
  error: unknown;
}

function useLiveQuery<T>(q: Query<DocumentData> | null, map: (id: string, d: DocumentData) => T, deps: unknown[]): Live<T[]> {
  const [state, setState] = useState<Live<T[]>>({ data: [], loading: !!q, error: null });
  useEffect(() => {
    if (!q) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    return onSnapshot(
      q,
      (snap) => setState({ data: snap.docs.map((d) => map(d.id, d.data())), loading: false, error: null }),
      (error) => setState({ data: [], loading: false, error }),
    );
  }, deps);
  return state;
}

const toWishlist = (id: string, d: DocumentData): Wishlist => ({
  id,
  ownerUid: d.ownerUid,
  ownerName: d.ownerName ?? '',
  title: d.title ?? '',
  eventDate: d.eventDate ?? '',
  wishes: d.wishes ?? '',
  createdAt: d.createdAt ?? null,
});

export function useWishlist(listId: string, enabled: boolean): Live<Wishlist | null> & { notFound: boolean } {
  const [state, setState] = useState<Live<Wishlist | null> & { notFound: boolean }>({
    data: null,
    loading: true,
    error: null,
    notFound: false,
  });
  useEffect(() => {
    if (!enabled) return;
    setState({ data: null, loading: true, error: null, notFound: false });
    return onSnapshot(
      listDoc(listId),
      (snap) =>
        setState({
          data: snap.exists() ? toWishlist(snap.id, snap.data()) : null,
          loading: false,
          error: null,
          notFound: !snap.exists(),
        }),
      (error) => setState({ data: null, loading: false, error, notFound: false }),
    );
  }, [listId, enabled]);
  return state;
}

export function useMyWishlists(uid: string | null): Live<Wishlist[]> {
  const q = uid ? query(collection(db, 'wishlists'), where('ownerUid', '==', uid)) : null;
  const live = useLiveQuery(q, toWishlist, [uid]);
  return { ...live, data: [...live.data].sort((a, b) => millis(b.createdAt) - millis(a.createdAt)) };
}

export function useItems(listId: string): Live<Item[]> {
  const live = useLiveQuery(
    sub(listId, 'items'),
    (id, d): Item => ({
      id,
      title: d.title ?? '',
      description: d.description ?? '',
      url: d.url ?? '',
      imageUrl: d.imageUrl ?? '',
      price: d.price ?? '',
      priority: d.priority ?? 2,
      createdAt: d.createdAt ?? null,
    }),
    [listId],
  );
  // Сначала «очень хочу», внутри — в порядке добавления.
  const data = [...live.data].sort(
    (a, b) => a.priority - b.priority || millis(a.createdAt, Infinity) - millis(b.createdAt, Infinity),
  );
  return { ...live, data };
}

export function useReservations(listId: string): Live<Reservation[]> {
  return useLiveQuery(sub(listId, 'reservations'), (id, d) => ({ id, uid: d.uid }), [listId]);
}

/** Только для гостей: правила не дают автору читать эту коллекцию. */
export function useReservationDetails(listId: string, enabled: boolean): Live<ReservationDetail[]> {
  return useLiveQuery(
    enabled ? sub(listId, 'reservationDetails') : null,
    (id, d) => ({ id, uid: d.uid, guestName: d.guestName ?? '' }),
    [listId, enabled],
  );
}

/** Только для гостей: автор свои «сюрпризы» не видит. */
export function useGuestGifts(listId: string, enabled: boolean): Live<GuestGift[]> {
  const live = useLiveQuery(
    enabled ? sub(listId, 'guestGifts') : null,
    (id, d): GuestGift => ({
      id,
      uid: d.uid,
      guestName: d.guestName ?? '',
      title: d.title ?? '',
      description: d.description ?? '',
      url: d.url ?? '',
      price: d.price ?? '',
      createdAt: d.createdAt ?? null,
    }),
    [listId, enabled],
  );
  return { ...live, data: [...live.data].sort((a, b) => millis(a.createdAt, Infinity) - millis(b.createdAt, Infinity)) };
}

function millis(t: { toMillis(): number } | null, fallback = 0): number {
  return t ? t.toMillis() : fallback;
}

// ---------- вишлисты ----------

export async function createWishlist(
  ownerUid: string,
  ownerName: string,
  title: string,
  eventDate: string,
  wishes: string,
): Promise<string> {
  const ref = await addDoc(collection(db, 'wishlists'), {
    ownerUid,
    ownerName,
    title,
    eventDate,
    wishes,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function updateWishlist(listId: string, data: Partial<{ title: string; eventDate: string; wishes: string }>) {
  return updateDoc(listDoc(listId), data);
}

// ---------- пункты (автор) ----------

export function addItem(listId: string, data: ItemData) {
  return addDoc(sub(listId, 'items'), { ...data, createdAt: serverTimestamp() });
}

export function updateItem(listId: string, itemId: string, data: ItemData) {
  return updateDoc(doc(sub(listId, 'items'), itemId), { ...data });
}

/** Удаляет пункт, а если он забронирован — ещё и бронь с деталями, одним batch-ом. */
export function deleteItem(listId: string, itemId: string, reserved: boolean) {
  const batch = writeBatch(db);
  batch.delete(doc(sub(listId, 'items'), itemId));
  if (reserved) {
    batch.delete(doc(sub(listId, 'reservations'), itemId));
    batch.delete(doc(sub(listId, 'reservationDetails'), itemId));
  }
  return batch.commit();
}

// ---------- брони (гость) ----------

/**
 * Бронь создаётся одним batch-ом. Документ с ID пункта можно только создать (не обновить),
 * поэтому если кто-то успел раньше — придёт permission-denied.
 */
export function reserveItem(listId: string, itemId: string, uid: string, guestName: string) {
  const batch = writeBatch(db);
  batch.set(doc(sub(listId, 'reservations'), itemId), { uid, createdAt: serverTimestamp() });
  batch.set(doc(sub(listId, 'reservationDetails'), itemId), { uid, guestName });
  return batch.commit();
}

export function cancelReservation(listId: string, itemId: string) {
  const batch = writeBatch(db);
  batch.delete(doc(sub(listId, 'reservations'), itemId));
  batch.delete(doc(sub(listId, 'reservationDetails'), itemId));
  return batch.commit();
}

// ---------- «Я дарю другое» (гость) ----------

export function addGuestGift(listId: string, uid: string, guestName: string, data: GiftData) {
  return addDoc(sub(listId, 'guestGifts'), { ...data, uid, guestName, createdAt: serverTimestamp() });
}

export function updateGuestGift(listId: string, giftId: string, data: GiftData) {
  return updateDoc(doc(sub(listId, 'guestGifts'), giftId), { ...data });
}

export function deleteGuestGift(listId: string, giftId: string) {
  return deleteDoc(doc(sub(listId, 'guestGifts'), giftId));
}

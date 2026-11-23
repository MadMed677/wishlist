import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Query,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  GiftData,
  GuestGift,
  Item,
  ItemData,
  Question,
  QuestionAuthor,
  Reservation,
  ReservationDetail,
  Wishlist,
} from './types';

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
  return useLiveQuery(sub(listId, 'reservations'), (id, d) => ({ id, uid: d.uid, group: d.group === true }), [listId]);
}

/** Только для гостей: правила не дают автору читать эту коллекцию. */
export function useReservationDetails(listId: string, enabled: boolean): Live<ReservationDetail[]> {
  return useLiveQuery(
    enabled ? sub(listId, 'reservationDetails') : null,
    (id, d): ReservationDetail => ({
      id,
      uid: d.uid,
      guestName: d.guestName ?? '',
      group: d.group === true,
      members: Object.entries((d.members ?? {}) as Record<string, { name?: string; at?: { toMillis(): number } | null }>)
        .map(([uid, m]) => ({ uid, name: m?.name ?? '', at: m?.at ? m.at.toMillis() : Number.MAX_SAFE_INTEGER }))
        .sort((x, y) => x.at - y.at),
      note: d.note ?? '',
      noteBy: d.noteBy ?? '',
    }),
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

/** Вопросы по подарку и к списку — видят все, включая автора. По времени: старые сверху. */
export function useQuestions(listId: string): Live<Question[]> {
  const live = useLiveQuery(
    sub(listId, 'questions'),
    (id, d): Question => ({
      id,
      itemId: typeof d.itemId === 'string' ? d.itemId : null,
      text: d.text ?? '',
      answer: d.answer ?? '',
      answeredAt: d.answer ? millis(d.answeredAt ?? null, 1) : 0,
      createdAt: d.createdAt ?? null,
    }),
    [listId],
  );
  return { ...live, data: [...live.data].sort((a, b) => millis(a.createdAt, Infinity) - millis(b.createdAt, Infinity)) };
}

/** Только для гостей: кто задал вопрос. */
export function useQuestionAuthors(listId: string, enabled: boolean): Live<QuestionAuthor[]> {
  return useLiveQuery(
    enabled ? sub(listId, 'questionAuthors') : null,
    (id, d): QuestionAuthor => ({ id, uid: d.uid, guestName: d.guestName ?? '' }),
    [listId, enabled],
  );
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

/** Удаляет пункт, а заодно его бронь с деталями и вопросы к нему — одним batch-ом. */
export function deleteItem(listId: string, itemId: string, reserved: boolean, questionIds: string[] = []) {
  const batch = writeBatch(db);
  batch.delete(doc(sub(listId, 'items'), itemId));
  if (reserved) {
    batch.delete(doc(sub(listId, 'reservations'), itemId));
    batch.delete(doc(sub(listId, 'reservationDetails'), itemId));
  }
  for (const id of questionIds) {
    batch.delete(doc(sub(listId, 'questions'), id));
    batch.delete(doc(sub(listId, 'questionAuthors'), id));
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

/** Есть ли сейчас бронь на пункт — чтобы отличить «кто-то успел раньше» от отказа правил. */
export async function isReserved(listId: string, itemId: string): Promise<boolean> {
  try {
    return (await getDoc(doc(sub(listId, 'reservations'), itemId))).exists();
  } catch {
    return false;
  }
}

export function cancelReservation(listId: string, itemId: string) {
  const batch = writeBatch(db);
  batch.delete(doc(sub(listId, 'reservations'), itemId));
  batch.delete(doc(sub(listId, 'reservationDetails'), itemId));
  return batch.commit();
}

// ---------- «Подарим вместе» (гость) ----------

/** Открыть сбор: бронь с group: true + детали с первым участником, одним batch-ом. */
export function startGroup(listId: string, itemId: string, uid: string, guestName: string, note: string) {
  const batch = writeBatch(db);
  batch.set(doc(sub(listId, 'reservations'), itemId), { uid, group: true, createdAt: serverTimestamp() });
  batch.set(doc(sub(listId, 'reservationDetails'), itemId), {
    uid,
    guestName,
    group: true,
    members: { [uid]: { name: guestName, at: serverTimestamp() } },
    note,
    noteBy: note ? guestName : '',
  });
  return batch.commit();
}

export class GroupGoneError extends Error {}

/** Присоединиться к сбору. */
export function joinGroup(listId: string, itemId: string, uid: string, name: string) {
  const ref = doc(sub(listId, 'reservationDetails'), itemId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().group !== true) throw new GroupGoneError('Сбор уже закрыт');
    tx.update(ref, { [`members.${uid}`]: { name, at: serverTimestamp() } });
  });
}

/** Выйти из сбора. Последний участник освобождает подарок (удаляет бронь). */
export function leaveGroup(listId: string, itemId: string, uid: string) {
  const detailsRef = doc(sub(listId, 'reservationDetails'), itemId);
  const resRef = doc(sub(listId, 'reservations'), itemId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(detailsRef);
    if (!snap.exists()) return;
    const members = Object.keys(snap.data().members ?? {});
    if (members.length <= 1) {
      tx.delete(resRef);
      tx.delete(detailsRef);
    } else {
      tx.update(detailsRef, { [`members.${uid}`]: deleteField() });
    }
  });
}

export function updateGroupNote(listId: string, itemId: string, note: string, noteBy: string) {
  return updateDoc(doc(sub(listId, 'reservationDetails'), itemId), { note, noteBy: note ? noteBy : '' });
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

// ---------- вопросы по подарку ----------

/** Гость задаёт вопрос: сам вопрос (виден всем) + «кто спросил» (только гостям), одним batch-ом. */
export function askQuestion(listId: string, itemId: string | null, uid: string, guestName: string, text: string) {
  const ref = doc(sub(listId, 'questions'));
  const batch = writeBatch(db);
  batch.set(ref, { itemId, text, answer: null, createdAt: serverTimestamp() });
  batch.set(doc(sub(listId, 'questionAuthors'), ref.id), { uid, guestName });
  return batch.commit();
}

/** Спросивший правит текст, пока нет ответа. */
export function editQuestion(listId: string, questionId: string, text: string) {
  return updateDoc(doc(sub(listId, 'questions'), questionId), { text, editedAt: serverTimestamp() });
}

/** Удалить вопрос (спросивший или автор списка) вместе с записью «кто спросил». */
export function deleteQuestion(listId: string, questionId: string) {
  const batch = writeBatch(db);
  batch.delete(doc(sub(listId, 'questions'), questionId));
  batch.delete(doc(sub(listId, 'questionAuthors'), questionId));
  return batch.commit();
}

/** Автор отвечает или меняет ответ. */
export function answerQuestion(listId: string, questionId: string, answer: string) {
  return updateDoc(doc(sub(listId, 'questions'), questionId), { answer, answeredAt: serverTimestamp() });
}

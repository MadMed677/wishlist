/*
 * Перенос данных анонимного гостя на Google-аккаунт, который уже существует.
 *
 * Обычно анонимный аккаунт просто «привязывается» к Google (linkWithPopup) — uid тот же,
 * ничего переносить не надо. Но если этот Google-аккаунт уже входил в вишлист раньше
 * (например, с другого телефона), Firebase не может слить два аккаунта: приходится войти
 * в существующий, а брони анонима остаются под старым uid. Здесь мы их переносим:
 *   1) собираем всё, что аноним сделал в списках, открытых в этом браузере;
 *   2) записываем план в localStorage (если вкладку закроют посередине — доделаем потом);
 *   3) как аноним снимаем свои брони / выходим из сборов / удаляем свои подарки;
 *   4) входим в Google-аккаунт и создаём всё то же самое уже от него.
 * Правила Firestore для этого менять не нужно: каждый шаг — обычное действие гостя.
 */
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { addGuestGift, cancelReservation, deleteGuestGift, joinGroup, leaveGroup, reserveItem, startGroup } from './api';
import { auth, db } from './firebase';
import type { GiftData } from './types';
import { loadVisitedLists } from './utils';

type Entry =
  | { kind: 'solo'; listId: string; itemId: string; name: string; title: string }
  | { kind: 'member'; listId: string; itemId: string; name: string; note: string; title: string }
  | { kind: 'gift'; listId: string; giftId: string; name: string; data: GiftData };

export interface MigrationReport {
  moved: number;
  failed: string[];
}

const JOURNAL_KEY = 'wishlist.migration';

// Пока идёт перенос, «доделывание» при смене пользователя не запускаем.
let inProgress = false;

interface Journal {
  from: string;
  entries: Entry[];
}

function saveJournal(j: Journal) {
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(j));
  } catch {
    /* без журнала всё равно попробуем */
  }
}

function loadJournal(): Journal | null {
  try {
    const j = JSON.parse(localStorage.getItem(JOURNAL_KEY) ?? 'null');
    return j && typeof j.from === 'string' && Array.isArray(j.entries) ? j : null;
  } catch {
    return null;
  }
}

function clearJournal() {
  try {
    localStorage.removeItem(JOURNAL_KEY);
  } catch {
    /* ignore */
  }
}

const label = (e: Entry) => `«${e.kind === 'gift' ? e.data.title : e.title || 'подарок'}»`;

/** Всё, что этот uid сделал в списках, открытых в этом браузере. */
async function collect(uid: string): Promise<Entry[]> {
  const out: Entry[] = [];
  for (const listId of loadVisitedLists()) {
    try {
      const [details, gifts, items] = await Promise.all([
        getDocs(collection(db, 'wishlists', listId, 'reservationDetails')),
        getDocs(query(collection(db, 'wishlists', listId, 'guestGifts'), where('uid', '==', uid))),
        getDocs(collection(db, 'wishlists', listId, 'items')),
      ]);
      const titles = new Map(items.docs.map((d) => [d.id, (d.data().title as string) ?? '']));
      for (const d of details.docs) {
        const v = d.data();
        const title = titles.get(d.id) ?? '';
        if (v.group === true) {
          const m = v.members?.[uid];
          if (m) out.push({ kind: 'member', listId, itemId: d.id, name: m.name ?? '', note: v.note ?? '', title });
        } else if (v.uid === uid) {
          out.push({ kind: 'solo', listId, itemId: d.id, name: v.guestName ?? '', title });
        }
      }
      for (const g of gifts.docs) {
        const v = g.data();
        out.push({
          kind: 'gift',
          listId,
          giftId: g.id,
          name: v.guestName ?? '',
          data: { title: v.title ?? '', description: v.description ?? '', url: v.url ?? '', price: v.price ?? '' },
        });
      }
    } catch {
      /* список удалили или он недоступен — пропускаем */
    }
  }
  return out;
}

/** Шаг 3: снять всё от имени анонима. Возвращает то, что удалось снять. */
async function removeAll(entries: Entry[], uid: string): Promise<Entry[]> {
  const removed: Entry[] = [];
  for (const e of entries) {
    try {
      if (e.kind === 'solo') await cancelReservation(e.listId, e.itemId);
      else if (e.kind === 'member') await leaveGroup(e.listId, e.itemId, uid);
      else await deleteGuestGift(e.listId, e.giftId);
      removed.push(e);
    } catch {
      /* не сняли — значит, и переносить не будем: останется у анонима */
    }
  }
  return removed;
}

/** Шаг 4: создать всё заново от имени uid. */
async function restoreAll(entries: Entry[], uid: string, resuming = false): Promise<MigrationReport> {
  const report: MigrationReport = { moved: 0, failed: [] };
  for (const e of entries) {
    try {
      if (e.kind === 'solo') {
        await reserveItem(e.listId, e.itemId, uid, e.name);
      } else if (e.kind === 'member') {
        const det = await getDoc(doc(db, 'wishlists', e.listId, 'reservationDetails', e.itemId));
        if (det.exists() && det.data().group === true) await joinGroup(e.listId, e.itemId, uid, e.name);
        else await startGroup(e.listId, e.itemId, uid, e.name, e.note);
      } else {
        // при повторном запуске не дублируем подарок, если старый так и не удалился
        if (resuming && (await getDoc(doc(db, 'wishlists', e.listId, 'guestGifts', e.giftId))).exists()) continue;
        await addGuestGift(e.listId, uid, e.name, e.data);
      }
      report.moved++;
    } catch {
      if (!resuming) report.failed.push(label(e));
    }
  }
  return report;
}

/** Войти в существующий Google-аккаунт, перенеся на него всё, что сделал аноним. */
export async function switchAccountKeepingData(anon: User, signIn: () => Promise<unknown>): Promise<MigrationReport> {
  inProgress = true;
  try {
    return await switchAccount(anon, signIn);
  } finally {
    inProgress = false;
  }
}

async function switchAccount(anon: User, signIn: () => Promise<unknown>): Promise<MigrationReport> {
  const entries = await collect(anon.uid);
  if (entries.length === 0) {
    await signIn();
    return { moved: 0, failed: [] };
  }
  saveJournal({ from: anon.uid, entries });
  const removed = await removeAll(entries, anon.uid);
  try {
    await signIn();
    if (!auth.currentUser || auth.currentUser.uid === anon.uid) throw new Error('Не получилось войти через Google');
  } catch (err) {
    // вход не удался — возвращаем всё анониму, как было
    await restoreAll(removed, anon.uid);
    clearJournal();
    throw err;
  }
  const report = await restoreAll(removed, auth.currentUser!.uid);
  clearJournal();
  return report;
}

/** Если перенос прервали (закрыли вкладку), доделываем его при следующем запуске. */
export async function resumePendingMigration(user: User | null) {
  const j = loadJournal();
  if (!j || !user || inProgress) return;
  clearJournal();
  // вход в Google так и не случился — возвращаем анониму; иначе — переносим на Google-аккаунт
  await restoreAll(j.entries, user.uid, true);
}

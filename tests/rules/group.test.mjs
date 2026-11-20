import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, writeBatch, updateDoc, deleteField, serverTimestamp, runTransaction } from 'firebase/firestore';

const env = await initializeTestEnvironment({ projectId: 'demo-wishlist', firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 } });
const google = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } }).firestore();
const anon = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const owner = google('owner'), a = anon('A'), b = anon('B'), c = anon('C');
let ok = 0;
const t = async (n, p) => { try { await p; ok++; console.log('✓', n); } catch (e) { console.error('✗', n, '-', e.message); process.exitCode = 1; } };
const L = 'wishlists/G1';
await setDoc(doc(owner, L), { ownerUid: 'owner', ownerName: 'O', title: 'ДР', eventDate: '', wishes: 'кофе', createdAt: serverTimestamp() });
for (const id of ['i1', 'i2']) await setDoc(doc(owner, `${L}/items/${id}`), { title: 'X', description: '', url: '', imageUrl: '', price: '≈ 60 000 ₸', priority: 1, createdAt: serverTimestamp() });
const R = (db, i) => doc(db, `${L}/reservations/${i}`);
const D = (db, i) => doc(db, `${L}/reservationDetails/${i}`);
const start = (db, uid, name, i, note = '') => {
  const bt = writeBatch(db);
  bt.set(R(db, i), { uid, group: true, createdAt: serverTimestamp() });
  bt.set(D(db, i), { uid, guestName: name, group: true, members: { [uid]: { name, at: serverTimestamp() } }, note, noteBy: note ? name : '' });
  return bt.commit();
};
const solo = (db, uid, name, i) => {
  const bt = writeBatch(db);
  bt.set(R(db, i), { uid, createdAt: serverTimestamp() });
  bt.set(D(db, i), { uid, guestName: name });
  return bt.commit();
};
const join = (db, uid, name, i) => updateDoc(D(db, i), { [`members.${uid}`]: { name, at: serverTimestamp() } });
const leave = (db, uid, i) => updateDoc(D(db, i), { [`members.${uid}`]: deleteField() });
const removeBoth = (db, i) => { const bt = writeBatch(db); bt.delete(R(db, i)); bt.delete(D(db, i)); return bt.commit(); };

await t('wishes too long rejected', assertFails(updateDoc(doc(owner, L), { wishes: 'x'.repeat(1001) })));
await t('owner updates wishes', assertSucceeds(updateDoc(doc(owner, L), { wishes: 'Люблю кофе' })));
await t('owner cannot start group', assertFails(start(owner, 'owner', 'O', 'i1')));
await t('group with mismatched flags rejected', assertFails((() => {
  const bt = writeBatch(a);
  bt.set(R(a, 'i1'), { uid: 'A', createdAt: serverTimestamp() });
  bt.set(D(a, 'i1'), { uid: 'A', guestName: 'Аня', group: true, members: { A: { name: 'Аня', at: serverTimestamp() } }, note: '', noteBy: '' });
  return bt.commit();
})()));
await t('group with extra member rejected', assertFails((() => {
  const bt = writeBatch(a);
  bt.set(R(a, 'i1'), { uid: 'A', group: true, createdAt: serverTimestamp() });
  bt.set(D(a, 'i1'), { uid: 'A', guestName: 'Аня', group: true, members: { A: { name: 'Аня', at: serverTimestamp() }, B: { name: 'Боря', at: serverTimestamp() } }, note: '', noteBy: '' });
  return bt.commit();
})()));
await t('A starts group', assertSucceeds(start(a, 'A', 'Аня', 'i1', 'Покупаю я')));
await t('B cannot reserve group item alone', assertFails(solo(b, 'B', 'Боря', 'i1')));
await t('owner sees reservation (Занято)', assertSucceeds(getDoc(R(owner, 'i1'))));
await t('owner CANNOT read group details', assertFails(getDoc(D(owner, 'i1'))));
await t('owner CANNOT list details', assertFails(getDocs(collection(owner, `${L}/reservationDetails`))));
await t('B joins', assertSucceeds(join(b, 'B', 'Боря', 'i1')));
await t('B joining again rejected', assertFails(join(b, 'B', 'Боря2', 'i1')));
await t('C cannot add someone else', assertFails(updateDoc(D(c, 'i1'), { 'members.X': { name: 'X', at: serverTimestamp() } })));
await t('C cannot remove A', assertFails(updateDoc(D(c, 'i1'), { 'members.A': deleteField() })));
await t('C joins', assertSucceeds(join(c, 'C', 'Лена', 'i1')));
await t('join cannot change note', assertFails(updateDoc(D(anon('E'), 'i1'), { 'members.E': { name: 'E', at: serverTimestamp() }, note: 'hack' })));
await t('non-member cannot edit note', assertFails(updateDoc(D(anon('E'), 'i1'), { note: 'hack', noteBy: 'E' })));
await t('member edits note', assertSucceeds(updateDoc(D(b, 'i1'), { note: 'По 20 000', noteBy: 'Боря' })));
await t('note too long rejected', assertFails(updateDoc(D(b, 'i1'), { note: 'x'.repeat(301), noteBy: 'Боря' })));
await t('cannot change uid', assertFails(updateDoc(D(b, 'i1'), { uid: 'B' })));
await t('owner cannot join', assertFails(join(owner, 'owner', 'O', 'i1')));
await t('A (creator) cannot delete group while others in', assertFails(removeBoth(a, 'i1')));
await t('A leaves (others stay)', assertSucceeds(leave(a, 'A', 'i1')));
await t('B leaves', assertSucceeds(leave(b, 'B', 'i1')));
await t('C cannot leave by emptying members', assertFails(leave(c, 'C', 'i1')));
await t('C last leaves -> delete both', assertSucceeds(removeBoth(c, 'i1')));
await t('item free again: B reserves alone', assertSucceeds(solo(b, 'B', 'Боря', 'i1')));
await t('A cannot join a solo reservation', assertFails(join(a, 'A', 'Аня', 'i1')));
await t('B cancels solo', assertSucceeds(removeBoth(b, 'i1')));
await t('A starts group on i2', assertSucceeds(start(a, 'A', 'Аня', 'i2')));
await t('B joins via transaction', assertSucceeds(runTransaction(b, async (tx) => {
  const s = await tx.get(D(b, 'i2'));
  if (!s.exists()) throw new Error('gone');
  tx.update(D(b, 'i2'), { 'members.B': { name: 'Боря', at: serverTimestamp() } });
})));
await t('owner deletes item with group (batch)', assertSucceeds((() => {
  const bt = writeBatch(owner);
  bt.delete(doc(owner, `${L}/items/i2`));
  bt.delete(R(owner, 'i2'));
  bt.delete(D(owner, 'i2'));
  return bt.commit();
})()));
console.log(process.exitCode ? `\nFAILED (passed ${ok})` : `\nALL ${ok} PASSED`);
await env.cleanup();
process.exit(process.exitCode ?? 0);

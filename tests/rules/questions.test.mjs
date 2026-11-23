import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, writeBatch, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Вопросы по подарку: вопрос и ответ видят все, «кто спросил» — только гости.
const env = await initializeTestEnvironment({
  projectId: 'demo-wishlist',
  firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
});
const google = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } }).firestore();
const anon = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const owner = google('owner'), a = anon('guestA'), b = anon('guestB'), nobody = env.unauthenticatedContext().firestore();
let ok = 0;
const t = async (name, p) => { try { await p; ok++; console.log('✓', name); } catch (e) { console.error('✗', name, '-', e.message); process.exitCode = 1; } };
const L = 'wishlists/LQ';

const ask = (db, qId, { uid, name = 'Аня', itemId = 'i1', text = 'Подойдёт синий?', extra = {}, author = true } = {}) => {
  const bt = writeBatch(db);
  bt.set(doc(db, `${L}/questions/${qId}`), { itemId, text, answer: null, createdAt: serverTimestamp(), ...extra });
  if (author) bt.set(doc(db, `${L}/questionAuthors/${qId}`), { uid, guestName: name });
  return bt.commit();
};
const removeQ = (db, qId) => { const bt = writeBatch(db); bt.delete(doc(db, `${L}/questions/${qId}`)); bt.delete(doc(db, `${L}/questionAuthors/${qId}`)); return bt.commit(); };

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, L), { ownerUid: 'owner', ownerName: 'Артём', title: 'ДР', eventDate: '', wishes: '' });
  await setDoc(doc(db, `${L}/items/i1`), { title: 'Наушники', description: '', url: '', imageUrl: '', price: '', priority: 1 });
});

// создание
await t('guest A asks about item', assertSucceeds(ask(a, 'q1', { uid: 'guestA' })));
await t('guest B asks about the whole list (itemId null)', assertSucceeds(ask(b, 'q2', { uid: 'guestB', name: 'Боря', itemId: null, text: 'Деньгами норм?' })));
await t('owner cannot ask in own list', assertFails(ask(owner, 'q3', { uid: 'owner', name: 'Артём' })));
await t('question without author record rejected', assertFails(ask(a, 'q4', { uid: 'guestA', author: false })));
await t('author record for other uid rejected', assertFails(ask(a, 'q5', { uid: 'guestB' })));
await t('question about missing item rejected', assertFails(ask(a, 'q6', { uid: 'guestA', itemId: 'nope' })));
await t('empty question rejected', assertFails(ask(a, 'q7', { uid: 'guestA', text: '' })));
await t('too long question rejected', assertFails(ask(a, 'q8', { uid: 'guestA', text: 'x'.repeat(501) })));
await t('question with pre-filled answer rejected', assertFails(ask(a, 'q9', { uid: 'guestA', extra: { answer: 'Да' } })));
await t('question with extra fields rejected', assertFails(ask(a, 'q10', { uid: 'guestA', extra: { uid: 'guestA' } })));
await t('unauth cannot ask', assertFails(ask(nobody, 'q11', { uid: 'x' })));

// чтение
await t('owner reads questions', assertSucceeds(getDocs(collection(owner, `${L}/questions`))));
await t('owner CANNOT read questionAuthors (query)', assertFails(getDocs(collection(owner, `${L}/questionAuthors`))));
await t('owner CANNOT read questionAuthors (doc)', assertFails(getDoc(doc(owner, `${L}/questionAuthors/q1`))));
await t('guest B reads questions', assertSucceeds(getDocs(collection(b, `${L}/questions`))));
await t('guest B reads questionAuthors', assertSucceeds(getDocs(collection(b, `${L}/questionAuthors`))));
await t('unauth cannot read questions', assertFails(getDocs(collection(nobody, `${L}/questions`))));

// правка вопроса
await t('guest A edits own unanswered question', assertSucceeds(updateDoc(doc(a, `${L}/questions/q1`), { text: 'А синий подойдёт?', editedAt: serverTimestamp() })));
await t('guest B cannot edit A question', assertFails(updateDoc(doc(b, `${L}/questions/q1`), { text: 'хак' })));
await t('guest A cannot answer own question', assertFails(updateDoc(doc(a, `${L}/questions/q1`), { answer: 'Да' })));
await t('guest A cannot move question to another item', assertFails(updateDoc(doc(a, `${L}/questions/q1`), { itemId: null })));
await t('owner cannot edit question text', assertFails(updateDoc(doc(owner, `${L}/questions/q1`), { text: 'другой' })));
await t('guest A cannot steal B author record', assertFails(setDoc(doc(a, `${L}/questionAuthors/q2`), { uid: 'guestA', guestName: 'Аня' })));

// ответ
await t('owner answers', assertSucceeds(updateDoc(doc(owner, `${L}/questions/q1`), { answer: 'Да, любой', answeredAt: serverTimestamp() })));
await t('owner cannot answer with empty text', assertFails(updateDoc(doc(owner, `${L}/questions/q1`), { answer: '' })));
await t('owner cannot answer too long', assertFails(updateDoc(doc(owner, `${L}/questions/q1`), { answer: 'x'.repeat(1001) })));
await t('owner edits answer', assertSucceeds(updateDoc(doc(owner, `${L}/questions/q1`), { answer: 'Да, только чёрный', answeredAt: serverTimestamp() })));
await t('guest B cannot answer', assertFails(updateDoc(doc(b, `${L}/questions/q2`), { answer: 'Да' })));
await t('guest A cannot edit answered question', assertFails(updateDoc(doc(a, `${L}/questions/q1`), { text: 'передумал' })));

// удаление
await t('guest B cannot delete A question', assertFails(removeQ(b, 'q1')));
await t('guest A deletes own (answered) question', assertSucceeds(removeQ(a, 'q1')));
await t('owner deletes guest question with author record', assertSucceeds(removeQ(owner, 'q2')));
await t('guest asks again', assertSucceeds(ask(a, 'q12', { uid: 'guestA' })));
await t('owner deletes item together with its questions', assertSucceeds((() => {
  const bt = writeBatch(owner);
  bt.delete(doc(owner, `${L}/items/i1`));
  bt.delete(doc(owner, `${L}/questions/q12`));
  bt.delete(doc(owner, `${L}/questionAuthors/q12`));
  return bt.commit();
})()));
await t('question gone', assertSucceeds(getDoc(doc(owner, `${L}/questions/q12`)).then((s) => { if (s.exists()) throw new Error('still exists'); })));

console.log(process.exitCode ? `\nFAILED (passed ${ok})` : `\nALL ${ok} PASSED`);
await env.cleanup();
process.exit(process.exitCode ?? 0);

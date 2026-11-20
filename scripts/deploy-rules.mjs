// Публикует firestore.rules в Firebase через Admin SDK (используется в .github/workflows/firestore-rules.yml).
// Ключ сервисного аккаунта берётся из переменной FIREBASE_SERVICE_ACCOUNT (JSON целиком).
// firebase-tools здесь не используем: перед деплоем он проверяет API через serviceusage,
// а у ключа firebase-adminsdk на это нет прав.
import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.error('FIREBASE_SERVICE_ACCOUNT не задан');
  process.exit(1);
}

const serviceAccount = JSON.parse(raw);
initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });

const source = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const rules = getSecurityRules();
const released = await rules.releaseFirestoreRulesetFromSource(source);
const live = await rules.getFirestoreRuleset();

console.log(`Опубликован ruleset ${released.name} (проект ${serviceAccount.project_id})`);
if (live.name !== released.name || live.source[0].content !== source) {
  console.error('Опубликованные правила не совпадают с firestore.rules');
  process.exit(1);
}
console.log('Проверено: в Firebase сейчас именно эти правила.');

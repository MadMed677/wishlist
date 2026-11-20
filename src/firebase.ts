import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onIdTokenChanged,
  signInAnonymously,
  signInWithCredential,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { connectFirestoreEmulator, disableNetwork, enableNetwork, initializeFirestore } from 'firebase/firestore';

// Конфиг Firebase-проекта wishlist-24cee.
// Firebase Console → ⚙️ Project settings → General → Your apps → Web app → SDK setup and configuration → Config.
// Эти ключи публичные, их можно хранить в репозитории: доступ к данным защищают firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyBdj6k6WhQWmkSLI-5yhPJkZEuzgW9kA4U',
  authDomain: 'wishlist-24cee.firebaseapp.com',
  projectId: 'wishlist-24cee',
  storageBucket: 'wishlist-24cee.firebasestorage.app',
  messagingSenderId: '802479969958',
  appId: '1:802479969958:web:8a76c7e1a7881203798667',
};

// Локальная разработка без настоящего проекта: `npm run dev:emulators` (см. README).
const useEmulators = import.meta.env.VITE_USE_EMULATORS === '1';

/** false, если в конфиге остались заглушки TODO. */
export const isFirebaseConfigured =
  useEmulators || !Object.values(firebaseConfig).some((v) => v.includes('TODO'));

export const app = initializeApp(
  useEmulators ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-wishlist', appId: 'demo' } : firebaseConfig,
);
export const auth = getAuth(app);
auth.languageCode = 'ru';
// Транспорт по умолчанию: потоковое соединение (WebChannel), SDK сам переходит на long polling,
// если поток не проходит. Если в какой-то сети обновления опаздывают на ~30 секунд
// (прокси/антивирус буферизует поток) — можно включить { experimentalForceLongPolling: true }.
export const db = initializeFirestore(app, {});

// Телефоны «усыпляют» фоновые вкладки, и соединение потом долго восстанавливается.
// Когда пользователь возвращается на вкладку или появляется сеть — переподключаемся сразу.
let hiddenAt = 0;
function reconnect() {
  disableNetwork(db)
    .then(() => enableNetwork(db))
    .catch(() => {});
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt > 3000) reconnect();
});
window.addEventListener('online', reconnect);
window.addEventListener('pageshow', (e) => {
  if (e.persisted) reconnect();
});

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  // Только для локальных тестов: вход «через Google» без окна (эмулятор принимает фейковый токен).
  (window as unknown as Record<string, unknown>).__emulatorGoogleSignIn = (sub: string, name: string) =>
    signInWithCredential(
      auth,
      GoogleAuthProvider.credential(JSON.stringify({ sub, name, email: `${sub}@example.com`, email_verified: true })),
    );
}

/** Незаметный анонимный вход для гостей. */
export async function signInGuest(): Promise<void> {
  if (!auth.currentUser) await signInAnonymously(auth);
}

export function signOut(): Promise<void> {
  return fbSignOut(auth);
}

/** Подписка на пользователя; срабатывает и при входе/выходе, и при привязке Google к анониму. */
export function watchUser(cb: (user: User | null) => void): () => void {
  return onIdTokenChanged(auth, cb);
}

export function userDisplayName(user: User): string {
  return (
    user.displayName ||
    user.providerData.find((p) => p.displayName)?.displayName ||
    user.email ||
    'Автор'
  );
}

/** Человеческий текст ошибки Firebase. */
export function errorText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Окно входа закрыто.';
    case 'auth/popup-blocked':
      return 'Браузер заблокировал окно входа. Разреши всплывающие окна и попробуй ещё раз.';
    case 'auth/unauthorized-domain':
      return 'Этот домен не добавлен в Authorized domains в Firebase.';
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'Этот способ входа не включён в Firebase Authentication.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Нет связи с сервером. Проверь интернет.';
    case 'permission-denied':
      return 'Нет прав на это действие.';
    case 'not-found':
      return 'Не найдено.';
    default:
      return (e as Error)?.message || 'Что-то пошло не так.';
  }
}

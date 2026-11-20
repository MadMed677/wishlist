import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  linkWithPopup,
  onIdTokenChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

// TODO: вставь сюда конфиг своего Firebase-проекта.
// Firebase Console → ⚙️ Project settings → General → Your apps → Web app → SDK setup and configuration → Config.
// Эти ключи публичные, их можно хранить в репозитории: доступ к данным защищают firestore.rules.
const firebaseConfig = {
  apiKey: 'TODO_API_KEY',
  authDomain: 'TODO_PROJECT_ID.firebaseapp.com',
  projectId: 'TODO_PROJECT_ID',
  storageBucket: 'TODO_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'TODO_SENDER_ID',
  appId: 'TODO_APP_ID',
};

// Локальная разработка без настоящего проекта: `npm run dev:emulators` (см. README).
const useEmulators = import.meta.env.VITE_USE_EMULATORS === '1';

/** false, пока в конфиге остаются заглушки TODO. */
export const isFirebaseConfigured =
  useEmulators || !Object.values(firebaseConfig).some((v) => v.includes('TODO'));

export const app = initializeApp(
  useEmulators ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-wishlist', appId: 'demo' } : firebaseConfig,
);
export const auth = getAuth(app);
auth.languageCode = 'ru';
export const db = getFirestore(app);

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

/**
 * Вход через Google (для авторов вишлистов).
 * Если сейчас вошёл анонимный гость, пробуем «привязать» Google к тому же аккаунту,
 * чтобы его брони не потерялись. Если этот Google-аккаунт уже существует — просто входим в него.
 */
export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const current = auth.currentUser;
  if (current?.isAnonymous) {
    try {
      await linkWithPopup(current, provider);
      await current.reload();
      return;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
        const credential = GoogleAuthProvider.credentialFromError(e as never);
        if (credential) {
          await signInWithCredential(auth, credential);
          return;
        }
      }
      throw e;
    }
  }
  await signInWithPopup(auth, provider);
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

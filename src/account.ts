import {
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  signInWithCredential,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';
import { switchAccountKeepingData, type MigrationReport } from './migrate';
import { plural } from './utils';

/** Короткое сообщение внизу экрана (его показывает App). */
export function notify(text: string) {
  window.dispatchEvent(new CustomEvent('wishlist:notice', { detail: text }));
}

function reportText(r: MigrationReport): string {
  if (r.failed.length) {
    return `Вошли через Google. Перенесли ${r.moved}, но не получилось перенести: ${r.failed.join(', ')} — их успели занять.`;
  }
  if (r.moved) return `Готово — ${r.moved} ${plural(r.moved, 'бронь перенесена', 'брони перенесены', 'броней перенесено')} на Google-аккаунт.`;
  return 'Готово — вошли через Google.';
}

/**
 * Привязать анонимного гостя к Google так, чтобы ничего не потерялось.
 * - Обычно: аккаунт «привязывается» (uid тот же) — все брони остаются на месте.
 * - Если этот Google-аккаунт уже был в вишлисте: входим в него и переносим данные анонима.
 */
async function linkOrMerge(current: User, link: () => Promise<unknown>, signInExisting: (e: unknown) => Promise<unknown>) {
  try {
    await link();
    await current.reload();
    await current.getIdToken(true);
    notify('Готово — всё сохранено в твоём Google-аккаунте.');
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
      notify(reportText(await switchAccountKeepingData(current, () => signInExisting(e))));
      return;
    }
    throw e;
  }
}

/** Вход через Google: для авторов и для гостей (с сохранением броней). */
export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const current = auth.currentUser;
  if (current?.isAnonymous) {
    return linkOrMerge(
      current,
      () => linkWithPopup(current, provider),
      // ключ Google из ошибки «аккаунт уже есть»; если его нет — ещё раз через окно Google
      (e) => {
        const credential = GoogleAuthProvider.credentialFromError(e as never);
        return credential ? signInWithCredential(auth, credential) : signInWithPopup(auth, provider);
      },
    );
  }
  await signInWithPopup(auth, provider);
}

// Только для локальных тестов на эмуляторе: тот же путь привязки, но без окна Google.
if (import.meta.env.VITE_USE_EMULATORS === '1') {
  (window as unknown as Record<string, unknown>).__emulatorGoogleLink = async (sub: string, name: string) => {
    const credential = GoogleAuthProvider.credential(
      JSON.stringify({ sub, name, email: `${sub}@example.com`, email_verified: true }),
    );
    const current = auth.currentUser;
    if (current?.isAnonymous) {
      return linkOrMerge(current, () => linkWithCredential(current, credential), () => signInWithCredential(auth, credential));
    }
    await signInWithCredential(auth, credential);
  };
}

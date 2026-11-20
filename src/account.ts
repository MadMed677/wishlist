import {
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  signInWithCredential,
  signInWithPopup,
  type AuthCredential,
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

/** Вход по уже полученному ключу Google: гость привязывается (или переносит данные), остальные просто входят. */
async function signInWithGoogleCredential(credential: AuthCredential) {
  const current = auth.currentUser;
  if (current?.isAnonymous) {
    return linkOrMerge(current, () => linkWithCredential(current, credential), () => signInWithCredential(auth, credential));
  }
  await signInWithCredential(auth, credential);
}

// ---------- Google Identity Services: вход на телефонах ----------
// Окно Firebase (страница wishlist-24cee.firebaseapp.com) на iPhone закрывается, не вернув результат:
// Safari прячет нашу вкладку и режет связь между сайтами. Окно Google Identity Services отдаёт ключ
// прямо нашей странице, поэтому на телефонах входим через него. Для этого в Google Cloud у OAuth-клиента
// в «Authorized JavaScript origins» должен быть https://madmed677.github.io (см. README).

// OAuth-клиент «Web client (auto created by Google Service)» проекта — публичный идентификатор.
const GOOGLE_CLIENT_ID = '802479969958-48klfh29pvkarc5tittnobr0ff5t67qk.apps.googleusercontent.com';
const useEmulators = import.meta.env.VITE_USE_EMULATORS === '1';

type TokenResponse = { access_token?: string; error?: string };
type TokenClient = { requestAccessToken: () => void };
type Gis = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    prompt?: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type?: string }) => void;
  }) => TokenClient;
};

function gis(): Gis | undefined {
  return (window as unknown as { google?: { accounts?: { oauth2?: Gis } } }).google?.accounts?.oauth2;
}

function isMobileBrowser(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod|Android/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

let gisScript: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (gis()) return Promise.resolve();
  gisScript ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisScript = null;
      reject(new Error('gis'));
    };
    document.head.appendChild(s);
  });
  return gisScript;
}

// Скрипт грузим заранее: окно входа можно открыть только сразу по нажатию, без ожидания сети.
if (isMobileBrowser() && !useEmulators) loadGis().catch(() => {});

function gisError(type = 'unknown') {
  return Object.assign(new Error(type), { code: `gis/${type}` });
}

/** Открывает окно Google (синхронно — в том же нажатии) и ждёт ключ. */
function requestGoogleToken(oauth2: Gis): Promise<string> {
  return new Promise((resolve, reject) => {
    oauth2
      .initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        prompt: 'select_account',
        callback: (r) => (r.access_token ? resolve(r.access_token) : reject(gisError(r.error))),
        error_callback: (e) => reject(gisError(e.type)),
      })
      .requestAccessToken();
  });
}

function credentialFromToken(token: string): AuthCredential {
  // эмулятор принимает «поддельный» id-токен вместо настоящего ключа
  return useEmulators ? GoogleAuthProvider.credential(token) : GoogleAuthProvider.credential(null, token);
}

/** Вход через Google: для авторов и для гостей (с сохранением броней). */
export function signInWithGoogle(): Promise<void> {
  // Важно: до открытия окна не должно быть ни одного await — иначе браузер заблокирует окно.
  const oauth2 = isMobileBrowser() ? gis() : undefined;
  if (oauth2) {
    return requestGoogleToken(oauth2).then((token) => signInWithGoogleCredential(credentialFromToken(token)));
  }

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
  return signInWithPopup(auth, provider).then(() => undefined);
}

/** Название приложения, если ссылку открыли внутри него (Telegram, Instagram…): там Google вход не пускает. */
export function inAppBrowser(): string | null {
  const ua = navigator.userAgent;
  if ('TelegramWebviewProxy' in window || 'TelegramWebview' in window || /Telegram/i.test(ua)) return 'Telegram';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
  if (/WhatsApp/i.test(ua)) return 'WhatsApp';
  if (/VKClient|vkontakte/i.test(ua)) return 'VK';
  if (/Line\//.test(ua)) return 'LINE';
  if (/; wv\)/.test(ua)) return 'приложения';
  return null;
}

// Только для локальных тестов на эмуляторе: тот же путь привязки, но без окна Google.
if (useEmulators) {
  (window as unknown as Record<string, unknown>).__emulatorGoogleLink = (sub: string, name: string) =>
    signInWithGoogleCredential(
      GoogleAuthProvider.credential(JSON.stringify({ sub, name, email: `${sub}@example.com`, email_verified: true })),
    );
}

import type { Priority } from './types';

export const PRIORITIES: { value: Priority; label: string; emoji: string }[] = [
  { value: 1, label: 'Очень хочу', emoji: '🔥' },
  { value: 2, label: 'Хочу', emoji: '✨' },
  { value: 3, label: 'Было бы неплохо', emoji: '🙂' },
];

export function priorityInfo(p: Priority) {
  return PRIORITIES.find((x) => x.value === p) ?? PRIORITIES[1];
}

/** Возвращает ссылку, только если это http(s), иначе null (защита от javascript: и т.п.). */
export function safeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function countdown(iso: string): string {
  if (!iso) return '';
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'сегодня! 🎉';
  if (days === 1) return 'завтра';
  if (days < 0) return 'уже прошло';
  return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`;
}

export function giftsWord(n: number) {
  return plural(n, 'подарок', 'подарка', 'подарков');
}

// ---------- имя гостя ----------

const NAME_KEY = 'wishlist.guestName';

export function loadGuestName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveGuestName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* приватный режим — просто не запоминаем */
  }
}

// ---------- тема ----------

export type Theme = 'auto' | 'light' | 'dark';
const THEME_KEY = 'wishlist.theme';

export function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(t: Theme) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignore */
  }
}

export function shareUrl(listId: string): string {
  return `${location.origin}${location.pathname}#/list/${listId}`;
}

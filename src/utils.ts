import type { Priority } from './types';

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 1, label: 'Очень хочу' },
  { value: 2, label: 'Хочу' },
  { value: 3, label: 'Было бы неплохо' },
];

export function priorityLabel(p: Priority): string {
  return (PRIORITIES.find((x) => x.value === p) ?? PRIORITIES[1]).label;
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
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '');
}

export function plural(n: number, one: string, few: string, many: string) {
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
  if (days === 0) return 'сегодня!';
  if (days === 1) return 'завтра';
  if (days < 0) return 'уже прошло';
  return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`;
}

export function wishesCount(n: number) {
  return `${n} ${plural(n, 'желание', 'желания', 'желаний')}`;
}

/** «Артём» → «от Артёма» не склоняем надёжно, поэтому просто первое слово имени. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** «Боря», «Боря и Лена», «Боря, Лена и ещё 2». */
export function joinNames(names: string[], max = 2): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length <= max) return `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`;
  return `${names.slice(0, max).join(', ')} и ещё ${names.length - max}`;
}

/** Достаём число из свободной цены: «≈ 60 000 ₸» → 60000, «45 тыс» → 45000. */
export function parsePrice(raw: string): { amount: number; symbol: string } | null {
  const s = raw.replace(/\u00a0|\u202f/g, ' ');
  const m = s.match(/(\d[\d ]*(?:[.,]\d+)?)\s*(тыс|k|к)?/i);
  if (!m) return null;
  let amount = parseFloat(m[1].replace(/ /g, '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (m[2]) amount *= 1000;
  const symbol = s.includes('₽') ? '₽' : s.includes('$') ? '$' : s.includes('€') ? '€' : '₸';
  return { amount, symbol };
}

/** Примерная доля на каждого: цена ÷ участников, округлено до сотни. */
export function shareText(price: string, people: number): string | null {
  const p = parsePrice(price);
  if (!p || people < 1) return null;
  const raw = p.amount / people;
  const value = raw >= 1000 ? Math.round(raw / 100) * 100 : Math.round(raw);
  return `${value.toLocaleString('ru-RU')} ${p.symbol}`;
}

// ---------- списки, открытые в этом браузере ----------
// Нужны, чтобы при входе через Google перенести брони анонимного гостя со всех его списков.

const VISITED_KEY = 'wishlist.visited';

export function loadVisitedLists(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(VISITED_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberVisitedList(listId: string) {
  try {
    const list = loadVisitedLists().filter((id) => id !== listId);
    list.unshift(listId);
    localStorage.setItem(VISITED_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* приватный режим — ничего страшного */
  }
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
    if (t === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignore */
  }
}

export function shareUrl(listId: string): string {
  return `${location.origin}${location.pathname}#/list/${listId}`;
}

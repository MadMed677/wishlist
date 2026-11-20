import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Theme } from '../utils';
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from './icons';

const OPTIONS: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Светлая', Icon: SunIcon },
  { value: 'dark', label: 'Тёмная', Icon: MoonIcon },
  { value: 'auto', label: 'Авто (как в системе)', Icon: MonitorIcon },
];

/** Кнопка в шапке: меню из трёх вариантов темы. По умолчанию — «Авто». */
export function ThemeMenu({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2];

  // Закрыть по клику мимо меню и по Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    // фокус на выбранный пункт
    const idx = OPTIONS.findIndex((o) => o.value === theme);
    requestAnimationFrame(() => itemRefs.current[idx]?.focus());
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, theme]);

  const pick = (t: Theme) => {
    onChange(t);
    setOpen(false);
    buttonRef.current?.focus();
  };

  // Стрелки вверх/вниз двигают фокус по пунктам.
  // Работает и когда фокус ещё на кнопке: тогда отсчёт идёт от выбранного пункта.
  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    e.preventDefault();
    const focused = itemRefs.current.findIndex((el) => el === document.activeElement);
    const base = focused >= 0 ? focused : OPTIONS.findIndex((o) => o.value === theme);
    const next = (base + (e.key === 'ArrowDown' ? 1 : -1) + OPTIONS.length) % OPTIONS.length;
    itemRefs.current[next]?.focus();
  };

  const label = `Тема: ${current.label.toLowerCase()}`;

  return (
    <div className="menu-wrap" ref={wrapRef} onKeyDown={onMenuKey}>
      <button
        ref={buttonRef}
        className="icon-btn"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <current.Icon />
      </button>
      {open && (
        <div className="menu" role="menu" aria-label="Тема оформления">
          {OPTIONS.map((o, i) => {
            const on = o.value === theme;
            return (
              <button
                key={o.value}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className={`menu-item t-small${on ? ' is-selected' : ''}`}
                role="menuitemradio"
                aria-checked={on}
                onClick={() => pick(o.value)}
              >
                <o.Icon size={18} />
                <span>{o.label}</span>
                {on && <CheckIcon size={16} strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

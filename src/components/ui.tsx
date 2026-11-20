import { useEffect, useState, type ReactNode } from 'react';
import { inAppBrowser } from '../account';
import { AlertIcon, CloseIcon } from './icons';

export function Spinner({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="spinner-wrap t-small" role="status">
      <span className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="error t-small" role="alert">
      <AlertIcon />
      <span>{children}</span>
    </div>
  );
}

/** Ссылку открыли внутри Telegram/Instagram…: Google там вход не пускает — просим открыть в браузере. */
export function InAppHint() {
  const [app] = useState(inAppBrowser);
  const [copied, setCopied] = useState(false);
  if (!app) return null;
  const copy = () => {
    navigator.clipboard
      ?.writeText(location.href)
      .then(() => setCopied(true))
      .catch(() => {});
  };
  return (
    <div className="inapp-hint t-small" role="note">
      <AlertIcon />
      <div>
        <p>
          Ссылка открыта внутри {app} — тут Google может не пустить. Открой её в Safari или Chrome (меню ⋯ → «Открыть в
          браузере») и войди там.
        </p>
        <button className="btn btn-sm" type="button" onClick={copy}>
          {copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
        </button>
      </div>
    </div>
  );
}

/** Шторка снизу на телефоне, модальное окно по центру на десктопе. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden />
        <div className="sheet-head">
          <h2 className="t-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  );
}

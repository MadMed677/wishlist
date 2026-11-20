import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { errorText } from '../firebase';
import { MessageIcon, PlusIcon } from './icons';
import { ErrorBox } from './ui';

export const WISHES_MAX = 1000;

/** Подсказки-заготовки: вставляют начало строки в поле пожеланий. */
const STARTERS = [
  { label: 'Что люблю', text: 'Люблю: ' },
  { label: 'Что не дарить', text: 'Не дарите: ' },
  { label: 'Размеры', text: 'Размеры: ' },
  { label: 'Бюджет', text: 'Бюджет: ' },
];

/** Голубой блок с пожеланиями автора. Длинный текст сворачивается до нескольких строк. */
export function WishesCard({
  title,
  text,
  action,
  footer,
  compact = false,
}: {
  title: string;
  text: string;
  action?: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const lines = text.split('\n').length;
  const long = compact ? text.length > 140 || lines > 3 : text.length > 280 || lines > 5;

  return (
    <section className={`wishes${compact ? ' wishes-compact' : ''}`} aria-label={title}>
      <div className="wishes-head">
        <span className="wishes-title t-label">
          <MessageIcon size={compact ? 16 : 18} />
          {title}
        </span>
        {action}
      </div>
      <p className={`wishes-text ${compact ? 't-small' : 't-body'}${long && !open ? ' is-clamped' : ''}`}>{text}</p>
      {long && (
        <button type="button" className="wishes-more t-label" onClick={() => setOpen((o) => !o)}>
          {open ? 'Свернуть' : 'Читать полностью'}
        </button>
      )}
      {footer}
    </section>
  );
}

/** Пустое состояние у автора: предложить написать пожелания. */
export function WishesEmpty({ onWrite }: { onWrite: () => void }) {
  return (
    <section className="wishes-empty" aria-label="Пожелания для гостей">
      <span className="wishes-title t-label">
        <MessageIcon size={18} />
        Пожелания для гостей
      </span>
      <p className="t-small muted">
        Расскажи, что тебе в целом нравится и чего дарить не стоит. Это поможет гостям, если они захотят подарить что-то
        не из списка.
      </p>
      <button className="btn btn-sm" onClick={onWrite} style={{ alignSelf: 'flex-start' }}>
        <PlusIcon size={14} strokeWidth={3} />
        Написать пожелания
      </button>
    </section>
  );
}

/** Поле пожеланий с подсказками и счётчиком — для формы создания и для шторки «Пожелания». */
export function WishesField({
  id,
  value,
  onChange,
  label = 'Пожелания для гостей',
  rows = 6,
  autoFocus = false,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label?: string;
  rows?: number;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (starter: string) => {
    const base = value.replace(/\s+$/, '');
    const next = (base ? `${base}\n` : '') + starter;
    onChange(next.slice(0, WISHES_MAX));
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  return (
    <div className="field">
      <label className="t-label" htmlFor={id}>
        {label}
      </label>
      <div className="chips-row" style={{ margin: '2px 0 4px' }}>
        {STARTERS.map((s) => (
          <button key={s.label} type="button" className="chip t-label" onClick={() => insert(s.text)}>
            <PlusIcon size={14} strokeWidth={2.6} />
            {s.label}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={WISHES_MAX}
        rows={rows}
        autoFocus={autoFocus}
        placeholder="Например: люблю кофе и настолки, не дарите одежду и сладкое…"
      />
      <span className="t-small muted" style={{ alignSelf: 'flex-end' }}>
        {value.length} / {WISHES_MAX}
      </span>
    </div>
  );
}

/** Содержимое шторки/окна «Пожелания». */
export function WishesForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string;
  onSubmit: (wishes: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(value.trim());
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <p className="t-body muted">
        Напиши, что тебе в целом нравится и чего дарить не стоит. Гости увидят это над списком — пригодится, если они
        захотят подарить что-то не из списка.
      </p>
      <WishesField id="wishes-edit" value={value} onChange={setValue} autoFocus />
      <ErrorBox>{error}</ErrorBox>
      <div className="form-actions">
        <button type="button" className="btn desktop-only" onClick={onCancel}>
          Отмена
        </button>
        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
          {busy ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
}

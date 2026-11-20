import { useState, type FormEvent } from 'react';
import { errorText } from '../firebase';
import type { GiftData } from '../types';
import { safeUrl } from '../utils';
import { EyeOffIcon } from './icons';
import { ErrorBox } from './ui';
import { WishesCard } from './Wishes';

const EMPTY: GiftData = { title: '', description: '', url: '', price: '' };

export function GiftForm({
  ownerName,
  wishes,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  ownerName: string;
  wishes?: string;
  initial?: GiftData;
  submitLabel: string;
  onSubmit: (data: GiftData) => Promise<void>;
  onCancel: () => void;
}) {
  const [data, setData] = useState<GiftData>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bad, setBad] = useState<Partial<Record<'title' | 'url', string>>>({});
  const set = (key: keyof GiftData, value: string) => {
    setData((d) => ({ ...d, [key]: value }));
    setBad((b) => (key in b ? { ...b, [key]: undefined } : b));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const title = data.title.trim();
    const url = data.url.trim() ? safeUrl(data.url) : '';
    const errs: typeof bad = {};
    if (!title) errs.title = 'Напиши, что даришь.';
    if (url === null) errs.url = 'Ссылка выглядит странно. Начни её с https://';
    if (Object.keys(errs).length) return setBad(errs);
    setBusy(true);
    setError('');
    try {
      await onSubmit({ title, description: data.description.trim(), url: url ?? '', price: data.price.trim() });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      {wishes && <WishesCard compact title={`${ownerName || 'Автор'} просит учесть`} text={wishes} />}
      <div className="note t-small">
        <EyeOffIcon />
        <span>{ownerName || 'Автор'} этого не увидит. Видно только другим гостям — чтобы никто не купил то же самое.</span>
      </div>
      <label className="field">
        <span className="t-label">Что даришь *</span>
        <input
          className="input"
          id="gift-title"
          value={data.title}
          onChange={(e) => set('title', e.target.value)}
          maxLength={200}
          aria-invalid={!!bad.title}
          autoFocus
        />
        {bad.title && <span className="field-error">{bad.title}</span>}
      </label>
      <label className="field">
        <span className="t-label">Комментарий</span>
        <textarea className="input"
          id="gift-description"
          value={data.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={2000}
          rows={2}
        />
      </label>
      <div className="form-grid-2">
        <label className="field">
          <span className="t-label">Ссылка</span>
          <input className="input"
            id="gift-url"
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={data.url}
            onChange={(e) => set('url', e.target.value)}
            maxLength={2000}
            placeholder="https://…"
            aria-invalid={!!bad.url}
          />
          {bad.url && <span className="field-error">{bad.url}</span>}
        </label>
        <label className="field">
          <span className="t-label">Примерная цена</span>
          <input className="input" id="gift-price" value={data.price} onChange={(e) => set('price', e.target.value)} maxLength={50} />
        </label>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <div className="form-actions">
        <button type="button" className="btn desktop-only" onClick={onCancel}>
          Отмена
        </button>
        <button className="btn btn-primary btn-lg" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? 'Сохраняю…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

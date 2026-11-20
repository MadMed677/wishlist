import { useState, type FormEvent } from 'react';
import type { GiftData } from '../types';
import { safeUrl } from '../utils';
import { errorText } from '../firebase';
import { ErrorBox } from './ui';

const EMPTY: GiftData = { title: '', description: '', url: '', price: '' };

export function GiftForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: GiftData;
  submitLabel: string;
  onSubmit: (data: GiftData) => Promise<void>;
}) {
  const [data, setData] = useState<GiftData>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof GiftData, value: string) => setData((d) => ({ ...d, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const title = data.title.trim();
    if (!title) return setError('Напиши, что даришь.');
    const url = data.url.trim() ? safeUrl(data.url) : '';
    if (url === null) return setError('Ссылка выглядит странно.');
    setBusy(true);
    setError('');
    try {
      await onSubmit({ title, description: data.description.trim(), url, price: data.price.trim() });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <p className="muted small">Автор списка этого не увидит — только другие гости, чтобы не купить то же самое.</p>
      <label>
        <span>Что даришь *</span>
        <input value={data.title} onChange={(e) => set('title', e.target.value)} maxLength={200} required autoFocus />
      </label>
      <label>
        <span>Комментарий</span>
        <textarea value={data.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} rows={2} />
      </label>
      <label>
        <span>Ссылка</span>
        <input
          type="url"
          inputMode="url"
          value={data.url}
          onChange={(e) => set('url', e.target.value)}
          maxLength={2000}
          placeholder="https://…"
        />
      </label>
      <label>
        <span>Примерная цена</span>
        <input value={data.price} onChange={(e) => set('price', e.target.value)} maxLength={50} />
      </label>
      <ErrorBox>{error}</ErrorBox>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? 'Сохраняю…' : submitLabel}
      </button>
    </form>
  );
}

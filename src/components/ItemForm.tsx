import { useState, type FormEvent } from 'react';
import type { ItemData, Priority } from '../types';
import { PRIORITIES, safeUrl } from '../utils';
import { errorText } from '../firebase';
import { ErrorBox } from './ui';

const EMPTY: ItemData = { title: '', description: '', url: '', imageUrl: '', price: '', priority: 2 };

export function ItemForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: ItemData;
  submitLabel: string;
  onSubmit: (data: ItemData) => Promise<void>;
}) {
  const [data, setData] = useState<ItemData>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof ItemData>(key: K, value: ItemData[K]) => setData((d) => ({ ...d, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const title = data.title.trim();
    if (!title) return setError('Напиши название.');
    const url = data.url.trim() ? safeUrl(data.url) : '';
    const imageUrl = data.imageUrl.trim() ? safeUrl(data.imageUrl) : '';
    if (url === null) return setError('Ссылка на товар выглядит странно.');
    if (imageUrl === null) return setError('Ссылка на картинку выглядит странно.');
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        title,
        description: data.description.trim(),
        url,
        imageUrl,
        price: data.price.trim(),
        priority: data.priority,
      });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <label>
        <span>Название *</span>
        <input value={data.title} onChange={(e) => set('title', e.target.value)} maxLength={200} required autoFocus />
      </label>

      <fieldset className="priority-picker">
        <legend>Насколько хочется</legend>
        {PRIORITIES.map((p) => (
          <label key={p.value} className={data.priority === p.value ? 'chip chip-on' : 'chip'}>
            <input
              type="radio"
              name="priority"
              checked={data.priority === p.value}
              onChange={() => set('priority', p.value as Priority)}
            />
            {p.emoji} {p.label}
          </label>
        ))}
      </fieldset>

      <label>
        <span>Комментарий</span>
        <textarea
          value={data.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Размер, цвет, модель…"
        />
      </label>
      <label>
        <span>Ссылка на товар</span>
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
        <span>Ссылка на картинку</span>
        <input
          type="url"
          inputMode="url"
          value={data.imageUrl}
          onChange={(e) => set('imageUrl', e.target.value)}
          maxLength={2000}
          placeholder="https://…/photo.jpg"
        />
      </label>
      <label>
        <span>Примерная цена</span>
        <input value={data.price} onChange={(e) => set('price', e.target.value)} maxLength={50} placeholder="≈ 3 000 ₽" />
      </label>

      <ErrorBox>{error}</ErrorBox>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? 'Сохраняю…' : submitLabel}
      </button>
    </form>
  );
}

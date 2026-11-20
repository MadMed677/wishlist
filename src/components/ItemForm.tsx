import { useState, type FormEvent } from 'react';
import { errorText } from '../firebase';
import type { ItemData, Priority } from '../types';
import { PRIORITIES, safeUrl } from '../utils';
import { ErrorBox } from './ui';

const EMPTY: ItemData = { title: '', description: '', url: '', imageUrl: '', price: '', priority: 2 };

export function ItemForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: ItemData;
  submitLabel: string;
  onSubmit: (data: ItemData) => Promise<void>;
  onCancel: () => void;
}) {
  const [data, setData] = useState<ItemData>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bad, setBad] = useState<Partial<Record<'title' | 'url' | 'imageUrl', string>>>({});

  const set = <K extends keyof ItemData>(key: K, value: ItemData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    setBad((b) => (key in b ? { ...b, [key]: undefined } : b));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const title = data.title.trim();
    const url = data.url.trim() ? safeUrl(data.url) : '';
    const imageUrl = data.imageUrl.trim() ? safeUrl(data.imageUrl) : '';
    const errs: typeof bad = {};
    if (!title) errs.title = 'Напиши название.';
    if (url === null) errs.url = 'Ссылка выглядит странно. Начни её с https://';
    if (imageUrl === null) errs.imageUrl = 'Ссылка выглядит странно. Начни её с https://';
    if (Object.keys(errs).length) return setBad(errs);
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        title,
        description: data.description.trim(),
        url: url ?? '',
        imageUrl: imageUrl ?? '',
        price: data.price.trim(),
        priority: data.priority,
      });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className="field">
        <span className="t-label">Название *</span>
        <input className="input"
          id="item-title"
          value={data.title}
          onChange={(e) => set('title', e.target.value)}
          maxLength={200}
          aria-invalid={!!bad.title}
          autoFocus
        />
        {bad.title && <span className="field-error">{bad.title}</span>}
      </label>

      <fieldset className="chips">
        <legend className="t-label">Насколько хочется</legend>
        {PRIORITIES.map((p) => (
          <label key={p.value} className={`chip t-label${data.priority === p.value ? ' chip-on' : ''}`}>
            <input
              type="radio"
              name="priority"
              checked={data.priority === p.value}
              onChange={() => set('priority', p.value as Priority)}
            />
            {p.label}
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span className="t-label">Комментарий</span>
        <textarea className="input"
          id="item-description"
          value={data.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder="Размер, цвет, модель…"
        />
      </label>
      <label className="field">
        <span className="t-label">Ссылка на товар</span>
        <input className="input"
          id="item-url"
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
      <div className="form-grid-2">
        <label className="field">
          <span className="t-label">Картинка (URL)</span>
          <input className="input"
            id="item-image"
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={data.imageUrl}
            onChange={(e) => set('imageUrl', e.target.value)}
            maxLength={2000}
            placeholder="https://…jpg"
            aria-invalid={!!bad.imageUrl}
          />
          {bad.imageUrl && <span className="field-error">{bad.imageUrl}</span>}
        </label>
        <label className="field">
          <span className="t-label">Примерная цена</span>
          <input className="input"
            id="item-price"
            value={data.price}
            onChange={(e) => set('price', e.target.value)}
            maxLength={50}
            placeholder="≈ 15 000 ₸"
          />
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

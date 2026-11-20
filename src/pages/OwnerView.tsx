import { useCallback, useState, type FormEvent } from 'react';
import { addItem, deleteItem, updateItem, updateWishlist, useItems, useReservations } from '../api';
import { ItemCard } from '../components/ItemCard';
import { ItemForm } from '../components/ItemForm';
import { ErrorBox, Sheet, Spinner } from '../components/ui';
import { errorText } from '../firebase';
import type { Item, Wishlist } from '../types';
import { giftsWord, shareUrl } from '../utils';

type Editing = { kind: 'new' } | { kind: 'item'; item: Item } | { kind: 'list' } | null;

export function OwnerView({ list }: { list: Wishlist }) {
  const items = useItems(list.id);
  const reservations = useReservations(list.id);
  const reserved = new Set(reservations.data.map((r) => r.id));
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState('');
  const close = useCallback(() => setEditing(null), []);

  const remove = async (item: Item) => {
    const msg = reserved.has(item.id)
      ? `Удалить «${item.title}»? Его уже кто-то забронировал — бронь тоже пропадёт.`
      : `Удалить «${item.title}»?`;
    if (!confirm(msg)) return;
    setError('');
    try {
      await deleteItem(list.id, item.id, reserved.has(item.id));
    } catch (e) {
      setError(errorText(e));
    }
  };

  const reservedCount = items.data.filter((i) => reserved.has(i.id)).length;

  return (
    <>
      <ShareBox listId={list.id} />

      <div className="row-between">
        <p className="muted small">
          {items.data.length > 0 &&
            `${items.data.length} ${giftsWord(items.data.length)} в списке, занято: ${reservedCount}. Кто что дарит — секрет 🤫`}
        </p>
        <button className="btn btn-ghost btn-small" onClick={() => setEditing({ kind: 'list' })}>
          ✏️ Список
        </button>
      </div>

      <ErrorBox>{error || (items.error ? errorText(items.error) : '')}</ErrorBox>

      {items.loading ? (
        <Spinner />
      ) : items.data.length === 0 ? (
        <div className="card empty">
          <p>Список пока пуст. Добавь первое желание!</p>
        </div>
      ) : (
        <div className="items">
          {items.data.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              status={reserved.has(item.id) ? <p className="status status-taken">🎀 Занято</p> : null}
              footer={
                <>
                  <button className="btn btn-small" onClick={() => setEditing({ kind: 'item', item })}>
                    Изменить
                  </button>
                  <button className="btn btn-small btn-danger" onClick={() => remove(item)}>
                    Удалить
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setEditing({ kind: 'new' })} aria-label="Добавить желание">
        ＋ Желание
      </button>

      {editing?.kind === 'new' && (
        <Sheet title="Новое желание" onClose={close}>
          <ItemForm
            submitLabel="Добавить"
            onSubmit={async (data) => {
              await addItem(list.id, data);
              close();
            }}
          />
        </Sheet>
      )}
      {editing?.kind === 'item' && (
        <Sheet title="Изменить желание" onClose={close}>
          <ItemForm
            initial={editing.item}
            submitLabel="Сохранить"
            onSubmit={async (data) => {
              await updateItem(list.id, editing.item.id, data);
              close();
            }}
          />
        </Sheet>
      )}
      {editing?.kind === 'list' && (
        <Sheet title="Вишлист" onClose={close}>
          <ListForm list={list} onDone={close} />
        </Sheet>
      )}
    </>
  );
}

function ShareBox({ listId }: { listId: string }) {
  const url = shareUrl(listId);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Мой вишлист', url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Скопируй ссылку:', url);
    }
  };

  return (
    <section className="card share">
      <p className="small">Отправь эту ссылку друзьям:</p>
      <div className="share-row">
        <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Ссылка на вишлист" />
        <button className="btn btn-primary" onClick={share}>
          {copied ? 'Скопировано ✓' : 'Поделиться'}
        </button>
      </div>
    </section>
  );
}

function ListForm({ list, onDone }: { list: Wishlist; onDone: () => void }) {
  const [title, setTitle] = useState(list.title);
  const [eventDate, setEventDate] = useState(list.eventDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Название не может быть пустым.');
    setBusy(true);
    try {
      await updateWishlist(list.id, { title: title.trim(), eventDate });
      onDone();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <label>
        <span>Название</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
      </label>
      <label>
        <span>Дата события</span>
        <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
      </label>
      <ErrorBox>{error}</ErrorBox>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? 'Сохраняю…' : 'Сохранить'}
      </button>
    </form>
  );
}

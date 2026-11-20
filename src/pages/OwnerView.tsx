import { useCallback, useState, type FormEvent } from 'react';
import { addItem, deleteItem, updateItem, updateWishlist, useItems, useReservations } from '../api';
import { CheckIcon, ChevronLeftIcon, CopyIcon, PlusIcon, ShareIcon } from '../components/icons';
import { ItemCard, StatusReserved } from '../components/ItemCard';
import { ItemForm } from '../components/ItemForm';
import { ErrorBox, Sheet, Spinner } from '../components/ui';
import { errorText } from '../firebase';
import type { Item, Wishlist } from '../types';
import { shareUrl, wishesCount } from '../utils';
import { ListTitle } from './ListPage';

type Editing = { kind: 'new' } | { kind: 'item'; item: Item } | { kind: 'list' } | null;

export function OwnerView({ list }: { list: Wishlist }) {
  const items = useItems(list.id);
  const reservations = useReservations(list.id);
  const reserved = new Set(reservations.data.map((r) => r.id));
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState('');
  const close = useCallback(() => setEditing(null), []);

  const remove = async (item: Item) => {
    const isReserved = reserved.has(item.id);
    const msg = isReserved
      ? `Удалить «${item.title}»? Его уже кто-то забронировал — бронь тоже пропадёт.`
      : `Удалить «${item.title}»?`;
    if (!confirm(msg)) return;
    setError('');
    try {
      await deleteItem(list.id, item.id, isReserved);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const takenCount = items.data.filter((i) => reserved.has(i.id)).length;
  const openNew = () => setEditing({ kind: 'new' });

  return (
    <div className="list-layout">
      <aside className="list-aside">
        <a href="#/" className="t-small muted desktop-only" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ChevronLeftIcon size={16} />
          Мои вишлисты
        </a>
        <ListTitle list={list} showOwner={false} />
        <ShareBox listId={list.id} title={list.title} />
        <div className="row-between desktop-only" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <span className="t-small muted">
            {wishesCount(items.data.length)} · занято {takenCount}
          </span>
          <span className="t-small muted">Кто что дарит — секрет. Ты увидишь только «Занято».</span>
          <button className="btn btn-sm" style={{ marginTop: 4 }} onClick={() => setEditing({ kind: 'list' })}>
            Изменить название и дату
          </button>
        </div>
        <div className="row-between mobile-only">
          <span className="t-small muted">
            {items.data.length > 0
              ? `${wishesCount(items.data.length)} · занято: ${takenCount}. Кто что дарит — секрет`
              : 'Кто что дарит — секрет'}
          </span>
          <button className="btn btn-sm" onClick={() => setEditing({ kind: 'list' })}>
            Изменить список
          </button>
        </div>
      </aside>

      <section className="list-main">
        <div className="row-between desktop-only">
          <h2 className="t-title">Желания</h2>
          <button className="btn btn-primary" onClick={openNew}>
            <PlusIcon size={16} strokeWidth={2.6} />
            Добавить желание
          </button>
        </div>

        <ErrorBox>{error || (items.error ? errorText(items.error) : '')}</ErrorBox>

        {items.loading ? (
          <Spinner />
        ) : items.data.length === 0 ? (
          <div className="empty">
            <PlusIcon size={32} strokeWidth={1.8} />
            <span className="t-small">Список пока пуст. Добавь первое желание!</span>
          </div>
        ) : (
          <div className="items">
            {items.data.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                status={reserved.has(item.id) ? <StatusReserved>Занято</StatusReserved> : null}
                actions={
                  <div className="item-actions">
                    <button className="btn btn-sm" onClick={() => setEditing({ kind: 'item', item })}>
                      Изменить
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(item)}>
                      Удалить
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>

      <button className="fab t-button mobile-only" onClick={openNew}>
        <PlusIcon size={18} strokeWidth={2.6} />
        Желание
      </button>

      {editing?.kind === 'new' && (
        <Sheet title="Новое желание" onClose={close}>
          <ItemForm
            submitLabel="Добавить"
            onCancel={close}
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
            onCancel={close}
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
    </div>
  );
}

function ShareBox({ listId, title }: { listId: string; title: string }) {
  const url = shareUrl(listId);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Скопируй ссылку:', url);
    }
  };

  const share = async () => {
    if (canShare) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    await copy();
  };

  return (
    <section className="card stack" style={{ gap: 10 }}>
      <span className="t-small muted mobile-only">Отправь эту ссылку друзьям:</span>
      <span className="t-label desktop-only">Ссылка для друзей</span>
      <div className="share-row">
        <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Ссылка на вишлист" />
        <button className="btn btn-primary mobile-only" onClick={share}>
          {copied ? <CheckIcon size={16} /> : <ShareIcon size={16} />}
          {copied ? 'Скопировано' : 'Поделиться'}
        </button>
        <button className="btn btn-primary desktop-only" onClick={copy}>
          {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
          {copied ? 'Скопировано' : 'Скопировать ссылку'}
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
      <label className="field">
        <span className="t-label">Название</span>
        <input id="edit-list-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
      </label>
      <label className="field">
        <span className="t-label">Дата события</span>
        <input id="edit-list-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
      </label>
      <ErrorBox>{error}</ErrorBox>
      <div className="form-actions">
        <button type="button" className="btn desktop-only" onClick={onDone}>
          Отмена
        </button>
        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
          {busy ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
}

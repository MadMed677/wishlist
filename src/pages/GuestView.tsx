import { useCallback, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  addGuestGift,
  cancelReservation,
  deleteGuestGift,
  reserveItem,
  updateGuestGift,
  useGuestGifts,
  useItems,
  useReservationDetails,
  useReservations,
} from '../api';
import { GiftForm } from '../components/GiftForm';
import { ItemCard } from '../components/ItemCard';
import { ErrorBox, ExternalLink, Sheet, Spinner } from '../components/ui';
import { errorText, signInWithGoogle } from '../firebase';
import type { GuestGift, Item, Wishlist } from '../types';
import { hostOf, loadGuestName, safeUrl, saveGuestName } from '../utils';

export function GuestView({ list, user }: { list: Wishlist; user: User }) {
  const [name, setName] = useState(() => loadGuestName() || (!user.isAnonymous ? user.displayName ?? '' : ''));
  const [editingName, setEditingName] = useState(!loadGuestName());

  if (editingName || !name) {
    return (
      <NameForm
        initial={name}
        onSave={(n) => {
          saveGuestName(n);
          setName(n);
          setEditingName(false);
        }}
      />
    );
  }

  return <GuestList list={list} user={user} name={name} onChangeName={() => setEditingName(true)} />;
}

function NameForm({ initial, onSave }: { initial: string; onSave: (name: string) => void }) {
  const [value, setValue] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = value.trim();
    if (n) onSave(n);
  };
  return (
    <section className="card">
      <h2>Как тебя зовут?</h2>
      <p className="muted small">
        Имя увидят другие гости, когда ты забронируешь подарок. Автор списка не узнает, кто что дарит.
      </p>
      <form className="form" onSubmit={submit}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Например, Аня"
          maxLength={60}
          autoFocus
          required
          autoComplete="given-name"
        />
        <button className="btn btn-primary" type="submit">
          Продолжить
        </button>
      </form>
    </section>
  );
}

type Editing = { kind: 'newGift' } | { kind: 'gift'; gift: GuestGift } | null;

function GuestList({
  list,
  user,
  name,
  onChangeName,
}: {
  list: Wishlist;
  user: User;
  name: string;
  onChangeName: () => void;
}) {
  const items = useItems(list.id);
  const reservations = useReservations(list.id);
  const details = useReservationDetails(list.id, true);
  const gifts = useGuestGifts(list.id, true);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Editing>(null);
  const close = useCallback(() => setEditing(null), []);

  const resByItem = new Map(reservations.data.map((r) => [r.id, r]));
  const nameByItem = new Map(details.data.map((d) => [d.id, d.guestName]));

  const reserve = async (item: Item) => {
    setBusyItem(item.id);
    setError('');
    try {
      await reserveItem(list.id, item.id, user.uid, name);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(
        code === 'permission-denied'
          ? `Ой, «${item.title}» только что забронировал кто-то другой. Выбери что-нибудь ещё 🙂`
          : errorText(e),
      );
    } finally {
      setBusyItem(null);
    }
  };

  const cancel = async (item: Item) => {
    setBusyItem(item.id);
    setError('');
    try {
      await cancelReservation(list.id, item.id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyItem(null);
    }
  };

  const removeGift = async (gift: GuestGift) => {
    if (!confirm(`Удалить «${gift.title}»?`)) return;
    try {
      await deleteGuestGift(list.id, gift.id);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const myCount = reservations.data.filter((r) => r.uid === user.uid).length;

  return (
    <>
      <div className="row-between">
        <p className="muted small">
          Ты — <strong>{name}</strong>
          {myCount > 0 && <> · дарю: {myCount}</>}
        </p>
        <button className="btn btn-ghost btn-small" onClick={onChangeName}>
          Сменить имя
        </button>
      </div>

      <ErrorBox>{error || (items.error ? errorText(items.error) : '')}</ErrorBox>

      {items.loading ? (
        <Spinner />
      ) : items.data.length === 0 ? (
        <div className="card empty">
          <p>Автор пока ничего не добавил. Загляни позже — или подари что-то своё ниже.</p>
        </div>
      ) : (
        <div className="items">
          {items.data.map((item) => {
            const res = resByItem.get(item.id);
            const mine = res?.uid === user.uid;
            const who = nameByItem.get(item.id);
            const busy = busyItem === item.id;
            return (
              <ItemCard
                key={item.id}
                item={item}
                status={
                  res ? (
                    mine ? (
                      <p className="status status-mine">🎁 Это даришь ты</p>
                    ) : (
                      <p className="status status-taken">🎀 Дарит {who || 'кто-то из гостей'}</p>
                    )
                  ) : null
                }
                footer={
                  !res ? (
                    <button className="btn btn-primary" onClick={() => reserve(item)} disabled={busy}>
                      {busy ? '…' : 'Буду дарить это'}
                    </button>
                  ) : mine ? (
                    <button className="btn" onClick={() => cancel(item)} disabled={busy}>
                      {busy ? '…' : 'Отменить бронь'}
                    </button>
                  ) : null
                }
              />
            );
          })}
        </div>
      )}

      <section className="other-gifts">
        <div className="row-between">
          <h2>Я дарю другое</h2>
          <button className="btn btn-small btn-primary" onClick={() => setEditing({ kind: 'newGift' })}>
            ＋ Добавить
          </button>
        </div>
        <p className="muted small">
          Подарки не из списка. Автор их не видит — это видно только гостям, чтобы не купить одно и то же.
        </p>
        {gifts.error ? (
          <ErrorBox>{errorText(gifts.error)}</ErrorBox>
        ) : gifts.loading ? (
          <Spinner />
        ) : gifts.data.length === 0 ? (
          <p className="muted small">Пока никто не добавил.</p>
        ) : (
          <div className="items">
            {gifts.data.map((g) => {
              const url = safeUrl(g.url);
              const mine = g.uid === user.uid;
              return (
                <article key={g.id} className="card gift">
                  <div className="item-meta">
                    <span className="badge">{mine ? '🎁 Ты' : `🎁 ${g.guestName}`}</span>
                    {g.price && <span className="price">{g.price}</span>}
                  </div>
                  <h3 className="item-title">{g.title}</h3>
                  {g.description && <p className="item-desc">{g.description}</p>}
                  {url && (
                    <p className="item-link">
                      <ExternalLink href={url}>🔗 {hostOf(url)}</ExternalLink>
                    </p>
                  )}
                  {mine && (
                    <div className="item-actions">
                      <button className="btn btn-small" onClick={() => setEditing({ kind: 'gift', gift: g })}>
                        Изменить
                      </button>
                      <button className="btn btn-small btn-danger" onClick={() => removeGift(g)}>
                        Удалить
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {user.isAnonymous && <OwnerLogin />}

      {editing?.kind === 'newGift' && (
        <Sheet title="Я дарю другое" onClose={close}>
          <GiftForm
            submitLabel="Добавить"
            onSubmit={async (data) => {
              await addGuestGift(list.id, user.uid, name, data);
              close();
            }}
          />
        </Sheet>
      )}
      {editing?.kind === 'gift' && (
        <Sheet title="Изменить подарок" onClose={close}>
          <GiftForm
            initial={editing.gift}
            submitLabel="Сохранить"
            onSubmit={async (data) => {
              await updateGuestGift(list.id, editing.gift.id, data);
              close();
            }}
          />
        </Sheet>
      )}
    </>
  );
}

/** Для автора, открывшего свою ссылку на новом устройстве. */
function OwnerLogin() {
  const [error, setError] = useState('');
  const login = async () => {
    setError('');
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <footer className="owner-login">
      <button className="link-btn" onClick={login}>
        Это мой вишлист — войти через Google
      </button>
      <ErrorBox>{error}</ErrorBox>
    </footer>
  );
}

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
import { LinkIcon, PlusIcon } from '../components/icons';
import { ItemCard, StatusMine, StatusReserved } from '../components/ItemCard';
import { ErrorBox, ExternalLink, Sheet, Spinner } from '../components/ui';
import { errorText, signInWithGoogle } from '../firebase';
import type { GuestGift, Item, Wishlist } from '../types';
import { firstName, hostOf, loadGuestName, plural, safeUrl, saveGuestName } from '../utils';
import { ListTitle } from './ListPage';

export function GuestView({ list, user }: { list: Wishlist; user: User }) {
  const [name, setName] = useState(() => loadGuestName());
  const [askName, setAskName] = useState(() => !loadGuestName());
  const suggested = name || (!user.isAnonymous ? firstName(user.displayName ?? '') : '');

  const saveName = (n: string) => {
    saveGuestName(n);
    setName(n);
    setAskName(false);
  };

  if (askName || !name) {
    // Телефон: только карточка с именем. Десктоп: окно поверх списка.
    return (
      <div className="name-gate">
        <div className="name-gate-behind" aria-hidden>
          <GuestList list={list} user={user} name={name || '…'} onChangeName={() => {}} />
        </div>
        <div className="name-gate-overlay">
          <div className="mobile-only">
            <ListTitle list={list} showOwner />
          </div>
          <NameForm
            initial={suggested}
            ownerName={firstName(list.ownerName)}
            onSave={saveName}
            onCancel={name ? () => setAskName(false) : undefined}
          />
        </div>
      </div>
    );
  }

  return <GuestList list={list} user={user} name={name} onChangeName={() => setAskName(true)} />;
}

function NameForm({
  initial,
  ownerName,
  onSave,
  onCancel,
}: {
  initial: string;
  ownerName: string;
  onSave: (name: string) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = value.trim();
    if (n) onSave(n);
  };
  return (
    <section className="card card-raised name-card" role="dialog" aria-label="Как тебя зовут?" style={{ marginTop: 'var(--space-4)' }}>
      <h2 className="t-title">Как тебя зовут?</h2>
      <p className="t-body muted">
        Имя увидят другие гости, когда ты забронируешь подарок. {ownerName || 'Автор'} не узнает, кто что дарит.
      </p>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="t-label">Имя</span>
          <input
            id="guest-name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Например, Аня"
            maxLength={60}
            autoFocus
            required
            autoComplete="given-name"
          />
        </label>
        <button className="btn btn-primary btn-lg" type="submit">
          Продолжить
        </button>
        {onCancel && (
          <button className="btn" type="button" onClick={onCancel}>
            Отмена
          </button>
        )}
      </form>
      <p className="t-small muted" style={{ textAlign: 'center' }}>
        Регистрация не нужна. Имя запомнится на этом устройстве.
      </p>
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
  const owner = firstName(list.ownerName) || 'Автор';

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
          ? `Ой, «${item.title}» только что забронировал кто-то другой. Выбери что-нибудь ещё.`
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

  const myCount = items.data.filter((i) => resByItem.get(i.id)?.uid === user.uid).length;
  const myCountText = myCount > 0 ? `Даришь: ${myCount} ${plural(myCount, 'подарок', 'подарка', 'подарков')}` : 'Пока ничего не выбрано';

  return (
    <div className="list-layout">
      <aside className="list-aside">
        <ListTitle list={list} showOwner />

        <section className="card row-between desktop-only">
          <span className="stack" style={{ gap: 2 }}>
            <span className="t-small muted">
              Ты — <strong style={{ color: 'var(--text)' }}>{name}</strong>
            </span>
            <span className="t-small muted">{myCountText}</span>
          </span>
          <button className="btn btn-sm" onClick={onChangeName}>
            Сменить имя
          </button>
        </section>
        <div className="row-between mobile-only">
          <span className="t-small muted">
            Ты — <strong style={{ color: 'var(--text)' }}>{name}</strong>
            {myCount > 0 && <> · дарю: {myCount}</>}
          </span>
          <button className="btn btn-sm" onClick={onChangeName}>
            Сменить имя
          </button>
        </div>

        <section className="stack desktop-only" style={{ gap: 10 }}>
          <h2 className="t-label">Как это работает</h2>
          <ul className="how-it-works">
            <li className="t-small">Выбери подарок и нажми «Буду дарить это» — другие гости увидят, что он занят.</li>
            <li className="t-small">{owner} видит только «Занято», без имён.</li>
            <li className="t-small">Даришь что-то не из списка — добавь в «Я дарю другое».</li>
          </ul>
        </section>

        {user.isAnonymous && (
          <div className="desktop-only">
            <OwnerLogin />
          </div>
        )}
      </aside>

      <section className="list-main">
        <h2 className="t-title desktop-only">Желания</h2>

        <ErrorBox>{error || (items.error ? errorText(items.error) : '')}</ErrorBox>

        {items.loading ? (
          <Spinner />
        ) : items.data.length === 0 ? (
          <div className="empty">
            <span className="t-small">{owner} пока ничего не добавил. Загляни позже — или подари что-то своё ниже.</span>
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
                        <StatusMine>Это даришь ты</StatusMine>
                      ) : (
                        <StatusReserved>Дарит {who || 'кто-то из гостей'}</StatusReserved>
                      )
                    ) : null
                  }
                  actions={
                    !res ? (
                      <button className="btn btn-primary btn-block" onClick={() => reserve(item)} disabled={busy}>
                        {busy ? 'Секунду…' : 'Буду дарить это'}
                      </button>
                    ) : mine ? (
                      <button className="btn btn-block" onClick={() => cancel(item)} disabled={busy}>
                        {busy ? 'Секунду…' : 'Отменить бронь'}
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
            <span className="stack" style={{ gap: 2 }}>
              <h2 className="t-title">Я дарю другое</h2>
              <span className="t-small muted desktop-only">Подарки не из списка. {owner} их не видит — только гости.</span>
            </span>
            <button className="btn btn-primary btn-sm" onClick={() => setEditing({ kind: 'newGift' })}>
              <PlusIcon size={14} strokeWidth={3} />
              Добавить
            </button>
          </div>
          <p className="t-small muted mobile-only">Подарки не из списка. {owner} их не видит — только гости.</p>
          {gifts.error ? (
            <ErrorBox>{errorText(gifts.error)}</ErrorBox>
          ) : gifts.loading ? (
            <Spinner />
          ) : gifts.data.length === 0 ? (
            <p className="t-small muted">Пока никто не добавил.</p>
          ) : (
            <div className="items">
              {gifts.data.map((g) => (
                <GiftCard
                  key={g.id}
                  gift={g}
                  mine={g.uid === user.uid}
                  onEdit={() => setEditing({ kind: 'gift', gift: g })}
                  onDelete={() => removeGift(g)}
                />
              ))}
            </div>
          )}
        </section>

        {user.isAnonymous && (
          <div className="mobile-only" style={{ alignSelf: 'center' }}>
            <OwnerLogin />
          </div>
        )}
      </section>

      {editing?.kind === 'newGift' && (
        <Sheet title="Я дарю другое" onClose={close}>
          <GiftForm
            ownerName={owner}
            submitLabel="Добавить"
            onCancel={close}
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
            ownerName={owner}
            initial={editing.gift}
            submitLabel="Сохранить"
            onCancel={close}
            onSubmit={async (data) => {
              await updateGuestGift(list.id, editing.gift.id, data);
              close();
            }}
          />
        </Sheet>
      )}
    </div>
  );
}

function GiftCard({
  gift,
  mine,
  onEdit,
  onDelete,
}: {
  gift: GuestGift;
  mine: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const url = safeUrl(gift.url);
  return (
    <article className="card gift">
      <div className="item-meta">
        <span className={`badge t-caption${mine ? ' badge-mine' : ''}`}>{mine ? 'Ты' : `Дарит ${gift.guestName}`}</span>
        {gift.price && <span className="price t-small">{gift.price}</span>}
      </div>
      <h3 className="item-title t-item">{gift.title}</h3>
      {gift.description && <p className="item-desc t-small">{gift.description}</p>}
      {url && (
        <ExternalLink href={url} className="item-link t-small">
          <LinkIcon size={14} />
          {hostOf(url)}
        </ExternalLink>
      )}
      {mine && (
        <div className="item-actions" style={{ paddingTop: 'var(--space-2)' }}>
          <button className="btn btn-sm" onClick={onEdit}>
            Изменить
          </button>
          <button className="btn btn-sm btn-danger" onClick={onDelete}>
            Удалить
          </button>
        </div>
      )}
    </article>
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
    <>
      <button className="link-btn" onClick={login}>
        Это мой вишлист — войти через Google
      </button>
      <ErrorBox>{error}</ErrorBox>
    </>
  );
}

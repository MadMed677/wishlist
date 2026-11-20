import { useCallback, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  addGuestGift,
  cancelReservation,
  deleteGuestGift,
  GroupGoneError,
  joinGroup,
  leaveGroup,
  startGroup,
  updateGroupNote,
  reserveItem,
  updateGuestGift,
  useGuestGifts,
  useItems,
  useReservationDetails,
  useReservations,
} from '../api';
import { GiftForm } from '../components/GiftForm';
import { GroupInfo, GroupNoteForm, GroupStartForm, groupMark } from '../components/Group';
import { LinkIcon, PlusIcon, UsersIcon } from '../components/icons';
import { CardMark, ItemCard } from '../components/ItemCard';
import { ErrorBox, ExternalLink, Sheet, Spinner } from '../components/ui';
import { WishesCard } from '../components/Wishes';
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
          <input className="input"
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

type Editing =
  | { kind: 'newGift' }
  | { kind: 'gift'; gift: GuestGift }
  | { kind: 'startGroup'; item: Item }
  | { kind: 'groupNote'; item: Item; note: string }
  | null;

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
  const detailsByItem = new Map(details.data.map((d) => [d.id, d]));

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

  const run = async (item: Item, action: () => Promise<unknown>, raceText?: string) => {
    setBusyItem(item.id);
    setError('');
    try {
      await action();
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(
        e instanceof GroupGoneError
          ? 'Этот сбор уже закрыт — все участники вышли.'
          : code === 'permission-denied' && raceText
            ? raceText
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

  const isMine = (itemId: string) => {
    const res = resByItem.get(itemId);
    if (!res) return false;
    if (res.group) return !!detailsByItem.get(itemId)?.members.some((m) => m.uid === user.uid);
    return res.uid === user.uid;
  };
  const myCount = items.data.filter((i) => isMine(i.id)).length;
  const myCountText = myCount > 0 ? `Даришь: ${myCount} ${plural(myCount, 'подарок', 'подарка', 'подарков')}` : 'Пока ничего не выбрано';

  return (
    <div className="list-layout">
      <aside className="list-aside">
        <ListTitle list={list} showOwner />
        {list.wishes && <WishesCard title={`Пожелания · ${owner}`} text={list.wishes} />}

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
            <li className="t-small">Дорого одному — нажми «Подарим вместе», и другие гости смогут скинуться с тобой.</li>
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
            <span className="t-small">В списке пока пусто. Загляни позже — или подари что-то своё ниже.</span>
          </div>
        ) : (
          <div className="items">
            {items.data.map((item) => {
              const res = resByItem.get(item.id);
              const det = detailsByItem.get(item.id);
              const busy = busyItem === item.id;

              // Общий подарок
              if (res?.group) {
                const members = det?.members ?? [];
                const joined = members.some((m) => m.uid === user.uid);
                const organizer = members[0]?.uid === user.uid;
                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    mark={groupMark(members, user.uid)}
                    actions={
                      <>
                        <GroupInfo item={item} members={members} note={det?.note ?? ''} noteBy={det?.noteBy ?? ''} myUid={user.uid} />
                        {!joined ? (
                          <button
                            className="btn btn-primary btn-block"
                            disabled={busy || !det}
                            onClick={() => run(item, () => joinGroup(list.id, item.id, user.uid, name))}
                          >
                            Присоединиться
                          </button>
                        ) : organizer ? (
                          <div className="item-actions">
                            <button
                              className="btn btn-sm"
                              onClick={() => setEditing({ kind: 'groupNote', item, note: det?.note ?? '' })}
                            >
                              Изменить комментарий
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              disabled={busy}
                              onClick={() => run(item, () => leaveGroup(list.id, item.id, user.uid))}
                            >
                              Выйти
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-block"
                            disabled={busy}
                            onClick={() => run(item, () => leaveGroup(list.id, item.id, user.uid))}
                          >
                            Выйти из сбора
                          </button>
                        )}
                      </>
                    }
                  />
                );
              }

              const mine = res?.uid === user.uid;
              return (
                <ItemCard
                  key={item.id}
                  item={item}
                  mark={
                    res
                      ? mine
                        ? { tone: 'mine', text: 'Это даришь ты' }
                        : { tone: 'reserved', text: `Дарит ${det?.guestName || 'кто-то из гостей'}` }
                      : null
                  }
                  actions={
                    !res ? (
                      <div className="two-buttons">
                        <button className="btn btn-primary" onClick={() => reserve(item)} disabled={busy}>
                          Буду дарить это
                        </button>
                        <button className="btn" onClick={() => setEditing({ kind: 'startGroup', item })} disabled={busy}>
                          <UsersIcon size={18} />
                          Подарим вместе
                        </button>
                      </div>
                    ) : mine ? (
                      <button className="btn btn-block" onClick={() => cancel(item)} disabled={busy}>
                        Отменить бронь
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

      {editing?.kind === 'startGroup' && (
        <Sheet title="Подарим вместе" onClose={close}>
          <GroupStartForm
            item={editing.item}
            ownerName={owner}
            onCancel={close}
            onSubmit={async (note) => {
              const item = editing.item;
              try {
                await startGroup(list.id, item.id, user.uid, name, note);
              } catch (e) {
                if ((e as { code?: string }).code === 'permission-denied') {
                  close();
                  setError(`Ой, «${item.title}» только что забронировал кто-то другой. Выбери что-нибудь ещё.`);
                  return;
                }
                throw e;
              }
              close();
            }}
          />
        </Sheet>
      )}
      {editing?.kind === 'groupNote' && (
        <Sheet title="Комментарий к сбору" onClose={close}>
          <GroupNoteForm
            initial={editing.note}
            onCancel={close}
            onSubmit={async (note) => {
              await updateGroupNote(list.id, editing.item.id, note, name);
              close();
            }}
          />
        </Sheet>
      )}
      {editing?.kind === 'newGift' && (
        <Sheet title="Я дарю другое" onClose={close}>
          <GiftForm
            ownerName={owner}
            wishes={list.wishes}
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
            wishes={list.wishes}
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
  const tone = mine ? 'mine' : 'reserved';
  return (
    <article className={`item gift item-${tone}`}>
      <CardMark mark={{ tone, text: mine ? 'Это даришь ты' : `Дарит ${gift.guestName}` }} />
      <div className="item-body">
        <div className="item-meta" style={{ alignItems: 'baseline' }}>
          <h3 className="item-title t-item">{gift.title}</h3>
          {gift.price && <span className="price t-small">{gift.price}</span>}
        </div>
        {gift.description && <p className="item-desc t-small">{gift.description}</p>}
        {url && (
          <ExternalLink href={url} className="item-link t-small">
            <LinkIcon size={14} />
            {hostOf(url)}
          </ExternalLink>
        )}
        {mine && (
          <div className="item-footer">
            <div className="item-actions">
              <button className="btn btn-sm" onClick={onEdit}>
                Изменить
              </button>
              <button className="btn btn-sm btn-danger" onClick={onDelete}>
                Удалить
              </button>
            </div>
          </div>
        )}
      </div>
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

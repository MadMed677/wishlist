import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import {
  addGuestGift,
  cancelReservation,
  deleteGuestGift,
  GroupGoneError,
  isReserved,
  joinGroup,
  leaveGroup,
  startGroup,
  updateGroupNote,
  reserveItem,
  updateGuestGift,
  useGuestGifts,
  useItems,
  useQuestionAuthors,
  useQuestions,
  useReservationDetails,
  useReservations,
} from '../api';
import { GiftForm } from '../components/GiftForm';
import { GroupInfo, GroupNoteForm, GroupStartForm, groupMark } from '../components/Group';
import { GoogleIcon, LinkIcon, PlusIcon, ShieldIcon, UsersIcon } from '../components/icons';
import { CardMark, ItemCard } from '../components/ItemCard';
import { QuestionsLink, QuestionsPanel, scopeTitle, useSeenAnswers, type QuestionScope } from '../components/Questions';
import { ErrorBox, ExternalLink, InAppHint, Sheet, Spinner } from '../components/ui';
import { WishesCard } from '../components/Wishes';
import { signInWithGoogle } from '../account';
import { errorText } from '../firebase';
import type { GuestGift, Item, Wishlist } from '../types';
import { firstName, hostOf, loadGuestName, plural, rememberVisitedList, safeUrl, saveGuestName } from '../utils';
import { ListTitle } from './ListPage';

export function GuestView({ list, user }: { list: Wishlist; user: User }) {
  const [name, setName] = useState(() => loadGuestName());
  const [askName, setAskName] = useState(() => !loadGuestName());
  // у привязанного анонима имя Google может лежать только в providerData
  const googleName = !user.isAnonymous
    ? firstName(user.displayName || user.providerData.find((p) => p.displayName)?.displayName || '')
    : '';
  const suggested = name || googleName;

  const saveName = (n: string) => {
    saveGuestName(n);
    setName(n);
    setAskName(false);
  };

  // Запоминаем список — чтобы при входе через Google перенести брони со всех списков.
  useEffect(() => rememberVisitedList(list.id), [list.id]);

  // Вошёл через Google на шаге с именем — имя берём из аккаунта, второй раз не спрашиваем.
  useEffect(() => {
    if (!name && googleName) saveName(googleName);
  }, [googleName]);

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
            offerGoogle={user.isAnonymous && !name}
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
  offerGoogle,
  onSave,
  onCancel,
}: {
  initial: string;
  ownerName: string;
  offerGoogle: boolean;
  onSave: (name: string) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [bad, setBad] = useState(false);
  const google = useGoogleSignIn();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = value.trim();
    if (n) onSave(n);
    else setBad(true);
  };
  return (
    <section className="card card-raised name-card" role="dialog" aria-label="Как тебя зовут?" style={{ marginTop: 'var(--space-4)' }}>
      <h2 className="t-title">{offerGoogle ? 'Привет! Как тебя представить?' : 'Как тебя зовут?'}</h2>
      <p className="t-body muted">
        Имя увидят другие гости, когда ты забронируешь подарок. {ownerName || 'Автор'} не узнает, кто что дарит.
      </p>
      {offerGoogle && (
        <>
          <button className="btn btn-primary btn-lg" onClick={google.signIn} disabled={google.busy} aria-busy={google.busy}>
            <GoogleIcon />
            Войти через Google
          </button>
          <p className="t-small muted" style={{ marginTop: -6 }}>
            Рекомендуем: твои брони сохранятся в аккаунте и не потеряются, а имя подставится само.
          </p>
          <InAppHint />
          <ErrorBox>{google.error}</ErrorBox>
          <div className="or-divider t-small" aria-hidden>
            или без входа
          </div>
        </>
      )}
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span className="t-label">Имя</span>
          <input
            className="input"
            id="guest-name"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setBad(false);
            }}
            placeholder="Например, Аня"
            maxLength={60}
            autoFocus={!offerGoogle}
            aria-invalid={bad}
            autoComplete="given-name"
          />
          {bad && <span className="field-error">Напиши имя — его увидят другие гости.</span>}
        </label>
        <button className={`btn btn-lg${offerGoogle ? '' : ' btn-primary'}`} type="submit">
          {offerGoogle ? 'Продолжить без входа' : 'Продолжить'}
        </button>
        {onCancel && (
          <button className="btn btn-ghost" type="button" onClick={onCancel}>
            Отмена
          </button>
        )}
      </form>
      {offerGoogle && (
        <p className="t-small muted" style={{ textAlign: 'center' }}>
          Без входа брони хранятся только в этом браузере.
        </p>
      )}
    </section>
  );
}

/** Вход через Google с сохранением броней: общий для шага с именем и карточки «Сохрани брони». */
function useGoogleSignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const signIn = async () => {
    setBusy(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, signIn };
}

/** Пока гость анонимный — настойчиво предлагаем привязать Google, иначе брони живут только в браузере. */
function SaveAccountBanner() {
  const google = useGoogleSignIn();
  return (
    <section className="save-banner" aria-label="Сохрани свои брони">
      <div className="save-banner-head">
        <ShieldIcon size={20} />
        <h2 className="t-label">Сохрани свои брони</h2>
      </div>
      <p className="t-small">
        Сейчас всё, что ты бронируешь, хранится только в этом браузере. Почистишь его или откроешь ссылку с другого
        телефона — и брони потеряются.
      </p>
      <button className="btn btn-primary btn-block" onClick={google.signIn} disabled={google.busy} aria-busy={google.busy}>
        <GoogleIcon />
        Войти через Google
      </button>
      <span className="t-small muted">Ничего не пропадёт: всё сделанное привяжется к аккаунту. Это твой список? Тоже входи здесь.</span>
      <InAppHint />
      <ErrorBox>{google.error}</ErrorBox>
    </section>
  );
}

type Editing =
  | { kind: 'newGift' }
  | { kind: 'gift'; gift: GuestGift }
  | { kind: 'startGroup'; item: Item }
  | { kind: 'groupNote'; item: Item; note: string }
  | { kind: 'questions'; scope: QuestionScope }
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
  const questions = useQuestions(list.id);
  const questionAuthors = useQuestionAuthors(list.id, true);
  const seen = useSeenAnswers();
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Editing>(null);
  const close = useCallback(() => setEditing(null), []);
  const owner = firstName(list.ownerName) || 'Автор';

  const resByItem = new Map(reservations.data.map((r) => [r.id, r]));

  // Вопросы: мои — по записям «кто спросил»; «Артём ответил» — новый ответ на мой вопрос.
  const myQuestionIds = new Set(questionAuthors.data.filter((a) => a.uid === user.uid).map((a) => a.id));
  const questionsFor = (itemId: string | null) => questions.data.filter((q) => q.itemId === itemId);
  const hasNewAnswer = (itemId: string | null) => questionsFor(itemId).some((q) => myQuestionIds.has(q.id) && seen.isNew(q));
  const questionsLink = (
    itemId: string | null,
    onOpen: () => void,
    extra: { emptyText?: string; prefix?: string; className?: string } = {},
  ) => (
    <QuestionsLink
      role="guest"
      questions={questionsFor(itemId)}
      ownerName={owner}
      hasNewAnswer={hasNewAnswer(itemId)}
      onOpen={onOpen}
      {...extra}
    />
  );
  const listQuestionsLink = questionsLink(null, () => setEditing({ kind: 'questions', scope: { kind: 'list' } }), {
    emptyText: 'Задать вопрос к списку',
    prefix: 'Вопросы к списку',
    className: 'q-link q-link-wishes',
  });
  const itemFooter = (item: Item) => questionsLink(item.id, () => setEditing({ kind: 'questions', scope: { kind: 'item', item } }));
  const detailsByItem = new Map(details.data.map((d) => [d.id, d]));

  // permission-denied бывает и при гонке (кто-то успел раньше), и когда на сервере старые правила.
  const deniedText = async (item: Item) =>
    (await isReserved(list.id, item.id))
      ? `Ой, «${item.title}» только что забронировал кто-то другой. Выбери что-нибудь ещё.`
      : 'Не получилось сохранить — сервер отклонил запрос. Попробуй ещё раз чуть позже; если не поможет, напиши автору списка.';

  const reserve = async (item: Item) => {
    setBusyItem(item.id);
    setError('');
    try {
      await reserveItem(list.id, item.id, user.uid, name);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'permission-denied' ? await deniedText(item) : errorText(e));
    } finally {
      setBusyItem(null);
    }
  };

  const run = async (item: Item, action: () => Promise<unknown>) => {
    setBusyItem(item.id);
    setError('');
    try {
      await action();
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(
        e instanceof GroupGoneError
          ? 'Этот сбор уже закрыт — все участники вышли.'
          : code === 'permission-denied'
            ? await deniedText(item)
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
        {user.isAnonymous && <SaveAccountBanner />}
        {list.wishes ? (
          <WishesCard title={`Пожелания · ${owner}`} text={list.wishes} footer={listQuestionsLink} />
        ) : (
          <section className="wishes">{listQuestionsLink}</section>
        )}

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
        <details className="how mobile-only">
          <summary className="t-label">Как это работает?</summary>
          <ul className="how-it-works">
            <li className="t-small">Выбери подарок и нажми «Буду дарить это» — другие гости увидят, что он занят.</li>
            <li className="t-small">Дорого одному — нажми «Подарим вместе», и другие гости смогут скинуться с тобой.</li>
            <li className="t-small">{owner} видит только «Занято», без имён.</li>
            <li className="t-small">Даришь что-то не из списка — добавь в «Я дарю другое».</li>
          </ul>
        </details>
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
                    footer={itemFooter(item)}
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
                  footer={itemFooter(item)}
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
                  setError(await deniedText(item));
                  return;
                }
                throw e;
              }
              close();
            }}
          />
        </Sheet>
      )}
      {editing?.kind === 'questions' && (
        <Sheet title={scopeTitle(editing.scope)} onClose={close}>
          <QuestionsPanel
            listId={list.id}
            role="guest"
            scope={editing.scope}
            questions={questions.data}
            authors={questionAuthors.data}
            items={items.data}
            ownerName={owner}
            uid={user.uid}
            guestName={name}
            onSeen={seen.markSeen}
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

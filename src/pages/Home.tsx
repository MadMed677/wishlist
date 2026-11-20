import { useState, type FormEvent } from 'react';
import { createWishlist, useItems, useMyWishlists, useReservations } from '../api';
import { useAuth } from '../auth';
import { CakeIcon, ChevronRightIcon, GoogleIcon } from '../components/icons';
import { CardMark } from '../components/ItemCard';
import { ErrorBox, Spinner } from '../components/ui';
import { WishesField } from '../components/Wishes';
import { errorText, signInWithGoogle, signOut, userDisplayName } from '../firebase';
import { navigate } from '../router';
import type { Wishlist } from '../types';
import { countdown, firstName, formatDate, wishesCount } from '../utils';

export function Home() {
  const { user } = useAuth();
  if (user === undefined) return <Spinner />;
  if (!user || user.isAnonymous) return <Landing />;
  return <MyLists uid={user.uid} name={userDisplayName(user)} />;
}

function Landing() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const login = async () => {
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

  return (
    <div className="landing">
      <section className="landing-main">
        <div className="landing-icon mobile-only">
          <CakeIcon size={36} strokeWidth={1.8} />
        </div>
        <h1 className="t-display mobile-only">Вишлист ко дню рождения</h1>
        <h1 className="t-hero desktop-only">Вишлист ко дню рождения</h1>
        <p className="t-body muted" style={{ maxWidth: 520 }}>
          Составь список желаний и отправь ссылку друзьям. Они договорятся, кто что дарит, а ты не узнаешь кто — сюрприз
          сохранится.
        </p>
        <button className="btn btn-primary btn-lg btn-block" onClick={login} disabled={busy}>
          <GoogleIcon />
          {busy ? 'Вхожу…' : 'Войти через Google'}
        </button>
        <ErrorBox>{error}</ErrorBox>
        <p className="t-small muted">Гостям входить не нужно — достаточно открыть ссылку на список.</p>
      </section>

      <section className="landing-preview desktop-only" aria-label="Пример списка глазами гостя">
        <div className="row-between" style={{ alignItems: 'baseline' }}>
          <span className="t-title">День рождения — 30!</span>
          <span className="t-small muted">через 24 дня</span>
        </div>
        <div className="preview-cards">
          <article className="item item-reserved">
            <CardMark mark={{ tone: 'reserved', text: 'Дарит Боря' }} />
            <div className="item-body">
              <span className="t-item">Наушники с шумодавом</span>
            </div>
          </article>
          <article className="item item-mine">
            <CardMark mark={{ tone: 'mine', text: 'Это даришь ты' }} />
            <div className="item-body">
              <span className="t-item">Ручная кофемолка</span>
            </div>
          </article>
          <article className="item">
            <div className="item-body">
              <span className="t-item">Настольная игра «Каркассон»</span>
              <span className="btn btn-primary btn-sm" aria-hidden>
                Буду дарить это
              </span>
            </div>
          </article>
        </div>
        <p className="t-small muted">Так список видят гости. Автор видит только «Занято», без имён.</p>
      </section>
    </div>
  );
}

function MyLists({ uid, name }: { uid: string; name: string }) {
  const lists = useMyWishlists(uid);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [wishes, setWishes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return setError('Придумай название.');
    setBusy(true);
    setError('');
    try {
      const id = await createWishlist(uid, name, t, eventDate, wishes.trim());
      navigate(`/list/${id}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  const hello = `Привет, ${firstName(name)}!`;

  return (
    <>
      <div className="row-between">
        <h1 className="t-display mobile-only">{hello}</h1>
        <h1 className="t-hero desktop-only">{hello}</h1>
        <button className="btn btn-sm mobile-only" onClick={() => signOut()}>
          Выйти
        </button>
      </div>

      <div className="lists-layout">
        <section className="create card card-raised">
          <h2 className="t-title">Новый вишлист</h2>
          <form className="form" onSubmit={create}>
            <label className="field">
              <span className="t-label">Название</span>
              <input
                id="list-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Мой день рождения"
                maxLength={200}
                required
              />
            </label>
            <label className="field">
              <span className="t-label">Дата события</span>
              <input id="list-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </label>
            <WishesField id="list-wishes" value={wishes} onChange={setWishes} rows={3} label="Пожелания для гостей (необязательно)" />
            <p className="t-small muted" style={{ marginTop: -6 }}>
              Что тебе в целом нравится и чего дарить не стоит. Можно дописать потом.
            </p>
            <ErrorBox>{error}</ErrorBox>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Создаю…' : 'Создать'}
            </button>
          </form>
        </section>

        <section className="lists">
          <h2 className="t-title">Мои вишлисты</h2>
          {lists.loading ? (
            <Spinner />
          ) : lists.error ? (
            <ErrorBox>{errorText(lists.error)}</ErrorBox>
          ) : lists.data.length === 0 ? (
            <p className="t-small muted">Пока ни одного — создай первый.</p>
          ) : (
            <div className="list-cards">
              {lists.data.map((l) => (
                <ListCard key={l.id} list={l} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ListCard({ list }: { list: Wishlist }) {
  return (
    <a className="card list-card" href={`#/list/${list.id}`}>
      <span className="stack" style={{ gap: 2 }}>
        <strong className="t-item">{list.title}</strong>
        {list.eventDate && (
          <span className="t-small muted">
            {formatDate(list.eventDate)} · {countdown(list.eventDate)}
          </span>
        )}
        <ListStats listId={list.id} />
      </span>
      <ChevronRightIcon />
    </a>
  );
}

function ListStats({ listId }: { listId: string }) {
  const items = useItems(listId);
  const reservations = useReservations(listId);
  if (items.loading) return null;
  const ids = new Set(items.data.map((i) => i.id));
  const taken = reservations.data.filter((r) => ids.has(r.id)).length;
  return (
    <span className="t-small muted desktop-only" style={{ paddingTop: 'var(--space-3)' }}>
      {wishesCount(items.data.length)} · занято {taken}
    </span>
  );
}

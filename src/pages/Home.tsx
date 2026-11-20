import { useState, type FormEvent } from 'react';
import { createWishlist, useMyWishlists } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, Spinner } from '../components/ui';
import { errorText, signInWithGoogle, signOut, userDisplayName } from '../firebase';
import { navigate } from '../router';
import { countdown, formatDate } from '../utils';

export function Home() {
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user === undefined) return <Spinner />;

  if (!user || user.isAnonymous) {
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
      <section className="card hero">
        <div className="hero-emoji">🎂</div>
        <h1>Вишлист ко дню рождения</h1>
        <p>
          Составь список желаний и отправь ссылку друзьям. Они договорятся, кто что дарит, а ты не узнаешь, кто именно —
          сюрприз сохранится.
        </p>
        <button className="btn btn-primary btn-wide" onClick={login} disabled={busy}>
          {busy ? 'Вхожу…' : 'Войти через Google'}
        </button>
        <ErrorBox>{error}</ErrorBox>
        <p className="muted small">Гостям входить не нужно — достаточно открыть ссылку на список.</p>
      </section>
    );
  }

  return <MyLists uid={user.uid} name={userDisplayName(user)} />;
}

function MyLists({ uid, name }: { uid: string; name: string }) {
  const lists = useMyWishlists(uid);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return setError('Придумай название.');
    setBusy(true);
    setError('');
    try {
      const id = await createWishlist(uid, name, t, eventDate);
      navigate(`/list/${id}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <>
      <section className="row-between">
        <h1>Привет, {name.split(' ')[0]}!</h1>
        <button className="btn btn-ghost btn-small" onClick={() => signOut()}>
          Выйти
        </button>
      </section>

      <section className="card">
        <h2>Новый вишлист</h2>
        <form className="form" onSubmit={create}>
          <label>
            <span>Название</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Мой день рождения 🎉"
              maxLength={200}
              required
            />
          </label>
          <label>
            <span>Дата события</span>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </label>
          <ErrorBox>{error}</ErrorBox>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Создаю…' : 'Создать'}
          </button>
        </form>
      </section>

      <section>
        <h2>Мои вишлисты</h2>
        {lists.loading ? (
          <Spinner />
        ) : lists.error ? (
          <ErrorBox>{errorText(lists.error)}</ErrorBox>
        ) : lists.data.length === 0 ? (
          <p className="muted">Пока ни одного — создай первый выше.</p>
        ) : (
          <ul className="list-links">
            {lists.data.map((l) => (
              <li key={l.id}>
                <a className="card list-link" href={`#/list/${l.id}`}>
                  <strong>{l.title}</strong>
                  {l.eventDate && (
                    <span className="muted small">
                      {formatDate(l.eventDate)} · {countdown(l.eventDate)}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

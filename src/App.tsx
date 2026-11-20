import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { GiftIcon } from './components/icons';
import { isFirebaseConfigured, signOut, userDisplayName } from './firebase';
import { Home } from './pages/Home';
import { ListPage } from './pages/ListPage';
import { useRoute } from './router';
import { applyTheme, firstName, loadTheme, type Theme } from './utils';
import { ThemeMenu } from './components/ThemeMenu';
import { CloseIcon } from './components/icons';

export function App() {
  const route = useRoute();
  const { user } = useAuth();
  const [theme, setTheme] = useState<Theme>(loadTheme);

  const changeTheme = (next: Theme) => {
    applyTheme(next);
    setTheme(next);
  };

  const author = user && !user.isAnonymous ? userDisplayName(user) : null;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/">
            <GiftIcon size={22} />
            Вишлист
          </a>
          <div className="topbar-actions">
            <ThemeMenu theme={theme} onChange={changeTheme} />
            {author && (
              <>
                <span className="user-chip desktop-only">
                  <span className="avatar t-label" aria-hidden>
                    {author.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="t-label">{firstName(author)}</span>
                </span>
                <button className="btn btn-sm desktop-only" onClick={() => signOut()}>
                  Выйти
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <Notice />
      <main className="page">
        {!isFirebaseConfigured ? (
          <div className="empty">
            <h2 className="t-title" style={{ color: 'var(--text)' }}>
              Firebase ещё не настроен
            </h2>
            <p className="t-small">
              Вставь конфиг Firebase-проекта в <code>src/firebase.ts</code> — пошаговая инструкция в README репозитория.
            </p>
          </div>
        ) : route.name === 'home' ? (
          <Home />
        ) : route.name === 'list' ? (
          <ListPage key={route.id} listId={route.id} />
        ) : (
          <div className="empty">
            <p className="t-small">Такой страницы нет.</p>
            <a className="btn" href="#/">
              На главную
            </a>
          </div>
        )}
      </main>
    </>
  );
}

/** Короткие сообщения внизу экрана (например, «брони перенесены на Google-аккаунт»). */
function Notice() {
  const [text, setText] = useState('');
  useEffect(() => {
    let timer = 0;
    const onNotice = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setText(''), 7000);
    };
    window.addEventListener('wishlist:notice', onNotice);
    return () => {
      window.removeEventListener('wishlist:notice', onNotice);
      window.clearTimeout(timer);
    };
  }, []);
  if (!text) return null;
  return (
    <div className="toast t-small" role="status">
      <span>{text}</span>
      <button className="icon-btn" aria-label="Закрыть" onClick={() => setText('')}>
        <CloseIcon size={18} />
      </button>
    </div>
  );
}

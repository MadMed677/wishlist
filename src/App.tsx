import { useState } from 'react';
import { useAuth } from './auth';
import { MoonIcon, GiftIcon, SunIcon } from './components/icons';
import { isFirebaseConfigured, signOut, userDisplayName } from './firebase';
import { Home } from './pages/Home';
import { ListPage } from './pages/ListPage';
import { useRoute } from './router';
import { applyTheme, firstName, loadTheme, resolvedTheme, type Theme } from './utils';

export function App() {
  const route = useRoute();
  const { user } = useAuth();
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const shown = resolvedTheme(theme);

  const toggleTheme = () => {
    const next: Theme = shown === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  const author = user && !user.isAnonymous ? userDisplayName(user) : null;
  const themeLabel = shown === 'dark' ? 'Светлая тема' : 'Тёмная тема';

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/">
            <GiftIcon size={22} />
            Вишлист
          </a>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={toggleTheme} title={themeLabel} aria-label={themeLabel}>
              {shown === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
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

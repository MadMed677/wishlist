import { useState } from 'react';
import { isFirebaseConfigured } from './firebase';
import { useRoute } from './router';
import { Home } from './pages/Home';
import { ListPage } from './pages/ListPage';
import { applyTheme, loadTheme, type Theme } from './utils';

const THEME_ICON: Record<Theme, string> = { auto: '🌓', light: '☀️', dark: '🌙' };
const THEME_NEXT: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };
const THEME_LABEL: Record<Theme, string> = { auto: 'Тема: как в системе', light: 'Тема: светлая', dark: 'Тема: тёмная' };

export function App() {
  const route = useRoute();
  const [theme, setTheme] = useState<Theme>(loadTheme);

  const toggleTheme = () => {
    const next = THEME_NEXT[theme];
    applyTheme(next);
    setTheme(next);
  };

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          🎁 Вишлист
        </a>
        <button className="icon-btn" onClick={toggleTheme} title={THEME_LABEL[theme]} aria-label={THEME_LABEL[theme]}>
          {THEME_ICON[theme]}
        </button>
      </header>

      <main className="content">
        {!isFirebaseConfigured ? (
          <div className="card notice">
            <h2>Firebase ещё не настроен</h2>
            <p>
              Вставь конфиг Firebase-проекта в <code>src/firebase.ts</code> — пошаговая инструкция в README репозитория.
            </p>
          </div>
        ) : route.name === 'home' ? (
          <Home />
        ) : route.name === 'list' ? (
          <ListPage key={route.id} listId={route.id} />
        ) : (
          <div className="card empty">
            <p>Такой страницы нет.</p>
            <a className="btn" href="#/">
              На главную
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

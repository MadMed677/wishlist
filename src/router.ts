import { useEffect, useState } from 'react';

export type Route = { name: 'home' } | { name: 'list'; id: string } | { name: 'notFound' };

function parse(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  if (path === '/' || path === '') return { name: 'home' };
  const m = path.match(/^\/list\/([A-Za-z0-9_-]+)\/?$/);
  if (m) return { name: 'list', id: m[1] };
  return { name: 'notFound' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parse(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string) {
  location.hash = path;
}

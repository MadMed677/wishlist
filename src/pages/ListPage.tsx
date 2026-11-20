import { useEffect, useState } from 'react';
import { useWishlist } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, Spinner } from '../components/ui';
import { errorText, signInGuest } from '../firebase';
import type { Wishlist } from '../types';
import { countdown, firstName, formatDate } from '../utils';
import { GuestView } from './GuestView';
import { OwnerView } from './OwnerView';

/** Одна страница списка: автор видит OwnerView, все остальные — GuestView. */
export function ListPage({ listId }: { listId: string }) {
  const { user } = useAuth();
  const [authError, setAuthError] = useState('');

  // Гость входит анонимно и незаметно.
  useEffect(() => {
    if (user === null) signInGuest().catch((e) => setAuthError(errorText(e)));
  }, [user]);

  const list = useWishlist(listId, !!user);

  if (authError) return <ErrorBox>Не получилось войти: {authError}</ErrorBox>;
  if (!user || list.loading) return <Spinner />;
  if (list.error) return <ErrorBox>{errorText(list.error)}</ErrorBox>;
  if (list.notFound || !list.data)
    return (
      <div className="empty">
        <p className="t-small">Такого вишлиста нет. Возможно, ссылка неполная.</p>
        <a className="btn" href="#/">
          На главную
        </a>
      </div>
    );

  return user.uid === list.data.ownerUid ? <OwnerView list={list.data} /> : <GuestView list={list.data} user={user} />;
}

/** Название, автор и дата — шапка боковой колонки. */
export function ListTitle({ list, showOwner }: { list: Wishlist; showOwner: boolean }) {
  // Имена не склоняем (Айгерим, Асель…), поэтому просто «Артём · дата».
  const owner = showOwner && list.ownerName ? firstName(list.ownerName) : '';
  return (
    <section className="list-title">
      <h1 className="t-hero">{list.title}</h1>
      {(owner || list.eventDate) && (
        <p className="t-small muted">
          {owner}
          {owner && list.eventDate && ' · '}
          {list.eventDate && (
            <>
              {formatDate(list.eventDate)} — <strong style={{ color: 'var(--text)' }}>{countdown(list.eventDate)}</strong>
            </>
          )}
        </p>
      )}
    </section>
  );
}

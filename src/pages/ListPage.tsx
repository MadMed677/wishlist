import { useEffect, useState } from 'react';
import { useWishlist } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, Spinner } from '../components/ui';
import { errorText, signInGuest } from '../firebase';
import type { Wishlist } from '../types';
import { countdown, formatDate } from '../utils';
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
      <div className="card empty">
        <p>Такого вишлиста нет. Возможно, ссылка неполная.</p>
        <a className="btn" href="#/">
          На главную
        </a>
      </div>
    );

  const isOwner = user.uid === list.data.ownerUid;
  return (
    <>
      <ListHeader list={list.data} />
      {isOwner ? <OwnerView list={list.data} /> : <GuestView list={list.data} user={user} />}
    </>
  );
}

function ListHeader({ list }: { list: Wishlist }) {
  return (
    <section className="list-header">
      <h1>{list.title}</h1>
      <p className="muted">
        {list.ownerName && <>от {list.ownerName}</>}
        {list.ownerName && list.eventDate && ' · '}
        {list.eventDate && (
          <>
            {formatDate(list.eventDate)} — <strong>{countdown(list.eventDate)}</strong>
          </>
        )}
      </p>
    </section>
  );
}

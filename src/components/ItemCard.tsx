import { useState, type ReactNode } from 'react';
import type { Item } from '../types';
import { hostOf, priorityLabel, safeUrl } from '../utils';
import { GiftIcon, LinkIcon } from './icons';
import { ExternalLink } from './ui';

/** Карточка пункта вишлиста. Статус брони и кнопки передаются снаружи. */
export function ItemCard({ item, status, actions }: { item: Item; status?: ReactNode; actions?: ReactNode }) {
  const url = safeUrl(item.url);
  const img = safeUrl(item.imageUrl);
  const [imgOk, setImgOk] = useState(true);
  const hasImg = !!img && imgOk;

  return (
    <article className="item">
      {hasImg ? (
        <div className="item-img">
          <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
        </div>
      ) : (
        <div className="item-img item-img-empty" aria-hidden>
          <GiftIcon size={28} strokeWidth={1.6} />
        </div>
      )}
      <div className="item-body">
        <div className="item-meta">
          <span className={`badge t-caption${item.priority === 1 ? ' badge-hot' : ''}`}>{priorityLabel(item.priority)}</span>
          {item.price && <span className="price t-small">{item.price}</span>}
        </div>
        <h3 className="item-title t-item">{item.title}</h3>
        {item.description && <p className="item-desc t-small">{item.description}</p>}
        {url && (
          <ExternalLink href={url} className="item-link t-small">
            <LinkIcon size={14} />
            {hostOf(url)}
          </ExternalLink>
        )}
        {(status || actions) && (
          <div className="item-footer">
            {status}
            {actions}
          </div>
        )}
      </div>
    </article>
  );
}

export function StatusReserved({ children }: { children: ReactNode }) {
  return <span className="status status-reserved t-small">{children}</span>;
}

export function StatusMine({ children }: { children: ReactNode }) {
  return <span className="status status-mine t-small">{children}</span>;
}

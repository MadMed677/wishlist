import { useState, type ReactNode } from 'react';
import type { Item } from '../types';
import { hostOf, priorityLabel, safeUrl } from '../utils';
import { CheckIcon, GiftIcon, LinkIcon, LockIcon } from './icons';
import { ExternalLink } from './ui';

/** Состояние брони, которое показывается полосой сверху карточки. */
export type ItemMark = { tone: 'reserved' | 'mine'; text: string } | null;

/** Карточка пункта вишлиста. Статус брони (`mark`) и кнопки передаются снаружи. */
export function ItemCard({ item, mark, actions }: { item: Item; mark?: ItemMark; actions?: ReactNode }) {
  const url = safeUrl(item.url);
  const img = safeUrl(item.imageUrl);
  const [imgOk, setImgOk] = useState(true);
  const hasImg = !!img && imgOk;

  return (
    <article className={`item${mark ? ` item-${mark.tone}` : ''}`}>
      {mark && (
        <div className={`item-mark item-mark-${mark.tone} t-small`}>
          {mark.tone === 'mine' ? <CheckIcon size={16} strokeWidth={2.4} /> : <LockIcon size={16} />}
          <span>{mark.text}</span>
        </div>
      )}
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
        {actions && <div className="item-footer">{actions}</div>}
      </div>
    </article>
  );
}

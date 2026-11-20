import { useState, type ReactNode } from 'react';
import type { Item } from '../types';
import { hostOf, priorityInfo, safeUrl } from '../utils';
import { ExternalLink } from './ui';

/** Карточка пункта вишлиста. Кнопки/статус передаются через `footer`. */
export function ItemCard({ item, status, footer }: { item: Item; status?: ReactNode; footer?: ReactNode }) {
  const url = safeUrl(item.url);
  const img = safeUrl(item.imageUrl);
  const [imgOk, setImgOk] = useState(true);
  const p = priorityInfo(item.priority);

  return (
    <article className={`card item prio-${item.priority}`}>
      {img && imgOk && (
        <div className="item-img">
          <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
        </div>
      )}
      <div className="item-body">
        <div className="item-meta">
          <span className={`badge badge-prio-${item.priority}`}>
            {p.emoji} {p.label}
          </span>
          {item.price && <span className="price">{item.price}</span>}
        </div>
        <h3 className="item-title">{item.title}</h3>
        {item.description && <p className="item-desc">{item.description}</p>}
        {url && (
          <p className="item-link">
            <ExternalLink href={url}>🔗 {hostOf(url)}</ExternalLink>
          </p>
        )}
        {status}
        {footer && <div className="item-actions">{footer}</div>}
      </div>
    </article>
  );
}

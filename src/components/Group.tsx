import { useState, type FormEvent } from 'react';
import { errorText } from '../firebase';
import type { GroupMember, Item } from '../types';
import { joinNames, plural, shareText } from '../utils';
import { UsersIcon } from './icons';
import type { ItemMark } from './ItemCard';
import { ErrorBox } from './ui';

export const NOTE_MAX = 300;

/** Текст полосы статуса у карточки со сбором. Имена не склоняем. */
export function groupMark(members: GroupMember[], myUid: string): NonNullable<ItemMark> {
  const me = members.find((m) => m.uid === myUid);
  const others = members.filter((m) => m.uid !== myUid).map((m) => m.name);
  if (!me) {
    return {
      tone: 'group',
      icon: 'users',
      text: others.length === 1 ? `Скидывается ${others[0]}` : `Скидываются ${joinNames(others)}`,
    };
  }
  const iAmOrganizer = members[0]?.uid === myUid;
  if (iAmOrganizer) {
    return {
      tone: 'group',
      icon: 'check',
      text: others.length ? `Ты собираешь · с тобой ${joinNames(others)}` : 'Сбор открыт · пока только ты',
    };
  }
  return {
    tone: 'group',
    icon: 'check',
    text: others.length === 1 ? `Ты и ${others[0]} скидываетесь` : `Ты, ${joinNames(others)} скидываетесь`,
  };
}

/** Участники, кто покупает, комментарий и примерная доля на каждого. */
export function GroupInfo({
  item,
  members,
  note,
  noteBy,
  myUid,
}: {
  item: Item;
  members: GroupMember[];
  note: string;
  noteBy: string;
  myUid: string;
}) {
  const joined = members.some((m) => m.uid === myUid);
  const organizer = members[0];
  const n = members.length;
  // Пока в сборе только ты — доля «с каждого» не имеет смысла.
  const share = joined && n < 2 ? null : shareText(item.price, joined ? n : n + 1);

  return (
    <div className="group-info">
      <div className="group-people">
        <span className="avatars" aria-hidden>
          {members.slice(0, 4).map((m) => (
            <span key={m.uid} className={`avatar-sm t-caption${m.uid === myUid ? ' avatar-me' : ''}`}>
              {(m.name || '?').slice(0, 1).toUpperCase()}
            </span>
          ))}
        </span>
        <span className="t-small muted">
          {n} {plural(n, 'участник', 'участника', 'участников')}
          {organizer && (organizer.uid === myUid ? ' · покупаешь ты' : ` · покупает ${organizer.name}`)}
        </span>
      </div>
      {note && (
        <p className="group-note t-small">
          <strong>{noteBy ? `${noteBy}:` : ''}</strong> {note}
        </p>
      )}
      {share && (
        <span className="t-small muted">
          {joined ? `≈ ${share} с каждого` : `Если присоединишься — примерно ${share} с каждого`}
        </span>
      )}
    </div>
  );
}

/** Содержимое шторки «Подарим вместе». */
export function GroupStartForm({
  item,
  ownerName,
  onSubmit,
  onCancel,
}: {
  item: Item;
  ownerName: string;
  onSubmit: (note: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(note.trim());
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  const steps = [
    'Ты открываешь сбор. Подарок помечается для других гостей как «Скидываются…», и к нему можно присоединиться.',
    'Ты организатор: обычно ты и покупаешь, а остальные переводят тебе свою часть.',
    `${ownerName || 'Автор'} увидит только «Занято» — ни участников, ни комментария.`,
  ];

  return (
    <form className="form" onSubmit={submit}>
      <div className="group-item row-between">
        <span className="t-item">{item.title}</span>
        {item.price && <span className="price t-small">{item.price}</span>}
      </div>
      <ol className="group-steps">
        {steps.map((s, i) => (
          <li key={i} className="t-small">
            <span className="step-num t-caption" aria-hidden>
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <label className="field">
        <span className="t-label">Комментарий для участников (необязательно)</span>
        <textarea
          id="group-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX}
          rows={3}
          placeholder="Например: покупаю я, скиньте на Kaspi до 10 декабря"
        />
      </label>
      <ErrorBox>{error}</ErrorBox>
      <div className="form-actions">
        <button type="button" className="btn desktop-only" onClick={onCancel}>
          Отмена
        </button>
        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
          <UsersIcon size={18} />
          {busy ? 'Открываю…' : 'Открыть сбор'}
        </button>
      </div>
    </form>
  );
}

/** Изменить комментарий сбора. */
export function GroupNoteForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string;
  onSubmit: (note: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [note, setNote] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(note.trim());
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <p className="t-small muted">Его видят все участники и другие гости. Автор списка — нет.</p>
      <label className="field">
        <span className="t-label">Комментарий для участников</span>
        <textarea
          id="group-note-edit"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX}
          rows={3}
          autoFocus
          placeholder="Например: покупаю я, скиньте на Kaspi до 10 декабря"
        />
      </label>
      <ErrorBox>{error}</ErrorBox>
      <div className="form-actions">
        <button type="button" className="btn desktop-only" onClick={onCancel}>
          Отмена
        </button>
        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
          {busy ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
}

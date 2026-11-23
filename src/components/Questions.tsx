import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { answerQuestion, askQuestion, deleteQuestion, editQuestion } from '../api';
import { errorText } from '../firebase';
import type { Item, Question, QuestionAuthor } from '../types';
import { plural } from '../utils';
import { ChevronRightIcon, EyeOffIcon, QuestionIcon } from './icons';
import { ErrorBox } from './ui';

export const QUESTION_MAX = 500;
export const ANSWER_MAX = 1000;

/** Что открыто в шторке «Вопросы»: вопросы к подарку, к списку целиком или все без ответа (у автора). */
export type QuestionScope = { kind: 'item'; item: Item } | { kind: 'list' } | { kind: 'unanswered' };

export const questionsCount = (n: number) => `${n} ${plural(n, 'вопрос', 'вопроса', 'вопросов')}`;

// ---------- «Артём ответил»: какие ответы гость уже видел (localStorage) ----------

const SEEN_KEY = 'wishlist.seenAnswers';

function loadSeen(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

/** Ответы на мои вопросы, которые я ещё не открывал. */
export function useSeenAnswers() {
  const [seen, setSeen] = useState(loadSeen);
  const isNew = useCallback((q: Question) => !!q.answer && seen[q.id] !== q.answeredAt, [seen]);
  const markSeen = useCallback((qs: Question[]) => {
    const fresh = qs.filter((q) => q.answer && seen[q.id] !== q.answeredAt);
    if (!fresh.length) return;
    const next = { ...loadSeen() };
    for (const q of fresh) next[q.id] = q.answeredAt;
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      /* приватный режим — просто не запоминаем */
    }
    setSeen(next);
  }, [seen]);
  return { isNew, markSeen };
}

// ---------- строка «Вопросы» внизу карточки и у пожеланий ----------

/**
 * Гость: «Задать вопрос» или «2 вопроса» (+ «Артём ответил»).
 * Автор: строки нет, пока нет вопросов; иначе «2 вопроса» + «1 без ответа».
 */
export function QuestionsLink({
  role,
  questions,
  ownerName,
  hasNewAnswer = false,
  emptyText = 'Задать вопрос',
  prefix = '',
  className = 'q-link',
  onOpen,
}: {
  role: 'owner' | 'guest';
  questions: Question[];
  ownerName: string;
  hasNewAnswer?: boolean;
  emptyText?: string;
  prefix?: string; // «Вопросы к списку · 2» вместо «2 вопроса»
  className?: string;
  onOpen: () => void;
}) {
  const n = questions.length;
  if (role === 'owner' && n === 0) return null;
  const unanswered = questions.filter((q) => !q.answer).length;
  const label =
    n === 0
      ? emptyText
      : prefix
        ? role === 'owner' && unanswered > 0
          ? prefix // число уже на метке «N без ответа»
          : `${prefix} · ${n}`
        : role === 'owner' && unanswered === 0
          ? `${questionsCount(n)} · ${n === 1 ? 'отвечен' : 'отвечены'}`
          : questionsCount(n);
  const muted = n === 0 || (role === 'owner' && unanswered === 0);
  return (
    <button type="button" className={`${className} t-label${muted ? ' q-link-muted' : ''}`} onClick={onOpen}>
      <QuestionIcon size={18} />
      <span className="q-link-text">{label}</span>
      {role === 'owner' && unanswered > 0 && <span className="q-badge t-caption">{unanswered} без ответа</span>}
      {role === 'guest' && hasNewAnswer && <span className="q-badge t-caption">{ownerName} ответил</span>}
      {n > 0 && <ChevronRightIcon size={18} />}
    </button>
  );
}

/** Автор: «2 вопроса без ответа» — над списком, ведёт в шторку со всеми неотвеченными. */
export function UnansweredBanner({ questions, items, onOpen }: { questions: Question[]; items: Item[]; onOpen: () => void }) {
  const open = questions.filter((q) => !q.answer);
  if (!open.length) return null;
  const titles = new Map(items.map((i) => [i.id, i.title]));
  const about: string[] = [];
  for (const q of open) {
    const label = q.itemId ? `«${titles.get(q.itemId) ?? 'подарок'}»` : 'список';
    if (!about.includes(label)) about.push(label);
  }
  const shown = about.slice(0, 2).join(' и ');
  const more = about.length > 2 ? ` и ещё ${about.length - 2}` : '';
  return (
    <button type="button" className="q-banner" onClick={onOpen}>
      <span className="q-banner-icon" aria-hidden>
        <QuestionIcon size={20} />
      </span>
      <span className="q-banner-text">
        <span className="t-label">
          {open.length} {plural(open.length, 'вопрос', 'вопроса', 'вопросов')} без ответа
        </span>
        <span className="t-small muted">
          Гости спрашивают про {shown}
          {more}
        </span>
      </span>
      <ChevronRightIcon size={20} />
    </button>
  );
}

// ---------- шторка «Вопросы» ----------

export function scopeTitle(scope: QuestionScope): string {
  return scope.kind === 'list' ? 'Вопросы к списку' : scope.kind === 'unanswered' ? 'Вопросы без ответа' : 'Вопросы';
}

export function QuestionsPanel({
  listId,
  role,
  scope,
  questions,
  authors = [],
  items,
  ownerName,
  uid,
  guestName = '',
  onSeen,
}: {
  listId: string;
  role: 'owner' | 'guest';
  scope: QuestionScope;
  questions: Question[];
  authors?: QuestionAuthor[];
  items: Item[];
  ownerName: string;
  uid: string;
  guestName?: string;
  onSeen?: (qs: Question[]) => void;
}) {
  // «Без ответа»: запоминаем список при открытии, чтобы отвеченный вопрос не исчезал из-под рук.
  const [openIds] = useState(() => new Set(questions.filter((q) => !q.answer).map((q) => q.id)));
  const shown = questions.filter((q) =>
    scope.kind === 'item' ? q.itemId === scope.item.id : scope.kind === 'list' ? q.itemId === null : openIds.has(q.id),
  );
  const authorById = new Map(authors.map((a) => [a.id, a]));
  const titles = new Map(items.map((i) => [i.id, i.title]));
  const [error, setError] = useState('');

  // Гость открыл вопросы — ответы на его вопросы считаем прочитанными.
  const mineAnswered = shown.filter((q) => q.answer && authorById.get(q.id)?.uid === uid);
  const seenKey = mineAnswered.map((q) => `${q.id}:${q.answeredAt}`).join(',');
  useEffect(() => {
    if (mineAnswered.length) onSeen?.(mineAnswered);
  }, [seenKey]);

  return (
    <div className="form">
      {scope.kind === 'item' && (
        <div className="q-subject">
          <span className="t-item">{scope.item.title}</span>
          {scope.item.price && <span className="price t-small">{scope.item.price}</span>}
        </div>
      )}
      {scope.kind === 'list' && role === 'guest' && (
        <p className="t-small muted">Общие вопросы — не про конкретный подарок: «можно деньгами?», «какой размер?».</p>
      )}
      {role === 'owner' && (
        <p className="q-hint t-small">
          <EyeOffIcon size={16} />
          <span>Ты не видишь, кто спросил, — так сюрприз сохранится. Ответ увидят все гости.</span>
        </p>
      )}

      {shown.length > 0 ? (
        <div className="q-list">
          {shown.map((q) => (
            <QuestionRow
              key={q.id}
              listId={listId}
              role={role}
              question={q}
              author={authorById.get(q.id)}
              mine={authorById.get(q.id)?.uid === uid}
              ownerName={ownerName}
              about={scope.kind === 'unanswered' ? (q.itemId ? `«${titles.get(q.itemId) ?? 'подарок'}»` : 'к списку') : ''}
              onError={setError}
            />
          ))}
        </div>
      ) : role === 'owner' ? (
        <p className="t-small muted">Вопросов нет.</p>
      ) : (
        <p className="t-small muted">Вопросов пока нет — спроси первым.</p>
      )}

      <ErrorBox>{error}</ErrorBox>

      {role === 'guest' && scope.kind !== 'unanswered' && (
        <AskForm
          listId={listId}
          itemId={scope.kind === 'item' ? scope.item.id : null}
          uid={uid}
          guestName={guestName}
          ownerName={ownerName}
        />
      )}
    </div>
  );
}

function QuestionRow({
  listId,
  role,
  question: q,
  author,
  mine,
  ownerName,
  about,
  onError,
}: {
  listId: string;
  role: 'owner' | 'guest';
  question: Question;
  author?: QuestionAuthor;
  mine: boolean;
  ownerName: string;
  about: string;
  onError: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    onError('');
    try {
      await action();
      setEditing(false);
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    const msg = role === 'owner' ? 'Удалить вопрос? Гости его больше не увидят.' : 'Удалить твой вопрос?';
    if (confirm(msg)) run(() => deleteQuestion(listId, q.id));
  };

  const who =
    role === 'owner'
      ? 'Гость спрашивает'
      : mine
        ? q.answer
          ? 'Твой вопрос'
          : 'Твой вопрос · ждёт ответа'
        : `${author?.guestName || 'Гость'} спрашивает`;

  const ownerOpen = role === 'owner' && !q.answer;

  return (
    <div className={`q-item${ownerOpen ? ' q-item-open' : ''}${mine && role === 'guest' ? ' q-item-mine' : ''}`}>
      <span className="t-caption muted">
        {who}
        {about && ` · ${about}`}
      </span>

      {role === 'guest' && mine && editing ? (
        <TextForm
          id={`q-edit-${q.id}`}
          label="Твой вопрос"
          initial={q.text}
          max={QUESTION_MAX}
          submitLabel="Сохранить"
          busy={busy}
          onSubmit={(text) => run(() => editQuestion(listId, q.id, text))}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <p className="q-text t-body">{q.text}</p>
      )}

      {q.answer && !(role === 'owner' && editing) && (
        <div className="q-answer">
          <span className="t-caption">{role === 'owner' ? 'Твой ответ' : `Ответ · ${ownerName}`}</span>
          <span className="t-small">{q.answer}</span>
        </div>
      )}
      {!q.answer && role === 'guest' && !mine && <span className="t-small muted">Ждёт ответа</span>}

      {role === 'owner' && (ownerOpen || editing) ? (
        <TextForm
          id={`q-answer-${q.id}`}
          label="Твой ответ"
          initial={q.answer}
          max={ANSWER_MAX}
          submitLabel="Ответить"
          busy={busy}
          onSubmit={(text) => run(() => answerQuestion(listId, q.id, text))}
          onCancel={editing ? () => setEditing(false) : undefined}
          extra={
            !editing && (
              <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>
                Удалить
              </button>
            )
          }
        />
      ) : role === 'owner' ? (
        <div className="item-actions">
          <button className="btn btn-sm" onClick={() => setEditing(true)} disabled={busy}>
            Изменить ответ
          </button>
          <button className="btn btn-sm btn-danger" onClick={remove} disabled={busy}>
            Удалить вопрос
          </button>
        </div>
      ) : mine && !editing ? (
        <div className="item-actions">
          {!q.answer && (
            <button className="btn btn-sm" onClick={() => setEditing(true)} disabled={busy}>
              Изменить
            </button>
          )}
          <button className="btn btn-sm btn-danger" onClick={remove} disabled={busy}>
            Удалить
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Поле + кнопка: ответ автора или правка своего вопроса. */
function TextForm({
  id,
  label,
  initial,
  max,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
  extra,
}: {
  id: string;
  label: string;
  initial: string;
  max: number;
  submitLabel: string;
  busy: boolean;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  extra?: ReactNode;
}) {
  const [value, setValue] = useState(initial);
  const [bad, setBad] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text) return setBad(true);
    onSubmit(text);
  };
  return (
    <form className="q-form" onSubmit={submit} noValidate>
      <label className="field">
        <span className="t-label">{label}</span>
        <textarea
          className="input"
          id={id}
          rows={2}
          value={value}
          maxLength={max}
          aria-invalid={bad}
          onChange={(e) => {
            setValue(e.target.value);
            setBad(false);
          }}
        />
        {bad && <span className="field-error">Напиши текст.</span>}
      </label>
      <div className="q-form-actions">
        <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Отмена
          </button>
        )}
        {extra}
      </div>
    </form>
  );
}

/** Форма гостя «Твой вопрос». */
function AskForm({
  listId,
  itemId,
  uid,
  guestName,
  ownerName,
}: {
  listId: string;
  itemId: string | null;
  uid: string;
  guestName: string;
  ownerName: string;
}) {
  const [value, setValue] = useState('');
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text) return setBad(true);
    setBusy(true);
    setError('');
    try {
      await askQuestion(listId, itemId, uid, guestName, text);
      setValue('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="q-ask" onSubmit={submit} noValidate>
      <label className="field">
        <span className="t-label">Твой вопрос</span>
        <textarea
          className="input"
          id="question-text"
          rows={2}
          value={value}
          maxLength={QUESTION_MAX}
          placeholder={itemId ? 'Например: подойдёт другая модель?' : 'Например: можно подарить деньгами?'}
          aria-invalid={bad}
          onChange={(e) => {
            setValue(e.target.value);
            setBad(false);
          }}
        />
        {bad && <span className="field-error">Напиши вопрос.</span>}
      </label>
      <p className="q-hint t-small">
        <EyeOffIcon size={16} />
        <span>{ownerName} увидит вопрос, но не узнает, кто спросил. Другие гости увидят твоё имя.</span>
      </p>
      <ErrorBox>{error}</ErrorBox>
      <button className="btn btn-primary btn-lg" type="submit" disabled={busy} aria-busy={busy}>
        {busy ? 'Отправляю…' : 'Отправить вопрос'}
      </button>
    </form>
  );
}

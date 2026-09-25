import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { IconName } from '../icons';
import { Button } from './Button';
import { Badge } from './Display';
import { Icon } from './Icon';
import { cx } from './utils';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'violet' | 'gray' | 'outline';

export function Timeline({ light, children, className }: { light?: boolean; children: ReactNode; className?: string }) {
  return <div className={cx('b24-timeline', light && 'b24-timeline--light', className)} role="feed">{children}</div>;
}

export interface TimelineItemProps {
  icon?: IconName;
  tone?: Tone;
  title: ReactNode;
  time?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  pinned?: boolean;
  className?: string;
  children?: ReactNode;
}
export function TimelineItem({ icon = 'info', tone = 'primary', title, time, actions, footer, pinned, className, children }: TimelineItemProps) {
  return (
    <article className={cx('b24-timeline__item', pinned && 'b24-timeline__item--pinned', className)}>
      <span className={cx('b24-timeline__icon', tone !== 'primary' && `b24-timeline__icon--${tone}`)} aria-hidden><Icon name={icon} /></span>
      <div className="b24-timeline__card">
        <header className="b24-timeline__header">
          <span className="b24-timeline__title">{title}</span>
          {time && <span className="b24-timeline__time">{time}</span>}
          {actions && <span className="b24-timeline__actions">{actions}</span>}
        </header>
        {children && <div className="b24-timeline__body">{children}</div>}
        {footer && <div className="b24-timeline__footer">{footer}</div>}
      </div>
    </article>
  );
}

export interface TimelineActivityProps extends Omit<TimelineItemProps, 'tone'> {
  done?: boolean;
  onToggle?: (done: boolean) => void;
  /** срок — «сегодня, 18:00»; overdue подсветит красным */
  deadline?: ReactNode;
  overdue?: boolean;
}
/** Дело: кружок «выполнить», срок, подсветка просрочки. */
export function TimelineActivity({ done, onToggle, deadline, overdue, icon = 'phone', title, time, actions, children, footer, className }: TimelineActivityProps) {
  return (
    <article className={cx('b24-timeline__item', 'b24-timeline__item--activity', overdue && !done && 'b24-timeline__item--overdue', done && 'b24-timeline__item--done', className)}>
      <span className={cx('b24-timeline__icon', done ? 'b24-timeline__icon--success' : overdue ? 'b24-timeline__icon--danger' : 'b24-timeline__icon--warning')} aria-hidden><Icon name={icon} /></span>
      <div className="b24-timeline__card">
        <header className="b24-timeline__header">
          <button type="button" role="checkbox" aria-checked={!!done} aria-label={done ? 'Вернуть в работу' : 'Выполнить'} className="b24-timeline__complete" onClick={() => onToggle?.(!done)}>
            <Icon name={done ? 'checkCircle' : 'circle'} />
          </button>
          <span className="b24-timeline__title">{title}</span>
          {time && <span className="b24-timeline__time">{time}</span>}
          {actions && <span className="b24-timeline__actions">{actions}</span>}
        </header>
        {children && <div className="b24-timeline__body">{children}</div>}
        {deadline && (
          <div className="b24-timeline__meta">
            <span className="b24-timeline__deadline">
              Срок: <Badge size="sm" tone={done ? 'gray' : overdue ? 'danger' : 'warning'}>{deadline}</Badge>
            </span>
          </div>
        )}
        {footer && <div className="b24-timeline__footer">{footer}</div>}
      </div>
    </article>
  );
}

export function TimelineDivider({ children, tone = 'primary' }: { children: ReactNode; tone?: 'primary' | 'success' | 'gray' }) {
  return <div className={cx('b24-timeline__divider', tone !== 'primary' && `b24-timeline__divider--${tone}`)} role="separator"><span>{children}</span></div>;
}

/* ── Композер ────────────────────────────────────────── */
export interface ComposerTab { id: string; label: ReactNode; placeholder?: string }
export interface TimelineComposerProps {
  tabs?: ComposerTab[];
  onSubmit: (text: string, tab: string) => void | Promise<void>;
  submitText?: string;
  /** доп. кнопки справа в футере (скрепка и т.п.) */
  tools?: ReactNode;
  className?: string;
}
export function TimelineComposer({ tabs = [{ id: 'comment', label: 'Комментарий', placeholder: 'Оставьте комментарий' }], onSubmit, submitText = 'Отправить', tools, className }: TimelineComposerProps) {
  const [tab, setTab] = useState(tabs[0].id);
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await onSubmit(value, tab);
      setText('');
      setExpanded(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cx('b24-composer', (expanded || text) && 'is-expanded', className)}>
      {tabs.length > 1 && (
        <div className="b24-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" className="b24-tabs__item" aria-selected={t.id === tab}
              onClick={() => { setTab(t.id); setExpanded(true); input.current?.focus(); }}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="b24-composer__body">
        <textarea
          ref={input}
          rows={1}
          className="b24-composer__input"
          placeholder={current.placeholder ?? 'Напишите…'}
          aria-label={typeof current.label === 'string' ? current.label : 'Сообщение'}
          value={text}
          onFocus={() => setExpanded(true)}
          onBlur={() => { if (!text.trim()) setExpanded(false); }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); } }}
        />
        <div className="b24-composer__footer">
          <Button variant="primary" size="sm" loading={busy} disabled={!text.trim()} onMouseDown={(e) => e.preventDefault()} onClick={submit}>{submitText}</Button>
          <Button variant="link" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => { setText(''); setExpanded(false); input.current?.blur(); }}>Отменить</Button>
          <span className="b24-composer__hint">Ctrl+Enter — отправить</span>
          {tools && <span className="b24-composer__footer-right">{tools}</span>}
        </div>
      </div>
    </div>
  );
}

export { formatTimelineTime } from '../js/timeline';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { enableKanbanDnd, readableTextColor, stagePicker, type KanbanMove, type KanbanQuickField, type StagePickerHandle, type StagePickerStage } from '../js/kanban';
import { Icon } from './Icon';
import { cx } from './utils';
import { t } from '../js/i18n';

export interface KanbanColumn {
  id: string;
  title: ReactNode;
  color?: string;
  /** подпись под шапкой: сумма «3 274 823 ₽» */
  total?: ReactNode;
  /** количество, если отличается от числа загруженных карточек */
  count?: number;
}

export interface KanbanProps<T> {
  columns: KanbanColumn[];
  /** карточки, сгруппированные по id колонки */
  items: Record<string, T[]>;
  getId: (item: T) => string | number;
  renderCard: (item: T, column: KanbanColumn) => ReactNode;
  /** перенос карточки; верните false, чтобы отменить */
  onMove?: (move: KanbanMove) => void | boolean | Promise<void | boolean>;
  canDrop?: (move: KanbanMove) => boolean;
  /** «+» в колонке */
  onAdd?: (columnId: string) => void;
  /** своя форма быстрого добавления, рендерится под «+» у колонки columnId */
  quickAdd?: { columnId: string; node: ReactNode } | null;
  /**
   * Встроенное быстрое добавление («+ Быстрый элемент», как на портале): круглый «+» под шапкой открывает форму
   * в колонке. Enter — сохранить (форма очищается и остаётся), Esc — закрыть. false или исключение — значения остаются.
   */
  onQuickAdd?: (columnId: string, values: Record<string, string>) => void | boolean | Promise<void | boolean>;
  /** поля формы быстрого добавления; по умолчанию «Название» (title) */
  quickAddFields?: KanbanQuickField[];
  onCardClick?: (item: T) => void;
  /** цвет полоски слева у карточки */
  getAccent?: (item: T) => string | undefined;
  /** Air-подложка (белые подписи) или светлая */
  light?: boolean;
  columnWidth?: number;
  height?: number | string;
  emptyText?: ReactNode;
  className?: string;
}

/** Применяет перенос к сгруппированному состоянию — удобно в onMove. */
export function applyKanbanMove<T>(items: Record<string, T[]>, move: KanbanMove, getId: (item: T) => string | number): Record<string, T[]> {
  const from = [...(items[move.from] ?? [])];
  const idx = from.findIndex((i) => String(getId(i)) === move.id);
  if (idx < 0) return items;
  const [card] = from.splice(idx, 1);
  const next = { ...items, [move.from]: from };
  const to = move.from === move.to ? from : [...(items[move.to] ?? [])];
  to.splice(Math.min(move.index, to.length), 0, card);
  next[move.to] = to;
  return next;
}

export function Kanban<T>({
  columns, items, getId, renderCard, onMove, canDrop, onAdd, quickAdd, onQuickAdd, quickAddFields, onCardClick, getAccent, light, columnWidth, height = 'calc(100vh - 220px)', emptyText, className,
}: KanbanProps<T>) {
  const [quickOpen, setQuickOpen] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onMove, canDrop });
  handlers.current = { onMove, canDrop };

  useEffect(() => {
    if (!boardRef.current) return;
    return enableKanbanDnd(boardRef.current, {
      mutateDom: false,
      onMove: (m) => handlers.current.onMove?.(m),
      canDrop: (m) => handlers.current.canDrop?.(m) ?? true,
    });
  }, []);

  return (
    <div
      ref={boardRef}
      className={cx('b24-kanban', light && 'b24-kanban--light', className)}
      style={{ height, ...(columnWidth ? { ['--b24-kanban-column-width' as string]: `${columnWidth}px` } : null) }}
      role="list"
      aria-label={t('Канбан')}
    >
      {columns.map((col) => {
        const list = items[col.id] ?? [];
        const style = col.color ? ({ '--column-color': col.color, '--column-text': readableTextColor(col.color) } as CSSProperties) : undefined;
        return (
          <section key={col.id} className="b24-kanban__column" data-column={col.id} style={style} role="listitem" aria-label={typeof col.title === 'string' ? col.title : undefined}>
            <header className="b24-kanban__header">
              <span className="b24-kanban__title">{col.title}</span>
              <span className="b24-kanban__count">{col.count ?? list.length}</span>
            </header>
            {col.total !== undefined && <div className="b24-kanban__total"><span>{col.total}</span></div>}
            {onQuickAdd ? (
              <button
                type="button" className="b24-kanban__add b24-kanban__add--round" aria-label={t('Быстрое добавление')} aria-expanded={quickOpen === col.id}
                onClick={() => setQuickOpen((v) => (v === col.id ? null : col.id))}
              >
                <Icon name="plus" />
              </button>
            ) : onAdd && (
              <button type="button" className="b24-kanban__add" aria-label={t('Добавить')} onClick={() => onAdd(col.id)}>
                <Icon name="plus" />
              </button>
            )}
            {onQuickAdd && quickOpen === col.id && (
              <QuickAddForm fields={quickAddFields} onSave={(values) => onQuickAdd(col.id, values)} onClose={() => setQuickOpen(null)} />
            )}
            {quickAdd?.columnId === col.id && <div className="b24-kanban__quick">{quickAdd.node}</div>}
            <div className="b24-kanban__items">
              {list.map((item) => (
                <KanbanCardShell key={getId(item)} id={String(getId(item))} accent={getAccent?.(item)} onClick={onCardClick ? () => onCardClick(item) : undefined}>
                  {renderCard(item, col)}
                </KanbanCardShell>
              ))}
              {!list.length && emptyText && <div className="b24-kanban__empty">{emptyText}</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function QuickAddForm({ fields, onSave, onClose }: {
  fields?: KanbanQuickField[];
  onSave: (values: Record<string, string>) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
}) {
  const list = fields?.length ? fields : [{ name: 'title', placeholder: t('Название'), required: true } as KanbanQuickField];
  const initial = () => Object.fromEntries(list.map((f) => [f.name, f.value ?? (f.type === 'select' ? f.options?.[0]?.value ?? '' : '')]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { formRef.current?.querySelector<HTMLElement>('input,select')?.focus(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = Object.fromEntries(list.map((f) => [f.name, (values[f.name] ?? '').trim()]));
    const missing = list.findIndex((f) => f.required && !trimmed[f.name]);
    if (missing >= 0) { formRef.current?.querySelectorAll<HTMLElement>('input,select')[missing]?.focus(); return; }
    setBusy(true); setError('');
    try {
      if ((await onSave(trimmed)) === false) return;
      setValues(initial());
      formRef.current?.querySelector<HTMLElement>('input,select')?.focus();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('Не удалось сохранить'));
    } finally { setBusy(false); }
  };

  return (
    <form ref={formRef} className={cx('b24-kanban__quick', busy && 'is-busy')} noValidate aria-label={t('Быстрое добавление')} onSubmit={submit}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } }}>
      {list.map((f) => f.type === 'select' ? (
        <select key={f.name} className="b24-select" name={f.name} aria-label={f.placeholder} value={values[f.name]} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}>
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input key={f.name} className="b24-input" name={f.name} type={f.type === 'number' ? 'number' : 'text'} placeholder={f.placeholder} aria-label={f.placeholder} autoComplete="off"
          value={values[f.name]} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
      ))}
      {error && <div className="b24-kanban__quick-error" role="alert">{error}</div>}
      <div className="b24-kanban__quick-actions">
        <button type="submit" className="b24-btn b24-btn--success b24-btn--xs" disabled={busy}>{t('Сохранить')}</button>
        <button type="button" className="b24-btn b24-btn--plain b24-btn--xs" onClick={onClose}>{t('Отмена')}</button>
      </div>
    </form>
  );
}

/* ── Выбор стадии в карточке ─────────────────────────── */
export interface StagePickerProps {
  stages: StagePickerStage[];
  value?: string;
  /** false или исключение — вернуть прежнюю стадию */
  onChange?: (id: string, prev: string | undefined) => void | boolean | Promise<void | boolean>;
  disabled?: boolean;
  label?: string;
  className?: string;
}

/** Строка стадий с прокруткой: цвет стадии фоном, выбранная — сплошным, текущая прокручивается в центр. */
export function StagePicker({ stages, value, onChange, disabled, label, className }: StagePickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<StagePickerHandle | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const key = JSON.stringify(stages) + String(disabled) + (label ?? '');

  useEffect(() => {
    if (!ref.current) return;
    const h = stagePicker(ref.current, { stages, value, disabled, label, onChange: (id, prev) => change.current?.(id, prev) });
    handle.current = h;
    return () => { h.destroy(); handle.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (handle.current && handle.current.getValue() !== value) handle.current.setValue(value);
  }, [value]);

  return <div ref={ref} className={cx('b24-stage-picker', className)} />;
}

function KanbanCardShell({ id, accent, onClick, children }: { id: string; accent?: string; onClick?: () => void; children: ReactNode }) {
  return (
    <div
      className="b24-kanban-card"
      data-id={id}
      style={accent ? ({ '--card-accent': accent } as CSSProperties) : undefined}
      tabIndex={0}
      role="button"
      aria-roledescription={t('Перетаскиваемая карточка. Alt+стрелки — переместить')}
      onClick={onClick}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ') && !e.altKey) { e.preventDefault(); onClick(); } }}
    >
      {children}
    </div>
  );
}

/* ── Содержимое карточки ─────────────────────────────── */
export interface KanbanCardProps {
  title: ReactNode;
  href?: string;
  price?: ReactNode;
  fields?: Array<{ label: ReactNode; value: ReactNode }>;
  footer?: ReactNode;
  footerRight?: ReactNode;
  children?: ReactNode;
}
export function KanbanCard({ title, href, price, fields, footer, footerRight, children }: KanbanCardProps) {
  return (
    <>
      <span style={{ display: 'contents' }}>
        {href ? <a className="b24-kanban-card__title" href={href} data-no-drag>{title}</a> : <span className="b24-kanban-card__title">{title}</span>}
        {price !== undefined && <span className="b24-kanban-card__price">{price}</span>}
        {fields?.map((f, i) => (
          <span key={i} className="b24-kanban-card__field">
            <span className="b24-kanban-card__label">{f.label}</span>
            <span className="b24-kanban-card__value">{f.value}</span>
          </span>
        ))}
        {children}
        {(footer || footerRight) && (
          <span className="b24-kanban-card__footer">
            <span>{footer}</span>
            <span>{footerRight}</span>
          </span>
        )}
      </span>
    </>
  );
}

export type { KanbanMove, KanbanQuickField, StagePickerStage };

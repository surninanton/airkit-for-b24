import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { enableKanbanDnd, readableTextColor, type KanbanMove } from '../js/kanban';
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
  /** форма быстрого добавления, рендерится под «+» у колонки addingTo */
  quickAdd?: { columnId: string; node: ReactNode } | null;
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
  columns, items, getId, renderCard, onMove, canDrop, onAdd, quickAdd, onCardClick, getAccent, light, columnWidth, height = 'calc(100vh - 220px)', emptyText, className,
}: KanbanProps<T>) {
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
            {onAdd && (
              <button type="button" className="b24-kanban__add" aria-label={t('Добавить')} onClick={() => onAdd(col.id)}>
                <Icon name="plus" />
              </button>
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

export type { KanbanMove };

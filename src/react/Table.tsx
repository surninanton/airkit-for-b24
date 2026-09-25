import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Checkbox } from './Form';
import { EmptyState, Loader } from './Display';
import { Icon } from './Icon';
import { cx } from './utils';

export type SortDir = 'ascending' | 'descending';
export interface SortState { key: string; dir: SortDir }

export interface Column<T> {
  key: string;
  title: ReactNode;
  render?: (row: T, index: number) => ReactNode;
  /** значение для сортировки (по умолчанию row[key]) */
  sortValue?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  numeric?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  selectable?: boolean;
  selected?: Array<string | number>;
  onSelectionChange?: (keys: Array<string | number>) => void;
  /** контролируемая сортировка; если onSortChange не задан — сортирует на клиенте */
  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  empty?: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  striped?: boolean;
  maxHeight?: number | string;
  className?: string;
}

export function DataTable<T>({
  columns, rows, rowKey, selectable, selected = [], onSelectionChange,
  sort: sortProp, onSortChange, onRowClick, loading, empty, footer, compact, striped, maxHeight, className,
}: DataTableProps<T>) {
  const [innerSort, setInnerSort] = useState<SortState | null>(null);
  const sort = sortProp !== undefined ? sortProp : innerSort;

  const sorted = useMemo(() => {
    if (!sort || onSortChange) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const get = col.sortValue ?? ((r: T) => (r as Record<string, unknown>)[col.key] as string | number);
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    return [...rows].sort((a, b) => {
      const va = get(a), vb = get(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : collator.compare(String(va ?? ''), String(vb ?? ''));
      return sort.dir === 'ascending' ? cmp : -cmp;
    });
  }, [rows, sort, columns, onSortChange]);

  const toggleSort = (key: string) => {
    const next: SortState = { key, dir: sort?.key === key && sort.dir === 'ascending' ? 'descending' : 'ascending' };
    if (onSortChange) onSortChange(next); else setInnerSort(next);
  };

  const keys = sorted.map(rowKey);
  const selectedSet = new Set(selected);
  const allChecked = keys.length > 0 && keys.every((k) => selectedSet.has(k));
  const someChecked = !allChecked && keys.some((k) => selectedSet.has(k));
  const toggleAll = () => onSelectionChange?.(allChecked ? [] : keys);
  const toggleOne = (k: string | number) =>
    onSelectionChange?.(selectedSet.has(k) ? selected.filter((x) => x !== k) : [...selected, k]);

  const colSpan = columns.length + (selectable ? 1 : 0);
  const alignStyle = (c: Column<T>): CSSProperties | undefined => (c.align && c.align !== 'left' ? { textAlign: c.align } : undefined);

  return (
    <div className={cx('b24-table-wrap', className)} style={{ maxHeight, position: 'relative' }}>
      <table className={cx('b24-table', compact && 'b24-table--compact', striped && 'b24-table--striped')}>
        <thead>
          <tr>
            {selectable && (
              <th className="b24-table__cell-check">
                <Checkbox aria-label="Выбрать все" checked={allChecked} indeterminate={someChecked} onChange={toggleAll} />
              </th>
            )}
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ width: c.width, ...alignStyle(c) }}
                className={cx(c.numeric && 'b24-table__num')}
                aria-sort={c.sortable ? (sort?.key === c.key ? sort.dir : 'none') : undefined}
                tabIndex={c.sortable ? 0 : undefined}
                onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                onKeyDown={c.sortable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(c.key); } } : undefined}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && !rows.length ? (
            <tr><td colSpan={colSpan}><Loader /></td></tr>
          ) : !sorted.length ? (
            <tr><td colSpan={colSpan} style={{ borderBottom: 0 }}>{empty ?? <EmptyState title="Ничего не найдено">Попробуйте изменить параметры фильтра</EmptyState>}</td></tr>
          ) : (
            sorted.map((row, i) => {
              const k = rowKey(row);
              const isSel = selectedSet.has(k);
              return (
                <tr
                  key={k}
                  aria-selected={selectable ? isSel : undefined}
                  onClick={onRowClick ? (e) => { if (!(e.target as HTMLElement).closest('a,button,input,label')) onRowClick(row); } : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {selectable && (
                    <td className="b24-table__cell-check">
                      <Checkbox aria-label="Выбрать строку" checked={isSel} onChange={() => toggleOne(k)} />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} style={alignStyle(c)} className={cx(c.numeric && 'b24-table__num')}>
                      {c.render ? c.render(row, i) : String((row as Record<string, unknown>)[c.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {loading && rows.length > 0 && <div className="b24-loader-overlay"><span className="b24-spinner" /></div>}
      {footer && <div className="b24-table-footer">{footer}</div>}
    </div>
  );
}

export interface PaginationProps {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}
export function Pagination({ page, pages, onChange }: PaginationProps) {
  if (pages <= 1) return null;
  const list: Array<number | '…'> = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) list.push(p);
    else if (list[list.length - 1] !== '…') list.push('…');
  }
  return (
    <nav className="b24-pagination" aria-label="Страницы">
      <button type="button" className="b24-pagination__item" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Назад"><Icon name="chevronLeft" size={16} /></button>
      {list.map((p, i) =>
        p === '…' ? <span key={`e${i}`} className="b24-pagination__item" aria-hidden>…</span> : (
          <button key={p} type="button" className="b24-pagination__item" aria-current={p === page ? 'page' : undefined} onClick={() => onChange(p)}>{p}</button>
        ),
      )}
      <button type="button" className="b24-pagination__item" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Вперёд"><Icon name="chevronRight" size={16} /></button>
    </nav>
  );
}

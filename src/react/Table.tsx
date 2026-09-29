import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from './Button';
import { Checkbox } from './Form';
import { EmptyState, Loader } from './Display';
import { Icon } from './Icon';
import { Dropdown, type MenuEntry } from './Overlay';
import { cx } from './utils';
import type { IconName } from '../icons';
import {
  clearGridState, enableColumnReorder, layoutWidths, loadGridState, measureColumn, moveColumn, normalizeGridState, saveGridState,
  round1, SERVICE_WIDTH, startColumnResize, type GridState,
} from '../js/grid-core';
import { confirm } from '../js/modal';

export type SortDir = 'ascending' | 'descending';
export interface SortState { key: string; dir: SortDir }

export interface Column<T> {
  key: string;
  title: ReactNode;
  /** подпись в меню ⚙ (если title — не строка) */
  label?: string;
  render?: (row: T, index: number) => ReactNode;
  /** значение для сортировки (по умолчанию row[key]) */
  sortValue?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  numeric?: boolean;
  /** скрыт по умолчанию (можно включить в ⚙) */
  hidden?: boolean;
}

export interface GroupAction<K> {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'tinted' | 'tinted-danger' | 'plain';
  icon?: IconName;
  /** текст подтверждения; {n} — количество отмеченных */
  confirm?: string;
  onClick: (keys: K[]) => void;
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
  /* ── грид ── */
  /** ключ для сохранения ширины/порядка/видимости столбцов в localStorage */
  stateKey?: string;
  /** менять ширину столбцов (двойной клик по ручке — по содержимому) */
  resizable?: boolean;
  /** перетаскивать столбцы */
  reorderable?: boolean;
  /** меню ⚙ с видимостью столбцов */
  columnSettings?: boolean;
  /** меню ☰ у строки */
  rowActions?: (row: T) => MenuEntry[];
  /** панель действий с отмеченными строками */
  groupActions?: Array<GroupAction<string | number>>;
  onGridStateChange?: (state: GridState) => void;
}

export function DataTable<T>({
  columns, rows, rowKey, selectable, selected = [], onSelectionChange,
  sort: sortProp, onSortChange, onRowClick, loading, empty, footer, compact, striped, maxHeight, className,
  stateKey, resizable, reorderable, columnSettings, rowActions, groupActions, onGridStateChange,
}: DataTableProps<T>) {
  const [innerSort, setInnerSort] = useState<SortState | null>(null);
  const sort = sortProp !== undefined ? sortProp : innerSort;
  const tableRef = useRef<HTMLTableElement>(null);
  const headRowRef = useRef<HTMLTableRowElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapWidth, setWrapWidth] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    setWrapWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWrapWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── состояние столбцов ── */
  const colKeys = columns.map((c) => c.key);
  const defaultHidden = columns.filter((c) => c.hidden).map((c) => c.key);
  const [grid, setGrid] = useState<GridState>(() => normalizeGridState(colKeys, loadGridState(stateKey), defaultHidden));
  const keysSig = colKeys.join('|');
  useEffect(() => { setGrid((g) => normalizeGridState(colKeys, g, defaultHidden)); }, [keysSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const gridCb = useRef(onGridStateChange);
  gridCb.current = onGridStateChange;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    saveGridState(stateKey, grid);
    gridCb.current?.(grid);
  }, [grid, stateKey]);

  const byKey = new Map(columns.map((c) => [c.key, c]));
  const visible = grid.order.map((k) => byKey.get(k)).filter((c): c is Column<T> => !!c && !grid.hidden.includes(c.key));
  const hasWidths = Object.keys(grid.widths).length > 0;

  /* ── перетаскивание столбцов ── */
  useEffect(() => {
    if (!reorderable || !headRowRef.current) return;
    return enableColumnReorder(headRowRef.current, {
      onReorder: (key, beforeKey) => setGrid((g) => ({ ...g, order: moveColumn(g.order, key, beforeKey) })),
    });
  }, [reorderable]);

  /** фактические ширины служебных столбцов, снятые при «заморозке» */
  const [serviceW, setServiceW] = useState<{ corner?: number; menu?: number }>({});
  /** перед первым изменением ширины «замораживаем» точные текущие ширины (до 0.1px), включая служебные */
  const freeze = (): Record<string, number> => {
    if (hasWidths || !headRowRef.current) return grid.widths;
    const w: Record<string, number> = {};
    headRowRef.current.querySelectorAll<HTMLElement>('th[data-key]').forEach((th) => { w[th.dataset.key!] = round1(th.getBoundingClientRect().width); });
    const corner = headRowRef.current.querySelector<HTMLElement>('.b24-datagrid__corner');
    const menu = headRowRef.current.querySelector<HTMLElement>('.b24-table__cell-menu');
    setServiceW({ corner: corner ? round1(corner.getBoundingClientRect().width) : undefined, menu: menu ? round1(menu.getBoundingClientRect().width) : undefined });
    return w;
  };
  const onResizeStart = (e: React.PointerEvent, key: string) => {
    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLElement;
    const base = freeze();
    setGrid((g) => ({ ...g, widths: base }));
    startColumnResize(e.nativeEvent, th, {
      onMove: (w) => setGrid((g) => ({ ...g, widths: { ...g.widths, [key]: w } })),
      onEnd: () => {},
    });
  };
  const onAutofit = (key: string) => {
    if (!tableRef.current) return;
    const base = freeze();
    const w = measureColumn(tableRef.current, key);
    setGrid((g) => ({ ...g, widths: { ...base, ...g.widths, [key]: w } }));
  };
  const cornerW = serviceW.corner ?? (columnSettings ? SERVICE_WIDTH.corner : SERVICE_WIDTH.check);
  const menuW = serviceW.menu ?? SERVICE_WIDTH.menu;
  const serviceTotal = (selectable || columnSettings ? cornerW : 0) + (rowActions ? menuW : 0);
  const layout = hasWidths ? layoutWidths(visible.map((c) => c.key), grid.widths, serviceTotal, wrapWidth) : null;
  const tableWidth = layout?.total;

  /* ── сортировка ── */
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

  /* ── выделение ── */
  const keys = sorted.map(rowKey);
  const selectedSet = new Set(selected);
  const allChecked = keys.length > 0 && keys.every((k) => selectedSet.has(k));
  const someChecked = !allChecked && keys.some((k) => selectedSet.has(k));
  const toggleAll = () => onSelectionChange?.(allChecked ? [] : keys);
  const toggleOne = (k: string | number) =>
    onSelectionChange?.(selectedSet.has(k) ? selected.filter((x) => x !== k) : [...selected, k]);

  const cornerCol = selectable || columnSettings;
  const colSpan = visible.length + (cornerCol ? 1 : 0) + (rowActions ? 1 : 0);
  const alignStyle = (c: Column<T>): CSSProperties | undefined => (c.align && c.align !== 'left' ? { textAlign: c.align } : undefined);

  const settingsMenu = columnSettings ? (
    <Dropdown
      placement="bottom-start"
      trigger={<button type="button" className="b24-table__settings" aria-label="Настройка столбцов" title="Настройка столбцов"><Icon name="settings" size={16} /></button>}
    >
      <div className="b24-grid-settings">
        <div className="b24-menu__title">Столбцы</div>
        <div className="b24-grid-settings__list">
          {grid.order.map((k) => {
            const c = byKey.get(k);
            if (!c) return null;
            const on = !grid.hidden.includes(k);
            const onlyOne = on && grid.order.length - grid.hidden.length === 1;
            return (
              <Checkbox
                key={k}
                label={c.label ?? (typeof c.title === 'string' ? c.title : k)}
                checked={on}
                disabled={onlyOne}
                onChange={(e) => setGrid((g) => ({ ...g, hidden: e.target.checked ? g.hidden.filter((x) => x !== k) : [...g.hidden, k] }))}
              />
            );
          })}
        </div>
        <div className="b24-grid-settings__footer">
          <Button variant="link" size="sm" onClick={() => { clearGridState(stateKey); setServiceW({}); setGrid(normalizeGridState(colKeys, null, defaultHidden)); }}>Сбросить настройки</Button>
        </div>
      </div>
    </Dropdown>
  ) : null;

  const runGroup = async (a: GroupAction<string | number>) => {
    if (!selected.length) return;
    if (a.confirm && !(await confirm(a.confirm.replace('{n}', String(selected.length)), { danger: a.variant?.includes('danger'), okText: a.label }))) return;
    a.onClick([...selected]);
  };

  return (
    <div ref={wrapRef} className={cx('b24-table-wrap', className)} style={{ maxHeight, position: 'relative' }}>
      <table
        ref={tableRef}
        className={cx('b24-table', 'b24-datagrid', hasWidths && 'b24-datagrid--fixed', compact && 'b24-table--compact', striped && 'b24-table--striped')}
        style={tableWidth ? { width: tableWidth } : undefined}
      >
        <colgroup>
          {cornerCol && <col style={{ width: hasWidths ? cornerW : undefined }} />}
          {rowActions && <col style={{ width: hasWidths ? menuW : undefined }} />}
          {visible.map((c) => <col key={c.key} data-col={c.key} style={{ width: layout ? layout.widths[c.key] : c.width }} />)}
        </colgroup>
        <thead>
          <tr ref={headRowRef}>
            {cornerCol && (
              <th className="b24-table__cell-check b24-datagrid__corner" data-fixed="">
                {selectable && <Checkbox aria-label="Выбрать все" checked={allChecked} indeterminate={someChecked} onChange={toggleAll} />}
                {settingsMenu}
              </th>
            )}
            {rowActions && <th className="b24-table__cell-menu" data-fixed="" />}
            {visible.map((c) => (
              <th
                key={c.key}
                data-key={c.key}
                data-col={c.key}
                style={alignStyle(c)}
                className={cx(c.numeric && 'b24-table__num', reorderable && 'b24-datagrid__draggable')}
                aria-sort={c.sortable ? (sort?.key === c.key ? sort.dir : 'none') : undefined}
                tabIndex={c.sortable ? 0 : undefined}
                onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                onKeyDown={c.sortable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(c.key); } } : undefined}
              >
                {c.title}
                {resizable && (
                  <span
                    className="b24-table__resizer"
                    aria-hidden="true"
                    title="Ширина столбца (двойной клик — по содержимому)"
                    onPointerDown={(e) => onResizeStart(e, c.key)}
                    onDoubleClick={(e) => { e.stopPropagation(); onAutofit(c.key); }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
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
              const menu = rowActions?.(row);
              return (
                <tr
                  key={k}
                  aria-selected={selectable ? isSel : undefined}
                  onClick={onRowClick ? (e) => { if (!(e.target as HTMLElement).closest('a,button,input,label')) onRowClick(row); } : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {cornerCol && (
                    <td className="b24-table__cell-check">
                      {selectable && <Checkbox aria-label="Выбрать строку" checked={isSel} onChange={() => toggleOne(k)} />}
                    </td>
                  )}
                  {rowActions && (
                    <td className="b24-table__cell-menu">
                      {menu && menu.length > 0 && (
                        <Dropdown
                          placement="bottom-start"
                          items={menu}
                          trigger={<button type="button" className="b24-table__row-menu" aria-label="Действия со строкой"><Icon name="menu" size={16} /></button>}
                        />
                      )}
                    </td>
                  )}
                  {visible.map((c) => (
                    <td key={c.key} data-col={c.key} style={alignStyle(c)} className={cx(c.numeric && 'b24-table__num')}>
                      {c.render ? c.render(row, i) : String((row as Record<string, unknown>)[c.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {groupActions && selected.length > 0 && (
        <div className="b24-grid-actions" role="toolbar" aria-label="Действия с отмеченными">
          <span className="b24-grid-actions__count">Отмечено: {selected.length} из {rows.length}</span>
          {groupActions.map((a) => (
            <Button key={a.id} size="sm" variant={a.variant ?? 'secondary'} icon={a.icon} onClick={() => void runGroup(a)}>{a.label}</Button>
          ))}
          <Button variant="link" size="sm" className="b24-grid-actions__clear" onClick={() => onSelectionChange?.([])}>Снять выделение</Button>
        </div>
      )}
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

import { icon, type IconName } from '../icons';
import { h, html } from './dom';
import { dropdown, type DropdownHandle } from './dropdown';
import {
  applyStickyColumns, clearGridState, enableColumnGuide, enableColumnReorder, layoutWidths, loadGridState, measureColumn, normalizeGridState,
  reorderWithPins, round1, saveGridState, SERVICE_WIDTH, startColumnResize, togglePinned, type GridState,
} from './grid-core';
import { confirm } from './modal';
import { datepicker, type DatePickerHandle } from './calendar';
import { escapeHtml, frameAnchorY, isInFrame } from './dom';
import { intlLocale, t } from './i18n';

/**
 * Грид в стиле main.ui.grid поверх обычной HTML-таблицы (удобно для PHP):
 *
 *   <div class="b24-table-wrap">
 *     <table class="b24-table" data-b24-grid="deals" data-b24-sortable>
 *       <thead><tr>
 *         <th class="b24-table__cell-check"><label class="b24-check"><input type="checkbox" data-b24-check-all></label></th>
 *         <th data-key="title" aria-sort="none">Сделка</th> …
 *       </tr></thead>
 *       <tbody><tr data-id="42">…</tr></tbody>
 *     </table>
 *     <script type="application/json">{ "rowActions": […], "groupActions": […] }</script>
 *   </div>
 *
 * Столбцы с data-key можно перетаскивать, менять ширину (двойной клик по ручке — по содержимому),
 * скрывать через ⚙. Состояние хранится в localStorage под ключом data-b24-grid.
 * События: b24:grid-change { state }, b24:row-action { action, id, row }, b24:group-action { action, ids, scope },
 * b24:page-change { page, pageSize }, b24:page-size-change { pageSize }, b24:load-more { respond(rows) }.
 */

export interface GridRowAction { id: string; label: string; icon?: IconName; danger?: boolean }
export interface GridGroupAction {
  id: string;
  /** подпись; {n} — отмечено, {total} — всего по фильтру */
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'tinted' | 'tinted-danger' | 'plain';
  icon?: IconName;
  /** текст подтверждения ({n}, {total}) — перед событием спросить confirm; без него подтверждение — на стороне приложения */
  confirm?: string;
  /** когда показывать: есть отмеченные (по умолчанию), ничего не отмечено («по фильтру») или всегда */
  when?: 'selected' | 'none' | 'always';
  /** выключить кнопку (например, фильтр не задан); функция пересчитывается при каждом обновлении панели */
  disabled?: boolean | ((ctx: { selected: number; total: number | null }) => boolean);
  /** подсказка у кнопки — особенно у выключенной */
  hint?: string;
}

/** Постраничный вывод в подвале; данные отдаёт сервер */
export interface GridPagination {
  page: number;
  pageSize: number;
  /** всего записей; null — неизвестно (ссылка «Показать количество» при onCountRequest) */
  total?: number | null;
  /** варианты «На странице» (по умолчанию 20, 50, 100, 200, 500) */
  pageSizes?: number[];
  /** номера страниц, «Показать ещё» или оба (по умолчанию pages, при onLoadMore — both) */
  mode?: 'pages' | 'more' | 'both';
  /** есть ли ещё строки для «Показать ещё», если total неизвестен */
  hasMore?: boolean;
}

export type CellEditType = 'text' | 'number' | 'select' | 'date';
export interface CellEditConfig { type: CellEditType; options?: Array<{ value: string; label: string }> }

export interface CellEditContext {
  id: string;
  key: string;
  value: string;
  oldValue: string;
  row: HTMLTableRowElement;
  cell: HTMLTableCellElement;
}

export interface GridOptions {
  /** ключ для localStorage; без него состояние не сохраняется */
  id?: string;
  resizable?: boolean;
  reorderable?: boolean;
  /** меню ⚙ с видимостью столбцов */
  settings?: boolean;
  /** скрытые по умолчанию столбцы (или th[data-hidden]) */
  hidden?: string[];
  /** закреплённые по умолчанию столбцы (или th[data-pinned]) */
  pinned?: string[];
  /** меню ☰ у строки; какие пункты показывать конкретной строке — tr[data-actions="edit,delete"] */
  rowActions?: GridRowAction[];
  groupActions?: GridGroupAction[];
  /** панель действий: появляется при отметке (auto) или видна всегда; по умолчанию always, если есть действия «по фильтру» или пагинация */
  actionPanel?: 'auto' | 'always';
  /** всего записей по фильтру — «Всего: N» в подвале */
  total?: number | null;
  /** посчитать total по запросу: вместо числа — ссылка «Показать количество» */
  onCountRequest?: () => Promise<number>;
  pagination?: GridPagination;
  onPageChange?: (page: number) => void;
  /** размер страницы запоминается в localStorage вместе с состоянием грида */
  onPageSizeChange?: (size: number) => void;
  /** «Показать ещё»: вернуть строки (HTML <tr>…, массив tr) и, если известно, есть ли ещё */
  onLoadMore?: () => Promise<string | HTMLTableRowElement[] | { rows: string | HTMLTableRowElement[]; hasMore?: boolean }>;
  onChange?: (state: GridState) => void;
  onRowAction?: (action: string, id: string, row: HTMLTableRowElement) => void;
  /** ids — отмеченные строки; у действий «по фильтру» (when: none) — пустой массив */
  onGroupAction?: (action: string, ids: string[]) => void;
  /**
   * Редактирование в ячейке (двойной клик): { ключ: { type, options } } или th[data-edit="text|number|select|date"]
   * (+ data-edit-options='[{"value":"..","label":".."}]' для select).
   */
  editable?: Record<string, CellEditConfig>;
  /**
   * Сохранение значения. Вернуть строку/HTML-строку — что показать в ячейке; бросить ошибку — не сохранять
   * (текст ошибки покажется под полем). Без обработчика — событие b24:cell-edit (preventDefault +
   * detail.resolve(display?) / detail.reject(message)); без обработки — значение просто принимается.
   */
  onCellEdit?: (ctx: CellEditContext) => void | string | Promise<void | string>;
}

export interface GridHandle {
  getState(): GridState;
  setState(state: Partial<GridState>): void;
  reset(): void;
  /** пересчитать после добавления строк/столбцов извне (строки подхватываются и сами) */
  refresh(): void;
  getSelectedIds(): string[];
  clearSelection(): void;
  setTotal(total: number | null): void;
  setPagination(next: Partial<GridPagination>): void;
  destroy(): void;
}

export function initGrid(table: HTMLTableElement, options: GridOptions = {}): GridHandle {
  const { resizable = true, reorderable = true, settings = true, rowActions = [], groupActions = [] } = options;
  const storageKey = options.id ?? (table.dataset.b24Grid || undefined);
  const maybeHead = table.tHead?.rows[0];
  if (!maybeHead) throw new Error('[airkit-for-b24] initGrid: у таблицы нет <thead>');
  const headRow: HTMLTableRowElement = maybeHead;
  const wrap = table.closest<HTMLElement>('.b24-table-wrap') ?? table.parentElement!;
  table.classList.add('b24-datagrid');

  const keyedTh = () => Array.from(headRow.cells).filter((c) => c.dataset.key) as HTMLTableCellElement[];
  const keys = keyedTh().map((th) => th.dataset.key!);
  const defaultHidden = options.hidden ?? keyedTh().filter((th) => th.hasAttribute('data-hidden')).map((th) => th.dataset.key!);
  const defaultPinned = options.pinned ?? keyedTh().filter((th) => th.hasAttribute('data-pinned')).map((th) => th.dataset.key!);
  let state = normalizeGridState(keys, loadGridState(storageKey), defaultHidden, defaultPinned);
  const cleanups: Array<() => void> = [];

  /* ── Меню строки: служебный столбец после чекбокса ── */
  const firstKeyedIndex = () => Array.from(headRow.cells).findIndex((c) => c.dataset.key);
  function ensureMenuCell(row: HTMLTableRowElement, isHead: boolean) {
    if (!rowActions.length || row.querySelector('.b24-table__cell-menu')) return;
    if (!isHead && row.cells.length === 1 && row.cells[0].colSpan > 1) return; // «пусто» / загрузка
    // в заголовке — перед первым столбцом с ключом; в строках — ровно под ☰ заголовка
    const headMenuIdx = Array.from(headRow.cells).findIndex((c) => c.classList.contains('b24-table__cell-menu'));
    const idx = isHead ? firstKeyedIndex() : headMenuIdx;
    const cell = isHead ? h('th', { class: 'b24-table__cell-menu', 'data-fixed': true }) : h('td', { class: 'b24-table__cell-menu' });
    if (!isHead) {
      const btn = h('button', { type: 'button', class: 'b24-table__row-menu', 'aria-label': t('Действия со строкой'), 'aria-haspopup': 'menu' }, html(icon('menu', { size: 16 })));
      cell.append(btn);
    }
    const ref = idx >= 0 ? row.cells[idx] : null;
    row.insertBefore(cell, ref ?? null);
  }

  /* ── Разметка ячеек data-col по исходному порядку заголовков ── */
  let headKeysByIndex: Array<string | undefined> = [];
  function markHead() {
    headKeysByIndex = Array.from(headRow.cells).map((c) => c.dataset.key);
    headRow.querySelectorAll<HTMLElement>('th[data-key]').forEach((th) => { th.dataset.col = th.dataset.key!; });
  }
  let cornerInserted = false;
  /**
   * Место под ⚙ нужно, только если нет ни меню строк (там ⚙ — над ☰), ни своей служебной ячейки в начале
   * (например, чекбокса «выбрать все»). Тогда — узкий служебный столбец шириной как ☰, без чекбоксов.
   */
  function ensureCorner() {
    if (!settings || rowActions.length) return;
    const has = Array.from(headRow.cells).some((c) => !c.dataset.key && !c.classList.contains('b24-table__cell-menu'));
    if (has) return;
    headRow.insertBefore(h('th', { class: 'b24-table__cell-menu b24-datagrid__gear-cell', 'data-fixed': true }), headRow.firstChild);
    cornerInserted = true;
  }
  function markRow(row: HTMLTableRowElement) {
    if (row.dataset.b24GridRow) return;
    if (row.cells.length === 1 && row.cells[0].colSpan > 1) return;
    if (cornerInserted && !row.querySelector(':scope > .b24-datagrid__corner-cell')) {
      row.insertBefore(h('td', { class: 'b24-table__cell-menu b24-datagrid__corner-cell' }), row.firstChild);
    }
    ensureMenuCell(row, false);
    Array.from(row.cells).forEach((cell, i) => {
      const k = headKeysByIndex[i];
      if (k) cell.dataset.col = k;
    });
    row.dataset.b24GridRow = '1';
  }

  /* ── colgroup ── */
  let colgroup = table.querySelector<HTMLTableColElement>(':scope > colgroup') as HTMLElement | null;
  function buildColgroup() {
    colgroup?.remove();
    colgroup = h('colgroup', {});
    for (const cell of Array.from(headRow.cells)) {
      const service = cell.dataset.key ? undefined
        : cell.classList.contains('b24-table__cell-menu') ? 'menu'
        : cell.classList.contains('b24-table__cell-check') ? (settings && !rowActions.length ? 'corner' : 'check')
        : 'other';
      colgroup.append(h('col', { 'data-col': cell.dataset.key, 'data-service': service }));
    }
    table.insertBefore(colgroup, table.firstChild);
  }

  /* ── Применение состояния ── */
  function reorderCells(parent: Element, cellSelector: (el: Element) => string | undefined) {
    const children = Array.from(parent.children);
    const keyed = children.filter((c) => cellSelector(c));
    if (keyed.length < 2) return;
    const lastKeyed = keyed[keyed.length - 1];
    let trailing: Element | null = lastKeyed.nextElementSibling;
    while (trailing && cellSelector(trailing)) trailing = trailing.nextElementSibling;
    const byKey = new Map(keyed.map((c) => [cellSelector(c)!, c]));
    const frag = document.createDocumentFragment();
    for (const k of state.order) { const c = byKey.get(k); if (c) frag.append(c); }
    parent.insertBefore(frag, trailing);
  }

  function apply() {
    const colKey = (el: Element) => (el as HTMLElement).dataset?.col || undefined;
    reorderCells(headRow, colKey);
    for (const body of Array.from(table.tBodies)) for (const row of Array.from(body.rows)) reorderCells(row, colKey);
    if (colgroup) reorderCells(colgroup, colKey);
    const hidden = new Set(state.hidden);
    table.querySelectorAll<HTMLElement>('[data-col]').forEach((el) => el.classList.toggle('b24-col-hidden', hidden.has(el.dataset.col!)));

    const hasWidths = Object.keys(state.widths).length > 0;
    table.classList.toggle('b24-datagrid--fixed', hasWidths);
    const cols = Array.from(colgroup?.querySelectorAll<HTMLTableColElement>('col') ?? []);
    if (hasWidths) {
      let serviceTotal = 0;
      for (const col of cols) {
        const svc = col.dataset.service as keyof typeof SERVICE_WIDTH | 'other' | undefined;
        if (!svc) continue;
        // фактическая ширина, снятая при «заморозке», иначе — стандартная
        const w = Number(col.dataset.w) || (svc === 'other' ? 44 : SERVICE_WIDTH[svc]);
        col.style.width = `${w}px`;
        serviceTotal += w;
      }
      const visibleKeys = state.order.filter((k) => !hidden.has(k));
      const lay = layoutWidths(visibleKeys, state.widths, serviceTotal, wrap.clientWidth);
      for (const col of cols) {
        const k = col.dataset.col;
        if (!k) continue;
        col.style.width = hidden.has(k) ? '' : `${lay.widths[k]}px`;
      }
      table.style.width = `${lay.total}px`;
    } else {
      cols.forEach((col) => { col.style.width = ''; });
      table.style.width = '';
    }
    applyStickyColumns(table, state.pinned.filter((k) => !hidden.has(k)));
  }

  /** Перед первым изменением ширины «замораживаем» текущие ширины всех видимых столбцов. */
  function freezeWidths() {
    if (Object.keys(state.widths).length) return;
    // точные текущие ширины (до 0.1px), включая служебные столбцы: переход на фиксированную раскладку
    // не должен сдвигать ни одну границу
    keyedTh().forEach((th) => {
      if (!th.classList.contains('b24-col-hidden')) state.widths[th.dataset.key!] = round1(th.getBoundingClientRect().width);
    });
    Array.from(headRow.cells).forEach((c, i) => {
      const col = colgroup?.children[i] as HTMLElement | undefined;
      if (col?.dataset.service) col.dataset.w = String(round1(c.getBoundingClientRect().width));
    });
  }

  function commit() {
    apply();
    saveGridState(storageKey, state);
    options.onChange?.(structuredClone(state));
    table.dispatchEvent(new CustomEvent('b24:grid-change', { detail: { state: structuredClone(state) }, bubbles: true }));
  }

  /* ── Ручки ширины ── */
  function addResizers() {
    if (!resizable) return;
    keyedTh().forEach((th) => {
      if (th.querySelector('.b24-table__resizer')) return;
      const handle = h('span', { class: 'b24-table__resizer', 'aria-hidden': 'true', title: t('Ширина столбца (двойной клик — по содержимому)') });
      handle.addEventListener('pointerdown', (e) => {
        freezeWidths();
        apply();
        const key = th.dataset.key!;
        startColumnResize(e, th, {
          onMove: (w) => { state.widths[key] = w; apply(); },
          onEnd: () => commit(),
        });
      });
      handle.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        freezeWidths();
        state.widths[th.dataset.key!] = measureColumn(table, th.dataset.key!);
        commit();
      });
      handle.addEventListener('click', (e) => e.stopPropagation()); // не сортировать
      th.append(handle);
    });
  }

  /* ── Меню ⚙ ── */
  let settingsDd: DropdownHandle | null = null;
  function addSettings() {
    if (!settings) return;
    const btn = h('button', { type: 'button', class: 'b24-table__settings', 'aria-label': t('Настройка столбцов'), title: t('Настройка столбцов') }, html(icon('settings', { size: 16 })));
    // как в Б24: ⚙ — в заголовке столбца ☰ (над меню строк); без меню строк — рядом с чекбоксом
    const menuHead = headRow.querySelector<HTMLElement>('th.b24-table__cell-menu');
    if (menuHead) {
      menuHead.append(btn);
    } else {
      const host = Array.from(headRow.cells).find((c) => !c.dataset.key)!;
      host.classList.add('b24-datagrid__corner');
      // чекбокс «выбрать все» и ⚙ — в общем флекс-контейнере, оба ровно по центру ячейки
      const inner = h('span', { class: 'b24-datagrid__corner-inner' });
      inner.append(...Array.from(host.childNodes), btn);
      host.append(inner);
    }
    const popup = h('div', { class: 'b24-popup b24-grid-settings', hidden: true });
    const renderSettings = () => {
      popup.textContent = '';
      popup.append(h('div', { class: 'b24-menu__title' }, t('Столбцы')));
      const list = h('div', { class: 'b24-grid-settings__list' });
      const labels = new Map(keyedTh().map((th) => [th.dataset.key!, th.dataset.label ?? th.textContent?.trim() ?? th.dataset.key!]));
      for (const k of state.order) {
        const visibleCount = state.order.length - state.hidden.length;
        const on = !state.hidden.includes(k);
        const cb = h('input', { type: 'checkbox', checked: on, disabled: on && visibleCount === 1 });
        cb.addEventListener('change', () => {
          state.hidden = cb.checked ? state.hidden.filter((x) => x !== k) : [...state.hidden, k];
          commit();
          renderSettings();
        });
        const isPinned = state.pinned.includes(k);
        const pin = h('button', {
          type: 'button',
          class: `b24-grid-settings__pin${isPinned ? ' is-pinned' : ''}`,
          'aria-pressed': String(isPinned),
          'aria-label': t(isPinned ? 'Открепить столбец «{name}»' : 'Закрепить столбец «{name}»', { name: labels.get(k) ?? k }),
          title: isPinned ? t('Открепить') : t('Закрепить слева'),
        }, html(icon('pin', { size: 14 })));
        pin.addEventListener('click', () => { state = togglePinned(state, k); commit(); renderSettings(); });
        list.append(h('div', { class: 'b24-grid-settings__item' }, h('label', { class: 'b24-check' }, cb, h('span', {}, labels.get(k) ?? k)), pin));
      }
      popup.append(list);
      const reset = h('button', { type: 'button', class: 'b24-btn b24-btn--link b24-btn--sm' }, t('Сбросить настройки'));
      reset.addEventListener('click', () => { api.reset(); renderSettings(); });
      popup.append(h('div', { class: 'b24-grid-settings__footer' }, reset));
    };
    renderSettings();
    wrap.append(popup);
    settingsDd = dropdown(btn, popup, { placement: 'bottom-start', closeOnSelect: false, onOpen: renderSettings });
    cleanups.push(() => { settingsDd?.destroy(); popup.remove(); btn.remove(); });
  }

  /* ── Меню строки ☰ ── */
  let rowMenuDd: DropdownHandle | null = null;
  function setupRowMenu() {
    if (!rowActions.length) return;
    const popup = h('div', { class: 'b24-popup', hidden: true });
    const menu = h('div', { class: 'b24-menu', role: 'menu' });
    popup.append(menu);
    wrap.append(popup);
    let currentRow: HTMLTableRowElement | null = null;
    // один общий попап на таблицу: триггер — нажатая кнопка
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.b24-table__row-menu');
      if (!btn || !table.contains(btn)) return;
      e.stopPropagation();
      currentRow = btn.closest('tr');
      const allowed = currentRow?.dataset.actions?.split(',').map((s) => s.trim());
      menu.textContent = '';
      for (const a of rowActions) {
        if (allowed && !allowed.includes(a.id)) continue;
        const item = h('button', { type: 'button', class: `b24-menu__item${a.danger ? ' b24-menu__item--danger' : ''}`, role: 'menuitem' });
        if (a.icon) item.append(html(icon(a.icon)));
        item.append(h('span', {}, a.label));
        item.addEventListener('click', () => {
          const row = currentRow!;
          const id = row.dataset.id ?? '';
          options.onRowAction?.(a.id, id, row);
          table.dispatchEvent(new CustomEvent('b24:row-action', { detail: { action: a.id, id, row }, bubbles: true }));
        });
        menu.append(item);
      }
      rowMenuDd?.destroy();
      rowMenuDd = dropdown(btn, popup, { placement: 'bottom-start', onClose: () => { rowMenuDd?.destroy(); rowMenuDd = null; } });
      rowMenuDd.open();
    };
    table.addEventListener('click', onClick);
    cleanups.push(() => { table.removeEventListener('click', onClick); rowMenuDd?.destroy(); popup.remove(); });
  }

  /* ── Подвал: отмеченные, всего, групповые действия, страницы ──
   * Одна панель на все случаи, как в списках Битрикс24. Прилипает к низу окна; во фрейме портала у документа
   * нет своего скролла (низ окна неизвестен), поэтому там панель стоит под таблицей, а при отметке строки
   * в длинной таблице — всплывает рядом с местом клика.
   */
  let total: number | null = options.total ?? null;
  let pagination: GridPagination | null = options.pagination ? { ...options.pagination } : null;
  const pageSizeKey = storageKey ? `${storageKey}:pageSize` : null;
  if (pagination && pageSizeKey) {
    try { const saved = Number(localStorage.getItem(pageSizeKey)); if (saved && saved !== pagination.pageSize) { pagination.pageSize = saved; queueMicrotask(() => options.onPageSizeChange?.(saved)); } } catch { /* нет доступа к хранилищу */ }
  }
  const selectedIds = () => Array.from(table.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]:checked'))
    .map((cb) => cb.closest('tr')?.dataset.id).filter((x): x is string => !!x);
  const pageRows = () => table.tBodies[0]?.querySelectorAll('tr[data-id]').length ?? 0;
  const syncCheckAll = () => {
    const boxes = Array.from(table.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]'));
    const n = boxes.filter((b) => b.checked).length;
    const all = table.querySelector<HTMLInputElement>('thead input[data-b24-check-all]');
    if (all) { all.checked = n > 0 && n === boxes.length; all.indeterminate = n > 0 && n < boxes.length; }
    boxes.forEach((b) => b.closest('tr')?.setAttribute('aria-selected', String(b.checked)));
    table.dispatchEvent(new CustomEvent('b24:selection', { detail: { count: n }, bubbles: true }));
  };
  const clearSelection = () => {
    table.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]:checked').forEach((cb) => { cb.checked = false; });
    syncCheckAll();
  };
  let updatePanel = () => {};
  function setupPanel() {
    const hasFilterActions = groupActions.some((a) => a.when === 'none' || a.when === 'always');
    if (!groupActions.length && !pagination && options.total === undefined && !options.onCountRequest) return;
    const mode = options.actionPanel ?? (hasFilterActions || pagination ? 'always' : 'auto');
    const panel = h('div', { class: 'b24-grid-panel', role: 'toolbar', 'aria-label': t('Действия со списком') });
    const counts = h('div', { class: 'b24-grid-panel__counts' });
    const selCount = h('span', { class: 'b24-grid-panel__selected' });
    const totalEl = h('span', { class: 'b24-grid-panel__total' });
    counts.append(selCount, totalEl);
    const actionsEl = h('div', { class: 'b24-grid-panel__actions' });
    const pager = h('div', { class: 'b24-grid-panel__pager' });
    panel.append(counts, actionsEl, pager);
    const more = h('button', { type: 'button', class: 'b24-btn b24-btn--secondary b24-grid-more' }, t('Показать ещё')) as HTMLButtonElement;
    const wrapEl = table.closest('.b24-table-wrap') ?? table;
    wrapEl.after(panel);
    panel.before(more);

    const buttons = groupActions.map((a) => {
      const btn = h('button', { type: 'button', class: `b24-btn b24-btn--sm b24-btn--${a.variant ?? 'secondary'}` }) as HTMLButtonElement;
      if (a.icon) btn.append(html(icon(a.icon)));
      const label = h('span', {});
      btn.append(label);
      btn.addEventListener('click', async () => {
        const when = a.when ?? 'selected';
        const ids = when === 'none' ? [] : selectedIds();
        if (when === 'selected' && !ids.length) return;
        const vars = { n: ids.length, total: total ?? '—' };
        if (a.confirm && !(await confirm(t(a.confirm, vars), { danger: a.variant?.includes('danger'), okText: t(a.label, vars) }))) return;
        options.onGroupAction?.(a.id, ids);
        table.dispatchEvent(new CustomEvent('b24:group-action', { detail: { action: a.id, ids, scope: ids.length ? 'selected' : 'filter' }, bubbles: true }));
      });
      actionsEl.append(btn);
      return { a, btn, label };
    });
    const clear = h('button', { type: 'button', class: 'b24-btn b24-btn--link b24-btn--sm b24-grid-panel__clear' }, t('Снять выделение'));
    clear.addEventListener('click', clearSelection);
    actionsEl.append(clear);

    const renderTotal = () => {
      totalEl.textContent = '';
      if (total != null) totalEl.append(t('Всего: {n}', { n: total.toLocaleString(intlLocale()) }));
      else if (options.onCountRequest) {
        const link = h('button', { type: 'button', class: 'b24-btn b24-btn--link b24-btn--sm' }, t('Показать количество')) as HTMLButtonElement;
        link.addEventListener('click', async () => {
          link.classList.add('b24-btn--loading');
          try { total = await options.onCountRequest!(); } catch { link.classList.remove('b24-btn--loading'); return; }
          updatePanel();
        });
        totalEl.append(t('Всего:') + ' ', link);
      }
    };
    const renderPager = () => {
      pager.textContent = '';
      if (!pagination) { more.hidden = true; return; }
      const p = pagination;
      const pm = p.mode ?? (options.onLoadMore ? 'both' : 'pages');
      const canLoad = pm !== 'pages';
      const sizes = p.pageSizes ?? [20, 50, 100, 200, 500];
      const sel = h('select', { class: 'b24-select b24-select--sm', 'aria-label': t('Строк на странице') }) as HTMLSelectElement;
      for (const n of sizes) sel.add(new Option(String(n), String(n), false, n === p.pageSize));
      sel.addEventListener('change', () => {
        p.pageSize = Number(sel.value);
        p.page = 1;
        if (pageSizeKey) { try { localStorage.setItem(pageSizeKey, sel.value); } catch { /* нет доступа */ } }
        options.onPageSizeChange?.(p.pageSize);
        table.dispatchEvent(new CustomEvent('b24:page-size-change', { detail: { pageSize: p.pageSize }, bubbles: true }));
        renderPager();
      });
      pager.append(h('label', { class: 'b24-grid-panel__size' }, h('span', {}, t('На странице:')), sel));
      const pages = total != null ? Math.max(1, Math.ceil(total / p.pageSize)) : null;
      if (pm !== 'more') {
        const nav = h('nav', { class: 'b24-pagination', 'aria-label': t('Страницы') });
        const go = (n: number) => { p.page = n; options.onPageChange?.(n); table.dispatchEvent(new CustomEvent('b24:page-change', { detail: { page: n, pageSize: p.pageSize }, bubbles: true })); renderPager(); };
        const item = (label: string | number, n: number | null, current = false, aria?: string) => {
          const b = h('button', { type: 'button', class: 'b24-pagination__item', 'aria-label': aria, 'aria-current': current ? 'page' : undefined }, String(label)) as HTMLButtonElement;
          if (n == null) b.disabled = true; else b.addEventListener('click', () => go(n));
          return b;
        };
        nav.append(item('‹', p.page > 1 ? p.page - 1 : null, false, t('Назад')));
        if (pages) {
          // 1 … p-1 p p+1 … N
          const set = new Set([1, pages, p.page - 1, p.page, p.page + 1].filter((n) => n >= 1 && n <= pages));
          let prev = 0;
          for (const n of [...set].sort((a, b) => a - b)) {
            if (n - prev > 1) nav.append(h('span', { class: 'b24-pagination__gap' }, '…'));
            nav.append(item(n, n === p.page ? null : n, n === p.page));
            prev = n;
          }
        } else nav.append(item(p.page, null, true));
        const hasNext = pages ? p.page < pages : p.hasMore !== false && pageRows() >= p.pageSize;
        nav.append(item('›', hasNext ? p.page + 1 : null, false, t('Вперёд')));
        pager.append(nav);
      }
      const shown = pageRows();
      // явный ответ сервера «больше нет» главнее подсчёта по total
      const canMore = canLoad && p.hasMore !== false && (total == null || shown < total - (p.page - 1) * p.pageSize);
      more.hidden = !canMore;
    };
    /** без onLoadMore — событие b24:load-more { respond(rows | Promise) } для серверных шаблонов */
    const loadMore = (): Promise<Awaited<ReturnType<NonNullable<GridOptions['onLoadMore']>>>> => {
      if (options.onLoadMore) return options.onLoadMore();
      return new Promise((resolve, reject) => {
        let answered = false;
        const ev = new CustomEvent('b24:load-more', { bubbles: true, detail: {
          page: pagination?.page, pageSize: pagination?.pageSize, loaded: pageRows(),
          respond: (r: unknown) => { answered = true; Promise.resolve(r).then(resolve as (v: unknown) => void, reject); },
        } });
        table.dispatchEvent(ev);
        if (!answered) resolve({ rows: [], hasMore: false });
      });
    };
    more.addEventListener('click', async () => {
      more.classList.add('b24-btn--loading');
      try {
        const res = await loadMore();
        const payload = typeof res === 'object' && !Array.isArray(res) && 'rows' in res ? res : { rows: res as string | HTMLTableRowElement[] };
        const body = table.tBodies[0];
        if (typeof payload.rows === 'string') {
          const tpl = document.createElement('template');
          tpl.innerHTML = `<table><tbody>${payload.rows}</tbody></table>`;
          body.append(...Array.from(tpl.content.querySelectorAll('tbody > tr')));
        } else body.append(...payload.rows);
        if (pagination && 'hasMore' in payload) pagination.hasMore = payload.hasMore;
        await new Promise((r) => setTimeout(r, 0)); // строки размечает MutationObserver
        syncCheckAll();
      } finally {
        more.classList.remove('b24-btn--loading');
        updatePanel();
      }
    });

    // во фрейме длинная таблица: при отметке панель всплывает у места клика
    const placeInFrame = () => {
      if (!isInFrame()) { panel.classList.remove('is-floating'); panel.style.top = ''; return; }
      const r = (wrapEl as HTMLElement).getBoundingClientRect();
      const tall = r.height > 600;
      const n = selectedIds().length;
      if (!tall || !n) { panel.classList.remove('is-floating'); panel.style.top = ''; return; }
      const top = Math.min(Math.max(frameAnchorY() + 28, r.top + scrollY), r.bottom + scrollY - panel.offsetHeight);
      panel.classList.add('is-floating');
      Object.assign(panel.style, { top: `${top}px`, left: `${r.left + scrollX}px`, width: `${r.width}px` });
    };

    updatePanel = () => {
      const n = selectedIds().length;
      const ctx = { selected: n, total };
      selCount.textContent = t('Отмечено: {n} / {m}', { n, m: pageRows() });
      for (const { a, btn, label } of buttons) {
        const when = a.when ?? 'selected';
        btn.hidden = when === 'selected' ? n === 0 : when === 'none' ? n > 0 : false;
        const off = typeof a.disabled === 'function' ? a.disabled(ctx) : !!a.disabled;
        btn.disabled = off;
        label.textContent = t(a.label, { n, total: total ?? '—' });
        if (a.hint) btn.title = a.hint; else btn.removeAttribute('title');
      }
      clear.hidden = n === 0;
      renderTotal();
      renderPager();
      panel.hidden = mode === 'auto' && n === 0;
      panel.classList.toggle('has-selection', n > 0);
      placeInFrame();
    };
    const onChange = (e: Event) => { if ((e.target as HTMLElement).matches('input[type="checkbox"]')) setTimeout(updatePanel, 0); };
    table.addEventListener('change', onChange);
    table.addEventListener('b24:selection', updatePanel);
    updatePanel();
    cleanups.push(() => { table.removeEventListener('change', onChange); table.removeEventListener('b24:selection', updatePanel); panel.remove(); more.remove(); });
  }

  /* ── Редактирование в ячейке ── */
  const editable: Record<string, CellEditConfig> = { ...(options.editable ?? {}) };
  keyedTh().forEach((th) => {
    const type = th.dataset.edit as CellEditType | undefined;
    if (!type || editable[th.dataset.key!]) return;
    let opts: CellEditConfig['options'];
    try { opts = th.dataset.editOptions ? JSON.parse(th.dataset.editOptions) : undefined; } catch { opts = undefined; }
    editable[th.dataset.key!] = { type, options: opts };
  });
  const markEditable = () => {
    for (const key of Object.keys(editable)) {
      table.querySelectorAll<HTMLElement>(`tbody td[data-col="${CSS.escape(key)}"]`).forEach((td) => {
        td.classList.add('b24-cell-editable');
        if (!td.hasAttribute('tabindex')) td.tabIndex = 0;
        td.title ||= t('Двойной клик или Enter — изменить');
      });
    }
  };
  let editing: { cell: HTMLTableCellElement; cleanup: () => void } | null = null;

  const cellValue = (cell: HTMLElement) => cell.dataset.value ?? cell.textContent?.trim() ?? '';

  function startEdit(cell: HTMLTableCellElement) {
    const key = cell.dataset.col!;
    const cfg = editable[key];
    const row = cell.closest('tr') as HTMLTableRowElement | null;
    if (!cfg || !row || editing?.cell === cell) return;
    editing?.cleanup();
    const oldValue = cellValue(cell);
    const original = cell.innerHTML;
    cell.classList.add('is-editing');
    cell.innerHTML = '';
    let control: HTMLInputElement | HTMLSelectElement;
    let dp: DatePickerHandle | null = null;
    if (cfg.type === 'select') {
      const sel = h('select', { class: 'b24-select b24-select--sm b24-cell-editor' });
      for (const o of cfg.options ?? []) sel.append(h('option', { value: o.value, selected: o.value === oldValue }, o.label));
      control = sel;
    } else {
      control = h('input', { class: 'b24-input b24-input--sm b24-cell-editor', value: oldValue, inputmode: cfg.type === 'number' ? 'decimal' : undefined });
    }
    const errorEl = h('div', { class: 'b24-cell-error', role: 'alert', hidden: true });
    cell.append(control, errorEl);
    if (cfg.type === 'date') dp = datepicker(control as HTMLInputElement, { onChange: () => void commit() });

    let busy = false;
    let finished = false;
    const finish = (html: string) => {
      if (finished) return;
      finished = true;
      dp?.destroy();
      cell.classList.remove('is-editing', 'is-saving', 'is-error');
      cell.innerHTML = html;
      if (editing?.cell === cell) editing = null;
    };
    const cancel = () => finish(original);

    async function commit(moveNext = false) {
      if (busy || finished) return;
      const value = control.value.trim();
      if (value === oldValue) { cancel(); if (moveNext) editNext(cell); return; }
      if (cfg.type === 'number' && value !== '' && !Number.isFinite(Number(value.replace(/\s/g, '').replace(',', '.')))) {
        showError(t('Введите число'));
        return;
      }
      busy = true;
      cell.classList.add('is-saving');
      errorEl.hidden = true;
      const ctx: CellEditContext = { id: row!.dataset.id ?? '', key, value, oldValue, row: row!, cell };
      const label = cfg.type === 'select' ? cfg.options?.find((o) => o.value === value)?.label ?? value : value;
      try {
        let display: string | void;
        if (options.onCellEdit) {
          display = await options.onCellEdit(ctx);
        } else {
          display = await new Promise<string | void>((resolve, reject) => {
            const ev = new CustomEvent('b24:cell-edit', { detail: { ...ctx, resolve, reject }, bubbles: true, cancelable: true });
            if (table.dispatchEvent(ev)) resolve(); // никто не обработал — принимаем
          });
        }
        cell.dataset.value = value;
        finish(display != null ? String(display) : escapeHtml(label));
        if (moveNext) editNext(cell);
      } catch (err) {
        busy = false;
        cell.classList.remove('is-saving');
        showError(typeof err === 'string' ? err : (err as Error)?.message ?? t('Не удалось сохранить'));
      }
    }
    function showError(msg: string) {
      cell.classList.add('is-error');
      errorEl.textContent = msg;
      errorEl.hidden = false;
      control.focus();
    }

    control.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter') { ke.preventDefault(); void commit(); }
      else if (ke.key === 'Escape') { ke.preventDefault(); ke.stopPropagation(); cancel(); }
      else if (ke.key === 'Tab') { ke.preventDefault(); void commit(true); }
    });
    if (cfg.type === 'select') control.addEventListener('change', () => void commit());
    control.addEventListener('blur', () => {
      // клик в календаре — не уход из ячейки
      setTimeout(() => {
        if (finished || busy) return;
        const active = document.activeElement;
        if (active === control || (active as HTMLElement)?.closest?.('.b24-datepicker-popup')) return;
        if (cfg.type === 'date' && document.querySelector('.b24-datepicker-popup:not([hidden])')) return;
        void commit();
      }, 0);
    });
    editing = { cell, cleanup: () => { if (!busy) void commit(); } };
    control.focus();
    if (control instanceof HTMLInputElement) control.select();
    dp?.open(); // календарь сразу, не дожидаясь события фокуса
  }

  function editNext(cell: HTMLTableCellElement) {
    const row = cell.closest('tr')!;
    const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>('td.b24-cell-editable')).filter((c) => !c.classList.contains('b24-col-hidden'));
    const next = cells[cells.indexOf(cell) + 1];
    if (next) startEdit(next);
  }

  if (Object.keys(editable).length) {
    const onDbl = (e: MouseEvent) => {
      const cell = (e.target as HTMLElement).closest<HTMLTableCellElement>('td.b24-cell-editable');
      if (!cell || !table.contains(cell) || cell.classList.contains('is-editing')) return;
      if ((e.target as HTMLElement).closest('a,button,input,select,label')) return;
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      startEdit(cell);
    };
    const onKey = (e: KeyboardEvent) => {
      const cell = (e.target as HTMLElement).closest<HTMLTableCellElement>('td.b24-cell-editable');
      if (cell && (e.key === 'Enter' || e.key === 'F2') && !cell.classList.contains('is-editing')) { e.preventDefault(); startEdit(cell); }
    };
    table.addEventListener('dblclick', onDbl);
    table.addEventListener('keydown', onKey);
    cleanups.push(() => { table.removeEventListener('dblclick', onDbl); table.removeEventListener('keydown', onKey); editing?.cleanup(); });
  }

  /* ── init ── */
  ensureCorner();
  ensureMenuCell(headRow, true);
  markHead();
  for (const body of Array.from(table.tBodies)) for (const row of Array.from(body.rows)) markRow(row);
  buildColgroup();
  addSettings();
  addResizers();
  setupRowMenu();
  setupPanel();
  const extra = (cornerInserted ? 1 : 0) + (rowActions.length ? 1 : 0);
  if (extra) for (const body of Array.from(table.tBodies)) for (const row of Array.from(body.rows)) {
    if (row.cells.length === 1 && row.cells[0].colSpan > 1) row.cells[0].colSpan += extra;
  }
  apply();
  if (Object.keys(editable).length) markEditable();
  if (reorderable) {
    headRow.querySelectorAll('th[data-key]').forEach((th) => th.classList.add('b24-datagrid__draggable'));
    cleanups.push(enableColumnReorder(headRow, {
      onReorder: (key, beforeKey) => { state = reorderWithPins(state, key, beforeKey); commit(); },
    }));
  }

  // новые строки (подгрузка, сортировка) — размечаем и приводим к текущему порядку
  if (resizable) cleanups.push(enableColumnGuide(table, wrap));

  const onScrollX = () => wrap.classList.toggle('is-scrolled-x', wrap.scrollLeft > 0);
  wrap.addEventListener('scroll', onScrollX, { passive: true });
  cleanups.push(() => wrap.removeEventListener('scroll', onScrollX));

  if (typeof ResizeObserver !== 'undefined') {
    let lastW = wrap.clientWidth;
    const ro = new ResizeObserver(() => {
      if (wrap.clientWidth === lastW) return;
      lastW = wrap.clientWidth;
      apply();
    });
    ro.observe(wrap);
    cleanups.push(() => ro.disconnect());
  }

  const mo = new MutationObserver((records) => {
    let changed = false;
    for (const r of records) r.addedNodes.forEach((n) => {
      if (n instanceof HTMLTableRowElement && !n.dataset.b24GridRow) { markRow(n); changed = true; }
    });
    if (changed) { apply(); if (Object.keys(editable).length) markEditable(); updatePanel(); }
  });
  for (const body of Array.from(table.tBodies)) mo.observe(body, { childList: true });
  cleanups.push(() => mo.disconnect());

  const api: GridHandle = {
    getState: () => structuredClone(state),
    setState(next) { state = normalizeGridState(keys, { ...state, ...next }, defaultHidden, defaultPinned); commit(); },
    reset() {
      clearGridState(storageKey);
      state = normalizeGridState(keys, null, defaultHidden, defaultPinned);
      colgroup?.querySelectorAll<HTMLElement>('col').forEach((c) => { c.style.width = ''; delete c.dataset.w; });
      commit();
      clearGridState(storageKey);
    },
    refresh() {
      for (const body of Array.from(table.tBodies)) for (const row of Array.from(body.rows)) markRow(row);
      apply();
      updatePanel();
    },
    getSelectedIds: selectedIds,
    clearSelection,
    setTotal(next) { total = next; updatePanel(); },
    setPagination(next) { pagination = { ...(pagination ?? { page: 1, pageSize: 20 }), ...next }; updatePanel(); },
    destroy() { cleanups.splice(0).forEach((c) => c()); },
  };
  return api;
}

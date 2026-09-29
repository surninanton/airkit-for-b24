import { icon, type IconName } from '../icons';
import { h, html } from './dom';
import { dropdown, type DropdownHandle } from './dropdown';
import {
  clearGridState, enableColumnReorder, loadGridState, measureColumn, moveColumn, normalizeGridState, saveGridState,
  startColumnResize, type GridState,
} from './grid-core';
import { confirm } from './modal';

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
 * События: b24:grid-change { state }, b24:row-action { action, id, row }, b24:group-action { action, ids }.
 */

export interface GridRowAction { id: string; label: string; icon?: IconName; danger?: boolean }
export interface GridGroupAction {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'tinted' | 'tinted-danger' | 'plain';
  icon?: IconName;
  /** текст подтверждения — перед событием спросить confirm */
  confirm?: string;
}

export interface GridOptions {
  /** ключ для localStorage; без него состояние не сохраняется */
  id?: string;
  resizable?: boolean;
  reorderable?: boolean;
  /** меню ⚙ с видимостью столбцов */
  settings?: boolean;
  /** скрытые по умолчанию столбцы */
  hidden?: string[];
  /** меню ☰ у строки; какие пункты показывать конкретной строке — tr[data-actions="edit,delete"] */
  rowActions?: GridRowAction[];
  groupActions?: GridGroupAction[];
  onChange?: (state: GridState) => void;
  onRowAction?: (action: string, id: string, row: HTMLTableRowElement) => void;
  onGroupAction?: (action: string, ids: string[]) => void;
}

export interface GridHandle {
  getState(): GridState;
  setState(state: Partial<GridState>): void;
  reset(): void;
  /** пересчитать после добавления строк/столбцов извне (строки подхватываются и сами) */
  refresh(): void;
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
  let state = normalizeGridState(keys, loadGridState(storageKey), defaultHidden);
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
      const btn = h('button', { type: 'button', class: 'b24-table__row-menu', 'aria-label': 'Действия со строкой', 'aria-haspopup': 'menu' }, html(icon('menu', { size: 16 })));
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
  function ensureCorner() {
    if (!settings) return;
    const has = Array.from(headRow.cells).some((c) => !c.dataset.key && !c.classList.contains('b24-table__cell-menu'));
    if (has) return;
    headRow.insertBefore(h('th', { class: 'b24-table__cell-check', 'data-fixed': true }), headRow.firstChild);
    cornerInserted = true;
  }
  function markRow(row: HTMLTableRowElement) {
    if (row.dataset.b24GridRow) return;
    if (row.cells.length === 1 && row.cells[0].colSpan > 1) return;
    if (cornerInserted && !row.querySelector(':scope > .b24-datagrid__corner-cell')) {
      row.insertBefore(h('td', { class: 'b24-table__cell-check b24-datagrid__corner-cell' }), row.firstChild);
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
      colgroup.append(h('col', { 'data-col': cell.dataset.key }));
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
    if (hasWidths) {
      let total = 0;
      colgroup?.querySelectorAll<HTMLTableColElement>('col').forEach((col) => {
        const k = col.dataset.col;
        if (k && hidden.has(k)) { col.style.width = ''; return; }
        const w = k ? state.widths[k] : undefined;
        col.style.width = w ? `${w}px` : '';
        total += w ?? (k ? 150 : 44);
      });
      table.style.width = `${total}px`;
    } else {
      colgroup?.querySelectorAll<HTMLTableColElement>('col').forEach((col) => { col.style.width = ''; });
      table.style.width = '';
    }
  }

  /** Перед первым изменением ширины «замораживаем» текущие ширины всех видимых столбцов. */
  function freezeWidths() {
    if (Object.keys(state.widths).length) return;
    keyedTh().forEach((th) => {
      if (!th.classList.contains('b24-col-hidden')) state.widths[th.dataset.key!] = Math.round(th.getBoundingClientRect().width);
    });
    // служебные столбцы
    Array.from(headRow.cells).forEach((c, i) => {
      const col = colgroup?.children[i] as HTMLElement | undefined;
      if (!c.dataset.key && col) col.style.width = `${Math.round(c.getBoundingClientRect().width)}px`;
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
      const handle = h('span', { class: 'b24-table__resizer', 'aria-hidden': 'true', title: 'Ширина столбца (двойной клик — по содержимому)' });
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
    const host = Array.from(headRow.cells).find((c) => !c.dataset.key && !c.classList.contains('b24-table__cell-menu'))!;
    host.classList.add('b24-datagrid__corner');
    const btn = h('button', { type: 'button', class: 'b24-table__settings', 'aria-label': 'Настройка столбцов', title: 'Настройка столбцов' }, html(icon('settings', { size: 16 })));
    host.append(btn);
    const popup = h('div', { class: 'b24-popup b24-grid-settings', hidden: true });
    const renderSettings = () => {
      popup.textContent = '';
      popup.append(h('div', { class: 'b24-menu__title' }, 'Столбцы'));
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
        list.append(h('label', { class: 'b24-check' }, cb, h('span', {}, labels.get(k) ?? k)));
      }
      popup.append(list);
      const reset = h('button', { type: 'button', class: 'b24-btn b24-btn--link b24-btn--sm' }, 'Сбросить настройки');
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

  /* ── Групповые действия ── */
  function setupGroupActions() {
    if (!groupActions.length) return;
    const bar = h('div', { class: 'b24-grid-actions', hidden: true, role: 'toolbar', 'aria-label': 'Действия с отмеченными' });
    const count = h('span', { class: 'b24-grid-actions__count' });
    bar.append(count);
    const selectedIds = () => Array.from(table.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]:checked'))
      .map((cb) => cb.closest('tr')?.dataset.id).filter((x): x is string => !!x);
    for (const a of groupActions) {
      const btn = h('button', { type: 'button', class: `b24-btn b24-btn--sm b24-btn--${a.variant ?? 'secondary'}` });
      if (a.icon) btn.append(html(icon(a.icon)));
      btn.append(h('span', {}, a.label));
      btn.addEventListener('click', async () => {
        const ids = selectedIds();
        if (!ids.length) return;
        if (a.confirm && !(await confirm(a.confirm.replace('{n}', String(ids.length)), { danger: a.variant?.includes('danger'), okText: a.label }))) return;
        options.onGroupAction?.(a.id, ids);
        table.dispatchEvent(new CustomEvent('b24:group-action', { detail: { action: a.id, ids }, bubbles: true }));
      });
      bar.append(btn);
    }
    const clear = h('button', { type: 'button', class: 'b24-btn b24-btn--link b24-btn--sm b24-grid-actions__clear' }, 'Снять выделение');
    clear.addEventListener('click', () => {
      table.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]:checked').forEach((cb) => { cb.checked = false; });
      const all = table.querySelector<HTMLInputElement>('thead input[data-b24-check-all]');
      if (all) { all.checked = false; all.indeterminate = false; }
      table.querySelectorAll('tbody tr[aria-selected="true"]').forEach((tr) => tr.setAttribute('aria-selected', 'false'));
      update();
    });
    bar.append(clear);
    table.after(bar);
    const update = () => {
      const n = selectedIds().length;
      const total = table.tBodies[0]?.querySelectorAll('tr[data-id]').length ?? 0;
      count.textContent = `Отмечено: ${n} из ${total}`;
      bar.hidden = n === 0;
    };
    const onChange = (e: Event) => { if ((e.target as HTMLElement).matches('input[type="checkbox"]')) setTimeout(update, 0); };
    table.addEventListener('change', onChange);
    table.addEventListener('b24:selection', update);
    update();
    cleanups.push(() => { table.removeEventListener('change', onChange); table.removeEventListener('b24:selection', update); bar.remove(); });
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
  setupGroupActions();
  const extra = (cornerInserted ? 1 : 0) + (rowActions.length ? 1 : 0);
  if (extra) for (const body of Array.from(table.tBodies)) for (const row of Array.from(body.rows)) {
    if (row.cells.length === 1 && row.cells[0].colSpan > 1) row.cells[0].colSpan += extra;
  }
  apply();
  if (reorderable) {
    headRow.querySelectorAll('th[data-key]').forEach((th) => th.classList.add('b24-datagrid__draggable'));
    cleanups.push(enableColumnReorder(headRow, {
      onReorder: (key, beforeKey) => { state.order = moveColumn(state.order, key, beforeKey); commit(); },
    }));
  }

  // новые строки (подгрузка, сортировка) — размечаем и приводим к текущему порядку
  const mo = new MutationObserver((records) => {
    let changed = false;
    for (const r of records) r.addedNodes.forEach((n) => {
      if (n instanceof HTMLTableRowElement && !n.dataset.b24GridRow) { markRow(n); changed = true; }
    });
    if (changed) apply();
  });
  for (const body of Array.from(table.tBodies)) mo.observe(body, { childList: true });
  cleanups.push(() => mo.disconnect());

  const api: GridHandle = {
    getState: () => structuredClone(state),
    setState(next) { state = normalizeGridState(keys, { ...state, ...next }); commit(); },
    reset() {
      clearGridState(storageKey);
      state = normalizeGridState(keys, null, defaultHidden);
      colgroup?.querySelectorAll<HTMLElement>('col').forEach((c) => { c.style.width = ''; });
      commit();
      clearGridState(storageKey);
    },
    refresh() {
      for (const body of Array.from(table.tBodies)) for (const row of Array.from(body.rows)) markRow(row);
      apply();
    },
    destroy() { cleanups.splice(0).forEach((c) => c()); },
  };
  return api;
}

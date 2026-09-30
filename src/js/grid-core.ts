/**
 * Ядро грида (без привязки к фреймворку): состояние столбцов, сохранение,
 * изменение ширины и перетаскивание столбцов. DOM таблицы не меняет — сообщает о результате колбэками.
 */

export interface GridState {
  /** порядок ключей столбцов */
  order: string[];
  /** ширины, px */
  widths: Record<string, number>;
  /** скрытые столбцы */
  hidden: string[];
  /** закреплённые слева столбцы (всегда в начале order) */
  pinned: string[];
}

const PREFIX = 'b24-grid:';
export const MIN_COL_WIDTH = 60;
/** служебные столбцы: угол (чекбокс + ⚙), только чекбокс, меню ☰ */
export const SERVICE_WIDTH = { corner: 64, check: 44, menu: 36 } as const;
export const DEFAULT_COL_WIDTH = 150;
/** ширина с точностью до 0.1px — чтобы при переходе на фиксированную раскладку ничего не сдвигалось */
export const round1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * Итоговые ширины для отрисовки: сохранённые ширины как есть, а если сумма меньше контейнера,
 * остаток получает последний видимый столбец. Благодаря этому граница любого другого столбца
 * при перетаскивании идёт ровно за курсором (браузер не «размазывает» остаток по всем столбцам).
 */
export function layoutWidths(visibleKeys: string[], widths: Record<string, number>, serviceTotal: number, containerWidth: number): { widths: Record<string, number>; total: number } {
  const out: Record<string, number> = {};
  let total = serviceTotal;
  // остаток меньше полупикселя не раздаём: это погрешность округления, а не свободное место
  for (const k of visibleKeys) { out[k] = widths[k] ?? DEFAULT_COL_WIDTH; total += out[k]; }
  const last = visibleKeys[visibleKeys.length - 1];
  if (last && containerWidth > 0 && containerWidth - total > 0.5) {
    out[last] += containerWidth - total;
    total = containerWidth;
  }
  return { widths: out, total };
}
export const MAX_AUTOFIT_WIDTH = 600;

export function loadGridState(key: string | undefined): Partial<GridState> | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Partial<GridState>) : null;
  } catch {
    return null;
  }
}

export function saveGridState(key: string | undefined, state: GridState): void {
  if (!key) return;
  try { localStorage.setItem(PREFIX + key, JSON.stringify(state)); } catch { /* приватный режим и т.п. */ }
}

export function clearGridState(key: string | undefined): void {
  if (!key) return;
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}

/** Сводит сохранённое состояние с актуальным набором столбцов: новые — в конец, удалённые — выбрасываются. */
export function normalizeGridState(keys: string[], saved?: Partial<GridState> | null, defaultHidden: string[] = [], defaultPinned: string[] = []): GridState {
  const known = new Set(keys);
  const order = (saved?.order ?? []).filter((k) => known.has(k));
  for (const k of keys) if (!order.includes(k)) order.push(k);
  const widths: Record<string, number> = {};
  for (const [k, w] of Object.entries(saved?.widths ?? {})) if (known.has(k) && w > 0) widths[k] = round1(w);
  let hidden = (saved?.hidden ?? defaultHidden).filter((k) => known.has(k));
  if (hidden.length >= keys.length) hidden = hidden.slice(0, keys.length - 1); // хотя бы один столбец виден
  const pinned = (saved?.pinned ?? defaultPinned).filter((k) => known.has(k));
  return { order: pinFirst(order, pinned), widths, hidden, pinned };
}

/** Закреплённые столбцы — в начало, в их текущем порядке. */
export function pinFirst(order: string[], pinned: string[]): string[] {
  const set = new Set(pinned);
  return [...order.filter((k) => set.has(k)), ...order.filter((k) => !set.has(k))];
}

/** Закрепить / открепить столбец: закреплённый встаёт в конец группы закреплённых, откреплённый — сразу после неё. */
export function togglePinned(state: GridState, key: string): GridState {
  const isPinned = state.pinned.includes(key);
  const pinned = isPinned ? state.pinned.filter((k) => k !== key) : [...state.pinned, key];
  const rest = state.order.filter((k) => k !== key);
  const pinnedInOrder = rest.filter((k) => pinned.includes(k));
  const others = rest.filter((k) => !pinned.includes(k));
  const order = isPinned ? [...pinnedInOrder, key, ...others] : [...pinnedInOrder, key, ...others];
  return { ...state, pinned: order.filter((k) => pinned.includes(k)), order };
}

/**
 * Перестановка с учётом закрепления: брошенный перед закреплённым столбцом — закрепляется,
 * закреплённый, брошенный в незакреплённую часть, — открепляется.
 */
export function reorderWithPins(state: GridState, key: string, beforeKey: string | null): GridState {
  const order = moveColumn(state.order, key, beforeKey);
  const idx = order.indexOf(key);
  const next = order[idx + 1];
  const prev = order[idx - 1];
  let pinned = state.pinned.filter((k) => k !== key);
  if ((next && pinned.includes(next)) || (prev && pinned.includes(prev) && (!next || !pinned.includes(next)) && state.pinned.includes(key))) pinned = [...pinned, key];
  pinned = order.filter((k) => pinned.includes(k));
  return { ...state, order: pinFirst(order, pinned), pinned };
}

/**
 * Прилипание закреплённых столбцов при горизонтальной прокрутке (для vanilla и React).
 * Служебные ячейки в начале строки (чекбокс, ☰) прилипают вместе с закреплёнными.
 * Отступ left считается по фактическим ширинам заголовков.
 */
export function applyStickyColumns(table: HTMLTableElement, pinned: string[]): void {
  const headRow = table.tHead?.rows[0];
  if (!headRow) return;
  const cells = Array.from(headRow.cells);
  const set = new Set(pinned);
  const lefts: number[] = [];
  let left = 0;
  let lastSticky = -1;
  const anyPinned = pinned.length > 0;
  let leading = true;
  cells.forEach((c, i) => {
    const key = c.dataset.col;
    const service = !key;
    const sticky = anyPinned && ((service && leading) || (!!key && set.has(key)));
    if (key && !set.has(key)) leading = false;
    if (sticky && getComputedStyle(c).display !== 'none') {
      lefts[i] = left;
      left += c.getBoundingClientRect().width;
      lastSticky = i;
    } else {
      lefts[i] = -1;
    }
  });
  const rows = [headRow, ...Array.from(table.tBodies).flatMap((b) => Array.from(b.rows))];
  for (const row of rows) {
    const rc = Array.from(row.cells);
    if (rc.length === 1 && rc[0].colSpan > 1) continue;
    rc.forEach((cell, i) => {
      const l = lefts[i] ?? -1;
      const on = l >= 0;
      cell.classList.toggle('b24-col-pinned', on);
      cell.classList.toggle('b24-col-pinned-last', on && i === lastSticky);
      cell.style.left = on ? `${l}px` : '';
    });
  }
}

/** Перенос ключа key перед beforeKey (null — в конец). */
export function moveColumn(order: string[], key: string, beforeKey: string | null): string[] {
  const next = order.filter((k) => k !== key);
  const i = beforeKey ? next.indexOf(beforeKey) : -1;
  next.splice(i < 0 ? next.length : i, 0, key);
  return next;
}

/* ── Изменение ширины ─────────────────────────────────── */

export interface ResizeOptions {
  min?: number;
  onMove: (width: number) => void;
  onEnd: (width: number) => void;
}

/** Запускается из pointerdown по ручке на правой границе заголовка. */
export function startColumnResize(e: PointerEvent, th: HTMLElement, opts: ResizeOptions): void {
  e.preventDefault();
  e.stopPropagation();
  const min = opts.min ?? MIN_COL_WIDTH;
  const startX = e.clientX;
  const startW = th.getBoundingClientRect().width;
  let width = startW;
  document.body.classList.add('b24-col-resizing');
  const move = (ev: PointerEvent) => {
    width = Math.max(min, round1(startW + ev.clientX - startX));
    opts.onMove(width);
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    document.body.classList.remove('b24-col-resizing');
    opts.onEnd(width);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

/** Ширина «по содержимому» (двойной клик по ручке): максимум по ячейкам столбца [data-col=key]. */
export function measureColumn(table: HTMLTableElement, key: string): number {
  let max = MIN_COL_WIDTH;
  const cells = table.querySelectorAll<HTMLElement>(`[data-col="${CSS.escape(key)}"]`);
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:0';
  document.body.append(probe);
  cells.forEach((cell) => {
    if (cell.tagName === 'COL') return;
    const cs = getComputedStyle(cell);
    probe.style.font = cs.font;
    probe.innerHTML = cell.innerHTML;
    probe.querySelectorAll('.b24-table__resizer').forEach((r) => r.remove());
    const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    max = Math.max(max, Math.ceil(probe.getBoundingClientRect().width + pad + 2));
  });
  probe.remove();
  return Math.min(max, MAX_AUTOFIT_WIDTH);
}

/* ── Перетаскивание столбцов ──────────────────────────── */

export interface ReorderOptions {
  /** key — перетаскиваемый столбец, beforeKey — перед каким встать (null — в конец) */
  onReorder: (key: string, beforeKey: string | null) => void;
}

const INTERACTIVE = 'a,button,input,select,textarea,label,.b24-table__resizer,[data-no-drag]';

/**
 * Заголовки th[data-key] (без data-fixed) можно перетаскивать мышью/пальцем.
 * Во время перетаскивания рисуются «призрак» заголовка и вертикальная линия места вставки.
 */
export function enableColumnReorder(headRow: HTMLTableRowElement, opts: ReorderOptions): () => void {
  let pending: { th: HTMLElement; x: number; y: number; id: number } | null = null;
  let drag: { th: HTMLElement; key: string; ghost: HTMLElement; line: HTMLElement; offsetX: number; beforeKey: string | null | undefined } | null = null;

  const draggable = () => Array.from(headRow.querySelectorAll<HTMLElement>('th[data-key]:not([data-fixed])')).filter((th) => th.offsetParent !== null);

  function start(th: HTMLElement, x: number) {
    const r = th.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'b24-col-ghost';
    ghost.textContent = th.textContent?.trim() ?? '';
    ghost.style.width = `${r.width}px`;
    ghost.style.height = `${r.height}px`;
    ghost.style.top = `${r.top}px`;
    ghost.style.left = `${r.left}px`;
    const table = th.closest('table')!;
    const tr = table.getBoundingClientRect();
    const wrap = table.closest<HTMLElement>('.b24-table-wrap')?.getBoundingClientRect() ?? tr;
    const line = document.createElement('div');
    line.className = 'b24-col-drop';
    line.style.top = `${Math.max(tr.top, wrap.top)}px`;
    line.style.height = `${Math.min(tr.bottom, wrap.bottom) - Math.max(tr.top, wrap.top)}px`;
    document.body.append(ghost, line);
    th.classList.add('is-dragging');
    document.body.classList.add('b24-col-reordering');
    drag = { th, key: th.dataset.key!, ghost, line, offsetX: x - r.left, beforeKey: undefined };
  }

  function locate(x: number) {
    if (!drag) return;
    drag.ghost.style.left = `${x - drag.offsetX}px`;
    const list = draggable();
    let before: HTMLElement | null = null;
    for (const th of list) {
      const r = th.getBoundingClientRect();
      if (x < r.left + r.width / 2) { before = th; break; }
    }
    const last = list[list.length - 1];
    const lineX = before ? before.getBoundingClientRect().left : last.getBoundingClientRect().right;
    drag.line.style.left = `${Math.round(lineX) - 1}px`;
    drag.beforeKey = before ? before.dataset.key! : null;
  }

  function finish(cancel: boolean) {
    if (!drag) return;
    const d = drag;
    drag = null;
    d.ghost.remove();
    d.line.remove();
    d.th.classList.remove('is-dragging');
    document.body.classList.remove('b24-col-reordering');
    if (cancel || d.beforeKey === undefined || d.beforeKey === d.key) return;
    // уже на своём месте?
    const keys = draggable().map((th) => th.dataset.key!);
    const i = keys.indexOf(d.key);
    const nextKey = keys[i + 1] ?? null;
    if (d.beforeKey === nextKey) return;
    opts.onReorder(d.key, d.beforeKey);
  }

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || drag) return;
    const t = e.target as HTMLElement;
    const th = t.closest<HTMLElement>('th[data-key]:not([data-fixed])');
    if (!th || !headRow.contains(th) || t.closest(INTERACTIVE)) return;
    pending = { th, x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onMove = (e: PointerEvent) => {
    if (drag) { locate(e.clientX); return; }
    if (!pending || e.pointerId !== pending.id) return;
    if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > 5) {
      const p = pending;
      pending = null;
      start(p.th, p.x);
      locate(e.clientX);
    }
  };
  const onUp = () => {
    const wasDragging = !!drag;
    pending = null;
    finish(false);
    if (wasDragging) {
      // клик после перетаскивания не должен сортировать столбец
      const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      headRow.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => headRow.removeEventListener('click', stop, true), 0);
    }
  };
  const onCancel = () => { pending = null; finish(true); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && drag) { e.stopPropagation(); finish(true); } };

  headRow.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  document.addEventListener('keydown', onKey, true);
  return () => {
    finish(true);
    headRow.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    document.removeEventListener('keydown', onKey, true);
  };
}

/**
 * Направляющая как в гриде Битрикс24: пока курсор в заголовке, у столбца под курсором
 * граница тянется линией через всю высоту таблицы. Во время изменения ширины — подсвечена и идёт за границей.
 */
export function enableColumnGuide(table: HTMLTableElement, wrap: HTMLElement): () => void {
  const head = table.tHead;
  if (!head) return () => {};
  if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
  const line = document.createElement('div');
  line.className = 'b24-col-guide';
  line.hidden = true;
  wrap.append(line);
  let current: HTMLElement | null = null;
  let resizing = false;

  const place = (th: HTMLElement) => {
    const wr = wrap.getBoundingClientRect();
    const tr = th.getBoundingClientRect();
    const tb = table.getBoundingClientRect();
    line.style.left = `${tr.right - wr.left + wrap.scrollLeft - 1}px`;
    line.style.top = `${tb.top - wr.top + wrap.scrollTop}px`;
    line.style.height = `${tb.height}px`;
    line.hidden = false;
  };
  const hide = () => { if (!resizing) { line.hidden = true; current = null; } };

  const onOver = (e: MouseEvent) => {
    if (resizing) return;
    const th = (e.target as HTMLElement).closest<HTMLElement>('th[data-key]');
    if (!th || !head.contains(th)) return;
    current = th;
    line.classList.toggle('is-active', !!(e.target as HTMLElement).closest('.b24-table__resizer'));
    place(th);
  };
  const onDown = (e: PointerEvent) => {
    const rz = (e.target as HTMLElement).closest('.b24-table__resizer');
    if (!rz) return;
    current = rz.closest('th');
    resizing = true;
    line.classList.add('is-active');
    if (current) place(current);
    const move = () => { if (current) place(current); };
    // ширина меняется в обработчике ручки (vanilla — сразу, React — после отрисовки):
    // следим и за движением (подписка после обработчика ручки), и за размером самого столбца
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(move) : null;
    if (current) ro?.observe(current);
    const subscribe = setTimeout(() => window.addEventListener('pointermove', move), 0);
    const up = (ev: PointerEvent) => {
      resizing = false;
      clearTimeout(subscribe);
      ro?.disconnect();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      line.classList.remove('is-active');
      const over = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!over || !head.contains(over)) hide(); else if (current) place(current);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  const onScroll = () => { if (current && !line.hidden) place(current); };
  // React-грид сообщает об обновлении раскладки после каждой отрисовки
  const onLayout = () => { if (current && !line.hidden) place(current); };
  table.addEventListener('b24:grid-layout', onLayout);

  head.addEventListener('mouseover', onOver);
  head.addEventListener('mouseleave', hide);
  head.addEventListener('pointerdown', onDown, true); // перехват: ручка ширины останавливает всплытие
  wrap.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    head.removeEventListener('mouseover', onOver);
    head.removeEventListener('mouseleave', hide);
    head.removeEventListener('pointerdown', onDown, true);
    table.removeEventListener('b24:grid-layout', onLayout);
    wrap.removeEventListener('scroll', onScroll);
    line.remove();
  };
}

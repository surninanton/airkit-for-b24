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
}

const PREFIX = 'b24-grid:';
export const MIN_COL_WIDTH = 60;
/** служебные столбцы: угол (чекбокс + ⚙), только чекбокс, меню ☰ */
export const SERVICE_WIDTH = { corner: 64, check: 44, menu: 36 } as const;
export const DEFAULT_COL_WIDTH = 150;

/**
 * Итоговые ширины для отрисовки: сохранённые ширины как есть, а если сумма меньше контейнера,
 * остаток получает последний видимый столбец. Благодаря этому граница любого другого столбца
 * при перетаскивании идёт ровно за курсором (браузер не «размазывает» остаток по всем столбцам).
 */
export function layoutWidths(visibleKeys: string[], widths: Record<string, number>, serviceTotal: number, containerWidth: number): { widths: Record<string, number>; total: number } {
  const out: Record<string, number> = {};
  let total = serviceTotal;
  for (const k of visibleKeys) { out[k] = widths[k] ?? DEFAULT_COL_WIDTH; total += out[k]; }
  const last = visibleKeys[visibleKeys.length - 1];
  if (last && containerWidth > 0 && total < containerWidth) {
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
export function normalizeGridState(keys: string[], saved?: Partial<GridState> | null, defaultHidden: string[] = []): GridState {
  const known = new Set(keys);
  const order = (saved?.order ?? []).filter((k) => known.has(k));
  for (const k of keys) if (!order.includes(k)) order.push(k);
  const widths: Record<string, number> = {};
  for (const [k, w] of Object.entries(saved?.widths ?? {})) if (known.has(k) && w > 0) widths[k] = Math.round(w);
  let hidden = (saved?.hidden ?? defaultHidden).filter((k) => known.has(k));
  if (hidden.length >= keys.length) hidden = hidden.slice(0, keys.length - 1); // хотя бы один столбец виден
  return { order, widths, hidden };
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
    width = Math.max(min, Math.round(startW + ev.clientX - startX));
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

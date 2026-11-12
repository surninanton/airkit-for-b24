/**
 * Drag & drop для канбана на pointer events (мышь + тач с долгим нажатием).
 *
 * Разметка:
 *   .b24-kanban
 *     .b24-kanban__column[data-column="new"]
 *       .b24-kanban__items
 *         .b24-kanban-card[data-id="42"]
 *
 * mutateDom=true (vanilla): карточка переносится в DOM, при отказе (onMove → false) возвращается.
 * mutateDom=false (React): DOM не трогается, состояние обновляет onMove.
 */

import { h } from './dom';
import { t } from './i18n';

export interface KanbanMove {
  id: string;
  from: string;
  to: string;
  /** позиция в целевой колонке (без учёта самой карточки) */
  index: number;
  fromIndex: number;
}

export interface KanbanDndOptions {
  onMove?: (move: KanbanMove) => void | boolean | Promise<void | boolean>;
  canDrop?: (move: KanbanMove) => boolean;
  mutateDom?: boolean;
  /** задержка старта перетаскивания пальцем, мс */
  touchDelay?: number;
}

const CARD = '.b24-kanban-card[data-id]';
const COLUMN = '.b24-kanban__column[data-column]';
const ITEMS = '.b24-kanban__items';
const INTERACTIVE = 'a,button,input,select,textarea,label,[contenteditable],[data-no-drag]';

function cardsOf(items: Element, except?: Element): HTMLElement[] {
  return Array.from(items.querySelectorAll<HTMLElement>(`:scope > ${CARD}`)).filter((c) => c !== except);
}

const instances = new WeakMap<HTMLElement, { off: () => void; options: KanbanDndOptions }>();

/**
 * Включает перетаскивание на доске. Повторный вызов для той же доски не навешивает обработчики второй раз:
 * возвращает прежнюю функцию отключения, а переданные опции заменяют прежние.
 * Заодно красит колонки с data-color (paintKanbanColumns).
 */
export function enableKanbanDnd(board: HTMLElement, opts?: KanbanDndOptions): () => void {
  paintKanbanColumns(board);
  const existing = instances.get(board);
  if (existing) {
    if (opts) existing.options = opts;
    return existing.off;
  }
  const state = { options: opts ?? {}, off: () => {} };
  instances.set(board, state);
  // опции читаются при каждом событии — их можно заменить повторным вызовом
  const mutateDomOf = () => state.options.mutateDom ?? true;

  let pending: { card: HTMLElement; x: number; y: number; pointerId: number; type: string; timer?: ReturnType<typeof setTimeout> } | null = null;
  let drag: {
    card: HTMLElement;
    ghost: HTMLElement;
    placeholder: HTMLElement;
    offsetX: number;
    offsetY: number;
    fromColumn: HTMLElement;
    fromIndex: number;
    origNext: Node | null;
    x: number;
    y: number;
    raf: number;
    column: HTMLElement | null;
  } | null = null;

  const preventTouchScroll = (e: TouchEvent) => { if (drag) e.preventDefault(); };

  function start(card: HTMLElement, x: number, y: number) {
    const rect = card.getBoundingClientRect();
    const fromColumn = card.closest<HTMLElement>(COLUMN)!;
    const items = card.closest(ITEMS)!;
    const placeholder = document.createElement('div');
    placeholder.className = 'b24-kanban__placeholder';
    placeholder.style.height = `${rect.height}px`;
    const ghost = card.cloneNode(true) as HTMLElement;
    ghost.classList.add('is-drag-ghost');
    ghost.removeAttribute('id');
    ghost.style.width = `${rect.width}px`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    document.body.append(ghost);

    drag = {
      card, ghost, placeholder,
      offsetX: x - rect.left, offsetY: y - rect.top,
      fromColumn, fromIndex: cardsOf(items).indexOf(card),
      origNext: card.nextSibling,
      x, y, raf: 0, column: fromColumn,
    };
    card.before(placeholder);
    card.classList.add('is-drag-source');
    fromColumn.classList.add('is-drop-target');
    document.body.classList.add('b24-dragging');
    document.addEventListener('touchmove', preventTouchScroll, { passive: false });
    drag.raf = requestAnimationFrame(tick);
  }

  function locate(x: number, y: number) {
    if (!drag) return;
    const el = document.elementFromPoint(x, y);
    const column = el?.closest<HTMLElement>(COLUMN);
    if (!column || !board.contains(column)) return;
    const items = column.querySelector<HTMLElement>(ITEMS);
    if (!items) return;
    if (column !== drag.column) {
      drag.column?.classList.remove('is-drop-target');
      column.classList.add('is-drop-target');
      drag.column = column;
    }
    const before = cardsOf(items, drag.card).find((c) => {
      const r = c.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    if (before) { if (drag.placeholder.nextSibling !== before) before.before(drag.placeholder); }
    else if (items.lastElementChild !== drag.placeholder) items.append(drag.placeholder);
  }

  function autoScroll(x: number, y: number) {
    const EDGE = 60;
    const speed = (dist: number) => Math.ceil((EDGE - dist) / 4);
    const b = board.getBoundingClientRect();
    if (x < b.left + EDGE) board.scrollLeft -= speed(x - b.left);
    else if (x > b.right - EDGE) board.scrollLeft += speed(b.right - x);
    const items = drag?.column?.querySelector<HTMLElement>(ITEMS);
    if (items && items.scrollHeight > items.clientHeight) {
      const r = items.getBoundingClientRect();
      if (y < r.top + EDGE && y > r.top - 20) items.scrollTop -= speed(Math.max(0, y - r.top));
      else if (y > r.bottom - EDGE && y < r.bottom + 20) items.scrollTop += speed(Math.max(0, r.bottom - y));
    }
  }

  function follow() {
    if (!drag) return;
    drag.ghost.style.left = `${drag.x - drag.offsetX}px`;
    drag.ghost.style.top = `${drag.y - drag.offsetY}px`;
    locate(drag.x, drag.y);
  }

  /** Кадровый цикл нужен только для автопрокрутки у краёв, пока курсор стоит. */
  function tick() {
    if (!drag) return;
    const { scrollLeft } = board;
    autoScroll(drag.x, drag.y);
    if (board.scrollLeft !== scrollLeft) locate(drag.x, drag.y);
    drag.raf = requestAnimationFrame(tick);
  }

  function cleanup(d: NonNullable<typeof drag>) {
    cancelAnimationFrame(d.raf);
    d.ghost.remove();
    d.card.classList.remove('is-drag-source');
    board.querySelectorAll('.is-drop-target').forEach((c) => c.classList.remove('is-drop-target'));
    document.body.classList.remove('b24-dragging');
    document.removeEventListener('touchmove', preventTouchScroll);
  }

  async function finish(cancel: boolean) {
    if (!drag) return;
    const d = drag;
    drag = null;
    cleanup(d);
    const toColumn = d.placeholder.closest<HTMLElement>(COLUMN);
    const items = d.placeholder.parentElement;
    const index = items ? Array.from(items.children).filter((n) => n === d.placeholder || (n.matches(CARD) && n !== d.card)).indexOf(d.placeholder) : -1;
    const move: KanbanMove = {
      id: d.card.dataset.id!,
      from: d.fromColumn.dataset.column!,
      to: toColumn?.dataset.column ?? d.fromColumn.dataset.column!,
      index,
      fromIndex: d.fromIndex,
    };
    const unchanged = move.from === move.to && move.index === move.fromIndex;
    const allowed = !cancel && !unchanged && toColumn && (state.options.canDrop?.(move) ?? true);

    if (allowed && mutateDomOf()) d.placeholder.replaceWith(d.card);
    else d.placeholder.remove();
    if (!allowed) return;

    const revert = () => {
      if (!mutateDomOf()) return;
      const origItems = d.fromColumn.querySelector(ITEMS)!;
      if (d.origNext && d.origNext.parentNode === origItems) origItems.insertBefore(d.card, d.origNext);
      else origItems.insertBefore(d.card, cardsOf(origItems, d.card)[d.fromIndex] ?? null);
    };

    const event = new CustomEvent<KanbanMove>('b24:kanban-move', { detail: move, bubbles: true, cancelable: true });
    if (!board.dispatchEvent(event)) return revert();
    try {
      const result = await state.options.onMove?.(move);
      if (result === false) revert();
    } catch (err) {
      revert();
      throw err;
    }
  }

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || drag) return;
    const target = e.target as HTMLElement;
    const card = target.closest<HTMLElement>(CARD);
    if (!card || !board.contains(card) || target.closest(INTERACTIVE)) return;
    pending = { card, x: e.clientX, y: e.clientY, pointerId: e.pointerId, type: e.pointerType };
    if (e.pointerType === 'touch') {
      pending.timer = setTimeout(() => {
        if (!pending) return;
        const p = pending;
        pending = null;
        navigator.vibrate?.(10);
        start(p.card, p.x, p.y);
      }, state.options.touchDelay ?? 250);
    }
  };

  const onMove = (e: PointerEvent) => {
    if (drag) {
      drag.x = e.clientX;
      drag.y = e.clientY;
      follow();
      return;
    }
    if (!pending || e.pointerId !== pending.pointerId) return;
    const dist = Math.hypot(e.clientX - pending.x, e.clientY - pending.y);
    if (pending.type === 'touch') {
      if (dist > 8) { clearTimeout(pending.timer); pending = null; } // это скролл, не drag
      return;
    }
    if (dist > 5) {
      const p = pending;
      pending = null;
      start(p.card, p.x, p.y);
      drag!.x = e.clientX;
      drag!.y = e.clientY;
      follow();
    }
  };

  const onUp = () => {
    if (pending) { clearTimeout(pending.timer); pending = null; }
    if (drag) void finish(false);
  };
  const onCancel = () => {
    if (pending) { clearTimeout(pending.timer); pending = null; }
    if (drag) void finish(true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && drag) { e.stopPropagation(); void finish(true); }
  };
  // Клик после перетаскивания не должен открывать карточку
  let suppressClick = false;
  const onClickCapture = (e: MouseEvent) => {
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; }
  };
  const markDragged = () => {
    if (!drag) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
  };

  // Клавиатура: Alt+←/→ — в соседнюю колонку, Alt+↑/↓ — сдвиг внутри колонки
  const onCardKey = async (e: KeyboardEvent) => {
    if (!e.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const card = (e.target as HTMLElement).closest<HTMLElement>(CARD);
    if (!card || !board.contains(card)) return;
    e.preventDefault();
    const columns = Array.from(board.querySelectorAll<HTMLElement>(COLUMN));
    const fromColumn = card.closest<HTMLElement>(COLUMN)!;
    const fromItems = fromColumn.querySelector(ITEMS)!;
    const fromIndex = cardsOf(fromItems).indexOf(card);
    let toColumn = fromColumn;
    let index = fromIndex;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      toColumn = columns[columns.indexOf(fromColumn) + (e.key === 'ArrowRight' ? 1 : -1)];
      if (!toColumn) return;
      index = 0;
    } else {
      index = Math.max(0, Math.min(cardsOf(fromItems).length - 1, fromIndex + (e.key === 'ArrowDown' ? 1 : -1)));
      if (index === fromIndex) return;
    }
    const move: KanbanMove = { id: card.dataset.id!, from: fromColumn.dataset.column!, to: toColumn.dataset.column!, index, fromIndex };
    if (state.options.canDrop && !state.options.canDrop(move)) return;
    const toItems = toColumn.querySelector(ITEMS)!;
    const doMove = () => {
      const siblings = cardsOf(toItems, card);
      toItems.insertBefore(card, siblings[index] ?? null);
      card.focus();
    };
    if (mutateDomOf()) doMove();
    const event = new CustomEvent<KanbanMove>('b24:kanban-move', { detail: move, bubbles: true, cancelable: true });
    const ok = board.dispatchEvent(event) && (await state.options.onMove?.(move)) !== false;
    if (!ok && mutateDomOf()) fromItems.insertBefore(card, cardsOf(fromItems, card)[fromIndex] ?? null);
    if (!mutateDomOf()) requestAnimationFrame(() => board.querySelector<HTMLElement>(`${CARD}[data-id="${CSS.escape(move.id)}"]`)?.focus());
  };

  board.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', markDragged, true);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  document.addEventListener('keydown', onKey, true);
  board.addEventListener('click', onClickCapture, true);
  board.addEventListener('keydown', onCardKey);

  state.off = () => {
    if (instances.get(board) === state) instances.delete(board);
    if (drag) void finish(true);
    board.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', markDragged, true);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    document.removeEventListener('keydown', onKey, true);
    board.removeEventListener('click', onClickCapture, true);
    board.removeEventListener('keydown', onCardKey);
  };
  return state.off;
}

/** Контрастный цвет текста для цветной шапки колонки. */
export function readableTextColor(color: string): string {
  const m = color.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return '#1f2329';
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.36 ? '#1f2329' : '#ffffff';
}

/** Проставляет --column-color / --column-text по data-color у колонок. */
export function paintKanbanColumns(board: HTMLElement): void {
  board.querySelectorAll<HTMLElement>('.b24-kanban__column[data-color]').forEach((col) => {
    const color = col.dataset.color!;
    col.style.setProperty('--column-color', color);
    col.style.setProperty('--column-text', readableTextColor(color));
  });
}

/* ── Быстрое добавление в колонку («+ Быстрый элемент», как на портале) ───────── */

export interface KanbanQuickField {
  name: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'select';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  value?: string;
}

export interface KanbanQuickAddOptions {
  /** поля формы; по умолчанию одно — «Название» (name: 'title') */
  fields?: KanbanQuickField[];
  /** сохранение; false или исключение — форма остаётся с введёнными значениями */
  onSave: (values: Record<string, string>, columnId: string) => void | boolean | Promise<void | boolean>;
  /** после сохранения форма очищается и остаётся открытой (как на портале); false — закрыть */
  keepOpen?: boolean;
  submitText?: string;
  onClose?: () => void;
}

export interface KanbanQuickAddHandle {
  element: HTMLFormElement;
  close: () => void;
}

const openForms = new WeakMap<HTMLElement, KanbanQuickAddHandle>();

/** Открывает форму быстрого добавления в колонке (под шапкой и «+»). Повторный вызов — фокус на открытой форме. */
export function openKanbanQuickAdd(column: HTMLElement, options: KanbanQuickAddOptions): KanbanQuickAddHandle {
  const opened = openForms.get(column);
  if (opened) {
    opened.element.querySelector<HTMLElement>('input,select')?.focus();
    return opened;
  }
  const fields = options.fields?.length ? options.fields : [{ name: 'title', placeholder: t('Название'), required: true }];
  const controls = fields.map((f) => {
    if (f.type === 'select') {
      const sel = h('select', { class: 'b24-select', name: f.name, 'aria-label': f.placeholder, required: f.required });
      for (const o of f.options ?? []) sel.append(h('option', { value: o.value }, o.label));
      if (f.value !== undefined) sel.value = f.value;
      return sel;
    }
    const input = h('input', {
      class: 'b24-input', name: f.name, type: f.type === 'number' ? 'number' : 'text',
      placeholder: f.placeholder, 'aria-label': f.placeholder, required: f.required, autocomplete: 'off',
    });
    if (f.value !== undefined) input.value = f.value;
    return input;
  });
  const error = h('div', { class: 'b24-kanban__quick-error', role: 'alert' });
  const save = h('button', { type: 'submit', class: 'b24-btn b24-btn--success b24-btn--xs' }, options.submitText ?? t('Сохранить'));
  const cancel = h('button', { type: 'button', class: 'b24-btn b24-btn--plain b24-btn--xs' }, t('Отмена'));
  const form = h('form', { class: 'b24-kanban__quick', novalidate: true, 'aria-label': t('Быстрое добавление') }, ...controls, error, h('div', { class: 'b24-kanban__quick-actions' }, save, cancel));

  const columnId = column.dataset.column ?? '';
  const close = () => {
    if (openForms.get(column) !== handle) return;
    openForms.delete(column);
    form.remove();
    column.querySelector<HTMLElement>('.b24-kanban__add')?.setAttribute('aria-expanded', 'false');
    options.onClose?.();
  };
  const handle: KanbanQuickAddHandle = { element: form, close };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.classList.contains('is-busy')) return;
    const values: Record<string, string> = {};
    let missing: HTMLElement | null = null;
    fields.forEach((f, i) => {
      const v = controls[i].value.trim();
      values[f.name] = v;
      if (f.required && !v && !missing) missing = controls[i];
    });
    if (missing) { (missing as HTMLElement).focus(); return; }
    error.textContent = '';
    form.classList.add('is-busy');
    save.disabled = true;
    try {
      const result = await options.onSave(values, columnId);
      if (result === false) return;
      if (options.keepOpen === false) return close();
      controls.forEach((c, i) => { c.value = fields[i].value ?? (c instanceof HTMLSelectElement ? c.options[0]?.value ?? '' : ''); });
      controls[0]?.focus();
    } catch (err) {
      error.textContent = err instanceof Error && err.message ? err.message : t('Не удалось сохранить');
    } finally {
      form.classList.remove('is-busy');
      save.disabled = false;
    }
  });
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  });
  cancel.addEventListener('click', close);

  const after = column.querySelector('.b24-kanban__add') ?? column.querySelector('.b24-kanban__total') ?? column.querySelector('.b24-kanban__header');
  if (after) after.after(form); else column.prepend(form);
  column.querySelector<HTMLElement>('.b24-kanban__add')?.setAttribute('aria-expanded', 'true');
  openForms.set(column, handle);
  controls[0]?.focus();
  return handle;
}

/** Клик по «+» (.b24-kanban__add) в любой колонке доски открывает форму быстрого добавления. Возвращает функцию отключения. */
export function enableKanbanQuickAdd(board: HTMLElement, options: KanbanQuickAddOptions): () => void {
  const onClick = (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.b24-kanban__add');
    const column = btn?.closest<HTMLElement>(COLUMN);
    if (!btn || !column || !board.contains(column)) return;
    const opened = openForms.get(column);
    if (opened) opened.close(); else openKanbanQuickAdd(column, options);
  };
  board.addEventListener('click', onClick);
  return () => board.removeEventListener('click', onClick);
}

/* ── Выбор стадии в карточке: одна строка с прокруткой, текущая — по центру ───── */

export interface StagePickerStage { id: string; title: string; color?: string }

export interface StagePickerOptions {
  stages: StagePickerStage[];
  value?: string;
  /** смена стадии; false или исключение — вернуть прежнюю */
  onChange?: (id: string, prev: string | undefined) => void | boolean | Promise<void | boolean>;
  disabled?: boolean;
  label?: string;
}

export interface StagePickerHandle {
  element: HTMLElement;
  getValue: () => string | undefined;
  setValue: (id: string | undefined, smooth?: boolean) => void;
  setStages: (stages: StagePickerStage[], value?: string) => void;
  destroy: () => void;
}

/** Прокручивает строку так, чтобы элемент стоял по центру (у краёв — прижимается к началу/концу). */
export function scrollIntoCenter(row: HTMLElement, item: HTMLElement, smooth = false): void {
  const left = item.offsetLeft - row.offsetLeft * (item.offsetParent === row ? 0 : 1) - (row.clientWidth - item.offsetWidth) / 2;
  const max = row.scrollWidth - row.clientWidth;
  row.scrollTo({ left: Math.max(0, Math.min(max, left)), behavior: smooth ? 'smooth' : 'auto' });
}

export function stagePicker(el: HTMLElement, options: StagePickerOptions): StagePickerHandle {
  let stages = options.stages;
  let value = options.value;
  el.classList.add('b24-stage-picker');
  el.setAttribute('role', 'radiogroup');
  el.setAttribute('aria-label', options.label ?? t('Стадия'));
  el.classList.toggle('is-disabled', !!options.disabled);

  const updateEdges = () => {
    const max = el.scrollWidth - el.clientWidth;
    el.classList.toggle('is-fade-start', el.scrollLeft > 1);
    el.classList.toggle('is-fade-end', el.scrollLeft < max - 1);
  };

  const paint = () => {
    el.querySelectorAll<HTMLButtonElement>('.b24-stage-picker__item').forEach((b) => {
      const on = b.dataset.id === value;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on || (value === undefined && b === el.firstElementChild) ? 0 : -1;
    });
  };

  const center = (smooth: boolean) => {
    const chip = el.querySelector<HTMLElement>('.b24-stage-picker__item.is-active');
    if (chip) scrollIntoCenter(el, chip, smooth);
    updateEdges();
  };

  const render = () => {
    el.replaceChildren(...stages.map((s) => {
      const b = h('button', { type: 'button', class: 'b24-stage-picker__item', role: 'radio', 'data-id': s.id, disabled: options.disabled }, s.title);
      if (s.color) {
        b.style.setProperty('--_c', s.color);
        b.style.setProperty('--_t', readableTextColor(s.color));
      }
      return b;
    }));
    paint();
  };

  const select = async (id: string) => {
    if (id === value || options.disabled) return;
    const prev = value;
    value = id;
    paint();
    center(true);
    try {
      if ((await options.onChange?.(id, prev)) === false) { value = prev; paint(); center(true); }
    } catch (err) {
      value = prev; paint(); center(true);
      throw err;
    }
  };

  const onClick = (e: MouseEvent) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.b24-stage-picker__item');
    if (b && el.contains(b)) void select(b.dataset.id!);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const items = Array.from(el.querySelectorAll<HTMLButtonElement>('.b24-stage-picker__item'));
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
    items[next].focus();
    void select(items[next].dataset.id!);
  };
  // колесо мыши прокручивает строку по горизонтали, пока есть куда
  const onWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0 || (e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => center(false)) : null;

  render();
  el.addEventListener('click', onClick);
  el.addEventListener('keydown', onKey);
  el.addEventListener('scroll', updateEdges, { passive: true });
  el.addEventListener('wheel', onWheel, { passive: false });
  ro?.observe(el);
  requestAnimationFrame(() => center(false));

  return {
    element: el,
    getValue: () => value,
    setValue: (id, smooth = true) => { value = id; paint(); center(smooth); },
    setStages: (next, v) => { stages = next; if (v !== undefined) value = v; render(); center(false); },
    destroy: () => {
      el.removeEventListener('click', onClick);
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('scroll', updateEdges);
      el.removeEventListener('wheel', onWheel);
      ro?.disconnect();
      el.classList.remove('is-disabled', 'is-fade-start', 'is-fade-end');
    },
  };
}

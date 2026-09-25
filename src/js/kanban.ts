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

export function enableKanbanDnd(board: HTMLElement, options: KanbanDndOptions = {}): () => void {
  const { mutateDom = true, touchDelay = 250 } = options;

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
    const allowed = !cancel && !unchanged && toColumn && (options.canDrop?.(move) ?? true);

    if (allowed && mutateDom) d.placeholder.replaceWith(d.card);
    else d.placeholder.remove();
    if (!allowed) return;

    const revert = () => {
      if (!mutateDom) return;
      const origItems = d.fromColumn.querySelector(ITEMS)!;
      if (d.origNext && d.origNext.parentNode === origItems) origItems.insertBefore(d.card, d.origNext);
      else origItems.insertBefore(d.card, cardsOf(origItems, d.card)[d.fromIndex] ?? null);
    };

    const event = new CustomEvent<KanbanMove>('b24:kanban-move', { detail: move, bubbles: true, cancelable: true });
    if (!board.dispatchEvent(event)) return revert();
    try {
      const result = await options.onMove?.(move);
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
      }, touchDelay);
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
    if (options.canDrop && !options.canDrop(move)) return;
    const toItems = toColumn.querySelector(ITEMS)!;
    const doMove = () => {
      const siblings = cardsOf(toItems, card);
      toItems.insertBefore(card, siblings[index] ?? null);
      card.focus();
    };
    if (mutateDom) doMove();
    const event = new CustomEvent<KanbanMove>('b24:kanban-move', { detail: move, bubbles: true, cancelable: true });
    const ok = board.dispatchEvent(event) && (await options.onMove?.(move)) !== false;
    if (!ok && mutateDom) fromItems.insertBefore(card, cardsOf(fromItems, card)[fromIndex] ?? null);
    if (!mutateDom) requestAnimationFrame(() => board.querySelector<HTMLElement>(`${CARD}[data-id="${CSS.escape(move.id)}"]`)?.focus());
  };

  board.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', markDragged, true);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  document.addEventListener('keydown', onKey, true);
  board.addEventListener('click', onClickCapture, true);
  board.addEventListener('keydown', onCardKey);

  return () => {
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

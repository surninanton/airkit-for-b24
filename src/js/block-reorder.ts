/**
 * Перестановка блоков перетаскиванием с зажатым Ctrl (⌘ на Mac, Alt) и левой кнопкой мыши.
 * Включается сама на колонке карточки сущности (`.b24-entity__main`) и на любом контейнере с `data-b24-reorder`;
 * `data-b24-reorder="off"` отключает. Порядок запоминается в хранилище кита. Esc во время перетаскивания — отмена.
 *
 *   enableBlockReorder(el, { onReorder: (ids) => save(ids), key: 'order-card' });
 *   // id блока: data-b24-block, иначе заголовок .b24-card__title / .b24-section-title, иначе номер
 */
import { storageGet, storageSet } from './storage';

export interface BlockReorderOptions {
  /** какие дочерние элементы двигаются; по умолчанию — все прямые */
  items?: string;
  /** ключ запоминания порядка; по умолчанию — из заголовков блоков */
  key?: string | null;
  /** порядок изменён */
  onReorder?: (ids: string[]) => void;
}
export interface BlockReorderHandle { getOrder(): string[]; apply(): void; reset(): void; destroy(): void }

const PREFIX = 'b24-blocks:';
const MOVE_THRESHOLD = 4;

export function enableBlockReorder(host: HTMLElement, options: BlockReorderOptions = {}): BlockReorderHandle {
  const items = () => Array.from(host.children).filter((c): c is HTMLElement => c instanceof HTMLElement && (!options.items || c.matches(options.items)));
  const idOf = (el: HTMLElement, i: number) =>
    el.dataset.b24Block ?? el.querySelector('.b24-card__title, .b24-section-title')?.textContent?.trim() ?? String(i);
  const getOrder = () => items().map(idOf);
  const storeKey = () => PREFIX + (options.key ?? [...getOrder()].sort().join('|'));
  const defaultOrder = getOrder();

  const apply = () => {
    let saved: string[] = [];
    try { const v = JSON.parse(storageGet(storeKey()) ?? '[]'); if (Array.isArray(v)) saved = v.filter((x) => typeof x === 'string'); } catch { /* нет сохранённого */ }
    if (!saved.length) return;
    const list = items();
    const rank = (el: HTMLElement, i: number) => { const k = saved.indexOf(idOf(el, i)); return k < 0 ? saved.length + i : k; };
    list.map((el, i) => ({ el, r: rank(el, i) })).sort((a, b) => a.r - b.r).forEach(({ el }) => host.append(el));
  };
  const save = () => { try { storageSet(storeKey(), JSON.stringify(getOrder())); } catch { /* хранилище недоступно */ } };
  const modifier = (e: PointerEvent | KeyboardEvent) => e.ctrlKey || e.metaKey || e.altKey;

  let drag: { el: HTMLElement; startX: number; startY: number; grabDY: number; before: string[]; active: boolean; id: number } | null = null;
  let scroller: HTMLElement | null = null;
  let blockNextClick = false;

  const scrollParent = (el: HTMLElement): HTMLElement | null => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    }
    return null;
  };
  const position = (clientY: number) => {
    const d = drag!;
    d.el.style.transform = '';
    const natural = d.el.getBoundingClientRect();
    const others = items().filter((x) => x !== d.el);
    const center = clientY - d.grabDY + natural.height / 2;
    const next = others.find((x) => { const r = x.getBoundingClientRect(); return center < r.top + r.height / 2; });
    if (next) { if (d.el.nextElementSibling !== next) host.insertBefore(d.el, next); }
    else if (others.length && host.lastElementChild !== d.el) host.append(d.el);
    d.el.style.transform = '';
    const top = d.el.getBoundingClientRect().top;
    d.el.style.transform = `translateY(${Math.round(clientY - d.grabDY - top)}px)`;
  };
  const finish = (commit: boolean) => {
    const d = drag;
    if (!d) return;
    drag = null;
    try { host.releasePointerCapture(d.id); } catch { /* уже отпущен */ }
    window.removeEventListener('keydown', onKey, true);
    document.documentElement.classList.remove('b24-is-reordering');
    d.el.classList.remove('is-reordering');
    d.el.style.transform = '';
    host.classList.remove('is-reordering-host');
    if (!d.active) return;
    blockNextClick = true;
    window.setTimeout(() => { blockNextClick = false; }, 0);
    if (!commit) { d.before.forEach((id) => { const el = items().find((x, i) => idOf(x, i) === id); if (el) host.append(el); }); return; }
    const after = getOrder();
    if (after.join('\u0000') !== d.before.join('\u0000')) { save(); options.onReorder?.(after); host.dispatchEvent(new CustomEvent('b24:reorder', { bubbles: true, detail: { ids: after } })); }
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); finish(false); } };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || !modifier(e) || drag) return;
    const target = e.target as HTMLElement;
    const el = items().find((x) => x.contains(target));
    if (!el) return;
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    drag = { el, startX: e.clientX, startY: e.clientY, grabDY: e.clientY - rect.top, before: getOrder(), active: false, id: e.pointerId };
    scroller = scrollParent(host);
    try { host.setPointerCapture(e.pointerId); } catch { /* нет захвата */ }
    window.addEventListener('keydown', onKey, true);
  };
  const onMove = (e: PointerEvent) => {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < MOVE_THRESHOLD) return;
      d.active = true;
      d.el.classList.add('is-reordering');
      host.classList.add('is-reordering-host');
      document.documentElement.classList.add('b24-is-reordering');
    }
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      if (e.clientY < r.top + 40) scroller.scrollTop -= 14; else if (e.clientY > r.bottom - 40) scroller.scrollTop += 14;
    }
    position(e.clientY);
  };
  const onUp = (e: PointerEvent) => { if (drag && e.pointerId === drag.id) finish(true); };
  const onCancel = (e: PointerEvent) => { if (drag && e.pointerId === drag.id) finish(false); };
  const onClick = (e: MouseEvent) => { if (blockNextClick) { e.preventDefault(); e.stopPropagation(); } };
  const onMenu = (e: Event) => { if (drag) e.preventDefault(); };
  // Ctrl+клик на Mac открывает контекстное меню: во время и сразу после перетаскивания оно не нужно
  const onModDown = (e: KeyboardEvent) => { if (modifier(e)) host.classList.add('is-reorder-ready'); };
  const onModUp = (e: KeyboardEvent) => { if (!modifier(e)) host.classList.remove('is-reorder-ready'); };

  host.addEventListener('pointerdown', onDown, true);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onCancel);
  host.addEventListener('click', onClick, true);
  host.addEventListener('contextmenu', onMenu, true);
  window.addEventListener('keydown', onModDown);
  window.addEventListener('keyup', onModUp);
  host.classList.add('b24-reorderable');
  apply();

  return {
    getOrder, apply,
    reset() { storageSet(storeKey(), null); defaultOrder.forEach((id) => { const el = items().find((x, i) => idOf(x, i) === id); if (el) host.append(el); }); },
    destroy() {
      finish(false);
      host.removeEventListener('pointerdown', onDown, true);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onCancel);
      host.removeEventListener('click', onClick, true);
      host.removeEventListener('contextmenu', onMenu, true);
      window.removeEventListener('keydown', onModDown);
      window.removeEventListener('keyup', onModUp);
      host.classList.remove('b24-reorderable', 'is-reorder-ready');
    },
  };
}

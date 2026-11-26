/**
 * Контекстное меню: правая кнопка, долгое нажатие пальцем (≈600 мс) и клавиша меню / Shift+F10.
 *
 *   const cm = contextMenu(row, [
 *     { label: 'Открыть', icon: 'eye', onClick: open },
 *     { separator: true },
 *     { label: 'Удалить', icon: 'trash', danger: true, onClick: remove },
 *   ]);
 *   // или одно меню на много строк: contextMenu(list, (e, target) => itemsFor(target.closest('[data-id]')), { selector: '[data-id]' })
 *   openContextMenu(x, y, items)  — открыть в точке (например, от невидимого якоря)
 *
 * После долгого нажатия отпускание пальца не закрывает меню и не вызывает click по элементу под ним
 * (`ignoreOutsideMs`, `suppressClickMs`). Esc, клик мимо, прокрутка и смена размера закрывают.
 */
import { icon, type IconName } from '../icons';
import { bringToFront, h, html, pushLayer } from './dom';

function swatchEl(color: string): HTMLElement {
  const e = h('span', { class: 'b24-menu__swatch', 'aria-hidden': 'true' });
  e.style.background = color;
  return e;
}

export interface ContextMenuItem {
  label?: string;
  icon?: IconName;
  /** цветной кружок 14 px вместо иконки */
  swatch?: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  /** разделитель вместо пункта */
  separator?: boolean;
  /** заголовок группы (серым) вместо пункта */
  title?: string;
  /** своё содержимое вместо пункта: палитра, поле ввода, мини-форма; функция получает close() для закрытия меню. Позиция пересчитывается, когда меню выросло */
  content?: Node | ((close: () => void) => Node);
  /** отметка ✓ справа (role=menuitemcheckbox): «Папка 1 ✓» */
  checked?: boolean;
  /** вложенное меню: пункт открывает его справа (клик, → или наведение), ← и Esc закрывают только вложенное */
  children?: ContextMenuItem[];
  onClick?: () => void;
}
export type ContextMenuItems = ContextMenuItem[] | ((event: Event, target: HTMLElement) => ContextMenuItem[] | null | undefined);
export interface ContextMenuOptions {
  /** долгое нажатие, мс (по умолчанию 600; 0 — выключить) */
  longPress?: number;
  /** после открытия клики мимо игнорируются столько мс: отпускание пальца после долгого нажатия не должно закрывать меню (по умолчанию 400) */
  ignoreOutsideMs?: number;
  /** и подавлять следующий click на столько мс (по умолчанию 500) */
  suppressClickMs?: number;
  /** меню на делегированных элементах: открывать, только если цель события внутри selector */
  selector?: string;
  /** оставить стандартное меню браузера на тексте в полях ввода (по умолчанию да) */
  keepNativeOnInputs?: boolean;
  onOpen?: (target: HTMLElement) => void;
  onClose?: () => void;
}
export interface ContextMenuHandle { open(x: number, y: number): void; close(): void; destroy(): void }

let current: { close: () => void } | null = null;

/** Открыть меню в точке экрана. Возвращает функцию закрытия. */
export function openContextMenu(x: number, y: number, items: ContextMenuItem[], options: Pick<ContextMenuOptions, 'ignoreOutsideMs' | 'onClose'> = {}): () => void {
  current?.close();
  const menu = h('div', { class: 'b24-popup b24-root b24-context-menu', role: 'menu' });
  const list = h('div', { class: 'b24-menu' });
  menu.append(list);
  const btns: HTMLButtonElement[] = [];
  const subs: Array<{ el: HTMLElement; owner: HTMLElement; close: () => void }> = [];
  const closeSubs = (from = 0) => { while (subs.length > from) subs.pop()!.close(); };
  /** вложенное меню справа от пункта (или слева, если не помещается) */
  const openSub = (btn: HTMLButtonElement, children: ContextMenuItem[], level: number) => {
    if (subs[level]?.owner === btn) return;
    closeSubs(level);
    const sub = h('div', { class: 'b24-popup b24-root b24-context-menu b24-context-menu--sub', role: 'menu' });
    const subList = h('div', { class: 'b24-menu' });
    sub.append(subList);
    const subBtns: HTMLButtonElement[] = [];
    fill(subList, children, subBtns, level + 1);
    sub.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;';
    document.body.append(sub);
    bringToFront(sub);
    const r = btn.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const w = sub.offsetWidth, hh = sub.offsetHeight;
    const left = r.right + 2 + w > vw - 8 ? Math.max(8, r.left - w - 2) : r.right + 2;
    sub.style.left = `${Math.round(left)}px`;
    sub.style.top = `${Math.round(Math.max(8, Math.min(r.top - 5, vh - hh - 8)))}px`;
    sub.style.visibility = '';
    btn.setAttribute('aria-expanded', 'true');
    const back = () => { closeSubs(level); btn.focus({ preventScroll: true }); };
    sub.addEventListener('keydown', (e) => {
      const enabled = subBtns.filter((b) => !b.disabled);
      const k = enabled.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'ArrowLeft' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); back(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); enabled[(k + 1) % enabled.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); enabled[(k - 1 + enabled.length) % enabled.length]?.focus(); }
      else if (e.key === 'Tab') { e.preventDefault(); close(); }
    });
    sub.addEventListener('contextmenu', (e) => e.preventDefault());
    subs[level] = { el: sub, owner: btn, close: () => { sub.remove(); btn.removeAttribute('aria-expanded'); } };
    return subBtns;
  };
  function fill(list: HTMLElement, entries: ContextMenuItem[], into: HTMLButtonElement[], level: number) {
    for (const it of entries) {
      if (it.separator) { list.append(h('div', { class: 'b24-menu__divider', role: 'separator' })); continue; }
      if (it.content) {
        const box = h('div', { class: 'b24-context-menu__content' });
        box.append(typeof it.content === 'function' ? it.content(() => close()) : it.content);
        list.append(box);
        continue;
      }
      if (it.title && !it.label) { list.append(h('div', { class: 'b24-menu__title' }, it.title)); continue; }
      const hasSub = !!it.children?.length;
      const b = h('button', { type: 'button', role: it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem', class: `b24-menu__item${it.danger ? ' b24-menu__item--danger' : ''}`, tabindex: '-1' }, it.swatch ? swatchEl(it.swatch) : it.icon ? html(icon(it.icon)) : '', h('span', {}, it.label ?? '')) as HTMLButtonElement;
      if (it.checked !== undefined) b.setAttribute('aria-checked', String(!!it.checked));
      if (it.hint) b.append(h('span', { class: 'b24-menu__hint' }, it.hint));
      if (hasSub) { b.setAttribute('aria-haspopup', 'menu'); b.append(h('span', { class: 'b24-menu__sub', 'aria-hidden': 'true' }, html(icon('chevronRight', { size: 14 })))); }
      if (it.disabled) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
      if (hasSub) {
        const open = (focus: boolean) => { const sb = openSub(b, it.children!, level); if (focus) (sb ?? [])[0]?.focus(); };
        b.addEventListener('click', () => open(false));
        b.addEventListener('pointerenter', () => { if (!b.disabled) open(false); });
        b.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); open(true); } });
      } else {
        b.addEventListener('pointerenter', () => closeSubs(level));
        b.addEventListener('click', () => { close(); it.onClick?.(); });
      }
      into.push(b);
      list.append(b);
    }
  }
  fill(list, items, btns, 0);
  menu.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;';
  document.body.append(menu);
  bringToFront(menu);
  const place = () => {
    const w = menu.offsetWidth, hh = menu.offsetHeight;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    menu.style.left = `${Math.round(Math.max(8, Math.min(x, vw - w - 8)))}px`;
    menu.style.top = `${Math.round(Math.max(8, Math.min(y + hh > vh - 8 ? y - hh : y, vh - hh - 8)))}px`;
    menu.style.visibility = '';
  };
  place();
  // содержимое пункта может менять размер (палитра, раскрытие): держим меню внутри экрана
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => place()) : null;
  ro?.observe(menu);
  const openedAt = Date.now();
  const ignore = options.ignoreOutsideMs ?? 400;
  const inside = (n: Node) => menu.contains(n) || subs.some((x) => x?.el.contains(n));
  const onDown = (e: Event) => { if (Date.now() - openedAt < ignore) return; if (!inside(e.target as Node)) close(); };
  // прокрутка закрывает меню, но не сразу после открытия: страница могла доезжать до цели (scrollIntoView)
  const onScroll = (e: Event) => { if (Date.now() - openedAt < 250) return; if (!inside(e.target as Node)) close(); };
  const onKey = (e: KeyboardEvent) => {
    const enabled = btns.filter((b) => !b.disabled);
    const i = enabled.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); enabled[(i + 1) % enabled.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); enabled[(i - 1 + enabled.length) % enabled.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); enabled[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); enabled[enabled.length - 1]?.focus(); }
    else if (e.key === 'Tab') { e.preventDefault(); close(); }
  };
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', close);
  menu.addEventListener('keydown', onKey);
  menu.addEventListener('contextmenu', (e) => e.preventDefault());
  const releaseLayer = pushLayer(() => close());
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    closeSubs();
    releaseLayer();
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', close);
    ro?.disconnect();
    menu.remove();
    if (current?.close === close) current = null;
    options.onClose?.();
  }
  current = { close };
  return close;
}

export function contextMenu(target: HTMLElement | Document, items: ContextMenuItems, options: ContextMenuOptions = {}): ContextMenuHandle {
  const longPress = options.longPress ?? 600;
  let closeFn: (() => void) | null = null;
  let timer = 0;
  let press: { x: number; y: number; id: number; el: HTMLElement } | null = null;
  let suppressUntil = 0;

  const resolve = (e: Event, el: HTMLElement) => (typeof items === 'function' ? items(e, el) : items) ?? [];
  const matched = (e: Event): HTMLElement | null => {
    const t = e.target as HTMLElement | null;
    if (!t || !(t instanceof Element)) return null;
    if (options.selector) return t.closest<HTMLElement>(options.selector);
    return t as HTMLElement;
  };
  const show = (x: number, y: number, e: Event, el: HTMLElement) => {
    const list = resolve(e, el);
    if (!list.length) return false;
    closeFn?.();
    closeFn = openContextMenu(x, y, list, { ignoreOutsideMs: options.ignoreOutsideMs, onClose: () => { closeFn = null; options.onClose?.(); } });
    options.onOpen?.(el);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.b24-context-menu .b24-menu__item:not(:disabled)')?.focus({ preventScroll: true }));
    return true;
  };

  const onContext = (e: Event) => {
    const me = e as MouseEvent;
    const el = matched(e);
    if (!el) return;
    if ((options.keepNativeOnInputs ?? true) && el.closest('input, textarea, [contenteditable="true"]')) return;
    // на сенсорном экране браузер сам шлёт contextmenu после долгого нажатия: наш таймер уже открыл меню
    if (Date.now() - suppressUntil < 0) { e.preventDefault(); return; }
    let x = me.clientX, y = me.clientY;
    if (!x && !y) { const r = el.getBoundingClientRect(); x = r.left + Math.min(40, r.width / 2); y = r.top + Math.min(24, r.height / 2); }   // с клавиатуры — у элемента
    if (show(x, y, e, el)) e.preventDefault();
  };
  const cancel = () => { clearTimeout(timer); press = null; };
  const onPointerDown = (e: Event) => {
    const pe = e as PointerEvent;
    if (!longPress || pe.pointerType === 'mouse' || !pe.isPrimary) return;
    const el = matched(e);
    if (!el || el.closest('input, textarea, [contenteditable="true"]')) return;
    press = { x: pe.clientX, y: pe.clientY, id: pe.pointerId, el };
    timer = window.setTimeout(() => {
      if (!press) return;
      const p = press;
      press = null;
      if (show(p.x, p.y, e, p.el)) {
        navigator.vibrate?.(12);
        // отпускание пальца не должно ни кликнуть по элементу под меню, ни закрыть его
        const sc = options.suppressClickMs ?? 500;
        suppressUntil = Date.now() + sc;
        const eat = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
        document.addEventListener('click', eat, { capture: true, once: true });
        setTimeout(() => document.removeEventListener('click', eat, true), sc);
      }
    }, longPress);
  };
  const onPointerMove = (e: Event) => {
    const pe = e as PointerEvent;
    if (press && pe.pointerId === press.id && Math.hypot(pe.clientX - press.x, pe.clientY - press.y) > 10) cancel();
  };
  target.addEventListener('contextmenu', onContext);
  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointerup', cancel);
  target.addEventListener('pointercancel', cancel);
  target.addEventListener('pointerleave', cancel);
  return {
    open(x, y) { show(x, y, new Event('contextmenu'), (target instanceof Document ? document.body : target) as HTMLElement); },
    close() { closeFn?.(); },
    destroy() {
      cancel();
      closeFn?.();
      target.removeEventListener('contextmenu', onContext);
      target.removeEventListener('pointerdown', onPointerDown);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', cancel);
      target.removeEventListener('pointercancel', cancel);
      target.removeEventListener('pointerleave', cancel);
    },
  };
}

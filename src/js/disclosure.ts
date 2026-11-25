/**
 * Раскрытие: строка-кнопка «Последние заказы · 5» с шевроном и панелью.
 *
 *   const d = createDisclosure(host, { label: 'Последние заказы', count: 5, content: () => list, overlay: true, onToggle: (open) => … });
 *   d.toggle(); d.setCount(6); d.refresh();
 *
 * Без overlay панель раскрывается в потоке и сдвигает содержимое ниже; overlay — выпадающая панель шириной с кнопку поверх содержимого
 * (тень, закрывается по клику мимо и Esc, фокус возвращается на кнопку). aria-expanded и aria-controls у кнопки.
 * content: узел или функция — вызывается при первом раскрытии (refresh() вызывает её снова).
 */
import { icon } from '../icons';
import { h, html, pushLayer } from './dom';

export interface DisclosureOptions {
  label: string;
  /** число справа от подписи: «Последние заказы · 5» */
  count?: number | string;
  content: HTMLElement | (() => HTMLElement);
  /** выпадающая панель поверх содержимого ниже (по умолчанию сдвигает его) */
  overlay?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
}
export interface DisclosureHandle {
  element: HTMLElement;
  button: HTMLButtonElement;
  panel: HTMLElement;
  isOpen(): boolean;
  open(): void;
  close(): void;
  toggle(open?: boolean): void;
  setLabel(label: string): void;
  setCount(count: number | string | null): void;
  /** перестроить содержимое (если content — функция) */
  refresh(): void;
  destroy(): void;
}

let seq = 0;
export function createDisclosure(host: HTMLElement, options: DisclosureOptions): DisclosureHandle {
  const id = `b24-disclosure-${++seq}`;
  const labelEl = h('span', { class: 'b24-disclosure__label' }, options.label);
  const countEl = h('span', { class: 'b24-disclosure__count' });
  const button = h('button', { type: 'button', class: 'b24-disclosure__btn', 'aria-expanded': 'false', 'aria-controls': id }, labelEl, countEl, h('span', { class: 'b24-disclosure__chev', 'aria-hidden': 'true' }, html(icon('chevronDown', { size: 18 })))) as HTMLButtonElement;
  const panel = h('div', { class: 'b24-disclosure__panel', id, role: 'region', hidden: '' });
  const root = h('div', { class: `b24-disclosure${options.overlay ? ' b24-disclosure--overlay' : ''}` }, button, panel);
  host.append(root);
  let isOpen = false;
  let built = false;
  let release = () => {};

  const setCount = (c: number | string | null | undefined) => {
    countEl.textContent = c == null || c === '' ? '' : `· ${c}`;
    countEl.hidden = c == null || c === '';
  };
  setCount(options.count);
  const build = () => {
    const node = typeof options.content === 'function' ? options.content() : options.content;
    panel.replaceChildren(node);
    built = true;
  };
  const onOutside = (e: Event) => { if (!root.contains(e.target as Node)) handle.close(); };
  const set = (open: boolean, focus = false) => {
    if (open === isOpen) return;
    isOpen = open;
    if (open && !built) build();
    panel.hidden = !open;
    root.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    if (options.overlay) {
      if (open) {
        document.addEventListener('pointerdown', onOutside, true);
        release = pushLayer(() => { set(false, true); });
      } else {
        document.removeEventListener('pointerdown', onOutside, true);
        release();
        release = () => {};
      }
    }
    if (!open && focus) button.focus({ preventScroll: true });
    options.onToggle?.(open);
  };
  button.addEventListener('click', () => set(!isOpen));

  const handle: DisclosureHandle = {
    element: root,
    button,
    panel,
    isOpen: () => isOpen,
    open: () => set(true),
    close: () => set(false),
    toggle: (open) => set(open ?? !isOpen),
    setLabel(label) { labelEl.textContent = label; },
    setCount,
    refresh() { if (typeof options.content === 'function' && (built || isOpen)) build(); },
    destroy() {
      document.removeEventListener('pointerdown', onOutside, true);
      release();
      root.remove();
    },
  };
  if (options.open) set(true);
  return handle;
}

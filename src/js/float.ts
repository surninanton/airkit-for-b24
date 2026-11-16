/**
 * Плавающая панель у кнопки: позиционирование в пределах окна, закрытие по клику мимо и Esc.
 * На ≤768px CSS (.b24-float--sheet) превращает её в нижний лист с затемнением.
 */
import { bringToFront, h, pushLayer } from './dom';

export interface FloatOptions {
  /** откуда открыть: сверху или снизу от кнопки (по умолчанию — где больше места) */
  placement?: 'top' | 'bottom';
  /** выровнять по краю кнопки: start — левый, end — правый */
  align?: 'start' | 'end';
  /** нижний лист на телефоне (по умолчанию да) */
  sheet?: boolean;
  onClose?: () => void;
}
export interface FloatHandle { element: HTMLElement; close(): void; reposition(): void }

export function showFloat(anchor: HTMLElement, panel: HTMLElement, options: FloatOptions = {}): FloatHandle {
  const sheet = options.sheet !== false;
  const wrap = h('div', { class: `b24-float b24-root${sheet ? ' b24-float--sheet' : ''}` }, panel);
  const backdrop = h('div', { class: 'b24-float-backdrop b24-root' });
  document.body.append(backdrop, wrap);
  bringToFront(backdrop);
  bringToFront(wrap);
  let closed = false;

  const reposition = () => {
    const r = anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const w = wrap.offsetWidth;
    const hh = wrap.offsetHeight;
    const gap = 6;
    const below = vh - r.bottom - gap;
    const above = r.top - gap;
    const place = options.placement ?? (below >= hh || below >= above ? 'bottom' : 'top');
    let top = place === 'bottom' ? r.bottom + gap : r.top - gap - hh;
    top = Math.max(8, Math.min(top, vh - hh - 8));
    let left = (options.align ?? 'start') === 'end' ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, vw - w - 8));
    wrap.style.top = `${Math.round(top)}px`;
    wrap.style.left = `${Math.round(left)}px`;
  };
  reposition();

  const onDown = (e: Event) => {
    const t = e.target as Node;
    if (!wrap.contains(t) && !anchor.contains(t)) close();
  };
  const onResize = () => reposition();
  const releaseLayer = pushLayer(() => { close(); anchor.focus?.({ preventScroll: true }); });
  setTimeout(() => document.addEventListener('pointerdown', onDown, true), 0);
  window.addEventListener('resize', onResize);

  function close() {
    if (closed) return;
    closed = true;
    releaseLayer();
    document.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('resize', onResize);
    wrap.remove();
    backdrop.remove();
    options.onClose?.();
  }
  backdrop.addEventListener('click', close);
  return { element: wrap, close, reposition };
}

import { icon, type IconName } from '../icons';
import { animateOut, frameAnchorY, h, html, isInFrame } from './dom';
import { t } from './i18n';

export type ToastType = 'default' | 'success' | 'danger' | 'warning' | 'primary';

export interface ToastOptions {
  type?: ToastType;
  /** мс; 0 — не закрывать автоматически */
  duration?: number;
  action?: { label: string; onClick: () => void };
  position?: 'bottom-left' | 'top-right';
  closable?: boolean;
  /** одинаковый текст и тип не плодят новые тосты: у видимого растёт счётчик «×2» и перезапускается таймер (по умолчанию да) */
  dedupe?: boolean;
}

/** Видимых тостов в стопке не больше — самые старые закрываются */
export const TOAST_LIMIT = 4;

export interface ToastHandle {
  close(): Promise<void>;
}

const ICONS: Partial<Record<ToastType, IconName>> = {
  success: 'success',
  danger: 'error',
  warning: 'warning',
  primary: 'info',
};

const stacks = new Map<string, HTMLElement>();

function getStack(position: string): HTMLElement {
  let stack = stacks.get(position);
  if (!stack || !stack.isConnected) {
    stack = h('div', {
      class: `b24-toast-stack b24-root${position === 'top-right' ? ' b24-toast-stack--top-right' : ''}`,
      role: 'region',
      'aria-live': 'polite',
      style: 'background:transparent',
    });
    document.body.append(stack);
    stacks.set(position, stack);
  }
  return stack;
}

/** Всплывающее уведомление в стиле BX.UI.Notification. */
export function toast(message: string, options: ToastOptions = {}): ToastHandle {
  const { type = 'default', duration = 4000, action, position = 'bottom-left', closable = true, dedupe = true } = options;
  const existing = dedupe ? Array.from(getStack(position).children).find((t) => (t as HTMLElement).dataset.key === `${type}:${message}` && !(t as HTMLElement).dataset.closing) as (HTMLElement & { b24Bump?: () => ToastHandle }) | undefined : undefined;
  if (existing?.b24Bump) return existing.b24Bump();
  const el = h('div', { class: `b24-toast b24-toast--${type}`, role: type === 'danger' ? 'alert' : 'status' });
  const iconName = ICONS[type];
  if (iconName) el.append(h('span', { class: 'b24-toast__icon' }, html(icon(iconName))));
  el.append(h('span', { class: 'b24-toast__text' }, message));

  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  el.dataset.key = `${type}:${message}`;
  let count = 1;
  const close = async () => {
    if (closed) return;
    closed = true;
    el.dataset.closing = '1';
    clearTimeout(timer);
    await animateOut(el);
    el.remove();
  };

  if (action) {
    const btn = h('button', { type: 'button', class: 'b24-toast__action' }, action.label);
    btn.addEventListener('click', () => { action.onClick(); void close(); });
    el.append(btn);
  }
  if (closable) {
    const btn = h('button', { type: 'button', class: 'b24-toast__close', 'aria-label': t('Закрыть') }, html(icon('close')));
    btn.addEventListener('click', () => void close());
    el.append(btn);
  }

  const start = () => { if (duration > 0) timer = setTimeout(close, duration); };
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', start);

  (el as HTMLElement & { b24Bump?: () => ToastHandle }).b24Bump = () => {
    count += 1;
    let badge = el.querySelector<HTMLElement>('.b24-toast__count');
    if (!badge) { badge = h('span', { class: 'b24-toast__count', 'aria-hidden': 'true' }); el.querySelector('.b24-toast__text')!.after(badge); }
    badge.textContent = `×${count}`;
    clearTimeout(timer);
    start();
    return { close };
  };

  const stack = getStack(position);
  // предел стопки: самые старые уходят
  const alive = Array.from(stack.children).filter((t) => !(t as HTMLElement).dataset.closing) as HTMLElement[];
  alive.slice(0, Math.max(0, alive.length - TOAST_LIMIT + 1)).forEach((t) => {
    const x = t.querySelector<HTMLButtonElement>('.b24-toast__close');
    if (x) x.click(); else t.remove();
  });
  if (isInFrame()) {
    // во фрейме нет своего скролла: fixed-низ = низ всего контента; показываем у места клика
    stack.classList.add('b24-toast-stack--anchored');
    stack.style.top = `${Math.max(16, Math.round(frameAnchorY() + 24))}px`;
  }
  stack.append(el);
  start();
  return { close };
}

import { icon, type IconName } from '../icons';
import { animateOut, frameAnchorY, h, html, isInFrame } from './dom';

export type ToastType = 'default' | 'success' | 'danger' | 'warning' | 'primary';

export interface ToastOptions {
  type?: ToastType;
  /** мс; 0 — не закрывать автоматически */
  duration?: number;
  action?: { label: string; onClick: () => void };
  position?: 'bottom-left' | 'top-right';
  closable?: boolean;
}

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
  const { type = 'default', duration = 4000, action, position = 'bottom-left', closable = true } = options;
  const el = h('div', { class: `b24-toast b24-toast--${type}`, role: type === 'danger' ? 'alert' : 'status' });
  const iconName = ICONS[type];
  if (iconName) el.append(h('span', { class: 'b24-toast__icon' }, html(icon(iconName))));
  el.append(h('span', { class: 'b24-toast__text' }, message));

  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
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
    const btn = h('button', { type: 'button', class: 'b24-toast__close', 'aria-label': 'Закрыть' }, html(icon('close')));
    btn.addEventListener('click', () => void close());
    el.append(btn);
  }

  const start = () => { if (duration > 0) timer = setTimeout(close, duration); };
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', start);

  const stack = getStack(position);
  if (isInFrame()) {
    // во фрейме нет своего скролла: fixed-низ = низ всего контента; показываем у места клика
    stack.classList.add('b24-toast-stack--anchored');
    stack.style.top = `${Math.max(16, Math.round(frameAnchorY() + 24))}px`;
  }
  stack.append(el);
  start();
  return { close };
}

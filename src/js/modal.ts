import { icon } from '../icons';
import { anchorOverlayInFrame, animateOut, bringToFront, append, runAutoInit, focusFirst, h, html, lockScroll, pushLayer, trapFocus, type Content } from './dom';
import { t } from './i18n';

export interface ModalButton {
  text: string;
  /** класс-модификатор кнопки: primary | success | danger | secondary | plain | link … */
  variant?: string;
  /** значение, с которым резолвится result */
  value?: unknown;
  /** false — клик не закрывает окно (например, «Применить») */
  closes?: boolean;
  onClick?: (ctx: ModalHandle) => void | boolean | Promise<void | boolean>;
  autofocus?: boolean;
}

export interface ModalOptions {
  title?: string;
  content?: Content;
  buttons?: ModalButton[];
  size?: 'sm' | 'md' | 'lg';
  width?: number;
  closeOnOverlay?: boolean;
  closable?: boolean;
  onClose?: (value: unknown) => void;
  /** false — не инициализировать data-b24-* в содержимом (по умолчанию init() запускается для тела окна) */
  autoInit?: boolean;
}

export interface ModalHandle {
  element: HTMLElement;
  body: HTMLElement;
  close(value?: unknown): Promise<void>;
  /** промис, который резолвится значением закрытия */
  result: Promise<unknown>;
}

/** Модальное окно (BX.PopupWindow / MessageBox). */
export function modal(options: ModalOptions): ModalHandle {
  const { title, content, buttons = [], size = 'md', width, closeOnOverlay = true, closable = true, onClose, autoInit = true } = options;
  const titleId = `b24-modal-${Math.random().toString(36).slice(2, 8)}`;

  const overlay = h('div', { class: 'b24-overlay b24-root', style: 'background-color:var(--b24-bg-overlay)' });
  const dialog = h('div', {
    class: `b24-modal${size !== 'md' ? ` b24-modal--${size}` : ''}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': title ? titleId : undefined,
    style: width ? `--b24-modal-width:${width}px` : undefined,
  });
  const body = h('div', { class: 'b24-modal__body' });
  append(body, content);

  if (title || closable) {
    const header = h('div', { class: 'b24-modal__header' });
    header.append(h('h2', { class: 'b24-modal__title', id: titleId }, title ?? ''));
    if (closable) {
      const x = h('button', { type: 'button', class: 'b24-close', 'aria-label': t('Закрыть') }, html(icon('close')));
      x.addEventListener('click', () => void handle.close(undefined));
      header.append(x);
    }
    dialog.append(header);
  }
  dialog.append(body);

  let resolveResult!: (v: unknown) => void;
  const result = new Promise<unknown>((r) => (resolveResult = r));
  const prevFocus = document.activeElement as HTMLElement | null;
  const releaseScroll = lockScroll();
  const releaseTrap = trapFocus(dialog);
  let releaseLayer = () => {};
  let closed = false;

  const handle: ModalHandle = {
    element: dialog,
    body,
    result,
    async close(value?: unknown) {
      if (closed) return;
      closed = true;
      releaseLayer();
      releaseTrap();
      await animateOut(overlay);
      overlay.remove();
      releaseScroll();
      prevFocus?.focus?.({ preventScroll: true });
      onClose?.(value);
      resolveResult(value);
    },
  };

  if (buttons.length) {
    const footer = h('div', { class: 'b24-modal__footer' });
    for (const b of buttons) {
      const btn = h('button', {
        type: 'button',
        class: `b24-btn b24-btn--${b.variant ?? 'secondary'}`,
        autofocus: b.autofocus,
      }, b.text);
      btn.addEventListener('click', async () => {
        if (b.onClick) {
          // пока промис не завершён: у нажатой кнопки — загрузка, остальные кнопки окна заблокированы
          const all = [...footer.querySelectorAll<HTMLButtonElement>('button')];
          btn.classList.add('b24-btn--loading');
          all.forEach((x) => { x.disabled = true; });
          dialog.setAttribute('aria-busy', 'true');
          try {
            const r = await b.onClick(handle);
            if (r === false) return;
          } finally {
            btn.classList.remove('b24-btn--loading');
            all.forEach((x) => { x.disabled = false; });
            dialog.removeAttribute('aria-busy');
          }
        }
        if (b.closes !== false) void handle.close(b.value);
      });
      footer.append(btn);
    }
    dialog.append(footer);
  }

  if (closable) releaseLayer = pushLayer(() => void handle.close(undefined));
  overlay.addEventListener('mousedown', (e) => {
    if (closable && closeOnOverlay && e.target === overlay) void handle.close(undefined);
  });

  overlay.append(dialog);
  document.body.append(overlay);
  if (autoInit) runAutoInit(body);
  bringToFront(overlay);
  anchorOverlayInFrame(overlay, dialog);
  focusFirst(dialog);
  return handle;
}

/** Подтверждение: резолвится true/false. */
export async function confirm(
  message: Content,
  opts: { title?: string; okText?: string; cancelText?: string; danger?: boolean } = {},
): Promise<boolean> {
  const m = modal({
    title: opts.title ?? t('Подтвердите действие'),
    content: message,
    size: 'sm',
    buttons: [
      { text: opts.okText ?? t('Продолжить'), variant: opts.danger ? 'danger' : 'primary', value: true, autofocus: true },
      { text: opts.cancelText ?? t('Отмена'), variant: 'plain', value: false },
    ],
  });
  return (await m.result) === true;
}

/** Сообщение с одной кнопкой. */
export async function alert(message: Content, opts: { title?: string; okText?: string } = {}): Promise<void> {
  await modal({
    title: opts.title,
    content: message,
    size: 'sm',
    buttons: [{ text: opts.okText ?? t('Понятно'), variant: 'primary', autofocus: true }],
  }).result;
}

export interface PromptOptions {
  title?: string;
  /** подпись над полем */
  label?: string;
  value?: string;
  placeholder?: string;
  okLabel?: string;
  cancelLabel?: string;
  maxLength?: number;
  /** пустое значение допустимо (по умолчанию нет: «ОК» неактивна) */
  allowEmpty?: boolean;
  /** текст ошибки (окно остаётся открытым) или null/undefined — значение подходит */
  validate?: (value: string) => string | null | undefined;
}
/** Окно ввода одной строки: резолвится введённой строкой (обрезанной по краям) или null (Отмена, Esc, клик мимо). */
export async function prompt(opts: PromptOptions = {}): Promise<string | null> {
  const id = `b24-prompt-${Math.random().toString(36).slice(2, 8)}`;
  const input = h('input', { type: 'text', class: 'b24-input', id, value: opts.value ?? '', placeholder: opts.placeholder, maxlength: opts.maxLength ? String(opts.maxLength) : undefined, autocomplete: 'off' }) as HTMLInputElement;
  const error = h('div', { class: 'b24-field__error', role: 'alert', hidden: '' });
  const content = h('div', { class: 'b24-field' }, opts.label ? h('label', { class: 'b24-label', for: id }, opts.label) : '', input, error);
  let okBtn: HTMLButtonElement | null = null;
  const value = () => input.value.trim();
  const sync = () => { error.hidden = true; if (okBtn) okBtn.disabled = !opts.allowEmpty && !value(); };
  const m = modal({
    title: opts.title,
    content,
    size: 'sm',
    buttons: [
      {
        text: opts.okLabel ?? t('ОК'), variant: 'primary', closes: false,
        onClick: (ctx) => {
          const v = value();
          if (!opts.allowEmpty && !v) return false;
          const err = opts.validate?.(v);
          if (err) { error.textContent = err; error.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return false; }
          void ctx.close(v);
          return false;
        },
      },
      { text: opts.cancelLabel ?? t('Отмена'), variant: 'plain', value: null },
    ],
  });
  okBtn = m.element.querySelector<HTMLButtonElement>('.b24-modal__footer .b24-btn--primary');
  sync();
  input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); sync(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); okBtn?.click(); } });
  requestAnimationFrame(() => { input.focus(); input.select(); });
  const r = await m.result;
  return typeof r === 'string' ? r : null;
}

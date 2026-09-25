export type Content = string | Node | null | undefined;

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined> = {},
  ...children: Content[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(key === 'className' ? 'class' : key, value === true ? '' : value);
  }
  for (const child of children) append(el, child);
  return el;
}

/** Строки вставляются как текст; для готовой разметки передайте Node. */
export function append(parent: Element, content: Content): void {
  if (content == null) return;
  parent.append(typeof content === 'string' ? document.createTextNode(content) : content);
}

export function html(markup: string): DocumentFragment {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Удерживает Tab внутри контейнера; возвращает функцию снятия. */
export function trapFocus(container: HTMLElement): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}

export function focusFirst(container: HTMLElement): void {
  const target = container.querySelector<HTMLElement>('[autofocus]') ?? container.querySelector<HTMLElement>(FOCUSABLE);
  target?.focus({ preventScroll: true });
}

let lockCount = 0;
export function lockScroll(): () => void {
  lockCount++;
  document.body.classList.add('b24-scroll-lock');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (!lockCount) document.body.classList.remove('b24-scroll-lock');
  };
}

/** Ждёт окончания CSS-анимации закрытия (с таймаутом на случай reduced motion). */
export function animateOut(el: HTMLElement, className = 'is-closing', timeout = 400): Promise<void> {
  return new Promise((resolve) => {
    el.classList.add(className);
    const done = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(done, timeout);
    el.addEventListener('animationend', (e) => { if (e.target === el) done(); }, { once: true });
  });
}

/** Стек открытых слоёв: Escape закрывает только верхний. */
const layers: Array<() => void> = [];
export function pushLayer(close: () => void): () => void {
  layers.push(close);
  return () => {
    const i = layers.lastIndexOf(close);
    if (i >= 0) layers.splice(i, 1);
  };
}
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && layers.length) {
      e.preventDefault();
      layers[layers.length - 1]();
    }
  });
}

/* ── Позиционирование во фрейме портала ──────────────────
 * Фрейм растянут на всю высоту контента и своего скролла не имеет, поэтому fixed-элементы
 * (модалки, тосты) по центру/низу фрейма оказываются далеко от места, где пользователь кликнул.
 * Во фрейме (класс b24-in-frame на <html>) такие элементы привязываются к Y последнего клика.
 */
let lastPointerY: number | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => { lastPointerY = e.pageY; }, true);
}

export const isInFrame = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('b24-in-frame');

/** Y (в координатах документа), рядом с которым показывать всплывающие элементы во фрейме. */
export function frameAnchorY(): number {
  if (lastPointerY != null) return lastPointerY;
  const active = document.activeElement;
  if (active && active !== document.body) return active.getBoundingClientRect().top + window.scrollY;
  return window.scrollY + 120;
}

/** Во фрейме: прижимает overlay к верху и сдвигает диалог к месту клика (с запасом сверху и снизу). */
export function anchorOverlayInFrame(overlay: HTMLElement, dialog: HTMLElement): void {
  if (!isInFrame()) return;
  overlay.classList.add('b24-overlay--anchored');
  const frameH = document.documentElement.clientHeight;
  const y = frameAnchorY() - 120;
  const top = Math.max(16, Math.min(y, frameH - dialog.offsetHeight - 16));
  overlay.style.setProperty('--b24-anchor-y', `${Math.round(top)}px`);
}

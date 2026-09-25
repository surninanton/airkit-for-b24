/**
 * Мост к JS SDK портала (BX24), если приложение открыто во фрейме Битрикс24.
 * Все функции безопасны вне портала — просто ничего не делают.
 */
interface BX24Like {
  fitWindow?: (cb?: () => void) => void;
  resizeWindow?: (w: number, h: number, cb?: () => void) => void;
  setTitle?: (title: string, cb?: () => void) => void;
  scrollParentWindow?: (y: number, cb?: () => void) => void;
  openPath?: (path: string, cb?: (r: unknown) => void) => void;
  closeApplication?: () => void;
  init?: (cb: () => void) => void;
  placement?: { info?: () => { placement: string; options: unknown } };
}

function bx(): BX24Like | undefined {
  return typeof window !== 'undefined' ? (window as unknown as { BX24?: BX24Like }).BX24 : undefined;
}

export const isInPortal = (): boolean => !!bx() && window.parent !== window;

export function ready(): Promise<void> {
  const api = bx();
  return new Promise((resolve) => (api?.init ? api.init(resolve) : resolve()));
}

export function fitFrame(): void {
  bx()?.fitWindow?.();
}

/**
 * Подгоняет высоту фрейма под контент (рост и уменьшение). Возвращает отписку.
 *
 * Как устроен портал (api.bitrix24.com/api/v1 + bitrix/js/rest/applayout.js):
 *  - BX24.resizeWindow(w, h) делает parseInt(w): '100%' превращается в 100px — ширину туда передавать нельзя;
 *  - BX24.fitWindow() шлёт width:'100%' и height = scrollHeight документа (не меньше высоты фрейма);
 *  - портал применяет размер и вызывает колбэк.
 * Поэтому: рост — fitWindow(); уменьшение — resizeWindow(текущая ширина фрейма, h), а в его колбэке,
 * когда фрейм уже стал ниже, — fitWindow(), чтобы вернуть ширину 100%.
 * Высоту меряем по body; класс b24-in-frame снимает min-height: 100vh (см. layout.css).
 */
export interface AutoFitOptions {
  /** за чьим размером следить (по умолчанию body) */
  target?: Element;
  /**
   * Минимальная высота фрейма, px. 'initial' (по умолчанию) — высота, которую портал дал фрейму при открытии:
   * короткий контент не оставляет под приложением пустую подложку портала. 0 — без ограничения.
   */
  minHeight?: number | 'initial';
}

export function autoFitFrame(options: AutoFitOptions | Element = {}): () => void {
  const opts: AutoFitOptions = options instanceof Element ? { target: options } : options;
  const target = opts.target ?? document.body;
  const api = bx();
  if (!api?.fitWindow || typeof ResizeObserver === 'undefined') return () => {};
  const root = document.documentElement;
  // Стартовая высота фрейма — до первой подгонки
  const floor = Math.max(0, Math.floor(opts.minHeight === undefined || opts.minHeight === 'initial' ? window.innerHeight : opts.minHeight));
  root.classList.add('b24-in-frame');
  // Фиксированные px, а не vh: не зависит от текущей высоты фрейма, поэтому петли роста нет
  if (floor) root.style.setProperty('--b24-frame-min-height', `${floor}px`);
  let last = 0;
  const ro = new ResizeObserver(() => {
    const height = Math.max(floor, Math.ceil(document.body.getBoundingClientRect().height));
    if (height <= 0 || Math.abs(height - last) < 2) return;
    const shrink = last > 0 && height < last;
    last = height;
    if (shrink && api.resizeWindow && window.innerWidth > 0) {
      api.resizeWindow(window.innerWidth, height, () => api.fitWindow!());
    } else {
      api.fitWindow!();
    }
  });
  ro.observe(target);
  return () => {
    ro.disconnect();
    root.classList.remove('b24-in-frame');
    root.style.removeProperty('--b24-frame-min-height');
  };
}

/** Прокрутить страницу портала (y — абсолютная координата страницы портала; 0 — к началу). */
export function scrollParent(y: number): void {
  bx()?.scrollParentWindow?.(y);
}

export function setTitle(title: string): void {
  const api = bx();
  if (api?.setTitle) api.setTitle(title);
  else document.title = title;
}

export function openPath(path: string): void {
  const api = bx();
  if (api?.openPath) api.openPath(path);
  else window.open(path, '_blank');
}

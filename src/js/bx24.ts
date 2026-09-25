/**
 * Мост к JS SDK портала (BX24), если приложение открыто во фрейме Битрикс24.
 * Все функции безопасны вне портала — просто ничего не делают.
 */
interface BX24Like {
  fitWindow?: (cb?: () => void) => void;
  resizeWindow?: (w: number | string, h: number, cb?: () => void) => void;
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
 * Подгоняет высоту фрейма под контент при каждом изменении размеров — и в большую, и в меньшую сторону.
 * Возвращает отписку.
 *
 * - Ширину не трогаем ('100%'): если передавать scrollWidth, фрейм «защёлкивается» на текущей ширине
 *   и сжимается петлёй ResizeObserver → resizeWindow.
 * - Высоту меряем по body, а не по documentElement.scrollHeight: scrollHeight не бывает меньше
 *   высоты самого фрейма, и фрейм не смог бы уменьшиться после перехода на короткую вкладку.
 *   Чтобы body не тянулся на 100vh, на <html> ставится класс b24-in-frame (см. layout.css).
 */
export function autoFitFrame(target: Element = document.body): () => void {
  const api = bx();
  if (!api || (!api.fitWindow && !api.resizeWindow) || typeof ResizeObserver === 'undefined') return () => {};
  document.documentElement.classList.add('b24-in-frame');
  let last = 0;
  const ro = new ResizeObserver(() => {
    const height = Math.ceil(document.body.getBoundingClientRect().height);
    if (height <= 0 || Math.abs(height - last) < 2) return;
    last = height;
    if (api.resizeWindow) api.resizeWindow('100%', height);
    else api.fitWindow!();
  });
  ro.observe(target);
  return () => {
    ro.disconnect();
    document.documentElement.classList.remove('b24-in-frame');
  };
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

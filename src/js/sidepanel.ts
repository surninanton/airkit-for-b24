import { icon } from '../icons';
import { animateOut, append, bringToFront, focusFirst, h, html, lockScroll, pushLayer, trapFocus, type Content } from './dom';

export interface SidePanelOptions {
  title?: string;
  content?: Content;
  /** открыть страницу во фрейме вместо content */
  url?: string;
  width?: number;
  /** Air-подложка внутри панели (как карточки CRM) */
  air?: boolean;
  footer?: Content;
  closeLabel?: string;
  onClose?: () => void;
}

export interface SidePanelHandle {
  element: HTMLElement;
  body: HTMLElement;
  setTitle(title: string): void;
  close(): Promise<void>;
}

const openPanels: SidePanelHandle[] = [];

/** Слайдер справа — аналог BX.SidePanel.Instance.open(). Вложенные панели сдвигаются «лесенкой». */
export function openSidePanel(options: SidePanelOptions): SidePanelHandle {
  const { title, content, url, width = 900, air = false, footer, closeLabel = 'Закрыть', onClose } = options;
  const depth = openPanels.length;
  const overlay = h('div', { class: 'b24-sidepanel-overlay b24-root', style: `background-color:var(--b24-bg-overlay)` });
  const panel = h('div', {
    class: `b24-sidepanel${air ? ' b24-sidepanel--air' : ''}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title ?? 'Панель',
    style: `--b24-panel-width:${Math.max(360, width - depth * 60)}px`,
  });

  const closeBtn = h('button', { type: 'button', class: 'b24-sidepanel__close', 'aria-label': closeLabel }, html(icon('close')));
  const titleEl = h('h2', { class: 'b24-sidepanel__title' }, title ?? '');
  const header = h('div', { class: 'b24-sidepanel__header' }, titleEl);
  const body = h('div', { class: 'b24-sidepanel__body' });

  if (url) {
    body.style.padding = '0';
    body.append(h('iframe', { src: url, title: title ?? '', style: 'border:0;width:100%;height:100%;display:block' }));
  } else {
    append(body, content);
  }

  panel.append(closeBtn);
  if (title !== undefined) panel.append(header);
  panel.append(body);
  if (footer) {
    const f = h('div', { class: 'b24-sidepanel__footer' });
    append(f, footer);
    panel.append(f);
  }
  overlay.append(panel);

  const releaseScroll = lockScroll();
  const releaseTrap = trapFocus(panel);
  const prevFocus = document.activeElement as HTMLElement | null;
  let closed = false;

  const handle: SidePanelHandle = {
    element: panel,
    body,
    setTitle(t) { titleEl.textContent = t; },
    async close() {
      if (closed) return;
      closed = true;
      releaseLayer();
      releaseTrap();
      const i = openPanels.indexOf(handle);
      if (i >= 0) openPanels.splice(i, 1);
      await animateOut(overlay, 'is-closing', 450);
      overlay.remove();
      releaseScroll();
      prevFocus?.focus?.({ preventScroll: true });
      onClose?.();
    },
  };
  const releaseLayer = pushLayer(() => void handle.close());

  closeBtn.addEventListener('click', () => void handle.close());
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) void handle.close(); });

  document.body.append(overlay);
  bringToFront(overlay);
  openPanels.push(handle);
  focusFirst(panel);
  return handle;
}

export function closeAllSidePanels(): Promise<void[]> {
  return Promise.all([...openPanels].reverse().map((p) => p.close()));
}

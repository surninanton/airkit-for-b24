import { openContextMenu } from './context-menu';
import { icon } from '../icons';
import { animateOut, append, runAutoInit, bringToFront, focusFirst, h, html, lockScroll, pushLayer, trapFocus, type Content } from './dom';
import { t } from './i18n';

export interface SidePanelOptions {
  title?: string;
  content?: Content;
  /** открыть страницу во фрейме вместо content */
  url?: string;
  width?: number;
  /** Air-подложка внутри панели (как карточки CRM) */
  air?: boolean;
  footer?: Content;
  /** кнопка «← Назад» в шапке (для вложенной панели): закрывает эту панель и возвращает к предыдущей; строка — свой текст */
  back?: boolean | string;
  /**
   * Узкая панель (уже 600 px, на телефоне): в футере остаются первые `footerKeep` кнопок (или помеченные [data-b24-keep]),
   * остальные уходят в меню «Ещё ▾». По умолчанию 2; 0 — не сворачивать, всегда показывать все.
   */
  footerKeep?: number;
  closeLabel?: string;
  onClose?: () => void;
  /** false — не инициализировать data-b24-* в содержимом (по умолчанию init() запускается для тела панели) */
  autoInit?: boolean;
}

export interface SidePanelHandle {
  element: HTMLElement;
  body: HTMLElement;
  setTitle(title: string): void;
  /** заменить футер без пересоздания панели (null — убрать); сворачивание в «Ещё ▾» пересчитывается */
  setFooter(content: Content | null): void;
  close(): Promise<void>;
}

const openPanels: SidePanelHandle[] = [];

/** Узкая панель: лишние кнопки футера прячутся в «Ещё ▾» (кнопки остаются в DOM, пункт меню нажимает их). */
function collapseFooter(footer: HTMLElement, panel: HTMLElement, keep: number, minWidth = 600): () => void {
  let more: HTMLButtonElement | null = null;
  let hiddenBtns: HTMLElement[] = [];
  const restore = () => { hiddenBtns.forEach((b) => b.removeAttribute('hidden')); hiddenBtns = []; more?.remove(); more = null; footer.classList.remove('is-collapsed'); };
  const apply = () => {
    const narrow = panel.getBoundingClientRect().width < minWidth;
    const buttons = [...footer.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el !== more && el.matches('button, a') && (!el.hidden || hiddenBtns.includes(el)));
    const marked = buttons.filter((b) => b.hasAttribute('data-b24-keep'));
    if (!narrow || buttons.length <= (marked.length || keep)) { if (hiddenBtns.length) restore(); return; }
    // оставляем keep кнопок; если с «Ещё» они не помещаются в один ряд — на одну меньше (но не меньше одной)
    for (let n = marked.length || keep; n >= 1; n--) {
      const kept = marked.length ? marked : buttons.slice(0, n);
      mount(buttons.filter((b) => !kept.includes(b)));
      if (marked.length || n === 1 || oneRow()) break;
    }
    // один ряд всегда: оставшиеся кнопки при нехватке места сжимаются с многоточием
    footer.classList.add('is-collapsed');
  };
  const oneRow = () => new Set([...footer.children].filter((el): el is HTMLElement => el instanceof HTMLElement && !el.hidden).map((el) => el.offsetTop)).size <= 1;
  const mount = (extras: HTMLElement[]) => {
    restore();
    hiddenBtns = extras;
    extras.forEach((b) => b.setAttribute('hidden', ''));
    const btn = h('button', { type: 'button', class: 'b24-btn b24-btn--secondary', 'data-b24-more': '', 'aria-haspopup': 'menu' }, t('Ещё'), html(icon('chevronDown')));
    btn.addEventListener('click', () => {
      const r = btn.getBoundingClientRect();
      openContextMenu(r.right, r.top - 8, hiddenBtns.map((b) => ({
        label: (b.textContent ?? '').replace(/\s+/g, ' ').trim() || b.getAttribute('aria-label') || '',
        danger: b.classList.contains('b24-btn--danger'),
        disabled: (b as HTMLButtonElement).disabled,
        onClick: () => b.click(),
      })));
    });
    footer.append(btn);
    more = btn;
  };
  const ro = new ResizeObserver(apply);
  ro.observe(panel);
  apply();
  return () => ro.disconnect();
}

/** Слайдер справа — аналог BX.SidePanel.Instance.open(). Вложенные панели сдвигаются «лесенкой». */
export function openSidePanel(options: SidePanelOptions): SidePanelHandle {
  const { title, content, url, width = 900, air = false, footer, back, footerKeep = 2, closeLabel = t('Закрыть'), onClose, autoInit = true } = options;
  const depth = openPanels.length;
  const overlay = h('div', { class: 'b24-sidepanel-overlay b24-root', style: `background-color:var(--b24-bg-overlay)` });
  const panel = h('div', {
    class: `b24-sidepanel${air ? ' b24-sidepanel--air' : ''}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title ?? t('Панель'),
    style: `--b24-panel-width:${Math.max(360, width - depth * 60)}px`,
  });

  const closeBtn = h('button', { type: 'button', class: 'b24-sidepanel__close', 'aria-label': closeLabel }, html(icon('close')));
  const titleEl = h('h2', { class: 'b24-sidepanel__title' }, title ?? '');
  const backBtn = back ? h('button', { type: 'button', class: 'b24-sidepanel__back' }, html(icon('arrowLeft')), typeof back === 'string' ? back : t('Назад')) : null;
  const header = h('div', { class: 'b24-sidepanel__header' }, ...(backBtn ? [backBtn] : []), titleEl);
  const body = h('div', { class: 'b24-sidepanel__body' });
  let footerEl: HTMLElement | null = null;

  if (url) {
    body.style.padding = '0';
    body.append(h('iframe', { src: url, title: title ?? '', style: 'border:0;width:100%;height:100%;display:block' }));
  } else {
    append(body, content);
  }

  panel.append(closeBtn);
  if (title !== undefined) panel.append(header);
  panel.append(body);
  let stopFooter: (() => void) | null = null;
  const mountFooter = (content: Content | null) => {
    stopFooter?.();
    stopFooter = null;
    footerEl?.remove();
    footerEl = null;
    if (content == null) return;
    footerEl = h('div', { class: 'b24-sidepanel__footer' });
    append(footerEl, content);
    panel.append(footerEl);
    if (footerKeep > 0 && panel.isConnected) stopFooter = collapseFooter(footerEl, panel, footerKeep);
    if (autoInit && panel.isConnected) runAutoInit(footerEl);
  };
  if (footer) mountFooter(footer);
  overlay.append(panel);

  const releaseScroll = lockScroll();
  const releaseTrap = trapFocus(panel);
  const prevFocus = document.activeElement as HTMLElement | null;
  let closed = false;

  const handle: SidePanelHandle = {
    element: panel,
    body,
    setTitle(t) { titleEl.textContent = t; },
    setFooter: mountFooter,
    async close() {
      if (closed) return;
      closed = true;
      releaseLayer();
      releaseTrap();
      stopFooter?.();
      stopFooter = null;
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
  backBtn?.addEventListener('click', () => void handle.close());
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) void handle.close(); });

  document.body.append(overlay);
  if (footerEl && footerKeep > 0) stopFooter = collapseFooter(footerEl, panel, footerKeep);
  if (autoInit && !url) runAutoInit(panel);
  bringToFront(overlay);
  openPanels.push(handle);
  focusFirst(panel);
  return handle;
}

export function closeAllSidePanels(): Promise<void[]> {
  return Promise.all([...openPanels].reverse().map((p) => p.close()));
}

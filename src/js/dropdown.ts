import { bringToFront, viewportHeight, pushLayer } from './dom';

export interface DropdownOptions {
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  offset?: number;
  /** закрывать по клику на пункт меню */
  closeOnSelect?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface DropdownHandle {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}

/**
 * Привязывает .b24-popup к кнопке. Попап переносится в <body> и позиционируется абсолютно.
 */
export function dropdown(trigger: HTMLElement, popup: HTMLElement, options: DropdownOptions = {}): DropdownHandle {
  const { placement = 'bottom-start', offset = 6, closeOnSelect = true } = options;
  let opened = false;
  let releaseLayer = () => {};

  popup.hidden = true;
  popup.classList.add('b24-popup');
  if (!popup.closest('.b24-root')) popup.classList.add('b24-root');
  popup.style.background = 'var(--b24-bg-surface)';
  if (!popup.id) popup.id = `b24-popup-${Math.random().toString(36).slice(2, 8)}`;
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', popup.id);

  const position = () => {
    const r = trigger.getBoundingClientRect();
    const pw = popup.offsetWidth;
    const ph = popup.offsetHeight;
    const [side, align] = placement.split('-') as ['bottom' | 'top', 'start' | 'end'];
    let top = side === 'bottom' ? r.bottom + offset : r.top - ph - offset;
    if (side === 'bottom' && top + ph > viewportHeight() && r.top - ph - offset > 0) top = r.top - ph - offset;
    if (side === 'top' && top < 0) top = r.bottom + offset;
    let left = align === 'start' ? r.left : r.right - pw;
    left = Math.min(Math.max(8, left), window.innerWidth - pw - 8);
    popup.style.top = `${top + window.scrollY}px`;
    popup.style.left = `${left + window.scrollX}px`;
  };

  const onDocDown = (e: MouseEvent) => {
    const t = e.target as Node;
    if (!popup.contains(t) && !trigger.contains(t)) close();
  };
  const onPopupClick = (e: MouseEvent) => {
    if (closeOnSelect && (e.target as HTMLElement).closest('.b24-menu__item')) close();
  };
  const onKey = (e: KeyboardEvent) => {
    const items = Array.from(popup.querySelectorAll<HTMLElement>('.b24-menu__item:not([disabled])'));
    if (!items.length || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  };
  const onReflow = () => opened && position();

  function open() {
    if (opened) return;
    opened = true;
    if (popup.parentElement !== document.body) document.body.append(popup);
    popup.hidden = false;
    bringToFront(popup);
    position();
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', onDocDown);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    releaseLayer = pushLayer(() => { close(); trigger.focus(); });
    options.onOpen?.();
  }
  function close() {
    if (!opened) return;
    opened = false;
    popup.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onDocDown);
    window.removeEventListener('resize', onReflow);
    window.removeEventListener('scroll', onReflow, true);
    releaseLayer();
    options.onClose?.();
  }
  const onTrigger = (e: Event) => { e.preventDefault(); opened ? close() : open(); };

  trigger.addEventListener('click', onTrigger);
  popup.addEventListener('click', onPopupClick);
  popup.addEventListener('keydown', onKey);

  return {
    open,
    close,
    toggle: () => (opened ? close() : open()),
    isOpen: () => opened,
    destroy() {
      close();
      trigger.removeEventListener('click', onTrigger);
      popup.removeEventListener('click', onPopupClick);
      popup.removeEventListener('keydown', onKey);
    },
  };
}

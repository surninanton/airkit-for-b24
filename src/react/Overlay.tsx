import {
  cloneElement, useCallback, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactElement, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { focusFirst, lockScroll, pushLayer, trapFocus } from '../js/dom';
import { Icon } from './Icon';
import type { IconName } from '../icons';
import { cx, usePresence } from './utils';

function useLayer(active: boolean, containerRef: React.RefObject<HTMLElement | null>, onClose?: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const el = containerRef.current;
    const prev = document.activeElement as HTMLElement | null;
    const releaseScroll = lockScroll();
    const releaseTrap = trapFocus(el);
    const releaseLayer = pushLayer(() => onCloseRef.current?.());
    focusFirst(el);
    return () => {
      releaseLayer();
      releaseTrap();
      releaseScroll();
      prev?.focus?.({ preventScroll: true });
    };
  }, [active, containerRef]);
}

/* ── Modal ───────────────────────────────────────────── */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  width?: number;
  closeOnOverlay?: boolean;
  children?: ReactNode;
}
export function Modal({ open, onClose, title, footer, size = 'md', width, closeOnOverlay = true, children }: ModalProps) {
  const { mounted, closing } = usePresence(open, 180);
  const ref = useRef<HTMLDivElement>(null);
  useLayer(mounted && !closing, ref, onClose);
  if (!mounted) return null;
  return createPortal(
    <div
      className={cx('b24-overlay b24-root', closing && 'is-closing')}
      style={{ backgroundColor: 'var(--b24-bg-overlay)' }}
      onMouseDown={(e) => { if (closeOnOverlay && e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={cx('b24-modal', size !== 'md' && `b24-modal--${size}`)}
        style={width ? ({ '--b24-modal-width': `${width}px` } as CSSProperties) : undefined}
      >
        <div className="b24-modal__header">
          <h2 className="b24-modal__title">{title}</h2>
          <button type="button" className="b24-close" aria-label="Закрыть" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="b24-modal__body">{children}</div>
        {footer && <div className="b24-modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ── SidePanel ───────────────────────────────────────── */
export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  headerActions?: ReactNode;
  footer?: ReactNode;
  width?: number;
  air?: boolean;
  children?: ReactNode;
}
export function SidePanel({ open, onClose, title, headerActions, footer, width = 900, air, children }: SidePanelProps) {
  const { mounted, closing } = usePresence(open, 300);
  const ref = useRef<HTMLDivElement>(null);
  useLayer(mounted && !closing, ref, onClose);
  if (!mounted) return null;
  return createPortal(
    <div
      className={cx('b24-sidepanel-overlay b24-root', closing && 'is-closing')}
      style={{ backgroundColor: 'var(--b24-bg-overlay)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={ref} role="dialog" aria-modal="true" className={cx('b24-sidepanel', air && 'b24-sidepanel--air')} style={{ '--b24-panel-width': `${width}px` } as CSSProperties}>
        <button type="button" className="b24-sidepanel__close" aria-label="Закрыть" onClick={onClose}><Icon name="close" /></button>
        {(title || headerActions) && (
          <div className="b24-sidepanel__header">
            <h2 className="b24-sidepanel__title">{title}</h2>
            {headerActions && <div className="b24-row">{headerActions}</div>}
          </div>
        )}
        <div className="b24-sidepanel__body">{children}</div>
        {footer && <div className="b24-sidepanel__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ── Dropdown / Menu ─────────────────────────────────── */
export type MenuEntry =
  | { type?: 'item'; label: ReactNode; icon?: IconName; hint?: ReactNode; danger?: boolean; checked?: boolean; disabled?: boolean; onClick?: () => void }
  | { type: 'divider' }
  | { type: 'title'; label: ReactNode };

export interface DropdownProps {
  /** Элемент-триггер (обычно <Button>) — получает onClick и aria-атрибуты */
  trigger: ReactElement<Record<string, unknown>>;
  items?: MenuEntry[];
  /** произвольное содержимое попапа вместо items */
  children?: ReactNode;
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  minWidth?: number;
}

export function Dropdown({ trigger, items, children, placement = 'bottom-start', minWidth }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popupRef.current) return;
    const place = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      const p = popupRef.current!;
      const [side, align] = placement.split('-');
      let top = side === 'bottom' ? r.bottom + 6 : r.top - p.offsetHeight - 6;
      if (side === 'bottom' && top + p.offsetHeight > innerHeight && r.top - p.offsetHeight - 6 > 0) top = r.top - p.offsetHeight - 6;
      let left = align === 'start' ? r.left : r.right - p.offsetWidth;
      left = Math.min(Math.max(8, left), innerWidth - p.offsetWidth - 8);
      setPos({ top: top + scrollY, left: left + scrollX });
    };
    place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popupRef.current?.contains(t) && !triggerRef.current?.contains(t)) close();
    };
    const release = pushLayer(() => { close(); triggerRef.current?.focus(); });
    document.addEventListener('mousedown', onDown);
    addEventListener('resize', place);
    addEventListener('scroll', place, true);
    return () => {
      release();
      document.removeEventListener('mousedown', onDown);
      removeEventListener('resize', place);
      removeEventListener('scroll', place, true);
    };
  }, [open, placement, close]);

  const onKey = (e: React.KeyboardEvent) => {
    const list = Array.from(popupRef.current?.querySelectorAll<HTMLElement>('.b24-menu__item:not(:disabled)') ?? []);
    if (!list.length || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const i = list.indexOf(document.activeElement as HTMLElement);
    list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
  };

  const triggerEl = cloneElement(trigger, {
    ref: (node: HTMLElement | null) => { triggerRef.current = node; },
    onClick: (e: React.MouseEvent) => {
      (trigger.props.onClick as ((e: React.MouseEvent) => void) | undefined)?.(e);
      setOpen((v) => !v);
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
  });

  return (
    <>
      {triggerEl}
      {open && createPortal(
        <div
          ref={popupRef}
          className="b24-popup b24-root"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, minWidth, background: 'var(--b24-bg-surface)' }}
          onKeyDown={onKey}
        >
          {items ? <Menu items={items} onSelect={close} /> : children}
        </div>,
        document.body,
      )}
    </>
  );
}

export function Menu({ items, onSelect }: { items: MenuEntry[]; onSelect?: () => void }) {
  return (
    <div className="b24-menu" role="menu">
      {items.map((it, i) => {
        if (it.type === 'divider') return <div key={i} className="b24-menu__divider" role="separator" />;
        if (it.type === 'title') return <div key={i} className="b24-menu__title">{it.label}</div>;
        return (
          <button
            key={i}
            type="button"
            role={it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
            aria-checked={it.checked}
            disabled={it.disabled}
            className={cx('b24-menu__item', it.danger && 'b24-menu__item--danger')}
            onClick={() => { it.onClick?.(); onSelect?.(); }}
          >
            {it.icon && <Icon name={it.icon} />}
            <span>{it.label}</span>
            {it.hint && <span className="b24-menu__hint">{it.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Tooltip (CSS) ───────────────────────────────────── */
export function Tooltip({ text, placement = 'top', children }: { text: string; placement?: 'top' | 'bottom'; children: ReactNode }) {
  return (
    <span data-b24-tooltip={text} data-b24-tooltip-pos={placement === 'bottom' ? 'bottom' : undefined} style={{ display: 'inline-flex' }}>
      {children}
    </span>
  );
}

/* ── Popover: произвольный попап у якоря ─────────────── */
export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  className?: string;
  style?: CSSProperties;
  /** селекторы, клики в которых не закрывают попап (вложенные попапы) */
  ignoreOutside?: string;
  role?: string;
  'aria-label'?: string;
  children: ReactNode;
}
export function Popover({ open, onClose, anchorRef, placement = 'bottom-start', className, style, ignoreOutside, children, ...aria }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      const a = anchorRef.current;
      const p = ref.current;
      if (!a || !p) return;
      const r = a.getBoundingClientRect();
      const [side, align] = placement.split('-');
      let top = side === 'bottom' ? r.bottom + 6 : r.top - p.offsetHeight - 6;
      if (side === 'bottom' && top + p.offsetHeight > innerHeight && r.top - p.offsetHeight - 6 > 0) top = r.top - p.offsetHeight - 6;
      let left = align === 'start' ? r.left : r.right - p.offsetWidth;
      left = Math.min(Math.max(8, left), innerWidth - p.offsetWidth - 8);
      setPos({ top: top + scrollY, left: left + scrollX });
    };
    place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || anchorRef.current?.contains(t)) return;
      if (ignoreOutside && t.closest(ignoreOutside)) return;
      onCloseRef.current();
    };
    const release = pushLayer(() => onCloseRef.current());
    document.addEventListener('mousedown', onDown);
    addEventListener('resize', place);
    addEventListener('scroll', place, true);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    if (ref.current) ro?.observe(ref.current);
    return () => {
      release();
      ro?.disconnect();
      document.removeEventListener('mousedown', onDown);
      removeEventListener('resize', place);
      removeEventListener('scroll', place, true);
    };
  }, [open, placement, anchorRef, ignoreOutside]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      className={cx('b24-popup b24-root', className)}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, background: 'var(--b24-bg-surface)', ...style }}
      {...aria}
    >
      {children}
    </div>,
    document.body,
  );
}

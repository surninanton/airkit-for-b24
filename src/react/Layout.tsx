import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Counter } from './Display';
import { Icon } from './Icon';
import type { IconName } from '../icons';
import { cx } from './utils';
import { setTheme, setAirPreset, type AirPreset, type Theme } from '../js/theme';
import { Vendor } from './Vendor';
import type { VendorOptions } from '../js/vendor';
import { t } from '../js/i18n';

/** Корень приложения: подключает базовые стили и тему. */
export function B24Provider({ theme = 'light', air = 'blue', children }: { theme?: Theme; air?: AirPreset; children: ReactNode }) {
  useEffect(() => { setTheme(theme); }, [theme]);
  useEffect(() => { setAirPreset(air); }, [air]);
  useEffect(() => {
    document.body.classList.add('b24-root');
    return () => document.body.classList.remove('b24-root');
  }, []);
  return <>{children}</>;
}

/** Приложение внутри фрейма портала. */
export function App({ air, white, flush, maxWidth, children, className }: { air?: boolean; white?: boolean; flush?: boolean; maxWidth?: number; children: ReactNode; className?: string }) {
  return (
    <div className={cx('b24-app', air && 'b24-app--air', white && 'b24-app--white', flush && 'b24-app--flush', className)}>
      <div className="b24-page" style={maxWidth ? ({ '--b24-page-max': `${maxWidth}px` } as CSSProperties) : undefined}>{children}</div>
    </div>
  );
}

export interface ToolbarProps {
  title: ReactNode;
  /** кнопки слева от поиска (например, «Создать») */
  actions?: ReactNode;
  search?: ReactNode;
  right?: ReactNode;
  /** вторая строка: вкладки-вью, быстрые фильтры */
  bottom?: ReactNode;
  glass?: boolean;
  /** блок разработчика — всегда последним справа (правило кита) */
  vendor?: VendorOptions;
}
export function Toolbar({ title, actions, search, right, bottom, glass, vendor }: ToolbarProps) {
  return (
    <div className={cx('b24-toolbar', glass && 'b24-toolbar--glass')}>
      <div className="b24-toolbar__row">
        <h1 className="b24-toolbar__title">{title}</h1>
        {actions}
        {search && <div className="b24-toolbar__search">{search}</div>}
        {(right || vendor) && <div className="b24-toolbar__right">{right}{vendor && <Vendor {...vendor} />}</div>}
      </div>
      {bottom && <div className="b24-toolbar__row">{bottom}</div>}
    </div>
  );
}

/* ── Shell (самостоятельное приложение) ──────────────── */
export interface ShellProps {
  sidebar: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  collapsed?: boolean;
  onCollapsedChange?: (v: boolean) => void;
  /** блок разработчика — всегда последним справа в шапке (правило кита) */
  vendor?: VendorOptions;
}
export function AppShell({ sidebar, header, children, collapsed: collapsedProp, onCollapsedChange, vendor }: ShellProps) {
  const [inner, setInner] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const collapsed = collapsedProp ?? inner;
  const toggle = () => {
    if (matchMedia('(max-width: 768px)').matches) setMenuOpen((v) => !v);
    else if (onCollapsedChange) onCollapsedChange(!collapsed);
    else setInner(!collapsed);
  };
  return (
    <div className={cx('b24-shell b24-root', collapsed && 'is-collapsed', menuOpen && 'is-menu-open')}>
      <aside className="b24-shell__sidebar" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setMenuOpen(false); }}>{sidebar}</aside>
      <header className="b24-shell__header">
        <button type="button" className="b24-btn b24-btn--plain b24-btn--icon" style={{ color: '#fff' }} aria-label={t('Меню')} onClick={toggle}>
          <Icon name="menu" />
        </button>
        {header}
        {vendor && <Vendor {...vendor} />}
      </header>
      <main className="b24-shell__main">{children}</main>
    </div>
  );
}

export function Sidebar({ brand, brandMark = '24', children }: { brand?: ReactNode; brandMark?: ReactNode; children: ReactNode }) {
  return (
    <nav className="b24-sidebar" aria-label={t('Главное меню')}>
      {brand && (
        <div className="b24-sidebar__brand">
          <span className="b24-sidebar__brand-mark">{brandMark}</span>
          <span className="b24-sidebar__brand-text">{brand}</span>
        </div>
      )}
      {children}
    </nav>
  );
}

export function SidebarGroup({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return <div className="b24-sidebar__group">{title && <div className="b24-sidebar__group-title">{title}</div>}{children}</div>;
}

export interface NavItemProps {
  label: ReactNode;
  icon?: IconName;
  href?: string;
  active?: boolean;
  counter?: number;
  onClick?: () => void;
}
export function SidebarItem({ label, icon, href = '#', active, counter, onClick }: NavItemProps) {
  return (
    <a
      className="b24-sidebar__item"
      href={href}
      aria-current={active ? 'page' : undefined}
      title={typeof label === 'string' ? label : undefined}
      onClick={onClick ? (e) => { e.preventDefault(); onClick(); } : undefined}
    >
      {icon && <Icon name={icon} />}
      <span className="b24-sidebar__label">{label}</span>
      {counter ? <Counter value={counter} /> : null}
    </a>
  );
}

export function TopNav({ items }: { items: NavItemProps[] }) {
  return (
    <nav className="b24-topnav">
      {items.map((it, i) => (
        <a
          key={i}
          className="b24-topnav__item"
          href={it.href ?? '#'}
          aria-current={it.active ? 'page' : undefined}
          onClick={it.onClick ? (e) => { e.preventDefault(); it.onClick!(); } : undefined}
        >
          {it.label}
          {it.counter ? <Counter value={it.counter} /> : null}
        </a>
      ))}
    </nav>
  );
}

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from '../icons';
import { cx } from './utils';
import { avatarColor as colorFor, initials } from '../js/avatar';
import { t } from '../js/i18n';

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'violet' | 'gray';

/* ── Card ─────────────────────────────────────────────── */
export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  variant?: 'default' | 'bordered' | 'flat';
  interactive?: boolean;
  selected?: boolean;
  /** без внутренних отступов у body (например, для таблицы) */
  flush?: boolean;
}
export function Card({ title, subtitle, actions, footer, variant = 'default', interactive, selected, flush, className, children, ...rest }: CardProps) {
  return (
    <div className={cx('b24-card', variant !== 'default' && `b24-card--${variant}`, interactive && 'b24-card--interactive', selected && 'b24-card--selected', className)} {...rest}>
      {(title || actions) && (
        <div className="b24-card__header">
          <div>
            {title && <h3 className="b24-card__title">{title}</h3>}
            {subtitle && <div className="b24-card__subtitle">{subtitle}</div>}
          </div>
          {actions && <div className="b24-card__actions">{actions}</div>}
        </div>
      )}
      <div className="b24-card__body" style={flush ? { padding: 0 } : undefined}>{children}</div>
      {footer && <div className="b24-card__footer">{footer}</div>}
    </div>
  );
}

export function SectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return <h4 className="b24-section-title">{children}{actions && <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>{actions}</span>}</h4>;
}

export function Props({ items }: { items: Array<{ label: ReactNode; value?: ReactNode }> }) {
  return (
    <div className="b24-props">
      {items.map((it, i) => (
        <div className="b24-prop" key={i}>
          <span className="b24-prop__label">{it.label}</span>
          <span className="b24-prop__value">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Stat({ label, value, delta, trend }: { label: ReactNode; value: ReactNode; delta?: ReactNode; trend?: 'up' | 'down' }) {
  return (
    <div className="b24-stat">
      <span className="b24-stat__label">{label}</span>
      <span className="b24-stat__value">{value}</span>
      {delta && <span className={cx('b24-stat__delta', trend && `b24-stat__delta--${trend}`)}>{delta}</span>}
    </div>
  );
}

export function EmptyState({ icon = 'search', title, children, actions }: { icon?: IconName; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="b24-empty">
      <div className="b24-empty__icon"><Icon name={icon} /></div>
      <h3 className="b24-empty__title">{title}</h3>
      {children && <p className="b24-empty__text">{children}</p>}
      {actions && <div className="b24-row">{actions}</div>}
    </div>
  );
}

/* ── Badge / Counter / Tag / Dot ─────────────────────── */
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  filled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  round?: boolean;
  caps?: boolean;
  icon?: IconName;
}
export function Badge({ tone = 'gray', filled, size = 'md', round, caps, icon, className, children, ...rest }: BadgeProps) {
  return (
    <span className={cx('b24-badge', `b24-badge--${tone}`, filled && 'b24-badge--filled', size !== 'md' && `b24-badge--${size}`, round && 'b24-badge--round', caps && 'b24-badge--caps', className)} {...rest}>
      {icon && <Icon name={icon} size={12} strokeWidth={2} />}
      {children}
    </span>
  );
}

export interface CounterProps {
  value: number;
  max?: number;
  tone?: 'danger' | 'primary' | 'success' | 'warning' | 'gray' | 'light' | 'outline';
  size?: 'md' | 'lg';
  hideZero?: boolean;
  className?: string;
}
export function Counter({ value, max = 99, tone = 'danger', size = 'md', hideZero = true, className }: CounterProps) {
  if (hideZero && !value) return null;
  return (
    <span className={cx('b24-counter', tone !== 'danger' && `b24-counter--${tone}`, size === 'lg' && 'b24-counter--lg', className)}>
      {value > max ? `${max}+` : value}
    </span>
  );
}

export function Tag({ children, onRemove, style }: { children: ReactNode; onRemove?: () => void; style?: CSSProperties }) {
  return (
    <span className="b24-tag" style={style}>
      <span className="b24-tag__text">{children}</span>
      {onRemove && <button type="button" className="b24-tag__remove" aria-label={t('Удалить')} onClick={onRemove}><Icon name="close" /></button>}
    </span>
  );
}

export function Dot({ tone }: { tone?: Exclude<Tone, 'violet' | 'gray'> }) {
  return <span className={cx('b24-dot', tone && `b24-dot--${tone}`)} />;
}

/* ── Alert ───────────────────────────────────────────── */
export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'copilot';
  title?: ReactNode;
  icon?: IconName | false;
  outline?: boolean;
  onClose?: () => void;
}
const ALERT_ICON: Record<NonNullable<AlertProps['tone']>, IconName> = {
  primary: 'info', success: 'success', warning: 'warning', danger: 'error', copilot: 'sparkles',
};
export function Alert({ tone = 'primary', title, icon, outline, onClose, className, children, ...rest }: AlertProps) {
  const iconName = icon === false ? null : icon ?? ALERT_ICON[tone];
  return (
    <div className={cx('b24-alert', tone !== 'primary' && `b24-alert--${tone}`, outline && 'b24-alert--outline', className)} role={tone === 'danger' ? 'alert' : 'status'} {...rest}>
      {iconName && <span className="b24-alert__icon"><Icon name={iconName} /></span>}
      <div className="b24-alert__content">
        {title && <p className="b24-alert__title">{title}</p>}
        {children}
      </div>
      {onClose && <button type="button" className="b24-alert__close" aria-label={t('Закрыть')} onClick={onClose}><Icon name="close" /></button>}
    </div>
  );
}

/* ── Avatar / User ───────────────────────────────────── */
export { initials };
export interface AvatarProps {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  square?: boolean;
  online?: boolean;
  className?: string;
}
export function Avatar({ name, src, size = 'md', square, online, className }: AvatarProps) {
  const empty = !src && !name;
  return (
    <span
      className={cx('b24-avatar', size !== 'md' && `b24-avatar--${size}`, square && 'b24-avatar--square', empty && 'b24-avatar--empty', className)}
      style={name && !src ? ({ '--b24-avatar-bg': colorFor(name) } as CSSProperties) : undefined}
      title={name}
    >
      {src ? <img src={src} alt={name ?? ''} /> : name ? initials(name) : null}
      {online && <span className="b24-avatar__status" />}
    </span>
  );
}
export function AvatarStack({ children }: { children: ReactNode }) {
  return <span className="b24-avatar-stack">{children}</span>;
}
export function User({ name, meta, src, href, size = 'sm', onClick }: { name: string; meta?: ReactNode; src?: string; href?: string; size?: AvatarProps['size']; onClick?: () => void }) {
  return (
    <span className="b24-user">
      <Avatar name={name} src={src} size={size} />
      <span className="b24-user__info">
        {href || onClick ? <a className="b24-user__name" href={href ?? '#'} onClick={onClick ? (e) => { e.preventDefault(); onClick(); } : undefined}>{name}</a> : <span className="b24-user__name">{name}</span>}
        {meta && <span className="b24-user__meta">{meta}</span>}
      </span>
    </span>
  );
}

/* ── Feedback ────────────────────────────────────────── */
export function Spinner({ size = 'md', label = t('Загрузка') }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  return <span className={cx('b24-spinner', size !== 'md' && `b24-spinner--${size}`)} role="status" aria-label={label} />;
}
export function Loader({ children = t('Загрузка…') }: { children?: ReactNode }) {
  return <div className="b24-loader"><Spinner />{children}</div>;
}
export function Skeleton({ width, height, circle, className }: { width?: number | string; height?: number | string; circle?: boolean; className?: string }) {
  return <span className={cx('b24-skeleton', circle && 'b24-skeleton--circle', className)} style={{ width, height }} />;
}
export function Progress({ value, tone, size, indeterminate, label }: { value?: number; tone?: 'success' | 'warning' | 'danger'; size?: 'md' | 'lg'; indeterminate?: boolean; label?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div
      className={cx('b24-progress', tone && `b24-progress--${tone}`, size === 'lg' && 'b24-progress--lg', indeterminate && 'b24-progress--indeterminate')}
      style={{ '--_value': `${v}%` } as CSSProperties}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : v}
    />
  );
}

/* ── Stages ──────────────────────────────────────────── */
export interface Stage { id: string; name: string; color?: string; semantic?: 'process' | 'success' | 'fail' }
export interface StagesProps {
  stages: Stage[];
  current: string;
  onChange?: (id: string) => void;
  size?: 'sm' | 'md';
}
/** Шкала стадий сделки. Стадии до текущей закрашиваются цветом текущей. */
export function Stages({ stages, current, onChange, size = 'md' }: StagesProps) {
  const index = stages.findIndex((s) => s.id === current);
  const currentStage = stages[index];
  const color = currentStage?.color ?? 'var(--b24-color-primary)';
  return (
    <div className={cx('b24-stages', size === 'sm' && 'b24-stages--sm')} role="list">
      {stages.map((s, i) => {
        const failed = s.semantic === 'fail' && s.id === current;
        return (
          <button
            key={s.id}
            type="button"
            role="listitem"
            title={s.name}
            aria-current={s.id === current ? 'step' : undefined}
            className={cx('b24-stages__item', failed ? 'is-fail' : i < index ? 'is-done' : i === index && 'is-current')}
            style={{ '--stage-color': color } as CSSProperties}
            onClick={() => onChange?.(s.id)}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

export function StageMini({ total, done, color, label }: { total: number; done: number; color?: string; label?: ReactNode }) {
  return (
    <span className="b24-stage-mini" style={color ? ({ '--stage-color': color } as CSSProperties) : undefined}>
      <span className="b24-stage-mini__bar">{Array.from({ length: total }, (_, i) => <i key={i} className={i < done ? 'is-done' : undefined} />)}</span>
      {label && <span className="b24-stage-mini__label">{label}</span>}
    </span>
  );
}

/* ── Богатые ячейки ── */
/** «Поле: ~~было~~ → станет»; одинаковые значения — «(без изменений)», пустые — «пусто» */
export function DiffValue({ field, before, after, emptyText = t('пусто') }: { field?: ReactNode; before: ReactNode; after: ReactNode; emptyText?: string }) {
  const empty = (v: ReactNode) => v == null || v === '';
  const val = (v: ReactNode) => (empty(v) ? <span className="b24-diff__empty">{emptyText}</span> : v);
  const same = (empty(before) && empty(after)) || (typeof before !== 'object' && typeof after !== 'object' && String(before ?? '') === String(after ?? ''));
  if (same) return <span className="b24-diff b24-diff--same">{field && <span className="b24-diff__field">{field}</span>}<span className="b24-diff__value">{val(after)}</span></span>;
  return (
    <span className="b24-diff">
      {field && <span className="b24-diff__field">{field}</span>}
      {empty(before) ? val(before) : <del>{before}</del>}<span className="b24-diff__arrow" aria-label={t('станет')}>→</span>{empty(after) ? val(after) : <ins>{after}</ins>}
    </span>
  );
}

/** Ссылка-чип на карточку: «#123 ООО Ромашка», с крестиком при onRemove */
export function Chip({ children, href, id, avatar, onRemove }: { children: ReactNode; href?: string; id?: string | number; avatar?: string; onRemove?: () => void }) {
  const inner = (
    <>
      {avatar && <Avatar name={typeof children === 'string' ? children : ''} src={avatar} size="xs" />}
      {id != null && <span className="b24-chip__id">#{id}</span>}
      <span>{children}</span>
      {onRemove && <button type="button" className="b24-chip__remove" aria-label={t('Убрать')} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}><Icon name="close" /></button>}
    </>
  );
  return href ? <a className="b24-chip" href={href} target="_top">{inner}</a> : <span className="b24-chip">{inner}</span>;
}

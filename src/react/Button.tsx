import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from '../icons';
import { cx } from './utils';
import { Dropdown, type MenuEntry } from './Overlay';

export type ButtonVariant =
  | 'default' | 'primary' | 'success' | 'danger' | 'copilot'
  | 'secondary' | 'tinted' | 'tinted-danger' | 'plain' | 'link' | 'glass';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  wide?: boolean;
  round?: boolean;
  /** Только иконка — обязательно передайте aria-label */
  iconOnly?: boolean;
}

export const buttonClass = ({ variant = 'default', size = 'md', loading, wide, round, iconOnly }: Partial<ButtonProps>) =>
  cx(
    'b24-btn',
    variant !== 'default' && `b24-btn--${variant}`,
    size !== 'md' && `b24-btn--${size}`,
    loading && 'b24-btn--loading',
    wide && 'b24-btn--wide',
    round && 'b24-btn--round',
    iconOnly && 'b24-btn--icon',
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, icon, iconRight, loading, wide, round, iconOnly, className, children, type = 'button', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(buttonClass({ variant, size, loading, wide, round, iconOnly }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      {children != null && children !== false && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} />}
    </button>
  );
});

export interface SplitButtonProps extends Omit<ButtonProps, 'iconRight'> {
  /** пункты выпадающего меню у шеврона */
  menu?: MenuEntry[];
  onMenuClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  menuLabel?: string;
}

/** «Создать ▾»: основная кнопка + шеврон с меню */
export function SplitButton({ menu, onMenuClick, menuLabel = 'Ещё', variant = 'success', size, ...rest }: SplitButtonProps) {
  const chevron = <Button variant={variant} size={size} icon="chevronDown" aria-label={menuLabel} onClick={onMenuClick} />;
  return (
    <span className="b24-btn-split">
      <Button variant={variant} size={size} {...rest} />
      {menu ? <Dropdown trigger={chevron} items={menu} placement="bottom-start" /> : chevron}
    </span>
  );
}

export function ButtonGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('b24-btn-group', className)} role="group">{children}</div>;
}

import {
  forwardRef, useEffect, useId, useRef, cloneElement, isValidElement,
  type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { Icon } from './Icon';
import type { IconName } from '../icons';
import { cx } from './utils';
import { t } from '../js/i18n';

type Size = 'sm' | 'md' | 'lg';

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  inline?: boolean;
  className?: string;
  /** Один контрол; ему автоматически пробрасываются id / aria-* */
  children: ReactElement<Record<string, unknown>>;
}

export function Field({ label, hint, error, required, inline, className, children }: FieldProps) {
  const autoId = useId();
  const id = (children.props.id as string | undefined) ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': cx(hintId, errorId) || undefined,
        required: required || (children.props.required as boolean | undefined),
      })
    : children;
  return (
    <div className={cx('b24-field', inline && 'b24-field--inline', !!error && 'b24-field--error', className)}>
      {label && <label htmlFor={id} className={cx('b24-field__label', required && 'b24-field__label--required')}>{label}</label>}
      {inline ? <div className="b24-stack" style={{ flex: 1, gap: 4 }}>{control}{hint && !error && <div id={hintId} className="b24-field__hint">{hint}</div>}{error && <div id={errorId} className="b24-field__error">{error}</div>}</div> : control}
      {!inline && hint && !error && <div id={hintId} className="b24-field__hint">{hint}</div>}
      {!inline && error && <div id={errorId} className="b24-field__error" role="alert">{error}</div>}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: Size;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ size = 'md', className, ...rest }, ref) {
  return <input ref={ref} className={cx('b24-input', size !== 'md' && `b24-input--${size}`, className)} {...rest} />;
});

export interface InputGroupProps extends Omit<InputProps, 'prefix'> {
  icon?: IconName;
  iconRight?: IconName;
  prefix?: ReactNode;
  suffix?: ReactNode;
  glass?: boolean;
  onClear?: () => void;
  groupClassName?: string;
}
/** Поле с иконкой / аддонами / кнопкой очистки. */
export const InputGroup = forwardRef<HTMLInputElement, InputGroupProps>(function InputGroup(
  { icon, iconRight, prefix, suffix, glass, onClear, groupClassName, value, ...rest },
  ref,
) {
  return (
    <div className={cx('b24-input-group', glass && 'b24-input-group--glass', groupClassName)}>
      {prefix && <span className="b24-input-group__addon">{prefix}</span>}
      {icon && <span className="b24-input-group__icon"><Icon name={icon} /></span>}
      <Input ref={ref} value={value} {...rest} />
      {onClear && value ? (
        <button type="button" className="b24-input-group__icon" style={{ background: 'none', border: 0, cursor: 'pointer' }} aria-label={t('Очистить')} onClick={onClear}>
          <Icon name="close" size={16} />
        </button>
      ) : null}
      {iconRight && <span className="b24-input-group__icon"><Icon name={iconRight} /></span>}
      {suffix && <span className="b24-input-group__addon">{suffix}</span>}
    </div>
  );
});

export const SearchInput = forwardRef<HTMLInputElement, Omit<InputGroupProps, 'icon'>>(function SearchInput(props, ref) {
  return <InputGroup ref={ref} type="search" icon="search" placeholder={t('Поиск')} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx('b24-textarea', className)} {...rest} />;
});

export interface SelectOption { value: string; label: ReactNode; disabled?: boolean }
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: Size;
  options?: SelectOption[];
  placeholder?: string;
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = 'md', options, placeholder, className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cx('b24-select', size !== 'md' && `b24-select--${size}`, className)} {...rest}>
      {placeholder !== undefined && <option value="" disabled hidden={!!rest.required}>{placeholder}</option>}
      {options?.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      {children}
    </select>
  );
});

export interface CheckProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
}
export const Checkbox = forwardRef<HTMLInputElement, CheckProps>(function Checkbox({ label, description, indeterminate, className, ...rest }, ref) {
  const inner = useRef<HTMLInputElement>(null);
  useEffect(() => { if (inner.current) inner.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <label className={cx('b24-check', className)}>
      <input
        type="checkbox"
        ref={(node) => {
          inner.current = node;
          if (typeof ref === 'function') ref(node); else if (ref) ref.current = node;
        }}
        {...rest}
      />
      {(label || description) && <span>{label}{description && <span className="b24-check__desc">{description}</span>}</span>}
    </label>
  );
});

export const Radio = forwardRef<HTMLInputElement, CheckProps>(function Radio({ label, description, className, ...rest }, ref) {
  return (
    <label className={cx('b24-check', className)}>
      <input type="radio" ref={ref} {...rest} />
      {(label || description) && <span>{label}{description && <span className="b24-check__desc">{description}</span>}</span>}
    </label>
  );
});

export const Switch = forwardRef<HTMLInputElement, CheckProps & { success?: boolean }>(function Switch({ label, description, success, className, ...rest }, ref) {
  return (
    <label className={cx('b24-switch', success && 'b24-switch--success', className)}>
      <input type="checkbox" role="switch" ref={ref} {...rest} />
      {(label || description) && <span>{label}{description && <span className="b24-check__desc">{description}</span>}</span>}
    </label>
  );
});

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createTree, type TreeHandle, type TreeItem, type TreeOptions } from '../js/controls';
import { Icon } from './Icon';
import type { IconName } from '../icons';
import { cx } from './utils';

/* ── Аккордеон ── */
export function Accordion({ flush, className, children }: { flush?: boolean; className?: string; children: ReactNode }) {
  return <div className={cx('b24-accordion', flush && 'b24-accordion--flush', className)}>{children}</div>;
}
export function AccordionItem({ title, meta, counter, open, onToggle, name, children }: {
  title: ReactNode; meta?: ReactNode; counter?: ReactNode;
  /** контролируемо; без него — как обычный details */
  open?: boolean; onToggle?: (open: boolean) => void;
  /** одинаковый name — открыт только один */
  name?: string;
  children: ReactNode;
}) {
  return (
    <details className="b24-accordion__item" open={open} {...(name ? { name } : {})} onToggle={(e) => onToggle?.((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="b24-accordion__head">
        <span className="b24-accordion__title">{title}</span>
        {meta && <span className="b24-accordion__meta">{meta}</span>}
        {counter != null && <span className="b24-counter b24-counter--gray">{counter}</span>}
      </summary>
      <div className="b24-accordion__body">{children}</div>
    </details>
  );
}

/* ── Карточки-радио ── */
export interface RadioCardOption { value: string; title: ReactNode; description?: ReactNode; icon?: IconName; color?: string; disabled?: boolean }
export function RadioCards({ options, value, onChange, name, minWidth, multiple, ariaLabel }: {
  options: RadioCardOption[];
  value: string | string[] | null;
  onChange: (value: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  name?: string; minWidth?: number;
  /** флажки вместо радио: value — массив */
  multiple?: boolean;
  ariaLabel?: string;
}) {
  const auto = useId();
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <div className="b24-radio-cards" role={multiple ? 'group' : 'radiogroup'} aria-label={ariaLabel} style={minWidth ? { ['--b24-radio-card-min' as string]: `${minWidth}px` } : undefined}>
      {options.map((o) => (
        <label key={o.value} className="b24-radio-card" style={o.color ? ({ '--b24-radio-card-color': o.color } as CSSProperties) : undefined}>
          <input
            type={multiple ? 'checkbox' : 'radio'} name={name ?? auto} value={o.value} disabled={o.disabled} checked={values.includes(o.value)}
            onChange={(e) => (multiple ? onChange(e.target.checked ? [...values, o.value] : values.filter((v) => v !== o.value)) : onChange(o.value))}
          />
          {o.icon && <span className="b24-radio-card__icon"><Icon name={o.icon} /></span>}
          <span className="b24-radio-card__title">{o.title}</span>
          {o.description && <span className="b24-radio-card__desc">{o.description}</span>}
        </label>
      ))}
    </div>
  );
}

/* ── Группа чекбоксов ── */
export interface CheckGroupOption { value: string; label: ReactNode; id?: string | number; disabled?: boolean }
export function CheckGroup({ options, value, onChange, height, ariaLabel }: { options: CheckGroupOption[]; value: string[]; onChange: (value: string[]) => void; height?: number; ariaLabel?: string }) {
  const enabled = options.filter((o) => !o.disabled).map((o) => o.value);
  return (
    <div className="b24-check-group" role="group" aria-label={ariaLabel}>
      <div className="b24-check-group__head">
        <span className="b24-check-group__count">Выбрано {value.length} из {options.length}</span>
        <button type="button" className="b24-check-group__link" onClick={() => onChange(Array.from(new Set([...value, ...enabled])))}>все</button>
        <button type="button" className="b24-check-group__link" onClick={() => onChange(value.filter((v) => !enabled.includes(v)))}>очистить</button>
      </div>
      <div className="b24-check-group__list" style={height ? ({ '--b24-check-group-h': `${height}px` } as CSSProperties) : undefined}>
        {options.map((o) => (
          <label key={o.value} className="b24-check">
            <input type="checkbox" disabled={o.disabled} checked={value.includes(o.value)} onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))} />
            <span>{o.label}{o.id != null && <span className="b24-check-group__id">#{o.id}</span>}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ── Сегментированный переключатель ── */
export function Segmented<V extends string>({ options, value, onChange, wide, ariaLabel }: { options: Array<{ value: V; label: ReactNode; icon?: IconName; disabled?: boolean }>; value: V; onChange: (v: V) => void; wide?: boolean; ariaLabel?: string }) {
  const name = useId();
  return (
    <div className={cx('b24-segmented', wide && 'b24-segmented--wide')} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <label key={o.value}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} disabled={o.disabled} onChange={() => onChange(o.value)} />
          <span>{o.icon && <Icon name={o.icon} />}{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/* ── Ползунок ── */
export function Range({ value, onChange, min = 0, max = 100, step = 1, suffix = '', showValue = true, disabled, ariaLabel }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; showValue?: boolean; disabled?: boolean; ariaLabel?: string }) {
  const p = ((value - min) / ((max - min) || 1)) * 100;
  return (
    <div className="b24-range-field">
      <input type="range" className="b24-range" min={min} max={max} step={step} value={value} disabled={disabled} aria-label={ariaLabel} style={{ ['--_p' as string]: `${p}%` }} onChange={(e) => onChange(Number(e.target.value))} />
      {showValue && <span className="b24-range-field__value">{value}{suffix}</span>}
    </div>
  );
}
export function RangePair({ value, onChange, min = 0, max = 100, step = 1, suffix = '', ariaLabel = ['От', 'До'] }: { value: [number, number]; onChange: (v: [number, number]) => void; min?: number; max?: number; step?: number; suffix?: string; ariaLabel?: [string, string] }) {
  const pct = (v: number) => `${((v - min) / ((max - min) || 1)) * 100}%`;
  return (
    <div className="b24-range-field">
      <div className="b24-range-pair" style={{ flex: 1, ['--_a' as string]: pct(value[0]), ['--_b' as string]: pct(value[1]) }}>
        <input type="range" className="b24-range" min={min} max={max} step={step} value={value[0]} aria-label={ariaLabel[0]} onChange={(e) => onChange([Math.min(Number(e.target.value), value[1]), value[1]])} />
        <input type="range" className="b24-range" min={min} max={max} step={step} value={value[1]} aria-label={ariaLabel[1]} onChange={(e) => onChange([value[0], Math.max(Number(e.target.value), value[0])])} />
      </div>
      <span className="b24-range-field__value">{value[0]}–{value[1]}{suffix}</span>
    </div>
  );
}

/* ── Выбор цвета ── */
export const B24_COLORS = ['#2fc6f6', '#0075ff', '#1bce7b', '#faa72c', '#ff5752', '#a77bde', '#e66f9b', '#828b95'];
export function ColorPicker({ value, onChange, colors = B24_COLORS, custom = true, ariaLabel = 'Цвет' }: { value: string; onChange: (v: string) => void; colors?: string[]; custom?: boolean; ariaLabel?: string }) {
  const name = useId();
  const isCustom = !!value && !colors.includes(value);
  return (
    <div className="b24-colors" role="radiogroup" aria-label={ariaLabel}>
      {colors.map((c) => (
        <label key={c} className="b24-colors__swatch" style={{ ['--c' as string]: c }} title={c}>
          <input type="radio" name={name} value={c} checked={value === c} aria-label={c} onChange={() => onChange(c)} />
        </label>
      ))}
      {custom && (
        <label className={cx('b24-colors__custom', isCustom && 'is-active')} style={isCustom ? ({ '--c': value } as CSSProperties) : undefined} title="Свой цвет">
          <input type="color" aria-label="Свой цвет" value={isCustom ? value : '#0075ff'} onChange={(e) => onChange(e.target.value)} />
        </label>
      )}
    </div>
  );
}

/* ── Поле секрета ── */
export function SecretInput({ value, onChange, saved, mask = '••••••••••••', placeholder, id, name, invalid }: {
  value: string; onChange: (v: string) => void;
  /** значение уже сохранено на сервере: поле пустое, маска в подсказке */
  saved?: boolean; mask?: string; placeholder?: string; id?: string; name?: string; invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={cx('b24-secret', saved && 'is-saved')}>
      <input
        className="b24-input" id={id} name={name} type={show ? 'text' : 'password'} autoComplete="new-password" value={value} aria-invalid={invalid || undefined}
        placeholder={saved ? mask : placeholder} title={saved ? 'Значение сохранено. Введите новое, чтобы заменить' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className="b24-secret__toggle" aria-pressed={show} aria-label={show ? 'Скрыть значение' : 'Показать значение'} onClick={() => setShow((s) => !s)}>
        <Icon name="eye" />
      </button>
    </div>
  );
}

/* ── Дерево ── */
export interface TreeProps extends Omit<TreeOptions, 'selected' | 'onSelect'> {
  selected: string[];
  onSelect: (ids: string[], item: TreeItem) => void;
  className?: string;
}
export function Tree({ selected, onSelect, items, className, ...options }: TreeProps) {
  const host = useRef<HTMLDivElement>(null);
  const tree = useRef<TreeHandle | null>(null);
  const cb = useRef(onSelect);
  cb.current = onSelect;
  useEffect(() => {
    tree.current = createTree(host.current!, { ...options, items, selected, onSelect: (ids, item) => cb.current(ids, item) });
    return () => tree.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const itemsKey = JSON.stringify(items);
  useEffect(() => { tree.current?.setItems(items); }, [itemsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const selKey = selected.join('|');
  useEffect(() => { if (tree.current && tree.current.getSelected().join('|') !== selKey) tree.current.setSelected(selected); }, [selKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={host} className={className} />;
}
export type { TreeItem };

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Counter } from './Display';
import { cx } from './utils';

export interface TabItem { id: string; label: ReactNode; counter?: number; disabled?: boolean }
export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: 'line' | 'pills' | 'glass';
  className?: string;
  'aria-label'?: string;
}

export function Tabs({ items, value, onChange, variant = 'line', className, ...rest }: TabsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const enabled = items.filter((t) => !t.disabled);
    const i = enabled.findIndex((t) => t.id === value);
    const next = enabled[(i + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
    onChange(next.id);
    ref.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(next.id)}"]`)?.focus();
  };
  return (
    <div
      ref={ref}
      role="tablist"
      className={cx('b24-tabs', variant === 'pills' && 'b24-tabs--pills', variant === 'glass' && 'b24-tabs--pills b24-tabs--glass', className)}
      onKeyDown={onKey}
      aria-label={rest['aria-label']}
    >
      {items.map((t) => (
        <button
          key={t.id}
          data-id={t.id}
          type="button"
          role="tab"
          className="b24-tabs__item"
          aria-selected={t.id === value}
          tabIndex={t.id === value ? 0 : -1}
          disabled={t.disabled}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.counter ? <Counter value={t.counter} tone={t.id === value ? 'danger' : 'gray'} /> : null}
        </button>
      ))}
    </div>
  );
}

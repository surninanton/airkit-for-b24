import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  MONTHS, WEEKDAYS, PERIOD_OPTIONS, addMonths, formatDate, inRange, isDisabled, isSameDay, isWeekend, monthGrid,
  parseDate, resolvePeriod, startOfDay, toISODate, type DateRange, type PeriodType, type PeriodValue,
} from '../js/date';
import { Button } from './Button';
import { Select } from './Form';
import { Icon } from './Icon';
import { Popover } from './Overlay';
import { cx } from './utils';

/* ── Calendar ────────────────────────────────────────── */
export interface CalendarProps {
  mode?: 'single' | 'range';
  value?: Date | null;
  onChange?: (value: Date | null) => void;
  range?: DateRange;
  onRangeChange?: (range: DateRange) => void;
  min?: Date | null;
  max?: Date | null;
  withTime?: boolean;
  footer?: boolean;
  /** начальный месяц (если нет значения) */
  defaultMonth?: Date;
}

export function Calendar({ mode = 'single', value = null, onChange, range = { from: null, to: null }, onRangeChange, min, max, withTime, footer = true, defaultMonth }: CalendarProps) {
  const initial = value ?? range.from ?? defaultMonth ?? new Date();
  const [cursor, setCursor] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [view, setView] = useState<'days' | 'months'>('days');
  const [hover, setHover] = useState<Date | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const today = new Date();

  const pick = (day: Date) => {
    if (mode === 'single') {
      const next = withTime && value ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), value.getHours(), value.getMinutes()) : day;
      onChange?.(next);
      return;
    }
    if (!range.from || range.to) onRangeChange?.({ from: day, to: null });
    else onRangeChange?.(day < range.from ? { from: day, to: range.from } : { from: range.from, to: day });
    setHover(null);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.b24-calendar__day');
    const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key];
    if (!btn || !delta) return;
    e.preventDefault();
    const d = parseDate(btn.dataset.date)!;
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
    if (target.getMonth() !== cursor.getMonth()) setCursor(new Date(target.getFullYear(), target.getMonth(), 1));
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-date="${toISODate(target)}"]`)?.focus());
  };

  const rangeEnd = mode === 'range' ? range.to ?? (range.from ? hover : null) : null;
  const [ra, rb] = range.from && rangeEnd && rangeEnd < range.from ? [rangeEnd, range.from] : [range.from, rangeEnd];
  const focusable = days.find((d) => (mode === 'single' ? isSameDay(d, value) : isSameDay(d, range.from)) && d.getMonth() === cursor.getMonth())
    ?? days.find((d) => isSameDay(d, today) && d.getMonth() === cursor.getMonth())
    ?? days.find((d) => d.getMonth() === cursor.getMonth());

  return (
    <div className="b24-calendar">
      <div className="b24-calendar__head">
        <button type="button" className="b24-calendar__title" aria-live="polite" onClick={() => setView(view === 'days' ? 'months' : 'days')}>
          {view === 'days' ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}` : cursor.getFullYear()}
        </button>
        <button type="button" className="b24-calendar__nav" aria-label="Назад" onClick={() => setCursor(addMonths(cursor, view === 'days' ? -1 : -12))}><Icon name="chevronLeft" /></button>
        <button type="button" className="b24-calendar__nav" aria-label="Вперёд" onClick={() => setCursor(addMonths(cursor, view === 'days' ? 1 : 12))}><Icon name="chevronRight" /></button>
      </div>

      {view === 'months' ? (
        <div className="b24-calendar__months">
          {MONTHS.map((m, i) => (
            <button key={m} type="button" className={cx('b24-calendar__month', i === cursor.getMonth() && 'is-selected')} onClick={() => { setCursor(new Date(cursor.getFullYear(), i, 1)); setView('days'); }}>
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      ) : (
        <div ref={gridRef} className="b24-calendar__grid" role="grid" onKeyDown={onKey} onMouseLeave={() => setHover(null)}>
          {WEEKDAYS.map((d) => <span key={d} className="b24-calendar__weekday" role="columnheader">{d}</span>)}
          {days.map((day) => {
            const start = mode === 'range' && isSameDay(day, ra);
            const end = mode === 'range' && isSameDay(day, rb ?? ra);
            const selected = mode === 'single' && isSameDay(day, value);
            return (
              <button
                key={day.getTime()}
                type="button"
                data-date={toISODate(day)}
                aria-label={formatDate(day)}
                aria-selected={selected || start || end || undefined}
                tabIndex={isSameDay(day, focusable) ? 0 : -1}
                disabled={isDisabled(day, min, max)}
                className={cx(
                  'b24-calendar__day',
                  day.getMonth() !== cursor.getMonth() && 'is-outside',
                  isWeekend(day) && 'is-weekend',
                  isSameDay(day, today) && 'is-today',
                  selected && 'is-selected',
                  start && 'is-range-start',
                  end && 'is-range-end',
                  mode === 'range' && rb && inRange(day, ra, rb) && 'is-in-range',
                )}
                onClick={() => pick(day)}
                onMouseEnter={mode === 'range' && range.from && !range.to ? () => setHover(day) : undefined}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      )}

      {withTime && mode === 'single' && (
        <div className="b24-calendar__time">
          Время
          <input
            type="time"
            className="b24-input b24-input--sm"
            aria-label="Время"
            value={value ? formatDate(value, true).slice(11) : ''}
            onChange={(e) => {
              const [hh, mm] = e.target.value.split(':').map(Number);
              const base = value ?? startOfDay(new Date());
              onChange?.(new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh || 0, mm || 0));
            }}
          />
        </div>
      )}

      {footer && (
        <div className="b24-calendar__footer">
          <Button variant="link" size="sm" onClick={() => {
            const t = startOfDay(new Date());
            setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
            if (mode === 'single') onChange?.(t); else onRangeChange?.({ from: t, to: t });
          }}>Сегодня</Button>
          <Button variant="plain" size="sm" onClick={() => (mode === 'single' ? onChange?.(null) : onRangeChange?.({ from: null, to: null }))}>Очистить</Button>
        </div>
      )}
    </div>
  );
}

/* ── DatePicker ──────────────────────────────────────── */
export interface DatePickerProps {
  value: Date | null;
  onChange: (value: Date | null) => void;
  min?: Date | null;
  max?: Date | null;
  withTime?: boolean;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  className?: string;
}

export function DatePicker({ value, onChange, min, max, withTime, placeholder = 'дд.мм.гггг', disabled, size = 'md', className, ...inputProps }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = text ?? formatDate(value, withTime);

  const commit = () => {
    if (text === null) return;
    const d = parseDate(text);
    onChange(text.trim() === '' ? null : d ?? value);
    setText(null);
  };

  return (
    <div ref={anchor} className={cx('b24-input-group b24-datepicker', className)} style={size === 'sm' ? { height: 'var(--b24-size-sm)' } : undefined}>
      <input
        ref={inputRef}
        className={cx('b24-input', size === 'sm' && 'b24-input--sm')}
        value={shown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { commit(); setOpen(false); }
          if (e.key === 'Tab') setOpen(false);
        }}
        {...inputProps}
      />
      <span className="b24-input-group__icon" onMouseDown={(e) => { e.preventDefault(); if (!disabled) { setOpen((v) => !v); inputRef.current?.focus(); } }}>
        <Icon name="calendar" />
      </span>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} className="b24-datepicker-popup" role="dialog" aria-label="Выбор даты">
        <Calendar
          value={value}
          min={min}
          max={max}
          withTime={withTime}
          onChange={(d) => { onChange(d); setText(null); if (!withTime) setOpen(false); }}
        />
      </Popover>
    </div>
  );
}

/* ── DateRangePicker ─────────────────────────────────── */
export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  min?: Date | null;
  max?: Date | null;
  /** быстрые периоды слева (Сегодня, Текущая неделя …) */
  presets?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const RANGE_PRESETS: PeriodType[] = ['today', 'yesterday', 'week', 'lastWeek', 'month', 'lastMonth', 'quarter', 'last7', 'last30'];

export function DateRangePicker({ value, onChange, min, max, presets = true, placeholder = 'Период', disabled, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const label = value.from ? `${formatDate(value.from)} – ${value.to ? formatDate(value.to) : '…'}` : '';
  return (
    <div ref={anchor} className={cx('b24-input-group b24-datepicker', className)}>
      <input className="b24-input" readOnly value={label} placeholder={placeholder} disabled={disabled} onClick={() => setOpen(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'ArrowDown') setOpen(true); }} />
      <span className="b24-input-group__icon" onMouseDown={(e) => { e.preventDefault(); if (!disabled) setOpen((v) => !v); }}><Icon name="calendar" /></span>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} className={cx('b24-datepicker-popup', presets && 'b24-datepicker-popup--with-presets')} role="dialog" aria-label="Выбор периода">
        {presets && (
          <div className="b24-datepicker-presets">
            {RANGE_PRESETS.map((p) => (
              <button key={p} type="button" className="b24-menu__item" onClick={() => {
                const r = resolvePeriodSafe(p);
                if (r) { onChange(r); setOpen(false); }
              }}>{PERIOD_OPTIONS.find((o) => o.value === p)!.label}</button>
            ))}
          </div>
        )}
        <Calendar mode="range" range={value} min={min} max={max} onRangeChange={(r) => { onChange(r); if ((r.from && r.to) || (!r.from && !r.to)) setOpen(false); }} />
      </Popover>
    </div>
  );
}

function resolvePeriodSafe(type: PeriodType): DateRange | null {
  return resolvePeriod({ type });
}

/* ── PeriodPicker: «Любая дата ▾» + поля, как в фильтре ── */
export interface PeriodPickerProps {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  options?: PeriodType[];
  id?: string;
}
export function PeriodPicker({ value, onChange, options, id }: PeriodPickerProps): ReactNode {
  const list = options ? PERIOD_OPTIONS.filter((o) => options.includes(o.value)) : PERIOD_OPTIONS;
  return (
    <div className="b24-filter-popup__field-row">
      <Select id={id} value={value.type} onChange={(e) => onChange({ type: e.target.value as PeriodType })} options={list.map((o) => ({ value: o.value, label: o.label }))} />
      {value.type === 'exact' && (
        <DatePicker value={parseDate(value.from)} onChange={(d) => onChange({ ...value, from: formatDate(d) })} />
      )}
      {value.type === 'range' && (
        <>
          <DatePicker value={parseDate(value.from)} onChange={(d) => onChange({ ...value, from: formatDate(d) })} placeholder="с" />
          <span className="b24-filter-popup__sep">—</span>
          <DatePicker value={parseDate(value.to)} onChange={(d) => onChange({ ...value, to: formatDate(d) })} placeholder="по" />
        </>
      )}
    </div>
  );
}

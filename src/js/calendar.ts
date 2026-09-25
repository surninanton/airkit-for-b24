import { icon } from '../icons';
import {
  MONTHS, WEEKDAYS, addMonths, formatDate, inRange, isDisabled, isSameDay, isWeekend, monthGrid, parseDate,
  startOfDay, toISODate, type DateRange,
} from './date';
import { h, html, pushLayer } from './dom';

export interface CalendarOptions {
  mode?: 'single' | 'range';
  value?: Date | null;
  range?: DateRange;
  min?: Date | null;
  max?: Date | null;
  /** показать поле времени (только single) */
  withTime?: boolean;
  /** кнопки «Сегодня» / «Очистить» */
  footer?: boolean;
  onSelect?: (value: Date | null) => void;
  onRangeSelect?: (range: DateRange) => void;
}

export interface CalendarHandle {
  element: HTMLElement;
  setValue(value: Date | null): void;
  setRange(range: DateRange): void;
  showMonth(date: Date): void;
  destroy(): void;
}

/** Календарь-сетка (без попапа). Отрисовывается в container. */
export function createCalendar(container: HTMLElement, options: CalendarOptions = {}): CalendarHandle {
  const { mode = 'single', min, max, withTime = false, footer = true } = options;
  let value = options.value ?? null;
  let range: DateRange = options.range ?? { from: null, to: null };
  let view: 'days' | 'months' = 'days';
  let cursor = startOfDay(value ?? range.from ?? new Date());
  cursor.setDate(1);
  let hover: Date | null = null;

  const root = h('div', { class: 'b24-calendar' });
  container.append(root);

  const render = () => {
    root.textContent = '';
    const head = h('div', { class: 'b24-calendar__head' });
    const title = h('button', { type: 'button', class: 'b24-calendar__title', 'aria-live': 'polite' },
      view === 'days' ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}` : String(cursor.getFullYear()));
    const prev = h('button', { type: 'button', class: 'b24-calendar__nav', 'aria-label': view === 'days' ? 'Предыдущий месяц' : 'Предыдущий год' }, html(icon('chevronLeft')));
    const next = h('button', { type: 'button', class: 'b24-calendar__nav', 'aria-label': view === 'days' ? 'Следующий месяц' : 'Следующий год' }, html(icon('chevronRight')));
    title.addEventListener('click', () => { view = view === 'days' ? 'months' : 'days'; render(); });
    prev.addEventListener('click', () => { cursor = addMonths(cursor, view === 'days' ? -1 : -12); render(); });
    next.addEventListener('click', () => { cursor = addMonths(cursor, view === 'days' ? 1 : 12); render(); });
    head.append(title, prev, next);
    root.append(head);

    if (view === 'months') {
      const grid = h('div', { class: 'b24-calendar__months' });
      MONTHS.forEach((name, i) => {
        const b = h('button', { type: 'button', class: `b24-calendar__month${i === cursor.getMonth() ? ' is-selected' : ''}` }, name.slice(0, 3));
        b.addEventListener('click', () => { cursor = new Date(cursor.getFullYear(), i, 1); view = 'days'; render(); });
        grid.append(b);
      });
      root.append(grid);
      return;
    }

    const grid = h('div', { class: 'b24-calendar__grid', role: 'grid' });
    WEEKDAYS.forEach((d) => grid.append(h('span', { class: 'b24-calendar__weekday', role: 'columnheader' }, d)));
    const today = new Date();
    const rangeEnd = mode === 'range' ? range.to ?? (range.from ? hover : null) : null;
    for (const day of monthGrid(cursor.getFullYear(), cursor.getMonth())) {
      const cls = ['b24-calendar__day'];
      if (day.getMonth() !== cursor.getMonth()) cls.push('is-outside');
      if (isWeekend(day)) cls.push('is-weekend');
      if (isSameDay(day, today)) cls.push('is-today');
      if (mode === 'single' && isSameDay(day, value)) cls.push('is-selected');
      if (mode === 'range' && range.from) {
        const [a, b] = rangeEnd && rangeEnd < range.from ? [rangeEnd, range.from] : [range.from, rangeEnd];
        if (isSameDay(day, a)) cls.push('is-range-start');
        if (isSameDay(day, b ?? a)) cls.push('is-range-end');
        if (b && inRange(day, a, b)) cls.push('is-in-range');
      }
      const btn = h('button', {
        type: 'button',
        class: cls.join(' '),
        'data-date': toISODate(day),
        'aria-label': formatDate(day),
        'aria-selected': cls.includes('is-selected') || cls.includes('is-range-start') || cls.includes('is-range-end') ? 'true' : undefined,
        disabled: isDisabled(day, min, max),
        tabindex: '-1',
      }, String(day.getDate()));
      grid.append(btn);
    }
    root.append(grid);
    // фокусируемый день для клавиатуры
    const focusDay = grid.querySelector<HTMLElement>('.is-selected, .is-range-start, .is-today:not(.is-outside)') ?? grid.querySelector<HTMLElement>('.b24-calendar__day:not(.is-outside)');
    focusDay?.setAttribute('tabindex', '0');

    if (withTime && mode === 'single') {
      const time = h('input', { type: 'time', class: 'b24-input b24-input--sm', value: value ? formatDate(value, true).slice(11) : '', 'aria-label': 'Время' });
      time.addEventListener('change', () => {
        const [hh, mm] = time.value.split(':').map(Number);
        const base = value ?? startOfDay(new Date());
        value = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh || 0, mm || 0);
        options.onSelect?.(value);
      });
      root.append(h('div', { class: 'b24-calendar__time' }, 'Время', time));
    }

    if (footer) {
      const f = h('div', { class: 'b24-calendar__footer' });
      const todayBtn = h('button', { type: 'button', class: 'b24-btn b24-btn--link b24-btn--sm' }, 'Сегодня');
      todayBtn.addEventListener('click', () => {
        const t = startOfDay(new Date());
        if (mode === 'single') selectSingle(t);
        else { range = { from: t, to: t }; options.onRangeSelect?.(range); cursor = new Date(t.getFullYear(), t.getMonth(), 1); render(); }
      });
      const clear = h('button', { type: 'button', class: 'b24-btn b24-btn--plain b24-btn--sm' }, 'Очистить');
      clear.addEventListener('click', () => {
        if (mode === 'single') { value = null; options.onSelect?.(null); }
        else { range = { from: null, to: null }; options.onRangeSelect?.(range); }
        render();
      });
      f.append(todayBtn, clear);
      root.append(f);
    }
  };

  const selectSingle = (day: Date) => {
    const withT = withTime && value ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), value.getHours(), value.getMinutes()) : day;
    value = withT;
    cursor = new Date(day.getFullYear(), day.getMonth(), 1);
    render();
    options.onSelect?.(value);
  };

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.b24-calendar__day');
    if (!btn || btn.disabled) return;
    const day = parseDate(btn.dataset.date)!;
    if (mode === 'single') return selectSingle(day);
    if (!range.from || range.to) range = { from: day, to: null };
    else range = day < range.from ? { from: day, to: range.from } : { from: range.from, to: day };
    hover = null;
    render();
    options.onRangeSelect?.(range);
  });
  root.addEventListener('mouseover', (e) => {
    if (mode !== 'range' || !range.from || range.to) return;
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.b24-calendar__day');
    const d = btn ? parseDate(btn.dataset.date) : null;
    if (d && !isSameDay(d, hover)) { hover = d; render(); }
  });
  root.addEventListener('keydown', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.b24-calendar__day');
    if (!btn) return;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const d = parseDate(btn.dataset.date)!;
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
    if (target.getMonth() !== cursor.getMonth()) { cursor = new Date(target.getFullYear(), target.getMonth(), 1); render(); }
    root.querySelector<HTMLElement>(`[data-date="${toISODate(target)}"]`)?.focus();
  });

  render();
  return {
    element: root,
    setValue(v) { value = v; if (v) cursor = new Date(v.getFullYear(), v.getMonth(), 1); render(); },
    setRange(r) { range = r; if (r.from) cursor = new Date(r.from.getFullYear(), r.from.getMonth(), 1); render(); },
    showMonth(d) { cursor = new Date(d.getFullYear(), d.getMonth(), 1); render(); },
    destroy() { root.remove(); },
  };
}

/* ── DatePicker: поле + попап ───────────────────────── */

export interface DatePickerOptions extends Omit<CalendarOptions, 'onSelect' | 'onRangeSelect' | 'value' | 'range'> {
  /** для range: второе поле «по» (иначе в одном поле пишется «dd.mm.yyyy – dd.mm.yyyy») */
  inputTo?: HTMLInputElement;
  onChange?: (value: Date | null | DateRange) => void;
}

export interface DatePickerHandle {
  open(): void;
  close(): void;
  getValue(): Date | null;
  getRange(): DateRange;
  destroy(): void;
}

/** Привязывает календарь к <input>. Значение хранится в поле строкой dd.mm.yyyy. */
export function datepicker(input: HTMLInputElement, options: DatePickerOptions = {}): DatePickerHandle {
  const { mode = 'single', inputTo, withTime } = options;
  const RANGE_SEP = ' – ';
  const readRange = (): DateRange => {
    if (inputTo) return { from: parseDate(input.value), to: parseDate(inputTo.value) };
    const [a, b] = input.value.split(/\s+[–-]\s+/);
    return { from: parseDate(a), to: parseDate(b) };
  };

  const popup = h('div', { class: 'b24-popup b24-root b24-datepicker-popup', hidden: true, role: 'dialog', 'aria-label': 'Выбор даты', style: 'background:var(--b24-bg-surface)' });
  let cal: CalendarHandle | null = null;
  let releaseLayer = () => {};
  let opened = false;

  const emit = () => {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    inputTo?.dispatchEvent(new Event('change', { bubbles: true }));
    options.onChange?.(mode === 'single' ? parseDate(input.value) : readRange());
  };

  const position = () => {
    const anchor = input.closest('.b24-input-group') ?? input;
    const r = anchor.getBoundingClientRect();
    const ph = popup.offsetHeight;
    let top = r.bottom + 6;
    if (top + ph > innerHeight && r.top - ph - 6 > 0) top = r.top - ph - 6;
    const left = Math.min(Math.max(8, r.left), innerWidth - popup.offsetWidth - 8);
    popup.style.top = `${top + scrollY}px`;
    popup.style.left = `${left + scrollX}px`;
  };

  const onDocDown = (e: MouseEvent) => {
    const t = e.target as Node;
    if (!popup.contains(t) && t !== input && t !== inputTo && !(input.closest('.b24-datepicker')?.contains(t))) close();
  };

  function open() {
    if (opened || input.disabled) return;
    opened = true;
    popup.textContent = '';
    cal = createCalendar(popup, {
      ...options,
      value: parseDate(input.value),
      range: readRange(),
      onSelect(v) {
        input.value = formatDate(v, withTime);
        emit();
        if (!withTime) close();
      },
      onRangeSelect(r) {
        if (inputTo) { input.value = formatDate(r.from); inputTo.value = formatDate(r.to); }
        else input.value = r.from ? `${formatDate(r.from)}${r.to ? RANGE_SEP + formatDate(r.to) : ''}` : '';
        emit();
        if ((r.from && r.to) || (!r.from && !r.to)) close();
      },
    });
    document.body.append(popup);
    popup.hidden = false;
    position();
    document.addEventListener('mousedown', onDocDown);
    addEventListener('resize', position);
    addEventListener('scroll', position, true);
    releaseLayer = pushLayer(() => { close(); input.focus(); });
  }

  function close() {
    if (!opened) return;
    opened = false;
    popup.hidden = true;
    cal?.destroy();
    cal = null;
    document.removeEventListener('mousedown', onDocDown);
    removeEventListener('resize', position);
    removeEventListener('scroll', position, true);
    releaseLayer();
  }

  const onFocus = () => open();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' && opened) { e.preventDefault(); popup.querySelector<HTMLElement>('.b24-calendar__day[tabindex="0"]')?.focus(); }
    if (e.key === 'Enter') { close(); normalize(); }
    if (e.key === 'Tab') close();
  };
  // Ручной ввод: при blur нормализуем формат
  const normalize = () => {
    if (mode === 'single') {
      const d = parseDate(input.value);
      const next = d ? formatDate(d, withTime) : '';
      if (next !== input.value) { input.value = next; emit(); }
      if (d && cal) cal.setValue(d);
    }
  };
  const onInput = () => {
    if (!cal || mode !== 'single') return;
    const d = parseDate(input.value);
    if (d) cal.showMonth(d);
  };

  input.autocomplete = 'off';
  if (!input.placeholder) input.placeholder = mode === 'range' && !inputTo ? 'дд.мм.гггг – дд.мм.гггг' : 'дд.мм.гггг';
  input.addEventListener('focus', onFocus);
  input.addEventListener('click', onFocus);
  input.addEventListener('keydown', onKey);
  input.addEventListener('input', onInput);
  input.addEventListener('change', normalize);
  inputTo?.addEventListener('focus', onFocus);
  inputTo?.addEventListener('click', onFocus);

  // иконка календаря в .b24-input-group открывает попап
  const iconBtn = input.closest('.b24-input-group')?.querySelector<HTMLElement>('[data-b24-datepicker-toggle]');
  const onIcon = () => (opened ? close() : (input.focus(), open()));
  iconBtn?.addEventListener('click', onIcon);

  return {
    open,
    close,
    getValue: () => parseDate(input.value),
    getRange: readRange,
    destroy() {
      close();
      popup.remove();
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('click', onFocus);
      input.removeEventListener('keydown', onKey);
      input.removeEventListener('input', onInput);
      input.removeEventListener('change', normalize);
      inputTo?.removeEventListener('focus', onFocus);
      inputTo?.removeEventListener('click', onFocus);
      iconBtn?.removeEventListener('click', onIcon);
    },
  };
}

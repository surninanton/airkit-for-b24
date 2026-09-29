import { bringToFront, viewportHeight, h, pushLayer } from './dom';

/**
 * Выбор времени HH:MM: поле + попап с колонками часов и минут.
 *   <input class="b24-input" name="time" data-b24-timepicker data-step="15" data-min="08:00" data-max="20:00">
 * Значение в input — всегда строка HH:MM (или пусто); при изменении — событие change.
 */

export type TimeStep = 1 | 5 | 10 | 15 | 30;

export interface TimePickerOptions {
  /** шаг минут: 1, 5, 10, 15, 30 (по умолчанию 15) */
  step?: number;
  /** HH:MM */
  min?: string;
  max?: string;
  /** false — разрешить минуты не кратные шагу (при ручном вводе) */
  strict?: boolean;
  placeholder?: string;
  /** закрывать попап после выбора минут (по умолчанию true) */
  closeOnSelect?: boolean;
  onChange?: (value: string) => void;
  /** выбор завершён (клик по минутам или Enter) — даже если значение не изменилось */
  onSelect?: (value: string) => void;
}

export interface TimePickerHandle {
  open(): void;
  close(): void;
  isOpen(): boolean;
  getValue(): string;
  setValue(value: string, emit?: boolean): void;
  destroy(): void;
}

const ALLOWED_STEPS = [1, 5, 10, 15, 30];
const pad = (n: number) => String(n).padStart(2, '0');
const toMin = (h: number, m: number) => h * 60 + m;
export const formatTime = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/**
 * «9» → 09:00, «930» → 09:30, «0930» → 09:30, «9:30» / «09.30» / «9 30» → 09:30, «1430» → 14:30.
 * Возвращает минуты от полуночи или null.
 */
export function parseTime(value: string | null | undefined): number | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  let h: number;
  let m: number;
  const sep = s.match(/^(\d{1,2})\s*[:.,\s\-]\s*(\d{1,2})$/);
  if (sep) {
    h = +sep[1];
    m = +sep[2];
  } else if (/^\d{1,4}$/.test(s)) {
    if (s.length <= 2) { h = +s; m = 0; }
    else if (s.length === 3) { h = +s[0]; m = +s.slice(1); }
    else { h = +s.slice(0, 2); m = +s.slice(2); }
  } else {
    return null;
  }
  return h >= 0 && h < 24 && m >= 0 && m < 60 ? toMin(h, m) : null;
}

export function timepicker(input: HTMLInputElement, options: TimePickerOptions = {}): TimePickerHandle {
  const step = ALLOWED_STEPS.includes(Number(options.step)) ? Number(options.step) : 15;
  const strict = options.strict !== false;
  const closeOnSelect = options.closeOnSelect !== false;
  const min = parseTime(options.min) ?? 0;
  const max = parseTime(options.max) ?? toMin(23, 59);

  let opened = false;
  let releaseLayer = () => {};
  let committed = normalize(input.value) ?? '';
  input.value = committed;
  input.autocomplete = 'off';
  input.inputMode = 'numeric';
  if (!input.placeholder) input.placeholder = options.placeholder ?? 'чч:мм';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-haspopup', 'listbox');
  input.setAttribute('aria-expanded', 'false');

  const popup = h('div', { class: 'b24-popup b24-root b24-timepicker-popup', hidden: true, role: 'dialog', 'aria-label': 'Выбор времени', style: 'background:var(--b24-bg-surface)' });
  const hoursCol = h('div', { class: 'b24-timepicker__col', role: 'listbox', 'aria-label': 'Часы' });
  const minutesCol = h('div', { class: 'b24-timepicker__col', role: 'listbox', 'aria-label': 'Минуты' });
  popup.append(hoursCol, h('span', { class: 'b24-timepicker__sep', 'aria-hidden': 'true' }, ':'), minutesCol);

  function clamp(v: number): number {
    return Math.min(max, Math.max(min, v));
  }

  /** Строка → HH:MM с учётом шага/границ; null — не время. */
  function normalize(raw: string): string | null {
    const t = parseTime(raw);
    if (t == null) return raw.trim() === '' ? '' : null;
    let v = t;
    if (strict && v % step) v = Math.round(v / step) * step;
    if (v >= 24 * 60) v -= step;
    return formatTime(clamp(v));
  }

  function commit(value: string) {
    input.value = value;
    if (value === committed) return;
    committed = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    options.onChange?.(value);
  }

  function hourAllowed(hh: number): boolean {
    return toMin(hh, 59) >= min && toMin(hh, 0) <= max;
  }
  function minuteAllowed(hh: number, mm: number): boolean {
    const v = toMin(hh, mm);
    return v >= min && v <= max;
  }

  function render() {
    const current = parseTime(input.value);
    const ch = current != null ? Math.floor(current / 60) : null;
    const cm = current != null ? current % 60 : null;
    hoursCol.textContent = '';
    minutesCol.textContent = '';
    for (let hh = 0; hh < 24; hh++) {
      const b = h('button', {
        type: 'button', class: `b24-timepicker__cell${hh === ch ? ' is-selected' : ''}`, role: 'option',
        'aria-selected': String(hh === ch), 'data-hour': String(hh), disabled: !hourAllowed(hh), tabindex: '-1',
      }, pad(hh));
      hoursCol.append(b);
    }
    const hourForMinutes = ch ?? Math.floor(clamp(toMin(new Date().getHours(), 0)) / 60);
    const minutes: number[] = [];
    for (let mm = 0; mm < 60; mm += step) minutes.push(mm);
    // нестрогий режим: показываем и введённое «некратное» значение
    if (cm != null && !minutes.includes(cm)) { minutes.push(cm); minutes.sort((a, b) => a - b); }
    for (const mm of minutes) {
      const b = h('button', {
        type: 'button', class: `b24-timepicker__cell${mm === cm ? ' is-selected' : ''}`, role: 'option',
        'aria-selected': String(mm === cm), 'data-minute': String(mm), disabled: !minuteAllowed(hourForMinutes, mm), tabindex: '-1',
      }, pad(mm));
      minutesCol.append(b);
    }
    // выбранное — в видимую область колонки
    for (const col of [hoursCol, minutesCol]) {
      col.classList.toggle('is-scrollable', col.scrollHeight > col.clientHeight + 1);
      const sel = col.querySelector<HTMLElement>('.is-selected');
      if (sel) col.scrollTop = sel.offsetTop - col.clientHeight / 2 + sel.offsetHeight / 2;
    }
  }

  function position() {
    const r = input.getBoundingClientRect();
    const ph = popup.offsetHeight;
    const pw = popup.offsetWidth;
    // Во фрейме портала viewportHeight() — высота фрейма, поэтому переворот вверх не даёт обрезаться у низа фрейма
    let top = r.bottom + 6;
    if (top + ph > viewportHeight() - 4 && r.top - ph - 6 >= 0) top = r.top - ph - 6;
    top = Math.max(4, top);
    const left = Math.min(Math.max(8, r.left), innerWidth - pw - 8);
    popup.style.top = `${top + scrollY}px`;
    popup.style.left = `${left + scrollX}px`;
  }

  const onDocDown = (e: MouseEvent) => {
    const t = e.target as Node;
    if (!popup.contains(t) && t !== input) close();
  };

  function open() {
    if (opened || input.disabled || input.readOnly) return;
    opened = true;
    document.body.append(popup);
    popup.hidden = false;
    bringToFront(popup);
    render();
    position();
    input.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', onDocDown, true);
    addEventListener('resize', position);
    addEventListener('scroll', position, true);
    releaseLayer = pushLayer(() => close());
  }

  function close() {
    if (!opened) return;
    opened = false;
    popup.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onDocDown, true);
    removeEventListener('resize', position);
    removeEventListener('scroll', position, true);
    releaseLayer();
  }

  popup.addEventListener('mousedown', (e) => e.preventDefault()); // фокус остаётся в поле
  popup.addEventListener('click', (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLButtonElement>('.b24-timepicker__cell');
    if (!cell || cell.disabled) return;
    const current = parseTime(input.value);
    if (cell.dataset.hour != null) {
      const hh = Number(cell.dataset.hour);
      let mm = current != null ? current % 60 : 0;
      if (!minuteAllowed(hh, mm)) mm = Math.ceil((Math.max(min, toMin(hh, 0)) - toMin(hh, 0)) / step) * step;
      commit(formatTime(clamp(toMin(hh, Math.min(mm, 59)))));
      render();
    } else {
      const mm = Number(cell.dataset.minute);
      const hh = current != null ? Math.floor(current / 60) : Math.floor(clamp(toMin(new Date().getHours(), 0)) / 60);
      // сначала закрыть: подписчики change видят, что выбор завершён
      if (closeOnSelect) close();
      commit(formatTime(clamp(toMin(hh, mm))));
      if (!closeOnSelect) render();
      options.onSelect?.(committed);
    }
  });

  const onFocus = () => open();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const base = parseTime(input.value) ?? Math.round(toMin(new Date().getHours(), new Date().getMinutes()) / step) * step;
      let next = base + (e.key === 'ArrowUp' ? step : -step);
      if (next % step) next = e.key === 'ArrowUp' ? Math.floor(next / step) * step : Math.ceil(next / step) * step;
      next = ((next % 1440) + 1440) % 1440;
      commit(formatTime(clamp(next)));
      if (!opened) open(); else render();
    } else if (e.key === 'Enter') {
      if (opened) e.preventDefault();
      normalizeInput();
      close();
      options.onSelect?.(committed);
    } else if (e.key === 'Tab') {
      normalizeInput();
      close();
    }
  };
  function normalizeInput() {
    const n = normalize(input.value);
    commit(n == null ? committed : n);
  }
  const onBlur = () => normalizeInput();
  const onInput = () => {
    if (!opened) return;
    const t = parseTime(input.value);
    if (t != null) render();
  };

  input.addEventListener('focus', onFocus);
  input.addEventListener('click', onFocus);
  input.addEventListener('keydown', onKey);
  input.addEventListener('blur', onBlur);
  input.addEventListener('input', onInput);

  return {
    open,
    close,
    isOpen: () => opened,
    getValue: () => committed,
    setValue(value, emit = false) {
      const n = normalize(value) ?? '';
      if (emit) commit(n); else { committed = n; input.value = n; }
      if (opened) render();
    },
    destroy() {
      close();
      popup.remove();
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('click', onFocus);
      input.removeEventListener('keydown', onKey);
      input.removeEventListener('blur', onBlur);
      input.removeEventListener('input', onInput);
    },
  };
}

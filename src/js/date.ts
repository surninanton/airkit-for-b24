/**
 * Чистая логика дат (без DOM): сетка месяца, формат/разбор dd.mm.yyyy, периоды фильтра.
 * Используется и vanilla-календарём, и React-компонентами.
 */

import { t } from './i18n';

export const months = (): string[] => [t('Январь'), t('Февраль'), t('Март'), t('Апрель'), t('Май'), t('Июнь'), t('Июль'), t('Август'), t('Сентябрь'), t('Октябрь'), t('Ноябрь'), t('Декабрь')];
export const monthsGenitive = (): string[] => [t('января'), t('февраля'), t('марта'), t('апреля'), t('мая'), t('июня'), t('июля'), t('августа'), t('сентября'), t('октября'), t('ноября'), t('декабря')];
export const weekdays = (): string[] => [t('Пн'), t('Вт'), t('Ср'), t('Чт'), t('Пт'), t('Сб'), t('Вс')];

/** Массив, элементы которого вычисляются при каждом обращении (подписи следуют за setLocale) */
const live = <T>(get: () => T[]): T[] => new Proxy([] as T[], {
  get: (_, k) => { const a = get(); const v = Reflect.get(a, k); return typeof v === 'function' ? v.bind(a) : v; },
  has: (_, k) => Reflect.has(get(), k),
  ownKeys: () => Reflect.ownKeys(get()),
  getOwnPropertyDescriptor: (_, k) => { const d = Reflect.getOwnPropertyDescriptor(get(), k); return d && k !== 'length' ? { ...d, configurable: true } : d; },
});

export const MONTHS: string[] = live(months);
export const MONTHS_GENITIVE: string[] = live(monthsGenitive);
export const WEEKDAYS: string[] = live(weekdays);

export interface DateRange { from: Date | null; to: Date | null }

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const addMonths = (d: Date, n: number): Date => {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(d.getDate(), last));
  return r;
};
export const isSameDay = (a?: Date | null, b?: Date | null): boolean =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const isWeekend = (d: Date): boolean => d.getDay() === 0 || d.getDay() === 6;

/** true, если d в [from, to] (по дням, границы включительно). */
export function inRange(d: Date, from?: Date | null, to?: Date | null): boolean {
  if (!from || !to) return false;
  const t = startOfDay(d).getTime();
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return t >= Math.min(a, b) && t <= Math.max(a, b);
}

export function isDisabled(d: Date, min?: Date | null, max?: Date | null): boolean {
  const t = startOfDay(d).getTime();
  return (!!min && t < startOfDay(min).getTime()) || (!!max && t > startOfDay(max).getTime());
}

/** 6 недель × 7 дней, неделя с понедельника. */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const shift = (first.getDay() + 6) % 7;
  const start = addDays(first, -shift);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** dd.mm.yyyy (+ HH:MM при withTime) */
export function formatDate(d: Date | null | undefined, withTime = false): string {
  if (!d) return '';
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  return withTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

/** ISO yyyy-mm-dd — удобно для REST Битрикс24 и <input name> */
export function toISODate(d: Date | null | undefined): string {
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
}

/** «24 сентября 2026» / «24 сентября», если текущий год */
export function formatHuman(d: Date | null | undefined): string {
  if (!d) return '';
  const base = `${d.getDate()} ${monthsGenitive()[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** Разбирает dd.mm.yyyy[ HH:MM], d.m.yy, yyyy-mm-dd. Невалидное → null. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const s = value.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/);
  let y: number, mo: number, d: number, h = 0, mi = 0;
  if (m) {
    [y, mo, d] = [+m[1], +m[2], +m[3]];
    if (m[4]) { h = +m[4]; mi = +m[5]; }
  } else {
    m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (!m) return null;
    [d, mo, y] = [+m[1], +m[2], +m[3]];
    if (y < 100) y += 2000;
    if (m[4]) { h = +m[4]; mi = +m[5]; }
  }
  const r = new Date(y, mo - 1, d, h, mi);
  return r.getFullYear() === y && r.getMonth() === mo - 1 && r.getDate() === d && h < 24 && mi < 60 ? r : null;
}

/* ── Периоды фильтра (как «Дата создания» в main.ui.filter) ───────────── */

export type PeriodType =
  | 'any' | 'yesterday' | 'today' | 'tomorrow'
  | 'week' | 'lastWeek' | 'nextWeek'
  | 'month' | 'lastMonth' | 'nextMonth'
  | 'quarter' | 'year'
  | 'last7' | 'last30' | 'last90'
  | 'exact' | 'range';

export interface PeriodValue { type: PeriodType; from?: string; to?: string }

export const periodOptions = (): Array<{ value: PeriodType; label: string }> => [
  { value: 'any', label: t('Любая дата') },
  { value: 'yesterday', label: t('Вчера') },
  { value: 'today', label: t('Сегодня') },
  { value: 'tomorrow', label: t('Завтра') },
  { value: 'week', label: t('Текущая неделя') },
  { value: 'lastWeek', label: t('Прошлая неделя') },
  { value: 'nextWeek', label: t('Следующая неделя') },
  { value: 'month', label: t('Текущий месяц') },
  { value: 'lastMonth', label: t('Прошлый месяц') },
  { value: 'nextMonth', label: t('Следующий месяц') },
  { value: 'quarter', label: t('Текущий квартал') },
  { value: 'year', label: t('Текущий год') },
  { value: 'last7', label: t('Последние 7 дней') },
  { value: 'last30', label: t('Последние 30 дней') },
  { value: 'last90', label: t('Последние 90 дней') },
  { value: 'exact', label: t('Точная дата') },
  { value: 'range', label: t('Диапазон') },
];
export const PERIOD_OPTIONS: Array<{ value: PeriodType; label: string }> = live(periodOptions);

/** Превращает период в конкретный интервал дат (включительно). any → null. */
export function resolvePeriod(p: PeriodValue | null | undefined, now = new Date()): DateRange | null {
  if (!p || p.type === 'any') return null;
  const today = startOfDay(now);
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const monthStart = (offset: number) => new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const monthEnd = (offset: number) => new Date(today.getFullYear(), today.getMonth() + offset + 1, 0);
  switch (p.type) {
    case 'yesterday': return { from: addDays(today, -1), to: addDays(today, -1) };
    case 'today': return { from: today, to: today };
    case 'tomorrow': return { from: addDays(today, 1), to: addDays(today, 1) };
    case 'week': return { from: monday, to: addDays(monday, 6) };
    case 'lastWeek': return { from: addDays(monday, -7), to: addDays(monday, -1) };
    case 'nextWeek': return { from: addDays(monday, 7), to: addDays(monday, 13) };
    case 'month': return { from: monthStart(0), to: monthEnd(0) };
    case 'lastMonth': return { from: monthStart(-1), to: monthEnd(-1) };
    case 'nextMonth': return { from: monthStart(1), to: monthEnd(1) };
    case 'quarter': {
      const q = Math.floor(today.getMonth() / 3) * 3;
      return { from: new Date(today.getFullYear(), q, 1), to: new Date(today.getFullYear(), q + 3, 0) };
    }
    case 'year': return { from: new Date(today.getFullYear(), 0, 1), to: new Date(today.getFullYear(), 11, 31) };
    case 'last7': return { from: addDays(today, -6), to: today };
    case 'last30': return { from: addDays(today, -29), to: today };
    case 'last90': return { from: addDays(today, -89), to: today };
    case 'exact': {
      const d = parseDate(p.from);
      return d ? { from: startOfDay(d), to: startOfDay(d) } : null;
    }
    case 'range': {
      const from = parseDate(p.from);
      const to = parseDate(p.to);
      return from || to ? { from: from && startOfDay(from), to: to && startOfDay(to) } : null;
    }
  }
}

/** Подпись периода для чипа фильтра: «Текущий месяц», «24.09.2026», «01.09.2026 – 30.09.2026». */
export function periodLabel(p: PeriodValue | null | undefined): string {
  if (!p || p.type === 'any') return '';
  if (p.type === 'exact') return p.from ?? '';
  if (p.type === 'range') return [p.from || '…', p.to || '…'].join(' – ');
  return periodOptions().find((o) => o.value === p.type)?.label ?? '';
}

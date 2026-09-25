/**
 * Модель фильтра (без DOM): поля, значения, пресеты, подписи чипов,
 * конвертация в filter для REST Битрикс24 (crm.deal.list и т.п.).
 */
import { periodLabel, resolvePeriod, toISODate, type PeriodValue } from './date';

export type FilterFieldType = 'text' | 'number' | 'select' | 'multiselect' | 'date' | 'checkbox';

export interface FilterOption { value: string; label: string }

export interface FilterField {
  id: string;
  label: string;
  type: FilterFieldType;
  options?: FilterOption[];
  placeholder?: string;
  /** поле REST Битрикс24 для toBitrixFilter (по умолчанию id) */
  b24Field?: string;
  /** показывать в попапе по умолчанию; остальные — через «Добавить поле» */
  default?: boolean;
}

export interface NumberRange { from?: string; to?: string }
export type FilterValue = string | string[] | NumberRange | PeriodValue | undefined;
export type FilterValues = Record<string, FilterValue>;

export interface FilterPreset {
  id: string;
  name: string;
  values: FilterValues;
  /** системный пресет нельзя удалить */
  system?: boolean;
}

export interface FilterState {
  presetId: string | null;
  values: FilterValues;
  search: string;
}

export function isEmptyValue(field: FilterField, value: FilterValue): boolean {
  if (value == null || value === '') return true;
  switch (field.type) {
    case 'multiselect': return !(value as string[]).length;
    case 'number': { const v = value as NumberRange; return !v.from && !v.to; }
    case 'date': { const v = value as PeriodValue; return !v.type || v.type === 'any' || (v.type === 'exact' && !v.from) || (v.type === 'range' && !v.from && !v.to); }
    default: return false;
  }
}

/** Только заполненные значения. */
export function cleanValues(fields: FilterField[], values: FilterValues): FilterValues {
  const out: FilterValues = {};
  for (const f of fields) if (!isEmptyValue(f, values[f.id])) out[f.id] = values[f.id];
  return out;
}

export function countActive(fields: FilterField[], values: FilterValues): number {
  return Object.keys(cleanValues(fields, values)).length;
}

export function sameValues(fields: FilterField[], a: FilterValues, b: FilterValues): boolean {
  return JSON.stringify(cleanValues(fields, a)) === JSON.stringify(cleanValues(fields, b));
}

/** «Стадия: В работе», «Сумма: от 1000», «Дата: Текущий месяц» */
export function valueLabel(field: FilterField, value: FilterValue): string {
  const opt = (v: string) => field.options?.find((o) => o.value === v)?.label ?? v;
  switch (field.type) {
    case 'select': return opt(value as string);
    case 'multiselect': return (value as string[]).map(opt).join(', ');
    case 'number': {
      const { from, to } = value as NumberRange;
      if (from && to) return `${from} – ${to}`;
      return from ? `от ${from}` : `до ${to}`;
    }
    case 'date': return periodLabel(value as PeriodValue);
    case 'checkbox': return value === 'Y' ? 'Да' : 'Нет';
    default: return String(value);
  }
}

/** Подписи для чипов в строке поиска. */
export function chips(fields: FilterField[], state: FilterState, presets: FilterPreset[] = []): Array<{ key: string; label: string }> {
  const preset = presets.find((p) => p.id === state.presetId);
  if (preset && sameValues(fields, preset.values, state.values)) return [{ key: `preset:${preset.id}`, label: preset.name }];
  return fields
    .filter((f) => !isEmptyValue(f, state.values[f.id]))
    .map((f) => ({ key: f.id, label: `${f.label}: ${valueLabel(f, state.values[f.id])}` }));
}

/**
 * Фильтр для REST: { '%TITLE': 'abc', '=STAGE_ID': ['NEW'], '>=OPPORTUNITY': 1000, '>=DATE_CREATE': '2026-09-01', '<=DATE_CREATE': '2026-09-30T23:59:59' }
 * search кладётся в searchField (по умолчанию '%TITLE').
 */
export function toBitrixFilter(fields: FilterField[], state: FilterState, searchField = '%TITLE'): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (state.search.trim()) out[searchField] = state.search.trim();
  for (const f of fields) {
    const v = state.values[f.id];
    if (isEmptyValue(f, v)) continue;
    const key = f.b24Field ?? f.id;
    switch (f.type) {
      case 'text': out[`%${key}`] = v; break;
      case 'select': out[`=${key}`] = v; break;
      case 'multiselect': out[`@${key}`] = v; break;
      case 'checkbox': out[`=${key}`] = v; break;
      case 'number': {
        const { from, to } = v as NumberRange;
        if (from) out[`>=${key}`] = Number(String(from).replace(/\s/g, '').replace(',', '.'));
        if (to) out[`<=${key}`] = Number(String(to).replace(/\s/g, '').replace(',', '.'));
        break;
      }
      case 'date': {
        const r = resolvePeriod(v as PeriodValue);
        if (r?.from) out[`>=${key}`] = toISODate(r.from);
        if (r?.to) out[`<=${key}`] = `${toISODate(r.to)}T23:59:59`;
        break;
      }
    }
  }
  return out;
}

/** Плоские GET-параметры: filter[STAGE_ID]=NEW&filter[DATE][type]=month … (для PHP $_GET['filter']) */
export function toQuery(state: FilterState, prefix = 'filter'): URLSearchParams {
  const params = new URLSearchParams();
  if (state.presetId) params.set(`${prefix}[preset]`, state.presetId);
  if (state.search) params.set(`${prefix}[search]`, state.search);
  for (const [id, v] of Object.entries(state.values)) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => params.append(`${prefix}[${id}][]`, x));
    else if (typeof v === 'object') Object.entries(v).forEach(([k, x]) => x && params.set(`${prefix}[${id}][${k}]`, String(x)));
    else params.set(`${prefix}[${id}]`, v);
  }
  return params;
}

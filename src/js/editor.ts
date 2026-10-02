import { icon } from '../icons';
import { avatarHtml } from './avatar';
import { datepicker } from './calendar';
import { enhanceSelect } from './combobox';
import { formatDate, parseDate } from './date';
import { escapeHtml, h, html } from './dom';
import type { DialogItem, EntityDialogOptions } from './entity-dialog';
import { createTagSelector } from './tag-selector';
import { intlLocale, t } from './i18n';

export type EditorFieldType =
  | 'text' | 'textarea' | 'number' | 'money' | 'email' | 'phone' | 'url'
  | 'select' | 'multiselect' | 'date' | 'datetime' | 'boolean' | 'user' | 'users';

export interface EditorField {
  id: string;
  label: string;
  type: EditorFieldType;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  readonly?: boolean;
  hint?: string;
  placeholder?: string;
  /** для money */
  currency?: string;
  /** для user/users: откуда брать сотрудников */
  dialog?: Omit<EntityDialogOptions, 'selected' | 'onChange' | 'onClose' | 'multiple'>;
  /** своё отображение значения в режиме просмотра (HTML-строка экранируется, Node вставляется как есть) */
  format?: (value: unknown, values: EditorValues) => string | Node;
  validate?: (value: unknown, values: EditorValues) => string | null | undefined;
}

export interface EditorSection {
  id: string;
  title: string;
  fields: string[];
  columns?: 1 | 2;
}

/**
 * Значения: text/number/money/… — string; date — «dd.mm.yyyy»; datetime — «dd.mm.yyyy HH:MM»;
 * boolean — boolean; select — string; multiselect — string[]; user — DialogItem | null; users — DialogItem[].
 */
export type EditorValues = Record<string, unknown>;

export interface EntityEditorOptions {
  fields: EditorField[];
  sections: EditorSection[];
  values: EditorValues;
  /** вернуть объект ошибок { fieldId: 'текст' }, чтобы подсветить поля; throw — общая ошибка */
  onSave?: (values: EditorValues, changed: string[]) => Promise<void | Record<string, string>> | void | Record<string, string>;
  onCancel?: () => void;
  readonly?: boolean;
  emptyText?: string;
  saveText?: string;
}

export interface EntityEditorHandle {
  element: HTMLElement;
  getValues(): EditorValues;
  setValues(values: EditorValues): void;
  edit(sectionId?: string): void;
  cancel(): void;
  save(): Promise<boolean>;
  isEditing(): boolean;
  destroy(): void;
}

const isEmpty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && !v.length);

export function formatMoney(v: unknown, currency = '₽'): string {
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? `${n.toLocaleString(intlLocale(), { maximumFractionDigits: 2 })} ${currency}` : String(v);
}

function viewValue(field: EditorField, value: unknown, values: EditorValues): Node | string {
  if (field.format) return field.format(value, values);
  const esc = (s: unknown) => escapeHtml(String(s));
  switch (field.type) {
    case 'money': return formatMoney(value, field.currency);
    case 'number': return Number(value).toLocaleString(intlLocale());
    case 'email': return html(`<a href="mailto:${esc(value)}">${esc(value)}</a>`);
    case 'phone': return html(`<a href="tel:${esc(String(value).replace(/[^\d+]/g, ''))}">${esc(value)}</a>`);
    case 'url': return html(`<a href="${esc(value)}" target="_blank" rel="noopener">${esc(String(value).replace(/^https?:\/\//, ''))}</a>`);
    case 'boolean': return value ? t('Да') : t('Нет');
    case 'select': return field.options?.find((o) => o.value === value)?.label ?? String(value);
    case 'multiselect': return (value as string[]).map((v) => field.options?.find((o) => o.value === v)?.label ?? v).join(', ');
    case 'user':
    case 'users': {
      const list = (Array.isArray(value) ? value : [value]) as DialogItem[];
      const wrap = h('span', { class: 'b24-stack', style: '--b24-gap:6px' });
      for (const u of list) wrap.append(html(`<span class="b24-user">${avatarHtml(u.title, u.avatar, 'sm')}<span class="b24-user__info"><span class="b24-user__name">${esc(u.title)}</span>${u.subtitle ? `<span class="b24-user__meta">${esc(u.subtitle)}</span>` : ''}</span></span>`));
      return wrap;
    }
    default: return String(value);
  }
}

/** Карточка сущности с просмотром и редактированием по секциям (аналог BX.UI.EntityEditor). */
export function createEntityEditor(container: HTMLElement, options: EntityEditorOptions): EntityEditorHandle {
  const { fields, sections, readonly, emptyText = t('не заполнено'), saveText = t('Сохранить') } = options;
  const byId = new Map(fields.map((f) => [f.id, f]));
  let values: EditorValues = structuredClone(options.values);
  const editing = new Set<string>();
  /** читатели значений контролов текущего редактирования */
  const readers = new Map<string, () => unknown>();
  const cleanups: Array<() => void> = [];
  let errors: Record<string, string> = {};
  let saving = false;

  const root = h('div', { class: 'b24-editor' });
  const sectionsEl = h('div', { class: 'b24-editor' });
  const bar = h('div', { class: 'b24-editor-bar', hidden: true });
  const barError = h('span', { class: 'b24-editor-bar__error' });
  const saveBtn = h('button', { type: 'button', class: 'b24-btn b24-btn--success' }, saveText);
  const cancelBtn = h('button', { type: 'button', class: 'b24-btn b24-btn--link' }, t('Отменить'));
  bar.append(saveBtn, cancelBtn, barError);
  root.append(sectionsEl, bar);
  container.append(root);

  const control = (field: EditorField, value: unknown): HTMLElement => {
    const id = `b24e-${field.id}-${Math.random().toString(36).slice(2, 6)}`;
    const text = (type: string, extra: Record<string, string> = {}) => {
      const input = h('input', { id, type, class: 'b24-input', value: value == null ? '' : String(value), placeholder: field.placeholder, ...extra });
      readers.set(field.id, () => input.value.trim());
      return input;
    };
    switch (field.type) {
      case 'textarea': {
        const ta = h('textarea', { id, class: 'b24-textarea', rows: '3', placeholder: field.placeholder });
        ta.value = value == null ? '' : String(value);
        readers.set(field.id, () => ta.value.trim());
        return ta;
      }
      case 'number': return text('text', { inputmode: 'decimal' });
      case 'money': {
        const input = text('text', { inputmode: 'decimal' });
        const group = h('div', { class: 'b24-input-group' }, input, h('span', { class: 'b24-input-group__addon' }, field.currency ?? '₽'));
        return group;
      }
      case 'email': return text('email');
      case 'phone': return text('tel');
      case 'url': return text('url');
      case 'date':
      case 'datetime': {
        const input = h('input', { id, class: 'b24-input', value: value == null ? '' : String(value) });
        const group = h('div', { class: 'b24-input-group b24-datepicker' }, input, h('span', { class: 'b24-input-group__icon', 'data-b24-datepicker-toggle': true }, html(icon('calendar'))));
        const dp = datepicker(input, { withTime: field.type === 'datetime' });
        cleanups.push(() => dp.destroy());
        readers.set(field.id, () => {
          const d = parseDate(input.value);
          return d ? formatDate(d, field.type === 'datetime') : '';
        });
        return group;
      }
      case 'boolean': {
        const cb = h('input', { id, type: 'checkbox', role: 'switch', checked: !!value });
        readers.set(field.id, () => cb.checked);
        return h('label', { class: 'b24-switch' }, cb, h('span', {}, field.label));
      }
      case 'select':
      case 'multiselect': {
        const multiple = field.type === 'multiselect';
        const sel = h('select', { id, class: 'b24-select', multiple: multiple || undefined });
        if (!multiple) sel.append(h('option', { value: '' }, t('Не выбрано')));
        const current = new Set(multiple ? ((value as string[]) ?? []) : [String(value ?? '')]);
        for (const o of field.options ?? []) sel.append(h('option', { value: o.value, selected: current.has(o.value) }, o.label));
        const wrap = h('div', {}, sel);
        const cb = enhanceSelect(sel);
        cleanups.push(() => cb.destroy());
        readers.set(field.id, () => (multiple ? Array.from(sel.selectedOptions).map((o) => o.value) : sel.value));
        return wrap;
      }
      case 'user':
      case 'users': {
        const wrap = h('div', { id });
        const multiple = field.type === 'users';
        const ts = createTagSelector(wrap, {
          ...field.dialog,
          multiple,
          selected: (multiple ? (value as DialogItem[]) ?? [] : value ? [value as DialogItem] : []),
        });
        cleanups.push(() => ts.destroy());
        readers.set(field.id, () => (multiple ? ts.getSelected() : ts.getSelected()[0] ?? null));
        return wrap;
      }
      default: return text('text');
    }
  };

  const renderSection = (section: EditorSection): HTMLElement => {
    const isEditing = editing.has(section.id);
    const el = h('section', { class: `b24-editor-section${section.columns === 2 ? ' b24-editor-section--2col' : ''}${isEditing ? ' is-editing' : ''}`, 'data-section': section.id });
    const header = h('header', { class: 'b24-editor-section__header' }, h('h3', { class: 'b24-editor-section__title' }, section.title));
    if (!readonly && !isEditing) {
      const edit = h('button', { type: 'button', class: 'b24-editor-section__edit' }, t('изменить'));
      edit.addEventListener('click', () => api.edit(section.id));
      header.append(edit);
    }
    el.append(header);
    const grid = h('div', { class: 'b24-editor-section__fields' });
    for (const fid of section.fields) {
      const field = byId.get(fid);
      if (!field) continue;
      const value = values[fid];
      const fieldReadonly = readonly || field.readonly;
      const wrap = h('div', { class: `b24-editor-field${fieldReadonly ? ' is-readonly' : ''}${errors[fid] ? ' is-invalid' : ''}`, 'data-field': fid });
      const label = h('span', { class: `b24-editor-field__label${isEditing && field.required ? ' b24-editor-field__label--required' : ''}` }, field.label);
      if (field.hint) label.append(h('span', { class: 'b24-editor-field__hint', 'data-b24-tooltip': field.hint, tabindex: '0', 'aria-label': field.hint }, html(icon('question'))));
      if (!(isEditing && field.type === 'boolean' && !fieldReadonly)) wrap.append(label);
      if (isEditing && !fieldReadonly) {
        wrap.append(control(field, value));
      } else {
        const v = h('div', { class: `b24-editor-field__value${isEmpty(value) ? ' is-empty' : ''}` });
        const content = isEmpty(value) ? emptyText : viewValue(field, value, values);
        v.append(typeof content === 'string' ? document.createTextNode(content) : content);
        if (!fieldReadonly && !isEditing) {
          v.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('a')) return;
            api.edit(section.id);
            requestAnimationFrame(() => root.querySelector<HTMLElement>(`[data-field="${fid}"] input:not([type=hidden]), [data-field="${fid}"] textarea, [data-field="${fid}"] .b24-combobox, [data-field="${fid}"] .b24-tag-selector__add`)?.focus());
          });
        }
        wrap.append(v);
      }
      if (errors[fid]) wrap.append(h('span', { class: 'b24-editor-field__error', role: 'alert' }, errors[fid]));
      grid.append(wrap);
    }
    el.append(grid);
    return el;
  };

  const render = () => {
    cleanups.splice(0).forEach((c) => c());
    readers.clear();
    sectionsEl.textContent = '';
    for (const s of sections) sectionsEl.append(renderSection(s));
    bar.hidden = !editing.size;
    saveBtn.classList.toggle('b24-btn--loading', saving);
  };

  const collect = (): EditorValues => {
    const next = { ...values };
    readers.forEach((read, id) => { next[id] = read(); });
    return next;
  };

  const validate = (next: EditorValues): Record<string, string> => {
    const errs: Record<string, string> = {};
    for (const id of readers.keys()) {
      const f = byId.get(id)!;
      const v = next[id];
      if (f.required && isEmpty(v)) { errs[id] = t('Обязательное поле'); continue; }
      if (isEmpty(v)) continue;
      if ((f.type === 'number' || f.type === 'money') && !Number.isFinite(Number(String(v).replace(/\s/g, '').replace(',', '.')))) errs[id] = t('Введите число');
      else if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) errs[id] = t('Некорректный e-mail');
      else if ((f.type === 'date' || f.type === 'datetime') && !parseDate(String(v))) errs[id] = t('Некорректная дата');
      const custom = f.validate?.(v, next);
      if (custom) errs[id] = custom;
    }
    return errs;
  };

  const api: EntityEditorHandle = {
    element: root,
    getValues: () => structuredClone(values),
    setValues(v) { values = structuredClone(v); render(); },
    isEditing: () => editing.size > 0,
    edit(sectionId) {
      if (readonly) return;
      // сохраняем уже введённое в других секциях
      const draft = collect();
      values = draft;
      if (sectionId) editing.add(sectionId); else sections.forEach((s) => editing.add(s.id));
      render();
    },
    cancel() {
      values = structuredClone(options.values);
      editing.clear();
      errors = {};
      barError.textContent = '';
      render();
      options.onCancel?.();
    },
    async save() {
      if (saving) return false;
      const next = collect();
      errors = validate(next);
      values = next;
      barError.textContent = '';
      if (Object.keys(errors).length) { render(); root.querySelector<HTMLElement>('.is-invalid input, .is-invalid textarea, .is-invalid .b24-combobox')?.focus(); return false; }
      const changed = Object.keys(next).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(options.values[k]));
      saving = true;
      render();
      try {
        const res = await options.onSave?.(next, changed);
        if (res && Object.keys(res).length) { errors = res; return false; }
        options.values = structuredClone(next);
        editing.clear();
        errors = {};
        return true;
      } catch (err) {
        barError.textContent = (err as Error)?.message ?? t('Не удалось сохранить');
        return false;
      } finally {
        saving = false;
        render();
      }
    },
    destroy() { cleanups.splice(0).forEach((c) => c()); root.remove(); },
  };

  saveBtn.addEventListener('click', () => void api.save());
  cancelBtn.addEventListener('click', () => api.cancel());
  root.addEventListener('keydown', (e) => {
    if (!editing.size) return;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void api.save(); }
  });

  render();
  return api;
}

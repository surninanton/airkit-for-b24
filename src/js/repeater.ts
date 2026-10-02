import { icon } from '../icons';
import { createCombobox, type ComboItem, type CreateComboboxHandle } from './combobox';
import { h, html } from './dom';

/* ── Повторяющиеся строки ──────────────────────────────────
 * Список строк одного вида: добавить, удалить, пустое состояние. Содержимое строки рисует render(),
 * значения хранит сам редактор — getValues() отдаёт актуальный массив.
 */
export interface RepeaterRowContext<T> {
  readonly index: number;
  get(): T;
  /** поменять значение строки (без перерисовки — поля строки уже у вас) */
  update(patch: Partial<T>): void;
  remove(): void;
  /** элемент строки (.b24-repeater__row) — например, чтобы пометить ошибку */
  readonly row: HTMLElement;
}

export interface RepeaterOptions<T> {
  values?: T[];
  /** значение новой строки */
  create: () => T;
  /** рисует содержимое строки в body; может вернуть функцию очистки */
  render: (body: HTMLElement, value: T, ctx: RepeaterRowContext<T>) => void | (() => void);
  addLabel?: string;
  /** текст пустого состояния; null — не показывать */
  emptyText?: string | null;
  removeLabel?: string;
  /** не меньше строк (кнопка удаления прячется) */
  min?: number;
  /** не больше строк (кнопка добавления прячется) */
  max?: number;
  className?: string;
  onChange?: (values: T[]) => void;
}

export interface RepeaterHandle<T> {
  element: HTMLElement;
  getValues(): T[];
  setValues(values: T[]): void;
  add(value?: T): void;
  remove(index: number): void;
  /** строки по порядку — для подсветки ошибок */
  rows(): HTMLElement[];
  destroy(): void;
}

export function createRepeater<T>(host: HTMLElement, options: RepeaterOptions<T>): RepeaterHandle<T> {
  const o = options;
  type Row = { value: T; el: HTMLElement; cleanup?: () => void };
  let rows: Row[] = [];
  const root = h('div', { class: `b24-repeater${o.className ? ` ${o.className}` : ''}` });
  const list = h('div', { class: 'b24-repeater__list' });
  const empty = h('div', { class: 'b24-repeater__empty' }, o.emptyText ?? '');
  const add = h('button', { type: 'button', class: 'b24-repeater__add' }, html(icon('plus')), h('span', {}, o.addLabel ?? 'Добавить'));
  root.append(list, empty, add);
  host.append(root);

  const emit = () => o.onChange?.(rows.map((r) => r.value));
  const sync = () => {
    empty.hidden = rows.length > 0 || o.emptyText === null || !o.emptyText;
    add.hidden = o.max != null && rows.length >= o.max;
    const canRemove = o.min == null || rows.length > o.min;
    rows.forEach((r) => { (r.el.querySelector(':scope > .b24-repeater__remove') as HTMLElement).hidden = !canRemove; });
  };

  const build = (value: T): Row => {
    const el = h('div', { class: 'b24-repeater__row' });
    const body = h('div', { class: 'b24-repeater__body' });
    const del = h('button', { type: 'button', class: 'b24-repeater__remove', 'aria-label': o.removeLabel ?? 'Удалить строку', title: o.removeLabel ?? 'Удалить' }, html(icon('trash')));
    el.append(body, del);
    const row: Row = { value, el };
    const ctx: RepeaterRowContext<T> = {
      get index() { return rows.indexOf(row); },
      get: () => row.value,
      update(patch) {
        row.value = (typeof row.value === 'object' && row.value !== null ? { ...row.value, ...patch } : patch) as T;
        emit();
      },
      remove: () => removeRow(row),
      row: el,
    };
    del.addEventListener('click', () => removeRow(row));
    const c = o.render(body, value, ctx);
    if (typeof c === 'function') row.cleanup = c;
    return row;
  };

  const removeRow = (row: Row) => {
    const i = rows.indexOf(row);
    if (i < 0) return;
    row.cleanup?.();
    row.el.remove();
    rows.splice(i, 1);
    sync();
    emit();
    // фокус — на соседнюю строку или кнопку «Добавить», чтобы не потерять его с клавиатуры
    const next = rows[i] ?? rows[i - 1];
    (next?.el.querySelector<HTMLElement>('input, select, textarea, [tabindex="0"], button') ?? add).focus();
  };

  const setValues = (values: T[]) => {
    rows.forEach((r) => { r.cleanup?.(); r.el.remove(); });
    rows = values.map(build);
    list.append(...rows.map((r) => r.el));
    sync();
  };
  const addRow = (value?: T, focus = true) => {
    const row = build(value ?? o.create());
    rows.push(row);
    list.append(row.el);
    sync();
    emit();
    if (focus) row.el.querySelector<HTMLElement>('input, select, textarea, [tabindex="0"]')?.focus();
  };
  add.addEventListener('click', () => addRow());
  setValues(o.values ?? []);

  return {
    element: root,
    getValues: () => rows.map((r) => r.value),
    setValues,
    add: (v) => addRow(v),
    remove: (i) => { if (rows[i]) removeRow(rows[i]); },
    rows: () => rows.map((r) => r.el),
    destroy() { rows.forEach((r) => r.cleanup?.()); root.remove(); },
  };
}

/* ── Повторитель для серверных форм ─────────────────────────
 * [data-b24-repeater] > .b24-repeater__list (строки из сервера) + <template> строки + [data-b24-repeater-add];
 * в строке [data-b24-repeater-remove]. Имена полей вида rows[__i__][key] / rows[0][key] перенумеровываются
 * по порядку — сервер получает плотный массив. Без JS видны строки, пришедшие с сервера.
 */
export function initRepeater(root: HTMLElement): () => void {
  const list = root.querySelector<HTMLElement>('.b24-repeater__list') ?? root;
  const tpl = root.querySelector<HTMLTemplateElement>('template');
  const addBtn = root.querySelector<HTMLElement>('[data-b24-repeater-add]');
  const empty = root.querySelector<HTMLElement>('.b24-repeater__empty');
  const max = Number(root.dataset.max) || Infinity;
  const rows = () => Array.from(list.querySelectorAll<HTMLElement>(':scope > .b24-repeater__row'));
  const renumber = () => {
    rows().forEach((row, i) => {
      row.querySelectorAll<HTMLElement>('[name], [id], [for]').forEach((el) => {
        // name: первый индекс в скобках rows[0][key]; id/for: сегмент -0- (в шаблоне — row-__i__-key)
        const name = el.getAttribute('name');
        if (name) el.setAttribute('name', name.replace(/\[(?:__i__|\d+)\]/, `[${i}]`));
        for (const attr of ['id', 'for']) {
          const v = el.getAttribute(attr);
          if (v) el.setAttribute(attr, v.replace(/__i__|-\d+-/, (m) => (m === '__i__' ? `${i}` : `-${i}-`)));
        }
      });
    });
    if (empty) empty.hidden = rows().length > 0;
    if (addBtn) addBtn.hidden = rows().length >= max;
    root.dispatchEvent(new CustomEvent('b24:repeater-change', { bubbles: true, detail: { count: rows().length } }));
  };
  const onClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (tpl && t.closest('[data-b24-repeater-add]') === addBtn) {
      e.preventDefault();
      const frag = tpl.content.cloneNode(true) as DocumentFragment;
      const row = frag.querySelector<HTMLElement>('.b24-repeater__row');
      list.append(frag);
      renumber();
      row?.querySelector<HTMLElement>('input, select, textarea')?.focus();
      return;
    }
    const rm = t.closest('[data-b24-repeater-remove]');
    if (rm && root.contains(rm)) {
      e.preventDefault();
      const row = rm.closest<HTMLElement>('.b24-repeater__row');
      const i = rows().indexOf(row!);
      row?.remove();
      renumber();
      (rows()[i] ?? rows()[i - 1])?.querySelector<HTMLElement>('input, select, textarea')?.focus() ?? addBtn?.focus();
    }
  };
  root.addEventListener('click', onClick);
  root.classList.add('is-enhanced');
  renumber();
  return () => { root.removeEventListener('click', onClick); root.classList.remove('is-enhanced'); };
}

/* ── Редактор «ключ → значение» ────────────────────────────
 * Пары со стрелкой между полями. Поле — текстовое или выпадающий список (items); у списка по умолчанию
 * можно ввести своё значение. Если справочника нет (items: null) — поле становится текстовым.
 */
export interface KeyValueField {
  placeholder?: string;
  /** варианты; null/undefined — свободный ввод */
  items?: ComboItem[] | null;
  /** у списка — разрешить значение не из списка (по умолчанию да) */
  creatable?: boolean;
  groupBy?: (item: ComboItem) => string | undefined;
  type?: 'text' | 'number';
  /** заголовок колонки */
  label?: string;
}

export interface KeyValuePair { key: string; value: string }

export interface KeyValueOptions {
  pairs?: KeyValuePair[];
  key?: KeyValueField;
  value?: KeyValueField;
  addLabel?: string;
  emptyText?: string | null;
  /** имя скрытого поля формы — пары уходят JSON-массивом */
  name?: string;
  size?: 'sm' | 'md';
  max?: number;
  onChange?: (pairs: KeyValuePair[]) => void;
}

export interface KeyValueHandle {
  element: HTMLElement;
  getPairs(): KeyValuePair[];
  setPairs(pairs: KeyValuePair[]): void;
  /** сменить справочник колонки (например, после загрузки) — существующие значения сохраняются */
  setItems(side: 'key' | 'value', items: ComboItem[] | null): void;
  destroy(): void;
}

/** Поле значения: список, если есть варианты, иначе input. Используется и в редакторе сопоставления. */
export function valueField(host: HTMLElement, f: KeyValueField, value: string, onChange: (v: string) => void, opts: { size?: 'sm' | 'md'; ariaLabel?: string } = {}): { destroy(): void; setValue(v: string): void } {
  if (f.items) {
    const c: CreateComboboxHandle = createCombobox(host, {
      items: f.items, value, placeholder: f.placeholder, creatable: f.creatable ?? true, groupBy: f.groupBy, size: opts.size, ariaLabel: opts.ariaLabel ?? f.label,
      onChange: (v) => onChange((v as string | null) ?? ''),
    });
    return { destroy: () => c.destroy(), setValue: (v) => c.setValue(v) };
  }
  const input = h('input', {
    class: `b24-input${opts.size === 'sm' ? ' b24-input--sm' : ''}`, type: f.type ?? 'text', placeholder: f.placeholder, 'aria-label': opts.ariaLabel ?? f.label,
  }) as HTMLInputElement;
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));
  host.append(input);
  return { destroy: () => input.remove(), setValue: (v) => { input.value = v; } };
}

export function createKeyValue(host: HTMLElement, options: KeyValueOptions): KeyValueHandle {
  const o = { ...options, key: { ...options.key }, value: { ...options.value } };
  const root = h('div', { class: 'b24-kv' });
  host.append(root);
  const hidden = o.name ? h('input', { type: 'hidden', name: o.name }) as HTMLInputElement : null;
  if (hidden) root.append(hidden);
  if (o.key.label || o.value.label) {
    root.append(h('div', { class: 'b24-kv__head', 'aria-hidden': 'true' }, h('span', {}, o.key.label ?? ''), h('span', {}), h('span', {}, o.value.label ?? '')));
  }
  const sync = (pairs: KeyValuePair[]) => {
    if (hidden) hidden.value = JSON.stringify(pairs);
    o.onChange?.(pairs);
  };
  const rep = createRepeater<KeyValuePair>(root, {
    values: o.pairs ?? [],
    create: () => ({ key: '', value: '' }),
    addLabel: o.addLabel ?? 'Добавить',
    emptyText: o.emptyText === undefined ? 'Пока ничего не добавлено' : o.emptyText,
    max: o.max,
    className: 'b24-kv__rows',
    onChange: sync,
    render(body, pair, ctx) {
      body.classList.add('b24-kv__row');
      const k = h('div', { class: 'b24-kv__cell' });
      const v = h('div', { class: 'b24-kv__cell' });
      body.append(k, h('span', { class: 'b24-kv__arrow', 'aria-hidden': 'true' }, html(icon('arrowRight'))), v);
      const fk = valueField(k, o.key, pair.key, (key) => ctx.update({ key }), { size: o.size, ariaLabel: o.key.label ?? 'Ключ' });
      const fv = valueField(v, o.value, pair.value, (value) => ctx.update({ value }), { size: o.size, ariaLabel: o.value.label ?? 'Значение' });
      return () => { fk.destroy(); fv.destroy(); };
    },
  });
  if (hidden) hidden.value = JSON.stringify(rep.getValues());

  return {
    element: root,
    getPairs: () => rep.getValues(),
    setPairs: (pairs) => { rep.setValues(pairs); if (hidden) hidden.value = JSON.stringify(pairs); },
    setItems(side, items) { o[side] = { ...o[side], items }; rep.setValues(rep.getValues()); },
    destroy: () => { rep.destroy(); root.remove(); },
  };
}

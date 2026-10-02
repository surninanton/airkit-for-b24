import { icon } from '../icons';
import { h, html } from './dom';
import { isCreatedItem, openEntityDialog, type DialogItem, type EntityDialogHandle } from './entity-dialog';

export interface ComboboxOptions {
  /** поиск в списке; по умолчанию — если вариантов больше 7 */
  searchable?: boolean;
  placeholder?: string;
  size?: 'sm' | 'md';
  /** свободный ввод значения не из списка (data-creatable) — добавляется новым <option> */
  creatable?: boolean;
  /** счётчик «N из M» в списке (data-counter) */
  counter?: boolean;
}

export interface ComboboxHandle {
  element: HTMLElement;
  refresh(): void;
  destroy(): void;
}

/**
 * Превращает нативный <select> (single/multiple) в поле с поиском и тегами.
 * Сам <select> остаётся в форме и хранит значение — удобно для PHP.
 */
export function enhanceSelect(select: HTMLSelectElement, options: ComboboxOptions = {}): ComboboxHandle {
  const multiple = select.multiple;
  const placeholderOpt = Array.from(select.options).find((o) => o.value === '');
  const placeholder = options.placeholder ?? select.dataset.placeholder ?? placeholderOpt?.text ?? 'Не выбрано';
  const trigger = h('div', {
    class: `b24-combobox${options.size === 'sm' || select.classList.contains('b24-select--sm') ? ' b24-combobox--sm' : ''}`,
    role: 'combobox',
    tabindex: select.disabled ? '-1' : '0',
    'aria-haspopup': 'listbox',
    'aria-expanded': 'false',
    'aria-disabled': select.disabled ? 'true' : undefined,
    'aria-invalid': select.getAttribute('aria-invalid') ?? undefined,
  });
  const label = select.id ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(select.id)}"]`) : null;
  if (label) {
    label.id ||= `${select.id}-label`;
    trigger.setAttribute('aria-labelledby', label.id);
    label.addEventListener('click', (e) => { e.preventDefault(); trigger.focus(); });
  }
  select.hidden = true;
  select.after(trigger);

  let dialog: EntityDialogHandle | null = null;

  const items = (): DialogItem[] => {
    const out: DialogItem[] = [];
    for (const opt of Array.from(select.options)) {
      if (opt.value === '' && opt === placeholderOpt) continue;
      out.push({
        id: opt.value,
        title: opt.text,
        subtitle: opt.dataset.subtitle,
        avatar: opt.dataset.avatar,
        disabled: opt.disabled,
        group: opt.parentElement instanceof HTMLOptGroupElement ? opt.parentElement.label : undefined,
      });
    }
    return out;
  };
  const selectedItems = () => items().filter((i) => Array.from(select.selectedOptions).some((o) => o.value === i.id && o.value !== ''));

  const render = () => {
    trigger.textContent = '';
    const sel = selectedItems();
    if (!sel.length) {
      trigger.append(h('span', { class: 'b24-combobox__placeholder' }, placeholder));
    } else if (!multiple) {
      trigger.append(h('span', { class: 'b24-combobox__value' }, sel[0].title));
    } else {
      for (const item of sel) {
        const remove = h('button', { type: 'button', class: 'b24-tag__remove', 'aria-label': `Убрать ${item.title}`, tabindex: '-1' }, html(icon('close')));
        remove.addEventListener('click', (e) => {
          e.stopPropagation();
          const opt = Array.from(select.options).find((o) => o.value === item.id);
          if (opt) opt.selected = false;
          emit();
        });
        trigger.append(h('span', { class: 'b24-tag' }, h('span', { class: 'b24-tag__text' }, item.title), remove));
      }
    }
  };

  const emit = () => {
    render();
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const open = () => {
    if (dialog || select.disabled) return;
    const list = items();
    const creatable = options.creatable ?? select.dataset.creatable !== undefined;
    trigger.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    dialog = openEntityDialog(trigger, {
      items: list,
      multiple,
      selected: selectedItems(),
      // свободный ввод без поля поиска невозможен — со свободным вводом поиск всегда есть
      searchable: options.searchable ?? (select.dataset.search !== undefined ? select.dataset.search !== 'false' : creatable || list.length > 7),
      avatars: list.some((i) => i.avatar),
      compact: true,
      creatable,
      counter: options.counter ?? select.dataset.counter !== undefined,
      width: Math.max(trigger.offsetWidth, 220),
      onChange(sel) {
        // свободный ввод: заводим <option>, чтобы значение ушло с формой
        for (const item of sel) {
          if (isCreatedItem(item) && !Array.from(select.options).some((o) => o.value === String(item.id))) {
            const opt = new Option(item.title, String(item.id));
            opt.dataset.created = '1';
            select.add(opt);
          }
        }
        const keys = new Set(sel.map((i) => String(i.id)));
        for (const opt of Array.from(select.options)) opt.selected = keys.has(opt.value);
        if (!multiple && !sel.length && placeholderOpt) placeholderOpt.selected = true;
        emit();
      },
      onClose() {
        dialog = null;
        trigger.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      },
    });
  };

  trigger.addEventListener('click', () => (dialog ? dialog.close() : open()));
  trigger.addEventListener('keydown', (e) => {
    if (['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); open(); }
    if (e.key === 'Backspace' && multiple) {
      const last = selectedItems().pop();
      const opt = last && Array.from(select.options).find((o) => o.value === last.id);
      if (opt) { opt.selected = false; emit(); }
    }
  });
  const onExternalChange = () => render();
  select.addEventListener('change', onExternalChange);
  const mo = new MutationObserver(render);
  mo.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });

  render();
  return {
    element: trigger,
    refresh: render,
    destroy() {
      dialog?.close();
      mo.disconnect();
      select.removeEventListener('change', onExternalChange);
      trigger.remove();
      select.hidden = false;
    },
  };
}

/* ── Combobox без <select> ─────────────────────────────────
 * Для форм, которые собираются в JS (редактор сопоставления полей, Vue/React-обёртки).
 * Значение — строка (или массив при multiple). Значение не из списка («сырое») показывается как есть
 * с пометкой «не из списка» и сохраняется — например, когда справочник не загрузился.
 */
export interface ComboItem {
  value: string;
  label: string;
  /** вторая строка: код поля, e-mail; по ней тоже ищется */
  subtitle?: string;
  group?: string;
  avatar?: string;
  disabled?: boolean;
}

export interface CreateComboboxOptions {
  items: ComboItem[];
  value?: string | string[] | null;
  multiple?: boolean;
  placeholder?: string;
  /** поиск; по умолчанию — если вариантов больше 7 */
  searchable?: boolean;
  /** свободный ввод значения не из списка */
  creatable?: boolean;
  createLabel?: (query: string) => string;
  /** счётчик «N из M» внизу списка; по умолчанию — если вариантов больше 20 */
  counter?: boolean;
  /** группа по пункту, если не задана в item.group: например, item => item.value.startsWith('UF_') ? 'Пользовательские' : 'Системные' */
  groupBy?: (item: ComboItem) => string | undefined;
  size?: 'sm' | 'md';
  disabled?: boolean;
  invalid?: boolean;
  /** имя скрытого поля формы (при multiple — значения через запятую) */
  name?: string;
  id?: string;
  ariaLabel?: string;
  emptyText?: string;
  /** ширина списка, px; по умолчанию — по полю, не уже 260 */
  dialogWidth?: number;
  onChange?: (value: string | string[] | null, items: ComboItem[]) => void;
}

export interface CreateComboboxHandle {
  element: HTMLElement;
  getValue(): string | string[] | null;
  setValue(value: string | string[] | null): void;
  setItems(items: ComboItem[]): void;
  setDisabled(disabled: boolean): void;
  setInvalid(invalid: boolean): void;
  open(): void;
  destroy(): void;
}

export function createCombobox(host: HTMLElement, options: CreateComboboxOptions): CreateComboboxHandle {
  const o = { ...options };
  let items = o.items;
  let values: string[] = toList(o.value);
  let dialog: EntityDialogHandle | null = null;
  const trigger = h('div', {
    class: `b24-combobox${o.size === 'sm' ? ' b24-combobox--sm' : ''}`,
    role: 'combobox', tabindex: o.disabled ? '-1' : '0', 'aria-haspopup': 'listbox', 'aria-expanded': 'false',
    id: o.id, 'aria-label': o.ariaLabel,
  });
  const hidden = o.name ? h('input', { type: 'hidden', name: o.name }) as HTMLInputElement : null;
  host.append(trigger);
  if (hidden) host.append(hidden);

  const byValue = (v: string) => items.find((i) => i.value === v);
  const label = (v: string) => byValue(v)?.label ?? v;
  const toDialog = (i: ComboItem): DialogItem => ({ id: i.value, title: i.label, subtitle: i.subtitle, group: i.group ?? o.groupBy?.(i), avatar: i.avatar, disabled: i.disabled });
  const selectedDialog = (): DialogItem[] => values.map((v) => (byValue(v) ? toDialog(byValue(v)!) : { id: v, title: v }));
  const out = () => (o.multiple ? [...values] : values[0] ?? null);

  const render = () => {
    trigger.textContent = '';
    trigger.setAttribute('aria-disabled', o.disabled ? 'true' : 'false');
    trigger.tabIndex = o.disabled ? -1 : 0;
    if (o.invalid) trigger.setAttribute('aria-invalid', 'true'); else trigger.removeAttribute('aria-invalid');
    if (hidden) hidden.value = values.join(',');
    if (!values.length) { trigger.append(h('span', { class: 'b24-combobox__placeholder' }, o.placeholder ?? 'Не выбрано')); return; }
    if (!o.multiple) {
      const v = values[0];
      const raw = !byValue(v);
      const val = h('span', { class: `b24-combobox__value${raw ? ' is-raw' : ''}` }, label(v));
      trigger.append(val);
      const sub = byValue(v)?.subtitle;
      if (sub) trigger.append(h('span', { class: 'b24-combobox__code' }, sub));
      if (raw) trigger.append(h('span', { class: 'b24-combobox__raw', title: 'Значения нет в справочнике — сохранится как введено' }, 'не из списка'));
      return;
    }
    for (const v of values) {
      const remove = h('button', { type: 'button', class: 'b24-tag__remove', 'aria-label': `Убрать ${label(v)}`, tabindex: '-1' }, html(icon('close')));
      remove.addEventListener('click', (e) => { e.stopPropagation(); values = values.filter((x) => x !== v); emit(); });
      trigger.append(h('span', { class: `b24-tag${byValue(v) ? '' : ' is-raw'}` }, h('span', { class: 'b24-tag__text' }, label(v)), remove));
    }
  };
  const emit = () => {
    render();
    o.onChange?.(out(), values.map((v) => byValue(v) ?? { value: v, label: v }));
    trigger.dispatchEvent(new CustomEvent('b24:combobox-change', { bubbles: true, detail: { value: out() } }));
  };

  const open = () => {
    if (dialog || o.disabled) return;
    trigger.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    dialog = openEntityDialog(trigger, {
      items: items.map(toDialog),
      multiple: o.multiple,
      selected: selectedDialog(),
      searchable: o.searchable ?? (o.creatable || items.length > 7),
      creatable: o.creatable,
      createLabel: o.createLabel,
      counter: o.counter ?? items.length > 20,
      emptyText: o.emptyText,
      avatars: items.some((i) => i.avatar),
      compact: true,
      width: o.dialogWidth ?? Math.max(trigger.offsetWidth, 260),
      onChange(sel) { values = sel.map((i) => String(i.id)); emit(); },
      onClose() { dialog = null; trigger.classList.remove('is-open'); trigger.setAttribute('aria-expanded', 'false'); },
    });
  };
  const onClick = () => (dialog ? dialog.close() : open());
  const onKey = (e: KeyboardEvent) => {
    if (['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); open(); }
    if (e.key === 'Backspace' && o.multiple && values.length) { values = values.slice(0, -1); emit(); }
  };
  trigger.addEventListener('click', onClick);
  trigger.addEventListener('keydown', onKey);
  render();

  return {
    element: trigger,
    getValue: out,
    setValue(v) { values = toList(v); dialog?.setSelected(selectedDialog()); render(); },
    setItems(next) { items = next; render(); },
    setDisabled(d) { o.disabled = d; if (d) dialog?.close(); render(); },
    setInvalid(i) { o.invalid = i; render(); },
    open,
    destroy() { dialog?.close(); trigger.remove(); hidden?.remove(); },
  };
}

function toList(v: string | string[] | null | undefined): string[] {
  if (v == null || v === '') return [];
  return Array.isArray(v) ? v.filter((x) => x !== '') : [v];
}

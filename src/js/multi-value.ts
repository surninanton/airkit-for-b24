import { icon } from '../icons';
import { h, html } from './dom';
import { openEntityDialog, type EntityDialogHandle } from './entity-dialog';
import { parseTime, timepicker, type TimePickerHandle } from './timepicker';

/**
 * Поле из нескольких значений на тегах: «09:00 ✕  14:30 ✕  + Добавить».
 *   <div data-b24-multi data-type="time" data-name="times[]" data-max="6" data-step="15" data-values="09:00,14:30"></div>
 * Значения уходят с формой скрытыми полями name[]; событие b24:multi-change { values }.
 */

export interface MultiValueOptions {
  type?: 'time' | 'select';
  /** для select: варианты */
  options?: Array<{ value: string; label: string }>;
  values?: string[];
  /** максимум значений: после него «+» скрыт, показывается «не больше N» */
  max?: number;
  /** не добавлять дубли (по умолчанию true) */
  unique?: boolean;
  /** сортировать: для time по умолчанию true (по времени), для select — по порядку options */
  sort?: boolean;
  /** имя скрытых полей: «times» → times[] */
  name?: string;
  addLabel?: string;
  placeholder?: string;
  /** для time: шаг, min, max (HH:MM) */
  step?: number;
  minTime?: string;
  maxTime?: string;
  disabled?: boolean;
  onChange?: (values: string[]) => void;
}

export interface MultiValueHandle {
  element: HTMLElement;
  getValues(): string[];
  setValues(values: string[], emit?: boolean): void;
  add(value: string): boolean;
  remove(value: string): void;
  destroy(): void;
}

export function multiValue(container: HTMLElement, options: MultiValueOptions = {}): MultiValueHandle {
  const type = options.type ?? 'time';
  const unique = options.unique !== false;
  const sortValues = options.sort ?? (type === 'time');
  const max = options.max && options.max > 0 ? options.max : Infinity;
  const addLabel = options.addLabel ?? 'Добавить';
  const opts = options.options ?? [];
  const labelOf = (v: string) => (type === 'select' ? opts.find((o) => o.value === v)?.label ?? v : v);
  const inputName = options.name ? (options.name.endsWith('[]') ? options.name : `${options.name}[]`) : null;

  let values: string[] = [];
  let editor: HTMLInputElement | null = null;
  let tp: TimePickerHandle | null = null;
  let dialog: EntityDialogHandle | null = null;

  const root = h('div', { class: `b24-multi${options.disabled ? ' is-disabled' : ''}`, role: 'group' });
  const hidden = h('span', { hidden: true });
  container.append(root, hidden);

  const normalizeValue = (v: string): string | null => {
    if (type === 'time') {
      const t = parseTime(v);
      return t == null ? null : `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    }
    const s = String(v);
    return opts.length && !opts.some((o) => o.value === s) ? null : s;
  };

  const order = (list: string[]) => {
    if (!sortValues) return list;
    if (type === 'time') return [...list].sort((a, b) => (parseTime(a) ?? 0) - (parseTime(b) ?? 0));
    const idx = (v: string) => { const i = opts.findIndex((o) => o.value === v); return i < 0 ? Infinity : i; };
    return [...list].sort((a, b) => idx(a) - idx(b));
  };

  const emit = () => {
    options.onChange?.([...values]);
    root.dispatchEvent(new CustomEvent('b24:multi-change', { detail: { values: [...values] }, bubbles: true }));
  };

  const syncHidden = () => {
    if (!inputName) return;
    hidden.textContent = '';
    for (const v of values) hidden.append(h('input', { type: 'hidden', name: inputName, value: v }));
  };

  function closeEditor() {
    tp?.destroy();
    tp = null;
    editor = null;
    dialog?.close();
    dialog = null;
  }

  function render(focusAdd = false) {
    const hadEditor = !!editor;
    closeEditor();
    root.textContent = '';
    values.forEach((v, i) => {
      const label = labelOf(v);
      const chip = h('span', { class: 'b24-tag b24-multi__chip', tabindex: '0', 'data-index': String(i), title: label });
      chip.append(h('span', { class: 'b24-tag__text' }, label));
      if (!options.disabled) {
        const del = h('button', { type: 'button', class: 'b24-tag__remove', tabindex: '-1', 'aria-label': `Удалить ${label}` }, html(icon('close')));
        del.addEventListener('click', (e) => { e.stopPropagation(); removeAt(i); });
        chip.append(del);
      }
      root.append(chip);
    });
    if (!options.disabled) {
      if (values.length < max) {
        const add = h('button', { type: 'button', class: 'b24-tag-selector__add b24-multi__add' }, html(icon('plus', { size: 14 })), h('span', {}, addLabel));
        add.addEventListener('click', (e) => { e.stopPropagation(); openEditor(add); });
        root.append(add);
        if (focusAdd || hadEditor) requestAnimationFrame(() => add.focus());
      } else if (Number.isFinite(max)) {
        root.append(h('span', { class: 'b24-multi__limit' }, `не больше ${max}`));
      }
    }
    syncHidden();
  }

  function add(raw: string): boolean {
    const v = normalizeValue(raw);
    if (v == null || values.length >= max) return false;
    if (unique && values.includes(v)) return false;
    values = order([...values, v]);
    return true;
  }

  function removeAt(i: number) {
    values = values.filter((_, idx) => idx !== i);
    render();
    const chips = root.querySelectorAll<HTMLElement>('.b24-multi__chip');
    (chips[Math.min(i, chips.length - 1)] ?? root.querySelector<HTMLElement>('.b24-multi__add'))?.focus();
    emit();
  }

  function openEditor(addBtn: HTMLElement) {
    if (type === 'select') {
      const available = opts.filter((o) => !unique || !values.includes(o.value));
      dialog = openEntityDialog(addBtn, {
        items: available.map((o) => ({ id: o.value, title: o.label })),
        searchable: available.length > 7,
        avatars: false,
        compact: true,
        emptyText: 'Все варианты уже выбраны',
        onChange: (sel) => {
          const v = sel[0] ? String(sel[0].id) : null;
          if (v != null && add(v)) { render(true); emit(); }
        },
        onClose: () => { dialog = null; },
      });
      return;
    }
    // time: поле-редактор на месте «+»
    const input = h('input', { class: 'b24-input b24-input--sm b24-multi__editor', 'aria-label': 'Новое время', placeholder: options.placeholder ?? 'чч:мм' });
    addBtn.replaceWith(input);
    editor = input;
    let done = false;
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      const added = value ? add(value) : false;
      render(true);
      if (added) emit();
    };
    tp = timepicker(input, {
      step: options.step,
      min: options.minTime,
      max: options.maxTime,
      // клик по минутам в попапе = значение готово
      onSelect: (v) => finish(v),
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); finish(input.value); }
      else if (e.key === 'Escape') { e.stopPropagation(); finish(null); }
      else if (e.key === 'Backspace' && input.value === '' && values.length) {
        e.preventDefault();
        values = values.slice(0, -1);
        emit();
        syncHidden();
        // перерисовать чипы, не закрывая редактор
        root.querySelectorAll('.b24-multi__chip').forEach((c, i) => { if (i === values.length) c.remove(); });
      }
    });
    input.addEventListener('blur', () => setTimeout(() => { if (!done && document.activeElement !== input) finish(input.value || null); }, 0));
    input.focus();
  }

  // клавиатура на чипах: Delete/Backspace — удалить, стрелки — навигация
  root.addEventListener('keydown', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.b24-multi__chip');
    if (!chip || options.disabled) return;
    const i = Number(chip.dataset.index);
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeAt(i); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const items = Array.from(root.querySelectorAll<HTMLElement>('.b24-multi__chip, .b24-multi__add'));
      items[Math.max(0, Math.min(items.length - 1, items.indexOf(chip) + (e.key === 'ArrowRight' ? 1 : -1)))]?.focus();
    }
  });
  root.addEventListener('click', (e) => {
    if (e.target === root && !editor && !dialog) root.querySelector<HTMLElement>('.b24-multi__add')?.click();
  });

  for (const v of options.values ?? []) add(v);
  render();

  return {
    element: root,
    getValues: () => [...values],
    setValues(next, doEmit = false) {
      values = [];
      next.forEach((v) => add(v));
      render();
      if (doEmit) emit();
    },
    add(v) { const ok = add(v); if (ok) { render(); emit(); } return ok; },
    remove(v) { const i = values.indexOf(v); if (i >= 0) removeAt(i); },
    destroy() { closeEditor(); root.remove(); hidden.remove(); },
  };
}

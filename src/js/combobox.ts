import { icon } from '../icons';
import { h, html } from './dom';
import { openEntityDialog, type DialogItem, type EntityDialogHandle } from './entity-dialog';

export interface ComboboxOptions {
  /** поиск в списке; по умолчанию — если вариантов больше 7 */
  searchable?: boolean;
  placeholder?: string;
  size?: 'sm' | 'md';
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
    trigger.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    dialog = openEntityDialog(trigger, {
      items: list,
      multiple,
      selected: selectedItems(),
      searchable: options.searchable ?? (select.dataset.search !== undefined ? select.dataset.search !== 'false' : list.length > 7),
      avatars: list.some((i) => i.avatar),
      compact: true,
      width: Math.max(trigger.offsetWidth, 220),
      onChange(sel) {
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

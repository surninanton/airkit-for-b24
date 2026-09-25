import { icon } from '../icons';
import { avatarHtml } from './avatar';
import { h, html } from './dom';
import { itemKey, openEntityDialog, type DialogItem, type EntityDialogHandle, type EntityDialogOptions } from './entity-dialog';

export interface TagSelectorOptions extends Omit<EntityDialogOptions, 'selected' | 'onChange' | 'onClose'> {
  selected?: DialogItem[];
  /** имя для скрытых input — значения уходят вместе с формой (name[] для multiple) */
  name?: string;
  /** что писать в value скрытых полей: id или «entityId:id» */
  valueFormat?: 'id' | 'key';
  addLabel?: string;
  changeLabel?: string;
  /** без рамки (как в карточке CRM) */
  plain?: boolean;
  readonly?: boolean;
  onChange?: (selected: DialogItem[]) => void;
}

export interface TagSelectorHandle {
  element: HTMLElement;
  getSelected(): DialogItem[];
  setSelected(items: DialogItem[]): void;
  open(): void;
  destroy(): void;
}

/** Поле с тегами + диалог выбора (аналог BX.UI.EntitySelector.TagSelector). */
export function createTagSelector(container: HTMLElement, options: TagSelectorOptions): TagSelectorHandle {
  const { name, valueFormat = 'id', multiple = false, plain, readonly, addLabel = multiple ? 'Добавить' : 'Выбрать', changeLabel = 'Сменить', ...dialogOptions } = options;
  let selected = [...(options.selected ?? [])];
  let dialog: EntityDialogHandle | null = null;
  const root = h('div', { class: `b24-tag-selector${plain ? ' b24-tag-selector--plain' : ''}`, role: 'group' });
  const inputs = h('span', { hidden: true });
  container.append(root, inputs);

  const render = () => {
    root.textContent = '';
    for (const item of selected) {
      const tag = h('span', { class: 'b24-tag', title: item.subtitle ?? item.title });
      if (item.entityId === 'user' || item.avatar) tag.append(html(avatarHtml(item.title, item.avatar, 'xs')));
      tag.append(h('span', { class: 'b24-tag__text' }, item.title));
      if (!readonly) {
        const remove = h('button', { type: 'button', class: 'b24-tag__remove', 'aria-label': `Убрать ${item.title}` }, html(icon('close')));
        remove.addEventListener('click', (e) => { e.stopPropagation(); setSelected(selected.filter((s) => itemKey(s) !== itemKey(item)), true); });
        tag.append(remove);
      }
      root.append(tag);
    }
    if (!readonly) {
      const add = h('button', { type: 'button', class: 'b24-tag-selector__add', 'aria-haspopup': 'dialog' });
      if (multiple || !selected.length) add.append(html(icon('plus', { size: 14 })));
      add.append(h('span', {}, !multiple && selected.length ? changeLabel : addLabel));
      add.addEventListener('click', (e) => { e.stopPropagation(); open(); });
      root.append(add);
    }
    if (name) {
      inputs.textContent = '';
      const n = multiple ? `${name}[]` : name;
      if (!selected.length && !multiple) inputs.append(h('input', { type: 'hidden', name: n, value: '' }));
      for (const s of selected) inputs.append(h('input', { type: 'hidden', name: n, value: valueFormat === 'key' ? itemKey(s) : String(s.id) }));
    }
  };

  function setSelected(next: DialogItem[], emit = false) {
    selected = next;
    render();
    dialog?.setSelected(selected);
    if (emit) {
      options.onChange?.(selected);
      root.dispatchEvent(new CustomEvent('b24:select', { detail: { selected }, bubbles: true }));
    }
  }

  function open() {
    if (dialog || readonly) return;
    root.classList.add('is-open');
    dialog = openEntityDialog(root, {
      ...dialogOptions,
      multiple,
      selected,
      onChange: (sel) => setSelected(sel, true),
      onClose: () => { dialog = null; root.classList.remove('is-open'); },
    });
  }

  root.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('.b24-tag')) open(); });
  render();
  return {
    element: root,
    getSelected: () => [...selected],
    setSelected: (items) => setSelected(items),
    open,
    destroy() { dialog?.close(); root.remove(); inputs.remove(); },
  };
}

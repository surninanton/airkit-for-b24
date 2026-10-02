import { useEffect, useRef, useState } from 'react';
import { itemKey, openEntityDialog, type DialogItem, type DialogTab, type EntityDialogHandle, type EntityDialogOptions } from '../js/entity-dialog';
import { Avatar } from './Display';
import { Icon } from './Icon';
import { cx } from './utils';

/* ── Combobox ────────────────────────────────────────── */
export interface ComboOption {
  value: string;
  label: string;
  subtitle?: string;
  avatar?: string;
  group?: string;
  disabled?: boolean;
}

interface ComboBase {
  options?: ComboOption[];
  /** серверный поиск вместо options */
  loadOptions?: (query: string, signal: AbortSignal) => Promise<ComboOption[]>;
  placeholder?: string;
  searchable?: boolean;
  /** свободный ввод значения не из списка */
  creatable?: boolean;
  /** счётчик «N из M» внизу списка */
  counter?: boolean;
  /** группа варианта, если не задана в option.group */
  groupBy?: (option: ComboOption) => string | undefined;
  size?: 'sm' | 'md';
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
}
export interface ComboboxSingleProps extends ComboBase { multiple?: false; value: string | null; onChange: (value: string | null, option: ComboOption | null) => void }
export interface ComboboxMultiProps extends ComboBase { multiple: true; value: string[]; onChange: (value: string[], options: ComboOption[]) => void }
export type ComboboxProps = ComboboxSingleProps | ComboboxMultiProps;

const toItem = (o: ComboOption): DialogItem => ({ id: o.value, title: o.label, subtitle: o.subtitle, avatar: o.avatar, group: o.group, disabled: o.disabled, data: o });
const fromItem = (i: DialogItem): ComboOption => (i.data as ComboOption) ?? { value: String(i.id), label: i.title };

/** Выпадающий список с поиском и мультивыбором тегами. */
export function Combobox(props: ComboboxProps) {
  const { options = [], loadOptions, placeholder = 'Не выбрано', searchable, creatable, counter, groupBy, size = 'md', disabled, id, className, multiple } = props;
  const ref = useRef<HTMLDivElement>(null);
  const dialog = useRef<EntityDialogHandle | null>(null);
  const [open, setOpen] = useState(false);
  // для loadOptions помним подписи выбранных значений
  const known = useRef(new Map<string, ComboOption>());
  options.forEach((o) => known.current.set(o.value, o));
  const values = multiple ? props.value : props.value != null && props.value !== '' ? [props.value] : [];
  const selected = values.map((v) => known.current.get(v) ?? { value: v, label: v });
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => () => dialog.current?.close(), []);
  useEffect(() => { dialog.current?.setSelected(selected.map(toItem)); });

  const emit = (items: DialogItem[]) => {
    const opts = items.map(fromItem);
    opts.forEach((o) => known.current.set(o.value, o));
    const p = propsRef.current;
    if (p.multiple) p.onChange(opts.map((o) => o.value), opts);
    else p.onChange(opts[0]?.value ?? null, opts[0] ?? null);
  };

  const openDialog = () => {
    if (dialog.current || disabled || !ref.current) return;
    setOpen(true);
    dialog.current = openEntityDialog(ref.current, {
      items: loadOptions ? undefined : options.map(toItem),
      load: loadOptions ? async (q, _t, signal) => (await loadOptions(q, signal)).map(toItem) : undefined,
      multiple,
      selected: selected.map(toItem),
      searchable: searchable ?? (!!loadOptions || creatable || options.length > 7),
      creatable,
      counter,
      groupBy: groupBy ? (i) => groupBy(fromItem(i)) : undefined,
      avatars: options.some((o) => o.avatar),
      compact: true,
      width: Math.max(ref.current.offsetWidth, 220),
      onChange: emit,
      onClose: () => { dialog.current = null; setOpen(false); },
    });
  };

  // «сырое» значение: нет ни в options, ни среди загруженных
  const isRaw = (v: string) => !loadOptions && !options.some((o) => o.value === v);
  const remove = (v: string) => emit(selected.filter((o) => o.value !== v).map(toItem));

  return (
    <div
      ref={ref}
      id={id}
      role="combobox"
      tabIndex={disabled ? -1 : 0}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-disabled={disabled || undefined}
      aria-invalid={props['aria-invalid']}
      aria-describedby={props['aria-describedby']}
      aria-label={props['aria-label']}
      className={cx('b24-combobox', size === 'sm' && 'b24-combobox--sm', open && 'is-open', className)}
      onClick={() => (dialog.current ? dialog.current.close() : openDialog())}
      onKeyDown={(e) => {
        if (['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); openDialog(); }
        if (e.key === 'Backspace' && multiple && selected.length) remove(selected[selected.length - 1].value);
      }}
    >
      {!selected.length && <span className="b24-combobox__placeholder">{placeholder}</span>}
      {!multiple && selected[0] && <span className={cx('b24-combobox__value', isRaw(selected[0].value) && 'is-raw')}>{selected[0].label}</span>}
      {!multiple && selected[0]?.subtitle && <span className="b24-combobox__code">{selected[0].subtitle}</span>}
      {!multiple && selected[0] && isRaw(selected[0].value) && <span className="b24-combobox__raw" title="Значения нет в справочнике — сохранится как введено">не из списка</span>}
      {multiple && selected.map((o) => (
        <span key={o.value} className="b24-tag">
          <span className="b24-tag__text">{o.label}</span>
          <button type="button" tabIndex={-1} className="b24-tag__remove" aria-label={`Убрать ${o.label}`} onClick={(e) => { e.stopPropagation(); remove(o.value); }}>
            <Icon name="close" />
          </button>
        </span>
      ))}
    </div>
  );
}

/* ── EntitySelector (теги + диалог) ──────────────────── */
interface EntityBase {
  items?: DialogItem[];
  load?: EntityDialogOptions['load'];
  tabs?: DialogTab[];
  placeholder?: string;
  addLabel?: string;
  changeLabel?: string;
  plain?: boolean;
  readonly?: boolean;
  dialogWidth?: number;
  id?: string;
  className?: string;
}
export interface EntitySelectorSingleProps extends EntityBase { multiple?: false; value: DialogItem | null; onChange: (value: DialogItem | null) => void }
export interface EntitySelectorMultiProps extends EntityBase { multiple: true; value: DialogItem[]; onChange: (value: DialogItem[]) => void }
export type EntitySelectorProps = EntitySelectorSingleProps | EntitySelectorMultiProps;

/** Выбор сотрудников / отделов / сущностей CRM (аналог TagSelector + EntitySelector.Dialog). */
export function EntitySelector(props: EntitySelectorProps) {
  const { items, load, tabs, placeholder = 'Поиск', plain, readonly, dialogWidth, id, className, multiple } = props;
  const addLabel = props.addLabel ?? (multiple ? 'Добавить' : 'Выбрать');
  const ref = useRef<HTMLDivElement>(null);
  const dialog = useRef<EntityDialogHandle | null>(null);
  const [open, setOpen] = useState(false);
  const selected: DialogItem[] = multiple ? props.value : props.value ? [props.value] : [];
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => () => dialog.current?.close(), []);
  useEffect(() => { dialog.current?.setSelected(selected); });

  const emit = (next: DialogItem[]) => {
    const p = propsRef.current;
    if (p.multiple) p.onChange(next); else p.onChange(next[0] ?? null);
  };

  const openDialog = () => {
    if (dialog.current || readonly || !ref.current) return;
    setOpen(true);
    dialog.current = openEntityDialog(ref.current, {
      items, load, tabs, placeholder, multiple, width: dialogWidth,
      selected,
      onChange: emit,
      onClose: () => { dialog.current = null; setOpen(false); },
    });
  };

  return (
    <div
      ref={ref}
      id={id}
      role="group"
      className={cx('b24-tag-selector', plain && 'b24-tag-selector--plain', open && 'is-open', className)}
      onClick={(e) => { if (!(e.target as HTMLElement).closest('.b24-tag')) openDialog(); }}
    >
      {selected.map((item) => (
        <span key={itemKey(item)} className="b24-tag" title={item.subtitle ?? item.title}>
          {(item.entityId === 'user' || item.avatar) && <Avatar name={item.title} src={item.avatar} size="xs" />}
          <span className="b24-tag__text">{item.title}</span>
          {!readonly && (
            <button type="button" className="b24-tag__remove" aria-label={`Убрать ${item.title}`} onClick={(e) => { e.stopPropagation(); emit(selected.filter((s) => itemKey(s) !== itemKey(item))); }}>
              <Icon name="close" />
            </button>
          )}
        </span>
      ))}
      {!readonly && (
        <button type="button" className="b24-tag-selector__add" aria-haspopup="dialog" onClick={(e) => { e.stopPropagation(); openDialog(); }}>
          {(multiple || !selected.length) && <Icon name="plus" size={14} />}
          <span>{!multiple && selected.length ? props.changeLabel ?? 'Сменить' : addLabel}</span>
        </button>
      )}
    </div>
  );
}

export type { DialogItem, DialogTab };

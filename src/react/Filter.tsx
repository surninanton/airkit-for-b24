import { useEffect, useRef, useState } from 'react';
import type { PeriodValue } from '../js/date';
import {
  chips, cleanValues, countActive, toBitrixFilter,
  type FilterField, type FilterPreset, type FilterState, type FilterValue, type NumberRange,
} from '../js/filter-model';
import { Button } from './Button';
import { Checkbox, Input, Select } from './Form';
import { Icon } from './Icon';
import { Modal, Popover } from './Overlay';
import { PeriodPicker } from './DatePicker';
import { cx } from './utils';

export interface FilterProps {
  fields: FilterField[];
  presets?: FilterPreset[];
  onPresetsChange?: (presets: FilterPreset[]) => void;
  /** контролируемое состояние */
  value: FilterState;
  onChange: (state: FilterState, restFilter: Record<string, unknown>) => void;
  placeholder?: string;
  glass?: boolean;
  /** задержка поиска при вводе, мс; 0 — только Enter */
  searchDebounce?: number;
  className?: string;
}

export const emptyFilterState: FilterState = { presetId: null, values: {}, search: '' };

export function Filter({
  fields, presets = [], onPresetsChange, value, onChange, placeholder = 'Фильтр и поиск', glass, searchDebounce = 400, className,
}: FilterProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterState>(value);
  const [search, setSearch] = useState(value.search);
  const [visible, setVisible] = useState<Set<string>>(() => new Set(fields.filter((f) => f.default !== false).map((f) => f.id)));
  const [saveOpen, setSaveOpen] = useState(false);
  const [presetName, setPresetName] = useState('Мой фильтр');
  const barRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => setSearch(value.search), [value.search]);

  const emit = (next: FilterState) => {
    const clean = { ...next, values: cleanValues(fields, next.values) };
    onChange(clean, toBitrixFilter(fields, clean));
  };

  const openPopup = () => {
    setDraft(value);
    setVisible((v) => new Set([...v, ...Object.keys(value.values)]));
    setOpen(true);
  };

  const setField = (id: string, v: FilterValue) => setDraft((d) => ({ ...d, presetId: null, values: { ...d.values, [id]: v } }));

  const list = chips(fields, value, presets);
  const shown = list.slice(0, 2);
  const hasAny = list.length > 0 || !!value.search;

  const renderField = (f: FilterField) => {
    const v = draft.values[f.id];
    const id = `b24f-${f.id}`;
    let control: React.ReactNode;
    switch (f.type) {
      case 'text':
        control = <Input id={id} value={(v as string) ?? ''} placeholder={f.placeholder} onChange={(e) => setField(f.id, e.target.value)} />;
        break;
      case 'select':
      case 'checkbox':
        control = (
          <Select
            id={id}
            value={(v as string) ?? ''}
            onChange={(e) => setField(f.id, e.target.value)}
            options={[{ value: '', label: 'Не выбрано' }, ...(f.type === 'checkbox' ? [{ value: 'Y', label: 'Да' }, { value: 'N', label: 'Нет' }] : f.options ?? [])]}
          />
        );
        break;
      case 'multiselect': {
        const sel = new Set((v as string[]) ?? []);
        control = (
          <div className="b24-row" id={id} style={{ ['--b24-gap' as string]: '14px' }}>
            {f.options?.map((o) => (
              <Checkbox
                key={o.value}
                label={o.label}
                checked={sel.has(o.value)}
                onChange={(e) => {
                  const next = new Set(sel);
                  if (e.target.checked) next.add(o.value); else next.delete(o.value);
                  setField(f.id, [...next]);
                }}
              />
            ))}
          </div>
        );
        break;
      }
      case 'number': {
        const r = (v as NumberRange) ?? {};
        control = (
          <div className="b24-filter-popup__field-row">
            <Input id={id} inputMode="decimal" placeholder="от" value={r.from ?? ''} onChange={(e) => setField(f.id, { ...r, from: e.target.value })} />
            <span className="b24-filter-popup__sep">—</span>
            <Input inputMode="decimal" placeholder="до" aria-label={`${f.label} до`} value={r.to ?? ''} onChange={(e) => setField(f.id, { ...r, to: e.target.value })} />
          </div>
        );
        break;
      }
      case 'date':
        control = <PeriodPicker id={id} value={(v as PeriodValue) ?? { type: 'any' }} onChange={(p) => setField(f.id, p)} />;
        break;
    }
    return (
      <div className="b24-filter-popup__field" key={f.id}>
        <label className="b24-field__label" htmlFor={id}>{f.label}</label>
        {control}
      </div>
    );
  };

  const hidden = fields.filter((f) => !visible.has(f.id) && draft.values[f.id] == null);

  return (
    <>
      <div
        ref={barRef}
        role="search"
        className={cx('b24-filter', glass && 'b24-filter--glass', open && 'is-open', className)}
        onClick={(e) => { if (e.target === e.currentTarget) inputRef.current?.focus(); }}
      >
        <div className="b24-filter__chips">
          {shown.map((c) => (
            <span key={c.key} className="b24-filter__chip" title={c.label} onClick={openPopup}>
              <span>{c.label}</span>
              <button
                type="button"
                className="b24-filter__chip-remove"
                aria-label={`Убрать ${c.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (c.key.startsWith('preset:')) emit({ ...value, presetId: null, values: {} });
                  else { const values = { ...value.values }; delete values[c.key]; emit({ ...value, presetId: null, values }); }
                }}
              >
                <Icon name="close" />
              </button>
            </span>
          ))}
          {list.length > shown.length && <span className="b24-filter__chip b24-filter__chip--more" onClick={openPopup}>ещё {list.length - shown.length}</span>}
        </div>
        <input
          ref={inputRef}
          className="b24-filter__input"
          type="search"
          aria-label="Поиск"
          placeholder={list.length ? '' : placeholder}
          value={search}
          onChange={(e) => {
            const s = e.target.value;
            setSearch(s);
            clearTimeout(timer.current);
            if (searchDebounce > 0) timer.current = setTimeout(() => emit({ ...value, search: s }), searchDebounce);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer.current); emit({ ...value, search }); }
            if (e.key === 'Backspace' && !search) {
              const keys = Object.keys(cleanValues(fields, value.values));
              if (!keys.length) return;
              const values = { ...value.values };
              delete values[keys[keys.length - 1]];
              emit({ ...value, presetId: null, values });
            }
          }}
        />
        <button type="button" className="b24-filter__icon" aria-label="Открыть фильтр" aria-expanded={open} onClick={() => (open ? setOpen(false) : openPopup())}>
          <Icon name="filter" />
        </button>
        {hasAny && (
          <button type="button" className="b24-filter__icon" aria-label="Сбросить фильтр" onClick={() => { setSearch(''); emit({ presetId: null, values: {}, search: '' }); }}>
            <Icon name="close" />
          </button>
        )}
      </div>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={barRef}
        className="b24-filter-popup"
        ignoreOutside=".b24-datepicker-popup, .b24-overlay"
        role="dialog"
        aria-label="Фильтр"
      >
        <div className="b24-filter-popup__presets">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={cx('b24-filter-popup__preset', draft.presetId === p.id && 'is-active')}
              onClick={() => {
                setDraft({ ...draft, presetId: p.id, values: structuredClone(p.values) });
                setVisible((v) => new Set([...v, ...Object.keys(p.values)]));
              }}
            >
              <span>{p.name}</span>
              {!p.system && onPresetsChange && (
                <span
                  role="button"
                  aria-label={`Удалить пресет ${p.name}`}
                  className="b24-filter__chip-remove b24-filter-popup__preset-remove"
                  onClick={(e) => { e.stopPropagation(); onPresetsChange(presets.filter((x) => x.id !== p.id)); }}
                >
                  <Icon name="close" />
                </span>
              )}
            </button>
          ))}
          {onPresetsChange && (
            <Button variant="plain" size="sm" icon="plus" className="b24-filter-popup__save" onClick={() => setSaveOpen(true)}>Сохранить фильтр</Button>
          )}
        </div>
        <div className="b24-filter-popup__main">
          <div className="b24-filter-popup__fields">
            {fields.filter((f) => visible.has(f.id) || draft.values[f.id] != null).map(renderField)}
            <div className="b24-filter-popup__links">
              {hidden.length > 0 && (
                <Select size="sm" style={{ width: 'auto' }} aria-label="Добавить поле" value="" onChange={(e) => setVisible((v) => new Set([...v, e.target.value]))}
                  options={[{ value: '', label: '+ Добавить поле' }, ...hidden.map((f) => ({ value: f.id, label: f.label }))]} />
              )}
              <Button variant="link" size="sm" onClick={() => setVisible(new Set(fields.filter((f) => f.default !== false).map((f) => f.id)))}>Вернуть поля по умолчанию</Button>
            </div>
          </div>
          <div className="b24-filter-popup__footer">
            <Button variant="primary" icon="search" onClick={() => { setOpen(false); emit({ ...draft, search }); }}>
              Найти{countActive(fields, draft.values) ? ` (${countActive(fields, draft.values)})` : ''}
            </Button>
            <Button variant="link" onClick={() => setDraft({ presetId: null, values: {}, search: '' })}>Сбросить</Button>
          </div>
        </div>
      </Popover>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Сохранить фильтр"
        size="sm"
        footer={
          <>
            <Button variant="primary" onClick={() => {
              const name = presetName.trim();
              if (!name || !onPresetsChange) return;
              const preset: FilterPreset = { id: `user_${Date.now()}`, name, values: cleanValues(fields, draft.values) };
              onPresetsChange([...presets, preset]);
              setDraft({ ...draft, presetId: preset.id });
              setSaveOpen(false);
            }}>Сохранить</Button>
            <Button variant="link" onClick={() => setSaveOpen(false)}>Отмена</Button>
          </>
        }
      >
        <Input autoFocus value={presetName} onChange={(e) => setPresetName(e.target.value)} aria-label="Название фильтра" />
      </Modal>
    </>
  );
}

export type { FilterField, FilterPreset, FilterState };

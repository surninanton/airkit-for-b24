import { icon } from '../icons';
import { datepicker, type DatePickerHandle } from './calendar';
import { PERIOD_OPTIONS, type PeriodType, type PeriodValue } from './date';
import { bringToFront, h, html, pushLayer } from './dom';
import { modal } from './modal';
import {
  chips, cleanValues, countActive, toBitrixFilter, toQuery,
  type FilterField, type FilterPreset, type FilterState, type FilterValues, type NumberRange,
} from './filter-model';
import { t } from './i18n';

export interface FilterOptions {
  fields: FilterField[];
  presets?: FilterPreset[];
  /** начальное состояние (например, из $_GET, отрендеренного PHP в JSON) */
  state?: Partial<FilterState>;
  placeholder?: string;
  glass?: boolean;
  /**
   * 'event' — только событие b24:filter-apply + onApply
   * 'get'   — перейти на ?filter[...] (удобно для PHP-страниц)
   */
  submit?: 'event' | 'get';
  queryPrefix?: string;
  /** поиск по мере ввода (мс задержки); 0 — только по Enter */
  searchDebounce?: number;
  onApply?: (state: FilterState, restFilter: Record<string, unknown>) => void;
  onPresetsChange?: (presets: FilterPreset[]) => void;
}

export interface FilterHandle {
  getState(): FilterState;
  setState(state: Partial<FilterState>, apply?: boolean): void;
  open(): void;
  close(): void;
  destroy(): void;
}

/** Фильтр в духе main.ui.filter: строка с чипами + попап с пресетами и полями. */
export function createFilter(container: HTMLElement, options: FilterOptions): FilterHandle {
  const { fields, placeholder = t('Фильтр и поиск'), glass, submit = 'event', queryPrefix = 'filter', searchDebounce = 400 } = options;
  let presets = [...(options.presets ?? [])];
  let state: FilterState = { presetId: null, values: {}, search: '', ...options.state };
  // черновик значений в попапе, применяется по «Найти»
  let draft: FilterState = structuredClone(state);
  let visibleFields = new Set(fields.filter((f) => f.default !== false).map((f) => f.id));
  let opened = false;
  let releaseLayer = () => {};
  const pickers: DatePickerHandle[] = [];

  /* ── Bar ── */
  const bar = h('div', { class: `b24-filter${glass ? ' b24-filter--glass' : ''}`, role: 'search' });
  const chipsEl = h('div', { class: 'b24-filter__chips' });
  const input = h('input', { class: 'b24-filter__input', type: 'search', placeholder, 'aria-label': t('Поиск') });
  const filterBtn = h('button', { type: 'button', class: 'b24-filter__icon', 'aria-label': t('Открыть фильтр'), 'aria-haspopup': 'dialog' }, html(icon('filter')));
  const clearBtn = h('button', { type: 'button', class: 'b24-filter__icon', 'aria-label': t('Сбросить фильтр') }, html(icon('close')));
  bar.append(chipsEl, input, filterBtn, clearBtn);
  container.append(bar);

  /* ── Popup ── */
  const popup = h('div', { class: 'b24-popup b24-root b24-filter-popup', hidden: true, role: 'dialog', 'aria-label': t('Фильтр'), style: 'background:var(--b24-bg-surface)' });
  const presetsEl = h('div', { class: 'b24-filter-popup__presets' });
  const fieldsEl = h('div', { class: 'b24-filter-popup__fields' });
  const main = h('div', { class: 'b24-filter-popup__main' }, fieldsEl);
  const footer = h('div', { class: 'b24-filter-popup__footer' });
  const applyBtn = h('button', { type: 'button', class: 'b24-btn b24-btn--primary' }, html(icon('search')), h('span', {}, t('Найти')));
  const resetBtn = h('button', { type: 'button', class: 'b24-btn b24-btn--link' }, t('Сбросить'));
  footer.append(applyBtn, resetBtn);
  main.append(footer);
  popup.append(presetsEl, main);

  const renderBar = () => {
    chipsEl.textContent = '';
    const list = chips(fields, state, presets);
    const shown = list.slice(0, 2);
    for (const c of shown) {
      const remove = h('button', { type: 'button', class: 'b24-filter__chip-remove', 'aria-label': t('Убрать {name}', { name: c.label }) }, html(icon('close')));
      remove.addEventListener('click', (e) => {
        e.stopPropagation();
        if (c.key.startsWith('preset:')) setState({ presetId: null, values: {} }, true);
        else { const values = { ...state.values }; delete values[c.key]; setState({ presetId: null, values }, true); }
      });
      const chip = h('span', { class: 'b24-filter__chip', title: c.label }, h('span', {}, c.label), remove);
      chip.addEventListener('click', () => open());
      chipsEl.append(chip);
    }
    if (list.length > shown.length) {
      const more = h('span', { class: 'b24-filter__chip b24-filter__chip--more' }, t('ещё {n}', { n: list.length - shown.length }));
      more.addEventListener('click', () => open());
      chipsEl.append(more);
    }
    if (input.value !== state.search) input.value = state.search;
    clearBtn.hidden = !list.length && !state.search;
    input.placeholder = list.length ? '' : placeholder;
  };

  const renderPresets = () => {
    presetsEl.textContent = '';
    for (const p of presets) {
      const btn = h('button', { type: 'button', class: `b24-filter-popup__preset${draft.presetId === p.id ? ' is-active' : ''}` }, h('span', {}, p.name));
      if (!p.system) {
        const del = h('span', { class: 'b24-filter__chip-remove b24-filter-popup__preset-remove', role: 'button', 'aria-label': t('Удалить пресет {name}', { name: p.name }) }, html(icon('close')));
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          presets = presets.filter((x) => x.id !== p.id);
          if (draft.presetId === p.id) draft.presetId = null;
          options.onPresetsChange?.(presets);
          renderPresets();
        });
        btn.append(del);
      }
      btn.addEventListener('click', () => {
        draft = { ...draft, presetId: p.id, values: structuredClone(p.values) };
        for (const id of Object.keys(p.values)) visibleFields.add(id);
        renderPresets();
        renderFields();
      });
      presetsEl.append(btn);
    }
    const save = h('button', { type: 'button', class: 'b24-btn b24-btn--plain b24-btn--sm b24-filter-popup__save' }, html(icon('plus')), h('span', {}, t('Сохранить фильтр')));
    save.addEventListener('click', async () => {
      const nameInput = h('input', { class: 'b24-input', value: t('Мой фильтр'), 'aria-label': t('Название фильтра'), autofocus: true });
      const m = modal({
        title: t('Сохранить фильтр'),
        size: 'sm',
        content: nameInput,
        buttons: [
          { text: t('Сохранить'), variant: 'primary', value: true },
          { text: t('Отмена'), variant: 'link', value: false },
        ],
      });
      nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') void m.close(true); });
      const ok = await m.result;
      const name = nameInput.value.trim();
      if (!ok || !name) return;
      const preset: FilterPreset = { id: `user_${Date.now()}`, name, values: cleanValues(fields, draft.values) };
      presets = [...presets, preset];
      draft.presetId = preset.id;
      options.onPresetsChange?.(presets);
      renderPresets();
    });
    presetsEl.append(save);
  };

  const setDraft = (id: string, value: unknown) => {
    draft.values = { ...draft.values, [id]: value as never };
    draft.presetId = null;
    presetsEl.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'));
  };

  const renderFields = () => {
    pickers.splice(0).forEach((p) => p.destroy());
    fieldsEl.textContent = '';
    for (const f of fields) {
      if (!visibleFields.has(f.id) && draft.values[f.id] == null) continue;
      const id = `b24f-${f.id}-${Math.random().toString(36).slice(2, 6)}`;
      const wrap = h('div', { class: 'b24-filter-popup__field' }, h('label', { class: 'b24-field__label', for: id }, f.label));
      const v = draft.values[f.id];
      switch (f.type) {
        case 'text': {
          const el = h('input', { id, class: 'b24-input', value: (v as string) ?? '', placeholder: f.placeholder });
          el.addEventListener('input', () => setDraft(f.id, el.value));
          wrap.append(el);
          break;
        }
        case 'select':
        case 'checkbox': {
          const opts = f.type === 'checkbox' ? [{ value: 'Y', label: t('Да') }, { value: 'N', label: t('Нет') }] : f.options ?? [];
          const el = h('select', { id, class: 'b24-select' }, h('option', { value: '' }, t('Не выбрано')));
          for (const o of opts) el.append(h('option', { value: o.value, selected: o.value === v }, o.label));
          el.addEventListener('change', () => setDraft(f.id, el.value));
          wrap.append(el);
          break;
        }
        case 'multiselect': {
          const selected = new Set((v as string[]) ?? []);
          const row = h('div', { class: 'b24-row', id });
          for (const o of f.options ?? []) {
            const cb = h('input', { type: 'checkbox', value: o.value, checked: selected.has(o.value) });
            cb.addEventListener('change', () => {
              if (cb.checked) selected.add(o.value); else selected.delete(o.value);
              setDraft(f.id, [...selected]);
            });
            row.append(h('label', { class: 'b24-check' }, cb, h('span', {}, o.label)));
          }
          wrap.append(row);
          break;
        }
        case 'number': {
          const r = (v as NumberRange) ?? {};
          const from = h('input', { id, class: 'b24-input', inputmode: 'decimal', placeholder: t('от'), value: r.from ?? '' });
          const to = h('input', { class: 'b24-input', inputmode: 'decimal', placeholder: t('до'), value: r.to ?? '', 'aria-label': `${f.label} ${t('до')}` });
          const upd = () => setDraft(f.id, { from: from.value, to: to.value });
          from.addEventListener('input', upd);
          to.addEventListener('input', upd);
          wrap.append(h('div', { class: 'b24-filter-popup__field-row' }, from, h('span', { class: 'b24-filter-popup__sep' }, '—'), to));
          break;
        }
        case 'date': {
          const p = (v as PeriodValue) ?? { type: 'any' };
          const sel = h('select', { id, class: 'b24-select' });
          for (const o of PERIOD_OPTIONS) sel.append(h('option', { value: o.value, selected: o.value === p.type }, o.label));
          const row = h('div', { class: 'b24-filter-popup__field-row' }, sel);
          const addPicker = (key: 'from' | 'to', label: string) => {
            const inp = h('input', { class: 'b24-input', value: p[key] ?? '', 'aria-label': `${f.label}: ${label}` });
            const group = h('div', { class: 'b24-input-group b24-datepicker' }, inp, h('span', { class: 'b24-input-group__icon', 'data-b24-datepicker-toggle': true }, html(icon('calendar'))));
            row.append(group);
            pickers.push(datepicker(inp, {
              onChange: () => {
                const cur = (draft.values[f.id] as PeriodValue) ?? p;
                setDraft(f.id, { ...cur, [key]: inp.value });
              },
            }));
          };
          if (p.type === 'exact') addPicker('from', t('дата'));
          if (p.type === 'range') { addPicker('from', t('с')); row.append(h('span', { class: 'b24-filter-popup__sep' }, '—')); addPicker('to', t('по')); }
          sel.addEventListener('change', () => {
            setDraft(f.id, { type: sel.value as PeriodType });
            renderFields();
          });
          wrap.append(row);
          break;
        }
      }
      fieldsEl.append(wrap);
    }

    const hidden = fields.filter((f) => !visibleFields.has(f.id) && draft.values[f.id] == null);
    const links = h('div', { class: 'b24-filter-popup__links' });
    if (hidden.length) {
      const add = h('select', { class: 'b24-select b24-select--sm', 'aria-label': t('Добавить поле'), style: 'width:auto' }, h('option', { value: '' }, t('+ Добавить поле')));
      hidden.forEach((f) => add.append(h('option', { value: f.id }, f.label)));
      add.addEventListener('change', () => { visibleFields.add(add.value); renderFields(); });
      links.append(add);
    }
    const restore = h('button', { type: 'button', class: 'b24-btn b24-btn--link b24-btn--sm' }, t('Вернуть поля по умолчанию'));
    restore.addEventListener('click', () => { visibleFields = new Set(fields.filter((f) => f.default !== false).map((f) => f.id)); renderFields(); });
    links.append(restore);
    fieldsEl.append(links);
  };

  const position = () => {
    const r = bar.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left), innerWidth - popup.offsetWidth - 8);
    popup.style.top = `${r.bottom + 6 + scrollY}px`;
    popup.style.left = `${left + scrollX}px`;
  };
  const onDocDown = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    // клики в попапах календаря считаем «внутри»
    if (!popup.contains(t) && !bar.contains(t) && !t.closest('.b24-datepicker-popup, .b24-overlay')) close();
  };

  function open() {
    if (opened) return;
    opened = true;
    draft = structuredClone(state);
    for (const id of Object.keys(state.values)) visibleFields.add(id);
    renderPresets();
    renderFields();
    document.body.append(popup);
    popup.hidden = false;
    bringToFront(popup);
    bar.classList.add('is-open');
    filterBtn.setAttribute('aria-expanded', 'true');
    position();
    document.addEventListener('mousedown', onDocDown);
    addEventListener('resize', position);
    releaseLayer = pushLayer(() => close());
    popup.querySelector<HTMLElement>('input,select')?.focus();
  }
  function close() {
    if (!opened) return;
    opened = false;
    popup.hidden = true;
    pickers.splice(0).forEach((p) => p.destroy());
    bar.classList.remove('is-open');
    filterBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onDocDown);
    removeEventListener('resize', position);
    releaseLayer();
  }

  function apply() {
    state = { ...state, values: cleanValues(fields, state.values) };
    renderBar();
    const rest = toBitrixFilter(fields, state);
    if (submit === 'get') {
      const url = new URL(location.href);
      [...url.searchParams.keys()].filter((k) => k.startsWith(`${queryPrefix}[`)).forEach((k) => url.searchParams.delete(k));
      toQuery(state, queryPrefix).forEach((v, k) => url.searchParams.append(k, v));
      location.href = url.toString();
      return;
    }
    container.dispatchEvent(new CustomEvent('b24:filter-apply', { detail: { state, filter: rest }, bubbles: true }));
    options.onApply?.(state, rest);
  }

  function setState(next: Partial<FilterState>, doApply = false) {
    state = { ...state, ...next };
    renderBar();
    if (doApply) apply();
  }

  applyBtn.addEventListener('click', () => {
    state = { ...draft, search: state.search };
    close();
    apply();
  });
  resetBtn.addEventListener('click', () => {
    draft = { presetId: null, values: {}, search: '' };
    renderPresets();
    renderFields();
  });
  filterBtn.addEventListener('click', (e) => { e.stopPropagation(); if (opened) close(); else open(); });
  clearBtn.addEventListener('click', (e) => { e.stopPropagation(); setState({ presetId: null, values: {}, search: '' }, true); });
  bar.addEventListener('click', (e) => { if (e.target === bar || e.target === chipsEl) input.focus(); });

  let timer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener('input', () => {
    state.search = input.value;
    clearBtn.hidden = !input.value && !countActive(fields, state.values);
    clearTimeout(timer);
    if (searchDebounce > 0 && submit === 'event') timer = setTimeout(apply, searchDebounce);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); apply(); }
    if (e.key === 'Backspace' && !input.value && Object.keys(state.values).length) {
      const keys = Object.keys(cleanValues(fields, state.values));
      const values = { ...state.values };
      delete values[keys[keys.length - 1]];
      setState({ presetId: null, values }, true);
    }
  });

  renderBar();
  return {
    getState: () => structuredClone(state),
    setState,
    open,
    close,
    destroy() { close(); popup.remove(); bar.remove(); clearTimeout(timer); },
  };
}

/** Прочитать JSON-конфиг из <script type="application/json"> для data-b24-filter. */
export function readJsonConfig<T>(el: HTMLElement, attr = 'b24Filter'): T | null {
  const ref = el.dataset[attr];
  const script = ref ? document.querySelector<HTMLScriptElement>(ref) : el.querySelector<HTMLScriptElement>('script[type="application/json"]');
  try { return script ? (JSON.parse(script.textContent ?? '') as T) : null; } catch { return null; }
}

export type { FilterField, FilterPreset, FilterState, FilterValues };

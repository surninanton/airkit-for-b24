import { icon } from '../icons';
import { createCombobox, type ComboItem, type CreateComboboxHandle } from './combobox';
import { h, html } from './dom';
import { t as tr } from './i18n';
import { createKeyValue, createRepeater, valueField, type KeyValueHandle, type RepeaterHandle } from './repeater';

/* ── Редактор сопоставления полей ──────────────────────────
 * Строка: источник (колонка или шаблон «{{Имя}} {{Фамилия}}») → поле Битрикс24 → правило обновления,
 * кнопка преобразования и удаление. Под строкой — панель преобразования: словарь значений
 * (пары «значение источника → значение Битрикс24», действие для значения не из словаря),
 * сумма прописью или склонение ФИО. Конфиги всех типов помнятся, наружу уходит только выбранный.
 * Для дочерней сущности — второй экземпляр со своим targetFields.
 */
export type UpdateRule = 'always' | 'if_empty' | 'if_changed' | 'never';
export type MissingAction = 'pass' | 'default' | 'skip' | 'fail';
export type InflectCase = 'nominative' | 'genitive' | 'dative' | 'accusative' | 'instrumental' | 'prepositional';

/** словарь: значение источника → значение Битрикс24; default — только при on_missing = default */
export interface ValueMapTransform { type: 'value_map'; map: Record<string, string>; on_missing: MissingAction; default?: string }
/** сумма прописью: названия валюты и дробной части в именительном падеже, склоняет обработчик (по умолчанию рубль/копейка) */
export interface AmountWordsTransform { type: 'amount_words'; currency?: string; fraction?: string }
export interface InflectTransform { type: 'inflect'; case: InflectCase }
export type FieldTransform = ValueMapTransform | AmountWordsTransform | InflectTransform;
export type TransformType = FieldTransform['type'];

export interface FieldMapping {
  mode: 'column' | 'template';
  /** код колонки источника (mode = column) */
  source: string;
  /** шаблон с {{Колонка}} (mode = template) */
  template: string;
  /** код поля Битрикс24 */
  target: string;
  rule: UpdateRule;
  transform?: FieldTransform | null;
}

type Dict = ComboItem[] | null | undefined;

export interface FieldMapperOptions {
  value?: FieldMapping[];
  /** колонки источника */
  sourceFields: ComboItem[];
  /** поля Битрикс24; subtitle — код поля (по нему тоже ищется) */
  targetFields: ComboItem[];
  /** группа поля Битрикс24; по умолчанию UF_* — «Пользовательские», остальные — «Системные» */
  groupTarget?: (item: ComboItem) => string | undefined;
  rules?: Array<{ value: UpdateRule; label: string }>;
  defaultRule?: UpdateRule;
  /** доступные преобразования (по умолчанию все) */
  transforms?: TransformType[];
  /** справочник значений поля Битрикс24 для словаря (стадии с group по воронкам, списки); null — свободный ввод */
  dictionary?: (target: string) => Dict | Promise<Dict>;
  /** подсказки значений источника для левой колонки словаря */
  sourceValues?: (source: string) => Dict | Promise<Dict>;
  /** режим «шаблон» (по умолчанию да) */
  allowTemplate?: boolean;
  labels?: { source?: string; target?: string; rule?: string; add?: string; empty?: string };
  /** имя скрытого поля — сопоставление уходит JSON */
  name?: string;
  onChange?: (value: FieldMapping[]) => void;
}

export interface FieldMapperHandle {
  element: HTMLElement;
  getValue(): FieldMapping[];
  setValue(value: FieldMapping[]): void;
  setSourceFields(items: ComboItem[]): void;
  setTargetFields(items: ComboItem[]): void;
  /** ошибки по пути «индекс.поле»: «3.target», «0.source», «2.transform» (или «2.transformation»), «1» — вся строка */
  setErrors(errors: Record<string, string | string[]>): void;
  clearErrors(): void;
  destroy(): void;
}

// label — геттер: подпись переводится при чтении, а не при загрузке модуля
const option = <V extends string>(value: V, label: string) => ({ value, get label() { return tr(label); } });
export const UPDATE_RULES: Array<{ value: UpdateRule; label: string }> = [
  option<UpdateRule>('always', 'Всегда перезаписывать'),
  option<UpdateRule>('if_empty', 'Только если поле пустое'),
  option<UpdateRule>('if_changed', 'Если значение изменилось'),
  option<UpdateRule>('never', 'Только при создании'),
];
const TRANSFORM_LABELS = (): Record<TransformType, string> => ({ value_map: tr('Словарь значений'), amount_words: tr('Сумма прописью'), inflect: tr('Склонение ФИО') });
const MISSING = (): Array<{ value: MissingAction; label: string }> => [
  { value: 'pass', label: tr('Передать как есть') },
  { value: 'default', label: tr('Подставить значение') },
  { value: 'skip', label: tr('Не заполнять поле') },
  { value: 'fail', label: tr('Остановить с ошибкой') },
];
const CASES = (): Array<{ value: InflectCase; label: string }> => [
  { value: 'nominative', label: tr('Именительный (кто?)') },
  { value: 'genitive', label: tr('Родительный (кого?)') },
  { value: 'dative', label: tr('Дательный (кому?)') },
  { value: 'accusative', label: tr('Винительный (кого?)') },
  { value: 'instrumental', label: tr('Творительный (кем?)') },
  { value: 'prepositional', label: tr('Предложный (о ком?)') },
];

const defaultGroup = (i: ComboItem) => (/^UF_/i.test(i.value) ? tr('Пользовательские') : tr('Системные'));
const freshTransform = (type: TransformType): FieldTransform =>
  type === 'value_map' ? { type, map: {}, on_missing: 'pass' } : type === 'amount_words' ? { type } : { type, case: 'genitive' };
/** Наружу: пустой словарь с «передать как есть» — то же, что без преобразования; default — только при on_missing = default */
export function normalizeTransform(t?: FieldTransform | null): FieldTransform | null {
  if (!t) return null;
  if (t.type === 'value_map') {
    if (!Object.keys(t.map).length && t.on_missing === 'pass') return null;
    const { default: def, ...rest } = t;
    return t.on_missing === 'default' ? { ...rest, default: def ?? '' } : rest;
  }
  if (t.type === 'amount_words') {
    const out: AmountWordsTransform = { type: 'amount_words' };
    if (t.currency?.trim()) out.currency = t.currency.trim();
    if (t.fraction?.trim()) out.fraction = t.fraction.trim();
    return out;
  }
  return { type: 'inflect', case: t.case };
}
/** «настроено»: преобразование что-то меняет */
const configured = (t?: FieldTransform | null) => !!normalizeTransform(t);
const pairsToMap = (pairs: Array<{ key: string; value: string }>) => Object.fromEntries(pairs.filter((p) => p.key !== '').map((p) => [p.key, p.value]));

function nativeSelect(opts: Array<{ value: string; label: string }>, value: string, onChange: (v: string) => void, attrs: Record<string, string> = {}): HTMLSelectElement {
  const sel = h('select', { class: 'b24-select b24-select--sm', ...attrs }) as HTMLSelectElement;
  for (const o of opts) sel.add(new Option(o.label, o.value, false, o.value === value));
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

export function createFieldMapper(host: HTMLElement, options: FieldMapperOptions): FieldMapperHandle {
  const o = options;
  let sourceFields = o.sourceFields;
  let targetFields = o.targetFields;
  const rules = o.rules ?? UPDATE_RULES;
  const available = o.transforms ?? (['value_map', 'amount_words', 'inflect'] as TransformType[]);
  const L = { source: tr('Колонка источника'), target: tr('Поле Битрикс24'), rule: tr('Обновление'), add: tr('Добавить поле'), empty: tr('Поля ещё не сопоставлены'), ...o.labels };
  const root = h('div', { class: 'b24-mapper' });
  host.append(root);
  const hidden = o.name ? h('input', { type: 'hidden', name: o.name }) as HTMLInputElement : null;
  if (hidden) root.append(hidden);
  root.append(h('div', { class: 'b24-mapper__head', 'aria-hidden': 'true' },
    h('span', {}, L.source), h('span', {}), h('span', {}), h('span', {}, L.target), h('span', {}, L.rule), h('span', {})));

  /** наружу — без кэша других типов преобразования */
  /** pairs — строки словаря при редактировании: в объекте map нельзя держать пустой или повторяющийся ключ */
  type RowState = FieldMapping & { cache: Partial<Record<TransformType, FieldTransform>>; pairs: Array<{ key: string; value: string }> };
  const clean = (r: RowState): FieldMapping => ({ mode: r.mode, source: r.source, template: r.template, target: r.target, rule: r.rule, transform: normalizeTransform(r.transform) });
  const emit = (rows: RowState[]) => {
    const v = rows.map(clean);
    if (hidden) hidden.value = JSON.stringify(v);
    o.onChange?.(v);
  };
  const toState = (m: FieldMapping): RowState => ({
    mode: m.mode ?? 'column', source: m.source ?? '', template: m.template ?? '', target: m.target ?? '', rule: m.rule ?? o.defaultRule ?? 'always',
    transform: m.transform ?? null, cache: m.transform ? { [m.transform.type]: m.transform } : {},
    pairs: m.transform?.type === 'value_map' ? Object.entries(m.transform.map ?? {}).map(([key, value]) => ({ key, value: String(value) })) : [],
  });

  // строки и их элементы для ошибок
  const rowApi: Array<{ row: HTMLElement; setError(field: string, msg: string): void; clear(): void }> = [];

  const rep: RepeaterHandle<RowState> = createRepeater<RowState>(root, {
    values: (o.value ?? []).map(toState),
    create: () => toState({ mode: 'column', source: '', template: '', target: '', rule: o.defaultRule ?? 'always' }),
    addLabel: L.add,
    emptyText: L.empty,
    className: 'b24-mapper__rows',
    onChange: emit,
    render(body, initial, ctx) {
      const st = initial;
      const set = (patch: Partial<RowState>) => { Object.assign(st, patch); ctx.update(patch); };
      body.classList.add('b24-mapper__row');
      const line = h('div', { class: 'b24-mapper__line' });
      const panel = h('div', { class: 'b24-mapper__panel', hidden: '' });
      const errorsEl = h('div', { class: 'b24-mapper__errors', role: 'alert' });
      body.append(line, panel, errorsEl);

      // источник: колонка или шаблон
      const srcCell = h('div', { class: 'b24-mapper__cell b24-mapper__source' });
      let srcCombo: CreateComboboxHandle | null = null;
      let tplArea: HTMLTextAreaElement | null = null;
      let insertCombo: CreateComboboxHandle | null = null;
      const renderSource = () => {
        srcCombo?.destroy(); insertCombo?.destroy(); srcCell.textContent = ''; srcCombo = null; tplArea = null; insertCombo = null;
        if (st.mode === 'column') {
          srcCombo = createCombobox(srcCell, { items: sourceFields, value: st.source, placeholder: tr('Выберите колонку'), creatable: true, size: 'sm', ariaLabel: L.source, onChange: (v) => { set({ source: (v as string) ?? '' }); refreshPanel(); } });
        } else {
          tplArea = h('textarea', { class: 'b24-textarea b24-mapper__template', rows: '2', placeholder: tr('{{Имя}} {{Фамилия}}'), 'aria-label': tr('Шаблон значения') }) as HTMLTextAreaElement;
          tplArea.value = st.template;
          tplArea.addEventListener('input', () => set({ template: tplArea!.value }));
          const ins = h('div', { class: 'b24-mapper__insert' });
          srcCell.append(tplArea, ins);
          // вставка {{колонки}} в позицию курсора
          insertCombo = createCombobox(ins, {
            items: sourceFields, placeholder: tr('+ колонка'), size: 'sm', ariaLabel: tr('Вставить колонку в шаблон'),
            onChange: (v) => {
              if (!v || !tplArea) return;
              const col = sourceFields.find((f) => f.value === v)?.label ?? String(v);
              const a = tplArea.selectionStart ?? tplArea.value.length;
              const b = tplArea.selectionEnd ?? a;
              const token = `{{${col}}}`;
              tplArea.value = tplArea.value.slice(0, a) + token + tplArea.value.slice(b);
              tplArea.selectionStart = tplArea.selectionEnd = a + token.length;
              set({ template: tplArea.value });
              insertCombo?.setValue(null);
              tplArea.focus();
            },
          });
        }
      };
      const modeBtn = h('button', { type: 'button', class: 'b24-mapper__mode', 'aria-pressed': 'false' }) as HTMLButtonElement;
      const syncMode = () => {
        const tpl = st.mode === 'template';
        modeBtn.setAttribute('aria-pressed', String(tpl));
        modeBtn.title = tpl ? tr('Шаблон — переключить на колонку') : tr('Колонка — переключить на шаблон');
        modeBtn.setAttribute('aria-label', modeBtn.title);
        modeBtn.innerHTML = tpl ? '<span aria-hidden="true">{ }</span>' : icon('list');
      };
      modeBtn.addEventListener('click', () => { set({ mode: st.mode === 'column' ? 'template' : 'column' }); syncMode(); renderSource(); (srcCell.querySelector('textarea, [tabindex="0"]') as HTMLElement | null)?.focus(); });

      const tgtCell = h('div', { class: 'b24-mapper__cell b24-mapper__target' });
      const tgtCombo = createCombobox(tgtCell, {
        items: targetFields, value: st.target, placeholder: tr('Выберите поле'), size: 'sm', ariaLabel: L.target,
        groupBy: o.groupTarget ?? defaultGroup, counter: true, creatable: true,
        onChange: (v) => { set({ target: (v as string) ?? '' }); refreshPanel(); },
      });
      const ruleCell = h('div', { class: 'b24-mapper__cell b24-mapper__rule' });
      ruleCell.append(nativeSelect(rules, st.rule, (v) => set({ rule: v as UpdateRule }), { 'aria-label': L.rule }));

      const trBtn = h('button', { type: 'button', class: 'b24-mapper__transform', 'aria-expanded': 'false' }, html(icon('settings'))) as HTMLButtonElement;
      const syncTrBtn = () => {
        const on = configured(st.transform);
        trBtn.classList.toggle('is-configured', on);
        const name = st.transform ? TRANSFORM_LABELS()[st.transform.type] : '';
        trBtn.title = on ? tr('Преобразование: {name}', { name }) : tr('Преобразование значения');
        trBtn.setAttribute('aria-label', trBtn.title);
      };
      trBtn.addEventListener('click', () => {
        const open = panel.hidden;
        panel.hidden = !open;
        trBtn.setAttribute('aria-expanded', String(open));
        if (open) refreshPanel(true);
      });

      line.append(srcCell);
      if (o.allowTemplate !== false) line.append(modeBtn); else line.append(h('span'));
      line.append(h('span', { class: 'b24-mapper__arrow', 'aria-hidden': 'true' }, html(icon('arrowRight'))), tgtCell, ruleCell);
      if (available.length) line.append(trBtn);

      // ── панель преобразования ──
      let kv: KeyValueHandle | null = null;
      let defField: { destroy(): void } | null = null;
      let panelToken = 0;
      const setTransform = (t: FieldTransform | null) => {
        if (t) st.cache[t.type] = t;
        set({ transform: t });
        syncTrBtn();
      };
      const refreshPanel = async (force = false) => {
        if (panel.hidden && !force) { syncTrBtn(); return; }
        const token = ++panelToken;
        kv?.destroy(); kv = null; defField?.destroy(); defField = null;
        panel.textContent = '';
        const types = h('div', { class: 'b24-tabs b24-tabs--pills b24-mapper__types', role: 'radiogroup', 'aria-label': tr('Тип преобразования') });
        const typeBtn = (type: TransformType | null, label: string) => {
          const active = (st.transform?.type ?? null) === type;
          const b = h('button', { type: 'button', class: `b24-tabs__item${active ? ' is-active' : ''}`, role: 'radio', 'aria-checked': String(active) }, label);
          b.addEventListener('click', () => { setTransform(type ? st.cache[type] ?? freshTransform(type) : null); void refreshPanel(); });
          return b;
        };
        const labels = TRANSFORM_LABELS();
        types.append(typeBtn(null, tr('Без преобразования')), ...available.map((t) => typeBtn(t, labels[t])));
        panel.append(types);
        const t = st.transform;
        if (!t) return;
        const box = h('div', { class: 'b24-mapper__config' });
        panel.append(box);
        if (t.type === 'value_map') {
          if (!st.target) { box.append(h('p', { class: 'b24-mapper__note' }, tr('Сначала выберите поле Битрикс24 — от него зависит список значений.'))); return; }
          box.append(h('div', { class: 'b24-mapper__loading' }, h('span', { class: 'b24-spinner b24-spinner--sm' }), tr('Загрузка значений…')));
          const [dict, srcVals] = await Promise.all([
            Promise.resolve(o.dictionary?.(st.target) ?? null).catch(() => null),
            Promise.resolve(st.mode === 'column' && st.source ? o.sourceValues?.(st.source) ?? null : null).catch(() => null),
          ]);
          if (token !== panelToken) return; // пока грузилось, панель перерисовали
          box.textContent = '';
          if (!dict) box.append(h('p', { class: 'b24-mapper__note' }, tr('Справочника у поля нет — значения вводятся вручную.')));
          const kvHost = h('div');
          box.append(kvHost);
          kv = createKeyValue(kvHost, {
            pairs: st.pairs,
            key: { label: tr('Значение источника'), placeholder: tr('Как в источнике'), items: srcVals ?? null },
            value: { label: tr('Значение Битрикс24'), placeholder: tr('Выберите значение'), items: dict ?? null },
            addLabel: tr('Добавить значение'),
            emptyText: tr('Добавьте пары значений'),
            size: 'sm',
            onChange: (pairs) => { st.pairs = pairs; setTransform({ ...(st.transform as ValueMapTransform), map: pairsToMap(pairs) }); },
          });
          const miss = h('div', { class: 'b24-mapper__missing' });
          const missLabel = h('span', { class: 'b24-mapper__missing-label' }, tr('Значения нет в словаре:'));
          const defHost = h('div', { class: 'b24-mapper__default' });
          const renderDefault = () => {
            defField?.destroy(); defField = null; defHost.textContent = '';
            const cur = st.transform as ValueMapTransform;
            defHost.hidden = cur.on_missing !== 'default';
            if (cur.on_missing === 'default') {
              defField = valueField(defHost, { items: dict ?? null, placeholder: tr('Значение по умолчанию') }, cur.default ?? '', (v) => setTransform({ ...(st.transform as ValueMapTransform), default: v }), { size: 'sm', ariaLabel: tr('Значение по умолчанию') });
            }
          };
          miss.append(missLabel, nativeSelect(MISSING(), t.on_missing, (v) => { setTransform({ ...(st.transform as ValueMapTransform), on_missing: v as MissingAction }); renderDefault(); }, { 'aria-label': tr('Если значения нет в словаре') }), defHost);
          box.append(miss);
          renderDefault();
        } else if (t.type === 'amount_words') {
          const text = (label: string, key: 'currency' | 'fraction', placeholder: string) => {
            const input = h('input', { class: 'b24-input b24-input--sm', placeholder, 'aria-label': label }) as HTMLInputElement;
            input.value = (t as AmountWordsTransform)[key] ?? '';
            input.addEventListener('input', () => setTransform({ ...(st.transform as AmountWordsTransform), [key]: input.value }));
            return h('label', { class: 'b24-mapper__inline' }, h('span', { class: 'b24-mapper__missing-label' }, label), input);
          };
          box.append(h('div', { class: 'b24-row' }, text(tr('Валюта'), 'currency', tr('рубль')), text(tr('Дробная часть'), 'fraction', tr('копейка'))),
            h('p', { class: 'b24-mapper__note' }, tr('Названия — в именительном падеже, склоняются при подстановке: 1 250,50 → «одна тысяча двести пятьдесят рублей 50 копеек».')));
        } else {
          box.append(h('div', { class: 'b24-row' },
            h('span', { class: 'b24-mapper__missing-label' }, tr('Падеж')),
            nativeSelect(CASES(), t.case, (v) => setTransform({ ...(st.transform as InflectTransform), case: v as InflectCase }), { 'aria-label': tr('Падеж') })),
            h('p', { class: 'b24-mapper__note' }, tr('Иванов Пётр Сергеевич → Иванова Петра Сергеевича (родительный).')));
        }
      };

      renderSource();
      syncMode();
      syncTrBtn();

      const api = {
        row: ctx.row,
        setError(raw: string, msg: string) {
          // имена полей Laravel-модели тоже понимаем: metabase_field, bitrix_field, transformation
          const field = ({ metabase_field: 'source', bitrix_field: 'target', update_rule: 'rule' } as Record<string, string>)[raw] ?? raw;
          ctx.row.classList.add('is-invalid');
          if (field === 'source') srcCombo?.setInvalid(true);
          if (field === 'target') tgtCombo.setInvalid(true);
          if (field === 'template') tplArea?.setAttribute('aria-invalid', 'true');
          if (field.startsWith('transform') && panel.hidden) trBtn.click();
          errorsEl.append(h('div', {}, msg));
        },
        clear() {
          ctx.row.classList.remove('is-invalid');
          srcCombo?.setInvalid(false);
          tgtCombo.setInvalid(false);
          tplArea?.removeAttribute('aria-invalid');
          errorsEl.textContent = '';
        },
      };
      rowApi.push(api);
      return () => {
        panelToken++;
        srcCombo?.destroy(); insertCombo?.destroy(); tgtCombo.destroy(); kv?.destroy(); defField?.destroy();
        rowApi.splice(rowApi.indexOf(api), 1);
      };
    },
  });
  if (hidden) hidden.value = JSON.stringify(rep.getValues().map(clean));

  const apiFor = (i: number) => rowApi.find((a) => a.row === rep.rows()[i]);

  return {
    element: root,
    getValue: () => rep.getValues().map(clean),
    setValue: (v) => rep.setValues(v.map(toState)),
    setSourceFields(items) { sourceFields = items; rep.setValues(rep.getValues()); },
    setTargetFields(items) { targetFields = items; rep.setValues(rep.getValues()); },
    setErrors(errors) {
      rowApi.forEach((a) => a.clear());
      for (const [path, msg] of Object.entries(errors)) {
        const [i, ...rest] = path.split('.');
        const api = apiFor(Number(i));
        const list = Array.isArray(msg) ? msg : [msg];
        list.forEach((m) => api?.setError(rest.join('.') || 'row', m));
      }
      root.querySelector<HTMLElement>('.b24-repeater__row.is-invalid')?.scrollIntoView({ block: 'nearest' });
    },
    clearErrors: () => rowApi.forEach((a) => a.clear()),
    destroy: () => { rep.destroy(); root.remove(); },
  };
}

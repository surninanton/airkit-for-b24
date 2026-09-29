import { dropdown } from './dropdown';
import { initTabs } from './tabs';
import { initSortableTable } from './table';
import { datepicker } from './calendar';
import { parseDate, startOfDay } from './date';
import { enableKanbanDnd, paintKanbanColumns } from './kanban';
import { createFilter, readJsonConfig, type FilterOptions } from './filter';
import { enhanceSelect } from './combobox';
import { createTagSelector, type TagSelectorOptions } from './tag-selector';
import { createUploader } from './uploader';
import { createEntityEditor, type EntityEditorOptions } from './editor';
import { initComposer } from './timeline';
import { timepicker } from './timepicker';
import { multiValue, type MultiValueOptions } from './multi-value';

/**
 * Декларативная инициализация по data-атрибутам (удобно для PHP/Jinja-шаблонов):
 *   data-b24-dropdown="#menu-id"   — кнопка открывает .b24-popup
 *   data-b24-tabs                  — контейнер вкладок
 *   data-b24-sortable              — сортировка таблицы
 *   data-b24-dismiss               — кнопка закрытия ближайшего .b24-alert / [data-b24-dismissible]
 *   data-b24-shell-toggle          — свернуть сайдбар / открыть меню на мобильном
 *   input[data-b24-datepicker]     — календарь; ="range" — диапазон в одном поле,
 *                                    data-b24-to="#id" — второе поле диапазона, data-min / data-max (дата или today), data-time
 *   [data-b24-kanban]              — drag & drop; событие b24:kanban-move (preventDefault → откат)
 *   [data-b24-filter]              — фильтр; конфиг FilterOptions в <script type="application/json"> внутри
 *                                    или data-b24-filter="#config-id"; событие b24:filter-apply
 *   select[data-b24-combobox]      — select с поиском и тегами (data-search="false" — без поиска)
 *   [data-b24-entity-selector]     — поле с тегами + диалог; JSON-конфиг TagSelectorOptions внутри
 *   [data-b24-uploader]            — загрузчик; data-name, data-url, data-accept, data-max-size (МБ), data-single, data-view="grid"
 *   [data-b24-editor]              — карточка с полями; JSON-конфиг EntityEditorOptions (без onSave), событие b24:editor-save
 *   [data-b24-composer]            — композер таймлайна; событие b24:composer-submit
 *   input[data-b24-timepicker]     — выбор времени HH:MM; data-step (1/5/10/15/30), data-min, data-max, data-strict="false"
 *   [data-b24-multi]               — несколько значений тегами; data-type="time|select", data-name, data-max (кол-во),
 *                                    data-step, data-min-time / data-max-time (HH:MM),
 *                                    data-values="09:00,14:30", data-unique="false", data-sort="false";
 *                                    варианты select — <option> внутри или JSON-конфиг; событие b24:multi-change
 * Повторный вызов безопасен.
 */
export function init(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-b24-dropdown]').forEach((trigger) => {
    if (trigger.dataset.b24Ready) return;
    const popup = document.querySelector<HTMLElement>(trigger.dataset.b24Dropdown!);
    if (!popup) return;
    trigger.dataset.b24Ready = '1';
    dropdown(trigger, popup, {
      placement: (trigger.dataset.b24Placement as 'bottom-start') ?? 'bottom-start',
    });
  });
  root.querySelectorAll<HTMLElement>('[data-b24-tabs]').forEach((el) => initTabs(el));
  root.querySelectorAll<HTMLTableElement>('table[data-b24-sortable]').forEach(initSortableTable);

  root.querySelectorAll<HTMLInputElement>('input[data-b24-datepicker]').forEach((input) => {
    if (input.dataset.b24Ready) return;
    input.dataset.b24Ready = '1';
    const d = input.dataset;
    datepicker(input, {
      mode: d.b24Datepicker === 'range' || d.b24To ? 'range' : 'single',
      inputTo: d.b24To ? document.querySelector<HTMLInputElement>(d.b24To) ?? undefined : undefined,
      min: dateAttr(d.min),
      max: dateAttr(d.max),
      withTime: d.time !== undefined,
    });
  });

  root.querySelectorAll<HTMLElement>('[data-b24-kanban]').forEach((board) => {
    paintKanbanColumns(board);
    if (board.dataset.b24Ready) return;
    board.dataset.b24Ready = '1';
    enableKanbanDnd(board);
  });

  root.querySelectorAll<HTMLElement>('[data-b24-filter]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    const config = readJsonConfig<FilterOptions>(el);
    if (!config) return;
    el.dataset.b24Ready = '1';
    createFilter(el, config);
  });

  root.querySelectorAll<HTMLSelectElement>('select[data-b24-combobox]').forEach((select) => {
    if (select.dataset.b24Ready) return;
    select.dataset.b24Ready = '1';
    enhanceSelect(select);
  });

  root.querySelectorAll<HTMLElement>('[data-b24-entity-selector]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    const config = readJsonConfig<TagSelectorOptions>(el, 'b24EntitySelector');
    if (!config) return;
    el.dataset.b24Ready = '1';
    createTagSelector(el, config);
  });

  root.querySelectorAll<HTMLElement>('[data-b24-uploader]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    const d = el.dataset;
    createUploader(el, {
      name: d.name,
      url: d.url,
      accept: d.accept,
      maxSize: d.maxSize ? Number(d.maxSize) * 1024 * 1024 : undefined,
      maxFiles: d.maxFiles ? Number(d.maxFiles) : undefined,
      multiple: d.single === undefined,
      view: d.view === 'grid' ? 'grid' : 'list',
      compact: d.compact !== undefined,
      files: readJsonConfig(el, 'b24Uploader') ?? undefined,
    });
  });

  root.querySelectorAll<HTMLElement>('[data-b24-editor]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    const config = readJsonConfig<EntityEditorOptions>(el, 'b24Editor');
    if (!config) return;
    el.dataset.b24Ready = '1';
    createEntityEditor(el, {
      ...config,
      // отдаём сохранение наружу: слушайте b24:editor-save и вызывайте detail.resolve() / detail.reject(err)
      onSave: (values, changed) => new Promise((resolve, reject) => {
        const handled = !el.dispatchEvent(new CustomEvent('b24:editor-save', { detail: { values, changed, resolve, reject }, bubbles: true, cancelable: true }));
        if (!handled) resolve();
      }),
    });
  });

  root.querySelectorAll<HTMLElement>('[data-b24-composer]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    initComposer(el);
  });

  root.querySelectorAll<HTMLInputElement>('input[data-b24-timepicker]').forEach((input) => {
    if (input.dataset.b24Ready) return;
    input.dataset.b24Ready = '1';
    const d = input.dataset;
    timepicker(input, { step: d.step ? Number(d.step) : undefined, min: d.min, max: d.max, strict: d.strict !== 'false' });
  });

  root.querySelectorAll<HTMLElement>('[data-b24-multi]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    const d = el.dataset;
    const json = readJsonConfig<MultiValueOptions>(el, 'b24Multi') ?? {};
    // варианты для select можно задать разметкой: <option value="mon">Пн</option>
    const optionEls = Array.from(el.querySelectorAll('option'));
    const fromOptions = optionEls.map((o) => ({ value: o.value, label: o.textContent ?? o.value }));
    const selectedFromOptions = optionEls.filter((o) => o.selected || o.hasAttribute('selected')).map((o) => o.value);
    optionEls.forEach((o) => o.remove());
    el.querySelectorAll('script[type="application/json"]').forEach((s) => s.remove());
    const bool = (v?: string) => (v === undefined ? undefined : v !== 'false');
    multiValue(el, {
      ...json,
      type: (d.type as 'time' | 'select') ?? json.type,
      name: d.name ?? json.name,
      max: d.max ? Number(d.max) : json.max,
      step: d.step ? Number(d.step) : json.step,
      minTime: d.minTime ?? json.minTime,
      maxTime: d.maxTime ?? json.maxTime,
      unique: bool(d.unique) ?? json.unique,
      sort: bool(d.sort) ?? json.sort,
      addLabel: d.addLabel ?? json.addLabel,
      options: json.options ?? (fromOptions.length ? fromOptions : undefined),
      values: d.values !== undefined ? d.values.split(',').map((v) => v.trim()).filter(Boolean) : json.values ?? selectedFromOptions,
    });
  });
}

/** data-min / data-max: дата или «today» */
const dateAttr = (v?: string) => (v === 'today' ? startOfDay(new Date()) : parseDate(v));

let delegated = false;
export function delegateGlobalEvents(): void {
  if (delegated || typeof document === 'undefined') return;
  delegated = true;
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const dismiss = target.closest<HTMLElement>('[data-b24-dismiss]');
    if (dismiss) {
      dismiss.closest('.b24-alert, [data-b24-dismissible]')?.remove();
      return;
    }
    const toggle = target.closest<HTMLElement>('[data-b24-shell-toggle]');
    if (toggle) {
      const shell = toggle.closest('.b24-shell') ?? document.querySelector('.b24-shell');
      if (!shell) return;
      if (window.matchMedia('(max-width: 768px)').matches) shell.classList.toggle('is-menu-open');
      else shell.classList.toggle('is-collapsed');
    }
  });
}

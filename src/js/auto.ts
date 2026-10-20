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
import { createVendor, type VendorOptions } from './vendor';
import { initGrid, type GridOptions } from './grid';
import { createChart, sparkline, type ChartOptions } from './chart';
import { initSettings, initWizard } from './screens';
import { initRepeater } from './repeater';
import { initCheckGroup, initColors, initRange, initSecret } from './controls';
import { copyText } from './logs';
import { initAnchorNav, initCookieNotice, initGallery, initSiteHeader, initThemeSwitch, initToc, initTopnav, initVideo } from './site';
import { t } from './i18n';
import { warnLayout } from './page-header';
import { createRating, getRating } from './rating';
import { setAutoInit } from './dom';

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
 *   [data-b24-vendor]              — блок разработчика (правило кита); JSON-конфиг VendorOptions внутри;
 *                                    data-counter — непрочитанные обращения; потом getVendor(el).setCounter(n) или событие b24:vendor-counter
 *   [data-b24-gallery]             — галерея скриншотов: a.b24-gallery__item → лайтбокс (←/→, Esc)
 *   .b24-topnav[data-b24-topnav]   — верхнее меню сайта: на ≤768px пункты прячутся в «☰»
 *   .b24-site-header[data-b24-site-header] — липкая шапка сайта: бургер на ≤960px, группы меню (details)
 *   .b24-anchor-nav[data-b24-anchor-nav]   — якорное меню: подсветка текущей секции
 *   a.b24-video[data-b24-video]    — видео: по клику плеер на месте постера (data-embed — iframe)
 *   .b24-toc[data-b24-toc]         — оглавление статьи: подсветка раздела; пустой <ol> + data-source — собрать из h2/h3
 *   [data-b24-cookie]              — уведомление о cookie (показывается, пока не принято)
 *   [data-b24-theme-switch]        — переключатель светлой/тёмной темы (запоминается)
 *   [data-b24-rating]              — оценка звёздами: data-name (скрытое поле), data-value, data-max, data-readonly,
 *                                    data-disabled, data-size="sm|lg", data-clearable="false"; событие b24:rating-change { value }
 *   table[data-b24-grid][data-row-open] — открыть запись кликом по строке (или tr[data-href]); событие b24:row-open
 *   .b24-table__expander[aria-controls] — раскрыть строку .b24-table__details (событие b24:row-expand)
 *   .b24-check-group[data-b24-check-group] — «Выбрано N из M», ссылки [data-b24-check-group-all/none]
 *   input.b24-range[data-b24-range], .b24-range-pair[data-b24-range] — закраска дорожки и значение рядом
 *   .b24-colors[data-b24-colors]   — палитра со своим цветом (input[type=color])
 *   .b24-secret[data-b24-secret]   — поле секрета с «глазом»; data-saved — значение уже сохранено
 *   [data-b24-repeater]            — повторяющиеся строки серверной формы: <template> строки, [data-b24-repeater-add],
 *                                    [data-b24-repeater-remove]; имена rows[0][key] перенумеровываются; data-max
 *   select[data-b24-combobox][data-creatable][data-counter] — свободный ввод и счётчик «N из M»
 *   [data-b24-chart]               — график: JSON-конфиг ChartOptions внутри или data-b24-chart="#id"
 *   [data-b24-sparkline="3,5,4,8"] — спарклайн (data-color — свой цвет)
 *   .b24-settings[data-b24-settings] — страница настроек: подсветка раздела, панель сохранения, событие b24:settings-save
 *   .b24-wizard[data-b24-wizard]   — мастер по шагам: проверка полей, события b24:wizard-next / b24:wizard-finish
 *   table[data-b24-grid="ключ"]    — грид: ширина/порядок/видимость столбцов th[data-key] (сохраняются), меню ☰ строк,
 *                                    групповые действия; JSON-конфиг GridOptions в <script> внутри .b24-table-wrap
 *                                    или data-b24-grid-config="#id"; data-resizable / data-reorderable / data-settings="false"
 * В конце init() проверяет компоновку шапки (checkLayout): основная кнопка или фильтр справа — console.warn.
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

  root.querySelectorAll<HTMLElement>('[data-b24-vendor]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    const config = readJsonConfig<VendorOptions>(el, 'b24Vendor');
    if (!config) return;
    el.dataset.b24Ready = '1';
    el.querySelectorAll('script[type="application/json"]').forEach((s) => s.remove());
    const counter = el.dataset.counter !== undefined ? Number(el.dataset.counter) : config.counter;
    createVendor(el, { ...config, counter });
  });

  root.querySelectorAll<HTMLTableElement>('table[data-b24-grid]').forEach((table) => {
    if (table.dataset.b24GridReady) return;
    table.dataset.b24GridReady = '1';
    const d = table.dataset;
    const wrap = table.closest<HTMLElement>('.b24-table-wrap');
    const config = (d.b24GridConfig ? readJsonConfig<GridOptions>(table, 'b24GridConfig') : wrap ? readJsonConfig<GridOptions>(wrap, 'b24GridConfigInline') : null) ?? {};
    wrap?.querySelectorAll(':scope > script[type="application/json"]').forEach((s) => s.remove());
    const flag = (v?: string) => (v === undefined ? undefined : v !== 'false');
    initGrid(table, {
      ...config,
      id: d.b24Grid || config.id,
      resizable: flag(d.resizable) ?? config.resizable,
      reorderable: flag(d.reorderable) ?? config.reorderable,
      settings: flag(d.settings) ?? config.settings,
    });
  });
  root.querySelectorAll<HTMLElement>('[data-b24-gallery]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    initGallery(el);
  });

  root.querySelectorAll<HTMLElement>('.b24-topnav[data-b24-topnav]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    initTopnav(el);
  });

  root.querySelectorAll<HTMLElement>('.b24-site-header[data-b24-site-header]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    initSiteHeader(el);
  });

  root.querySelectorAll<HTMLElement>('.b24-anchor-nav[data-b24-anchor-nav]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    initAnchorNav(el);
  });

  root.querySelectorAll<HTMLAnchorElement>('a.b24-video[data-b24-video]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    initVideo(el);
  });

  root.querySelectorAll<HTMLElement>('.b24-toc[data-b24-toc]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    initToc(el);
  });

  root.querySelectorAll<HTMLElement>('[data-b24-cookie]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    initCookieNotice(el);
  });

  const once = (sel: string, fn: (el: HTMLElement) => unknown) => root.querySelectorAll<HTMLElement>(sel).forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    fn(el);
  });
  once('.b24-check-group[data-b24-check-group]', initCheckGroup);
  once('[data-b24-range]', initRange);
  once('.b24-colors[data-b24-colors]', initColors);
  once('.b24-secret[data-b24-secret]', initSecret);
  root.querySelectorAll<HTMLElement>('[data-b24-repeater]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    initRepeater(el);
  });
  root.querySelectorAll<HTMLElement>('[data-b24-chart]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    const cfg = readJsonConfig<ChartOptions>(el, 'b24Chart');
    if (!cfg) return;
    el.dataset.b24Ready = '1';
    createChart(el, cfg);
  });
  root.querySelectorAll<HTMLElement>('[data-b24-sparkline]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    sparkline(el, el.dataset.b24Sparkline!.split(',').map(Number).filter((n) => !Number.isNaN(n)), { color: el.dataset.color });
  });
  root.querySelectorAll<HTMLElement>('.b24-settings[data-b24-settings]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    initSettings(el);
  });
  root.querySelectorAll<HTMLElement>('.b24-wizard[data-b24-wizard]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    initWizard(el);
  });
  root.querySelectorAll<HTMLElement>('[data-b24-theme-switch]').forEach((el) => {
    if (el.dataset.b24Ready) return;
    el.dataset.b24Ready = '1';
    initThemeSwitch(el);
  });

  root.querySelectorAll<HTMLElement>('[data-b24-rating]').forEach((el) => {
    if (el.dataset.b24Ready || getRating(el)) return;
    el.dataset.b24Ready = '1';
    const d = el.dataset;
    createRating(el, {
      name: d.name, value: Number(d.value ?? 0), max: d.max ? Number(d.max) : undefined,
      readonly: d.readonly !== undefined && d.readonly !== 'false', disabled: d.disabled !== undefined && d.disabled !== 'false',
      clearable: d.clearable !== 'false', size: d.size as 'sm' | 'lg' | undefined, label: d.label,
    });
  });

  // правила компоновки шапки (dist/AGENTS.md): замечания в консоль; <html data-b24-layout-check="off"> — выключить
  if (document.documentElement.dataset.b24LayoutCheck !== 'off') warnLayout(root);
}
setAutoInit(init);

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
    // копирование блока кода: [data-b24-copy] внутри .b24-code или с текстом в атрибуте
    const copyBtn = target.closest<HTMLElement>('[data-b24-copy]');
    if (copyBtn) {
      const text = copyBtn.dataset.b24Copy || copyBtn.closest('.b24-code')?.querySelector('pre')?.textContent || '';
      void copyText(text).then((ok) => { copyBtn.classList.toggle('is-done', ok); setTimeout(() => copyBtn.classList.remove('is-done'), 1200); });
      return;
    }
    // раскрывающаяся строка таблицы: кнопка с aria-controls → строка .b24-table__details
    const expander = target.closest<HTMLButtonElement>('.b24-table__expander[aria-controls]');
    if (expander) {
      const row = document.getElementById(expander.getAttribute('aria-controls')!);
      if (!row) return;
      const open = expander.getAttribute('aria-expanded') !== 'true';
      expander.setAttribute('aria-expanded', String(open));
      expander.setAttribute('aria-label', open ? t('Скрыть подробности') : t('Показать подробности'));
      row.hidden = !open;
      expander.dispatchEvent(new CustomEvent('b24:row-expand', { bubbles: true, detail: { open, row } }));
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

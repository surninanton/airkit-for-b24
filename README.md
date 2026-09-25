# sdk-ui-bitrix24

UI-кит для своих приложений в стиле Битрикс24 (дизайн **Air**). Три слоя, используйте любой:

| Слой | Что это | Где удобно |
|---|---|---|
| **CSS** (`b24ui.css`) | токены `--b24-*` + классы компонентов `.b24-*` | PHP/Jinja/любые шаблоны |
| **Vanilla JS** (`b24ui.js`, `window.B24UI`) | тосты, модалки, confirm, слайдер, дропдауны, вкладки, сортировка таблиц | серверные шаблоны без фреймворка |
| **React** (`sdk-ui-bitrix24/react`) | типизированные компоненты поверх тех же классов | Vite/React-фронты |

Значения токенов (цвета, радиусы, тени, размеры, типографика) сняты с живого портала на Air. Весь CSS, JS, иконки и фон-подложка написаны заново: из Битрикс24 ничего не скопировано.

## Быстрый старт

```bash
npm install
npm run dev      # витрина: demo/index.html (чистый HTML) и demo/react.html (React CRM-пример)
npm run build    # dist/: b24ui.css, b24ui.min.css, tokens.css, b24ui.js (IIFE), js/, react/, icons/ (ESM + d.ts)
```

## PHP / серверные шаблоны

```html
<link rel="stylesheet" href="/assets/b24ui.min.css">
<script src="/assets/b24ui.js" defer></script>

<body class="b24-root">
  <div class="b24-app b24-app--air">
    <div class="b24-toolbar">
      <div class="b24-toolbar__row">
        <h1 class="b24-toolbar__title">Журнал</h1>
        <button class="b24-btn b24-btn--success">Создать</button>
      </div>
    </div>

    <div class="b24-card">
      <div class="b24-card__header"><h2 class="b24-card__title">Правила</h2></div>
      <div class="b24-card__body">…</div>
    </div>
  </div>
</body>
```

Декларативные атрибуты (инициализируются автоматически, повторный `B24UI.init(root)` безопасен):

| Атрибут | Эффект |
|---|---|
| `data-b24-dropdown="#menu"` | кнопка открывает `.b24-popup` с `.b24-menu` |
| `data-b24-tabs` + `data-b24-tab="id"` / `data-b24-tab-panel="id"` | вкладки |
| `table[data-b24-sortable]` + `th[aria-sort]`, `input[data-b24-check-all]` | сортировка и «выбрать все» (события `b24:sort`, `b24:selection`) |
| `data-b24-dismiss` | закрывает ближайший `.b24-alert` |
| `data-b24-tooltip="Текст"` | тултип (только CSS) |
| `data-b24-shell-toggle` | свернуть сайдбар `.b24-shell` |
| `input[data-b24-datepicker]` | календарь; `="range"` — период в одном поле, `data-b24-to="#id"` — второе поле, `data-min`/`data-max` (дата или `today`), `data-time` |
| `[data-b24-kanban]` | drag & drop карточек `.b24-kanban-card[data-id]` между `.b24-kanban__column[data-column]`; цвет колонки — `data-color`; событие `b24:kanban-move` (`preventDefault()` — откат) |
| `select[data-b24-combobox]` | select с поиском, группами (`optgroup`) и тегами для `multiple`; сам `<select>` остаётся в форме |
| `[data-b24-entity-selector]` | выбор сотрудников/отделов/сущностей тегами; конфиг `TagSelectorOptions` в JSON; `name` → скрытые поля формы |
| `[data-b24-uploader]` | загрузчик: `data-name`, `data-url`, `data-accept`, `data-max-size` (МБ), `data-single`, `data-view="grid"`; без `data-url` файлы уходят с формой |
| `[data-b24-editor]` | карточка с полями (как «О сделке»); JSON `EntityEditorOptions`; событие `b24:editor-save` (`preventDefault()` + `detail.resolve()` / `reject(err)`) |
| `[data-b24-composer]` | композер таймлайна; событие `b24:composer-submit` `{ text, tab }` |
| `[data-b24-filter]` | фильтр; конфиг `FilterOptions` в `<script type="application/json">` внутри; событие `b24:filter-apply` с готовым REST-фильтром |

Императивный API:

```js
B24UI.toast('Сохранено', { type: 'success' });
B24UI.toast('Удалено', { action: { label: 'Отменить', onClick: restore } });
const ok = await B24UI.confirm('Удалить сделку?', { danger: true, okText: 'Удалить' });
const m = B24UI.modal({ title: 'Настройки', content: node, buttons: [{ text: 'Сохранить', variant: 'success', onClick: save }] });
const panel = B24UI.openSidePanel({ title: 'Сделка #42', content: node, air: true, footer });
B24UI.setTheme('dark');            // light | dark | auto
B24UI.setAirPreset('violet');      // blue | violet | teal | graphite
B24UI.bx24.autoFitFrame();         // высота фрейма = высота контента (растёт и уменьшается); во фрейме модалки и тосты — у места клика
B24UI.bx24.scrollParent(0);        // прокрутить страницу портала к началу приложения

B24UI.datepicker(input, { mode: 'range', min: new Date() });
B24UI.enableKanbanDnd(board, { onMove: async (m) => (await save(m)) !== false }); // false → карточка вернётся
B24UI.createFilter(el, { fields, presets, submit: 'get' });  // 'get' → ?filter[STAGE_ID]=NEW… для $_GET
```

### Выбор сотрудников из портала

```js
// внутри приложения Битрикс24: поиск идёт через REST user.search
B24UI.createTagSelector(el, { name: 'ASSIGNED_BY_ID', load: B24UI.bx24UserLoader(), tabs: [{ id: 'users', title: 'Сотрудники' }] });
```

### Загрузка файлов

Без `url` и `upload` файлы складываются в настоящий `<input type="file" name>` и уходят с формой в `$_FILES`. С `url` каждый файл уходит POST-запросом (multipart) с прогрессом; из JSON-ответа `{ id, url }` берётся `id`, и id загруженных файлов попадают в скрытые поля `name[]`. Своя загрузка, например в Диск Битрикс24, передаётся через `upload(file, { onProgress, signal })`.

### Фильтр → REST Битрикс24

Состояние фильтра само превращается в `filter` для `crm.*.list`: `toBitrixFilter(fields, state)`.

```js
// поля: { id: 'DATE_CREATE', type: 'date' }, { id: 'OPPORTUNITY', type: 'number' }, { id: 'STAGE_ID', type: 'select' }
// «Текущий месяц» + сумма от 1000 + стадия NEW →
{ ">=DATE_CREATE": "2026-09-01", "<=DATE_CREATE": "2026-09-30T23:59:59", ">=OPPORTUNITY": 1000, "=STAGE_ID": "NEW" }
```

Типы полей: `text` (`%`), `select` (`=`), `multiselect` (`@`), `number` (`>=`/`<=`), `date` (периоды: вчера/сегодня/неделя/месяц/квартал/последние N дней/точная дата/диапазон), `checkbox` (`Y`/`N`). Имя поля REST задаётся через `b24Field`, если оно отличается от `id`.

## React

```tsx
import 'sdk-ui-bitrix24/css';
import { B24Provider, App, Toolbar, SplitButton, SearchInput, DataTable, SidePanel, Stages, toast } from 'sdk-ui-bitrix24/react';

<B24Provider theme="light">
  <App air>
    <Toolbar
      title="Сделки"
      actions={<SplitButton icon="plus" onClick={create} menu={[{ label: 'Импорт', icon: 'upload' }]}>Создать</SplitButton>}
      search={<SearchInput glass value={q} onChange={(e) => setQ(e.target.value)} />}
    />
    <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} selectable selected={sel} onSelectionChange={setSel} />
  </App>
</B24Provider>
```

Компоненты: `Button`, `SplitButton`, `ButtonGroup`, `Field`, `Input`, `InputGroup`, `SearchInput`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Card`, `SectionTitle`, `Props`, `Stat`, `EmptyState`, `Badge`, `Counter`, `Tag`, `Dot`, `Alert`, `Avatar`, `AvatarStack`, `User`, `Spinner`, `Loader`, `Skeleton`, `Progress`, `Stages`, `StageMini`, `Tabs`, `DataTable`, `Pagination`, `Modal`, `SidePanel`, `Dropdown`, `Menu`, `Popover`, `Tooltip`, `Icon`, `Calendar`, `DatePicker`, `DateRangePicker`, `PeriodPicker`, `Filter`, `Kanban` (+ `KanbanCard`, `applyKanbanMove`), `Combobox`, `EntitySelector`, `Uploader`, `EntityEditor`, `Timeline` (+ `TimelineItem`, `TimelineActivity`, `TimelineDivider`, `TimelineComposer`), раскладка: `B24Provider`, `App`, `Toolbar`, `AppShell`, `Sidebar`, `SidebarGroup`, `SidebarItem`, `TopNav`.

Канбан в React контролируемый: DnD только сообщает о переносе, состояние обновляете вы.

```tsx
<Kanban
  columns={stages.map((s) => ({ id: s.id, title: s.name, color: s.color, total: money(sum(s.id)) }))}
  items={byStage}
  getId={(d) => d.id}
  onMove={(m) => setByStage((prev) => applyKanbanMove(prev, m, (d) => d.id))}
  renderCard={(d) => <KanbanCard title={d.title} price={money(d.sum)} footerRight={d.date} />}
/>
```

Полный пример — `demo/react-demo.tsx`: вкладки «Список», «Канбан», «Календарь», фильтр в тулбаре. Карточка сделки (клик по названию) — это `EntityEditor` и `Timeline` с композером, делами и файлами. В «Создать» есть `EntitySelector`, `Combobox` и `Uploader`.

## Раскладки

- **`.b24-app`**: приложение внутри фрейма портала (плейсмент). Модификатор `--air` включает фирменную подложку, `--white` делает белый фон.
- **`.b24-shell`**: самостоятельное приложение с сайдбаром, шапкой и верхним меню, как сам портал. На мобильных сайдбар выезжает поверх контента.

## Токены и кастомизация

Все значения лежат в CSS-переменных, см. `src/styles/tokens.css`. Переопределять можно глобально или на любом контейнере:

```css
:root { --b24-color-primary: #6a4cff; --b24-radius-md: 6px; }
.my-widget { --b24-bg-surface: #fafafa; }
```

Отдельно можно подключить только токены: `sdk-ui-bitrix24/tokens.css`.

## Структура

```
src/styles/   tokens.css, themes.css, base.css, components/*.css
src/js/       vanilla-модули + global.ts (IIFE-сборка)
src/react/    React-компоненты
src/icons/    собственный набор иконок (строки SVG + <Icon>)
demo/         витрина (vite)
```

## Альтернатива

Если проект на Vue/Nuxt, посмотрите официальный кит [`@bitrix24/b24ui-nuxt`](https://bitrix24.github.io/b24ui/). Этот пакет закрывает React и серверные шаблоны.

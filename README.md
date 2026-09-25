# airkit-for-b24

Неофициальный UI-кит для приложений Битрикс24 в стиле портала (дизайн **Air**). Три слоя, используйте любой:

| Слой | Что это | Где удобно |
|---|---|---|
| **CSS** (`b24ui.css`) | токены `--b24-*` + классы компонентов `.b24-*` | PHP/Jinja/любые шаблоны |
| **Vanilla JS** (`b24ui.js`, `window.B24UI`) | тосты, модалки, confirm, слайдер, дропдауны, вкладки, сортировка таблиц | серверные шаблоны без фреймворка |
| **React** (`airkit-for-b24/react`) | типизированные компоненты поверх тех же классов | Vite/React-фронты |

Значения токенов (цвета, радиусы, тени, размеры, типографика) сняты с живого портала на Air. Весь CSS, JS, иконки и фон-подложка написаны заново: из Битрикс24 ничего не скопировано.

## Зачем этот проект

Приложения для Битрикс24 открываются прямо внутри портала: в том же окне, рядом с CRM, задачами и лентой. Пользователь не разделяет «портал» и «стороннее приложение». Для него это одна система, и если на одном экране она выглядит аккуратно, а на соседнем как самодельная админка из 2008 года, система целиком кажется сырой.

К сожалению, разработчики сторонних решений для Битрикс24 слишком часто не утруждают себя интерфейсом. Приложения собирают по принципу «и так сойдёт»: голые таблицы, разнобой шрифтов и кнопок, формы без выравнивания, ошибки в виде `alert()`.

Мне не раз попадались приложения, где на одной странице вперемешку свалены полноразмерные скриншоты портала и настройки самого приложения. Этакая инструкция, которая своим видом только мешает разобраться в функционале. Будь это новички, я бы сделал скидку. Но увы: чаще всего это команды, которые в теме уже слишком давно, чтобы им её делать. И таких, как вы сами знаете, на маркетплейсе много.

Обиднее всего, что для приличного результата не нужно ничего особенного. Даже взяв Bootstrap или любой другой готовый набор компонентов, можно за вечер получить аккуратный и понятный интерфейс. Но и этого часто не делают, и такой подход меня, честно говоря, озадачивает: функциональность вложена, а до пользователя она доходит в виде, в котором ей трудно доверять.

В своих приложениях я стараюсь держаться упорядоченной логики и делать интерфейс хотя бы понятным: чтобы человек сразу видел, где он, что может сделать и что произошло после нажатия кнопки. Этот кит вырос из этого стремления. Это набор компонентов, который повторяет визуальный язык самого Битрикс24 (дизайн Air), чтобы приложение выглядело частью портала, а не чужеродной вставкой.

### Отдельный проект для сообщества

Этот кит вырос из моих собственных приложений для Битрикс24. Подход к интерфейсу складывался в них годами, от проекта к проекту. В какой-то момент стало понятно, что это уже не набор стилей под конкретное приложение, а самостоятельная вещь. Я выделил её в отдельный проект и отдаю сообществу.

Идея простая: чтобы сторонние приложения говорили с пользователем на одном языке. Не каждое на своём диалекте, а на визуальном языке самого Битрикс24. Кнопки, формы, таблицы, карточки выглядят и ведут себя так, как пользователь уже привык в портале.

Дальше проект живёт своей жизнью: развивается вместе с приложениями, которые на нём построены, и с теми, кто захочет его использовать. Если вам близка эта идея, берите, пользуйтесь и присылайте улучшения.

### Почему стиль Битрикс24, а не просто Bootstrap

Приложение живёт внутри портала, поэтому родной вид важнее просто красивого: пользователю не нужно переучиваться, кнопки, поля и карточки ведут себя так, как он привык. Значения цветов, радиусов, теней и размеров сняты с живого портала, но весь код, иконки и фон написаны заново. Из Битрикс24 ничего не скопировано.

### Кому подойдёт

Официальный кит Битрикса ([`@bitrix24/b24ui`](https://bitrix24.github.io/b24ui/)) сделан под Vue/Nuxt. Этот работает и в React, и в обычных серверных шаблонах (PHP, Jinja): подключаете один CSS и один скрипт, и формы остаются обычными HTML-формами, которые уходят на сервер как есть.

### Что внутри

Не только кнопки и поля, но и то, что обычно приходится писать самому: канбан с перетаскиванием, фильтр, который сразу превращается в REST-фильтр для `crm.*.list`, выбор сотрудников, загрузка файлов, карточка с редактированием полей, таймлайн, подгонка фрейма приложения под контент.

### Статус

Кит уже работает в реальном приложении. Именно там всплыли и были исправлены тонкости работы во фрейме портала: высота и ширина фрейма, модалки у места клика. При этом версия пока 0.x: API может меняться, автотестов нет, все надписи на русском.

> Это неофициальный проект. Он не связан с компанией «1С-Битрикс» и не поддерживается ею. «Битрикс24» — товарный знак правообладателя.

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
import 'airkit-for-b24/css';
import { B24Provider, App, Toolbar, SplitButton, SearchInput, DataTable, SidePanel, Stages, toast } from 'airkit-for-b24/react';

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

## Приложение во фрейме портала

`B24UI.bx24.autoFitFrame()` подгоняет высоту фрейма под контент в обе стороны, ширина остаётся 100%.
- Рост идёт через `BX24.fitWindow()`. Уменьшение: `BX24.resizeWindow(текущая ширина, h)`, а в его колбэке снова `fitWindow()`, чтобы вернуть ширину 100%. Ширину `'100%'` в `resizeWindow` передавать нельзя: там стоит `parseInt`, и получится 100px.
- На `<html>` ставится класс `b24-in-frame`: у `.b24-app` и `.b24-shell` снимается `min-height: 100vh`, а модалки, `confirm` и тосты появляются у места последнего клика. У фрейма нет своего скролла, поэтому по центру фрейма они ушли бы за экран.
- Фрейм не бывает ниже высоты, которую ему дал портал при открытии: `.b24-app` дотягивается до неё через `--b24-frame-min-height`, поэтому под коротким контентом не проступает подложка портала. Свой предел: `autoFitFrame({ minHeight: 900 })`, без предела: `{ minHeight: 0 }`.
- `ResizeObserver` не срабатывает в фоновой вкладке браузера: фрейм подгоняется, когда вкладка снова отрисовывается. Для пользователя это незаметно, но учитывайте при автотестах.
- Боковая панель (`openSidePanel`) во фрейме пока открывается на всю высоту фрейма, без привязки к месту клика.

## Токены и кастомизация

Все значения лежат в CSS-переменных, см. `src/styles/tokens.css`. Переопределять можно глобально или на любом контейнере:

```css
:root { --b24-color-primary: #6a4cff; --b24-radius-md: 6px; }
.my-widget { --b24-bg-surface: #fafafa; }
```

Отдельно можно подключить только токены: `airkit-for-b24/tokens.css`.

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

## Лицензия

[MIT](LICENSE) © 2026 Anton Surnin. Кит можно бесплатно использовать в любых проектах, в том числе коммерческих, менять и распространять. Обязательное условие одно: сохранять копирайт и текст лицензии. Копирайт уже стоит в шапке `b24ui.css` и `b24ui.js`, поэтому достаточно их не вырезать.

### Просьба ♥

Лицензия этого не требует, но если кит вам пригодился, оставьте, пожалуйста, в подвале приложения маленькую ссылку на репозиторий. Так о ките узнают другие разработчики, и приложений с нормальным интерфейсом станет больше.

```html
<!-- готовая разметка -->
<footer class="b24-credit-footer">
  <a class="b24-credit" href="https://github.com/surninanton/airkit-for-b24" target="_blank" rel="noopener">
    <!-- иконка GitHub --> <span>Сделано на airkit-for-b24</span> <span class="b24-credit__heart">♥</span>
  </a>
</footer>
```

```js
// vanilla: ссылка с иконкой GitHub и сердечком
footer.innerHTML = B24UI.creditHtml();
```

```tsx
// React
import { Credit } from 'airkit-for-b24/react';
<Credit />
```


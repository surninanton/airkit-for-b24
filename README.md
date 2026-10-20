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

## Правила кита

Кит не только набор компонентов, но и договорённость о том, как выглядит порядочное стороннее приложение внутри Битрикс24. Лицензия MIT не может обязать им следовать. Но если вы используете кит, пожалуйста, соблюдайте эти правила: ради них он и сделан.

### 1. Блок разработчика: всегда и в одном месте

Пользователь должен с первого взгляда понимать, что перед ним стороннее приложение, чьё оно и куда идти с вопросом. Поэтому в каждом приложении есть блок разработчика:

- **Место:** правый конец верхней строки приложения (служебный угол шапки раздела `aside` или шапка `AppShell`), последним элементом.
- **Логотип:** горизонтальный, **высота 24 px**, ширина до 140 px, SVG или PNG @2x. Для синей подложки Air можно дать светлую версию (`logoOnDark`).
- **Нет горизонтального логотипа** (квадратный или вертикальный): иконка **24×24** плюс название компании текстом. На узких экранах остаётся только иконка.
- **Меню по клику:**
  - заголовок: название и версия приложения, «Разработчик: …»;
  - **Поддержка:** «Мои обращения» и «Новое обращение» (страница, слайдер или ссылка);
  - **Политика конфиденциальности;**
  - Лицензионное соглашение (`license`), Контакты (`contacts`) — по желанию;
  - Сайт разработчика, Приложение в Маркетплейсе (по желанию).
- **Обязательно:** название, поддержка, политика конфиденциальности (`links.privacy`, а не в `extra`). Если чего-то не хватает, кит пишет предупреждение в консоль (`checkVendor`).

```html
<div class="b24-page-header__aside">
  …
  <span data-b24-vendor>
    <script type="application/json">
    { "name": "Кедр Софт", "logo": "/img/logo.svg", "logoOnDark": "/img/logo-white.svg", "icon": "/img/icon.svg",
      "app": { "name": "Планировщик", "version": "1.4.0" },
      "links": { "support": "/support", "newTicket": "/support/new", "privacy": "https://example.com/privacy",
                 "contacts": "https://example.com/contacts", "site": "https://example.com", "marketplace": "https://…" } }
    </script>
  </span>
</div>
```

```tsx
// React: проп vendor у <PageHeader> или <AppShell> сам ставит блок последним справа
<AppShell vendor={{ name: 'Кедр Софт', logo, logoOnDark, icon, app: { name: 'Мини-CRM', version: '0.9.2' },
  links: { support: () => openSidePanel({ title: 'Мои обращения', content }), privacy: '…', contacts: '…' } }} … />
```

Ссылка может быть URL (откроется в новой вкладке) или функцией: например, открыть слайдер со списком обращений прямо в приложении.

**Непрочитанные ответы поддержки.** Красная наклейка на кнопке блока (перед шевроном, остаётся и на телефоне, где видна только иконка) и у пункта «Мои обращения». Начальное значение — `counter` в конфиге или `data-counter="3"` у `[data-b24-vendor]`; потом:

```js
B24UI.getVendor('[data-b24-vendor]').setCounter(5);   // 0 — скрыть, больше 99 — «99+»
// или без доступа к блоку:
el.dispatchEvent(new CustomEvent('b24:vendor-counter', { detail: { count: 5 } }));
```

В React — проп `counter` у `<Vendor>` (блок не пересоздаётся). `getVendor` принимает контейнер, кнопку или селектор.

**Ссылки своего сайта.** По умолчанию все ссылки меню открываются в новой вкладке: внутри фрейма Битрикс24 ссылка на `/…` иначе открылась бы в самом фрейме. На сайте разработчика задайте `"sameOrigin": "self"` — ссылки на `/…` и на тот же домен откроются в этой же вкладке, внешние по-прежнему в новой.

### 2. Шапка раздела: как в портале

Приложение выглядит как раздел портала, если его шапка устроена как в CRM и Задачах. Порядок задаёт компонент `createPageHeader` / `<PageHeader>` (и CSS `.b24-page-header`), переставить слоты нельзя:

```
[Обзор] [Действия] [Журнал 11] [Поддержка]                       сведения о портале  [Разработчик ▾]
Обращения портала  [+ Создать ▾]  [Все ▾]  [фильтр и поиск ………]                                 [⚙]
[Список|Доска]  [2 Без ответа] [0 Мои]                                                   [Роботы] [•••]
```

- вкладки приложения — меню раздела, первой строкой (как «Сделки · Товары · Клиенты» в CRM);
- «Создать» сразу после заголовка, затем селекторы и фильтр; справа только кнопки-иконки (`tools`), второстепенное (`extra`) и служебный угол с блоком разработчика (`aside`);
- `init()` и `<PageHeader>` пишут в консоль замечание, если основная кнопка или фильтр стоят справа (`checkLayout()`).

Все правила и примеры для агентов — в [`AGENTS.md`](AGENTS.md), он же лежит в `dist/AGENTS.md`. В CLAUDE.md своего приложения достаточно строки: «UI — по правилам из …/dist/AGENTS.md».

## Быстрый старт

```bash
npm install
npm run dev      # витрина: demo/index.html (чистый HTML) и demo/react.html (React CRM-пример)
npm run build    # dist/: b24ui.css, b24ui.min.css, tokens.css, b24ui.js (IIFE), js/, react/, icons/ (ESM + d.ts)
```

Тесты поведения — Playwright на демо-страницах, на ширине 1280 и 390px (сервер поднимается сам):

```bash
npm test         # сайт, экраны, редакторы, элементы управления и компоненты приложения на 1280 и 390px
```

Изменения по версиям — в [CHANGELOG.md](CHANGELOG.md), планы — в [BACKLOG.md](BACKLOG.md).

## PHP / серверные шаблоны

```html
<link rel="stylesheet" href="/assets/b24ui.min.css">
<script src="/assets/b24ui.js" defer></script>

<body class="b24-root">
  <div class="b24-app b24-app--air">
    <header class="b24-page-header">
      <div class="b24-page-header__main">
        <h1 class="b24-page-header__title">Журнал</h1>
        <div class="b24-page-header__create"><button class="b24-btn b24-btn--success">Создать</button></div>
      </div>
    </header>

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
| `input[data-b24-timepicker]` | выбор времени `HH:MM`: попап часы/минуты, `data-step` (1/5/10/15/30, по умолчанию 15), `data-min`, `data-max`, `data-strict="false"` — разрешить некратные минуты; ввод «9», «930», «9:30», «09.30»; ↑/↓ — ±шаг |
| `[data-b24-multi]` | несколько значений тегами: `data-type="time"` (редактор — timepicker) или `"select"` (варианты — `<option>` внутри); `data-name` → скрытые поля `name[]`, `data-max` — сколько значений, `data-values="09:00,14:30"`, `data-unique`, `data-sort`, `data-min-time`/`data-max-time`; событие `b24:multi-change` |
| `table[data-b24-grid="ключ"]` | грид как в Б24: ширина столбцов (двойной клик по границе — по содержимому), перетаскивание столбцов, ⚙ — видимость; всё сохраняется в `localStorage` под ключом. Столбцы — `th[data-key]`, строки — `tr[data-id]`. JSON-конфиг внутри `.b24-table-wrap`: `rowActions` (меню ☰, `tr[data-actions]` ограничивает пункты), `groupActions` (панель «Отмечено: N»). Закрепление слева — `th[data-pinned]` или 📌 в ⚙. Редактирование в ячейке — `th[data-edit="text|number|select|date"]` (+ `data-edit-options` для select, сырое значение — `td[data-value]`). События `b24:row-action`, `b24:group-action`, `b24:grid-change`, `b24:cell-edit` |
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

### Расписание: время запуска

```html
<form method="post">
  <input class="b24-input" name="DATE_FROM" data-b24-datepicker data-b24-to="#to"> — <input class="b24-input" id="to" name="DATE_TO">
  <div data-b24-multi data-type="time" data-name="TIMES" data-max="6" data-step="15" data-values="09:00,14:30"></div>
  <div data-b24-multi data-type="select" data-name="DAYS"><option value="1" selected>Пн</option><option value="2">Вт</option>…</div>
</form>
<!-- POST: TIMES[]=09:00&TIMES[]=14:30&DAYS[]=1 -->
```

JS: `B24UI.timepicker(input, { step, min, max, strict, onChange, onSelect })`, `B24UI.multiValue(el, { type, options, values, max, unique, sort, name })`.

### Грид (таблица как в Битрикс24)

```html
<div class="b24-table-wrap">
  <table class="b24-table" data-b24-grid="deals" data-b24-sortable>
    <thead><tr>
      <th class="b24-table__cell-check"><label class="b24-check"><input type="checkbox" data-b24-check-all></label></th>
      <th data-key="title" aria-sort="none" data-pinned>Сделка</th>   <!-- закреплён слева -->
      <th data-key="sum" aria-sort="none" data-edit="number">Сумма</th>
      <th data-key="comment" data-hidden>Комментарий</th>   <!-- скрыт по умолчанию -->
      <th data-key="note" data-edit="text">Заметка</th>     <!-- двойной клик / Enter — изменить -->
    </tr></thead>
    <tbody><tr data-id="42">…</tr></tbody>
  </table>
  <script type="application/json">
  { "rowActions": [{ "id": "edit", "label": "Изменить", "icon": "edit" }, { "id": "delete", "label": "Удалить", "icon": "trash", "danger": true }],
    "groupActions": [{ "id": "delete", "label": "Удалить", "variant": "tinted-danger", "confirm": "Удалить отмеченные ({n})?" }] }
  </script>
</div>
```

Сохранение ячейки на сервер (vanilla): слушайте `b24:cell-edit`, вызовите `e.preventDefault()`, затем `e.detail.resolve('что показать')` или `e.detail.reject('текст ошибки')`. Пока идёт запрос, в ячейке крутится индикатор. При ошибке поле остаётся открытым, текст ошибки виден под ним. Enter сохраняет, Esc отменяет, Tab переходит к следующей редактируемой ячейке строки. Можно и через опцию `onCellEdit` в `initGrid`.

```tsx
// столбцы: { key: 'title', pinned: true, … }, { key: 'sum', editable: { type: 'number', value: (r) => String(r.sum) } }
<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} selectable selected={sel} onSelectionChange={setSel}
  onCellEdit={async (row, key, value) => { await api.update(row.id, key, value); /* throw — ошибка под полем */ }}
  stateKey="deals" resizable reorderable columnSettings
  rowActions={(row) => [{ label: 'Открыть', icon: 'eye', onClick: () => open(row) }]}
  groupActions={[{ id: 'delete', label: 'Удалить', variant: 'tinted-danger', confirm: 'Удалить ({n})?', onClick: (ids) => remove(ids) }]} />
```

#### Открытие записи кликом по строке

Как в списках Битрикс24: клик по строке открывает запись.

- **Со ссылкой**: `<tr data-id="42" data-href="/deal/42/">` — переход по ссылке; Ctrl/⌘-клик или средняя кнопка — новая вкладка.
- **Своим кодом**: `<table data-b24-grid="deals" data-row-open>` (или `rowOpen: true`) — для всех строк; слушайте `b24:row-open { id, row, href, newTab }`. Или колбэк `onRowOpen(id, row, event)` в `initGrid` — тогда переход по `data-href` не делается.
- **Не открывают** клики по ссылкам, кнопкам, полям, чекбоксу, ☰, редактируемым ячейкам и по `[data-no-open]`, а также выделение текста. `e.preventDefault()` в `b24:row-open` отменяет переход, `tr[data-open="false"]` — строку не открывать.
- **React**: `onRowClick={(row) => open(row)}` у `DataTable`.

#### Подвал грида: действия, «Всего», страницы

Под таблицей — одна панель, как в списках Битрикс24: «Отмечено: N / M», «Всего: N» (или ссылка «Показать количество»), кнопки действий и постраничный вывод. Панель прилипает к низу окна, пока таблица на экране.

```json
{ "groupActions": [
    { "id": "stop", "label": "Остановить", "variant": "secondary" },
    { "id": "delete", "label": "Удалить", "variant": "tinted-danger", "confirm": "Удалить отмеченные ({n})?" },
    { "id": "stop-filter", "label": "Остановить по фильтру ({total})", "when": "none" },
    { "id": "delete-filter", "label": "Удалить по фильтру ({total})", "variant": "tinted-danger", "when": "none", "hint": "Сначала выберите фильтр" } ],
  "total": 4210,
  "pagination": { "page": 1, "pageSize": 50, "pageSizes": [20, 50, 100, 200, 500], "mode": "both" } }
```

- **`when`** у действия: `selected` (по умолчанию) — только когда есть отмеченные, `none` — когда ничего не отмечено («по фильтру»), `always`. В подписи и подтверждении: `{n}` — отмечено, `{total}` — всего.
- **Событие то же**: `b24:group-action { action, ids, scope }` / `onGroupAction(action, ids)`; у действий «по фильтру» `ids` пустой, `scope: 'filter'`. Без `confirm` встроенного подтверждения нет — показывайте своё.
- **`disabled`** — `true` или функция `({ selected, total }) => boolean` (в JS); `hint` — подсказка у кнопки.
- **Панель видна всегда**, если есть действия «по фильтру» или пагинация; `actionPanel: 'auto'` — только при отметке.
- **Всего**: `total` или `onCountRequest: () => Promise<number>` — тогда вместо числа ссылка «Показать количество»; `grid.setTotal(n)`.
- **Страницы**: номера (`mode: 'pages'`), «Показать ещё» (`'more'`) или оба (`'both'`). Размер страницы запоминается в localStorage вместе с состоянием грида. События `b24:page-change { page, pageSize }`, `b24:page-size-change { pageSize }` — или колбэки `onPageChange`, `onPageSizeChange`.
- **«Показать ещё»**: `onLoadMore: () => Promise<html | tr[] | { rows, hasMore }>` или, для серверных шаблонов, событие `b24:load-more` — ответьте сразу промисом: `e.detail.respond(fetch(…).then((r) => r.text()))`. Новые строки встают в тот же `tbody`: отметка, «выбрать все», ☰-меню и счётчики работают; `hasMore: false` прячет кнопку.
- **Размер страницы из localStorage**: если сохранённый размер отличается от отрисованного сервером, после инициализации приходит `b24:page-size-change { pageSize, restored: true }` (и `onPageSizeChange`). Подписывайтесь до `DOMContentLoaded` — инлайн-скриптом или модулем.
- **Доступ к гриду из автоинициализации**: `B24UI.getGrid(table | '#selector')` → методы `replaceRows(html | tr[], { hasMore, total, page })` (заменить строки, например первой порцией нового размера), `appendRows(…)`, `getSelectedIds()`, `clearSelection()`, `setTotal(n)`, `setPagination({…})`, `getPagination()`. После вставки строк счётчики, «выбрать все» и «Показать ещё» обновляются сами.
- **Во фрейме портала** у документа нет своего скролла, и где низ окна — фрейм не знает. Поэтому там панель стоит сразу под таблицей, а в длинной таблице (выше 600px) при отметке строки всплывает рядом с местом клика.

### Выбор сотрудников из портала

```js
// внутри приложения Битрикс24: поиск идёт через REST user.search
B24UI.createTagSelector(el, { name: 'ASSIGNED_BY_ID', load: B24UI.bx24UserLoader(), tabs: [{ id: 'users', title: 'Сотрудники' }] });
```

### Загрузка файлов

Без `url` и `upload` файлы складываются в настоящий `<input type="file" name>` и уходят с формой в `$_FILES`. С `url` каждый файл уходит POST-запросом (multipart) с прогрессом; из JSON-ответа `{ id, url }` берётся `id`, и id загруженных файлов попадают в скрытые поля `name[]`. Своя загрузка, например в Диск Битрикс24, передаётся через `upload(file, { onProgress, signal })`.

### Фильтр → REST Битрикс24

Фильтр — часть шапки раздела: в портале строка «Фильтр и поиск» стоит после заголовка, «Создать» и селекторов. Своей ширины у `.b24-filter` нет, её задаёт контейнер; в шапке это `.b24-page-header__filter` (растягивается, но не шире 560px). На подложке Air — `"glass": true`.

```html
<header class="b24-page-header">
  <div class="b24-page-header__main">
    <h1 class="b24-page-header__title">Сделки</h1>
    <div class="b24-page-header__create"><button class="b24-btn b24-btn--success">Создать</button></div>
    <div class="b24-page-header__filter">
      <div data-b24-filter>
        <script type="application/json">{ "glass": true, "fields": [ … ], "presets": [ … ] }</script>
      </div>
    </div>
  </div>
</header>
```

В JS — `createPageHeader(host, { title, create, filter: { fields, presets } })`, в React — `<PageHeader filter={<Filter glass … />}>`. Фильтр на всю ширину карточки — просто положите его в карточку.

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
import { B24Provider, App, PageHeader, SearchInput, DataTable, SidePanel, Stages, toast } from 'airkit-for-b24/react';

<B24Provider theme="light">
  <App air>
    <PageHeader
      title="Сделки"
      create={{ onClick: create, menu: [{ label: 'Импорт', icon: 'upload' }] }}
      filter={<SearchInput glass value={q} onChange={(e) => setQ(e.target.value)} />}
    />
    <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} selectable selected={sel} onSelectionChange={setSel} />
  </App>
</B24Provider>
```

Компоненты: `Button`, `SplitButton`, `ButtonGroup`, `Field`, `Input`, `InputGroup`, `SearchInput`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Card`, `SectionTitle`, `Props`, `Stat`, `EmptyState`, `Badge`, `Counter`, `Tag`, `Dot`, `Alert`, `Avatar`, `AvatarStack`, `User`, `Spinner`, `Loader`, `Skeleton`, `Progress`, `Stages`, `StageMini`, `Tabs`, `DataTable`, `Pagination`, `Modal`, `SidePanel`, `Dropdown`, `Menu`, `Popover`, `Tooltip`, `Icon`, `Calendar`, `DatePicker`, `DateRangePicker`, `PeriodPicker`, `Vendor`, `Filter`, `Kanban` (+ `KanbanCard`, `applyKanbanMove`), `Combobox`, `EntitySelector`, `Uploader`, `EntityEditor`, `Timeline` (+ `TimelineItem`, `TimelineActivity`, `TimelineDivider`, `TimelineComposer`), раскладка: `B24Provider`, `App`, `PageHeader`, `Toolbar` (устарел для шапки раздела), `AppShell`, `Sidebar`, `SidebarGroup`, `SidebarItem`, `TopNav`.

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

Полный пример — `demo/react-demo.tsx`: шапка раздела `<PageHeader>`, вид «Список», «Канбан», «Календарь». Карточка сделки (клик по названию) — это `EntityEditor` и `Timeline` с композером, делами и файлами. В «Создать» есть `EntitySelector`, `Combobox` и `Uploader`.

## Раскладки

- **`.b24-app`**: приложение внутри фрейма портала (плейсмент). Модификатор `--air` включает фирменную подложку, `--white` делает белый фон.
- **`.b24-page-header`**: шапка раздела страницы — меню раздела, заголовок, «Создать», селекторы, фильтр, вид, счётчики (правило 2, `createPageHeader` / `<PageHeader>`).
- **`.b24-shell`**: самостоятельное приложение с сайдбаром, шапкой и верхним меню, как сам портал. На мобильных сайдбар выезжает поверх контента.

## Экраны приложения

Типовые экраны, которые каждое приложение иначе собирает заново. Пример — `demo/screens.html` (вкладки «Дашборд», «Настройки», «Мастер настройки», «Пустые состояния»).

| Класс / функция | Что это |
|---|---|
| `.b24-empty` + `--neutral`, `--access`, `--error`, `--success`; `--compact`, `--glass`; `__actions`, `__note` | пустые состояния: «нет данных», «ничего не найдено», «нет доступа», «ошибка загрузки», «готово». `--compact` — внутри карточки, `--glass` — прямо на подложке Air |
| `.b24-settings[data-b24-settings]` > `nav.b24-settings__nav` (`a.b24-settings__link`) + `form.b24-settings__body` (`.b24-settings__section`) | страница настроек: разделы слева с подсветкой текущего, на узком экране — лентой сверху |
| `.b24-setting` (`--block`, `--danger`) > `__label`, `__hint`, `__control` | строка настройки: подпись и пояснение слева, контрол справа |
| `.b24-savebar` + `[data-b24-settings-reset]` | панель «Есть несохранённые изменения» — появляется сама при правках, «Отменить» возвращает сохранённые значения. Событие `b24:settings-save` `{ values, resolve, reject }`: `preventDefault()` — сохраняете сами, иначе форма отправится обычным образом. Уход со страницы с правками спрашивает подтверждение |
| `.b24-dashboard` + `.b24-span-3/4/6/8/12` | сетка дашборда на 12 колонок, на узком экране — в одну |
| `.b24-kpi` > `__label`, `__value`, `__row` (`__delta--up/down/flat`, `__period`, спарклайн) | плитка с цифрой |
| `ul.b24-meters` > `.b24-meter` (`style="--value: 70"`) | рейтинг полосами без графика |
| `[data-b24-chart]` (JSON внутри) / `createChart(el, options)` | графики: `line`, `area`, `bar` (рядом или `stacked`), `donut`. Подсказка при наведении, легенда от двух серий, скрытая таблица для скринридеров, перерисовка по ширине. Цвета — токены `--b24-chart-1…6` в фиксированном порядке, отдельные для тёмной темы; палитра проверена на различимость при дальтонизме |
| `[data-b24-sparkline="3,5,4,8"]` / `sparkline(el, data)` | линия тренда без осей |
| `ol.b24-stepper` (`--vertical`) > `.b24-stepper__item` (`is-done`, `is-current`, `is-error`) | шаги процесса |
| `.b24-wizard[data-b24-wizard]` > `__head` (степпер), `__step`, `__foot` (`[data-b24-wizard-back/next/finish]`, `__counter`) | мастер первой настройки. Без JS шаги идут подряд одной формой. С JS: «Далее» проверяет поля шага, событие `b24:wizard-next` `{ index, waitUntil(promise) }` — например, проверить подключение (отклонённый промис помечает шаг ошибкой); `b24:wizard-finish` `{ values, waitUntil }` |

React: `<Chart>`, `<Sparkline>`, `<Kpi>`, `<Stepper>`, `<SettingRow>`, `<SaveBar>`, `<EmptyScreen>`.

```html
<div data-b24-chart>
  <script type="application/json">
    { "type": "bar", "labels": ["Пн", "Вт", "Ср"], "series": [{ "name": "Запуски", "data": [2310, 2480, 2290] }] }
  </script>
</div>
```

## Редакторы полей

Сложные поля форм настройки интеграций. Всё поведение доступно из vanilla JS, поэтому обёртки для Vue и других фреймворков получаются тонкими: создать виджет в `onMounted`, передать значение, слушать `onChange`, вызвать `destroy()` при размонтировании. Пример — `demo/editors.html`.

| Функция / класс | Что это |
|---|---|
| `createCombobox(host, { items, value, creatable, counter, groupBy, onChange })` | выпадающий список без `<select>`: группы (например, «Системные / Пользовательские» по префиксу `UF_`), поиск по названию и коду (`subtitle`), счётчик «N из M», свободный ввод. Значение не из справочника показывается с пометкой «не из списка» и сохраняется |
| `select[data-b24-combobox][data-creatable][data-counter]` | то же для серверной формы: своё значение добавляется новым `<option>` |
| `createRepeater(host, { values, create, render, addLabel, emptyText, min, max, onChange })` | повторяющиеся строки: добавить, удалить, пустое состояние, фокус не теряется. Содержимое строки рисует `render(body, value, ctx)`, `ctx.update(patch)` меняет значение |
| `[data-b24-repeater]` + `<template>` + `[data-b24-repeater-add]` / `[data-b24-repeater-remove]` | повторитель для PHP-форм: имена `rows[0][key]` перенумеровываются, `data-max` — предел строк |
| `createKeyValue(host, { pairs, key, value, onChange })` | пары «ключ → значение» со стрелкой. Колонка — список (`items`, своё значение разрешено) или текст (`items: null` — справочник не загрузился) |
| `createFieldMapper(host, options)` | сопоставление полей: источник (колонка или шаблон `{{Имя}} {{Фамилия}}` со вставкой колонки) → поле Битрикс24 → правило обновления (`always`, `if_empty`, `if_changed`, `never`). Кнопка ⚙ открывает преобразование: словарь значений `{ type: 'value_map', map: { 'из': 'в' }, on_missing: 'pass' | 'default' | 'skip' | 'fail', default? }` (`dictionary(target)` — справочник с группами, например стадии по воронкам), сумма прописью `{ type: 'amount_words', currency?: 'рубль', fraction?: 'копейка' }`, склонение `{ type: 'inflect', case: 'genitive' }` (падежи полными английскими названиями). Пустой словарь с `pass` отдаётся как `null`. Конфиги всех типов помнятся, наружу уходит выбранный. `setErrors({ '3.target': '…' })` — ошибки сервера по пути. Для дочерней сущности — второй экземпляр со своим `targetFields` |
| `createCombobox(host, { load, loadById, display: 'chip' })` | поиск на сервере (задачи, вопросы Metabase); число в поиске ищет ещё и по ID; выбранное — чипом с аватаром, ссылкой (`href`), `#id` (`meta`) и крестиком |
| `createLogViewer(host, { load({ cursor, levels, signal }) })` | журнал в тёмной консоли: фильтр уровней, раскрытие контекста (JSON с подсветкой) и стектрейса, копирование записи, «Загрузить ещё» по курсору |
| `codeHtml(lines)` / `jsonHtml(value)` / `traceHtml(trace)` | блок кода со строками разного тона и кнопкой копирования, подсветка JSON и стектрейса |
| `tr.is-danger` / `is-warning` / `is-success` / `is-info` у `.b24-table` | тон строки: ошибка, расхождение, совпадение. В React — `rowTone={(row) => …}` у `DataTable` |
| `.b24-table__expander[aria-controls]` + `tr.b24-table__details[hidden]` | раскрывающаяся строка с деталями. В React — `renderExpanded={(row) => …}` (`expanded` / `onExpandedChange` — контролируемо) |
| `diffHtml(before, after, { field })` / `<DiffValue>` | «Поле: ~~было~~ → станет», одинаковые — «(без изменений)», пустые — «пусто» |
| `chipHtml(title, { href, id })` / `<Chip>`, `.b24-chips` | ссылка-чип на карточку «#123 Название» |
| `.b24-cell-choice` | выбор прямо в ячейке: заголовок, радиокнопки, кнопка |

React: `<Combobox creatable counter groupBy>`, `<KeyValueEditor>`, `<FieldMapper>`, `<LogViewer>`, `<CodeBlock>`, `<JsonView>`, `<DiffValue>`, `<Chip>`; у `<DataTable>` — `rowTone`, `renderExpanded`.

```js
const mapper = B24UI.createFieldMapper(el, {
  sourceFields: [{ value: 'status', label: 'Статус' }],
  targetFields: [{ value: 'STAGE_ID', label: 'Стадия', subtitle: 'STAGE_ID' }],
  dictionary: (field) => (field === 'STAGE_ID' ? loadStages() : null), // можно Promise
  value: savedMappings,
  onChange: (mappings) => { form.mappings = mappings; },
});
```

## Элементы управления

Пример — `demo/controls.html`.

| Класс / функция | Что это |
|---|---|
| `.b24-accordion` > `details.b24-accordion__item` > `summary.b24-accordion__head` + `.b24-accordion__body` | аккордеон для приложения без JS: шеврон, счётчик, `__meta`, вложенность, `name="…"` — открыт один; `--flush` — без подложки |
| `.b24-radio-cards` > `label.b24-radio-card` (`__icon`, `__title`, `__desc`) | карточки-радио: рамка цвета `--b24-radio-card-color`, галочка в углу. С checkbox — множественный выбор |
| `.b24-check-group[data-b24-check-group]` | список чекбоксов с прокруткой, «Выбрано N из M», ссылки «все / очистить», `#id` у пункта |
| `.b24-segmented` | сегментированный переключатель на радиокнопках (`--wide` — на всю ширину) |
| `input.b24-range[data-b24-range]`, `.b24-range-pair[data-b24-range]` | ползунок и диапазон с двумя ручками; значение — в `.b24-range-field__value`, `data-suffix` — единица |
| `.b24-colors[data-b24-colors]` | палитра цветов Битрикс24 и свой цвет |
| `.b24-secret[data-b24-secret]` | поле секрета с «глазом»; `data-saved` — значение уже сохранено: поле пустое, маска и «введите новое, чтобы заменить» |
| `createTree(host, { items, select: 'single' \| 'multiple' })` | дерево разделов или отделов с клавиатурой как в ARIA tree |
| `popover(anchor, { title, text, actions })` | всплывающая подсказка с кнопками |
| `startTour([{ target, title, text }])` | обучение по шагам: затемнение с окном вокруг элемента |
| `applyServerErrors(form, errors)` / `clearServerErrors(form)` | ответ Laravel 422 (`{ errors: { 'notify.chat_id': [...] } }`) — в ошибки полей по `name="notify[chat_id]"`; возвращает ошибки без поля |
| `crmEntityUrl(type, id, typeId?, base?)` | ссылка на карточку CRM: `deal`, `contact`, … или `entityTypeId`; смарт-процессы — `/crm/type/{typeId}/details/{id}/` |
| `plural(n, ['запись', 'записи', 'записей'])`, `formatCount` | русское множественное число |
| `.b24-badge > .b24-spinner`, `.b24-dot--pulse` | бейдж со спиннером и пульсирующая точка «идёт» |
| `toast(…)` | одинаковые тосты склеиваются со счётчиком «×3», видимых не больше четырёх |
| `[data-b24-rating]`, `createRating(host, { name, value, max, readonly })` | оценка звёздами: скрытое поле `data-name`, `data-value`, `data-max` (5), `data-readonly` — только показ, `data-disabled`, `data-size="sm\|lg"`; наведение, клик (повторный — сброс, `data-clearable="false"` — без сброса), стрелки, Home/End, цифры. Событие `b24:rating-change { value }`, `getRating(el).setValue(n)` |

React: `Accordion`, `AccordionItem`, `RadioCards`, `CheckGroup`, `Segmented`, `Range`, `RangePair`, `ColorPicker`, `SecretInput`, `Tree`, `Rating` (`<Rating value onChange readOnly max name />`).

## Планировщик: сотрудники и время

`createScheduler(host, options)` — шкала «сотрудники × время» по мотивам Bryntum Scheduler, на токенах кита. Пример — `demo/scheduler.html`.

- **Строки** — сотрудники (`resources`: `id`, `name`, `avatar`, `meta` — должность, `group` — отдел; отделы сворачиваются). Видимые строки рисуются по мере прокрутки — сотни сотрудников не тормозят.
- **Шкала** — день, неделя, месяц; кнопки «назад / сегодня / вперёд». В дне и неделе показаны часы `hours: [8, 20]` — ночь не занимает место. Ctrl/⌘ + колесо — масштаб. Линия «сейчас».
- **График работы** (`bands`): смены `kind: 'work'` светлые, остальное время приглушено; отпуск, больничный, командировка — штриховкой с подписью.
- **Встречи** (`events`): перетаскивание по времени и на другого сотрудника, растягивание за края, создание выделением пустого места, шаг привязки `step` (15 минут). С клавиатуры: Alt+←/→ — сдвиг, Alt+Shift+←/→ — длительность, Enter — открыть, Delete — удалить.
- **Сервер решает**: `onChange({ event, start, end, resourceId, previous })` — отклонённый промис откатывает изменение; `onCreate`, `onClick`, `onDelete`. Данные периода — `load({ start, end }, signal)`.
- **Подсказки**: пересечения встреч у одного сотрудника и встречи во время отсутствия — красная рамка, вне рабочего времени — пунктир; загрузка сотрудника за видимый период в процентах.
- Из портала: `bx24SchedulerLoader(userIds)` — занятость из календаря Битрикс24 (`calendar.accessibility.get`).

```js
B24UI.createScheduler(el, {
  resources: [{ id: '1', name: 'Алиса Мельникова', meta: 'Менеджер', group: 'Продажи' }],
  bands: [{ resourceId: '1', start: '2026-10-05T09:00', end: '2026-10-05T18:00', kind: 'work' }],
  events: [{ id: 'm1', resourceId: '1', start: '2026-10-05T10:00', end: '2026-10-05T11:00', title: 'Демо' }],
  onChange: ({ event, start, end, resourceId }) => api.moveMeeting(event.id, start, end, resourceId),
});
```

React: `<Scheduler resources events bands onChange …>`.

## Сайт и лендинги приложений

Для сайта разработчика и страниц приложений (витрина, описания, политики) есть отдельный набор компонентов. Они работают без JavaScript, так что документы видны и роботу кабинета Битрикс24. JS нужен только лайтбоксу галереи и мобильному меню. На Air-подложке текст белый, элементы «стеклянные». Для светлого фона есть модификаторы `--light` / `--dark`. Пример — `demo/site.html`.

| Класс | Что это |
|---|---|
| `.b24-prose` | длинный текст описаний: абзацы, `h2–h4`, списки, `code`, ссылки |
| `.b24-document` (+ `.b24-document-card`) | политики и соглашения: `h1` + «Редакция от…», `h2`, таблицы с рамками (на ≤640px строки становятся карточками), `blockquote` |
| `.b24-product-card` | карточка приложения: иконка 56px, название, бейдж, описание, подвал со ссылками. Кликабельна вся карточка (растянутая ссылка `__link`), ссылки подвала — отдельные цели |
| `.b24-gallery[data-b24-gallery]` | сетка скриншотов в рамке «как в портале». Без JS ссылка открывает картинку, с JS — лайтбокс (←/→, Esc, подпись, счётчик) |
| `.b24-brand` | знак + название в шапке |
| `.b24-topnav[data-b24-topnav]` | меню сайта: без JS пункты переносятся, с JS на ≤768px прячутся в «☰» |
| `.b24-site-footer` | подвал: колонки (`__row`), `__brand`, `__title`, `__links`, нижняя строка `__bottom` с дисклеймером и credit |
| `.b24-hero` | заголовок `clamp(30px, 5vw, 46px)`, подзаголовок, кнопки, место под скриншот (`__media`) |
| `.b24-features` (`--glass`) | плитки преимуществ: иконка, заголовок, текст |
| `.b24-steps` (`--glass`) | шаги «как это работает»: горизонтально, на ≤768px — столбиком |
| `.b24-linklist` (`--inline`) | список документов: иконка, название, подпись |
| `.b24-section-label` | капс-подпись над группой карточек |
| `.b24-breadcrumbs` (`--glass`) | хлебные крошки (`<ol>`, `aria-current="page"`) |
| `.b24-changelog` | история версий: версия, дата, пункты с бейджами |
| `.b24-site-layout` | две колонки (контент + боковая 320px), на ≤920px — одна |


### Корпоративный сайт: раскладка и маркетинговые блоки

Полноценная страница сайта — `.b24-site` (Air-подложка на всю страницу) со стопкой секций. Пример — `demo/landing.html`.

| Класс | Что это |
|---|---|
| `.b24-site`, `.b24-container` (`--narrow`, `--wide`) | страница сайта и контейнер по ширине |
| `.b24-section` (`--air`, `--light`, `--white`, `--compact`) + `__head`, `__eyebrow`, `__title`, `__lead` | секции с чередованием подложки и светлого фона, единые отступы |
| `.b24-site-header[data-b24-site-header]` | липкая шапка: бренд, меню `.b24-site-nav` (ссылки и группы `details.b24-site-nav__group` с мегаменю `.b24-megamenu`), кнопки `__actions`. Без JS группы раскрываются кликом. С JS: на ≤960px бургер, Esc и клик мимо закрывают, при прокрутке фон плотнее |
| `.b24-megamenu--panes` > `.b24-megamenu__cat` (`__cat-label` с `input[type=radio]` + `__pane`), `__all`, `__footer` (`__footer-lead`, `__footer-links`) | мегаменю с категориями: слева категории, справа панель выбранной (`__pane-head`, `__grid` с `a.b24-megamenu__item`, `__empty`; под описанием пункта — метки `__tags` > `__tag`, например «for Bitrix24»). Без JS переключается кликом и стрелками ↑/↓ (радиокнопки + `:has()`), с JS — ещё и наведением. На ≤960px — аккордеон. Включается само внутри `data-b24-site-header` |
| `.b24-anchor-nav[data-b24-anchor-nav]` | липкое якорное меню под шапкой, подсвечивает текущую секцию |
| `.b24-site-pagination` (`--glass`) | пагинация сайта ссылками |
| `.b24-cta` (`--glass`, `--accent`, `--center`) | полоса призыва: заголовок, текст, кнопки |
| `.b24-pricing` > `.b24-pricing__period` + `.b24-plans` > `.b24-plan` (`is-featured`) | тарифы. Переключатель «месяц/год» на радиокнопках, без JS: цены `data-period="month|year"` |
| `.b24-compare-wrap` > `table.b24-compare` | сравнение: строки-группы, выделенная колонка, ✓/—, первая колонка липкая |
| `.b24-faq` (`--glass`) > `details.b24-faq__item` | вопросы-ответы на `details/summary` (`name="…"` — открыт один) |
| `.b24-numbers` (`--glass`, `--divided`) > `.b24-number` | крупные цифры с подписями |
| `.b24-quotes` > `figure.b24-quote`, `.b24-logos` (`--glass`) | отзывы и монохромные логотипы |
| `.b24-people` > `.b24-person` | команда |
| `.b24-contacts`, `.b24-channels` > `a.b24-channel`, `a.b24-map` | контакты: каналы связи, реквизиты (`.b24-props`), карта-заглушка (или `iframe` внутри) |
| `a.b24-video[data-b24-video]` | видео с постером: без JS ссылка на ролик, с JS плеер на месте (`data-embed` — iframe) |
| `.b24-display-1/2/3`, `.b24-lead`, `.b24-measure`, `.b24-text-center` | крупные заголовки и утилиты текста |

### Контент сайта: статьи, блог, формы, документы

Страницы читаются без JS; скрипт нужен только для оглавления, cookie-уведомления и переключателя темы. Примеры — `demo/article.html`, `demo/blog.html`, `demo/about.html`, `demo/docs.html`.

| Класс | Что это |
|---|---|
| `.b24-article-layout` > `article.b24-article` + `nav.b24-toc[data-b24-toc]` | статья с липким оглавлением справа. `__header`, `__tags`, `__title`, `__lead`, `__meta` (автор, дата, время чтения), `__cover`, `__footer`. Пустой `<ol>` в оглавлении собирается из h2/h3 блока `data-source`, текущий раздел подсвечивается |
| `figure.b24-figure`, `.b24-table-scroll`, таблицы в `.b24-prose` | иллюстрации с подписью, таблицы с прокруткой на узком экране |
| `.b24-callout` (`--tip`, `--warning`, `--danger`) + `__icon`, `__title` | врезки «совет / внимание» |
| `.b24-posts` > `.b24-post-card` | карточки статей; ссылка `__link` растянута на всю карточку |
| `ol.b24-news` > `.b24-news__item` | лента новостей: дата, заголовок, текст, теги |
| `.b24-arrow-link` (`--glass`) | ссылка «Читать далее →» |
| `.b24-badge--soon/--new/--free/--beta/--hit` (`--glass`) | бейджи «Скоро», «Новое», «Бесплатно» и др. |
| `form.b24-site-form` (`--glass`) + `__title`, `__text`, `__actions` | форма обратной связи. Ошибки полей — `:user-invalid` и `.b24-field__error-hint`, без JS |
| `.b24-consent` | чекбокс согласия на обработку данных |
| `.b24-form-status` (`--success`, `--error`) | результат отправки, который отдаёт сервер. `.is-sent` на форме оставляет только заголовок и статус; статус с `--on-sent` можно положить в разметку заранее — он появится вместе с `.is-sent` |
| `form.b24-subscribe` (`--glass`) | подписка: поле и кнопка в строку |
| `.b24-cookie[data-b24-cookie]` + `[data-b24-cookie-accept]` | уведомление о cookie; согласие хранится в localStorage (ключ — значение атрибута) |
| `nav.b24-lang-switch` | переключатель языка ссылками (`aria-current` у текущего) |
| `button.b24-theme-switch[data-b24-theme-switch]` + `__light`, `__dark` | светлая/тёмная тема, выбор запоминается. Чтобы тема не мигала, до стилей вызовите `applyStoredTheme()` или прочитайте `b24-theme` из localStorage |
| `.b24-page-bar` > `__title` + `__tabs` (`__full`/`__short`) | строка «заголовок + вкладки-пилюли» страницы приложения; на узком экране короткие подписи |
| `.b24-app-intro` > `__icon` (72px), `__body`, `__text` | карточка-вступление приложения: иконка, статус, описание |
| `.b24-props--columns` | реквизиты в колонки |
| `ul.b24-doc-index` > `.b24-doc-index__item` | документы, сгруппированные по приложениям |
| печать | `@media print`: у `.b24-document` и статьи убираются шапка, подвал, оглавление и подложка |

## Приложение во фрейме портала

`B24UI.bx24.autoFitFrame()` подгоняет высоту фрейма под контент в обе стороны, ширина остаётся 100%.
- Рост идёт через `BX24.fitWindow()`. Уменьшение: `BX24.resizeWindow(текущая ширина, h)`, а в его колбэке снова `fitWindow()`, чтобы вернуть ширину 100%. Ширину `'100%'` в `resizeWindow` передавать нельзя: там стоит `parseInt`, и получится 100px.
- На `<html>` ставится класс `b24-in-frame`: у `.b24-app` и `.b24-shell` снимается `min-height: 100vh`, а модалки, `confirm` и тосты появляются у места последнего клика. У фрейма нет своего скролла, поэтому по центру фрейма они ушли бы за экран.
- Фрейм не бывает ниже высоты, которую ему дал портал при открытии: `.b24-app` дотягивается до неё через `--b24-frame-min-height`, поэтому под коротким контентом не проступает подложка портала. Свой предел: `autoFitFrame({ minHeight: 900 })`, без предела: `{ minHeight: 0 }`.
- `ResizeObserver` не срабатывает в фоновой вкладке браузера: фрейм подгоняется, когда вкладка снова отрисовывается. Для пользователя это незаметно, но учитывайте при автотестах.
- Боковая панель (`openSidePanel`) во фрейме пока открывается на всю высоту фрейма, без привязки к месту клика.
- Строка фильтра и поиска — часть шапки раздела (`.b24-page-header__filter`), а не отдельный блок на всю ширину: так приложение выглядит как разделы портала. Пример — в разделе «Фильтр → REST Битрикс24», правила — в [`AGENTS.md`](AGENTS.md).

## Язык подписей

Встроенные подписи компонентов («Закрыть», «Сегодня», «Ничего не найдено», названия месяцев) есть на русском и английском. Язык берётся из `<html lang="…">` (`en*` — английский, иначе русский) или задаётся явно — до отрисовки компонентов:

```js
B24UI.setLocale('en');
// свой язык: ключ — русская фраза, без перевода остаётся русский текст
B24UI.addMessages('kk', { 'Сохранить': 'Сақтау', 'Отмена': 'Бас тарту' });
B24UI.setLocale('kk');
B24UI.t('Выбрано {n} из {m}', { n: 2, m: 5 }); // для своих подписей
```

Внутри портала язык пользователя можно взять из `BX24.getLang()`. Числа и даты форматируются по выбранному языку (`intlLocale()`). `plural()` — только для русского.

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


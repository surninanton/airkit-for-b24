# airkit-for-b24

Неофициальный UI-кит для приложений Битрикс24 в стиле портала (дизайн **Air**).

**Демо:** [airkit.appb24.ru](https://airkit.appb24.ru) — все компоненты, экраны приложения, React-пример и страницы сайта.

Три слоя, используйте любой:

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

### Раздел и подразделы: как CRM в Битрикс24

В левом меню — только разделы («CRM», «Расписание смен»). Подразделы раздела («Сделки · Счета · Компании · Контакты») — **меню раздела** над заголовком, а не вложенные пункты сайдбара.

- **Сайдбар**: пункт раздела подсвечен на всех его подстраницах — `aria-current="page"` (или `"true"`, или `.is-active`) ставит сервер / роутер по префиксу адреса; в React — `<SidebarItem active>`. Вложенных пунктов в сайдбаре нет.
- **Меню раздела**: `menu` у `createPageHeader` / `<PageHeader>` (или разметка `.b24-page-header__nav > nav.b24-topnav.b24-page-header__menu`). Текущий подраздел — `active` / `aria-current="page"`, счётчик — `counter` / `<span class="b24-counter">` внутри пункта.
- **В шапке оболочки** (на одной линии с брендом, как в Битрикс24): `<TopNav>` / `.b24-topnav` прямо в `.b24-shell__header`; на телефоне меню переносится отдельной строкой во всю ширину.
- **«Ещё ▾»**: пункты, что не помещаются по ширине, сами уходят в выпадающее меню «Ещё» со своими счётчиками; сумма счётчиков — на «Ещё», открытый подраздел всегда остаётся на виду. Работает в шапке раздела и `<TopNav>`, для своей разметки — `.b24-topnav[data-b24-more]` или `initTopnavMore(nav)`; выключить — `data-b24-more="off"`.
- **Вид страницы** (Канбан · Список · Дела) — вторая строка шапки: `views` или `.b24-tabs.b24-tabs--glass` (на тёмной подложке, сам по себе с отступами и скруглением) / `.b24-tabs--pills` на светлой.

```html
<aside class="b24-shell__sidebar"><nav class="b24-sidebar">…
  <a class="b24-sidebar__item" href="/staff/schedule/" aria-current="page">Расписание смен</a>   <!-- и на /staff/schedule/team/ -->
</nav></aside>
<header class="b24-page-header">
  <div class="b24-page-header__nav">
    <nav class="b24-topnav b24-page-header__menu" aria-label="Разделы">
      <a class="b24-topnav__item" href="/staff/schedule/" aria-current="page">Расписание</a>
      <a class="b24-topnav__item" href="/staff/schedule/team/">Состав смен <span class="b24-counter">3</span></a>
      <a class="b24-topnav__item" href="/staff/schedule/wishes/">Пожелания</a>
    </nav>
  </div>
  <div class="b24-page-header__main"><h1 class="b24-page-header__title">Расписание</h1>…</div>
  <div class="b24-page-header__sub">
    <div class="b24-page-header__views"><div class="b24-tabs b24-tabs--glass" data-b24-tabs>
      <button class="b24-tabs__item" data-b24-tab="week" aria-selected="true">Неделя</button><button class="b24-tabs__item" data-b24-tab="month">Месяц</button>
    </div></div>
  </div>
</header>
```

## Быстрый старт

```bash
npm install
npm run dev      # витрина: demo/index.html (чистый HTML) и demo/react.html (React CRM-пример)
npm run build:demo   # сборка витрины в dist-demo/ (её публикует .github/workflows/pages.yml на airkit.appb24.ru)
npm run build    # dist/: b24ui.css, b24ui.min.css, tokens.css, b24ui.js (IIFE), js/, react/, icons/ (ESM + d.ts)
```

Тесты поведения — Playwright на демо-страницах, на ширине 1280 и 390px (сервер поднимается сам):

```bash
npm test         # сайт, экраны, редакторы, элементы управления и компоненты приложения на 1280 и 390px
```

Изменения по версиям — в [CHANGELOG.md](CHANGELOG.md).

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
| `data-b24-shell-toggle` | свернуть сайдбар `.b24-shell` (на мобильном — открыть меню). Место бургера — строка логотипа: `<div class="b24-sidebar__brand"><button class="b24-sidebar__toggle" data-b24-shell-toggle aria-label="Меню">…</button><a class="b24-sidebar__brand-link" href="/"><span class="b24-sidebar__brand-mark">24</span><span class="b24-sidebar__brand-text">Мой портал</span></a></div>` (логотип-ссылка — рядом с кнопкой, не вокруг неё; без ссылки — те же `span` прямо в `__brand`; в React — `<Sidebar brandHref="/">`); в свёрнутом сайдбаре он встаёт вместо логотипа, а такая же кнопка в `.b24-shell__header` остаётся только на мобильном |
| `input[data-b24-datepicker]` | календарь; `="range"` — период в одном поле, `data-b24-to="#id"` — второе поле, `data-min`/`data-max` (дата или `today`), `data-time` |
| `[data-b24-kanban]` | drag & drop карточек `.b24-kanban-card[data-id]` между `.b24-kanban__column[data-column]`; цвет колонки — `data-color`; событие `b24:kanban-move` (`preventDefault()` — откат). Нужен **либо** атрибут, **либо** `enableKanbanDnd(board)`; повторный вызов безопасен — обработчики не дублируются |
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
// содержимое окна и панели инициализируется само (data-b24-rating, -datepicker, -combobox… из <template>); autoInit: false — выключить
// content-строка вставляется как текст (защита от XSS); готовую разметку — через B24UI.html('<p>…</p>') или DOM-узел
// onClick кнопки вернул промис — у неё загрузка, остальные кнопки окна заблокированы до завершения; false — окно не закрывается
B24UI.setTheme('dark');            // light | dark | auto
B24UI.setAirPreset('violet');      // blue | violet | teal | graphite
B24UI.bx24.autoFitFrame();         // высота фрейма = высота контента (растёт и уменьшается); во фрейме модалки и тосты — у места клика
B24UI.bx24.scrollParent(0);        // прокрутить страницу портала к началу приложения

B24UI.datepicker(input, { mode: 'range', min: new Date() });
B24UI.enableKanbanDnd(board, { onMove: async (m) => (await save(m)) !== false }); // false → карточка вернётся
// повторный вызов для той же доски не навешивает обработчики второй раз, а заменяет опции; колонки с data-color красит сам
B24UI.paintKanbanColumns(board);   // после перерисовки innerHTML — перекрасить шапки (--column-color, --column-text)
// «+ Быстрый элемент», как на портале: <button class="b24-kanban__add b24-kanban__add--round"> под шапкой колонки
B24UI.enableKanbanQuickAdd(board, {
  fields: [{ name: 'title', placeholder: 'Имя', required: true }, { name: 'vacancy', type: 'select', options }],
  onSave: async (values, columnId) => { await api.add(values, columnId); },  // Enter — сохранить и ввести ещё, Esc — закрыть
});
// выбор стадии в карточке: одна строка с прокруткой, края затухают, текущая — по центру
B24UI.stagePicker(el, { stages: [{ id: 'new', title: 'Отклик', color: '#2fc6f6' }, …], value: 'new', onChange: (id, prev) => save(id) }); // false → вернуть
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

Хранилище состояния. Грид (`b24-grid:<id>`, размер страницы `b24-grid:<id>:pageSize`), «частые» эмодзи (`b24-emoji-recent`), тема (`b24-theme`) и принятое уведомление о cookie пишут через общее хранилище; по умолчанию это localStorage. `B24UI.setStorage({ get(key): string | null, set(key, value: string | null) })` подменяет его, например серверным по пользователю: `get` синхронный (данные отдайте в страницу заранее), `set(key, null)` — удалить ключ, запись может быть fire-and-forget; вызывайте до `init()` / `initGrid`. `setStorage(null)` возвращает localStorage, `getStorage()` — текущее. Ошибки `set` в консоль, компонент не падает. Состояние грида — JSON `{ order: string[], widths: Record<string, number> (px), hidden: string[], pinned: string[] }` (ключи — `data-key` столбцов; неизвестные ключи отбрасываются, новые столбцы встают в конец). Что изменилось — `onChange(state)` в `initGrid` (в React — `onGridStateChange`) и событие `b24:grid-change { state }` на таблице. Начальное состояние, главнее хранилища: `initGrid(table, { id, state })`, в React `<Table initialGridState>`.

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

В JS — `createPageHeader(host, { title, create, filter: { fields, presets } })`, в React — `<PageHeader filter={<Filter glass … />}>`. Вне шапки строка фильтра не шире 800px, как в Битрикс24 (`--b24-filter-max-width`); своя ширина — `maxWidth: 600`, на всю ширину контейнера — `maxWidth: 'none'` или класс `.b24-filter--full`.

Число рядом с названием пресета или варианта («Нанят 68») — `count` у пресета и у `options[]`; обновить — `filter.setCounts({ presets: { hired: 70 }, fields: { stage: { new: 3 } } })`. В `<select>` число идёт в скобках.

Состояние фильтра само превращается в `filter` для `crm.*.list`: `toBitrixFilter(fields, state)`. Для своей серверной фильтрации значение поля `type: 'date'` (`{ type: 'week' }`, `{ type: 'range', from, to }`…) переводится в даты через `resolvePeriod(value)` → `{ from, to }` (оба дня включительно, `any` → `null`).

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

Компоненты: `Button`, `SplitButton`, `ButtonGroup`, `Field`, `Input`, `InputGroup`, `SearchInput`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Card`, `SectionTitle`, `Props`, `Stat`, `EmptyState`, `Badge`, `Counter`, `Tag`, `Dot`, `Alert`, `Avatar`, `AvatarStack`, `User`, `Spinner`, `Loader`, `Skeleton`, `Progress`, `Stages`, `StageMini`, `Tabs`, `DataTable`, `Pagination`, `Modal`, `SidePanel`, `Dropdown`, `Menu`, `Popover`, `Tooltip`, `Icon`, `Calendar`, `DatePicker`, `DateRangePicker`, `PeriodPicker`, `Vendor`, `Filter`, `Kanban` (+ `KanbanCard`, `applyKanbanMove`, `StagePicker`), `Combobox`, `EntitySelector`, `Uploader`, `EntityEditor`, `Timeline` (+ `TimelineItem`, `TimelineActivity`, `TimelineDivider`, `TimelineComposer`), `ChatLayout`, `ChatHeader`, `ChatList`, `ChatFeed`, `ChatComposer`, `MessengerBar`, `ChatDock`, раскладка: `B24Provider`, `App`, `PageHeader`, `Toolbar` (устарел для шапки раздела), `AppShell`, `Sidebar`, `SidebarGroup`, `SidebarItem`, `TopNav`.

Канбан в React контролируемый: DnD только сообщает о переносе, состояние обновляете вы.

```tsx
<Kanban
  columns={stages.map((s) => ({ id: s.id, title: s.name, color: s.color, total: money(sum(s.id)) }))}
  items={byStage}
  getId={(d) => d.id}
  onMove={(m) => setByStage((prev) => applyKanbanMove(prev, m, (d) => d.id))}
  renderCard={(d) => <KanbanCard title={d.title} price={money(d.sum)} footerRight={d.date} />}
  onQuickAdd={(stageId, values) => api.add(values, stageId)}   // круглый «+» и форма в колонке; quickAddFields — поля
/>
<StagePicker stages={stages} value={stage} onChange={(id) => setStage(id)} />
```

Колонка канбана не сжимает шапку и карточки: прокручивается только список. Внутри боковой панели одноколоночную сетку делайте через `.b24-rows` (`grid-template-columns: minmax(0, 1fr)`) — тогда строка плашек или таблица не раздвинет панель шире экрана.

Полный пример — `demo/react-demo.tsx`: шапка раздела `<PageHeader>`, вид «Список», «Канбан», «Календарь». Карточка сделки (клик по названию) — это `EntityEditor` и `Timeline` с композером, делами и файлами. В «Создать» есть `EntitySelector`, `Combobox` и `Uploader`.

## Раскладки

- **`.b24-app`**: приложение внутри фрейма портала (плейсмент). Модификатор `--air` включает фирменную подложку, `--white` делает белый фон.
- **`.b24-page-header`**: шапка раздела страницы — меню раздела, заголовок, «Создать», селекторы, фильтр, вид, счётчики (правило 2, `createPageHeader` / `<PageHeader>`).
- **`.b24-shell`**: самостоятельное приложение с сайдбаром, шапкой и верхним меню, как сам портал. Бургер — в строке логотипа сайдбара (`.b24-sidebar__toggle`, в React `<AppShell>` + `<Sidebar>` ставят его сами); свёрнутый сайдбар показывает бургер вместо логотипа. На мобильных сайдбар выезжает поверх контента, бургер — в шапке.

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

### Экран блокировки с кодом-паролем

Быстрый вход по коду на доверенном устройстве — как экран блокировки телефона. Пример — вкладка «Экран блокировки» в `demo/screens.html`.

- Полноэкранный слой на подложке Air (или `video: url`): часы и дата, выбор профиля «Кто продолжит работу?» (один профиль — сразу ввод кода), точки кода, экранная клавиатура (`keypad: false` — без неё), ввод с клавиатуры: цифры, Backspace, Esc — к профилям.
- Кит код **не проверяет и не хранит**: `onSubmit(pin, user)` отправляет его на сервер. Промис выполнен — экран снимается (`onUnlock`, `lock.unlocked`); отклонён — «тряска», текст ошибки из `error.message` («Неверный код, осталось попыток: 2»), код стирается. Лимит попыток и отвязку устройства решает сервер.
- Пока экран открыт, остальная страница недоступна (`inert`) и не прокручивается. Окна, открытые поверх (например, `B24UI.confirm` из `onOtherUser`), встают над экраном и получают клавиши; тосты — выше всех. Слой экрана — `--b24-z-lock`.
- `openPinSetup({ length, onSave })` — окно «Быстрый вход по коду»: код и повтор, только цифры, проверка длины и совпадения.
- `idleLock({ minutes, onIdle })` — вызов после простоя (мышь, клавиатура, касания, прокрутка сбрасывают таймер); возвращает функцию остановки.

```js
const lock = B24UI.createLockScreen({
  users: [{ id: '7', name: 'Алиса Мельникова', meta: 'Менеджер', avatar }],
  length: 4,
  onSubmit: (pin, user) => api.pinLogin(user.id, pin),     // отказ: throw new Error('Неверный код')
  onOtherUser: () => location.assign('/login'),            // ссылка «Войти под другим аккаунтом»
});
await lock.unlocked;
const stop = B24UI.idleLock({ minutes: 15, onIdle: () => B24UI.createLockScreen({ /* … */ }) });
```

React: `<LockScreen open={locked} users onSubmit onUnlock={() => setLocked(false)} />`, `openPinSetup`, `idleLock`.

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
| `avatarHtml(name, src, size, { status: 'online' \| 'away', title })`, `.b24-avatar > .b24-avatar__status` (`.is-away`) | аватар с точкой «в сети» в углу; React — `<Avatar status="online" />` |
| `.b24-badge > .b24-spinner`, `.b24-dot--pulse` | бейдж со спиннером и пульсирующая точка «идёт» |
| `toast(…)` | одинаковые тосты склеиваются со счётчиком «×3», видимых не больше четырёх |
| `[data-b24-rating]`, `createRating(host, { name, value, max, readonly })` | оценка звёздами: скрытое поле `data-name`, `data-value`, `data-max` (5), `data-readonly` — только показ, `data-disabled`, `data-size="sm\|lg"`; наведение, клик (повторный — сброс, `data-clearable="false"` — без сброса), стрелки, Home/End, цифры. Событие `b24:rating-change { value }`, `getRating(el).setValue(n)` |

React: `Accordion`, `AccordionItem`, `RadioCards`, `CheckGroup`, `Segmented`, `Range`, `RangePair`, `ColorPicker`, `SecretInput`, `Tree`, `Rating` (`<Rating value onChange readOnly max name />`).

## Чаты: открытые линии и переписка

Список диалогов, лента сообщений, поле ответа и каркас «список | переписка | карточка» — для омниканальной переписки (Telegram, VK, MAX, сайт) и чата сотрудников. Пример — `demo/chat.html`, в React — раздел «Мессенджер» в `demo/react-demo.tsx`.

- **Каркас** `.b24-chat[data-b24-chat]` > `__list` · `__main` (`__head` + лента + поле) · `__aside` (карточка). Высота — `--b24-chat-height` (по умолчанию `calc(100vh - 200px)`). На ≤1100px карточка выезжает поверх по кнопке `[data-b24-chat-aside]` (закрывается кликом мимо и Esc), на ≤768px одна колонка: выбор диалога открывает переписку, `[data-b24-chat-back]` — назад к списку. `initChatLayout(el)` → `{ openDialog, back, toggleAside }`.
- **Рейл слева** `createChatRail(chatEl, { items, value, onSelect })` / `<ChatLayout rail={<ChatRail items value onSelect />}>` — узкая (68px) полоса «Чаты / Линии / CRM / Телефон» перед `.b24-chat__list`, как в десктопном Битрикс24. Пункт `{ id, label, icon, href?, counter?, title?, disabled? }` — значок с подписью под ним, кнопка или ссылка (`href`); активный — с подложкой и цветом акцента (`aria-current`); `counter` — `b24-counter` на значке. На ≤768px — горизонтальная панель над списком, в открытой переписке (`.is-dialog-open`) скрыта. `setActive`, `setItems`, `update(id, patch)`. Иконки для рейла и софтфона: `headset`, `chart`, `phone`, `phoneIncoming`, `phoneOutgoing`, `phoneMissed`. **Состояние и перерисовка**: `status` — точка на значке (`online` зелёная, `away` оранжевая, `busy` / `disconnected` красная, `offline` серая, `ringing` зелёная с пульсом, значок «звонит»); `attrs` и `className` — свои атрибуты и класс пункта. Кнопки не пересоздаются: `setActive`, `update` и `setItems` меняют только изменившееся, добавленные снаружи атрибуты и классы сохраняются; `buttonOf(id)` — кнопка для popover. **Общий рейл с панелями**: `createChatRail(chat, { panes: true, items: [{ id, pane: 'phone', … }] })` и в разметке несколько `.b24-chat__pane[data-b24-chat-pane="phone"]` (каждая со своей раскладкой список | переписка | карточка) — выбор пункта показывает свою панель (`onPaneChange`, `setPane`). **Раздел «Телефон»**: в панели `.b24-chat__list` с журналом звонков и кнопкой `<button class="b24-chat__open" data-b24-chat-open>` («Набор» — круглая зелёная кнопка, только на телефоне), `.b24-chat__main` с шапкой `[data-b24-chat-back]` и `.b24-chat__center` с клавиатурой; `initChatLayout` переключает журнал и набор.
- **Список** `createChatList(host, { items, value, onSelect })`: аватар (точка `status`), имя, время («14:05», «вчера», «пн», «12.11»), превью с «Вы:» (`previewOut`), бейдж канала (`channel: 'Telegram'` — фирменным цветом, или `{ label, color }`), счётчик `unread`, `muted`. `subtitle` — подпись под именем, когда превью пустое («Чат должности», «в сети»). Стрелки ↑/↓, Home/End, Enter. `update(id, patch)` — новое сообщение без перерисовки списка.
- **Поиск по сообщениям.** Список: результаты — обычные `items` с `group: 'Сообщения'` (id строки уникален — например id сообщения), `highlight` подсвечивает совпадение в `preview` (`'доставка'`, `['цена','срок']` или диапазоны `[[0, 4]]`; до двух строк, начало обрезается, чтобы совпадение было видно), `dialogId` и `messageId` — ваши данные для перехода. Лента: `feed.scrollTo(id, { highlight?, smooth? })` — по центру и короткая подсветка (`.is-flash`), `false`, если сообщения нет в ленте. `feed.jumpTo(id, loader?)` — если сообщения нет, вызывается `loader(id)` (или `onLoadAround` ленты); он возвращает окно вокруг сообщения: массив, `{ messages, hasMore?, hasNewer? }` или `{ before, message, after, hasMore?, hasNewer? }`. Лента заменяется окном и прокручивается к сообщению; `hasNewer` + `onLoadNewer` (внизу «Показать новее» и подгрузка у низа, результат — в `append`), `setHasNewer(v)`. В React — `<ChatFeed feedRef hasNewer onLoadNewer onLoadAround>`.
- **Прокрутка колонок `.b24-entity`** (данные | таймлайн) включается только для `.b24-sidepanel__body > .b24-entity` — карточка должна быть прямым ребёнком тела панели; в обёртке колонки не получат высоту панели и прокручивается вся панель (ширина ≥861 px).
- **Видео, этапы, контакты.** Вложение `{ type: 'video', player, url, thumb, name, duration }` (iframe-плеер по клику, ссылка или неактивная плашка); `initStages(root)` для `.b24-stages` со своей разметкой (цвет текущего этапа, наведение); контакты колонкой `.b24-contact-list > .b24-contact`; `createCallLog({ renderRecord })` + `hasRecord`; статус `'unknown'` у рейла и панели.
- **Правка и набор.** `ChatMessage.edited` — подпись «изменено»; `onEdit` у ленты — пункт «Изменить» у своих сообщений; `composer.startEdit({ id, text })` / `cancelEdit()` — плашка «Редактирование» над полем, `onSend(text, { mode: 'edit', editId })`. `feed.setTyping('Анна печатает…' | null)`, `ChatListItem.typing`, `onTyping` у поля (не чаще раза в 3 с).
- **Лента** `createChatFeed(host, { messages, hasMore, onLoadMore, onRetry })`: пузыри `dir: 'in' | 'out'` с автором, временем и статусом (`sending` · `sent` ✓ · `delivered` ✓✓ · `read` ✓✓ синим · `failed` — «Не доставлено: причина» и «Повторить»), служебные строки `dir: 'system'` по центру, разделители дат, ссылки в тексте. Вложения: `photo` (превью), `file` (имя, размер), `voice` (плеер), `geo` (точка на карте). `setMessages(все)` сам понимает, что пришло сверху («Показать раньше», прокрутка к верху — позиция не прыгает) или снизу (прокрутка вниз, если вы были у низа или сообщение наше); догружающиеся картинки не сбивают низ.
- **Подключение**: `createChatFeed` и `createChatComposer` можно вызывать прямо на `.b24-chat__main` (после `__head`) или на своих обёртках внутри него — обёртка ленты растягивается сама.
- **Поле ответа** `createChatComposer(host, { onSend, onAttach, quickReplies })`: textarea растёт с текстом, Enter — отправить, Shift+Enter — новая строка (`enterToSend: false` — по Ctrl/⌘+Enter), скрепка, быстрые ответы над полем, `slots.attachments` — превью вложений, `slots.actions` — свои кнопки. `false` или исключение из `onSend` — текст остаётся. `setDisabled(true, 'Диалог закрыт')` — вместо поля строка с причиной.

```js
const list = B24UI.createChatList(listEl, { items: dialogs, value: 'd1', onSelect: openDialog });
const feed = B24UI.createChatFeed(feedEl, { messages, hasMore: true, onLoadMore: async () => feed.setMessages([...(await api.older()), ...messages]) });
B24UI.createChatComposer(composerEl, { quickReplies: ['Здравствуйте!'], onSend: async (text) => feed.append([await api.send(text)]) });
```

```tsx
<ChatLayout dialogOpen={!!active} onBack={() => setActive(null)} list={<ChatList items={dialogs} value={active} onSelect={setActive} />} aside={<ClientCard />}>
  <ChatHeader title={d.name} meta="Telegram" avatar={<Avatar name={d.name} status="online" />} asideToggle />
  <ChatFeed messages={messages} hasMore onLoadMore={loadOlder} onRetry={resend} />
  <ChatComposer quickReplies={replies} onSend={send} />
</ChatLayout>
```

### Эмодзи, реакции и меню сообщения

- **Выбор эмодзи**: `createChatComposer(host, { emoji: true })` (в React — `<ChatComposer emoji />`, в окне — `composer: { emoji: true }`) добавляет кнопку 🙂 рядом со скрепкой. Панель: «Частые» (хранятся в localStorage), разделы, поиск по русским словам («пицца», «спасибо», «сердце»; «ё» = «е»); стрелки и Enter, Esc закрывает; эмодзи вставляется в позицию курсора. На ≤768px панель — нижний лист. Отдельно: `openEmojiPicker(anchor, { onSelect, align, placement })`, `attachEmojiPicker(composer)`, `searchEmoji(q)`, `getRecentEmoji()`.
- **Реакции**: `ChatMessage.reactions: [{ emoji, count, mine, users }]` — чипы «👍 3» под пузырём (`mine` — подсвечен, `users` — в подсказке). `onReact(messageId, emoji, message)` — клик по чипу или по эмодзи в полоске быстрых реакций. Кит сам реакцию не меняет: поставьте или снимите её на сервере и передайте новый `reactions` через `setMessages` / `update`. Полоска (`quickReactions`, по умолчанию 👍 ❤️ 😂 😮 😢 🙏, «🙂» — любая другая) появляется у сообщения по наведению и фокусу, на телефоне — по долгому нажатию.
- **Меню сообщения «⋯»**: `onReply(message)` — «Ответить», «Копировать» текст (`copy: false` — убрать), свои пункты — `actions: (m) => [{ id, label, icon, danger, onClick }]`.
- **Свой контент в сообщении**: `decorate(message, el)` вызывается для каждого сообщения после отрисовки и после каждой перерисовки (`setMessages` перерисовывает ленту целиком) — дописывайте разметку в `el`, MutationObserver не нужен.

```js
const composer = B24UI.createChatComposer(el, { emoji: true, onSend });
const feed = B24UI.createChatFeed(feedEl, {
  messages, onReply: (m) => composer.setValue(`> ${m.text}\n`),
  onReact: async (id, emoji) => feed.setMessages(await api.toggleReaction(id, emoji)),
  actions: (m) => (m.dir === 'out' ? [{ id: 'del', label: 'Удалить', icon: 'trash', danger: true, onClick: remove }] : []),
  decorate: (m, el) => { if (m.data?.order) el.querySelector('.b24-chat-msg__bubble').append(orderBadge(m.data.order)); },
});
```

### Файлы, скрытый режим, заметки

- **Вложения в поле ответа**: `onAttach(files)` срабатывает на скрепку, перетаскивание файлов на поле и вставку из буфера (Ctrl+V с картинкой; вставка обычного текста не затрагивается). Покажите файл чипом: `composer.addAttachment({ id, name, size, thumb, progress: 0 })`, прогресс — `updateAttachment(id, { progress: 0.4 })`, ошибка — `{ error: 'Файл слишком большой' }`. Пока идёт загрузка, отправка заблокирована; когда файлы загружены, можно отправить только их без текста. `onSend(text, { attachments, mode })`; после успеха чипы убираются. `removeAttachment`, `getAttachments`, `clearAttachments`, `onRemoveAttachment`.
- **Куда бросать и что принимать**: `dropTarget: element` — файлы можно бросать на всю переписку (например, `.b24-chat__main`), она подсвечивается; `accept`, `maxSize` (байты), `maxFiles` (с учётом уже добавленных) проверяются для скрепки, перетаскивания и вставки; отклонённый файл — тост или `onReject(file, 'size' | 'count' | 'type')`. `clearFailedOnSend: true` — после успешной отправки убирать и чипы с ошибкой.
- **Отправка не удалась**: `onSend` вернул `false` или бросил исключение — чипы снова доступны, прогресс, выставленный вашим кодом во время отправки, снимается; пока отправка идёт, чипы приглушены и не убираются.
- **Режим ответа**: `modes: [{ id: 'reply', label: 'Ответ клиенту' }, { id: 'note', label: 'Скрытое сообщение', tone: 'note', placeholder }]` — переключатель над полем; `tone: 'note'` красит поле в жёлтый. `setMode(id)`, `getMode()`, `onModeChange`, `setModeDisabled(id, true, 'Клиент ещё не написал')` — кнопка недоступна, причина в подсказке.
- **Заметка в ленте**: `dir: 'note'` — жёлтая подложка, замок и подпись «Видят только сотрудники» (`noteLabel` — свой текст). Выравнивается как исходящее; `mine: false` — заметка коллеги: слева, с аватаром и именем.
- **Подпись чипов реакций**: `reactionsHint` — общая приписка в подсказке («Нажмите, чтобы поставить или убрать свою»).
- **Лайтбокс**: `openLightbox(items, start, { label, prevLabel, nextLabel })` — свои подписи вместо «Просмотр скриншота».
- **Окно чата**: `openChatDock({ headExtra: node })` или `dock.slots.head` — свои кнопки и аватары в шапке («Пригласить», приглашённые); в свёрнутом окне скрыты.
- **Участники**: `Member.actions: [{ id, label, icon, danger }]` + `onAction(actionId, member)` — кнопки справа («Удалить из чата»), клик не вызывает `onSelect`.
- **Группы в списке диалогов**: `ChatListItem.group: 'Покупатели'` — заголовок перед первым диалогом группы (порядок — как в items).
- Иконка `userPlus`. В React: `<ChatComposer composerRef={ref} modes onModeChange />`, `<MemberList onAction />`.

### Мессенджер сквозь раздел: правая панель и окна чата

Как в Битрикс24: чат с клиентом под рукой на любой странице — например, в кассе рядом с чеком.

- **Правая панель** `createMessengerBar({ items, value, onSelect, onAll, allCounter, actions })` — fixed-колонка у правого края под шапкой `AppShell`: «Все чаты», аватары диалогов (счётчик 99+, точка статуса, подсказка «имя · канал»), кнопки внизу (`actions: [{ id, icon, label, counter, active, onClick }]`), активный — с обводкой. Прокрутка без полосы, на ≤768px скрыта. Пока панель открыта, `html.b24-has-im-bar` — контент `.b24-shell__main` и `.b24-app` отступает. `setItems`, `update(id, patch)`, `setActive`, `setActions`, `setAllCounter`.
- **Окно чата** `openChatDock({ id, name, avatar, status, meta, feed, composer, onExpand, onClose })` — плавающее окно у правого края (рядом с панелью): шапка с «Открыть полностью», «Свернуть», «Закрыть»; внутри `createChatFeed` (`feed: { messages, … }`) и `createChatComposer` (`composer: { onSend, quickReplies }`, без `onSend` — только чтение). Повторный вызов с тем же `id` разворачивает открытое окно. Несколько окон — в ряд, лишние по ширине сворачиваются. Свёрнутое — полоска с именем и счётчиком (`setCounter(n)`). На телефоне — нижний лист на 70% высоты. Хэндл: `feed`, `composer`, `minimize`, `restore`, `toggle`, `setHeader`, `close`; `getChatDocks()`.
- **Звук и уведомления**: `notifySound({ dedupeKey })` — короткий «дзынь» через WebAudio, без файла (до первого клика на странице браузер звук не даст — вернётся `false`); `requestNotifyPermission()` — из обработчика клика; `desktopNotify({ title, body, tag, onClick })` — системное уведомление, по умолчанию только если вкладка не на виду. Ключ `dedupeKey` / `tag` — из нескольких открытых вкладок звенит и показывает одна (`claimNotify(key)` через localStorage).

```js
const bar = B24UI.createMessengerBar({ items, onSelect: (id) => openDock(id), onAll: () => location.href = '/staff/chats/' });
const dock = B24UI.openChatDock({ id, name: 'Мария', meta: 'Telegram', feed: { messages }, composer: { onSend: (text) => api.send(id, text) } });
socket.on('message', (m) => { dock.feed.append([m]); if (dock.isMinimized()) dock.setCounter(++unread); B24UI.notifySound({ dedupeKey: m.id }); });
```

React: `<MessengerBar items value onSelect onAll actions />`, `<ChatDock id name meta messages onSend onClose minimized counter />` — рендерятся поверх страницы, на месте ничего не выводят.

### Люди: участники и выбор сотрудника

- **Список участников** `createMemberList(host, { items, onSelect, title })` — аватар с точкой `status` (`'online' | 'away'`), имя, подпись `caption` (должность, «в сети»), `meta` справа («Админ»), `self: true` — отметка «вы», строка неактивна (`selfSelectable: true` — можно выбрать), `disabled`. `title: 'Участники'` — заголовок с числом. Без `onSelect` строки не кликаются. `compact` — мельче, для узкой колонки и окна чата. Хорошо встаёт в `.b24-chat__aside`. `setItems`, `update(id, patch)`, `setSelected(ids)`.
- **Выбор сотрудника** `pickUser({ users, title, multiple, exclude, selected })` — модалка с поиском по имени и должности (каждое слово — начало слова, «ё» = «е»), ↓ из поиска — в список, Enter — первый найденный. Один человек — клик сразу закрывает окно, промис резолвится `Member`; `multiple: true` — галочки и кнопка «Выбрать (N)» (`okText`), резолвится `Member[]`. Отмена / Esc — `null`. `exclude` — скрыть уже добавленных; поиск по серверу — `load: (query, signal) => Promise<Member[]>` вместо `users`. Фильтр отдельно — `matchMember(member, query)`.

```js
B24UI.createMemberList(asideEl, { title: 'Участники', items: [{ id: '1', name: 'Марина Ковалёва', caption: 'Управляющая', status: 'online', self: true }], onSelect: openProfile });
const user = await B24UI.pickUser({ users: staff, title: 'Новый чат' });           // Member | null
const added = await B24UI.pickUser({ users: staff, multiple: true, exclude: memberIds, okText: 'Добавить' }); // Member[] | null
```

React: `<MemberList items title onSelect compact selected />`; `pickUser` — та же функция из `airkit-for-b24/react`.

## Конструктор чеков: блоки, лента, QR, зоны печати

Пример — `demo/receipt.html`. Все компоненты работают и поодиночке.

- **Сортируемый список** `createSortable(host, { items, toggle, renderBody, renderItem, onReorder, onToggle })` / `<SortableList>`: строки-блоки с ручкой, включателем (`toggle: true`, `enabled`) и раскрывающейся частью (`renderBody(item, el)` — есть, строка раскрывается; вызывается один раз). Перетаскивание за ручку мышью, пером и пальцем; на телефоне ещё и долгое касание по строке (страница при этом не листается). С клавиатуры: Alt+↑ / Alt+↓ на ручке (↑ / ↓ без Alt — к соседней ручке), позиция озвучивается. Esc во время перетаскивания — отмена. Развёрнутая строка двигается целиком. `fixed: true` — строка стоит на месте («Итого» внизу). `onReorder(ids, { id, from, to })`; `update`, `move`, `expand`, `getOrder`, `contentOf` / `bodyOf`. В React `content` и `body` — обычные узлы (порталы), порядок хранит родитель.
- **Чековая лента** `createReceipt(host, { lines, paper: 58 | 80, switcher })` / `<Receipt>`: моноширинный блок шириной в символах (58 мм — 32, 80 мм — 48; `width` — любое число), на подложке «бумага» с рваным краем (`torn: false` — без него); на узком экране масштабируется по ширине. Строки: `{ text, bold, dh, dw, align, invert }` (двойная высота / ширина, выравнивание, «белым по чёрному»), `{ sep: '-' }`, `{ cols: [слева, справа] }` (правая колонка по краю, левая переносится), `{ qr, label }`, `{ barcode, label }` (заглушка), `{ blank }`. Перенос по словам с учётом двойной ширины. `setLines`, `setPaper`, `setWidth`, `getText()` — ровно то, что напечатал бы принтер.
- **QR-код** `createQr(host, text, { size, ecc, label })` / `<Qr value />`, `qrSvg(text)`, `qrMatrix(text)`: без зависимостей, версии 1–10 (до ~210 байт при уровне M), UTF-8, уровни L/M/Q/H. Проверен сторонним декодером.
- **Дерево**: у `TreeItem` — `badges` (значки или чипы справа). Значение узла с наследованием: `valueOptions: [{ value, label, color }]`, `values: { id: ['kitchen'] }`, `onValueChange(id, value | null)`. Узел без своего значения показывает унаследованное серым с подписью «как у родителя» (`inheritLabel`); клик по значению — выбор набора, там же «Как у родителя»; ↺ — сбросить к родителю. Своё значение остаётся у потомка при смене родителя. `getValues`, `setValues`, `getEffective(id)`.
- **Дерево: перенос и действия** (`demo/kb.html`): `draggable: true` — ручка слева; перетащить между соседями (порядок) или на середину узла (внутрь раздела); с клавиатуры Alt+↑ / ↓ / → / ←, Esc — отмена. `canDrop(item, parent)` запрещает перенос, `onMove({ id, item, fromParentId, parentId, index })` вызывается после переноса (вернуть `false` — откат). `actions: [{ id, label, icon, danger, separatorBefore }]` (или функция от узла) — меню «…» справа (и клавиша ContextMenu), выбор — `onAction(id, item)`. `handle.rename(id)` / F2 — правка названия на месте, `onRename(id, label, item)`; `getItems()` отдаёт текущее дерево. Дерево хранит свою копию `items`.
- **Автосохранение** `createSaveStatus(host)` / `<SaveStatus state />`: `setState('saving' | 'saved' | 'error' | 'neutral' | 'idle', { time, text })` (`neutral` — серый текст без значка: «Опубликованная версия») → «Сохраняю…», «Сохранено · 14:32», «Не сохранено — повторяю» (`role="status"`, `compact` — только значок). Для слота `extra` шапки или шапки панели; на подложке Air цвет подстраивается.
- **Панель**: `handle.setFooter(content | null)` меняет футер без пересоздания (сворачивание в «Ещё ▾» пересчитывается). `initToc` в теле `openSidePanel` сам следит за прокруткой панели (или `data-scroller="селектор"` / `initToc(el, { scroller })`); заголовки ищутся внутри панели, одинаковые id на странице не мешают. Липкое оглавление — `.b24-toc--sticky` (оглавление и текст соседи в строке grid / flex; отступ сверху — `--b24-toc-top`).
- **Текст `.b24-prose`**: `blockquote` (+ `cite`/`footer`), `mark`, чек-лист (`ul.b24-checklist` или `li > input[type=checkbox]`), `.b24-delimiter` («***»), `.b24-callout` с `.b24-callout__title`.
- **Блочный редактор Editor.js**: обёртка `.b24-blockeditor` подкрашивает `.ce-*`, `.cdx-*`, `.tc-*` под токены кита (блоки, тулбар, меню «/», inline-тулбар, список, чек-лист, цитата, выноска, маркер, таблица, код); светлая и тёмная тема — сами.

```js
const list = B24UI.createSortable(el, { items: blocks, toggle: true, renderBody: (item, body) => body.append(form(item)), onReorder: (ids) => save(ids) });
const receipt = B24UI.createReceipt(el2, { paper: 58, switcher: true, lines: [{ text: 'ЧЕК', bold: true, dh: true, align: 'center' }, { cols: ['Пицца', '2 × 450'] }, { qr: url }] });
B24UI.createTree(el3, { items, select: false, valueOptions: zones, values: { all: ['desk'] }, onValueChange: save });
```

## Софтфон: набор, карточка звонка, статус линии

Пример — `demo/phone.html`. Компоненты показывают состояние и сообщают о действиях; сами звонки (WebRTC, SIP, телефония Битрикс24) — ваш код.

- **Клавиатура** `createDialpad(host, { onDial, onKey, mode })` / `<Dialpad>`: поле номера и кнопки 1–9 * 0 # с буквами (ABC, DEF…, у 0 — «+»; удержание «0» вводит «+»). Ввод с клавиатуры компьютера (буквы игнорируются), Enter — позвонить; вставка нормализуется: «8 (999) 123-45-67» → «+7 (999) 123-45-67» (российские 8…/7…/9… — в +7, остальное как есть, `*100#` не трогается). `onDial(number, formatted)`; `mode: 'dtmf'` / `setMode('dtmf')` — во время звонка: каждое нажатие уходит в `onKey(key)`, номер не набирается. `captureKeyboard: true` — слушать клавиатуру на всём документе (для popover). `normalizePhone(text)`, `formatPhone(number)`. `internalMaxLength: 4` — внутренние номера (7xx, 8xx, 1001) из не более чем 4 цифр остаются как есть, а не превращаются в «+7…» (`normalizePhone(text, { internalMaxLength })`). Поле номера защищено от общих стилей `input` шаблона. Кнопка вызова — круглая зелёная трубка по центру под клавиатурой (подпись в `title` и `aria-label`); `callButton: 'wide'` — широкая с подписью.
- **Карточка звонка** `createCallCard(host, { state, name, number, onAnswer, onDecline, onHangup, onAction })` / `<CallCard>`: `incoming` — «Ответить / Отклонить»; `dialing`, `active` (таймер mm:ss), `held`, `ended` — кнопки «Без звука / Удержание / Клавиши / Перевести» (`actions` — свои; `toggle` — переключатель с `aria-pressed`) и красная «Завершить». `onAction(id, pressed)`; «Удержание» само переводит в `held`. `setState`, `setInfo`, `setPressed`, `getDuration`; `slots.extra` — место под кнопками (клавиатура DTMF, индикатор микрофона).
- **Плеер записи** `createAudioPlayer(host, { src, duration, compact, download, onPlay, onEnd, onError })` / `<AudioPlayer src duration compact download />`: play / pause, перемотка по полосе (мышь, касание, стрелки), «текущее / общее» время, скорость 1× / 1,5× / 2× (`speeds`), «Скачать» (`download: true` или имя файла). `compact: true` — одна строка для строки журнала (▶ 0:12 ━━○━━ 2:05 1×; на ≤480px без общего времени и «Скачать»), обычный — для карточки звонка. Источник может отдаваться с Range (206); пока длительность неизвестна — «—:—» и перемотка недоступна (`duration` — если знаете заранее, `preload: 'none'` — не грузить метаданные до нажатия). Ошибка загрузки или формата — текст («Не удалось загрузить запись…», `errorText` — свой) и «Повторить», а не пустой плеер; `onError({ code, message })`. Одновременно играет один плеер (`exclusive: false` — отключить). `play()`, `pause()`, `seek(sec)`, `setSpeed`, `setSrc(src, duration)`, `audio` — сам элемент. Компактный плеер ставьте рядом со строкой журнала или в раскрытие под ней: внутри кликабельной строки `createCallLog` (она кнопка) кнопки вкладывать нельзя.
- **Не модальная карточка**: `createCallCard(document.body, { floating: true, state: 'incoming', … })` — плавает справа вверху под шапкой без затемнения и блокировки страницы (`{ position: 'top-left' | 'bottom-right' }`); «Свернуть» превращает её в полоску внизу экрана: имя, таймер, «Развернуть», «Завершить» (`minimize()`, `restore()`, `onMinimize`). `slots.customer` — место под карточку клиента (заказы, «Новый заказ», «Открыть заказ»). На телефоне — на всю ширину. Свернуть можно и входящий звонок: в полоске «Ответить» и «Отклонить». Итог: `setState('ended', { text: 'Ответил коллега' })` — свой текст вместо стандартного (`statusText` в React), `onClose` добавляет кнопку «Закрыть» (в карточке и в полоске). `setStartedAt(ts)` и `setState('active', { startedAt })` — таймер от момента ответа на стороне сервера (ringing → talking). «Ответить», «Отклонить» и «Завершить» — круглые кнопки (зелёная и красные) с подписью под ними.
- **Журнал звонков** `createCallLog(host, { items, onSelect, onMissedChange })` / `<CallLog>`: иконка направления (входящий / исходящий / пропущенный), две строки текста, время и длительность справа, заголовки дней («СЕГОДНЯ», «ВЧЕРА», «14 НОЯБРЯ»), пропущенный красным. `markSeen(ids?)` — просмотрены; `onMissedChange(n)` — для счётчика на пункте меню: `setNavCounter('/phone/missed/', n)`. Строка: `badge` (метка «Ответил коллега», `tone: 'success' | 'warning' | 'danger'`), `selected` / `setSelected(id)` (выбрана — подсветка и `aria-selected`), `actions: [{ id, label, icon, primary }]` + `onAction(actionId, item)` — кнопки справа («Перезвонить»), клик не вызывает `onSelect`. Кнопка-действие с `icon: 'phone'` (или `round: true`) — круглая зелёная иконка, как кнопка вызова в Битрикс24; подпись — в `title` и `aria-label`.
- **Статус линии** `createLineStatus(host, { status, onChange })` / `<LineStatus>`: точка `online` / `away` / `offline` / `disconnected` и подпись («На линии», «Перерыв», «Не на линии», «Нет связи»; `label` и `labels` — свои). С `onChange` — выбор «На линии / Перерыв».
- **Уровень микрофона** `createMicMeter(host, { bars })` / `<MicMeter>`: деления, `setLevel(0–1)`, `setMuted`; `connect(stream)` — уровень считается сам из потока `getUserMedia`.
- **Popover со своим контентом**: `popover(anchor, { content: node, width, className })` — клавиатура или карточка звонка над кнопкой; Esc и клик мимо закрывают.
- **Кнопки панели мессенджера**: у `MessengerBarAction` — `variant: 'success' | 'danger' | 'primary'` (зелёная круглая кнопка звонка), `className`, `status` (точка на значке), `pulse` (идёт звонок), `disabled`; `onClick(button, event)` — кнопка вторым аргументом для popover. Оформление живёт в данных и не слетает при перерисовке.
- Иконки: `micOff`, `pause`, `phoneForward` (рядом с `phone`, `phoneIncoming`, `phoneOutgoing`, `phoneMissed`, `headset`).

```js
const pad = B24UI.createDialpad(el, { onDial: (number) => softphone.call(number) });
const card = B24UI.createCallCard(el2, { state: 'incoming', name: 'Мария', number: '89991234567', onAnswer: () => softphone.answer(), onHangup: () => softphone.hangup(), onAction: (id, on) => id === 'mute' && softphone.mute(on) });
bar.setActions([{ id: 'phone', icon: 'phone', label: 'Телефон', variant: 'success', status: 'online', pulse: inCall, onClick: (btn) => popover(btn, { content: pad.element, width: 300, placement: 'left' }) }]);
```

## Оболочка без перезагрузки: embed и меню на лету

- **Режим embed** — страница без оболочки (во фрейме, во время звонка): `setEmbed(true)` или `?embed=1` (также `window.name = 'b24-embed'`, `<html data-b24-embed>`; `init()` включает сам, `isEmbed()`). Скрываются сайдбар и шапка оболочки, подвал и панель мессенджера, контент на всю страницу (`html.b24-embed`). В React — `<AppShell embed>`.
- **Подсветка по адресу**: `setShellActive(url)` ставит `aria-current="page"` на пункт сайдбара и меню раздела, который ведёт на url (точное совпадение, затем самый длинный общий путь; нет подходящего — подсветка не меняется). `watchShellActive()` делает это сам при `popstate`, `hashchange`, `history.pushState / replaceState`.
- **Меню на лету**: `setSidebar(nav, [{ title, items: [{ label, href, icon, counter, active }] }])`, `setTopNav(nav, items)` (пункты меню раздела пересобираются, «Ещё ▾» пересчитывается сама), `setNavCounter(url | подпись, n)` — счётчик на пункте («Пропущенные 3»).

## Контекстное меню, палитра, таблетка, шапка оболочки

Пример — `demo/controls.html`, нижний раздел.

- **Контекстное меню** `contextMenu(target, items, options)` / `openContextMenu(x, y, items)`: правая кнопка, долгое нажатие пальцем (≈600 мс, `longPress`), клавиша меню / Shift+F10. Пункты: `{ label, icon, hint, danger, disabled, onClick }`, `{ separator: true }`, `{ title }` (заголовок группы). Одно меню на много строк — `selector` и функция `items(event, target)`. После долгого нажатия отпускание пальца не закрывает меню (`ignoreOutsideMs`, по умолчанию 400) и не кликает по элементу под ним (`suppressClickMs`, 500). Стрелки, Home/End, Esc, клик мимо и прокрутка закрывают; меню не выходит за экран; в полях ввода остаётся меню браузера (`keepNativeOnInputs: false` — убрать). `openContextMenu` — от невидимого якоря в любой точке.  Пункт со своим содержимым: `{ content: node | (close) => node }` — палитра, поле, мини-форма; позиция пересчитывается, когда меню выросло. Меню и поповеры лежат выше правой панели мессенджера и окон чата (z-index от 1200).
- **Палитра из массива** `createColors(el, { colors, value, custom, onChange })`: разметку `.b24-colors` собирает кит. Галочка на светлых цветах (жёлтый, белый) тёмная, на тёмных белая — и у готовой разметки, и в React `<ColorPicker>`. Подписи цветов: `colors: [{ value: '#2fc6f6', name: 'Голубой' }]` — `name` попадает в подсказку и `aria-label` вместо hex.
- **Таблетка с цветом акцента** `createSegmented(el, { items: [{ value, label, icon, color }], value, onChange })` / `<Segmented options={[{ …, color }]} />`: выбранный пункт заливается цветом бренда, текст подбирается по яркости. Логотип вместо значка: `{ src: '/img/brand.svg' }` — картинка 20 px.
- **Шапка оболочки**: `<AppShell title search searchCollapsible>` или разметкой `.b24-shell__title` (после бургера, до меню; одна строка с многоточием) и `.b24-shell__search`. `searchCollapsible` (`.b24-shell__search--collapsible`, `--collapsible-mobile` — только на узком экране): поиск сворачивается в лупу и раскрывается поверх шапки с курсором в поле; Esc, клик мимо и повторный клик сворачивают (`initShellSearch`, `init()` подключает сам). Пустая `.b24-page-header` (без элементов или со всеми пустыми строками) не занимает места. Размер заголовка: `.b24-shell__title--lg` (как у заголовка раздела), `titleSize="lg"` в React или `--b24-shell-title-size`. Раскрытое поле поиска не перекрывается лупой (она встаёт справа и становится «×»), обёртка с `min-width: 0` не даёт горизонтальной прокрутки, Esc закрывает и параметры фильтра внутри, и само поле. React `<Filter>` тоже открывает параметры по курсору в строке.
- **Поле для тёмного фона**: `.b24-input--glass`, `.b24-textarea--glass`, `.b24-select--glass`; в React `<Input glass />`.
- **Звонок**: `CallLogItem.avatar` (`true` — инициалы, или URL; направление остаётся значком на углу), `CallLogItem.brand` (`{ label, icon | src, color }`); `createCallCard({ accent, brand })` — полоса и таймер цвета бренда, метка в углу, `setAccent`, `setBrand`, `slots.brand`.

## Планировщик: сотрудники и время

`createScheduler(host, options)` — шкала «сотрудники × время» по мотивам Bryntum Scheduler, на токенах кита. Пример — `demo/scheduler.html`.

- **Строки** — сотрудники (`resources`: `id`, `name`, `avatar`, `meta` — должность, `group` — отдел; отделы сворачиваются). Видимые строки рисуются по мере прокрутки — сотни сотрудников не тормозят. **Статус**: `online: true` или `status: 'online' | 'away'` — точка у аватара, `lastSeen` (дата или строка) — подсказка «Был(а) в сети 5 мин назад»; обновление — `setResources(…)`.
- **Шкала** — день, неделя (с понедельника), N дней от даты (`view: 'days', days: 7, date` — например, «7 дней с сегодня»; «назад / вперёд» листают на N дней; без пересоздания — `setDays(n)`, `setRange(start, n)`, в React — проп `days` / `date`), месяц; кнопки «назад / сегодня / вперёд». В дне и неделе показаны часы `hours: [8, 20]` — ночь не занимает место. Ctrl/⌘ + колесо — масштаб. Линия «сейчас».
- **График работы** (`bands`): смены `kind: 'work'` светлые, остальное время приглушено; отпуск, больничный, командировка — штриховкой с подписью. Свой вид — любой `kind` (`'wish'`) с `label`, `color` и `className`: штриховка цветом, подпись, пункт легенды. Встреча поверх своего вида не считается конфликтом; `absent: true` — считается.
- **Встречи** (`events`): перетаскивание по времени и на другого сотрудника, растягивание за края, создание выделением пустого места, шаг привязки `step` (15 минут). С клавиатуры: Alt+←/→ — сдвиг, Alt+Shift+←/→ — длительность, Enter — открыть, Delete — удалить.
- **Окно редактирования** (`editor: true` или `{ fields, comment, duration }`): клик (или Enter, «Изменить» в меню) — название, тип, сотрудник, дата и время начала и конца, «Весь день», комментарий и свои поля (`fields: [{ name, label, type: 'text' | 'textarea' | 'number' | 'select', options, required }]`, значения — в `event.data[name]`). Выделение пустого места тоже открывает окно. Сохранение — `onSave(event, { isNew, previous })`: отклонённый промис оставляет окно открытым и показывает текст ошибки; для новой верните встречу с id сервера. Без `onSave` новые уходят в `onCreate`, изменения — в `onChange`. «Удалить» в окне — через `onDelete`. Есть свой `onClick` — окно по двойному клику или `scheduler.editEvent(id)`.
- **Типы событий** (`eventTypes: [{ id, label, color, allDay, hint }]`, у события — `type`): цвет и «весь день» по умолчанию, легенда (`hint` — подпись «10:00–24:00»), пункт «Тип» в меню и окне. Свои меню и окно — `eventTypesMenu: false`: типы дают только цвет и легенду.
- **Контекстное меню** (правая кнопка, клавиша меню / Shift+F10 на встрече): на встрече — Изменить · Тип · Дублировать · Копировать · Удалить, на пустом месте — Создать (по типам) · Вставить. `contextMenu: (ctx) => items` меняет пункты (`ctx.kind`: `'event'` / `'slot'`, `ctx.items` — пункты по умолчанию), `false` — без меню.
- **Копии**: Ctrl/⌘+C на встрече и Ctrl/⌘+V — на место под курсором, Alt + перетаскивание, «Дублировать» — сразу после оригинала; уходят как новые (`onSave` / `onCreate` с `copyOf`).
- **Масштаб**: кнопки «−», «+», «По размеру» в панели (и Ctrl/⌘ + колесо). Шкала не бывает уже области: «−» после «окна часов на ширину» добавляет часы за пределами `hours` (8–20 → 7–21 → … → сутки 0–24), час становится уже; «+» — обратно, затем шкала шире области и деления «:30», «:15», «:45». «По размеру» — окно `hours` ровно на ширину. API: `zoomIn()`, `zoomOut()`, `zoomToFit()`.
- **Комментарий** (`comment`) — значок на встрече и текст в подсказке. **Оформление из данных**: `variant: 'dashed'` (пожелание, черновик) или `'hatched'`, свой класс — `className`.
- **Снимок всего расписания** (картинка для мессенджера): строки виртуализированы, но рисуются все, что попадают в видимую высоту, — задайте `height` под все строки.
- **Легенда**: типы событий (или «Встреча») и только те виды графика, что есть в `bands`; `legend: 'types'` — только типы, `false` — без легенды.
- **Без времени**: `allDay: true` у события (выходной, отпуск, больничный, которые нужно кликать и двигать) — полоса на свои `start–end`, подпись только названием, не помечается «вне рабочего времени» и «отсутствует». Конец ровно в полночь подписывается «24:00».
- **Создание**: `createWithinDay: true` не даёт протянуть выделение через полночь. **Прокрутка при открытии**: `initialScroll: 'now'` (к сегодня, по умолчанию), `'center'` (сегодняшний день — в дне «сейчас» — по центру) или `'start'` (к началу недели / месяца, в дне — к первому видимому часу). Из кода: `scrollToDate(date, 'center' | 'start')`, `scrollToTime(date, 'third' | 'center' | 'start')`.
- **Сервер решает**: `onChange({ event, start, end, resourceId, previous })` — отклонённый промис откатывает изменение; `onCreate`, `onClick`, `onDelete`. Данные периода — `load({ start, end }, signal)`.
- **Подсказки**: пересечения встреч у одного сотрудника и встречи во время отсутствия — красная рамка, вне рабочего времени — пунктир; загрузка сотрудника за видимый период в процентах.
- Из портала: `bx24SchedulerLoader(userIds)` — занятость из календаря Битрикс24 (`calendar.accessibility.get`).

```js
B24UI.createScheduler(el, {
  resources: [{ id: '1', name: 'Алиса Мельникова', meta: 'Менеджер', group: 'Продажи' }],
  bands: [{ resourceId: '1', start: '2026-10-05T09:00', end: '2026-10-05T18:00', kind: 'work' }],
  events: [
    { id: 'm1', resourceId: '1', start: '2026-10-05T10:00', end: '2026-10-05T11:00', title: 'Демо' },
    { id: 'off', resourceId: '1', start: '2026-10-06T09:00', end: '2026-10-06T18:00', title: 'Выходной', allDay: true },
  ],
  createWithinDay: true, initialScroll: 'start',
  eventTypes: [{ id: 'meeting', label: 'Встреча' }, { id: 'off', label: 'Выходной', color: '#828b95', allDay: true }],
  editor: { fields: [{ name: 'place', label: 'Место', type: 'select', options: [{ value: 'office', label: 'Офис' }, { value: 'online', label: 'Онлайн' }] }] },
  onSave: async (event, { isNew }) => (isNew ? api.createMeeting(event) : api.updateMeeting(event)), // вернуть встречу с id
  onDelete: (event) => api.deleteMeeting(event.id),
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

Модалки, слайдер, тосты и выпадающие меню вставляются прямо в `<body>`, вне вашего контейнера, поэтому значения, переопределённые на контейнере, до них не дойдут. Тему и общие переопределения ставьте на `:root` / `<html>` (`data-b24-theme`, `data-b24-air` — тоже на `<html>`); на контейнере — только то, что касается его самого.

Фон плашек по статусу (тот же, что у `.b24-alert`, меняется с темой): `--b24-bg-info`, `--b24-bg-success`, `--b24-bg-warning`, `--b24-bg-danger`; цвет текста к ним — `--b24-color-soft-text-blue|green|orange|red`.

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


## Карточка сущности: заказ, клиент, профиль, звонок

Слайдер `openSidePanel({ air: true, width: 1180, content, footer })`, внутри `.b24-entity`. Эталон — `demo/cards.html` (`cards.html?card=order|contact|profile|call|callmini`).

```
.b24-entity
  .b24-entity__head      аватар/логотип + .b24-entity__ident (.b24-entity__name, .b24-entity__sub с бейджами) + .b24-entity__amount
  .b24-stages            стадии (необязательно)   .b24-entity__stats — плитки .b24-stat
  .b24-entity__cols
    .b24-entity__main    .b24-card с .b24-props.b24-props--rows (название — значение), .b24-table--compact
    .b24-entity__side    .b24-composer + .b24-timeline
```

- Имя сущности — только в шапке, не в заголовке панели («Звонок», «Клиент», «Мой профиль»; у заказа «ПиР · Заказ №7275» — номер, а не имя). Не повторяйте его в заголовке панели, строке «Клиент» и полях ФИО. Поля правки показывайте по кнопке «Изменить», а «Сохранить / Отмена» в `footer` — только в режиме правки.
- **Переход в другую карточку.** Имя клиента и номера заказов — `<a class="b24-entity-link" data-b24-entity-open="contact:42">`. Клик шлёт `b24:entity-open { type, id, trigger }` (всплывает, `cancelable`); приложение открывает панель поверх: `document.addEventListener('b24:entity-open', (e) => { e.preventDefault(); openSidePanel({ back: true, … }); })`. `back: true` (React — `onBack`) добавляет в шапку «← Назад».
- **Телефон и связь.** `.b24-prop__value--row` с круглой `b24-btn b24-btn--round b24-btn--icon b24-btn--sm b24-btn--success` («Позвонить»). Мессенджеры — `.b24-msgrs > .b24-msgr` с круглой `.b24-btn--channel` (цвет канала в `--_c`) и идентификатором; почта — круглая `b24-btn--secondary` с иконкой `mail`.
- **Закрепление в ленте.** Кнопка `[data-b24-pin]` в `.b24-timeline__actions` записи (React: `<TimelineItem pinnable>`, `<Timeline onPin>`) поднимает запись под разделитель «Закреплено» вверху ленты, повторное нажатие возвращает её на место. `initTimelinePin(timeline)` подключается сам; `setTimelinePinned(timeline, item, pinned)` — из кода. Событие `b24:timeline-pin { item, pinned }`. Само закрепление приложению нужно сохранить на сервере.
- **Оплата с фискальным чеком.** Пока чек не пробит — обычный `select` способа. Пробит — `select` отключён, рядом бейдж «Фискальный чек №…» и кнопка «Сделать возврат чека» (с подтверждением); после возврата способ снова меняется, и можно пробить новый чек. Подсказка под полем объясняет, почему поле недоступно.
- **Кто менял.** `.b24-entity__editor`: аватар `--sm` и «изменил Анна О. · 18:52», полное имя в `data-b24-tooltip`.
- **Запись разговора** в записи ленты — `<div class="b24-timeline__record">` + `createAudioPlayer(el, { compact: true, preload: 'none' })`. В журнале звонков — `CallLogItem.record: { src, duration?, download? }`: под строкой встаёт компактный плеер.
- **Компактный вариант** (попап софтфона, панель 360–400 px): `.b24-entity--compact` — одна колонка, аватар 44 px.
- **Узкий экран.** Футер панели сам прячет лишние кнопки в «Ещё ▾» (`footerKeep`, по умолчанию остаются две; главные помечайте `data-b24-keep`). `.b24-stages` прокручивается по горизонтали, а `.b24-stages--fold` оставляет подпись только у текущей стадии.
- **Метка бренда.** `<span class="b24-badge b24-badge--brand" style="--b24-badge-bg:#3b4a8a"><img class="b24-badge__img" src="…">Пицц и Ролл</span>`; цвет текста — `--b24-badge-color` (React: `<Badge color textColor src>`).

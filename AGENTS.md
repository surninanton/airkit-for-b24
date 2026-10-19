# airkit-for-b24 — правила для агентов

Этот файл для ИИ-агентов и разработчиков, которые собирают интерфейс приложения Битрикс24 на ките airkit-for-b24. Он лежит в корне репозитория и копируется в `dist/AGENTS.md`. Подробности API — в README.md.

Добавьте в CLAUDE.md / AGENTS.md своего приложения строку:

```
UI — на airkit-for-b24 по правилам из <путь до кита>/dist/AGENTS.md (шапка раздела — только createPageHeader / <PageHeader>).
```

## 1. Шапка раздела — как в портале

Каждая страница приложения начинается с шапки раздела. Она устроена как разделы самого портала (CRM, Задачи):

```
[Обзор] [Действия] [Журнал 11] [Поддержка]                         datanika.bitrix24.ru  [Разработчик ▾]   ← меню раздела · служебный угол
Обращения портала  [+ Создать ▾]  [Все роли ▾]  [фильтр и поиск ………]                              [⚙] [⚡]   ← заголовок · создать · селекторы · фильтр · tools
[Список|Сроки|Календарь]  [0 Просрочены] [2 Без ответа]                                 [Роботы] [••• ▾]   ← вид · счётчики · extra
```

Эталоны из портала:

- **CRM → Сделки.** Меню «Сделки · Товары и склады · Клиенты · Продажи · Аналитика…». Под ним: «Сделки» → «+ Создать ▾» → «Общая воронка ▾» → фильтр «Сделки в работе». Ниже: «Канбан · Список · Дела · Календарь» → «0 Входящие · 0 Запланированные · Ещё».
- **Задачи.** «Мои задачи» → «+ Создать ▾» → «Все роли ▾» → фильтр «В работе», справа ⚙ и ⚡. Ниже: «Список · Сроки · Мой план · Календарь · Гант» → «Чаты задач 0 · 0 Просрочены · 0 Комментарии · Прочитать все», справа «Консультация · Роботы · •••».

Правила:

1. **«Создать» стоит сразу после заголовка, слева.** Никогда не справа и не после фильтра. Зелёная кнопка (`b24-btn--success`), с шевроном, если вариантов несколько.
2. **Порядок первой строки:** заголовок → «Создать» → селекторы (воронка, роли, статус, период) → фильтр и поиск. Фильтр не шире 560px.
3. **Вкладки приложения — это меню раздела**, первой строкой над заголовком. Как «Сделки · Товары · Клиенты» в CRM. Не ставьте их в одну строку с заголовком и не прижимайте вправо.
4. **Заголовок — название текущей страницы** («Обращения портала», «Мои задачи»), а не название приложения.
5. **Вторая строка:** переключатель вида (`b24-tabs--pills b24-tabs--glass`) → счётчики (кнопки со `b24-counter`).
6. **Справа только служебное:**
   - `tools` (первая строка) — только кнопки-иконки: настройки, автоматизация;
   - `extra` (вторая строка) — второстепенные кнопки с подписью и «•••»;
   - `aside` (строка меню) — сведения о портале и блок разработчика, последним.
7. **Никакой «шапки-карточки»** над шапкой раздела: она стоит прямо на подложке Air, контент — в карточках ниже.

## 2. Как это собрать

Только через компонент шапки. Порядок слотов задан компонентом и CSS (`order`), переставить его разметкой нельзя.

```js
import { createPageHeader } from 'airkit-for-b24';

const header = createPageHeader(document.getElementById('header'), {
  menu: [
    { label: 'Обзор', href: '#/' },
    { label: 'Журнал приложения', href: '#/log', counter: 11 },
    { label: 'Поддержка', href: '#/support', active: true },
  ],
  title: 'Обращения портала',
  create: { onClick: openNew, menu: [{ label: 'Из шаблона', onClick: fromTemplate }] },
  selectors: [statusSelect],                       // Node
  filter: { fields, presets, placeholder: 'Фильтр и поиск' },   // FilterOptions → createFilter, glass
  tools: [settingsIconButton],                     // только .b24-btn--icon
  views: { items: [{ value: 'list', label: 'Список' }, { value: 'board', label: 'Доска' }], value: 'list', onChange },
  counters: [{ label: 'Без ответа', value: 'open', count: 2, tone: 'danger' }],
  extra: [robotsButton],
  aside: ['datanika.bitrix24.ru'],
  vendor: { name: 'Кедр Софт', links: { support, privacy, license } },
});
header.setMenu('#/log'); header.setTitle('Журнал'); header.setView('board'); header.setCounter('open', 0);
header.filter;   // FilterHandle
header.slots;    // контейнеры слотов: create, selectors, filter, tools, views, counters, extra, aside…
```

```tsx
<PageHeader
  menu={[{ label: 'Обзор', href: '#/' }, { label: 'Поддержка', active: true }]}
  title="Обращения портала"
  create={{ onClick: openNew, menu: [{ label: 'Из шаблона', onClick: fromTemplate }] }}
  selectors={<StatusSelect />}
  filter={<Filter glass fields={fields} value={filter} onChange={setFilter} />}
  tools={<Button variant="glass" iconOnly icon="settings" aria-label="Настройки" />}
  views={{ items: [{ id: 'list', label: 'Список' }, { id: 'board', label: 'Доска' }], value: view, onChange: setView }}
  counters={[{ label: 'Без ответа', count: 2, tone: 'danger' }]}
  extra={<Button variant="glass" size="sm">Роботы</Button>}
  vendor={vendor}
/>
```

Вкладки на одной странице (панели `[data-b24-tab-panel]`, без перезагрузки): пункт меню с `tab` — это кнопка `[data-b24-tab]`, её переключает `initTabs`; `setMenu('support')` переключает и панели.

```js
createPageHeader(host, { menu: [{ label: 'Обзор', tab: 'overview' }, { label: 'Поддержка', tab: 'support', active: true }], title: 'Обращения портала', … });
```

Разметкой: `<nav class="b24-topnav b24-page-header__menu" data-b24-tabs><button type="button" class="b24-topnav__item" data-b24-tab="overview" aria-selected="true">Обзор</button>…</nav>` — оформление кнопок кит сбрасывает сам, активный пункт — по `aria-selected` / `aria-current` / `.is-active`.

Разметкой (PHP/Jinja):

```html
<header class="b24-page-header">
  <div class="b24-page-header__nav">
    <nav class="b24-topnav b24-page-header__menu">…a.b24-topnav__item[aria-current=page]…</nav>
    <div class="b24-page-header__aside">…<span data-b24-vendor>…</span></div>
  </div>
  <div class="b24-page-header__main">
    <h1 class="b24-page-header__title">Обращения портала</h1>
    <div class="b24-page-header__create"><button class="b24-btn b24-btn--success">Создать</button></div>
    <div class="b24-page-header__selectors">…</div>
    <div class="b24-page-header__filter"><div data-b24-filter>…</div></div>
    <div class="b24-page-header__tools">…только .b24-btn--icon…</div>
  </div>
  <div class="b24-page-header__sub">
    <div class="b24-page-header__views"><div class="b24-tabs b24-tabs--pills b24-tabs--glass">…</div></div>
    <div class="b24-page-header__counters">…</div>
    <div class="b24-page-header__extra">…</div>
  </div>
</header>
```

На белом фоне без подложки Air: `light: true` / `<PageHeader light>` / `.b24-page-header--light`.

`.b24-toolbar` и `<Toolbar>` остаются для совместимости, для новой шапки раздела их не используйте.

## 3. Проверка

`init()` (автоинициализация `window.B24UI`) и `<PageHeader>` проверяют компоновку и пишут в консоль `[airkit-for-b24] Компоновка: …`, если:

- основная кнопка (`--success` / `--primary`) или фильтр стоят справа: `.b24-toolbar__right`, `__tools`, `__extra`, `__aside`, `.b24-page-bar`;
- основная кнопка в `.b24-toolbar__row` идёт после фильтра;
- в `__tools` кнопка с текстом.

Проверить вручную: `B24UI.checkLayout()` вернёт список замечаний. Перед сдачей страницы в консоли не должно быть ни одного. Выключить (только для старых экранов): `<html data-b24-layout-check="off">`.

## 4. Остальные правила кита

- **Блок разработчика** есть в каждом приложении: правый конец верхней строки, последним (`vendor` у шапки). Обязательно: название, поддержка, политика конфиденциальности — в `links.privacy`, не в `extra`. По желанию: `license` (лицензионное соглашение, встаёт рядом с политикой), `contacts`.
- **Подвал** «Сделано на airkit-for-b24» (`creditHtml()` / `<Credit>`) — просьба автора, не требование лицензии; если он уже стоит, не убирайте.
- **Имена в примерах и демо** — вымышленные.

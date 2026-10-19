import { icon } from '../icons';
import { append, h, html, type Content } from './dom';
import { dropdown, type DropdownHandle } from './dropdown';
import { createFilter, type FilterHandle, type FilterOptions } from './filter';
import { t } from './i18n';
import { initTabs } from './tabs';
import { createVendor, type VendorHandle, type VendorOptions } from './vendor';

/* ── Шапка раздела ─────────────────────────────────────────
 * Как в разделах портала: меню раздела → «Заголовок · Создать · селекторы · фильтр» → «вид · счётчики».
 * Справа только служебное: tools — кнопки-иконки, extra — второстепенные кнопки и «•••», aside — блок разработчика.
 * Порядок задают слоты, переставить его нельзя.
 */
export interface PageHeaderMenuItem {
  label: string;
  /** ключ пункта для setMenu(); по умолчанию — tab, href или label */
  value?: string;
  href?: string;
  /** вкладка на этой же странице: кнопка [data-b24-tab], панели [data-b24-tab-panel] переключает initTabs */
  tab?: string;
  active?: boolean;
  counter?: number;
  onClick?: () => void;
}
export type PageHeaderCreateItem = { label: string; hint?: string; onClick?: () => void; href?: string } | '-';
export interface PageHeaderCreate {
  /** по умолчанию «Создать» */
  label?: string;
  onClick?: () => void;
  href?: string;
  /** пункты у шеврона: «Создать ▾» */
  menu?: PageHeaderCreateItem[];
}
export interface PageHeaderView { value: string; label: string }
export interface PageHeaderCounter {
  label: string;
  count: number;
  /** ключ для setCounter(); по умолчанию label */
  value?: string;
  tone?: 'danger' | 'success' | 'warning' | 'gray';
  onClick?: () => void;
}
export interface PageHeaderOptions {
  /** меню раздела: страницы приложения (как «Сделки · Товары · Клиенты» в CRM) */
  menu?: PageHeaderMenuItem[];
  title: Content;
  /** основная кнопка сразу после заголовка; Node — своя кнопка */
  create?: PageHeaderCreate | Node;
  /** селекторы между «Создать» и фильтром (воронка, роли, период) */
  selectors?: Content[];
  /** FilterOptions — фильтр создаётся сам (glass по умолчанию); Node — свой */
  filter?: FilterOptions | Node;
  /** справа в первой строке: только кнопки-иконки (настройки и т. п.) */
  tools?: Content[];
  /** переключатель вида (Канбан · Список · Календарь) */
  views?: { items: PageHeaderView[]; value?: string; onChange?: (value: string) => void };
  counters?: PageHeaderCounter[];
  /** справа во второй строке: второстепенные кнопки и «•••» */
  extra?: Content[];
  /** служебный угол справа вверху: сведения о портале и т. п.; блок разработчика встаёт последним */
  aside?: Content[];
  vendor?: VendorOptions;
  /** на светлом фоне без Air-подложки */
  light?: boolean;
}
export type PageHeaderSlot = 'nav' | 'menu' | 'main' | 'title' | 'create' | 'selectors' | 'filter' | 'tools' | 'sub' | 'views' | 'counters' | 'extra' | 'aside';
export interface PageHeaderHandle {
  element: HTMLElement;
  /** контейнеры слотов — для своего содержимого */
  slots: Partial<Record<PageHeaderSlot, HTMLElement>>;
  filter?: FilterHandle;
  vendor?: VendorHandle;
  setTitle(title: Content): void;
  setMenu(value: string): void;
  setView(value: string): void;
  setCounter(value: string, count: number): void;
  destroy(): void;
}

const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !(v instanceof Node);

export function createPageHeader(host: HTMLElement, options: PageHeaderOptions): PageHeaderHandle {
  const o = options;
  const cleanups: Array<() => void> = [];
  const root = h('header', { class: `b24-page-header${o.light ? ' b24-page-header--light' : ''}` });
  const slots: PageHeaderHandle['slots'] = {};
  const slot = (name: PageHeaderSlot, parent: HTMLElement, tag: 'div' | 'nav' | 'h1' = 'div') => {
    const el = h(tag, { class: `b24-page-header__${name}` });
    parent.append(el);
    slots[name] = el;
    return el;
  };
  const fill = (el: HTMLElement, items: Content[] | undefined) => items?.forEach((c) => append(el, c));

  /* строка меню */
  const hasNav = !!o.menu?.length;
  const nav = hasNav ? slot('nav', root) : null;
  const main = slot('main', root);
  const menuKey = (m: PageHeaderMenuItem) => m.value ?? m.tab ?? m.href ?? m.label;
  const menuLinks: Array<[string, HTMLElement, PageHeaderMenuItem]> = [];
  let tabsMenu: HTMLElement | null = null;
  if (nav && o.menu) {
    const menu = slot('menu', nav, 'nav');
    menu.classList.add('b24-topnav');
    menu.setAttribute('aria-label', t('Разделы'));
    for (const m of o.menu) {
      // ссылка — переход; кнопка — вкладка на странице (tab) или обработчик без href
      const a = m.tab || (m.onClick && !m.href)
        ? h('button', { type: 'button', class: 'b24-topnav__item', 'data-b24-tab': m.tab, 'aria-selected': m.tab ? String(!!m.active) : undefined, 'aria-current': !m.tab && m.active ? 'page' : undefined }, m.label)
        : h('a', { class: 'b24-topnav__item', href: m.href ?? '#', 'aria-current': m.active ? 'page' : undefined }, m.label);
      if (m.counter) a.append(h('span', { class: 'b24-counter' }, String(m.counter)));
      if (m.onClick) a.addEventListener('click', (e) => { if (!m.tab) { e.preventDefault(); setMenu(menuKey(m)); } m.onClick!(); });
      menuLinks.push([menuKey(m), a, m]);
      menu.append(a);
    }
    if (o.menu.some((m) => m.tab)) { menu.setAttribute('data-b24-tabs', ''); tabsMenu = menu; }
  }
  const setMenu = (value: string) => {
    const hit = menuLinks.find(([k]) => k === value);
    if (hit?.[2].tab) { hit[1].click(); return; } // вкладка: initTabs переключит панели
    menuLinks.forEach(([k, a, m]) => { if (m.tab) return; if (k === value) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  };

  /* строка 1 */
  const title = slot('title', main, 'h1');
  append(title, o.title);

  if (o.create) {
    const box = slot('create', main);
    if (o.create instanceof Node) box.append(o.create);
    else {
      const c = o.create;
      const btn = h(c.href ? 'a' : 'button', { class: 'b24-btn b24-btn--success', ...(c.href ? { href: c.href } : { type: 'button' }) },
        html(icon('plus')), h('span', {}, c.label ?? t('Создать')));
      if (c.onClick) btn.addEventListener('click', (e) => { if (!c.href) e.preventDefault(); c.onClick!(); });
      if (c.menu?.length) {
        const split = h('div', { class: 'b24-btn-split' });
        const chevron = h('button', { type: 'button', class: 'b24-btn b24-btn--success', 'aria-label': t('Ещё') }, html(icon('chevronDown')));
        const popup = h('div', { class: 'b24-popup', hidden: true });
        const list = h('div', { class: 'b24-menu', role: 'menu' });
        for (const it of c.menu) {
          if (it === '-') { list.append(h('div', { class: 'b24-menu__divider' })); continue; }
          const item = h(it.href ? 'a' : 'button', { class: 'b24-menu__item', role: 'menuitem', ...(it.href ? { href: it.href } : { type: 'button' }) }, it.label);
          if (it.hint) item.append(h('span', { class: 'b24-menu__hint' }, it.hint));
          if (it.onClick) item.addEventListener('click', () => it.onClick!());
          list.append(item);
        }
        popup.append(list);
        split.append(btn, chevron);
        box.append(split, popup);
        const dd: DropdownHandle = dropdown(chevron, popup, { placement: 'bottom-start' });
        cleanups.push(() => { dd.destroy(); popup.remove(); });
      } else box.append(btn);
    }
  }
  if (o.selectors?.length) fill(slot('selectors', main), o.selectors);

  let filter: FilterHandle | undefined;
  if (o.filter) {
    const box = slot('filter', main);
    if (o.filter instanceof Node) box.append(o.filter);
    else if (isPlain(o.filter)) filter = createFilter(box, { glass: !o.light, ...o.filter });
  }
  if (o.tools?.length) fill(slot('tools', main), o.tools);

  /* служебный угол: в строке меню, без неё — последним в первой строке */
  let vendor: VendorHandle | undefined;
  if (o.aside?.length || o.vendor) {
    const aside = slot('aside', nav ?? main);
    fill(aside, o.aside);
    if (o.vendor) {
      const v = h('span', {});
      aside.append(v);
      vendor = createVendor(v, { onDark: !o.light, ...o.vendor });
    }
  }

  /* строка 2 */
  const viewButtons: Array<[string, HTMLButtonElement]> = [];
  if (o.views?.items.length || o.counters?.length || o.extra?.length) {
    const sub = slot('sub', root);
    if (o.views?.items.length) {
      const views = slot('views', sub);
      const tabs = h('div', { class: `b24-tabs b24-tabs--pills${o.light ? '' : ' b24-tabs--glass'}`, role: 'tablist', 'aria-label': t('Вид') });
      for (const v of o.views.items) {
        const b = h('button', { type: 'button', role: 'tab', class: 'b24-tabs__item', 'aria-selected': String(v.value === o.views.value) }, v.label) as HTMLButtonElement;
        b.addEventListener('click', () => { setView(v.value); o.views!.onChange?.(v.value); });
        viewButtons.push([v.value, b]);
        tabs.append(b);
      }
      views.append(tabs);
    }
    if (o.counters?.length) {
      const box = slot('counters', sub);
      for (const c of o.counters) {
        const b = h('button', { type: 'button', class: `b24-btn ${o.light ? 'b24-btn--secondary' : 'b24-btn--glass'} b24-btn--sm`, 'data-value': c.value ?? c.label },
          h('span', { class: `b24-counter${c.tone ? ` b24-counter--${c.tone}` : ''}${c.count ? '' : ' b24-counter--gray'}`, 'data-tone': c.tone ?? '' }, String(c.count)),
          h('span', {}, c.label));
        if (c.onClick) b.addEventListener('click', () => c.onClick!());
        box.append(b);
      }
    }
    if (o.extra?.length) fill(slot('extra', sub), o.extra);
  }
  const setView = (value: string) => viewButtons.forEach(([k, b]) => b.setAttribute('aria-selected', String(k === value)));

  host.append(root);
  if (tabsMenu) initTabs(tabsMenu);

  return {
    element: root,
    slots,
    filter,
    vendor,
    setTitle(next) { title.textContent = ''; append(title, next); },
    setMenu,
    setView,
    setCounter(value, count) {
      const b = slots.counters?.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"]`);
      const badge = b?.querySelector<HTMLElement>('.b24-counter');
      if (!badge) return;
      badge.textContent = String(count);
      badge.classList.toggle('b24-counter--gray', !count && !badge.dataset.tone);
    },
    destroy() { cleanups.forEach((f) => f()); filter?.destroy(); vendor?.destroy(); root.remove(); },
  };
}

/* ── Проверка компоновки ───────────────────────────────────
 * Ищет то, что раз за разом ставят не туда: основную кнопку и фильтр справа, текстовые кнопки в tools.
 * Возвращает список замечаний; init() пишет их в консоль (console.warn) один раз на элемент.
 */
const PRIMARY = '.b24-btn--success, .b24-btn--primary';
const FILTER = '.b24-filter, [data-b24-filter]';
const SERVICE_ZONES = '.b24-toolbar__right, .b24-page-header__tools, .b24-page-header__extra, .b24-page-header__aside, .b24-page-bar';
const label = (el: Element) => `«${(el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40) || el.getAttribute('aria-label') || el.className}»`;

export function checkLayout(root: ParentNode = document): Array<{ element: Element; message: string }> {
  const out: Array<{ element: Element; message: string }> = [];
  root.querySelectorAll(SERVICE_ZONES).forEach((zone) => {
    const where = zone.classList.contains('b24-page-bar') ? '.b24-page-bar (строка с вкладками)' : `.${[...zone.classList].find((c) => c.startsWith('b24-'))}`;
    zone.querySelectorAll(PRIMARY).forEach((btn) => {
      if (btn.closest('.b24-popup, .b24-modal, .b24-vendor-menu')) return;
      out.push({ element: btn, message: `Основная кнопка ${label(btn)} стоит в ${where}. Как в портале, она идёт сразу после заголовка: .b24-page-header__create (createPageHeader({ create }) / <PageHeader create>).` });
    });
    zone.querySelectorAll(FILTER).forEach((f) => {
      if (f.parentElement?.closest(FILTER)) return;
      out.push({ element: f, message: `Фильтр стоит в ${where}. Его место — после «Создать» и селекторов: .b24-page-header__filter (createPageHeader({ filter }) / <PageHeader filter>).` });
    });
  });
  root.querySelectorAll('.b24-page-header__tools').forEach((zone) => {
    zone.querySelectorAll('.b24-btn:not(.b24-btn--icon)').forEach((btn) => {
      if (btn.matches(PRIMARY) || btn.closest('.b24-popup')) return;
      out.push({ element: btn, message: `В .b24-page-header__tools только кнопки-иконки, а ${label(btn)} — с текстом. Второстепенные кнопки с подписью — во второй строке справа: .b24-page-header__extra.` });
    });
  });
  root.querySelectorAll('.b24-toolbar__row').forEach((row) => {
    const search = row.querySelector(':scope > .b24-toolbar__search');
    if (!search) return;
    row.querySelectorAll(`:scope > ${PRIMARY.split(', ').join(', :scope > ')}, :scope > .b24-btn-split`).forEach((btn) => {
      if (search.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING) {
        out.push({ element: btn, message: `Основная кнопка ${label(btn)} стоит после фильтра. Порядок в портале: заголовок → «Создать» → селекторы → фильтр.` });
      }
    });
  });
  return out;
}

const warned = new WeakSet<Element>();
/** Пишет замечания checkLayout() в консоль, по одному разу на элемент. Возвращает их число. */
export function warnLayout(root: ParentNode = document): number {
  let n = 0;
  for (const { element, message } of checkLayout(root)) {
    n++;
    if (warned.has(element)) continue;
    warned.add(element);
    console.warn(`[airkit-for-b24] Компоновка: ${message} Правила — dist/AGENTS.md.`, element);
  }
  return n;
}

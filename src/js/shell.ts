/**
 * Оболочка приложения без перезагрузки страницы: режим embed, подсветка пунктов меню по адресу, обновление меню на лету.
 * Нужно, когда приложение открывается во фрейме (переходы во время звонка) и когда меню приходит с сервера динамически.
 *
 *   setEmbed(true)                  — страница без оболочки: без сайдбара и шапки (html.b24-embed); initEmbed() включает сам по ?embed=1
 *   setShellActive(url)             — подсветить пункты сайдбара и меню раздела, которые ведут на url (aria-current="page")
 *   watchShellActive()              — делать это по popstate / hashchange и вызовам history.pushState
 *   setSidebar(nav, groups)         — пересобрать сайдбар: группы и пункты; setSidebarCounter(url, n) — счётчик на пункте
 *   setTopNav(nav, items)           — пересобрать меню раздела (.b24-topnav); «Ещё ▾» пересчитывается само
 */
import { icon, type IconName } from '../icons';
import { h, html } from './dom';
import { initTopnavMore } from './topnav-more';

/* ── Режим embed ─────────────────────────────────────────── */

export const EMBED_CLASS = 'b24-embed';
/** Страница открыта как встраиваемая: ?embed=1 (или embed=true), window.name === 'b24-embed', <html data-b24-embed> / class. */
export function isEmbed(): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement;
  if (root.classList.contains(EMBED_CLASS)) return true;
  if (root.hasAttribute('data-b24-embed') && root.getAttribute('data-b24-embed') !== 'off') return true;
  try {
    const q = new URLSearchParams(location.search).get('embed');
    if (q === '1' || q === 'true') return true;
    if (window.name === 'b24-embed') return true;
  } catch { /* нет доступа к location */ }
  return false;
}
/** Включить / выключить режим: сайдбар и шапка оболочки скрыты, контент занимает всю страницу. */
export function setEmbed(on = true): void {
  document.documentElement.classList.toggle(EMBED_CLASS, on);
  document.documentElement.dispatchEvent(new CustomEvent('b24:embed', { detail: { embed: on } }));
}
export function initEmbed(): boolean {
  const on = isEmbed();
  if (on) setEmbed(true);
  return on;
}

/* ── Подсветка по адресу ─────────────────────────────────── */

export interface ShellActiveOptions {
  /** где искать (по умолчанию весь документ) */
  root?: ParentNode;
}
const toUrl = (href: string, base = location.href): URL | null => {
  try { return new URL(href, base); } catch { return null; }
};
/** Насколько пункт подходит адресу: 0 — никак; больше — точнее (точное совпадение, затем самый длинный общий путь). */
function score(item: string, target: URL): number {
  if (!item || item === '#') return 0;
  const u = toUrl(item);
  if (!u || u.origin !== target.origin) return 0;
  const sameHash = u.hash === target.hash;
  if (u.pathname === target.pathname) {
    if (u.search && u.search !== target.search) return 0;
    if (u.hash && !sameHash) return 0;
    return 1000 + (u.search ? 20 : 0) + (u.hash ? 10 : 0);
  }
  const base = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
  if (base !== '/' && target.pathname.startsWith(base)) return 10 + base.length;
  return 0;
}
function activate(items: HTMLElement[], target: URL): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestScore = 0;
  for (const el of items) {
    const href = el.getAttribute('href') ?? el.dataset.href ?? '';
    const sc = score(href, target);
    if (sc > bestScore) { best = el; bestScore = sc; }
  }
  if (!best) return null;                      // ни один пункт не подошёл — прежняя подсветка остаётся
  for (const el of items) {
    const on = el === best;
    if (on) { el.setAttribute('aria-current', 'page'); el.classList.add('is-active'); }
    else { el.removeAttribute('aria-current'); el.classList.remove('is-active'); }
  }
  return best;
}
/**
 * Подсветить пункты сайдбара и меню раздела, ведущие на url: точное совпадение важнее, затем самый длинный общий путь
 * («/crm/deals/» подсветит «/crm/»). Пункты без href и «#» не трогаются. Возвращает найденные пункты.
 */
export function setShellActive(url: string | URL = location.href, options: ShellActiveOptions = {}): { sidebar: HTMLElement | null; topnav: HTMLElement | null } {
  const target = typeof url === 'string' ? toUrl(url) : url;
  const root = options.root ?? document;
  if (!target) return { sidebar: null, topnav: null };
  const side = Array.from(root.querySelectorAll<HTMLElement>('.b24-sidebar__item'));
  const top = Array.from(root.querySelectorAll<HTMLElement>('.b24-topnav__item:not(.b24-topnav__more)'));
  const r = { sidebar: side.length ? activate(side, target) : null, topnav: top.length ? activate(top, target) : null };
  root.querySelectorAll<HTMLElement>('.b24-topnav').forEach((nav) => nav.dispatchEvent(new CustomEvent('b24:navactive', { bubbles: true })));
  return r;
}

/** Подсвечивать пункты сам: при popstate, hashchange и history.pushState / replaceState. Возвращает функцию отмены. */
export function watchShellActive(options: ShellActiveOptions = {}): () => void {
  const apply = () => setShellActive(location.href, options);
  const wrap = (name: 'pushState' | 'replaceState') => {
    const orig = history[name];
    history[name] = function patched(this: History, ...args: Parameters<History['pushState']>) {
      const r = orig.apply(this, args);
      queueMicrotask(apply);
      return r;
    } as History['pushState'];
    return () => { history[name] = orig; };
  };
  const undo = [wrap('pushState'), wrap('replaceState')];
  window.addEventListener('popstate', apply);
  window.addEventListener('hashchange', apply);
  apply();
  return () => { undo.forEach((f) => f()); window.removeEventListener('popstate', apply); window.removeEventListener('hashchange', apply); };
}

/* ── Меню на лету ────────────────────────────────────────── */

export interface ShellNavItem {
  label: string;
  href?: string;
  icon?: IconName;
  counter?: number;
  active?: boolean;
  /** пункт-кнопка вместо ссылки: клик вызывает onClick */
  onClick?: (event: MouseEvent) => void;
  title?: string;
}
export interface ShellNavGroup { title?: string; items: ShellNavItem[] }

const counterEl = (n?: number) => (n ? h('span', { class: 'b24-counter' }, n > 99 ? '99+' : String(n)) : '');

function fillItem(el: HTMLElement, it: ShellNavItem, cls: string, label: string | null): void {
  el.className = cls;
  if (el instanceof HTMLAnchorElement) el.href = it.href ?? '#';
  if (it.href) el.dataset.href = it.href;
  if (it.active) { el.setAttribute('aria-current', 'page'); el.classList.add('is-active'); }
  if (it.title) el.title = it.title;
  const kids: Node[] = [];
  if (it.icon) kids.push(html(icon(it.icon)));
  kids.push(label ? h('span', { class: label }, it.label) : document.createTextNode(it.label));
  const c = counterEl(it.counter);
  if (c) kids.push(c);
  el.replaceChildren(...kids);
  if (it.onClick) el.addEventListener('click', (e) => { e.preventDefault(); it.onClick!(e as MouseEvent); });
}

/** Пересобрать сайдбар (nav.b24-sidebar): логотип остаётся, группы и пункты — заново. Активный — по `active` или по текущему адресу. */
export function setSidebar(nav: HTMLElement | string, groups: ShellNavGroup[] | ShellNavItem[]): void {
  const el = typeof nav === 'string' ? document.querySelector<HTMLElement>(nav) : nav;
  if (!el) return;
  el.querySelectorAll(':scope > .b24-sidebar__group, :scope > .b24-sidebar__item').forEach((n) => n.remove());
  const list: ShellNavGroup[] = groups.length && 'items' in (groups[0] as ShellNavGroup) ? (groups as ShellNavGroup[]) : [{ items: groups as ShellNavItem[] }];
  for (const g of list) {
    const box = h('div', { class: 'b24-sidebar__group' });
    if (g.title) box.append(h('div', { class: 'b24-sidebar__group-title' }, g.title));
    for (const it of g.items) {
      const a = h(it.href !== undefined || !it.onClick ? 'a' : 'button', it.onClick && it.href === undefined ? { type: 'button' } : {});
      fillItem(a, it, 'b24-sidebar__item', 'b24-sidebar__label');
      box.append(a);
    }
    el.append(box);
  }
  if (!list.some((g) => g.items.some((i) => i.active))) setShellActive(location.href, { root: el });
}

/** Счётчик на пункте сайдбара или меню раздела по адресу (или тексту): 0 убирает. Для «Пропущенные: 3». */
export function setNavCounter(match: string, count: number, root: ParentNode = document): boolean {
  const target = toUrl(match);
  const items = Array.from(root.querySelectorAll<HTMLElement>('.b24-sidebar__item, .b24-topnav__item:not(.b24-topnav__more)'));
  const el = items.find((x) => (x.getAttribute('href') ?? x.dataset.href) === match)
    ?? items.find((x) => { const hr = x.getAttribute('href') ?? ''; const u = toUrl(hr); return !!(u && target && u.href === target.href); })
    ?? items.find((x) => (x.querySelector('.b24-sidebar__label')?.textContent ?? x.childNodes[0]?.textContent ?? '').trim() === match);
  if (!el) return false;
  el.querySelector(':scope > .b24-counter')?.remove();
  if (count > 0) el.append(h('span', { class: 'b24-counter' }, count > 99 ? '99+' : String(count)));
  return true;
}

/** Пересобрать меню раздела (.b24-topnav): пункты заново, «Ещё ▾» пересчитывается сама (initTopnavMore подключается при необходимости). */
export function setTopNav(nav: HTMLElement | string, items: ShellNavItem[], options: { more?: boolean } = {}): void {
  const el = typeof nav === 'string' ? document.querySelector<HTMLElement>(nav) : nav;
  if (!el) return;
  el.querySelectorAll(':scope > .b24-topnav__item:not(.b24-topnav__more)').forEach((n) => n.remove());
  const more = el.querySelector(':scope > .b24-topnav__more');
  for (const it of items) {
    const a = h(it.href !== undefined || !it.onClick ? 'a' : 'button', it.onClick && it.href === undefined ? { type: 'button' } : {});
    fillItem(a, it, 'b24-topnav__item', null);
    el.insertBefore(a, more);
  }
  if (!items.some((i) => i.active)) setShellActive(location.href, { root: el });
  if (options.more !== false) initTopnavMore(el);
}

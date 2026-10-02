import { icon } from '../icons';
import { h, html } from './dom';
import { dropdown, type DropdownHandle } from './dropdown';
import { modal, type ModalHandle } from './modal';

/* ── Галерея скриншотов + лайтбокс ──────────────────────────
 * <ul class="b24-gallery" data-b24-gallery>
 *   <li><a class="b24-gallery__item" href="full-1.png">
 *     <span class="b24-gallery__frame"><img src="thumb-1.png" alt="Список правил"></span>
 *     <span class="b24-gallery__caption">Список правил</span>
 *   </a></li>
 * </ul>
 * Без JS ссылка открывает картинку целиком; с JS — лайтбокс, ←/→ листают, Esc закрывает.
 */
export interface GalleryItem { src: string; caption: string; alt: string }

export interface GalleryHandle {
  open(index?: number): void;
  destroy(): void;
}

export function openLightbox(items: GalleryItem[], start = 0): ModalHandle {
  let index = Math.max(0, Math.min(start, items.length - 1));
  const img = h('img', { class: 'b24-lightbox__img', alt: '' });
  const caption = h('div', { class: 'b24-lightbox__caption' });
  const counter = h('div', { class: 'b24-lightbox__counter' });
  const stage = h('div', { class: 'b24-lightbox__stage' }, img);
  const multi = items.length > 1;
  const prev = h('button', { type: 'button', class: 'b24-lightbox__nav b24-lightbox__nav--prev', 'aria-label': 'Предыдущий скриншот' }, html(icon('chevronLeft')));
  const next = h('button', { type: 'button', class: 'b24-lightbox__nav b24-lightbox__nav--next', 'aria-label': 'Следующий скриншот' }, html(icon('chevronRight')));
  if (multi) stage.append(prev, next);
  const content = h('div', { class: 'b24-lightbox__content' }, stage, caption);
  if (multi) content.append(counter);

  const show = (i: number) => {
    index = (i + items.length) % items.length;
    const it = items[index];
    img.src = it.src;
    img.alt = it.alt || it.caption;
    caption.textContent = it.caption;
    caption.hidden = !it.caption;
    counter.textContent = `${index + 1} из ${items.length}`;
    // предзагрузка соседних
    if (multi) for (const j of [index - 1, index + 1]) { const n = items[(j + items.length) % items.length]; new Image().src = n.src; }
  };
  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));

  const m = modal({ title: '', content, size: 'lg', closeOnOverlay: true });
  m.element.classList.add('b24-lightbox');
  m.element.setAttribute('aria-label', 'Просмотр скриншота');
  const onKey = (e: KeyboardEvent) => {
    if (!multi) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
  };
  document.addEventListener('keydown', onKey);
  void m.result.then(() => document.removeEventListener('keydown', onKey));
  show(index);
  return m;
}

export function initGallery(root: HTMLElement): GalleryHandle {
  const links = () => Array.from(root.querySelectorAll<HTMLAnchorElement>('a.b24-gallery__item, a[data-b24-gallery-item]'));
  const items = (): GalleryItem[] => links().map((a) => {
    const im = a.querySelector('img');
    return {
      src: a.href,
      caption: a.dataset.caption ?? a.querySelector('.b24-gallery__caption')?.textContent?.trim() ?? im?.alt ?? '',
      alt: im?.alt ?? '',
    };
  });
  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a.b24-gallery__item, a[data-b24-gallery-item]');
    if (!a || !root.contains(a)) return;
    // Ctrl/Cmd/Shift/средняя кнопка — как обычная ссылка
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openLightbox(items(), links().indexOf(a));
  };
  root.addEventListener('click', onClick);
  return {
    open: (i = 0) => { openLightbox(items(), i); },
    destroy: () => root.removeEventListener('click', onClick),
  };
}

/* ── Адаптивное верхнее меню ───────────────────────────────
 * <nav class="b24-topnav" data-b24-topnav>…a.b24-topnav__item…</nav>
 * Без JS пункты переносятся на новую строку; с JS на ≤768px пункты прячутся в меню «☰ Раздел».
 */
export function initTopnav(nav: HTMLElement): () => void {
  nav.classList.add('is-enhanced');
  const items = () => Array.from(nav.querySelectorAll<HTMLAnchorElement>(':scope > a.b24-topnav__item'));
  const current = items().find((a) => a.getAttribute('aria-current') === 'page');
  const toggle = h('button', {
    type: 'button',
    class: 'b24-btn b24-btn--glass b24-btn--sm b24-topnav__toggle',
    'aria-label': 'Меню разделов',
  }, html(icon('menu', { size: 16 })), h('span', {}, current?.textContent?.trim() || 'Меню'));
  nav.append(toggle);
  const popup = h('div', { class: 'b24-popup b24-topnav-menu', hidden: true });
  const menu = h('div', { class: 'b24-menu', role: 'menu' });
  for (const a of items()) {
    const item = h('a', { class: 'b24-menu__item', href: a.href, role: 'menuitem' }, a.textContent?.trim() ?? '');
    if (a.getAttribute('aria-current')) item.setAttribute('aria-current', a.getAttribute('aria-current')!);
    if (a.target) item.setAttribute('target', a.target);
    menu.append(item);
  }
  popup.append(menu);
  nav.append(popup);
  const dd: DropdownHandle = dropdown(toggle, popup, { placement: 'bottom-start' });
  return () => { dd.destroy(); popup.remove(); toggle.remove(); nav.classList.remove('is-enhanced'); };
}

/* ── Липкая шапка сайта ────────────────────────────────────
 * <header class="b24-site-header" data-b24-site-header>
 *   <div class="b24-container b24-site-header__row">
 *     <a class="b24-brand">…</a>
 *     <nav class="b24-site-nav">
 *       <a class="b24-site-nav__link" href="…">Цены</a>
 *       <details class="b24-site-nav__group"><summary>Продукты</summary><div class="b24-megamenu">…</div></details>
 *     </nav>
 *     <div class="b24-site-header__actions">…кнопки…</div>
 *   </div>
 * </header>
 * Без JS группы раскрываются кликом (details), пункты переносятся. С JS: на ≤960px — бургер,
 * открытая группа закрывает остальные, Esc и клик мимо закрывают, при прокрутке — плотный фон.
 */
export function initSiteHeader(header: HTMLElement): () => void {
  header.classList.add('is-enhanced');
  const row = header.querySelector<HTMLElement>('.b24-site-header__row') ?? header;
  const groups = () => Array.from(header.querySelectorAll<HTMLDetailsElement>('details.b24-site-nav__group'));
  let burger = header.querySelector<HTMLButtonElement>('.b24-site-header__burger');
  if (!burger) {
    burger = h('button', { type: 'button', class: 'b24-btn b24-btn--glass b24-btn--icon b24-site-header__burger', 'aria-label': 'Открыть меню', 'aria-expanded': 'false' }, html(icon('menu'))) as HTMLButtonElement;
    row.append(burger);
  }
  // подпись и состояние — и у кнопки из разметки, и у созданной китом
  if (!burger.getAttribute('aria-label') && !burger.textContent?.trim()) burger.setAttribute('aria-label', 'Открыть меню');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('type', 'button');
  const nav = header.querySelector<HTMLElement>('.b24-site-nav');
  if (nav && !nav.id) nav.id = `b24-site-nav-${Math.random().toString(36).slice(2, 7)}`;
  if (nav) burger.setAttribute('aria-controls', nav.id);

  const closeGroups = (except?: HTMLDetailsElement) => groups().forEach((g) => { if (g !== except) g.open = false; });
  const setMenu = (open: boolean) => {
    header.classList.toggle('is-menu-open', open);
    burger!.setAttribute('aria-expanded', String(open));
    burger!.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    burger!.innerHTML = icon(open ? 'close' : 'menu');
    document.body.classList.toggle('b24-menu-open', open);
    if (!open) closeGroups();
  };
  const onBurger = () => setMenu(!header.classList.contains('is-menu-open'));
  const onToggle = (e: Event) => { const g = e.target as HTMLDetailsElement; if (g.matches?.('details.b24-site-nav__group') && g.open) closeGroups(g); };
  const onDocDown = (e: MouseEvent) => { if (!header.contains(e.target as Node)) closeGroups(); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    const open = groups().find((g) => g.open);
    if (open) { open.open = false; open.querySelector('summary')?.focus(); }
    else if (header.classList.contains('is-menu-open')) { setMenu(false); burger!.focus(); }
  };
  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    if (a && header.contains(a) && (a.closest('.b24-megamenu') || header.classList.contains('is-menu-open'))) { closeGroups(); setMenu(false); }
  };
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 4);
  const mq = window.matchMedia('(max-width: 960px)');
  const onMq = () => { if (!mq.matches) setMenu(false); };

  // повторный клик по пункту меню не должен начинать выделение текста
  const onMouseDown = (e: MouseEvent) => { if (e.detail > 1 && (e.target as HTMLElement).closest('summary, .b24-site-nav__link')) e.preventDefault(); };
  burger.addEventListener('click', onBurger);
  header.addEventListener('mousedown', onMouseDown);
  header.addEventListener('toggle', onToggle, true);
  header.addEventListener('click', onClick);
  document.addEventListener('mousedown', onDocDown);
  document.addEventListener('keydown', onKey);
  window.addEventListener('scroll', onScroll, { passive: true });
  mq.addEventListener?.('change', onMq);
  onScroll();
  const panes = Array.from(header.querySelectorAll<HTMLElement>('.b24-megamenu--panes, [data-b24-megamenu-panes]')).map((m) => initMegamenuPanes(m, mq));
  return () => {
    panes.forEach((off) => off());
    burger!.removeEventListener('click', onBurger);
    header.removeEventListener('mousedown', onMouseDown);
    header.removeEventListener('toggle', onToggle, true);
    header.removeEventListener('click', onClick);
    document.removeEventListener('mousedown', onDocDown);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('scroll', onScroll);
    mq.removeEventListener?.('change', onMq);
    header.classList.remove('is-enhanced', 'is-menu-open');
  };
}

/* Мегаменю с категориями. Без JS категории переключаются радиокнопками (клик, стрелки ↑/↓).
 * Здесь: на десктопе категория выбирается и наведением; на узком экране открытую можно свернуть
 * повторным тапом, а при открытии меню все категории свёрнуты. */
function initMegamenuPanes(menu: HTMLElement, mq: MediaQueryList): () => void {
  const inputs = () => Array.from(menu.querySelectorAll<HTMLInputElement>('.b24-megamenu__cat-label > input[type="radio"]'));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const sync = () => {
    if (mq.matches) inputs().forEach((i) => { i.checked = false; });
    else if (!inputs().some((i) => i.checked)) { const first = inputs()[0]; if (first) first.checked = true; }
  };
  const labelOf = (e: Event) => (e.target as HTMLElement).closest?.<HTMLLabelElement>('.b24-megamenu__cat-label') ?? null;
  // задержка, чтобы при движении мыши наискосок к панели не перескакивать по соседним категориям
  const onOver = (e: PointerEvent) => {
    const label = labelOf(e);
    if (!label || e.pointerType !== 'mouse' || mq.matches) return;
    clearTimeout(timer);
    timer = setTimeout(() => { const i = label.querySelector('input'); if (i) i.checked = true; }, 90);
  };
  const onOut = (e: PointerEvent) => { if (labelOf(e)) clearTimeout(timer); };
  const onClick = (e: MouseEvent) => {
    const label = labelOf(e);
    const i = label?.querySelector('input');
    if (e.target === i) return; // вторичный клик по самому радио, который порождает label
    // клик по label ещё не переключил радио: checked — прежнее состояние
    if (i && i.checked && mq.matches) { e.preventDefault(); i.checked = false; }
  };
  menu.addEventListener('pointerover', onOver);
  menu.addEventListener('pointerout', onOut);
  menu.addEventListener('click', onClick);
  mq.addEventListener?.('change', sync);
  sync();
  return () => {
    clearTimeout(timer);
    menu.removeEventListener('pointerover', onOver);
    menu.removeEventListener('pointerout', onOut);
    menu.removeEventListener('click', onClick);
    mq.removeEventListener?.('change', sync);
  };
}

/* ── Подсветка текущего раздела (якорное меню, оглавление статьи) ──
 * Активен последний раздел, верх которого уже прошёл под шапкой (и якорным меню, если оно есть).
 */
function scrollSpy(links: HTMLAnchorElement[], offset: () => number, onActive?: (a: HTMLAnchorElement) => void): () => void {
  const pairs = links
    .map((a) => ({ a, t: document.getElementById(decodeURIComponent(a.hash.slice(1))) }))
    .filter((p): p is { a: HTMLAnchorElement; t: HTMLElement } => !!p.t);
  if (!pairs.length) return () => {};
  let current: HTMLAnchorElement | null = null;
  const setActive = (a: HTMLAnchorElement | null) => {
    if (a === current) return;
    current = a;
    for (const p of pairs) {
      const on = p.a === a;
      p.a.classList.toggle('is-active', on);
      if (on) p.a.setAttribute('aria-current', 'true'); else p.a.removeAttribute('aria-current');
    }
    if (a) onActive?.(a);
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = () => {
    timer = undefined;
    const line = offset();
    let active: HTMLAnchorElement | null = null;
    // по клику заголовок встаёт на свой scroll-margin-top — он и есть линия, иначе подсветится предыдущий пункт
    for (const p of pairs) {
      const margin = parseFloat(getComputedStyle(p.t).scrollMarginTop) || 0;
      if (p.t.getBoundingClientRect().top <= Math.max(line, margin) + 1) active = p.a;
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) active = pairs[pairs.length - 1].a;
    setActive(active);
  };
  // троттлинг таймером, а не кадрами: в фоновой вкладке кадры не приходят и пересчёт бы «залип»
  const onScroll = () => { if (!timer) timer = setTimeout(update, 60); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
  return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); clearTimeout(timer); };
}

const headerBottom = () => {
  const header = document.querySelector<HTMLElement>('.b24-site-header');
  const anchor = document.querySelector<HTMLElement>('.b24-anchor-nav');
  const bottom = Math.max(header?.getBoundingClientRect().bottom ?? 0, anchor?.getBoundingClientRect().bottom ?? 0);
  return bottom + 24;
};

/* ── Якорное меню: подсветка секции, которая сейчас на экране ── */
export function initAnchorNav(nav: HTMLElement): () => void {
  // только пункты меню: кнопки справа (например, «Установить» → #pricing) — не пункты
  const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a.b24-anchor-nav__link[href^="#"], .b24-anchor-nav__list a[href^="#"]'));
  return scrollSpy(links, () => nav.getBoundingClientRect().bottom + 24, (a) => {
    const list = a.closest<HTMLElement>('.b24-anchor-nav__list');
    if (!list) return;
    const lr = list.getBoundingClientRect(), ar = a.getBoundingClientRect();
    if (ar.left < lr.left || ar.right > lr.right) list.scrollLeft += ar.left - lr.left - 16;
  });
}

/* ── Оглавление статьи ─────────────────────────────────────
 * <nav class="b24-toc" data-b24-toc [data-source="#article-body"]><p class="b24-toc__title">Содержание</p><ol>…</ol></nav>
 * Если <ol> пуст и задан data-source — оглавление собирается из h2/h3 текста (id проставляются).
 */
export function initToc(toc: HTMLElement): () => void {
  let list = toc.querySelector<HTMLOListElement>('ol');
  const src = toc.dataset.source ? document.querySelector<HTMLElement>(toc.dataset.source) : null;
  if (src && (!list || !list.children.length)) {
    if (!list) { list = h('ol', {}) as HTMLOListElement; toc.append(list); }
    let sub: HTMLOListElement | null = null;
    src.querySelectorAll<HTMLHeadingElement>('h2, h3').forEach((hd, i) => {
      if (!hd.id) hd.id = `section-${i + 1}`;
      const li = h('li', {}, h('a', { href: `#${hd.id}` }, hd.textContent?.trim() ?? ''));
      if (hd.tagName === 'H2' || !list!.lastElementChild) { list!.append(li); sub = null; }
      else { if (!sub) { sub = h('ol', {}) as HTMLOListElement; list!.lastElementChild!.append(sub); } sub.append(li); }
    });
  }
  const links = Array.from(toc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
  return scrollSpy(links, headerBottom);
}

/* ── Уведомление о cookie ──────────────────────────────────
 * <div class="b24-cookie" data-b24-cookie hidden>…<button data-b24-cookie-accept>Понятно</button></div>
 * Показывается, пока не принято (localStorage); без JS остаётся скрытым и не мешает.
 */
const COOKIE_KEY = 'b24-cookie-accepted';
export function initCookieNotice(el: HTMLElement): () => void {
  const key = el.dataset.b24Cookie || COOKIE_KEY;
  let accepted = false;
  try { accepted = localStorage.getItem(key) === '1'; } catch { /* приватный режим */ }
  if (accepted) { el.hidden = true; return () => {}; }
  el.hidden = false;
  const onClick = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('[data-b24-cookie-accept]')) return;
    try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
    el.hidden = true;
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}

/* ── Переключатель темы ────────────────────────────────────
 * <button class="b24-btn b24-btn--glass b24-btn--icon b24-theme-switch" data-b24-theme-switch>…</button>
 * Переключает data-b24-theme на <html> и запоминает выбор. Чтобы не было вспышки светлой темы,
 * в <head> можно применить сохранённое значение заранее: B24UI.applyStoredTheme() или
 * <script>try{var t=localStorage.getItem('b24-theme');if(t)document.documentElement.dataset.b24Theme=t}catch(e){}</script>
 */
const THEME_KEY = 'b24-theme';
export function applyStoredTheme(): void {
  try { const t = localStorage.getItem(THEME_KEY); if (t) document.documentElement.dataset.b24Theme = t; } catch { /* ignore */ }
}
export function initThemeSwitch(btn: HTMLElement): () => void {
  applyStoredTheme();
  const root = document.documentElement;
  const isDark = () => root.dataset.b24Theme === 'dark' || (root.dataset.b24Theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const sync = () => {
    btn.setAttribute('aria-pressed', String(isDark()));
    if (!btn.getAttribute('aria-label') && !btn.textContent?.trim()) btn.setAttribute('aria-label', 'Тёмная тема');
  };
  const onClick = () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.b24Theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
    sync();
  };
  btn.addEventListener('click', onClick);
  sync();
  return () => btn.removeEventListener('click', onClick);
}

/* ── Видео с постером ──────────────────────────────────────
 * <a class="b24-video" href="demo.mp4" data-b24-video [data-embed="https://…/embed/…"]>
 *   <img class="b24-video__poster" src="poster.jpg" alt=""><span class="b24-video__play"></span>
 * </a>
 * Без JS — ссылка на видео; с JS — плеер на месте постера.
 */
export function initVideo(el: HTMLAnchorElement): () => void {
  const onClick = (e: MouseEvent) => {
    if (el.classList.contains('is-playing')) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const embed = el.dataset.embed;
    const title = el.getAttribute('aria-label') ?? el.querySelector('.b24-video__caption')?.textContent ?? 'Видео';
    el.textContent = '';
    if (embed) {
      const src = embed + (embed.includes('?') ? '&' : '?') + 'autoplay=1';
      el.append(h('iframe', { src, title, allow: 'autoplay; fullscreen; picture-in-picture', allowfullscreen: true }));
    } else {
      el.append(h('video', { src: el.href, controls: true, autoplay: true, playsinline: true }));
    }
    el.classList.add('is-playing');
    el.removeAttribute('href');
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}

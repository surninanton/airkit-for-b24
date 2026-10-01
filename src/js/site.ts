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

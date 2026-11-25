/**
 * Выбор обоев (фон переписки): модальное окно с категориями, сеткой превью 16:10 и «Без обоев».
 *
 *   const item = await pickWallpaper({
 *     categories: [{ id: 'food', label: 'Еда', items: [{ id: 'pizza', thumb: '/w/pizza-s.jpg', src: '/w/pizza.jpg', label: 'Пицца' }, { id: 'warm', thumb: '', css: 'linear-gradient(#ffd89b,#19547b)' }] }],
 *     value: current, onPreview: (it) => feed.setBackground(it?.src ? { image: it.src } : it?.css ? { css: it.css } : null),
 *   });   // item | null (отмена); item.id === '' — «Без обоев»
 *
 * onPreview вызывается при каждом выборе (null — без обоев) и при отмене возвращает прежнее значение — страница показывает фон сразу.
 */
import { icon } from '../icons';
import { h, html } from './dom';
import { t } from './i18n';
import { modal } from './modal';

export interface WallpaperItem {
  id: string;
  /** превью (картинка); без него превью строится из css или src */
  thumb?: string;
  /** полноразмерная картинка */
  src?: string;
  /** CSS-фон: цвет или градиент */
  css?: string;
  label?: string;
}
export interface WallpaperCategory { id: string; label: string; items: WallpaperItem[] }
export interface WallpaperPickerOptions {
  categories: WallpaperCategory[];
  /** id выбранных сейчас обоев; пусто — «Без обоев» */
  value?: string | null;
  onPreview?: (item: WallpaperItem | null) => void;
  title?: string;
  okLabel?: string;
  cancelLabel?: string;
  noneLabel?: string;
}

const NONE: WallpaperItem = { id: '' };

export async function pickWallpaper(opts: WallpaperPickerOptions): Promise<WallpaperItem | null> {
  const cats = opts.categories.filter((c) => c.items.length);
  const all = cats.flatMap((c) => c.items);
  const initial = opts.value ? all.find((x) => x.id === opts.value) ?? null : null;
  let sel: WallpaperItem = initial ?? { ...NONE, label: opts.noneLabel ?? t('Без обоев') };
  let catId = cats.find((c) => initial && c.items.includes(initial))?.id ?? cats[0]?.id;

  const tabs = h('div', { class: 'b24-wallpicker__tabs', role: 'tablist', 'aria-label': t('Категории обоев') });
  const grid = h('div', { class: 'b24-wallpicker__grid', role: 'group' });
  const root = h('div', { class: 'b24-wallpicker' }, tabs, grid);

  const tile = (it: WallpaperItem, none = false): HTMLElement => {
    const on = none ? sel.id === '' : sel.id === it.id;
    const thumb = h('span', { class: 'b24-wallpicker__thumb' });
    if (none) thumb.append(html(icon('close', { size: 22 })));
    else if (it.thumb || it.src) thumb.append(h('img', { src: it.thumb || it.src!, alt: '', loading: 'lazy' }));
    else if (it.css) thumb.style.background = it.css;
    const b = h('button', { type: 'button', class: `b24-wallpicker__tile${on ? ' is-selected' : ''}${none ? ' is-none' : ''}`, 'aria-pressed': String(on), 'data-id': it.id },
      thumb, h('span', { class: 'b24-wallpicker__check', 'aria-hidden': 'true' }, html(icon('check', { size: 14 }))),
      h('span', { class: 'b24-wallpicker__label' }, none ? opts.noneLabel ?? t('Без обоев') : it.label ?? ''));
    b.addEventListener('click', () => {
      sel = none ? { ...NONE, label: opts.noneLabel ?? t('Без обоев') } : it;
      paint();
      opts.onPreview?.(none ? null : it);
    });
    return b;
  };
  const paint = () => {
    tabs.replaceChildren(...cats.map((c) => {
      const b = h('button', { type: 'button', role: 'tab', class: `b24-wallpicker__tab${c.id === catId ? ' is-active' : ''}`, 'aria-selected': String(c.id === catId), tabindex: c.id === catId ? '0' : '-1', 'data-cat': c.id }, c.label);
      b.addEventListener('click', () => { catId = c.id; paint(); });
      b.addEventListener('keydown', (e) => {
        const i = cats.findIndex((x) => x.id === catId);
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        catId = cats[(i + d + cats.length) % cats.length].id;
        paint();
        tabs.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
      });
      return b;
    }));
    tabs.hidden = cats.length < 2;
    grid.replaceChildren(tile(NONE, true), ...(cats.find((c) => c.id === catId)?.items ?? []).map((it) => tile(it)));
  };
  paint();

  const m = modal({
    title: opts.title ?? t('Обои'),
    content: root,
    size: 'lg',
    buttons: [
      { text: opts.okLabel ?? t('Применить'), variant: 'primary', closes: false, onClick: (ctx) => { void ctx.close({ picked: sel }); return false; } },
      { text: opts.cancelLabel ?? t('Отмена'), variant: 'plain', value: null },
    ],
  });
  const r = (await m.result) as { picked: WallpaperItem } | null | undefined;
  if (!r) { opts.onPreview?.(initial); return null; }
  return r.picked;
}

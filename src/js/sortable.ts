/**
 * Сортируемый список: строки-блоки с ручкой, включателем и раскрывающимися настройками.
 * Перетаскивание за ручку (мышь, перо, касание) и долгим касанием по строке на телефоне; с клавиатуры — Alt+↑ / Alt+↓
 * на ручке (↑ / ↓ без Alt — к соседней ручке). Развёрнутая строка двигается целиком. Esc во время перетаскивания — отмена.
 *
 *   createSortable(host, {
 *     items: [{ id: 'logo', title: 'Логотип', subtitle: 'Шапка чека', enabled: true }],
 *     toggle: true,
 *     renderBody: (item, el) => { el.append(settingsForm(item)); },   // есть — строка раскрывается
 *     onReorder: (ids) => save(ids),
 *   });
 */
import { icon, type IconName } from '../icons';
import { h, html } from './dom';
import { t } from './i18n';

export interface SortableItem {
  id: string;
  title?: string;
  subtitle?: string;
  icon?: IconName;
  /** включатель в строке (нужен toggle: true); по умолчанию включён */
  enabled?: boolean;
  /** строка недоступна: включатель не нажимается */
  disabled?: boolean;
  /** не двигается и не отодвигается другими (например, «Итого» внизу) */
  fixed?: boolean;
  /** раскрыта */
  open?: boolean;
  data?: unknown;
}
export interface SortableOptions {
  items: SortableItem[];
  /** включатель справа в каждой строке */
  toggle?: boolean;
  /** наполнение раскрывающейся части; вызывается один раз при первом раскрытии. Вернуть функцию — она вызовется при удалении строки */
  renderBody?: (item: SortableItem, body: HTMLElement) => void | (() => void);
  /** своё содержимое строки вместо заголовка и подписи */
  renderItem?: (item: SortableItem, content: HTMLElement) => void;
  /** порядок изменён: новый порядок id и что сдвинули */
  onReorder?: (ids: string[], moved: { id: string; from: number; to: number }) => void;
  onToggle?: (id: string, enabled: boolean, item: SortableItem) => void;
  onExpand?: (id: string, open: boolean) => void;
  /** подпись списка для скринридеров */
  label?: string;
}
export interface SortableHandle {
  element: HTMLElement;
  setItems(items: SortableItem[]): void;
  update(id: string, patch: Partial<SortableItem>): void;
  getOrder(): string[];
  /** переставить программно (без onReorder) */
  move(id: string, toIndex: number): void;
  expand(id: string, open?: boolean): void;
  /** контейнеры строки: для порталов React и т. п. */
  contentOf(id: string): HTMLElement | null;
  bodyOf(id: string): HTMLElement | null;
  destroy(): void;
}

const LONG_PRESS = 380;

export function createSortable(host: HTMLElement, options: SortableOptions): SortableHandle {
  let items = options.items.slice();
  const root = h('ol', { class: 'b24-sortable', 'aria-label': options.label });
  const live = h('div', { class: 'b24-sortable__live', 'aria-live': 'polite', role: 'status' });
  host.append(root, live);
  const lis = new Map<string, HTMLElement>();
  const cleanups = new Map<string, () => void>();
  const byId = (id: string) => items.find((x) => x.id === id);
  const expandable = !!options.renderBody;
  const uid = Math.random().toString(36).slice(2, 7);

  const order = () => Array.from(root.children).map((li) => (li as HTMLElement).dataset.id!).filter(Boolean);
  const syncItemsOrder = () => { const o = order(); items = o.map((id) => byId(id)!).filter(Boolean); };

  const fillRow = (li: HTMLElement, it: SortableItem) => {
    const enabled = it.enabled !== false;
    li.className = `b24-sortable__item${enabled || !options.toggle ? '' : ' is-off'}${it.fixed ? ' is-fixed' : ''}${li.classList.contains('is-open') ? ' is-open' : ''}${li.classList.contains('is-dragging') ? ' is-dragging' : ''}`;
    const row = li.querySelector<HTMLElement>(':scope > .b24-sortable__row')!;
    const handle = h('button', {
      type: 'button', class: 'b24-sortable__handle', 'aria-label': `${t('Переместить')}: ${it.title ?? it.id}`,
      title: t('Перетащите или Alt+↑ / Alt+↓'), disabled: it.fixed || undefined,
    }, html(icon('menu', { size: 18 })));
    const content = h('div', { class: 'b24-sortable__content' });
    if (options.renderItem) options.renderItem(it, content);
    else {
      if (it.icon) content.append(h('span', { class: 'b24-sortable__icon' }, html(icon(it.icon, { size: 18 }))));
      content.append(h('span', { class: 'b24-sortable__text' }, h('span', { class: 'b24-sortable__title' }, it.title ?? it.id), it.subtitle ? h('span', { class: 'b24-sortable__subtitle' }, it.subtitle) : ''));
    }
    const tail = h('div', { class: 'b24-sortable__tail' });
    if (options.toggle) {
      const sw = h('label', { class: 'b24-switch b24-sortable__switch' }, h('input', { type: 'checkbox', role: 'switch', 'aria-label': it.title ?? it.id }), h('span', {}));
      const input = sw.firstElementChild as HTMLInputElement;
      input.checked = enabled;
      input.disabled = !!it.disabled;
      input.addEventListener('change', () => {
        const cur = byId(it.id);
        if (!cur) return;
        cur.enabled = input.checked;
        li.classList.toggle('is-off', !input.checked);
        options.onToggle?.(it.id, input.checked, cur);
      });
      tail.append(sw);
    }
    if (expandable) {
      const open = li.classList.contains('is-open');
      const ex = h('button', { type: 'button', class: 'b24-sortable__expand', 'aria-expanded': String(open), 'aria-controls': `b24-sortable-${uid}-${it.id}`, 'aria-label': `${t('Настройки')}: ${it.title ?? it.id}` }, html(icon('chevronDown', { size: 18 })));
      tail.append(ex);
    }
    row.replaceChildren(handle, content, tail);
  };

  const ensureBody = (li: HTMLElement, it: SortableItem) => {
    let body = li.querySelector<HTMLElement>(':scope > .b24-sortable__body');
    if (!body) {
      body = h('div', { class: 'b24-sortable__body', id: `b24-sortable-${uid}-${it.id}`, hidden: '' });
      li.append(body);
      const done = options.renderBody?.(it, body);
      if (typeof done === 'function') cleanups.set(it.id, done);
    }
    return body;
  };

  const setOpen = (id: string, open: boolean) => {
    const li = lis.get(id);
    const it = byId(id);
    if (!li || !it || !expandable) return;
    const body = ensureBody(li, it);
    body.hidden = !open;
    li.classList.toggle('is-open', open);
    it.open = open;
    li.querySelector('.b24-sortable__expand')?.setAttribute('aria-expanded', String(open));
    options.onExpand?.(id, open);
  };

  const build = (it: SortableItem): HTMLElement => {
    const li = h('li', { class: 'b24-sortable__item', 'data-id': it.id }, h('div', { class: 'b24-sortable__row' }));
    lis.set(it.id, li);
    if (it.open) li.classList.add('is-open');
    fillRow(li, it);
    if (it.open && expandable) { const body = ensureBody(li, it); body.hidden = false; }
    return li;
  };

  const render = () => {
    const ids = new Set(items.map((x) => x.id));
    for (const [id, li] of lis) if (!ids.has(id)) { cleanups.get(id)?.(); cleanups.delete(id); li.remove(); lis.delete(id); }
    const next = items.map((it) => {
      const li = lis.get(it.id);
      if (!li) return build(it);
      fillRow(li, it);
      return li;
    });
    root.replaceChildren(...next);
  };

  const announce = (id: string) => {
    const i = order().indexOf(id);
    live.textContent = `${byId(id)?.title ?? id}: ${t('позиция')} ${i + 1} ${t('из')} ${items.length}`;
  };

  /* ── перетаскивание ── */
  let drag: { li: HTMLElement; id: string; grab: number; from: number; before: string[]; y: number } | null = null;
  let press: { li: HTMLElement; x: number; y: number; timer: number; pointerId: number; handle: boolean } | null = null;
  let raf = 0;

  const flip = (skip: HTMLElement, mutate: () => void) => {
    const els = Array.from(root.children).filter((c) => c !== skip) as HTMLElement[];
    const first = new Map(els.map((el) => [el, el.getBoundingClientRect().top]));
    mutate();
    for (const el of els) {
      const dy = (first.get(el) ?? 0) - el.getBoundingClientRect().top;
      if (!dy) continue;
      el.style.transition = 'none';
      el.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => { el.style.transition = 'transform 160ms ease'; el.style.transform = ''; setTimeout(() => { el.style.transition = ''; }, 200); });
    }
  };

  const place = () => {
    if (!drag) return;
    const { li, grab } = drag;
    const desired = drag.y - grab;
    li.style.transform = '';
    let guard = 0;
    for (;;) {
      if (guard++ > 50) break;
      const r = li.getBoundingClientRect();
      const mid = desired + r.height / 2;
      const next = li.nextElementSibling as HTMLElement | null;
      const prev = li.previousElementSibling as HTMLElement | null;
      const nr = next?.getBoundingClientRect();
      const pr = prev?.getBoundingClientRect();
      if (next && !next.classList.contains('is-fixed') && nr && mid > nr.top + nr.height / 2) flip(li, () => next.after(li));
      else if (prev && !prev.classList.contains('is-fixed') && pr && mid < pr.top + pr.height / 2) flip(li, () => prev.before(li));
      else break;
    }
    li.style.transform = `translateY(${desired - li.getBoundingClientRect().top}px)`;
  };

  const tick = () => {
    if (!drag) return;
    const edge = 56;
    const y = drag.y;
    const dy = y < edge ? -Math.ceil((edge - y) / 4) : y > window.innerHeight - edge ? Math.ceil((y - (window.innerHeight - edge)) / 4) : 0;
    if (dy) { window.scrollBy(0, dy); place(); }
    raf = requestAnimationFrame(tick);
  };

  const startDrag = (li: HTMLElement, y: number) => {
    const rect = li.getBoundingClientRect();
    drag = { li, id: li.dataset.id!, grab: y - rect.top, from: order().indexOf(li.dataset.id!), before: order(), y };
    li.classList.add('is-dragging');
    root.classList.add('is-sorting');
    document.body.classList.add('b24-sorting');
    raf = requestAnimationFrame(tick);
    announce(drag.id);
  };

  const finish = (cancel: boolean) => {
    if (!drag) return;
    const { li, id, from, before } = drag;
    cancelAnimationFrame(raf);
    drag = null;
    if (cancel) root.replaceChildren(...before.map((i) => lis.get(i)!));
    li.style.transition = 'transform 140ms ease';
    li.style.transform = '';
    setTimeout(() => { li.style.transition = ''; li.classList.remove('is-dragging'); }, 150);
    root.classList.remove('is-sorting');
    document.body.classList.remove('b24-sorting');
    syncItemsOrder();
    const to = order().indexOf(id);
    if (!cancel && to !== from) { announce(id); options.onReorder?.(order(), { id, from, to }); }
  };

  const onMove = (e: PointerEvent) => {
    if (drag) { drag.y = e.clientY; place(); e.preventDefault(); return; }
    if (!press || e.pointerId !== press.pointerId) return;
    const dist = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    if (press.handle) { if (dist > 3) { const p = press; press = null; startDrag(p.li, e.clientY); drag!.y = e.clientY; place(); } }
    else if (dist > 8) { clearTimeout(press.timer); press = null; }      // пользователь листает страницу
  };
  const onUp = (e: PointerEvent) => {
    if (press && e.pointerId === press.pointerId) { clearTimeout(press.timer); press = null; }
    if (drag) finish(e.type === 'pointercancel');
  };
  const onTouchMove = (e: TouchEvent) => { if (drag && e.cancelable) e.preventDefault(); };
  const onDocKey = (e: KeyboardEvent) => { if (drag && e.key === 'Escape') { e.stopPropagation(); finish(true); } };
  document.addEventListener('pointermove', onMove, { passive: false });
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('keydown', onDocKey, true);

  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || drag) return;
    const target = e.target as HTMLElement;
    const li = target.closest<HTMLElement>('.b24-sortable__item');
    if (!li || li.parentElement !== root || li.classList.contains('is-fixed')) return;
    const onHandle = !!target.closest('.b24-sortable__handle');
    if (!onHandle) {
      // долгое касание по строке — только для пальца и не по элементам управления
      if (e.pointerType !== 'touch' || target.closest('button, a, input, label, select, textarea, .b24-sortable__body')) return;
      const x = e.clientX, y = e.clientY;
      const timer = window.setTimeout(() => {
        if (!press) return;
        const p = press; press = null;
        startDrag(p.li, y);
        navigator.vibrate?.(10);
      }, LONG_PRESS);
      press = { li, x, y, timer, pointerId: e.pointerId, handle: false };
      return;
    }
    // ручка: мышь и перо — после сдвига на 3px, палец — сразу (у ручки touch-action: none)
    if (e.pointerType === 'touch') { e.preventDefault(); startDrag(li, e.clientY); return; }
    press = { li, x: e.clientX, y: e.clientY, timer: 0, pointerId: e.pointerId, handle: true };
    e.preventDefault();
  });

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const li = target.closest<HTMLElement>('.b24-sortable__item');
    if (!li || !expandable) return;
    if (target.closest('.b24-sortable__expand') || (target.closest('.b24-sortable__content') && !target.closest('a, button, input, label'))) setOpen(li.dataset.id!, !li.classList.contains('is-open'));
  });

  root.addEventListener('keydown', (e) => {
    const handle = (e.target as HTMLElement).closest<HTMLElement>('.b24-sortable__handle');
    if (!handle) return;
    const li = handle.closest<HTMLElement>('.b24-sortable__item')!;
    const id = li.dataset.id!;
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const from = order().indexOf(id);
      const sib = (e.key === 'ArrowUp' ? li.previousElementSibling : li.nextElementSibling) as HTMLElement | null;
      if (!sib || sib.classList.contains('is-fixed')) return;
      flip(li, () => { if (e.key === 'ArrowUp') sib.before(li); else sib.after(li); });
      handle.focus();
      syncItemsOrder();
      announce(id);
      options.onReorder?.(order(), { id, from, to: order().indexOf(id) });
    } else if (!e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const sib = (e.key === 'ArrowUp' ? li.previousElementSibling : li.nextElementSibling) as HTMLElement | null;
      sib?.querySelector<HTMLElement>('.b24-sortable__handle:not(:disabled)')?.focus();
    }
  });

  render();
  return {
    element: root,
    setItems(next) { items = next.slice(); render(); },
    update(id, patch) {
      const it = byId(id);
      const li = lis.get(id);
      if (!it || !li) return;
      Object.assign(it, patch);
      if ('open' in patch) setOpen(id, !!patch.open);
      fillRow(li, it);
    },
    getOrder: order,
    move(id, toIndex) {
      const li = lis.get(id);
      if (!li) return;
      const kids = Array.from(root.children).filter((c) => c !== li);
      const ref = kids[Math.max(0, Math.min(toIndex, kids.length))] ?? null;
      root.insertBefore(li, ref);
      syncItemsOrder();
    },
    expand(id, open) { setOpen(id, open ?? !lis.get(id)?.classList.contains('is-open')); },
    contentOf: (id) => lis.get(id)?.querySelector<HTMLElement>('.b24-sortable__content') ?? null,
    bodyOf: (id) => lis.get(id)?.querySelector<HTMLElement>('.b24-sortable__body') ?? null,
    destroy() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('keydown', onDocKey, true);
      cleanups.forEach((fn) => fn());
      root.remove();
      live.remove();
    },
  };
}

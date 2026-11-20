/**
 * Журнал звонков: список строк с иконкой направления, двумя строками текста, временем и длительностью справа,
 * группировка по дням («17 НОЯБРЯ»), «пропущенный» красным, счётчик непросмотренных пропущенных.
 *
 *   const log = createCallLog(el, { items, onSelect, onMissedChange: (n) => setNavCounter('/phone/missed/', n) });
 *   items: [{ id, direction: 'in' | 'out', missed: true, title: 'Мария Образцова', subtitle: '+7 (999) 123-45-67 · Доставка', time, duration: 125 }]
 */
import { createAudioPlayer } from './audio-player';
import { icon, type IconName } from '../icons';
import { avatarHtml } from './avatar';
import { h, html } from './dom';
import { t } from './i18n';
import { formatChatDay, type ChatDate } from './chat';

export interface CallLogItem {
  id: string;
  direction: 'in' | 'out';
  /** пропущенный: красная иконка и название; считается в счётчике, пока не просмотрен */
  missed?: boolean;
  title: string;
  /** вторая строка: номер, линия, ответственный */
  subtitle?: string;
  time: ChatDate;
  /** секунды или готовая строка («2:05»); у пропущенного не показывается */
  duration?: number | string;
  /** пропущенный уже просмотрен — в счётчик не входит */
  seen?: boolean;
  /** своя иконка вместо направления */
  icon?: IconName;
  /** аватар абонента вместо значка направления: URL картинки или true — инициалы по title (направление остаётся маленьким значком на углу) */
  avatar?: string | boolean;
  /** бренд / линия: «Пицца Ролл · Доставка» с логотипом или значком, цвет бренда */
  brand?: CallLogBrand;
  /** метка под названием или рядом со временем: «Ответил коллега», «Перезвонили» */
  badge?: string | { text: string; tone?: 'default' | 'success' | 'warning' | 'danger' };
  /** строка выбрана (открыта справа): подсветка и aria-selected */
  selected?: boolean;
  /** кнопки справа в строке («Перезвонить»); клик — onAction, не onSelect */
  actions?: CallLogAction[];
  /** запись разговора: под строкой встаёт компактный плеер (createAudioPlayer; метаданные грузятся по нажатию) */
  record?: { src: string; duration?: number; label?: string; download?: boolean | string };
  data?: unknown;
}
/** Метка бренда / линии у звонка: значок или картинка и подпись цветом бренда. */
export interface CallLogBrand { label?: string; icon?: IconName; /** URL логотипа */ src?: string; color?: string; title?: string }
export interface CallLogAction {
  id: string;
  label: string;
  icon?: IconName;
  /** круглая зелёная кнопка-значок, как кнопка вызова в Битрикс24 (по умолчанию — когда icon: 'phone'); подпись уходит в title и aria-label */
  round?: boolean;
  /** то же, что round (совместимость) */
  primary?: boolean;
  disabled?: boolean;
}
export interface CallLogOptions {
  items: CallLogItem[];
  /** клик (или Enter) по строке; без обработчика строки не кнопки */
  onSelect?: (id: string, item: CallLogItem) => void;
  /** группировать по дням с заголовками (по умолчанию да) */
  groupByDay?: boolean;
  emptyText?: string;
  /** нажата кнопка-действие в строке (item.actions) */
  onAction?: (actionId: string, item: CallLogItem) => void;
  /** число непросмотренных пропущенных изменилось */
  onMissedChange?: (count: number) => void;
  label?: string;
}
export interface CallLogHandle {
  element: HTMLElement;
  setItems(items: CallLogItem[]): void;
  update(id: string, patch: Partial<CallLogItem>): void;
  /** непросмотренные пропущенные */
  getMissedCount(): number;
  /** выбранная строка (null — снять выбор) */
  setSelected(id: string | null): void;
  /** отметить пропущенные просмотренными (все или указанные) */
  markSeen(ids?: string[]): void;
  destroy(): void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (d: ChatDate) => (d instanceof Date ? d : new Date(d));
const fmtTime = (d: ChatDate) => { const x = toDate(d); return `${pad(x.getHours())}:${pad(x.getMinutes())}`; };
export const formatCallDuration = (s: number | string | undefined): string => {
  if (s == null || s === '') return '';
  if (typeof s === 'string') return s;
  const sec = Math.max(0, Math.round(s));
  return sec >= 3600 ? `${Math.floor(sec / 3600)}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}` : `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
};
const dayKey = (d: ChatDate) => { const x = toDate(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };

export function createCallLog(host: HTMLElement, options: CallLogOptions): CallLogHandle {
  let items = options.items;
  const interactive = !!options.onSelect;
  const root = h('div', { class: 'b24-calllog', role: interactive ? 'listbox' : 'list', 'aria-label': options.label ?? t('Журнал звонков') });
  host.append(root);
  const rows = new Map<string, HTMLElement>();
  let lastMissed = -1;

  const missedCount = () => items.filter((i) => i.missed && !i.seen).length;
  const notify = () => { const n = missedCount(); if (n !== lastMissed) { lastMissed = n; options.onMissedChange?.(n); } };

  const fill = (row: HTMLElement, it: CallLogItem) => {
    const ico: IconName = it.icon ?? (it.missed ? 'phoneMissed' : it.direction === 'out' ? 'phoneOutgoing' : 'phoneIncoming');
    row.className = `b24-calllog__item is-${it.direction}${it.missed ? ' is-missed' : ''}${it.missed && !it.seen ? ' is-unseen' : ''}${it.selected ? ' is-selected' : ''}`;
    if (interactive) row.setAttribute('aria-selected', String(!!it.selected));
    const badge = typeof it.badge === 'string' ? { text: it.badge, tone: 'default' as const } : it.badge;
    const dur = it.missed ? '' : formatCallDuration(it.duration);
    const lead = it.avatar
      ? h('span', { class: 'b24-calllog__avatar', 'aria-hidden': 'true' }, html(avatarHtml(it.title, typeof it.avatar === 'string' ? it.avatar : undefined, 'md')), h('span', { class: 'b24-calllog__dir' }, html(icon(ico, { size: 12 }))))
      : h('span', { class: 'b24-calllog__icon', 'aria-hidden': 'true' }, html(icon(ico, { size: 18 })));
    let brand: HTMLElement | string = '';
    if (it.brand) {
      brand = h('span', { class: 'b24-calllog__brand', title: it.brand.title ?? it.brand.label });
      if (it.brand.color) (brand as HTMLElement).style.setProperty('--_brand', it.brand.color);
      if (it.brand.src) (brand as HTMLElement).append(h('img', { src: it.brand.src, alt: '', class: 'b24-calllog__brand-logo' }));
      else if (it.brand.icon) (brand as HTMLElement).append(html(icon(it.brand.icon, { size: 14 })));
      if (it.brand.label) (brand as HTMLElement).append(h('span', {}, it.brand.label));
    }
    row.replaceChildren(
      lead,
      h('span', { class: 'b24-calllog__body' }, h('span', { class: 'b24-calllog__title' }, it.title), it.subtitle ? h('span', { class: 'b24-calllog__subtitle' }, it.subtitle) : '',
        brand, badge ? h('span', { class: `b24-calllog__badge is-${badge.tone ?? 'default'}` }, badge.text) : ''),
      h('span', { class: 'b24-calllog__meta' }, h('time', { class: 'b24-calllog__time', datetime: toDate(it.time).toISOString() }, fmtTime(it.time)), dur ? h('span', { class: 'b24-calllog__duration' }, dur) : ''),
    );
    const dir = it.missed ? t('пропущенный') : it.direction === 'out' ? t('исходящий') : t('входящий');
    row.setAttribute('aria-label', `${it.title}, ${dir}, ${fmtTime(it.time)}${dur ? `, ${dur}` : ''}${badge ? `, ${badge.text}` : ''}`);
  };

  const actionButtons = (it: CallLogItem) => {
    const box = h('span', { class: 'b24-calllog__actions' });
    for (const a of it.actions ?? []) {
      const round = (a.round ?? a.primary ?? a.icon === 'phone') && !!a.icon;
      const b = h('button', { type: 'button', class: `b24-calllog__action${round ? ' is-primary is-round' : ''}`, 'aria-label': `${a.label}: ${it.title}`, title: a.label, disabled: a.disabled || undefined }, a.icon ? html(icon(a.icon, { size: round ? 20 : 18 })) : a.label);
      b.addEventListener('click', (e) => { e.stopPropagation(); options.onAction?.(a.id, it); });
      box.append(b);
    }
    return box;
  };

  const render = () => {
    rows.clear();
    if (!items.length) { root.replaceChildren(h('div', { class: 'b24-calllog__empty' }, options.emptyText ?? t('Звонков пока нет'))); notify(); return; }
    const out: HTMLElement[] = [];
    let day = '';
    for (const it of items) {
      if (options.groupByDay !== false && dayKey(it.time) !== day) {
        day = dayKey(it.time);
        out.push(h('div', { class: 'b24-calllog__day', role: 'presentation' }, formatChatDay(it.time)));
      }
      const row = interactive ? h('button', { type: 'button', role: 'option', 'data-id': it.id, tabindex: '-1' }) : h('div', { role: 'listitem', 'data-id': it.id });
      fill(row, it);
      rows.set(it.id, row);
      const acts = it.actions?.length ? actionButtons(it) : null;
      // кнопка внутри кнопки недопустима: у кликабельной строки действия — соседи в обёртке
      if (!acts) out.push(row);
      else if (!interactive) { row.append(acts); out.push(row); }
      else out.push(h('div', { class: 'b24-calllog__rowwrap', role: 'presentation' }, row, acts));
      if (it.record) {
        const rec = h('div', { class: 'b24-calllog__record', role: 'presentation' });
        out.push(rec);
        createAudioPlayer(rec, { compact: true, preload: 'none', label: t('Запись разговора'), ...it.record });
      }
    }
    root.replaceChildren(...out);
    if (interactive) { const first = rows.values().next().value as HTMLElement | undefined; if (first) first.tabIndex = 0; }
    notify();
  };

  if (interactive) {
    root.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('.b24-calllog__item');
      const it = row && items.find((x) => x.id === row.dataset.id);
      if (it) options.onSelect!(it.id, it);
    });
    root.addEventListener('keydown', (e) => {
      const list = Array.from(rows.values());
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (i < 0) return;
      const next = e.key === 'ArrowDown' ? Math.min(list.length - 1, i + 1) : e.key === 'ArrowUp' ? Math.max(0, i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : -1;
      if (next < 0) return;
      e.preventDefault();
      list.forEach((r) => { r.tabIndex = -1; });
      list[next].tabIndex = 0;
      list[next].focus();
    });
  }

  render();
  return {
    element: root,
    setItems(next) { items = next; render(); },
    update(id, patch) {
      const i = items.findIndex((x) => x.id === id);
      if (i < 0) return;
      items = items.map((x, j) => (j === i ? { ...x, ...patch } : x));
      const row = rows.get(id);
      if (row) { if ('actions' in patch) render(); else fill(row, items[i]); }
      notify();
    },
    getMissedCount: missedCount,
    setSelected(id) { items = items.map((x) => ({ ...x, selected: x.id === id })); items.forEach((it) => { const row = rows.get(it.id); if (row) fill(row, it); }); },
    markSeen(ids) {
      items = items.map((x) => (x.missed && !x.seen && (!ids || ids.includes(x.id)) ? { ...x, seen: true } : x));
      items.forEach((it) => { const row = rows.get(it.id); if (row) fill(row, it); });
      notify();
    },
    destroy() { root.remove(); },
  };
}

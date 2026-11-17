/**
 * Журнал звонков: список строк с иконкой направления, двумя строками текста, временем и длительностью справа,
 * группировка по дням («17 НОЯБРЯ»), «пропущенный» красным, счётчик непросмотренных пропущенных.
 *
 *   const log = createCallLog(el, { items, onSelect, onMissedChange: (n) => setNavCounter('/phone/missed/', n) });
 *   items: [{ id, direction: 'in' | 'out', missed: true, title: 'Мария Образцова', subtitle: '+7 (999) 123-45-67 · Доставка', time, duration: 125 }]
 */
import { icon, type IconName } from '../icons';
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
  data?: unknown;
}
export interface CallLogOptions {
  items: CallLogItem[];
  /** клик (или Enter) по строке; без обработчика строки не кнопки */
  onSelect?: (id: string, item: CallLogItem) => void;
  /** группировать по дням с заголовками (по умолчанию да) */
  groupByDay?: boolean;
  emptyText?: string;
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
    row.className = `b24-calllog__item is-${it.direction}${it.missed ? ' is-missed' : ''}${it.missed && !it.seen ? ' is-unseen' : ''}`;
    const dur = it.missed ? '' : formatCallDuration(it.duration);
    row.replaceChildren(
      h('span', { class: 'b24-calllog__icon', 'aria-hidden': 'true' }, html(icon(ico, { size: 18 }))),
      h('span', { class: 'b24-calllog__body' }, h('span', { class: 'b24-calllog__title' }, it.title), it.subtitle ? h('span', { class: 'b24-calllog__subtitle' }, it.subtitle) : ''),
      h('span', { class: 'b24-calllog__meta' }, h('time', { class: 'b24-calllog__time', datetime: toDate(it.time).toISOString() }, fmtTime(it.time)), dur ? h('span', { class: 'b24-calllog__duration' }, dur) : ''),
    );
    const dir = it.missed ? t('пропущенный') : it.direction === 'out' ? t('исходящий') : t('входящий');
    row.setAttribute('aria-label', `${it.title}, ${dir}, ${fmtTime(it.time)}${dur ? `, ${dur}` : ''}`);
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
      out.push(row);
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
      if (row) fill(row, items[i]);
      notify();
    },
    getMissedCount: missedCount,
    markSeen(ids) {
      items = items.map((x) => (x.missed && !x.seen && (!ids || ids.includes(x.id)) ? { ...x, seen: true } : x));
      items.forEach((it) => { const row = rows.get(it.id); if (row) fill(row, it); });
      notify();
    },
    destroy() { root.remove(); },
  };
}

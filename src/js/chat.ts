/**
 * Чаты: список диалогов, лента сообщений, поле ответа и каркас «список | переписка | карточка».
 * Омниканальная переписка (Telegram, VK, MAX…) и чат сотрудников — как открытые линии Битрикс24.
 *
 *   .b24-chat [data-b24-chat] (.is-dialog-open)
 *     .b24-chat__list   — createChatList
 *     .b24-chat__main   — .b24-chat__head ([data-b24-chat-back]) + createChatFeed + createChatComposer
 *     .b24-chat__aside  — карточка клиента
 * На ≤768px одна колонка: список, а после выбора диалога — переписка с кнопкой «назад»; на ≤1100px карточка скрыта.
 */
import { icon, type IconName } from '../icons';
import { avatarHtml } from './avatar';
import { autoResize } from './timeline';
import { bringToFront, h, html } from './dom';
import { renderMarkup, toPlain, MARKERS, mentionMarker } from './chat-markup';
import { createAudioPlayer } from './audio-player';
import { createMicMeter } from './phone';
import { storageGet, storageSet } from './storage';
import { getLocale, intlLocale, t } from './i18n';
import { attachEmojiPicker, openEmojiPicker } from './emoji';
import { showFloat } from './float';
import { toast } from './toast';
import { contextMenu, openContextMenu, type ContextMenuItem } from './context-menu';

export type ChatDate = Date | string | number;
const toDate = (d: ChatDate) => (d instanceof Date ? d : new Date(d));
const pad = (n: number) => String(n).padStart(2, '0');
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayNum = (d: Date) => Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);

/** Время в списке диалогов: сегодня — «14:05», вчера — «вчера», за неделю — «пн», раньше — «12.11», в прошлом году — «12.11.25». */
export function formatChatListTime(value: ChatDate, now = new Date()): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const diff = dayNum(now) - dayNum(d);
  if (diff <= 0) return hm(d);
  if (diff === 1) return t('вчера');
  if (diff < 7) return d.toLocaleDateString(intlLocale(), { weekday: 'short' }).replace('.', '');
  const y = d.getFullYear() !== now.getFullYear() ? `.${String(d.getFullYear()).slice(2)}` : '';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}${y}`;
}

/** Разделитель дат в ленте: «Сегодня», «Вчера», «16 ноября», «16 ноября 2025». */
export function formatChatDay(value: ChatDate, now = new Date()): string {
  const d = toDate(value);
  const diff = dayNum(now) - dayNum(d);
  if (diff === 0) return t('Сегодня');
  if (diff === 1) return t('Вчера');
  const year = d.getFullYear() !== now.getFullYear();
  if (getLocale() !== 'ru') return d.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long', year: year ? 'numeric' : undefined });
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${d.getDate()} ${months[d.getMonth()]}${year ? ` ${d.getFullYear()}` : ''}`;
}

/** Текст с переносами строк и ссылками http(s) — без innerHTML. */
function richText(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const re = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) frag.append(text.slice(last, m.index));
    frag.append(h('a', { href: m[0], target: '_blank', rel: 'noopener noreferrer' }, m[0]));
    last = m.index! + m[0].length;
  }
  if (last < text.length) frag.append(text.slice(last));
  return frag;
}

/* ── Список диалогов ─────────────────────────────────────── */

export interface ChatChannel {
  label: string;
  color?: string;
  /** значок из набора кита перед подписью бейджа (12px): 'users' — беседа, 'phone'… */
  icon?: IconName;
}
/**
 * Пункт меню строки (список диалогов, пункт рейла): по правому клику, долгому нажатию и с клавиатуры (Shift+F10 / клавиша меню).
 * children — вложенное меню («Добавить в папку →»), checked — отметка ✓, separator — разделитель.
 */
export interface ChatMenuAction<T> {
  id?: string;
  label?: string;
  icon?: IconName;
  /** цветной кружок 14 px вместо иконки: «Цвет папки → Бирюзовый» */
  swatch?: string;
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  children?: Array<ChatMenuAction<T>>;
  onClick?: (item: T) => void;
}
export function chatMenuItems<T>(actions: Array<ChatMenuAction<T>>, item: T): ContextMenuItem[] {
  return actions.map((a) => (a.separator
    ? { separator: true }
    : { label: a.label, icon: a.icon, swatch: a.swatch, danger: a.danger, disabled: a.disabled, checked: a.checked, children: a.children ? chatMenuItems(a.children, item) : undefined, onClick: a.onClick ? () => a.onClick!(item) : undefined }));
}
export interface ChatListItem {
  id: string;
  name: string;
  avatar?: string;
  /** время последнего сообщения */
  time?: ChatDate;
  /** текст последнего сообщения */
  preview?: string;
  /** подпись под именем, когда превью пустое: «Чат должности», «в сети» */
  subtitle?: string;
  /** последнее сообщение — наше: префикс «Вы:» */
  previewOut?: boolean;
  /** канал: «Telegram», { label: 'VK', color: '#0077ff' } */
  channel?: string | ChatChannel;
  /** бренд / магазин: отдельная метка рядом с бейджем канала («ПиР»), цвет — color */
  brand?: string | ChatChannel;
  unread?: number;
  /** точка у аватара */
  status?: 'online' | 'away';
  /** закреплён / приглушён — как в мессенджере */
  muted?: boolean;
  /** группа: заголовок («Покупатели», «Сотрудники») ставится перед первым диалогом группы; порядок — как в items */
  group?: string;
  /** собеседник печатает: вместо превью курсивом «печатает…»; строка — свой текст («Анна печатает…») */
  typing?: boolean | string;
  /** черновик в поле ответа: в превью «Черновик: текст» (красная метка) вместо последнего сообщения; набор «печатает…» важнее */
  draft?: string;
  /** закреплён: значок-булавка у времени; порядок («закреплённые первыми») задаёте вы в items, после последнего закреплённого — тонкий разделитель */
  pinned?: boolean;
  /**
   * Результат поиска по сообщениям: что подсветить в preview — строка (все вхождения без учёта регистра), список строк
   * или диапазоны [[с, по)] в символах preview. Строка получает до 2 строк текста, превью обрезается так, чтобы совпадение было видно.
   */
  highlight?: string | string[] | Array<[number, number]>;
  /** диалог, к которому относится найденное сообщение (id строки при поиске по сообщениям — уникален, например id сообщения) */
  dialogId?: string;
  /** найденное сообщение: после открытия диалога — feed.jumpTo(messageId) */
  messageId?: string;
  /** цветные полоски папок по левому краю строки (3 px, первые 3); в подсказке строки — «Папки: …» (title каждой) */
  stripes?: Array<{ color: string; title?: string }>;
}
export interface ChatListOptions {
  items: ChatListItem[];
  value?: string | null;
  onSelect?: (id: string, item: ChatListItem) => void;
  emptyText?: string;
  label?: string;
  /** меню строки: правый клик, долгое нажатие, Shift+F10 / клавиша меню; вернуть [] или null — без меню */
  itemActions?: (item: ChatListItem) => Array<ChatMenuAction<ChatListItem>> | null | undefined;
}
export interface ChatListHandle {
  element: HTMLElement;
  setItems(items: ChatListItem[]): void;
  /** изменить один диалог (новое сообщение, прочитан) — без перерисовки списка */
  update(id: string, patch: Partial<ChatListItem>): void;
  setActive(id: string | null): void;
  getActive(): string | null;
  destroy(): void;
}

/** Превью с подсветкой найденного: <mark class="b24-chat-list__mark">; начало обрезается, чтобы первое совпадение было видно. */
function highlightNodes(text: string, hl: NonNullable<ChatListItem['highlight']>): Array<string | HTMLElement> {
  let ranges: Array<[number, number]> = [];
  if (typeof hl === 'string' || (Array.isArray(hl) && typeof hl[0] === 'string')) {
    const low = text.toLowerCase();
    for (const q of (typeof hl === 'string' ? [hl] : (hl as string[]))) {
      const needle = q.toLowerCase();
      if (!needle) continue;
      for (let i = low.indexOf(needle); i >= 0; i = low.indexOf(needle, i + needle.length)) ranges.push([i, i + needle.length]);
    }
  } else ranges = (hl as Array<[number, number]>).map(([a, b]) => [Math.max(0, a), Math.min(text.length, b)] as [number, number]).filter(([a, b]) => b > a);
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push([r[0], r[1]]);
  }
  if (!merged.length) return [text];
  const cut = merged[0][0] > 32 ? merged[0][0] - 24 : 0;
  const out: Array<string | HTMLElement> = [];
  if (cut) out.push('…');
  let pos = cut;
  for (const [a, b] of merged) {
    if (b <= cut) continue;
    const from = Math.max(a, cut);
    if (from > pos) out.push(text.slice(pos, from));
    out.push(h('mark', { class: 'b24-chat-list__mark' }, text.slice(from, b)));
    pos = b;
  }
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

/** Бейдж канала: «Telegram» — фирменным цветом, если известен. */
const CHANNEL_COLORS: Record<string, string> = { telegram: '#2aabee', tg: '#2aabee', vk: '#0077ff', 'вконтакте': '#0077ff', max: '#7b4dff', whatsapp: '#25d366', avito: '#00aaff', email: '#828b95', 'сайт': '#2fc6f6' };
function channelBadge(ch: string | ChatChannel): HTMLElement {
  const c = typeof ch === 'string' ? { label: ch } : ch;
  const color = c.color ?? CHANNEL_COLORS[c.label.toLowerCase()];
  const el = h('span', { class: 'b24-chat-channel' }, c.icon ? html(icon(c.icon, { size: 12 })) : '', c.label);
  if (color) el.style.setProperty('--_c', color);
  return el;
}

export function createChatList(host: HTMLElement, options: ChatListOptions): ChatListHandle {
  let items = options.items;
  let active = options.value ?? null;
  const root = h('div', { class: 'b24-chat-list', role: 'listbox', 'aria-label': options.label ?? t('Диалоги') });
  host.append(root);
  const rows = new Map<string, HTMLElement>();

  const fill = (row: HTMLElement, it: ChatListItem) => {
    row.className = `b24-chat-list__item${it.id === active ? ' is-active' : ''}${it.unread ? ' is-unread' : ''}${it.muted ? ' is-muted' : ''}${it.highlight && it.preview ? ' is-found' : ''}${it.pinned ? ' is-pinned' : ''}`;
    row.setAttribute('aria-selected', String(it.id === active));
    const av = html(avatarHtml(it.name, it.avatar, 'lg', { status: it.status })).firstElementChild!;
    const top = h('span', { class: 'b24-chat-list__top' }, h('span', { class: 'b24-chat-list__name' }, it.name), it.time != null ? h('span', { class: 'b24-chat-list__time' }, formatChatListTime(it.time)) : '', it.pinned ? h('span', { class: 'b24-chat-list__pin', title: t('Закреплён') }, html(icon('pin', { size: 12 }))) : '');
    const preview = it.typing
      ? h('span', { class: 'b24-chat-list__preview b24-chat-list__typing' }, typeof it.typing === 'string' ? it.typing : t('печатает…'))
      : it.draft
      ? h('span', { class: 'b24-chat-list__preview b24-chat-list__draftline' }, h('span', { class: 'b24-chat-list__draft' }, `${t('Черновик')}: `), it.draft.replace(/\s+/g, ' '))
      : it.preview || !it.subtitle
      ? h('span', { class: 'b24-chat-list__preview' }, it.previewOut ? h('span', { class: 'b24-chat-list__you' }, `${t('Вы')}: `) : '', ...(it.highlight && it.preview ? highlightNodes(it.preview, it.highlight) : [it.preview ?? '']))
      : h('span', { class: 'b24-chat-list__preview b24-chat-list__subtitle' }, it.subtitle);
    const bottom = h('span', { class: 'b24-chat-list__bottom' }, preview);
    if (it.channel) bottom.append(channelBadge(it.channel));
    if (it.brand) { const bb = channelBadge(it.brand); bb.classList.add('b24-chat-channel--brand'); bottom.append(bb); }
    if (it.unread) bottom.append(h('span', { class: 'b24-counter' }, it.unread > 99 ? '99+' : String(it.unread)));
    const stripes = it.stripes?.length ? h('span', { class: 'b24-chat-list__stripes', 'aria-hidden': 'true' }, ...it.stripes.slice(0, 3).map((x) => { const b = h('span', {}); b.style.background = x.color; return b; })) : null;
    row.classList.toggle('has-stripes', !!stripes);
    const folders = (it.stripes ?? []).map((x) => x.title).filter(Boolean);
    if (folders.length) row.title = `${t('Папки')}: ${folders.join(', ')}`; else row.removeAttribute('title');
    row.replaceChildren(...(stripes ? [stripes] : []), av, h('span', { class: 'b24-chat-list__body' }, top, bottom));
    row.setAttribute('aria-label', `${it.name}${it.unread ? `, ${t('непрочитанных: {n}', { n: it.unread })}` : ''}${it.typing ? `. ${typeof it.typing === 'string' ? it.typing : t('печатает…')}` : it.preview ? `. ${it.preview}` : it.subtitle ? `. ${it.subtitle}` : ''}`);
  };

  // тонкий разделитель после последнего закреплённого (если за ним идёт незакреплённый из той же группы)
  const markPins = () => {
    items.forEach((it, i) => {
      const next = items[i + 1];
      rows.get(it.id)?.classList.toggle('is-pin-last', !!it.pinned && !!next && !next.pinned && next.group === it.group);
    });
  };
  const render = () => {
    rows.clear();
    if (!items.length) {
      root.replaceChildren(h('div', { class: 'b24-chat-list__empty' }, options.emptyText ?? t('Диалогов нет')));
      return;
    }
    const out: HTMLElement[] = [];
    let group: string | undefined;
    for (const it of items) {
      if (it.group && it.group !== group) out.push(h('div', { class: 'b24-chat-list__group', role: 'presentation' }, it.group));
      group = it.group;
      const row = h('button', { type: 'button', role: 'option', 'data-id': it.id, tabindex: '-1' });
      fill(row, it);
      rows.set(it.id, row);
      out.push(row);
    }
    root.replaceChildren(...out);
    markPins();
    const focusable = rows.get(active ?? '') ?? root.firstElementChild;
    if (focusable instanceof HTMLElement) focusable.tabIndex = 0;
  };

  const select = (id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    handle.setActive(id);
    options.onSelect?.(id, it);
  };

  root.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.b24-chat-list__item');
    if (row) select(row.dataset.id!);
  });
  root.addEventListener('keydown', (e) => {
    const list = Array.from(rows.values());
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    let next = -1;
    if (e.key === 'ArrowDown') next = Math.min(list.length - 1, i + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = list.length - 1;
    if (next < 0) return;
    e.preventDefault();
    list.forEach((r) => { r.tabIndex = -1; });
    list[next].tabIndex = 0;
    list[next].focus();
  });

  render();
  const menu = options.itemActions
    ? contextMenu(root, (_e, el) => {
      const it = items.find((x) => x.id === el.dataset.id);
      const acts = it && options.itemActions!(it);
      return acts?.length ? chatMenuItems(acts, it!) : null;
    }, { selector: '.b24-chat-list__item' })
    : null;
  const handle: ChatListHandle = {
    element: root,
    setItems(next) { items = next; render(); },
    update(id, patch) {
      const i = items.findIndex((x) => x.id === id);
      if (i < 0) return;
      items = items.map((x, j) => (j === i ? { ...x, ...patch } : x));
      const row = rows.get(id);
      if (row) fill(row, items[i]);
      markPins();
    },
    setActive(id) {
      active = id;
      rows.forEach((row, key) => {
        row.classList.toggle('is-active', key === id);
        row.setAttribute('aria-selected', String(key === id));
        row.tabIndex = key === id ? 0 : -1;
      });
    },
    getActive: () => active,
    destroy() { menu?.destroy(); root.remove(); },
  };
  return handle;
}

/* ── Лента сообщений ─────────────────────────────────────── */

export type ChatAttachment =
  | { type: 'photo'; url: string; thumb?: string; name?: string; width?: number; height?: number }
  | { type: 'file'; url: string; name: string; size?: number }
  | { type: 'voice'; url: string; duration?: number }
  /** video: player — адрес встроенного плеера (iframe, VK video_ext.php): превью с ▶, по клику плеер в пузыре 16:9; без player — превью-ссылка на url; без обоих — неактивная плашка */
  | { type: 'video'; player?: string; url?: string; thumb?: string; name?: string; duration?: number }
  | { type: 'geo'; lat: number; lng: number; label?: string; url?: string };

export interface ChatReaction {
  emoji: string;
  count: number;
  /** вы уже поставили эту реакцию */
  mine?: boolean;
  /** кто поставил — в подсказке чипа */
  users?: string[];
  /**
   * кто поставил, аватарами вместо числа в чипе: до 3 кружков с наложением (строка — имя, инициалы; { name, src } — с картинкой). При count > 3 — число.
   * Без avatars при reactionsInBubble аватары строятся по users (инициалы); без reactionsInBubble — число, как раньше.
   */
  avatars?: Array<string | { name: string; src?: string }>;
}
/** Ссылка на сообщение, на которое отвечают: quote: true — цитата фрагмента (значок кавычек); attachment — вместо текста подпись «Фото», «Файл»… */
export interface ChatReplyRef {
  id: string;
  author?: string;
  text?: string;
  attachment?: 'photo' | 'file' | 'voice' | 'video' | 'geo' | (string & {});
  quote?: boolean;
}
export interface ChatMessageAction {
  id: string;
  label: string;
  icon?: IconName;
  danger?: boolean;
  onClick: (message: ChatMessage) => void;
}
export interface ChatMessage {
  id: string;
  /** для dir: 'note': false — заметка коллеги: слева, с аватаром и именем (по умолчанию — ваша, справа) */
  mine?: boolean;
  /** in — входящее, out — наше, system — служебная строка по центру («Диалог закрыт»), note — заметка для сотрудников (жёлтая, с замком) */
  dir: 'in' | 'out' | 'system' | 'note';
  text?: string;
  time: ChatDate;
  /** подпись над пузырём: имя сотрудника в исходящих, участника — в групповом чате */
  author?: string;
  avatar?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  /** причина «не доставлено» */
  error?: string;
  attachments?: ChatAttachment[];
  /** реакции под пузырём: чипы «👍 3» */
  reactions?: ChatReaction[];
  /** это ответ на сообщение: блок цитаты над текстом (полоска, автор, 1–2 строки), клик ведёт к исходному (см. onReplyClick) */
  replyTo?: ChatReplyRef;
  /** пересланное: серая строка «Переслано от X» над текстом */
  forwarded?: { from: string };
  /** удалено: серый курсив «Сообщение удалено» вместо текста и вложений, без меню, реакций и ответа */
  deleted?: boolean;
  /** сообщение изменено: серая подпись «изменено» в meta; дата/время правки — в подсказке */
  edited?: boolean | ChatDate;
  /** false — «Изменить» из onEdit для этого сообщения не показывается (чужое, старше срока правки); по умолчанию — у своих (out и своя заметка) с текстом */
  editable?: boolean;
}
export type ChatAroundResult =
  | ChatMessage[]
  | { messages: ChatMessage[]; hasMore?: boolean; hasNewer?: boolean }
  | { before?: ChatMessage[]; message: ChatMessage; after?: ChatMessage[]; hasMore?: boolean; hasNewer?: boolean };
export interface ChatSelectAction {
  id: string;
  label: string;
  icon?: IconName;
  danger?: boolean;
  /** выбранные сообщения в порядке ленты; false — оставить режим выбора открытым */
  onClick: (messages: ChatMessage[]) => void | boolean | Promise<void | boolean>;
}
export interface ChatPinnedMessage { id: string; author?: string; text?: string; canUnpin?: boolean }
export interface ChatFeedBackground {
  /** картинка фона (url): cover, по центру */
  image?: string;
  /** CSS-фон: цвет или градиент (linear-gradient(…)) */
  css?: string;
  /** узор поверх тона: url (SVG-«дудл») — повторяется плиткой */
  pattern?: string;
  /** прозрачность узора 0–1 (по умолчанию 0.14) */
  opacity?: number;
  /** цветной слой поверх тона и под узором (rgba(...)) */
  tint?: string;
  /** размер плитки узора, px (по умолчанию 320) */
  patternSize?: number;
}
export interface ChatScrollOptions {
  /** коротко подсветить сообщение (по умолчанию да) */
  highlight?: boolean;
  /** плавная прокрутка (по умолчанию нет) */
  smooth?: boolean;
}
export interface ChatFeedOptions {
  messages?: ChatMessage[];
  /** есть сообщения раньше — кнопка «Показать раньше» */
  hasMore?: boolean;
  /** подгрузить раньше; позиция прокрутки сохраняется, когда придут новые сообщения (setMessages / prepend) */
  onLoadMore?: () => void | Promise<unknown>;
  /** лента показывает окно вокруг найденного сообщения, свежее — ниже (после jumpTo): кнопка «Показать новее» и подгрузка у низа */
  hasNewer?: boolean;
  /** подгрузить новее последнего показанного: передайте их в append() */
  onLoadNewer?: () => void | Promise<unknown>;
  /**
   * Окно вокруг сообщения для jumpTo(id), когда его нет в ленте: вернуть сообщения вокруг id (включая его) —
   * массивом или { messages, hasMore (есть раньше), hasNewer (есть новее) }, либо { before, after, message } .
   */
  onLoadAround?: (id: string) => ChatAroundResult | Promise<ChatAroundResult>;
  /** разметка в тексте: **жирный**, __курсив__, ~~зачёркнутый~~, `код`, ```блок```, «> цитата» (по умолчанию выключена — текст как есть) */
  formatting?: boolean;
  /** клик по блоку ответа (replyTo): исходное сообщение есть в ленте — прокрутка к нему с подсветкой, нет — вызывается onReplyClick (если не задан, но есть onLoadAround — лента подгружает окно вокруг сообщения сама) */
  onReplyClick?: (id: string, message: ChatMessage) => void;
  /** «Цитировать»: при выделении текста в сообщении рядом с выделением всплывает кнопка (и «Копировать»); без обработчика кнопки нет */
  onQuote?: (message: ChatMessage, selectedText: string) => void;
  /** «Переслать» в меню сообщения; без обработчика пункта нет */
  onForward?: (message: ChatMessage) => void;
  /** клик по упоминанию @[Имя](user:ID) в тексте (при formatting) */
  onMentionClick?: (id: string, message: ChatMessage) => void;
  /**
   * Фон ленты как в Telegram / MAX / WhatsApp: тон (image — картинка, css — цвет или градиент), поверх узор pattern (SVG и т. п., повторяется;
   * opacity — его прозрачность, по умолчанию 0.14) и tint — цветной слой; в тёмной теме фон затемняется. Пузыри остаются читаемыми.
   * То же — CSS-переменными на .b24-chat-feed: --b24-chat-bg, --b24-chat-bg-pattern, --b24-chat-bg-opacity.
   */
  background?: ChatFeedBackground | null;
  /** аватары у входящих (групповой чат) */
  showAvatars?: boolean;
  /** повторить отправку («не доставлено» → «Повторить») */
  onRetry?: (message: ChatMessage) => void;
  onPhotoClick?: (attachment: ChatAttachment & { type: 'photo' }, message: ChatMessage) => void;
  emptyText?: string;
  /** подпись заметок (dir: 'note') над текстом; по умолчанию «Видят только сотрудники» */
  noteLabel?: string;
  /** общая приписка в подсказке чипов реакций: «Нажмите, чтобы убрать свою» */
  reactionsHint?: string;
  /** реакции внутри пузыря, как в Telegram: после текста и вложений, в одной строке с временем (по умолчанию — под пузырём) */
  reactionsInBubble?: boolean;
  /**
   * Реакция: клик по чипу или эмодзи в полоске быстрых реакций. Ваш код ставит / снимает реакцию и передаёт новое
   * message.reactions. Задан onReact — у сообщения по наведению (на телефоне — по долгому нажатию) появляется полоска.
   */
  onReact?: (messageId: string, emoji: string, message: ChatMessage) => void;
  /** быстрые реакции в полоске (по умолчанию 👍 ❤️ 😂 😮 😢 🙏), «+» открывает панель эмодзи */
  quickReactions?: string[];
  /** «Ответить» в меню сообщения */
  onReply?: (message: ChatMessage) => void;
  /** «Изменить» в меню своих сообщений (dir: 'out' и своя заметка; скрыть у конкретного — message.editable: false; не у отправляющихся и недоставленных) — обычно composer.startEdit */
  onEdit?: (message: ChatMessage) => void;
  /** «Копировать» текст в меню сообщения (по умолчанию да) */
  copy?: boolean;
  /** свои пункты меню сообщения (после «Ответить» и «Копировать»); вернуть [] — без своих; { separator: true } — разделитель */
  actions?: (message: ChatMessage) => Array<ChatMessageAction | { separator: true }>;
  /**
   * Работа с сообщением как в Telegram / ВК / MAX: контекстное меню по правому клику, долгому нажатию и Shift+F10 / клавише меню
   * (сверху быстрые реакции и «⌄» — все эмодзи, ниже «Ответить», «Переслать», «Копировать», «Изменить» и ваши actions); у пузыря при наведении —
   * круглые кнопки «Ответить» и «⋯» (то же меню); двойной щелчок — «Ответить» (replyOnDoubleClick). Если выделен текст, остаётся меню браузера.
   * Старая полоска быстрых реакций над пузырём не рисуется (hoverReactions: true — вернуть).
   */
  messageMenu?: boolean;
  /** с messageMenu: полоска быстрых реакций над пузырём по наведению (по умолчанию нет — реакции в меню) */
  hoverReactions?: boolean;
  /** двойной щелчок по пузырю — onReply (по умолчанию включено вместе с messageMenu; не срабатывает на ссылках, вложениях, чипах реакций и блоке ответа) */
  replyOnDoubleClick?: boolean;
  /** кнопки панели режима выбора (feed.startSelect): «Переслать», «Копировать», «Удалить»…; после onReturn !== false режим закрывается */
  selectActions?: ChatSelectAction[];
  /** выбор изменился (startSelect, клик по сообщению, endSelect) */
  onSelectChange?: (selected: ChatMessage[]) => void;
  /** ✕ на полоске закреплённого сообщения (feed.setPinned) */
  onUnpin?: () => void;
  /** ✕ показывается только если разрешено: для всех закреплённых (по умолчанию нет) или для конкретного — setPinned({ canUnpin }) */
  canUnpin?: boolean;
  /** клик по полоске закреплённого, когда сообщения нет в ленте (иначе — прокрутка, onReplyClick или onLoadAround) */
  onPinnedClick?: (id: string) => void;

  /** вызывается для каждого сообщения после отрисовки (и после каждой перерисовки): добавить свою разметку в el */
  decorate?: (message: ChatMessage, el: HTMLElement) => void;
}
export interface ChatFeedHandle {
  element: HTMLElement;
  /** весь список: кит сам поймёт, что пришло сверху (прокрутка сохраняется) или снизу (прокрутка вниз, если вы были у низа) */
  setMessages(messages: ChatMessage[]): void;
  append(messages: ChatMessage[]): void;
  prepend(messages: ChatMessage[]): void;
  update(id: string, patch: Partial<ChatMessage>): void;
  setHasMore(value: boolean): void;
  /** индикатор набора внизу ленты («Анна печатает…» с анимированными точками); null — скрыть. Прокрутка не сдвигается, если пользователь не у низа */
  setTyping(text: string | null): void;
  scrollToBottom(smooth?: boolean): void;
  /** режим выбора: кружки-галочки у сообщений, панель «Выбрано: N» и selectActions; firstId — сразу отметить сообщение; Esc и «Отмена» выходят */
  startSelect(firstId?: string): void;
  endSelect(): void;
  getSelected(): ChatMessage[];
  isSelecting(): boolean;
  /** закреплённое сообщение: полоска сверху ленты (pin, «Закреплённое сообщение», текст в одну строку, ✕ при canUnpin); null — убрать */
  setPinned(pinned: ChatPinnedMessage | null): void;
  /** прокрутить к сообщению (по центру) и коротко подсветить (.is-flash); false — такого сообщения в ленте нет */
  scrollTo(id: string, options?: ChatScrollOptions): boolean;
  /**
   * Перейти к сообщению, даже если оно не загружено: есть в ленте — как scrollTo; нет — вызывается loader (или options.onLoadAround),
   * лента заменяется окном вокруг сообщения и прокручивается к нему. true — перешли.
   */
  jumpTo(id: string, loader?: (id: string) => ChatAroundResult | Promise<ChatAroundResult>, options?: ChatScrollOptions): Promise<boolean>;
  setHasNewer(value: boolean): void;
  /** фон ленты (см. options.background); null — убрать */
  setBackground(background: ChatFeedBackground | null): void;
  /** пользователь у низа ленты */
  isAtBottom(): boolean;
  destroy(): void;
}

const fmtSize = (n?: number) => (n == null ? '' : n < 1024 ? `${n} ${t('Б')}` : n < 1048576 ? `${Math.round(n / 1024)} ${t('КБ')}` : `${(n / 1048576).toFixed(1).replace('.', ',')} ${t('МБ')}`);
const fmtDur = (s?: number) => (s == null ? '' : `${Math.floor(s / 60)}:${pad(Math.round(s % 60))}`);

async function copyText(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); return; } catch { /* нет доступа к буферу — запасной путь */ }
  const ta = h('textarea', { style: 'position:fixed;opacity:0;pointer-events:none' }) as HTMLTextAreaElement;
  ta.value = text;
  document.body.append(ta);
  ta.select();
  try { document.execCommand('copy'); } catch { /* нечем копировать */ }
  ta.remove();
}

export function createChatFeed(host: HTMLElement, options: ChatFeedOptions = {}): ChatFeedHandle {
  let messages: ChatMessage[] = options.messages ?? [];
  let hasMore = !!options.hasMore;
  let loading = false;
  const root = h('div', { class: 'b24-chat-feed', role: 'log', 'aria-live': 'polite', 'aria-label': t('Сообщения'), tabindex: '0' });
  const list = h('div', { class: 'b24-chat-feed__list' });
  const more = h('button', { type: 'button', class: 'b24-btn b24-btn--plain b24-btn--sm b24-chat-feed__more' }, t('Показать раньше'));
  const typing = h('div', { class: 'b24-chat-typing', hidden: '', role: 'status' });
  let hasNewer = !!options.hasNewer;
  let loadingNewer = false;
  const newer = h('button', { type: 'button', class: 'b24-btn b24-btn--plain b24-btn--sm b24-chat-feed__newer' }, t('Показать новее'));
  newer.hidden = !hasNewer;
  const pinBar = h('div', { class: 'b24-chat-pinbar', hidden: '' });
  const selBar = h('div', { class: 'b24-chat-selbar', role: 'toolbar', 'aria-label': t('Выбранные сообщения'), hidden: '' });
  // фон: тон, цветной слой и узор — липкий слой на высоту видимой области (прокручивается не с сообщениями, как в мессенджерах)
  const bgBox = h('div', { class: 'b24-chat-feed__bg', 'aria-hidden': 'true' }, h('div', { class: 'b24-chat-feed__bg-tone' }), h('div', { class: 'b24-chat-feed__bg-tint' }), h('div', { class: 'b24-chat-feed__bg-pattern' }));
  root.append(bgBox, pinBar, selBar, more, list, typing, newer);
  const paintBg = (bg: ChatFeedBackground | null | undefined) => {
    root.classList.toggle('has-bg', !!bg);
    const set = (k: string, v: string | null) => { if (v == null) root.style.removeProperty(k); else root.style.setProperty(k, v); };
    set('--b24-chat-bg', bg ? (bg.image ? `center / cover no-repeat url("${bg.image.replace(/"/g, '%22')}")` : bg.css ?? null) : null);
    set('--b24-chat-bg-tint', bg?.tint ?? null);
    set('--b24-chat-bg-pattern', bg?.pattern ? `url("${bg.pattern.replace(/"/g, '%22')}")` : null);
    set('--b24-chat-bg-opacity', bg?.opacity != null ? String(bg.opacity) : null);
    set('--b24-chat-bg-size', bg?.patternSize ? `${bg.patternSize}px` : null);
  };
  paintBg(options.background);
  const bgRo = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => root.style.setProperty('--_h', `${root.clientHeight}px`)) : null;
  bgRo?.observe(root);
  host.append(root);

  const nearBottom = () => root.scrollHeight - root.scrollTop - root.clientHeight < 80;
  // «прилипание» к низу: картинки и голосовые догружаются и меняют высоту — если пользователь был у низа, остаёмся внизу
  let stick = true;
  let programmatic = false;

  const attachment = (a: ChatAttachment, m: ChatMessage): HTMLElement => {
    switch (a.type) {
      case 'photo': {
        // без адреса (вложение без ссылки): не битая картинка и не ссылка на текущую страницу, а неактивная плашка
        if (!a.url && !a.thumb) return h('div', { class: 'b24-chat-att b24-chat-att--file is-disabled' }, html(icon('image')), h('span', { class: 'b24-chat-att__body' }, h('span', { class: 'b24-chat-att__name' }, a.name ?? t('Фото'))));
        const img = h('img', { src: a.thumb ?? a.url, alt: a.name ?? t('Фото'), loading: 'lazy' });
        if (a.width && a.height) { img.width = a.width; img.height = a.height; }
        const link = h('a', { class: 'b24-chat-att b24-chat-att--photo', href: a.url || a.thumb, target: '_blank', rel: 'noopener' }, img);
        if (options.onPhotoClick) link.addEventListener('click', (e) => { e.preventDefault(); options.onPhotoClick!(a, m); });
        return link;
      }
      case 'file':
        if (!a.url) return h('div', { class: 'b24-chat-att b24-chat-att--file is-disabled', title: t('Файл недоступен') }, html(icon('file')), h('span', { class: 'b24-chat-att__body' }, h('span', { class: 'b24-chat-att__name' }, a.name), a.size != null ? h('span', { class: 'b24-chat-att__meta' }, fmtSize(a.size)) : ''));
        return h('a', { class: 'b24-chat-att b24-chat-att--file', href: a.url, target: '_blank', rel: 'noopener', download: a.name },
          html(icon('file')), h('span', { class: 'b24-chat-att__body' }, h('span', { class: 'b24-chat-att__name' }, a.name), a.size != null ? h('span', { class: 'b24-chat-att__meta' }, fmtSize(a.size)) : ''));
      case 'voice': {
        if (!a.url) return h('div', { class: 'b24-chat-att b24-chat-att--voice is-disabled', title: t('Запись недоступна') }, html(icon('mic')), h('span', { class: 'b24-chat-att__name' }, t('Голосовое сообщение')), a.duration != null ? h('span', { class: 'b24-chat-att__meta' }, fmtDur(a.duration)) : '');
        // компактный плеер: play / pause, полоса, время (метаданные грузятся по нажатию)
        const box = h('div', { class: 'b24-chat-att b24-chat-att--voice' });
        createAudioPlayer(box, { src: a.url, duration: a.duration, compact: true, speeds: [1], preload: 'none', label: t('Голосовое сообщение') });
        return box;
      }
      case 'video': {
        const label = a.name ?? t('Видео');
        const poster = (): HTMLElement[] => [
          ...(a.thumb ? [h('img', { src: a.thumb, alt: label, loading: 'lazy' })] : []),
          h('span', { class: 'b24-chat-att__play', 'aria-hidden': 'true' }, html(icon('play', { size: 28 }))),
          ...(a.duration != null ? [h('span', { class: 'b24-chat-att__dur' }, fmtDur(a.duration))] : []),
        ];
        const frameUrl = (() => { try { const u = new URL(a.player ?? '', location.href); return a.player && /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } })();
        if (frameUrl) {
          const box = h('div', { class: `b24-chat-att b24-chat-att--video${a.thumb ? '' : ' is-nothumb'}` });
          const btn = h('button', { type: 'button', class: 'b24-chat-att__poster', 'aria-label': `${t('Смотреть')}: ${label}`, title: label }, ...poster());
          btn.addEventListener('click', () => {
            const frame = h('iframe', {
              src: frameUrl, title: label, allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture', allowfullscreen: '',
              sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox', referrerpolicy: 'strict-origin-when-cross-origin', loading: 'lazy',
            });
            box.classList.add('is-playing');
            box.replaceChildren(frame);
          });
          box.append(btn);
          return box;
        }
        const link = a.url && /^(https?:|\/|\.)/i.test(a.url) ? a.url : '';
        if (link) return h('a', { class: `b24-chat-att b24-chat-att--video${a.thumb ? '' : ' is-nothumb'}`, href: link, target: '_blank', rel: 'noopener', title: label, 'aria-label': `${t('Смотреть')}: ${label}` }, ...poster());
        return h('div', { class: 'b24-chat-att b24-chat-att--file is-disabled', title: t('Видео недоступно') }, html(icon('play')), h('span', { class: 'b24-chat-att__body' }, h('span', { class: 'b24-chat-att__name' }, label), a.duration != null ? h('span', { class: 'b24-chat-att__meta' }, fmtDur(a.duration)) : ''));
      }
      case 'geo': {
        const url = a.url ?? `https://yandex.ru/maps/?pt=${a.lng},${a.lat}&z=16&l=map`;
        return h('a', { class: 'b24-chat-att b24-chat-att--geo', href: url, target: '_blank', rel: 'noopener' },
          html(icon('mapPin')), h('span', { class: 'b24-chat-att__body' }, h('span', { class: 'b24-chat-att__name' }, a.label ?? t('Геоточка')), h('span', { class: 'b24-chat-att__meta' }, `${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}`)));
      }
    }
  };

  const statusIcon = (m: ChatMessage) => {
    if (m.dir !== 'out' || !m.status || m.status === 'failed') return '';
    const label = { sending: t('Отправляется'), sent: t('Отправлено'), delivered: t('Доставлено'), read: t('Прочитано') }[m.status];
    const name = m.status === 'sending' ? 'clock' : m.status === 'sent' ? 'check' : 'checkDouble';
    return h('span', { class: `b24-chat-msg__status is-${m.status}`, title: label, 'aria-label': label }, html(icon(name, { size: 14 })));
  };

  /** выделенный текст внутри сообщения (пусто — выделения нет или оно в другом месте) */
  const textElOf = (n: Node | null) => (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>('.b24-chat-msg__text') ?? null;
  const selectedIn = (id: string): string => {
    const s = getSelection();
    if (!s || s.isCollapsed) return '';
    const a = textElOf(s.anchorNode);
    return a && a === textElOf(s.focusNode) && a.closest<HTMLElement>('.b24-chat-msg')?.dataset.id === id ? s.toString() : '';
  };
  let selSnap: { id: string; text: string } | null = null;
  let selecting = false;
  const selected = new Set<string>();
  /** переход к исходному сообщению: есть в ленте — прокрутка и подсветка, нет — onReplyClick или подгрузка окна (onLoadAround) */
  const goTo = (id: string, m: ChatMessage) => {
    if (handle.scrollTo(id)) return;
    if (options.onReplyClick) options.onReplyClick(id, m);
    else if (options.onLoadAround) void handle.jumpTo(id);
  };

  /** Быстрые реакции в меню сообщения: ряд эмодзи и «⌄» — все эмодзи. */
  const reactionsRow = (m: ChatMessage, close: () => void): HTMLElement => {
    const row = h('div', { class: 'b24-chat-menu__reactions', role: 'group', 'aria-label': t('Реакции') });
    for (const e of options.quickReactions ?? ['👍', '❤️', '😂', '😮', '😢', '🙏']) {
      const b = h('button', { type: 'button', class: 'b24-chat-menu__reaction', 'aria-label': e, 'data-emoji': e }, e);
      b.addEventListener('click', () => { close(); options.onReact!(m.id, e, m); });
      row.append(b);
    }
    const all = h('button', { type: 'button', class: 'b24-chat-menu__reaction b24-chat-menu__reaction--all', 'aria-label': t('Другая реакция'), title: t('Другая реакция') }, html(icon('chevronDown', { size: 16 })));
    all.addEventListener('click', () => {
      close();
      const anchor = findEl(m.id)?.querySelector<HTMLElement>('.b24-chat-msg__bubble') ?? root;
      openEmojiPicker(anchor, { align: isMine(m) ? 'end' : 'start', onSelect: (e) => options.onReact!(m.id, e, m) });
    });
    row.append(all);
    return row;
  };
  const isMine = (m: ChatMessage) => m.dir === 'out' || (m.dir === 'note' && m.mine !== false);
  const menuItemsFor = (m: ChatMessage): ContextMenuItem[] => {
    const out: ContextMenuItem[] = [];
    if (options.onReact) { out.push({ content: (close) => reactionsRow(m, close) }); out.push({ separator: true }); }
    for (const a of messageActions(m)) {
      if ('separator' in a) { if (out.length && !out[out.length - 1].separator) out.push({ separator: true }); continue; }
      out.push({ label: a.label, icon: a.icon, danger: a.danger, onClick: () => a.onClick(m) });
    }
    while (out.length && out[out.length - 1].separator) out.pop();
    return out.length === 1 && out[0].separator ? [] : out;
  };
  const openMenuAt = (m: ChatMessage, x: number, y: number) => {
    const items = menuItemsFor(m);
    if (items.length) openContextMenu(x, y, items);
  };
  /** Круглые кнопки сбоку пузыря (при наведении): «Ответить» и «⋯» с тем же меню. */
  const buildSide = (m: ChatMessage): HTMLElement | null => {
    const hasMenu = messageMenuItemsExist(m);
    if (!options.onReply && !hasMenu) return null;
    const side = h('div', { class: 'b24-chat-msg__side', role: 'toolbar', 'aria-label': t('Действия с сообщением') });
    if (options.onReply) {
      const b = h('button', { type: 'button', class: 'b24-chat-msg__sidebtn', 'aria-label': t('Ответить'), title: t('Ответить'), 'data-act': 'reply' }, html(icon('reply', { size: 16 })));
      b.addEventListener('click', (e) => { e.stopPropagation(); options.onReply!(m); });
      side.append(b);
    }
    if (hasMenu) {
      const b = h('button', { type: 'button', class: 'b24-chat-msg__sidebtn', 'aria-label': t('Ещё'), title: t('Ещё'), 'aria-haspopup': 'menu', 'data-act': 'more' }, html(icon('more', { size: 16 })));
      b.addEventListener('pointerdown', () => { selSnap = { id: m.id, text: selectedIn(m.id) }; });
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const r = b.getBoundingClientRect();
        openMenuAt(m, isMine(m) ? r.right - 200 : r.left, r.bottom + 4);
      });
      side.append(b);
    }
    return side;
  };
  const messageMenuItemsExist = (m: ChatMessage) => !!options.onReact || messageActions(m).some((a) => !('separator' in a));

  /** Блок «ответ на…» в пузыре: полоска акцента, автор, 1–2 строки; клик — к исходному сообщению. */
  const replyBlock = (m: ChatMessage): HTMLElement => {
    const r = m.replyTo!;
    const kinds: Record<string, string> = { photo: t('Фото'), file: t('Файл'), voice: t('Голосовое сообщение'), video: t('Видео'), geo: t('Геоточка') };
    const body = r.text?.trim() ? (options.formatting ? toPlain(r.text) : r.text) : r.attachment ? kinds[r.attachment] ?? r.attachment : '';
    const el = h('div', { class: `b24-chat-msg__reply${r.quote ? ' is-quote' : ''}`, role: 'button', tabindex: '0', 'data-reply-id': r.id, title: t('Перейти к сообщению') },
      r.quote ? html(icon('quote', { size: 12 })) : '', r.author ? h('span', { class: 'b24-chat-msg__reply-author' }, r.author) : '', h('span', { class: 'b24-chat-msg__reply-text' }, body));
    const go = () => goTo(r.id, m);
    el.addEventListener('click', (e) => { e.preventDefault(); go(); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    return el;
  };

  const buildMessage = (m: ChatMessage, prev?: ChatMessage): HTMLElement => {
    if (m.dir === 'system') return h('div', { class: 'b24-chat-system', 'data-id': m.id }, h('span', {}, m.text ?? ''));
    const d = toDate(m.time);
    // подряд от одного автора в пределах 5 минут — без повторной подписи
    const grouped = !!prev && prev.dir === m.dir && prev.author === m.author && dayNum(toDate(prev.time)) === dayNum(d) && d.getTime() - toDate(prev.time).getTime() < 5 * 60000;
    const el = h('div', { class: `b24-chat-msg is-${m.dir === 'note' ? `${m.mine === false ? 'in' : 'out'} is-note` : m.dir}${m.status === 'failed' ? ' is-failed' : ''}${grouped ? ' is-grouped' : ''}${m.deleted ? ' is-deleted' : ''}${selected.has(m.id) ? ' is-selected' : ''}`, 'data-id': m.id });
    el.append(h('span', { class: 'b24-chat-msg__check', role: 'checkbox', 'aria-checked': String(selected.has(m.id)), 'aria-label': t('Выбрать') }, html(icon('check', { size: 14 }))));
    if ((options.showAvatars && m.dir === 'in') || (m.dir === 'note' && m.mine === false)) el.append(grouped ? h('span', { class: 'b24-chat-msg__avatar' }) : html(avatarHtml(m.author ?? '', m.avatar, 'sm')).firstElementChild!);
    const bubble = h('div', { class: 'b24-chat-msg__bubble' });
    if (m.dir === 'note') bubble.append(h('div', { class: 'b24-chat-msg__note' }, html(icon('lock', { size: 12 })), h('span', {}, options.noteLabel ?? t('Видят только сотрудники'))));
    if (m.author && !grouped) bubble.append(h('div', { class: 'b24-chat-msg__author' }, m.author));
    const del = !!m.deleted;
    if (del) bubble.append(h('div', { class: 'b24-chat-msg__deleted' }, t('Сообщение удалено')));
    else {
      if (m.forwarded) bubble.append(h('div', { class: 'b24-chat-msg__fwd' }, html(icon('forward', { size: 12 })), h('span', {}, t('Переслано от {from}', { from: m.forwarded.from }))));
      if (m.replyTo) bubble.append(replyBlock(m));
      if (m.attachments?.length) bubble.append(h('div', { class: 'b24-chat-msg__atts' }, ...m.attachments.map((a) => attachment(a, m))));
      if (m.text) bubble.append(h('div', { class: 'b24-chat-msg__text' }, options.formatting ? renderMarkup(m.text) : richText(m.text)));
    }
    const meta = h('span', { class: 'b24-chat-msg__meta' });
    if (m.edited && !del) {
      const ed = m.edited === true ? null : toDate(m.edited);
      meta.append(h('span', { class: 'b24-chat-msg__edited', title: ed && !isNaN(ed.getTime()) ? `${t('Изменено')} ${formatChatDay(ed)}, ${hm(ed)}` : undefined }, t('изменено')));
    }
    meta.append(h('time', { datetime: d.toISOString() }, hm(d)), del ? '' : statusIcon(m));
    const inBubble = !del && !!options.reactionsInBubble && !!m.reactions?.some((r) => r.count > 0);
    const reactionChips = (): HTMLElement => {
      const chips = h('div', { class: 'b24-chat-reactions', role: 'group', 'aria-label': t('Реакции') });
      for (const r of m.reactions ?? []) {
        if (r.count <= 0) continue;
        const who = r.avatars ?? (options.reactionsInBubble ? r.users : undefined);
        const people = who && who.length && r.count <= 3 ? who.slice(0, 3).map((x) => (typeof x === 'string' ? { name: x } : x)) : [];
        const chip = h('button', {
          type: 'button', class: `b24-chat-reaction${r.mine ? ' is-mine' : ''}${people.length ? ' has-avatars' : ''}`, 'data-emoji': r.emoji, 'aria-pressed': String(!!r.mine),
          title: [r.users?.length ? r.users.join(', ') : people.map((p) => p.name).join(', '), options.reactionsHint ?? ''].filter(Boolean).join(' — ') || undefined, 'aria-label': `${r.emoji} ${r.count}`,
        }, h('span', { class: 'b24-chat-reaction__emoji' }, r.emoji));
        if (people.length) {
          const stack = h('span', { class: 'b24-chat-reaction__avatars', 'aria-hidden': 'true' });
          for (const p of people) stack.append(html(avatarHtml(p.name, p.src, 'xs')).firstElementChild!);
          chip.append(stack);
        } else chip.append(h('span', { class: 'b24-chat-reaction__count' }, String(r.count)));
        if (options.onReact) chip.addEventListener('click', () => options.onReact!(m.id, r.emoji, m));
        else chip.disabled = true;
        chips.append(chip);
      }
      return chips;
    };
    if (inBubble) bubble.append(h('div', { class: 'b24-chat-msg__foot' }, reactionChips(), meta));
    else bubble.append(meta);
    const col = h('div', { class: 'b24-chat-msg__col' }, bubble);
    if (m.status === 'failed') {
      const err = h('div', { class: 'b24-chat-msg__error', role: 'alert' }, html(icon('warning', { size: 14 })), h('span', {}, `${t('Не доставлено')}${m.error ? `: ${m.error}` : ''}`));
      if (options.onRetry) {
        const retry = h('button', { type: 'button', class: 'b24-chat-msg__retry' }, t('Повторить'));
        retry.addEventListener('click', () => options.onRetry!(m));
        err.append(retry);
      }
      col.append(err);
    }
    if (!del && !inBubble && m.reactions?.some((r) => r.count > 0)) col.append(reactionChips());
    if (options.messageMenu && !del) { const side = buildSide(m); if (side) bubble.append(side); }
    const tools = del || (options.messageMenu && !options.hoverReactions) ? null : buildTools(m);
    if (tools) col.append(tools);
    el.append(col);
    return el;
  };

  const messageActions = (m: ChatMessage): Array<ChatMessageAction | { separator: true }> => {
    const list: Array<ChatMessageAction | { separator: true }> = [];
    if (options.onReply) list.push({ id: 'reply', label: t('Ответить'), icon: 'reply', onClick: options.onReply });
    if (options.onForward) list.push({ id: 'forward', label: t('Переслать'), icon: 'forward', onClick: options.onForward });
    // выделена часть текста — копируется она, иначе весь текст (при formatting — без маркеров разметки)
    if (m.text && options.copy !== false) list.push({ id: 'copy', label: t('Копировать'), icon: 'copy', onClick: (x) => { const sel = selectedIn(x.id) || (selSnap?.id === x.id ? selSnap.text : ''); selSnap = null; void copyText(sel || (options.formatting ? toPlain(x.text ?? '') : x.text ?? '')); } });
    if (options.onEdit && (m.dir === 'out' || (m.dir === 'note' && m.mine !== false)) && m.editable !== false && m.text && m.status !== 'failed' && m.status !== 'sending') list.push({ id: 'edit', label: t('Изменить'), icon: 'edit', onClick: options.onEdit });
    return [...list, ...(options.actions?.(m) ?? [])];
  };

  /** Полоска быстрых реакций и «⋯» над пузырём: по наведению / фокусу, на телефоне — по долгому нажатию (.is-tools). */
  const buildTools = (m: ChatMessage): HTMLElement | null => {
    const acts = (options.messageMenu ? [] : messageActions(m)).filter((a): a is ChatMessageAction => !('separator' in a));
    if (!options.onReact && !acts.length) return null;
    const bar = h('div', { class: 'b24-chat-msg__tools', role: 'toolbar', 'aria-label': t('Действия с сообщением') });
    if (options.onReact) {
      for (const e of options.quickReactions ?? ['👍', '❤️', '😂', '😮', '😢', '🙏']) {
        const b = h('button', { type: 'button', class: 'b24-chat-msg__tool b24-chat-msg__tool--emoji', 'aria-label': e, 'data-emoji': e }, e);
        b.addEventListener('click', () => { options.onReact!(m.id, e, m); hideTools(); });
        bar.append(b);
      }
      const plus = h('button', { type: 'button', class: 'b24-chat-msg__tool', 'aria-label': t('Другая реакция'), title: t('Другая реакция') }, html(icon('smile', { size: 16 })));
      plus.addEventListener('click', () => {
        openEmojiPicker(plus, { align: m.dir === 'out' || (m.dir === 'note' && m.mine !== false) ? 'end' : 'start', onSelect: (e) => { options.onReact!(m.id, e, m); hideTools(); } });
      });
      bar.append(plus);
    }
    if (acts.length) {
      const more = h('button', { type: 'button', class: 'b24-chat-msg__tool', 'aria-label': t('Ещё'), title: t('Ещё'), 'aria-haspopup': 'menu' }, html(icon('more', { size: 16 })));
      more.addEventListener('pointerdown', () => { selSnap = { id: m.id, text: selectedIn(m.id) }; });
      more.addEventListener('click', () => {
        const menu = h('div', { class: 'b24-chat-menu', role: 'menu' });
        const fl = showFloat(more, menu, { align: m.dir === 'out' || (m.dir === 'note' && m.mine !== false) ? 'end' : 'start', sheet: false, onClose: () => more.focus({ preventScroll: true }) });
        for (const a of acts) {
          const item = h('button', { type: 'button', role: 'menuitem', class: `b24-chat-menu__item${a.danger ? ' is-danger' : ''}` }, a.icon ? html(icon(a.icon, { size: 16 })) : '', h('span', {}, a.label));
          item.addEventListener('click', () => { fl.close(); hideTools(); a.onClick(m); });
          menu.append(item);
        }
        fl.reposition();
        (menu.firstElementChild as HTMLElement | null)?.focus();
      });
      bar.append(more);
    }
    return bar;
  };

  /** Долгое нажатие (телефон) показывает полоску; касание в другом месте скрывает. */
  let pressTimer = 0;
  let toolsEl: HTMLElement | null = null;
  const hideTools = () => { toolsEl?.classList.remove('is-tools'); toolsEl = null; };
  list.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement;
    const msg = target.closest<HTMLElement>('.b24-chat-msg');
    if (toolsEl && (!msg || msg !== toolsEl) && !target.closest('.b24-chat-msg__tools')) hideTools();
    if (options.messageMenu || e.pointerType !== 'touch' || !msg || !msg.querySelector('.b24-chat-msg__tools') || target.closest('a, button, audio')) return;
    clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => { hideTools(); msg.classList.add('is-tools'); toolsEl = msg; }, 450);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointermove']) list.addEventListener(ev, () => clearTimeout(pressTimer), { passive: true });
  list.addEventListener('contextmenu', (e) => { if (options.messageMenu) return; if (toolsEl || (e.target as HTMLElement).closest('.b24-chat-msg__bubble') && matchMedia('(pointer: coarse)').matches) e.preventDefault(); });

  const render = () => {
    toolsEl = null;
    more.hidden = !hasMore;
    if (!messages.length) {
      list.replaceChildren(h('div', { class: 'b24-chat-feed__empty' }, options.emptyText ?? t('Сообщений пока нет')));
      return;
    }
    const out: HTMLElement[] = [];
    let prev: ChatMessage | undefined;
    for (const m of messages) {
      const d = toDate(m.time);
      if (!prev || dayNum(toDate(prev.time)) !== dayNum(d)) {
        out.push(h('div', { class: 'b24-chat-date', role: 'separator' }, h('span', {}, formatChatDay(d))));
        prev = undefined;
      }
      const el = buildMessage(m, prev);
      if (options.decorate) { try { options.decorate(m, el); } catch (err) { console.error('[airkit-for-b24] decorate:', err); } }
      out.push(el);
      prev = m;
    }
    list.replaceChildren(...out);
  };


  /* ── контекстное меню, двойной щелчок, режим выбора, закреплённое ── */
  const msgOf = (n: Element | null) => { const el = n?.closest<HTMLElement>('.b24-chat-msg'); return el ? messages.find((x) => x.id === el.dataset.id) : undefined; };
  let lastMsgEl: HTMLElement | null = null;
  list.addEventListener('pointerover', (e) => { const el = (e.target as HTMLElement).closest<HTMLElement>('.b24-chat-msg'); if (el) lastMsgEl = el; });
  const menuHandle = options.messageMenu
    ? contextMenu(list, (e, target) => {
      const m = msgOf(target);
      // выделен текст — оставляем меню браузера (копирование), выделение «Цитировать» — плашка у выделения
      if (!m || m.dir === 'system' || m.deleted || selecting || selectedIn(m.id) || target.closest('.b24-chat-msg__side, .b24-chat-msg__check')) return null;
      selSnap = null;
      void e;
      return menuItemsFor(m);
    }, { selector: '.b24-chat-msg__bubble' })
    : null;
  // Shift+F10 / клавиша меню: меню для сообщения в фокусе, под курсором или последнего
  const onMenuKey = (e: KeyboardEvent) => {
    if (!options.messageMenu || selecting || !((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu')) return;
    const active = document.activeElement as HTMLElement | null;
    const el = (active && active !== root ? active.closest<HTMLElement>('.b24-chat-msg') : null) ?? (lastMsgEl && list.contains(lastMsgEl) ? lastMsgEl : null) ?? (list.querySelector<HTMLElement>('.b24-chat-msg:last-of-type'));
    const m = msgOf(el);
    if (!el || !m || m.dir === 'system' || m.deleted) return;
    e.preventDefault();
    const r = (el.querySelector('.b24-chat-msg__bubble') ?? el).getBoundingClientRect();
    openMenuAt(m, r.left + Math.min(40, r.width / 2), r.top + Math.min(24, r.height / 2));
  };
  root.addEventListener('keydown', onMenuKey);
  // двойной щелчок по пузырю — «Ответить»
  const dblReply = !!options.onReply && (options.replyOnDoubleClick ?? !!options.messageMenu);
  const dblTarget = (t0: Element) => !!t0.closest('.b24-chat-msg__bubble') && !t0.closest('a, button, audio, video, input, textarea, .b24-chat-msg__atts, .b24-chat-reaction, .b24-chat-reactions, .b24-chat-msg__reply, .b24-chat-msg__side, .b24-chat-msg__tools, .b24-chat-msg__error');
  if (dblReply) {
    list.addEventListener('mousedown', (e) => { if (e.detail > 1 && !selecting && dblTarget(e.target as Element)) e.preventDefault(); });
    list.addEventListener('dblclick', (e) => {
      const m = msgOf(e.target as Element);
      if (!m || m.dir === 'system' || m.deleted || selecting || !dblTarget(e.target as Element)) return;
      getSelection()?.removeAllRanges();
      options.onReply!(m);
    });
  }

  // клик по упоминанию
  list.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('.b24-chat-mention');
    if (!a || selecting) return;
    e.preventDefault();
    const m = msgOf(a);
    if (m && a.dataset.userId) options.onMentionClick?.(a.dataset.userId, m);
  });
  // режим выбора
  const selectedMsgs = () => messages.filter((x) => selected.has(x.id));
  const paintSel = () => {
    list.querySelectorAll<HTMLElement>('.b24-chat-msg[data-id]').forEach((el) => {
      const on = selected.has(el.dataset.id!);
      el.classList.toggle('is-selected', on);
      el.querySelector('.b24-chat-msg__check')?.setAttribute('aria-checked', String(on));
    });
    selBar.replaceChildren();
    if (!selecting) return;
    const n = selected.size;
    selBar.append(h('span', { class: 'b24-chat-selbar__count', 'aria-live': 'polite' }, t('Выбрано: {n}', { n })));
    for (const a of options.selectActions ?? []) {
      const b = h('button', { type: 'button', class: `b24-chat-selbar__btn${a.danger ? ' is-danger' : ''}`, 'data-id': a.id, disabled: n === 0 }, a.icon ? html(icon(a.icon, { size: 16 })) : '', h('span', {}, a.label));
      b.addEventListener('click', async () => {
        const r = await a.onClick(selectedMsgs());
        if (r !== false) handle.endSelect();
      });
      selBar.append(b);
    }
    const cancel = h('button', { type: 'button', class: 'b24-chat-selbar__btn b24-chat-selbar__cancel', 'data-id': 'cancel' }, t('Отмена'));
    cancel.addEventListener('click', () => handle.endSelect());
    selBar.append(cancel);
    options.onSelectChange?.(selectedMsgs());
  };
  list.addEventListener('click', (e) => {
    if (!selecting) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('.b24-chat-msg');
    if (!el || !el.dataset.id) return;
    e.preventDefault();
    e.stopPropagation();
    if (selected.has(el.dataset.id)) selected.delete(el.dataset.id); else selected.add(el.dataset.id);
    paintSel();
  }, true);
  const onSelKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); handle.endSelect(); } };

  // закреплённое сообщение
  let pinned: ChatPinnedMessage | null = null;
  const paintPin = () => {
    pinBar.hidden = !pinned;
    pinBar.replaceChildren();
    if (!pinned) return;
    const p = pinned;
    const raw = (p.text ?? '').trim();
    const txt = (options.formatting ? toPlain(raw) : raw).replace(/\s+/g, ' ');
    const body = h('button', { type: 'button', class: 'b24-chat-pinbar__body', title: t('Перейти к сообщению') },
      html(icon('pin', { size: 16 })),
      h('span', { class: 'b24-chat-pinbar__text' }, h('span', { class: 'b24-chat-pinbar__title' }, p.author ? `${t('Закреплённое сообщение')} · ${p.author}` : t('Закреплённое сообщение')), h('span', { class: 'b24-chat-pinbar__msg' }, txt)));
    body.addEventListener('click', () => {
      if (handle.scrollTo(p.id)) return;
      if (options.onPinnedClick) options.onPinnedClick(p.id);
      else if (options.onReplyClick) options.onReplyClick(p.id, messages.find((x) => x.id === p.id) ?? ({ id: p.id, dir: 'in', time: new Date() } as ChatMessage));
      else if (options.onLoadAround) void handle.jumpTo(p.id);
    });
    pinBar.append(body);
    if ((p.canUnpin ?? options.canUnpin) && options.onUnpin) {
      const x = h('button', { type: 'button', class: 'b24-chat-pinbar__x', 'aria-label': t('Открепить'), title: t('Открепить') }, html(icon('close', { size: 14 })));
      x.addEventListener('click', () => options.onUnpin!());
      pinBar.append(x);
    }
  };

  /** Перерисовка с якорем прокрутки: пришло сверху — остаёмся на месте, снизу — вниз, если были у низа. */
  const apply = (next: ChatMessage[]) => {
    const oldFirst = messages[0]?.id;
    const oldLast = messages[messages.length - 1]?.id;
    const wasEmpty = !messages.length;
    const atBottom = nearBottom();
    const fromBottom = root.scrollHeight - root.scrollTop;
    const prevTop = root.scrollTop;
    messages = next;
    render();
    const prepended = !wasEmpty && next.length && next[0].id !== oldFirst && next.some((m) => m.id === oldFirst);
    const appended = !wasEmpty && next.length && next[next.length - 1].id !== oldLast;
    const replaced = !wasEmpty && !next.some((m) => m.id === oldFirst || m.id === oldLast);
    if (wasEmpty || replaced) handle.scrollToBottom();
    else if (prepended && !appended) { root.scrollTop = root.scrollHeight - fromBottom; stick = false; }
    else if (appended && (atBottom || (next[next.length - 1].dir === 'out' || (next[next.length - 1].dir === 'note' && next[next.length - 1].mine !== false)))) handle.scrollToBottom(true);
    else root.scrollTop = prevTop;
  };

  const loadMore = async () => {
    if (loading || !hasMore || !options.onLoadMore) return;
    loading = true;
    more.disabled = true;
    more.classList.add('b24-btn--loading');
    try { await options.onLoadMore(); } finally {
      loading = false;
      more.disabled = false;
      more.classList.remove('b24-btn--loading');
    }
  };
  more.addEventListener('click', () => void loadMore());
  const loadNewer = async () => {
    if (loadingNewer || !hasNewer || !options.onLoadNewer) return;
    loadingNewer = true;
    newer.disabled = true;
    newer.classList.add('b24-btn--loading');
    try { await options.onLoadNewer(); } finally {
      loadingNewer = false;
      newer.disabled = false;
      newer.classList.remove('b24-btn--loading');
    }
  };
  newer.addEventListener('click', () => void loadNewer());
  // у верха ленты — подгружаем сами
  root.addEventListener('scroll', () => {
    // у низа — прилипаем; ушёл вверх сам (не наша прокрутка) — отлипаем
    if (nearBottom()) stick = true;
    else if (!programmatic) stick = false;
    if (root.scrollTop < 40 && hasMore && options.onLoadMore) void loadMore();
    if (hasNewer && !programmatic && nearBottom()) void loadNewer();
  }, { passive: true });
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (stick && !hasNewer) handle.scrollToBottom(); }) : null;
  let flashTimer = 0;
  const findEl = (id: string) => Array.from(list.children).find((c) => (c as HTMLElement).dataset.id === id) as HTMLElement | undefined;
  const around = (r: ChatAroundResult): { messages: ChatMessage[]; hasMore?: boolean; hasNewer?: boolean } => {
    if (Array.isArray(r)) return { messages: r };
    if ('message' in r) return { messages: [...(r.before ?? []), r.message, ...(r.after ?? [])], hasMore: r.hasMore, hasNewer: r.hasNewer };
    return r;
  };
  ro?.observe(list);

  render();
  requestAnimationFrame(() => handle.scrollToBottom());

  // «Цитировать» / «Копировать» рядом с выделенным текстом (только при onQuote)
  let quotePop: HTMLElement | null = null;
  let quoteInfo: { msg: ChatMessage; text: string } | null = null;
  const hideQuote = () => { quotePop?.remove(); quotePop = null; quoteInfo = null; };
  const showQuote = () => {
    if (!options.onQuote) return;
    const s = getSelection();
    const a = s && !s.isCollapsed && s.rangeCount ? textElOf(s.anchorNode) : null;
    const text = a && s && a === textElOf(s.focusNode) && root.contains(a) ? s.toString().trim() : '';
    const msg = text ? messages.find((x) => x.id === a!.closest<HTMLElement>('.b24-chat-msg')?.dataset.id) : undefined;
    if (!s || !msg) { hideQuote(); return; }
    quoteInfo = { msg, text };
    if (!quotePop) {
      const q = h('button', { type: 'button', class: 'b24-chat-quote-pop__btn', 'data-act': 'quote' }, html(icon('quote', { size: 14 })), t('Цитировать'));
      const c = h('button', { type: 'button', class: 'b24-chat-quote-pop__btn', 'data-act': 'copy' }, html(icon('copy', { size: 14 })), t('Копировать'));
      quotePop = h('div', { class: 'b24-root b24-chat-quote-pop', role: 'toolbar', 'aria-label': t('Выделенный текст') }, q, c);
      // клик не должен снимать выделение
      quotePop.addEventListener('mousedown', (e) => e.preventDefault());
      quotePop.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') e.preventDefault(); });
      quotePop.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
        const info = quoteInfo;
        if (!btn || !info) return;
        if (btn.dataset.act === 'quote') options.onQuote!(info.msg, info.text); else void copyText(info.text);
        getSelection()?.removeAllRanges();
        hideQuote();
      });
      document.body.append(quotePop);
      bringToFront(quotePop);
    }
    const rects = s.getRangeAt(0).getClientRects();
    const r = rects.length ? rects[rects.length - 1] : s.getRangeAt(0).getBoundingClientRect();
    const pw = quotePop.offsetWidth, ph = quotePop.offsetHeight;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const vw = document.documentElement.clientWidth;
    const top = coarse || r.top - ph - 8 < 8 ? r.bottom + (coarse ? 44 : 8) : r.top - ph - 8;
    quotePop.style.left = `${Math.round(Math.max(8, Math.min(r.left + r.width / 2 - pw / 2, vw - pw - 8)))}px`;
    quotePop.style.top = `${Math.round(Math.max(8, top))}px`;
  };
  let selTimer = 0;
  const onSelectionChange = () => { if (!options.onQuote) return; clearTimeout(selTimer); selTimer = window.setTimeout(showQuote, 140); };
  if (options.onQuote) {
    document.addEventListener('selectionchange', onSelectionChange);
    root.addEventListener('scroll', hideQuote, { passive: true });
  }

  const handle: ChatFeedHandle = {
    element: root,
    setMessages: apply,
    append: (list2) => apply([...messages, ...list2]),
    prepend: (list2) => apply([...list2, ...messages]),
    update(id, patch) {
      const atBottom = nearBottom();
      const top = root.scrollTop;
      messages = messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
      render();
      if (atBottom) handle.scrollToBottom(); else root.scrollTop = top;
    },
    setHasMore(v) { hasMore = v; more.hidden = !v; },
    setTyping(text) {
      const at = nearBottom();
      const top = root.scrollTop;
      if (text) typing.replaceChildren(h('span', { class: 'b24-chat-typing__dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('span', {}, text));
      else typing.replaceChildren();
      typing.hidden = !text;
      if (at) handle.scrollToBottom(); else root.scrollTop = top;
    },
    scrollTo(id, opts = {}) {
      const el = findEl(id);
      if (!el) return false;
      stick = false;
      programmatic = true;
      const rr = root.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const top = Math.max(0, root.scrollTop + (er.top - rr.top) - (root.clientHeight - er.height) / 2);
      root.scrollTo({ top, behavior: opts.smooth ? 'smooth' : 'auto' });
      const done = () => requestAnimationFrame(() => requestAnimationFrame(() => { programmatic = false; }));
      if (opts.smooth) setTimeout(done, 500); else done();
      if (opts.highlight !== false) {
        list.querySelectorAll('.is-flash').forEach((x) => x.classList.remove('is-flash'));
        void el.offsetWidth;
        el.classList.add('is-flash');
        clearTimeout(flashTimer);
        flashTimer = window.setTimeout(() => el.classList.remove('is-flash'), 2000);
      }
      return true;
    },
    async jumpTo(id, loader, opts) {
      if (handle.scrollTo(id, opts)) return true;
      const load = loader ?? options.onLoadAround;
      if (!load) return false;
      const r = around(await load(id));
      if (!r.messages.some((m) => m.id === id)) return false;
      messages = r.messages;
      if (r.hasMore !== undefined) handle.setHasMore(r.hasMore);
      if (r.hasNewer !== undefined) handle.setHasNewer(r.hasNewer);
      render();
      return handle.scrollTo(id, opts);
    },
    setBackground(bg) { paintBg(bg); },
    setHasNewer(v) { hasNewer = v; newer.hidden = !v; if (!v) stick = nearBottom(); },
    startSelect(firstId) {
      if (selecting) return;
      selecting = true;
      selected.clear();
      if (firstId) selected.add(firstId);
      hideTools();
      hideQuote();
      getSelection()?.removeAllRanges();
      root.classList.add('is-selecting');
      selBar.hidden = false;
      document.addEventListener('keydown', onSelKey);
      paintSel();
    },
    endSelect() {
      if (!selecting) return;
      selecting = false;
      selected.clear();
      root.classList.remove('is-selecting');
      selBar.hidden = true;
      document.removeEventListener('keydown', onSelKey);
      paintSel();
      options.onSelectChange?.([]);
    },
    getSelected: selectedMsgs,
    isSelecting: () => selecting,
    setPinned(p) { pinned = p ? { ...p } : null; paintPin(); },
    scrollToBottom(smooth = false) {
      stick = true;
      programmatic = true;
      root.scrollTo({ top: root.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      // событие scroll приходит в следующем кадре — снимаем флаг после него
      const done = () => requestAnimationFrame(() => requestAnimationFrame(() => { programmatic = false; }));
      if (smooth) setTimeout(done, 400); else done();
    },
    isAtBottom: nearBottom,
    destroy() { ro?.disconnect(); bgRo?.disconnect(); menuHandle?.destroy(); document.removeEventListener('keydown', onSelKey); document.removeEventListener('selectionchange', onSelectionChange); clearTimeout(selTimer); hideQuote(); root.remove(); },
  };
  return handle;
}

/* ── Поле ответа ─────────────────────────────────────────── */

/** Вложение в поле ответа: чип с именем, размером и прогрессом загрузки. */
export interface ComposerAttachment {
  id: string;
  name: string;
  size?: number;
  /** превью картинки */
  thumb?: string;
  /** загрузка 0–1; пока меньше 1 — отправка заблокирована; без поля — загружено */
  progress?: number;
  /** загрузка не удалась: текст ошибки, вложение в отправку не попадает */
  error?: string;
  data?: unknown;
}
/** Режим ответа: «Ответ клиенту» / «Скрытое сообщение» — переключатель над полем. */
export interface ChatComposerMode {
  id: string;
  label: string;
  /** note — жёлтое поле, как у заметок в ленте */
  tone?: 'note';
  /** подсказка в поле в этом режиме */
  placeholder?: string;
  disabled?: boolean;
  /** почему недоступен — в подсказке кнопки («Клиент ещё не написал») */
  disabledReason?: string;
}
export interface ChatSendContext {
  /** загруженные вложения (без ошибочных); после успешной отправки они убираются */
  attachments: ComposerAttachment[];
  /** id выбранного режима, если заданы modes; 'edit' — правка сообщения (startEdit), тогда есть editId */
  mode?: string;
  /** id правимого сообщения (mode: 'edit') */
  editId?: string;
  /** id сообщения, на которое отвечают (setReply); после отправки панель ответа сбрасывается */
  replyTo?: string;
  /** то же целиком: автор, текст, quote */
  reply?: ChatReplyDraft;
  /** id упомянутых (опция mentions): в text они уже заменены маркерами @[Имя Фамилия](user:ID) */
  mentions?: string[];
}
export interface ChatMentionCandidate { id: string; name: string; avatar?: string; caption?: string }
export interface ChatMentionsOptions {
  /** кандидаты по набранному после «@» запросу (пустая строка — сразу после «@») */
  load: (query: string) => Promise<ChatMentionCandidate[]>;
  /** символ вызова списка (по умолчанию «@») */
  trigger?: string;
}
/** Ответ в поле ввода: «↩ Ответ: Автор — текст…» над полем. quote: true — цитата выделенного фрагмента. */
export interface ChatReplyDraft { id: string; author?: string; text?: string; quote?: boolean }
export interface ChatComposerOptions {
  placeholder?: string;
  /** отправка: false или исключение — текст остаётся в поле. Можно отправить только файлы без текста (ctx.attachments) */
  onSend: (text: string, ctx: ChatSendContext) => void | boolean | Promise<void | boolean>;
  /** переключатель режима ответа над полем */
  modes?: ChatComposerMode[];
  mode?: string;
  onModeChange?: (mode: string) => void;
  /** крестик на чипе вложения (по умолчанию чип просто убирается) */
  onRemoveAttachment?: (attachment: ComposerAttachment) => void;
  /** куда можно бросать файлы: элемент (например .b24-chat__main — вся переписка) или функция; по умолчанию — само поле ответа */
  dropTarget?: HTMLElement | (() => HTMLElement | null);
  /** проверка файлов из скрепки, перетаскивания и вставки: размер в байтах, общее число вложений (с уже добавленными) */
  maxSize?: number;
  maxFiles?: number;
  /** файл отклонён проверкой; по умолчанию — тост. reason: 'size' | 'count' | 'type' */
  onReject?: (file: File, reason: 'size' | 'count' | 'type') => void;
  /** после успешной отправки убирать и чипы с ошибкой (по умолчанию они остаются) */
  clearFailedOnSend?: boolean;
  /** файлы из скрепки, перетаскивания на поле и вставки из буфера (Ctrl+V с картинкой): показывайте их через addAttachment и грузите сами */
  onAttach?: (files: File[]) => void;
  /** допустимые типы: «.pdf,image/*» — для скрепки, перетаскивания и вставки */
  accept?: string;
  /** быстрые ответы над полем: клик вставляет текст */
  quickReplies?: string[];
  /** отправка по Enter (по умолчанию да; Shift+Enter — новая строка). false — по Ctrl/⌘+Enter */
  enterToSend?: boolean;
  disabled?: boolean;
  /** причина, почему ответить нельзя («Диалог закрыт») — вместо поля */
  disabledText?: string;
  maxLength?: number;
  /** пользователь печатает: вызывается при вводе не чаще раза в 3 с — шлите «печатает» в канал */
  onTyping?: () => void;
  /** голосовые сообщения: кнопка микрофона на месте «Отправить», пока поле пустое и нет вложений; запись (MediaRecorder: audio/webm;codecs=opus, в Safari audio/mp4) → «Стоп» → прослушивание → «Отправить» / «Удалить» */
  voice?: boolean;
  /** отправка записи: blob, длительность в секундах, mime (например «audio/webm;codecs=opus»); false или исключение — запись остаётся для повторной отправки */
  onVoice?: (blob: Blob, durationSec: number, mime: string) => void | boolean | Promise<void | boolean>;
  /** максимальная длина записи, с (по умолчанию 300): по достижении запись останавливается и открывается предпрослушивание */
  maxVoiceSec?: number;
  /** @упоминания: при вводе «@» и букв над полем всплывает список (стрелки, Enter / Tab, Esc); вставляется «@Имя Фамилия », при отправке — маркер @[Имя Фамилия](user:ID) и ctx.mentions */
  mentions?: ChatMentionsOptions;
  /** черновик: текст поля сохраняется через общее хранилище кита (B24UI.setStorage / localStorage) под ключом «b24-draft:» + draftKey с задержкой ~400 мс и восстанавливается при создании; после отправки ключ очищается */
  draftKey?: string;
  /** черновик сохранён / очищен (text — пустая строка): показать «Черновик: …» в списке диалогов (ChatListItem.draft) */
  onDraftChange?: (text: string) => void;
  /** форматирование: Ctrl/⌘+B (**), +I (__), +Shift+X (~~), +E (`) оборачивают выделение маркерами (повторно — снимают); правый клик по выделению в поле — меню «Жирный / Курсив / Зачёркнутый / Код / Цитата» и «Вырезать / Копировать / Вставить»; кнопка «Aa» с панелью (formattingButton). Значение поля — с маркерами: для отправки используйте chatMarkup.toHtml / toPlain */
  formatting?: boolean;
  /** кнопка «Aa» с панелью форматирования рядом со скрепкой (по умолчанию да при formatting; false — только горячие клавиши и меню) */
  formattingButton?: boolean;
  /** ответ отменён пользователем (✕ или Esc в пустом поле); setReply(null) и отправка его не вызывают */
  onReplyCancel?: () => void;
  /** кнопка выбора эмодзи рядом со скрепкой: панель с «Частыми», разделами и поиском; вставка в позицию курсора */
  emoji?: boolean;
}
export interface ChatComposerHandle {
  element: HTMLElement;
  /** контейнеры: превью вложений над полем и свои кнопки рядом со скрепкой */
  slots: { attachments: HTMLElement; actions: HTMLElement; quick: HTMLElement };
  focus(): void;
  getValue(): string;
  setValue(text: string): void;
  /** правка своего сообщения: плашка «Редактирование» над полем, текст в поле, курсор в конце; onSend получит mode: 'edit' и editId, вложения выключены */
  startEdit(message: { id: string; text: string }): void;
  /** выйти из правки (Esc или ✕): поле очищается (с draftKey — возвращается набранный до правки текст) */
  cancelEdit(): void;
  /** сохранённый черновик (после сброса отложенного сохранения); '' — нет */
  getDraft(): string;
  /** удалить сохранённый черновик (поле не трогает) */
  clearDraft(): void;
  /** голосовое: начать запись (как нажатие на микрофон) / отменить запись или предпрослушивание / идёт ли запись */
  startVoice(): void;
  cancelVoice(): void;
  isRecording(): boolean;
  /** панель «Ответ: Автор — текст…» над полем (с ✕), фокус в поле; null — убрать. onSend получит ctx.replyTo / ctx.reply */
  setReply(reply: ChatReplyDraft | null): void;
  getReply(): ChatReplyDraft | null;
  /** пользователь отменил ответ (то же, что ✕): панель убирается, вызывается onReplyCancel */
  cancelReply(): void;
  /** обернуть выделение маркерами разметки (как горячие клавиши) */
  format(kind: 'bold' | 'italic' | 'strike' | 'code' | 'quote'): void;
  /** id правимого сообщения или null */
  getEditing(): string | null;
  insert(text: string): void;
  /** чип вложения под полем; обновляйте прогресс через updateAttachment */
  addAttachment(a: ComposerAttachment): void;
  updateAttachment(id: string, patch: Partial<ComposerAttachment>): void;
  removeAttachment(id: string): void;
  getAttachments(): ComposerAttachment[];
  clearAttachments(): void;
  setMode(id: string): void;
  getMode(): string | undefined;
  /** сделать режим недоступным / доступным; reason — подсказка на кнопке */
  setModeDisabled(id: string, disabled: boolean, reason?: string): void;
  setDisabled(disabled: boolean, text?: string): void;
  setQuickReplies(list: string[]): void;
  destroy(): void;
}

export function createChatComposer(host: HTMLElement, options: ChatComposerOptions): ChatComposerHandle {
  const enter = options.enterToSend !== false;
  const root = h('div', { class: 'b24-chat-composer' });
  const quick = h('div', { class: 'b24-chat-composer__quick', role: 'list', 'aria-label': t('Быстрые ответы') });
  const atts = h('div', { class: 'b24-chat-composer__attachments' });
  const input = h('textarea', { class: 'b24-chat-composer__input', rows: '1', placeholder: options.placeholder ?? t('Написать сообщение…'), title: enter ? t('Enter — отправить, Shift+Enter — новая строка') : t('Ctrl+Enter — отправить'), 'aria-label': t('Сообщение') });
  if (options.maxLength) input.maxLength = options.maxLength;
  const actions = h('div', { class: 'b24-chat-composer__actions' });
  const send = h('button', { type: 'button', class: 'b24-btn b24-btn--primary b24-btn--icon b24-chat-composer__send', 'aria-label': t('Отправить'), title: t('Отправить') }, html(icon('send')));
  const blocked = h('div', { class: 'b24-chat-composer__blocked', hidden: '' });
  const typeOk = (f: File) => {
    const rules = (options.accept ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!rules.length) return true;
    const name = f.name.toLowerCase();
    const type = f.type.toLowerCase();
    return rules.some((r) => (r.startsWith('.') ? name.endsWith(r) : r.endsWith('/*') ? type.startsWith(r.slice(0, -1)) : type === r));
  };
  /** проверка размера, числа и типа; годные файлы — в onAttach, остальные — в onReject (по умолчанию тост) */
  const accept = (list: File[]) => {
    let room = options.maxFiles != null ? options.maxFiles - files.size : Infinity;
    const okList: File[] = [];
    for (const f of list) {
      const reason = !typeOk(f) ? 'type' : options.maxSize != null && f.size > options.maxSize ? 'size' : room <= 0 ? 'count' : null;
      if (!reason) { okList.push(f); room -= 1; continue; }
      if (options.onReject) options.onReject(f, reason);
      else toast(reason === 'size' ? t('Файл «{name}» больше {size}', { name: f.name, size: fmtSize(options.maxSize) }) : reason === 'count' ? t('Можно прикрепить не больше {n} файлов', { n: options.maxFiles ?? 0 }) : t('Файл «{name}» этого типа прикрепить нельзя', { name: f.name }), { type: 'warning' });
    }
    if (okList.length) options.onAttach!(okList);
  };
  if (options.onAttach) {
    const file = h('input', { type: 'file', multiple: true, hidden: '', accept: options.accept });
    const clip = h('button', { type: 'button', class: 'b24-btn b24-btn--plain b24-btn--icon b24-chat-composer__attach', 'aria-label': t('Прикрепить файл'), title: t('Прикрепить файл') }, html(icon('paperclip')));
    clip.addEventListener('click', () => file.click());
    file.addEventListener('change', () => { if (file.files?.length) accept(Array.from(file.files)); file.value = ''; });
    actions.append(clip, file);
  }
  const modesEl = h('div', { class: 'b24-chat-composer__modes', role: 'radiogroup', 'aria-label': t('Режим ответа') });
  const row = h('div', { class: 'b24-chat-composer__row' }, actions, input, send);
  const editBar = h('div', { class: 'b24-chat-composer__editing', hidden: '' });
  root.append(quick, modesEl, editBar, atts, row, blocked);
  host.append(root);
  const unResize = autoResize(input);

  /* вложения */
  const files = new Map<string, { a: ComposerAttachment; el: HTMLElement }>();
  let editId: string | null = null;
  const sending = new Set<string>();
  const uploading = (a: ComposerAttachment) => !a.error && a.progress != null && a.progress < 1;
  const ready = () => Array.from(files.values()).map((x) => x.a).filter((a) => !a.error && !uploading(a));
  let micShown = false;
  const sync = () => {
    const can = editId != null ? !!input.value.trim() : !!input.value.trim() || ready().length > 0;
    const wait = Array.from(files.values()).some((x) => uploading(x.a));
    const mic = !!options.voice && !!options.onVoice && !can && editId == null && !vs;
    if (mic !== micShown) {
      micShown = mic;
      send.classList.toggle('is-mic', mic);
      send.replaceChildren(html(icon(mic ? 'mic' : 'send')));
      send.setAttribute('aria-label', mic ? t('Записать голосовое сообщение') : t('Отправить'));
      send.title = mic ? t('Записать голосовое сообщение') : t('Отправить');
    }
    send.disabled = mic ? root.classList.contains('is-busy') || root.classList.contains('is-disabled') : !can || wait || root.classList.contains('is-busy') || root.classList.contains('is-disabled');
  };
  const fit = () => input.dispatchEvent(new Event('input'));
  const paintChip = (rec: { a: ComposerAttachment; el: HTMLElement }) => {
    const a = rec.a;
    const pct = a.progress != null ? Math.round(Math.max(0, Math.min(1, a.progress)) * 100) : 100;
    rec.el.className = `b24-chat-attchip${a.error ? ' is-error' : ''}${uploading(a) ? ' is-uploading' : ''}${sending.has(a.id) ? ' is-sending' : ''}`;
    const thumb = a.thumb ? h('img', { class: 'b24-chat-attchip__thumb', src: a.thumb, alt: '' }) : h('span', { class: 'b24-chat-attchip__icon' }, html(icon('file', { size: 18 })));
    const info = a.error ? a.error : uploading(a) ? `${pct}%` : fmtSize(a.size);
    const rm = h('button', { type: 'button', class: 'b24-chat-attchip__remove', 'aria-label': `${t('Убрать')} ${a.name}`, title: t('Убрать') }, html(icon('close', { size: 14 })));
    rm.addEventListener('click', () => { handle.removeAttachment(a.id); options.onRemoveAttachment?.(a); input.focus(); });
    const bar = uploading(a) ? h('span', { class: 'b24-chat-attchip__bar', role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { style: `width:${pct}%` })) : '';
    rec.el.replaceChildren(thumb, h('span', { class: 'b24-chat-attchip__body' }, h('span', { class: 'b24-chat-attchip__name' }, a.name), info ? h('span', { class: 'b24-chat-attchip__meta' }, info) : ''), rm, bar);
  };

  /* режимы ответа */
  const modeList = options.modes ?? [];
  let mode: string | undefined = options.mode ?? modeList.find((m) => !m.disabled)?.id;
  const paintModes = () => {
    modesEl.hidden = modeList.length < 2;
    const cur = modeList.find((m) => m.id === mode);
    root.classList.toggle('is-mode-note', cur?.tone === 'note');
    input.placeholder = cur?.placeholder ?? options.placeholder ?? t('Написать сообщение…');
    modesEl.replaceChildren(...modeList.map((m) => {
      const b = h('button', {
        type: 'button', role: 'radio', class: `b24-chat-composer__mode${m.tone === 'note' ? ' is-note' : ''}${m.id === mode ? ' is-active' : ''}`,
        'aria-checked': String(m.id === mode), 'data-mode': m.id, title: m.disabled ? m.disabledReason : undefined,
      }, m.tone === 'note' ? html(icon('lock', { size: 13 })) : '', m.label);
      b.disabled = !!m.disabled;
      b.addEventListener('click', () => handle.setMode(m.id));
      return b;
    }));
  };

  /* форматирование: Ctrl/⌘ + B, I, Shift+X, E и кнопка «Aa» с панелью */
  const fmtMarks = { bold: MARKERS.bold, italic: MARKERS.italic, strike: MARKERS.strike, code: MARKERS.code } as const;
  const wrapSel = (mark: string) => {
    const v = input.value;
    const s = input.selectionStart, e = input.selectionEnd, L = mark.length;
    const sel = v.slice(s, e);
    let from = s, to = e, rep: string, a: number, b: number;
    if (sel.length >= 2 * L && sel.startsWith(mark) && sel.endsWith(mark)) { rep = sel.slice(L, -L); a = s; b = s + rep.length; }
    else if (v.slice(s - L, s) === mark && v.slice(e, e + L) === mark) { from = s - L; to = e + L; rep = sel; a = from; b = from + sel.length; }
    else if (!sel) { rep = mark + mark; a = b = s + L; }
    else { rep = mark + sel + mark; a = s + L; b = s + L + sel.length; }
    input.focus();
    input.setSelectionRange(from, to);
    if (!document.execCommand('insertText', false, rep)) input.setRangeText(rep, from, to, 'end');
    input.setSelectionRange(a, b);
    fit();
  };
  let quoteFn = () => {};
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = mac ? '⌘' : 'Ctrl+';
  if (options.formatting) {
    const defs: Array<[keyof typeof fmtMarks, string, string, string]> = [
      ['bold', 'Жирный', `${mod}B`, '<b>B</b>'], ['italic', 'Курсив', `${mod}I`, '<i>I</i>'],
      ['strike', 'Зачёркнутый', `${mod}${mac ? '⇧' : 'Shift+'}X`, '<s>S</s>'], ['code', 'Код', `${mod}E`, '<code>&lt;/&gt;</code>'],
    ];
    const bar = h('div', { class: 'b24-chat-composer__fmt', role: 'toolbar', 'aria-label': t('Форматирование'), hidden: '' });
    if (options.formattingButton !== false) for (const [kind, label, key, glyph] of defs) {
      const b = h('button', { type: 'button', class: 'b24-chat-composer__fmt-btn', 'data-fmt': kind, 'aria-label': `${t(label)} (${key})`, title: `${t(label)} (${key})` }, html(glyph));
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => wrapSel(fmtMarks[kind]));
      bar.append(b);
    }
    if (options.formattingButton !== false) {
      const aa = h('button', { type: 'button', class: 'b24-btn b24-btn--plain b24-btn--icon b24-chat-composer__aa', 'aria-label': t('Форматирование'), title: t('Форматирование'), 'aria-pressed': 'false' }, 'Aa');
      aa.addEventListener('click', () => { bar.hidden = !bar.hidden; aa.setAttribute('aria-pressed', String(!bar.hidden)); input.focus(); });
      actions.append(aa);
      row.before(bar);
    }
    // правый клик по выделению в поле: форматирование и системные «Вырезать / Копировать / Вставить»; без выделения — меню браузера
    const insertAt = (rep: string, from: number, to: number, a: number, b: number) => {
      input.focus();
      input.setSelectionRange(from, to);
      if (!document.execCommand('insertText', false, rep)) input.setRangeText(rep, from, to, 'end');
      input.setSelectionRange(a, b);
      fit();
    };
    const quoteLines = () => {
      const v = input.value;
      const ls = v.lastIndexOf('\n', input.selectionStart - 1) + 1;
      let le = v.indexOf('\n', input.selectionEnd);
      if (le < 0) le = v.length;
      const lines = v.slice(ls, le).split('\n');
      const all = lines.every((l) => l.startsWith('> '));
      const rep = lines.map((l) => (all ? l.slice(2) : `> ${l}`)).join('\n');
      insertAt(rep, ls, le, ls, ls + rep.length);
    };
    quoteFn = quoteLines;
    const execClip = (cmd: 'cut' | 'copy') => { input.focus(); document.execCommand(cmd); };
    contextMenu(input, () => {
      if (input.selectionStart === input.selectionEnd) return null;
      const sc = (k: string) => `${mod}${k}`;
      return [
        { label: t('Жирный'), hint: sc('B'), onClick: () => wrapSel(fmtMarks.bold) },
        { label: t('Курсив'), hint: sc('I'), onClick: () => wrapSel(fmtMarks.italic) },
        { label: t('Зачёркнутый'), hint: sc(`${mac ? '⇧' : 'Shift+'}X`), onClick: () => wrapSel(fmtMarks.strike) },
        { label: t('Код'), hint: sc('E'), onClick: () => wrapSel(fmtMarks.code) },
        { label: t('Цитата'), onClick: quoteLines },
        { separator: true },
        { label: t('Вырезать'), hint: sc('X'), onClick: () => execClip('cut') },
        { label: t('Копировать'), hint: sc('C'), onClick: () => execClip('copy') },
        { label: t('Вставить'), hint: sc('V'), onClick: () => { void navigator.clipboard?.readText().then((txt) => { input.focus(); if (!document.execCommand('insertText', false, txt)) input.setRangeText(txt, input.selectionStart, input.selectionEnd, 'end'); fit(); }).catch(() => {}); } },
      ];
    }, { keepNativeOnInputs: false, longPress: 0 });
    input.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const kind = e.code === 'KeyB' && !e.shiftKey ? 'bold' : e.code === 'KeyI' && !e.shiftKey ? 'italic' : e.code === 'KeyX' && e.shiftKey ? 'strike' : e.code === 'KeyE' && !e.shiftKey ? 'code' : null;
      if (!kind) return;
      e.preventDefault();
      wrapSel(fmtMarks[kind]);
    });
  }

  /* панель ответа над полем */
  let reply: ChatReplyDraft | null = null;
  const replyBar = h('div', { class: 'b24-chat-composer__reply-bar', hidden: '' });
  editBar.after(replyBar);
  const setReplyInner = (r: ChatReplyDraft | null) => {
    reply = r ? { ...r } : null;
    replyBar.hidden = !r;
    root.classList.toggle('is-replying', !!r);
    if (!r) { replyBar.replaceChildren(); return; }
    const cut = (r.text ?? '').replace(/\s+/g, ' ').trim();
    const x = h('button', { type: 'button', class: 'b24-chat-composer__reply-x', 'aria-label': t('Отменить ответ'), title: t('Отменить ответ') }, html(icon('close', { size: 14 })));
    x.addEventListener('click', () => { handle.cancelReply(); });
    replyBar.replaceChildren(
      html(icon(r.quote ? 'quote' : 'reply', { size: 16 })),
      h('span', { class: 'b24-chat-composer__reply-body' }, h('span', { class: 'b24-chat-composer__reply-title' }, r.author ? t(r.quote ? 'Цитата {author}' : 'Ответ для {author}', { author: r.author }) : r.quote ? t('Цитата') : t('Ответ')), h('span', { class: 'b24-chat-composer__reply-text' }, cut.length > 140 ? `${cut.slice(0, 140)}…` : cut)),
      x,
    );
  };

  /* упоминания: в поле — «@Имя Фамилия», при отправке — маркер @[Имя Фамилия](user:ID) */
  const mentionCfg = options.mentions;
  const trigger = mentionCfg?.trigger ?? '@';
  const mentioned: Array<{ id: string; name: string }> = [];
  const withMentions = (text: string): { text: string; ids: string[] } => {
    const ids: string[] = [];
    let out = text;
    for (const mm of mentioned) {
      const needle = trigger + mm.name;
      const i = out.indexOf(needle);
      const next = out[i + needle.length];
      if (i >= 0 && (next === undefined || /[\s.,;:!?)\]]/.test(next))) { out = out.slice(0, i) + mentionMarker(mm.name, mm.id) + out.slice(i + needle.length); if (!ids.includes(mm.id)) ids.push(mm.id); }
    }
    return { text: out, ids };
  };
  /* черновик */
  const dKey = options.draftKey ? `b24-draft:${options.draftKey}` : null;
  let dTimer = 0;
  let silent = false;
  let stash = '';
  const saveDraft = () => {
    clearTimeout(dTimer);
    dTimer = 0;
    if (!dKey || editId != null) return;
    const v = input.value;
    if (v.trim()) { storageSet(dKey, v); storageSet(`${dKey}:m`, mentioned.length ? JSON.stringify(mentioned) : null); }
    else { storageSet(dKey, null); storageSet(`${dKey}:m`, null); }
    options.onDraftChange?.(v.trim() ? v : '');
  };
  const dropDraft = () => {
    clearTimeout(dTimer);
    dTimer = 0;
    if (!dKey) return;
    if (storageGet(dKey) != null || mentioned.length) { storageSet(dKey, null); storageSet(`${dKey}:m`, null); options.onDraftChange?.(''); }
  };

  const submit = async () => {
    const text = input.value.trim();
    const atts = editId != null ? [] : ready();
    const mm = mentionCfg ? withMentions(text) : { text, ids: [] as string[] };
    if ((!text && !atts.length) || root.classList.contains('is-busy') || root.classList.contains('is-disabled')) return;
    if (editId == null && Array.from(files.values()).some((x) => uploading(x.a))) return;
    root.classList.add('is-busy');
    sync();
    const sendingIds = new Set(atts.map((a) => a.id));
    sendingIds.forEach((id) => { sending.add(id); const rec = files.get(id); if (rec) paintChip(rec); });
    let ok = false;
    try {
      const r = await options.onSend(mm.text, editId != null ? { attachments: [], mode: 'edit', editId, ...(mm.ids.length ? { mentions: mm.ids } : {}) } : { attachments: atts, mode, ...(reply ? { replyTo: reply.id, reply: { ...reply } } : {}), ...(mm.ids.length ? { mentions: mm.ids } : {}) });
      ok = r !== false;
      if (ok && editId != null) { handle.cancelEdit(); }
      else if (ok) {
        input.value = ''; fit();
        mentioned.length = 0;
        dropDraft();
        setReplyInner(null);
        atts.forEach((a) => handle.removeAttachment(a.id));
        if (options.clearFailedOnSend) Array.from(files.values()).filter((x) => x.a.error).forEach((x) => handle.removeAttachment(x.a.id));
      }
    } finally {
      // отправка не удалась: вложения снова доступны, «прогресс отправки», выставленный вашим кодом, снимаем
      if (!ok) sendingIds.forEach((id) => { const rec = files.get(id); if (rec && rec.a.progress != null && rec.a.progress < 1 && !rec.a.error) { rec.a = { ...rec.a, progress: undefined }; paintChip(rec); } });
      sendingIds.forEach((id) => { sending.delete(id); const rec = files.get(id); if (rec) paintChip(rec); });
      root.classList.remove('is-busy');
      sync();
      input.focus();
    }
  };

  let lastTyping = 0;
  input.addEventListener('input', () => {
    sync();
    if (silent || !options.onTyping || !input.value) return;
    const now = Date.now();
    if (now - lastTyping >= 3000) { lastTyping = now; try { options.onTyping(); } catch (err) { console.error('[airkit-for-b24] onTyping:', err); } }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editId != null) { e.preventDefault(); e.stopPropagation(); handle.cancelEdit(); return; }
    if (e.key === 'Escape' && reply && !input.value) { e.preventDefault(); e.stopPropagation(); handle.cancelReply(); return; }
    if (e.key !== 'Enter' || e.isComposing) return;
    const mod = e.ctrlKey || e.metaKey;
    if (enter ? !e.shiftKey && !mod : mod) { e.preventDefault(); void submit(); }
  });
  send.addEventListener('click', () => { if (send.classList.contains('is-mic')) void startVoice(); else void submit(); });

  /* голосовые сообщения: микрофон вместо «Отправить», запись → предпрослушивание → отправка */
  const voiceOn = !!options.voice && !!options.onVoice;
  const voiceBox = h('div', { class: 'b24-chat-composer__voice', hidden: '', role: 'group', 'aria-label': t('Голосовое сообщение') });
  row.after(voiceBox);
  type VoiceState = { stream: MediaStream; rec: MediaRecorder; chunks: Blob[]; t0: number; timer: number; meter: ReturnType<typeof createMicMeter> | null; url: string | null; blob: Blob | null; dur: number; cancelled: boolean; mime: string };
  let vs: VoiceState | null = null;
  const pickMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) ?? '';
  const voiceCleanup = () => {
    const v = vs;
    vs = null;
    if (v) {
      clearInterval(v.timer);
      v.meter?.destroy();
      v.stream.getTracks().forEach((tr) => tr.stop());
      if (v.url) URL.revokeObjectURL(v.url);
    }
    voiceBox.hidden = true;
    voiceBox.replaceChildren();
    root.classList.remove('is-voice');
    sync();
  };
  const voiceBtn = (cls: string, ic: IconName, label: string, fn: () => void) => {
    const b = h('button', { type: 'button', class: `b24-chat-composer__voice-btn ${cls}`, 'aria-label': label, title: label }, html(icon(ic, { size: 18 })));
    b.addEventListener('click', fn);
    return b;
  };
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const showPreview = () => {
    const v = vs;
    if (!v || !v.blob) return;
    v.url = URL.createObjectURL(v.blob);
    voiceBox.replaceChildren();
    const trash = voiceBtn('is-danger', 'trash', t('Удалить'), () => handle.cancelVoice());
    const player = h('div', { class: 'b24-chat-composer__voice-player' });
    createAudioPlayer(player, { src: v.url, duration: v.dur, compact: true, speeds: [1], preload: 'auto', label: t('Голосовое сообщение') });
    const sendBtn = h('button', { type: 'button', class: 'b24-btn b24-btn--primary b24-btn--icon b24-chat-composer__voice-send', 'aria-label': t('Отправить'), title: t('Отправить') }, html(icon('send')));
    sendBtn.addEventListener('click', async () => {
      if (!v.blob || sendBtn.disabled) return;
      sendBtn.disabled = true;
      trash.disabled = true;
      let ok = false;
      try { const r = await options.onVoice!(v.blob, Math.max(1, Math.round(v.dur)), v.blob.type || v.mime); ok = r !== false; } catch (err) { console.error('[airkit-for-b24] onVoice:', err); }
      if (ok) voiceCleanup(); else { sendBtn.disabled = false; trash.disabled = false; }
    });
    voiceBox.append(trash, player, sendBtn);
    sendBtn.focus();
  };
  const showRecording = () => {
    const v = vs!;
    voiceBox.hidden = false;
    root.classList.add('is-voice');
    voiceBox.replaceChildren();
    const timerEl = h('span', { class: 'b24-chat-composer__voice-time', role: 'timer', 'aria-live': 'off' }, '0:00');
    const meterHost = h('div', { class: 'b24-chat-composer__voice-meter' });
    voiceBox.append(
      voiceBtn('is-danger', 'trash', t('Отменить запись'), () => handle.cancelVoice()),
      h('span', { class: 'b24-chat-composer__voice-dot', 'aria-hidden': 'true' }), timerEl, meterHost,
      voiceBtn('is-stop', 'stop', t('Остановить запись'), () => stopVoice()),
    );
    voiceBox.querySelector<HTMLElement>('.is-stop')?.focus();
    v.meter = createMicMeter(meterHost, { bars: 18, label: t('Уровень микрофона') });
    v.meter.connect(v.stream);
    const max = options.maxVoiceSec ?? 300;
    v.timer = window.setInterval(() => {
      const sec = (Date.now() - v.t0) / 1000;
      timerEl.textContent = mmss(sec);
      if (sec >= max) stopVoice();
    }, 200);
  };
  const stopVoice = () => {
    const v = vs;
    if (!v || v.rec.state === 'inactive') return;
    clearInterval(v.timer);
    v.dur = Math.min((Date.now() - v.t0) / 1000, options.maxVoiceSec ?? 300);
    v.rec.stop();
  };
  const startVoice = async () => {
    if (!voiceOn || vs || root.classList.contains('is-busy') || root.classList.contains('is-disabled')) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { toast(t('Запись голоса недоступна в этом браузере'), { type: 'warning' }); return; }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { toast(t('Нет доступа к микрофону'), { type: 'danger' }); return; }
    const mime = pickMime();
    let rec: MediaRecorder;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); } catch { stream.getTracks().forEach((tr) => tr.stop()); toast(t('Запись голоса недоступна в этом браузере'), { type: 'warning' }); return; }
    const v: VoiceState = { stream, rec, chunks: [], t0: Date.now(), timer: 0, meter: null, url: null, blob: null, dur: 0, cancelled: false, mime: rec.mimeType || mime };
    vs = v;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) v.chunks.push(e.data); };
    rec.onstop = () => {
      v.meter?.destroy();
      v.meter = null;
      v.stream.getTracks().forEach((tr) => tr.stop());
      if (v.cancelled || vs !== v) return;
      if (v.dur < 0.6 || !v.chunks.length) { voiceCleanup(); return; }   // случайное нажатие
      v.blob = new Blob(v.chunks, { type: rec.mimeType || v.mime || 'audio/webm' });
      showPreview();
    };
    rec.start(250);
    showRecording();
    sync();
  };
  // Esc отменяет запись и предпрослушивание, где бы ни был фокус (кнопка «Отправить» при записи скрыта)
  const onVoiceKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && vs && !e.defaultPrevented) { e.preventDefault(); handle.cancelVoice(); } };
  document.addEventListener('keydown', onVoiceKey);

  /* упоминания: список над полем */
  const mList = h('div', { class: 'b24-chat-mention-list', role: 'listbox', 'aria-label': t('Упомянуть'), hidden: '' });
  let mItems: Array<{ id: string; name: string; avatar?: string; caption?: string }> = [];
  let mActive = 0;
  let mToken: { start: number; end: number; query: string } | null = null;
  let mSeq = 0;
  let mTimer = 0;
  const mClose = () => { mSeq++; clearTimeout(mTimer); mToken = null; mItems = []; mList.hidden = true; mList.replaceChildren(); };
  const mPaint = () => {
    mList.replaceChildren(...mItems.map((it, i) => {
      const b = h('button', { type: 'button', role: 'option', class: `b24-chat-mention-list__item${i === mActive ? ' is-active' : ''}`, 'aria-selected': String(i === mActive), 'data-id': it.id },
        html(avatarHtml(it.name, it.avatar, 'xs')), h('span', { class: 'b24-chat-mention-list__name' }, it.name), it.caption ? h('span', { class: 'b24-chat-mention-list__caption' }, it.caption) : '');
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => mPick(i));
      return b;
    }));
    mList.hidden = !mItems.length;
    mList.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  };
  const mPick = (i: number) => {
    const it = mItems[i];
    const tok = mToken;
    if (!it || !tok) return;
    const ins = `${trigger}${it.name} `;
    input.focus();
    input.setSelectionRange(tok.start, tok.end);
    if (!document.execCommand('insertText', false, ins)) input.setRangeText(ins, tok.start, tok.end, 'end');
    if (!mentioned.some((x) => x.id === it.id && x.name === it.name)) mentioned.push({ id: it.id, name: it.name });
    mClose();
    fit();
  };
  const mUpdate = () => {
    if (!mentionCfg) return;
    const pos = input.selectionStart;
    if (input.selectionEnd !== pos) { mClose(); return; }
    const esc = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`(?:^|\\s)${esc}([^\\s]*(?: [^\\s]*)?)$`).exec(input.value.slice(0, pos));
    if (!m) { mClose(); return; }
    const query = m[1];
    mToken = { start: pos - query.length - trigger.length, end: pos, query };
    clearTimeout(mTimer);
    const my = ++mSeq;
    mTimer = window.setTimeout(async () => {
      let list: typeof mItems = [];
      try { list = await mentionCfg.load(query); } catch (err) { console.error('[airkit-for-b24] mentions.load:', err); }
      if (my !== mSeq || !mToken) return;
      mItems = list.slice(0, 8);
      mActive = 0;
      mPaint();
    }, 120);
  };
  if (mentionCfg) {
    root.append(mList);
    input.addEventListener('input', () => { if (!silent) mUpdate(); });
    input.addEventListener('click', mUpdate);
    input.addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') mUpdate(); });
    input.addEventListener('blur', () => { window.setTimeout(mClose, 150); });
    input.addEventListener('keydown', (e) => {
      if (mList.hidden || !mItems.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopImmediatePropagation(); mActive = (mActive + (e.key === 'ArrowDown' ? 1 : -1) + mItems.length) % mItems.length; mPaint(); }
      else if ((e.key === 'Enter' || e.key === 'Tab') && !e.isComposing) { e.preventDefault(); e.stopImmediatePropagation(); mPick(mActive); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); mClose(); }
    }, true);
  }
  // черновик: сохраняется через 400 мс после ввода; восстанавливается при создании
  if (dKey) {
    input.addEventListener('input', () => { if (silent || editId != null) return; clearTimeout(dTimer); dTimer = window.setTimeout(saveDraft, 400); });
    const d = storageGet(dKey);
    if (d) {
      silent = true;
      input.value = d;
      try { const ms = JSON.parse(storageGet(`${dKey}:m`) ?? '[]'); if (Array.isArray(ms)) for (const x of ms) if (x && typeof x.id === 'string' && typeof x.name === 'string') mentioned.push({ id: x.id, name: x.name }); } catch { /* повреждённые отметки — упоминания без id */ }
      fit();
      silent = false;
      options.onDraftChange?.(d);
    }
  }
  const dropCleanup: Array<() => void> = [];
  if (options.onAttach) {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const target = (typeof options.dropTarget === 'function' ? options.dropTarget() : options.dropTarget) ?? root;
    let depth = 0;
    const mark = (on: boolean) => { root.classList.toggle('is-dragover', on); if (target !== root) target.classList.toggle('b24-chat-dropzone-active', on); };
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      target.addEventListener(type, fn as EventListener);
      dropCleanup.push(() => target.removeEventListener(type, fn as EventListener));
    };
    on('dragenter', (e) => { if (hasFiles(e as DragEvent)) { depth += 1; mark(true); } });
    on('dragover', (e) => { if (hasFiles(e as DragEvent)) e.preventDefault(); });
    on('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) mark(false); });
    on('drop', (e) => {
      depth = 0;
      mark(false);
      if (!hasFiles(e as DragEvent) || root.classList.contains('is-disabled')) return;
      e.preventDefault();
      const list = Array.from((e as DragEvent).dataTransfer!.files);
      if (list.length) accept(list);
    });
    // вставка картинки или файла из буфера; обычный текст вставляется как всегда
    input.addEventListener('paste', (e) => {
      const list = Array.from(e.clipboardData?.files ?? []);
      if (!list.length || e.clipboardData?.getData('text/plain')) return;
      e.preventDefault();
      accept(list);
    });
  }

  const setQuick = (list: string[]) => {
    quick.replaceChildren(...list.map((text) => {
      const b = h('button', { type: 'button', class: 'b24-chat-composer__reply', role: 'listitem', title: text }, text);
      b.addEventListener('click', () => handle.insert(text));
      return b;
    }));
    quick.hidden = !list.length;
  };
  setQuick(options.quickReplies ?? []);

  const handle: ChatComposerHandle = {
    element: root,
    slots: { attachments: atts, actions, quick },
    focus: () => input.focus(),
    getValue: () => input.value,
    setValue(text) { input.value = text; fit(); },
    startEdit(m) {
      setReplyInner(null);
      editId = m.id;
      root.classList.add('is-editing');
      const cut = m.text.replace(/\s+/g, ' ').trim();
      const x = h('button', { type: 'button', class: 'b24-chat-composer__editing-x', 'aria-label': t('Отменить редактирование'), title: t('Отменить редактирование') }, html(icon('close', { size: 14 })));
      x.addEventListener('click', () => { handle.cancelEdit(); });
      editBar.replaceChildren(html(icon('edit', { size: 16 })), h('span', { class: 'b24-chat-composer__editing-body' }, h('span', { class: 'b24-chat-composer__editing-title' }, t('Редактирование')), h('span', { class: 'b24-chat-composer__editing-text' }, cut.length > 140 ? `${cut.slice(0, 140)}…` : cut)), x);
      editBar.hidden = false;
      stash = input.value;
      silent = true;
      // маркеры упоминаний @[Имя](user:ID) показываем как «@Имя» и запоминаем: при отправке они вернутся
      mentioned.length = 0;
      input.value = mentionCfg ? m.text.replace(/@\[([^\]\n]{1,80})\]\(user:([^)\s]{1,64})\)/g, (_all, name: string, id: string) => { mentioned.push({ id, name }); return `${trigger}${name}`; }) : m.text;
      fit();
      silent = false;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      sync();
    },
    cancelEdit() {
      if (editId == null) return;
      editId = null;
      root.classList.remove('is-editing');
      editBar.hidden = true;
      editBar.replaceChildren();
      silent = true;
      mentioned.length = 0;
      input.value = dKey ? stash : ''; fit();
      stash = '';
      silent = false;
      if (dKey && input.value) { try { const ms = JSON.parse(storageGet(`${dKey}:m`) ?? '[]'); if (Array.isArray(ms)) for (const x of ms) if (x && typeof x.id === 'string') mentioned.push({ id: x.id, name: x.name }); } catch { /* ignore */ } }
      sync();
      input.focus();
    },
    getDraft() { if (dTimer) saveDraft(); return dKey ? storageGet(dKey) ?? '' : ''; },
    clearDraft() { dropDraft(); },
    startVoice() { void startVoice(); },
    cancelVoice() { if (!vs) return; vs.cancelled = true; if (vs.rec.state !== 'inactive') vs.rec.stop(); voiceCleanup(); input.focus(); },
    isRecording: () => !!vs && vs.rec.state === 'recording',
    getEditing: () => editId,
    setReply(r) { if (r && editId != null) handle.cancelEdit(); setReplyInner(r); if (r) input.focus(); },
    getReply: () => (reply ? { ...reply } : null),
    cancelReply() { if (!reply) return; setReplyInner(null); input.focus(); options.onReplyCancel?.(); },
    format(kind) { if (kind === 'quote') quoteFn(); else wrapSel(fmtMarks[kind]); },
    addAttachment(a) {
      const old = files.get(a.id);
      if (old) { old.a = a; paintChip(old); sync(); return; }
      const rec = { a, el: h('div', { class: 'b24-chat-attchip' }) };
      files.set(a.id, rec);
      paintChip(rec);
      atts.append(rec.el);
      sync();
    },
    updateAttachment(id, patch) {
      const rec = files.get(id);
      if (!rec) return;
      rec.a = { ...rec.a, ...patch };
      paintChip(rec);
      sync();
    },
    removeAttachment(id) { files.get(id)?.el.remove(); files.delete(id); sync(); },
    getAttachments: () => Array.from(files.values()).map((x) => x.a),
    clearAttachments() { files.forEach((x) => x.el.remove()); files.clear(); sync(); },
    setMode(id) {
      const m = modeList.find((x) => x.id === id);
      if (!m || m.disabled || id === mode) return;
      mode = id;
      paintModes();
      options.onModeChange?.(id);
    },
    getMode: () => mode,
    setModeDisabled(id, disabled, reason) {
      const m = modeList.find((x) => x.id === id);
      if (!m) return;
      m.disabled = disabled;
      m.disabledReason = reason;
      if (disabled && mode === id) { mode = modeList.find((x) => !x.disabled)?.id; if (mode) options.onModeChange?.(mode); }
      paintModes();
    },
    insert(text) {
      const { selectionStart: s, selectionEnd: e, value } = input;
      input.value = value.slice(0, s) + text + value.slice(e);
      input.selectionStart = input.selectionEnd = s + text.length;
      fit();
      input.focus();
    },
    setDisabled(disabled, text) {
      root.classList.toggle('is-disabled', disabled);
      input.disabled = disabled;
      blocked.hidden = !(disabled && text);
      blocked.textContent = text ?? '';
      row.hidden = !!(disabled && text);
      quick.hidden = disabled || !quick.childElementCount;
      sync();
    },
    setQuickReplies: setQuick,
    destroy() { document.removeEventListener('keydown', onVoiceKey); if (dTimer) saveDraft(); if (vs) { vs.cancelled = true; if (vs.rec.state !== 'inactive') vs.rec.stop(); voiceCleanup(); } clearTimeout(mTimer); unResize(); dropCleanup.forEach((fn) => fn()); root.remove(); },
  };
  const emojiBtn = options.emoji ? attachEmojiPicker(handle) : null;
  if (emojiBtn) { const base = handle.destroy; handle.destroy = () => { emojiBtn.destroy(); base(); }; }
  paintModes();
  if (options.disabled || options.disabledText) handle.setDisabled(true, options.disabledText);
  sync();
  return handle;
}

/* ── Вертикальная навигация слева от списка ──────────────── */

/** unknown — первого статуса ещё не было: точки и подписи нет (не «нет связи») */
export type ChatRailStatus = 'online' | 'away' | 'busy' | 'offline' | 'disconnected' | 'ringing' | 'unknown';
export interface ChatRailItem {
  id: string;
  label: string;
  icon: IconName;
  /** ссылка вместо кнопки */
  href?: string;
  /** число на значке (непрочитанные, пропущенные) */
  counter?: number;
  /** точка состояния на значке: online — зелёная, away — оранжевая, busy / disconnected — красная, offline — серая, ringing — зелёная с пульсом («звонит») */
  status?: ChatRailStatus;
  /** подсказка; по умолчанию — подпись */
  title?: string;
  /** лёгкий фон значка («#9be8dc»): цвет папки; иконка остаётся тёмной */
  color?: string;
  disabled?: boolean;
  /** панель, которую показывает пункт (см. ChatRailOptions.panes): значение data-b24-chat-pane */
  pane?: string;
  /** свои атрибуты и класс на кнопке: переживают любые перерисовки рейла */
  attrs?: Record<string, string>;
  className?: string;
  /** не перетаскивается и не сдвигается другими (когда у рейла sortable) */
  fixed?: boolean;
}
export interface ChatRailOptions {
  items: ChatRailItem[];
  /** активный пункт */
  value?: string | null;
  onSelect?: (id: string, item: ChatRailItem, event: MouseEvent) => void;
  label?: string;
  /**
   * Общий рейл с несколькими панелями внутри одного .b24-chat: у каждого пункта — pane, в разметке — несколько
   * `.b24-chat__pane[data-b24-chat-pane="lines"]` (каждая со своей раскладкой список | переписка | карточка).
   * Выбор пункта показывает его панель и скрывает остальные; `onPaneChange` сообщает о смене.
   */
  panes?: boolean;
  onPaneChange?: (pane: string, element: HTMLElement) => void;
  /**
   * Пункты перетаскиваются (мышь, касание — долгим нажатием, Alt + стрелки с клавиатуры). true — все, кроме fixed; функция — выбрать, какие
   * (папки двигаются, «Чаты / Линии / Телефон» стоят на месте). Остальные пункты остаются на своих местах.
   */
  sortable?: boolean | ((item: ChatRailItem) => boolean);
  /** порядок изменён: id перетаскиваемых пунктов в новом порядке и id всех пунктов */
  onReorder?: (ids: string[], all: string[]) => void;
  /** кнопка «+» в конце рейла (создать папку) */
  onAdd?: () => void;
  addLabel?: string;
  /** меню пункта: правый клик, долгое нажатие, Shift+F10 / клавиша меню */
  itemActions?: (item: ChatRailItem) => Array<ChatMenuAction<ChatRailItem>> | null | undefined;
}
export interface ChatRailHandle {
  element: HTMLElement;
  setItems(items: ChatRailItem[]): void;
  update(id: string, patch: Partial<ChatRailItem>): void;
  setActive(id: string | null): void;
  /** панель по id (для panes) */
  setPane(pane: string): void;
  getActive(): string | null;
  /** кнопка пункта: для popover, фокуса и т. п. */
  buttonOf(id: string): HTMLElement | null;
  destroy(): void;
}

/**
 * Узкий рейл «Чаты / Линии / CRM / Телефон» — слот слева от .b24-chat__list внутри .b24-chat (как в десктопном Битрикс24).
 * Пункт — значок и подпись под ним, кнопка или ссылка; активный — с подложкой и цветом акцента (aria-current).
 * Кнопки не пересоздаются: setActive, update и setItems меняют только изменившееся, внешние атрибуты сохраняются.
 * На ≤768px — горизонтальная панель над списком; когда открыта переписка (.is-dialog-open) — скрыта.
 * host — сам .b24-chat (рейл встанет первым) или любой контейнер.
 */
export function createChatRail(host: HTMLElement, options: ChatRailOptions): ChatRailHandle {
  let items = options.items;
  let active = options.value ?? null;
  const root = h('nav', { class: 'b24-chat__rail', 'aria-label': options.label ?? t('Разделы чата') });
  if (host.classList.contains('b24-chat')) host.prepend(root); else host.append(root);
  const chatEl = (host.classList.contains('b24-chat') ? host : root.closest<HTMLElement>('.b24-chat')) ?? host;
  const els = new Map<string, HTMLElement>();
  const sig = new Map<string, string>();
  const ownAttrs = new Map<string, Set<string>>();

  const paintPanes = () => {
    if (!options.panes) return;
    const cur = items.find((x) => x.id === active)?.pane;
    chatEl.querySelectorAll<HTMLElement>(':scope > [data-b24-chat-pane]').forEach((p) => { p.hidden = !!cur && p.dataset.b24ChatPane !== cur; });
  };

  /** Обновляет кнопку на месте. Содержимое (значок, подпись, счётчик, точка) пересобирается, только если оно изменилось. */
  const paint = (el: HTMLElement, it: ChatRailItem) => {
    const on = it.id === active;
    el.classList.toggle('is-active', on);
    for (const cls of (el.dataset.railClass ?? '').split(' ').filter(Boolean)) el.classList.remove(cls);
    if (it.className) { it.className.split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c)); el.dataset.railClass = it.className; } else delete el.dataset.railClass;
    el.classList.toggle('is-ringing', it.status === 'ringing');
    if (on) el.setAttribute('aria-current', it.href ? 'page' : 'true'); else el.removeAttribute('aria-current');
    el.title = it.title ?? it.label;
    if (it.disabled) { el.setAttribute('aria-disabled', 'true'); if (el instanceof HTMLButtonElement) el.disabled = true; } else { el.removeAttribute('aria-disabled'); if (el instanceof HTMLButtonElement) el.disabled = false; }
    if (el instanceof HTMLAnchorElement) { if (it.href && !it.disabled) el.href = it.href; else el.removeAttribute('href'); }
    // свои атрибуты: ставим заданные, снимаем только прежние собственные
    const prev = ownAttrs.get(it.id) ?? new Set<string>();
    const next = new Set(Object.keys(it.attrs ?? {}));
    prev.forEach((k) => { if (!next.has(k)) el.removeAttribute(k); });
    for (const [k, v] of Object.entries(it.attrs ?? {})) el.setAttribute(k, v);
    ownAttrs.set(it.id, next);
    const s = `${it.icon}|${it.label}|${it.counter ?? ''}|${it.status ?? ''}|${it.color ?? ''}`;
    if (sig.get(it.id) !== s) {
      sig.set(it.id, s);
      const ico = h('span', { class: 'b24-chat-rail__icon' }, html(icon(it.icon, { size: 24 })));
      if (it.color) ico.style.setProperty('--b24-chat-rail-color', it.color);
      ico.classList.toggle('has-color', !!it.color);
      if (it.counter) ico.append(h('span', { class: 'b24-counter b24-chat-rail__counter' }, it.counter > 99 ? '99+' : String(it.counter)));
      if (it.status && it.status !== 'unknown') ico.append(h('span', { class: `b24-chat-rail__dot is-${it.status}`, 'aria-hidden': 'true' }));
      el.replaceChildren(ico, h('span', { class: 'b24-chat-rail__label' }, it.label));
    }
    const parts = [it.counter ? t('непрочитанных: {n}', { n: it.counter }) : '', it.status && it.status !== 'unknown' ? ({ online: t('на линии'), away: t('перерыв'), busy: t('занят'), offline: t('не на линии'), disconnected: t('нет связи'), ringing: t('звонит') } as const)[it.status] : ''].filter(Boolean);
    if (parts.length) el.setAttribute('aria-label', `${it.label}, ${parts.join(', ')}`); else el.removeAttribute('aria-label');
  };

  let addLast = () => {};
  const render = () => {
    const ids = new Set(items.map((x) => x.id));
    for (const [id, el] of els) if (!ids.has(id)) { el.remove(); els.delete(id); sig.delete(id); ownAttrs.delete(id); }
    items.forEach((it, i) => {
      let el = els.get(it.id);
      // тип элемента (ссылка / кнопка) поменялся — пересоздаём, иначе обновляем на месте
      if (el && (el instanceof HTMLAnchorElement) !== !!it.href) { el.remove(); els.delete(it.id); sig.delete(it.id); el = undefined; }
      if (!el) {
        el = it.href ? h('a', {}) : h('button', { type: 'button' });
        el.className = 'b24-chat-rail__item';
        el.dataset.id = it.id;
        els.set(it.id, el);
      }
      paint(el, it);
      if (root.children[i] !== el) root.insertBefore(el, root.children[i] ?? null);
    });
    addLast();
    paintPanes();
  };
  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.b24-chat-rail__item');
    if (!el || el.getAttribute('aria-disabled') === 'true') { if (el) e.preventDefault(); return; }
    const it = items.find((x) => x.id === el.dataset.id);
    if (!it) return;
    handle.setActive(it.id);
    if (options.panes && it.pane) {
      const pane = chatEl.querySelector<HTMLElement>(`:scope > [data-b24-chat-pane="${CSS.escape(it.pane)}"]`);
      if (pane) options.onPaneChange?.(it.pane, pane);
    }
    options.onSelect?.(it.id, it, e);
  });
  render();
  // ── перетаскивание папок: мышь, касание (долгое нажатие), Alt + стрелки ──
  const isSortable = (it: ChatRailItem) => !it.fixed && !it.disabled && (typeof options.sortable === 'function' ? options.sortable(it) : !!options.sortable);
  const live = h('div', { class: 'b24-sortable__live', 'aria-live': 'polite', role: 'status' });
  root.append(live);
  const sortIds = () => items.filter(isSortable).map((x) => x.id);
  /** новый порядок только среди перетаскиваемых: остальные остаются на своих местах */
  const applyOrder = (ids: string[]) => {
    const byId = new Map(items.map((x) => [x.id, x]));
    let k = 0;
    items = items.map((x) => (isSortable(x) ? byId.get(ids[k++])! : x));
    render();
  };
  const finish = () => options.onReorder?.(sortIds(), items.map((x) => x.id));
  let drag: { id: string; el: HTMLElement; pid: number; x: number; y: number; started: boolean; touch: boolean; timer: number; before: string } | null = null;
  let suppressClickUntil = 0;
  let suppressClickEl: HTMLElement | null = null;
  const horizontal = () => getComputedStyle(root).flexDirection.startsWith('row');
  const startDrag = () => {
    if (!drag || drag.started) return;
    drag.started = true;
    drag.before = sortIds().join('|');
    try { drag.el.setPointerCapture(drag.pid); } catch { /* ignore */ }
    drag.el.classList.add('is-dragging');
    root.classList.add('is-sorting');
    navigator.vibrate?.(10);
  };
  const dragTo = (x: number, y: number) => {
    if (!drag) return;
    const hz = horizontal();
    const pos = hz ? x : y;
    const others = sortIds().filter((id) => id !== drag!.id);
    let idx = 0;
    for (const id of others) {
      const r = els.get(id)!.getBoundingClientRect();
      if ((hz ? r.left + r.width / 2 : r.top + r.height / 2) < pos) idx++;
    }
    const next = others.slice();
    next.splice(idx, 0, drag.id);
    if (next.join('|') !== sortIds().join('|')) applyOrder(next);
  };
  const endDrag = () => {
    if (!drag) return;
    clearTimeout(drag.timer);
    const d = drag;
    drag = null;
    if (!d.started) return;
    d.el.classList.remove('is-dragging');
    root.classList.remove('is-sorting');
    suppressClickUntil = Date.now() + 350;
    suppressClickEl = d.el;
    if (sortIds().join('|') !== d.before) { finish(); live.textContent = `${items.find((x) => x.id === d.id)?.label ?? ''}: ${sortIds().indexOf(d.id) + 1} / ${sortIds().length}`; }
  };
  if (options.sortable) {
    root.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.b24-chat-rail__item[data-id]');
      const it = el && items.find((x) => x.id === el.dataset.id);
      if (!el || !it || !isSortable(it) || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const touch = e.pointerType !== 'mouse';
      drag = { id: it.id, el, pid: e.pointerId, x: e.clientX, y: e.clientY, started: false, touch, timer: 0, before: '' };
      if (touch) drag.timer = window.setTimeout(startDrag, 380);
    });
    root.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.pid) return;
      if (!drag.started) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) <= 6) return;
        if (drag.touch) { clearTimeout(drag.timer); drag = null; return; }   // палец поехал раньше долгого нажатия — это прокрутка
        startDrag();
      }
      e.preventDefault();
      dragTo(e.clientX, e.clientY);
    });
    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', endDrag);
    root.addEventListener('touchmove', (e) => { if (drag?.started && e.cancelable) e.preventDefault(); }, { passive: false });
    root.addEventListener('dragstart', (e) => e.preventDefault());
    root.addEventListener('click', (e) => { if (Date.now() < suppressClickUntil && suppressClickEl?.contains(e.target as Node)) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    root.addEventListener('keydown', (e) => {
      if (!e.altKey) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>('.b24-chat-rail__item[data-id]');
      const it = el && items.find((x) => x.id === el.dataset.id);
      if (!el || !it || !isSortable(it)) return;
      const dir = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : 0;
      if (!dir) return;
      e.preventDefault();
      const ids = sortIds();
      const i = ids.indexOf(it.id);
      const j = i + dir;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      applyOrder(ids);
      els.get(it.id)?.focus();
      finish();
      live.textContent = `${it.label}: ${j + 1} / ${ids.length}`;
    });
  }
  // ── кнопка «+» внизу и меню пункта ──
  const addBtn = options.onAdd
    ? h('button', { type: 'button', class: 'b24-chat-rail__item b24-chat-rail__add', 'aria-label': options.addLabel ?? t('Добавить'), title: options.addLabel ?? t('Добавить') }, h('span', { class: 'b24-chat-rail__icon' }, html(icon('plus', { size: 22 }))))
    : null;
  if (addBtn) { addBtn.addEventListener('click', () => options.onAdd!()); root.append(addBtn); }
  const menu = options.itemActions
    ? contextMenu(root, (_e, el) => {
      const it = items.find((x) => x.id === el.dataset.id);
      const acts = it && options.itemActions!(it);
      return acts?.length ? chatMenuItems(acts, it!) : null;
    }, { selector: '.b24-chat-rail__item[data-id]' })
    : null;
  addLast = () => { if (addBtn) root.append(addBtn); live.isConnected && root.append(live); };
  addLast();
  const handle: ChatRailHandle = {
    element: root,
    setItems(next) { items = next; render(); },
    update(id, patch) { items = items.map((x) => (x.id === id ? { ...x, ...patch } : x)); const it = items.find((x) => x.id === id); const el = els.get(id); if (it && el) paint(el, it); },
    setActive(id) { active = id; items.forEach((it) => { const el = els.get(it.id); if (el) paint(el, it); }); paintPanes(); },
    setPane(pane) { const it = items.find((x) => x.pane === pane); if (it) handle.setActive(it.id); },
    getActive: () => active,
    buttonOf: (id) => els.get(id) ?? null,
    destroy() { menu?.destroy(); root.remove(); },
  };
  return handle;
}

/* ── Каркас «список | переписка | карточка» ──────────────── */

export interface ChatLayoutHandle {
  element: HTMLElement;
  /** показать переписку (на телефоне — вместо списка) */
  openDialog(): void;
  /** назад к списку (телефон) */
  back(): void;
  /** показать / скрыть карточку (на ≤1100px она выезжает поверх) */
  toggleAside(open?: boolean): void;
  destroy(): void;
}

/** .b24-chat: кнопки [data-b24-chat-back] — назад к списку, [data-b24-chat-aside] — карточка. Подключается и через init() ([data-b24-chat]). */
export function initChatLayout(el: HTMLElement): ChatLayoutHandle {
  // пустые кнопки «назад» и «набор» получают значок сами (свой — data-b24-icon="имя"); с содержимым не трогаем
  el.querySelectorAll<HTMLElement>('[data-b24-chat-back], [data-b24-chat-open]').forEach((b) => {
    if (b.childElementCount || b.textContent?.trim()) return;
    const name = (b.dataset.b24Icon as IconName | undefined) ?? (b.hasAttribute('data-b24-chat-back') ? 'arrowLeft' : 'phone');
    b.innerHTML = icon(name, { size: b.hasAttribute('data-b24-chat-open') ? 24 : 20 });
  });
  // фаза захвата: список перерисовывает строку в своём обработчике, и цель клика к всплытию уже не в документе
  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-b24-chat-back]')) handle.back();
    else if (target.closest('[data-b24-chat-open]')) handle.openDialog();
    else if (target.closest('[data-b24-chat-aside]')) handle.toggleAside();
    else {
      if (el.classList.contains('is-aside-open') && !target.closest('.b24-chat__aside')) handle.toggleAside(false);
      if (target.closest('.b24-chat__list .b24-chat-list__item')) handle.openDialog();
    }
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && el.classList.contains('is-aside-open')) { e.stopPropagation(); handle.toggleAside(false); } };
  el.addEventListener('click', onClick, true);
  el.addEventListener('keydown', onKey);
  const handle: ChatLayoutHandle = {
    element: el,
    openDialog() { el.classList.add('is-dialog-open'); },
    back() { el.classList.remove('is-dialog-open'); el.querySelector<HTMLElement>('.b24-chat-list__item.is-active')?.focus(); },
    toggleAside(open) { el.classList.toggle('is-aside-open', open ?? !el.classList.contains('is-aside-open')); },
    destroy() { el.removeEventListener('click', onClick, true); el.removeEventListener('keydown', onKey); },
  };
  return handle;
}

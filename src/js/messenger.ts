/**
 * Мессенджер сквозь весь раздел, как в Битрикс24:
 *   createMessengerBar — правая панель: «Все чаты», аватары диалогов со счётчиками, кнопки внизу;
 *   openChatDock       — плавающее окно чата у правого края (несколько в ряд), свёрнутое — полоска с именем и счётчиком;
 *                        на телефоне — нижний лист на 70% высоты.
 * Окно собирается из createChatFeed + createChatComposer (chat.ts).
 */
import { icon, type IconName } from '../icons';
import { avatarHtml } from './avatar';
import { h, html } from './dom';
import { t } from './i18n';
import {
  createChatComposer, createChatFeed,
  type ChatComposerHandle, type ChatComposerOptions, type ChatFeedHandle, type ChatFeedOptions,
} from './chat';

const fmtCount = (n?: number) => (!n ? '' : n > 99 ? '99+' : String(n));

/* ── Правая панель ─────────────────────────────────────── */

export interface MessengerBarItem {
  id: string;
  name: string;
  avatar?: string;
  counter?: number;
  status?: 'online' | 'away';
  /** канал — в подсказке: «Мария · Telegram» */
  channel?: string;
  /** собеседник печатает: анимированные точки на аватаре, в подсказке «печатает…» (строка — свой текст) */
  typing?: boolean | string;
}
export interface MessengerBarAction {
  id: string;
  icon: IconName;
  label: string;
  counter?: number;
  active?: boolean;
  /** окраска: success — зелёная круглая кнопка (звонок), danger, primary */
  variant?: 'success' | 'danger' | 'primary';
  /** свой класс кнопки: оформление не слетает при перерисовке панели */
  className?: string;
  /** точка статуса на значке: online, away, offline, disconnected */
  status?: 'online' | 'away' | 'offline' | 'disconnected' | 'unknown';
  /** идёт звонок или другое длящееся действие: кнопка пульсирует */
  pulse?: boolean;
  disabled?: boolean;
  /** клик; вторым аргументом — кнопка, чтобы показать popover над ней */
  onClick?: (button: HTMLElement, event: MouseEvent) => void;
}
export interface MessengerBarOptions {
  items: MessengerBarItem[];
  value?: string | null;
  onSelect?: (id: string, item: MessengerBarItem) => void;
  /** кнопка «Все чаты» сверху; без обработчика — кнопки нет */
  onAll?: () => void;
  allLabel?: string;
  /** счётчик на «Все чаты» */
  allCounter?: number;
  /** кнопки внизу: уведомления, звонки… */
  actions?: MessengerBarAction[];
  /** куда вставить (по умолчанию document.body); панель fixed у правого края */
  host?: HTMLElement;
}
export interface MessengerBarHandle {
  element: HTMLElement;
  setItems(items: MessengerBarItem[]): void;
  update(id: string, patch: Partial<MessengerBarItem>): void;
  setActive(id: string | null): void;
  setActions(actions: MessengerBarAction[]): void;
  setAllCounter(n: number): void;
  destroy(): void;
}

/** Подсказка слева от кнопки панели: обычная CSS-подсказка обрезалась бы прокруткой колонки. */
let tip: HTMLElement | null = null;
function showTip(target: HTMLElement, text: string) {
  if (!tip) { tip = h('div', { class: 'b24-im-bar__tip b24-root', role: 'tooltip' }); document.body.append(tip); }
  tip.textContent = text;
  tip.hidden = false;
  const r = target.getBoundingClientRect();
  tip.style.top = `${r.top + r.height / 2}px`;
  tip.style.right = `${window.innerWidth - r.left + 8}px`;
}
const hideTip = () => { if (tip) tip.hidden = true; };

export function createMessengerBar(options: MessengerBarOptions): MessengerBarHandle {
  let items = options.items;
  let active = options.value ?? null;
  let actions = options.actions ?? [];
  let allCounter = options.allCounter ?? 0;
  const root = h('nav', { class: 'b24-im-bar b24-root', 'aria-label': t('Мессенджер') });
  const top = h('div', { class: 'b24-im-bar__top' });
  const list = h('div', { class: 'b24-im-bar__list', role: 'list' });
  const bottom = h('div', { class: 'b24-im-bar__bottom' });
  root.append(top, list, bottom);
  (options.host ?? document.body).append(root);
  document.documentElement.classList.add('b24-has-im-bar');

  const counterEl = (n?: number) => (n ? h('span', { class: 'b24-counter b24-im-bar__counter' }, fmtCount(n)) : '');
  const typingText = (it: MessengerBarItem) => (typeof it.typing === 'string' ? it.typing : t('печатает…'));
  const label = (it: MessengerBarItem) => [it.name, it.channel, it.typing ? typingText(it) : ''].filter(Boolean).join(' · ');

  const renderTop = () => {
    top.replaceChildren();
    if (!options.onAll) return;
    const b = h('button', { type: 'button', class: 'b24-im-bar__btn b24-im-bar__all', 'aria-label': options.allLabel ?? t('Все чаты'), 'data-tip': options.allLabel ?? t('Все чаты') }, html(icon('chat')), counterEl(allCounter));
    b.addEventListener('click', () => options.onAll!());
    top.append(b);
  };
  const itemEl = (it: MessengerBarItem) => {
    const b = h('button', {
      type: 'button', role: 'listitem', class: `b24-im-bar__btn b24-im-bar__item${it.id === active ? ' is-active' : ''}${it.typing ? ' is-typing' : ''}`,
      'data-id': it.id, 'data-tip': label(it), 'aria-label': `${label(it)}${it.counter ? `, ${t('непрочитанных: {n}', { n: it.counter })}` : ''}`,
      'aria-current': it.id === active ? 'true' : undefined,
    }, html(avatarHtml(it.name, it.avatar, 'lg', { status: it.status })), counterEl(it.counter), it.typing ? h('span', { class: 'b24-im-bar__typing', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')) : '');
    return b;
  };
  const renderList = () => list.replaceChildren(...items.map(itemEl));
  const renderBottom = () => {
    bottom.replaceChildren(...actions.map((a) => {
      const cls = ['b24-im-bar__btn', 'b24-im-bar__action', a.variant ? `b24-im-bar__action--${a.variant}` : '', a.pulse ? 'is-pulse' : '', a.active ? 'is-active' : '', a.className ?? ''].filter(Boolean).join(' ');
      const b = h('button', { type: 'button', class: cls, 'data-id': a.id, 'aria-label': a.label, 'data-tip': a.label, 'aria-pressed': a.active ? 'true' : undefined, disabled: a.disabled || undefined }, html(icon(a.icon)), counterEl(a.counter));
      if (a.status && a.status !== 'unknown') b.append(h('span', { class: `b24-im-bar__dot is-${a.status}`, 'aria-hidden': 'true' }));
      b.addEventListener('click', (e) => a.onClick?.(b, e));
      return b;
    }));
  };

  list.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.b24-im-bar__item');
    const it = b && items.find((x) => x.id === b.dataset.id);
    if (it) { handle.setActive(it.id); options.onSelect?.(it.id, it); }
  });
  const onOver = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (b && root.contains(b)) showTip(b, b.dataset.tip!); else hideTip();
  };
  root.addEventListener('pointerover', onOver);
  root.addEventListener('focusin', onOver);
  root.addEventListener('pointerleave', hideTip);
  root.addEventListener('focusout', hideTip);
  list.addEventListener('scroll', hideTip, { passive: true });

  renderTop(); renderList(); renderBottom();

  const handle: MessengerBarHandle = {
    element: root,
    setItems(next) { items = next; renderList(); },
    update(id, patch) {
      items = items.map((x) => (x.id === id ? { ...x, ...patch } : x));
      const old = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
      const it = items.find((x) => x.id === id);
      if (old && it) old.replaceWith(itemEl(it));
    },
    setActive(id) {
      active = id;
      list.querySelectorAll<HTMLElement>('.b24-im-bar__item').forEach((b) => {
        const on = b.dataset.id === id;
        b.classList.toggle('is-active', on);
        if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
    },
    setActions(next) { actions = next; renderBottom(); },
    setAllCounter(n) { allCounter = n; renderTop(); },
    destroy() {
      hideTip();
      root.remove();
      if (!document.querySelector('.b24-im-bar')) document.documentElement.classList.remove('b24-has-im-bar');
    },
  };
  return handle;
}

/* ── Плавающее окно чата ───────────────────────────────── */

export interface ChatDockOptions {
  /** ключ окна: повторный openChatDock с тем же id разворачивает уже открытое */
  id: string;
  name: string;
  avatar?: string;
  status?: 'online' | 'away';
  /** вторая строка шапки: «Telegram · в сети» */
  meta?: string;
  /** свои кнопки и аватары в шапке (между именем и кнопками окна): «Пригласить», приглашённые; позже — handle.slots.head */
  headExtra?: Node | Node[];
  /** «Открыть полностью» — перейти в раздел чатов; без обработчика кнопки нет */
  onExpand?: () => void;
  onClose?: () => void;
  onMinimize?: (minimized: boolean) => void;
  minimized?: boolean;
  /** лента: messages, hasMore, onLoadMore, onRetry… */
  feed?: ChatFeedOptions;
  /** поле ответа: onSend обязателен, чтобы можно было ответить; без него — только чтение */
  composer?: Partial<ChatComposerOptions> & { onSend?: ChatComposerOptions['onSend'] };
}
export interface ChatDockHandle {
  id: string;
  element: HTMLElement;
  feed: ChatFeedHandle;
  composer: ChatComposerHandle | null;
  minimize(): void;
  restore(): void;
  toggle(): void;
  isMinimized(): boolean;
  /** счётчик на свёрнутой полоске */
  setCounter(n: number): void;
  /** контейнеры: head — место для своих кнопок и аватаров в шапке */
  slots: { head: HTMLElement };
  setHeader(patch: { name?: string; meta?: string; avatar?: string; status?: 'online' | 'away' }): void;
  /** «Анна печатает…»: строка в ленте окна и «печатает…» во второй строке шапки ; null — убрать */
  setTyping(text: string | null): void;
  focus(): void;
  close(): void;
}

let dockHost: HTMLElement | null = null;
const docks = new Map<string, ChatDockHandle>();
/** окон в ряд не больше, чем помещается; лишние сворачиваются — начиная со старых */
const fitDocks = () => {
  if (!dockHost) return;
  const open = Array.from(docks.values()).filter((d) => !d.isMinimized());
  const room = Math.max(1, Math.floor((window.innerWidth - 120) / 372));
  open.slice(0, Math.max(0, open.length - room)).forEach((d) => d.minimize());
};

export function openChatDock(options: ChatDockOptions): ChatDockHandle {
  const existing = docks.get(options.id);
  if (existing) { existing.restore(); existing.focus(); return existing; }
  if (!dockHost) {
    dockHost = h('div', { class: 'b24-chat-docks b24-root' });
    document.body.append(dockHost);
    window.addEventListener('resize', fitDocks);
  }
  const el = h('section', { class: 'b24-chat-dock', role: 'dialog', 'aria-label': options.name, 'data-id': options.id });
  const avatarBox = h('span', { class: 'b24-chat-dock__avatar' });
  const nameEl = h('span', { class: 'b24-chat-dock__name' });
  const metaEl = h('span', { class: 'b24-chat-dock__meta' });
  const badge = h('span', { class: 'b24-counter b24-chat-dock__counter', hidden: '' });
  const titleBtn = h('button', { type: 'button', class: 'b24-chat-dock__title', 'aria-expanded': 'true' }, avatarBox, h('span', { class: 'b24-chat-dock__who' }, nameEl, metaEl), badge);
  const tools = h('div', { class: 'b24-chat-dock__tools' });
  const tool = (name: IconName, label: string, fn: () => void, cls = '') => {
    const b = h('button', { type: 'button', class: `b24-chat-dock__tool${cls}`, 'aria-label': label, title: label }, html(icon(name, { size: 18 })));
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    tools.append(b);
    return b;
  };
  if (options.onExpand) tool('externalLink', t('Открыть полностью'), () => options.onExpand!(), ' b24-chat-dock__expand');
  const minBtn = tool('minus', t('Свернуть'), () => handle.toggle(), ' b24-chat-dock__min');
  tool('close', t('Закрыть'), () => handle.close());
  const headSlot = h('div', { class: 'b24-chat-dock__extra' });
  if (options.headExtra) headSlot.append(...(Array.isArray(options.headExtra) ? options.headExtra : [options.headExtra]));
  const head = h('header', { class: 'b24-chat-dock__head' }, titleBtn, headSlot, tools);
  const body = h('div', { class: 'b24-chat-dock__body' });
  el.append(head, body);
  dockHost.prepend(el); // новые — справа, у панели

  const header = { name: options.name, meta: options.meta, avatar: options.avatar, status: options.status };
  let typingText: string | null = null;
  const paintHeader = () => {
    avatarBox.innerHTML = avatarHtml(header.name, header.avatar, 'sm', { status: header.status });
    nameEl.textContent = header.name;
    metaEl.textContent = typingText ? t('печатает…') : header.meta ?? '';
    metaEl.hidden = !typingText && !header.meta;
    metaEl.classList.toggle('is-typing', !!typingText);
    el.classList.toggle('is-typing', !!typingText);
    el.setAttribute('aria-label', header.name);
  };
  paintHeader();

  const feed = createChatFeed(body, options.feed ?? {});
  const composer = options.composer?.onSend ? createChatComposer(body, { ...options.composer, onSend: options.composer.onSend } as ChatComposerOptions) : null;

  const setMin = (min: boolean) => {
    if (min === el.classList.contains('is-minimized')) return;
    el.classList.toggle('is-minimized', min);
    titleBtn.setAttribute('aria-expanded', String(!min));
    minBtn.setAttribute('aria-label', min ? t('Развернуть') : t('Свернуть'));
    minBtn.title = min ? t('Развернуть') : t('Свернуть');
    minBtn.innerHTML = icon(min ? 'chevronUp' : 'minus', { size: 18 });
    if (!min) { badge.hidden = true; feed.scrollToBottom(); fitDocks(); }
    options.onMinimize?.(min);
  };
  titleBtn.addEventListener('click', () => handle.toggle());
  // Esc в окне сворачивает его (на телефоне — закрывает лист)
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || el.classList.contains('is-minimized')) return;
    e.stopPropagation();
    if (window.matchMedia('(max-width: 768px)').matches) handle.close(); else handle.minimize();
  });

  const handle: ChatDockHandle = {
    id: options.id,
    element: el,
    slots: { head: headSlot },
    feed,
    composer,
    minimize: () => setMin(true),
    restore: () => setMin(false),
    toggle: () => setMin(!el.classList.contains('is-minimized')),
    isMinimized: () => el.classList.contains('is-minimized'),
    setCounter(n) { badge.textContent = fmtCount(n); badge.hidden = !n; },
    setHeader(patch) { Object.assign(header, patch); paintHeader(); },
    setTyping(text) { typingText = text || null; feed.setTyping(typingText); paintHeader(); },
    focus() { (composer ? el.querySelector<HTMLElement>('.b24-chat-composer__input') : el.querySelector<HTMLElement>('.b24-chat-feed'))?.focus(); },
    close() {
      composer?.destroy();
      feed.destroy();
      el.remove();
      docks.delete(options.id);
      if (!docks.size && dockHost) { dockHost.remove(); dockHost = null; window.removeEventListener('resize', fitDocks); }
      options.onClose?.();
    },
  };
  docks.set(options.id, handle);
  if (options.minimized) setMin(true); else fitDocks();
  return handle;
}

/** Открытые окна чата */
export const getChatDocks = (): ChatDockHandle[] => Array.from(docks.values());

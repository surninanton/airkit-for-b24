import { createContext, useContext, useEffect, useRef, type MouseEvent, type MutableRefObject, type ReactNode } from 'react';
import {
  createChatComposer, createChatFeed, createChatList, initChatLayout,
  type ChatComposerHandle, type ChatComposerOptions, type ChatFeedHandle, type ChatFeedOptions,
  type ChatLayoutHandle, type ChatListHandle, type ChatRailItem, type ChatListOptions, type ChatMessage, type ChatListItem,
} from '../js/chat';
import {
  createMessengerBar, openChatDock,
  type MessengerBarHandle, type MessengerBarItem, type MessengerBarAction, type ChatDockHandle,
} from '../js/messenger';
import { createMemberList, type Member, type MemberListHandle, type MemberListOptions } from '../js/members';
import { Icon } from './Icon';
import { cx } from './utils';
import { t } from '../js/i18n';

/* Каркас: <ChatLayout list={…} aside={…} dialogOpen={!!activeId} onBack={() => setActiveId(null)}>{переписка}</ChatLayout> */
// кнопки [data-b24-chat-back] / [data-b24-chat-aside] обрабатывает initChatLayout; React сообщает только onBack
const LayoutCtx = createContext<{ onBack: () => void } | null>(null);

export interface ChatLayoutProps {
  /** рейл слева от списка: <ChatRail> (на ≤768px — панель над списком) */
  rail?: ReactNode;
  /** левая колонка: шапка списка и <ChatList> */
  list: ReactNode;
  /** правая колонка: карточка клиента; на ≤1100px выезжает по <ChatHeader asideToggle> */
  aside?: ReactNode;
  /** на телефоне показана переписка, а не список */
  dialogOpen?: boolean;
  /** «назад» на телефоне */
  onBack?: () => void;
  /** высота каркаса (по умолчанию calc(100vh - 200px)) */
  height?: number | string;
  className?: string;
  children: ReactNode;
}
export function ChatLayout({ rail, list, aside, dialogOpen, onBack, height, className, children }: ChatLayoutProps) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<ChatLayoutHandle | null>(null);
  const back = useRef(onBack);
  back.current = onBack;
  useEffect(() => {
    const h = initChatLayout(ref.current!);
    handle.current = h;
    return () => h.destroy();
  }, []);
  useEffect(() => { if (dialogOpen) handle.current?.openDialog(); else handle.current?.back(); }, [dialogOpen]);
  const ctx = { onBack: () => back.current?.() };
  return (
    <LayoutCtx.Provider value={ctx}>
      <div ref={ref} className={cx('b24-chat', className)} style={height != null ? { ['--b24-chat-height' as string]: typeof height === 'number' ? `${height}px` : height } : undefined}>
        {rail}
        <div className="b24-chat__list">{list}</div>
        <div className="b24-chat__main">{children}</div>
        {aside != null && <aside className="b24-chat__aside">{aside}</aside>}
      </div>
    </LayoutCtx.Provider>
  );
}

/** Шапка переписки: «назад» (телефон), аватар/имя/подпись, действия; asideToggle — кнопка карточки на ≤1100px */
export function ChatHeader({ title, meta, avatar, actions, asideToggle }: { title: ReactNode; meta?: ReactNode; avatar?: ReactNode; actions?: ReactNode; asideToggle?: boolean }) {
  const ctx = useContext(LayoutCtx);
  return (
    <div className="b24-chat__head">
      <button type="button" className="b24-btn b24-btn--plain b24-btn--icon" data-b24-chat-back aria-label={t('Назад')} onClick={() => ctx?.onBack()}>
        <Icon name="arrowLeft" />
      </button>
      {avatar}
      <div className="b24-chat__head-title">
        <span className="b24-chat__head-name">{title}</span>
        {meta && <span className="b24-chat__head-meta">{meta}</span>}
      </div>
      {actions}
      {asideToggle && (
        <button type="button" className="b24-btn b24-btn--plain b24-btn--icon b24-chat__aside-toggle" data-b24-chat-aside aria-label={t('Карточка')}>
          <Icon name="user" />
        </button>
      )}
    </div>
  );
}

export interface ChatRailProps {
  items: ChatRailItem[];
  value?: string | null;
  onSelect?: (id: string, item: ChatRailItem, event: MouseEvent<HTMLElement>) => void;
  label?: string;
}
/** Рейл «Чаты / Линии / CRM / Телефон»: передайте в <ChatLayout rail={…}>. Пункт с href — ссылка, без — кнопка. */
export function ChatRail({ items, value, onSelect, label }: ChatRailProps) {
  return (
    <nav className="b24-chat__rail" aria-label={label ?? t('Разделы чата')}>
      {items.map((it) => {
        const on = it.id === value;
        const props = {
          className: cx('b24-chat-rail__item', on && 'is-active', it.status === 'ringing' && 'is-ringing', it.className),
          title: it.title ?? it.label,
          'aria-current': on ? (it.href ? ('page' as const) : ('true' as const)) : undefined,
          'aria-disabled': it.disabled || undefined,
          'aria-label': it.counter ? `${it.label}, ${t('непрочитанных: {n}', { n: it.counter })}` : undefined,
          ...(it.attrs ?? {}),
          onClick: (e: MouseEvent<HTMLElement>) => { if (it.disabled) { e.preventDefault(); return; } onSelect?.(it.id, it, e); },
        };
        const inner = (
          <>
            <span className="b24-chat-rail__icon">
              <Icon name={it.icon} size={24} />
              {!!it.counter && <span className="b24-counter b24-chat-rail__counter">{it.counter > 99 ? '99+' : it.counter}</span>}
              {it.status && <span className={`b24-chat-rail__dot is-${it.status}`} aria-hidden="true" />}
            </span>
            <span className="b24-chat-rail__label">{it.label}</span>
          </>
        );
        return it.href && !it.disabled
          ? <a key={it.id} href={it.href} {...props}>{inner}</a>
          : <button key={it.id} type="button" disabled={it.disabled} {...props}>{inner}</button>;
      })}
    </nav>
  );
}

export interface ChatListProps extends Omit<ChatListOptions, 'items'> { items: ChatListItem[]; className?: string }
/** Список диалогов; items и value применяются без пересоздания */
export function ChatList({ items, value, onSelect, emptyText, label, className }: ChatListProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<ChatListHandle | null>(null);
  const sel = useRef(onSelect);
  sel.current = onSelect;
  useEffect(() => {
    h.current = createChatList(host.current!, { items, value, emptyText, label, onSelect: (id, it) => sel.current?.(id, it) });
    return () => h.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const first = useRef(true);
  const key = JSON.stringify(items);
  useEffect(() => { if (first.current) { first.current = false; return; } h.current?.setItems(items); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (h.current && h.current.getActive() !== (value ?? null)) h.current.setActive(value ?? null); }, [value]);
  return <div ref={host} className={cx('b24-chat-list-host', className)} style={{ display: 'contents' }} />;
}

export interface ChatFeedProps extends Omit<ChatFeedOptions, 'messages'> {
  messages: ChatMessage[];
  /** хэндл ленты: scrollTo(id), jumpTo(id), scrollToBottom… */
  feedRef?: MutableRefObject<ChatFeedHandle | null>;
}
/**
 * Лента: передавайте весь список messages — кит сам поймёт, что пришло сверху («Показать раньше», позиция сохраняется)
 * или снизу (прокрутка вниз, если пользователь был у низа или сообщение наше).
 */
export function ChatFeed({ messages, hasMore, onLoadMore, onRetry, onPhotoClick, showAvatars, emptyText, noteLabel, reactionsHint, onReact, quickReactions, onReply, onEdit, copy, actions, decorate, hasNewer, onLoadNewer, onLoadAround, feedRef }: ChatFeedProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<ChatFeedHandle | null>(null);
  const cbs = useRef({ onLoadMore, onRetry, onPhotoClick, onReact, onReply, onEdit, actions, decorate, onLoadNewer, onLoadAround });
  cbs.current = { onLoadMore, onRetry, onPhotoClick, onReact, onReply, onEdit, actions, decorate, onLoadNewer, onLoadAround };
  useEffect(() => {
    h.current = createChatFeed(host.current!, {
      messages, hasMore, hasNewer, showAvatars, emptyText, quickReactions, copy, noteLabel, reactionsHint,
      onReact: onReact ? (id, e, m) => cbs.current.onReact?.(id, e, m) : undefined,
      onReply: onReply ? (m) => cbs.current.onReply?.(m) : undefined,
      onEdit: onEdit ? (m) => cbs.current.onEdit?.(m) : undefined,
      actions: actions ? (m) => cbs.current.actions?.(m) ?? [] : undefined,
      decorate: decorate ? (m, el) => cbs.current.decorate?.(m, el) : undefined,
      onLoadMore: onLoadMore ? () => cbs.current.onLoadMore?.() : undefined,
      onLoadNewer: onLoadNewer ? () => cbs.current.onLoadNewer?.() : undefined,
      onLoadAround: onLoadAround ? (id) => cbs.current.onLoadAround!(id) : undefined,
      onRetry: onRetry ? (m) => cbs.current.onRetry?.(m) : undefined,
      onPhotoClick: onPhotoClick ? (a, m) => cbs.current.onPhotoClick?.(a, m) : undefined,
    });
    if (feedRef) feedRef.current = h.current;
    return () => { h.current?.destroy(); if (feedRef) feedRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const first = useRef(true);
  const key = JSON.stringify(messages);
  useEffect(() => { if (first.current) { first.current = false; return; } h.current?.setMessages(messages); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { h.current?.setHasMore(!!hasMore); }, [hasMore]);
  useEffect(() => { h.current?.setHasNewer(!!hasNewer); }, [hasNewer]);
  return <div ref={host} style={{ display: 'contents' }} />;
}

export interface ChatComposerProps extends ChatComposerOptions {
  /** превью вложений над полем */
  attachments?: ReactNode;
  /** хэндл поля: addAttachment / updateAttachment (прогресс), setMode, setModeDisabled, insert… */
  composerRef?: MutableRefObject<ChatComposerHandle | null>;
}
/** Поле ответа: Enter — отправить, Shift+Enter — новая строка; false из onSend — текст остаётся */
export function ChatComposer({ onSend, onAttach, accept, quickReplies, enterToSend, disabled, disabledText, placeholder, maxLength, emoji, modes, mode, onModeChange, onRemoveAttachment, composerRef, dropTarget, maxSize, maxFiles, onReject, clearFailedOnSend, onTyping }: ChatComposerProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<ChatComposerHandle | null>(null);
  const cbs = useRef({ onSend, onAttach, onModeChange, onRemoveAttachment, onTyping });
  cbs.current = { onSend, onAttach, onModeChange, onRemoveAttachment, onTyping };
  useEffect(() => {
    h.current = createChatComposer(host.current!, {
      placeholder, accept, quickReplies, enterToSend, disabled, disabledText, maxLength, emoji, modes, mode, dropTarget, maxSize, maxFiles, onReject, clearFailedOnSend,
      onModeChange: onModeChange ? (m) => cbs.current.onModeChange?.(m) : undefined,
      onRemoveAttachment: onRemoveAttachment ? (a) => cbs.current.onRemoveAttachment?.(a) : undefined,
      onSend: (text, ctx) => cbs.current.onSend(text, ctx),
      onTyping: onTyping ? () => cbs.current.onTyping?.() : undefined,
      onAttach: onAttach ? (files) => cbs.current.onAttach?.(files) : undefined,
    });
    if (composerRef) composerRef.current = h.current;
    return () => { if (composerRef) composerRef.current = null; h.current?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const qKey = JSON.stringify(quickReplies ?? []);
  useEffect(() => { h.current?.setQuickReplies(quickReplies ?? []); }, [qKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { h.current?.setDisabled(!!(disabled || disabledText), disabledText); }, [disabled, disabledText]);
  return <div ref={host} style={{ display: 'contents' }} />;
}

export type { ChatMessage, ChatListItem };

/* ── Правая панель мессенджера и плавающее окно ── */

export interface MessengerBarProps {
  items: MessengerBarItem[];
  value?: string | null;
  onSelect?: (id: string, item: MessengerBarItem) => void;
  onAll?: () => void;
  allLabel?: string;
  allCounter?: number;
  actions?: MessengerBarAction[];
}
/** Правая панель мессенджера (fixed у правого края, под шапкой AppShell); сама ничего не рендерит на месте */
export function MessengerBar({ items, value, onSelect, onAll, allLabel, allCounter, actions }: MessengerBarProps) {
  const h = useRef<MessengerBarHandle | null>(null);
  const cbs = useRef({ onSelect, onAll, actions });
  cbs.current = { onSelect, onAll, actions };
  useEffect(() => {
    h.current = createMessengerBar({
      items, value, allLabel, allCounter,
      onSelect: (id, it) => cbs.current.onSelect?.(id, it),
      onAll: onAll ? () => cbs.current.onAll?.() : undefined,
      actions: wrapActions(actions),
    });
    return () => h.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const wrapActions = (list?: MessengerBarAction[]) => list?.map((a) => ({ ...a, onClick: (...args: Parameters<NonNullable<MessengerBarAction['onClick']>>) => cbs.current.actions?.find((x) => x.id === a.id)?.onClick?.(...args) }));
  const first = useRef(true);
  const iKey = JSON.stringify(items);
  const aKey = JSON.stringify(actions?.map(({ onClick: _o, ...rest }) => rest) ?? []);
  useEffect(() => { if (first.current) return; h.current?.setItems(items); }, [iKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (first.current) return; h.current?.setActions(wrapActions(actions) ?? []); }, [aKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (first.current) return; h.current?.setAllCounter(allCounter ?? 0); }, [allCounter]);
  useEffect(() => { if (first.current) { first.current = false; return; } h.current?.setActive(value ?? null); }, [value]);
  return null;
}

export interface ChatDockProps {
  /** ключ окна; смена id — другое окно */
  id: string;
  name: string;
  avatar?: string;
  status?: 'online' | 'away';
  meta?: string;
  messages: ChatMessage[];
  hasMore?: boolean;
  onLoadMore?: () => void | Promise<unknown>;
  onRetry?: (m: ChatMessage) => void;
  /** без onSend — окно только для чтения */
  onSend?: (text: string) => void | boolean | Promise<void | boolean>;
  quickReplies?: string[];
  minimized?: boolean;
  onMinimize?: (minimized: boolean) => void;
  /** счётчик на свёрнутой полоске */
  counter?: number;
  onExpand?: () => void;
  onClose?: () => void;
  /** собеседник печатает: «печатает…» в шапке окна и строка в ленте; строка — свой текст («Анна печатает…») */
  typing?: boolean | string;
}
/** Плавающее окно чата у правого края; несколько <ChatDock> — окна в ряд. Сам ничего не рендерит на месте */
export function ChatDock({ id, name, avatar, status, meta, messages, hasMore, onLoadMore, onRetry, onSend, quickReplies, minimized, onMinimize, counter, onExpand, onClose, typing }: ChatDockProps) {
  const h = useRef<ChatDockHandle | null>(null);
  const cbs = useRef({ onLoadMore, onRetry, onSend, onMinimize, onExpand, onClose });
  cbs.current = { onLoadMore, onRetry, onSend, onMinimize, onExpand, onClose };
  const closing = useRef(false);
  useEffect(() => {
    closing.current = false;
    h.current = openChatDock({
      id, name, avatar, status, meta, minimized,
      onMinimize: (m) => cbs.current.onMinimize?.(m),
      onExpand: onExpand ? () => cbs.current.onExpand?.() : undefined,
      onClose: () => { if (!closing.current) cbs.current.onClose?.(); },
      feed: { messages, hasMore, onLoadMore: onLoadMore ? () => cbs.current.onLoadMore?.() : undefined, onRetry: onRetry ? (m) => cbs.current.onRetry?.(m) : undefined },
      composer: onSend ? { quickReplies, onSend: (text) => cbs.current.onSend!(text) } : undefined,
    });
    return () => { closing.current = true; h.current?.close(); h.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const mKey = JSON.stringify(messages);
  useEffect(() => { h.current?.feed.setMessages(messages); }, [mKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { h.current?.feed.setHasMore(!!hasMore); }, [hasMore]);
  useEffect(() => { h.current?.setHeader({ name, avatar, status, meta }); }, [name, avatar, status, meta]);
  useEffect(() => { if (minimized == null || !h.current) return; if (minimized) h.current.minimize(); else h.current.restore(); }, [minimized]);
  useEffect(() => { h.current?.setCounter(counter ?? 0); }, [counter]);
  useEffect(() => { h.current?.setTyping(typing ? (typeof typing === 'string' ? typing : t('печатает…')) : null); }, [typing]);
  return null;
}

export interface MemberListProps extends Omit<MemberListOptions, 'items'> { items: Member[]; className?: string }
/** Список участников: аватар со статусом, имя, подпись, «вы»; items и selected применяются без пересоздания */
export function MemberList({ items, onSelect, onAction, title, emptyText, compact, selected, selfSelectable, label, className }: MemberListProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<MemberListHandle | null>(null);
  const sel = useRef(onSelect);
  sel.current = onSelect;
  const act = useRef(onAction);
  act.current = onAction;
  useEffect(() => {
    h.current = createMemberList(host.current!, {
      onAction: (a, m) => act.current?.(a, m),
      items, title, emptyText, compact, selected, selfSelectable, label,
      onSelect: onSelect ? (id, m) => sel.current?.(id, m) : undefined,
    });
    if (className) h.current.element.classList.add(...className.split(/\s+/).filter(Boolean));
    return () => h.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const first = useRef(true);
  const key = JSON.stringify(items);
  useEffect(() => { if (first.current) { first.current = false; return; } h.current?.setItems(items); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const selKey = JSON.stringify(selected ?? null);
  useEffect(() => { if (selected) h.current?.setSelected(selected); }, [selKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={host} style={{ display: 'contents' }} />;
}

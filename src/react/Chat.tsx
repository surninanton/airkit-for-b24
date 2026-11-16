import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import {
  createChatComposer, createChatFeed, createChatList, initChatLayout,
  type ChatComposerHandle, type ChatComposerOptions, type ChatFeedHandle, type ChatFeedOptions,
  type ChatLayoutHandle, type ChatListHandle, type ChatListOptions, type ChatMessage, type ChatListItem,
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
export function ChatLayout({ list, aside, dialogOpen, onBack, height, className, children }: ChatLayoutProps) {
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

export interface ChatFeedProps extends Omit<ChatFeedOptions, 'messages'> { messages: ChatMessage[] }
/**
 * Лента: передавайте весь список messages — кит сам поймёт, что пришло сверху («Показать раньше», позиция сохраняется)
 * или снизу (прокрутка вниз, если пользователь был у низа или сообщение наше).
 */
export function ChatFeed({ messages, hasMore, onLoadMore, onRetry, onPhotoClick, showAvatars, emptyText, onReact, quickReactions, onReply, copy, actions, decorate }: ChatFeedProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<ChatFeedHandle | null>(null);
  const cbs = useRef({ onLoadMore, onRetry, onPhotoClick, onReact, onReply, actions, decorate });
  cbs.current = { onLoadMore, onRetry, onPhotoClick, onReact, onReply, actions, decorate };
  useEffect(() => {
    h.current = createChatFeed(host.current!, {
      messages, hasMore, showAvatars, emptyText, quickReactions, copy,
      onReact: onReact ? (id, e, m) => cbs.current.onReact?.(id, e, m) : undefined,
      onReply: onReply ? (m) => cbs.current.onReply?.(m) : undefined,
      actions: actions ? (m) => cbs.current.actions?.(m) ?? [] : undefined,
      decorate: decorate ? (m, el) => cbs.current.decorate?.(m, el) : undefined,
      onLoadMore: onLoadMore ? () => cbs.current.onLoadMore?.() : undefined,
      onRetry: onRetry ? (m) => cbs.current.onRetry?.(m) : undefined,
      onPhotoClick: onPhotoClick ? (a, m) => cbs.current.onPhotoClick?.(a, m) : undefined,
    });
    return () => h.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const first = useRef(true);
  const key = JSON.stringify(messages);
  useEffect(() => { if (first.current) { first.current = false; return; } h.current?.setMessages(messages); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { h.current?.setHasMore(!!hasMore); }, [hasMore]);
  return <div ref={host} style={{ display: 'contents' }} />;
}

export interface ChatComposerProps extends ChatComposerOptions { /** превью вложений над полем */ attachments?: ReactNode }
/** Поле ответа: Enter — отправить, Shift+Enter — новая строка; false из onSend — текст остаётся */
export function ChatComposer({ onSend, onAttach, accept, quickReplies, enterToSend, disabled, disabledText, placeholder, maxLength, emoji }: ChatComposerProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<ChatComposerHandle | null>(null);
  const cbs = useRef({ onSend, onAttach });
  cbs.current = { onSend, onAttach };
  useEffect(() => {
    h.current = createChatComposer(host.current!, {
      placeholder, accept, quickReplies, enterToSend, disabled, disabledText, maxLength, emoji,
      onSend: (text) => cbs.current.onSend(text),
      onAttach: onAttach ? (files) => cbs.current.onAttach?.(files) : undefined,
    });
    return () => h.current?.destroy();
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
  const wrapActions = (list?: MessengerBarAction[]) => list?.map((a) => ({ ...a, onClick: () => cbs.current.actions?.find((x) => x.id === a.id)?.onClick?.() }));
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
}
/** Плавающее окно чата у правого края; несколько <ChatDock> — окна в ряд. Сам ничего не рендерит на месте */
export function ChatDock({ id, name, avatar, status, meta, messages, hasMore, onLoadMore, onRetry, onSend, quickReplies, minimized, onMinimize, counter, onExpand, onClose }: ChatDockProps) {
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
  return null;
}

export interface MemberListProps extends Omit<MemberListOptions, 'items'> { items: Member[]; className?: string }
/** Список участников: аватар со статусом, имя, подпись, «вы»; items и selected применяются без пересоздания */
export function MemberList({ items, onSelect, title, emptyText, compact, selected, selfSelectable, label, className }: MemberListProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<MemberListHandle | null>(null);
  const sel = useRef(onSelect);
  sel.current = onSelect;
  useEffect(() => {
    h.current = createMemberList(host.current!, {
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

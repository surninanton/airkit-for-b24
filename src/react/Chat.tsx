import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import {
  createChatComposer, createChatFeed, createChatList, initChatLayout,
  type ChatComposerHandle, type ChatComposerOptions, type ChatFeedHandle, type ChatFeedOptions,
  type ChatLayoutHandle, type ChatListHandle, type ChatListOptions, type ChatMessage, type ChatListItem,
} from '../js/chat';
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
export function ChatFeed({ messages, hasMore, onLoadMore, onRetry, onPhotoClick, showAvatars, emptyText }: ChatFeedProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<ChatFeedHandle | null>(null);
  const cbs = useRef({ onLoadMore, onRetry, onPhotoClick });
  cbs.current = { onLoadMore, onRetry, onPhotoClick };
  useEffect(() => {
    h.current = createChatFeed(host.current!, {
      messages, hasMore, showAvatars, emptyText,
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
export function ChatComposer({ onSend, onAttach, accept, quickReplies, enterToSend, disabled, disabledText, placeholder, maxLength }: ChatComposerProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<ChatComposerHandle | null>(null);
  const cbs = useRef({ onSend, onAttach });
  cbs.current = { onSend, onAttach };
  useEffect(() => {
    h.current = createChatComposer(host.current!, {
      placeholder, accept, quickReplies, enterToSend, disabled, disabledText, maxLength,
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

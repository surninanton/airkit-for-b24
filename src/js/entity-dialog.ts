import { icon, type IconName } from '../icons';
import { avatarHtml } from './avatar';
import { bringToFront, viewportHeight, escapeHtml, h, html, pushLayer, type Content } from './dom';

export interface DialogItem {
  id: string | number;
  /** тип сущности: user, department, deal … (id уникален в пределах entityId) */
  entityId?: string;
  title: string;
  subtitle?: string;
  /** URL аватара; для entityId=user без avatar рисуются инициалы */
  avatar?: string;
  icon?: IconName;
  /** вкладка для статического списка */
  tab?: string;
  group?: string;
  disabled?: boolean;
  data?: unknown;
}

export interface DialogTab { id: string; title: string; icon?: IconName }

export interface EntityDialogOptions {
  items?: DialogItem[];
  /** асинхронная загрузка (поиск по серверу); вызывается при открытии и при вводе */
  load?: (query: string, tab: string | null, signal: AbortSignal) => Promise<DialogItem[]>;
  tabs?: DialogTab[];
  multiple?: boolean;
  selected?: DialogItem[];
  searchable?: boolean;
  placeholder?: string;
  emptyText?: string;
  width?: number;
  compact?: boolean;
  /** показывать аватары/иконки */
  avatars?: boolean;
  placement?: 'bottom-start' | 'bottom-end';
  debounce?: number;
  /** футер «Выбрано: N · Готово» для multiple (по умолчанию true) */
  footer?: boolean | Content;
  /** свободный ввод: при поиске без точного совпадения первым пунктом идёт «Использовать «…»» */
  creatable?: boolean;
  /** подпись пункта свободного ввода */
  createLabel?: (query: string) => string;
  /** счётчик «N из M» внизу списка (липкий) */
  counter?: boolean;
  /** группа пункта, если её нет в item.group (например, по префиксу кода UF_) */
  groupBy?: (item: DialogItem) => string | undefined;
  onChange?: (selected: DialogItem[]) => void;
  onClose?: (selected: DialogItem[]) => void;
}

export interface EntityDialogHandle {
  element: HTMLElement;
  getSelected(): DialogItem[];
  setSelected(items: DialogItem[]): void;
  refresh(): void;
  close(): void;
}

export const itemKey = (i: Pick<DialogItem, 'id' | 'entityId'>): string => `${i.entityId ?? ''}:${i.id}`;

/** Пункт свободного ввода: id и title — введённый текст */
export const isCreatedItem = (i: DialogItem): boolean => (i.data as { __created?: boolean } | undefined)?.__created === true;

function highlight(text: string, query: string): string {
  const safe = escapeHtml(text);
  if (!query) return safe;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return safe;
  return `${escapeHtml(text.slice(0, i))}<mark>${escapeHtml(text.slice(i, i + query.length))}</mark>${escapeHtml(text.slice(i + query.length))}`;
}

const ENTITY_ICONS: Record<string, IconName> = { department: 'department', company: 'company', contact: 'user', deal: 'deal', lead: 'star', task: 'tasks', project: 'folder' };

/** Диалог выбора (аналог BX.UI.EntitySelector.Dialog): поиск, вкладки, мультивыбор, асинхронная загрузка. */
export function openEntityDialog(anchor: HTMLElement, options: EntityDialogOptions): EntityDialogHandle {
  const {
    tabs = [], multiple = false, searchable = true, placeholder = 'Поиск', emptyText = 'Ничего не найдено',
    width, compact, avatars = true, placement = 'bottom-start', debounce = 250,
  } = options;
  let selected = [...(options.selected ?? [])];
  const withGroups = (list: DialogItem[]) => (options.groupBy ? list.map((i) => ({ ...i, group: i.group ?? options.groupBy!(i) })) : list);
  let items: DialogItem[] = withGroups(options.items ?? []);
  let query = '';
  let tab: string | null = tabs[0]?.id ?? null;
  let active = 0;
  let loading = false;
  let abort: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const root = h('div', {
    class: `b24-popup b24-root b24-dialog${compact ? ' b24-dialog--compact' : ''}`,
    role: 'dialog',
    style: `background:var(--b24-bg-surface)${width ? `;--b24-dialog-width:${width}px` : ''}`,
  });
  const listId = `b24-dlg-${Math.random().toString(36).slice(2, 8)}`;
  const search = h('input', {
    class: 'b24-input',
    placeholder,
    'aria-label': placeholder,
    role: 'combobox',
    'aria-expanded': 'true',
    'aria-controls': listId,
    'aria-autocomplete': 'list',
    autocomplete: 'off',
  });
  const list = h('div', { class: 'b24-dialog__list', id: listId, role: 'listbox', 'aria-multiselectable': multiple ? 'true' : undefined });

  if (searchable) {
    root.append(h('div', { class: 'b24-dialog__search' },
      h('div', { class: 'b24-input-group' }, h('span', { class: 'b24-input-group__icon' }, html(icon('search'))), search)));
  }
  let tabsEl: HTMLElement | null = null;
  if (tabs.length > 1) {
    tabsEl = h('div', { class: 'b24-dialog__tabs', role: 'tablist' });
    root.append(tabsEl);
  }
  root.append(list);
  const footerEl = h('div', { class: 'b24-dialog__footer' });
  const showFooter = options.footer !== false && (multiple || !!options.counter || (options.footer && options.footer !== true));
  if (showFooter) root.append(footerEl);

  const isSelected = (i: DialogItem) => selected.some((s) => itemKey(s) === itemKey(i));

  /** найденные пункты без пункта свободного ввода; группы идут подряд в порядке первого появления */
  const found = (): DialogItem[] => {
    const q = query.trim().toLowerCase();
    const list = options.load ? items : items.filter((i) =>
      (!tab || !tabs.length || !i.tab || i.tab === tab) &&
      (!q || i.title.toLowerCase().includes(q) || i.subtitle?.toLowerCase().includes(q) || String(i.id).toLowerCase().includes(q)));
    if (!list.some((i) => i.group)) return list;
    const order = new Map<string, number>();
    list.forEach((i) => { if (!order.has(i.group ?? '')) order.set(i.group ?? '', order.size); });
    return [...list].sort((a, b) => order.get(a.group ?? '')! - order.get(b.group ?? '')!);
  };
  const visible = (): DialogItem[] => {
    const list = found();
    const q = query.trim();
    if (!options.creatable || !q) return list;
    const lower = q.toLowerCase();
    const exact = items.some((i) => i.title.toLowerCase() === lower || String(i.id).toLowerCase() === lower);
    return exact ? list : [{ id: q, title: q, data: { __created: true } }, ...list];
  };

  const renderTabs = () => {
    if (!tabsEl) return;
    tabsEl.textContent = '';
    for (const t of tabs) {
      const b = h('button', { type: 'button', class: 'b24-dialog__tab', role: 'tab', 'aria-selected': String(t.id === tab) });
      if (t.icon) b.append(html(icon(t.icon)));
      b.append(t.title);
      b.addEventListener('click', () => { tab = t.id; active = 0; renderTabs(); reload(); });
      tabsEl.append(b);
    }
  };

  const renderFooter = () => {
    if (!showFooter) return;
    footerEl.textContent = '';
    if (options.footer && options.footer !== true) {
      footerEl.append(typeof options.footer === 'string' ? document.createTextNode(options.footer) : options.footer);
      return;
    }
    const parts: string[] = [];
    if (options.counter) parts.push(`${found().length} из ${items.length}`);
    if (multiple) parts.push(`Выбрано: ${selected.length}`);
    footerEl.append(h('span', { class: 'b24-dialog__counter' }, parts.join(' · ')));
    if (multiple) {
      const done = h('button', { type: 'button', class: 'b24-btn b24-btn--primary b24-btn--sm' }, 'Готово');
      done.addEventListener('click', () => handle.close());
      footerEl.append(done);
    }
  };

  const renderList = () => {
    list.textContent = '';
    if (loading && !items.length) {
      list.append(h('div', { class: 'b24-dialog__loading' }, h('span', { class: 'b24-spinner b24-spinner--sm' }), 'Загрузка…'));
      return;
    }
    const data = visible();
    renderFooter();
    if (!data.length) {
      list.append(h('div', { class: 'b24-dialog__empty' }, emptyText));
      return;
    }
    active = Math.min(active, data.length - 1);
    let group: string | undefined;
    data.forEach((item, index) => {
      if (isCreatedItem(item)) {
        const el = h('div', {
          class: `b24-dialog__item b24-dialog__item--create${index === active ? ' is-active' : ''}`,
          role: 'option', id: `${listId}-${index}`, 'aria-selected': 'false', 'data-index': String(index),
        }, h('span', { class: 'b24-dialog__item-icon' }, html(icon('plus'))), h('span', { class: 'b24-dialog__item-text' },
          h('span', { class: 'b24-dialog__item-title' }, options.createLabel?.(item.title) ?? `Использовать «${item.title}»`)));
        list.append(el);
        return;
      }
      if (item.group && item.group !== group) {
        group = item.group;
        list.append(h('div', { class: 'b24-dialog__group', role: 'presentation' }, group));
      }
      const el = h('div', {
        class: `b24-dialog__item${index === active ? ' is-active' : ''}`,
        role: 'option',
        id: `${listId}-${index}`,
        'aria-selected': String(isSelected(item)),
        'aria-disabled': item.disabled ? 'true' : undefined,
        'data-index': String(index),
      });
      if (avatars) {
        if (item.avatar || item.entityId === 'user' || (!item.icon && !item.entityId)) el.append(html(avatarHtml(item.title, item.avatar, 'sm')));
        else el.append(h('span', { class: 'b24-dialog__item-icon' }, html(icon(item.icon ?? ENTITY_ICONS[item.entityId ?? ''] ?? 'file'))));
      }
      const text = h('span', { class: 'b24-dialog__item-text' });
      const title = h('span', { class: 'b24-dialog__item-title' });
      title.innerHTML = highlight(item.title, query.trim());
      text.append(title);
      if (item.subtitle) {
        const sub = h('span', { class: 'b24-dialog__item-subtitle' });
        sub.innerHTML = highlight(item.subtitle, query.trim());
        text.append(sub);
      }
      el.append(text);
      if (multiple) el.append(h('span', { class: 'b24-dialog__check' }, html(icon('check'))));
      list.append(el);
    });
    search.setAttribute('aria-activedescendant', `${listId}-${active}`);
    list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  };

  const toggle = (item: DialogItem) => {
    if (item.disabled) return;
    if (multiple) {
      selected = isSelected(item) ? selected.filter((s) => itemKey(s) !== itemKey(item)) : [...selected, item];
      options.onChange?.(selected);
      renderList();
      renderFooter();
    } else {
      selected = [item];
      options.onChange?.(selected);
      handle.close();
    }
  };

  const reload = () => {
    if (!options.load) { renderList(); return; }
    abort?.abort();
    abort = new AbortController();
    const signal = abort.signal;
    loading = true;
    renderList();
    options.load(query.trim(), tab, signal).then((res) => {
      if (signal.aborted) return;
      items = withGroups(res);
      loading = false;
      renderList();
    }).catch((err) => {
      if (signal.aborted) return;
      loading = false;
      items = [];
      list.textContent = '';
      list.append(h('div', { class: 'b24-dialog__empty' }, `Ошибка загрузки: ${err?.message ?? err}`));
    });
  };

  list.addEventListener('mousedown', (e) => e.preventDefault()); // не терять фокус поиска
  list.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.b24-dialog__item');
    if (!el) return;
    active = Number(el.dataset.index);
    toggle(visible()[active]);
  });
  search.addEventListener('input', () => {
    query = search.value;
    active = 0;
    clearTimeout(timer);
    if (options.load) timer = setTimeout(reload, debounce);
    else renderList();
  });
  root.addEventListener('keydown', (e) => {
    const data = visible();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!data.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + data.length) % data.length;
      renderList();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (data[active]) toggle(data[active]);
    } else if (e.key === 'Tab' && !e.shiftKey && tabs.length > 1 && document.activeElement === search) {
      e.preventDefault();
      const i = tabs.findIndex((t) => t.id === tab);
      tab = tabs[(i + 1) % tabs.length].id;
      renderTabs();
      reload();
    }
  });

  const position = () => {
    const r = anchor.getBoundingClientRect();
    const ph = root.offsetHeight;
    let top = r.bottom + 6;
    if (top + ph > viewportHeight() && r.top - ph - 6 > 0) top = r.top - ph - 6;
    let left = placement === 'bottom-end' ? r.right - root.offsetWidth : r.left;
    left = Math.min(Math.max(8, left), innerWidth - root.offsetWidth - 8);
    root.style.top = `${top + scrollY}px`;
    root.style.left = `${left + scrollX}px`;
  };
  const onDocDown = (e: MouseEvent) => {
    const t = e.target as Node;
    if (!root.contains(t) && !anchor.contains(t)) handle.close();
  };

  const releaseLayer = pushLayer(() => { handle.close(); anchor.focus?.(); });
  const handle: EntityDialogHandle = {
    element: root,
    getSelected: () => [...selected],
    setSelected(next) { selected = [...next]; renderList(); renderFooter(); },
    refresh: reload,
    close() {
      if (closed) return;
      closed = true;
      abort?.abort();
      clearTimeout(timer);
      releaseLayer();
      document.removeEventListener('mousedown', onDocDown, true);
      removeEventListener('resize', position);
      removeEventListener('scroll', onScroll, true);
      root.remove();
      options.onClose?.(selected);
    },
  };
  const onScroll = (e: Event) => { if (!root.contains(e.target as Node)) position(); };

  renderTabs();
  renderFooter();
  document.body.append(root);
  bringToFront(root);
  reload();
  position();
  requestAnimationFrame(position);
  document.addEventListener('mousedown', onDocDown, true);
  addEventListener('resize', position);
  addEventListener('scroll', onScroll, true);
  if (searchable) search.focus({ preventScroll: true });
  else {
    list.tabIndex = 0;
    list.focus({ preventScroll: true });
  }
  return handle;
}

/**
 * Загрузчик сотрудников через REST портала (BX24.callMethod('user.search')).
 * Работает внутри приложения Битрикс24; вне портала вернёт пустой список.
 */
export function bx24UserLoader(extraFilter: Record<string, unknown> = {}): NonNullable<EntityDialogOptions['load']> {
  type BX = { callMethod: (m: string, p: unknown, cb: (r: { error(): unknown; data(): unknown }) => void) => void };
  return (query) => new Promise((resolve, reject) => {
    const BX24 = (window as unknown as { BX24?: BX }).BX24;
    if (!BX24?.callMethod) return resolve([]);
    const filter = { ACTIVE: true, ...extraFilter, ...(query ? { FIND: query } : {}) };
    BX24.callMethod('user.search', { FILTER: filter }, (res) => {
      if (res.error()) return reject(new Error(String(res.error())));
      const users = res.data() as Array<Record<string, string>>;
      resolve(users.map((u) => ({
        id: u.ID,
        entityId: 'user',
        title: [u.NAME, u.LAST_NAME].filter(Boolean).join(' ') || u.EMAIL,
        subtitle: u.WORK_POSITION || u.EMAIL,
        avatar: u.PERSONAL_PHOTO || undefined,
      })));
    });
  });
}

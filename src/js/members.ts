/**
 * Люди: список участников и выбор пользователя в модальном окне.
 *   createMemberList(host, { items, onSelect }) — участники чата/группы: аватар со статусом, имя, должность, отметка «вы»;
 *   pickUser({ users, multiple }) — модалка с поиском по имени и должности; резолвится выбранным (или null при отмене).
 *
 *   .b24-member-list (.b24-member-list--compact)
 *     .b24-member-list__title — «Участники · 5»
 *     .b24-member (.is-self, .is-selected, :disabled) > .b24-avatar + .b24-member__body (__name + __you, __caption) + __meta
 *   .b24-user-picker > .b24-user-picker__search (.b24-input-group) + .b24-member-list
 */
import { icon, type IconName } from '../icons';
import { avatarHtml } from './avatar';
import { h, html } from './dom';
import { t } from './i18n';
import { modal } from './modal';

/** Действие на строке участника: кнопка-иконка справа («Удалить из чата»). */
export interface MemberAction {
  id: string;
  label: string;
  icon?: IconName;
  danger?: boolean;
}
export interface Member {
  id: string;
  name: string;
  avatar?: string;
  /** подпись под именем: должность, «в сети», «был вчера» */
  caption?: string;
  /** точка у аватара */
  status?: 'online' | 'away';
  /** это вы: отметка «вы», пункт неактивен (по умолчанию) */
  self?: boolean;
  /** неактивен (уже в чате, нет доступа) */
  disabled?: boolean;
  /** справа: роль («Админ»), время, счётчик — текстом */
  meta?: string;
  /** кнопки-действия справа; клик — onAction(actionId, member), не onSelect */
  actions?: MemberAction[];
}

export interface MemberListOptions {
  items: Member[];
  /** клик по участнику; без onSelect строки — не кнопки, а просто список */
  onSelect?: (id: string, member: Member) => void;
  /** клик по кнопке-действию на строке (Member.actions) */
  onAction?: (actionId: string, member: Member) => void;
  /** заголовок над списком: «Участники» — к нему добавляется число */
  title?: string;
  emptyText?: string;
  /** мельче: аватар 32px, без отступов карточки — для узкой колонки и окна чата */
  compact?: boolean;
  /** выбранные (галочка справа) — для множественного выбора */
  selected?: string[];
  /** «вы» можно выбрать (по умолчанию нет) */
  selfSelectable?: boolean;
  label?: string;
}

export interface MemberListHandle {
  element: HTMLElement;
  setItems(items: Member[]): void;
  update(id: string, patch: Partial<Member>): void;
  setSelected(ids: string[]): void;
  /** отрисованные (после фильтра) строки — для клавиатуры снаружи */
  rows(): HTMLElement[];
  destroy(): void;
}

const norm = (s: string) => s.toLocaleLowerCase().replace(/ё/g, 'е');

/** Поиск по имени и подписи: каждое слово запроса — начало слова в имени или подписи. */
export function matchMember(m: Member, query: string): boolean {
  const q = norm(query).trim();
  if (!q) return true;
  const words = norm(`${m.name} ${m.caption ?? ''}`).split(/[\s.,()«»"-]+/).filter(Boolean);
  return q.split(/\s+/).every((part) => words.some((w) => w.startsWith(part)));
}

export function createMemberList(host: HTMLElement, options: MemberListOptions): MemberListHandle {
  let items = options.items;
  let selected = new Set(options.selected ?? []);
  const interactive = !!options.onSelect;
  const root = h('div', { class: `b24-member-list${options.compact ? ' b24-member-list--compact' : ''}` });
  const title = options.title ? h('div', { class: 'b24-member-list__title' }) : null;
  const list = h('div', {
    class: 'b24-member-list__items',
    role: interactive ? 'listbox' : 'list',
    'aria-label': options.label ?? options.title ?? t('Участники'),
    'aria-multiselectable': options.selected ? 'true' : undefined,
  });
  if (title) root.append(title);
  root.append(list);
  host.append(root);
  const rowMap = new Map<string, HTMLElement>();

  const isDisabled = (m: Member) => !!m.disabled || (!!m.self && !options.selfSelectable);

  const fill = (row: HTMLElement, m: Member) => {
    const sel = selected.has(m.id);
    row.className = `b24-member${m.self ? ' is-self' : ''}${sel ? ' is-selected' : ''}${isDisabled(m) ? ' is-disabled' : ''}`;
    if (row instanceof HTMLButtonElement) row.disabled = isDisabled(m);
    if (interactive) row.setAttribute('aria-selected', String(sel));
    const av = html(avatarHtml(m.name, m.avatar, options.compact ? 'md' : 'lg', { status: m.status })).firstElementChild!;
    const name = h('span', { class: 'b24-member__name' }, h('span', { class: 'b24-member__name-text' }, m.name), m.self ? h('span', { class: 'b24-member__you' }, t('вы')) : '');
    const body = h('span', { class: 'b24-member__body' }, name, m.caption ? h('span', { class: 'b24-member__caption' }, m.caption) : '');
    const tail: Node[] = [];
    if (m.meta) tail.push(h('span', { class: 'b24-member__meta' }, m.meta));
    if (options.selected) tail.push(h('span', { class: 'b24-member__check', 'aria-hidden': 'true' }, html(icon('check'))));
    row.replaceChildren(av, body, ...tail);
    const status = m.status === 'online' ? `, ${t('в сети')}` : '';
    row.setAttribute('aria-label', `${m.name}${m.self ? ` (${t('вы')})` : ''}${status}${m.caption ? `. ${m.caption}` : ''}`);
  };

  const actionButtons = (m: Member) => {
    const box = h('span', { class: 'b24-member__actions' });
    for (const a of m.actions ?? []) {
      const b = h('button', { type: 'button', class: `b24-member__action${a.danger ? ' is-danger' : ''}`, 'aria-label': `${a.label}: ${m.name}`, title: a.label }, a.icon ? html(icon(a.icon, { size: 16 })) : a.label);
      b.addEventListener('click', (e) => { e.stopPropagation(); options.onAction?.(a.id, m); });
      box.append(b);
    }
    return box;
  };

  const render = () => {
    rowMap.clear();
    if (title) title.replaceChildren(options.title!, items.length ? h('span', { class: 'b24-member-list__count' }, String(items.length)) : '');
    if (!items.length) {
      list.replaceChildren(h('div', { class: 'b24-member-list__empty' }, options.emptyText ?? t('Никого нет')));
      return;
    }
    list.replaceChildren(...items.map((m) => {
      const row = interactive
        ? h('button', { type: 'button', role: 'option', 'data-id': m.id, tabindex: '-1' })
        : h('div', { role: 'listitem', 'data-id': m.id });
      fill(row, m);
      rowMap.set(m.id, row);
      const acts = m.actions?.length ? actionButtons(m) : null;
      if (!acts) return row;
      // кнопка внутри кнопки недопустима: у кликабельной строки действия — соседи в обёртке
      if (!interactive) { row.append(acts); return row; }
      return h('div', { class: 'b24-member-item', role: 'presentation' }, row, acts);
    }));
    const first = [...rowMap.values()].find((r) => !(r as HTMLButtonElement).disabled);
    if (interactive && first) first.tabIndex = 0;
  };

  if (interactive) {
    list.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLButtonElement>('.b24-member');
      if (!row || row.disabled) return;
      const m = items.find((x) => x.id === row.dataset.id);
      if (m) options.onSelect!(m.id, m);
    });
    list.addEventListener('keydown', (e) => {
      const rows = handle.rows();
      const i = rows.indexOf(document.activeElement as HTMLElement);
      if (i < 0) return;
      let next = -1;
      if (e.key === 'ArrowDown') next = Math.min(rows.length - 1, i + 1);
      else if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = rows.length - 1;
      if (next < 0) return;
      e.preventDefault();
      rows.forEach((r) => { r.tabIndex = -1; });
      rows[next].tabIndex = 0;
      rows[next].focus();
    });
  }

  render();
  const handle: MemberListHandle = {
    element: root,
    setItems(next) { items = next; render(); },
    update(id, patch) {
      const i = items.findIndex((x) => x.id === id);
      if (i < 0) return;
      items = items.map((x, j) => (j === i ? { ...x, ...patch } : x));
      if ('actions' in patch) { render(); return; }
      const row = rowMap.get(id);
      if (row) fill(row, items[i]);
    },
    setSelected(ids) {
      selected = new Set(ids);
      items.forEach((m) => { const row = rowMap.get(m.id); if (row) fill(row, m); });
    },
    rows: () => [...rowMap.values()].filter((r) => !(r as HTMLButtonElement).disabled),
    destroy() { root.remove(); },
  };
  return handle;
}

/* ── Выбор пользователя ──────────────────────────────────── */

export interface PickUserOptions {
  /** список людей; для поиска по серверу — load */
  users?: Member[];
  /** загрузка по запросу (вызывается при открытии и при вводе, с задержкой 250 мс) */
  load?: (query: string, signal: AbortSignal) => Promise<Member[]>;
  title?: string;
  placeholder?: string;
  emptyText?: string;
  /** несколько человек: галочки и кнопка «Выбрать (N)» */
  multiple?: boolean;
  /** уже выбранные (для multiple) */
  selected?: string[];
  /** скрыть этих людей (уже в чате) — или передайте им disabled */
  exclude?: string[];
  /** текст основной кнопки для multiple (по умолчанию «Выбрать») */
  okText?: string;
}

/**
 * Модалка выбора пользователя. Один — клик по человеку сразу закрывает окно и резолвит Member;
 * multiple — резолвит Member[] по кнопке «Выбрать». Отмена / Esc — null.
 */
export function pickUser(options: PickUserOptions & { multiple: true }): Promise<Member[] | null>;
export function pickUser(options: PickUserOptions & { multiple?: false }): Promise<Member | null>;
export function pickUser(options: PickUserOptions): Promise<Member | Member[] | null>;
export function pickUser(options: PickUserOptions): Promise<Member | Member[] | null> {
  const exclude = new Set(options.exclude ?? []);
  let all: Member[] = (options.users ?? []).filter((u) => !exclude.has(u.id));
  const known = new Map(all.map((u) => [u.id, u]));
  const chosen = new Set(options.selected ?? []);
  let query = '';
  let result: Member | Member[] | null = null;

  const input = h('input', { type: 'search', class: 'b24-input', placeholder: options.placeholder ?? t('Поиск по имени или должности'), 'aria-label': t('Поиск'), autocomplete: 'off' }) as HTMLInputElement;
  const search = h('div', { class: 'b24-input-group b24-user-picker__search' }, h('span', { class: 'b24-input-group__icon' }, html(icon('search'))), input);
  const box = h('div', { class: 'b24-user-picker' }, search);

  const okText = () => (chosen.size ? `${options.okText ?? t('Выбрать')} (${chosen.size})` : options.okText ?? t('Выбрать'));
  const m = modal({
    title: options.title ?? (options.multiple ? t('Выберите сотрудников') : t('Выберите сотрудника')),
    content: box,
    size: 'sm',
    autoInit: false,
    buttons: options.multiple
      ? [
          { text: okText(), variant: 'primary', onClick: () => { result = [...chosen].map((id) => known.get(id)).filter((x): x is Member => !!x); } },
          { text: t('Отмена'), variant: 'secondary' },
        ]
      : [],
    onClose: () => { abort?.abort(); },
  });
  const okBtn = m.element.querySelector<HTMLButtonElement>('.b24-modal__footer .b24-btn--primary');
  const syncOk = () => { if (okBtn) { okBtn.textContent = okText(); okBtn.disabled = !chosen.size; } };
  syncOk();

  const list = createMemberList(box, {
    items: [],
    compact: true,
    selected: options.multiple ? [...chosen] : undefined,
    emptyText: options.emptyText ?? t('Никого не нашлось'),
    label: t('Сотрудники'),
    onSelect: (id, member) => {
      if (!options.multiple) { result = member; void m.close(); return; }
      if (chosen.has(id)) chosen.delete(id); else chosen.add(id);
      list.setSelected([...chosen]);
      syncOk();
    },
  });
  list.element.classList.add('b24-user-picker__list');

  const show = () => list.setItems(all.filter((u) => matchMember(u, query)));
  let abort: AbortController | null = null;
  let timer = 0;
  const load = async () => {
    if (!options.load) return show();
    abort?.abort();
    abort = new AbortController();
    const signal = abort.signal;
    box.classList.add('is-loading');
    try {
      const got = await options.load(query, signal);
      if (signal.aborted) return;
      all = got.filter((u) => !exclude.has(u.id));
      all.forEach((u) => known.set(u.id, u));
      list.setItems(all);
    } catch { /* отменено или ошибка сети — оставляем прежний список */ } finally {
      if (!signal.aborted) box.classList.remove('is-loading');
    }
  };

  input.addEventListener('input', () => {
    query = input.value;
    if (!options.load) return show();
    clearTimeout(timer);
    timer = window.setTimeout(() => void load(), 250);
  });
  input.addEventListener('keydown', (e) => {
    const rows = list.rows();
    if (e.key === 'ArrowDown' && rows.length) { e.preventDefault(); rows.forEach((r) => { r.tabIndex = -1; }); rows[0].tabIndex = 0; rows[0].focus(); }
    if (e.key === 'Enter' && rows.length) { e.preventDefault(); rows[0].click(); }
  });

  void load();
  requestAnimationFrame(() => input.focus());
  return m.result.then(() => result);
}

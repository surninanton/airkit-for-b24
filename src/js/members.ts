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
  /** метка роли справа от имени («Создатель», «Админ») — плашкой, левее meta */
  role?: string;
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
  /** кнопка-строка «+ Добавить участников» над списком */
  onAdd?: () => void;
  addLabel?: string;
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
  if (options.onAdd) {
    const add = h('button', { type: 'button', class: 'b24-member-list__add' }, h('span', { class: 'b24-member-list__add-icon', 'aria-hidden': 'true' }, html(icon('plus', { size: 16 }))), options.addLabel ?? t('Добавить участников'));
    add.addEventListener('click', () => options.onAdd!());
    root.append(add);
  }
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
    if (m.role) tail.push(h('span', { class: 'b24-member__role' }, m.role));
    if (m.meta) tail.push(h('span', { class: 'b24-member__meta' }, m.meta));
    if (options.selected) tail.push(h('span', { class: 'b24-member__check', 'aria-hidden': 'true' }, html(icon('check'))));
    row.replaceChildren(av, body, ...tail);
    const status = m.status === 'online' ? `, ${t('в сети')}` : '';
    row.setAttribute('aria-label', `${m.name}${m.self ? ` (${t('вы')})` : ''}${m.role ? `, ${m.role}` : ''}${status}${m.caption ? `. ${m.caption}` : ''}`);
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

/** Группа людей для выбора «целиком»: должности, отделы. */
export interface PickGroupItem {
  id: string;
  name: string;
  caption?: string;
  /** id сотрудников группы */
  members: string[];
}
export interface PickGroup {
  id: string;
  /** название вкладки: «Должности», «Отделы» */
  label: string;
  items: PickGroupItem[];
}
export interface PickTitleField {
  label?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
}

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
  /** вкладки групп (должности, отделы): отметка группы выбирает всех её участников; только с multiple */
  groups?: PickGroup[];
  /** поле «Название чата» сверху; результат — { title, users } */
  titleField?: PickTitleField;
  /** счётчик «Выбрано: N» и чипы выбранных внизу (по умолчанию — если есть groups или titleField) */
  chips?: boolean;
}
export interface PickMembersResult { title: string; users: Member[] }

/**
 * Модалка выбора пользователя. Один — клик по человеку сразу закрывает окно и резолвит Member;
 * multiple — резолвит Member[] по кнопке «Выбрать»; с titleField — { title, users }. Отмена / Esc — null.
 */
export function pickUser(options: PickUserOptions & { multiple: true; titleField: PickTitleField }): Promise<PickMembersResult | null>;
export function pickUser(options: PickUserOptions & { multiple: true }): Promise<Member[] | null>;
export function pickUser(options: PickUserOptions & { multiple?: false }): Promise<Member | null>;
export function pickUser(options: PickUserOptions): Promise<Member | Member[] | PickMembersResult | null>;
export function pickUser(options: PickUserOptions): Promise<Member | Member[] | PickMembersResult | null> {
  const exclude = new Set(options.exclude ?? []);
  let all: Member[] = (options.users ?? []).filter((u) => !exclude.has(u.id));
  const known = new Map(all.map((u) => [u.id, u]));
  const multiple = !!options.multiple;
  const groups = multiple ? options.groups ?? [] : [];
  const tf = multiple ? options.titleField : undefined;
  const chipsOn = multiple && (options.chips ?? (groups.length > 0 || !!tf));
  /* Выбор = (вручную ∪ участники отмеченных групп) \ снятые. Снятие группы убирает только тех, кто пришёл из неё. */
  const manual = new Set(options.selected ?? []);
  const groupOn = new Set<string>();
  const removed = new Set<string>();
  let query = '';
  let tab = 'people';
  let result: Member | Member[] | PickMembersResult | null = null;

  const gKey = (g: PickGroup, it: PickGroupItem) => `${g.id}:${it.id}`;
  const gItems = new Map<string, PickGroupItem>();
  groups.forEach((g) => g.items.forEach((it) => gItems.set(gKey(g, it), it)));
  /** кого группа реально может добавить: известные, не отключённые, не «вы» */
  const pickable = (id: string) => { const u = known.get(id); return !!u && !u.disabled && !u.self && !exclude.has(id); };
  const chosenIds = (): string[] => {
    const set = new Set<string>(manual);
    for (const k of groupOn) gItems.get(k)?.members.forEach((id) => { if (pickable(id)) set.add(id); });
    removed.forEach((id) => set.delete(id));
    return [...set].filter((id) => known.has(id));
  };
  const has = (id: string) => chosenIds().includes(id);

  const input = h('input', { type: 'search', class: 'b24-input', placeholder: options.placeholder ?? t('Поиск по имени или должности'), 'aria-label': t('Поиск'), autocomplete: 'off' }) as HTMLInputElement;
  const search = h('div', { class: 'b24-input-group b24-user-picker__search' }, h('span', { class: 'b24-input-group__icon' }, html(icon('search'))), input);
  const box = h('div', { class: 'b24-user-picker' });
  let titleInput: HTMLInputElement | null = null;
  if (tf) {
    titleInput = h('input', { type: 'text', class: 'b24-input', placeholder: tf.placeholder ?? '', value: tf.value ?? '', autocomplete: 'off', maxlength: '120', 'aria-required': tf.required ? 'true' : undefined }) as HTMLInputElement;
    titleInput.value = tf.value ?? '';
    box.append(h('label', { class: 'b24-field b24-user-picker__title' }, h('span', { class: 'b24-field__label' }, tf.label ?? t('Название чата')), titleInput));
  }
  const tabsBox = groups.length
    ? h('div', { class: 'b24-segmented b24-user-picker__tabs', role: 'radiogroup', 'aria-label': t('Что выбирать') })
    : null;
  if (tabsBox) {
    const tabName = `b24pk-${Math.random().toString(36).slice(2, 7)}`;
    [{ id: 'people', label: t('Сотрудники') }, ...groups.map((g) => ({ id: g.id, label: g.label }))].forEach((x) => {
      const r = h('input', { type: 'radio', name: tabName, value: x.id }) as HTMLInputElement;
      r.checked = x.id === tab;
      r.addEventListener('change', () => { if (r.checked) { tab = x.id; showTab(); } });
      tabsBox.append(h('label', {}, r, h('span', {}, x.label)));
    });
    box.append(tabsBox);
  }
  box.append(search);

  const okText = () => (chipsOn || !chosenIds().length ? options.okText ?? t('Выбрать') : `${options.okText ?? t('Выбрать')} (${chosenIds().length})`);
  const m = modal({
    title: options.title ?? (multiple ? t('Выберите сотрудников') : t('Выберите сотрудника')),
    content: box,
    size: 'sm',
    autoInit: false,
    buttons: multiple
      ? [
          {
            text: okText(), variant: 'primary',
            onClick: () => {
              const users = chosenIds().map((id) => known.get(id)).filter((x): x is Member => !!x);
              result = tf ? { title: (titleInput?.value ?? '').trim(), users } : users;
            },
          },
          { text: t('Отмена'), variant: 'secondary' },
        ]
      : [],
    onClose: () => { abort?.abort(); },
  });
  const okBtn = m.element.querySelector<HTMLButtonElement>('.b24-modal__footer .b24-btn--primary');

  const list = createMemberList(box, {
    items: [],
    compact: true,
    selected: multiple ? chosenIds() : undefined,
    emptyText: options.emptyText ?? t('Никого не нашлось'),
    label: t('Сотрудники'),
    onSelect: (id, member) => {
      if (!multiple) { result = member; void m.close(); return; }
      if (has(id)) { manual.delete(id); removed.add(id); } else { manual.add(id); removed.delete(id); }
      sync();
    },
  });
  list.element.classList.add('b24-user-picker__list');

  /* вкладка группы: строки с чекбоксом */
  const groupList = h('div', { class: 'b24-user-picker__groups b24-member-list__items', role: 'group' });
  if (groups.length) { groupList.hidden = true; box.append(groupList); }
  const state = (g: PickGroup, it: PickGroupItem): 'all' | 'some' | 'none' => {
    const ids = it.members.filter(pickable);
    if (!ids.length) return 'none';
    const cur = new Set(chosenIds());
    const n = ids.filter((id) => cur.has(id)).length;
    return n === 0 ? 'none' : n === ids.length ? 'all' : 'some';
  };
  const toggleGroup = (g: PickGroup, it: PickGroupItem) => {
    const k = gKey(g, it);
    const st = state(g, it);
    if (st === 'all') {
      if (groupOn.has(k)) groupOn.delete(k);
      else it.members.forEach((id) => { manual.delete(id); });
      // если все ещё выбраны другим путём — снимаем и его, иначе клик ничего не меняет
      if (state(g, it) === 'all') it.members.forEach((id) => { manual.delete(id); [...groupOn].forEach((gk) => { if (gItems.get(gk)?.members.includes(id)) removed.add(id); }); });
    } else {
      groupOn.add(k);
      it.members.forEach((id) => removed.delete(id));
    }
    sync();
  };
  const renderGroups = () => {
    const g = groups.find((x) => x.id === tab);
    groupList.replaceChildren();
    if (!g) return;
    const rows = g.items.filter((it) => matchMember({ id: it.id, name: it.name, caption: it.caption }, query));
    if (!rows.length) { groupList.append(h('div', { class: 'b24-member-list__empty' }, options.emptyText ?? t('Ничего не нашлось'))); return; }
    for (const it of rows) {
      const st = state(g, it);
      const n = it.members.length;
      const row = h('button', { type: 'button', role: 'checkbox', class: `b24-member b24-user-picker__group${st === 'all' ? ' is-selected' : ''}${st === 'some' ? ' is-mixed' : ''}`, 'aria-checked': st === 'all' ? 'true' : st === 'some' ? 'mixed' : 'false', 'data-id': it.id },
        h('span', { class: 'b24-member__check', 'aria-hidden': 'true' }, html(icon(st === 'some' ? 'minus' : 'check'))),
        h('span', { class: 'b24-member__body' }, h('span', { class: 'b24-member__name' }, h('span', { class: 'b24-member__name-text' }, it.name)), h('span', { class: 'b24-member__caption' }, `${it.caption ? `${it.caption} · ` : ''}${n} ${t('чел.')}`)));
      row.addEventListener('click', () => toggleGroup(g, it));
      groupList.append(row);
    }
  };

  /* внизу: «Выбрано: N» и чипы */
  const count = h('div', { class: 'b24-user-picker__count' });
  const chipsBox = h('div', { class: 'b24-user-picker__chips', role: 'list', 'aria-label': t('Выбранные') });
  const foot = h('div', { class: 'b24-user-picker__foot' }, count, chipsBox);
  if (chipsOn) box.append(foot);
  const renderChips = () => {
    const ids = chosenIds();
    count.textContent = `${t('Выбрано')}: ${ids.length}`;
    chipsBox.replaceChildren(...ids.map((id) => {
      const u = known.get(id)!;
      const x = h('button', { type: 'button', class: 'b24-user-picker__chip-x', 'aria-label': `${t('Убрать')}: ${u.name}` }, html(icon('close', { size: 12 })));
      x.addEventListener('click', () => { manual.delete(id); removed.add(id); sync(); });
      return h('span', { class: 'b24-user-picker__chip', role: 'listitem', title: u.name }, h('span', { class: 'b24-user-picker__chip-name' }, u.name), x);
    }));
    chipsBox.hidden = !ids.length;
  };

  const syncOk = () => {
    if (!okBtn) return;
    okBtn.textContent = okText();
    okBtn.disabled = !chosenIds().length || !!(tf?.required && !titleInput?.value.trim());
  };
  function sync() {
    if (!multiple) return;
    list.setSelected(chosenIds());
    if (groups.length) renderGroups();
    if (chipsOn) renderChips();
    syncOk();
  }
  function showTab() {
    const people = tab === 'people';
    list.element.hidden = !people;
    groupList.hidden = people;
    search.querySelector('input')!.placeholder = people ? options.placeholder ?? t('Поиск по имени или должности') : t('Поиск');
    if (!people) renderGroups();
  }
  titleInput?.addEventListener('input', syncOk);
  if (multiple) sync();

  const show = () => { if (tab === 'people') list.setItems(all.filter((u) => matchMember(u, query))); else renderGroups(); };
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
      sync();
    } catch { /* отменено или ошибка сети — оставляем прежний список */ } finally {
      if (!signal.aborted) box.classList.remove('is-loading');
    }
  };

  input.addEventListener('input', () => {
    query = input.value;
    if (!options.load || tab !== 'people') return show();
    clearTimeout(timer);
    timer = window.setTimeout(() => void load(), 250);
  });
  input.addEventListener('keydown', (e) => {
    if (tab !== 'people') return;
    const rows = list.rows();
    if (e.key === 'ArrowDown' && rows.length) { e.preventDefault(); rows.forEach((r) => { r.tabIndex = -1; }); rows[0].tabIndex = 0; rows[0].focus(); }
    if (e.key === 'Enter' && rows.length) { e.preventDefault(); rows[0].click(); }
  });

  void load();
  requestAnimationFrame(() => (titleInput && !titleInput.value ? titleInput : input).focus());
  return m.result.then(() => result);
}

/** Выбор участников группового чата: то же, что pickUser с multiple. */
export const pickMembers = (options: Omit<PickUserOptions, 'multiple'>) => pickUser({ ...options, multiple: true });

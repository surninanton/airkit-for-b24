import { icon, type IconName } from '../icons';
import { bringToFront, h, html, pushLayer } from './dom';

/* ── Группа чекбоксов ──────────────────────────────────────
 * .b24-check-group[data-b24-check-group]: счётчик .b24-check-group__count («Выбрано 2 из 7»),
 * ссылки [data-b24-check-group-all] и [data-b24-check-group-none].
 */
export function initCheckGroup(root: HTMLElement): () => void {
  const boxes = () => Array.from(root.querySelectorAll<HTMLInputElement>('.b24-check-group__list input[type="checkbox"]:not(:disabled)'));
  const count = root.querySelector<HTMLElement>('.b24-check-group__count');
  const sync = () => {
    const all = boxes();
    if (count) count.textContent = `Выбрано ${all.filter((b) => b.checked).length} из ${all.length}`;
  };
  const set = (on: boolean) => {
    for (const b of boxes()) if (b.checked !== on) { b.checked = on; b.dispatchEvent(new Event('change', { bubbles: true })); }
    sync();
  };
  const onClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-b24-check-group-all]')) { e.preventDefault(); set(true); }
    else if (t.closest('[data-b24-check-group-none]')) { e.preventDefault(); set(false); }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('change', sync);
  sync();
  return () => { root.removeEventListener('click', onClick); root.removeEventListener('change', sync); };
}

/* ── Ползунок ──────────────────────────────────────────────
 * input.b24-range: закраска дорожки до ручки; значение — в .b24-range-field__value рядом (data-suffix — единица).
 * .b24-range-pair: две ручки не пересекаются, отрезок между ними закрашен.
 */
export function initRange(el: HTMLElement): () => void {
  if (el.classList.contains('b24-range-pair')) {
    const [a, b] = Array.from(el.querySelectorAll<HTMLInputElement>('input[type="range"]'));
    if (!a || !b) return () => {};
    const out = el.parentElement?.querySelector<HTMLElement>('.b24-range-field__value');
    const pct = (i: HTMLInputElement) => ((Number(i.value) - Number(i.min || 0)) / ((Number(i.max || 100) - Number(i.min || 0)) || 1)) * 100;
    const sync = (e?: Event) => {
      if (Number(a.value) > Number(b.value)) { if (e?.target === a) a.value = b.value; else b.value = a.value; }
      el.style.setProperty('--_a', `${pct(a)}%`);
      el.style.setProperty('--_b', `${pct(b)}%`);
      if (out) out.textContent = `${a.value}–${b.value}${el.dataset.suffix ?? ''}`;
    };
    el.addEventListener('input', sync);
    sync();
    return () => el.removeEventListener('input', sync);
  }
  const input = el as HTMLInputElement;
  const out = input.parentElement?.querySelector<HTMLElement>('.b24-range-field__value');
  const sync = () => {
    const p = ((Number(input.value) - Number(input.min || 0)) / ((Number(input.max || 100) - Number(input.min || 0)) || 1)) * 100;
    input.style.setProperty('--_p', `${p}%`);
    if (out) out.textContent = `${input.value}${input.dataset.suffix ?? ''}`;
  };
  input.addEventListener('input', sync);
  sync();
  return () => input.removeEventListener('input', sync);
}

/* ── Выбор цвета ───────────────────────────────────────────
 * .b24-colors[data-b24-colors]: свой цвет из .b24-colors__custom > input[type=color] становится
 * отмеченным значением группы (скрытая радиокнопка с тем же name).
 */
export function initColors(root: HTMLElement): () => void {
  const custom = root.querySelector<HTMLElement>('.b24-colors__custom');
  const picker = custom?.querySelector<HTMLInputElement>('input[type="color"]');
  const name = root.querySelector<HTMLInputElement>('.b24-colors__swatch input[type="radio"]')?.name;
  if (!custom || !picker || !name) return () => {};
  let radio = custom.querySelector<HTMLInputElement>('input[type="radio"]');
  if (!radio) {
    radio = h('input', { type: 'radio', name, hidden: '', tabindex: '-1' }) as HTMLInputElement;
    custom.append(radio);
  }
  picker.setAttribute('aria-label', picker.getAttribute('aria-label') ?? 'Свой цвет');
  const onPick = () => {
    radio!.value = picker.value;
    radio!.checked = true;
    custom.style.setProperty('--c', picker.value);
    custom.classList.add('is-active');
    radio!.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const onChange = (e: Event) => { if (e.target !== radio && (e.target as HTMLInputElement).name === name) custom.classList.remove('is-active'); };
  picker.addEventListener('input', onPick);
  root.addEventListener('change', onChange);
  return () => { picker.removeEventListener('input', onPick); root.removeEventListener('change', onChange); };
}

/* ── Поле секрета ──────────────────────────────────────────
 * .b24-secret[data-b24-secret] > input.b24-input. Кнопка-«глаз» показывает введённое.
 * data-saved — значение уже сохранено на сервере: поле пустое, в подсказке маска и «введите новый, чтобы заменить».
 */
export function initSecret(root: HTMLElement): () => void {
  const input = root.querySelector<HTMLInputElement>('input');
  if (!input) return () => {};
  input.type = 'password';
  input.autocomplete = input.autocomplete || 'new-password';
  if (root.dataset.saved !== undefined && root.dataset.saved !== 'false') {
    root.classList.add('is-saved');
    input.placeholder = root.dataset.mask ?? '••••••••••••';
    input.title = 'Значение сохранено. Введите новое, чтобы заменить';
    const hint = root.parentElement?.querySelector<HTMLElement>('.b24-field__hint');
    if (hint && !hint.textContent?.trim()) hint.textContent = 'Сохранено. Введите новое значение, чтобы заменить';
  }
  const btn = h('button', { type: 'button', class: 'b24-secret__toggle', 'aria-pressed': 'false', 'aria-label': 'Показать значение' }, html(icon('eye'))) as HTMLButtonElement;
  btn.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(show));
    btn.setAttribute('aria-label', show ? 'Скрыть значение' : 'Показать значение');
    input.focus();
  });
  root.append(btn);
  return () => btn.remove();
}

/* ── Дерево ────────────────────────────────────────────────
 * Разделы, папки, структура компании. Клавиатура как в ARIA tree: ↑/↓, ← свернуть / к родителю,
 * → развернуть / к первому ребёнку, Home/End, Enter/пробел — выбрать.
 */
export interface TreeItem {
  id: string;
  label: string;
  children?: TreeItem[];
  icon?: IconName;
  /** число справа: элементов в разделе */
  count?: number;
  disabled?: boolean;
}
export interface TreeOptions {
  items: TreeItem[];
  /** выбор: один, несколько (с флажками) или без выбора */
  select?: 'single' | 'multiple' | false;
  selected?: string[];
  expanded?: string[];
  ariaLabel?: string;
  onSelect?: (ids: string[], item: TreeItem) => void;
  onToggle?: (id: string, expanded: boolean) => void;
}
export interface TreeHandle {
  element: HTMLElement;
  getSelected(): string[];
  setSelected(ids: string[]): void;
  expand(id: string, open?: boolean): void;
  setItems(items: TreeItem[]): void;
  destroy(): void;
}

export function createTree(host: HTMLElement, options: TreeOptions): TreeHandle {
  const o = options;
  const mode = o.select ?? 'single';
  let items = o.items;
  const selected = new Set(o.selected ?? []);
  const expanded = new Set(o.expanded ?? []);
  const byId = new Map<string, TreeItem>();
  const root = h('ul', { class: 'b24-tree', role: 'tree', 'aria-label': o.ariaLabel, 'aria-multiselectable': mode === 'multiple' ? 'true' : undefined });
  host.append(root);
  let focusId: string | null = null;

  const renderNode = (item: TreeItem, level: number): HTMLElement => {
    byId.set(item.id, item);
    const hasKids = !!item.children?.length;
    const li = h('li', {
      role: 'treeitem', 'data-id': item.id, 'aria-level': String(level),
      'aria-expanded': hasKids ? String(expanded.has(item.id)) : undefined,
      'aria-selected': mode ? String(selected.has(item.id)) : undefined,
      'aria-disabled': item.disabled ? 'true' : undefined,
    });
    const node = h('div', { class: 'b24-tree__node', tabindex: '-1' });
    node.append(h('span', { class: `b24-tree__toggle${hasKids ? '' : ' is-leaf'}`, 'aria-hidden': 'true' }));
    if (mode === 'multiple') {
      const cb = h('label', { class: 'b24-check', 'aria-hidden': 'true' }, h('input', { type: 'checkbox', tabindex: '-1' }));
      (cb.firstChild as HTMLInputElement).checked = selected.has(item.id);
      node.append(cb);
    }
    if (item.icon) node.append(h('span', { class: 'b24-tree__icon' }, html(icon(item.icon))));
    node.append(h('span', { class: 'b24-tree__label' }, item.label));
    if (item.count != null) node.append(h('span', { class: 'b24-tree__count' }, String(item.count)));
    li.append(node);
    if (hasKids) {
      const ul = h('ul', { role: 'group' });
      item.children!.forEach((c) => ul.append(renderNode(c, level + 1)));
      li.append(ul);
    }
    return li;
  };
  const render = () => {
    byId.clear();
    root.textContent = '';
    items.forEach((i) => root.append(renderNode(i, 1)));
    const first = focusId && root.querySelector(`[data-id="${CSS.escape(focusId)}"]`) ? focusId : visibleIds()[0];
    setFocusable(first ?? null, false);
  };
  /** видимые узлы по порядку (свёрнутые ветки пропускаются) */
  const visibleIds = (): string[] => Array.from(root.querySelectorAll<HTMLElement>('[role="treeitem"]'))
    .filter((li) => !li.parentElement?.closest('[aria-expanded="false"]'))
    .map((li) => li.dataset.id!);
  const liOf = (id: string) => root.querySelector<HTMLElement>(`[role="treeitem"][data-id="${CSS.escape(id)}"]`);
  const setFocusable = (id: string | null, focus = true) => {
    root.querySelectorAll<HTMLElement>('.b24-tree__node').forEach((n) => { n.tabIndex = -1; });
    focusId = id;
    if (!id) return;
    const node = liOf(id)?.querySelector<HTMLElement>(':scope > .b24-tree__node');
    if (node) { node.tabIndex = 0; if (focus) node.focus(); }
  };
  const toggle = (id: string, open?: boolean) => {
    const li = liOf(id);
    if (!li || !li.hasAttribute('aria-expanded')) return;
    const next = open ?? li.getAttribute('aria-expanded') !== 'true';
    li.setAttribute('aria-expanded', String(next));
    if (next) expanded.add(id); else expanded.delete(id);
    o.onToggle?.(id, next);
  };
  const choose = (id: string) => {
    const item = byId.get(id);
    if (!mode || !item || item.disabled) return;
    if (mode === 'single') { selected.clear(); selected.add(id); }
    else if (selected.has(id)) selected.delete(id); else selected.add(id);
    root.querySelectorAll<HTMLElement>('[role="treeitem"]').forEach((li) => {
      const on = selected.has(li.dataset.id!);
      li.setAttribute('aria-selected', String(on));
      const cb = li.querySelector<HTMLInputElement>(':scope > .b24-tree__node input');
      if (cb) cb.checked = on;
    });
    o.onSelect?.([...selected], item);
  };
  const onClick = (e: MouseEvent) => {
    const node = (e.target as HTMLElement).closest<HTMLElement>('.b24-tree__node');
    if (!node) return;
    const id = node.parentElement!.dataset.id!;
    setFocusable(id);
    if ((e.target as HTMLElement).closest('.b24-tree__toggle') || !mode) toggle(id);
    else choose(id);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!focusId) return;
    const ids = visibleIds();
    const i = ids.indexOf(focusId);
    const li = liOf(focusId)!;
    const exp = li.getAttribute('aria-expanded');
    let handled = true;
    if (e.key === 'ArrowDown') setFocusable(ids[Math.min(ids.length - 1, i + 1)]);
    else if (e.key === 'ArrowUp') setFocusable(ids[Math.max(0, i - 1)]);
    else if (e.key === 'Home') setFocusable(ids[0]);
    else if (e.key === 'End') setFocusable(ids[ids.length - 1]);
    else if (e.key === 'ArrowRight') { if (exp === 'false') toggle(focusId, true); else if (exp === 'true') setFocusable(ids[i + 1]); }
    else if (e.key === 'ArrowLeft') {
      if (exp === 'true') toggle(focusId, false);
      else { const parent = li.parentElement?.closest<HTMLElement>('[role="treeitem"]'); if (parent) setFocusable(parent.dataset.id!); }
    } else if (e.key === 'Enter' || e.key === ' ') { if (mode) choose(focusId); else toggle(focusId); }
    else handled = false;
    if (handled) e.preventDefault();
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  render();
  return {
    element: root,
    getSelected: () => [...selected],
    setSelected(ids) { selected.clear(); ids.forEach((i) => selected.add(i)); render(); },
    expand(id, open = true) { toggle(id, open); },
    setItems(next) { items = next; render(); },
    destroy() { root.remove(); },
  };
}

/* ── Всплывающая подсказка с текстом и кнопками ──────────── */
export interface PopoverAction { label: string; variant?: 'primary' | 'secondary' | 'plain' | 'link'; onClick?: () => void | boolean; }
export interface PopoverOptions {
  title?: string;
  text?: string;
  /** кнопки; onClick вернул false — подсказка не закрывается */
  actions?: PopoverAction[];
  placement?: 'bottom' | 'top' | 'right' | 'left';
  dark?: boolean;
  closable?: boolean;
  /** подпись слева от кнопок («Шаг 2 из 4») */
  step?: string;
  /** закрывать по клику мимо (по умолчанию да) */
  closeOnOutside?: boolean;
  onClose?: () => void;
}
export interface PopoverHandle { element: HTMLElement; close(): void; reposition(): void }

export function popover(anchor: HTMLElement, options: PopoverOptions): PopoverHandle {
  const o = options;
  const el = h('div', { class: `b24-popover b24-root${o.dark ? ' b24-popover--dark' : ''}`, role: 'dialog', 'aria-label': o.title ?? o.text ?? '' });
  const arrow = h('span', { class: 'b24-popover__arrow', 'aria-hidden': 'true' });
  el.append(arrow);
  if (o.title) el.append(h('p', { class: 'b24-popover__title' }, o.title));
  if (o.text) el.append(h('p', { class: 'b24-popover__text' }, o.text));
  if (o.actions?.length || o.step) {
    const row = h('div', { class: 'b24-popover__actions' });
    if (o.step) row.append(h('span', { class: 'b24-popover__step' }, o.step));
    for (const a of o.actions ?? []) {
      const b = h('button', { type: 'button', class: `b24-btn b24-btn--${a.variant ?? 'primary'} b24-btn--sm` }, a.label);
      b.addEventListener('click', () => { if (a.onClick?.() !== false) handle.close(); });
      row.append(b);
    }
    el.append(row);
  }
  if (o.closable !== false) {
    const x = h('button', { type: 'button', class: 'b24-popover__close', 'aria-label': 'Закрыть' }, html(icon('close')));
    x.addEventListener('click', () => handle.close());
    el.append(x);
  }
  document.body.append(el);
  bringToFront(el);

  const place = () => {
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const hgt = el.offsetHeight;
    const gap = 12;
    let pl = o.placement ?? 'bottom';
    // нет места — на противоположную сторону
    if (pl === 'bottom' && r.bottom + gap + hgt > innerHeight && r.top - gap - hgt > 0) pl = 'top';
    if (pl === 'top' && r.top - gap - hgt < 0) pl = 'bottom';
    if (pl === 'right' && r.right + gap + w > innerWidth) pl = 'left';
    if (pl === 'left' && r.left - gap - w < 0) pl = 'right';
    let top: number; let left: number;
    if (pl === 'bottom' || pl === 'top') {
      top = pl === 'bottom' ? r.bottom + gap : r.top - gap - hgt;
      left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
      const ax = Math.min(Math.max(14, r.left + r.width / 2 - left - 6), w - 26);
      Object.assign(arrow.style, { left: `${ax}px`, top: pl === 'bottom' ? '-6px' : '', bottom: pl === 'top' ? '-6px' : '' });
    } else {
      left = pl === 'right' ? r.right + gap : r.left - gap - w;
      top = Math.min(Math.max(8, r.top + r.height / 2 - hgt / 2), innerHeight - hgt - 8);
      const ay = Math.min(Math.max(14, r.top + r.height / 2 - top - 6), hgt - 26);
      Object.assign(arrow.style, { top: `${ay}px`, left: pl === 'right' ? '-6px' : '', right: pl === 'left' ? '-6px' : '', bottom: '' });
    }
    el.style.top = `${top + scrollY}px`;
    el.style.left = `${left + scrollX}px`;
  };
  const onDown = (e: MouseEvent) => { if (o.closeOnOutside !== false && !el.contains(e.target as Node) && !anchor.contains(e.target as Node)) handle.close(); };
  const release = pushLayer(() => handle.close());
  let closed = false;
  const handle: PopoverHandle = {
    element: el,
    reposition: place,
    close() {
      if (closed) return;
      closed = true;
      release();
      document.removeEventListener('mousedown', onDown, true);
      removeEventListener('resize', place);
      el.remove();
      o.onClose?.();
    },
  };
  place();
  document.addEventListener('mousedown', onDown, true);
  addEventListener('resize', place);
  (el.querySelector<HTMLElement>('.b24-btn--primary') ?? el.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
  return handle;
}

/* ── Обучение по шагам ─────────────────────────────────────
 * Затемнение с «окном» вокруг элемента и подсказка «Назад / Далее / Готово». Esc — закрыть.
 */
export interface TourStep { target: string | HTMLElement; title: string; text?: string; placement?: PopoverOptions['placement'] }
export interface TourHandle { close(): void; go(index: number): void }

export function startTour(steps: TourStep[], options: { onFinish?: (completed: boolean) => void; doneLabel?: string } = {}): TourHandle {
  let index = 0;
  let pop: PopoverHandle | null = null;
  const spot = h('div', { class: 'b24-spotlight', 'aria-hidden': 'true' });
  document.body.append(spot);
  bringToFront(spot);
  let finished = false;
  const finish = (completed: boolean) => {
    if (finished) return;
    finished = true;
    pop?.close();
    spot.remove();
    removeEventListener('resize', reflow);
    options.onFinish?.(completed);
  };
  const targetOf = (s: TourStep) => (typeof s.target === 'string' ? document.querySelector<HTMLElement>(s.target) : s.target);
  const reflow = () => {
    const t = targetOf(steps[index]);
    if (!t) return;
    const r = t.getBoundingClientRect();
    Object.assign(spot.style, { top: `${r.top + scrollY - 4}px`, left: `${r.left + scrollX - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px` });
    pop?.reposition();
  };
  const show = (i: number) => {
    index = Math.max(0, Math.min(steps.length - 1, i));
    const step = steps[index];
    const t = targetOf(step);
    if (!t) { if (index < steps.length - 1) show(index + 1); else finish(true); return; }
    t.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    if (pop) { const old = pop; pop = null; old.close(); }
    reflow();
    const last = index === steps.length - 1;
    pop = popover(t, {
      title: step.title, text: step.text, placement: step.placement, step: `${index + 1} из ${steps.length}`, closeOnOutside: false,
      actions: [
        ...(index > 0 ? [{ label: 'Назад', variant: 'plain' as const, onClick: () => { show(index - 1); return false; } }] : []),
        { label: last ? (options.doneLabel ?? 'Готово') : 'Далее', onClick: () => { if (last) finish(true); else show(index + 1); return false; } },
      ],
      onClose: () => { if (pop) finish(false); },
    });
    reflow();
  };
  addEventListener('resize', reflow);
  show(0);
  return { close: () => finish(false), go: show };
}

/* ── Мелочи ───────────────────────────────────────────────── */
/** Русское множественное число: plural(5, ['запись', 'записи', 'записей']) → «записей» */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
/** «5 записей», с разделителем тысяч */
export const formatCount = (n: number, forms: [string, string, string]) => `${new Intl.NumberFormat('ru-RU').format(n)} ${plural(n, forms)}`;

/* ── Ссылки на CRM ─────────────────────────────────────────
 * crmEntityUrl('deal', 15) → /crm/deal/details/15/; смарт-процесс: crmEntityUrl('dynamic', 7, 128) → /crm/type/128/details/7/.
 * Тип можно передать и числом entityTypeId (1 лид, 2 сделка, 3 контакт, 4 компания, 7 предложение, 31 счёт, ≥128 — смарт-процесс).
 * base — адрес портала для ссылок вне фрейма (https://portal.bitrix24.ru).
 */
export type CrmEntityType = 'lead' | 'deal' | 'contact' | 'company' | 'quote' | 'invoice' | 'dynamic' | number;
const CRM_BY_ID: Record<number, string> = { 1: 'lead', 2: 'deal', 3: 'contact', 4: 'company', 7: 'quote', 31: 'invoice' };

export function crmEntityUrl(type: CrmEntityType, id: string | number, typeId?: number, base = ''): string {
  const prefix = base.replace(/\/+$/, '');
  let kind = typeof type === 'number' ? CRM_BY_ID[type] : type;
  let dynamicId = typeId;
  if (typeof type === 'number' && !kind) { kind = 'dynamic'; dynamicId = type; }
  if (kind === 'invoice') { kind = 'dynamic'; dynamicId = 31; }
  if (kind === 'dynamic') {
    if (!dynamicId) throw new Error('crmEntityUrl: для смарт-процесса нужен entityTypeId');
    return `${prefix}/crm/type/${dynamicId}/details/${encodeURIComponent(String(id))}/`;
  }
  return `${prefix}/crm/${kind}/details/${encodeURIComponent(String(id))}/`;
}

/* ── Ошибки сервера в поля формы ───────────────────────────
 * applyServerErrors(form, { 'settings.chat_id': ['Чат не найден'] }) — путь Laravel (точки) ищет поле
 * по name «settings[chat_id]», «settings.chat_id» или по id. Поле получает .b24-field--error и текст ошибки.
 * Можно передать и весь ответ 422 { message, errors }. Возвращает ошибки, для которых поле не нашлось.
 */
export function applyServerErrors(
  root: HTMLElement,
  errors: Record<string, string | string[]> | { errors?: Record<string, string | string[]> },
  options: { prefix?: string; focus?: boolean } = {},
): Record<string, string[]> {
  clearServerErrors(root);
  const list = ('errors' in errors && errors.errors && typeof errors.errors === 'object' ? errors.errors : errors) as Record<string, string | string[]>;
  const missed: Record<string, string[]> = {};
  let first: HTMLElement | null = null;
  for (const [rawPath, msg] of Object.entries(list)) {
    const msgs = Array.isArray(msg) ? msg : [msg];
    const path = options.prefix && rawPath.startsWith(options.prefix) ? rawPath.slice(options.prefix.length).replace(/^\./, '') : rawPath;
    const parts = path.split('.');
    const bracket = parts[0] + parts.slice(1).map((p) => `[${p}]`).join('');
    const sel = [bracket, path, `${bracket}[]`].map((n) => `[name="${CSS.escape(n)}"]`).join(', ');
    const input = root.querySelector<HTMLElement>(sel) ?? root.querySelector<HTMLElement>(`#${CSS.escape(path.replace(/\./g, '_'))}`);
    if (!input) { missed[rawPath] = msgs; continue; }
    const field = input.closest<HTMLElement>('.b24-field') ?? input.parentElement!;
    field.classList.add('b24-field--error');
    input.setAttribute('aria-invalid', 'true');
    const err = h('div', { class: 'b24-field__error', 'data-b24-server-error': '' }, msgs.join(' '));
    err.id = `${input.id || `b24-err-${Math.random().toString(36).slice(2, 7)}`}-error`;
    input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), err.id].filter(Boolean).join(' '));
    field.append(err);
    first ??= input;
  }
  if (first && options.focus !== false) { first.scrollIntoView({ block: 'center' }); first.focus({ preventScroll: true }); }
  return missed;
}

export function clearServerErrors(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-b24-server-error]').forEach((err) => {
    const field = err.parentElement;
    field?.querySelectorAll<HTMLElement>('[aria-describedby]').forEach((i) => {
      const rest = i.getAttribute('aria-describedby')!.split(' ').filter((x) => x !== err.id).join(' ');
      if (rest) i.setAttribute('aria-describedby', rest); else i.removeAttribute('aria-describedby');
      i.removeAttribute('aria-invalid');
    });
    field?.classList.remove('b24-field--error');
    err.remove();
  });
}


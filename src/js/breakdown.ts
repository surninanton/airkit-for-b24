/**
 * Детализация расчёта: итоговая сумма раскладывается на секции и строки с пояснениями.
 *
 *   const b = breakdown(el, {
 *     title: 'Анна Рябова · 12 ноября', total: 1740,
 *     parts: [{ key: 'shifts', label: 'Выходы', sum: 500 }, { key: 'orders', label: 'Доставки', sum: 1140 }],
 *     sections: [{ key: 'orders', title: 'Доставки', count: 3, sum: 1140, hint: 'за выход: 500 ₽, от 10 — 600 ₽',
 *       groups: [{ title: 'Рейс 8', sum: 900, rows: [{ id: 'o1', html: '<a href="#">№7371</a>', sub: 'Кумово · 12:40', badges: [{ text: 'доставлен', kind: 'success' }], sum: 450 }] }] }],
 *     onChange: (rowId, value) => save(rowId, value),   // value === null — вернуть авто
 *     onRemove: (rowId) => confirmAndDelete(rowId),
 *   });
 *   b.update(next); b.destroy();
 *
 * Разметка (для серверного рендера, без JS):
 *   .b24-breakdown > __head (__title · __total · __parts > __part-chip, __op) · __section (.is-collapsed) > __section-head
 *     (__toggle · __count · __actions · __sum) · __hint · __body > __group (__group-head) · __row (.is-manual, .has-remove)
 *     > __main (__text · __sub · __badges) · __side (__sum · __note) · __remove · __empty
 */
import { icon } from '../icons';
import { formatMoney } from './editor';
import { h, html } from './dom';
import { t } from './i18n';

export interface BreakdownPart { key: string; label: string; sum: number }
export interface BreakdownBadge { text: string; kind?: 'success' | 'warning' | 'danger' | 'primary' | 'violet' | 'gray' }
export interface BreakdownRow {
  id: string;
  /** основной текст как HTML (ссылка «№7372» и т. п.); вместо него — text */
  html?: string;
  text?: string;
  /** вторичный текст: зона, время, кто записал */
  sub?: string;
  badges?: BreakdownBadge[];
  /** итоговая сумма строки; null — «—» */
  sum: number | null;
  /** расчётное значение: плейсхолдер поля правки; сумма, отличная от него, считается заданной вручную */
  auto?: number;
  /** принудительно: сумма задана вручную (бейдж «вручную») */
  manual?: boolean;
  /** клик по сумме открывает поле правки */
  editable?: boolean;
  removable?: boolean;
  /** пояснение мелким под суммой: «450 → 100: второй заказ рейса в ту же зону» */
  note?: string;
}
export interface BreakdownGroup { title: string; sum?: number; rows: BreakdownRow[] }
export interface BreakdownSection {
  key: string;
  title: string;
  count?: number;
  sum?: number;
  /** подпись-правило под заголовком */
  hint?: string;
  /** HTML слота действий в шапке секции; элементы с data-action вызывают onAction */
  actionsHtml?: string;
  actions?: Node;
  /** свёрнута сразу (дальше состояние ведёт пользователь) */
  collapsed?: boolean;
  /** текст пустой секции, по умолчанию «нет за период» */
  empty?: string;
  rows?: BreakdownRow[];
  groups?: BreakdownGroup[];
}
export interface BreakdownOptions {
  title?: string;
  subtitle?: string;
  total: number;
  /** слагаемые формулы под итогом; клик — прокрутка к секции с тем же key */
  parts?: BreakdownPart[];
  sections: BreakdownSection[];
  /** формат сумм; по умолчанию «1 740 ₽» */
  money?: (value: number) => string;
  onChange?: (rowId: string, value: number | null) => void;
  onRemove?: (rowId: string) => void;
  onAction?: (sectionKey: string, action: string, event: Event) => void;
}
export interface BreakdownHandle {
  update(next: Partial<BreakdownOptions>): void;
  /** раскрыть / свернуть секцию */
  toggle(key: string, open?: boolean): void;
  /** прокрутить к секции (раскрыв её) */
  scrollTo(key: string): void;
  readonly element: HTMLElement;
  destroy(): void;
}

const parseNum = (s: string): number | null => {
  const v = s.replace(/\s/g, '').replace(',', '.');
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

export function createBreakdown(host: HTMLElement, options: BreakdownOptions): BreakdownHandle {
  let opts = options;
  const collapsed = new Map<string, boolean>();
  const root = h('div', { class: 'b24-breakdown' });
  host.append(root);
  const money = (v: number) => (opts.money ?? ((x: number) => formatMoney(x)))(v);
  const sumText = (v: number | null | undefined) => (v == null ? '—' : money(v));
  const sumCls = (v: number | null | undefined) => (typeof v === 'number' && v < 0 ? ' is-negative' : '');

  const rowEl = (r: BreakdownRow, hasRemove: boolean) => {
    const manual = r.manual ?? (r.auto != null && r.sum !== r.auto);
    const el = h('div', { class: `b24-breakdown__row${manual ? ' is-manual' : ''}${hasRemove ? ' has-remove' : ''}`, 'data-id': r.id });
    const text = h('div', { class: 'b24-breakdown__text' });
    if (r.html != null) text.innerHTML = r.html; else text.textContent = r.text ?? '';
    const main = h('div', { class: 'b24-breakdown__main' }, text);
    if (r.sub) main.append(h('div', { class: 'b24-breakdown__sub' }, r.sub));
    const badges = [...(r.badges ?? [])];
    if (manual) badges.push({ text: t('вручную'), kind: 'warning' });
    if (badges.length) {
      const bx = h('div', { class: 'b24-breakdown__badges' });
      badges.forEach((b) => bx.append(h('span', { class: `b24-badge b24-badge--sm b24-badge--${b.kind ?? 'gray'}` }, b.text)));
      main.append(bx);
    }
    const sum = r.editable
      ? h('button', { type: 'button', class: `b24-breakdown__sum is-editable${sumCls(r.sum)}`, 'data-edit': r.id, title: t('Изменить сумму') }, sumText(r.sum))
      : h('span', { class: `b24-breakdown__sum${sumCls(r.sum)}` }, sumText(r.sum));
    const side = h('div', { class: 'b24-breakdown__side' }, sum);
    if (r.note) side.append(h('div', { class: 'b24-breakdown__note' }, r.note));
    el.append(main, side);
    if (hasRemove) {
      el.append(r.removable
        ? h('button', { type: 'button', class: 'b24-breakdown__remove', 'data-remove': r.id, 'aria-label': t('Удалить'), title: t('Удалить') }, html(icon('close', { size: 16 })))
        : h('span', { class: 'b24-breakdown__remove-gap' }));
    }
    return el;
  };

  const render = () => {
    root.textContent = '';
    const head = h('div', { class: 'b24-breakdown__head' });
    if (opts.title || opts.subtitle) {
      const tt = h('div', { class: 'b24-breakdown__title' }, opts.title ?? '');
      if (opts.subtitle) tt.append(h('div', { class: 'b24-breakdown__subtitle' }, opts.subtitle));
      head.append(tt);
    }
    head.append(h('div', { class: `b24-breakdown__total${sumCls(opts.total)}` }, money(opts.total)));
    if (opts.parts?.length) {
      const parts = h('div', { class: 'b24-breakdown__parts' });
      opts.parts.forEach((p, i) => {
        if (i) parts.append(h('span', { class: 'b24-breakdown__op', 'aria-hidden': 'true' }, '+'));
        const chip = h('button', { type: 'button', class: 'b24-breakdown__part-chip', 'data-part': p.key });
        chip.append(h('span', { class: 'b24-breakdown__part-label' }, p.label), h('span', { class: `b24-breakdown__part-sum${sumCls(p.sum)}` }, money(p.sum)));
        parts.append(chip);
      });
      parts.append(h('span', { class: 'b24-breakdown__op', 'aria-hidden': 'true' }, '='), h('span', { class: 'b24-breakdown__part-total' }, money(opts.total)));
      head.append(parts);
    }
    root.append(head);

    // слот под ✕ резервируется во всей карточке, чтобы суммы всех секций стояли в одну колонку
    const hasRemove = opts.sections.some((s) => (s.groups ?? [{ rows: s.rows ?? [] }]).some((g) => g.rows.some((r) => r.removable)));
    for (const s of opts.sections) {
      if (!collapsed.has(s.key)) collapsed.set(s.key, !!s.collapsed);
      const isCol = collapsed.get(s.key)!;
      const sec = h('section', { class: `b24-breakdown__section${isCol ? ' is-collapsed' : ''}`, 'data-key': s.key });
      const bodyId = `b24-bd-${Math.random().toString(36).slice(2, 8)}`;
      const toggle = h('button', { type: 'button', class: 'b24-breakdown__toggle', 'aria-expanded': String(!isCol), 'aria-controls': bodyId },
        h('span', { class: 'b24-breakdown__chevron' }, html(icon('chevronDown', { size: 16 }))),
        h('span', { class: 'b24-breakdown__section-title' }, s.title));
      if (s.count != null) toggle.append(h('span', { class: 'b24-counter b24-breakdown__count' }, String(s.count)));
      const shead = h('div', { class: 'b24-breakdown__section-head' }, toggle);
      if (s.actionsHtml || s.actions) {
        const act = h('div', { class: 'b24-breakdown__actions' });
        if (s.actionsHtml) act.innerHTML = s.actionsHtml;
        if (s.actions) act.append(s.actions);
        shead.append(act);
      }
      if (s.sum != null) shead.append(h('div', { class: `b24-breakdown__sum b24-breakdown__section-sum${sumCls(s.sum)}` }, money(s.sum)));
      sec.append(shead);
      if (s.hint) sec.append(h('div', { class: 'b24-breakdown__hint' }, s.hint));
      const body = h('div', { class: 'b24-breakdown__body', id: bodyId });
      body.hidden = isCol;
      const groups: BreakdownGroup[] = s.groups ?? [{ title: '', rows: s.rows ?? [] }];
      const allRows = groups.flatMap((g) => g.rows);
      if (!allRows.length) body.append(h('div', { class: 'b24-breakdown__empty' }, s.empty ?? t('нет за период')));
      for (const g of groups) {
        if (!g.rows.length && !g.title) continue;
        const gEl = h('div', { class: 'b24-breakdown__group' });
        if (g.title) {
          gEl.append(h('div', { class: 'b24-breakdown__group-head' },
            h('span', { class: 'b24-breakdown__group-title' }, g.title),
            g.sum != null ? h('span', { class: `b24-breakdown__sum${sumCls(g.sum)}` }, money(g.sum)) : null));
        }
        g.rows.forEach((r) => gEl.append(rowEl(r, hasRemove)));
        body.append(gEl);
      }
      sec.append(body);
      root.append(sec);
    }
  };

  const findRow = (id: string): BreakdownRow | undefined => {
    for (const s of opts.sections) for (const g of s.groups ?? [{ rows: s.rows ?? [] }]) { const r = g.rows.find((x) => x.id === id); if (r) return r; }
    return undefined;
  };

  const setOpen = (key: string, open: boolean) => {
    collapsed.set(key, !open);
    const sec = root.querySelector<HTMLElement>(`.b24-breakdown__section[data-key="${CSS.escape(key)}"]`);
    if (!sec) return;
    sec.classList.toggle('is-collapsed', !open);
    sec.querySelector('.b24-breakdown__toggle')?.setAttribute('aria-expanded', String(open));
    sec.querySelector<HTMLElement>('.b24-breakdown__body')!.hidden = !open;
  };

  const scrollTo = (key: string) => {
    setOpen(key, true);
    const sec = root.querySelector<HTMLElement>(`.b24-breakdown__section[data-key="${CSS.escape(key)}"]`);
    if (!sec) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    sec.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    sec.classList.add('is-flash');
    window.setTimeout(() => sec.classList.remove('is-flash'), 1200);
  };

  const startEdit = (btn: HTMLElement) => {
    const id = btn.dataset.edit!;
    const row = findRow(id);
    if (!row) return;
    const manual = row.manual ?? (row.auto != null && row.sum !== row.auto);
    const input = h('input', { type: 'text', inputmode: 'decimal', class: 'b24-breakdown__input', 'aria-label': t('Сумма'), autocomplete: 'off' }) as HTMLInputElement;
    input.value = manual && row.sum != null ? String(row.sum) : '';
    const ph = row.auto ?? row.sum;
    input.placeholder = ph != null ? String(ph) : t('авто');
    btn.replaceWith(input);
    input.focus(); input.select();
    let done = false;
    const finish = (commit: boolean) => {
      if (done) return;
      done = true;
      if (commit) {
        const n = parseNum(input.value);
        if (Number.isNaN(n)) { input.classList.add('is-invalid'); done = false; input.focus(); return; }
        const same = n === null ? !manual : manual && n === row.sum;
        if (!same) { opts.onChange?.(id, n); }
      }
      render();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  };

  root.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const part = el.closest<HTMLElement>('[data-part]');
    if (part && root.contains(part)) { scrollTo(part.dataset.part!); return; }
    const tg = el.closest<HTMLElement>('.b24-breakdown__toggle');
    if (tg) { const key = tg.closest<HTMLElement>('.b24-breakdown__section')!.dataset.key!; setOpen(key, !!collapsed.get(key)); return; }
    const edit = el.closest<HTMLElement>('[data-edit]');
    if (edit) { startEdit(edit); return; }
    const rm = el.closest<HTMLElement>('[data-remove]');
    if (rm) { opts.onRemove?.(rm.dataset.remove!); return; }
    const act = el.closest<HTMLElement>('.b24-breakdown__actions [data-action]');
    if (act) opts.onAction?.(act.closest<HTMLElement>('.b24-breakdown__section')!.dataset.key!, act.dataset.action!, e);
  });

  render();
  return {
    element: root,
    update(next) { opts = { ...opts, ...next }; render(); },
    toggle(key, open) { setOpen(key, open ?? !!collapsed.get(key)); },
    scrollTo,
    destroy() { root.remove(); },
  };
}

export { createBreakdown as breakdown };

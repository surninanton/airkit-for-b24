import { icon } from '../icons';
import { escapeHtml, h, html } from './dom';
import { intlLocale, t as tr } from './i18n';

/* ── Подсветка JSON ─────────────────────────────────────── */
export function jsonHtml(value: unknown, indent = 2): string {
  let text: string;
  try { text = typeof value === 'string' ? JSON.stringify(JSON.parse(value), null, indent) : JSON.stringify(value, null, indent); } catch { text = String(value); }
  if (text === undefined) text = 'undefined';
  return escapeHtml(text).replace(
    /(&quot;(?:\\.|[^&\\]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (m, str: string | undefined, colon: string | undefined, bool: string | undefined) => {
      if (str) return colon ? `<span class="b24-json__key">${str}</span>${colon}` : `<span class="b24-json__str">${str}</span>`;
      if (bool) return `<span class="b24-json__bool">${m}</span>`;
      if (m === 'null') return `<span class="b24-json__null">${m}</span>`;
      return `<span class="b24-json__num">${m}</span>`;
    },
  );
}

/* ── Блок кода со строками разного тона ──────────────────
 * codeHtml(['ok', { text: 'Ошибка', tone: 'error' }]) → <pre class="b24-code">…; кнопка копирования — по наведению.
 */
export type CodeTone = 'error' | 'warning' | 'success' | 'info' | 'muted';
export function codeHtml(lines: Array<string | { text: string; tone?: CodeTone }>, options: { copy?: boolean; dark?: boolean } = {}): string {
  const body = lines.map((l) => (typeof l === 'string' ? { text: l } : l))
    .map((l) => `<span class="b24-code__line${l.tone ? ` is-${l.tone}` : ''}">${escapeHtml(l.text) || ' '}</span>`).join('');
  const copy = options.copy !== false ? `<button type="button" class="b24-code__copy" data-b24-copy aria-label="${escapeHtml(tr('Скопировать'))}">${icon('copy')}</button>` : '';
  return `<div class="b24-code${options.dark ? ' b24-code--dark' : ''}">${copy}<pre>${body}</pre></div>`;
}

/** Стектрейс: строки кадров (#0 …, at …) приглушены, файлы и номера строк выделены */
export function traceHtml(trace: string): string {
  return trace.split('\n').map((line) => {
    const safe = escapeHtml(line);
    const frame = /^\s*(#\d+|at\s)/.test(line);
    const withFile = safe.replace(/([\w./\\-]+\.(?:php|js|ts|py))(\(|:)(\d+)/g, '<span class="b24-trace__file">$1</span>$2<span class="b24-trace__line">$3</span>');
    return `<span class="b24-code__line${frame ? ' is-muted' : ' is-error'}">${withFile || ' '}</span>`;
  }).join('');
}

/** Копирование по кнопке [data-b24-copy] внутри .b24-code или с data-b24-copy="текст" */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' }) as HTMLTextAreaElement;
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/* ── Просмотр логов ────────────────────────────────────────
 * Тёмная консоль: фильтр уровней (несколько сразу), строка «время · уровень · сообщение»,
 * раскрытие контекста (JSON с подсветкой) и стектрейса, копирование записи, «Загрузить ещё» по курсору.
 */
export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | (string & {});
export interface LogEntry {
  id: string | number;
  time: string | Date;
  level: LogLevel;
  message: string;
  context?: unknown;
  trace?: string;
}
export interface LogPage<C> { items: LogEntry[]; next?: C | null }
export interface LogViewerOptions<C = unknown> {
  /** страница записей; cursor = null — первая. Меняются уровни — загрузка начинается заново */
  load: (args: { cursor: C | null; levels: LogLevel[]; signal: AbortSignal }) => Promise<LogPage<C>>;
  levels?: Array<{ value: LogLevel; label: string }>;
  /** включённые уровни (по умолчанию все) */
  selected?: LogLevel[];
  emptyText?: string;
  /** высота списка */
  height?: number | string;
  onLevelsChange?: (levels: LogLevel[]) => void;
}
export interface LogViewerHandle {
  element: HTMLElement;
  reload(): void;
  setLevels(levels: LogLevel[]): void;
  /** добавить записи сверху (живой хвост) */
  prepend(items: LogEntry[]): void;
  destroy(): void;
}

const DEFAULT_LEVELS = () => [
  { value: 'debug', label: tr('Отладка') },
  { value: 'info', label: tr('Инфо') },
  { value: 'warning', label: tr('Предупреждения') },
  { value: 'error', label: tr('Ошибки') },
];
const timeFmt = () => new Intl.DateTimeFormat(intlLocale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function createLogViewer<C = unknown>(host: HTMLElement, options: LogViewerOptions<C>): LogViewerHandle {
  const o = options;
  const levels = o.levels ?? DEFAULT_LEVELS();
  let active = new Set<LogLevel>(o.selected ?? levels.map((l) => l.value));
  let cursor: C | null = null;
  let hasMore = false;
  let abort: AbortController | null = null;
  let count = 0;

  const root = h('div', { class: 'b24-logs' });
  const bar = h('div', { class: 'b24-logs__bar', role: 'group', 'aria-label': tr('Уровни') });
  const counter = h('span', { class: 'b24-logs__count', 'aria-live': 'polite' });
  const list = h('div', { class: 'b24-logs__list', role: 'log', 'aria-live': 'off' });
  if (o.height) list.style.maxHeight = typeof o.height === 'number' ? `${o.height}px` : o.height;
  const more = h('button', { type: 'button', class: 'b24-logs__more' }, tr('Загрузить ещё')) as HTMLButtonElement;
  const empty = h('div', { class: 'b24-logs__empty' }, o.emptyText ?? tr('Записей нет'));
  root.append(bar, list, more);
  host.append(root);

  const renderBar = () => {
    bar.textContent = '';
    for (const l of levels) {
      const on = active.has(l.value);
      const b = h('button', { type: 'button', class: `b24-logs__level is-${l.value}`, 'aria-pressed': String(on) }, h('span', { class: 'b24-logs__dot' }), l.label);
      b.addEventListener('click', () => {
        if (on && active.size === 1) return; // хотя бы один уровень
        if (on) active.delete(l.value); else active.add(l.value);
        renderBar();
        o.onLevelsChange?.([...active]);
        reload();
      });
      bar.append(b);
    }
    bar.append(counter);
  };

  const entryEl = (e: LogEntry) => {
    const t = typeof e.time === 'string' ? new Date(e.time) : e.time;
    const when = Number.isNaN(t.getTime()) ? String(e.time) : timeFmt().format(t).replace(',', '');
    const details = e.context !== undefined || e.trace;
    const row = h('div', { class: `b24-logs__entry is-${e.level}` });
    const head = h(details ? 'button' : 'div', { class: 'b24-logs__head', ...(details ? { type: 'button', 'aria-expanded': 'false' } : {}) },
      h('time', { class: 'b24-logs__time' }, when),
      h('span', { class: 'b24-logs__lvl' }, String(e.level).toUpperCase()),
      h('span', { class: 'b24-logs__msg' }, e.message));
    const copy = h('button', { type: 'button', class: 'b24-logs__copy', 'aria-label': tr('Скопировать запись'), title: tr('Скопировать') }, html(icon('copy')));
    copy.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const ok = await copyText(JSON.stringify({ time: e.time, level: e.level, message: e.message, context: e.context, trace: e.trace }, null, 2));
      copy.classList.toggle('is-done', ok);
      setTimeout(() => copy.classList.remove('is-done'), 1200);
    });
    row.append(head, copy);
    if (details) {
      const box = h('div', { class: 'b24-logs__details', hidden: '' });
      if (e.context !== undefined) box.append(h('pre', { class: 'b24-logs__json' }, html(jsonHtml(e.context))));
      if (e.trace) box.append(h('pre', { class: 'b24-logs__trace' }, html(traceHtml(e.trace))));
      row.append(box);
      head.addEventListener('click', () => {
        const open = box.hidden;
        box.hidden = !open;
        head.setAttribute('aria-expanded', String(open));
      });
    }
    return row;
  };

  const sync = () => {
    counter.textContent = count ? tr('Показано: {count}', { count }) : '';
    more.hidden = !hasMore;
    if (!count) list.replaceChildren(empty); else empty.remove();
  };

  const fetchPage = async (reset: boolean) => {
    abort?.abort();
    abort = new AbortController();
    const signal = abort.signal;
    if (reset) { cursor = null; count = 0; list.replaceChildren(h('div', { class: 'b24-logs__empty' }, h('span', { class: 'b24-spinner b24-spinner--sm' }), tr('Загрузка…'))); more.hidden = true; }
    more.classList.add('b24-btn--loading');
    try {
      const page = await o.load({ cursor, levels: [...active], signal });
      if (signal.aborted) return;
      if (reset) list.textContent = '';
      page.items.forEach((e) => list.append(entryEl(e)));
      count += page.items.length;
      cursor = page.next ?? null;
      hasMore = page.next != null;
    } catch (err) {
      if (signal.aborted) return;
      list.append(h('div', { class: 'b24-logs__empty is-error' }, tr('Не удалось загрузить: {error}', { error: String((err as Error)?.message ?? err) })));
    } finally {
      if (!signal.aborted) { more.classList.remove('b24-btn--loading'); sync(); }
    }
  };
  const reload = () => void fetchPage(true);
  more.addEventListener('click', () => void fetchPage(false));
  renderBar();
  reload();

  return {
    element: root,
    reload,
    setLevels(next) { active = new Set(next); renderBar(); reload(); },
    prepend(items) { items.slice().reverse().forEach((e) => { if (active.has(e.level)) { list.prepend(entryEl(e)); count++; } }); sync(); },
    destroy() { abort?.abort(); root.remove(); },
  };
}

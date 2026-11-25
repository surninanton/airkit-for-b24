/**
 * Простая разметка сообщений чата (совпадает с серверным конвертером Telegram HTML / plain):
 *   **жирный**  __курсив__  ~~зачёркнутый~~  `код`  ```блок кода``` (можно в несколько строк)
 *   строка, начинающаяся с «> » — цитата;  ссылки http(s) — как есть.
 * Упоминание: @[Имя Фамилия](user:ID) — чип-ссылка; toPlain → «@Имя Фамилия», toHtml → «@Имя Фамилия» (обычный текст).
 * Внутри `кода`, блока кода и ссылок маркеры не разбираются. Одиночное _ не трогаем (snake_case, ссылки).
 * Только безопасные узлы: DOM строится через createElement / textContent, HTML для отправки — с экранированием.
 *
 *   chatMarkup.toPlain('**привет**')   → 'привет'
 *   chatMarkup.toHtml('**привет**')    → '<b>привет</b>'   (b, i, s, code, pre, blockquote, a)
 *   chatMarkup.render('**привет**')    → DocumentFragment
 */
import { h } from './dom';

export type InlineNode =
  | string
  | { t: 'b' | 'i' | 's'; c: InlineNode[] }
  | { t: 'code'; v: string }
  | { t: 'a'; href: string }
  | { t: 'mention'; name: string; id: string };
export type BlockNode =
  | { t: 'p'; c: InlineNode[] }
  | { t: 'pre'; v: string }
  | { t: 'quote'; c: InlineNode[] };

const URL_RE = /https?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]]/y;
const MARKS: Array<['**' | '__' | '~~', 'b' | 'i' | 's']> = [['**', 'b'], ['__', 'i'], ['~~', 's']];

/** Конец ссылки не должен «съедать» закрывающий маркер: http://x** → http://x */
function urlAt(text: string, i: number): string | null {
  URL_RE.lastIndex = i;
  const m = URL_RE.exec(text);
  if (!m) return null;
  let u = m[0];
  while (/(\*\*|~~|__)$/.test(u)) u = u.slice(0, -2);
  return u.length > 8 ? u : null;
}

/** Закрывающий маркер: код и ссылки пропускаются. */
function findClose(text: string, mark: string, from: number): number {
  let i = from;
  while (i < text.length) {
    if (text[i] === '`') {
      const j = text.indexOf('`', i + 1);
      if (j > i && !text.slice(i + 1, j).includes('\n')) { i = j + 1; continue; }
    }
    if (text.startsWith('http', i)) { const u = urlAt(text, i); if (u) { i += u.length; continue; } }
    if (text.startsWith(mark, i)) return i;
    i++;
  }
  return -1;
}

export function parseInline(text: string): InlineNode[] {
  const out: InlineNode[] = [];
  let buf = '';
  const flush = () => { if (buf) { out.push(buf); buf = ''; } };
  let i = 0;
  outer: while (i < text.length) {
    const c = text[i];
    if (c === '`') {
      const j = text.indexOf('`', i + 1);
      if (j > i + 1 && !text.slice(i + 1, j).includes('\n')) { flush(); out.push({ t: 'code', v: text.slice(i + 1, j) }); i = j + 1; continue; }
    }
    if (c === '@') {
      const m = /^@\[([^\]\n]{1,80})\]\(user:([^)\s]{1,64})\)/.exec(text.slice(i));
      if (m) { flush(); out.push({ t: 'mention', name: m[1], id: m[2] }); i += m[0].length; continue; }
    }
    if (c === 'h') {
      const u = urlAt(text, i);
      if (u) { flush(); out.push({ t: 'a', href: u }); i += u.length; continue; }
    }
    for (const [mark, t] of MARKS) {
      if (!text.startsWith(mark, i)) continue;
      const j = findClose(text, mark, i + 2);
      if (j > i + 2 && text.slice(i + 2, j).trim()) { flush(); out.push({ t, c: parseInline(text.slice(i + 2, j)) }); i = j + 2; continue outer; }
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}

export function parseMarkup(text: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  const pushText = (seg: string) => {
    const lines = seg.split('\n');
    let run: string[] = [];
    let quote: string[] = [];
    const flushRun = () => { if (run.length) { const s = run.join('\n'); if (s) blocks.push({ t: 'p', c: parseInline(s) }); run = []; } };
    const flushQuote = () => { if (quote.length) { blocks.push({ t: 'quote', c: parseInline(quote.join('\n')) }); quote = []; } };
    for (const line of lines) {
      if (line.startsWith('> ')) { flushRun(); quote.push(line.slice(2)); } else { flushQuote(); run.push(line); }
    }
    flushRun(); flushQuote();
  };
  const re = /```([\s\S]*?)```/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    let before = text.slice(last, m.index);
    if (before.endsWith('\n')) before = before.slice(0, -1);
    if (before) pushText(before);
    blocks.push({ t: 'pre', v: m[1].replace(/^\n/, '').replace(/\n$/, '') });
    last = m.index! + m[0].length;
    if (text[last] === '\n') last++;
  }
  const rest = text.slice(last);
  if (rest) pushText(rest);
  return blocks;
}

const inlinePlain = (nodes: InlineNode[]): string => nodes.map((n) => (typeof n === 'string' ? n : n.t === 'code' ? n.v : n.t === 'a' ? n.href : n.t === 'mention' ? `@${n.name}` : inlinePlain(n.c))).join('');
/** Текст без маркеров разметки. */
export function toPlain(text: string): string {
  return parseMarkup(text).map((b) => (b.t === 'pre' ? b.v : inlinePlain(b.c))).join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inlineHtml = (nodes: InlineNode[]): string => nodes.map((n) => {
  if (typeof n === 'string') return esc(n);
  if (n.t === 'code') return `<code>${esc(n.v)}</code>`;
  if (n.t === 'a') return `<a href="${esc(n.href)}">${esc(n.href)}</a>`;
  if (n.t === 'mention') return esc(`@${n.name}`);
  return `<${n.t}>${inlineHtml(n.c)}</${n.t}>`;
}).join('');
/** Безопасный HTML для Telegram parse_mode=HTML: b, i, s, code, pre, blockquote, a; остальной текст экранирован. */
export function toHtml(text: string): string {
  return parseMarkup(text).map((b) => (b.t === 'pre' ? `<pre>${esc(b.v)}</pre>` : b.t === 'quote' ? `<blockquote>${inlineHtml(b.c)}</blockquote>` : inlineHtml(b.c))).join('');
}

const inlineDom = (nodes: InlineNode[]): Array<string | HTMLElement> => nodes.map((n) => {
  if (typeof n === 'string') return n;
  if (n.t === 'code') return h('code', { class: 'b24-chat-code-inline' }, n.v);
  if (n.t === 'a') return h('a', { href: n.href, target: '_blank', rel: 'noopener noreferrer' }, n.href);
  if (n.t === 'mention') return h('a', { class: 'b24-chat-mention', href: '#', role: 'link', 'data-user-id': n.id }, `@${n.name}`);
  return h(n.t === 'b' ? 'strong' : n.t === 'i' ? 'em' : 's', {}, ...inlineDom(n.c));
});
/** Разметка → DOM (без innerHTML). */
export function renderMarkup(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const b of parseMarkup(text)) {
    if (b.t === 'pre') frag.append(h('pre', { class: 'b24-chat-code' }, h('code', {}, b.v)));
    else if (b.t === 'quote') frag.append(h('blockquote', { class: 'b24-chat-blockquote' }, ...inlineDom(b.c)));
    else frag.append(...inlineDom(b.c));
  }
  return frag;
}

/** Упоминание в тексте: @[Имя Фамилия](user:ID). */
export const mentionMarker = (name: string, id: string): string => `@[${name.replace(/[\]\n]/g, ' ')}](user:${id})`;

/** Маркеры форматирования для полей ввода. */
export const MARKERS = { bold: '**', italic: '__', strike: '~~', code: '`' } as const;

export const chatMarkup = { toPlain, toHtml, render: renderMarkup, parse: parseMarkup };

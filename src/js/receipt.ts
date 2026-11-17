/**
 * Предпросмотр чековой ленты: моноширинный блок фиксированной ширины в символах (32 — лента 58 мм, 48 — 80 мм),
 * жирный, двойная высота / ширина, выравнивание, инверсия, разделители, таблица «название … цена», QR и штрихкод.
 *
 *   createReceipt(host, { lines, paper: 58 | 80 })
 *   lines: [
 *     { text: 'ПИЦЦА РОЛЛ', bold: true, dh: true, dw: true, align: 'center' },
 *     { sep: '-' },
 *     { cols: ['Маргарита 30 см', '2 × 450'] },
 *     { text: 'ОТМЕНА', invert: true, align: 'center' },
 *     { qr: 'https://pizzairoll.ru/o/42', label: 'Оцените заказ' },
 *     { barcode: '4600000000012' },
 *   ]
 * Перенос слов — по ширине ленты (с учётом двойной ширины: в строке вдвое меньше символов).
 */
import { h } from './dom';
import { t } from './i18n';
import { qrSvg, type QrEcc } from './qr';

export interface ReceiptTextLine {
  text: string;
  bold?: boolean;
  /** двойная высота */
  dh?: boolean;
  /** двойная ширина: символов в строке вдвое меньше */
  dw?: boolean;
  align?: 'left' | 'center' | 'right';
  /** белым по чёрному: «ОТМЕНА», «ИЗМЕНЕНИЕ» */
  invert?: boolean;
}
export interface ReceiptSepLine { sep: string }
export interface ReceiptColsLine {
  /** [слева, справа]: правая колонка выровнена по краю ленты, левая переносится */
  cols: [string, string];
  bold?: boolean;
  dh?: boolean;
  dw?: boolean;
}
export interface ReceiptQrLine { qr: string; label?: string; ecc?: QrEcc; align?: 'left' | 'center' | 'right' }
/** штрихкод — заглушка: полосы по цифрам и подпись (для предпросмотра, не для печати) */
export interface ReceiptBarcodeLine { barcode: string; label?: string; align?: 'left' | 'center' | 'right' }
export interface ReceiptBlankLine { blank: number | true }
export type ReceiptLine = ReceiptTextLine | ReceiptSepLine | ReceiptColsLine | ReceiptQrLine | ReceiptBarcodeLine | ReceiptBlankLine;

export interface ReceiptOptions {
  lines?: ReceiptLine[];
  /** ширина ленты, мм: 58 → 32 символа, 80 → 48 (по умолчанию 80) */
  paper?: 58 | 80;
  /** или сразу число символов в строке (важнее paper) */
  width?: number;
  /** рваный край сверху и снизу (по умолчанию да) */
  torn?: boolean;
  /** переключатель 58 / 80 мм над лентой */
  switcher?: boolean;
  onPaperChange?: (paper: 58 | 80, width: number) => void;
}
export interface ReceiptHandle {
  element: HTMLElement;
  setLines(lines: ReceiptLine[]): void;
  setPaper(paper: 58 | 80): void;
  setWidth(width: number): void;
  getWidth(): number;
  /** ровно то, что напечатал бы принтер: строки с учётом переноса, без QR и штрихкода (они — [QR]/[BARCODE]) */
  getText(): string;
  destroy(): void;
}

const PAPER_WIDTH = { 58: 32, 80: 48 } as const;

/** Разбить текст по словам на строки не длиннее width; слово длиннее строки режется. */
export function wrapReceiptText(text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of String(text).split('\n')) {
    let cur = '';
    for (let word of para.split(/ +/)) {
      if (!word && !cur) continue;
      while (word.length > width) {
        if (cur) { out.push(cur); cur = ''; }
        out.push(word.slice(0, width));
        word = word.slice(width);
      }
      if (!cur) cur = word;
      else if (cur.length + 1 + word.length <= width) cur += ` ${word}`;
      else { out.push(cur); cur = word; }
    }
    out.push(cur);
  }
  return out;
}

const pad = (s: string, w: number, align: 'left' | 'center' | 'right') => {
  const gap = Math.max(0, w - s.length);
  return align === 'right' ? ' '.repeat(gap) + s : align === 'center' ? ' '.repeat(Math.floor(gap / 2)) + s : s;
};

interface Row { text: string; bold?: boolean; dh?: boolean; dw?: boolean; invert?: boolean; align?: 'left' | 'center' | 'right'; custom?: HTMLElement; plain: string }

/** Строки ленты → ряды фиксированной ширины (в «ячейках» принтера). */
export function layoutReceipt(lines: ReceiptLine[], width: number): Row[] {
  const rows: Row[] = [];
  for (const ln of lines) {
    if ('sep' in ln) { const c = (ln.sep || '-')[0]; rows.push({ text: c.repeat(width), plain: c.repeat(width) }); continue; }
    if ('blank' in ln) { for (let i = 0; i < (ln.blank === true ? 1 : ln.blank); i++) rows.push({ text: '', plain: '' }); continue; }
    if ('qr' in ln) { rows.push({ text: '', plain: `[QR] ${ln.qr}`, custom: qrBlock(ln, width) }); if (ln.label) wrapReceiptText(ln.label, width).forEach((s) => rows.push({ text: s, align: ln.align ?? 'center', plain: pad(s, width, ln.align ?? 'center') })); continue; }
    if ('barcode' in ln) { rows.push({ text: '', plain: `[BARCODE] ${ln.barcode}`, custom: barcodeBlock(ln) }); wrapReceiptText(ln.label ?? ln.barcode, width).forEach((s) => rows.push({ text: s, align: ln.align ?? 'center', plain: pad(s, width, ln.align ?? 'center') })); continue; }
    const cells = 'dw' in ln && ln.dw ? Math.floor(width / 2) : width;
    const style = { bold: ln.bold, dh: ln.dh, dw: ln.dw };
    if ('cols' in ln) {
      const [l, r] = ln.cols.map((x) => String(x ?? '')) as [string, string];
      const leftMax = Math.max(1, cells - r.length - 1);
      const parts = wrapReceiptText(l, leftMax);
      parts.forEach((p, i) => {
        const last = i === parts.length - 1;
        const text = last ? p + ' '.repeat(Math.max(1, cells - p.length - r.length)) + r : p;
        rows.push({ ...style, text, plain: text });
      });
      continue;
    }
    const align = ln.align ?? 'left';
    wrapReceiptText(ln.text, cells).forEach((s) => {
      const text = ln.invert ? pad(s, cells, align).padEnd(cells) : s;
      rows.push({ ...style, text: ln.invert ? text : s, align, invert: ln.invert, plain: pad(s, cells, align) });
    });
  }
  return rows;
}

function qrBlock(ln: ReceiptQrLine, width: number): HTMLElement {
  const box = h('div', { class: 'b24-receipt__qr', style: `justify-content:${(ln.align ?? 'center') === 'left' ? 'flex-start' : ln.align === 'right' ? 'flex-end' : 'center'}` });
  try { box.innerHTML = qrSvg(ln.qr, { size: Math.round(width * 3.4 * 8), ecc: ln.ecc ?? 'M', margin: 1 }); } catch { box.textContent = '[QR]'; }
  const svg = box.querySelector('svg');
  if (svg) { svg.removeAttribute('width'); svg.removeAttribute('height'); svg.setAttribute('aria-label', ln.qr); (svg as unknown as HTMLElement).style.width = `${Math.round(width * 0.5)}ch`; }
  return box;
}

/** Заглушка штрихкода: ширина полосы по цифре — выглядит как код, но не сканируется. */
function barcodeBlock(ln: ReceiptBarcodeLine): HTMLElement {
  const box = h('div', { class: 'b24-receipt__barcode', 'aria-label': ln.barcode, role: 'img', style: `justify-content:${(ln.align ?? 'center') === 'left' ? 'flex-start' : ln.align === 'right' ? 'flex-end' : 'center'}` });
  const bars = h('div', { class: 'b24-receipt__bars' });
  for (const ch of `1${ln.barcode}1`) {
    const d = Number(ch) || 1;
    bars.append(h('i', { style: `width:${(d % 4) + 1}px` }), h('i', { class: 'is-gap', style: `width:${((d * 3) % 3) + 1}px` }));
  }
  box.append(bars);
  return box;
}

export function createReceipt(host: HTMLElement, options: ReceiptOptions = {}): ReceiptHandle {
  let paper: 58 | 80 = options.paper ?? 80;
  let width = options.width ?? PAPER_WIDTH[paper];
  let lines = options.lines ?? [];
  const root = h('div', { class: 'b24-receipt-wrap' });
  const paperEl = h('div', { class: `b24-receipt${options.torn === false ? '' : ' is-torn'}`, role: 'img' });
  const body = h('div', { class: 'b24-receipt__body' });
  paperEl.append(body);
  let switcher: HTMLElement | null = null;
  if (options.switcher) {
    switcher = h('div', { class: 'b24-receipt__switch', role: 'radiogroup', 'aria-label': t('Ширина ленты') });
    for (const p of [58, 80] as const) {
      const b = h('button', { type: 'button', role: 'radio', class: 'b24-receipt__paper', 'data-paper': String(p) }, `${p} ${t('мм')}`);
      b.addEventListener('click', () => { handle.setPaper(p); options.onPaperChange?.(p, width); });
      switcher.append(b);
    }
    root.append(switcher);
  }
  root.append(paperEl);
  host.append(root);

  let rows: Row[] = [];
  const paint = () => {
    paperEl.style.setProperty('--b24-receipt-cols', String(width));
    paperEl.setAttribute('aria-label', `${t('Чек')}, ${width} ${t('символов в строке')}`);
    switcher?.querySelectorAll<HTMLElement>('.b24-receipt__paper').forEach((b) => {
      const on = Number(b.dataset.paper) === paper && width === PAPER_WIDTH[paper];
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });
    rows = layoutReceipt(lines, width);
    body.replaceChildren(...rows.map((r) => {
      if (r.custom) return r.custom;
      const line = h('div', { class: `b24-receipt__row${r.invert ? ' is-invert' : ''}${r.bold ? ' is-bold' : ''}${r.dh ? ' is-dh' : ''}${r.dw ? ' is-dw' : ''}`, style: r.align && !r.invert ? `text-align:${r.align}` : undefined });
      const inner = h('span', { class: 'b24-receipt__text', style: `--n:${r.text.length}` }, r.text || ' ');
      if (r.invert) { line.style.textAlign = r.align ?? 'left'; }
      line.append(inner);
      return line;
    }));
  };
  paint();

  const handle: ReceiptHandle = {
    element: root,
    setLines(next) { lines = next; paint(); },
    setPaper(p) { paper = p; width = PAPER_WIDTH[p]; paint(); },
    setWidth(w) { width = Math.max(8, Math.round(w)); paint(); },
    getWidth: () => width,
    getText: () => rows.map((r) => r.plain.replace(/\s+$/, '')).join('\n'),
    destroy() { root.remove(); },
  };
  return handle;
}

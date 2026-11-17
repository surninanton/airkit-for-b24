/**
 * QR-код без зависимостей: байтовый режим, версии 1–10 (до ~210 байт при уровне M), уровни L/M/Q/H.
 * Для предпросмотра чека, ссылок и подписей. Алгоритм — по ISO/IEC 18004 (Рид-Соломон над GF(256), 8 масок).
 *   qrMatrix(text, ecc?)         — матрица модулей boolean[][]
 *   qrSvg(text, { size, ecc, margin, color, background }) — SVG-строка
 *   createQr(host, text, options) — вставляет SVG, возвращает { element, update(text) }
 */
import { h, html } from './dom';

export type QrEcc = 'L' | 'M' | 'Q' | 'H';
const ECC_IDX: Record<QrEcc, number> = { L: 0, M: 1, Q: 2, H: 3 };
const FORMAT_BITS: Record<QrEcc, number> = { L: 1, M: 0, Q: 3, H: 2 };
// индекс — версия 1…10 (0 — пустой)
const ECC_PER_BLOCK = [
  [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
];
const BLOCKS = [
  [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
];
const MAX_VERSION = 10;

/** всего кодовых слов (данные + коррекция) в версии */
function rawCodewords(ver: number): number {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const a = Math.floor(ver / 7) + 2;
    n -= (25 * a - 10) * a - 55;
    if (ver >= 7) n -= 36;
  }
  return Math.floor(n / 8);
}
const dataCodewords = (ver: number, e: number) => rawCodewords(ver) - ECC_PER_BLOCK[e][ver] * BLOCKS[e][ver];

/* GF(256), многочлен 0x11D */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gmul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsGenerator(deg: number): number[] {
  let poly = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gmul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}
function rsRemainder(data: number[], deg: number): number[] {
  const gen = rsGenerator(deg);
  const rem = new Array(deg).fill(0);
  for (const b of data) {
    const factor = b ^ rem.shift()!;
    rem.push(0);
    for (let i = 0; i < deg; i++) rem[i] ^= gmul(gen[i + 1], factor);
  }
  return rem;
}

function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function encodeData(bytes: number[], ver: number, e: number): number[] {
  const bits: number[] = [];
  const put = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  const cap = dataCodewords(ver, e) * 8;
  put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  return out;
}

function interleave(data: number[], ver: number, e: number): number[] {
  const blocks = BLOCKS[e][ver];
  const eccLen = ECC_PER_BLOCK[e][ver];
  const raw = rawCodewords(ver);
  const shortBlocks = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks) - eccLen;
  const parts: Array<{ data: number[]; ecc: number[] }> = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const len = shortLen + (i < shortBlocks ? 0 : 1);
    const d = data.slice(k, k + len);
    k += len;
    parts.push({ data: d, ecc: rsRemainder(d, eccLen) });
  }
  const out: number[] = [];
  for (let i = 0; i <= shortLen; i++) parts.forEach((p) => { if (i < p.data.length) out.push(p.data[i]); });
  for (let i = 0; i < eccLen; i++) parts.forEach((p) => out.push(p.ecc[i]));
  return out;
}

function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const res = [6];
  for (let pos = ver * 4 + 10; res.length < n; pos -= step) res.splice(1, 0, pos);
  return res;
}

/** Матрица модулей (true — тёмный). Бросает, если текст не помещается в версию 10. */
export function qrMatrix(text: string, ecc: QrEcc = 'M'): boolean[][] {
  const e = ECC_IDX[ecc];
  const bytes = utf8(text);
  let ver = 1;
  for (; ver <= MAX_VERSION; ver++) {
    const need = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
    if (need <= dataCodewords(ver, e) * 8) break;
  }
  if (ver > MAX_VERSION) throw new Error(`QR: текст слишком длинный (${bytes.length} байт)`);
  const size = ver * 4 + 17;
  const mod: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x: number, y: number, v: boolean) => { mod[y][x] = v; fn[y][x] = true; };

  // шаблоны: поисковые, выравнивающие, служебные линии
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  for (let i = 0; i < size; i++) { if (!fn[6][i]) set(i, 6, i % 2 === 0); if (!fn[i][6]) set(6, i, i % 2 === 0); }
  const al = alignmentPositions(ver);
  al.forEach((cy, i) => al.forEach((cx, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));

  const drawFormat = (mask: number) => {
    const d = (FORMAT_BITS[ecc] << 3) | mask;
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const bits = ((d << 10) | r) ^ 0x5412;
    const b = (i: number) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, b(i));
    set(8, 7, b(6)); set(8, 8, b(7)); set(7, 8, b(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, b(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, b(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, b(i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let r = ver;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const bits = (ver << 12) | r;
    for (let i = 0; i < 18; i++) {
      const v = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3), bb = Math.floor(i / 3);
      set(a, bb, v); set(bb, a, v);
    }
  }

  // данные зигзагом
  const codewords = interleave(encodeData(bytes, ver, e), ver, e);
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fn[y][x] && bi < codewords.length * 8) {
          mod[y][x] = ((codewords[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1;
          bi++;
        }
      }
    }
  }

  const MASKS: Array<(x: number, y: number) => boolean> = [
    (x, y) => (x + y) % 2 === 0, (_x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const apply = (m: number) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x]; };

  const penalty = (): number => {
    let p = 0;
    const lines = (get: (a: number, b: number) => boolean) => {
      for (let a = 0; a < size; a++) {
        let run = 1;
        const arr: boolean[] = [];
        for (let b = 0; b < size; b++) arr.push(get(a, b));
        for (let b = 1; b < size; b++) {
          if (arr[b] === arr[b - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p += 1; } else run = 1;
        }
        const s = arr.map((v) => (v ? '1' : '0')).join('');
        for (const pat of ['10111010000', '00001011101']) { let i = -1; while ((i = s.indexOf(pat, i + 1)) >= 0) p += 40; }
      }
    };
    lines((a, b) => mod[a][b]);
    lines((a, b) => mod[b][a]);
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = mod[y][x]; if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3; }
    let dark = 0;
    for (const row of mod) for (const c of row) if (c) dark++;
    p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    return p;
  };

  let best = 0, bestP = Infinity;
  for (let m = 0; m < 8; m++) {
    apply(m); drawFormat(m);
    const p = penalty();
    if (p < bestP) { best = m; bestP = p; }
    apply(m);
  }
  apply(best); drawFormat(best);
  return mod;
}

export interface QrSvgOptions {
  /** сторона в px (по умолчанию 160) */
  size?: number;
  ecc?: QrEcc;
  /** тихая зона в модулях (по умолчанию 2) */
  margin?: number;
  color?: string;
  background?: string;
}

/** SVG-строка QR-кода: один path, чёткие границы (shape-rendering: crispEdges). */
export function qrSvg(text: string, options: QrSvgOptions = {}): string {
  const m = qrMatrix(text, options.ecc ?? 'M');
  const margin = options.margin ?? 2;
  const n = m.length + margin * 2;
  const size = options.size ?? 160;
  let d = '';
  m.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) { x++; continue; }
      let e = x;
      while (e < row.length && row[e]) e++;
      d += `M${x + margin} ${y + margin}h${e - x}v1h-${e - x}z`;
      x = e;
    }
  });
  const bg = options.background ?? '#fff';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img"><rect width="${n}" height="${n}" fill="${bg}"/><path d="${d}" fill="${options.color ?? '#000'}"/></svg>`;
}

export interface QrOptions extends QrSvgOptions {
  /** подпись под кодом */
  label?: string;
  /** alt для скринридеров (по умолчанию — сам текст) */
  alt?: string;
}
export interface QrHandle { element: HTMLElement; update(text: string): void; destroy(): void }

/** QR-код в элементе: `createQr(host, 'https://example.com', { size: 120, label: 'Оцените заказ' })`. */
export function createQr(host: HTMLElement, text: string, options: QrOptions = {}): QrHandle {
  const root = h('figure', { class: 'b24-qr' });
  const box = h('div', { class: 'b24-qr__code' });
  const cap = h('figcaption', { class: 'b24-qr__label' });
  root.append(box, cap);
  host.append(root);
  const paint = (value: string) => {
    try { box.replaceChildren(html(qrSvg(value, options))); box.setAttribute('aria-label', options.alt ?? value); box.removeAttribute('data-error'); }
    catch { box.replaceChildren(h('span', { class: 'b24-qr__error' }, '⚠')); box.setAttribute('data-error', 'true'); }
    cap.textContent = options.label ?? '';
    cap.hidden = !options.label;
  };
  paint(text);
  return { element: root, update: paint, destroy: () => root.remove() };
}

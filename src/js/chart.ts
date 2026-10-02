import { escapeHtml } from './dom';
import { intlLocale, t } from './i18n';

/* ── Графики дашборда ─────────────────────────────────────
 * Линия, область, столбцы (рядом или стопкой), кольцо и спарклайн. SVG без зависимостей.
 * Цвета серий — токены --b24-chart-1…6 в фиксированном порядке (тема меняется без перерисовки).
 * Есть подсказка при наведении, легенда (от двух серий) и скрытая таблица для скринридеров.
 */

export type ChartType = 'line' | 'area' | 'bar' | 'donut';

export interface ChartSeries {
  name: string;
  data: number[];
  /** свой цвет вместо токена палитры; лучше не задавать — палитра проверена на различимость */
  color?: string;
}

export interface ChartOptions {
  type: ChartType;
  /** подписи по оси X; для кольца — названия долей */
  labels: string[];
  series: ChartSeries[];
  /** столбцы стопкой */
  stacked?: boolean;
  /** высота области графика, px (по умолчанию 240, у кольца — 180) */
  height?: number;
  /** формат значения в подсказке и легенде; по умолчанию «12 345» */
  format?: (value: number) => string;
  /** формат подписей оси Y; по умолчанию «12 тыс.» */
  axisFormat?: (value: number) => string;
  /** легенда: по умолчанию — от двух серий и у кольца */
  legend?: boolean;
  /** подпись в центре кольца под суммой */
  centerLabel?: string;
  /** название графика для скринридеров */
  title?: string;
}

export interface ChartHandle {
  update(options: Partial<ChartOptions>): void;
  destroy(): void;
}

const NS = 'http://www.w3.org/2000/svg';
const MAX_BAR = 24;
const nf = { format: (v: number) => new Intl.NumberFormat(intlLocale()).format(v) };
const compact = { format: (v: number) => new Intl.NumberFormat(intlLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(v) };

export const chartColor = (i: number, s?: ChartSeries) => s?.color ?? `var(--b24-chart-${(i % 6) + 1})`;

/** «Круглые» деления оси: шаг 1/2/5 × 10^k, 4–5 делений */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.append(node);
  return node;
};

/** Столбец: скругление 4px только на конце со значением, у базовой линии — прямой угол */
function barPath(x: number, w: number, y0: number, y1: number, round: boolean): string {
  const up = y1 <= y0;
  const h = Math.abs(y1 - y0);
  const r = round ? Math.min(4, w / 2, h) : 0;
  if (up) return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}

export function createChart(root: HTMLElement, initial: ChartOptions): ChartHandle {
  let o: ChartOptions = { ...initial };
  root.classList.add('b24-chart');
  const plot = document.createElement('div');
  plot.className = 'b24-chart__plot';
  const tip = document.createElement('div');
  tip.className = 'b24-chart__tip';
  tip.hidden = true;
  const legend = document.createElement('ul');
  legend.className = 'b24-chart__legend';
  const table = document.createElement('table');
  table.className = 'b24-sr-only';
  root.replaceChildren(plot, legend, table, tip);

  const fmt = (v: number) => (o.format ?? nf.format)(v);

  function renderTable() {
    const head = o.type === 'donut' ? `<th>${t('Доля')}</th><th>${t('Значение')}</th>` : `<th></th>${o.series.map((s) => `<th>${escapeHtml(s.name)}</th>`).join('')}`;
    const rows = o.type === 'donut'
      ? o.labels.map((l, i) => `<tr><th>${escapeHtml(l)}</th><td>${fmt(o.series[0]?.data[i] ?? 0)}</td></tr>`)
      : o.labels.map((l, i) => `<tr><th>${escapeHtml(l)}</th>${o.series.map((s) => `<td>${fmt(s.data[i] ?? 0)}</td>`).join('')}</tr>`);
    table.innerHTML = `${o.title ? `<caption>${escapeHtml(o.title)}</caption>` : ''}<thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody>`;
  }

  function renderLegend() {
    const donut = o.type === 'donut';
    const show = o.legend ?? (donut || o.series.length > 1);
    legend.hidden = !show;
    if (!show) { legend.replaceChildren(); return; }
    const lineKey = o.type === 'line' || o.type === 'area';
    legend.innerHTML = donut
      ? o.labels.map((l, i) => `<li><span class="b24-chart__key" style="--c:${chartColor(i)}"></span>${escapeHtml(l)}<b>${fmt(o.series[0]?.data[i] ?? 0)}</b></li>`).join('')
      : o.series.map((s, i) => `<li><span class="b24-chart__key${lineKey ? ' b24-chart__key--line' : ''}" style="--c:${chartColor(i, s)}"></span>${escapeHtml(s.name)}</li>`).join('');
  }

  /** x, y — координаты в области графика; подсказка может выходить за неё в пределах всего блока */
  const showTip = (html: string, px: number, py: number) => {
    tip.innerHTML = html;
    tip.hidden = false;
    const x = px + plot.offsetLeft;
    const y = py + plot.offsetTop;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const W = root.clientWidth;
    let left = x + 14;
    // справа не помещается: слева от точки, а если и там нет места — прижимаем к правому краю
    if (left + tw > W) left = x - tw - 14 >= 0 ? x - tw - 14 : W - tw;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${Math.max(0, Math.min(y - th / 2, root.clientHeight - th))}px`;
  };
  const hideTip = () => { tip.hidden = true; plot.classList.remove('is-hover'); plot.querySelectorAll('.is-hover').forEach((n) => n.classList.remove('is-hover')); };
  const row = (color: string, name: string, value: string) =>
    `<div class="b24-chart__tip-row"><span class="b24-chart__key" style="--c:${color}"></span>${escapeHtml(name)}<b>${value}</b></div>`;

  let svg: SVGSVGElement | null = null;

  function renderDonut(size: number) {
    const data = (o.series[0]?.data ?? []).map((v) => Math.max(0, v));
    const total = data.reduce((a, b) => a + b, 0);
    svg = el('svg', { viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': o.title ?? t('Диаграмма') });
    const c = size / 2;
    const R = size / 2 - 2;
    const r = R * 0.64;
    let a0 = -Math.PI / 2;
    const slices: SVGPathElement[] = [];
    data.forEach((v, i) => {
      if (!total || !v) return;
      const a1 = a0 + (v / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad: number, a: number) => `${c + rad * Math.cos(a)},${c + rad * Math.sin(a)}`;
      // целый круг одной долей: две дуги, иначе SVG не нарисует
      const d = v === total
        ? `M${p(R, 0)}A${R},${R} 0 1 1 ${p(R, Math.PI)}A${R},${R} 0 1 1 ${p(R, 0)}M${p(r, 0)}A${r},${r} 0 1 0 ${p(r, Math.PI)}A${r},${r} 0 1 0 ${p(r, 0)}Z`
        : `M${p(R, a0)}A${R},${R} 0 ${large} 1 ${p(R, a1)}L${p(r, a1)}A${r},${r} 0 ${large} 0 ${p(r, a0)}Z`;
      const path = el('path', { d, class: 'b24-chart__slice', 'fill-rule': 'evenodd', style: `fill:${chartColor(i)}` }, svg!);
      path.dataset.i = String(i);
      slices.push(path);
      a0 = a1;
    });
    el('text', { x: c, y: c + 2, 'text-anchor': 'middle', class: 'b24-chart__center' }, svg).textContent = compact.format(total);
    if (o.centerLabel) el('text', { x: c, y: c + 20, 'text-anchor': 'middle', class: 'b24-chart__center-label' }, svg).textContent = o.centerLabel;
    svg.addEventListener('pointermove', (e) => {
      const t = (e.target as Element).closest('.b24-chart__slice') as SVGPathElement | null;
      if (!t) { hideTip(); return; }
      const i = Number(t.dataset.i);
      slices.forEach((s) => s.classList.toggle('is-hover', s === t));
      plot.classList.add('is-hover');
      const box = plot.getBoundingClientRect();
      const pct = total ? Math.round((data[i] / total) * 1000) / 10 : 0;
      showTip(row(chartColor(i), o.labels[i] ?? '', `${fmt(data[i])} · ${pct}%`), e.clientX - box.left, e.clientY - box.top);
    });
    svg.addEventListener('pointerleave', hideTip);
    plot.prepend(svg);
  }

  function renderXY(W: number, H: number) {
    const n = o.labels.length;
    const stacked = o.type === 'bar' && !!o.stacked;
    let lo = 0;
    let hi = 0;
    for (let i = 0; i < n; i++) {
      if (stacked) {
        let pos = 0; let neg = 0;
        for (const s of o.series) { const v = s.data[i] ?? 0; if (v >= 0) pos += v; else neg += v; }
        hi = Math.max(hi, pos); lo = Math.min(lo, neg);
      } else for (const s of o.series) { const v = s.data[i] ?? 0; hi = Math.max(hi, v); lo = Math.min(lo, v); }
    }
    const ticks = niceTicks(lo, hi);
    const axisFmt = o.axisFormat ?? ((v: number) => (Math.abs(v) >= 10000 ? compact.format(v) : nf.format(v)));
    const tickW = Math.max(...ticks.map((t) => axisFmt(t).length)) * 6.6 + 10;
    const single = o.series.length === 1 && o.type !== 'bar';
    const endLabelW = single ? fmt(o.series[0].data[n - 1] ?? 0).length * 7 + 12 : 8;
    const pad = { l: tickW, r: endLabelW, t: 8, b: 24 };
    const pw = Math.max(10, W - pad.l - pad.r);
    const ph = Math.max(10, H - pad.t - pad.b);
    const y = (v: number) => pad.t + ph - ((v - ticks[0]) / (ticks[ticks.length - 1] - ticks[0])) * ph;
    const band = pw / Math.max(1, n);
    // линии: точки от края до края; столбцы: по центру полосы
    const x = (i: number) => (o.type === 'bar' ? pad.l + band * i + band / 2 : pad.l + (n > 1 ? (pw * i) / (n - 1) : pw / 2));

    svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': o.title ?? t('График') });
    const gGrid = el('g', {}, svg);
    for (const t of ticks) {
      el('line', { x1: pad.l, x2: pad.l + pw, y1: y(t), y2: y(t), class: t === 0 ? 'b24-chart__baseline' : 'b24-chart__grid' }, gGrid);
      el('text', { x: pad.l - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'b24-chart__tick' }, gGrid).textContent = axisFmt(t);
    }
    // подписи X: прореживаем, чтобы не наезжали
    const labelW = Math.max(...o.labels.map((l) => l.length)) * 6.4 + 10;
    const every = Math.max(1, Math.ceil((labelW * n) / pw));
    o.labels.forEach((l, i) => {
      if (i % every) return;
      el('text', { x: x(i), y: H - 6, 'text-anchor': o.type === 'bar' ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle', class: 'b24-chart__tick' }, gGrid).textContent = l;
    });

    const marks = el('g', {}, svg);
    const bars: SVGPathElement[][] = Array.from({ length: n }, () => []);
    if (o.type === 'bar') {
      const k = stacked ? 1 : o.series.length;
      const gap = 2;
      const w = Math.max(2, Math.min(MAX_BAR, (band * 0.7 - gap * (k - 1)) / k));
      for (let i = 0; i < n; i++) {
        let pos = 0; let neg = 0;
        const groupW = stacked ? w : w * k + gap * (k - 1);
        // в стопке скругляется только крайний сегмент
        const lastPos = stacked ? o.series.map((s) => s.data[i] ?? 0).map((v, j) => (v > 0 ? j : -1)).reduce((a, b) => Math.max(a, b), -1) : -1;
        o.series.forEach((s, j) => {
          const v = s.data[i] ?? 0;
          if (!v) return;
          let y0: number; let y1: number;
          if (stacked) {
            const base = v >= 0 ? pos : neg;
            y0 = y(base); y1 = y(base + v);
            if (v >= 0) pos += v; else neg += v;
            // зазор 2px цвета подложки между сегментами
            if (base !== 0) y0 += v >= 0 ? -gap / 2 : gap / 2;
          } else { y0 = y(0); y1 = y(v); }
          const bx = x(i) - groupW / 2 + (stacked ? 0 : j * (w + gap));
          const p = el('path', { d: barPath(bx, w, y0, y1, !stacked || j === lastPos || v < 0), class: 'b24-chart__bar', style: `fill:${chartColor(j, s)}` }, marks);
          bars[i].push(p);
        });
      }
    } else {
      o.series.forEach((s, j) => {
        const pts = s.data.slice(0, n).map((v, i) => [x(i), y(v ?? 0)] as const);
        const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join('');
        // заливка только у одной серии: наложенные полупрозрачные заливки смешиваются в грязный цвет
        if (o.type === 'area' && o.series.length === 1) el('path', { d: `${d}L${pts[pts.length - 1][0]},${y(Math.max(0, ticks[0]))}L${pts[0][0]},${y(Math.max(0, ticks[0]))}Z`, class: 'b24-chart__area', style: `fill:${chartColor(j, s)}` }, marks);
        el('path', { d, class: 'b24-chart__line', style: `stroke:${chartColor(j, s)}` }, marks);
        const [ex, ey] = pts[pts.length - 1];
        el('circle', { cx: ex, cy: ey, r: 4, class: 'b24-chart__dot', style: `fill:${chartColor(j, s)}` }, marks);
        if (single) el('text', { x: ex + 8, y: ey + 4, class: 'b24-chart__end' }, marks).textContent = fmt(s.data[n - 1] ?? 0);
      });
    }

    // слой наведения: ближайшая точка по X
    const cross = el('line', { y1: pad.t, y2: pad.t + ph, class: 'b24-chart__cross', visibility: 'hidden' }, svg);
    const hoverDots = o.type === 'bar' ? [] : o.series.map((s, j) => el('circle', { r: 4, class: 'b24-chart__dot', visibility: 'hidden', style: `fill:${chartColor(j, s)}` }, svg!));
    const hit = el('rect', { x: pad.l - band / 2, y: 0, width: pw + band, height: H, fill: 'transparent' }, svg);
    const onMove = (e: PointerEvent) => {
      const box = svg!.getBoundingClientRect();
      const mx = ((e.clientX - box.left) / box.width) * W;
      const i = o.type === 'bar'
        ? Math.min(n - 1, Math.max(0, Math.floor((mx - pad.l) / band)))
        : Math.min(n - 1, Math.max(0, Math.round(((mx - pad.l) / pw) * (n - 1))));
      plot.classList.add('is-hover');
      if (o.type === 'bar') bars.forEach((g, gi) => g.forEach((b) => b.classList.toggle('is-hover', gi === i)));
      else {
        cross.setAttribute('x1', String(x(i))); cross.setAttribute('x2', String(x(i))); cross.setAttribute('visibility', 'visible');
        hoverDots.forEach((dot, j) => { dot.setAttribute('cx', String(x(i))); dot.setAttribute('cy', String(y(o.series[j].data[i] ?? 0))); dot.setAttribute('visibility', 'visible'); });
      }
      let html = `<div class="b24-chart__tip-title">${escapeHtml(o.labels[i] ?? '')}</div>${o.series.map((s, j) => row(chartColor(j, s), s.name, fmt(s.data[i] ?? 0))).join('')}`;
      if (stacked && o.series.length > 1) html += `<div class="b24-chart__tip-row">${t('Всего')}<b>${fmt(o.series.reduce((a, s) => a + (s.data[i] ?? 0), 0))}</b></div>`;
      const scale = box.width / W;
      const top = o.type === 'bar' ? y(Math.max(...o.series.map((s) => s.data[i] ?? 0))) : y(o.series[0].data[i] ?? 0);
      showTip(html, x(i) * scale, top * scale);
    };
    const onLeave = () => { hideTip(); cross.setAttribute('visibility', 'hidden'); hoverDots.forEach((d) => d.setAttribute('visibility', 'hidden')); };
    hit.addEventListener('pointermove', onMove);
    hit.addEventListener('pointerdown', onMove);
    hit.addEventListener('pointerleave', onLeave);
    plot.prepend(svg);
  }

  function render() {
    svg?.remove();
    hideTip();
    const donut = o.type === 'donut';
    root.classList.toggle('b24-chart--donut', donut);
    if (o.height) root.style.setProperty('--b24-chart-h', `${o.height}px`);
    const W = plot.clientWidth || 600;
    const H = plot.clientHeight || o.height || (donut ? 180 : 240);
    if (donut) renderDonut(Math.min(W, H)); else renderXY(W, H);
    renderLegend();
    renderTable();
  }

  let lastW = -1;
  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => { if (plot.clientWidth !== lastW) { lastW = plot.clientWidth; render(); } })
    : null;
  ro?.observe(plot);
  render();

  return {
    update(next) { o = { ...o, ...next }; render(); },
    destroy() { ro?.disconnect(); root.replaceChildren(); root.classList.remove('b24-chart', 'b24-chart--donut'); },
  };
}

/** Спарклайн: линия тренда без осей, точка на последнем значении */
export function sparkline(target: HTMLElement | SVGSVGElement, data: number[], options: { color?: string; width?: number; height?: number } = {}): void {
  const W = options.width ?? (target.clientWidth || 96);
  const H = options.height ?? (target.clientHeight || 32);
  const svg = target instanceof SVGSVGElement ? target : el('svg', {});
  if (!(target instanceof SVGSVGElement)) target.replaceChildren(svg);
  svg.classList.add('b24-sparkline');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('aria-hidden', 'true');
  if (options.color) svg.style.setProperty('--b24-sparkline-color', options.color);
  if (!data.length) { svg.replaceChildren(); return; }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const r = 4;
  const px = (i: number) => r + (data.length > 1 ? ((W - r * 2) * i) / (data.length - 1) : (W - r * 2) / 2);
  const py = (v: number) => r + (max === min ? (H - r * 2) / 2 : (H - r * 2) * (1 - (v - min) / (max - min)));
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join('');
  svg.innerHTML = `<path d="${d}"/><circle cx="${px(data.length - 1)}" cy="${py(data[data.length - 1])}" r="3.5"/>`;
}

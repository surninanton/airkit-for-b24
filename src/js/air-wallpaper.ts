/**
 * Обои страницы с гарантией читаемости: картинка ставится фоном Air, а кит замеряет её яркость и пестроту
 * под боковым меню, шапкой и страницей и подбирает затемнение (scrim) и размытие, чтобы белый текст держал контраст
 * (WCAG 1.4.3: 4.5:1 для меню и мелкого текста, 3:1 для крупных заголовков).
 *
 *   const info = await setAirWallpaper('/wallpapers/forest.jpg');   // → { sidebar, header, page, blur, … }
 *   setAirWallpaper(null);                                          // вернуть штатный фон
 *   setAirWallpaper(url, { strength: 'strong' });                   // 'soft' | 'auto' | 'strong'
 *
 * Результат пишется в переменные на <html> (--b24-wp-*) и в data-b24-wallpaper; стили кита (сайдбар, шапка оболочки,
 * заголовки на подложке, панель мессенджера) читают их сами. Картинка с чужого домена без CORS не читается:
 * тогда берутся осторожные значения по умолчанию. Пересчёт — при изменении размера окна.
 */
export interface WallpaperOptions {
  /** сила затемнения: soft — минимум для 3:1, auto — по WCAG, strong — с запасом */
  strength?: 'soft' | 'auto' | 'strong';
  /** корень, куда писать переменные */
  root?: HTMLElement;
  /** ширина бокового меню в px, если нет .b24-shell__sidebar */
  sidebarWidth?: number;
  /** высота шапки в px, если нет .b24-shell__header */
  headerHeight?: number;
}
export interface WallpaperAnalysis {
  /** непрозрачность затемнения под боковым меню, шапкой и по всей странице (0…1) */
  sidebar: number;
  header: number;
  page: number;
  /** размытие под меню, px */
  blur: number;
  /** яркость самых светлых мест под меню (0 — чёрный, 1 — белый) и пестрота (0 — гладко, 1 — очень пёстро) */
  luma: number;
  busy: number;
  /** картинку не удалось прочитать (CORS): значения по умолчанию */
  fallback: boolean;
}

const SCRIM = '8, 14, 30';
const SCRIM_LUM = 0.005;
let current: { src: string; img: HTMLImageElement | null; options: WallpaperOptions } | null = null;
let onResize: (() => void) | null = null;

const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };

/** затемнение, при котором самый светлый пиксель зоны даёт белому тексту контраст ratio */
export function scrimFor(lightest: number, ratio: number): number {
  const target = 1.05 / ratio - 0.05; // допустимая яркость фона под белым текстом
  if (lightest <= target) return 0;
  return Math.min(0.88, (lightest - target) / (lightest - SCRIM_LUM));
}

interface Zone { x0: number; x1: number; y0: number; y1: number }
function measure(data: Uint8ClampedArray, w: number, zone: Zone): { p85: number; busy: number } {
  const lums: number[] = [];
  let diff = 0, pairs = 0;
  for (let y = zone.y0; y < zone.y1; y++) {
    let prev = -1;
    for (let x = zone.x0; x < zone.x1; x++) {
      const i = (y * w + x) * 4;
      const l = 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]);
      lums.push(l);
      if (prev >= 0) { diff += Math.abs(Math.sqrt(l) - Math.sqrt(prev)); pairs++; }
      prev = l;
    }
  }
  if (!lums.length) return { p85: 0, busy: 0 };
  lums.sort((a, b) => a - b);
  return { p85: lums[Math.min(lums.length - 1, Math.floor(lums.length * 0.85))], busy: Math.min(1, (pairs ? diff / pairs : 0) * 6) };
}

function analyze(img: HTMLImageElement, o: WallpaperOptions): WallpaperAnalysis | null {
  const vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
  const W = 160, H = Math.max(40, Math.round((W * vh) / vw));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // как background-size: cover по центру
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, W, H).data; } catch { return null; }
  const sb = document.querySelector<HTMLElement>('.b24-shell__sidebar');
  const hd = document.querySelector<HTMLElement>('.b24-shell__header');
  const sbw = Math.min(vw, sb?.getBoundingClientRect().width || o.sidebarWidth || 240);
  const hdh = Math.min(vh, hd?.getBoundingClientRect().height || o.headerHeight || 64);
  const px = (v: number, total: number, size: number) => Math.max(1, Math.min(size, Math.round((v / total) * size)));
  const sideZone: Zone = { x0: 0, x1: px(sbw, vw, W), y0: 0, y1: H };
  const headZone: Zone = { x0: sideZone.x1, x1: W, y0: 0, y1: px(hdh, vh, H) };
  const pageZone: Zone = { x0: sideZone.x1, x1: W, y0: headZone.y1, y1: H };
  const side = measure(data, W, sideZone), head = measure(data, W, headZone), page = measure(data, W, pageZone);
  const k = o.strength === 'strong' ? { t: 7, p: 4.5 } : o.strength === 'soft' ? { t: 3.5, p: 3 } : { t: 4.5, p: 3 };
  // пёстрая текстура мешает читать даже на тёмном: минимум затемнения и размытие по пестроте
  const sidebar = Math.max(scrimFor(side.p85, k.t), 0.18 + 0.3 * side.busy);
  const header = Math.max(scrimFor(head.p85, k.p), 0.1 + 0.2 * head.busy);
  const pageA = Math.min(0.5, scrimFor(page.p85, k.p) * 0.7);
  return {
    sidebar: round(Math.min(0.88, sidebar)), header: round(Math.min(0.8, header)), page: round(pageA),
    blur: Math.round(8 + 14 * Math.max(side.busy, head.busy)),
    luma: round(Math.sqrt(side.p85)), busy: round(side.busy), fallback: false,
  };
}
const round = (v: number) => Math.round(v * 100) / 100;
const FALLBACK: WallpaperAnalysis = { sidebar: 0.6, header: 0.4, page: 0.25, blur: 18, luma: 0.6, busy: 0.5, fallback: true };

function apply(src: string, a: WallpaperAnalysis, root: HTMLElement) {
  const st = root.style;
  st.setProperty('--b24-wp-scrim', SCRIM);
  st.setProperty('--b24-wp-a-side', String(a.sidebar));
  st.setProperty('--b24-wp-a-head', String(a.header));
  st.setProperty('--b24-wp-a-page', String(a.page));
  st.setProperty('--b24-wp-blur', `${a.blur}px`);
  st.setProperty('--b24-air-bg-image', `linear-gradient(rgba(${SCRIM}, ${a.page}), rgba(${SCRIM}, ${a.page})), url("${src.replace(/"/g, '%22')}")`);
  root.dataset.b24Wallpaper = a.fallback ? 'unknown' : a.luma > 0.65 ? 'light' : 'dark';
}

const loadImage = (src: string, anonymous: boolean) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  if (anonymous) img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('wallpaper'));
  img.src = src;
});

export function clearAirWallpaper(root: HTMLElement = document.documentElement): void {
  ['--b24-wp-scrim', '--b24-wp-a-side', '--b24-wp-a-head', '--b24-wp-a-page', '--b24-wp-blur', '--b24-air-bg-image'].forEach((p) => root.style.removeProperty(p));
  delete root.dataset.b24Wallpaper;
  if (onResize) { window.removeEventListener('resize', onResize); onResize = null; }
  current = null;
}

/** Ставит обои и подбирает затемнение. null — штатный фон. Возвращает замер (или значения по умолчанию, если картинку не прочитать). */
export async function setAirWallpaper(src: string | null, options: WallpaperOptions = {}): Promise<WallpaperAnalysis | null> {
  const root = options.root ?? document.documentElement;
  if (!src) { clearAirWallpaper(root); return null; }
  let img: HTMLImageElement | null = null;
  let analysis: WallpaperAnalysis | null = null;
  try { img = await loadImage(src, true); analysis = analyze(img, options); } catch { img = null; }
  if (!analysis) analysis = FALLBACK;
  apply(src, analysis, root);
  current = { src, img, options };
  if (!onResize) {
    let timer = 0;
    onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!current?.img) return;
        const a = analyze(current.img, current.options);
        if (a) apply(current.src, a, current.options.root ?? document.documentElement);
      }, 200);
    };
    window.addEventListener('resize', onResize);
  }
  return analysis;
}

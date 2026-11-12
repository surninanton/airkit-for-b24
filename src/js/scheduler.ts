import { icon } from '../icons';
import { avatarHtml } from './avatar';
import { escapeHtml, h, html } from './dom';
import { intlLocale, t } from './i18n';
import { openEventEditor, openMenuAt, type SchedulerMenuItem } from './scheduler-editor';

export type { SchedulerMenuItem } from './scheduler-editor';

/* ── Планировщик: сотрудники × время ──────────────────────
 * Строки — сотрудники (с группировкой по отделам), шкала — день, неделя или месяц.
 * Фон строки — график работы и отсутствия (bands), поверх — встречи (events).
 * Встречи перетаскиваются по времени и между сотрудниками, растягиваются за края, создаются выделением.
 * Каждое изменение уходит в onChange/onCreate: промис отклонён — изменение откатывается.
 * Пересечения встреч у одного сотрудника и встречи вне рабочего времени подсвечиваются,
 * у сотрудника показана загрузка за видимый период. Строки виртуализированы.
 * editor — окно редактирования (название, тип, сотрудник, время, «весь день», комментарий, свои поля),
 * eventTypes — типы с цветом, contextMenu — меню по правой кнопке, масштаб — кнопками и Ctrl/⌘ + колесо,
 * копирование: Ctrl/⌘+C / V, Alt + перетаскивание, «Дублировать» в меню.
 */
export type SchedulerView = 'day' | 'week' | 'month';
export type DateInput = Date | string | number;
export type BandKind = 'work' | 'vacation' | 'sick' | 'trip' | 'off';

export interface SchedulerResource {
  id: string;
  name: string;
  avatar?: string;
  /** вторая строка: должность */
  meta?: string;
  /** отдел — строки группируются и сворачиваются */
  group?: string;
}
export interface SchedulerEvent {
  id: string;
  resourceId: string;
  start: DateInput;
  end: DateInput;
  title: string;
  /** цвет полосы; по умолчанию — основной цвет кита */
  color?: string;
  readonly?: boolean;
  /** без времени: выходной, отпуск, больничный — полоса на свои start–end, но в подписи, подсказке и aria-label только название
   *  (и день в подсказке); не помечается «вне рабочего времени» и «сотрудник отсутствует» */
  allDay?: boolean;
  /** id из eventTypes: цвет и «весь день» по умолчанию берутся из типа */
  type?: string;
  /** комментарий: поле в окне редактирования, значок на встрече, текст в подсказке */
  comment?: string;
  /** данные приложения; свои поля окна редактирования (editor.fields) пишутся сюда по name */
  data?: unknown;
}
/** тип события: «Встреча», «Звонок», «Выходной»… — цвет, подпись в легенде, пункт меню «Тип» */
export interface SchedulerEventType {
  id: string;
  label: string;
  color?: string;
  /** события этого типа — без времени (выходной, отпуск) */
  allDay?: boolean;
}
/** своё поле окна редактирования; значение — в event.data[name] */
export interface SchedulerEditorField {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'select';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
}
export interface SchedulerEditorOptions {
  fields?: SchedulerEditorField[];
  /** поле «Комментарий» (по умолчанию есть) */
  comment?: boolean;
  /** длительность новой встречи из меню «Создать», минуты (по умолчанию 60) */
  duration?: number;
}
/** что передаётся в contextMenu: где нажали и пункты по умолчанию */
export type SchedulerMenuContext =
  | { kind: 'event'; event: SchedulerEvent; items: SchedulerMenuItem[] }
  | { kind: 'slot'; resourceId: string; start: Date; end: Date; items: SchedulerMenuItem[] };
/** черновик новой встречи: выделение, меню «Создать», копия */
export interface SchedulerDraft {
  resourceId: string;
  start: Date;
  end: Date;
  title?: string;
  type?: string;
  allDay?: boolean;
  color?: string;
  comment?: string;
  data?: unknown;
  /** id встречи, с которой сделана копия */
  copyOf?: string;
}
/** интервал графика: смена (work) или отсутствие */
export interface SchedulerBand {
  resourceId: string;
  start: DateInput;
  end: DateInput;
  kind: BandKind;
  label?: string;
}
export interface SchedulerChange {
  event: SchedulerEvent;
  start: Date;
  end: Date;
  resourceId: string;
  previous: { start: Date; end: Date; resourceId: string };
}
export interface SchedulerOptions {
  resources: SchedulerResource[];
  events?: SchedulerEvent[];
  bands?: SchedulerBand[];
  /** загрузка данных периода (вызывается при смене вида и дат) */
  load?: (range: { start: Date; end: Date }, signal: AbortSignal) => Promise<{ events?: SchedulerEvent[]; bands?: SchedulerBand[] }>;
  view?: SchedulerView;
  /** дата, вокруг которой показывается период (по умолчанию сегодня) */
  date?: DateInput;
  /** шаг привязки, минуты (по умолчанию 15; в месяце — 60) */
  step?: number;
  /** видимые часы суток в дне и неделе: [8, 20] — ночь не показывается (по умолчанию [8, 20]); [0, 24] — сутки целиком */
  hours?: [number, number];
  /** высота области, px */
  height?: number;
  toolbar?: boolean;
  /** легенда под шкалой: true — типы и виды графика, которые есть в bands (по умолчанию); 'types' — только типы событий; false — без легенды */
  legend?: boolean | 'types';
  readonly?: boolean;
  /** выделение для onCreate — в пределах одного дня (по умолчанию нет: можно протянуть через полночь) */
  createWithinDay?: boolean;
  /** прокрутка шкалы при открытии и смене вида: 'now' — к сегодня / «сейчас» (по умолчанию), 'start' — к началу периода (в дне — к первому видимому часу) */
  initialScroll?: 'now' | 'start';
  /** подсказка над встречей; по умолчанию — название, время, сотрудник */
  tooltip?: (event: SchedulerEvent, resource?: SchedulerResource) => string;
  onChange?: (change: SchedulerChange) => void | Promise<unknown>;
  onCreate?: (draft: SchedulerDraft) => void | SchedulerEvent | Promise<SchedulerEvent | void>;
  /** окно редактирования: клик, двойной клик или Enter по встрече, «Изменить» в меню; новая встреча после выделения — тоже через окно */
  editor?: boolean | SchedulerEditorOptions;
  /** типы событий: цвет, «весь день», легенда, пункт меню «Тип» */
  eventTypes?: SchedulerEventType[];
  /** меню по правой кнопке (и клавише меню / Shift+F10 на встрече): true — пункты по умолчанию (по умолчанию),
   *  функция — получает контекст с пунктами по умолчанию и возвращает свои; false — без меню */
  contextMenu?: boolean | ((ctx: SchedulerMenuContext) => SchedulerMenuItem[] | false | void);
  /** сохранение из окна редактирования, смена типа в меню, копия. Если не задан — новые встречи уходят в onCreate,
   *  изменения — в onChange. Отклонённый промис — изменение не применяется (окно показывает ошибку).
   *  Для новой вернуть встречу с id сервера (иначе id сгенерируется) */
  onSave?: (event: SchedulerEvent, info: { isNew: boolean; previous?: SchedulerEvent }) => void | SchedulerEvent | Promise<SchedulerEvent | void>;
  onClick?: (event: SchedulerEvent) => void;
  onDelete?: (event: SchedulerEvent) => void | Promise<unknown>;
  onRangeChange?: (range: { view: SchedulerView; start: Date; end: Date }) => void;
}
export interface SchedulerHandle {
  element: HTMLElement;
  readonly view: SchedulerView;
  readonly range: { start: Date; end: Date };
  setView(view: SchedulerView): void;
  setDate(date: DateInput): void;
  prev(): void;
  next(): void;
  today(): void;
  setResources(resources: SchedulerResource[]): void;
  setEvents(events: SchedulerEvent[]): void;
  setBands(bands: SchedulerBand[]): void;
  getEvents(): SchedulerEvent[];
  /** прокрутить к моменту времени */
  scrollToTime(date: DateInput): void;
  /** открыть окно редактирования встречи */
  editEvent(id: string): void;
  /** открыть окно новой встречи с заполненными полями */
  createEvent(draft: SchedulerDraft): void;
  zoomIn(): void;
  zoomOut(): void;
  /** весь период на ширину области */
  zoomToFit(): void;
  destroy(): void;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const toDate = (d: DateInput) => (d instanceof Date ? new Date(d.getTime()) : new Date(d));
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** пикселей в часе по виду (умножается на зум) */
const PX: Record<SchedulerView, number> = { day: 64, week: 24, month: 2 };
const ROW_PAD = 4;
const GROUP_H = 32;

export function createScheduler(host: HTMLElement, options: SchedulerOptions): SchedulerHandle {
  const o = options;
  let view: SchedulerView = o.view ?? 'week';
  let anchor = startOfDay(o.date ? toDate(o.date) : new Date());
  let zoom = 1;
  let resources = o.resources;
  let events: Array<SchedulerEvent & { s: Date; e: Date }> = [];
  let bands: Array<SchedulerBand & { s: Date; e: Date }> = [];
  const collapsed = new Set<string>();
  let abort: AbortController | null = null;

  const fmtTime = () => new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' });
  /** «17:00–24:00»: конец ровно в полночь следующего дня — 24:00, а не 00:00 */
  const fmtRange = (a: Date, b: Date) => {
    const ft = fmtTime();
    const midnight = b.getHours() === 0 && b.getMinutes() === 0 && b > a && startOfDay(b).getTime() !== startOfDay(a).getTime();
    return `${ft.format(a)}–${midnight ? '24:00' : ft.format(b)}`;
  };
  const normEvents = (list: SchedulerEvent[]) => list.map((e) => ({ ...e, s: toDate(e.start), e: toDate(e.end) }));
  const normBands = (list: SchedulerBand[]) => list.map((b) => ({ ...b, s: toDate(b.start), e: toDate(b.end) }));
  events = normEvents(o.events ?? []);
  bands = normBands(o.bands ?? []);
  type Ev = SchedulerEvent & { s: Date; e: Date };
  const typeOf = (e: { type?: string }) => (e.type ? o.eventTypes?.find((x) => x.id === e.type) : undefined);
  const isAllDay = (e: SchedulerEvent) => e.allDay ?? typeOf(e)?.allDay ?? false;
  const colorOf = (e: SchedulerEvent) => e.color ?? typeOf(e)?.color;
  const editorOpts = (): SchedulerEditorOptions | null => (!o.editor || o.readonly ? null : o.editor === true ? {} : o.editor);
  const canCreate = () => !o.readonly && !!(o.onCreate || o.onSave);
  /** внутренняя встреча → для приложения: start/end — Date, без служебных s/e */
  const pub = (ev: Ev): SchedulerEvent => { const { s, e, ...rest } = ev; return { ...rest, start: s, end: e }; };
  const isEvent = (r: unknown): r is SchedulerEvent => !!r && typeof r === 'object' && 'id' in r;
  /** поля, которые переносятся в копию */
  const copyFields = (ev: SchedulerEvent) => ({ title: ev.title, type: ev.type, allDay: ev.allDay, color: ev.color, comment: ev.comment, data: ev.data });
  let copied: SchedulerEvent | null = null;
  /** последнее место под курсором — сюда вставляется копия по Ctrl/⌘+V */
  let lastSlot: { resourceId: string; time: Date } | null = null;
  let zoomInBtn: HTMLButtonElement | null = null;
  let zoomOutBtn: HTMLButtonElement | null = null;
  const MAX_ZOOM = 4;

  /* ── период и масштаб ── */
  const range = () => {
    if (view === 'day') return { start: anchor, end: addDays(anchor, 1) };
    if (view === 'week') { const mon = addDays(anchor, -((anchor.getDay() + 6) % 7)); return { start: mon, end: addDays(mon, 7) }; }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    return { start: first, end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) };
  };
  /** пикселей в часе: по виду и зуму, но шкала не уже видимой области */
  let fitPx = 0;
  const pxh = () => Math.max(PX[view] * zoom, fitPx);
  const stepMs = () => (o.step ?? (view === 'month' ? 60 : 15)) * 60_000;
  /** окно часов суток: в месяце — сутки целиком */
  const win = (): [number, number] => (view === 'month' ? [0, 24] : o.hours ?? [8, 20]);
  const dayW = () => (win()[1] - win()[0]) * pxh();
  const days = () => Math.round((range().end.getTime() - range().start.getTime()) / DAY);
  /** время → x: каждый день — окно часов, время вне окна прижимается к его краю */
  const x = (d: Date) => {
    const start = range().start;
    const di = Math.floor((startOfDay(d).getTime() - start.getTime() + 2 * HOUR) / DAY);
    if (di < 0) return 0;
    if (di >= days()) return days() * dayW();
    const [h0, h1] = win();
    const hrs = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    return di * dayW() + (Math.min(h1, Math.max(h0, hrs)) - h0) * pxh();
  };
  const width = () => days() * dayW();
  const timeAt = (px: number) => {
    const [h0, h1] = win();
    const di = Math.min(days() - 1, Math.max(0, Math.floor(px / dayW())));
    const within = Math.min(h1 - h0, Math.max(0, (px - di * dayW()) / pxh()));
    const d = addDays(range().start, di);
    return new Date(d.getTime() + (h0 + within) * HOUR);
  };
  const snap = (d: Date) => new Date(Math.round(d.getTime() / stepMs()) * stepMs());

  /* ── каркас ── */
  const root = h('div', { class: 'b24-scheduler', role: 'region', 'aria-label': t('Планировщик') });
  if (o.height) root.style.setProperty('--b24-scheduler-height', `${o.height}px`);
  const title = h('h2', { class: 'b24-scheduler__title' });
  const viewport = h('div', { class: 'b24-scheduler__viewport', tabindex: '-1' });
  const canvas = h('div', { class: 'b24-scheduler__canvas' });
  const head = h('div', { class: 'b24-scheduler__head' });
  const corner = h('div', { class: 'b24-scheduler__corner' }, t('Сотрудники'));
  const scale = h('div', { class: 'b24-scheduler__scale' });
  head.append(corner, scale);
  const body = h('div', { class: 'b24-scheduler__body' });
  const grid = h('div', { class: 'b24-scheduler__grid', 'aria-hidden': 'true' });
  const rowsLayer = h('div');
  body.append(grid, rowsLayer);
  canvas.append(head, body);
  viewport.append(canvas);
  const tip = h('div', { class: 'b24-scheduler__tip', role: 'tooltip', hidden: '' });

  if (o.toolbar !== false) {
    const bar = h('div', { class: 'b24-scheduler__toolbar' });
    const btn = (label: string, aria: string, fn: () => void, iconName?: Parameters<typeof icon>[0]) => {
      const b = h('button', { type: 'button', class: `b24-btn b24-btn--secondary b24-btn--sm${iconName ? ' b24-btn--icon' : ''}`, 'aria-label': aria }, iconName ? html(icon(iconName)) : label);
      b.addEventListener('click', fn);
      return b;
    };
    const nav = h('div', { class: 'b24-scheduler__nav' },
      btn('', t('Назад'), () => handle.prev(), 'chevronLeft'), btn(t('Сегодня'), t('Сегодня'), () => handle.today()), btn('', t('Вперёд'), () => handle.next(), 'chevronRight'));
    const seg = h('div', { class: 'b24-segmented', role: 'radiogroup', 'aria-label': t('Вид') });
    const name = `b24-sch-${Math.random().toString(36).slice(2, 7)}`;
    for (const [v, label] of [['day', t('День')], ['week', t('Неделя')], ['month', t('Месяц')]] as const) {
      const input = h('input', { type: 'radio', name, value: v }) as HTMLInputElement;
      input.checked = v === view;
      input.addEventListener('change', () => handle.setView(v));
      seg.append(h('label', {}, input, h('span', {}, label)));
    }
    zoomOutBtn = btn('', t('Уменьшить масштаб'), () => handle.zoomOut(), 'minus');
    zoomInBtn = btn('', t('Увеличить масштаб'), () => handle.zoomIn(), 'plus');
    const zoomBox = h('div', { class: 'b24-scheduler__zoom', role: 'group', 'aria-label': t('Масштаб') },
      zoomOutBtn, zoomInBtn, btn(t('По размеру'), t('По размеру'), () => handle.zoomToFit()));
    zoomBox.lastElementChild!.setAttribute('title', t('Весь период на ширину области'));
    bar.append(nav, title, zoomBox, seg);
    root.append(bar);
  }
  root.append(viewport);
  // легенда пересобирается при каждой отрисовке: пункты графика — только тех видов, что есть в bands
  const legend = o.legend !== false ? h('div', { class: 'b24-scheduler__legend' }) : null;
  if (legend) root.append(legend);
  let legendKey = '';
  const renderLegend = () => {
    if (!legend) return;
    const item = (label: string, bg: string) => `<span><i style="background:${bg}"></i>${escapeHtml(label)}</span>`;
    const kinds = new Set(bands.map((b) => b.kind));
    const out = o.eventTypes?.length
      ? o.eventTypes.map((ty) => item(ty.label, `color-mix(in srgb, ${ty.color ?? 'var(--b24-color-primary)'} 25%, var(--b24-bg-surface)); box-shadow: inset 2px 0 0 ${ty.color ?? 'var(--b24-color-primary)'}`))
      : [item(t('Встреча'), 'color-mix(in srgb, var(--b24-color-primary) 25%, var(--b24-bg-surface))')];
    if (o.legend !== 'types') {
      if (kinds.has('work')) {
        out.push(item(t('Рабочее время'), 'var(--b24-bg-surface); box-shadow: inset 0 0 0 1px var(--b24-divider-accent)'));
        out.push(item(t('Нерабочее время'), 'color-mix(in srgb, var(--b24-text-subtle) 10%, transparent); background-image: repeating-linear-gradient(135deg, color-mix(in srgb, var(--b24-text-subtle) 22%, transparent) 0 1px, transparent 1px 4px)'));
      }
      if (kinds.has('vacation')) out.push(item(t('Отпуск'), 'repeating-linear-gradient(135deg, var(--b24-color-soft-violet-1) 0 3px, transparent 3px 6px)'));
      if (kinds.has('sick')) out.push(item(t('Больничный'), 'repeating-linear-gradient(135deg, var(--b24-color-soft-red-2) 0 3px, transparent 3px 6px)'));
      if (kinds.has('trip')) out.push(item(t('Командировка'), 'repeating-linear-gradient(135deg, var(--b24-color-soft-blue-1) 0 3px, transparent 3px 6px)'));
      out.push(item(t('Пересечение'), 'transparent; box-shadow: inset 0 0 0 1.5px var(--b24-color-danger)'));
    }
    const markup = out.join('');
    if (markup !== legendKey) { legendKey = markup; legend.replaceChildren(html(markup)); }
  };
  host.append(root);
  document.body.append(tip);

  /* ── раскладка строк ── */
  type Item =
    | { type: 'group'; name: string; count: number; top: number; height: number }
    | { type: 'resource'; res: SchedulerResource; top: number; height: number; lanes: Map<string, number>; laneCount: number };
  let layout: Item[] = [];
  let laneH = 30;

  const inRange = (s: Date, e: Date) => e > range().start && s < range().end;
  const computeLayout = () => {
    root.dataset.view = view;
    laneH = parseFloat(getComputedStyle(root).getPropertyValue('--_lane-h')) || 30;
    const resW = parseFloat(getComputedStyle(root).getPropertyValue('--_res-w')) || 240;
    const avail = viewport.clientWidth - resW;
    fitPx = avail > 0 ? avail / (days() * (win()[1] - win()[0])) : 0;
    const out: Item[] = [];
    let top = 0;
    const groups = new Map<string, SchedulerResource[]>();
    const plain: SchedulerResource[] = [];
    for (const r of resources) { if (r.group) { if (!groups.has(r.group)) groups.set(r.group, []); groups.get(r.group)!.push(r); } else plain.push(r); }
    const pushRes = (r: SchedulerResource) => {
      const evs = events.filter((e) => e.resourceId === r.id && inRange(e.s, e.e)).sort((a, b) => a.s.getTime() - b.s.getTime() || b.e.getTime() - a.e.getTime());
      const laneEnds: number[] = [];
      const lanes = new Map<string, number>();
      for (const e of evs) {
        let lane = laneEnds.findIndex((end) => end <= e.s.getTime());
        if (lane < 0) { lane = laneEnds.length; laneEnds.push(0); }
        laneEnds[lane] = e.e.getTime();
        lanes.set(e.id, lane);
      }
      const laneCount = Math.max(1, laneEnds.length);
      const height = Math.max(44, laneCount * laneH + ROW_PAD * 2);
      out.push({ type: 'resource', res: r, top, height, lanes, laneCount });
      top += height;
    };
    plain.forEach(pushRes);
    for (const [name, list] of groups) {
      out.push({ type: 'group', name, count: list.length, top, height: GROUP_H });
      top += GROUP_H;
      if (!collapsed.has(name)) list.forEach(pushRes);
    }
    layout = out;
    body.style.height = `${top}px`;
  };

  /* ── шапка и сетка ── */
  const renderScale = () => {
    const { start, end } = range();
    const w = width();
    scale.style.width = `${w}px`;
    grid.style.left = 'var(--_res-w)';
    grid.style.width = `${w}px`;
    scale.textContent = '';
    grid.textContent = '';
    const today = new Date();
    const loc = intlLocale();
    const tick = (cls: string, left: number, wpx: number, text: string, extra = '') => {
      scale.append(h('div', { class: `b24-scheduler__tick b24-scheduler__tick--${cls}${extra}`, style: `left:${left}px;width:${wpx}px` }, text));
    };
    const col = (left: number, cls = '') => grid.append(h('div', { class: `b24-scheduler__col${cls}`, style: `left:${left}px` }));
    const [h0, h1] = win();
    // деления внутри часа при увеличении: :30 от 100 px на час, :15 и :45 от 200 px
    const sub = pxh() >= 200 ? 4 : pxh() >= 100 ? 2 : 1;
    const subTicks = (left: number) => {
      for (let q = 1; q < sub; q++) {
        const l = left + (q * pxh()) / sub;
        tick('bottom', l, pxh() / sub, `:${String((60 / sub) * q).padStart(2, '0')}`, ' is-sub');
        col(l, ' is-minor is-sub');
      }
    };
    if (view === 'day') {
      tick('top', 0, w, new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(start));
      for (let hh = h0; hh < h1; hh++) {
        tick('bottom', (hh - h0) * pxh(), pxh() / sub, `${String(hh).padStart(2, '0')}:00`);
        col((hh - h0) * pxh(), hh === h0 ? '' : ' is-minor');
        subTicks((hh - h0) * pxh());
      }
    } else if (view === 'week') {
      // подписи часов — каждый час при увеличении, иначе каждые 2 часа (или реже, если узко)
      const every = pxh() >= 40 ? 1 : pxh() * 2 >= 40 ? 2 : pxh() * 4 >= 40 ? 4 : 6;
      for (let i = 0; i < days(); i++) {
        const d = addDays(start, i);
        const left = i * dayW();
        const wd = new Intl.DateTimeFormat(loc, { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
        tick('top', left, dayW(), wd, `${sameDay(d, today) ? ' is-today' : ''}${isWeekend(d) ? ' is-weekend' : ''}`);
        for (let hh = h0; hh < h1; hh += every) {
          tick('bottom', left + (hh - h0) * pxh(), (every * pxh()) / sub, every === 1 && sub > 1 ? `${String(hh).padStart(2, '0')}:00` : String(hh).padStart(2, '0'));
          if (every === 1) subTicks(left + (hh - h0) * pxh());
        }
        col(left, ` is-day${isWeekend(d) ? ' is-weekend' : ''}`);
        if (isWeekend(d)) grid.lastElementChild!.setAttribute('style', `left:${left}px;width:${dayW()}px`);
        for (let hh = h0 + every; hh < h1; hh += every) col(left + (hh - h0) * pxh(), ' is-minor');
      }
    } else {
      tick('top', 0, w, new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(start));
      for (let i = 0; i < days(); i++) {
        const d = addDays(start, i);
        const wd = new Intl.DateTimeFormat(loc, { weekday: 'narrow' }).format(d);
        tick('bottom', i * dayW(), dayW(), `${d.getDate()} ${wd}`, `${sameDay(d, today) ? ' is-today' : ''}${isWeekend(d) ? ' is-weekend' : ''}`);
        col(i * dayW(), isWeekend(d) ? ' is-weekend' : '');
        if (isWeekend(d)) grid.lastElementChild!.setAttribute('style', `left:${i * dayW()}px;width:${dayW()}px`);
      }
    }
    const nowH = today.getHours() + today.getMinutes() / 60;
    if (today >= start && today < end && nowH >= h0 && nowH <= h1) grid.append(h('div', { class: 'b24-scheduler__now', style: `left:${x(today)}px` }));
    title.textContent = view === 'day'
      ? new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }).format(start)
      : view === 'week'
        ? `${new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' }).format(start)} — ${new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' }).format(addDays(end, -1))}`
        : new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(start);
    if (zoomOutBtn) zoomOutBtn.disabled = pxh() <= fitPx + 0.5;
    if (zoomInBtn) zoomInBtn.disabled = pxh() >= PX[view] * MAX_ZOOM - 0.5;
  };

  /* ── загрузка и конфликты ── */
  const clip = (s: Date, e: Date) => Math.max(0, Math.min(e.getTime(), range().end.getTime()) - Math.max(s.getTime(), range().start.getTime()));
  const resBands = (id: string) => bands.filter((b) => b.resourceId === id && inRange(b.s, b.e));
  const loadOf = (id: string) => {
    const work = resBands(id).filter((b) => b.kind === 'work').reduce((a, b) => a + clip(b.s, b.e), 0);
    if (!work) return null;
    const busy = events.filter((e) => e.resourceId === id).reduce((a, e) => a + clip(e.s, e.e), 0);
    return Math.round((busy / work) * 100);
  };
  const flags = (ev: SchedulerEvent & { s: Date; e: Date }) => {
    const mine = events.filter((e) => e.resourceId === ev.resourceId && e.id !== ev.id);
    const overlap = mine.some((e) => e.s < ev.e && e.e > ev.s);
    const rb = bands.filter((b) => b.resourceId === ev.resourceId);
    // событие без времени (выходной, отпуск) само говорит об отсутствии — не конфликт с графиком
    const absent = !isAllDay(ev) && rb.find((b) => b.kind !== 'work' && b.s < ev.e && b.e > ev.s);
    const works = rb.filter((b) => b.kind === 'work');
    const outside = !isAllDay(ev) && works.length > 0 && !works.some((b) => b.s <= ev.s && b.e >= ev.e);
    return { overlap, absent, outside };
  };

  /* ── строки (только видимые) ── */
  const rendered = new Map<string, HTMLElement>();
  const rowKey = (it: Item) => (it.type === 'group' ? `g:${it.name}` : `r:${it.res.id}`);

  const buildRow = (it: Item): HTMLElement => {
    const w = width();
    if (it.type === 'group') {
      const el = h('div', { class: 'b24-scheduler__group', style: `top:${it.top}px;height:${it.height}px;width:calc(var(--_res-w) + ${w}px)` });
      const b = h('button', { type: 'button', class: 'b24-scheduler__group-head', 'aria-expanded': String(!collapsed.has(it.name)) }, it.name, h('span', { class: 'b24-scheduler__group-count' }, String(it.count)));
      b.addEventListener('click', () => { if (collapsed.has(it.name)) collapsed.delete(it.name); else collapsed.add(it.name); render(true); });
      el.append(b);
      return el;
    }
    const r = it.res;
    const rb = resBands(r.id);
    const hasSchedule = bands.some((b) => b.resourceId === r.id && b.kind === 'work');
    const el = h('div', { class: `b24-scheduler__row${hasSchedule ? ' has-schedule' : ''}`, 'data-resource': r.id, style: `top:${it.top}px;height:${it.height}px;width:calc(var(--_res-w) + ${w}px)` });
    const cell = h('div', { class: 'b24-scheduler__resource' });
    cell.append(html(avatarHtml(r.name, r.avatar, 'sm')));
    cell.append(h('div', { class: 'b24-scheduler__who' }, h('span', { class: 'b24-scheduler__name', title: r.name }, r.name), r.meta ? h('span', { class: 'b24-scheduler__meta' }, r.meta) : ''));
    const load = loadOf(r.id);
    if (load != null) {
      const l = h('div', { class: `b24-scheduler__load${load > 100 ? ' is-over' : ''}`, title: t('Загрузка за период: {n}%', { n: load }) }, `${load}%`, h('span', { class: 'b24-scheduler__load-bar' }, h('i', { style: `--v:${load}` })));
      cell.append(l);
    }
    const track = h('div', { class: 'b24-scheduler__track', style: `width:${w}px;height:${it.height}px` });
    // нерабочее время = дополнение смен в видимом периоде; рабочее остаётся прозрачным, сквозь него видна сетка часов
    if (hasSchedule) {
      const work = rb.filter((b) => b.kind === 'work')
        .map((b) => (view === 'month' ? [x(startOfDay(b.s)), x(startOfDay(b.s)) + dayW()] : [x(b.s), x(b.e)]))
        .sort((a, b) => a[0] - b[0]);
      let cur = 0;
      for (const [a, b] of work) {
        if (a > cur) track.append(h('div', { class: 'b24-scheduler__band b24-scheduler__band--offhours', style: `left:${cur}px;width:${a - cur}px` }));
        cur = Math.max(cur, b);
      }
      if (cur < w) track.append(h('div', { class: 'b24-scheduler__band b24-scheduler__band--offhours', style: `left:${cur}px;width:${w - cur}px` }));
    }
    for (const b of rb) {
      if (b.kind === 'work') continue;
      const left = Math.max(0, x(b.s));
      const right = Math.min(w, x(b.e));
      if (right <= left) continue;
      const label = b.label ?? ({ vacation: t('Отпуск'), sick: t('Больничный'), trip: t('Командировка'), off: '', work: '' } as Record<BandKind, string>)[b.kind];
      track.append(h('div', { class: `b24-scheduler__band b24-scheduler__band--${b.kind}`, style: `left:${left}px;width:${right - left}px` }, right - left > 60 ? label : ''));
    }
    for (const e of events) {
      if (e.resourceId !== r.id || !inRange(e.s, e.e)) continue;
      const left = Math.max(0, x(e.s));
      const right = Math.min(w, x(e.e));
      const lane = it.lanes.get(e.id) ?? 0;
      const f = flags(e);
      const ev = h('div', {
        class: `b24-scheduler__event${e.readonly || o.readonly ? ' is-readonly' : ''}${f.overlap || f.absent ? ' is-conflict' : ''}${f.outside ? ' is-outside' : ''}`,
        'data-event': e.id, tabindex: '0', role: 'button',
        'aria-label': `${e.title}${isAllDay(e) ? '' : `, ${fmtRange(e.s, e.e)}`}${e.comment ? `, ${t('есть комментарий')}` : ''}${f.overlap ? `, ${t('пересекается с другой встречей')}` : ''}`,
        style: `left:${left}px;width:${Math.max(4, right - left)}px;top:${ROW_PAD + lane * laneH + 2}px${colorOf(e) ? `;--b24-scheduler-event-color:${colorOf(e)}` : ''}`,
      });
      const titleEl = h('span', { class: 'b24-scheduler__event-title' }, e.title);
      if (e.comment) titleEl.prepend(html(icon('comment')));
      ev.append(titleEl);
      if (!isAllDay(e) && right - left > 70 && view !== 'month') ev.append(h('span', { class: 'b24-scheduler__event-time' }, fmtRange(e.s, e.e)));
      ev.append(h('span', { class: 'b24-scheduler__handle b24-scheduler__handle--start', 'aria-hidden': 'true' }), h('span', { class: 'b24-scheduler__handle b24-scheduler__handle--end', 'aria-hidden': 'true' }));
      track.append(ev);
    }
    el.append(cell, track);
    return el;
  };

  const buffer = 400;
  const renderRows = (force = false) => {
    const top = viewport.scrollTop - 56;
    const bottom = top + viewport.clientHeight + buffer;
    const wanted = new Set<string>();
    for (const it of layout) {
      if (it.top + it.height < top - buffer || it.top > bottom) continue;
      const k = rowKey(it);
      wanted.add(k);
      if (force || !rendered.has(k)) {
        rendered.get(k)?.remove();
        const el = buildRow(it);
        rendered.set(k, el);
        rowsLayer.append(el);
      }
    }
    for (const [k, el] of rendered) if (!wanted.has(k)) { el.remove(); rendered.delete(k); }
  };
  const render = (relayout = true) => {
    if (relayout) computeLayout();
    renderScale();
    renderLegend();
    rendered.forEach((el) => el.remove());
    rendered.clear();
    if (!resources.length) rowsLayer.replaceChildren(h('div', { class: 'b24-scheduler__empty' }, t('Нет сотрудников')));
    renderRows(true);
  };

  /* ── загрузка периода ── */
  const reload = async () => {
    const r = range();
    o.onRangeChange?.({ view, ...r });
    if (!o.load) return;
    abort?.abort();
    abort = new AbortController();
    const signal = abort.signal;
    root.setAttribute('aria-busy', 'true');
    try {
      const res = await o.load(r, signal);
      if (signal.aborted) return;
      if (res.events) events = normEvents(res.events);
      if (res.bands) bands = normBands(res.bands);
      render();
    } catch { /* отменено или ошибка загрузки — показываем то, что есть */ } finally {
      if (!signal.aborted) root.removeAttribute('aria-busy');
    }
  };

  /* ── подсказка ── */
  const resById = (id: string) => resources.find((r) => r.id === id);
  const evById = (id: string) => events.find((e) => e.id === id);
  const showTip = (text: string, cx: number, cy: number) => {
    tip.innerHTML = text;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(cx + 12, innerWidth - r.width - 8)}px`;
    tip.style.top = `${Math.max(8, cy - r.height - 12)}px`;
  };
  const hideTip = () => { tip.hidden = true; };
  const tipFor = (e: SchedulerEvent & { s: Date; e: Date }) => {
    if (o.tooltip) return o.tooltip(e, resById(e.resourceId));
    const f = flags(e);
    const day = new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(e.s);
    const ty = typeOf(e);
    const note = e.comment ? `<br><span class="b24-scheduler__tip-note">${escapeHtml(e.comment.length > 200 ? `${e.comment.slice(0, 200)}…` : e.comment)}</span>` : '';
    return `<b>${escapeHtml(e.title)}</b>${ty ? ` · ${escapeHtml(ty.label)}` : ''}<br>${escapeHtml(day)}${isAllDay(e) ? '' : `, ${fmtRange(e.s, e.e)}`}<br>${escapeHtml(resById(e.resourceId)?.name ?? '')}${note}`
      + (f.overlap ? `<br>⚠ ${escapeHtml(t('Пересекается с другой встречей'))}` : '')
      + (f.absent ? `<br>⚠ ${escapeHtml(t('Сотрудник отсутствует'))}` : '')
      + (f.outside ? `<br>${escapeHtml(t('Вне рабочего времени'))}` : '');
  };

  /* ── изменение встречи: оптимистично, откат при отказе ── */
  const commit = async (ev: SchedulerEvent & { s: Date; e: Date }, next: { start: Date; end: Date; resourceId: string }) => {
    const previous = { start: ev.s, end: ev.e, resourceId: ev.resourceId };
    if (previous.start.getTime() === next.start.getTime() && previous.end.getTime() === next.end.getTime() && previous.resourceId === next.resourceId) { render(); return; }
    Object.assign(ev, { s: next.start, e: next.end, start: next.start, end: next.end, resourceId: next.resourceId });
    render();
    const el = rowsLayer.querySelector<HTMLElement>(`[data-event="${CSS.escape(ev.id)}"]`);
    el?.classList.add('is-saving');
    try {
      await o.onChange?.({ event: ev, start: next.start, end: next.end, resourceId: next.resourceId, previous });
    } catch {
      Object.assign(ev, { s: previous.start, e: previous.end, start: previous.start, end: previous.end, resourceId: previous.resourceId });
    }
    render();
    rowsLayer.querySelector<HTMLElement>(`[data-event="${CSS.escape(ev.id)}"]`)?.focus({ preventScroll: true });
  };

  /* ── создание, сохранение, удаление: окно редактирования, меню, копии ── */
  const resW = () => parseFloat(getComputedStyle(root).getPropertyValue('--_res-w')) || 240;
  /** новая встреча: onSave(isNew) или onCreate; ошибка пробрасывается (окно её покажет) */
  const persistNew = async (draft: SchedulerDraft) => {
    let saved: SchedulerEvent | null = null;
    if (o.onSave) {
      const { copyOf: _copyOf, ...rest } = draft;
      const ev: SchedulerEvent = { ...rest, id: '', title: draft.title ?? t('Новая встреча') };
      const r = await o.onSave(ev, { isNew: true });
      saved = isEvent(r) ? r : { ...ev, id: `new-${Math.random().toString(36).slice(2, 9)}` };
    } else {
      const r = await o.onCreate?.(draft);
      if (isEvent(r)) saved = r;
    }
    if (saved) { events.push(...normEvents([saved])); render(); }
  };
  /** изменённая встреча целиком (окно, смена типа): onSave или onChange */
  const persistEdit = async (cur: Ev, next: SchedulerEvent) => {
    let saved = next;
    if (o.onSave) {
      const r = await o.onSave(next, { isNew: false, previous: pub(cur) });
      if (isEvent(r)) saved = r;
    } else {
      await o.onChange?.({ event: next, start: toDate(next.start), end: toDate(next.end), resourceId: next.resourceId, previous: { start: cur.s, end: cur.e, resourceId: cur.resourceId } });
    }
    const norm = normEvents([saved])[0];
    const i = events.indexOf(cur);
    if (i >= 0) events[i] = norm; else events.push(norm);
    render();
  };
  const quiet = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* отказ — приложение само сообщает почему */ } };
  const removeEvent = async (ev: Ev) => {
    if (!o.onDelete) return;
    await o.onDelete(ev);
    events = events.filter((x2) => x2.id !== ev.id);
    render();
  };
  const timeStep = () => [30, 15, 10, 5, 1].find((v) => v <= stepMs() / 60_000) ?? 15;
  const openEditorFor = (base: SchedulerEvent, cur?: Ev) => {
    const eo = editorOpts();
    if (!eo) return;
    hideTip();
    openEventEditor({
      event: { ...base, start: toDate(base.start), end: toDate(base.end) },
      isNew: !cur, resources, types: o.eventTypes, fields: eo.fields, comment: eo.comment, step: timeStep(),
      save: async (next) => {
        if (cur) await persistEdit(cur, next);
        else await persistNew({ resourceId: next.resourceId, start: next.start, end: next.end, title: next.title, type: next.type, allDay: next.allDay, color: next.color, comment: next.comment, data: next.data });
      },
      remove: cur && o.onDelete ? () => removeEvent(cur) : undefined,
    });
  };
  /** выделение, «Создать» в меню: с окном редактирования — через окно, без него — сразу */
  const createFrom = (draft: SchedulerDraft) => {
    if (editorOpts()) openEditorFor({ id: '', title: draft.title ?? '', ...draft });
    else void quiet(() => persistNew(draft));
  };
  const copyAt = (src: SchedulerEvent, resourceId: string, start: Date) => {
    const dur = toDate(src.end).getTime() - toDate(src.start).getTime();
    return quiet(() => persistNew({ ...copyFields(src), resourceId, start, end: new Date(start.getTime() + dur), copyOf: src.id }));
  };
  const paste = (at?: { resourceId: string; time: Date }) => {
    if (!copied || !canCreate()) return;
    const target = at ?? lastSlot ?? { resourceId: copied.resourceId, time: toDate(copied.end) };
    void copyAt(copied, target.resourceId, target.time);
  };
  const setType = (ev: Ev, ty: SchedulerEventType) => {
    const next: SchedulerEvent = { ...pub(ev), type: ty.id };
    delete next.color;
    if (ty.allDay !== undefined) delete next.allDay;
    void quiet(() => persistEdit(ev, next));
  };

  /* ── контекстное меню ── */
  let closeMenu: (() => void) | null = null;
  const tidy = (items: SchedulerMenuItem[]) => items.filter((it, i, a) => !it.divider || (i > 0 && i < a.length - 1 && !a[i - 1].divider));
  const eventItems = (ev: Ev): SchedulerMenuItem[] => {
    const locked = !!ev.readonly || !!o.readonly;
    const items: SchedulerMenuItem[] = [];
    if (editorOpts() && !ev.readonly) items.push({ id: 'edit', label: t('Изменить'), icon: 'edit', hint: 'Enter', onClick: () => openEditorFor(pub(ev), ev) });
    if (o.eventTypes?.length && !locked) {
      items.push({ id: 'type', title: true, label: t('Тип') });
      for (const ty of o.eventTypes) items.push({ id: `type:${ty.id}`, label: ty.label, checked: ev.type === ty.id, onClick: () => setType(ev, ty) });
    }
    if (canCreate() && !ev.readonly) {
      items.push({ id: 'd1', divider: true });
      items.push({ id: 'duplicate', label: t('Дублировать'), icon: 'copy', onClick: () => void copyAt(pub(ev), ev.resourceId, ev.e) });
      items.push({ id: 'copy', label: t('Копировать'), hint: 'Ctrl+C', onClick: () => { copied = pub(ev); } });
    }
    if (o.onDelete && !locked) {
      items.push({ id: 'd2', divider: true });
      items.push({ id: 'delete', label: t('Удалить'), icon: 'trash', danger: true, hint: 'Delete', onClick: () => void quiet(() => removeEvent(ev)) });
    }
    return tidy(items);
  };
  const slotItems = (resourceId: string, start: Date, end: Date): SchedulerMenuItem[] => {
    if (!canCreate()) return [];
    const items: SchedulerMenuItem[] = [];
    if (o.eventTypes?.length) {
      items.push({ id: 'create', title: true, label: t('Создать') });
      for (const ty of o.eventTypes) items.push({ id: `create:${ty.id}`, label: ty.label, icon: 'plus', onClick: () => createFrom({ resourceId, start, end, type: ty.id, title: ty.label }) });
    } else {
      items.push({ id: 'create', label: t('Создать встречу'), icon: 'plus', onClick: () => createFrom({ resourceId, start, end }) });
    }
    if (copied) items.push({ id: 'd1', divider: true }, { id: 'paste', label: t('Вставить'), icon: 'copy', hint: 'Ctrl+V', onClick: () => paste({ resourceId, time: start }) });
    return tidy(items);
  };
  /** показать меню; false — показывать нечего (остаётся меню браузера) */
  const showMenu = (ctx: SchedulerMenuContext, cx: number, cy: number) => {
    if (o.contextMenu === false) return false;
    let items = ctx.items;
    if (typeof o.contextMenu === 'function') {
      const r = o.contextMenu(ctx);
      if (r === false) return false;
      if (Array.isArray(r)) items = r;
    }
    if (!items.length) return false;
    closeMenu?.();
    hideTip();
    closeMenu = openMenuAt(items, cx, cy);
    return true;
  };
  const eventCtx = (ev: Ev): SchedulerMenuContext => ({ kind: 'event', event: pub(ev), items: eventItems(ev) });
  const onContext = (e: MouseEvent) => {
    if (drag || o.contextMenu === false) return;
    const target = e.target as HTMLElement;
    const evEl = target.closest<HTMLElement>('.b24-scheduler__event');
    const ev = evEl && evById(evEl.dataset.event!);
    let ctx: SchedulerMenuContext | null = null;
    if (ev) ctx = eventCtx(ev);
    else {
      const track = target.closest<HTMLElement>('.b24-scheduler__track');
      const row = track?.closest<HTMLElement>('.b24-scheduler__row');
      if (!row) return;
      const start = snap(timeAt(trackX(e.clientX)));
      const end = new Date(start.getTime() + (editorOpts()?.duration ?? 60) * 60_000);
      ctx = { kind: 'slot', resourceId: row.dataset.resource!, start, end, items: slotItems(row.dataset.resource!, start, end) };
    }
    if (showMenu(ctx, e.clientX, e.clientY)) e.preventDefault();
  };

  /* ── перетаскивание, растягивание, создание ── */
  type Drag =
    | { kind: 'move' | 'start' | 'end'; ev: Ev; el: HTMLElement; x0: number; y0: number; moved: boolean; rowTop: number; copy?: boolean; ghost?: HTMLElement; next?: { start: Date; end: Date; resourceId: string } }
    | { kind: 'create'; resourceId: string; track: HTMLElement; sel: HTMLElement; from: Date; to: Date; x0: number };
  let drag: Drag | null = null;
  const bodyY = (clientY: number) => clientY - body.getBoundingClientRect().top;
  const trackX = (clientX: number) => clientX - body.getBoundingClientRect().left - resW();
  const resourceAtY = (y: number) => layout.find((it) => it.type === 'resource' && y >= it.top && y < it.top + it.height) as Extract<Item, { type: 'resource' }> | undefined;

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const evEl = target.closest<HTMLElement>('.b24-scheduler__event');
    if (evEl) {
      // встречу только для чтения нельзя двигать, но можно открыть кликом
      const ev = evById(evEl.dataset.event!);
      if (!ev) return;
      const kind = target.classList.contains('b24-scheduler__handle--start') ? 'start' : target.classList.contains('b24-scheduler__handle--end') ? 'end' : 'move';
      const row = evEl.closest<HTMLElement>('.b24-scheduler__row')!;
      drag = { kind, ev, el: evEl, x0: e.clientX, y0: e.clientY, moved: false, rowTop: parseFloat(row.style.top) };
      evEl.setPointerCapture(e.pointerId);
      e.preventDefault();
      evEl.focus({ preventScroll: true }); // для Ctrl/⌘+C, Delete и клавиши меню после клика
      return;
    }
    const track = target.closest<HTMLElement>('.b24-scheduler__track');
    if (!track) return;
    viewport.focus({ preventScroll: true }); // для Ctrl/⌘+V
    if (!canCreate()) return;
    const row = track.closest<HTMLElement>('.b24-scheduler__row')!;
    const from = snap(timeAt(trackX(e.clientX)));
    const sel = h('div', { class: 'b24-scheduler__selection', style: `top:${ROW_PAD + 2}px;left:${x(from)}px;width:0` });
    track.append(sel);
    drag = { kind: 'create', resourceId: row.dataset.resource!, track, sel, from, to: from, x0: e.clientX };
    track.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) {
      const target = e.target as HTMLElement;
      const evEl = target.closest<HTMLElement>('.b24-scheduler__event');
      const ev = evEl && evById(evEl.dataset.event!);
      const row = target.closest<HTMLElement>('.b24-scheduler__track')?.closest<HTMLElement>('.b24-scheduler__row');
      if (row) lastSlot = { resourceId: row.dataset.resource!, time: snap(timeAt(trackX(e.clientX))) };
      if (ev) showTip(tipFor(ev), e.clientX, e.clientY); else hideTip();
      return;
    }
    if (drag.kind === 'create') {
      drag.to = snap(timeAt(trackX(e.clientX)));
      if (o.createWithinDay) {
        const d0 = startOfDay(drag.from).getTime();
        drag.to = new Date(Math.min(Math.max(drag.to.getTime(), d0), d0 + 24 * HOUR));
      }
      const a = drag.from < drag.to ? drag.from : drag.to;
      const b = drag.from < drag.to ? drag.to : drag.from;
      Object.assign(drag.sel.style, { left: `${x(a)}px`, width: `${x(b) - x(a)}px` });
      showTip(fmtRange(a, b), e.clientX, e.clientY);
      return;
    }
    const d = drag;
    if (d.ev.readonly || o.readonly) return;
    if (!d.moved && Math.abs(e.clientX - d.x0) < 3 && Math.abs(e.clientY - d.y0) < 3) return;
    d.moved = true;
    // Alt при переносе — копия: едет «тень», оригинал остаётся на месте (Alt можно нажать и отпустить на ходу)
    d.copy = d.kind === 'move' && e.altKey && canCreate();
    if (d.copy && !d.ghost) {
      d.ghost = d.el.cloneNode(true) as HTMLElement;
      d.ghost.removeAttribute('data-event');
      d.ghost.removeAttribute('tabindex');
      d.ghost.setAttribute('aria-hidden', 'true');
      d.ghost.classList.add('is-dragging', 'is-copy');
      d.ghost.classList.remove('is-conflict', 'is-outside');
      d.el.after(d.ghost);
      d.el.style.transform = '';
      d.el.classList.remove('is-dragging');
    } else if (!d.copy && d.ghost) {
      d.ghost.remove();
      d.ghost = undefined;
    }
    if (!d.copy) d.el.classList.add('is-dragging');
    const moving = d.ghost ?? d.el;
    // сдвиг считаем через шкалу: окно часов делает её нелинейной по времени
    const shiftTo = (base: Date) => snap(timeAt(x(base) + (e.clientX - d.x0)));
    const delta = shiftTo(d.kind === 'end' ? d.ev.e : d.ev.s).getTime() - (d.kind === 'end' ? d.ev.e : d.ev.s).getTime();
    let start = d.ev.s;
    let end = d.ev.e;
    let resourceId = d.ev.resourceId;
    if (d.kind === 'move') {
      start = new Date(d.ev.s.getTime() + delta);
      end = new Date(d.ev.e.getTime() + delta);
      const target = resourceAtY(bodyY(e.clientY));
      if (target) resourceId = target.res.id;
      const dy = target ? target.top - d.rowTop : 0;
      moving.style.transform = `translate(${x(start) - x(d.ev.s)}px, ${dy}px)`;
      const tm = d.ghost?.querySelector('.b24-scheduler__event-time');
      if (tm) tm.textContent = fmtRange(start, end);
    } else if (d.kind === 'start') {
      start = new Date(Math.min(d.ev.s.getTime() + delta, d.ev.e.getTime() - stepMs()));
      d.el.style.left = `${x(start)}px`;
      d.el.style.width = `${x(end) - x(start)}px`;
    } else {
      end = new Date(Math.max(d.ev.e.getTime() + delta, d.ev.s.getTime() + stepMs()));
      d.el.style.width = `${x(end) - x(start)}px`;
    }
    d.next = { start, end, resourceId };
    showTip(`${d.copy ? '+ ' : ''}${isAllDay(d.ev) ? escapeHtml(d.ev.title) : fmtRange(start, end)}${resourceId !== d.ev.resourceId ? `<br>→ ${escapeHtml(resById(resourceId)?.name ?? '')}` : ''}`, e.clientX, e.clientY);
  };
  const onUp = async () => {
    const d = drag;
    drag = null;
    hideTip();
    if (!d) return;
    if (d.kind === 'create') {
      const a = d.from < d.to ? d.from : d.to;
      const b = d.from < d.to ? d.to : d.from;
      d.sel.remove();
      if (b.getTime() - a.getTime() < stepMs()) return;
      createFrom({ resourceId: d.resourceId, start: a, end: b });
      return;
    }
    if (!d.moved) {
      if (o.onClick) o.onClick(d.ev);
      else if (editorOpts() && !d.ev.readonly) openEditorFor(pub(d.ev), d.ev);
      return;
    }
    d.ghost?.remove();
    if (d.copy && d.next) { render(); await copyAt(pub(d.ev), d.next.resourceId, d.next.start); return; }
    await commit(d.ev, d.next ?? { start: d.ev.s, end: d.ev.e, resourceId: d.ev.resourceId });
  };
  const onLeave = () => { if (!drag) hideTip(); };
  // есть свой onClick — окно редактирования открывается двойным кликом
  const onDblClick = (e: MouseEvent) => {
    if (!o.onClick || !editorOpts()) return;
    const ev = evById((e.target as HTMLElement).closest<HTMLElement>('.b24-scheduler__event')?.dataset.event ?? '');
    if (ev && !ev.readonly) openEditorFor(pub(ev), ev);
  };

  /* клавиатура: Enter — открыть, Alt+←/→ — сдвинуть, Alt+Shift+←/→ — длительность, Delete — удалить,
   * Ctrl/⌘+C / V — копировать и вставить, клавиша меню / Shift+F10 — контекстное меню */
  const onKey = async (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.code === 'KeyV' && copied && canCreate()) { e.preventDefault(); paste(); return; }
    const evEl = (e.target as HTMLElement).closest<HTMLElement>('.b24-scheduler__event');
    const ev = evEl && evById(evEl.dataset.event!);
    if (!ev || !evEl) return;
    if (mod && e.code === 'KeyC') { copied = pub(ev); return; }
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      const r = evEl.getBoundingClientRect();
      if (showMenu(eventCtx(ev), r.left + 8, r.bottom)) e.preventDefault();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (o.onClick) o.onClick(ev); else if (editorOpts() && !ev.readonly) openEditorFor(pub(ev), ev);
      return;
    }
    if (ev.readonly || o.readonly) return;
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.altKey) {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const s = stepMs() * dir;
      if (e.shiftKey) await commit(ev, { start: ev.s, end: new Date(Math.max(ev.e.getTime() + s, ev.s.getTime() + stepMs())), resourceId: ev.resourceId });
      else await commit(ev, { start: new Date(ev.s.getTime() + s), end: new Date(ev.e.getTime() + s), resourceId: ev.resourceId });
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && o.onDelete) {
      e.preventDefault();
      await quiet(() => removeEvent(ev));
    }
  };

  /* ── масштаб: кнопки и Ctrl/⌘ + колесо; не уже «весь период на ширину области» ── */
  const minZoom = () => Math.min(MAX_ZOOM, fitPx / PX[view]);
  const zoomAround = (next: number, offset: number) => {
    const at = timeAt(viewport.scrollLeft + offset);
    zoom = Math.min(MAX_ZOOM, Math.max(minZoom(), next));
    render(false);
    viewport.scrollLeft = Math.max(0, x(at) - offset);
  };
  const zoomCenter = (next: number) => zoomAround(next, (viewport.clientWidth - resW()) / 2);
  const onWheel = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    zoomAround(Math.max(zoom, minZoom()) * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - viewport.getBoundingClientRect().left - resW());
  };
  let scrollRaf = 0;
  const onScroll = () => { if (!scrollRaf) scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; renderRows(); }); };

  let lastW = 0;
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (viewport.clientWidth !== lastW) { lastW = viewport.clientWidth; render(); } }) : null;
  ro?.observe(viewport);
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);
  root.addEventListener('pointerleave', onLeave);
  root.addEventListener('keydown', onKey);
  root.addEventListener('contextmenu', onContext);
  root.addEventListener('dblclick', onDblClick);
  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('scroll', onScroll, { passive: true });

  const scrollToTime = (d: DateInput) => {
    viewport.scrollLeft = Math.max(0, x(toDate(d)) - (viewport.clientWidth - resW()) / 3);
  };
  /** при открытии: в дне — к 8:00 или к «сейчас», в неделе — к сегодняшнему дню; initialScroll: 'start' — к началу периода */
  const initialScroll = () => {
    const now = new Date();
    const { start, end } = range();
    if (o.initialScroll === 'start') { if (view === 'day') scrollToTime(new Date(start.getTime() + (o.hours?.[0] ?? 8) * HOUR)); else viewport.scrollLeft = 0; return; }
    if (now >= start && now < end) scrollToTime(view === 'day' ? new Date(Math.max(now.getTime() - 2 * HOUR, start.getTime())) : startOfDay(now));
    else if (view === 'day') scrollToTime(new Date(start.getTime() + 8 * HOUR));
    else viewport.scrollLeft = 0;
  };

  const handle: SchedulerHandle = {
    element: root,
    get view() { return view; },
    get range() { return range(); },
    setView(v) {
      view = v;
      root.querySelectorAll<HTMLInputElement>('.b24-segmented input').forEach((i) => { i.checked = i.value === v; });
      zoom = 1;
      render();
      initialScroll();
      void reload();
    },
    setDate(d) { anchor = startOfDay(toDate(d)); render(); initialScroll(); void reload(); },
    prev() { handle.setDate(view === 'day' ? addDays(anchor, -1) : view === 'week' ? addDays(anchor, -7) : new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1)); },
    next() { handle.setDate(view === 'day' ? addDays(anchor, 1) : view === 'week' ? addDays(anchor, 7) : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)); },
    today() { handle.setDate(new Date()); },
    setResources(r) { resources = r; render(); },
    setEvents(list) { events = normEvents(list); render(); },
    setBands(list) { bands = normBands(list); render(); },
    getEvents: () => events.map(({ s, e, ...rest }) => ({ ...rest, start: s, end: e })),
    scrollToTime,
    editEvent(id) { const ev = evById(id); if (ev) openEditorFor(pub(ev), ev); },
    createEvent(draft) { if (editorOpts()) openEditorFor({ id: '', title: draft.title ?? '', ...draft }); },
    zoomIn() { zoomCenter(Math.max(zoom, minZoom()) * 1.25); },
    zoomOut() { zoomCenter(Math.max(zoom, minZoom()) / 1.25); },
    zoomToFit() { zoomCenter(minZoom()); },
    destroy() {
      closeMenu?.();
      abort?.abort();
      ro?.disconnect();
      cancelAnimationFrame(scrollRaf);
      viewport.removeEventListener('wheel', onWheel);
      tip.remove();
      root.remove();
    },
  };

  render();
  requestAnimationFrame(() => { initialScroll(); renderRows(); });
  void reload();
  return handle;
}

/* ── Данные из портала ─────────────────────────────────────
 * Занятость сотрудников из календаря Битрикс24 (calendar.accessibility.get): интервалы занятости → встречи
 * только для чтения (название встречи метод не отдаёт). Работает внутри приложения Битрикс24.
 */
export function bx24SchedulerLoader(userIds: Array<string | number>): NonNullable<SchedulerOptions['load']> {
  type BX = { callMethod: (m: string, p: unknown, cb: (r: { error(): unknown; data(): unknown }) => void) => void };
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return (range) => new Promise((resolve, reject) => {
    const BX24 = (window as unknown as { BX24?: BX }).BX24;
    if (!BX24?.callMethod) return resolve({ events: [] });
    BX24.callMethod('calendar.accessibility.get', { users: userIds, from: ymd(range.start), to: ymd(range.end) }, (res) => {
      if (res.error()) return reject(new Error(String(res.error())));
      const data = res.data() as Record<string, Array<{ ID: string; DATE_FROM: string; DATE_TO: string; NAME?: string }>>;
      const events: SchedulerEvent[] = [];
      for (const [uid, list] of Object.entries(data ?? {})) {
        for (const it of list ?? []) {
          events.push({ id: `${uid}:${it.ID}`, resourceId: uid, start: new Date(it.DATE_FROM.replace(/(\d+)\.(\d+)\.(\d+)/, '$3-$2-$1')), end: new Date(it.DATE_TO.replace(/(\d+)\.(\d+)\.(\d+)/, '$3-$2-$1')), title: it.NAME || t('Занят'), readonly: true });
        }
      }
      resolve({ events });
    });
  });
}

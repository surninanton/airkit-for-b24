/**
 * Софтфон в браузере: клавиатура-набиратель, карточка звонка, статус линии, индикатор уровня микрофона.
 * Сами звонки (WebRTC, SIP, телефония Битрикс24) — ваш код: компоненты показывают состояние и сообщают о действиях.
 *
 *   createDialpad(host, { onDial, onKey, mode })      — поле номера и кнопки 1–9 * 0 #, ввод с клавиатуры, вставка с нормализацией
 *   createCallCard(host, { state, name, number, … })  — «Ответить / Отклонить» или таймер, «Без звука / Удержание / Клавиши / Перевести», «Завершить»
 *   createLineStatus(host, { status, onChange })      — точка online / away / offline / disconnected, подпись, выбор «На линии / Перерыв»
 *   createMicMeter(host, { level })                   — уровень микрофона; connect(stream) считает его сам
 *   normalizePhone(text, { internalMaxLength }), formatPhone(number)
 * Карточку и клавиатуру удобно показывать над кнопкой: popover(anchor, { content: card.element }).
 */
import { icon, type IconName } from '../icons';
import { avatarHtml } from './avatar';
import { h, html } from './dom';
import { t } from './i18n';
import { showFloat, type FloatHandle } from './float';

/* ── Номера ──────────────────────────────────────────────── */

/**
 * Привести номер к виду для набора: оставляет цифры, «+», «*», «#»; российские «8…» и «7…» (до 11 цифр) и «9…» (10 цифр) — в «+7…».
 * «8 (999) 123-45-67» → «+79991234567». Короткие номера и номера других стран не меняются.
 */
export interface NormalizePhoneOptions {
  /** номера из не более чем N цифр (без «+») — внутренние (7xx, 8xx, 1001): остаются как есть, не превращаются в «+7…» */
  internalMaxLength?: number;
}
export function normalizePhone(text: string, options: NormalizePhoneOptions = {}): string {
  const raw = String(text ?? '').replace(/[^\d+*#]/g, '');
  if (!raw) return '';
  if (/[*#]/.test(raw)) return raw;                                   // сервисные коды: *100#
  const plus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  // «8…» и «7…» без плюса — российский номер: заменяем на «+7» уже по ходу набора (до 11 цифр)
  if (!plus && options.internalMaxLength && digits.length <= options.internalMaxLength) return digits;
  if (!plus && digits.length >= 2 && digits.length <= 11 && (digits[0] === '8' || digits[0] === '7')) return `+7${digits.slice(1)}`;
  if (!plus && digits.length === 10 && digits[0] === '9') return `+7${digits}`;
  if (plus && digits.startsWith('8') && digits.length === 11) return `+7${digits.slice(1)}`;
  return (plus ? '+' : '') + digits;
}

/** «+79991234567» → «+7 (999) 123-45-67»; остальное — как есть. */
export function formatPhone(number: string, options: NormalizePhoneOptions = {}): string {
  const n = normalizePhone(number, options);
  const m = /^\+7(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/.exec(n);
  if (!m || n.length < 3) return n;
  const [, a, b, c, d] = m;
  return `+7${a ? ` (${a}${a.length === 3 ? ')' : ''}` : ''}${b ? ` ${b}` : ''}${c ? `-${c}` : ''}${d ? `-${d}` : ''}`;
}

/* ── Клавиатура ──────────────────────────────────────────── */

const KEYS: Array<[string, string]> = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];

export interface DialpadOptions {
  /** номер в поле */
  value?: string;
  /** dial — набор номера и кнопка вызова; dtmf — тоны во время звонка: каждое нажатие уходит в onKey */
  mode?: 'dial' | 'dtmf';
  /** «Позвонить»: number — нормализованный («+79991234567»), formatted — как в поле */
  onDial?: (number: string, formatted: string) => void;
  /** нажата клавиша (в режиме dtmf — тон, в dial — ввод символа) */
  onKey?: (key: string) => void;
  onChange?: (number: string) => void;
  /** слушать клавиатуру компьютера на всём документе, пока клавиатура на странице (для popover); по умолчанию — только когда фокус внутри */
  captureKeyboard?: boolean;
  /** нормализовать вставленный и введённый номер (по умолчанию да) */
  normalize?: boolean;
  /** внутренние номера из не более чем N цифр (7xx, 8xx, 1001) не превращать в «+7…»: internalMaxLength: 4 */
  internalMaxLength?: number;
  /** подпись кнопки вызова */
  dialLabel?: string;
  disabled?: boolean;
}
export interface DialpadHandle {
  element: HTMLElement;
  getValue(): string;
  setValue(number: string): void;
  clear(): void;
  setMode(mode: 'dial' | 'dtmf'): void;
  setDisabled(disabled: boolean): void;
  focus(): void;
  destroy(): void;
}

export function createDialpad(host: HTMLElement, options: DialpadOptions = {}): DialpadHandle {
  let mode: 'dial' | 'dtmf' = options.mode ?? 'dial';
  let value = '';
  const norm = options.normalize !== false;
  const np: NormalizePhoneOptions = { internalMaxLength: options.internalMaxLength };
  const root = h('div', { class: 'b24-dialpad', role: 'group', 'aria-label': t('Набор номера') });
  const input = h('input', { type: 'tel', class: 'b24-dialpad__input', inputmode: 'tel', autocomplete: 'off', placeholder: t('Номер телефона'), 'aria-label': t('Номер телефона'), spellcheck: 'false' }) as HTMLInputElement;
  const back = h('button', { type: 'button', class: 'b24-dialpad__back', 'aria-label': t('Стереть'), title: t('Стереть') }, html(icon('arrowLeft', { size: 18 })));
  const display = h('div', { class: 'b24-dialpad__display' }, input, back);
  const grid = h('div', { class: 'b24-dialpad__grid' });
  const call = h('button', { type: 'button', class: 'b24-btn b24-btn--success b24-dialpad__call' }, html(icon('phone', { size: 18 })), h('span', {}, options.dialLabel ?? t('Позвонить')));
  const tones = h('div', { class: 'b24-dialpad__tones', 'aria-live': 'polite' });
  const keyEls = new Map<string, HTMLButtonElement>();
  for (const [k, letters] of KEYS) {
    const b = h('button', { type: 'button', class: 'b24-dialpad__key', 'data-key': k, 'aria-label': letters && k !== '0' ? `${k}, ${letters}` : k === '0' ? '0, +' : k }, h('span', { class: 'b24-dialpad__digit' }, k), h('span', { class: 'b24-dialpad__letters' }, letters)) as HTMLButtonElement;
    keyEls.set(k, b);
    grid.append(b);
  }
  root.append(display, grid, tones, call);
  host.append(root);

  const paintValue = () => {
    input.value = norm ? formatPhone(value, np) : value;
    back.hidden = mode === 'dtmf' || !value;
    call.disabled = !value || !!options.disabled;
    input.readOnly = mode === 'dtmf';
  };
  const setMode = (m: 'dial' | 'dtmf') => {
    mode = m;
    root.classList.toggle('is-dtmf', m === 'dtmf');
    call.hidden = m === 'dtmf';
    tones.hidden = m !== 'dtmf';
    display.hidden = false;
    if (m === 'dtmf') { tones.textContent = ''; input.placeholder = ''; } else input.placeholder = t('Номер телефона');
    paintValue();
  };
  const emitChange = () => options.onChange?.(norm ? normalizePhone(value, np) : value);
  const flash = (k: string) => {
    const b = keyEls.get(k);
    if (!b) return;
    b.classList.add('is-pressed');
    setTimeout(() => b.classList.remove('is-pressed'), 120);
  };
  const press = (k: string) => {
    options.onKey?.(k);
    flash(k);
    if (mode === 'dtmf') { tones.textContent += k; return; }
    value += k;
    value = norm ? normalizePhone(value, np) || value : value;
    paintValue();
    emitChange();
  };
  const dial = () => {
    if (mode !== 'dial' || !value || options.disabled) return;
    const number = norm ? normalizePhone(value, np) : value;
    options.onDial?.(number, formatPhone(number, np));
  };

  // кнопки: 0 с удержанием — «+»
  let longTimer = 0;
  let longDone = false;
  grid.addEventListener('pointerdown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.b24-dialpad__key');
    if (!b || options.disabled) return;
    longDone = false;
    if (b.dataset.key === '0' && mode === 'dial' && !value) {
      longTimer = window.setTimeout(() => { longDone = true; press('+'); }, 500);
    }
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) grid.addEventListener(ev, () => clearTimeout(longTimer));
  grid.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.b24-dialpad__key');
    if (!b || options.disabled) return;
    if (longDone) { longDone = false; return; }
    press(b.dataset.key!);
    if (window.matchMedia('(pointer: fine)').matches) input.focus({ preventScroll: true });
  });
  back.addEventListener('click', () => { value = value.slice(0, -1); paintValue(); emitChange(); input.focus({ preventScroll: true }); });
  back.addEventListener('contextmenu', (e) => { e.preventDefault(); handle.clear(); });
  call.addEventListener('click', dial);

  // ввод в поле: оставляем допустимые символы, нормализуем на лету
  input.addEventListener('input', () => {
    value = input.value.replace(/[^\d+*#]/g, '');
    value = norm ? normalizePhone(value, np) : value;
    paintValue();
    input.setSelectionRange(input.value.length, input.value.length);
    emitChange();
  });
  input.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text') ?? '';
    if (!text) return;
    e.preventDefault();
    value = norm ? normalizePhone(text, np) : text.replace(/[^\d+*#]/g, '');
    paintValue();
    emitChange();
  });

  // клавиатура компьютера: цифры, *, #, Backspace, Enter
  const onKeydown = (e: KeyboardEvent) => {
    if (options.disabled || e.ctrlKey || e.metaKey || e.altKey) return;
    const inField = e.target === input;
    if (e.key === 'Enter') { if (mode === 'dial' && (inField || root.contains(e.target as Node) || options.captureKeyboard)) { e.preventDefault(); dial(); } return; }
    if (mode === 'dtmf' || !inField) {
      if (/^[0-9*#]$/.test(e.key)) {
        if (!inField && !root.contains(e.target as Node) && !options.captureKeyboard) return;
        if ((e.target as HTMLElement | null)?.matches?.('input, textarea, select, [contenteditable]') && e.target !== input) return;
        e.preventDefault();
        press(e.key);
      } else if (e.key === 'Backspace' && mode === 'dial' && (root.contains(e.target as Node) || options.captureKeyboard) && !inField) {
        e.preventDefault();
        value = value.slice(0, -1); paintValue(); emitChange();
      }
      return;
    }
    // в поле: события клавиш для DTMF не нужны; запрещаем буквы
    if (e.key.length === 1 && !/[0-9*#+()\-\s]/.test(e.key)) e.preventDefault();
    else if (/^[0-9*#]$/.test(e.key)) options.onKey?.(e.key);
  };
  const keyTarget: Document | HTMLElement = options.captureKeyboard ? document : root;
  keyTarget.addEventListener('keydown', onKeydown as EventListener);

  setMode(mode);
  if (options.value) { value = norm ? normalizePhone(options.value, np) : options.value; paintValue(); }
  if (options.disabled) root.classList.add('is-disabled');

  const handle: DialpadHandle = {
    element: root,
    getValue: () => (norm ? normalizePhone(value, np) : value),
    setValue(n) { value = norm ? normalizePhone(n, np) : n; paintValue(); emitChange(); },
    clear() { value = ''; tones.textContent = ''; paintValue(); emitChange(); },
    setMode,
    setDisabled(d) {
      options.disabled = d;
      root.classList.toggle('is-disabled', d);
      keyEls.forEach((b) => { b.disabled = d; });
      input.disabled = d;
      paintValue();
    },
    focus: () => input.focus(),
    destroy() { keyTarget.removeEventListener('keydown', onKeydown as EventListener); clearTimeout(longTimer); root.remove(); },
  };
  return handle;
}

/* ── Карточка звонка ─────────────────────────────────────── */

export type CallState = 'incoming' | 'dialing' | 'active' | 'held' | 'ended';
export interface CallCardAction { id: string; label: string; icon: IconName; /** переключатель (нажат / отжат) */ toggle?: boolean; pressed?: boolean; disabled?: boolean }
export interface CallCardOptions {
  state?: CallState;
  name?: string;
  number?: string;
  avatar?: string;
  /** подпись под именем, например «Линия: Доставка» */
  meta?: string;
  /** когда ответили: таймер считает от этого момента (по умолчанию — от перехода в active) */
  startedAt?: number | Date;
  /** кнопки активного звонка; по умолчанию «Без звука», «Удержание», «Клавиши», «Перевести» */
  actions?: CallCardAction[];
  /**
   * «Не модальный» режим: карточка плавает поверх страницы без затемнения и блокировки; страница остаётся живой.
   * true — справа вверху под шапкой, или { position: 'top-right' | 'top-left' | 'bottom-right' }. Карточка вставляется в host
   * (по умолчанию document.body). Кнопка «Свернуть» превращает её в полоску внизу экрана: имя, таймер, «Развернуть», «Завершить».
   */
  floating?: boolean | { position?: 'top-right' | 'top-left' | 'bottom-right' };
  /** свёрнута сразу (для floating) */
  minimized?: boolean;
  onMinimize?: (minimized: boolean) => void;
  /** «Закрыть» после завершения звонка (в состоянии ended и в полоске); без обработчика кнопки нет */
  onClose?: () => void;
  closeLabel?: string;
  onAnswer?: () => void;
  onDecline?: () => void;
  onHangup?: () => void;
  /** нажата кнопка действия; для toggle — pressed уже новое состояние */
  onAction?: (id: string, pressed: boolean) => void;
}
export interface CallCardHandle {
  element: HTMLElement;
  /** контейнеры: customer — карточка клиента под именем (заказы, «Новый заказ»); extra — под кнопками (клавиатура, индикатор микрофона) */
  slots: { customer: HTMLElement; extra: HTMLElement };
  /** свернуть в полоску внизу экрана / развернуть (floating) */
  minimize(): void;
  restore(): void;
  isMinimized(): boolean;
  /** extra.text — свой текст итога вместо стандартного («Ответил коллега», «Звонок прервался»); extra.startedAt — начало разговора */
  setState(state: CallState, extra?: { text?: string; startedAt?: number | Date }): void;
  getState(): CallState;
  /** свой текст под именем (null — вернуть стандартный) */
  setStatusText(text: string | null): void;
  /** когда начался разговор: таймер перейдёт на это время (при ringing → talking) */
  setStartedAt(startedAt: number | Date | null): void;
  setInfo(patch: { name?: string; number?: string; avatar?: string; meta?: string }): void;
  setPressed(id: string, pressed: boolean): void;
  setActions(actions: CallCardAction[]): void;
  /** длительность разговора, секунды */
  getDuration(): number;
  destroy(): void;
}

const DEFAULT_ACTIONS = (): CallCardAction[] => [
  { id: 'mute', label: t('Без звука'), icon: 'micOff', toggle: true },
  { id: 'hold', label: t('Удержание'), icon: 'pause', toggle: true },
  { id: 'keys', label: t('Клавиши'), icon: 'grid', toggle: true },
  { id: 'transfer', label: t('Перевести'), icon: 'phoneForward' },
];
export const formatCallTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export function createCallCard(host: HTMLElement, options: CallCardOptions = {}): CallCardHandle {
  let state: CallState = options.state ?? 'incoming';
  const info = { name: options.name ?? '', number: options.number ?? '', avatar: options.avatar, meta: options.meta };
  let actions = (options.actions ?? DEFAULT_ACTIONS()).map((a) => ({ ...a }));
  let startedAt: number | null = options.startedAt != null ? +new Date(options.startedAt) : null;
  let timer = 0;
  const floating = !!options.floating;
  const pos = typeof options.floating === 'object' ? options.floating.position ?? 'top-right' : 'top-right';
  const root = h('div', { class: 'b24-callcard', role: 'group' });
  const who = h('div', { class: 'b24-callcard__who' });
  const status = h('div', { class: 'b24-callcard__status', 'aria-live': 'off' });
  const customer = h('div', { class: 'b24-callcard__customer' });
  const buttons = h('div', { class: 'b24-callcard__actions' });
  const foot = h('div', { class: 'b24-callcard__foot' });
  const extra = h('div', { class: 'b24-callcard__extra' });
  // полоска внизу экрана: имя, таймер, «Развернуть», «Завершить»
  const miniName = h('span', { class: 'b24-callcard__mini-name' });
  const miniTime = h('span', { class: 'b24-callcard__mini-time' });
  const miniRestore = h('button', { type: 'button', class: 'b24-callcard__mini-btn', 'aria-label': t('Развернуть'), title: t('Развернуть') }, html(icon('chevronUp', { size: 18 })));
  const miniAnswer = h('button', { type: 'button', class: 'b24-callcard__mini-btn b24-callcard__mini-answer', 'aria-label': t('Ответить'), title: t('Ответить'), hidden: '' }, html(icon('phone', { size: 16 })));
  const miniEnd = h('button', { type: 'button', class: 'b24-callcard__mini-btn b24-callcard__mini-end', 'aria-label': t('Завершить'), title: t('Завершить') }, html(icon('phone', { size: 16 })));
  const mini = h('div', { class: 'b24-callcard__mini' }, miniName, miniTime, miniRestore, miniAnswer, miniEnd);
  let customText: string | null = null;
  const minBtn = h('button', { type: 'button', class: 'b24-callcard__min', 'aria-label': t('Свернуть'), title: t('Свернуть') }, html(icon('minus', { size: 16 })));
  root.append(minBtn, who, status, customer, buttons, foot, extra, mini);
  if (floating) { root.classList.add('b24-callcard--floating', `is-${pos}`); root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'false'); }
  else minBtn.hidden = true;
  (floating && host === document.body ? document.body : host).append(root);
  let minimized = false;

  const duration = () => (startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0);
  const paintStatus = () => {
    if (customText != null) {
      status.textContent = customText;
      status.classList.remove('is-timer');
      miniTime.textContent = customText;
      return;
    }
    const text = { incoming: t('Входящий звонок…'), dialing: t('Соединение…'), held: t('На удержании'), ended: t('Звонок завершён'), active: formatCallTime(duration()) }[state];
    status.textContent = state === 'held' && startedAt ? `${text} · ${formatCallTime(duration())}` : state === 'ended' && startedAt ? `${text} · ${formatCallTime(duration())}` : text;
    status.classList.toggle('is-timer', state === 'active');
    miniTime.textContent = state === 'active' || state === 'held' ? formatCallTime(duration()) : status.textContent;
  };
  const paintWho = () => {
    who.replaceChildren(
      html(avatarHtml(info.name || info.number || '?', info.avatar, 'lg')).firstElementChild!,
      h('div', { class: 'b24-callcard__text' },
        h('div', { class: 'b24-callcard__name' }, info.name || formatPhone(info.number)),
        info.name && info.number ? h('div', { class: 'b24-callcard__number' }, formatPhone(info.number)) : '',
        info.meta ? h('div', { class: 'b24-callcard__meta' }, info.meta) : ''),
    );
    root.setAttribute('aria-label', `${info.name || info.number}`);
    miniName.textContent = info.name || formatPhone(info.number);
  };
  const paintButtons = () => {
    buttons.hidden = state === 'incoming' || state === 'ended';
    buttons.replaceChildren(...actions.map((a) => {
      const b = h('button', { type: 'button', class: `b24-callcard__action${a.pressed ? ' is-pressed' : ''}`, 'data-action': a.id, 'aria-pressed': a.toggle ? String(!!a.pressed) : undefined, disabled: a.disabled || undefined },
        h('span', { class: 'b24-callcard__action-icon' }, html(icon(a.icon, { size: 20 }))), h('span', { class: 'b24-callcard__action-label' }, a.label));
      b.addEventListener('click', () => {
        if (a.toggle) { a.pressed = !a.pressed; b.classList.toggle('is-pressed', !!a.pressed); b.setAttribute('aria-pressed', String(!!a.pressed)); }
        if (a.id === 'hold' && a.toggle) handle.setState(a.pressed ? 'held' : 'active');
        options.onAction?.(a.id, !!a.pressed);
      });
      return b;
    }));
    foot.replaceChildren();
    if (state === 'incoming') {
      const ans = h('button', { type: 'button', class: 'b24-btn b24-btn--success b24-callcard__answer' }, html(icon('phone', { size: 18 })), h('span', {}, t('Ответить')));
      const dec = h('button', { type: 'button', class: 'b24-btn b24-btn--danger b24-callcard__decline' }, html(icon('phoneMissed', { size: 18 })), h('span', {}, t('Отклонить')));
      ans.addEventListener('click', () => options.onAnswer?.());
      dec.addEventListener('click', () => options.onDecline?.());
      foot.append(ans, dec);
    } else if (state === 'ended') {
      if (options.onClose) {
        const close = h('button', { type: 'button', class: 'b24-btn b24-btn--secondary b24-callcard__close' }, options.closeLabel ?? t('Закрыть'));
        close.addEventListener('click', () => options.onClose?.());
        foot.append(close);
      }
    } else {
      const end = h('button', { type: 'button', class: 'b24-btn b24-btn--danger b24-callcard__hangup' }, html(icon('phone', { size: 18 })), h('span', {}, t('Завершить')));
      end.addEventListener('click', () => options.onHangup?.());
      foot.append(end);
    }
  };
  const tick = () => { if (state === 'active' || state === 'held') paintStatus(); };
  const sync = () => {
    root.className = `b24-callcard${floating ? ` b24-callcard--floating is-${pos}` : ''}${minimized ? ' is-minimized' : ''} is-${state}`;
    minBtn.hidden = !floating || state === 'ended';
    // в полоске: входящий — «Ответить» и «Отклонить», завершён — «Закрыть», иначе «Завершить»
    miniAnswer.hidden = state !== 'incoming';
    const endLabel = state === 'incoming' ? t('Отклонить') : state === 'ended' ? options.closeLabel ?? t('Закрыть') : t('Завершить');
    miniEnd.setAttribute('aria-label', endLabel);
    miniEnd.title = endLabel;
    miniEnd.hidden = state === 'ended' && !options.onClose;
    miniEnd.classList.toggle('is-close', state === 'ended');
    miniEnd.innerHTML = icon(state === 'ended' ? 'close' : 'phone', { size: 16 });
    paintStatus();
    paintButtons();
    clearInterval(timer);
    if (state === 'active' || state === 'held') timer = window.setInterval(tick, 1000);
  };

  const setMinimized = (min: boolean) => {
    if (!floating || min === minimized) return;
    minimized = min;
    root.classList.toggle('is-minimized', min);
    options.onMinimize?.(min);
  };
  minBtn.addEventListener('click', () => setMinimized(true));
  miniRestore.addEventListener('click', () => setMinimized(false));
  mini.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('button')) setMinimized(false); });
  miniEnd.addEventListener('click', () => { if (state === 'incoming') options.onDecline?.(); else if (state === 'ended') options.onClose?.(); else options.onHangup?.(); });
  miniAnswer.addEventListener('click', () => options.onAnswer?.());

  paintWho();
  if ((state === 'active' || state === 'held') && !startedAt) startedAt = Date.now();
  sync();
  if (options.minimized) setMinimized(true);

  const handle: CallCardHandle = {
    element: root,
    slots: { customer, extra },
    minimize: () => setMinimized(true),
    restore: () => setMinimized(false),
    isMinimized: () => minimized,
    setState(next, extra) {
      if (extra?.startedAt != null) startedAt = +new Date(extra.startedAt);
      if (next === state && extra?.text === undefined && extra?.startedAt == null) return;
      if (next === 'active' && !startedAt) startedAt = Date.now();
      customText = extra?.text ?? null;                  // свой текст живёт до следующей смены состояния
      state = next;
      sync();
    },
    setStatusText(text) { customText = text; paintStatus(); },
    setStartedAt(v) { startedAt = v == null ? null : +new Date(v); paintStatus(); },
    getState: () => state,
    setInfo(patch) { Object.assign(info, patch); paintWho(); },
    setPressed(id, pressed) {
      const a = actions.find((x) => x.id === id);
      if (!a) return;
      a.pressed = pressed;
      const b = buttons.querySelector<HTMLElement>(`[data-action="${id}"]`);
      b?.classList.toggle('is-pressed', pressed);
      b?.setAttribute('aria-pressed', String(pressed));
      if (id === 'hold') handle.setState(pressed ? 'held' : 'active');
    },
    setActions(next) { actions = next.map((a) => ({ ...a })); paintButtons(); },
    getDuration: duration,
    destroy() { clearInterval(timer); root.remove(); },
  };
  return handle;
}

/* ── Статус линии ────────────────────────────────────────── */

export type LineStatus = 'online' | 'away' | 'offline' | 'disconnected';
export interface LineStatusOptions {
  status?: LineStatus;
  /** своя подпись; по умолчанию «На линии» / «Перерыв» / «Не на линии» / «Нет связи» */
  label?: string;
  /** задан — подпись превращается в выбор «На линии / Перерыв»; вызывается при выборе */
  onChange?: (status: 'online' | 'away') => void;
  /** подписи вариантов выбора */
  labels?: Partial<Record<LineStatus, string>>;
}
export interface LineStatusHandle {
  element: HTMLElement;
  setStatus(status: LineStatus, label?: string): void;
  getStatus(): LineStatus;
  destroy(): void;
}
const statusLabel = (s: LineStatus, labels?: Partial<Record<LineStatus, string>>) => labels?.[s] ?? { online: t('На линии'), away: t('Перерыв'), offline: t('Не на линии'), disconnected: t('Нет связи') }[s];

/** Индикатор: точка и подпись. С onChange — кнопка с выбором «На линии / Перерыв» (при disconnected и offline выбор недоступен). */
export function createLineStatus(host: HTMLElement, options: LineStatusOptions = {}): LineStatusHandle {
  let status: LineStatus = options.status ?? 'offline';
  let custom = options.label;
  const selectable = !!options.onChange;
  const root = h(selectable ? 'button' : 'span', { class: 'b24-linestatus', ...(selectable ? { type: 'button', 'aria-haspopup': 'menu' } : { role: 'status' }) });
  const dot = h('span', { class: 'b24-linestatus__dot', 'aria-hidden': 'true' });
  const text = h('span', { class: 'b24-linestatus__text' });
  root.append(dot, text);
  if (selectable) root.append(html(icon('chevronDown', { size: 14 })));
  host.append(root);
  let menu: FloatHandle | null = null;

  const paint = () => {
    root.className = `b24-linestatus is-${status}`;
    text.textContent = custom ?? statusLabel(status, options.labels);
    if (selectable) (root as HTMLButtonElement).disabled = status === 'disconnected' || status === 'offline';
  };
  if (selectable) {
    root.addEventListener('click', () => {
      if (menu) { menu.close(); return; }
      const box = h('div', { class: 'b24-chat-menu', role: 'menu' });
      menu = showFloat(root, box, { sheet: false, onClose: () => { menu = null; } });
      for (const s of ['online', 'away'] as const) {
        const it = h('button', { type: 'button', role: 'menuitemradio', 'aria-checked': String(status === s), class: `b24-chat-menu__item b24-linestatus__option is-${s}` }, h('span', { class: 'b24-linestatus__dot' }), h('span', {}, statusLabel(s, options.labels)));
        it.addEventListener('click', () => { menu?.close(); if (s !== status) { status = s; custom = undefined; paint(); options.onChange!(s); } });
        box.append(it);
      }
      menu.reposition();
      (box.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus();
    });
  }
  paint();
  return {
    element: root,
    setStatus(s, label) { status = s; custom = label; paint(); },
    getStatus: () => status,
    destroy() { menu?.close(); root.remove(); },
  };
}

/* ── Уровень микрофона ───────────────────────────────────── */

export interface MicMeterOptions {
  /** число делений (по умолчанию 10) */
  bars?: number;
  /** начальный уровень 0–1 */
  level?: number;
  label?: string;
  /** выключен: микрофон без звука (серые деления, перечёркнутый значок) */
  muted?: boolean;
}
export interface MicMeterHandle {
  element: HTMLElement;
  setLevel(level: number): void;
  setMuted(muted: boolean): void;
  /** подключить поток getUserMedia: уровень считается сам (RMS, сглаживание) */
  connect(stream: MediaStream): void;
  disconnect(): void;
  destroy(): void;
}

export function createMicMeter(host: HTMLElement, options: MicMeterOptions = {}): MicMeterHandle {
  const n = Math.max(3, options.bars ?? 10);
  const root = h('div', { class: 'b24-micmeter', role: 'meter', 'aria-label': options.label ?? t('Уровень микрофона'), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' });
  const ico = h('span', { class: 'b24-micmeter__icon' }, html(icon('mic', { size: 16 })));
  const bars = h('span', { class: 'b24-micmeter__bars' }, ...Array.from({ length: n }, (_, i) => h('i', { style: `height:${30 + Math.round((i / (n - 1)) * 70)}%` })));
  root.append(ico, bars);
  host.append(root);
  let level = 0;
  const paint = () => {
    const lit = Math.round(level * n);
    Array.from(bars.children).forEach((b, i) => b.classList.toggle('is-on', i < lit));
    root.setAttribute('aria-valuenow', String(Math.round(level * 100)));
  };
  let ctx: AudioContext | null = null;
  let src: MediaStreamAudioSourceNode | null = null;
  let raf = 0;
  const handle: MicMeterHandle = {
    element: root,
    setLevel(l) { level = Math.max(0, Math.min(1, l)); paint(); },
    setMuted(m) { root.classList.toggle('is-muted', m); if (m) { level = 0; paint(); } },
    connect(stream) {
      handle.disconnect();
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src = ctx.createMediaStreamSource(stream);
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) { const x = (v - 128) / 128; sum += x * x; }
        const rms = Math.sqrt(sum / buf.length);
        // громкая речь ≈ 0.2–0.3 RMS: растягиваем и сглаживаем
        const target = root.classList.contains('is-muted') ? 0 : Math.min(1, rms * 3.5);
        level = level * 0.6 + target * 0.4;
        paint();
        raf = requestAnimationFrame(loop);
      };
      loop();
    },
    disconnect() {
      cancelAnimationFrame(raf);
      try { src?.disconnect(); void ctx?.close(); } catch { /* уже закрыт */ }
      src = null; ctx = null;
      level = 0; paint();
    },
    destroy() { handle.disconnect(); root.remove(); },
  };
  if (options.muted) root.classList.add('is-muted');
  handle.setLevel(options.level ?? 0);
  return handle;
}

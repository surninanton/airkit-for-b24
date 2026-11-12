import { avatarColor, initials } from './avatar';
import { h, lockScroll, trapFocus } from './dom';
import { intlLocale, t } from './i18n';
import { modal } from './modal';

/* ── Экран блокировки с вводом код-пароля ──────────────────
 * Полноэкранный слой на подложке Air (или видео): часы и дата, выбор профиля («Кто продолжит работу?»),
 * точки кода, экранная клавиатура, ввод с клавиатуры (цифры, Backspace, Esc — к профилям).
 * Кит код не проверяет и не хранит: onSubmit(pin, user) отправляет его на сервер;
 * промис выполнен — экран снимается, отклонён — «тряска» и текст ошибки (error.message), код стирается.
 *   const lock = B24UI.createLockScreen({ users, length: 4, onSubmit: (pin, u) => api.pinLogin(u.id, pin) });
 *   await lock.unlocked;
 * Пока экран открыт, остальная страница недоступна (inert) и не прокручивается.
 */
export interface LockUser {
  id: string;
  name: string;
  avatar?: string;
  /** вторая строка под именем: должность, отдел */
  meta?: string;
}
export interface LockScreenOptions {
  /** профили на этом устройстве; один — сразу ввод кода; пусто — ввод кода без профиля */
  users?: LockUser[];
  /** выбранный профиль (id) — сразу ввод кода */
  user?: string;
  /** длина кода, по умолчанию 4 */
  length?: number;
  /** экранная клавиатура (по умолчанию да); ввод с физической клавиатуры работает всегда */
  keypad?: boolean;
  /** фоновое видео (URL) вместо подложки Air */
  video?: string;
  /** часы и дата (по умолчанию да) */
  clock?: boolean;
  title?: string;
  /** проверка кода; отклонённый промис — ошибка (текст из error.message), true/void — разблокировано, false — неверный код */
  onSubmit: (pin: string, user: LockUser | null) => Promise<unknown> | unknown;
  /** ссылка внизу «Войти под другим аккаунтом» — полный вход */
  onOtherUser?: () => void;
  otherUserLabel?: string;
  /** экран снят (после успешного кода или close()) */
  onUnlock?: (user: LockUser | null) => void;
}
export interface LockScreenHandle {
  element: HTMLElement;
  /** выполняется, когда экран снят */
  unlocked: Promise<LockUser | null>;
  /** показать ошибку под точками (например, «Осталось 2 попытки») */
  setError(message: string): void;
  setUsers(users: LockUser[]): void;
  /** снять экран без кода (выход, вход под другим аккаунтом): onUnlock не вызывается, unlocked выполняется с null */
  close(): void;
}

const avatar = (u: LockUser, size: 'md' | 'lg') => {
  const el = h('span', { class: `b24-lock__avatar b24-lock__avatar--${size}`, 'aria-hidden': 'true', style: u.avatar ? undefined : `--_c:${avatarColor(u.name)}` });
  if (u.avatar) el.append(h('img', { src: u.avatar, alt: '' }));
  else el.textContent = initials(u.name);
  return el;
};

export function createLockScreen(options: LockScreenOptions): LockScreenHandle {
  const o = options;
  const len = Math.min(8, Math.max(3, Math.floor(o.length ?? 4)));
  let users = o.users ?? [];
  let selected: LockUser | null = o.user ? users.find((u) => u.id === o.user) ?? null : users.length === 1 ? users[0] : null;
  let pin = '';
  let busy = false;
  let closed = false;
  let resolveUnlocked!: (u: LockUser | null) => void;
  const unlocked = new Promise<LockUser | null>((r) => { resolveUnlocked = r; });

  const root = h('div', { class: 'b24-lock b24-root', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title ?? t('Экран блокировки') });
  const bg = h('div', { class: 'b24-lock__bg', 'aria-hidden': 'true' });
  if (o.video) {
    const v = h('video', { src: o.video, autoplay: true, muted: true, loop: true, playsinline: true }) as HTMLVideoElement;
    v.muted = true;
    bg.append(v, h('div', { class: 'b24-lock__shade' }));
    bg.classList.add('has-video');
  } else {
    for (let i = 0; i < 3; i++) bg.append(h('span', { class: `b24-lock__cloud b24-lock__cloud--${i + 1}` }));
  }
  const body = h('div', { class: 'b24-lock__body' });
  const time = h('div', { class: 'b24-lock__time' });
  const date = h('div', { class: 'b24-lock__date' });
  const stage = h('div', { class: 'b24-lock__stage' });
  if (o.clock !== false) body.append(time, date);
  body.append(stage);
  root.append(bg, body);
  if (o.onOtherUser) {
    const other = h('button', { type: 'button', class: 'b24-lock__other' }, o.otherUserLabel ?? t('Войти под другим аккаунтом'));
    other.addEventListener('click', () => o.onOtherUser?.());
    body.append(other); // в потоке, под содержимым: не наезжает на клавиатуру на невысоких экранах
  }

  const tick = () => {
    const now = new Date();
    time.textContent = new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(now);
    date.textContent = new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  };
  tick();
  const clockTimer = o.clock !== false ? setInterval(tick, 1000) : 0;

  /* ── экраны ── */
  let dots: HTMLElement | null = null;
  let err: HTMLElement | null = null;
  const paintDots = () => dots?.querySelectorAll('i').forEach((d, i) => d.classList.toggle('is-on', i < pin.length));

  const showUsers = () => {
    selected = null;
    pin = '';
    dots = err = null;
    stage.replaceChildren(
      h('h2', { class: 'b24-lock__title' }, o.title ?? t('Кто продолжит работу?')),
      h('p', { class: 'b24-lock__hint' }, t('Выберите свой профиль')),
    );
    const list = h('div', { class: 'b24-lock__users', role: 'list' });
    users.forEach((u, i) => {
      const b = h('button', { type: 'button', class: 'b24-lock__user', role: 'listitem', style: `--_i:${i}` }, avatar(u, 'lg'), h('span', { class: 'b24-lock__user-name' }, u.name));
      if (u.meta) b.append(h('span', { class: 'b24-lock__user-meta' }, u.meta));
      b.addEventListener('click', () => showPin(u));
      list.append(b);
    });
    stage.append(list);
    list.querySelector<HTMLElement>('button')?.focus();
  };

  const showPin = (u: LockUser | null) => {
    selected = u;
    pin = '';
    stage.replaceChildren();
    if (u) stage.append(avatar(u, 'md'), h('div', { class: 'b24-lock__name' }, u.name));
    stage.append(h('p', { class: 'b24-lock__hint', id: 'b24-lock-hint' }, t('Введите код-пароль')));
    dots = h('div', { class: 'b24-lock__dots', role: 'img', 'aria-label': t('Введено цифр: {n} из {m}', { n: 0, m: len }) });
    for (let i = 0; i < len; i++) dots.append(h('i'));
    err = h('div', { class: 'b24-lock__error', role: 'alert', 'aria-live': 'assertive' });
    stage.append(dots, err);
    // скрытое поле: фокус для клавиатуры телефона и скринридера
    const input = h('input', { class: 'b24-lock__input', type: 'password', inputmode: 'numeric', autocomplete: 'off', 'aria-describedby': 'b24-lock-hint', 'aria-label': t('Код-пароль') }) as HTMLInputElement;
    input.addEventListener('input', () => {
      const v = input.value.replace(/\D/g, '').slice(0, len);
      input.value = '';
      for (const d of v) press(d);
    });
    stage.append(input);
    if (o.keypad !== false) {
      const pad = h('div', { class: 'b24-lock__keypad' });
      for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']) {
        if (!k) { pad.append(h('span')); continue; }
        const b = h('button', { type: 'button', class: `b24-lock__key${k === '⌫' ? ' b24-lock__key--erase' : ''}`, 'aria-label': k === '⌫' ? t('Стереть') : k, tabindex: '-1' }, k);
        b.addEventListener('click', () => { if (k === '⌫') erase(); else press(k); input.focus({ preventScroll: true }); });
        pad.append(b);
      }
      stage.append(pad);
    }
    if (users.length > 1) {
      const back = h('button', { type: 'button', class: 'b24-lock__back' }, `← ${t('К профилям')}`);
      back.addEventListener('click', showUsers);
      stage.append(back);
    }
    input.focus({ preventScroll: true });
  };

  const setError = (msg: string) => {
    if (!err) return;
    err.textContent = msg;
    if (msg) { stage.classList.remove('is-shake'); void stage.offsetWidth; stage.classList.add('is-shake'); }
  };
  const updateAria = () => dots?.setAttribute('aria-label', t('Введено цифр: {n} из {m}', { n: pin.length, m: len }));
  const erase = () => { if (busy || !pin) return; pin = pin.slice(0, -1); paintDots(); updateAria(); };
  const press = (d: string) => {
    if (busy || closed || pin.length >= len) return;
    if (pin.length === 0) setError('');
    pin += d;
    paintDots();
    updateAria();
    if (pin.length === len) void submit();
  };
  const submit = async () => {
    busy = true;
    root.classList.add('is-busy');
    const value = pin;
    try {
      const r = await o.onSubmit(value, selected);
      if (r === false) throw new Error(t('Неверный код'));
      unlock();
    } catch (e) {
      pin = '';
      paintDots();
      updateAria();
      setError(e instanceof Error && e.message ? e.message : t('Неверный код'));
    } finally {
      busy = false;
      root.classList.remove('is-busy');
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (closed || !dots) return;
    if (/^\d$/.test(e.key) && !(e.target as HTMLElement).matches('.b24-lock__input')) { e.preventDefault(); press(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); erase(); }
    else if (e.key === 'Escape' && users.length > 1) { e.preventDefault(); showUsers(); }
  };

  // остальная страница недоступна, пока экран открыт
  const inerted: HTMLElement[] = [];
  for (const el of Array.from(document.body.children) as HTMLElement[]) {
    if (!el.inert && el.tagName !== 'SCRIPT') { el.inert = true; inerted.push(el); }
  }
  document.body.append(root);
  const releaseScroll = lockScroll();
  const releaseTrap = trapFocus(root);
  document.addEventListener('keydown', onKey, true);
  if (selected || !users.length) showPin(selected); else showUsers();

  const teardown = () => {
    if (closed) return false;
    closed = true;
    clearInterval(clockTimer);
    document.removeEventListener('keydown', onKey, true);
    releaseTrap();
    releaseScroll();
    inerted.forEach((el) => { el.inert = false; });
    root.classList.add('is-closing');
    setTimeout(() => root.remove(), 260);
    return true;
  };
  const unlock = () => {
    const u = selected;
    if (!teardown()) return;
    o.onUnlock?.(u);
    resolveUnlocked(u);
  };

  return {
    element: root,
    unlocked,
    setError,
    setUsers(next) { users = next; if (!selected) showUsers(); },
    close: () => { if (teardown()) resolveUnlocked(null); },
  };
}

/* ── Установка кода-пароля: два поля «код» и «повторите» ── */
export interface PinSetupOptions {
  length?: number;
  title?: string;
  /** текст под заголовком; по умолчанию — «Придумайте код из N цифр…» */
  text?: string;
  /** пометка внизу, по умолчанию «Код действует только на этом устройстве» */
  note?: string | false;
  /** сохранить; отклонённый промис — ошибка в окне */
  onSave: (pin: string) => Promise<unknown> | unknown;
}

/** Окно установки кода; промис — true, если код сохранён, false — «Не сейчас». */
export function openPinSetup(options: PinSetupOptions): Promise<boolean> {
  const len = Math.min(8, Math.max(3, Math.floor(options.length ?? 4)));
  const form = h('form', { class: 'b24-form b24-pin-setup', novalidate: true });
  form.append(h('p', { class: 'b24-pin-setup__text' }, options.text ?? t('Придумайте код из {n} цифр — им можно будет быстро входить под собой.', { n: len })));
  const field = (label: string) => h('input', { class: 'b24-input b24-pin-setup__input', type: 'password', inputmode: 'numeric', autocomplete: 'new-password', 'aria-label': label, placeholder: label }) as HTMLInputElement;
  const a = field(t('Код-пароль'));
  const b = field(t('Повторите код'));
  const err = h('div', { class: 'b24-field__error', role: 'alert' });
  for (const inp of [a, b]) inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, len); err.textContent = ''; });
  form.append(a, b, err);
  if (options.note !== false) form.append(h('div', { class: 'b24-alert b24-alert--info b24-pin-setup__note' }, options.note ?? t('Код действует только на этом устройстве.')));
  return new Promise((resolve) => {
    let saved = false;
    const m = modal({
      title: options.title ?? t('Быстрый вход по коду'),
      content: form,
      size: 'sm',
      autoInit: false,
      onClose: () => resolve(saved),
      buttons: [
        {
          text: t('Сохранить'), variant: 'success',
          onClick: async () => {
            if (a.value.length !== len) { err.textContent = t('Код должен быть из {n} цифр', { n: len }); a.focus(); return false; }
            if (a.value !== b.value) { err.textContent = t('Коды не совпадают'); b.focus(); return false; }
            try { await options.onSave(a.value); saved = true; return true; } catch (e) {
              err.textContent = e instanceof Error && e.message ? e.message : t('Не удалось сохранить');
              return false;
            }
          },
        },
        { text: t('Не сейчас'), variant: 'secondary' },
      ],
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); m.element.querySelector<HTMLButtonElement>('.b24-btn--success')?.click(); });
    requestAnimationFrame(() => a.focus());
  });
}

/* ── Блокировка по простою ── */
export interface IdleLockOptions {
  /** минуты без действий пользователя */
  minutes: number;
  onIdle: () => void;
}
/** Вызывает onIdle после простоя (мышь, клавиатура, касания, прокрутка сбрасывают таймер). Возвращает функцию остановки. */
export function idleLock(options: IdleLockOptions): () => void {
  const ms = Math.max(1, options.minutes) * 60_000;
  let timer = 0;
  const reset = () => { clearTimeout(timer); timer = window.setTimeout(options.onIdle, ms); };
  const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];
  events.forEach((ev) => window.addEventListener(ev, reset, { passive: true, capture: true }));
  reset();
  return () => { clearTimeout(timer); events.forEach((ev) => window.removeEventListener(ev, reset, { capture: true })); };
}


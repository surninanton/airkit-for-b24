/**
 * Звук и уведомления о новых сообщениях.
 *   notifySound()            — короткий «дзынь» через WebAudio, без файла;
 *   desktopNotify({ … })      — системное уведомление (разрешение — requestNotifyPermission() по клику пользователя);
 *   claimNotify(key)          — дедупликация между вкладками: из нескольких открытых вкладок звенит одна.
 * Браузер не даёт звучать до первого действия пользователя на странице — до него notifySound молча ничего не делает.
 */

let ctx: AudioContext | null = null;
let unlocked = false;
const unlock = () => {
  unlocked = true;
  try { void ctx?.resume(); } catch { /* нет звука */ }
};
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { once: true, capture: true, passive: true });
}

/** Из нескольких вкладок срабатывает одна: первая, что заняла ключ на ttl мс (localStorage). Без localStorage — всегда true. */
export async function claimNotify(key: string, ttl = 4000): Promise<boolean> {
  const k = `b24-notify:${key}`;
  const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  try {
    const cur = localStorage.getItem(k);
    if (cur && Date.now() - parseInt(cur, 10) < ttl) return false;
    localStorage.setItem(k, token);
    // вкладки, записавшие ключ в ту же миллисекунду, разводим: побеждает последняя запись
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 60));
    return localStorage.getItem(k) === token;
  } catch {
    return true;
  }
}

export interface NotifySoundOptions {
  /** громкость 0–1 (по умолчанию 0.25) */
  volume?: number;
  /** ключ дедупликации между вкладками: с одним ключом звенит одна вкладка */
  dedupeKey?: string;
  /** 'ding' — два тона (по умолчанию), 'soft' — один мягкий */
  tone?: 'ding' | 'soft';
}

/** «Дзынь»: два коротких тона с затуханием. Возвращает false, если звук не прозвучал (нет WebAudio, не было клика, другая вкладка). */
export async function notifySound(options: NotifySoundOptions = {}): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC || !unlocked) return false;
  if (options.dedupeKey && !(await claimNotify(`sound:${options.dedupeKey}`))) return false;
  try {
    ctx ??= new AC();
    if (ctx.state === 'suspended') await ctx.resume();
    const vol = Math.max(0, Math.min(1, options.volume ?? 0.25));
    const notes = options.tone === 'soft' ? [[660, 0, 0.35]] : [[880, 0, 0.18], [1320, 0.11, 0.32]];
    const now = ctx.currentTime;
    for (const [freq, start, dur] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(vol, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    }
    return true;
  } catch {
    return false;
  }
}

/** Запросить разрешение на уведомления — вызывайте из обработчика клика («Включить уведомления»). */
export async function requestNotifyPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

export interface DesktopNotifyOptions {
  title: string;
  body?: string;
  icon?: string;
  /** одинаковый tag заменяет прежнее уведомление, а не добавляет новое; он же — ключ дедупликации между вкладками */
  tag?: string;
  /** клик по уведомлению: окно получает фокус, затем вызывается обработчик */
  onClick?: () => void;
  /** показывать, только если вкладка не на виду (по умолчанию да) */
  onlyHidden?: boolean;
  /** закрыть само через мс (по умолчанию 8000; 0 — не закрывать) */
  timeout?: number;
}

/** Системное уведомление. Разрешения нет — null (запрашивать его здесь браузер не даст без клика: см. requestNotifyPermission). */
export async function desktopNotify(options: DesktopNotifyOptions): Promise<Notification | null> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
  if ((options.onlyHidden ?? true) && document.visibilityState === 'visible') return null;
  if (options.tag && !(await claimNotify(`desktop:${options.tag}`))) return null;
  try {
    const n = new Notification(options.title, { body: options.body, icon: options.icon, tag: options.tag });
    n.onclick = () => { window.focus(); n.close(); options.onClick?.(); };
    const ms = options.timeout ?? 8000;
    if (ms) setTimeout(() => n.close(), ms);
    return n;
  } catch {
    return null;
  }
}

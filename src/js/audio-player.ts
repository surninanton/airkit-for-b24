/**
 * Плеер записи: play / pause, перемотка по полосе, текущее время / общее, скорость 1× / 1.5× / 2×, «Скачать», состояние ошибки.
 * Для записи разговора в журнале звонков и в карточке завершённого звонка. Источник может отдаваться с Range (206):
 * пока длительность неизвестна, показывается «—:—».
 *
 *   createAudioPlayer(host, { src, duration, compact, download, onPlay, onEnd, onError })
 *   compact — одна строка (строка журнала): ▶ 0:12 ━━━━○━━ 2:05 1×
 */
import { icon } from '../icons';
import { h, html } from './dom';
import { t } from './i18n';

export interface AudioPlayerOptions {
  src: string;
  /** длительность, если известна (секунды): показывается до загрузки метаданных, по ней можно перематывать */
  duration?: number;
  /** одна строка */
  compact?: boolean;
  /** скорости по кругу (по умолчанию 1, 1.5, 2); одна — кнопки нет */
  speeds?: number[];
  speed?: number;
  /** кнопка «Скачать»: true — по src, строка — имя файла */
  download?: boolean | string;
  /** подпись для скринридеров и подсказки («Запись разговора») */
  label?: string;
  /** auto — метаданные грузятся сразу (по умолчанию), none — только по нажатию (длительность «—:—», пока не нажали) */
  preload?: 'auto' | 'metadata' | 'none';
  autoplay?: boolean;
  /** при запуске ставить на паузу остальные плееры на странице (по умолчанию да) */
  exclusive?: boolean;
  /** текст ошибки вместо стандартного */
  errorText?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnd?: () => void;
  onError?: (error: { code: number | null; message: string }) => void;
  onTime?: (current: number, duration: number | null) => void;
}
export interface AudioPlayerHandle {
  element: HTMLElement;
  audio: HTMLAudioElement;
  play(): Promise<void>;
  pause(): void;
  toggle(): void;
  seek(seconds: number): void;
  setSpeed(speed: number): void;
  setSrc(src: string, duration?: number): void;
  isPlaying(): boolean;
  /** длительность: секунды или null, пока неизвестна */
  getDuration(): number | null;
  destroy(): void;
}

const players = new Set<AudioPlayerHandle>();
const pad = (n: number) => String(n).padStart(2, '0');
/** 125 → «2:05», 3725 → «1:02:05»; неизвестно → «—:—» */
export function formatAudioTime(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '—:—';
  const s = Math.floor(sec);
  return s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
}
const speedLabel = (s: number) => `${String(s).replace('.', ',')}×`;
const fmtSpeedAria = (s: number) => `${t('Скорость')}: ${speedLabel(s)}`;

export function createAudioPlayer(host: HTMLElement, options: AudioPlayerOptions): AudioPlayerHandle {
  const speeds = options.speeds?.length ? options.speeds : [1, 1.5, 2];
  let speed = options.speed ?? speeds[0];
  let knownDuration: number | null = options.duration != null && options.duration > 0 ? options.duration : null;
  let seeking = false;
  let state: 'idle' | 'loading' | 'playing' | 'error' = 'idle';

  const audio = h('audio', { preload: options.preload === 'auto' ? 'auto' : options.preload ?? 'metadata' }) as HTMLAudioElement;
  audio.src = options.src;
  audio.playbackRate = speed;
  const label = options.label ?? t('Запись разговора');
  const root = h('div', { class: `b24-audio${options.compact ? ' is-compact' : ''}`, role: 'group', 'aria-label': label });

  const play = h('button', { type: 'button', class: 'b24-audio__play', 'aria-label': t('Воспроизвести'), title: t('Воспроизвести') }, html(icon('play', { size: options.compact ? 16 : 20 })));
  const cur = h('span', { class: 'b24-audio__cur', 'aria-hidden': 'true' }, '0:00');
  const total = h('span', { class: 'b24-audio__total', 'aria-hidden': 'true' }, '—:—');
  const range = h('input', { type: 'range', class: 'b24-audio__range', min: '0', max: '100', step: '0.1', value: '0', 'aria-label': t('Перемотка') }) as HTMLInputElement;
  const rangeBox = h('span', { class: 'b24-audio__bar' }, range);
  const spd = h('button', { type: 'button', class: 'b24-audio__speed', title: fmtSpeedAria(speed), 'aria-label': fmtSpeedAria(speed) }, speedLabel(speed));
  if (speeds.length < 2) spd.hidden = true;
  const dl = options.download
    ? (h('a', { class: 'b24-audio__download', href: options.src, download: typeof options.download === 'string' ? options.download : '', 'aria-label': t('Скачать'), title: t('Скачать') }, html(icon('download', { size: 16 }))) as HTMLAnchorElement)
    : null;
  const err = h('div', { class: 'b24-audio__error', role: 'alert', hidden: '' });
  const retry = h('button', { type: 'button', class: 'b24-audio__retry' }, t('Повторить'));

  if (options.compact) root.append(play, cur, rangeBox, total, spd, ...(dl ? [dl] : []), err);
  else {
    const times = h('div', { class: 'b24-audio__times' }, cur, total);
    const tools = h('div', { class: 'b24-audio__tools' }, spd, ...(dl ? [dl] : []));
    root.append(play, h('div', { class: 'b24-audio__main' }, rangeBox, h('div', { class: 'b24-audio__row' }, times, tools)), err);
  }
  err.append(h('span', { class: 'b24-audio__error-text' }), retry);
  root.append(audio);
  host.append(root);

  const dur = (): number | null => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : knownDuration);
  const paint = () => {
    const d = dur();
    const c = audio.currentTime || 0;
    cur.textContent = formatAudioTime(c);
    total.textContent = formatAudioTime(d);
    range.disabled = d == null || state === 'error';
    range.max = String(d ?? 100);
    if (!seeking) range.value = String(d ? Math.min(c, d) : 0);
    range.style.setProperty('--_p', d ? `${Math.min(100, (c / d) * 100)}%` : '0%');
    range.setAttribute('aria-valuetext', d ? `${formatAudioTime(c)} ${t('из')} ${formatAudioTime(d)}` : formatAudioTime(c));
  };
  const setState = (s: typeof state) => {
    state = s;
    root.classList.toggle('is-playing', s === 'playing');
    root.classList.toggle('is-loading', s === 'loading');
    root.classList.toggle('is-error', s === 'error');
    err.hidden = s !== 'error';
    const playing = s === 'playing' || s === 'loading';
    play.innerHTML = icon(playing ? 'pause' : 'play', { size: options.compact ? 16 : 20 });
    const txt = playing ? t('Пауза') : t('Воспроизвести');
    play.setAttribute('aria-label', txt);
    play.title = txt;
    play.disabled = s === 'error';
    paint();
  };

  const startPlay = async () => {
    if (options.exclusive !== false) players.forEach((p) => { if (p !== handle && p.isPlaying()) p.pause(); });
    try { await audio.play(); } catch (e) {
      // NotAllowedError (нет жеста) и прерванная загрузка — не ошибка записи
      if ((e as DOMException)?.name === 'NotSupportedError') showError(4);
    }
  };
  const ERR: Record<number, string> = {
    1: t('Загрузка записи прервана'),
    2: t('Не удалось загрузить запись'),
    3: t('Не удалось воспроизвести запись: файл повреждён'),
    4: t('Не удалось загрузить запись: формат не поддерживается или файл недоступен'),
  };
  const showError = (code: number | null) => {
    const message = options.errorText ?? ERR[code ?? 2] ?? ERR[2];
    (err.querySelector('.b24-audio__error-text') as HTMLElement).textContent = message;
    setState('error');
    options.onError?.({ code, message });
  };

  play.addEventListener('click', () => { if (audio.paused) void startPlay(); else audio.pause(); });
  retry.addEventListener('click', () => { setState('idle'); audio.load(); void startPlay(); });
  spd.addEventListener('click', () => {
    const i = speeds.indexOf(speed);
    handle.setSpeed(speeds[(i + 1) % speeds.length]);
  });
  range.addEventListener('pointerdown', () => { seeking = true; });
  const endSeek = () => { seeking = false; paint(); };
  range.addEventListener('pointerup', endSeek);
  range.addEventListener('pointercancel', endSeek);
  range.addEventListener('input', () => {
    const v = Number(range.value);
    try { audio.currentTime = v; } catch { /* метаданные ещё не загружены */ }
    cur.textContent = formatAudioTime(v);
    range.style.setProperty('--_p', `${dur() ? (v / dur()!) * 100 : 0}%`);
  });
  range.addEventListener('change', () => { seeking = false; paint(); });

  audio.addEventListener('loadedmetadata', paint);
  audio.addEventListener('durationchange', paint);
  audio.addEventListener('timeupdate', () => { paint(); options.onTime?.(audio.currentTime, dur()); });
  audio.addEventListener('play', () => { setState('loading'); });
  audio.addEventListener('waiting', () => { if (!audio.paused) setState('loading'); });
  audio.addEventListener('playing', () => { setState('playing'); options.onPlay?.(); });
  audio.addEventListener('pause', () => { if (!audio.ended && state !== 'error') { setState('idle'); options.onPause?.(); } });
  audio.addEventListener('ended', () => { setState('idle'); audio.currentTime = 0; paint(); options.onEnd?.(); });
  audio.addEventListener('error', () => showError(audio.error?.code ?? null));
  // Space / стрелки на полосе работают штатно; ←/→ на кнопке — ±5 секунд
  root.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement) === play && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); handle.seek(audio.currentTime + (e.key === 'ArrowRight' ? 5 : -5)); }
  });

  const handle: AudioPlayerHandle = {
    element: root,
    audio,
    play: startPlay,
    pause: () => audio.pause(),
    toggle: () => { if (audio.paused) void startPlay(); else audio.pause(); },
    seek(sec) { const d = dur(); audio.currentTime = Math.max(0, d ? Math.min(sec, d) : sec); paint(); },
    setSpeed(s) {
      speed = s;
      audio.playbackRate = s;
      spd.textContent = speedLabel(s);
      spd.title = fmtSpeedAria(s);
      spd.setAttribute('aria-label', fmtSpeedAria(s));
    },
    setSrc(src, duration) {
      audio.pause();
      knownDuration = duration != null && duration > 0 ? duration : null;
      audio.src = src;
      audio.playbackRate = speed;
      if (dl) dl.href = src;
      setState('idle');
      paint();
    },
    isPlaying: () => !audio.paused && state !== 'error',
    getDuration: dur,
    destroy() { players.delete(handle); audio.pause(); audio.removeAttribute('src'); audio.load(); root.remove(); },
  };
  players.add(handle);
  setState('idle');
  if (options.autoplay) void startPlay();
  return handle;
}

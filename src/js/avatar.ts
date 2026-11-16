import { escapeHtml } from './dom';

const AVATAR_COLORS = ['#7fa3c8', '#2fc6f6', '#1bce7b', '#faa72c', '#f85e9e', '#853af5', '#37c5d8', '#b89238', '#0075ff'];

/** Инициалы: первые буквы двух первых слов. Слова без букв и цифр (эмодзи, знаки) пропускаются; символы берутся целиком, не по UTF-16. */
export function initials(name = ''): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const named = words.filter((w) => /[\p{L}\p{N}]/u.test(w));
  const pick = (w: string) => {
    const ch = Array.from(w).find((c) => /[\p{L}\p{N}]/u.test(c)) ?? Array.from(w)[0] ?? '';
    return ch.toUpperCase();
  };
  // нет ни одного слова с буквами (только эмодзи) — показываем первый символ как есть
  return (named.length ? named : words).slice(0, 2).map(pick).join('');
}

/** Стабильный цвет по имени. */
export function avatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export interface AvatarHtmlOptions {
  /** точка в углу: online — зелёная, away — жёлтая */
  status?: 'online' | 'away' | 'offline';
  /** подсказка при наведении («В сети», «Был(а) в сети 5 мин назад») */
  title?: string;
}

export function avatarHtml(name: string, src?: string, size: 'xs' | 'sm' | 'md' | 'lg' = 'sm', options: AvatarHtmlOptions = {}): string {
  const cls = `b24-avatar${size !== 'md' ? ` b24-avatar--${size}` : ''}`;
  const dot = options.status === 'online' || options.status === 'away' ? `<span class="b24-avatar__status${options.status === 'away' ? ' is-away' : ''}"></span>` : '';
  const title = options.title ? ` title="${escapeHtml(options.title)}"` : '';
  if (src) return `<span class="${cls}"${title}><img src="${escapeHtml(src)}" alt="">${dot}</span>`;
  return `<span class="${cls}" style="--b24-avatar-bg:${avatarColor(name)}"${title}>${escapeHtml(initials(name))}${dot}</span>`;
}

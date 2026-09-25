import { escapeHtml } from './dom';

const AVATAR_COLORS = ['#7fa3c8', '#2fc6f6', '#1bce7b', '#faa72c', '#f85e9e', '#853af5', '#37c5d8', '#b89238', '#0075ff'];

export function initials(name = ''): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

/** Стабильный цвет по имени. */
export function avatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function avatarHtml(name: string, src?: string, size: 'xs' | 'sm' | 'md' | 'lg' = 'sm'): string {
  const cls = `b24-avatar${size !== 'md' ? ` b24-avatar--${size}` : ''}`;
  if (src) return `<span class="${cls}"><img src="${escapeHtml(src)}" alt=""></span>`;
  return `<span class="${cls}" style="--b24-avatar-bg:${avatarColor(name)}">${escapeHtml(initials(name))}</span>`;
}

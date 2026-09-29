/**
 * Собственный набор линейных иконок (24×24, stroke = currentColor).
 * Иконки портала не копируются — рисунок свой, стилистически близкий.
 */
const paths = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronUp: '<path d="m6 15 6-6 6 6"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  settings: '<path d="M10.3 3.5h3.4l.5 2.3 1.6.9 2.2-.8 1.7 2.9-1.7 1.6v1.9l1.7 1.6-1.7 2.9-2.2-.8-1.6.9-.5 2.3h-3.4l-.5-2.3-1.6-.9-2.2.8-1.7-2.9 1.7-1.6v-1.9L3.9 8.8l1.7-2.9 2.2.8 1.6-.9z"/><circle cx="12" cy="12" r="2.8"/>',
  more: '<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>',
  moreVertical: '<circle cx="12" cy="5.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="18.5" r="1.2" fill="currentColor"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  home: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
  crm: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M3.5 10h17M9 10v9"/>',
  tasks: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  chat: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17h0A2.5 2.5 0 0 1 4 14.5z"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.8-3.8 3.8-5.8 7.5-5.8s6.7 2 7.5 5.8"/>',
  users: '<circle cx="9" cy="9" r="3.3"/><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><path d="M15.5 5.8a3.3 3.3 0 0 1 0 6.4M17.5 14.2c1.9.6 3.1 2.2 3.5 4.8"/>',
  company: '<path d="M4 20V6.5A1.5 1.5 0 0 1 5.5 5h7A1.5 1.5 0 0 1 14 6.5V20M14 10h4.5A1.5 1.5 0 0 1 20 11.5V20M3 20h18M7.5 9h3M7.5 12.5h3M7.5 16h3"/>',
  deal: '<path d="M12 3v18M16.5 7.5c-.6-1.5-2.3-2.5-4.5-2.5-2.5 0-4.5 1.3-4.5 3.3 0 4.7 9.5 2.6 9.5 7.4 0 2-2 3.3-5 3.3-2.3 0-4.2-1-4.8-2.7"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7 7.5 6 7.5-6"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
  file: '<path d="M6.5 3.5h7l5 5v11a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z"/><path d="M13.5 3.5v5h5"/>',
  folder: '<path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z"/>',
  chart: '<path d="M4 20h16M7 16v-5M12 16V7M17 16v-8"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14 8 3 3"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-12.5M10 11v6M14 11v6"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  upload: '<path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9M5 19.5h14"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  star: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7L9.6 9z"/>',
  pin: '<path d="M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v6"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="0.6" fill="currentColor"/>',
  warning: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/>',
  error: '<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>',
  success: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.3 2.4 2.4 4.6-5"/>',
  sparkles: '<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.5l-1.8-5.8-5.7-1.9L10.2 9z"/><path d="M18.5 3v3M17 4.5h3M5.5 17v3M4 18.5h3"/>',
  logout: '<path d="M14 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4M10 16l-4-4 4-4M6 12h10"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="5" cy="6.5" r="0.8" fill="currentColor"/><circle cx="5" cy="12" r="0.8" fill="currentColor"/><circle cx="5" cy="17.5" r="0.8" fill="currentColor"/>',
  kanban: '<rect x="4" y="4" width="4.5" height="16" rx="1.2"/><rect x="9.8" y="4" width="4.5" height="10" rx="1.2"/><rect x="15.5" y="4" width="4.5" height="13" rx="1.2"/>',
  robot: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4.5V8M3 13v2M21 13v2"/><circle cx="9.5" cy="13" r="1" fill="currentColor"/><circle cx="14.5" cy="13" r="1" fill="currentColor"/>',
  paperclip: '<path d="m20 11.5-7.8 7.8a5 5 0 0 1-7.1-7.1l8.3-8.3a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17.5 5-4.5 4 3.5 3-2.5 4.5 3.5"/>',
  send: '<path d="M4 11.5 20 4l-6.5 16-2.5-6.5z"/><path d="m11 13.5 3.5-3.5"/>',
  comment: '<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-8l-4.5 3v-3H5A1.5 1.5 0 0 1 3.5 16V7A1.5 1.5 0 0 1 5 5.5z"/><path d="M8 10h8M8 13h5"/>',
  sms: '<rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8.5 9.5h7M8.5 13h4.5"/>',
  cloudUpload: '<path d="M7 18.5H6a4 4 0 0 1-.4-8 6 6 0 0 1 11.7-1.5A4.5 4.5 0 0 1 18 18.5h-1"/><path d="M12 20v-8M9 14.5l3-3 3 3"/>',
  department: '<rect x="9" y="3.5" width="6" height="5" rx="1.2"/><rect x="3.5" y="15.5" width="6" height="5" rx="1.2"/><rect x="14.5" y="15.5" width="6" height="5" rx="1.2"/><path d="M12 8.5v3.5M6.5 15.5V12h11v3.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.3 2.4 2.4 4.6-5"/>',
  circle: '<circle cx="12" cy="12" r="8.5"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.5a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5v.4"/><circle cx="12" cy="16.6" r="0.6" fill="currentColor"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4.3-3 7.8-7 9-4-1.2-7-4.7-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  externalLink: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13"/><path d="M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10"/>',
  ticket: '<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  support: '<path d="M5 13v-1.5a7 7 0 0 1 14 0V13"/><rect x="3.5" y="12.5" width="4" height="6" rx="1.5"/><rect x="16.5" y="12.5" width="4" height="6" rx="1.5"/><path d="M18.5 18.5c0 1.4-1.6 2-4 2H12"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" fill="currentColor"/>',
  apps: '<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
} as const;

export type IconName = keyof typeof paths;

export const iconNames = Object.keys(paths) as IconName[];

export interface IconOptions {
  size?: number;
  strokeWidth?: number;
  className?: string;
  title?: string;
}

/** SVG-разметка иконки строкой — для vanilla JS / серверных шаблонов. */
export function icon(name: IconName, opts: IconOptions = {}): string {
  const { size = 20, strokeWidth = 1.7, className = 'b24-icon', title } = opts;
  const a11y = title ? `role="img" aria-label="${title}"` : 'aria-hidden="true"';
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${title ? `<title>${title}</title>` : ''}${paths[name]}</svg>`;
}

/** Сырые <path>-фрагменты (для React-обёртки). */
export function iconPaths(name: IconName): string {
  return paths[name];
}

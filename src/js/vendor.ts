import { icon, type IconName } from '../icons';
import { dropdown, type DropdownHandle } from './dropdown';
import { escapeHtml, h, html } from './dom';
import { t } from './i18n';

/**
 * Блок разработчика — стандарт кита для каждого стороннего приложения.
 *
 * Правило (см. README → «Правила кита»):
 *  - место: правый конец верхней строки приложения (тулбар / шапка), последним элементом;
 *  - логотип: горизонтальный, высота 24px, ширина до 140px (SVG или PNG @2x);
 *    если логотипа такого нет — квадратная иконка 24×24 + название компании текстом;
 *    на узких экранах остаётся только иконка;
 *  - по клику — меню: Поддержка (обращения / новое), Политика конфиденциальности, Контакты,
 *    Сайт разработчика, Страница в Маркетплейсе.
 *  Обязательно: название, поддержка, политика конфиденциальности, контакты.
 */

/** URL (откроется в новой вкладке) или обработчик (например, открыть слайдер с обращениями). */
export type VendorLink = string | (() => void);

export interface VendorOptions {
  /** название компании-разработчика (обязательно) */
  name: string;
  /** горизонтальный логотип; для тёмной/Air-подложки можно дать отдельный logoOnDark */
  logo?: string;
  logoOnDark?: string;
  /** квадратная иконка 24×24 — если нет горизонтального логотипа и для мобильных */
  icon?: string;
  app?: { name: string; version?: string };
  links: {
    /** «Мои обращения» (обязательно — support или newTicket) */
    support?: VendorLink;
    newTicket?: VendorLink;
    /** обязательно */
    privacy?: VendorLink;
    /** обязательно */
    contacts?: VendorLink;
    site?: VendorLink;
    marketplace?: VendorLink;
  };
  /** доп. пункты в конце меню */
  extra?: Array<{ label: string; link: VendorLink; icon?: IconName }>;
  /** на тёмной (Air) подложке — по умолчанию определяется автоматически */
  onDark?: boolean;
}

export interface VendorHandle {
  element: HTMLElement;
  open(): void;
  close(): void;
  destroy(): void;
}

/** Проверка обязательных частей правила. Возвращает список нарушений (и пишет их в console.warn). */
export function checkVendor(o: Partial<VendorOptions>): string[] {
  const problems: string[] = [];
  if (!o.name) problems.push('не указано название разработчика (name)');
  if (!o.links?.support && !o.links?.newTicket) problems.push('нет ссылки на поддержку (links.support или links.newTicket)');
  if (!o.links?.privacy) problems.push('нет политики конфиденциальности (links.privacy)');
  if (!o.links?.contacts) problems.push('нет контактов (links.contacts)');
  if (problems.length) console.warn(`[airkit-for-b24] блок разработчика не соответствует правилу кита: ${problems.join('; ')}`);
  return problems;
}

function menuItem(label: string, link: VendorLink, iconName: IconName, external = false): HTMLElement {
  const content = [html(icon(iconName)), h('span', {}, label)] as Node[];
  if (external) content.push(html(icon('externalLink', { className: 'b24-vendor__ext', size: 14 })));
  if (typeof link === 'string') {
    const a = h('a', { class: 'b24-menu__item', href: link, target: '_blank', rel: 'noopener', role: 'menuitem' });
    a.append(...content);
    return a;
  }
  const b = h('button', { type: 'button', class: 'b24-menu__item', role: 'menuitem' });
  b.append(...content);
  b.addEventListener('click', () => link());
  return b;
}

export function createVendor(container: HTMLElement, options: VendorOptions): VendorHandle {
  checkVendor(options);
  const onDark = options.onDark ?? !!container.closest('.b24-app--air, .b24-shell, .b24-toolbar--glass');
  const trigger = h('button', {
    type: 'button',
    class: `b24-vendor${onDark ? ' b24-vendor--on-dark' : ''}`,
    title: t('Разработчик: {name}', { name: options.name }),
    'aria-label': t('Разработчик приложения: {name}. Поддержка и контакты', { name: options.name }),
  });
  const logoSrc = onDark && options.logoOnDark ? options.logoOnDark : options.logo;
  if (logoSrc) {
    trigger.append(h('img', { class: 'b24-vendor__logo', src: logoSrc, alt: options.name }));
    if (options.icon) trigger.append(h('img', { class: 'b24-vendor__icon b24-vendor__icon--mobile', src: options.icon, alt: '' }));
  } else {
    if (options.icon) trigger.append(h('img', { class: 'b24-vendor__icon', src: options.icon, alt: '' }));
    else trigger.append(h('span', { class: 'b24-vendor__monogram', 'aria-hidden': 'true' }, options.name.trim().slice(0, 1).toUpperCase()));
    trigger.append(h('span', { class: 'b24-vendor__name' }, options.name));
  }
  trigger.append(html(icon('chevronDown', { className: 'b24-vendor__chevron', size: 14 })));

  const popup = h('div', { class: 'b24-popup b24-vendor-menu', hidden: true });
  const menu = h('div', { class: 'b24-menu', role: 'menu' });
  const head = h('div', { class: 'b24-vendor-menu__head' });
  head.append(html(`<span class="b24-vendor-menu__app">${escapeHtml(options.app?.name ?? t('Приложение'))}${options.app?.version ? ` <span class="b24-vendor-menu__version">v${escapeHtml(options.app.version)}</span>` : ''}</span><span class="b24-vendor-menu__by">${t('Разработчик: {name}', { name: escapeHtml(options.name) })}</span>`));
  menu.append(head);

  const L = options.links;
  if (L.support || L.newTicket) {
    menu.append(h('div', { class: 'b24-menu__title' }, t('Поддержка')));
    if (L.support) menu.append(menuItem(t('Мои обращения'), L.support, 'ticket'));
    if (L.newTicket) menu.append(menuItem(t('Новое обращение'), L.newTicket, 'plus'));
    menu.append(h('div', { class: 'b24-menu__divider' }));
  }
  if (L.privacy) menu.append(menuItem(t('Политика конфиденциальности'), L.privacy, 'shield'));
  if (L.contacts) menu.append(menuItem(t('Контакты'), L.contacts, 'phone'));
  if (L.site || L.marketplace || options.extra?.length) menu.append(h('div', { class: 'b24-menu__divider' }));
  if (L.site) menu.append(menuItem(t('Сайт разработчика'), L.site, 'link', true));
  if (L.marketplace) menu.append(menuItem(t('Приложение в Маркетплейсе'), L.marketplace, 'apps', true));
  for (const x of options.extra ?? []) menu.append(menuItem(x.label, x.link, x.icon ?? 'link'));
  popup.append(menu);
  container.append(trigger, popup);

  const dd: DropdownHandle = dropdown(trigger, popup, { placement: 'bottom-end' });
  return {
    element: trigger,
    open: dd.open,
    close: dd.close,
    destroy() { dd.destroy(); popup.remove(); trigger.remove(); },
  };
}

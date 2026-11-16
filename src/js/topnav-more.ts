import { icon } from '../icons';
import { h, html } from './dom';
import { dropdown } from './dropdown';
import { t } from './i18n';

/* ── Меню раздела: «Ещё ▾» для пунктов, которые не поместились ─────────
 * Как в Битрикс24 (CRM: «Сделки · Счета · Компании · Контакты · Ещё ▾»). Пункты .b24-topnav__item, которые
 * не влезают в ширину, прячутся (hidden) и появляются в выпадающем меню «Ещё». Счётчики пунктов
 * переезжают в меню, их сумма — на «Ещё»; если открытый пункт спрятан, «Ещё» подсвечен.
 * createPageHeader и <PageHeader> подключают это сами, разметка — через init() (.b24-page-header__menu,
 * .b24-topnav[data-b24-more]). Выключить: data-b24-more="off".
 */
const ITEM = ':scope > .b24-topnav__item:not(.b24-topnav__more)';
const isActive = (el: Element) =>
  el.getAttribute('aria-current') === 'page' || el.getAttribute('aria-current') === 'true' || el.getAttribute('aria-selected') === 'true' || el.classList.contains('is-active');

export function initTopnavMore(nav: HTMLElement): () => void {
  const prev = (nav as HTMLElement & { _b24More?: () => void })._b24More;
  if (prev) return prev;
  nav.classList.add('has-more');
  const label = h('span', {}, t('Ещё'));
  const badge = h('span', { class: 'b24-counter', hidden: '' });
  const more = h('button', { type: 'button', class: 'b24-topnav__item b24-topnav__more', 'aria-haspopup': 'menu', hidden: '' }, label, badge, html(icon('chevronDown', { size: 14 })));
  const popup = h('div', { class: 'b24-popup b24-topnav-menu', hidden: '' });
  const menu = h('div', { class: 'b24-menu', role: 'menu' });
  popup.append(menu);
  document.body.append(popup);
  const dd = dropdown(more, popup, { placement: 'bottom-start' });

  const textOf = (el: Element) => {
    const c = el.cloneNode(true) as Element;
    c.querySelectorAll('.b24-counter, svg').forEach((n) => n.remove());
    return c.textContent?.trim() ?? '';
  };

  let busy = false;
  let stopped = false;
  const layout = () => {
    if (busy || stopped || !nav.isConnected) return;
    busy = true;
    try {
      if (nav.lastElementChild !== more) nav.append(more);
      const items = Array.from(nav.querySelectorAll<HTMLElement>(ITEM));
      items.forEach((el) => { el.hidden = false; });
      more.hidden = true;
      if (!nav.clientWidth) return; // меню скрыто — разложим, когда появится
      // ширина, которую меню получает при всех пунктах (оно сжимается до доступной) — бюджет;
      // пункты по очереди, пока влезают вместе с «Ещё»; открытый пункт — всегда на виду
      const hidden: HTMLElement[] = [];
      // ширина по пунктам, а не scrollWidth: счётчики (right: -4px) выступают за край и дали бы ложное переполнение
      const gap = parseFloat(getComputedStyle(nav).columnGap) || 0;
      const contentW = () => {
        const vis = (Array.from(nav.children) as HTMLElement[]).filter((c) => !c.hidden && c.offsetParent !== null);
        return vis.reduce((a, c) => a + c.getBoundingClientRect().width, 0) + gap * Math.max(0, vis.length - 1);
      };
      const over = () => contentW() > nav.getBoundingClientRect().width + 1;
      if (over()) {
        more.hidden = false;
        // ширина «Ещё» — со счётчиком наибольшей возможной суммы, иначе он появится после замера и не влезет
        const total = items.reduce((acc, el) => acc + (parseInt(el.querySelector('.b24-counter')?.textContent ?? '', 10) || 0), 0);
        badge.hidden = !total;
        badge.textContent = total > 99 ? '99+' : String(total);
        const budget = nav.getBoundingClientRect().width + 1 - more.getBoundingClientRect().width - gap;
        const widths = items.map((el) => el.getBoundingClientRect().width + gap);
        const active = items.findIndex(isActive);
        let used = active >= 0 ? widths[active] : 0;
        let full = false; // порядок пунктов не меняется: после первого спрятанного прячутся и следующие
        items.forEach((el, i) => {
          if (i === active) return;
          if (!full && used + widths[i] <= budget) used += widths[i];
          else { full = true; hidden.push(el); }
        });
        hidden.forEach((el) => { el.hidden = true; });
        // соседи по строке могли забрать место обратно, пока меню сжималось: досчитываем с конца
        for (let i = items.length - 1; i >= 0 && over(); i--) {
          if (i === active || items[i].hidden) continue;
          items[i].hidden = true;
          hidden.push(items[i]);
        }
      }
      hidden.sort((a, b) => items.indexOf(a) - items.indexOf(b));
      menu.replaceChildren(...hidden.map((el) => {
        const count = el.querySelector('.b24-counter')?.textContent?.trim();
        const it = h('button', { type: 'button', class: `b24-menu__item${isActive(el) ? ' is-active' : ''}`, role: 'menuitem' }, h('span', {}, textOf(el)));
        if (isActive(el)) it.setAttribute('aria-current', 'page');
        if (count) it.append(h('span', { class: 'b24-counter b24-menu__counter' }, count));
        it.addEventListener('click', () => { dd.close(); el.click(); });
        return it;
      }));
      const sum = hidden.reduce((a, el) => a + (parseInt(el.querySelector('.b24-counter')?.textContent ?? '', 10) || 0), 0);
      badge.hidden = !sum;
      badge.textContent = sum > 99 ? '99+' : String(sum);
      more.classList.toggle('is-active', hidden.some(isActive));
    } finally {
      busy = false;
    }
  };

  let raf = 0;
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
  ro?.observe(nav);
  if (nav.parentElement) ro?.observe(nav.parentElement);
  const mo = new MutationObserver((records) => {
    if (records.every((r) => r.target === more || more.contains(r.target as Node))) return;
    schedule();
  });
  mo.observe(nav, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-current', 'aria-selected', 'class'] });
  layout();
  void document.fonts?.ready.then(schedule);

  const off = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    ro?.disconnect();
    mo.disconnect();
    dd.destroy();
    popup.remove();
    more.remove();
    nav.querySelectorAll<HTMLElement>(ITEM).forEach((el) => { el.hidden = false; });
    nav.classList.remove('has-more');
    delete (nav as HTMLElement & { _b24More?: () => void })._b24More;
  };
  (nav as HTMLElement & { _b24More?: () => void })._b24More = off;
  return off;
}

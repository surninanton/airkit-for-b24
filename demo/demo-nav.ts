/* Меню демо-страниц слева: одно на всех страницах витрины.
 * На широком экране — колонка слева, на узком и на React-примере (там своё меню портала) — выезжает по кнопке. */
import { icon, type IconName } from '../src/icons';

const SECTIONS: Array<{ title: string; items: Array<[string, string, IconName]> }> = [
  { title: 'Приложение', items: [['index.html', 'Компоненты', 'grid'], ['screens.html', 'Экраны приложения', 'chart'], ['editors.html', 'Редакторы полей', 'edit'], ['controls.html', 'Элементы управления', 'settings'], ['react.html', 'React-пример', 'apps']] },
  { title: 'Сайт', items: [['site.html', 'Сайт приложения', 'home'], ['landing.html', 'Лендинг', 'star'], ['about.html', 'О компании', 'company'], ['blog.html', 'Блог', 'comment'], ['article.html', 'Статья', 'file'], ['docs.html', 'Документы', 'folder']] },
];

const css = `
.demo-nav { position: fixed; z-index: 900; top: 0; bottom: 0; left: 0; width: var(--b24-sidebar-width, 240px); overflow-y: auto; scrollbar-width: none;
  background-color: var(--b24-air-bg-color); background-image: var(--b24-air-bg-image); background-attachment: fixed; background-size: cover;
  transition: transform .2s ease; }
html.has-demo-nav body { padding-left: var(--b24-sidebar-width, 240px); }
.demo-nav-toggle { position: fixed; z-index: 901; left: 12px; bottom: 12px; display: none; }
.demo-nav-backdrop { position: fixed; inset: 0; z-index: 899; background: rgba(0,0,0,.35); display: none; }
@media (max-width: 1000px) {
  html.has-demo-nav body { padding-left: 0; }
  .demo-nav { transform: translateX(-100%); }
  .demo-nav-toggle { display: inline-flex; }
  html.demo-nav-open .demo-nav { transform: none; }
  html.demo-nav-open .demo-nav-backdrop { display: block; }
}
html.demo-nav-overlay body { padding-left: 0; }
html.demo-nav-overlay .demo-nav { transform: translateX(-100%); }
html.demo-nav-overlay .demo-nav-toggle { display: inline-flex; }
html.demo-nav-overlay.demo-nav-open .demo-nav { transform: none; }
html.demo-nav-overlay.demo-nav-open .demo-nav-backdrop { display: block; }
@media print { .demo-nav, .demo-nav-toggle { display: none !important; } html.has-demo-nav body { padding-left: 0; } }
`;

function mount() {
  const here = location.pathname.split('/').pop() || 'index.html';
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  const html = document.documentElement;
  html.classList.add('has-demo-nav');
  // React-пример — макет портала со своим левым меню: меню демо только по кнопке
  if (here === 'react.html') html.classList.add('demo-nav-overlay');

  const aside = document.createElement('aside');
  aside.className = 'demo-nav b24-root';
  aside.setAttribute('aria-label', 'Примеры');
  // разметка сайдбара кита — как меню портала в React-примере
  aside.innerHTML = `<nav class="b24-sidebar">
    <a class="b24-sidebar__brand" href="index.html"><span class="b24-sidebar__brand-mark">24</span><span class="b24-sidebar__brand-text">airkit-for-b24</span></a>
    ${SECTIONS.map((s) => `<div class="b24-sidebar__group"><div class="b24-sidebar__group-title">${s.title}</div>${s.items.map(([href, label, ic]) =>
      `<a class="b24-sidebar__item" href="${href}"${href === here ? ' aria-current="page"' : ''}>${icon(ic)}<span class="b24-sidebar__label">${label}</span></a>`).join('')}</div>`).join('')}
  </nav>`;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'b24-btn b24-btn--primary b24-btn--sm demo-nav-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = '☰ Примеры';
  const backdrop = document.createElement('div');
  backdrop.className = 'demo-nav-backdrop';
  const set = (open: boolean) => { html.classList.toggle('demo-nav-open', open); toggle.setAttribute('aria-expanded', String(open)); };
  toggle.addEventListener('click', () => set(!html.classList.contains('demo-nav-open')));
  backdrop.addEventListener('click', () => set(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  document.body.append(aside, backdrop, toggle);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();

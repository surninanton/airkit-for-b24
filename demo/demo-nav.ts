/* Меню демо-страниц слева: одно на всех страницах витрины.
 * На широком экране — колонка слева, на узком и на React-примере (там своё меню портала) — выезжает по кнопке. */
const SECTIONS: Array<{ title: string; items: Array<[string, string]> }> = [
  { title: 'Приложение', items: [['index.html', 'Компоненты'], ['screens.html', 'Экраны приложения'], ['editors.html', 'Редакторы полей'], ['controls.html', 'Элементы управления'], ['react.html', 'React-пример']] },
  { title: 'Сайт', items: [['site.html', 'Сайт приложения'], ['landing.html', 'Лендинг'], ['about.html', 'О компании'], ['blog.html', 'Блог'], ['article.html', 'Статья'], ['docs.html', 'Документы']] },
];

const css = `
.demo-nav { position: fixed; z-index: 900; top: 0; bottom: 0; left: 0; width: 220px; overflow-y: auto; scrollbar-width: none;
  background-color: var(--b24-air-bg-color); background-image: linear-gradient(rgba(0,0,0,.18), rgba(0,0,0,.18)), var(--b24-air-bg-image); background-size: cover;
  box-shadow: 1px 0 0 rgba(255,255,255,.12); transition: transform .2s ease; }
.demo-nav .b24-sidebar { min-height: 100%; }
.demo-nav__brand { display: flex; align-items: center; gap: 10px; height: 38px; padding: 0 10px; margin-bottom: 6px; color: #fff; font-weight: 600; font-size: 16px; text-decoration: none; }
.demo-nav__brand span { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: rgba(255,255,255,.2); font-size: 12px; }
.demo-nav .b24-sidebar__item { height: 34px; font-size: 14px; }
html.has-demo-nav body { padding-left: 220px; }
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
  aside.innerHTML = `<nav class="b24-sidebar">
    <a class="demo-nav__brand" href="index.html"><span>b24</span>airkit-for-b24</a>
    ${SECTIONS.map((s) => `<div class="b24-sidebar__group-title">${s.title}</div>${s.items.map(([href, label]) =>
      `<a class="b24-sidebar__item${href === here ? ' is-active' : ''}" href="${href}"${href === here ? ' aria-current="page"' : ''}><span class="b24-sidebar__label">${label}</span></a>`).join('')}`).join('')}
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

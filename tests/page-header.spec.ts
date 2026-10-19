import { test, expect, type Page } from '@playwright/test';
import { open, noHorizontalScroll, isMobile } from './helpers';

const warnings = (page: Page) => {
  const list: string[] = [];
  page.on('console', (m) => { if (m.type() === 'warning' && m.text().includes('Компоновка')) list.push(m.text()); });
  return list;
};

test.describe('шапка раздела', () => {
  test('демо: порядок как в портале, без замечаний компоновки', async ({ page }) => {
    const warned = warnings(page);
    const { errors } = await open(page, '/index.html');
    const header = page.locator('#demo-app-header .b24-page-header');
    await expect(header.locator('.b24-page-header__menu .b24-topnav__item')).toHaveCount(4);
    await expect(header.locator('.b24-page-header__title')).toHaveText('Обращения портала');

    if (!isMobile(page)) {
      // «Создать» сразу после заголовка, селектор после «Создать», tools — у правого края
      const box = async (sel: string) => (await header.locator(sel).boundingBox())!;
      const title = await box('.b24-page-header__title');
      const create = await box('.b24-page-header__create');
      const sel = await box('.b24-page-header__selectors');
      const tools = await box('.b24-page-header__tools');
      const row = await box('.b24-page-header__main');
      expect(create.x).toBeGreaterThan(title.x + title.width);
      expect(create.x - (title.x + title.width)).toBeLessThan(30);
      expect(sel.x).toBeGreaterThan(create.x + create.width);
      expect(Math.abs(tools.x + tools.width - (row.x + row.width))).toBeLessThan(2);
    }

    // меню раздела, вид и счётчики переключаются через API
    await header.locator('.b24-topnav__item', { hasText: 'Обзор' }).click();
    await expect(header.locator('.b24-page-header__title')).toHaveText('Обзор');
    await expect(header.locator('.b24-topnav__item[aria-current="page"]')).toHaveText('Обзор');
    await header.locator('.b24-tabs__item', { hasText: 'Доска' }).click();
    await expect(header.locator('.b24-tabs__item', { hasText: 'Доска' })).toHaveAttribute('aria-selected', 'true');

    await noHorizontalScroll(page);
    expect(errors()).toEqual([]);
    expect(warned).toEqual([]);
  });

  test('checkLayout: «Создать» и фильтр справа, текст в tools — замечания в консоль', async ({ page }) => {
    const warned = warnings(page);
    await open(page, '/index.html');
    const found = await page.evaluate(async () => {
      const B24UI = (window as unknown as { B24UI: typeof import('../src/js/index') }).B24UI;
      const box = document.createElement('div');
      box.innerHTML = `
        <div class="b24-toolbar"><div class="b24-toolbar__row">
          <h1 class="b24-toolbar__title">Действия</h1>
          <div class="b24-toolbar__right"><select class="b24-select"></select><button class="b24-btn b24-btn--success">Создать</button></div>
        </div></div>
        <div class="b24-toolbar"><div class="b24-toolbar__row">
          <h1 class="b24-toolbar__title">Сделки</h1>
          <div class="b24-toolbar__search"><div class="b24-filter"></div></div>
          <button class="b24-btn b24-btn--success">Добавить</button>
        </div></div>
        <header class="b24-page-header"><div class="b24-page-header__main">
          <h1 class="b24-page-header__title">Задачи</h1>
          <div class="b24-page-header__tools"><button class="b24-btn b24-btn--glass">Роботы</button><div class="b24-filter"></div></div>
        </div></header>`;
      document.body.append(box);
      const list = B24UI.checkLayout(box).map((r) => r.message);
      B24UI.init(box);
      B24UI.init(box); // повторно не предупреждает
      box.remove();
      return list;
    });
    expect(found).toHaveLength(4);
    expect(found[0]).toContain('«Создать»');
    expect(found[0]).toContain('.b24-toolbar__right');
    expect(found.some((m) => m.includes('Фильтр стоит в .b24-page-header__tools'))).toBe(true);
    expect(found.some((m) => m.includes('только кнопки-иконки') && m.includes('«Роботы»'))).toBe(true);
    expect(found.some((m) => m.includes('«Добавить»') && m.includes('после фильтра'))).toBe(true);
    await expect.poll(() => warned.length).toBe(4);
  });

  test('меню раздела из вкладок на одной странице: кнопки без оформления браузера, панели переключаются', async ({ page }) => {
    await open(page, '/index.html');
    const res = await page.evaluate(async () => {
      const B24UI = (window as unknown as { B24UI: typeof import('../src/js/index') }).B24UI;
      const box = document.createElement('div');
      box.setAttribute('data-b24-tabs-scope', '');
      box.innerHTML = '<div id="ph"></div><div data-b24-tab-panel="overview">О</div><div data-b24-tab-panel="support">П</div>';
      document.querySelector('.b24-page')!.append(box);
      const ph = B24UI.createPageHeader(box.querySelector('#ph') as HTMLElement, {
        menu: [{ label: 'Обзор', tab: 'overview' }, { label: 'Поддержка', tab: 'support', active: true }],
        title: 'Поддержка',
      });
      const panels = () => [...box.querySelectorAll<HTMLElement>('[data-b24-tab-panel]')].map((p) => p.hidden);
      const btn = box.querySelectorAll<HTMLElement>('button.b24-topnav__item');
      const style = (el: HTMLElement) => { const c = getComputedStyle(el); return [c.backgroundColor, c.borderTopWidth]; };
      const start = { panels: panels(), inactive: style(btn[0]), active: style(btn[1]) };
      ph.setMenu('overview');
      const after = { panels: panels(), selected: btn[0].getAttribute('aria-selected') };
      box.remove();
      return { start, after };
    });
    expect(res.start.panels).toEqual([true, false]);
    expect(res.start.inactive).toEqual(['rgba(0, 0, 0, 0)', '0px']);
    expect(res.start.active[0]).not.toBe('rgba(0, 0, 0, 0)');
    expect(res.after).toEqual({ panels: [false, true], selected: 'true' });
  });
});

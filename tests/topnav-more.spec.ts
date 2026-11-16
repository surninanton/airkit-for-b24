import { test, expect } from '@playwright/test';
import { open } from './helpers';

type Api = typeof import('../src/js/index');

test('меню раздела: не поместившиеся пункты — в «Ещё ▾» со счётчиками', async ({ page }) => {
  const { errors } = await open(page, '/index.html');
  await page.evaluate(() => {
    const B24UI = (window as unknown as { B24UI: Api }).B24UI;
    const host = document.createElement('div');
    host.id = 'ph';
    host.className = 'b24-app b24-app--air';
    host.style.width = '520px';
    document.body.prepend(host);
    (window as unknown as { __clicked: string }).__clicked = '';
    const labels = ['Сделки', 'Счета', 'Компании', 'Контакты', 'Товары', 'Аналитика', 'Роботы', 'Настройки'];
    B24UI.createPageHeader(host, {
      title: 'Сделки',
      menu: labels.map((label, i) => ({ label, href: `#${i}`, active: i === 6, counter: i === 5 ? 3 : i === 7 ? 2 : undefined, onClick: () => { (window as unknown as { __clicked: string }).__clicked = label; } })),
    });
  });
  const nav = page.locator('#ph .b24-page-header__menu');
  const more = nav.locator('.b24-topnav__more');
  await expect(more).toBeVisible();
  // ничего не вылезает за меню
  expect(await nav.evaluate((n) => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
  // открытый пункт («Роботы») остаётся на виду, хотя он почти в конце
  await expect(nav.locator('.b24-topnav__item', { hasText: 'Роботы' })).toBeVisible();
  const hiddenCount = await nav.locator('.b24-topnav__item:not(.b24-topnav__more)[hidden]').count();
  expect(hiddenCount).toBeGreaterThan(0);
  // сумма счётчиков спрятанных пунктов — на «Ещё»
  const hiddenSum = await nav.evaluate((n) => Array.from(n.querySelectorAll('.b24-topnav__item:not(.b24-topnav__more)[hidden] .b24-counter')).reduce((a, c) => a + Number(c.textContent), 0));
  if (hiddenSum) await expect(more.locator('.b24-counter')).toHaveText(String(hiddenSum));
  await more.click();
  const menu = page.locator('.b24-topnav-menu:not([hidden])');
  await expect(menu.locator('.b24-menu__item')).toHaveCount(hiddenCount);
  await menu.locator('.b24-menu__item', { hasText: 'Настройки' }).click();
  expect(await page.evaluate(() => (window as unknown as { __clicked: string }).__clicked)).toBe('Настройки');
  // шире — всё помещается, «Ещё» пропадает
  await page.evaluate(() => { document.getElementById('ph')!.style.width = '1200px'; });
  await expect(more).toBeHidden();
  await expect(nav.locator('.b24-topnav__item:not(.b24-topnav__more)[hidden]')).toHaveCount(0);
  expect(errors()).toEqual([]);
});

test('вкладки b24-tabs--glass без --pills: отступы и скругление у пунктов', async ({ page }) => {
  await open(page, '/index.html');
  const res = await page.evaluate(() => {
    const host = document.createElement('div');
    host.className = 'b24-app b24-app--air';
    host.innerHTML = '<div class="b24-tabs b24-tabs--glass" role="tablist"><button class="b24-tabs__item" aria-selected="true">Канбан</button><button class="b24-tabs__item">Список</button></div>';
    document.body.prepend(host);
    const tabs = host.querySelector<HTMLElement>('.b24-tabs')!;
    const item = host.querySelector<HTMLElement>('.b24-tabs__item')!;
    const cs = getComputedStyle(item);
    return { display: getComputedStyle(tabs).display, padL: cs.paddingLeft, radius: cs.borderTopLeftRadius, width: tabs.getBoundingClientRect().width, host: host.getBoundingClientRect().width };
  });
  expect(res.display).toBe('inline-flex');
  expect(res.padL).toBe('10px');
  expect(res.radius).toBe('6px');
  expect(res.width).toBeLessThan(res.host / 2);
});

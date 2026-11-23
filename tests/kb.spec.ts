import { expect, test } from '@playwright/test';
import { noHorizontalScroll, open } from './helpers';

const labels = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).kbTree.getItems().map((i: any) => `${i.id}:${(i.children ?? []).map((c: any) => c.id).join(',')}`));

test('дерево: перетаскивание за ручку — порядок и перенос внутрь', async ({ page }) => {
  const { errors } = await open(page, '/kb.html');
  const drag = async (from: string, to: string, where: 'before' | 'after' | 'inside') => {
    const g = await page.locator(`[data-id="${from}"] > .b24-tree__node > .b24-tree__grip`).boundingBox();
    const t = await page.locator(`[data-id="${to}"] > .b24-tree__node`).boundingBox();
    const y = where === 'before' ? t!.y + 2 : where === 'after' ? t!.y + t!.height - 2 : t!.y + t!.height / 2;
    await page.mouse.move(g!.x + g!.width / 2, g!.y + g!.height / 2);
    await page.mouse.down();
    await page.mouse.move(t!.x + 80, y - 5, { steps: 4 });
    await page.mouse.move(t!.x + 80, y, { steps: 4 });
    await page.mouse.up();
  };
  await drag('faq', 'start', 'before');
  expect((await labels(page))[0]).toBe('faq:');
  await drag('faq', 'orders', 'inside');
  expect(await labels(page)).toEqual(['start:login,roles', 'orders:accept,refund,faq']);
  await drag('login', 'refund', 'after');
  expect((await labels(page))[1]).toBe('orders:accept,refund,login,faq');
  await expect(page.locator('#tree-out')).toContainText('Перенос login');
  await expect(page.locator('.b24-savestatus')).toBeVisible();
  expect(errors()).toEqual([]);
});

test('дерево: Alt+стрелки, меню «…», переименование и вложенный', async ({ page }) => {
  await open(page, '/kb.html');
  await page.locator('[data-id="roles"] > .b24-tree__node').focus();
  await page.keyboard.press('Alt+ArrowUp');
  expect((await labels(page))[0]).toBe('start:roles,login');
  await page.locator('[data-id="faq"] > .b24-tree__node').hover();
  await page.locator('[data-id="faq"] > .b24-tree__node > .b24-tree__more').click();
  await expect(page.locator('.b24-context-menu [role="menuitem"]')).toHaveCount(3);
  await page.locator('.b24-context-menu [role="menuitem"]', { hasText: 'Добавить вложенный' }).click();
  expect((await labels(page))[2]).toBe('faq:new-1');
  await page.locator('[data-id="faq"] > .b24-tree__node').hover();
  await page.locator('[data-id="faq"] > .b24-tree__node > .b24-tree__more').click();
  await page.locator('.b24-context-menu [role="menuitem"]', { hasText: 'Переименовать' }).click();
  await page.locator('.b24-tree__rename').fill('Вопросы');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-id="faq"] > .b24-tree__node .b24-tree__label')).toHaveText('Вопросы');
});

test('статья в панели: оглавление следит за прокруткой панели, setFooter меняет футер', async ({ page }) => {
  const { errors } = await open(page, '/kb.html');
  await page.locator('#open-article').click();
  const body = page.locator('.b24-sidepanel__body');
  await expect(page.locator('.b24-toc a')).toHaveCount(3);
  await expect(page.locator('.b24-toc a.is-active')).toHaveText('Подготовка');
  await body.evaluate((e) => { e.scrollTop = e.scrollHeight; });
  await expect(page.locator('.b24-toc a.is-active')).toHaveText('Итоги');
  await page.locator('.b24-toc a', { hasText: 'Порядок действий' }).click();
  await expect(page.locator('.b24-toc a.is-active')).toHaveText('Порядок действий');
  await expect(page.locator('.b24-prose blockquote cite')).toBeVisible();
  // вложенный чек-лист — под пунктом, зачёркивание не задевает подпункты без галочки; свой флажок синий
  const nested = page.locator('.b24-prose .b24-checklist .b24-checklist li').first();
  const outer = page.locator('.b24-prose > .b24-checklist > li').first();
  expect((await nested.boundingBox())!.y).toBeGreaterThan((await outer.locator('> span').boundingBox())!.y + 10);
  expect(await page.locator('.b24-prose input:checked').first().evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe('rgb(255, 255, 255)');
  // заголовки ищутся в панели, а не по первому id на странице
  expect(await page.locator('.b24-toc a').first().evaluate((a) => (a as HTMLAnchorElement).hash)).toBe('#section-1');
  await expect(page.locator('.b24-prose mark')).toBeVisible();
  await page.locator('[data-act="1"]').click();
  await expect(page.locator('.b24-sidepanel__title')).toHaveText('Возврат чека');
  await expect(page.locator('.b24-sidepanel__footer [data-act="0"]')).toBeVisible();
  await expect(page.locator('.b24-sidepanel__footer [data-act="1"]')).toHaveCount(0);
  expect(errors()).toEqual([]);
});

test('индикатор автосохранения и тема блочного редактора', async ({ page }) => {
  await open(page, '/kb.html');
  const st = page.locator('.b24-savestatus');
  await expect(st).toBeHidden();
  await page.evaluate(() => (window as any).kbStatus.setState('saving'));
  await expect(st).toContainText('Сохраняю…');
  await page.evaluate(() => (window as any).kbStatus.setState('saved', { time: new Date(2026, 0, 1, 14, 32) }));
  await expect(st).toHaveText('Сохранено · 14:32');
  await page.evaluate(() => (window as any).kbStatus.setState('error'));
  await expect(st).toContainText('Не сохранено — повторяю');
  await page.evaluate(() => (window as any).kbStatus.setState('neutral', { text: 'Опубликованная версия' }));
  await expect(st).toHaveText('Опубликованная версия');
  await expect(st.locator('.b24-savestatus__icon')).toBeHidden();
  const warn = await page.locator('.b24-blockeditor .cdx-warning').evaluate((e) => getComputedStyle(e).borderLeftWidth);
  expect(warn).toBe('3px');
  await noHorizontalScroll(page);
});

test('панель 390: футер в один ряд, оглавление в панели липкое', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page, '/kb.html');
  await page.locator('#open-article').click();
  const tops = await page.locator('.b24-sidepanel__footer > :visible').evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLElement).offsetTop))]);
  expect(tops.length).toBe(1);
  await expect(page.locator('[data-b24-more]')).toBeVisible();
});

test('дерево на узком экране: подпись не уходит под значок', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page, '/kb.html');
  const node = page.locator('[data-id="login"] > .b24-tree__node');
  const [label, grip] = await Promise.all([node.locator('.b24-tree__label').boundingBox(), node.locator('.b24-tree__grip').boundingBox()]);
  expect(Math.abs(label!.y - grip!.y)).toBeLessThan(12);
});

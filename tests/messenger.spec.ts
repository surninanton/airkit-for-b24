import { test, expect } from '@playwright/test';
import { open } from './helpers';

const mobile = (page: import('@playwright/test').Page) => (page.viewportSize()?.width ?? 1280) <= 768;

test('панель мессенджера: аватары, счётчики, подсказка, окно чата по клику', async ({ page }) => {
  const { errors } = await open(page, '/chat.html');
  const bar = page.locator('.b24-im-bar');
  if (mobile(page)) { await expect(bar).toBeHidden(); return; }
  await expect(bar).toBeVisible();
  await expect(bar.locator('.b24-im-bar__item')).toHaveCount(7);
  await expect(bar.locator('.b24-im-bar__item').first().locator('.b24-counter')).toHaveText('2');
  await expect(bar.locator('.b24-im-bar__all .b24-counter')).toHaveText('5');
  // контент не под панелью
  const right = await page.evaluate(() => {
    const app = document.querySelector('.b24-page')!.getBoundingClientRect();
    return { app: app.right, bar: document.querySelector('.b24-im-bar')!.getBoundingClientRect().left };
  });
  expect(right.app).toBeLessThanOrEqual(right.bar + 1);
  await bar.locator('.b24-im-bar__item').nth(2).hover();
  await expect(page.locator('.b24-im-bar__tip')).toHaveText('Пётр Тестов · MAX');
  await bar.locator('.b24-im-bar__item').nth(1).click();
  await expect(bar.locator('.b24-im-bar__item').nth(1)).toHaveClass(/is-active/);
  const dock = page.locator('.b24-chat-dock');
  await expect(dock).toHaveCount(1);
  await expect(dock.locator('.b24-chat-dock__name')).toHaveText('Иван Примеров');
  // ответ из окна
  await dock.locator('.b24-chat-composer__input').fill('Ответ из окна');
  await dock.locator('.b24-chat-composer__input').press('Enter');
  await expect(dock.locator('.b24-chat-msg.is-out').last()).toContainText('Ответ из окна');
  // свернуть — полоска; повторный open того же id — развернуть, а не второе окно
  await dock.getByRole('button', { name: 'Свернуть' }).click();
  await expect(dock).toHaveClass(/is-minimized/);
  await expect(dock.locator('.b24-chat-dock__body')).toBeHidden();
  await bar.locator('.b24-im-bar__item').nth(1).click();
  await expect(dock).not.toHaveClass(/is-minimized/);
  await expect(page.locator('.b24-chat-dock')).toHaveCount(1);
  // второе окно — в ряд левее
  await bar.locator('.b24-im-bar__item').nth(4).click();
  await expect(page.locator('.b24-chat-dock')).toHaveCount(2);
  const xs = await page.locator('.b24-chat-dock').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().left));
  expect(xs[0]).toBeGreaterThan(xs[1]);
  await page.locator('.b24-chat-dock').first().getByRole('button', { name: 'Закрыть' }).click();
  await expect(page.locator('.b24-chat-dock')).toHaveCount(1);
  expect(errors()).toEqual([]);
});

test('окно чата на телефоне — нижний лист 70% высоты; счётчик на свёрнутом', async ({ page }) => {
  await open(page, '/chat.html');
  await page.evaluate(() => document.getElementById('dock-incoming')!.click());
  const dock = page.locator('.b24-chat-dock');
  await expect(dock).toHaveCount(1);
  const box = (await dock.boundingBox())!;
  const vp = page.viewportSize()!;
  if (mobile(page)) {
    expect(Math.round(box.width)).toBe(vp.width);
    expect(Math.abs(box.height - vp.height * 0.7)).toBeLessThan(4);
  } else {
    expect(box.width).toBeCloseTo(360, 0);
  }
  await dock.getByRole('button', { name: 'Свернуть' }).click();
  await page.evaluate(() => document.getElementById('dock-incoming')!.click());
  await expect(dock.locator('.b24-chat-dock__counter')).toHaveText('1');
  await dock.locator('.b24-chat-dock__title').click();
  await expect(dock).not.toHaveClass(/is-minimized/);
  await expect(dock.locator('.b24-chat-dock__counter')).toBeHidden();
});

test('звук и уведомления: дедупликация между вкладками, без разрешения — null', async ({ page, context }) => {
  await open(page, '/chat.html');
  const page2 = await context.newPage();
  await page2.goto('/chat.html');
  const claim = (p: typeof page) => p.evaluate(() => (window as unknown as { B24UI: typeof import('../src/js/index') }).B24UI.claimNotify('msg-42'));
  const [a, b] = await Promise.all([claim(page), claim(page2)]);
  expect([a, b].filter(Boolean)).toHaveLength(1);
  // до клика звук молчит, после — играет
  expect(await page.evaluate(() => (window as unknown as { B24UI: typeof import('../src/js/index') }).B24UI.notifySound())).toBe(false);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  expect(await page.evaluate(() => (window as unknown as { B24UI: typeof import('../src/js/index') }).B24UI.notifySound())).toBe(true);
  expect(await page.evaluate(async () => (await (window as unknown as { B24UI: typeof import('../src/js/index') }).B24UI.desktopNotify({ title: 'x', onlyHidden: false })) === null)).toBe(true);
  await page2.close();
});

test('React: панель мессенджера открывает окно чата', async ({ page }) => {
  const { errors } = await open(page, '/react.html');
  if (mobile(page)) { await expect(page.locator('.b24-im-bar')).toBeHidden(); return; }
  await page.locator('.b24-im-bar__item').nth(1).click();
  const dock = page.locator('.b24-chat-dock');
  await expect(dock.locator('.b24-chat-dock__name')).toHaveText('Иван Примеров');
  await dock.locator('.b24-chat-composer__input').fill('Привет');
  await dock.locator('.b24-chat-composer__input').press('Enter');
  await expect(dock.locator('.b24-chat-msg.is-out')).toContainText('Привет');
  await dock.getByRole('button', { name: 'Закрыть' }).click();
  await expect(dock).toHaveCount(0);
  expect(errors()).toEqual([]);
});

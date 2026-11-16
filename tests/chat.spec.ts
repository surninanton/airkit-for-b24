import { test, expect } from '@playwright/test';
import { open, isMobile, noHorizontalScroll } from './helpers';

const mobile = (page: import('@playwright/test').Page) => (page.viewportSize()?.width ?? 1280) <= 768;

test('чаты: список, лента, отправка, «не доставлено», без ошибок', async ({ page }) => {
  const { errors } = await open(page, '/chat.html');
  const chat = page.locator('#chat');
  const list = chat.locator('.b24-chat-list');
  await expect(list.locator('.b24-chat-list__item')).toHaveCount(7);
  await expect(list.locator('.b24-chat-list__item.is-active')).toContainText('Мария Образцова');
  await expect(list.locator('.b24-chat-list__item').nth(2)).toContainText('Вы:');
  await expect(list.locator('.b24-chat-list__item').nth(3).locator('.b24-counter')).toHaveText('1');
  if (mobile(page)) await list.locator('.b24-chat-list__item').first().click();
  const feed = chat.locator('.b24-chat-feed');
  await expect(feed.locator('.b24-chat-date').first()).toBeVisible();
  // лента внизу
  await expect.poll(() => feed.evaluate((f) => f.scrollHeight - f.scrollTop - f.clientHeight)).toBeLessThan(5);
  await expect(feed.locator('.b24-chat-system')).toContainText('Диалог принят');
  await expect(feed.locator('.b24-chat-att--geo')).toContainText('ул. Строителей, 12');
  await expect(feed.locator('.b24-chat-att--file')).toContainText('1,8 МБ');
  await expect(feed.locator('.b24-chat-att--voice audio')).toHaveCount(1);
  await expect(feed.locator('.b24-chat-msg.is-failed .b24-chat-msg__error')).toContainText('клиент ограничил');
  await expect(feed.locator('.b24-chat-msg__text a')).toHaveAttribute('href', 'https://example.com/menu');
  // Shift+Enter — новая строка, Enter — отправка
  const input = chat.locator('.b24-chat-composer__input');
  await input.click();
  await page.keyboard.type('Первая строка');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('вторая');
  await expect(input).toHaveValue('Первая строка\nвторая');
  await page.keyboard.press('Enter');
  await expect(input).toHaveValue('');
  const last = feed.locator('.b24-chat-msg').last();
  await expect(last).toHaveClass(/is-out/);
  await expect(last.locator('.b24-chat-msg__text')).toHaveText('Первая строка\nвторая');
  await expect(last.locator('.b24-chat-msg__status')).toHaveClass(/is-delivered/);
  await expect.poll(() => feed.evaluate((f) => f.scrollHeight - f.scrollTop - f.clientHeight)).toBeLessThan(5);
  // «Повторить»
  await page.keyboard.type('ошибка связи');
  await page.keyboard.press('Enter');
  await expect(feed.locator('.b24-chat-msg').last()).toHaveClass(/is-failed/);
  await feed.locator('.b24-chat-msg').last().getByRole('button', { name: 'Повторить' }).click();
  await expect(feed.locator('.b24-chat-msg').last().locator('.b24-chat-msg__status')).toHaveClass(/is-delivered/);
  // быстрый ответ вставляет текст
  await chat.locator('.b24-chat-composer__reply').first().click();
  await expect(input).toHaveValue('Здравствуйте! Чем могу помочь?');
  if (!mobile(page)) await expect(list.locator('.b24-chat-list__item').first()).toContainText('Вы: ошибка связи');
  await noHorizontalScroll(page);
  expect(errors()).toEqual([]);
});

test('чаты: «Показать раньше» — позиция прокрутки сохраняется', async ({ page }) => {
  await open(page, '/chat.html');
  const chat = page.locator('#chat');
  if (mobile(page)) await chat.locator('.b24-chat-list__item').first().click();
  const feed = chat.locator('.b24-chat-feed');
  await expect.poll(() => feed.evaluate((f) => f.scrollHeight - f.scrollTop - f.clientHeight)).toBeLessThan(5);
  const anchor = feed.locator('.b24-chat-system').first();
  await feed.evaluate((f) => { f.scrollTop = 0; });
  await expect(feed.locator('.b24-chat-msg')).toHaveCount(22, { timeout: 5000 });
  const before = await anchor.evaluate((el) => el.getBoundingClientRect().top);
  // якорь остался на месте (±2px): лента не прыгнула к началу
  const top = await feed.evaluate((f) => f.scrollTop);
  expect(top).toBeGreaterThan(100);
  expect(Math.abs(before - (await anchor.evaluate((el) => el.getBoundingClientRect().top)))).toBeLessThan(2);
});

test('чаты: телефон — одна колонка, «назад»; список стрелками', async ({ page }) => {
  await open(page, '/chat.html');
  const chat = page.locator('#chat');
  const items = chat.locator('.b24-chat-list__item');
  if (!mobile(page)) {
    await items.nth(0).focus();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(items.nth(1)).toHaveClass(/is-active/);
    await expect(chat.locator('#chat-name')).toHaveText('Иван Примеров');
    await expect(chat.locator('.b24-chat__aside')).toBeVisible();
    return;
  }
  await expect(chat.locator('.b24-chat__main')).toBeHidden();
  await items.nth(5).click(); // закрытый диалог
  await expect(chat).toHaveClass(/is-dialog-open/);
  await expect(chat.locator('.b24-chat__main')).toBeVisible();
  await expect(chat.locator('.b24-chat-composer__blocked')).toContainText('Диалог закрыт');
  await chat.locator('[data-b24-chat-back]').click();
  await expect(chat).not.toHaveClass(/is-dialog-open/);
  await expect(chat.locator('.b24-chat-list')).toBeVisible();
});

test('чаты в React: выбор диалога и отправка', async ({ page }) => {
  const { errors } = await open(page, '/react.html');
  if (isMobile(page)) await page.locator('.b24-shell__header .b24-shell__toggle').click();
  await page.locator('.b24-sidebar__item', { hasText: 'Мессенджер' }).click();
  const chat = page.locator('.b24-chat');
  await expect(chat.locator('.b24-chat-list__item')).toHaveCount(3);
  if (mobile(page)) {
    // открыт первый диалог — на телефоне видна переписка; «назад» к списку
    if (await page.locator('.b24-shell.is-menu-open').count()) await page.locator('.b24-shell__header .b24-shell__toggle').click();
    await chat.locator('[data-b24-chat-back]').click();
    await expect(chat).not.toHaveClass(/is-dialog-open/);
  }
  await chat.locator('.b24-chat-list__item').nth(1).click();
  await expect(chat.locator('.b24-chat__head-name')).toHaveText('Иван Примеров');
  await chat.locator('.b24-chat-composer__input').fill('Привет из React');
  await chat.locator('.b24-chat-composer__input').press('Enter');
  await expect(chat.locator('.b24-chat-msg.is-out').last()).toContainText('Привет из React');
  await expect(chat.locator('.b24-chat-list__item').nth(1)).toContainText('Вы: Привет из React');
  if (mobile(page)) {
    await chat.locator('[data-b24-chat-back]').click();
    await expect(chat).not.toHaveClass(/is-dialog-open/);
  }
  expect(errors()).toEqual([]);
});

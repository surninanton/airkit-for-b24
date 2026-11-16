import { test, expect } from '@playwright/test';
import { open } from './helpers';

type P = import('@playwright/test').Page;
const mobile = (page: P) => (page.viewportSize()?.width ?? 1280) <= 768;
/** на телефоне после загрузки виден список: открываем первый диалог */
const openDialog = async (page: P) => { if (mobile(page)) await page.locator('#chat-list .b24-chat-list__item').first().click(); };

test('эмодзи: панель из поля ответа, поиск по-русски, вставка в позицию курсора, «Частые»', async ({ page }) => {
  const { errors } = await open(page, '/chat.html');
  await openDialog(page);
  await page.evaluate(() => localStorage.removeItem('b24-emoji-recent'));
  const input = page.locator('#chat-composer .b24-chat-composer__input');
  await input.fill('Привет!');
  await input.evaluate((el: HTMLTextAreaElement) => { el.setSelectionRange(6, 6); });
  await page.locator('.b24-chat-composer__emoji').click();
  const panel = page.locator('.b24-emoji');
  await expect(panel).toBeVisible();
  await panel.locator('.b24-emoji__search').fill('пицца');
  await expect(panel.locator('.b24-emoji__btn')).toHaveText(['🍕']);
  await panel.locator('.b24-emoji__search').fill('qqq');   // нет такого слова
  await expect(panel.locator('.b24-emoji__empty')).toBeVisible();
  await panel.locator('.b24-emoji__search').fill('спасибо');
  await panel.locator('.b24-emoji__btn').first().click();
  await expect(panel).toHaveCount(0);
  await expect(input).toHaveValue('Привет🙏!');
  // «Частые»
  await page.locator('.b24-chat-composer__emoji').click();
  await expect(page.locator('.b24-emoji__tab').first()).toHaveAttribute('title', 'Частые');
  await expect(page.locator('.b24-emoji__btn').first()).toHaveText('🙏');
  await page.keyboard.press('Escape');
  await expect(page.locator('.b24-emoji')).toHaveCount(0);
  if (mobile(page)) {
    await page.locator('.b24-chat-composer__emoji').click();
    const box = await page.locator('.b24-emoji').boundingBox();
    const vh = page.viewportSize()!.height;
    expect(Math.abs(box!.y + box!.height - vh)).toBeLessThan(2);   // нижний лист
    expect(Math.round(box!.width)).toBe(page.viewportSize()!.width);
  }
  expect(errors()).toEqual([]);
});

test('реакции: чип, полоска по наведению, onReact ставит и снимает, меню «Копировать»', async ({ page }) => {
  await open(page, '/chat.html');
  await openDialog(page);
  const msg = page.locator('.b24-chat-msg[data-id="m2"]');
  await expect(msg.locator('.b24-chat-reaction')).toHaveText('🍕2');
  await expect(msg.locator('.b24-chat-reaction')).toHaveAttribute('title', 'Иван, Елена');
  await msg.locator('.b24-chat-reaction').click();
  await expect(msg.locator('.b24-chat-reaction')).toHaveText('🍕3');
  await expect(msg.locator('.b24-chat-reaction')).toHaveClass(/is-mine/);
  await msg.locator('.b24-chat-reaction').click();
  await expect(msg.locator('.b24-chat-reaction')).toHaveText('🍕2');
  if (mobile(page)) {
    // долгое нажатие — касанием; в эмуляции тача проверяем класс через событие
    await msg.locator('.b24-chat-msg__bubble').dispatchEvent('pointerdown', { pointerType: 'touch' });
    await expect(msg).toHaveClass(/is-tools/);
  } else {
    await page.mouse.move(2, 2);
    await expect(msg.locator('.b24-chat-msg__tools')).toBeHidden();
    await msg.locator('.b24-chat-msg__bubble').hover();
    await expect(msg.locator('.b24-chat-msg__tools')).toBeVisible();
  }
  await msg.locator('.b24-chat-msg__tool--emoji[data-emoji="❤️"]').click();
  await expect(msg.locator('.b24-chat-reaction[data-emoji="❤️"]')).toHaveText('❤️1');
  // меню: ответить / копировать
  if (!mobile(page)) await page.locator('.b24-chat-msg[data-id="m2"]').locator('.b24-chat-msg__bubble').hover();
  if (mobile(page)) await page.locator('.b24-chat-msg[data-id="m2"]').locator('.b24-chat-msg__bubble').dispatchEvent('pointerdown', { pointerType: 'touch' });
  await page.locator('.b24-chat-msg[data-id="m2"] .b24-chat-msg__tools [aria-haspopup="menu"]').click();
  await expect(page.locator('.b24-chat-menu__item')).toHaveText(['Ответить', 'Копировать']);
  await page.locator('.b24-chat-menu__item', { hasText: 'Ответить' }).click();
  await expect(page.locator('#chat-composer .b24-chat-composer__input')).toHaveValue(/Здравствуйте! Хочу заказать/);
});

test('decorate: вызывается для каждого сообщения и после перерисовки', async ({ page }) => {
  await open(page, '/chat.html');
  await openDialog(page);
  const before = await page.locator('.b24-chat-msg[data-has-order="1"]').count();
  expect(before).toBeGreaterThan(0);
  await page.locator('.b24-chat-msg[data-id="m2"] .b24-chat-msg__tool--emoji[data-emoji="👍"]').click({ force: true });
  await expect(page.locator('.b24-chat-msg[data-has-order="1"]')).toHaveCount(before);
});

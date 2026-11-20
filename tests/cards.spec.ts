import { expect, test } from '@playwright/test';
import { noHorizontalScroll, open } from './helpers';

test('карточка заказа: имя клиента — кнопка в карточку клиента, поверх с «Назад»', async ({ page }) => {
  const { errors } = await open(page, '/cards.html?card=order');
  await expect(page.locator('.b24-sidepanel')).toHaveCount(1);
  await page.locator('.b24-entity-link').first().click();
  await expect(page.locator('.b24-sidepanel')).toHaveCount(2);
  await expect(page.locator('.b24-sidepanel').last().locator('.b24-entity__name')).toHaveText('Степан Громов');
  await page.locator('.b24-sidepanel__back').click();
  await expect(page.locator('.b24-sidepanel')).toHaveCount(1);
  expect(errors()).toEqual([]);
});

test('заказ: круглая «Позвонить», мессенджеры, почта, «изменил» в шапке', async ({ page }) => {
  await open(page, '/cards.html?card=order');
  await expect(page.locator('.b24-prop__value--row .b24-btn--round.b24-btn--success[aria-label="Позвонить"]')).toBeVisible();
  await expect(page.locator('.b24-msgr .b24-btn--channel')).toHaveCount(3);
  await expect(page.locator('.b24-btn--round[aria-label="Написать на почту"]')).toBeVisible();
  await expect(page.locator('.b24-entity__editor')).toContainText('изменил');
});

test('заказ: комментарий закрепляется вверху ленты и открепляется на место', async ({ page }) => {
  await open(page, '/cards.html?card=order');
  const tl = page.locator('#order-timeline');
  // новый комментарий через композер
  await page.locator('.b24-composer__input').click();
  await page.locator('.b24-composer__input').fill('Привет, тест');
  await page.locator('[data-b24-composer-submit]').click();
  const item = tl.locator('.b24-timeline__item', { hasText: 'Привет, тест' });
  const before = await tl.locator('.b24-timeline__item').evaluateAll((els) => els.map((e) => e.textContent?.slice(0, 20)));
  await item.locator('[data-b24-pin]').click();
  await expect(tl.locator('.b24-timeline__divider--pinned')).toHaveText('Закреплено');
  await expect(tl.locator('.b24-timeline__item').first()).toContainText('Привет, тест');
  await expect(item).toHaveClass(/b24-timeline__item--pinned/);
  await item.locator('[data-b24-pin]').click();
  await expect(tl.locator('.b24-timeline__divider--pinned')).toHaveCount(0);
  expect(await tl.locator('.b24-timeline__item').evaluateAll((els) => els.map((e) => e.textContent?.slice(0, 20)))).toEqual(before);
});

test('заказ: способ оплаты не меняется при фискальном чеке, пока не сделан возврат', async ({ page }) => {
  await open(page, '/cards.html?card=order');
  await expect(page.locator('#pay-method')).toBeDisabled();
  await expect(page.locator('#pay-fiscal')).toBeVisible();
  await page.locator('#pay-refund').click();
  await page.locator('.b24-modal .b24-btn--danger').click();
  await expect(page.locator('#pay-method')).toBeEnabled();
  await expect(page.locator('#pay-fiscal')).toBeHidden();
  await expect(page.locator('#pay-print')).toBeVisible();
  await page.locator('#pay-print').click();
  await expect(page.locator('#pay-method')).toBeDisabled();
});

test('профиль: имя только в шапке, поля и «Сохранить» — после «Изменить», вкладки переключаются', async ({ page }) => {
  await open(page, '/cards.html?card=profile');
  await expect(page.locator('#pf-last')).toBeHidden();
  await expect(page.locator('.b24-sidepanel__footer')).toBeHidden();
  await page.locator('#profile-edit').click();
  await expect(page.locator('#pf-last')).toBeVisible();
  await expect(page.locator('.b24-sidepanel__footer')).toBeVisible();
  await page.locator('#pf-first').fill('Пётр');
  await page.locator('[data-save]').click();
  await expect(page.locator('#profile-name')).toContainText('Пётр');
  await expect(page.locator('.b24-sidepanel__footer')).toBeHidden();
  await page.locator('[data-b24-tab="login"]').click();
  await expect(page.locator('[data-b24-tab-panel="login"]')).toBeVisible();
  await expect(page.locator('[data-b24-tab-panel="main"]')).toBeHidden();
});

test('звонок: плеер записи и компакт без горизонтальной прокрутки', async ({ page }) => {
  await open(page, '/cards.html?card=call');
  await expect(page.locator('#call-player .b24-audio')).toBeVisible();
  await expect(page.locator('.b24-entity__name')).toHaveCount(1);
  await open(page, '/cards.html?card=callmini');
  await expect(page.locator('.b24-entity--compact')).toBeVisible();
  await noHorizontalScroll(page);
});

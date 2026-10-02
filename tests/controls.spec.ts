import { test, expect } from '@playwright/test';
import { open, noHorizontalScroll, isMobile } from './helpers';

test('controls.html: без ошибок и горизонтальной прокрутки', async ({ page }) => {
  const { errors } = await open(page, '/controls.html');
  await page.waitForLoadState('networkidle');
  await noHorizontalScroll(page);
  expect(errors()).toEqual([]);
});

test('карточки-радио, группа чекбоксов, сегменты', async ({ page }) => {
  await open(page, '/controls.html');
  const card = page.locator('.b24-radio-card').filter({ has: page.locator('.b24-radio-card__title', { hasText: /^Обновлять$/ }) });
  await card.click();
  expect(await card.locator('input').isChecked()).toBe(true);
  await expect(page.locator('.b24-radio-card', { hasText: 'PDF' }).locator('input')).toBeDisabled();

  const group = page.locator('[data-b24-check-group]');
  await expect(group.locator('.b24-check-group__count')).toHaveText('Выбрано 2 из 5');
  await group.locator('[data-b24-check-group-all]').click();
  await expect(group.locator('.b24-check-group__count')).toHaveText('Выбрано 5 из 5');
  expect(await group.locator('input[value="9"]').isChecked()).toBe(false); // отключённый не трогаем
  await group.locator('[data-b24-check-group-none]').click();
  await expect(group.locator('.b24-check-group__count')).toHaveText('Выбрано 0 из 5');

  await page.locator('.b24-segmented label', { hasText: 'Месяц' }).click();
  expect(await page.locator('.b24-segmented input[value="month"]').isChecked()).toBe(true);
});

test('ползунки и выбор цвета', async ({ page }) => {
  await open(page, '/controls.html');
  const out = page.locator('#batch + .b24-range-field__value');
  await expect(out).toHaveText('50 строк');
  await page.locator('#batch').fill('200');
  await expect(out).toHaveText('200 строк');
  const pair = page.locator('.b24-range-pair');
  await pair.locator('input').nth(0).fill('20');
  // нижняя ручка не уходит за верхнюю
  expect(await pair.locator('input').nth(0).inputValue()).toBe('18');
  await expect(page.locator('.b24-range-pair + .b24-range-field__value')).toHaveText('18–18:00');

  await page.locator('.b24-colors__custom input[type="color"]').evaluate((i: HTMLInputElement) => { i.value = '#123456'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await page.locator('input[name="color"]:checked').evaluate((i: HTMLInputElement) => i.value)).toBe('#123456');
  await page.locator('.b24-colors__swatch').nth(2).click();
  await expect(page.locator('.b24-colors__custom')).not.toHaveClass(/is-active/);
});

test('секрет, ошибки сервера по полям', async ({ page }) => {
  await open(page, '/controls.html');
  const key = page.locator('#mb-key');
  await expect(key).toHaveAttribute('type', 'password');
  await expect(key).toHaveValue('');
  await expect(page.locator('#mb-key ~ .b24-secret__toggle')).toBeVisible();
  await page.locator('#hook ~ .b24-secret__toggle').click();
  await expect(page.locator('#hook')).toHaveAttribute('type', 'text');

  await page.locator('#api-form button[type="submit"]').click();
  await expect(page.locator('#api-form .b24-field--error')).toHaveCount(2);
  await expect(page.locator('#chat-id')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#missed')).toHaveText('Без поля: schedule.cron');
  // повторная отправка не дублирует сообщения
  await page.locator('#api-form button[type="submit"]').click();
  await expect(page.locator('#api-form [data-b24-server-error]')).toHaveCount(2);
});

test('дерево: клавиатура и выбор', async ({ page }) => {
  await open(page, '/controls.html');
  const tree = page.locator('.b24-tree');
  await expect(tree.locator('[role="treeitem"][aria-selected="true"]')).toHaveCount(1);
  await tree.locator('.b24-tree__node').first().focus();
  await page.keyboard.press('ArrowDown'); // Отдел продаж
  await page.keyboard.press('ArrowRight'); // развернуть
  await expect(tree.locator('[data-id="sales"]')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowRight'); // к первому ребёнку
  await page.keyboard.press('Space');
  await expect(tree.locator('[data-id="sales-ekb"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#tree-out')).toHaveText('Выбрано: sales, sales-ekb');
  await page.keyboard.press('ArrowLeft'); // к родителю
  await page.keyboard.press('ArrowLeft'); // свернуть
  await expect(tree.locator('[data-id="sales"]')).toHaveAttribute('aria-expanded', 'false');
});

test('аккордеон: открыт один на уровне', async ({ page }) => {
  await open(page, '/controls.html');
  const items = page.locator('.b24-card .b24-accordion > details[name="acc"]');
  await items.nth(1).locator('> summary').click();
  await expect(items.nth(1)).toHaveAttribute('open', '');
  await expect(items.nth(0)).not.toHaveAttribute('open', '');
});

test('тосты: одинаковые склеиваются, видимых не больше четырёх', async ({ page }) => {
  await open(page, '/controls.html');
  await page.click('#toast-same');
  await expect(page.locator('.b24-toast', { hasText: 'Синхронизация запущена' })).toHaveCount(1);
  await expect(page.locator('.b24-toast__count')).toHaveText('×3');
  await page.click('#toast-many');
  await expect(page.locator('.b24-toast:not([data-closing])')).toHaveCount(4);
});

test('подсказка с кнопками и обучение', async ({ page }) => {
  test.skip(isMobile(page), 'на десктопе');
  await open(page, '/controls.html');
  await page.click('#popover-btn');
  const pop = page.locator('.b24-popover');
  await expect(pop).toContainText('Новое: пробный запуск');
  await pop.getByRole('button', { name: 'Позже' }).click();
  await expect(pop).toHaveCount(0);

  await page.click('#tour-btn');
  await expect(page.locator('.b24-spotlight')).toBeVisible();
  await expect(page.locator('.b24-popover__step')).toHaveText('1 из 3');
  await page.locator('.b24-popover').getByRole('button', { name: 'Далее' }).click();
  await expect(page.locator('.b24-popover__step')).toHaveText('2 из 3');
  await page.locator('.b24-popover').getByRole('button', { name: 'Далее' }).click();
  await page.locator('.b24-popover').getByRole('button', { name: 'Готово' }).click();
  await expect(page.locator('.b24-spotlight')).toHaveCount(0);
  await expect(page.locator('.b24-toast', { hasText: 'Обучение пройдено' })).toBeVisible();
});

test('мелочи: множественное число и ссылки CRM', async ({ page }) => {
  await open(page, '/controls.html');
  await expect(page.locator('#plural-out')).toHaveText('1 запись · 2 записи · 5 записей · 11 записей · 21 запись · 1 234 записи');
  await expect(page.locator('#crm-out')).toHaveText('/crm/deal/details/15/  /crm/contact/details/7/  /crm/type/128/details/42/  https://example.bitrix24.ru/crm/type/31/details/5/');
});

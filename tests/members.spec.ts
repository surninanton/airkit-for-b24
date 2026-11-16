import { test, expect } from '@playwright/test';
import { open } from './helpers';

test('список участников: статус, подпись, «вы» неактивно, клик → onSelect', async ({ page }) => {
  const { errors } = await open(page, '/chat.html');
  const list = page.locator('#members .b24-member-list');
  await expect(list.locator('.b24-member-list__title')).toHaveText('Участники5');
  const rows = list.locator('.b24-member');
  await expect(rows).toHaveCount(5);
  const self = rows.first();
  await expect(self).toBeDisabled();
  await expect(self.locator('.b24-member__you')).toHaveText('вы');
  await expect(self.locator('.b24-avatar__status')).toHaveCount(1);
  await expect(rows.nth(1).locator('.b24-member__caption')).toHaveText('Повар-сушист');
  await expect(rows.nth(1).locator('.b24-member__meta')).toHaveText('Админ');
  await expect(rows.nth(2).locator('.b24-avatar__status.is-away')).toHaveCount(1);
  await rows.nth(1).click();
  await expect(page.locator('.b24-toast').last()).toContainText('Игорь Сафонов');
  // имя не вылезает за строку
  const fits = await rows.nth(1).evaluate((r) => r.scrollWidth <= r.clientWidth + 1);
  expect(fits).toBe(true);
  expect(errors()).toEqual([]);
});

test('подпись в списке диалогов, когда превью пустое', async ({ page }) => {
  await open(page, '/chat.html');
  const items = page.locator('#staff-chats .b24-chat-list__item').filter({ hasNot: page.locator('[data-nothing]') });
  await expect(page.locator('#staff-chats .b24-chat-list__group')).toHaveText(['Покупатели', 'Сотрудники']);
  await expect(items.nth(1).locator('.b24-chat-list__subtitle')).toHaveText('Чат должности · 6 участников');
  // есть превью — показываем его, а не подпись
  await expect(items.nth(2).locator('.b24-chat-list__subtitle')).toHaveCount(0);
  await expect(items.nth(2).locator('.b24-chat-list__preview')).toHaveText('Тимур: беру заказ на Ленина');
  await expect(items.nth(3)).toHaveAttribute('aria-label', /в сети/);
});

test('выбор пользователя: поиск по имени и должности, один — клик закрывает', async ({ page }) => {
  await open(page, '/chat.html');
  await page.locator('#pick-one').click();
  const dlg = page.locator('.b24-overlay [role=dialog]');
  await expect(dlg).toBeVisible();
  const input = dlg.locator('.b24-user-picker__search input');
  await expect(input).toBeFocused();
  await expect(dlg.locator('.b24-member')).toHaveCount(7);
  await input.fill('курьер');
  await expect(dlg.locator('.b24-member')).toHaveCount(2);
  await input.fill('алена');            // ё = е
  await expect(dlg.locator('.b24-member')).toHaveCount(1);
  await input.fill('никого');
  await expect(dlg.locator('.b24-member-list__empty')).toBeVisible();
  await input.fill('ига');
  await expect(dlg.locator('.b24-member')).toHaveCount(0);
  await input.fill('игорь');
  await input.press('Enter');
  await expect(dlg).toHaveCount(0);
  await expect(page.locator('.b24-toast').last()).toContainText('Чат с Игорь Сафонов');
});

test('выбор нескольких: галочки, «Добавить (N)», уже участники скрыты', async ({ page }) => {
  await open(page, '/chat.html');
  await page.locator('#pick-many').click();
  const dlg = page.locator('.b24-overlay [role=dialog]');
  const rows = dlg.locator('.b24-member');
  await expect(rows).toHaveCount(2);
  const ok = dlg.locator('.b24-modal__footer .b24-btn--primary');
  await expect(ok).toBeDisabled();
  await rows.nth(0).click();
  await rows.nth(1).click();
  await expect(rows.nth(0)).toHaveClass(/is-selected/);
  await expect(ok).toHaveText('Добавить (2)');
  await rows.nth(1).click();
  await expect(ok).toHaveText('Добавить (1)');
  await ok.click();
  await expect(dlg).toHaveCount(0);
  await expect(page.locator('#members .b24-member')).toHaveCount(6);
  // Esc — отмена, ничего не меняется
  await page.locator('#pick-many').click();
  await expect(dlg).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await expect(page.locator('#members .b24-member')).toHaveCount(6);
});

test('участник: действие «Удалить из чата» — не onSelect, свою строку удалить нельзя', async ({ page }) => {
  await open(page, '/chat.html');
  const rows = page.locator('#members .b24-member');
  await expect(rows).toHaveCount(5);
  await expect(page.locator('#members .b24-member__action')).toHaveCount(4);   // у «вы» действия нет
  await page.locator('#members .b24-member__action').first().click();
  await expect(rows).toHaveCount(4);
  await expect(page.locator('.b24-toast')).toHaveCount(0);                       // onSelect не сработал
});

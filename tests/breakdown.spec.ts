import { test, expect } from '@playwright/test';
import { open, noHorizontalScroll } from './helpers';

test('детализация расчёта: формула, секции, правка суммы, удаление, пустая секция', async ({ page }) => {
  const { errors } = await open(page, '/breakdown.html');
  const bd = page.locator('#bd .b24-breakdown');
  await expect(bd.locator('.b24-breakdown__total')).toContainText('1');
  await expect(bd.locator('.b24-breakdown__total')).toContainText('740');
  await expect(bd.locator('.b24-breakdown__part-chip')).toHaveCount(3);
  await expect(bd.locator('.b24-breakdown__part-total')).toContainText('740');
  // пустая секция
  await expect(bd.locator('[data-key="fines"] .b24-breakdown__empty')).toHaveText('нет за период');
  // группы и пояснение
  await expect(bd.locator('.b24-breakdown__group-head')).toHaveCount(2);
  await expect(bd.locator('.b24-breakdown__note')).toContainText('450 → 100');
  // сворачивание
  const sec = bd.locator('[data-key="orders"]');
  await sec.locator('.b24-breakdown__toggle').click();
  await expect(sec.locator('.b24-breakdown__body')).toBeHidden();
  await expect(sec.locator('.b24-breakdown__toggle')).toHaveAttribute('aria-expanded', 'false');
  // чип разворачивает и подсвечивает секцию
  await bd.locator('[data-part="orders"]').click();
  await expect(sec.locator('.b24-breakdown__body')).toBeVisible();
  // действие в шапке секции
  await sec.locator('[data-action="add"]').click();
  await expect(page.locator('#log')).toHaveText('action orders/add');
  // правка: ручное значение → бейдж и итог
  const row = bd.locator('.b24-breakdown__row[data-id="o3"]');
  await row.locator('.b24-breakdown__sum').click();
  const input = row.locator('input');
  await expect(input).toHaveValue('');
  await expect(input).toHaveAttribute('placeholder', '350');
  await input.fill('400');
  await input.press('Enter');
  await expect(page.locator('#log')).toHaveText('onChange o3: 400');
  await expect(bd.locator('.b24-breakdown__row[data-id="o3"]')).toHaveClass(/is-manual/);
  await expect(bd.locator('.b24-breakdown__row[data-id="o3"] .b24-badge', { hasText: 'вручную' })).toHaveCount(1);
  await expect(bd.locator('.b24-breakdown__total')).toContainText('790');
  // Esc — отмена
  await bd.locator('.b24-breakdown__row[data-id="o3"] .b24-breakdown__sum').click();
  await bd.locator('input').fill('999');
  await bd.locator('input').press('Escape');
  await expect(page.locator('#log')).toHaveText('onChange o3: 400');
  await expect(bd.locator('input')).toHaveCount(0);
  // пусто = авто
  await bd.locator('.b24-breakdown__row[data-id="o3"] .b24-breakdown__sum').click();
  await bd.locator('input').fill('');
  await bd.locator('input').press('Enter');
  await expect(page.locator('#log')).toHaveText('onChange o3: null');
  await expect(bd.locator('.b24-breakdown__row[data-id="o3"]')).not.toHaveClass(/is-manual/);
  // удаление
  await bd.locator('.b24-breakdown__row[data-id="o5"]').hover();
  await bd.locator('.b24-breakdown__row[data-id="o5"] .b24-breakdown__remove').click();
  await expect(page.locator('#log')).toHaveText('onRemove o5');
  await expect(bd.locator('.b24-breakdown__row[data-id="o5"]')).toHaveCount(0);
  // без права правки — обычный текст
  await expect(page.locator('#bd2 .b24-breakdown__sum.is-editable')).toHaveCount(0);
  await expect(page.locator('#bd2 [data-key="a"] .b24-breakdown__body')).toBeHidden();
  await noHorizontalScroll(page);
  expect(errors()).toEqual([]);
});

test('детализация расчёта: суммы выровнены по правому краю колонки', async ({ page }) => {
  await open(page, '/breakdown.html');
  const rights = await page.locator('#bd .b24-breakdown__row .b24-breakdown__side').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().right)));
  expect(new Set(rights).size).toBe(1);
});

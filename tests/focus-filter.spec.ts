import { test, expect } from '@playwright/test';
import { open } from './helpers';

test('поля ввода: при фокусе нет системной обводки, фокус виден рамкой и кольцом', async ({ page }) => {
  await open(page, '/controls.html');
  const input = page.locator('input.b24-input').first();
  await input.scrollIntoViewIfNeeded();
  await input.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');                      // фокус с клавиатуры: :focus-visible
  await expect(input).toBeFocused();
  const css = await input.evaluate((el) => { const s = getComputedStyle(el); return { outline: s.outlineStyle, ring: s.boxShadow, border: s.borderColor }; });
  expect(css.outline).toBe('none');
  expect(css.ring).not.toBe('none');                     // собственное кольцо фокуса осталось
  // кнопки по-прежнему получают обводку с клавиатуры
  const btn = page.locator('button.b24-btn').first();
  await btn.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  expect(await btn.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
});

test('фильтр: параметры открываются сразу при фокусе в строке поиска, фокус остаётся в строке', async ({ page }) => {
  await open(page, '/index.html');
  const input = page.locator('#demo-filter .b24-filter__input');
  const popup = page.locator('.b24-filter-popup');
  await expect(popup).toBeHidden();
  await input.focus();
  await expect(popup).toBeVisible();
  await expect(input).toBeFocused();                      // можно сразу печатать
  await page.keyboard.type('тест');
  await expect(input).toHaveValue('тест');
  await expect(popup).toBeVisible();
  // Esc закрывает, повторный клик в строку открывает снова
  await page.keyboard.press('Escape');
  await expect(popup).toBeHidden();
  await input.click();
  await expect(popup).toBeVisible();
  // Enter применяет поиск и закрывает параметры
  await input.press('Enter');
  await expect(popup).toBeHidden();
  // клик мимо закрывает, кнопка фильтра по-прежнему переключает
  await input.click();
  await expect(popup).toBeVisible();
  await page.locator('h2.b24-card__title').first().click();
  await expect(popup).toBeHidden();
  await page.locator('#demo-filter .b24-filter__icon').first().click();
  await expect(popup).toBeVisible();
  await page.locator('#demo-filter .b24-filter__icon').first().click();
  await expect(popup).toBeHidden();
});

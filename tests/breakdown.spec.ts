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
  for (const id of ['#bd', '#bd3']) {
    // суммы секции, группы и строки — одна правая колонка
    const rights = await page.locator(`${id} .b24-breakdown__row .b24-breakdown__sum, ${id} .b24-breakdown__section-sum, ${id} .b24-breakdown__group-sum`).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().right)));
    expect(rights.length).toBeGreaterThan(4);
    expect(new Set(rights).size, `${id}: ${rights}`).toBe(1);
  }
});

test('детализация расчёта: группы, бейджи в линию с подписью, серый счётчик, пустая шапка, слот действий', async ({ page }, info) => {
  await open(page, '/breakdown.html');
  const g = page.locator('#bd .b24-breakdown__group-head').first();
  await expect(g.locator('.b24-breakdown__group-sub')).toContainText('Антон');
  expect(await g.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  expect(await g.locator('.b24-breakdown__group-sum').evaluate((e) => Number(getComputedStyle(e).fontWeight))).toBeGreaterThanOrEqual(600);
  // подпись и бейдж «доп. точка» — в одной строке
  const meta = page.locator('#bd3 .b24-breakdown__row[data-id="d1"] .b24-breakdown__meta');
  const [a, b] = await Promise.all([meta.locator('.b24-breakdown__sub').boundingBox(), meta.locator('.b24-badge').boundingBox()]);
  expect(Math.abs((a!.y + a!.height / 2) - (b!.y + b!.height / 2))).toBeLessThan(8);
  // счётчик серый по умолчанию, countKind меняет
  await expect(page.locator('#bd [data-key="orders"] .b24-counter')).toHaveClass(/b24-counter--gray/);
  await expect(page.locator('#bd3 [data-key="w"] .b24-counter')).toHaveClass(/b24-counter--success/);
  // без title/subtitle в шапке нет пустого блока
  await expect(page.locator('#bd3 .b24-breakdown__title')).toHaveCount(0);
  const top = await page.locator('#bd3 .b24-breakdown__head').evaluate((h) => { const r = h.getBoundingClientRect(); const c = h.querySelector('.b24-breakdown__total')!.getBoundingClientRect(); return c.top - r.top; });
  expect(top).toBeLessThanOrEqual(20);
  // клики по select и кнопке в слоте действий не сворачивают секцию
  const sec = page.locator('#bd3 [data-key="w"]');
  await sec.locator('select').click();
  await page.keyboard.press('Escape');
  await sec.locator('[data-action="shift"]').click();
  await expect(page.locator('#log')).toHaveText('action w/shift');
  await expect(sec.locator('.b24-breakdown__body')).toBeVisible();
  // выравнивание по центру линии заголовка (на узком экране слот переносится на свою строку)
  if (info.project.name === 'mobile') return;
  const hy = await sec.locator('.b24-breakdown__section-title').boundingBox();
  const sy = await sec.locator('select').boundingBox();
  expect(Math.abs((hy!.y + hy!.height / 2) - (sy!.y + sy!.height / 2))).toBeLessThan(4);
});

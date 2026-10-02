import { test, expect, type Page } from '@playwright/test';
import { open, noHorizontalScroll, isMobile } from './helpers';

const tab = async (page: Page, id: string) => {
  const { errors } = await open(page, `/screens.html#${id}`);
  await expect(page.locator(`[data-b24-tab="${id}"]`)).toHaveAttribute('aria-selected', 'true');
  return errors;
};

test.describe('экраны приложения', () => {
  for (const id of ['dashboard', 'settings', 'wizard', 'empty']) {
    test(`${id}: без ошибок и горизонтальной прокрутки`, async ({ page }) => {
      const errors = await tab(page, id);
      await page.waitForLoadState('networkidle');
      await noHorizontalScroll(page);
      expect(errors()).toEqual([]);
    });
  }
});

test.describe('графики', () => {
  test('рисуются из JSON и из JS, есть легенда и таблица для скринридеров', async ({ page }) => {
    await tab(page, 'dashboard');
    await expect(page.locator('.b24-chart')).toHaveCount(3);
    await expect(page.locator('#runs-chart .b24-chart__line')).toHaveCount(3);
    await expect(page.locator('#runs-chart .b24-chart__legend li')).toHaveText(['Сделки', 'Лиды', 'Контакты']);
    await expect(page.locator('#runs-chart table tbody tr')).toHaveCount(6);
    await expect(page.locator('.b24-chart--donut .b24-chart__slice')).toHaveCount(4);
    await expect(page.locator('.b24-sparkline path')).toHaveCount(3);
  });

  test('подсказка при наведении и переключение на столбцы', async ({ page }) => {
    test.skip(isMobile(page), 'наведение — на десктопе');
    await tab(page, 'dashboard');
    const plot = page.locator('#runs-chart svg');
    const box = (await plot.boundingBox())!;
    await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
    const tip = page.locator('#runs-chart .b24-chart__tip');
    await expect(tip).toBeVisible();
    await expect(tip.locator('.b24-chart__tip-title')).toHaveText('сен');
    await expect(tip).toContainText('6 120');
    // подсказка не выходит за блок графика
    const t = (await tip.boundingBox())!;
    const c = (await page.locator('#runs-chart').boundingBox())!;
    expect(t.x + t.width).toBeLessThanOrEqual(c.x + c.width + 1);

    await page.click('#chart-type [data-type="bar"]');
    await expect(page.locator('#runs-chart .b24-chart__bar')).toHaveCount(18);
    await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
    await expect(tip).toContainText('Всего');
    // столбцы не толще 24px
    const w = await page.locator('#runs-chart .b24-chart__bar').first().evaluate((b) => (b as SVGGraphicsElement).getBBox().width);
    expect(w).toBeLessThanOrEqual(24);
  });

  test('тёмная тема меняет цвета без перерисовки', async ({ page }) => {
    await tab(page, 'dashboard');
    const stroke = () => page.locator('#runs-chart .b24-chart__line').first().evaluate((l) => getComputedStyle(l).stroke);
    const light = await stroke();
    await page.evaluate(() => { document.documentElement.dataset.b24Theme = 'dark'; });
    expect(await stroke()).not.toBe(light);
  });
});

test.describe('настройки', () => {
  test('меню подсвечивает раздел, панель сохранения появляется и прячется', async ({ page }) => {
    await tab(page, 'settings');
    await expect(page.locator('.b24-settings__link.is-active')).toContainText('Общие');
    const bar = page.locator('.b24-savebar');
    await expect(bar).toBeHidden();
    await page.fill('#st-name', 'Обходчики CRM');
    await expect(bar).toBeVisible();
    // вернули значение — изменений нет
    await page.fill('#st-name', 'Обходчики');
    await expect(bar).toBeHidden();

    await page.locator('input[name="weekends"]').evaluate((i) => (i as HTMLInputElement).click());
    await expect(bar).toBeVisible();
    await bar.locator('[data-b24-settings-reset]').click();
    await expect(bar).toBeHidden();
    expect(await page.locator('input[name="weekends"]').isChecked()).toBe(false);

    await page.fill('#st-name', 'Новое имя');
    await bar.locator('button[type="submit"]').click();
    await expect(bar.locator('button[type="submit"]')).toHaveClass(/b24-btn--loading/);
    await expect(bar).toBeHidden();
    await expect(page.locator('#st-name')).toHaveValue('Новое имя');
  });

  test('меню переходит к разделу', async ({ page }) => {
    test.skip(isMobile(page), 'на узком экране меню — горизонтальная лента');
    await tab(page, 'settings');
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
    await page.locator('.b24-settings__link', { hasText: 'Права доступа' }).click();
    await expect(page.locator('.b24-settings__link.is-active')).toContainText('Права доступа');
  });
});

test.describe('мастер', () => {
  test('проверка полей, ошибка асинхронной проверки, переходы и «Готово»', async ({ page }) => {
    await tab(page, 'wizard');
    const marks = page.locator('#wizard .b24-stepper__item');
    const next = page.locator('[data-b24-wizard-next]');
    await expect(page.locator('.b24-wizard__counter')).toHaveText('Шаг 1 из 3');
    await expect(page.locator('[data-b24-wizard-back]')).toBeHidden();

    // пустые обязательные поля — остаёмся
    await next.click();
    await expect(marks.nth(0)).toHaveClass(/is-current/);

    await page.fill('#wz-url', 'https://fail.example.com');
    await page.fill('#wz-key', 'key');
    await next.click();
    await expect(next).toHaveClass(/b24-btn--loading/);
    await expect(marks.nth(0)).toHaveClass(/is-error/);
    await expect(page.locator('.b24-wizard__counter')).toHaveText('Шаг 1 из 3');

    await page.fill('#wz-url', 'https://mb.example.com');
    await next.click();
    await expect(page.locator('.b24-wizard__counter')).toHaveText('Шаг 2 из 3');
    await expect(marks.nth(0)).toHaveClass(/is-done/);
    await expect(marks.nth(0)).not.toHaveClass(/is-error/);

    await page.locator('[data-b24-wizard-back]').click();
    await expect(page.locator('.b24-wizard__counter')).toHaveText('Шаг 1 из 3');
    await next.click();
    await next.click();
    await expect(page.locator('.b24-wizard__counter')).toHaveText('Шаг 3 из 3');
    await expect(next).toBeHidden();
    await page.locator('[data-b24-wizard-finish]').click();
    await expect(page.locator('.b24-toast').last()).toContainText('"role":"admins"');
  });
});

import { test, expect, type Page } from '@playwright/test';
import { open, isMobile } from './helpers';

// Английский режим: <html lang="en"> выставляем до скриптов страницы
const english = async (page: Page, path: string) => {
  await page.route(`**${path}`, async (route) => {
    const res = await route.fetch();
    route.fulfill({ response: res, body: (await res.text()).replace('<html lang="ru"', '<html lang="en"') });
  });
  return open(page, path);
};

test.beforeEach(({ page }) => { test.skip(isMobile(page), 'язык не зависит от ширины'); });

test('редакторы: повторитель, сопоставление, журнал по-английски', async ({ page }) => {
  await english(page, '/editors.html');
  await expect(page.locator('#kv .b24-repeater__remove').first()).toHaveAttribute('aria-label', 'Delete row');
  const rule = page.locator('#mapper .b24-mapper__rule select').first();
  await expect(rule.locator('option').first()).toHaveText('Always overwrite');
  await page.locator('#mapper .b24-mapper__transform').nth(2).click();
  await expect(page.locator('#mapper').getByRole('radio', { name: 'Value mapping' })).toBeVisible();
  await expect(page.locator('#logs .b24-logs__more')).toHaveText('Load more');
  await expect(page.locator('#logs .b24-logs__count')).toHaveText(/^Shown: 8$/);
});

test('компоненты приложения: календарь, окно, фильтр', async ({ page }) => {
  await english(page, '/index.html');
  await page.locator('#dp-1').click();
  await expect(page.locator('.b24-calendar:visible .b24-calendar__weekday').first()).toHaveText(/^Mo$/);
  await expect(page.locator('.b24-calendar:visible .b24-calendar__title')).toContainText(/September|October|November|December|January|February|March|April|May|June|July|August/);
  await page.keyboard.press('Escape');
  await page.click('#open-confirm');
  await expect(page.locator('.b24-modal:visible').getByRole('button', { name: 'Cancel' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#demo-filter .b24-filter__icon[aria-haspopup]').click();
  await expect(page.locator('.b24-filter-popup').getByRole('button', { name: 'Search' })).toBeVisible();
});

test('setLocale и свой словарь', async ({ page }) => {
  await open(page, '/controls.html');
  const out = await page.evaluate(async (path) => {
    const m = await import(path);
    const before = m.t('Сохранить');
    m.setLocale('en');
    const en = m.t('Выбрано {n} из {m}', { n: 2, m: 5 });
    m.addMessages('kk', { 'Сохранить': 'Сақтау' });
    m.setLocale('kk');
    const kk = [m.t('Сохранить'), m.t('Отмена')];
    m.setLocale('ru');
    return { before, en, kk };
  }, `/@fs${process.cwd()}/src/js/i18n.ts`);
  expect(out).toEqual({ before: 'Сохранить', en: 'Selected 2 of 5', kk: ['Сақтау', 'Отмена'] });
});

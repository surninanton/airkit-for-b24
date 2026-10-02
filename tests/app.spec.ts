import { test, expect } from '@playwright/test';
import { open, noHorizontalScroll, isMobile } from './helpers';

// Демо компонентов приложения: страница собирается без ошибок, на десктопе без горизонтальной прокрутки
for (const path of ['index.html', 'react.html']) {
  test(`${path}: без ошибок`, async ({ page }) => {
    const { errors } = await open(page, `/${path}`);
    await page.waitForLoadState('networkidle');
    if (!isMobile(page)) await noHorizontalScroll(page);
    expect(errors()).toEqual([]);
  });
}

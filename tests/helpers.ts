import { expect, type Page } from '@playwright/test';

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) <= 960;

/** Открывает демо и собирает ошибки страницы — тест упадёт, если они были. */
export async function open(page: Page, path: string) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(path);
  await page.waitForFunction(() => document.querySelector('.b24-site-header.is-enhanced, .b24-shell, .b24-app, body') !== null);
  return { errors: () => errors };
}

export async function noHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, 'горизонтальная прокрутка').toBeLessThanOrEqual(0);
}

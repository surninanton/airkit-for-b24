import { test, expect } from '@playwright/test';
import { open } from './helpers';

test('инициалы: эмодзи не режется пополам и не становится буквой', async ({ page }) => {
  await open(page, '/chat.html');
  const res = await page.evaluate(() => {
    const { initials, avatarHtml } = (window as unknown as { B24UI: { initials(n: string): string; avatarHtml(n: string): string } }).B24UI;
    return { a: initials('Маша 🌸'), b: initials('Иван Петров'), c: initials('🌸'), d: initials('🌸 Иван'), html: avatarHtml('Маша 🌸') };
  });
  expect(res).toMatchObject({ a: 'М', b: 'ИП', c: '🌸', d: 'И' });
  expect(res.html).not.toContain('�');
});

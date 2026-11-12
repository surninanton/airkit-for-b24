import { test, expect } from '@playwright/test';
import { open } from './helpers';

test.describe('бургер AppShell', () => {
  test('в строке логотипа сайдбара; свёрнутый — вместо логотипа; в шапке только на мобильном', async ({ page }) => {
    const { errors } = await open(page, '/react.html');
    const shell = page.locator('.b24-shell');
    const inSidebar = shell.locator('.b24-shell__sidebar .b24-sidebar__brand .b24-sidebar__toggle');
    const inHeader = shell.locator('.b24-shell__header .b24-shell__toggle');
    const mobile = (page.viewportSize()?.width ?? 1280) <= 768;

    if (!mobile) {
      await expect(inHeader).toBeHidden();
      await expect(inSidebar).toBeVisible();
      await expect(shell.locator('.b24-sidebar__brand-mark')).toBeVisible();
      await inSidebar.click();
      await expect(shell).toHaveClass(/is-collapsed/);
      // свёрнут: бургер на месте логотипа, по центру колонки
      await expect(shell.locator('.b24-sidebar__brand-mark')).toBeHidden();
      const side = (await shell.locator('.b24-shell__sidebar').boundingBox())!;
      const btn = (await inSidebar.boundingBox())!;
      expect(Math.abs(btn.x + btn.width / 2 - (side.x + side.width / 2))).toBeLessThan(3);
      await inSidebar.click();
      await expect(shell).not.toHaveClass(/is-collapsed/);
    } else {
      await expect(inHeader).toBeVisible();
      await inHeader.click();
      await expect(shell).toHaveClass(/is-menu-open/);
      await inSidebar.click(); // бургер в открытом меню его закрывает
      await expect(shell).not.toHaveClass(/is-menu-open/);
    }
    expect(errors()).toEqual([]);
  });
});

test('модалка: асинхронный onClick — загрузка у кнопки, остальные заблокированы', async ({ page }) => {
  await open(page, '/index.html');
  const res = await page.evaluate(async () => {
    const B24UI = (window as unknown as { B24UI: typeof import('../src/js/index') }).B24UI;
    let release!: () => void;
    const m = B24UI.modal({
      content: 'x',
      buttons: [
        { text: 'Сохранить', variant: 'success', onClick: () => new Promise<boolean>((r) => { release = () => r(false); }) },
        { text: 'Отмена' },
      ],
    });
    const [save, cancel] = [...m.element.querySelectorAll<HTMLButtonElement>('.b24-modal__footer button')];
    save.click();
    await new Promise((r) => setTimeout(r, 0));
    const during = { loading: save.classList.contains('b24-btn--loading'), saveDisabled: save.disabled, cancelDisabled: cancel.disabled, busy: m.element.closest('[aria-busy="true"]') !== null || m.element.querySelector('[aria-busy="true"]') !== null };
    release();
    await new Promise((r) => setTimeout(r, 0));
    const after = { loading: save.classList.contains('b24-btn--loading'), cancelDisabled: cancel.disabled, open: document.body.contains(m.element) };
    await m.close();
    return { during, after };
  });
  expect(res.during).toEqual({ loading: true, saveDisabled: true, cancelDisabled: true, busy: true });
  expect(res.after).toEqual({ loading: false, cancelDisabled: false, open: true });
});

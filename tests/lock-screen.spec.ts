import { test, expect } from '@playwright/test';
import { open } from './helpers';

test.describe('экран блокировки', () => {
  test.beforeEach(async ({ page }) => { await open(page, '/screens.html#lock'); });

  test('профили → код: ошибка с текстом сервера, Esc — к профилям, верный код снимает экран и возвращает страницу', async ({ page }) => {
    await page.locator('#lock-many').click();
    const lock = page.locator('.b24-lock');
    await expect(lock.getByRole('heading', { name: 'Кто продолжит работу?' })).toBeVisible();
    await expect(lock.locator('.b24-lock__user')).toHaveCount(3);
    expect(await page.locator('.b24-app').evaluate((el) => (el as HTMLElement).inert)).toBe(true); // страница недоступна

    await lock.locator('.b24-lock__user', { hasText: 'Тимур Сафонов' }).click({ force: true });
    await expect(lock.locator('.b24-lock__name')).toHaveText('Тимур Сафонов');
    // ввод с клавиатуры, Backspace стирает
    await page.keyboard.type('12');
    await expect(lock.locator('.b24-lock__dots i.is-on')).toHaveCount(2);
    await page.keyboard.press('Backspace');
    await expect(lock.locator('.b24-lock__dots i.is-on')).toHaveCount(1);
    await page.keyboard.type('999');
    await expect(lock.locator('.b24-lock__error')).toHaveText('Неверный код, осталось попыток: 2');
    await expect(lock.locator('.b24-lock__dots i.is-on')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(lock.locator('.b24-lock__user')).toHaveCount(3);

    // экранная клавиатура
    await lock.locator('.b24-lock__user', { hasText: 'Злата Фомина' }).click({ force: true });
    for (const d of ['1', '2', '3', '4']) await lock.getByRole('button', { name: d, exact: true }).click();
    await expect(lock).toHaveCount(0);
    await expect(page.locator('.b24-toast').last()).toContainText('С возвращением, Злата');
    expect(await page.locator('.b24-app').evaluate((el) => (el as HTMLElement).inert)).toBe(false);
  });

  test('один профиль — сразу ввод кода; «Войти под другим аккаунтом» снимает экран без кода', async ({ page }) => {
    await page.locator('#lock-one').click();
    const lock = page.locator('.b24-lock');
    await expect(lock.locator('.b24-lock__name')).toHaveText('Алиса Мельникова');
    await expect(lock.locator('.b24-lock__back')).toHaveCount(0);
    await lock.getByRole('button', { name: 'Войти под другим аккаунтом' }).click();
    await expect(lock).toHaveCount(0);
    await expect(page.locator('.b24-toast').last()).toContainText('полный вход');
  });

  test('установка кода: длина и совпадение, сохранение', async ({ page }) => {
    await page.locator('#pin-setup').click();
    const dlg = page.locator('.b24-modal:visible');
    await dlg.getByLabel('Код-пароль').fill('12ab3');
    await expect(dlg.getByLabel('Код-пароль')).toHaveValue('123'); // только цифры
    await dlg.getByRole('button', { name: 'Сохранить' }).click();
    await expect(dlg.locator('.b24-field__error')).toHaveText('Код должен быть из 4 цифр');
    await dlg.getByLabel('Код-пароль').fill('1234');
    await dlg.getByLabel('Повторите код').fill('4321');
    await dlg.getByRole('button', { name: 'Сохранить' }).click();
    await expect(dlg.locator('.b24-field__error')).toHaveText('Коды не совпадают');
    await dlg.getByLabel('Повторите код').fill('1234');
    await dlg.getByRole('button', { name: 'Сохранить' }).click();
    await expect(dlg).toBeHidden();
    await expect(page.locator('.b24-toast').last()).toContainText('Код сохранён');
  });
});

test('idleLock: onIdle после простоя, действие сбрасывает таймер', async ({ page }) => {
  await page.clock.install();
  await open(page, '/screens.html');
  await page.evaluate(() => {
    const w = window as unknown as { B24UI: typeof import('../src/js/index'); idle: number };
    w.idle = 0;
    w.B24UI.idleLock({ minutes: 1, onIdle: () => { w.idle += 1; } });
  });
  const idle = () => page.evaluate(() => (window as unknown as { idle: number }).idle);
  await page.clock.runFor(40_000);
  await page.mouse.move(10, 10);
  await page.mouse.move(40, 40);
  await page.clock.runFor(40_000);
  expect(await idle()).toBe(0);
  await page.clock.runFor(25_000);
  expect(await idle()).toBe(1);
});

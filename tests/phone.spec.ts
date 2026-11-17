import { test, expect, type Page } from '@playwright/test';
import { open, noHorizontalScroll } from './helpers';

type Api = typeof import('../src/js/index');

test('номера: нормализация и формат', async ({ page }) => {
  await open(page, '/phone.html');
  const r = await page.evaluate(() => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    return {
      a: B.normalizePhone('8 (999) 123-45-67'), b: B.normalizePhone('+7 999 123 45 67'), c: B.normalizePhone('79991234567'),
      d: B.normalizePhone('9991234567'), e: B.normalizePhone('+1 (212) 555-0100'), f: B.normalizePhone('*100#'), g: B.normalizePhone('112'),
      fmt: B.formatPhone('+79991234567'), part: B.formatPhone('+7999'), foreign: B.formatPhone('+12125550100'),
    };
  });
  expect(r).toEqual({ a: '+79991234567', b: '+79991234567', c: '+79991234567', d: '+79991234567', e: '+12125550100', f: '*100#', g: '112', fmt: '+7 (999) 123-45-67', part: '+7 (999)', foreign: '+12125550100' });
});

test('клавиатура: кнопки и буквы, ввод с клавиатуры, вставка, стереть, вызов', async ({ page }) => {
  const { errors } = await open(page, '/phone.html');
  const pad = page.locator('#dialpad .b24-dialpad');
  await expect(pad.locator('.b24-dialpad__key')).toHaveCount(12);
  await expect(pad.locator('[data-key="2"] .b24-dialpad__letters')).toHaveText('ABC');
  await expect(pad.locator('[data-key="0"] .b24-dialpad__letters')).toHaveText('+');
  await expect(pad.locator('.b24-dialpad__call')).toBeDisabled();
  const input = pad.locator('.b24-dialpad__input');
  await pad.locator('[data-key="8"]').click();
  await pad.locator('[data-key="9"]').click();
  await expect(input).toHaveValue('+7 (9');
  // вставка с нормализацией
  await input.fill('');
  await input.evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData('text', '8 (912) 345-67-89');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(input).toHaveValue('+7 (912) 345-67-89');
  // ввод с клавиатуры компьютера: буквы игнорируются
  await input.fill('');
  await input.focus();
  await page.keyboard.type('a8b9991234567');
  await expect(input).toHaveValue('+7 (999) 123-45-67');
  // стереть
  await pad.locator('.b24-dialpad__back').click();
  await expect(input).toHaveValue('+7 (999) 123-45-6');
  await pad.locator('[data-key="7"]').click();
  await input.press('Enter');
  await expect(page.locator('#dial-log')).toContainText('Звоним: +7 (999) 123-45-67 (+79991234567)');
  expect(errors()).toEqual([]);
});

test('клавиатура: удержание 0 даёт «+», режим DTMF отдаёт тоны в onKey и не набирает номер', async ({ page }) => {
  await open(page, '/phone.html');
  const pad = page.locator('#dialpad .b24-dialpad');
  const zero = pad.locator('[data-key="0"]');
  const box = (await zero.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(pad.locator('.b24-dialpad__input')).toHaveValue('+');
  await pad.locator('.b24-dialpad__back').click();
  // DTMF
  await page.locator('#dtmf').check();
  await expect(pad).toHaveClass(/is-dtmf/);
  await expect(pad.locator('.b24-dialpad__call')).toBeHidden();
  await pad.locator('[data-key="5"]').click();
  await pad.locator('[data-key="#"]').click();
  await expect(pad.locator('.b24-dialpad__tones')).toHaveText('5#');
  await expect(page.locator('#dial-log')).toHaveText('Тон: #');
  await page.keyboard.press('7');      // с клавиатуры компьютера
  await expect(pad.locator('.b24-dialpad__tones')).toHaveText('5#7');
  await expect(pad.locator('.b24-dialpad__input')).toHaveValue('');
});

test('карточка звонка: входящий, ответ, таймер, переключатели, удержание, завершение', async ({ page }) => {
  await open(page, '/phone.html');
  const card = page.locator('#callcard .b24-callcard');
  await expect(card).toHaveClass(/is-incoming/);
  await expect(card.locator('.b24-callcard__name')).toHaveText('Мария Образцова');
  await expect(card.locator('.b24-callcard__number')).toHaveText('+7 (999) 123-45-67');
  await expect(card.locator('.b24-callcard__actions')).toBeHidden();
  await expect(card.locator('.b24-callcard__foot .b24-btn')).toHaveText(['Ответить', 'Отклонить']);
  await card.getByRole('button', { name: 'Ответить' }).click();
  await expect(card).toHaveClass(/is-active/);
  await expect(card.locator('.b24-callcard__action')).toHaveText(['Без звука', 'Удержание', 'Клавиши', 'Перевести']);
  await expect(card.locator('.b24-callcard__status')).toHaveText('0:00');
  await expect(card.locator('.b24-callcard__status')).toHaveText(/^0:0[1-9]$/, { timeout: 4000 });
  const mute = card.locator('[data-action="mute"]');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.b24-micmeter')).toHaveClass(/is-muted/);
  await card.locator('[data-action="hold"]').click();
  await expect(card).toHaveClass(/is-held/);
  await expect(card.locator('.b24-callcard__status')).toContainText('На удержании');
  await card.locator('[data-action="hold"]').click();
  await expect(card).toHaveClass(/is-active/);
  // клавиши — клавиатура DTMF в слоте
  await card.locator('[data-action="keys"]').click();
  await expect(card.locator('.b24-callcard__extra .b24-dialpad.is-dtmf')).toBeVisible();
  await card.getByRole('button', { name: 'Завершить' }).click();
  await expect(card).toHaveClass(/is-ended/);
  await expect(card.locator('.b24-callcard__status')).toContainText('Звонок завершён');
  await noHorizontalScroll(page);
});

test('статус линии: точка и подпись, выбор «На линии / Перерыв» с клавиатуры', async ({ page }) => {
  await open(page, '/phone.html');
  const labels = await page.locator('#line-static .b24-linestatus').evaluateAll((els) => els.map((e) => [e.className.match(/is-(\w+)/)![1], e.textContent]));
  expect(labels).toEqual([['online', 'На линии'], ['away', 'Перерыв'], ['offline', 'Не на линии'], ['disconnected', 'Нет связи']]);
  const sel = page.locator('#line-select .b24-linestatus');
  await sel.click();
  await expect(page.locator('.b24-linestatus__option')).toHaveText(['На линии', 'Перерыв']);
  await page.locator('.b24-linestatus__option', { hasText: 'Перерыв' }).click();
  await expect(sel).toHaveClass(/is-away/);
  await expect(sel).toContainText('Перерыв');
  await expect(page.locator('.b24-toast').last()).toContainText('Перерыв');
});

test('индикатор микрофона: уровень в aria и делениях', async ({ page }) => {
  await open(page, '/phone.html');
  const r = await page.evaluate(() => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    const host = document.createElement('div');
    document.body.append(host);
    const m = B.createMicMeter(host, { bars: 10 });
    m.setLevel(0.5);
    const el = host.querySelector('.b24-micmeter')!;
    const on = el.querySelectorAll('.is-on').length;
    const now = el.getAttribute('aria-valuenow');
    m.setMuted(true);
    return { on, now, muted: el.classList.contains('is-muted'), after: el.querySelectorAll('.is-on').length };
  });
  expect(r).toEqual({ on: 5, now: '50', muted: true, after: 0 });
});

test('панель мессенджера: кнопка звонка — зелёная, точка статуса, popover с клавиатурой, пульс', async ({ page }) => {
  await open(page, '/phone.html');
  if ((page.viewportSize()?.width ?? 1280) <= 768) return;       // панель на телефоне скрыта
  const btn = page.locator('.b24-im-bar__action');
  await expect(btn).toHaveClass(/b24-im-bar__action--success/);
  await expect(btn.locator('.b24-im-bar__dot.is-online')).toBeVisible();
  await expect(btn).toHaveCSS('background-color', 'rgb(27, 206, 123)');
  await btn.click();
  const pop = page.locator('.b24-popover--content');
  await expect(pop.locator('.b24-dialpad')).toBeVisible();
  // captureKeyboard: цифры идут в клавиатуру popover, даже без фокуса в ней
  await page.keyboard.press('1');
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  await expect(pop.locator('.b24-dialpad__input')).toHaveValue('112');
  await page.keyboard.press('Enter');
  await expect(pop).toHaveCount(0);
  await expect(btn).toHaveClass(/is-pulse/);
  await expect(btn).toHaveClass(/b24-im-bar__action--success/);            // оформление не слетело после перерисовки
});

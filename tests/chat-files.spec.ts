import { test, expect, type Page } from '@playwright/test';
import { open } from './helpers';

const mobile = (page: Page) => (page.viewportSize()?.width ?? 1280) <= 768;
const openDialog = async (page: Page) => { if (mobile(page)) await page.locator('#chat-list .b24-chat-list__item').first().click(); };
const png = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') };

test('поле ответа: только файлы без текста, прогресс блокирует отправку, ошибочный не уходит', async ({ page }) => {
  await open(page, '/chat.html');
  await openDialog(page);
  const comp = page.locator('#chat-composer');
  const send = comp.locator('.b24-chat-composer__send');
  await expect(send).toBeDisabled();
  await comp.locator('input[type=file]').setInputFiles(png);
  const chip = comp.locator('.b24-chat-attchip');
  await expect(chip).toHaveCount(1);
  await expect(chip).toHaveClass(/is-uploading/);
  await expect(send).toBeDisabled();                    // идёт загрузка
  await expect(chip).not.toHaveClass(/is-uploading/, { timeout: 5000 });
  await expect(send).toBeEnabled();                     // текста нет, но файл загружен
  await send.click();
  await expect(comp.locator('.b24-chat-attchip')).toHaveCount(0);
  await expect(page.locator('#chat-feed .b24-chat-msg.is-out img').last()).toBeVisible();
  // ошибка загрузки
  await comp.locator('input[type=file]').setInputFiles({ ...png, name: 'err.png' });
  await expect(comp.locator('.b24-chat-attchip.is-error .b24-chat-attchip__meta')).toHaveText('Файл слишком большой', { timeout: 5000 });
  await expect(send).toBeDisabled();
  await comp.locator('.b24-chat-attchip__remove').click();
  await expect(comp.locator('.b24-chat-attchip')).toHaveCount(0);
});

test('поле ответа: перетаскивание и вставка из буфера идут в onAttach', async ({ page }) => {
  await open(page, '/chat.html');
  await openDialog(page);
  const comp = page.locator('#chat-composer .b24-chat-composer');
  await comp.evaluate((el) => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'drop.txt', { type: 'text/plain' }));
    el.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
    (el as HTMLElement).dataset.over = String(el.classList.contains('is-dragover'));
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await expect(comp).not.toHaveClass(/is-dragover/);
  expect(await comp.getAttribute('data-over')).toBe('true');
  await expect(comp.locator('.b24-chat-attchip__name')).toHaveText('drop.txt');
  await comp.evaluate((el) => {
    const dt = new DataTransfer();
    dt.items.add(new File(['y'], 'shot.png', { type: 'image/png' }));
    el.querySelector('textarea')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(comp.locator('.b24-chat-attchip')).toHaveCount(2);
});

test('скрытый режим: заметка в ленте — жёлтая, с замком и подписью', async ({ page }) => {
  await open(page, '/chat.html');
  await openDialog(page);
  const comp = page.locator('#chat-composer');
  await expect(comp.locator('.b24-chat-composer__mode')).toHaveText(['Ответ клиенту', 'Скрытое сообщение']);
  await comp.locator('.b24-chat-composer__mode[data-mode="note"]').click();
  await expect(comp.locator('.b24-chat-composer')).toHaveClass(/is-mode-note/);
  await expect(comp.locator('textarea')).toHaveAttribute('placeholder', 'Заметка: клиент её не увидит');
  await comp.locator('textarea').fill('Позвонить после обеда');
  await comp.locator('textarea').press('Enter');
  const note = page.locator('#chat-feed .b24-chat-msg.is-note').last();
  await expect(note).toContainText('Позвонить после обеда');
  await expect(note.locator('.b24-chat-msg__note')).toHaveText('Видят только сотрудники');
  const bg = await note.locator('.b24-chat-msg__bubble').evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(bg).toBe('rgb(255, 243, 196)');
  // недоступный режим: кнопка disabled с причиной, выбор возвращается к доступному
  await page.evaluate(() => (window as unknown as { __composer: { setModeDisabled(id: string, d: boolean, r: string): void } }).__composer.setModeDisabled('note', true, 'Клиент ещё не написал'));
  const noteBtn = comp.locator('.b24-chat-composer__mode[data-mode="note"]');
  await expect(noteBtn).toBeDisabled();
  await expect(noteBtn).toHaveAttribute('title', 'Клиент ещё не написал');
  await expect(comp.locator('.b24-chat-composer__mode[data-mode="reply"]')).toHaveClass(/is-active/);
});

test('окно чата: свои кнопки в шапке; лайтбокс с нейтральными подписями', async ({ page }) => {
  await open(page, '/chat.html');
  if (!mobile(page)) {
    await page.locator('.b24-im-bar__item').nth(1).click();
    await expect(page.locator('.b24-chat-dock__extra #dock-invite')).toBeVisible();
    await page.locator('.b24-chat-dock').getByRole('button', { name: 'Свернуть' }).click();
    await expect(page.locator('.b24-chat-dock__extra')).toBeHidden();
  }
  await openDialog(page);
  await page.locator('#chat-feed .b24-chat-att--photo').first().click();
  await expect(page.locator('.b24-lightbox')).toHaveAttribute('aria-label', 'Просмотр изображения');
});

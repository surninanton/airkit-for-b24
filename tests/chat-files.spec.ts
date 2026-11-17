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

test('файлы: dropTarget — вся переписка; maxSize/maxFiles/accept работают и для перетаскивания', async ({ page }) => {
  await open(page, '/chat.html');
  await openDialog(page);
  const main = page.locator('#chat .b24-chat__main');
  const comp = page.locator('#chat-composer .b24-chat-composer');
  await main.evaluate((el) => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'a.txt', { type: 'text/plain' }));
    el.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
    (el as HTMLElement).dataset.over = String(el.classList.contains('b24-chat-dropzone-active'));
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  expect(await main.getAttribute('data-over')).toBe('true');
  await expect(main).not.toHaveClass(/b24-chat-dropzone-active/);
  await expect(comp.locator('.b24-chat-attchip__name')).toHaveText('a.txt');
  // не тот тип и слишком большой: тост, чип не добавляется
  await main.evaluate((el) => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'run.exe', { type: 'application/x-msdownload' }));
    dt.items.add(new File([new Uint8Array(6 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' }));
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('.b24-toast')).toHaveCount(2);
  await expect(comp.locator('.b24-chat-attchip')).toHaveCount(1);
});

test('отправка вернула false: чипы снова доступны, прогресс отправки снят', async ({ page }) => {
  await open(page, '/chat.html');
  await openDialog(page);
  const res = await page.evaluate(async () => {
    const B24UI = (window as unknown as { B24UI: typeof import('../src/js/index') }).B24UI;
    const host = document.createElement('div');
    document.body.append(host);
    const c = B24UI.createChatComposer(host, { onAttach: () => undefined, onSend: async () => { c.updateAttachment('x', { progress: 0.4 }); return false; } });
    c.addAttachment({ id: 'x', name: 'x.png' });
    (host.querySelector('.b24-chat-composer__send') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 100));
    return { progress: c.getAttachments()[0].progress, sending: !!host.querySelector('.is-sending'), canSend: !(host.querySelector('.b24-chat-composer__send') as HTMLButtonElement).disabled };
  });
  expect(res).toEqual({ progress: undefined, sending: false, canSend: true });
});

test('заметка коллеги: слева, с аватаром и именем', async ({ page }) => {
  await open(page, '/chat.html');
  await openDialog(page);
  const note = page.locator('#chat-feed .b24-chat-msg[data-id="mc"]');
  await expect(note).toHaveClass(/is-in/);
  await expect(note).toHaveClass(/is-note/);
  await expect(note.locator('.b24-avatar')).toHaveCount(1);
  await expect(note.locator('.b24-chat-msg__author')).toHaveText('Игорь Сафонов');
  const mine = page.locator('#chat-feed .b24-chat-msg[data-id="mn"]');
  await expect(mine).toHaveClass(/is-out/);
});

test('рейл слева от списка: пункты, активный, счётчик, клик; на телефоне — панель над списком, скрыта в переписке', async ({ page }) => {
  await open(page, '/chat.html');
  const rail = page.locator('#chat > .b24-chat__rail');
  await expect(rail.locator('.b24-chat-rail__item')).toHaveText(['3Чаты', '5Линии', 'CRM', '1Телефон']);
  await expect(rail.locator('.b24-chat-rail__item[aria-current]')).toHaveText('5Линии');
  await expect(rail.locator('.b24-chat-rail__item').first().locator('.b24-chat-rail__counter')).toHaveText('3');
  await rail.locator('.b24-chat-rail__item', { hasText: 'Телефон' }).click();
  await expect(rail.locator('.b24-chat-rail__item[aria-current]')).toHaveText('1Телефон');
  await expect(page.locator('.b24-toast').last()).toContainText('phone');
  const r = (await rail.boundingBox())!;
  const list = (await page.locator('#chat .b24-chat__list').boundingBox())!;
  if (!mobile(page)) {
    expect(Math.round(r.width)).toBe(68);
    expect(list.x).toBeGreaterThanOrEqual(r.x + r.width - 1);        // список справа от рейла
  } else {
    expect(r.y + r.height).toBeLessThanOrEqual(list.y + 1);            // панель над списком
    expect(Math.round(r.width)).toBe(Math.round(list.width));
    await page.locator('#chat-list .b24-chat-list__item').first().click();
    await expect(rail).toBeHidden();                                  // открыта переписка
    await page.locator('[data-b24-chat-back]').click();
    await expect(rail).toBeVisible();
  }
});

test('иконки для софтфона: headset, phoneIncoming / Outgoing / Missed', async ({ page }) => {
  await open(page, '/chat.html');
  const ok = await page.evaluate(() => {
    const B = (window as unknown as { B24UI: { icon(n: string): string } }).B24UI;
    return ['headset', 'phone', 'chart', 'phoneIncoming', 'phoneOutgoing', 'phoneMissed', 'userPlus'].map((n) => B.icon(n).startsWith('<svg') && B.icon(n).includes('<path'));
  });
  expect(ok.every(Boolean)).toBe(true);
});

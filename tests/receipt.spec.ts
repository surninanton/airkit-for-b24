import { test, expect, type Page } from '@playwright/test';
import { open, noHorizontalScroll } from './helpers';

type Api = typeof import('../src/js/index');
const api = (page: Page) => page.evaluate(() => (window as unknown as { B24UI: Api }).B24UI && true);

test('чековая лента: перенос по ширине, двойная ширина, таблица, разделитель, инверсия', async ({ page }) => {
  await open(page, '/receipt.html');
  const res = await page.evaluate(() => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    const host = document.createElement('div');
    document.body.append(host);
    const r = B.createReceipt(host, { paper: 58, lines: [
      { text: 'Очень длинное название позиции которое не помещается' },
      { text: 'ИТОГО', dw: true, align: 'right' },
      { cols: ['Маргарита', '2 × 450'] },
      { cols: ['Ролл Филадельфия с лососем и огурцом', '520'] },
      { sep: '=' },
      { text: 'ОТМЕНА', invert: true, align: 'center' },
      { qr: 'https://example.com', label: 'Оцените' },
      { barcode: '4600000000012' },
    ] });
    const w32 = r.getText().split('\n');
    r.setPaper(80);
    return { w32, w48: r.getText().split('\n'), width: r.getWidth() };
  });
  expect(res.width).toBe(48);
  const lines = res.w32;
  expect(lines.every((l) => l.length <= 32)).toBe(true);
  expect(lines[0]).toBe('Очень длинное название позиции');     // перенос по словам
  expect(lines[2].trimEnd().length).toBeLessThanOrEqual(16);       // двойная ширина — вдвое меньше символов
  expect(lines.find((l) => l.startsWith('Маргарита'))!.endsWith('2 × 450')).toBe(true);
  expect(lines.find((l) => l.startsWith('Маргарита'))).toHaveLength(32);
  expect(lines.filter((l) => /^=+$/.test(l))[0]).toHaveLength(32);
  expect(res.w48.filter((l) => /^=+$/.test(l))[0]).toHaveLength(48);
  expect(lines.some((l) => l.startsWith('[QR]'))).toBe(true);
  expect(lines.some((l) => l.startsWith('[BARCODE]'))).toBe(true);
});

test('чековая лента: стили в DOM, переключатель 58 / 80 мм, без горизонтальной прокрутки страницы', async ({ page }) => {
  await open(page, '/receipt.html');
  const rec = page.locator('.b24-receipt');
  await expect(page.locator('.b24-receipt__row.is-dw.is-dh').first()).toBeVisible();
  await expect(page.locator('.b24-receipt__row.is-invert')).toHaveCSS('background-color', 'rgb(27, 27, 27)');
  await expect(page.locator('.b24-receipt__row.is-bold').first()).toHaveCSS('font-weight', '700');
  await expect(page.locator('.b24-receipt__paper.is-active')).toHaveText('80 мм');
  const w80 = (await rec.boundingBox())!.width;
  await page.locator('.b24-receipt__paper', { hasText: '58' }).click();
  await expect(page.locator('.b24-receipt__paper.is-active')).toHaveText('58 мм');
  expect((await rec.boundingBox())!.width).toBeLessThan(w80);
  await noHorizontalScroll(page);
  // QR — настоящий SVG, не заглушка (выключен в демо, включаем через переключатель блока)
  await page.locator('.b24-sortable__item[data-id="qr"] input[role=switch]').check();
  await expect(page.locator('.b24-receipt__qr svg')).toBeVisible();
});

test('QR: матрица корректной версии, поисковые узоры, SVG', async ({ page }) => {
  await open(page, '/receipt.html');
  const r = await page.evaluate(() => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    const m = B.qrMatrix('HELLO', 'M');
    const big = B.qrMatrix('x'.repeat(150), 'L');
    let throws = false;
    try { B.qrMatrix('x'.repeat(400)); } catch { throws = true; }
    const finder = (ox: number, oy: number) => [0, 6].every((i) => m[oy][ox + i] && m[oy + 6][ox + i] && m[oy + i][ox] && m[oy + i][ox + 6]) && !m[oy + 1][ox + 1] && m[oy + 3][ox + 3];
    return { size: m.length, big: big.length, throws, finders: [finder(0, 0), finder(m.length - 7, 0), finder(0, m.length - 7)], svg: B.qrSvg('HELLO').startsWith('<svg') };
  });
  expect(r.size).toBe(21);           // версия 1
  expect(r.big).toBe(17 + 4 * 7);    // 150 байт, уровень L — версия 7
  expect(r.throws).toBe(true);
  expect(r.finders).toEqual([true, true, true]);
  expect(r.svg).toBe(true);
});

const ids = (page: Page) => page.locator('#blocks .b24-sortable__item').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id));

test('сортируемый список: Alt+↑/↓ на ручке, onReorder, фокус остаётся, предпросмотр следует порядку', async ({ page }) => {
  await open(page, '/receipt.html');
  expect(await ids(page)).toEqual(['logo', 'order', 'items', 'total', 'qr', 'note']);
  const handle = page.locator('#blocks .b24-sortable__item[data-id="items"] .b24-sortable__handle');
  await handle.focus();
  await page.keyboard.press('Alt+ArrowUp');
  expect(await ids(page)).toEqual(['logo', 'items', 'order', 'total', 'qr', 'note']);
  await expect(handle).toBeFocused();
  await expect(page.locator('.b24-sortable__live')).toContainText('позиция 2 из 6');
  // предпросмотр: состав выше номера заказа
  const text = await page.locator('.b24-receipt').innerText();
  expect(text.indexOf('Маргарита')).toBeLessThan(text.indexOf('Заказ №'));
  await page.keyboard.press('Alt+ArrowDown');
  await page.keyboard.press('Alt+ArrowDown');
  expect(await ids(page)).toEqual(['logo', 'order', 'total', 'items', 'qr', 'note']);
  // ↑ без Alt — к ручке соседа
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#blocks .b24-sortable__item[data-id="total"] .b24-sortable__handle')).toBeFocused();
});

test('сортируемый список: перетаскивание мышью за ручку; развёрнутая строка едет целиком; Esc отменяет', async ({ page }) => {
  await open(page, '/receipt.html');
  const item = (id: string) => page.locator(`#blocks .b24-sortable__item[data-id="${id}"]`);
  await item('order').locator('.b24-sortable__expand').click();
  await expect(item('order').locator('.b24-sortable__body')).toBeVisible();
  const h = (await item('order').locator('.b24-sortable__handle').boundingBox())!;
  const target = (await item('total').boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + 40, { steps: 4 });
  await page.mouse.move(h.x + h.width / 2, target.y + target.height / 2 + 30, { steps: 12 });
  await expect(item('order')).toHaveClass(/is-dragging/);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(await ids(page)).toEqual(['logo', 'order', 'items', 'total', 'qr', 'note']);   // отмена
  // и теперь по-настоящему
  const h2 = (await item('order').locator('.b24-sortable__handle').boundingBox())!;
  await page.mouse.move(h2.x + h2.width / 2, h2.y + h2.height / 2);
  await page.mouse.down();
  await page.mouse.move(h2.x + h2.width / 2, h2.y + 40, { steps: 4 });
  const t2 = (await item('total').boundingBox())!;
  await page.mouse.move(h2.x + h2.width / 2, t2.y + t2.height - 4, { steps: 14 });
  await page.mouse.up();
  const after = await ids(page);
  expect(after.indexOf('order')).toBeGreaterThan(after.indexOf('items'));
  await expect(item('order').locator('.b24-sortable__body')).toBeVisible();              // раскрытие сохранилось
  await expect(item('order')).not.toHaveClass(/is-dragging/);
});

test('сортируемый список: включатель, раскрытие, ввод в настройках меняет предпросмотр', async ({ page }) => {
  await open(page, '/receipt.html');
  const sw = page.locator('#blocks .b24-sortable__item[data-id="note"] input[role=switch]');
  await expect(page.locator('.b24-receipt')).toContainText('Спасибо, что выбрали нас!');
  await sw.uncheck();
  await expect(page.locator('#blocks .b24-sortable__item[data-id="note"]')).toHaveClass(/is-off/);
  await expect(page.locator('.b24-receipt')).not.toContainText('Спасибо, что выбрали нас!');
  await page.locator('#blocks .b24-sortable__item[data-id="logo"] .b24-sortable__expand').click();
  await expect(page.locator('#blocks .b24-sortable__item[data-id="logo"] .b24-sortable__expand')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#blocks .b24-sortable__item[data-id="logo"] input.b24-input').fill('КАФЕ');
  await expect(page.locator('.b24-receipt')).toContainText('КАФЕ');
});

test('дерево: значок справа, наследование «как у родителя», выбор зон, сброс к родителю', async ({ page }) => {
  await open(page, '/receipt.html');
  const node = (id: string) => page.locator(`#zones [data-id="${id}"] > .b24-tree__node`);
  await expect(node('pizza-hot').locator('.b24-tree__chip', { hasText: 'хит' })).toBeVisible();
  // унаследованное — серое, с подписью; своё — без неё и со сбросом
  await expect(node('pizza-hot').locator('.b24-tree__valuebox')).toHaveClass(/is-inherited/);
  await expect(node('pizza-hot').locator('.b24-tree__inherit')).toHaveText('как у родителя');
  await expect(node('pizza-hot').locator('.b24-tree__chip.b24-tree__chip')).toContainText(['хит', 'Кухня', 'Упаковка']);
  await expect(node('pizza').locator('.b24-tree__reset')).toBeVisible();
  await expect(node('all').locator('.b24-tree__reset')).toHaveCount(0);       // у корня родителя нет
  // правим «Роллы»: при снятии «как у родителя» в набор попадает унаследованное, и к нему добавляем «Кухню»
  await node('rolls').locator('.b24-tree__value').click();
  const dlg = page.locator('.b24-tree-values');
  await expect(dlg.locator('.b24-tree-values__inherit input')).toBeChecked();
  await dlg.locator('.b24-tree-values__inherit input').uncheck();
  await dlg.getByLabel('Кухня').check();
  await expect(node('rolls').locator('.b24-tree__valuebox')).not.toHaveClass(/is-inherited/);
  await page.keyboard.press('Escape');
  // потомок «Горячие» наследует новое значение
  await expect(node('rolls-hot').locator('.b24-tree__chip')).toHaveText(['Кухня', 'Ресепшн']);
  await expect(node('rolls-hot').locator('.b24-tree__valuebox')).toHaveClass(/is-inherited/);
  // сброс к родителю
  await node('rolls').locator('.b24-tree__reset').click();
  await expect(node('rolls').locator('.b24-tree__chip')).toHaveText(['Ресепшн']);
  await expect(node('rolls').locator('.b24-tree__inherit')).toBeVisible();
  await noHorizontalScroll(page);
});

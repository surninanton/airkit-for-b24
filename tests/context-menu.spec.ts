import { test, expect, type Page } from '@playwright/test';
import { open, noHorizontalScroll } from './helpers';

type Api = typeof import('../src/js/index');

test('контекстное меню: правая кнопка, пункты, danger, разделитель, Esc и клик мимо', async ({ page }) => {
  const { errors } = await open(page, '/controls.html');
  const area = page.locator('#ctx-area');
  await area.scrollIntoViewIfNeeded();
  await area.click({ button: 'right' });
  const menu = page.locator('.b24-context-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('.b24-menu__item')).toHaveText(['ОткрытьEnter', 'Копировать номер', 'Отменить заказ', 'Недоступно']);
  await expect(menu.locator('.b24-menu__title')).toHaveText('Заказ № 4821');
  await expect(menu.locator('.b24-menu__divider')).toHaveCount(2);
  await expect(menu.locator('.b24-menu__item--danger')).toHaveText('Отменить заказ');
  await expect(menu.getByRole('menuitem', { name: 'Недоступно' })).toBeDisabled();
  // клавиатура: фокус на первом, ↓ ↓ Enter
  await expect(menu.locator('.b24-menu__item').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(menu).toHaveCount(0);
  await expect(page.locator('#ctx-out')).toHaveText('Копировать');
  // Esc и клик мимо
  await area.click({ button: 'right' });
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await area.click({ button: 'right' });
  await page.waitForTimeout(450);                       // окно «игнорировать клики мимо» прошло
  await page.locator('#ctx-out').click();
  await expect(menu).toHaveCount(0);
  // меню не вылезает за экран
  await page.evaluate(() => (window as unknown as { B24UI: Api }).B24UI.openContextMenu(window.innerWidth - 2, window.innerHeight - 2, [{ label: 'Один' }, { label: 'Два' }]));
  await expect(menu).toBeVisible();
  const box = (await menu.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  expect(errors()).toEqual([]);
});

test('контекстное меню: долгое нажатие пальцем открывает меню, отпускание не закрывает его и не кликает', async ({ page }) => {
  await open(page, '/controls.html');
  const r = await page.evaluate(async () => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:20px;top:200px;width:200px;height:80px;background:#eee';
    document.body.append(el);
    let clicked = 0;
    el.addEventListener('click', () => { clicked += 1; });
    document.addEventListener('click', () => { clicked += 1; });
    B.contextMenu(el, [{ label: 'Пункт' }], { longPress: 200, ignoreOutsideMs: 300 });
    const fire = (type: string, x = 60, y = 230) => el.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', isPrimary: true, pointerId: 7, clientX: x, clientY: y, bubbles: true }));
    fire('pointerdown');
    await new Promise((res) => setTimeout(res, 260));
    const opened = !!document.querySelector('.b24-context-menu');
    fire('pointerup');
    el.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', isPrimary: true, pointerId: 7, clientX: 60, clientY: 230, bubbles: true }));  // «отпускание» как нажатие вне меню в окне игнора
    el.click();                                         // click после долгого нажатия подавляется
    const stillOpen = !!document.querySelector('.b24-context-menu');
    // сдвиг пальца отменяет долгое нажатие
    document.querySelector('.b24-context-menu')?.remove();
    fire('pointerdown');
    fire('pointermove', 120, 300);
    await new Promise((res) => setTimeout(res, 260));
    const movedOpen = !!document.querySelector('.b24-context-menu');
    return { opened, stillOpen, clicked, movedOpen };
  });
  expect(r).toEqual({ opened: true, stillOpen: true, clicked: 0, movedOpen: false });
});

test('палитра из массива: галочка тёмная на светлых цветах, белая на тёмных; таблетка с акцентом', async ({ page }) => {
  await open(page, '/controls.html');
  await page.locator('#palette').scrollIntoViewIfNeeded();
  const sw = (c: string) => page.locator(`#palette .b24-colors__swatch:has(input[value="${c}"])`);
  await expect(page.locator('#palette .b24-colors__swatch')).toHaveCount(8);
  await expect(page.locator('#palette .b24-colors__custom')).toHaveCount(1);
  await expect(sw('#ffd400').locator('input')).toBeChecked();
  const ck = (c: string) => sw(c).evaluate((el) => getComputedStyle(el, '::after').borderBottomColor);
  expect(await ck('#ffd400')).toBe('rgb(31, 35, 41)');     // светлый — тёмная галочка
  await sw('#0075ff').click();
  await expect(page.locator('#ctx-out')).toHaveText('Цвет: #0075ff');
  expect(await ck('#0075ff')).toBe('rgb(255, 255, 255)');  // тёмный — белая
  // таблетка с акцентом бренда
  const tg = page.locator('#brands .b24-segmented > label').nth(0);
  await expect(tg.locator('span')).toHaveCSS('background-color', 'rgb(42, 171, 238)');
  await page.locator('#brands .b24-segmented > label', { hasText: 'MAX' }).click();
  await expect(page.locator('#brands .b24-segmented > label', { hasText: 'MAX' }).locator('span')).toHaveCSS('background-color', 'rgb(123, 77, 255)');
  await expect(page.locator('#ctx-out')).toHaveText('Канал: max');
  await page.locator('#brands .b24-segmented > label', { hasText: 'Сайт' }).click();
  await expect(page.locator('#brands .b24-segmented > label', { hasText: 'Сайт' }).locator('span')).toHaveCSS('color', 'rgb(31, 35, 41)');   // на жёлтом — тёмный текст
});

test('шапка оболочки: заголовок в одну строку с многоточием, поиск сворачивается в лупу и раскрывается поверх', async ({ page }) => {
  await open(page, '/controls.html');
  await page.locator('#fake-shell').scrollIntoViewIfNeeded();
  const title = page.locator('#fake-title');
  const tc = await title.evaluate((el) => { const s = getComputedStyle(el); return { ws: s.whiteSpace, to: s.textOverflow, over: el.scrollWidth > el.clientWidth }; });
  expect(tc).toMatchObject({ ws: 'nowrap', to: 'ellipsis' });
  const search = page.locator('#fake-search');
  await expect(search.locator('.b24-shell__search-toggle')).toBeVisible();
  await expect(search.locator('.b24-shell__search-field')).toBeHidden();
  await search.locator('.b24-shell__search-toggle').click();
  await expect(search).toHaveClass(/is-open/);
  await expect(search.locator('.b24-shell__search-field')).toBeVisible();
  await expect(search.locator('input')).toBeFocused();
  const hdr = (await page.locator('#fake-shell .b24-shell__header').boundingBox())!;
  const fld = (await search.locator('.b24-shell__search-field').boundingBox())!;
  expect(fld.width).toBeGreaterThan(hdr.width * 0.8);       // поверх всей шапки
  await page.keyboard.press('Escape');
  await expect(search).not.toHaveClass(/is-open/);
  await search.locator('.b24-shell__search-toggle').click();
  await page.locator('#ctx-out').click();                   // клик мимо
  await expect(search).not.toHaveClass(/is-open/);
  await noHorizontalScroll(page);
});

test('поле для тёмного фона и пустая шапка раздела', async ({ page }) => {
  await open(page, '/controls.html');
  const r = await page.evaluate(() => {
    const host = document.createElement('div');
    host.className = 'b24-root';
    host.innerHTML = '<input class="b24-input b24-input--glass" id="g1" placeholder="x"><header class="b24-page-header" id="ph1"></header><header class="b24-page-header" id="ph2"><div class="b24-page-header__nav"></div><div class="b24-page-header__main"></div></header><header class="b24-page-header" id="ph3"><div class="b24-page-header__main"><h1 class="b24-page-header__title">Раздел</h1></div></header>';
    document.body.append(host);
    const d = (id: string) => getComputedStyle(host.querySelector('#' + id)!).display;
    const res = { bg: getComputedStyle(host.querySelector('#g1')!).backgroundColor, ph1: d('ph1'), ph2: d('ph2'), ph3: d('ph3') };
    host.remove();
    return res;
  });
  expect(r.bg).toBe('rgba(255, 255, 255, 0.12)');
  expect(r.ph1).toBe('none');
  expect(r.ph2).toBe('none');
  expect(r.ph3).not.toBe('none');
});

test('звонок: аватар и бренд в строке журнала, акцент и бренд карточки', async ({ page }) => {
  await open(page, '/phone.html');
  const row = page.locator('#calllog .b24-calllog__item').nth(1);
  await expect(row.locator('.b24-calllog__avatar .b24-avatar')).toBeVisible();
  await expect(row.locator('.b24-calllog__dir')).toBeVisible();
  await expect(row.locator('.b24-calllog__brand')).toHaveText('Пицца Ролл · Доставка');
  await expect(row.locator('.b24-calllog__brand')).toHaveCSS('color', 'rgb(226, 121, 58)');
  const card = page.locator('#callcard .b24-callcard');
  await expect(card).toHaveClass(/has-accent/);
  await expect(card).toHaveCSS('border-top-color', 'rgb(226, 121, 58)');
  await expect(card.locator('.b24-callcard__brand')).toHaveText('Пицца Ролл');
  await page.evaluate(() => { /* смена бренда на лету */ });
});

test('меню: пункт со своим содержимым (палитра с подписями), позиция пересчитывается, выше правой панели', async ({ page }) => {
  await open(page, '/controls.html');
  const area = page.locator('#ctx-area');
  await area.scrollIntoViewIfNeeded();
  await area.click({ button: 'right' });
  const menu = page.locator('.b24-context-menu');
  await expect(menu.locator('.b24-context-menu__content .b24-colors__swatch')).toHaveCount(4);
  await expect(menu.locator('.b24-colors__swatch').first()).toHaveAttribute('title', 'Голубой');
  await expect(menu.locator('.b24-colors__swatch input').nth(1)).toHaveAttribute('aria-label', 'Оранжевый');
  await menu.locator('.b24-colors__swatch').nth(2).click();                 // выбор в содержимом закрывает меню через close()
  await expect(menu).toHaveCount(0);
  await expect(page.locator('#ctx-out')).toHaveText('Цвет: #ff5752');
  // у правого нижнего края содержимое не уводит меню за экран; z-index выше панели мессенджера (1090) и окон (1100)
  await page.evaluate(() => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    B.openContextMenu(window.innerWidth - 4, window.innerHeight - 4, [{ label: 'Один' }, { content: () => { const d = document.createElement('div'); d.style.height = '120px'; d.textContent = 'Содержимое'; return d; } }]);
  });
  await expect(menu).toBeVisible();
  const box = (await menu.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  expect(Number(await menu.evaluate((e) => getComputedStyle(e).zIndex))).toBeGreaterThan(1100);
});

test('таблетка: логотип-картинка вместо значка; заголовок оболочки крупный по модификатору', async ({ page }) => {
  await open(page, '/controls.html');
  const logo = page.locator('#brands .b24-segmented > label', { hasText: 'Лого' });
  await expect(logo.locator('img.b24-segmented__img')).toHaveCount(1);
  const wh = await logo.locator('img').evaluate((e) => [e.clientWidth, e.clientHeight]);
  expect(wh).toEqual([20, 20]);
  await logo.click();
  await expect(logo.locator('span')).toHaveCSS('background-color', 'rgb(226, 121, 58)');
  const small = await page.locator('#fake-title').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  const big = await page.locator('#fake-title2').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(big).toBeGreaterThan(small);
  expect(big).toBeGreaterThanOrEqual(24);
});

test('поиск в шапке (мобильный режим): лупа не перекрывает поле, нет горизонтальной прокрутки, один Esc закрывает и фильтр, и поле', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page, '/controls.html');
  await page.locator('#fake-shell2').scrollIntoViewIfNeeded();
  const search = page.locator('#fake-search2');
  await search.locator('.b24-shell__search-toggle').click();
  await expect(search).toHaveClass(/is-open/);
  await noHorizontalScroll(page);
  const tb = (await search.locator('.b24-shell__search-toggle').boundingBox())!;
  const fb = (await search.locator('.b24-filter').boundingBox())!;
  expect(fb.x + fb.width).toBeLessThanOrEqual(tb.x + 1);              // поле заканчивается до лупы
  await expect(search.locator('.b24-shell__search-toggle svg')).toBeVisible();
  // курсор в строке — параметры открыты; Esc закрывает всё сразу
  await search.locator('.b24-filter__input').click();
  await expect(page.locator('.b24-filter-popup')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.b24-filter-popup')).toBeHidden();
  await expect(search).not.toHaveClass(/is-open/);
});

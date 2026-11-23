import { expect, test } from '@playwright/test';
import { noHorizontalScroll, open } from './helpers';

test('карточка заказа: имя клиента — кнопка в карточку клиента, поверх с «Назад»', async ({ page }) => {
  const { errors } = await open(page, '/cards.html?card=order');
  await expect(page.locator('.b24-sidepanel')).toHaveCount(1);
  await page.locator('.b24-entity-link').first().click();
  await expect(page.locator('.b24-sidepanel')).toHaveCount(2);
  await expect(page.locator('.b24-sidepanel').last().locator('.b24-entity__name')).toHaveText('Степан Громов');
  await page.locator('.b24-sidepanel__back').click();
  await expect(page.locator('.b24-sidepanel')).toHaveCount(1);
  expect(errors()).toEqual([]);
});

test('заказ: круглая «Позвонить», мессенджеры, почта, «изменил» в шапке', async ({ page }) => {
  await open(page, '/cards.html?card=order');
  await expect(page.locator('.b24-contact .b24-btn--round.b24-btn--success[aria-label="Позвонить"]')).toBeVisible();
  await expect(page.locator('.b24-contact .b24-btn--channel')).toHaveCount(3);
  await expect(page.locator('.b24-btn--round[aria-label="Написать на почту"]')).toBeVisible();
  await expect(page.locator('.b24-entity__editor')).toContainText('изменил');
});

test('заказ: комментарий закрепляется вверху ленты и открепляется на место', async ({ page }) => {
  await open(page, '/cards.html?card=order');
  const tl = page.locator('#order-timeline');
  // новый комментарий через композер
  await page.locator('.b24-composer__input').click();
  await page.locator('.b24-composer__input').fill('Привет, тест');
  await page.locator('[data-b24-composer-submit]').click();
  const item = tl.locator('.b24-timeline__item', { hasText: 'Привет, тест' });
  const before = await tl.locator('.b24-timeline__item').evaluateAll((els) => els.map((e) => e.textContent?.slice(0, 20)));
  await item.locator('[data-b24-pin]').click();
  await expect(tl.locator('.b24-timeline__divider--pinned')).toHaveText('Закреплено');
  await expect(tl.locator('.b24-timeline__item').first()).toContainText('Привет, тест');
  await expect(item).toHaveClass(/b24-timeline__item--pinned/);
  await item.locator('[data-b24-pin]').click();
  await expect(tl.locator('.b24-timeline__divider--pinned')).toHaveCount(0);
  expect(await tl.locator('.b24-timeline__item').evaluateAll((els) => els.map((e) => e.textContent?.slice(0, 20)))).toEqual(before);
});

test('заказ: способ оплаты не меняется при фискальном чеке, пока не сделан возврат', async ({ page }) => {
  await open(page, '/cards.html?card=order');
  await expect(page.locator('#pay-method')).toBeDisabled();
  await expect(page.locator('#pay-fiscal')).toBeVisible();
  await page.locator('#pay-refund').click();
  await page.locator('.b24-modal .b24-btn--danger').click();
  await expect(page.locator('#pay-method')).toBeEnabled();
  await expect(page.locator('#pay-fiscal')).toBeHidden();
  await expect(page.locator('#pay-print')).toBeVisible();
  await page.locator('#pay-print').click();
  await expect(page.locator('#pay-method')).toBeDisabled();
});

test('профиль: имя только в шапке, поля и «Сохранить» — после «Изменить», вкладки переключаются', async ({ page }) => {
  await open(page, '/cards.html?card=profile');
  await expect(page.locator('#pf-last')).toBeHidden();
  await expect(page.locator('.b24-sidepanel__footer')).toBeHidden();
  await page.locator('#profile-edit').click();
  await expect(page.locator('#pf-last')).toBeVisible();
  await expect(page.locator('.b24-sidepanel__footer')).toBeVisible();
  await page.locator('#pf-first').fill('Пётр');
  await page.locator('[data-save]').click();
  await expect(page.locator('#profile-name')).toContainText('Пётр');
  await expect(page.locator('.b24-sidepanel__footer')).toBeHidden();
  await page.locator('[data-b24-tab="login"]').click();
  await expect(page.locator('[data-b24-tab-panel="login"]')).toBeVisible();
  await expect(page.locator('[data-b24-tab-panel="main"]')).toBeHidden();
});

test('звонок: плеер записи и компакт без горизонтальной прокрутки', async ({ page }) => {
  await open(page, '/cards.html?card=call');
  await expect(page.locator('#call-player .b24-audio')).toBeVisible();
  await expect(page.locator('.b24-entity__name')).toHaveCount(1);
  await open(page, '/cards.html?card=callmini');
  await expect(page.locator('.b24-entity--compact')).toBeVisible();
  await noHorizontalScroll(page);
});

test('футер панели: на узком экране лишние кнопки в «Ещё», на широком все на месте', async ({ page }) => {
  await open(page, '/cards.html?card=order');
  const narrow = (page.locator('.b24-sidepanel').first());
  const w = (await narrow.boundingBox())!.width;
  if (w < 600) {
    await expect(page.locator('[data-b24-more]')).toBeVisible();
    // в один ряд: на 390 px помещается одна кнопка и «Ещё»
    const tops = await page.locator('.b24-sidepanel__footer > :visible').evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLElement).offsetTop))]);
    expect(tops.length).toBe(1);
    await page.locator('[data-b24-more]').click();
    expect(await page.locator('.b24-context-menu [role="menuitem"]').count()).toBeGreaterThanOrEqual(4);
    await expect(page.locator('.b24-context-menu')).toContainText('Отменить заказ');
  } else {
    await expect(page.locator('[data-b24-more]')).toHaveCount(0);
    await expect(page.locator('.b24-sidepanel__footer > button:visible')).toHaveCount(6);
  }
});

test('стадии на узком экране: текущая крупно, остальные без подписи; бейдж бренда с картинкой', async ({ page }) => {
  await open(page, '/cards.html?card=order');
  await expect(page.locator('.b24-badge--brand .b24-badge__img')).toHaveJSProperty('height', 18);
  if (((await page.locator('.b24-sidepanel').boundingBox())!.width) < 600) {
    const w = await page.locator('.b24-stages__item:not(.is-current)').first().evaluate((e) => e.getBoundingClientRect().width);
    expect(w).toBeLessThanOrEqual(31);
  }
});

test('карточка клиента: контакты колонкой, значки одного размера и выравнивания', async ({ page }) => {
  await open(page, '/cards.html?card=contact');
  const rows = page.locator('.b24-contact-list .b24-contact');
  await expect(rows).toHaveCount(5);
  const boxes = await rows.evaluateAll((els) => els.map((e) => { const b = e.firstElementChild!.getBoundingClientRect(); const v = e.lastElementChild!.getBoundingClientRect(); return { x: Math.round(b.x), w: Math.round(b.width), h: Math.round(b.height), vx: Math.round(v.x) }; }));
  for (const b of boxes) { expect(b.w).toBe(32); expect(b.h).toBe(32); expect(b.x).toBe(boxes[0].x); expect(b.vx).toBe(boxes[0].vx); }
});

test('карточка заказа: полоска этапов — цвет текущего, наведение перекрашивает до этапа', async ({ page }) => {
  await open(page, '/cards.html?card=order');
  const stages = page.locator('.b24-stages').first();
  await expect(stages).toHaveAttribute('data-b24-stages', '');
  const items = stages.locator('.b24-stages__item');
  const lit = () => items.evaluateAll((els) => els.map((e) => (e.classList.contains('is-lit') ? getComputedStyle(e).backgroundColor : '')));
  // у фона есть transition — ждём, пока цвета устоятся
  await expect.poll(async () => new Set((await lit()).filter(Boolean)).size).toBe(1);
  const base = await lit();
  expect(base.filter(Boolean).length).toBeGreaterThan(0);
  // наведение на первый этап: окрашен только он, цвет — его собственный
  await items.first().hover();
  await expect.poll(async () => (await lit()).filter(Boolean).length).toBe(1);
  await page.mouse.move(2, 2);
  await expect.poll(async () => (await lit()).filter(Boolean).length).toBe(base.filter(Boolean).length);
});

test('карточка: колонки прокручиваются независимо, на узком экране — без своей прокрутки', async ({ page }) => {
  await open(page, '/cards.html?card=order');
  const wide = (page.viewportSize()?.width ?? 1280) > 860;
  const side = page.locator('.b24-entity__side').first();
  const oy = await side.evaluate((e) => getComputedStyle(e).overflowY);
  expect(oy).toBe(wide ? 'auto' : 'visible');
  if (wide) {
    expect(await side.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
    const before = await page.locator('.b24-entity__main').first().evaluate((e) => e.scrollTop);
    await side.evaluate((e) => { e.scrollTop = 200; });
    expect(await page.locator('.b24-entity__main').first().evaluate((e) => e.scrollTop)).toBe(before);
  }
});

import { test, expect, type Page } from '@playwright/test';
import { open, isMobile, noHorizontalScroll } from './helpers';

const ev = (page: Page, id: string) => page.locator(`.b24-scheduler__event[data-event="${id}"]`);
const model = (page: Page, id: string) => page.evaluate((id) => {
  const e = (window as unknown as { scheduler: { getEvents(): Array<{ id: string; resourceId: string; start: Date; end: Date }> } }).scheduler.getEvents().find((x) => x.id === id)!;
  return { resourceId: e.resourceId, start: new Date(e.start).getTime(), end: new Date(e.end).getTime() };
}, id);

test('scheduler.html: без ошибок и горизонтальной прокрутки страницы', async ({ page }) => {
  const { errors } = await open(page, '/scheduler.html');
  await page.waitForLoadState('networkidle');
  await noHorizontalScroll(page);
  expect(errors()).toEqual([]);
});

test.describe('планировщик', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(isMobile(page), 'перетаскивание — на десктопе');
    await open(page, '/scheduler.html');
    await expect(page.locator('.b24-scheduler__row').first()).toBeVisible();
  });

  test('группы, график, конфликты, вне рабочего времени, виртуализация', async ({ page }) => {
    await expect(page.locator('.b24-scheduler__group-head')).toHaveCount(3);
    await expect(ev(page, 'e-overlap-a')).toHaveClass(/is-conflict/);
    await expect(ev(page, 'e-overlap-b')).toHaveClass(/is-conflict/);
    await expect(page.locator('.b24-scheduler__band--vacation').first()).toBeAttached();
    // строк в DOM меньше, чем сотрудников: рисуются только видимые
    const rendered = await page.locator('.b24-scheduler__row').count();
    expect(rendered).toBeLessThan(24);
    await page.locator('.b24-scheduler__viewport').evaluate((v) => { v.scrollTop = v.scrollHeight; });
    await expect(page.locator('.b24-scheduler__row', { hasText: 'Нелли Аксёнова' })).toBeVisible();
    await expect(ev(page, 'e-late')).toHaveClass(/is-outside/);
  });

  test('сворачивание отдела', async ({ page }) => {
    const head = page.locator('.b24-scheduler__group-head', { hasText: 'Отдел продаж' });
    await head.click();
    await expect(page.locator('.b24-scheduler__group-head', { hasText: 'Отдел продаж' })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.b24-scheduler__row', { hasText: 'Алиса Мельникова' })).toHaveCount(0);
  });

  test('переключение вида и навигация', async ({ page }) => {
    const sch = page.locator('.b24-scheduler');
    await sch.locator('.b24-segmented label', { hasText: 'День' }).click();
    await expect(sch).toHaveAttribute('data-view', 'day');
    const t1 = await sch.locator('.b24-scheduler__title').textContent();
    await sch.getByRole('button', { name: 'Вперёд' }).click();
    await expect(sch.locator('.b24-scheduler__title')).not.toHaveText(t1!);
    await sch.getByRole('button', { name: 'Сегодня' }).click();
    await expect(sch.locator('.b24-scheduler__title')).toHaveText(t1!);
    await sch.locator('.b24-segmented label', { hasText: 'Месяц' }).click();
    await expect(sch).toHaveAttribute('data-view', 'month');
  });

  test('клавиатура: сдвиг на шаг и удаление', async ({ page }) => {
    const before = await model(page, 'e-overlap-b');
    await ev(page, 'e-overlap-b').focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(page.locator('.b24-toast').last()).toContainText('перенесена');
    const after = await model(page, 'e-overlap-b');
    expect(after.start - before.start).toBe(15 * 60_000);
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await expect.poll(async () => (await model(page, 'e-overlap-b')).end - after.end).toBe(15 * 60_000);
    await ev(page, 'e-overlap-b').focus();
    await page.keyboard.press('Delete');
    await page.locator('.b24-modal:visible').getByRole('button', { name: 'Удалить' }).click();
    await expect(ev(page, 'e-overlap-b')).toHaveCount(0);
  });

  test('перетаскивание на другого сотрудника и откат при отказе сервера', async ({ page }) => {
    const card = ev(page, 'e-overlap-b');
    await card.scrollIntoViewIfNeeded();
    const box = (await card.boundingBox())!;
    const target = page.locator('.b24-scheduler__row[data-resource="u01"] .b24-scheduler__track');
    const tb = (await target.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 20, { steps: 3 });
    await page.mouse.move(box.x + box.width / 2, tb.y + tb.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await model(page, 'e-overlap-b')).resourceId).toBe('u01');
    await expect(page.locator('.b24-toast').last()).toContainText('перенесена');

    // Полина (u03) в отпуске со вторника — «сервер» отказывает, встреча возвращается к Алисе
    const card2 = ev(page, 'e-overlap-b');
    await card2.scrollIntoViewIfNeeded();
    const b2 = (await card2.boundingBox())!;
    const t2 = (await page.locator('.b24-scheduler__row[data-resource="u03"] .b24-scheduler__track').boundingBox())!;
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
    await page.mouse.down();
    await page.mouse.move(b2.x + b2.width / 2, b2.y + 20, { steps: 3 });
    await page.mouse.move(b2.x + b2.width / 2, t2.y + t2.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('.b24-toast', { hasText: 'не перенесена' })).toBeVisible();
    await expect.poll(async () => (await model(page, 'e-overlap-b')).resourceId).toBe('u01');
  });

  test('растягивание за край и клик открывает карточку', async ({ page }) => {
    const before = await model(page, 'e-overlap-a');
    const card = ev(page, 'e-overlap-a');
    await card.scrollIntoViewIfNeeded();
    const handle = card.locator('.b24-scheduler__handle--end');
    const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 60, hb.y + hb.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await model(page, 'e-overlap-a')).end).toBeGreaterThan(before.end);
    expect((await model(page, 'e-overlap-a')).start).toBe(before.start);

    await ev(page, 'e-all-hands').scrollIntoViewIfNeeded();
    await ev(page, 'e-all-hands').click();
    await expect(page.locator('.b24-sidepanel:visible')).toContainText('Общее собрание');
  });

  test('создание выделением пустого места', async ({ page }) => {
    const sch = page.locator('.b24-scheduler');
    await sch.locator('.b24-segmented label', { hasText: 'День' }).click();
    const track = page.locator('.b24-scheduler__row[data-resource="u06"] .b24-scheduler__track');
    const tb = (await track.boundingBox())!;
    const vp = (await page.locator('.b24-scheduler__viewport').boundingBox())!;
    const y = tb.y + tb.height / 2;
    const x0 = Math.max(tb.x, vp.x + 300);
    await page.mouse.move(x0, y);
    await page.mouse.down();
    await page.mouse.move(x0 + 120, y, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('.b24-scheduler__row[data-resource="u06"] .b24-scheduler__event', { hasText: 'Новая встреча' })).toHaveCount(1);
  });
});

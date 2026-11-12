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
    await card.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
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
    await card2.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
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
    await card.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
    const handle = card.locator('.b24-scheduler__handle--end');
    const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + 60, hb.y + hb.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await model(page, 'e-overlap-a')).end).toBeGreaterThan(before.end);
    expect((await model(page, 'e-overlap-a')).start).toBe(before.start);

    await ev(page, 'e-all-hands').evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
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
    // встречи демо зависят от сегодняшней даты — ищем в строке свободный промежуток шириной 140px
    const busy = await page.locator('.b24-scheduler__row[data-resource="u06"] .b24-scheduler__event').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right]; }));
    let x0 = Math.max(tb.x, vp.x + 260) + 10;
    while (busy.some(([a, b]) => x0 < b + 4 && x0 + 140 > a - 4) && x0 < vp.x + vp.width - 150) x0 += 20;
    await page.mouse.move(x0, y);
    await page.mouse.down();
    await page.mouse.move(x0 + 120, y, { steps: 8 });
    await page.mouse.up();
    // выделение открывает окно новой встречи
    const dlg = page.locator('.b24-modal:visible');
    await expect(dlg).toContainText('Новая встреча');
    await dlg.getByLabel('Название').fill('Встреча с «Альфой»');
    await dlg.getByRole('button', { name: 'Сохранить' }).click();
    await expect(dlg).toBeHidden();
    await expect(page.locator('.b24-scheduler__row[data-resource="u06"] .b24-scheduler__event', { hasText: 'Встреча с «Альфой»' })).toHaveCount(1);
  });

  test('окно редактирования: проверка полей, отказ сервера, сохранение типа, комментария и своего поля', async ({ page }) => {
    const card = ev(page, 'e-overlap-b');
    await card.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
    await card.click();
    const dlg = page.locator('.b24-modal:visible');
    await expect(dlg).toContainText('Изменить встречу');
    await expect(dlg.getByLabel('Название')).toHaveValue('Демо для «Луча»');
    // пустое название — ошибка у поля, окно не закрывается
    await dlg.getByLabel('Название').fill('');
    await dlg.getByRole('button', { name: 'Сохранить' }).click();
    await expect(dlg.locator('.b24-field__error:visible')).toContainText('Укажите название');
    // на сотрудника в отпуске «сервер» отказывает — ошибка в окне
    await dlg.getByLabel('Название').fill('Демо для «Луча», финал');
    await dlg.getByLabel('Сотрудник').selectOption('u03');
    await dlg.getByRole('button', { name: 'Сохранить' }).click();
    await expect(dlg.locator('.b24-alert')).toContainText('отсутствует');
    await dlg.getByLabel('Сотрудник').selectOption('u00');
    await dlg.getByLabel('Тип').selectOption('training');
    await dlg.getByLabel('Место').selectOption('online');
    await dlg.getByLabel('Комментарий').fill('Показать отчёты');
    await dlg.getByRole('button', { name: 'Сохранить' }).click();
    await expect(dlg).toBeHidden();
    const saved = await page.evaluate(() => (window as unknown as { scheduler: { getEvents(): Array<Record<string, unknown>> } }).scheduler.getEvents().find((x) => x.id === 'e-overlap-b')!);
    expect(saved).toMatchObject({ title: 'Демо для «Луча», финал', type: 'training', comment: 'Показать отчёты', data: { place: 'online' }, resourceId: 'u00' });
    await expect(ev(page, 'e-overlap-b').locator('.b24-scheduler__event-title svg')).toHaveCount(1); // значок комментария
  });

  test('контекстное меню: тип, дублировать, копировать и вставить, Alt — копия переносом', async ({ page }) => {
    const card = ev(page, 'e-overlap-a');
    await card.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
    const count = () => page.evaluate(() => (window as unknown as { scheduler: { getEvents(): unknown[] } }).scheduler.getEvents().length);
    const n0 = await count();
    await card.click({ button: 'right' });
    const menu = page.locator('.b24-scheduler-menu:visible');
    await expect(menu.getByRole('menuitemradio', { name: 'Встреча' })).toHaveAttribute('aria-checked', 'true');
    await menu.getByRole('menuitemradio', { name: 'Важное' }).click();
    await expect.poll(async () => (await page.evaluate(() => (window as unknown as { scheduler: { getEvents(): Array<{ id: string; type?: string }> } }).scheduler.getEvents().find((x) => x.id === 'e-overlap-a')!.type))).toBe('urgent');

    await ev(page, 'e-overlap-a').click({ button: 'right' });
    await page.locator('.b24-scheduler-menu:visible').getByRole('menuitem', { name: 'Дублировать' }).click();
    await expect.poll(count).toBe(n0 + 1);

    // Ctrl/⌘+C на встрече, Ctrl/⌘+V — копия на место под курсором
    await ev(page, 'e-overlap-a').focus();
    await page.keyboard.press('ControlOrMeta+c');
    const target = page.locator('.b24-scheduler__row[data-resource="u05"] .b24-scheduler__track');
    const tb = (await target.boundingBox())!;
    const vp = (await page.locator('.b24-scheduler__viewport').boundingBox())!;
    await page.mouse.move(Math.max(tb.x, vp.x + 260) + 20, tb.y + tb.height / 2); // правее закреплённой колонки сотрудников
    await page.keyboard.press('ControlOrMeta+v');
    await expect.poll(count).toBe(n0 + 2);
    expect(await page.evaluate(() => (window as unknown as { scheduler: { getEvents(): Array<{ resourceId: string; title: string }> } }).scheduler.getEvents().filter((x) => x.resourceId === 'u05' && x.title === 'Переговоры «Ромашка»').length)).toBe(1);

    // Alt + перетаскивание — копия, оригинал на месте
    const c2 = ev(page, 'e-overlap-a');
    await c2.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
    const before = await model(page, 'e-overlap-a');
    const b = (await c2.boundingBox())!;
    await page.keyboard.down('Alt');
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2, { steps: 6 });
    // едет «тень», оригинал стоит на месте
    await expect(page.locator('.b24-scheduler__event.is-copy')).toHaveCount(1);
    const still = (await c2.boundingBox())!;
    expect(Math.abs(still.x - b.x)).toBeLessThan(1);
    await page.mouse.up();
    await expect(page.locator('.b24-scheduler__event.is-copy')).toHaveCount(0);
    await page.keyboard.up('Alt');
    await expect.poll(count).toBe(n0 + 3);
    expect(await model(page, 'e-overlap-a')).toEqual(before);
  });

  test('масштаб кнопками: «−» добавляет часы до 0–24, «+» — деления :30/:15, «По размеру» — окно hours', async ({ page }) => {
    const sch = page.locator('.b24-scheduler');
    await sch.locator('.b24-segmented label', { hasText: 'День' }).click();
    const w = () => page.locator('.b24-scheduler__scale').evaluate((el) => el.getBoundingClientRect().width);
    const hours = () => page.locator('.b24-scheduler__tick--bottom:not(.is-sub)').allTextContents();
    const subs = () => page.locator('.b24-scheduler__tick.is-sub').allTextContents();
    const minus = sch.getByRole('button', { name: 'Уменьшить масштаб' });
    const plus = sch.getByRole('button', { name: 'Увеличить масштаб' });
    const fitBtn = sch.getByRole('button', { name: 'По размеру' });
    const area = await page.locator('.b24-scheduler__viewport').evaluate((v) => v.clientWidth - (parseFloat(getComputedStyle(v.closest('.b24-scheduler')!).getPropertyValue('--_res-w')) || 240));

    // «По размеру» — окно 8–20 ровно на ширину области
    await fitBtn.click();
    expect(Math.abs((await w()) - area)).toBeLessThan(3);
    expect((await hours())[0]).toBe('08:00');
    await expect(minus).toBeEnabled();

    // «−» дальше: ширина та же, часов больше — до суток 0–24, только часовые деления
    await minus.click();
    expect(Math.abs((await w()) - area)).toBeLessThan(3);
    expect((await hours()).length).toBeGreaterThan(12);
    for (let i = 0; i < 12 && (await minus.isEnabled()); i++) await minus.click();
    await expect(minus).toBeDisabled();
    const all = await hours();
    expect(all[0]).toBe('00:00');
    expect(all).toHaveLength(24);
    expect(await subs()).toEqual([]);

    // «+» до упора: окно сужается обратно, потом шкала шире области и появляются :15/:30/:45
    for (let i = 0; i < 20 && (await plus.isEnabled()); i++) await plus.click();
    await expect(plus).toBeDisabled();
    expect(await w()).toBeGreaterThan(area * 1.4);
    expect((await hours())[0]).toBe('08:00');
    const fine = await subs();
    expect(fine).toContain(':15');
    expect(fine).toContain(':30');
    expect(fine).toContain(':45');

    await fitBtn.click();
    expect(Math.abs((await w()) - area)).toBeLessThan(3);
    expect((await hours())[0]).toBe('08:00');
  });
});

test('планировщик: 24:00, событие без времени, выделение в пределах дня, initialScroll', async ({ page }) => {
  test.skip(isMobile(page), 'перетаскивание — на десктопе');
  const { errors } = await open(page, '/scheduler.html');
  const out = await page.evaluate(async () => {
    const { createScheduler } = (window as unknown as { B24UI: typeof import('../src/js/index') }).B24UI;
    const host = document.createElement('div');
    host.id = 'sch2';
    host.style.width = '900px';
    document.querySelector('.b24-scheduler')!.before(host);
    const w = window as unknown as { created: Array<{ start: string; end: string }> };
    w.created = [];
    createScheduler(host, {
      view: 'week', date: '2026-10-07', hours: [0, 24], initialScroll: 'start', createWithinDay: true, toolbar: false, legend: false,
      resources: [{ id: 'a', name: 'Алиса' }],
      bands: [{ resourceId: 'a', start: '2026-10-05T09:00', end: '2026-10-05T18:00', kind: 'work' }, { resourceId: 'a', start: '2026-10-06T00:00', end: '2026-10-07T00:00', kind: 'off' }],
      events: [
        { id: 'late', resourceId: 'a', start: '2026-10-05T17:00', end: '2026-10-06T00:00', title: 'Смена' },
        { id: 'off', resourceId: 'a', start: '2026-10-06T10:00', end: '2026-10-07T00:00', title: 'Выходной', allDay: true },
      ],
      onCreate: (d) => { w.created.push({ start: d.start.toString(), end: d.end.toString() }); },
    });
    await new Promise((r) => setTimeout(r, 50));
    const q = (id: string) => host.querySelector<HTMLElement>(`[data-event="${id}"]`)!;
    return {
      lateTime: q('late').querySelector('.b24-scheduler__event-time')?.textContent ?? '',
      offNoTime: q('off').querySelector('.b24-scheduler__event-time') === null,
      offLabel: q('off').getAttribute('aria-label'),
      offFlagged: q('off').classList.contains('is-conflict') || q('off').classList.contains('is-outside'),
      scrollLeft: host.querySelector<HTMLElement>('.b24-scheduler__viewport')!.scrollLeft,
    };
  });
  expect(out).toEqual({ lateTime: '17:00–24:00', offNoTime: true, offLabel: 'Выходной', offFlagged: false, scrollLeft: 0 });

  // выделение со среды 22:00 на полдня вправо — обрезается полуночью
  const track = page.locator('#sch2 .b24-scheduler__track');
  const dayPx = (await track.evaluate((t) => t.getBoundingClientRect().width)) / 7;
  await page.locator('#sch2 .b24-scheduler__viewport').evaluate((v, left) => { v.scrollLeft = left; }, dayPx * 2.5);
  const tb = (await track.boundingBox())!;
  const x0 = tb.x + dayPx * (2 + 22 / 24);
  await page.mouse.move(x0, tb.y + tb.height / 2);
  await page.mouse.down();
  await page.mouse.move(x0 + dayPx * 0.5, tb.y + tb.height / 2, { steps: 8 });
  await page.mouse.up();
  const created = await page.evaluate(() => (window as unknown as { created: Array<{ start: string; end: string }> }).created);
  expect(created).toHaveLength(1);
  const end = new Date(created[0].end);
  expect([end.getDate(), end.getHours(), end.getMinutes()]).toEqual([8, 0, 0]);
  expect(new Date(created[0].start).getDate()).toBe(7);
  expect(errors()).toEqual([]);
});

test('легенда: пункты графика — только виды из bands; legend: \'types\' — только типы', async ({ page }) => {
  await open(page, '/scheduler.html');
  const res = await page.evaluate(async () => {
    const { createScheduler } = (window as unknown as { B24UI: typeof import('../src/js/index') }).B24UI;
    const mk = (opts: Record<string, unknown>) => {
      const host = document.createElement('div');
      document.body.append(host);
      const s = createScheduler(host, { resources: [{ id: 'a', name: 'Алиса' }], toolbar: false, ...opts } as Parameters<typeof createScheduler>[1]);
      const labels = [...host.querySelectorAll('.b24-scheduler__legend > span')].map((x) => x.textContent);
      return { s, host, labels };
    };
    const types = [{ id: 'shift', label: 'Смена' }, { id: 'vac', label: 'Отпуск', allDay: true }];
    const noBands = mk({ eventTypes: types });
    const onlyTypes = mk({ eventTypes: types, legend: 'types', bands: [{ resourceId: 'a', start: '2026-10-05T09:00', end: '2026-10-05T18:00', kind: 'work' }] });
    const withBands = mk({ bands: [{ resourceId: 'a', start: '2026-10-05T09:00', end: '2026-10-05T18:00', kind: 'work' }, { resourceId: 'a', start: '2026-10-06', end: '2026-10-07', kind: 'sick' }] });
    // bands пришли позже — легенда обновилась
    noBands.s.setBands([{ resourceId: 'a', start: '2026-10-06', end: '2026-10-07', kind: 'trip' }]);
    const later = [...noBands.host.querySelectorAll('.b24-scheduler__legend > span')].map((x) => x.textContent);
    [noBands, onlyTypes, withBands].forEach((x) => { x.s.destroy(); x.host.remove(); });
    return { noBands: noBands.labels, onlyTypes: onlyTypes.labels, withBands: withBands.labels, later };
  });
  expect(res.noBands).toEqual(['Смена', 'Отпуск', 'Пересечение']);
  expect(res.onlyTypes).toEqual(['Смена', 'Отпуск']);
  expect(res.withBands).toEqual(['Встреча', 'Рабочее время', 'Нерабочее время', 'Больничный', 'Пересечение']);
  expect(res.later).toEqual(['Смена', 'Отпуск', 'Командировка', 'Пересечение']);
});

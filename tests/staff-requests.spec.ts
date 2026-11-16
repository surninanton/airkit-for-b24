import { test, expect } from '@playwright/test';
import { open } from './helpers';

type Api = typeof import('../src/js/index');
type W = Window & { B24UI: Api; sch: ReturnType<Api['createScheduler']>; __r: unknown };

/** Свой планировщик на пустом месте demo/index.html */
async function makeScheduler(page: import('@playwright/test').Page, extra: Record<string, unknown> = {}) {
  await open(page, '/index.html');
  await page.evaluate((extra) => {
    const w = window as unknown as W;
    const host = document.createElement('div');
    host.id = 'sch-host';
    document.body.prepend(host);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const at = (d: number, h: number) => new Date(today.getTime() + d * 86400000 + h * 3600000);
    w.sch = w.B24UI.createScheduler(host, {
      resources: [
        { id: 'a', name: 'Иван Примеров', online: true },
        { id: 'b', name: 'Мария Образцова', status: 'away' },
        { id: 'c', name: 'Пётр Тестов', lastSeen: new Date(Date.now() - 5 * 60000) },
      ],
      events: [
        { id: 'wish', resourceId: 'a', start: at(0, 10), end: at(0, 14), title: 'Хочу утро', variant: 'dashed', className: 'my-wish', readonly: true },
        { id: 'w2', resourceId: 'b', start: at(0, 10), end: at(0, 12), title: 'Смена' },
      ],
      bands: [
        { resourceId: 'b', start: at(0, 9), end: at(0, 18), kind: 'wish', label: 'Пожелание', color: '#9dcf00' },
        { resourceId: 'b', start: at(0, 0), end: at(1, 0), kind: 'work' },
      ],
      view: 'week', height: 300,
      ...extra,
    } as never);
  }, extra);
}

test('планировщик: статус у аватара, свои bands с подписью, класс и вид события', async ({ page }) => {
  await makeScheduler(page);
  const host = page.locator('#sch-host');
  await expect(host.locator('[data-resource="a"] .b24-avatar__status')).toHaveCount(1);
  await expect(host.locator('[data-resource="a"] .b24-avatar')).toHaveAttribute('title', 'В сети');
  await expect(host.locator('[data-resource="b"] .b24-avatar__status.is-away')).toHaveCount(1);
  await expect(host.locator('[data-resource="c"] .b24-avatar__status')).toHaveCount(0);
  await expect(host.locator('[data-resource="c"] .b24-avatar')).toHaveAttribute('title', 'Был(а) в сети 5 мин назад');
  const band = host.locator('.b24-scheduler__band--custom.b24-scheduler__band--wish');
  await expect(band).toHaveAttribute('title', 'Пожелание');
  await expect(host.locator('.b24-scheduler__legend')).toContainText('Пожелание');
  // свой вид — не «отсутствие»: встреча поверх не конфликт
  await expect(host.locator('[data-event="w2"]')).not.toHaveClass(/is-conflict/);
  await expect(host.locator('[data-event="wish"]')).toHaveClass(/is-dashed/);
  await expect(host.locator('[data-event="wish"]')).toHaveClass(/my-wish/);
  // статус переживает виртуализацию/перерисовку
  await page.evaluate(() => (window as unknown as W).sch.setEvents([]));
  await expect(host.locator('[data-resource="a"] .b24-avatar__status')).toHaveCount(1);
});

test('планировщик: setDays / setRange без пересоздания, initialScroll center, scrollToDate', async ({ page }) => {
  await makeScheduler(page, { initialScroll: 'center', view: 'days', days: 14 });
  const host = page.locator('#sch-host');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const centerOfToday = () => page.evaluate(() => {
    const vp = document.querySelector<HTMLElement>('#sch-host .b24-scheduler__viewport')!;
    const resW = parseFloat(getComputedStyle(document.querySelector('#sch-host .b24-scheduler')!).getPropertyValue('--_res-w'));
    const w = document.querySelector<HTMLElement>('#sch-host .b24-scheduler__scale')!.scrollWidth;
    const dayW = w / (window as unknown as W).sch.days;
    // сегодня — первый день периода: середина дня в центре видимой части (если есть куда прокрутить)
    return { scroll: vp.scrollLeft, want: Math.max(0, dayW / 2 - (vp.clientWidth - resW) / 2), max: vp.scrollWidth - vp.clientWidth };
  });
  let c = await centerOfToday();
  expect(Math.abs(c.scroll - c.want)).toBeLessThan(2);
  const el = await host.locator('.b24-scheduler').elementHandle();
  await page.evaluate(() => { const w = window as unknown as W; const s = new Date(); s.setDate(s.getDate() - 3); w.sch.setRange(s, 10); });
  expect(await page.evaluate(() => (window as unknown as W).sch.days)).toBe(10);
  await expect(host.locator('.b24-segmented label', { hasText: '10 дн.' })).toHaveCount(1);
  expect(await el!.evaluate((n) => n.isConnected)).toBe(true); // тот же элемент — не пересоздан
  c = await centerOfToday();
  // сегодня теперь 4-й день: его середина по центру
  const ok = await page.evaluate(() => {
    const w = window as unknown as W;
    const vp = document.querySelector<HTMLElement>('#sch-host .b24-scheduler__viewport')!;
    const before = vp.scrollLeft;
    w.sch.scrollToDate(new Date(), 'center');
    return Math.abs(vp.scrollLeft - before) < 2;
  });
  expect(ok).toBe(true);
  await page.evaluate(() => (window as unknown as W).sch.setView('week'));
  await page.evaluate(() => (window as unknown as W).sch.setDays(3));
  await expect(host.locator('.b24-scheduler')).toHaveAttribute('data-view', 'days');
  await expect(host.locator('.b24-segmented label', { hasText: '3 дн.' })).toHaveCount(1);
});

test('фильтр: числа у пресетов и вариантов, setCounts', async ({ page }) => {
  await open(page, '/index.html');
  await page.evaluate(() => {
    const w = window as unknown as W & { f: ReturnType<Api['createFilter']> };
    const host = document.createElement('div');
    host.id = 'f-host';
    document.body.prepend(host);
    w.f = w.B24UI.createFilter(host, {
      fields: [
        { id: 'stage', label: 'Стадия', type: 'multiselect', options: [{ value: 'hired', label: 'Нанят', count: 68 }, { value: 'new', label: 'Новый' }] },
        { id: 'src', label: 'Источник', type: 'select', options: [{ value: 'hh', label: 'hh.ru', count: 1200 }] },
      ],
      presets: [{ id: 'hired', name: 'Нанятые', values: { stage: ['hired'] }, system: true, count: 68 }],
    });
    w.f.open();
  });
  const popup = page.locator('.b24-filter-popup');
  await expect(popup.locator('.b24-filter-popup__preset', { hasText: 'Нанятые' }).locator('.b24-filter-popup__count')).toHaveText('68');
  await expect(popup.locator('.b24-check', { hasText: 'Нанят' }).locator('.b24-filter-popup__count')).toHaveText('68');
  await expect(popup.locator('option', { hasText: 'hh.ru' })).toHaveText(/hh\.ru \(1\s200\)/);
  await page.evaluate(() => (window as unknown as { f: ReturnType<Api['createFilter']> }).f.setCounts({ presets: { hired: 70 }, fields: { stage: { new: 3 } } }));
  await expect(popup.locator('.b24-filter-popup__preset', { hasText: 'Нанятые' }).locator('.b24-filter-popup__count')).toHaveText('70');
  await expect(popup.locator('.b24-check', { hasText: 'Новый' }).locator('.b24-filter-popup__count')).toHaveText('3');
});

test('экран блокировки: confirm из onOtherUser — поверх экрана и получает клавиши', async ({ page }) => {
  await open(page, '/index.html');
  await page.evaluate(() => {
    const w = window as unknown as W;
    w.__r = 'pending';
    const lock = w.B24UI.createLockScreen({
      users: [{ id: '1', name: 'Иван Примеров' }],
      onSubmit: () => true,
      onOtherUser: async () => { w.__r = await w.B24UI.confirm('Выйти из профиля?'); if (w.__r) lock.close(); },
    });
  });
  await page.locator('.b24-lock__other').click();
  const dialog = page.locator('.b24-overlay [role="dialog"]');
  await expect(dialog).toBeVisible();
  const z = await page.evaluate(() => {
    const lock = document.querySelector('.b24-lock')!;
    const overlay = document.querySelector<HTMLElement>('.b24-overlay')!;
    return { lock: +getComputedStyle(lock).zIndex, modal: +getComputedStyle(overlay).zIndex };
  });
  expect(z.modal).toBeGreaterThan(z.lock);
  // цифры не уходят в код экрана, Esc закрывает окно, а не экран
  await page.keyboard.press('1');
  await expect(page.locator('.b24-lock__dots > i.is-on')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as W).__r)).toBe(false);
  await expect(page.locator('.b24-lock')).toBeVisible();
  await page.locator('.b24-lock__other').click();
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.locator('.b24-lock')).toHaveCount(0);
});

test('аватар: точка статуса не обрезается, avatarHtml со статусом', async ({ page }) => {
  await open(page, '/index.html');
  const res = await page.evaluate(() => {
    const B24UI = (window as unknown as W).B24UI;
    const host = document.createElement('div');
    host.style.padding = '20px';
    const img = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>');
    host.innerHTML = B24UI.avatarHtml('Иван Примеров', img, 'sm', { status: 'online', title: 'В сети' }) + B24UI.avatarHtml('Мария Образцова', undefined, 'md', { status: 'away' });
    document.body.prepend(host);
    return Array.from(host.querySelectorAll<HTMLElement>('.b24-avatar')).map((a) => {
      const dot = a.querySelector('.b24-avatar__status')!;
      const imgEl = a.querySelector('img');
      return {
        overflow: getComputedStyle(a).overflow,
        dot: !!dot, away: dot.classList.contains('is-away'),
        imgRadius: imgEl ? getComputedStyle(imgEl).borderRadius : null,
        title: a.title,
      };
    });
  });
  expect(res[0]).toEqual({ overflow: 'visible', dot: true, away: false, imgRadius: '50%', title: 'В сети' });
  expect(res[1]).toMatchObject({ overflow: 'visible', dot: true, away: true });
});

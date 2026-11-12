import { test, expect } from '@playwright/test';
import { open } from './helpers';

type Api = typeof import('../src/js/index');

test('канбан: длинная колонка прокручивает список, шапка и карточки не сжимаются', async ({ page }) => {
  await open(page, '/index.html');
  const res = await page.evaluate(() => {
    const B24UI = (window as unknown as { B24UI: Api }).B24UI;
    const host = document.createElement('div');
    host.className = 'b24-kanban';
    host.style.height = '400px';
    host.style.setProperty('--b24-kanban-column-width', '180px');
    const cards = Array.from({ length: 60 }, (_, i) => `<div class="b24-kanban-card" data-id="c${i}"><span class="b24-kanban-card__title">Отклик ${i}</span><span>Иван Примеров</span></div>`).join('');
    host.innerHTML = `
      <section class="b24-kanban__column" data-column="a" data-color="#2067b0">
        <header class="b24-kanban__header"><span class="b24-kanban__title">Отклик</span><span class="b24-kanban__count">60</span></header>
        <div class="b24-kanban__total"><span>60</span></div>
        <button class="b24-kanban__add b24-kanban__add--round" aria-label="+">+</button>
        <div class="b24-kanban__items">${cards}</div>
      </section>
      <section class="b24-kanban__column" data-column="b" data-color="#ffe86b">
        <header class="b24-kanban__header"><span class="b24-kanban__title">Резерв</span></header>
        <button class="b24-kanban__add b24-kanban__add--round" aria-label="+">+</button>
        <div class="b24-kanban__items"></div>
      </section>`;
    document.querySelector('main, body')!.prepend(host);
    // ручной рендер без data-b24-kanban: enableKanbanDnd красит колонки, повторный вызов — та же функция отключения
    const off1 = B24UI.enableKanbanDnd(host);
    const off2 = B24UI.enableKanbanDnd(host, { onMove: () => undefined });
    const header = host.querySelector<HTMLElement>('.b24-kanban__header')!;
    const items = host.querySelector<HTMLElement>('.b24-kanban__items')!;
    const card = host.querySelector<HTMLElement>('.b24-kanban-card')!;
    const add = host.querySelector<HTMLElement>('.b24-kanban__add--round')!;
    const out = {
      same: off1 === off2,
      headerH: header.getBoundingClientRect().height,
      addH: add.getBoundingClientRect().height,
      cardH: card.getBoundingClientRect().height,
      cardScroll: card.scrollHeight,
      scrolls: items.scrollHeight > items.clientHeight,
      columnH: host.querySelector<HTMLElement>('.b24-kanban__column')!.getBoundingClientRect().height,
      text: getComputedStyle(header).color,
      text2: getComputedStyle(host.querySelectorAll<HTMLElement>('.b24-kanban__header')[1]).color,
    };
    off1();
    const off3 = B24UI.enableKanbanDnd(host);
    out.same = out.same && off3 !== off1;
    off3();
    host.remove();
    return out;
  });
  expect(res.same).toBe(true);
  expect(res.headerH).toBe(32);
  expect(res.addH).toBe(30);
  expect(res.cardH).toBeGreaterThanOrEqual(res.cardScroll - 1);
  expect(res.scrolls).toBe(true);
  expect(res.columnH).toBeLessThanOrEqual(400);
  expect(res.text).toBe('rgb(255, 255, 255)'); // тёмный цвет колонки — белый текст
  expect(res.text2).toBe('rgb(31, 35, 41)');   // пастельный — тёмный
});

test('канбан: DnD не навешивается дважды (data-b24-kanban + ручной вызов)', async ({ page }) => {
  await open(page, '/index.html');
  const board = page.locator('#demo-kanban');
  await board.scrollIntoViewIfNeeded();
  const moves = await page.evaluate(() => {
    const B24UI = (window as unknown as { B24UI: Api }).B24UI;
    const el = document.getElementById('demo-kanban')!;
    (window as unknown as { __moves: number }).__moves = 0;
    B24UI.enableKanbanDnd(el, { onMove: () => { (window as unknown as { __moves: number }).__moves++; } });
    B24UI.init();
    return 0;
  });
  expect(moves).toBe(0);
  const card = board.locator('.b24-kanban-card[data-id="3"]');
  await card.scrollIntoViewIfNeeded();
  await card.focus();
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(board.locator('[data-column="new"] .b24-kanban-card[data-id="3"]')).toHaveCount(1);
  expect(await page.evaluate(() => (window as unknown as { __moves: number }).__moves)).toBe(1);
});

test('канбан: быстрое добавление — форма в узкой колонке, Enter сохраняет, Esc закрывает', async ({ page }) => {
  const { errors } = await open(page, '/index.html');
  const board = page.locator('#demo-kanban');
  await page.evaluate(() => document.getElementById('demo-kanban')!.style.setProperty('--b24-kanban-column-width', '160px'));
  const col = board.locator('[data-column="won"]');
  const before = await col.locator('.b24-kanban-card').count();
  const add = col.locator('.b24-kanban__add');
  await add.scrollIntoViewIfNeeded();
  await add.click();
  const form = col.locator('.b24-kanban__quick');
  await expect(form).toBeVisible();
  await expect(add).toHaveAttribute('aria-expanded', 'true');
  // поля и кнопки не вылезают за колонку
  const fit = await col.evaluate((c) => {
    const r = c.querySelector('.b24-kanban__quick')!.getBoundingClientRect();
    return Array.from(c.querySelectorAll('.b24-kanban__quick input, .b24-kanban__quick button')).every((el) => {
      const b = el.getBoundingClientRect();
      return b.left >= r.left - 0.5 && b.right <= r.right + 0.5;
    });
  });
  expect(fit).toBe(true);
  await expect(form.locator('input[name="title"]')).toBeFocused();
  await page.keyboard.press('Enter'); // пустое обязательное — не сохраняет
  await expect(col.locator('.b24-kanban-card')).toHaveCount(before);
  await page.keyboard.type('Новый кандидат');
  await page.keyboard.press('Enter');
  await expect(col.locator('.b24-kanban-card')).toHaveCount(before + 1);
  await expect(col.locator('.b24-kanban-card').first()).toContainText('Новый кандидат');
  await expect(form.locator('input[name="title"]')).toHaveValue('');
  await expect(col.locator('.b24-kanban__count')).toHaveText(String(before + 1));
  await page.keyboard.press('Escape');
  await expect(form).toHaveCount(0);
  await expect(add).toHaveAttribute('aria-expanded', 'false');
  expect(errors()).toEqual([]);
});

test('выбор стадии: строка с прокруткой, текущая по центру, цвет текста по фону', async ({ page }) => {
  await open(page, '/index.html');
  const picker = page.locator('#demo-stage-picker');
  await picker.scrollIntoViewIfNeeded();
  await page.evaluate(() => { document.getElementById('demo-stage-picker')!.style.maxWidth = '240px'; });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const center = () => picker.evaluate((row) => {
    const chip = row.querySelector<HTMLElement>('.is-active')!;
    const r = row.getBoundingClientRect(); const c = chip.getBoundingClientRect();
    return { delta: Math.abs((c.left + c.width / 2) - (r.left + r.width / 2)), scroll: row.scrollLeft, max: row.scrollWidth - row.clientWidth, id: chip.dataset.id };
  });
  const a = await center();
  expect(a.id).toBe('work');
  expect(a.max).toBeGreaterThan(0);
  expect(a.delta).toBeLessThan(3);
  await expect(picker).toHaveClass(/is-fade-start/);
  await expect(picker).toHaveClass(/is-fade-end/);
  await expect(picker.locator('[data-id="work"]')).toHaveAttribute('aria-checked', 'true');
  // крайняя стадия прижимается к концу
  await picker.locator('[data-id="lost"]').click({ force: true });
  await expect(page.locator('#demo-stage-value')).toHaveText('Стадия: lost');
  await expect.poll(async () => { const c = await center(); return Math.round(c.max - c.scroll); }).toBeLessThanOrEqual(1);
  await expect(picker).not.toHaveClass(/is-fade-end/);
  // клавиатура: Home — первая
  await picker.locator('[data-id="lost"]').focus();
  await page.keyboard.press('Home');
  await expect(picker.locator('[data-id="new"]')).toHaveAttribute('aria-checked', 'true');
  // цвет текста выбранной: на светлом жёлтом — тёмный
  await picker.locator('[data-id="meet"]').click({ force: true });
  await expect.poll(() => picker.locator('[data-id="meet"]').evaluate((el) => getComputedStyle(el).color)).toBe('rgb(31, 35, 41)');
  expect(await picker.locator('[data-id="offer"]').evaluate((el) => el.style.getPropertyValue('--_t'))).toBe('#1f2329');
  // на насыщенном — белый
  await picker.locator('[data-id="lost"]').click({ force: true });
  await expect.poll(() => picker.locator('[data-id="lost"]').evaluate((el) => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
});

test('боковая панель: сетка со строкой плашек не шире панели', async ({ page }) => {
  await open(page, '/index.html');
  const res = await page.evaluate(async () => {
    const B24UI = (window as unknown as { B24UI: Api }).B24UI;
    const content = document.createElement('div');
    content.className = 'b24-rows';
    const row = document.createElement('div');
    content.append(row, Object.assign(document.createElement('p'), { textContent: 'Текст отклика' }));
    B24UI.stagePicker(row, { stages: Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, title: `Стадия номер ${i}`, color: '#2fc6f6' })), value: 's6' });
    const panel = B24UI.openSidePanel({ title: 'Отклик', content, width: 360 });
    await new Promise((r) => setTimeout(r, 400));
    const body = document.querySelector<HTMLElement>('.b24-sidepanel__body')!;
    const out = { body: body.clientWidth, content: content.getBoundingClientRect().width, overflow: body.scrollWidth - body.clientWidth };
    panel.close();
    return out;
  });
  expect(res.overflow).toBeLessThanOrEqual(0);
  expect(res.content).toBeLessThanOrEqual(res.body);
});

import { test, expect, type Page } from '@playwright/test';
import { open, isMobile } from './helpers';

// Поведение компонентов приложения на demo/index.html (десктоп: грид, канбан и попапы рассчитаны на мышь)
test.beforeEach(async ({ page }) => {
  test.skip(isMobile(page), 'компоненты приложения проверяем на десктопе');
  // чистое состояние грида один раз за тест, а не при каждой перезагрузке
  await page.addInitScript(() => { if (!sessionStorage.getItem('b24-test')) { localStorage.clear(); sessionStorage.setItem('b24-test', '1'); } });
  await open(page, '/index.html');
});

const grid = (page: Page) => page.locator('table[data-b24-grid]');
const ids = (page: Page) => grid(page).locator('tbody tr[data-id]').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.id));

test.describe('грид', () => {
  test('сортировка по столбцу', async ({ page }) => {
    const sum = grid(page).locator('th[data-key="sum"]');
    await sum.click();
    const first = await ids(page);
    await sum.click();
    const second = await ids(page);
    expect(second).toEqual([...first].reverse());
    expect(new Set(first)).toEqual(new Set(['101', '102', '103']));
  });

  test('«выбрать все» и групповые действия', async ({ page }) => {
    await grid(page).locator('thead input[data-b24-check-all]').check();
    await expect(page.locator('#selected-info')).toHaveText('Выбрано: 3');
    const bar = page.locator('.b24-grid-actions');
    await expect(bar).toContainText('3');
    await bar.getByRole('button', { name: 'Выгрузить' }).click();
    await expect(page.locator('.b24-toast').last()).toContainText('export: 101, 102, 103');
    await grid(page).locator('tbody tr[data-id="102"] input[type="checkbox"]').uncheck();
    await expect(page.locator('#selected-info')).toHaveText('Выбрано: 2');
  });

  test('меню строки учитывает data-actions', async ({ page }) => {
    await grid(page).locator('tr[data-id="103"] .b24-table__row-menu').click();
    const items = page.locator('.b24-popup .b24-menu__item:visible');
    await expect(items).toHaveText(['Открыть', 'Копировать']);
    await items.first().click();
    await expect(page.locator('.b24-toast').last()).toContainText('Строка #103: open');
  });

  test('редактирование ячейки: отказ сервера и сохранение', async ({ page }) => {
    const cell = grid(page).locator('tr[data-id="101"] td[data-col="sum"], tr[data-id="101"] td.b24-table__num').first();
    await cell.dblclick();
    const input = cell.locator('input');
    await input.fill('20000000');
    await input.press('Enter');
    await expect(cell).toContainText('требует согласования');
    await input.fill('5000');
    await input.press('Enter');
    await expect(cell).toHaveText(/5\s000 ₽/);
    await expect(cell.locator('input')).toHaveCount(0);
  });

  test('скрытие столбца сохраняется после перезагрузки', async ({ page }) => {
    await page.locator('.b24-table__settings').first().click();
    await page.locator('.b24-popup').getByText('Заметка', { exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(grid(page).locator('th[data-key="note"]')).toBeHidden();
    await page.reload();
    await expect(grid(page).locator('th[data-key="note"]')).toBeHidden();
  });
});

test.describe('фильтр', () => {
  test('пресет, «Найти» и фильтр для REST', async ({ page }) => {
    const f = page.locator('#demo-filter');
    await expect(f.locator('.b24-filter__chip').first()).toContainText('Сделки в работе');
    await f.locator('.b24-filter__icon[aria-haspopup]').click();
    const popup = page.locator('.b24-filter-popup');
    await expect(popup).toBeVisible();
    await popup.getByRole('button', { name: 'Найти' }).click();
    await expect(page.locator('#filter-output')).toContainText('"=STAGE_ID": "NEW"');
    await f.locator('.b24-filter__chip-remove').first().click();
    await expect(page.locator('#filter-output')).not.toContainText('STAGE_ID');
  });

  test('поиск строкой', async ({ page }) => {
    const input = page.locator('#demo-filter .b24-filter__input');
    await input.fill('ромашка');
    await input.press('Enter');
    await expect(page.locator('#filter-output')).toContainText('ромашка');
  });
});

test.describe('даты и время', () => {
  test('календарь: выбор дня и Esc', async ({ page }) => {
    await page.locator('#dp-1').click();
    const cal = page.locator('.b24-calendar:visible');
    await expect(cal).toBeVisible();
    await cal.locator('.b24-calendar__day', { hasText: /^15$/ }).first().click();
    await expect(page.locator('#dp-1')).toHaveValue(/^15\.\d\d\.\d{4}$/);
    await page.locator('#dp-1').click();
    await expect(page.locator('.b24-calendar:visible')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.b24-calendar:visible')).toHaveCount(0);
  });

  test('ручной ввод даты и мин. дата', async ({ page }) => {
    await page.locator('#dp-1').fill('01.12.2026');
    await page.locator('#dp-1').press('Tab');
    await expect(page.locator('#dp-1')).toHaveValue('01.12.2026');
    await page.locator('#dp-4').click();
    await expect(page.locator('.b24-calendar:visible .b24-calendar__day[disabled], .b24-calendar:visible .b24-calendar__day[aria-disabled="true"]').first()).toBeVisible();
  });

  test('время: шаг и границы', async ({ page }) => {
    await page.locator('#tp-2').click();
    const cells = page.locator('.b24-timepicker__cell:visible');
    await expect(cells.first()).toBeVisible();
    const minutes = await page.locator('.b24-timepicker__col:visible').nth(1).locator('.b24-timepicker__cell').allTextContents();
    expect(minutes.slice(0, 3)).toEqual(['00', '05', '10']);
    await page.keyboard.press('Escape');
    await page.locator('#tp-2').fill('23:30');
    await page.locator('#tp-2').press('Tab');
    expect(await page.locator('#tp-2').inputValue()).not.toBe('23:30');
  });

  test('несколько значений: добавление и предел', async ({ page }) => {
    const multi = page.locator('[data-b24-multi][data-type="time"]');
    await expect(multi.locator('.b24-multi__chip')).toHaveCount(2);
    await expect(multi.locator('.b24-multi__chip').first()).toContainText('09:00'); // отсортированы
    await multi.locator('.b24-multi__chip .b24-tag__remove').first().click();
    await expect(multi.locator('.b24-multi__chip')).toHaveCount(1);
  });
});

test.describe('канбан', () => {
  test('перетаскивание карточки в другую стадию', async ({ page }) => {
    const card = page.locator('#demo-kanban .b24-kanban-card[data-id="2"]');
    const target = page.locator('#demo-kanban .b24-kanban__column[data-column="work"] .b24-kanban__items');
    await card.scrollIntoViewIfNeeded();
    const from = (await card.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + 20, from.y + 20);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 30, { steps: 4 });
    await page.mouse.move(to.x + to.width / 2, to.y + 40, { steps: 12 });
    await page.mouse.up();
    await expect(target.locator('.b24-kanban-card[data-id="2"]')).toHaveCount(1);
  });
});

test.describe('окна', () => {
  test('модальное окно: фокус внутри, Esc закрывает, фокус возвращается', async ({ page }) => {
    const btn = page.locator('#open-modal');
    await btn.click();
    const modal = page.locator('.b24-modal:visible');
    await expect(modal).toContainText('Настройки интеграции');
    expect(await modal.evaluate((m) => m.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('.b24-modal:visible')).toHaveCount(0);
    await expect(btn).toBeFocused();
  });

  test('подтверждение возвращает выбор', async ({ page }) => {
    await page.click('#open-confirm');
    await page.locator('.b24-modal:visible').getByRole('button', { name: 'Удалить' }).click();
    await expect(page.locator('.b24-toast').last()).toContainText('Сделка удалена');
    await page.click('#open-confirm');
    await page.keyboard.press('Escape');
    await expect(page.locator('.b24-toast').last()).toContainText('Отменено');
  });

  test('слайдер и вложенный слайдер закрываются по очереди', async ({ page }) => {
    await page.click('#open-panel');
    const panels = page.locator('.b24-sidepanel:visible');
    await expect(panels).toHaveCount(1);
    await panels.first().locator('#nested').click();
    await expect(page.locator('.b24-sidepanel:visible')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(page.locator('.b24-sidepanel:visible')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.b24-sidepanel:visible')).toHaveCount(0);
  });
});

test.describe('во фрейме портала', () => {
  test('тост показывается у места клика, а не внизу всего контента', async ({ page }) => {
    await page.evaluate(() => { document.body.innerHTML = '<iframe src="/index.html" style="width:1200px;height:800px;border:0"></iframe>'; });
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('#toast-ok')).toBeVisible({ timeout: 10000 });
    // autoFitFrame ставит этот класс, когда приложение открыто в портале (там есть BX24)
    await frame.locator('html').evaluate((el) => el.classList.add('b24-in-frame'));
    await frame.locator('#toast-ok').scrollIntoViewIfNeeded();
    await frame.locator('#toast-ok').click();
    const stack = frame.locator('.b24-toast-stack');
    await expect(stack).toHaveClass(/b24-toast-stack--anchored/);
    const btnY = (await frame.locator('#toast-ok').boundingBox())!.y;
    const toastY = (await frame.locator('.b24-toast').last().boundingBox())!.y;
    expect(Math.abs(toastY - btnY)).toBeLessThan(400);
  });
});

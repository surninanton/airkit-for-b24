import { test, expect } from '@playwright/test';
import { open } from './helpers';

test.describe('открытие записи кликом по строке грида', () => {
  test('клик по строке — b24:row-open; ссылки, чекбокс и редактируемые ячейки не открывают', async ({ page }) => {
    const { errors } = await open(page, '/index.html');
    await page.evaluate(() => {
      (window as unknown as { opened: string[] }).opened = [];
      document.addEventListener('b24:row-open', (e) => (window as unknown as { opened: string[] }).opened.push((e as CustomEvent).detail.id));
    });
    const opened = () => page.evaluate(() => (window as unknown as { opened: string[] }).opened);
    const row = page.locator('table[data-b24-grid="demo-deals"] tbody tr[data-id="101"]');
    await expect(row).toHaveCSS('cursor', 'pointer');
    await row.locator('td[data-col="stage"]').click({ position: { x: 4, y: 4 } });
    expect(await opened()).toEqual(['101']);
    await row.locator('td.b24-table__cell-check input').click();
    await row.locator('a', { hasText: 'Поставка оборудования' }).click();
    await row.locator('td.b24-cell-editable').first().click();
    expect(await opened()).toEqual(['101']);
    expect(errors()).toEqual([]);
  });

  test('tr[data-href] без rowOpen: переход по ссылке, preventDefault — отмена', async ({ page }) => {
    await open(page, '/index.html');
    const result = await page.evaluate(async () => {
      const B24UI = (window as unknown as { B24UI: typeof import('../src/js/index') }).B24UI;
      const wrap = document.createElement('div');
      wrap.className = 'b24-table-wrap';
      wrap.innerHTML = '<table class="b24-table"><thead><tr><th data-key="t">Название</th></tr></thead><tbody><tr data-id="7" data-href="#deal-7"><td>Сделка</td></tr><tr data-id="8"><td>Без ссылки</td></tr></tbody></table>';
      document.querySelector('.b24-page')!.append(wrap);
      B24UI.initGrid(wrap.querySelector('table')!, {});
      const cells = [wrap.querySelector('tr[data-id="7"] td[data-col="t"]'), wrap.querySelector('tr[data-id="8"] td[data-col="t"]')];
      (cells[1] as HTMLElement).click();
      const afterPlain = location.hash;
      (cells[0] as HTMLElement).click();
      const afterHref = location.hash;
      location.hash = '';
      wrap.querySelector('table')!.addEventListener('b24:row-open', (e) => e.preventDefault());
      (cells[0] as HTMLElement).click();
      const afterPrevented = location.hash;
      wrap.remove();
      return { afterPlain, afterHref, afterPrevented };
    });
    expect(result).toEqual({ afterPlain: '', afterHref: '#deal-7', afterPrevented: '' });
  });
});

test.describe('оценка звёздами', () => {
  test('клик, наведение, клавиатура, скрытое поле, сброс; только показ', async ({ page }) => {
    const { errors } = await open(page, '/controls.html');
    const rating = page.locator('#demo-rating .b24-rating');
    const input = page.locator('#demo-rating input[name="rating"]');
    await expect(rating).toHaveAttribute('role', 'slider');
    await expect(rating.locator('.b24-rating__star')).toHaveCount(5);

    await rating.locator('.b24-rating__star').nth(3).hover();
    await expect(rating.locator('.b24-rating__star.is-on')).toHaveCount(4);
    await rating.locator('.b24-rating__star').nth(3).click();
    await expect(input).toHaveValue('4');
    await expect(page.locator('#rating-out')).toHaveText('Оценка: 4');
    await expect(rating).toHaveAttribute('aria-valuenow', '4');

    await rating.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(input).toHaveValue('3');
    await page.keyboard.press('End');
    await expect(input).toHaveValue('5');
    await page.keyboard.press('2');
    await expect(input).toHaveValue('2');
    await rating.locator('.b24-rating__star').nth(1).click(); // повторный клик — сброс
    await expect(input).toHaveValue('0');
    await expect(page.locator('#rating-out')).toHaveText('Не оценено');

    const ro = page.locator('[data-b24-rating][data-readonly] .b24-rating');
    await expect(ro).toHaveAttribute('role', 'img');
    await expect(ro).toHaveAttribute('aria-label', 'Оценка: 4 из 5');
    await ro.locator('.b24-rating__star').nth(0).click();
    await expect(ro.locator('.b24-rating__star.is-on')).toHaveCount(4);
    expect(errors()).toEqual([]);
  });
});

test.describe('автоинициализация содержимого окон', () => {
  test('modal() и openSidePanel() оживляют data-b24-* из <template>; autoInit: false — нет; без двойной инициализации', async ({ page }) => {
    const { errors } = await open(page, '/controls.html');
    const res = await page.evaluate(async () => {
      const B24UI = (window as unknown as { B24UI: typeof import('../src/js/index') }).B24UI;
      const tpl = document.createElement('template');
      tpl.innerHTML = '<form><div data-b24-rating data-name="score" data-value="3"></div></form>';
      const stars = (el: Element) => el.querySelectorAll('.b24-rating').length;

      const m = B24UI.modal({ title: 'Оценка', content: tpl.content.cloneNode(true) as DocumentFragment });
      const inModal = stars(m.body);
      const host = m.body.querySelector<HTMLElement>('[data-b24-rating]')!;
      const value = B24UI.getRating(host)?.getValue();
      B24UI.init(m.body); // повторный init — без второго экземпляра
      const afterInit = stars(m.body);
      await m.close();

      const off = B24UI.modal({ content: tpl.content.cloneNode(true) as DocumentFragment, autoInit: false });
      const inOff = stars(off.body);
      await off.close();

      // содержимое собрано вручную до открытия — второй экземпляр не создаётся
      const pre = tpl.content.cloneNode(true) as DocumentFragment;
      B24UI.createRating(pre.querySelector<HTMLElement>('[data-b24-rating]')!, { value: 1 });
      const sp = B24UI.openSidePanel({ title: 'Панель', content: pre });
      const inPanel = stars(sp.element);
      await sp.close();
      return { inModal, value, afterInit, inOff, inPanel };
    });
    expect(res).toEqual({ inModal: 1, value: 3, afterInit: 1, inOff: 0, inPanel: 1 });
    expect(errors()).toEqual([]);
  });
});

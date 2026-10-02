import { test, expect, type Page } from '@playwright/test';
import { open, noHorizontalScroll } from './helpers';

const mapperValue = (page: Page, id = 'mapper') =>
  page.evaluate((id) => JSON.parse((document.querySelector(`#${id} input[type=hidden][name="field_mappings"]`) as HTMLInputElement | null)?.value ?? 'null')
    ?? JSON.parse(document.getElementById('mapper-json')!.textContent!).contact, id);
const dealValue = async (page: Page) => JSON.parse((await page.locator('#mapper-json').textContent())!).deal;

test('editors.html: без ошибок и горизонтальной прокрутки', async ({ page }) => {
  const { errors } = await open(page, '/editors.html');
  await page.waitForLoadState('networkidle');
  await noHorizontalScroll(page);
  expect(errors()).toEqual([]);
});

test.describe('выпадающий список', () => {
  test('группы, поиск по коду, счётчик и своё значение', async ({ page }) => {
    await open(page, '/editors.html');
    await page.locator('#combo .b24-combobox').click();
    const dialog = page.locator('.b24-dialog');
    await expect(dialog.locator('.b24-dialog__group')).toHaveText(['Системные', 'Пользовательские']);
    await expect(dialog.locator('.b24-dialog__counter')).toHaveText('27 из 27');
    await page.keyboard.type('stage');
    await expect(dialog.locator('.b24-dialog__item:not(.b24-dialog__item--create)')).toHaveCount(1);
    await expect(dialog.locator('.b24-dialog__item-subtitle mark')).toHaveText('STAGE');
    await expect(dialog.locator('.b24-dialog__counter')).toHaveText('1 из 27');
    await dialog.locator('.b24-dialog__search input').fill('UF_CRM_NEW');
    await expect(dialog.locator('.b24-dialog__item--create')).toContainText('Использовать «UF_CRM_NEW»');
    await page.keyboard.press('Enter');
    await expect(page.locator('#combo .b24-combobox__value')).toHaveText('UF_CRM_NEW');
    await expect(page.locator('#combo .b24-combobox__raw')).toBeVisible();
  });

  test('select с data-creatable: своё значение уходит с формой', async ({ page }) => {
    await open(page, '/editors.html');
    await page.locator('#chat + .b24-combobox').click();
    await page.keyboard.type('chat999');
    await page.keyboard.press('Enter');
    expect(await page.locator('#chat').inputValue()).toBe('chat999');
    await expect(page.locator('#chat option[value="chat999"]')).toHaveCount(1);
  });
});

test.describe('повторяющиеся строки', () => {
  test('серверная форма: добавление, удаление и перенумерация имён', async ({ page }) => {
    await open(page, '/editors.html');
    const form = page.locator('#phones-form');
    const add = form.locator('[data-b24-repeater-add]');
    await add.click();
    await add.click();
    await expect(form.locator('.b24-repeater__row')).toHaveCount(3);
    await expect(form.locator('select[name="phones[2][type]"]')).toBeFocused();
    await form.locator('[data-b24-repeater-remove]').first().click();
    const names = await form.locator('[name]').evaluateAll((els) => els.map((e) => e.getAttribute('name')));
    expect(names).toEqual(['phones[0][type]', 'phones[0][value]', 'phones[1][type]', 'phones[1][value]']);
    await add.click(); await add.click(); await add.click();
    await expect(add).toBeHidden(); // data-max="5"
    for (let i = 0; i < 5; i++) await form.locator('[data-b24-repeater-remove]').first().click();
    await expect(form.locator('.b24-repeater__empty')).toBeVisible();
  });

  test('ключ → значение: пары, пустое состояние, JSON', async ({ page }) => {
    await open(page, '/editors.html');
    const kv = page.locator('#kv');
    await kv.locator('.b24-repeater__add').click();
    await expect(kv.locator('.b24-kv__row')).toHaveCount(2);
    await kv.locator('.b24-kv__row').nth(1).locator('.b24-combobox').first().click();
    await page.locator('.b24-dialog__item', { hasText: 'Город' }).click();
    expect(JSON.parse((await page.locator('#kv-json').textContent())!)).toEqual([{ key: 'contract_no', value: 'UF_CRM_CONTRACT_NO' }, { key: 'city', value: '' }]);
    await kv.locator('.b24-repeater__remove').first().click();
    await kv.locator('.b24-repeater__remove').first().click();
    await expect(kv.locator('.b24-repeater__empty')).toHaveText('Условий нет — запуск для всех строк');
    expect(await page.locator('#kv-json').textContent()).toBe('[]');
  });
});

test.describe('сопоставление полей', () => {
  test('строки из значения, шаблон и вставка колонки', async ({ page }) => {
    await open(page, '/editors.html');
    const rows = page.locator('#mapper .b24-mapper__row');
    await expect(rows).toHaveCount(5);
    await expect(rows.nth(0).locator('.b24-mapper__template')).toHaveValue('Договор {{Номер договора}} — {{Фамилия}}');
    await expect(rows.nth(4).locator('.b24-mapper__target .b24-combobox__raw')).toBeVisible();

    // колонка → шаблон, вставка {{Город}}
    await rows.nth(1).locator('.b24-mapper__mode').click();
    const tpl = rows.nth(1).locator('.b24-mapper__template');
    await expect(tpl).toBeFocused();
    await tpl.fill('г. ');
    await rows.nth(1).locator('.b24-mapper__insert .b24-combobox').click();
    await page.locator('.b24-dialog__item', { hasText: 'Город' }).click();
    await expect(tpl).toHaveValue('г. {{Город}}');
    const v = await dealValue(page);
    expect(v[1]).toMatchObject({ mode: 'template', template: 'г. {{Город}}', target: 'OPPORTUNITY' });
  });

  test('словарь значений: справочник, «нет в словаре» и смена типа без потери', async ({ page }) => {
    await open(page, '/editors.html');
    const row = page.locator('#mapper .b24-mapper__row').nth(2);
    const btn = row.locator('.b24-mapper__transform');
    await expect(btn).toHaveClass(/is-configured/);
    await btn.click();
    await expect(row.locator('.b24-kv__row')).toHaveCount(2);
    // справочник стадий с группами по воронкам
    await row.locator('.b24-kv__row').nth(0).locator('.b24-kv__cell').nth(1).locator('.b24-combobox').click();
    await expect(page.locator('.b24-dialog__group')).toHaveText(['Продажи', 'Повторные продажи']);
    await page.locator('.b24-dialog__item', { hasText: 'Подготовка документов' }).click();
    // по умолчанию — поле значения; «пропустить» его прячет
    await expect(row.locator('.b24-mapper__default')).toBeVisible();
    await row.locator('.b24-mapper__missing select').selectOption('skip');
    await expect(row.locator('.b24-mapper__default')).toBeHidden();
    // переключились на «Сумму прописью» и обратно — пары на месте
    await row.getByRole('radio', { name: 'Сумма прописью' }).click();
    expect((await dealValue(page))[2].transform).toEqual({ type: 'amount_words' });
    await row.getByRole('radio', { name: 'Словарь значений' }).click();
    await expect(row.locator('.b24-kv__row')).toHaveCount(2);
    expect((await dealValue(page))[2].transform).toEqual({ type: 'value_map', map: { new: 'PREPARATION', signed: 'WON' }, on_missing: 'skip' });
    await row.getByRole('radio', { name: 'Без преобразования' }).click();
    expect((await dealValue(page))[2].transform).toBeNull();
    await expect(btn).not.toHaveClass(/is-configured/);
  });

  test('поле без справочника — свободный ввод значений', async ({ page }) => {
    await open(page, '/editors.html');
    const row = page.locator('#mapper .b24-mapper__row').nth(4);
    await row.locator('.b24-mapper__transform').click();
    await row.getByRole('radio', { name: 'Словарь значений' }).click();
    await expect(row.locator('.b24-mapper__note')).toContainText('Справочника у поля нет');
    // пустой словарь с «передать как есть» — то же, что без преобразования
    expect((await dealValue(page))[4].transform).toBeNull();
    await row.locator('.b24-repeater__add').click();
    const inputs = row.locator('.b24-kv__row input');
    await expect(inputs).toHaveCount(2);
    await inputs.nth(0).fill('Москва');
    await inputs.nth(1).fill('MSK');
    expect((await dealValue(page))[4].transform).toEqual({ type: 'value_map', map: { 'Москва': 'MSK' }, on_missing: 'pass' });
    await row.getByRole('radio', { name: 'Склонение ФИО' }).click();
    await row.locator('.b24-mapper__config select').selectOption('dative');
    expect((await dealValue(page))[4].transform).toEqual({ type: 'inflect', case: 'dative' });
  });

  test('ошибки сервера по пути и дочерний экземпляр со своим списком полей', async ({ page }) => {
    await open(page, '/editors.html');
    await page.click('#show-errors');
    const rows = page.locator('#mapper .b24-repeater__row');
    await expect(rows.nth(1)).toHaveClass(/is-invalid/);
    await expect(rows.nth(1).locator('.b24-mapper__target .b24-combobox')).toHaveAttribute('aria-invalid', 'true');
    await expect(rows.nth(2).locator('.b24-mapper__panel')).toBeVisible();
    await expect(rows.nth(2).locator('.b24-mapper__errors')).toContainText('Стадии NEW нет');

    const child = page.locator('#mapper-child');
    await child.locator('.b24-repeater__add').click();
    await child.locator('.b24-mapper__row').nth(2).locator('.b24-mapper__target .b24-combobox').click();
    await expect(page.locator('.b24-dialog__item-title')).toHaveText(['Имя', 'Фамилия', 'Отчество', 'Телефон', 'E-mail', 'Паспорт']);
    await page.keyboard.press('Escape');
    await child.locator('.b24-mapper__transform').first().click();
    await expect(child.getByRole('radio')).toHaveText(['Без преобразования', 'Склонение ФИО']);
  });
});

test.describe('таблица отчёта', () => {
  test('раскрытие строки, тон, «было → станет»', async ({ page }) => {
    await open(page, '/editors.html');
    const btn = page.locator('[aria-controls="rep-1"]');
    const details = page.locator('#rep-1');
    await expect(details).toBeHidden();
    await btn.click();
    await expect(details).toBeVisible();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(details.locator('.b24-diff')).toHaveCount(3);
    await expect(details.locator('.b24-diff--same')).toHaveCount(1);
    // пустое «было» не зачёркнуто
    await expect(details.locator('li').nth(2).locator('del')).toHaveCount(0);
    await btn.click();
    await expect(details).toBeHidden();
    const bg = await page.locator('#report tr.is-danger > td').nth(1).evaluate((td) => getComputedStyle(td).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  });
});

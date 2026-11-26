import { test, expect } from '@playwright/test';
import { open } from './helpers';

test('список участников: статус, подпись, «вы» неактивно, клик → onSelect', async ({ page }) => {
  const { errors } = await open(page, '/chat.html');
  const list = page.locator('#members .b24-member-list');
  await expect(list.locator('.b24-member-list__title')).toHaveText('Участники5');
  const rows = list.locator('.b24-member');
  await expect(rows).toHaveCount(5);
  const self = rows.first();
  await expect(self).toBeDisabled();
  await expect(self.locator('.b24-member__you')).toHaveText('вы');
  await expect(self.locator('.b24-avatar__status')).toHaveCount(1);
  await expect(rows.nth(1).locator('.b24-member__caption')).toHaveText('Повар-сушист');
  await expect(rows.nth(1).locator('.b24-member__meta')).toHaveText('Админ');
  await expect(rows.nth(2).locator('.b24-avatar__status.is-away')).toHaveCount(1);
  await rows.nth(1).click();
  await expect(page.locator('.b24-toast').last()).toContainText('Игорь Сафонов');
  // имя не вылезает за строку
  const fits = await rows.nth(1).evaluate((r) => r.scrollWidth <= r.clientWidth + 1);
  expect(fits).toBe(true);
  expect(errors()).toEqual([]);
});

test('подпись в списке диалогов, когда превью пустое', async ({ page }) => {
  await open(page, '/chat.html');
  const items = page.locator('#staff-chats .b24-chat-list__item').filter({ hasNot: page.locator('[data-nothing]') });
  await expect(page.locator('#staff-chats .b24-chat-list__group')).toHaveText(['Покупатели', 'Сотрудники']);
  await expect(items.nth(1).locator('.b24-chat-list__subtitle')).toHaveText('Чат должности · 6 участников');
  // есть превью — показываем его, а не подпись
  await expect(items.nth(2).locator('.b24-chat-list__subtitle')).toHaveCount(0);
  await expect(items.nth(2).locator('.b24-chat-list__preview')).toHaveText('Тимур: беру заказ на Ленина');
  await expect(items.nth(3)).toHaveAttribute('aria-label', /в сети/);
});

test('выбор пользователя: поиск по имени и должности, один — клик закрывает', async ({ page }) => {
  await open(page, '/chat.html');
  await page.locator('#pick-one').click();
  const dlg = page.locator('.b24-overlay [role=dialog]');
  await expect(dlg).toBeVisible();
  const input = dlg.locator('.b24-user-picker__search input');
  await expect(input).toBeFocused();
  await expect(dlg.locator('.b24-member')).toHaveCount(7);
  await input.fill('курьер');
  await expect(dlg.locator('.b24-member')).toHaveCount(2);
  await input.fill('алена');            // ё = е
  await expect(dlg.locator('.b24-member')).toHaveCount(1);
  await input.fill('никого');
  await expect(dlg.locator('.b24-member-list__empty')).toBeVisible();
  await input.fill('ига');
  await expect(dlg.locator('.b24-member')).toHaveCount(0);
  await input.fill('игорь');
  await input.press('Enter');
  await expect(dlg).toHaveCount(0);
  await expect(page.locator('.b24-toast').last()).toContainText('Чат с Игорь Сафонов');
});

test('выбор нескольких: галочки, «Добавить (N)», уже участники скрыты', async ({ page }) => {
  await open(page, '/chat.html');
  await page.locator('#pick-many').click();
  const dlg = page.locator('.b24-overlay [role=dialog]');
  const rows = dlg.locator('.b24-member');
  await expect(rows).toHaveCount(2);
  const ok = dlg.locator('.b24-modal__footer .b24-btn--primary');
  await expect(ok).toBeDisabled();
  await rows.nth(0).click();
  await rows.nth(1).click();
  await expect(rows.nth(0)).toHaveClass(/is-selected/);
  await expect(ok).toHaveText('Добавить (2)');
  await rows.nth(1).click();
  await expect(ok).toHaveText('Добавить (1)');
  await ok.click();
  await expect(dlg).toHaveCount(0);
  await expect(page.locator('#members .b24-member')).toHaveCount(6);
  // Esc — отмена, ничего не меняется
  await page.locator('#pick-many').click();
  await expect(dlg).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await expect(page.locator('#members .b24-member')).toHaveCount(6);
});

test('участник: действие «Удалить из чата» — не onSelect, свою строку удалить нельзя', async ({ page }) => {
  await open(page, '/chat.html');
  const rows = page.locator('#members .b24-member');
  await expect(rows).toHaveCount(5);
  await expect(page.locator('#members .b24-member__action')).toHaveCount(4);   // у «вы» действия нет
  await page.locator('#members .b24-member__action').first().click();
  await expect(rows).toHaveCount(4);
  await expect(page.locator('.b24-toast')).toHaveCount(0);                       // onSelect не сработал
});

test('выбор участников чата: название, группы с indeterminate, чипы, роль и «+ Добавить»', async ({ page }) => {
  const { errors } = await open(page, '/chat.html');
  await page.evaluate(() => {
    const w = window as unknown as { B24UI: { pickUser: (o: unknown) => Promise<unknown> }; __res?: unknown };
    const users = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: `Сотрудник ${'АБВГ'[i]}`, caption: 'Повар' }));
    users[3] = { ...users[3], disabled: true } as never;
    void w.B24UI.pickUser({
      users, multiple: true, okText: 'Создать чат', title: 'Новый чат',
      titleField: { placeholder: 'Название', required: true },
      groups: [{ id: 'pos', label: 'Должности', items: [{ id: 'cook', name: 'Повар', members: ['a', 'b', 'd'] }, { id: 'cour', name: 'Курьер', members: ['b', 'c'] }] }],
    }).then((r) => { w.__res = r; });
  });
  const dlg = page.locator('.b24-overlay [role=dialog]');
  const ok = dlg.locator('.b24-modal__footer .b24-btn--primary');
  await expect(ok).toBeDisabled();
  await dlg.locator('.b24-user-picker__tabs label', { hasText: 'Должности' }).click();
  const cook = dlg.locator('.b24-user-picker__group').first();
  const cour = dlg.locator('.b24-user-picker__group').nth(1);
  await expect(cook.locator('.b24-member__caption')).toHaveText('3 чел.');
  await cook.click();
  await expect(cook).toHaveAttribute('aria-checked', 'true');       // недоступный (d) не мешает
  await expect(cour).toHaveAttribute('aria-checked', 'mixed');
  await expect(dlg.locator('.b24-user-picker__count')).toHaveText('Выбрано: 2');
  await expect(ok).toBeDisabled();                                   // нет названия
  await dlg.locator('.b24-user-picker__title input').fill('Кухня');
  await expect(ok).toBeEnabled();
  await expect(ok).toHaveText('Создать чат');
  await cour.click();
  await expect(dlg.locator('.b24-user-picker__count')).toHaveText('Выбрано: 3');
  await cour.click();                                                // снять: уходит только c
  await expect(dlg.locator('.b24-user-picker__count')).toHaveText('Выбрано: 2');
  await expect(dlg.locator('.b24-user-picker__chip')).toHaveCount(2);
  await dlg.locator('.b24-user-picker__chip-x').first().click();
  await expect(dlg.locator('.b24-user-picker__count')).toHaveText('Выбрано: 1');
  await ok.click();
  await expect(dlg).toHaveCount(0);
  const res = await page.evaluate(() => (window as unknown as { __res: { title: string; users: { id: string }[] } }).__res);
  expect(res.title).toBe('Кухня');
  expect(res.users.map((u) => u.id)).toEqual(['b']);
  expect(errors()).toEqual([]);
});

test('createMemberList: кнопка «+ Добавить участников» и роль справа', async ({ page }) => {
  await open(page, '/chat.html');
  const n = await page.evaluate(() => {
    const w = window as unknown as { B24UI: { createMemberList: (h: HTMLElement, o: unknown) => unknown } };
    const host = document.createElement('div');
    document.body.append(host);
    let clicks = 0;
    w.B24UI.createMemberList(host, { items: [{ id: '1', name: 'Мария', role: 'Создатель' }], onAdd: () => { clicks++; } });
    host.querySelector<HTMLElement>('.b24-member-list__add')!.click();
    return { clicks, role: host.querySelector('.b24-member__role')?.textContent, first: host.querySelector('.b24-member-list > :first-child')?.className };
  });
  expect(n.clicks).toBe(1);
  expect(n.role).toBe('Создатель');
  expect(n.first).toContain('b24-member-list__add');
});

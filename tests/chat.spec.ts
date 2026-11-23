import { test, expect } from '@playwright/test';
import { open, isMobile, noHorizontalScroll } from './helpers';

const mobile = (page: import('@playwright/test').Page) => (page.viewportSize()?.width ?? 1280) <= 768;

test('чаты: список, лента, отправка, «не доставлено», без ошибок', async ({ page }) => {
  const { errors } = await open(page, '/chat.html');
  const chat = page.locator('#chat');
  const list = chat.locator('.b24-chat-list');
  await expect(list.locator('.b24-chat-list__item')).toHaveCount(7);
  await expect(list.locator('.b24-chat-list__item.is-active')).toContainText('Мария Образцова');
  await expect(list.locator('.b24-chat-list__item').nth(2)).toContainText('Вы:');
  await expect(list.locator('.b24-chat-list__item').nth(3).locator('.b24-counter')).toHaveText('1');
  if (mobile(page)) await list.locator('.b24-chat-list__item').first().click();
  const feed = chat.locator('.b24-chat-feed');
  await expect(feed.locator('.b24-chat-date').first()).toBeVisible();
  // лента внизу
  await expect.poll(() => feed.evaluate((f) => f.scrollHeight - f.scrollTop - f.clientHeight)).toBeLessThan(5);
  await expect(feed.locator('.b24-chat-system')).toContainText('Диалог принят');
  await expect(feed.locator('.b24-chat-att--geo')).toContainText('ул. Строителей, 12');
  await expect(feed.locator('.b24-chat-att--file')).toContainText('1,8 МБ');
  await expect(feed.locator('.b24-chat-att--voice audio')).toHaveCount(1);
  await expect(feed.locator('.b24-chat-msg.is-failed .b24-chat-msg__error')).toContainText('клиент ограничил');
  await expect(feed.locator('.b24-chat-msg__text a')).toHaveAttribute('href', 'https://example.com/menu');
  // Shift+Enter — новая строка, Enter — отправка
  const input = chat.locator('.b24-chat-composer__input');
  await input.click();
  await page.keyboard.type('Первая строка');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('вторая');
  await expect(input).toHaveValue('Первая строка\nвторая');
  await page.keyboard.press('Enter');
  await expect(input).toHaveValue('');
  const last = feed.locator('.b24-chat-msg').last();
  await expect(last).toHaveClass(/is-out/);
  await expect(last.locator('.b24-chat-msg__text')).toHaveText('Первая строка\nвторая');
  await expect(last.locator('.b24-chat-msg__status')).toHaveClass(/is-delivered/);
  await expect.poll(() => feed.evaluate((f) => f.scrollHeight - f.scrollTop - f.clientHeight)).toBeLessThan(5);
  // «Повторить»
  await page.keyboard.type('ошибка связи');
  await page.keyboard.press('Enter');
  await expect(feed.locator('.b24-chat-msg').last()).toHaveClass(/is-failed/);
  await feed.locator('.b24-chat-msg').last().getByRole('button', { name: 'Повторить' }).click();
  await expect(feed.locator('.b24-chat-msg').last().locator('.b24-chat-msg__status')).toHaveClass(/is-delivered/);
  // быстрый ответ вставляет текст
  await chat.locator('.b24-chat-composer__reply').first().click();
  await expect(input).toHaveValue('Здравствуйте! Чем могу помочь?');
  if (!mobile(page)) await expect(list.locator('.b24-chat-list__item').first()).toContainText('Вы: ошибка связи');
  await noHorizontalScroll(page);
  expect(errors()).toEqual([]);
});

test('чаты: «Показать раньше» — позиция прокрутки сохраняется', async ({ page }) => {
  await open(page, '/chat.html');
  const chat = page.locator('#chat');
  if (mobile(page)) await chat.locator('.b24-chat-list__item').first().click();
  const feed = chat.locator('.b24-chat-feed');
  await expect.poll(() => feed.evaluate((f) => f.scrollHeight - f.scrollTop - f.clientHeight)).toBeLessThan(5);
  const anchor = feed.locator('.b24-chat-system').first();
  await feed.evaluate((f) => { f.scrollTop = 0; });
  await expect(feed.locator('.b24-chat-msg')).toHaveCount(24, { timeout: 5000 });
  const before = await anchor.evaluate((el) => el.getBoundingClientRect().top);
  // якорь остался на месте (±2px): лента не прыгнула к началу
  const top = await feed.evaluate((f) => f.scrollTop);
  expect(top).toBeGreaterThan(100);
  expect(Math.abs(before - (await anchor.evaluate((el) => el.getBoundingClientRect().top)))).toBeLessThan(2);
});

test('чаты: телефон — одна колонка, «назад»; список стрелками', async ({ page }) => {
  await open(page, '/chat.html');
  const chat = page.locator('#chat');
  const items = chat.locator('.b24-chat-list__item');
  if (!mobile(page)) {
    await items.nth(0).focus();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(items.nth(1)).toHaveClass(/is-active/);
    await expect(chat.locator('#chat-name')).toHaveText('Иван Примеров');
    await expect(chat.locator('.b24-chat__aside')).toBeVisible();
    return;
  }
  await expect(chat.locator('.b24-chat__main')).toBeHidden();
  await items.nth(5).click(); // закрытый диалог
  await expect(chat).toHaveClass(/is-dialog-open/);
  await expect(chat.locator('.b24-chat__main')).toBeVisible();
  await expect(chat.locator('.b24-chat-composer__blocked')).toContainText('Диалог закрыт');
  await chat.locator('[data-b24-chat-back]').click();
  await expect(chat).not.toHaveClass(/is-dialog-open/);
  await expect(chat.locator('.b24-chat-list')).toBeVisible();
});

test('чаты в React: выбор диалога и отправка', async ({ page }) => {
  const { errors } = await open(page, '/react.html');
  if (isMobile(page)) await page.locator('.b24-shell__header .b24-shell__toggle').click();
  await page.locator('.b24-sidebar__item', { hasText: 'Мессенджер' }).click();
  const chat = page.locator('.b24-chat');
  await expect(chat.locator('.b24-chat-list__item')).toHaveCount(3);
  if (mobile(page)) {
    // открыт первый диалог — на телефоне видна переписка; «назад» к списку
    if (await page.locator('.b24-shell.is-menu-open').count()) await page.locator('.b24-shell__header .b24-shell__toggle').click();
    await chat.locator('[data-b24-chat-back]').click();
    await expect(chat).not.toHaveClass(/is-dialog-open/);
  }
  await chat.locator('.b24-chat-list__item').nth(1).click();
  await expect(chat.locator('.b24-chat__head-name')).toHaveText('Иван Примеров');
  await chat.locator('.b24-chat-composer__input').fill('Привет из React');
  await chat.locator('.b24-chat-composer__input').press('Enter');
  await expect(chat.locator('.b24-chat-msg.is-out').last()).toContainText('Привет из React');
  await expect(chat.locator('.b24-chat-list__item').nth(1)).toContainText('Вы: Привет из React');
  if (mobile(page)) {
    await chat.locator('[data-b24-chat-back]').click();
    await expect(chat).not.toHaveClass(/is-dialog-open/);
  }
  expect(errors()).toEqual([]);
});

test('чаты: пустое поле без прокрутки; лента в своей обёртке растягивается', async ({ page }) => {
  await open(page, '/chat.html');
  const input = page.locator('#chat .b24-chat-composer__input');
  const r = await input.evaluate((el: HTMLTextAreaElement) => ({ ch: el.clientHeight, sh: el.scrollHeight, ov: getComputedStyle(el).overflowY }));
  expect(r.sh).toBeLessThanOrEqual(r.ch);
  expect(r.ov).toBe('hidden');
  const res = await page.evaluate(() => {
    const B24UI = (window as unknown as { B24UI: typeof import('../src/js/index') }).B24UI;
    const chat = document.createElement('div');
    chat.className = 'b24-chat';
    chat.style.setProperty('--b24-chat-height', '500px');
    chat.innerHTML = '<div class="b24-chat__list"></div><div class="b24-chat__main"><div class="b24-chat__head">Шапка</div><div class="wrap-feed"></div><div class="wrap-comp"></div></div>';
    document.body.prepend(chat);
    B24UI.createChatFeed(chat.querySelector('.wrap-feed')!, { messages: [{ id: '1', dir: 'in', time: new Date(), text: 'Привет' }] });
    B24UI.createChatComposer(chat.querySelector('.wrap-comp')!, { onSend: () => undefined });
    const main = chat.querySelector('.b24-chat__main')!.getBoundingClientRect();
    const comp = chat.querySelector('.b24-chat-composer')!.getBoundingClientRect();
    return { gap: main.bottom - comp.bottom };
  });
  expect(Math.abs(res.gap)).toBeLessThan(2);
});

test('вложения без url: не ссылка на текущую страницу, а неактивная плашка', async ({ page }) => {
  const { errors } = await open(page, '/chat.html');
  const res = await page.evaluate(async () => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    document.body.append(host);
    B.createChatFeed(host, { messages: [{ id: 'x1', dir: 'in', author: 'Клиент', time: new Date(), attachments: [
      { type: 'file', url: '', name: 'Скан.pdf', size: 1000 },
      { type: 'photo', url: '', name: 'Фото.jpg' },
      { type: 'voice', url: '', duration: 5 },
    ] }] });
    return {
      links: host.querySelectorAll('a[href=""], a[download]').length,
      disabled: host.querySelectorAll('.b24-chat-att.is-disabled').length,
      audio: host.querySelectorAll('audio').length,
      img: host.querySelectorAll('img').length,
    };
  });
  expect(res).toEqual({ links: 0, disabled: 3, audio: 0, img: 0 });
  expect(errors()).toEqual([]);
});

test('чаты: «изменено», правка в поле ввода, индикатор набора', async ({ page }) => {
  await open(page, '/chat.html');
  if (mobile(page)) await page.locator('#chat .b24-chat-list__item').first().click();
  const feed = page.locator('#chat .b24-chat-feed');
  const input = page.locator('#chat .b24-chat-composer__input');
  const composer = page.locator('#chat .b24-chat-composer');
  // полоска действий: наведением, на телефоне — «долгим нажатием» (в эмуляции — событием)
  const tools = async (msg: import('@playwright/test').Locator) => {
    if (mobile(page)) await msg.locator('.b24-chat-msg__bubble').dispatchEvent('pointerdown', { pointerType: 'touch' });
    else await msg.locator('.b24-chat-msg__bubble').hover();
  };
  // своё сообщение
  await input.fill('Опечаткаа');
  await page.keyboard.press('Enter');
  const mine = feed.locator('.b24-chat-msg.is-out').last();
  await expect(mine.locator('.b24-chat-msg__status')).toHaveClass(/is-delivered/);
  await expect(mine.locator('.b24-chat-msg__edited')).toHaveCount(0);
  // «Изменить» в меню
  await tools(mine);
  await mine.locator('.b24-chat-msg__tool[aria-label="Ещё"]').click();
  await page.locator('.b24-chat-menu__item', { hasText: 'Изменить' }).click();
  await expect(composer.locator('.b24-chat-composer__editing')).toBeVisible();
  await expect(composer.locator('.b24-chat-composer__editing-text')).toHaveText('Опечаткаа');
  await expect(input).toHaveValue('Опечаткаа');
  await expect(composer.locator('.b24-chat-composer__attach')).toBeHidden();
  // пустой текст — отправка неактивна
  await input.fill('');
  await expect(composer.locator('.b24-chat-composer__send')).toBeDisabled();
  // Esc — выход, поле пустое
  await page.keyboard.press('Escape');
  await expect(composer.locator('.b24-chat-composer__editing')).toBeHidden();
  await expect(input).toHaveValue('');
  // правка и отправка
  await tools(mine);
  await mine.locator('.b24-chat-msg__tool[aria-label="Ещё"]').click();
  await page.locator('.b24-chat-menu__item', { hasText: 'Изменить' }).click();
  await input.fill('Опечатка исправлена');
  await page.keyboard.press('Enter');
  const edited = feed.locator('.b24-chat-msg.is-out').last();
  await expect(edited.locator('.b24-chat-msg__text')).toHaveText('Опечатка исправлена');
  await expect(edited.locator('.b24-chat-msg__edited')).toHaveText('изменено');
  await expect(edited.locator('.b24-chat-msg__edited')).toHaveAttribute('title', /Изменено/);
  await expect(composer.locator('.b24-chat-composer__editing')).toBeHidden();
  // onTyping не чаще раза в 3 с
  await input.pressSequentially('abc');
  const calls = () => page.evaluate(() => (window as any).__typingCalls as number);
  const c0 = await calls();
  expect(c0).toBeGreaterThan(0);
  await input.pressSequentially('def');
  expect((await calls()) - c0).toBeLessThanOrEqual(1);
  // индикатор набора в ленте
  await page.evaluate(() => (window as any).__feed.setTyping('Анна печатает…'));
  await expect(feed.locator('.b24-chat-typing')).toContainText('Анна печатает…');
  await expect.poll(() => feed.evaluate((f) => f.scrollHeight - f.scrollTop - f.clientHeight)).toBeLessThan(5);
  await page.evaluate(() => (window as any).__feed.setTyping(null));
  await expect(feed.locator('.b24-chat-typing')).toBeHidden();
  // в списке диалогов
  await page.evaluate(() => (window as any).__list.update('d2', { typing: true }));
  await expect(page.locator('#chat .b24-chat-list__item[data-id="d2"] .b24-chat-list__typing')).toHaveText('печатает…');
});

test('чаты: статусы доставки, аватары входящих и в списке по относительному url', async ({ page }) => {
  await open(page, '/chat.html');
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'probe';
    document.body.append(host);
    const a = document.createElement('div'); const b = document.createElement('div');
    host.append(a, b);
    const now = new Date();
    B.createChatFeed(a, { showAvatars: true, messages: [
      { id: 'i1', dir: 'in', author: 'Иван Тестов', avatar: '/proxy/avatar/1.jpg', text: 'Привет', time: now },
      { id: 'o1', dir: 'out', text: 's', time: now, status: 'sending' },
      { id: 'o2', dir: 'out', text: 's', time: now, status: 'sent' },
      { id: 'o3', dir: 'out', text: 's', time: now, status: 'delivered' },
      { id: 'o4', dir: 'out', text: 's', time: now, status: 'read' },
    ] });
    B.createChatList(b, { items: [{ id: 'x', name: 'Иван Тестов', avatar: '/proxy/avatar/1.jpg', preview: 'Привет' }] });
  });
  const probe = page.locator('#probe');
  await expect(probe.locator('.b24-chat-msg.is-in img')).toHaveAttribute('src', '/proxy/avatar/1.jpg');
  for (const s of ['sending', 'sent', 'delivered', 'read']) await expect(probe.locator(`.b24-chat-msg__status.is-${s}`)).toHaveCount(1);
  await expect(probe.locator('.b24-chat-list__item img')).toHaveAttribute('src', '/proxy/avatar/1.jpg');
});

test('чаты: editable и «Изменить» у своей заметки; «печатает…» в панели и окне', async ({ page }) => {
  await open(page, '/chat.html');
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'probe2';
    document.body.append(host);
    const now = new Date();
    B.createChatFeed(host, { onEdit: () => {}, messages: [
      { id: 'a', dir: 'out', text: 'можно', time: now },
      { id: 'b', dir: 'out', text: 'нельзя', time: now, editable: false },
      { id: 'c', dir: 'note', text: 'моя заметка', time: now },
      { id: 'd', dir: 'note', mine: false, text: 'чужая заметка', time: now },
      { id: 'e', dir: 'in', text: 'входящее', time: now },
    ] });
  });
  const has = async (id: string) => {
    const msg = page.locator(`#probe2 .b24-chat-msg[data-id="${id}"]`);
    await msg.locator('.b24-chat-msg__tool[aria-label="Ещё"]').count();
    return msg.locator('.b24-chat-msg__tool[aria-label="Ещё"]').evaluate((b) => { (b as HTMLElement).click(); const t = Array.from(document.querySelectorAll('.b24-chat-menu__item')).some((x) => x.textContent === 'Изменить'); document.querySelector('.b24-chat-menu')?.remove(); return t; });
  };
  expect(await has('a')).toBe(true);
  expect(await has('c')).toBe(true);
  expect(await has('b')).toBe(false);
  expect(await has('d')).toBe(false);
  expect(await has('e')).toBe(false);
  // правая панель
  await page.evaluate(() => (window as any).__bar().update('d2', { typing: true }));
  const item = page.locator('.b24-im-bar__item[data-id="d2"]');
  await expect(item).toHaveClass(/is-typing/);
  await expect(item.locator('.b24-im-bar__typing')).toHaveCount(1);
  await expect(item).toHaveAttribute('data-tip', /печатает…/);
  await page.evaluate(() => (window as any).__bar().update('d2', { typing: false }));
  await expect(page.locator('.b24-im-bar__item[data-id="d2"] .b24-im-bar__typing')).toHaveCount(0);
  // окно
  await page.evaluate(() => (window as any).__openDock('d2').setTyping('Анна печатает…'));
  const dock = page.locator('.b24-chat-dock[data-id="d2"]');
  await expect(dock.locator('.b24-chat-dock__meta')).toHaveText('печатает…');
  await expect(dock.locator('.b24-chat-typing')).toContainText('Анна печатает…');
  await page.evaluate(() => (window as any).__openDock('d2').setTyping(null));
  await expect(dock.locator('.b24-chat-typing')).toBeHidden();
  await expect(dock.locator('.b24-chat-dock__meta')).not.toHaveText('печатает…');
});

test('чаты: видео во вложениях — плеер по клику, ссылка, неактивная плашка', async ({ page }) => {
  await open(page, '/chat.html');
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'probe3';
    document.body.append(host);
    B.createChatFeed(host, { messages: [{ id: 'v', dir: 'in', time: new Date(), attachments: [
      { type: 'video', player: 'https://vk.com/video_ext.php?oid=1&id=2', thumb: '/proxy/t.jpg', name: 'Ролик', duration: 75 },
      { type: 'video', url: 'https://example.com/v.mp4', thumb: '/proxy/t2.jpg' },
      { type: 'video', name: 'Без адреса' },
      { type: 'video', player: 'javascript:alert(1)', name: 'Плохой плеер' },
    ] }] });
  });
  const atts = page.locator('#probe3 .b24-chat-msg__atts > *');
  await expect(atts.nth(0).locator('.b24-chat-att__play')).toBeVisible();
  await expect(atts.nth(0).locator('.b24-chat-att__dur')).toHaveText('1:15');
  await expect(atts.nth(0).locator('iframe')).toHaveCount(0);
  await atts.nth(0).locator('.b24-chat-att__poster').click();
  const frame = page.locator('#probe3 .b24-chat-att--video iframe');
  await expect(frame).toHaveAttribute('allow', /autoplay; encrypted-media; fullscreen; picture-in-picture/);
  await expect(frame).toHaveAttribute('sandbox', /allow-scripts/);
  const box = await page.locator('#probe3 .b24-chat-att--video.is-playing').boundingBox();
  expect(Math.abs(box!.width / box!.height - 16 / 9)).toBeLessThan(0.05);
  await expect(atts.nth(1)).toHaveAttribute('href', 'https://example.com/v.mp4');
  await expect(atts.nth(1)).toHaveAttribute('target', '_blank');
  await expect(atts.nth(2)).toHaveClass(/is-disabled/);
  await expect(atts.nth(3)).toHaveClass(/is-disabled/);
  await expect(page.locator('#probe3 a[href^="javascript"], #probe3 iframe[src^="javascript"]')).toHaveCount(0);
});

test('панель мессенджера: общая сетка отступов; рейл: unknown без точки; call-log: слот записи; значки назад/набор', async ({ page }) => {
  await open(page, '/chat.html');
  if (mobile(page)) return; // правая панель на телефоне скрыта
  // сетка: шаг между соседними кнопками одинаков в группах и между ними
  const gaps = await page.evaluate(() => {
    const bar = document.querySelector('.b24-im-bar')!;
    const btns = Array.from(bar.querySelectorAll('.b24-im-bar__btn')).map((b) => b.getBoundingClientRect());
    return { sizes: btns.map((r) => Math.round(r.width)), margins: Array.from(bar.querySelectorAll('.b24-im-bar__btn')).map((b) => getComputedStyle(b).margin) };
  });
  expect(new Set(gaps.sizes)).toEqual(new Set([40]));
  expect(new Set(gaps.margins)).toEqual(new Set(['0px']));
  const res = await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'probe4';
    document.body.append(host);
    const a = document.createElement('div'); const b = document.createElement('div'); const c = document.createElement('div');
    host.append(a, b, c);
    B.createChatRail(a, { items: [{ id: 'p', label: 'Телефон', icon: 'phone', status: 'unknown' }, { id: 'q', label: 'Чаты', icon: 'chat', status: 'disconnected' }] });
    let slot: HTMLElement | null = null;
    B.createCallLog(b, { items: [{ id: 'c1', direction: 'in', title: 'Мария', time: new Date(), hasRecord: true }], renderRecord: (it: any, el: HTMLElement) => { slot = el; el.textContent = `плеер ${it.id}`; } });
    c.innerHTML = '<div class="b24-chat"><button data-b24-chat-back></button><button data-b24-chat-open></button></div>';
    B.initChatLayout(c.firstElementChild);
    return { slot: !!slot };
  });
  expect(res.slot).toBe(true);
  await expect(page.locator('#probe4 .b24-calllog__record')).toHaveText('плеер c1');
  await expect(page.locator('#probe4 .b24-chat-rail__item').nth(0).locator('.b24-chat-rail__dot')).toHaveCount(0);
  await expect(page.locator('#probe4 .b24-chat-rail__item').nth(1).locator('.b24-chat-rail__dot.is-disconnected')).toHaveCount(1);
  await expect(page.locator('#probe4 [data-b24-chat-back] svg')).toHaveCount(1);
  await expect(page.locator('#probe4 [data-b24-chat-open] svg')).toHaveCount(1);
});

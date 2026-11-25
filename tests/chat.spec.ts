import { test, expect } from '@playwright/test';
import { open, isMobile, noHorizontalScroll } from './helpers';

const mobile = (page: import('@playwright/test').Page) => (page.viewportSize()?.width ?? 1280) <= 768;
const innerWidth768 = mobile;

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

test('чаты: brand в списке отдельной меткой; видео без thumb не уже 240px; aside не сжимает детей', async ({ page }) => {
  await open(page, '/chat.html');
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'probe5';
    host.style.cssText = 'width:360px';
    document.body.append(host);
    const a = document.createElement('div'); const b = document.createElement('div');
    host.append(a, b);
    B.createChatList(a, { items: [{ id: 'x', name: 'Иван', preview: 'Привет', channel: 'ВКонтакте', brand: { label: 'ПиР', color: '#c0392b' } }] });
    B.createChatFeed(b, { messages: [{ id: 'v', dir: 'in', time: new Date(), attachments: [{ type: 'video', player: 'https://vk.com/video_ext.php?oid=1&id=2' }] }] });
  });
  const badges = page.locator('#probe5 .b24-chat-list__item .b24-chat-channel');
  await expect(badges).toHaveCount(2);
  await expect(badges.nth(1)).toHaveText('ПиР');
  const w = await page.locator('#probe5 .b24-chat-att--video').evaluate((e) => e.getBoundingClientRect().width);
  expect(w).toBeGreaterThanOrEqual(235);
  expect(await page.locator('.b24-chat__aside > *').first().evaluate((e) => getComputedStyle(e).flexShrink)).toBe('0');
});

test('чаты: scrollTo, jumpTo (окно вокруг сообщения), подсветка найденного в списке', async ({ page }) => {
  await open(page, '/chat.html');
  if (mobile(page)) await page.locator('#chat .b24-chat-list__item').first().click();
  const feed = page.locator('#chat .b24-chat-feed');
  await expect.poll(() => feed.evaluate((f) => f.scrollHeight - f.scrollTop - f.clientHeight)).toBeLessThan(5);
  // сообщение есть в ленте: по центру и подсвечено
  const found = await page.evaluate(() => (window as any).__feed.scrollTo('m2'));
  expect(found).toBe(true);
  await expect(feed.locator('.b24-chat-msg[data-id="m2"]')).toHaveClass(/is-flash/);
  await expect.poll(() => feed.evaluate((f) => {
    const m = f.querySelector('.b24-chat-msg[data-id="m2"]')!.getBoundingClientRect();
    const r = f.getBoundingClientRect();
    return Math.abs((m.top + m.height / 2) - (r.top + r.height / 2));
  })).toBeLessThan(40);
  expect(await page.evaluate(() => (window as any).__feed.scrollTo('нет-такого'))).toBe(false);
  // без подсветки
  await page.evaluate(() => (window as any).__feed.scrollTo('m5', { highlight: false }));
  await expect(feed.locator('.is-flash')).toHaveCount(0);
  // сообщения нет в ленте: окно вокруг него, «Показать новее»
  const ok = await page.evaluate(async () => {
    const t = new Date(2024, 0, 5, 10, 0).getTime();
    const mk = (i: number) => ({ id: `f${i}`, dir: i % 2 ? 'out' : 'in', time: t + i * 60000, text: `Давнее сообщение ${i}` });
    return (window as any).__feed.jumpTo('f5', async () => ({ before: [1, 2, 3, 4].map(mk), message: mk(5), after: [6, 7, 8].map(mk), hasNewer: true, hasMore: false }));
  });
  expect(ok).toBe(true);
  await expect(feed.locator('.b24-chat-msg[data-id="f5"]')).toHaveClass(/is-flash/);
  await expect(feed.locator('.b24-chat-msg[data-id="m2"]')).toHaveCount(0);
  await expect(feed.locator('.b24-chat-feed__newer')).toBeVisible();
  await expect(feed.locator('.b24-chat-feed__more')).toBeHidden();
  // loader вернул окно без сообщения — false, лента не тронута
  expect(await page.evaluate(() => (window as any).__feed.jumpTo('zzz', async () => []))).toBe(false);
  await expect(feed.locator('.b24-chat-msg[data-id="f5"]')).toHaveCount(1);
  // список: найденное сообщение с подсветкой
  await page.evaluate(() => (window as any).__list.setItems([
    { id: 's1', name: 'Мария Образцова', time: Date.now() - 3600000, channel: 'Telegram', group: 'Сообщения', highlight: 'доставка', dialogId: 'd1', messageId: 'm9',
      preview: 'Подскажите, пожалуйста, когда будет вечером Доставка до Кутлинки и сколько она стоит, и можно ли оплатить картой курьеру? Доставка' },
    { id: 's2', name: 'Иван Примеров', group: 'Сообщения', highlight: [[0, 4]], preview: 'Спасибо, всё получили!' },
  ]));
  const row = page.locator('#chat .b24-chat-list__item[data-id="s1"]');
  await expect(row).toHaveClass(/is-found/);
  await expect(row.locator('mark.b24-chat-list__mark').first()).toHaveText('Доставка');
  await expect(row.locator('.b24-chat-list__preview')).toContainText('…');
  await expect(page.locator('#chat .b24-chat-list__item[data-id="s2"] mark')).toHaveText('Спас');
  await expect(page.locator('#chat .b24-chat-list__group')).toHaveText('Сообщения');
});

test('панель мессенджера: группы «Линии» / «Сотрудники» — разделитель, значок, порядок, counter', async ({ page }) => {
  await open(page, '/chat.html');
  const r = await page.evaluate(() => {
    const B = (window as any).B24UI;
    const bar = B.createMessengerBar({
      items: [
        { id: 's1', name: 'Анна Сотрудникова', group: 'staff', counter: 2 },
        { id: 'l1', name: 'Мария Образцова', group: 'lines', counter: 3 },
        { id: 'l2', name: 'Иван Примеров', group: 'lines' },
        { id: 's2', name: 'Пётр Тестов', group: 'staff' },
        { id: 'x', name: 'Без группы' },
      ],
      groups: [{ id: 'lines', label: 'Линии', icon: 'headset', counter: true }, { id: 'staff', label: 'Сотрудники', icon: 'users' }, { id: 'empty', label: 'Пусто', icon: 'chat' }],
    });
    (window as any).__gbar = bar;
    const kids = Array.from(bar.element.querySelector('.b24-im-bar__list').children) as HTMLElement[];
    return kids.map((k) => (k.classList.contains('b24-im-bar__group') ? `#${k.dataset.group}:${k.textContent}` : k.dataset.id));
  });
  expect(r).toEqual(['#lines:3', 'l1', 'l2', '#staff:', 's1', 's2', 'x']);
  const bar = page.locator('.b24-im-bar').last();
  await expect(bar.locator('.b24-im-bar__group[data-group="lines"]')).toHaveAttribute('data-tip', 'Линии');
  await expect(bar.locator('.b24-im-bar__group[data-group="lines"]')).toHaveClass(/is-first/);
  await expect(bar.locator('.b24-im-bar__group[data-group="empty"]')).toHaveCount(0);
  await expect(bar.locator('.b24-im-bar__group[data-group="staff"]')).toHaveCSS('border-top-width', '1px');
  // update без смены группы и со сменой: группировка сохраняется
  await page.evaluate(() => (window as any).__gbar.update('s1', { counter: 9 }));
  await page.evaluate(() => (window as any).__gbar.update('x', { group: 'lines' }));
  const after = await page.evaluate(() => Array.from((window as any).__gbar.element.querySelector('.b24-im-bar__list').children).map((k: any) => (k.classList.contains('b24-im-bar__group') ? `#${k.dataset.group}` : k.dataset.id)));
  expect(after).toEqual(['#lines', 'l1', 'l2', 'x', '#staff', 's1', 's2']);
  await page.evaluate(() => (window as any).__gbar.destroy());
});

test('чаты: реакции внутри пузыря (reactionsInBubble), аватары вместо числа', async ({ page }) => {
  await open(page, '/chat.html');
  const r = await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.style.cssText = 'height:420px;width:420px;display:flex;flex-direction:column';
    host.id = 'rb-host';
    document.body.append(host);
    const clicks: string[] = [];
    const feed = B.createChatFeed(host, {
      reactionsInBubble: true, reactionsHint: 'Нажмите',
      onReact: (id: string, e: string) => clicks.push(`${id}:${e}`),
      messages: [
        { id: 'a', dir: 'in', time: new Date(), text: 'Привет', reactions: [{ emoji: '👍', count: 2, users: ['Анна Ли', 'Пётр Тест'] }, { emoji: '❤️', count: 4, users: ['А', 'Б', 'В', 'Г'] }, { emoji: '🍕', count: 1, mine: true, avatars: [{ name: 'Вы', src: '/x.png' }] }] },
        { id: 'b', dir: 'out', time: new Date(), text: 'Ответ', reactions: [{ emoji: '🙏', count: 1, avatars: ['Иван Петров'] }] },
      ],
    });
    (window as any).__rbfeed = feed; (window as any).__rbclicks = clicks;
    const q = (id: string) => host.querySelector(`.b24-chat-msg[data-id="${id}"]`)!;
    const a = q('a');
    return {
      inBubble: !!a.querySelector('.b24-chat-msg__bubble .b24-chat-msg__foot .b24-chat-reactions'),
      notBelow: !a.querySelector('.b24-chat-msg__col > .b24-chat-reactions'),
      order: Array.from(a.querySelector('.b24-chat-msg__foot')!.children).map((c) => (c as HTMLElement).className.split(' ')[0]),
      av: Array.from(a.querySelectorAll('.b24-chat-reaction')).map((c) => c.querySelectorAll('.b24-avatar').length + ':' + (c.querySelector('.b24-chat-reaction__count')?.textContent ?? '')),
      initials: a.querySelector('.b24-chat-reaction .b24-avatar')!.textContent,
      img: a.querySelector('.b24-chat-reaction.is-mine img')?.getAttribute('src'),
      title: a.querySelector('.b24-chat-reaction')!.getAttribute('title'),
      outAv: q('b').querySelectorAll('.b24-chat-reaction .b24-avatar').length,
    };
  });
  expect(r.inBubble).toBe(true);
  expect(r.notBelow).toBe(true);
  expect(r.order).toEqual(['b24-chat-reactions', 'b24-chat-msg__meta']);
  expect(r.av).toEqual(['2:', '0:4', '1:']);
  expect(r.initials).toBe('АЛ');
  expect(r.img).toBe('/x.png');
  expect(r.title).toBe('Анна Ли, Пётр Тест — Нажмите');
  expect(r.outAv).toBe(1);
  // клик и обновление через update работают
  await page.locator('#rb-host .b24-chat-msg[data-id="a"] .b24-chat-reaction').first().click();
  expect(await page.evaluate(() => (window as any).__rbclicks)).toEqual(['a:👍']);
  await page.evaluate(() => (window as any).__rbfeed.update('a', { reactions: [{ emoji: '🔥', count: 1 }] }));
  await expect(page.locator('#rb-host .b24-chat-msg[data-id="a"] .b24-chat-msg__foot .b24-chat-reaction')).toHaveCount(1);
  // по умолчанию — под пузырём, без аватаров из users
  const dflt = await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div'); host.style.height = '200px'; document.body.append(host);
    B.createChatFeed(host, { messages: [{ id: 'z', dir: 'in', time: new Date(), text: 'x', reactions: [{ emoji: '👍', count: 1, users: ['Анна'] }] }] });
    return [!!host.querySelector('.b24-chat-msg__col > .b24-chat-reactions'), host.querySelectorAll('.b24-chat-reaction .b24-avatar').length];
  });
  expect(dflt).toEqual([true, 0]);
});

test('чаты: папки и закрепление — pinned, icon канала, меню строки с вложенным меню, рейл sortable / onAdd / меню, prompt', async ({ page }) => {
  await open(page, '/chat.html');
  const r = await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'pf-host';
    host.style.cssText = `position:fixed;left:${innerWidth > 768 ? 400 : 10}px;top:80px;width:360px;max-width:calc(100vw - 20px);height:420px;z-index:50;background:#fff;display:flex;flex-direction:column`;
    document.body.append(host);
    const log: string[] = [];
    (window as any).__pflog = log;
    (window as any).__pflist = B.createChatList(host, {
      items: [
        { id: 'p1', name: 'Закреплённый 1', pinned: true, time: new Date(), preview: 'a', channel: { label: 'ВКонтакте', icon: 'users' } },
        { id: 'p2', name: 'Закреплённый 2', pinned: true, preview: 'b' },
        { id: 'n1', name: 'Обычный', preview: 'c' },
      ],
      itemActions: (it: any) => [
        { label: it.pinned ? 'Открепить' : 'Закрепить', icon: 'pin', onClick: (x: any) => log.push(`pin:${x.id}`) },
        { label: 'Добавить в папку', icon: 'folder', children: [{ label: 'Папка 1', checked: true, onClick: (x: any) => log.push(`f1:${x.id}`) }, { label: 'Папка 2', checked: false, onClick: (x: any) => log.push(`f2:${x.id}`) }, { separator: true }, { label: '+ Новая папка', onClick: (x: any) => log.push(`new:${x.id}`) }] },
        { separator: true },
        { label: 'Удалить', danger: true, onClick: (x: any) => log.push(`del:${x.id}`) },
      ],
    });
    const q = (id: string) => host.querySelector(`.b24-chat-list__item[data-id="${id}"]`)!;
    return {
      pin: !!q('p1').querySelector('.b24-chat-list__pin svg'),
      noPin: !q('n1').querySelector('.b24-chat-list__pin'),
      last: [q('p1').classList.contains('is-pin-last'), q('p2').classList.contains('is-pin-last'), q('n1').classList.contains('is-pin-last')],
      chIcon: !!q('p1').querySelector('.b24-chat-channel svg'),
    };
  });
  expect(r).toEqual({ pin: true, noPin: true, last: [false, true, false], chIcon: true });
  // меню строки: правый клик → вложенное меню → пункт с отметкой
  await page.locator('#pf-host .b24-chat-list__item[data-id="n1"]').click({ button: 'right' });
  const menu = page.locator('.b24-context-menu').first();
  await expect(menu.getByRole('menuitem', { name: 'Закрепить' })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Добавить в папку' }).click();
  const sub = page.locator('.b24-context-menu--sub');
  await expect(sub.getByRole('menuitemcheckbox', { name: 'Папка 1' })).toHaveAttribute('aria-checked', 'true');
  await expect(sub.getByRole('menuitemcheckbox', { name: 'Папка 2' })).toHaveAttribute('aria-checked', 'false');
  await sub.getByRole('menuitem', { name: '+ Новая папка' }).click();
  expect(await page.evaluate(() => (window as any).__pflog)).toEqual(['new:n1']);
  await expect(page.locator('.b24-context-menu')).toHaveCount(0);
  // с клавиатуры: Shift+F10, → открывает вложенное, ← возвращает
  await page.locator('#pf-host .b24-chat-list__item[data-id="p1"]').focus();
  // браузер по Shift+F10 / клавише меню шлёт contextmenu без координат
  await page.evaluate(() => document.querySelector('#pf-host .b24-chat-list__item[data-id="p1"]')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  await expect(page.locator('.b24-context-menu').first()).toBeVisible();
  await expect(page.locator('.b24-context-menu').first().getByRole('menuitem', { name: 'Открепить' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.b24-context-menu').first().getByRole('menuitem', { name: 'Добавить в папку' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.b24-context-menu--sub')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.b24-context-menu--sub')).toHaveCount(0);
  await expect(page.locator('.b24-context-menu').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.b24-context-menu')).toHaveCount(0);
  await page.evaluate(() => { (window as any).__pflist.destroy(); document.getElementById('pf-host')!.remove(); });
});

test('чаты: рейл — перетаскивание папок мышью и Alt+стрелками, fixed, «+», меню, обрезка подписи; B24UI.prompt', async ({ page }) => {
  await open(page, '/chat.html');
  if ((page.viewportSize()?.width ?? 1280) <= 768) test.skip(true, 'мышиное перетаскивание проверяем на десктопе');
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'rl-host';
    host.className = 'b24-chat';
    host.style.cssText = 'position:fixed;left:400px;top:20px;height:520px;width:300px;z-index:50;background:#fff;display:grid;grid-template-columns:68px 1fr';
    document.body.append(host);
    (window as any).__rllog = [];
    B.createChatRail(host, {
      items: [
        { id: 'chats', label: 'Чаты', icon: 'chat', fixed: true },
        { id: 'f1', label: 'Папка один', icon: 'folder' },
        { id: 'f2', label: 'Очень длинное название папки', icon: 'folder' },
        { id: 'f3', label: 'Папка три', icon: 'folder' },
        { id: 'phone', label: 'Телефон', icon: 'phone' },
      ],
      sortable: (it: any) => it.id.startsWith('f'),
      onReorder: (ids: string[], all: string[]) => (window as any).__rllog.push([ids.join(','), all.join(',')]),
      onAdd: () => (window as any).__rllog.push('add'),
      addLabel: 'Новая папка',
      itemActions: (it: any) => (it.id.startsWith('f') ? [{ label: 'Переименовать', onClick: (x: any) => (window as any).__rllog.push(`ren:${x.id}`) }, { label: 'Удалить папку', danger: true }] : null),
    });
  });
  const items = () => page.evaluate(() => Array.from(document.querySelectorAll('#rl-host .b24-chat-rail__item')).map((e) => (e as HTMLElement).dataset.id ?? 'add'));
  expect(await items()).toEqual(['chats', 'f1', 'f2', 'f3', 'phone', 'add']);
  // подпись обрезается, полное название в title
  const long = page.locator('#rl-host .b24-chat-rail__item[data-id="f2"]');
  await expect(long).toHaveAttribute('title', 'Очень длинное название папки');
  expect(await long.locator('.b24-chat-rail__label').evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
  // мышь: f1 тянем вниз за f3
  const a = (await page.locator('#rl-host [data-id="f1"]').boundingBox())!;
  const c = (await page.locator('#rl-host [data-id="f3"]').boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, c.y + c.height - 4, { steps: 8 });
  await page.mouse.up();
  expect(await items()).toEqual(['chats', 'f2', 'f3', 'f1', 'phone', 'add']);
  expect(await page.evaluate(() => (window as any).__rllog)).toEqual([['f2,f3,f1', 'chats,f2,f3,f1,phone']]);
  // после перетаскивания клик по пункту не срабатывает как выбор
  expect(await page.locator('#rl-host .b24-chat-rail__item.is-active').count()).toBe(0);
  // Alt+↑
  await page.locator('#rl-host [data-id="f1"]').focus();
  await page.keyboard.press('Alt+ArrowUp');
  expect(await items()).toEqual(['chats', 'f2', 'f1', 'f3', 'phone', 'add']);
  await expect(page.locator('#rl-host [data-id="f1"]')).toBeFocused();
  // fixed не двигается
  await page.locator('#rl-host [data-id="chats"]').focus();
  await page.keyboard.press('Alt+ArrowDown');
  expect((await items())[0]).toBe('chats');
  // «+» и меню пункта
  await page.locator('#rl-host .b24-chat-rail__add').click();
  await page.locator('#rl-host [data-id="f2"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Переименовать' }).click();
  await page.locator('#rl-host [data-id="phone"]').click({ button: 'right' });
  await expect(page.locator('.b24-context-menu')).toHaveCount(0);
  expect((await page.evaluate(() => (window as any).__rllog)).slice(1)).toEqual([['f2,f1,f3', 'chats,f2,f1,f3,phone'], 'add', 'ren:f2']);
  // prompt
  const p = page.evaluate(() => (window as any).B24UI.prompt({ title: 'Новая папка', label: 'Название', value: '', okLabel: 'Создать', validate: (v: string) => (v === 'x' ? 'Слишком коротко' : null) }));
  const dlg = page.locator('.b24-modal');
  await expect(dlg.getByRole('button', { name: 'Создать' })).toBeDisabled();
  await dlg.locator('input').fill('x');
  await dlg.getByRole('button', { name: 'Создать' }).click();
  await expect(dlg.locator('.b24-field__error')).toHaveText('Слишком коротко');
  await dlg.locator('input').fill('  Заказы  ');
  await dlg.locator('input').press('Enter');
  expect(await p).toBe('Заказы');
  const p2 = page.evaluate(() => (window as any).B24UI.prompt({ title: 'Имя', value: 'Старое' }));
  await expect(page.locator('.b24-modal input')).toHaveValue('Старое');
  await page.keyboard.press('Escape');
  expect(await p2).toBeNull();
});

test('chatMarkup: toPlain / toHtml / безопасность', async ({ page }) => {
  await open(page, '/chat.html');
  const r = await page.evaluate(() => {
    const m = (window as any).B24UI.chatMarkup;
    return {
      plain: m.toPlain('**жирный** и __курсив__, ~~зачёркнутый~~ и `код`'),
      html: m.toHtml('**жирный** и __курсив__, ~~зач~~ и `код`'),
      nested: m.toHtml('**a __b__ c**'),
      snake: m.toHtml('my_snake_case_name и _x_'),
      codeRaw: m.toHtml('`**не жирный**` и ```\n__блок__ <b>\n```'),
      link: m.toHtml('**https://example.com/a_b**, и https://ex.com/q?x=1&y=2'),
      quote: m.toHtml('до\n> цитата **жирная**\n> вторая\nпосле'),
      quotePlain: m.toPlain('до\n> цитата\nпосле'),
      xss: m.toHtml('<img src=x onerror=alert(1)> **<script>**'),
      unclosed: m.toHtml('**без закрытия и ~~ и `'),
      pre2: m.toPlain('a\n```\nx\ny\n```\nb'),
    };
  });
  expect(r.plain).toBe('жирный и курсив, зачёркнутый и код');
  expect(r.html).toBe('<b>жирный</b> и <i>курсив</i>, <s>зач</s> и <code>код</code>');
  expect(r.nested).toBe('<b>a <i>b</i> c</b>');
  expect(r.snake).toBe('my_snake_case_name и _x_');
  expect(r.codeRaw).toBe('<code>**не жирный**</code> и <pre>__блок__ &lt;b&gt;</pre>');
  expect(r.link).toBe('<b><a href="https://example.com/a_b">https://example.com/a_b</a></b>, и <a href="https://ex.com/q?x=1&amp;y=2">https://ex.com/q?x=1&amp;y=2</a>');
  expect(r.quote).toBe('до<blockquote>цитата <b>жирная</b>\nвторая</blockquote>после');
  expect(r.quotePlain).toBe('до\nцитата\nпосле');
  expect(r.xss).toBe('&lt;img src=x onerror=alert(1)&gt; <b>&lt;script&gt;</b>');
  expect(r.unclosed).toBe('**без закрытия и ~~ и `');
  expect(r.pre2).toBe('a\nx\ny\nb');
});

test('чаты: ответ (replyTo), пересылка, formatting в ленте, onQuote, «Переслать», «Копировать»', async ({ page }) => {
  await open(page, '/chat.html');
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'rp-host';
    host.style.cssText = `position:fixed;left:${innerWidth > 768 ? 400 : 10}px;top:60px;width:380px;max-width:calc(100vw - 20px);height:460px;z-index:50;background:#eef2f4;display:flex;flex-direction:column`;
    document.body.append(host);
    const log: any[] = [];
    (window as any).__rplog = log;
    (window as any).__rpfeed = B.createChatFeed(host, {
      formatting: true,
      onForward: (m: any) => log.push(`fwd:${m.id}`),
      onQuote: (m: any, s: string) => log.push(`quote:${m.id}:${s}`),
      onReplyClick: (id: string) => log.push(`missing:${id}`),
      actions: () => [{ id: 'link', label: 'Копировать ссылку на сообщение', onClick: (m: any) => log.push(`link:${m.id}`) }],
      messages: [
        { id: 'a', dir: 'in', time: new Date(), text: 'Первое **сообщение** со `скобками`' },
        { id: 'b', dir: 'out', time: new Date(), text: 'Ответ', replyTo: { id: 'a', author: 'Мария', text: 'Первое **сообщение** со `скобками`' } },
        { id: 'c', dir: 'in', time: new Date(), text: 'Пересланное', forwarded: { from: 'Иван Петров' } },
        { id: 'd', dir: 'in', time: new Date(), text: 'Цитата', replyTo: { id: 'zzz', author: 'Пётр', text: 'Фрагмент', quote: true } },
        { id: 'e', dir: 'in', time: new Date(), text: '', attachments: [], replyTo: { id: 'a', attachment: 'photo' } },
        { id: 'f', dir: 'in', time: new Date(), text: '> цитата\n```\nкод **не жирный**\n```\n__курсив__ <b>x</b>' },
      ],
    });
  });
  const feed = page.locator('#rp-host');
  // форматирование и безопасный текст
  await expect(feed.locator('.b24-chat-msg[data-id="a"] strong')).toHaveText('сообщение');
  await expect(feed.locator('.b24-chat-msg[data-id="a"] code')).toHaveText('скобками');
  await expect(feed.locator('.b24-chat-msg[data-id="f"] blockquote')).toHaveText('цитата');
  await expect(feed.locator('.b24-chat-msg[data-id="f"] pre')).toHaveText('код **не жирный**');
  await expect(feed.locator('.b24-chat-msg[data-id="f"] em')).toHaveText('курсив');
  expect(await feed.locator('.b24-chat-msg[data-id="f"] b').count()).toBe(0);
  // ответ: автор, текст без маркеров, цитата со значком, вложение вместо текста
  const rb = feed.locator('.b24-chat-msg[data-id="b"] .b24-chat-msg__reply');
  await expect(rb.locator('.b24-chat-msg__reply-author')).toHaveText('Мария');
  await expect(rb.locator('.b24-chat-msg__reply-text')).toHaveText('Первое сообщение со скобками');
  await expect(feed.locator('.b24-chat-msg[data-id="d"] .b24-chat-msg__reply.is-quote svg')).toHaveCount(1);
  await expect(feed.locator('.b24-chat-msg[data-id="e"] .b24-chat-msg__reply-text')).toHaveText('Фото');
  await expect(feed.locator('.b24-chat-msg[data-id="c"] .b24-chat-msg__fwd')).toHaveText('Переслано от Иван Петров');
  // клик: есть в ленте — подсветка; нет — onReplyClick
  await rb.click();
  await expect(feed.locator('.b24-chat-msg[data-id="a"]')).toHaveClass(/is-flash/);
  await feed.locator('.b24-chat-msg[data-id="d"] .b24-chat-msg__reply').click();
  expect(await page.evaluate(() => (window as any).__rplog)).toEqual(['missing:zzz']);
  // меню: Переслать и свой пункт «Копировать ссылку»
  const more = async (id: string) => {
    const m = feed.locator(`.b24-chat-msg[data-id="${id}"]`);
    if (innerWidth768(page)) { await m.locator('.b24-chat-msg__bubble').dispatchEvent('pointerdown', { pointerType: 'touch' }); await page.waitForTimeout(550); } else await m.locator('.b24-chat-msg__bubble').hover();
    await m.locator('.b24-chat-msg__tool[aria-label="Ещё"]').click();
  };
  await more('c');
  const menu = page.locator('.b24-chat-menu');
  await expect(menu.getByRole('menuitem', { name: 'Копировать ссылку на сообщение' })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Переслать' }).click();
  expect((await page.evaluate(() => (window as any).__rplog)).at(-1)).toBe('fwd:c');
  // «Копировать» — выделенное / весь текст без маркеров
  await page.evaluate(() => { (window as any).__clip = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (s: string) => (window as any).__clip.push(s) }, configurable: true }); });
  const copy = async (id: string) => {
    await more(id);
    await page.locator('.b24-chat-menu').getByRole('menuitem', { name: 'Копировать', exact: true }).click();
  };
  await copy('a');
  expect(await page.evaluate(() => (window as any).__clip)).toEqual(['Первое сообщение со скобками']);
  // выделение части текста
  await page.evaluate(() => {
    const el = document.querySelector('#rp-host .b24-chat-msg[data-id="c"] .b24-chat-msg__text')!;
    const r = document.createRange(); r.setStart(el.firstChild!, 0); r.setEnd(el.firstChild!, 4);
    const s = getSelection()!; s.removeAllRanges(); s.addRange(r);
  });
  await page.evaluate(() => (window as any).__clip.splice(0));
  // всплывающая кнопка у выделения
  const pop = page.locator('.b24-chat-quote-pop');
  await expect(pop).toBeVisible();
  await pop.getByRole('button', { name: 'Цитировать' }).click();
  expect((await page.evaluate(() => (window as any).__rplog)).at(-1)).toBe('quote:c:Пере');
  await expect(pop).toHaveCount(0);
  await page.evaluate(() => { (window as any).__rpfeed.destroy(); document.getElementById('rp-host')?.remove(); });
});

test('композер: панель ответа (setReply), replyTo в onSend, Esc, форматирование горячими клавишами и «Aa»', async ({ page }) => {
  await open(page, '/chat.html');
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'cp-host';
    host.style.cssText = `position:fixed;left:${innerWidth > 768 ? 400 : 10}px;top:60px;width:380px;max-width:calc(100vw - 20px);z-index:50;background:#fff`;
    document.body.append(host);
    (window as any).__cplog = [];
    (window as any).__cp = B.createChatComposer(host, {
      formatting: true,
      onReplyCancel: () => (window as any).__cplog.push('cancel'),
      onSend: (text: string, ctx: any) => { (window as any).__cplog.push({ text, replyTo: ctx.replyTo, reply: ctx.reply }); },
    });
  });
  const root = page.locator('#cp-host .b24-chat-composer');
  const input = root.locator('textarea');
  await page.evaluate(() => (window as any).__cp.setReply({ id: 'm7', author: 'Мария', text: 'Привет,   как дела?' }));
  const bar = root.locator('.b24-chat-composer__reply-bar');
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('Ответ для Мария');
  await expect(bar).toContainText('Привет, как дела?');
  await expect(input).toBeFocused();
  // Esc в пустом поле — отмена
  await page.keyboard.press('Escape');
  await expect(bar).toBeHidden();
  expect(await page.evaluate(() => (window as any).__cplog)).toEqual(['cancel']);
  // ответ уходит с replyTo и сбрасывается после отправки (без onReplyCancel)
  await page.evaluate(() => (window as any).__cp.setReply({ id: 'm8', author: 'Иван', text: 'Цитата', quote: true }));
  await expect(bar.locator('svg').first()).toBeVisible();
  await expect(bar).toContainText('Цитата Иван');
  await input.fill('Ответ');
  await page.keyboard.press('Escape');
  await expect(bar).toBeVisible();
  await input.press('Enter');
  await expect(bar).toBeHidden();
  const log = await page.evaluate(() => (window as any).__cplog);
  expect(log[1]).toEqual({ text: 'Ответ', replyTo: 'm8', reply: { id: 'm8', author: 'Иван', text: 'Цитата', quote: true } });
  expect(log.length).toBe(2);
  // крестик
  await page.evaluate(() => (window as any).__cp.setReply({ id: 'm9', text: 'x' }));
  await bar.getByRole('button', { name: 'Отменить ответ' }).click();
  expect((await page.evaluate(() => (window as any).__cplog)).at(-1)).toBe('cancel');
  // форматирование: выделение → Ctrl+B, повторно — снять; без выделения — пара маркеров; другие клавиши
  await input.fill('слово другое');
  await input.evaluate((el: HTMLTextAreaElement) => { el.setSelectionRange(0, 5); });
  await input.press('Control+KeyB');
  await expect(input).toHaveValue('**слово** другое');
  expect(await input.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd])).toEqual([2, 7]);
  await input.press('Control+KeyB');
  await expect(input).toHaveValue('слово другое');
  await input.evaluate((el: HTMLTextAreaElement) => { el.setSelectionRange(6, 12); });
  await input.press('Control+KeyI');
  await expect(input).toHaveValue('слово __другое__');
  await input.evaluate((el: HTMLTextAreaElement) => { el.setSelectionRange(0, 5); });
  await input.press('Control+Shift+KeyX');
  await expect(input).toHaveValue('~~слово~~ __другое__');
  await input.fill('');
  await input.press('Control+KeyE');
  await expect(input).toHaveValue('``');
  expect(await input.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(1);
  // панель «Aa»
  const fmt = root.locator('.b24-chat-composer__fmt');
  await expect(fmt).toBeHidden();
  await root.locator('.b24-chat-composer__aa').click();
  await expect(fmt).toBeVisible();
  await input.fill('текст');
  await input.evaluate((el: HTMLTextAreaElement) => { el.setSelectionRange(0, 5); });
  await fmt.locator('[data-fmt="strike"]').click();
  await expect(input).toHaveValue('~~текст~~');
  await page.evaluate(() => { (window as any).__cp.destroy(); document.getElementById('cp-host')?.remove(); });
});

test('сообщение: контекстное меню (реакции, действия, separator/danger), Shift+F10, выделение оставляет меню браузера', async ({ page }) => {
  await open(page, '/chat.html');
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'mm-host';
    host.style.cssText = `position:fixed;left:${innerWidth > 768 ? 400 : 10}px;top:40px;width:420px;max-width:calc(100vw - 20px);height:480px;z-index:50;background:#eef2f4;display:flex;flex-direction:column`;
    document.body.append(host);
    (window as any).__mm = [];
    const log = (window as any).__mm;
    (window as any).__f = B.createChatFeed(host, {
      messageMenu: true, copy: true,
      onReact: (id, e) => log.push('react:' + id + ':' + e), onReply: (m) => log.push('reply:' + m.id), onForward: (m) => log.push('fwd:' + m.id),
      onEdit: (m) => log.push('edit:' + m.id),
      actions: (m) => [{ separator: true }, { id: 'pin', label: 'Закрепить', icon: 'pin', onClick: (x) => log.push('pin:' + x.id) }, { separator: true }, { id: 'del', label: 'Удалить', icon: 'trash', danger: true, onClick: (x) => log.push('del:' + x.id) }],
      messages: [
        { id: 'a', dir: 'in', time: new Date(), text: 'Входящее сообщение для проверки' },
        { id: 'b', dir: 'out', time: new Date(), text: 'Своё сообщение', status: 'read' },
        { id: 'd', dir: 'in', time: new Date(), deleted: true },
      ],
    });
  });
  const feed = page.locator('#mm-host');
  await feed.locator('.b24-chat-msg[data-id="a"] .b24-chat-msg__bubble').click({ button: 'right' });
  const menu = page.locator('.b24-context-menu').first();
  await expect(menu.locator('.b24-chat-menu__reactions .b24-chat-menu__reaction')).toHaveCount(7);
  await expect(menu.getByRole('menuitem')).toHaveText(['Ответить', 'Переслать', 'Копировать', 'Закрепить', 'Удалить']);
  await expect(menu.locator('.b24-menu__divider')).toHaveCount(3);
  await expect(menu.getByRole('menuitem', { name: 'Удалить' })).toHaveClass(/b24-menu__item--danger/);
  await menu.locator('.b24-chat-menu__reaction[data-emoji="👍"]').click();
  await expect(page.locator('.b24-context-menu')).toHaveCount(0);
  // «⌄» — все эмодзи
  await feed.locator('.b24-chat-msg[data-id="b"] .b24-chat-msg__bubble').click({ button: 'right' });
  await expect(page.locator('.b24-context-menu').getByRole('menuitem', { name: 'Изменить' })).toBeVisible();
  await page.locator('.b24-chat-menu__reaction--all').click();
  await expect(page.locator('.b24-emoji__grid').first()).toBeVisible();
  await page.keyboard.press('Escape');
  // действие
  await feed.locator('.b24-chat-msg[data-id="a"] .b24-chat-msg__bubble').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Переслать' }).click();
  // удалённое — без меню
  await feed.locator('.b24-chat-msg[data-id="d"] .b24-chat-msg__bubble').click({ button: 'right' });
  await expect(page.locator('.b24-context-menu')).toHaveCount(0);
  await expect(feed.locator('.b24-chat-msg[data-id="d"] .b24-chat-msg__deleted')).toHaveText('Сообщение удалено');
  await expect(feed.locator('.b24-chat-msg[data-id="d"] .b24-chat-msg__side, .b24-chat-msg[data-id="d"] .b24-chat-msg__tools')).toHaveCount(0);
  // выделен текст — своё меню не открывается (остаётся системное)
  await page.evaluate(() => {
    const el = document.querySelector('#mm-host .b24-chat-msg[data-id="a"] .b24-chat-msg__text')!;
    const r = document.createRange(); r.setStart(el.firstChild!, 0); r.setEnd(el.firstChild!, 5);
    const s = getSelection()!; s.removeAllRanges(); s.addRange(r);
  });
  await feed.locator('.b24-chat-msg[data-id="a"] .b24-chat-msg__bubble').dispatchEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
  await expect(page.locator('.b24-context-menu')).toHaveCount(0);
  await page.evaluate(() => getSelection()!.removeAllRanges());
  // Shift+F10 на ленте — меню последнего сообщения под курсором / последнего
  await feed.locator('.b24-chat-msg[data-id="b"] .b24-chat-msg__bubble').hover();
  await page.locator('#mm-host .b24-chat-feed').focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.locator('.b24-context-menu').getByRole('menuitem', { name: 'Изменить' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as any).__mm)).toEqual(['react:a:👍', 'fwd:a']);
  await page.evaluate(() => { (window as any).__f.destroy(); document.getElementById('mm-host')?.remove(); });
});

test('сообщение: кнопки сбоку (ответить и ⋯), без полоски реакций; двойной щелчок — ответ; hoverReactions', async ({ page }) => {
  await open(page, '/chat.html');
  if (mobile(page)) test.skip(true, 'на сенсорном экране кнопок сбоку нет: меню — по долгому нажатию');
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'mm-host';
    host.style.cssText = `position:fixed;left:${innerWidth > 768 ? 400 : 10}px;top:40px;width:420px;max-width:calc(100vw - 20px);height:480px;z-index:50;background:#eef2f4;display:flex;flex-direction:column`;
    document.body.append(host);
    (window as any).__mm = [];
    const log = (window as any).__mm;
    (window as any).__f = B.createChatFeed(host, {
      messageMenu: true,
      onReact: (id, e) => log.push('react:' + id + ':' + e), onReply: (m) => log.push('reply:' + m.id),
      messages: [
        { id: 'a', dir: 'in', time: new Date(), text: 'Слово другое слово https://example.com/x' },
        { id: 'b', dir: 'out', time: new Date(), text: 'Ответ', status: 'read', replyTo: { id: 'a', author: 'X', text: 'Слово' }, reactions: [{ emoji: '👍', count: 1 }] },
      ],
    });
  });
  const feed = page.locator('#mm-host');
  const a = feed.locator('.b24-chat-msg[data-id="a"]');
  await expect(feed.locator('.b24-chat-msg__tools')).toHaveCount(0);
  const side = a.locator('.b24-chat-msg__side');
  await expect(side).toBeHidden();
  await a.locator('.b24-chat-msg__bubble').hover();
  await expect(side).toBeVisible();
  // кнопки снаружи пузыря, у низа
  const geo = await page.evaluate(() => {
    const m = (id: string) => document.querySelector(`#mm-host .b24-chat-msg[data-id="${id}"]`)!;
    const bb = m('a').querySelector('.b24-chat-msg__bubble')!.getBoundingClientRect();
    const sb = m('a').querySelector('.b24-chat-msg__side')!.getBoundingClientRect();
    const ob = m('b').querySelector('.b24-chat-msg__bubble')!.getBoundingClientRect();
    const os = m('b').querySelector('.b24-chat-msg__side')!.getBoundingClientRect();
    return { inRight: sb.left >= bb.right, inBottom: Math.abs(sb.bottom - bb.bottom) < 2, outLeft: os.right <= ob.left, outBottom: Math.abs(os.bottom - ob.bottom) < 2 };
  });
  expect(geo).toEqual({ inRight: true, inBottom: true, outLeft: true, outBottom: true });
  await side.getByRole('button', { name: 'Ответить' }).click();
  await a.locator('.b24-chat-msg__bubble').hover();
  await side.getByRole('button', { name: 'Ещё' }).click();
  await expect(page.locator('.b24-context-menu .b24-chat-menu__reactions')).toBeVisible();
  await page.keyboard.press('Escape');
  // двойной щелчок по тексту — ответ, слово не выделяется
  await a.locator('.b24-chat-msg__text').dblclick({ position: { x: 8, y: 8 } });
  expect(await page.evaluate(() => getSelection()!.toString())).toBe('');
  // по ссылке, блоку ответа и чипу реакции — нет
  await a.locator('.b24-chat-msg__text a').dblclick();
  await feed.locator('.b24-chat-msg[data-id="b"] .b24-chat-msg__reply').dblclick();
  await feed.locator('.b24-chat-msg[data-id="b"] .b24-chat-reaction').dblclick();
  expect(await page.evaluate(() => (window as any).__mm.filter((x: string) => x.startsWith('reply')))).toEqual(['reply:a', 'reply:a']);
  await page.evaluate(() => { (window as any).__f.destroy(); document.getElementById('mm-host')?.remove(); });
  // hoverReactions: полоска возвращается
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'mm-host';
    host.style.cssText = `position:fixed;left:${innerWidth > 768 ? 400 : 10}px;top:40px;width:420px;max-width:calc(100vw - 20px);height:480px;z-index:50;background:#eef2f4;display:flex;flex-direction:column`;
    document.body.append(host);
    (window as any).__mm = [];
    const log = (window as any).__mm;
    (window as any).__f = B.createChatFeed(host, { messageMenu: true, hoverReactions: true, onReact: () => {}, messages: [{ id: 'a', dir: 'in', time: new Date(), text: 'x' }] });
  });
  await expect(page.locator('#mm-host .b24-chat-msg__tools')).toHaveCount(1);
  await page.evaluate(() => { (window as any).__f.destroy(); document.getElementById('mm-host')?.remove(); });
});

test('сообщение: режим выбора, закреплённое сообщение, панель ответа и меню поля', async ({ page }) => {
  await open(page, '/chat.html');
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'mm-host';
    host.style.cssText = `position:fixed;left:${innerWidth > 768 ? 400 : 10}px;top:40px;width:420px;max-width:calc(100vw - 20px);height:480px;z-index:50;background:#eef2f4;display:flex;flex-direction:column`;
    document.body.append(host);
    (window as any).__mm = [];
    const log = (window as any).__mm;
    (window as any).__f = B.createChatFeed(host, {
      messageMenu: true, onReply: () => {},
      selectActions: [{ id: 'copy', label: 'Копировать', icon: 'copy', onClick: (ms) => { log.push('copy:' + ms.map((m) => m.id).join(',')); return false; } }, { id: 'del', label: 'Удалить', danger: true, onClick: (ms) => { log.push('del:' + ms.map((m) => m.id).join(',')); } }],
      onSelectChange: (ms) => log.push('sel:' + ms.length),
      onUnpin: () => log.push('unpin'), canUnpin: false,
      messages: [
        { id: 'a', dir: 'in', time: new Date(), text: 'Первое' },
        { id: 'b', dir: 'out', time: new Date(), text: 'Второе', status: 'read' },
        { id: 'c', dir: 'in', time: new Date(), text: 'Третье' },
      ],
    });
  });
  const feed = page.locator('#mm-host');
  await page.evaluate(() => (window as any).__f.startSelect('b'));
  await expect(feed.locator('.b24-chat-selbar')).toContainText('Выбрано: 1');
  await expect(feed.locator('.b24-chat-msg[data-id="b"]')).toHaveClass(/is-selected/);
  await expect(feed.locator('.b24-chat-msg[data-id="a"] .b24-chat-msg__check')).toBeVisible();
  await feed.locator('.b24-chat-msg[data-id="c"]').click();
  await feed.locator('.b24-chat-msg[data-id="a"]').click();
  await expect(feed.locator('.b24-chat-selbar')).toContainText('Выбрано: 3');
  await feed.locator('.b24-chat-msg[data-id="b"]').click();
  expect(await page.evaluate(() => (window as any).__f.getSelected().map((m: any) => m.id))).toEqual(['a', 'c']);
  // контекстное меню и «Ответить» в режиме выбора отключены; onReply не вызывается двойным щелчком
  await feed.locator('.b24-chat-msg[data-id="a"] .b24-chat-msg__bubble').click({ button: 'right' });
  await expect(page.locator('.b24-context-menu')).toHaveCount(0);
  // false — режим остаётся
  await feed.locator('.b24-chat-selbar__btn[data-id="copy"]').click();
  await expect(feed.locator('.b24-chat-selbar')).toBeVisible();
  await feed.locator('.b24-chat-selbar__btn[data-id="del"]').click();
  await expect(feed.locator('.b24-chat-selbar')).toBeHidden();
  expect(await page.evaluate(() => (window as any).__f.isSelecting())).toBe(false);
  // Esc выходит
  await page.evaluate(() => (window as any).__f.startSelect());
  await expect(feed.locator('.b24-chat-selbar__btn[data-id="del"]')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(feed.locator('.b24-chat-selbar')).toBeHidden();
  expect((await page.evaluate(() => (window as any).__mm)).filter((x: string) => !x.startsWith('sel:'))).toEqual(['copy:a,c', 'del:a,c']);
  // закреплённое
  await page.evaluate(() => (window as any).__f.setPinned({ id: 'a', author: 'Мария', text: 'Первое **важное**' }));
  const pin = feed.locator('.b24-chat-pinbar');
  await expect(pin).toContainText('Закреплённое сообщение');
  await expect(pin).toContainText('Первое');
  await expect(pin.locator('.b24-chat-pinbar__x')).toHaveCount(0);
  await pin.locator('.b24-chat-pinbar__body').click();
  await expect(feed.locator('.b24-chat-msg[data-id="a"]')).toHaveClass(/is-flash/);
  await page.evaluate(() => (window as any).__f.setPinned({ id: 'a', text: 'x', canUnpin: true }));
  await pin.locator('.b24-chat-pinbar__x').click();
  expect((await page.evaluate(() => (window as any).__mm)).at(-1)).toBe('unpin');
  await page.evaluate(() => (window as any).__f.setPinned(null));
  await expect(pin).toBeHidden();
  await page.evaluate(() => { (window as any).__f.destroy(); document.getElementById('mm-host')?.remove(); });
});

test('композер: formattingButton: false, меню поля по правому клику на выделении, «Цитата»', async ({ page }) => {
  await open(page, '/chat.html');
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'fm-host';
    host.style.cssText = `position:fixed;left:${innerWidth > 768 ? 400 : 10}px;top:80px;width:380px;max-width:calc(100vw - 20px);z-index:50;background:#fff`;
    document.body.append(host);
    (window as any).__fm = B.createChatComposer(host, { formatting: true, formattingButton: false, onSend: () => {} });
  });
  const root = page.locator('#fm-host .b24-chat-composer');
  const input = root.locator('textarea');
  await expect(root.locator('.b24-chat-composer__aa')).toHaveCount(0);
  await expect(root.locator('.b24-chat-composer__fmt')).toHaveCount(0);
  await input.fill('первая\nвторая строка');
  // без выделения — системное меню
  await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(3, 3));
  await input.click({ button: 'right', position: { x: 5, y: 5 } });
  await expect(page.locator('.b24-context-menu')).toHaveCount(0);
  // с выделением — наше меню
  await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 6));
  await input.dispatchEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 420, clientY: 100 });
  const menu = page.locator('.b24-context-menu');
  await expect(menu.getByRole('menuitem')).toHaveCount(8);
  await expect(menu.getByRole('menuitem').nth(4)).toHaveText('Цитата');
  await menu.getByRole('menuitem', { name: /^Жирный/ }).click();
  await expect(input).toHaveValue('**первая**\nвторая строка');
  await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, el.value.length));
  await input.dispatchEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 420, clientY: 100 });
  await page.locator('.b24-context-menu').getByRole('menuitem', { name: 'Цитата' }).click();
  await expect(input).toHaveValue('> **первая**\n> вторая строка');
  await page.evaluate(() => (window as any).__fm.format('quote'));
  await expect(input).toHaveValue('**первая**\nвторая строка');
  await page.evaluate(() => { (window as any).__fm.destroy(); document.getElementById('fm-host')?.remove(); });
});

const mkComposerHost = (id: string) => `position:fixed;left:${innerWidth > 768 ? 400 : 10}px;top:${id === 'cv-host' ? 200 : 120}px;width:380px;max-width:calc(100vw - 20px);z-index:50;background:#fff`;

test('голосовое: кнопка микрофона вместо «Отправить», запись → стоп → предпрослушивание → отправка, Esc, нет доступа, лимит', async ({ page }) => {
  await open(page, '/chat.html');
  await page.evaluate(() => {
    const ac = new AudioContext();
    (window as any).__deny = false;
    // каждый вызов — новый поток: остановленные дорожки прежнего использовать нельзя
    navigator.mediaDevices.getUserMedia = async () => {
      if ((window as any).__deny) throw new Error('denied');
      const dst = ac.createMediaStreamDestination();
      const osc = ac.createOscillator();
      osc.connect(dst); osc.start();
      return dst.stream;
    };
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'cv-host';
    host.style.cssText = `position:fixed;left:${innerWidth > 768 ? 400 : 10}px;top:200px;width:380px;max-width:calc(100vw - 20px);z-index:50;background:#fff`;
    document.body.append(host);
    (window as any).__voice = [];
    (window as any).__vc = B.createChatComposer(host, {
      voice: true, maxVoiceSec: 2, onSend: () => {},
      onVoice: (blob: Blob, dur: number, mime: string) => { (window as any).__voice.push({ size: blob.size, dur, mime }); return true; },
    });
  });
  const root = page.locator('#cv-host .b24-chat-composer');
  const send = root.locator('.b24-chat-composer__send');
  const input = root.locator('textarea');
  await expect(send).toHaveClass(/is-mic/);
  await expect(send).toBeEnabled();
  await input.fill('текст');
  await expect(send).not.toHaveClass(/is-mic/);
  await input.fill('');
  await expect(send).toHaveClass(/is-mic/);
  // запись
  await send.click();
  const box = root.locator('.b24-chat-composer__voice');
  await expect(box).toBeVisible();
  await expect(root.locator('.b24-chat-composer__row')).toBeHidden();
  await expect(box.locator('.b24-micmeter')).toBeVisible();
  await expect(box.locator('.b24-chat-composer__voice-time')).toHaveText(/^0:0[1-9]$/, { timeout: 3000 });
  expect(await page.evaluate(() => (window as any).__vc.isRecording())).toBe(true);
  // Esc — отмена
  await page.keyboard.press('Escape');
  await expect(box).toBeHidden();
  await expect(root.locator('.b24-chat-composer__row')).toBeVisible();
  // запись → стоп → предпрослушивание → отправка
  await send.click();
  await expect(box.locator('.b24-chat-composer__voice-time')).toHaveText(/^0:01$/, { timeout: 3000 });
  await box.getByRole('button', { name: 'Остановить запись' }).click();
  await expect(box.locator('.b24-audio')).toBeVisible();
  await expect(box.locator('audio')).toHaveCount(1);
  await box.getByRole('button', { name: 'Отправить' }).click();
  await expect(box).toBeHidden();
  const sent = await page.evaluate(() => (window as any).__voice);
  expect(sent.length).toBe(1);
  expect(sent[0].size).toBeGreaterThan(100);
  expect(sent[0].dur).toBeGreaterThanOrEqual(1);
  expect(sent[0].mime).toMatch(/^audio\/(webm|mp4|ogg)/);
  // удалить после предпрослушивания
  await send.click();
  await expect(box.locator('.b24-chat-composer__voice-time')).toHaveText(/^0:01$/, { timeout: 3000 });
  await box.getByRole('button', { name: 'Остановить запись' }).click();
  await box.getByRole('button', { name: 'Удалить' }).click();
  await expect(box).toBeHidden();
  expect((await page.evaluate(() => (window as any).__voice)).length).toBe(1);
  // лимит: через maxVoiceSec запись останавливается и открывается предпрослушивание
  await send.click();
  await expect(box.locator('.b24-audio')).toBeVisible({ timeout: 5000 });
  await box.getByRole('button', { name: 'Удалить' }).click();
  // нет доступа — тост
  await page.evaluate(() => ((window as any).__deny = true));
  await send.click();
  await expect(page.locator('.b24-toast').filter({ hasText: 'Нет доступа к микрофону' })).toBeVisible();
  await expect(box).toBeHidden();
  await page.evaluate(() => { (window as any).__vc.destroy(); document.getElementById('cv-host')?.remove(); });
});

test('@упоминания: список, выбор с клавиатуры, маркер в тексте и ctx.mentions, чип в ленте, onMentionClick', async ({ page }) => {
  await open(page, '/chat.html');
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'mn-host';
    host.style.cssText = `position:fixed;left:${innerWidth > 768 ? 400 : 10}px;top:260px;width:380px;max-width:calc(100vw - 20px);z-index:50;background:#fff`;
    document.body.append(host);
    (window as any).__mn = [];
    const people = [{ id: '7', name: 'Иван Петров', caption: 'Курьер' }, { id: '8', name: 'Ирина Смирнова' }, { id: '9', name: 'Олег Новиков' }];
    (window as any).__mc = B.createChatComposer(host, {
      formatting: true,
      mentions: { load: async (q: string) => people.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) },
      onSend: (text: string, ctx: any) => { (window as any).__mn.push({ text, mentions: ctx.mentions }); },
    });
  });
  const root = page.locator('#mn-host .b24-chat-composer');
  const input = root.locator('textarea');
  const list = root.locator('.b24-chat-mention-list');
  await input.click();
  await input.pressSequentially('привет @и');
  await expect(list.getByRole('option')).toHaveCount(3);
  await expect(list.getByRole('option').first()).toContainText('Иван Петров');
  await expect(list.getByRole('option').first()).toContainText('Курьер');
  await input.press('ArrowDown');
  await expect(list.getByRole('option').nth(1)).toHaveClass(/is-active/);
  await input.press('Escape');
  await expect(list).toBeHidden();
  // выбор Enter
  await input.pressSequentially(' ');
  await input.fill('привет ');
  await input.pressSequentially('@ир');
  await expect(list.getByRole('option')).toHaveCount(1);
  await input.press('Enter');
  await expect(input).toHaveValue('привет @Ирина Смирнова ');
  await expect(list).toBeHidden();
  // Tab и мышь
  await input.pressSequentially('и @ол');
  await expect(list.getByRole('option')).toHaveCount(1);
  await list.getByRole('option').first().click();
  await expect(input).toHaveValue('привет @Ирина Смирнова и @Олег Новиков ');
  await input.pressSequentially('!');
  await input.press('Enter');
  const sent = await page.evaluate(() => (window as any).__mn);
  expect(sent).toEqual([{ text: 'привет @[Ирина Смирнова](user:8) и @[Олег Новиков](user:9) !', mentions: ['8', '9'] }]);
  // лента: чип и клик
  await page.evaluate((text) => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'mf-host';
    host.style.cssText = `position:fixed;left:${innerWidth > 768 ? 400 : 10}px;top:20px;width:380px;max-width:calc(100vw - 20px);height:200px;z-index:50;background:#fff;display:flex;flex-direction:column`;
    document.body.append(host);
    (window as any).__mclick = [];
    (window as any).__mf = B.createChatFeed(host, { formatting: true, onMentionClick: (id: string) => (window as any).__mclick.push(id), messages: [{ id: 'a', dir: 'in', time: new Date(), text }] });
    (window as any).__plain = [B.chatMarkup.toPlain(text), B.chatMarkup.toHtml(text)];
  }, sent[0].text);
  const chip = page.locator('#mf-host .b24-chat-mention');
  await expect(chip).toHaveCount(2);
  await expect(chip.first()).toHaveText('@Ирина Смирнова');
  await chip.first().click();
  expect(await page.evaluate(() => (window as any).__mclick)).toEqual(['8']);
  expect(await page.evaluate(() => (window as any).__plain)).toEqual(['привет @Ирина Смирнова и @Олег Новиков !', 'привет @Ирина Смирнова и @Олег Новиков !']);
  await page.evaluate(() => { (window as any).__mc.destroy(); (window as any).__mf.destroy(); document.getElementById('mn-host')?.remove(); document.getElementById('mf-host')?.remove(); });
});

test('черновики: сохранение через хранилище кита, восстановление, очистка после отправки, onDraftChange, ChatListItem.draft', async ({ page }) => {
  await open(page, '/chat.html');
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    (window as any).__ds = {};
    B.setStorage({ get: (k: string) => (window as any).__ds[k] ?? null, set: (k: string, v: string | null) => { if (v === null) delete (window as any).__ds[k]; else (window as any).__ds[k] = v; } });
    const host = document.createElement('div');
    host.id = 'dr-host';
    host.style.cssText = `position:fixed;left:${innerWidth > 768 ? 400 : 10}px;top:260px;width:380px;max-width:calc(100vw - 20px);z-index:50;background:#fff`;
    document.body.append(host);
    (window as any).__dlog = [];
    (window as any).__mk = () => B.createChatComposer(host, { draftKey: 'dlg-1', onDraftChange: (t: string) => (window as any).__dlog.push(t), onSend: () => {} });
    (window as any).__dc = (window as any).__mk();
  });
  const input = page.locator('#dr-host textarea');
  await input.click();
  await input.pressSequentially('недописанный текст');
  // до 400 мс — ещё не сохранён
  expect(await page.evaluate(() => (window as any).__ds['b24-draft:dlg-1'])).toBeUndefined();
  await expect.poll(() => page.evaluate(() => (window as any).__ds['b24-draft:dlg-1'])).toBe('недописанный текст');
  expect(await page.evaluate(() => (window as any).__dc.getDraft())).toBe('недописанный текст');
  expect((await page.evaluate(() => (window as any).__dlog)).at(-1)).toBe('недописанный текст');
  // новое поле с тем же ключом — текст восстановлен
  await page.evaluate(() => { (window as any).__dc.destroy(); (window as any).__dlog.length = 0; (window as any).__dc = (window as any).__mk(); });
  await expect(input).toHaveValue('недописанный текст');
  expect(await page.evaluate(() => (window as any).__dlog)).toEqual(['недописанный текст']);
  // отправка очищает
  await input.press('Enter');
  await expect(input).toHaveValue('');
  expect(await page.evaluate(() => (window as any).__ds['b24-draft:dlg-1'])).toBeUndefined();
  expect((await page.evaluate(() => (window as any).__dlog)).at(-1)).toBe('');
  // пустое поле — ключ удаляется; clearDraft
  await input.pressSequentially('ещё');
  await expect.poll(() => page.evaluate(() => (window as any).__ds['b24-draft:dlg-1'])).toBe('ещё');
  await page.evaluate(() => (window as any).__dc.clearDraft());
  expect(await page.evaluate(() => (window as any).__ds['b24-draft:dlg-1'])).toBeUndefined();
  // список: «Черновик: …» вместо превью
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'dl-host';
    host.style.cssText = `position:fixed;left:${innerWidth > 768 ? 400 : 10}px;top:20px;width:360px;max-width:calc(100vw - 20px);z-index:50;background:#fff`;
    document.body.append(host);
    (window as any).__dl = B.createChatList(host, { items: [{ id: '1', name: 'Мария', preview: 'Последнее сообщение', draft: 'недописанный\nтекст' }, { id: '2', name: 'Иван', preview: 'Привет' }] });
  });
  const row = page.locator('#dl-host .b24-chat-list__item[data-id="1"] .b24-chat-list__preview');
  await expect(row.locator('.b24-chat-list__draft')).toHaveText('Черновик:');
  await expect(row).toContainText('недописанный текст');
  await expect(row).not.toContainText('Последнее сообщение');
  await page.evaluate(() => { (window as any).__dc.destroy(); (window as any).__dl.destroy(); document.getElementById('dr-host')?.remove(); document.getElementById('dl-host')?.remove(); (window as any).B24UI.setStorage(null); });
});

test('pickWallpaper: категории, сетка, «Без обоев», onPreview, применить и отмена', async ({ page }) => {
  await open(page, '/chat.html');
  const grad = 'linear-gradient(135deg,#ffd89b,#19547b)';
  const cats = [
    { id: 'food', label: 'Еда', items: [{ id: 'pizza', thumb: '', css: grad, label: 'Пицца' }, { id: 'roll', css: '#e8590c', label: 'Роллы' }] },
    { id: 'abs', label: 'Абстракция', items: [{ id: 'blue', css: '#2b6cb0', label: 'Синий' }] },
  ];
  await page.evaluate((c) => { (window as any).__pv = []; (window as any).__pw = (window as any).B24UI.pickWallpaper({ categories: c, value: 'roll', onPreview: (it: any) => (window as any).__pv.push(it ? it.id : null) }); }, cats);
  const dlg = page.locator('.b24-modal');
  await expect(dlg.getByRole('tab')).toHaveText(['Еда', 'Абстракция']);
  await expect(dlg.getByRole('tab', { name: 'Еда' })).toHaveAttribute('aria-selected', 'true');
  await expect(dlg.locator('.b24-wallpicker__tile')).toHaveCount(3);           // «Без обоев» + 2
  await expect(dlg.locator('.b24-wallpicker__tile.is-selected')).toHaveAttribute('data-id', 'roll');
  const ratio = await dlg.locator('.b24-wallpicker__thumb').nth(1).evaluate((e) => { const r = e.getBoundingClientRect(); return Math.round((r.width / r.height) * 10) / 10; });
  expect(ratio).toBe(1.6);
  await dlg.locator('.b24-wallpicker__tile[data-id="pizza"]').click();
  await expect(dlg.locator('.b24-wallpicker__tile[data-id="pizza"]')).toHaveAttribute('aria-pressed', 'true');
  await dlg.getByRole('tab', { name: 'Абстракция' }).click();
  await expect(dlg.locator('.b24-wallpicker__tile')).toHaveCount(2);
  await dlg.locator('.b24-wallpicker__tile.is-none').click();
  await dlg.getByRole('button', { name: 'Отмена' }).click();
  expect(await page.evaluate(() => (window as any).__pw)).toBeNull();
  expect(await page.evaluate(() => (window as any).__pv)).toEqual(['pizza', null, 'roll']);   // при отмене — прежнее значение
  // применить
  await page.evaluate((c) => { (window as any).__pw = (window as any).B24UI.pickWallpaper({ categories: c, value: null }); }, cats);
  await dlg.getByRole('tab', { name: 'Абстракция' }).click();
  await dlg.locator('.b24-wallpicker__tile[data-id="blue"]').click();
  await dlg.getByRole('button', { name: 'Применить' }).click();
  expect((await page.evaluate(() => (window as any).__pw)).id).toBe('blue');
  await page.evaluate((c) => { (window as any).__pw = (window as any).B24UI.pickWallpaper({ categories: c, value: 'blue' }); }, cats);
  await dlg.locator('.b24-wallpicker__tile.is-none').click();
  await dlg.getByRole('button', { name: 'Применить' }).click();
  expect((await page.evaluate(() => (window as any).__pw)).id).toBe('');
});

test('фон ленты: тон, узор, tint, setBackground, затемнение в тёмной теме; голосовое во вложении — компактный плеер', async ({ page }) => {
  await open(page, '/chat.html');
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    const host = document.createElement('div');
    host.id = 'bg-host';
    host.style.cssText = `position:fixed;left:${innerWidth > 768 ? 400 : 10}px;top:60px;width:380px;max-width:calc(100vw - 20px);height:360px;z-index:50;background:#fff;display:flex;flex-direction:column`;
    document.body.append(host);
    const msgs = Array.from({ length: 14 }, (_, i) => ({ id: 'b' + i, dir: i % 2 ? 'out' : 'in', time: new Date(), text: 'Сообщение ' + i }));
    msgs.push({ id: 'vv', dir: 'in', time: new Date(), attachments: [{ type: 'voice', url: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', duration: 12 }] } as any);
    (window as any).__bf = B.createChatFeed(host, {
      messages: msgs,
      background: { css: 'linear-gradient(135deg,#ffd89b,#19547b)', pattern: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="6" fill="white"/></svg>', opacity: 0.3, tint: 'rgba(255,0,0,0.1)' },
    });
  });
  const feed = page.locator('#bg-host .b24-chat-feed');
  await expect(feed).toHaveClass(/has-bg/);
  expect(await feed.evaluate((f) => getComputedStyle(f.querySelector('.b24-chat-feed__bg-tone')!).backgroundImage)).toContain('linear-gradient');
  expect(await feed.evaluate((f) => getComputedStyle(f.querySelector('.b24-chat-feed__bg-pattern')!).backgroundImage)).toContain('svg');
  expect(await feed.evaluate((f) => getComputedStyle(f.querySelector('.b24-chat-feed__bg-pattern')!).opacity)).toBe('0.3');
  expect(await feed.evaluate((f) => getComputedStyle(f.querySelector('.b24-chat-feed__bg-tint')!).backgroundColor)).toContain('rgba(255, 0, 0');
  // слой на высоту видимой области и не прокручивается вместе с сообщениями
  await feed.evaluate((f) => { f.scrollTop = 0; });
  const r0 = await feed.evaluate((f) => { const b = f.querySelector('.b24-chat-feed__bg-tone')!.getBoundingClientRect(); const fr = f.getBoundingClientRect(); return { top: Math.round(b.top - fr.top), h: Math.round(b.height), fh: Math.round(fr.height) }; });
  await feed.evaluate((f) => { f.scrollTop = 200; });
  const r1 = await feed.evaluate((f) => { const b = f.querySelector('.b24-chat-feed__bg-tone')!.getBoundingClientRect(); const fr = f.getBoundingClientRect(); return { top: Math.round(b.top - fr.top), h: Math.round(b.height) }; });
  expect(r0.h).toBe(r0.fh);
  expect(r1.top).toBe(r0.top);
  // пузыри читаемы: непрозрачный фон
  expect(await feed.locator('.b24-chat-msg__bubble').first().evaluate((b) => getComputedStyle(b).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  // тёмная тема затемняет, setBackground(null) убирает
  await page.evaluate(() => document.documentElement.setAttribute('data-b24-theme', 'dark'));
  expect(await feed.evaluate((f) => getComputedStyle(f.querySelector('.b24-chat-feed__bg-tone')!).boxShadow)).toContain('rgba(0, 0, 0, 0.5)');
  await page.evaluate(() => document.documentElement.removeAttribute('data-b24-theme'));
  await page.evaluate(() => (window as any).__bf.setBackground({ image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }));
  expect(await feed.evaluate((f) => getComputedStyle(f.querySelector('.b24-chat-feed__bg-tone')!).backgroundImage)).toContain('url(');
  await page.evaluate(() => (window as any).__bf.setBackground(null));
  await expect(feed).not.toHaveClass(/has-bg/);
  // голосовое во вложении: компактный плеер (play, полоса, время)
  const voice = feed.locator('.b24-chat-att--voice');
  await feed.evaluate((f) => { f.scrollTop = f.scrollHeight; });
  await expect(voice.locator('.b24-audio.is-compact')).toBeVisible();
  await expect(voice.locator('.b24-audio__play')).toBeVisible();
  await expect(voice.locator('.b24-audio__total')).toHaveText('0:12');
  await expect(voice.locator('audio')).toHaveCount(1);
  await page.evaluate(() => { (window as any).__bf.destroy(); document.getElementById('bg-host')?.remove(); });
});

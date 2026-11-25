import { test, expect, type Page } from '@playwright/test';
import { open, noHorizontalScroll } from './helpers';

type Api = typeof import('../src/js/index');

test('номера: нормализация и формат', async ({ page }) => {
  await open(page, '/phone.html');
  const r = await page.evaluate(() => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    return {
      a: B.normalizePhone('8 (999) 123-45-67'), b: B.normalizePhone('+7 999 123 45 67'), c: B.normalizePhone('79991234567'),
      d: B.normalizePhone('9991234567'), e: B.normalizePhone('+1 (212) 555-0100'), f: B.normalizePhone('*100#'), g: B.normalizePhone('112'),
      fmt: B.formatPhone('+79991234567'), part: B.formatPhone('+7999'), foreign: B.formatPhone('+12125550100'),
    };
  });
  expect(r).toEqual({ a: '+79991234567', b: '+79991234567', c: '+79991234567', d: '+79991234567', e: '+12125550100', f: '*100#', g: '112', fmt: '+7 (999) 123-45-67', part: '+7 (999)', foreign: '+12125550100' });
});

test('клавиатура: кнопки и буквы, ввод с клавиатуры, вставка, стереть, вызов', async ({ page }) => {
  const { errors } = await open(page, '/phone.html');
  const pad = page.locator('#dialpad .b24-dialpad');
  await expect(pad.locator('.b24-dialpad__key')).toHaveCount(12);
  await expect(pad.locator('[data-key="2"] .b24-dialpad__letters')).toHaveText('ABC');
  await expect(pad.locator('[data-key="0"] .b24-dialpad__letters')).toHaveText('+');
  await expect(pad.locator('.b24-dialpad__call')).toBeDisabled();
  const input = pad.locator('.b24-dialpad__input');
  await pad.locator('[data-key="8"]').click();
  await pad.locator('[data-key="9"]').click();
  await expect(input).toHaveValue('+7 (9');
  // вставка с нормализацией
  await input.fill('');
  await input.evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData('text', '8 (912) 345-67-89');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(input).toHaveValue('+7 (912) 345-67-89');
  // ввод с клавиатуры компьютера: буквы игнорируются
  await input.fill('');
  await input.focus();
  await page.keyboard.type('a8b9991234567');
  await expect(input).toHaveValue('+7 (999) 123-45-67');
  // стереть
  await pad.locator('.b24-dialpad__back').click();
  await expect(input).toHaveValue('+7 (999) 123-45-6');
  await pad.locator('[data-key="7"]').click();
  await input.press('Enter');
  await expect(page.locator('#dial-log')).toContainText('Звоним: +7 (999) 123-45-67 (+79991234567)');
  expect(errors()).toEqual([]);
});

test('клавиатура: удержание 0 даёт «+», режим DTMF отдаёт тоны в onKey и не набирает номер', async ({ page }) => {
  await open(page, '/phone.html');
  const pad = page.locator('#dialpad .b24-dialpad');
  const zero = pad.locator('[data-key="0"]');
  const box = (await zero.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(pad.locator('.b24-dialpad__input')).toHaveValue('+');
  await pad.locator('.b24-dialpad__back').click();
  // DTMF
  await page.locator('#dtmf').check();
  await expect(pad).toHaveClass(/is-dtmf/);
  await expect(pad.locator('.b24-dialpad__call')).toBeHidden();
  await pad.locator('[data-key="5"]').click();
  await pad.locator('[data-key="#"]').click();
  await expect(pad.locator('.b24-dialpad__tones')).toHaveText('5#');
  await expect(page.locator('#dial-log')).toHaveText('Тон: #');
  await page.keyboard.press('7');      // с клавиатуры компьютера
  await expect(pad.locator('.b24-dialpad__tones')).toHaveText('5#7');
  await expect(pad.locator('.b24-dialpad__input')).toHaveValue('');
});

test('карточка звонка: входящий, ответ, таймер, переключатели, удержание, завершение', async ({ page }) => {
  await open(page, '/phone.html');
  const card = page.locator('#callcard .b24-callcard');
  await expect(card).toHaveClass(/is-incoming/);
  await expect(card.locator('.b24-callcard__name')).toHaveText('Мария Образцова');
  await expect(card.locator('.b24-callcard__number')).toHaveText('+7 (999) 123-45-67');
  await expect(card.locator('.b24-callcard__actions')).toBeHidden();
  await expect(card.locator('.b24-callcard__cta-label')).toHaveText(['Ответить', 'Отклонить']);
  await card.getByRole('button', { name: 'Ответить' }).click();
  await expect(card).toHaveClass(/is-active/);
  await expect(card.locator('.b24-callcard__action')).toHaveText(['Без звука', 'Удержание', 'Клавиши', 'Перевести']);
  await expect(card.locator('.b24-callcard__status')).toHaveText('0:00');
  await expect(card.locator('.b24-callcard__status')).toHaveText(/^0:0[1-9]$/, { timeout: 4000 });
  const mute = card.locator('[data-action="mute"]');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.b24-micmeter')).toHaveClass(/is-muted/);
  await card.locator('[data-action="hold"]').click();
  await expect(card).toHaveClass(/is-held/);
  await expect(card.locator('.b24-callcard__status')).toContainText('На удержании');
  await card.locator('[data-action="hold"]').click();
  await expect(card).toHaveClass(/is-active/);
  // клавиши — клавиатура DTMF в слоте
  await card.locator('[data-action="keys"]').click();
  await expect(card.locator('.b24-callcard__extra .b24-dialpad.is-dtmf')).toBeVisible();
  await card.getByRole('button', { name: 'Завершить' }).click();
  await expect(card).toHaveClass(/is-ended/);
  await expect(card.locator('.b24-callcard__status')).toContainText('Звонок завершён');
  await noHorizontalScroll(page);
});

test('статус линии: точка и подпись, выбор «На линии / Перерыв» с клавиатуры', async ({ page }) => {
  await open(page, '/phone.html');
  const labels = await page.locator('#line-static .b24-linestatus').evaluateAll((els) => els.map((e) => [e.className.match(/is-(\w+)/)![1], e.textContent]));
  expect(labels).toEqual([['online', 'На линии'], ['away', 'Перерыв'], ['offline', 'Не на линии'], ['disconnected', 'Нет связи']]);
  const sel = page.locator('#line-select .b24-linestatus');
  await sel.click();
  await expect(page.locator('.b24-linestatus__option')).toHaveText(['На линии', 'Перерыв']);
  await page.locator('.b24-linestatus__option', { hasText: 'Перерыв' }).click();
  await expect(sel).toHaveClass(/is-away/);
  await expect(sel).toContainText('Перерыв');
  await expect(page.locator('.b24-toast').last()).toContainText('Перерыв');
});

test('индикатор микрофона: уровень в aria и делениях', async ({ page }) => {
  await open(page, '/phone.html');
  const r = await page.evaluate(() => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    const host = document.createElement('div');
    document.body.append(host);
    const m = B.createMicMeter(host, { bars: 10 });
    m.setLevel(0.5);
    const el = host.querySelector('.b24-micmeter')!;
    const on = el.querySelectorAll('.is-on').length;
    const now = el.getAttribute('aria-valuenow');
    m.setMuted(true);
    return { on, now, muted: el.classList.contains('is-muted'), after: el.querySelectorAll('.is-on').length };
  });
  expect(r).toEqual({ on: 5, now: '50', muted: true, after: 0 });
});

test('панель мессенджера: кнопка звонка — зелёная, точка статуса, popover с клавиатурой, пульс', async ({ page }) => {
  await open(page, '/phone.html');
  if ((page.viewportSize()?.width ?? 1280) <= 768) return;       // панель на телефоне скрыта
  const btn = page.locator('.b24-im-bar__action');
  await expect(btn).toHaveClass(/b24-im-bar__action--success/);
  await expect(btn.locator('.b24-im-bar__dot.is-online')).toBeVisible();
  await expect(btn).toHaveCSS('background-color', 'rgb(27, 206, 123)');
  await btn.click();
  const pop = page.locator('.b24-popover--content');
  await expect(pop.locator('.b24-dialpad')).toBeVisible();
  // captureKeyboard: цифры идут в клавиатуру popover, даже без фокуса в ней
  await page.keyboard.press('1');
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  await expect(pop.locator('.b24-dialpad__input')).toHaveValue('112');
  await page.keyboard.press('Enter');
  await expect(pop).toHaveCount(0);
  await expect(btn).toHaveClass(/is-pulse/);
  await expect(btn).toHaveClass(/b24-im-bar__action--success/);            // оформление не слетело после перерисовки
});

test('не модальная карточка: без затемнения, справа вверху, слот клиента, свернуть в полоску и развернуть', async ({ page }) => {
  await open(page, '/phone.html');
  await page.locator('#float-open').click();
  const card = page.locator('.b24-callcard--floating');
  await expect(card).toBeVisible();
  await expect(page.locator('.b24-overlay')).toHaveCount(0);                      // страницы не блокирует
  await page.locator('#dial-log').scrollIntoViewIfNeeded();
  await expect(page.locator('#dtmf')).toBeEnabled();
  await card.getByRole('button', { name: 'Ответить' }).click();
  await expect(card.locator('.b24-callcard__customer')).toContainText('Постоянный клиент');
  const box = (await card.boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(box.x + box.width).toBeGreaterThan(vw - 80);                             // справа
  expect(box.y).toBeLessThan(120);                                                // вверху
  await card.getByRole('button', { name: 'Свернуть' }).click();
  await expect(card).toHaveClass(/is-minimized/);
  await expect(card.locator('.b24-callcard__customer')).toBeHidden();
  const mini = (await card.boundingBox())!;
  expect(mini.y + mini.height).toBeGreaterThan(page.viewportSize()!.height - 2);  // внизу экрана
  await expect(card.locator('.b24-callcard__mini-name')).toHaveText('Мария Образцова');
  await expect(card.locator('.b24-callcard__mini-time')).toHaveText(/^\d+:\d\d$/);
  await card.getByRole('button', { name: 'Развернуть' }).click();
  await expect(card).not.toHaveClass(/is-minimized/);
  await card.getByRole('button', { name: 'Свернуть' }).click();
  await card.locator('.b24-callcard__mini-end').click();                          // «Завершить» из полоски
  await expect(card).toHaveClass(/is-ended/);
});

test('журнал звонков: дни, направление, пропущенный красным, длительность, счётчик', async ({ page }) => {
  await open(page, '/phone.html');
  const log = page.locator('#calllog .b24-calllog');
  await expect(log.locator('.b24-calllog__day').first()).toHaveText('Сегодня');
  await expect(log.locator('.b24-calllog__day')).toHaveCount(3);
  const miss = log.locator('.b24-calllog__item').first();
  await expect(miss).toHaveClass(/is-missed/);
  await expect(miss.locator('.b24-calllog__title')).toHaveCSS('color', 'rgb(255, 87, 82)');
  await expect(miss.locator('.b24-calllog__duration')).toHaveCount(0);
  await expect(log.locator('.b24-calllog__item').nth(1).locator('.b24-calllog__duration')).toHaveText('2:05');
  await expect(log.locator('.b24-calllog__item').nth(1)).toHaveClass(/is-out/);
  await expect(page.locator('#missed-info')).toHaveText('Непросмотренных пропущенных: 2');
  await expect(page.locator('#demo-topnav .b24-topnav__item', { hasText: 'Пропущенные' }).locator('.b24-counter')).toHaveText('2');
  // клавиатура
  await log.locator('.b24-calllog__item').first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(log.locator('.b24-calllog__item').nth(1)).toBeFocused();
  // открыли «Пропущенные» — просмотрены, счётчик ушёл
  await page.locator('#demo-topnav .b24-topnav__item', { hasText: 'Пропущенные' }).click();
  await expect(page.locator('#missed-info')).toHaveText('Непросмотренных пропущенных: 0');
  await expect(page.locator('#demo-topnav .b24-topnav__item', { hasText: 'Пропущенные' }).locator('.b24-counter')).toHaveCount(0);
});

test('меню без перезагрузки: setShellActive по адресу, setTopNav, embed', async ({ page }) => {
  await open(page, '/phone.html');
  const r = await page.evaluate(() => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    const shell = document.createElement('div');
    shell.className = 'b24-shell';
    shell.innerHTML = '<aside class="b24-shell__sidebar"><nav class="b24-sidebar"><div class="b24-sidebar__group"><a class="b24-sidebar__item" href="/crm/">CRM</a><a class="b24-sidebar__item" href="/phone/">Телефон</a><a class="b24-sidebar__item" href="/phone/log/">Журнал</a></div></nav></aside><header class="b24-shell__header"></header><main class="b24-shell__main"></main>';
    document.body.append(shell);
    const a = B.setShellActive('/phone/missed/?x=1', { root: shell });
    const b = shell.querySelector('.b24-sidebar__item[aria-current]')!.textContent;
    B.setShellActive('/phone/log/', { root: shell });
    const c = shell.querySelector('.b24-sidebar__item[aria-current]')!.textContent;
    const none = B.setShellActive('/unknown/', { root: shell });
    const keep = shell.querySelector('.b24-sidebar__item[aria-current]')!.textContent;
    B.setSidebar(shell.querySelector('.b24-sidebar') as HTMLElement, [{ title: 'Телефон', items: [{ label: 'Набор', href: '/phone/', counter: 2 }, { label: 'Журнал', href: '/phone/log/', active: true }] }]);
    const items = Array.from(shell.querySelectorAll('.b24-sidebar__item')).map((e) => e.textContent!.replace(/\s+/g, ''));
    B.setEmbed(true);
    const hidden = getComputedStyle(shell.querySelector('.b24-shell__sidebar')!).display;
    const cols = getComputedStyle(shell).gridTemplateColumns.split(' ').length;
    B.setEmbed(false);
    shell.remove();
    return { a: !!a.sidebar, b, c, none: none.sidebar, keep, items, hidden, cols, embedOff: !document.documentElement.classList.contains('b24-embed') };
  });
  expect(r).toEqual({ a: true, b: 'Телефон', c: 'Журнал', none: null, keep: 'Журнал', items: ['Набор2', 'Журнал'], hidden: 'none', cols: 1, embedOff: true });
  // верхнее меню: пункты заменяются, «Ещё» не дублируется
  await page.evaluate(() => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    B.setTopNav(document.getElementById('demo-topnav')!, [{ label: 'Один', href: '#/1' }, { label: 'Два', href: '#/2', active: true }]);
  });
  await expect(page.locator('#demo-topnav .b24-topnav__item:not(.b24-topnav__more)')).toHaveText(['Один', 'Два']);
  await expect(page.locator('#demo-topnav .b24-topnav__item[aria-current="page"]')).toHaveText('Два');
  await expect(page.locator('#demo-topnav .b24-topnav__more')).toHaveCount(1);
  // ?embed=1 включает режим сам
  await page.goto('/phone.html?embed=1');
  await expect(page.locator('html')).toHaveClass(/b24-embed/);
});

test('плеер записи: время, перемотка, скорость, «—:—» до метаданных, ошибка с текстом и повтором', async ({ page }) => {
  await open(page, '/phone.html');
  const card = page.locator('#rec-card .b24-audio');
  await expect(card.locator('.b24-audio__total')).toHaveText('0:12');              // длительность известна заранее
  await expect(card.locator('.b24-audio__cur')).toHaveText('0:00');
  await expect(card.locator('.b24-audio__download')).toHaveAttribute('download', 'zapis-razgovora.wav');
  await card.getByRole('button', { name: 'Воспроизвести' }).click();
  await expect(card).toHaveClass(/is-playing/);
  await expect(page.locator('#rec-log')).toHaveText('Играет');
  await expect(card.locator('.b24-audio__cur')).not.toHaveText('0:00', { timeout: 5000 });
  await card.getByRole('button', { name: 'Пауза' }).click();
  await expect(card).not.toHaveClass(/is-playing/);
  // перемотка по полосе (с клавиатуры) и скорость
  await card.locator('.b24-audio__range').focus();
  const t0 = await card.locator('.b24-audio__range').evaluate((el: HTMLInputElement) => { el.value = '9'; el.dispatchEvent(new Event('input', { bubbles: true })); return el.value; });
  expect(t0).toBe('9');
  await expect(card.locator('.b24-audio__cur')).toHaveText('0:09');
  const sp = card.locator('.b24-audio__speed');
  await expect(sp).toHaveText('1×');
  await sp.click();
  await expect(sp).toHaveText('1,5×');
  await sp.click();
  await expect(sp).toHaveText('2×');
  expect(await card.locator('audio').evaluate((a: HTMLAudioElement) => a.playbackRate)).toBe(2);
  await sp.click();
  await expect(sp).toHaveText('1×');
  // только один плеер играет
  const comp = page.locator('#rec-compact .b24-audio');
  await card.getByRole('button', { name: 'Воспроизвести' }).click();
  await expect(card).toHaveClass(/is-playing/);
  await comp.getByRole('button', { name: 'Воспроизвести' }).click();
  await expect(comp).toHaveClass(/is-playing/);
  await expect(card).not.toHaveClass(/is-playing/);
  await comp.getByRole('button', { name: 'Пауза' }).click();
  // длительность неизвестна (метаданные не загружены, preload none): «—:—», перемотка недоступна
  const lazy = await page.evaluate(() => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    const host = document.createElement('div');
    document.body.append(host);
    B.createAudioPlayer(host, { src: '/never-loaded.wav', preload: 'none', compact: true });
    const el = host.querySelector('.b24-audio')!;
    const r = { total: el.querySelector('.b24-audio__total')!.textContent, disabled: (el.querySelector('.b24-audio__range') as HTMLInputElement).disabled, fmt: [B.formatAudioTime(null), B.formatAudioTime(125), B.formatAudioTime(3725), B.formatAudioTime(Infinity)] };
    host.remove();
    return r;
  });
  expect(lazy).toEqual({ total: '—:—', disabled: true, fmt: ['—:—', '2:05', '1:02:05', '—:—'] });
  // ошибка: текст, а не пустой плеер; «Повторить»
  const bad = page.locator('#rec-error .b24-audio');
  await expect(bad).toHaveClass(/is-error/, { timeout: 5000 });
  await expect(bad.locator('.b24-audio__error-text')).toContainText('Не удалось загрузить запись');
  await expect(bad.locator('.b24-audio__retry')).toBeVisible();
  await expect(bad.locator('.b24-audio__range')).toBeHidden();
  await noHorizontalScroll(page);
});

test('плеер записи: компактный — одна строка, помещается на 390 px', async ({ page }) => {
  await open(page, '/phone.html');
  const comp = page.locator('#rec-compact .b24-audio');
  const box = (await comp.boundingBox())!;
  expect(box.height).toBeLessThan(48);                                               // одна строка
  const play = (await comp.locator('.b24-audio__play').boundingBox())!;
  const bar = (await comp.locator('.b24-audio__bar').boundingBox())!;
  expect(Math.abs((play.y + play.height / 2) - (bar.y + bar.height / 2))).toBeLessThan(4);
  expect(bar.width).toBeGreaterThan(40);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await noHorizontalScroll(page);
});

const mob = (page: Page) => (page.viewportSize()?.width ?? 1280) <= 768;

test('рейл: точка состояния и «звонит», кнопки не пересоздаются, внешние атрибуты переживают перерисовки', async ({ page }) => {
  await open(page, '/phone.html');
  const r = await page.evaluate(() => {
    const rail = (window as unknown as { __railSoft: { buttonOf(id: string): HTMLElement; setActive(id: string): void; update(id: string, p: object): void; setItems(i: object[]): void; getActive(): string } }).__railSoft;
    const btn = rail.buttonOf('phone');
    btn.setAttribute('data-ext', 'mine');
    btn.classList.add('ext-class');
    const dot1 = btn.querySelector('.b24-chat-rail__dot')?.className;
    rail.setActive('lines'); rail.setActive('phone');
    rail.update('phone', { status: 'ringing' });
    const ringing = btn.classList.contains('is-ringing') && !!btn.querySelector('.b24-chat-rail__dot.is-ringing');
    rail.setItems([
      { id: 'lines', label: 'Линии', icon: 'headset', pane: 'lines', counter: 3 },
      { id: 'phone', label: 'Телефон', icon: 'phone', pane: 'phone', status: 'away', attrs: { 'data-demo-rail': 'phone' } },
    ]);
    const same = rail.buttonOf('phone') === btn;
    return { dot1, ringing, same, ext: btn.getAttribute('data-ext'), cls: btn.classList.contains('ext-class'), own: btn.getAttribute('data-demo-rail'), dot2: btn.querySelector('.b24-chat-rail__dot')?.className, counter: rail.buttonOf('lines').querySelector('.b24-counter')?.textContent, aria: btn.getAttribute('aria-label') };
  });
  expect(r.dot1).toContain('is-online');
  expect(r).toMatchObject({ ringing: true, same: true, ext: 'mine', cls: true, own: 'phone', counter: '3' });
  expect(r.dot2).toContain('is-away');
  expect(r.aria).toContain('перерыв');
});

test('общий рейл с панелями: пункт показывает свою панель; «Телефон»: журнал | набор, «Набор» и «назад» на телефоне', async ({ page }) => {
  await open(page, '/phone.html');
  const soft = page.locator('#softchat');
  await soft.scrollIntoViewIfNeeded();
  await expect(page.locator('#pane-lines')).toBeVisible();
  await expect(page.locator('#pane-phone')).toBeHidden();
  await soft.locator('.b24-chat-rail__item', { hasText: 'Телефон' }).click();
  await expect(page.locator('#pane-phone')).toBeVisible();
  await expect(page.locator('#pane-lines')).toBeHidden();
  await expect(soft.locator('.b24-chat-rail__item[aria-current]')).toContainText('Телефон');
  await expect(soft.locator('.b24-chat-rail__item[aria-current]').first()).toHaveAttribute('data-demo-rail', 'phone');
  const log = page.locator('#phone-log .b24-calllog');
  await expect(log.locator('.b24-calllog__action')).toHaveCount(2);
  await expect(log.locator('.b24-calllog__badge')).toHaveText('Ответил коллега');
  if (!mob(page)) {
    await expect(page.locator('#phone-pad .b24-dialpad')).toBeVisible();      // обе колонки сразу
    const l = (await page.locator('#pane-phone .b24-chat__list').boundingBox())!;
    const m = (await page.locator('#pane-phone .b24-chat__main').boundingBox())!;
    expect(m.x).toBeGreaterThanOrEqual(l.x + l.width - 1);
  } else {
    await expect(page.locator('#phone-pad .b24-dialpad')).toBeHidden();
    await expect(soft.locator('> .b24-chat__rail')).toBeVisible();
    await page.locator('#phone-open').click();                                   // «Набор»
    await expect(page.locator('#phone-pad .b24-dialpad')).toBeVisible();
    await expect(soft.locator('> .b24-chat__rail')).toBeHidden();
    await page.locator('#phone-back').click();
    await expect(page.locator('#phone-log .b24-calllog')).toBeVisible();
  }
  // «Перезвонить» не вызывает onSelect, выбранная строка подсвечивается
  const first = page.locator('#phone-log .b24-calllog__item').first();
  await page.locator('#phone-log .b24-calllog__action').first().click();
  await expect(first).not.toHaveClass(/is-selected/);
  if (mob(page)) await page.locator('#phone-back').click();      // «Перезвонить» открыл набор — возвращаемся к журналу
  await page.locator('#phone-log .b24-calllog__item').nth(1).click();
  await expect(page.locator('#phone-log .b24-calllog__item').nth(1)).toHaveClass(/is-selected/);
  await expect(page.locator('#phone-log .b24-calllog__item').nth(1)).toHaveAttribute('aria-selected', 'true');
});

test('карточка звонка: свернуть входящий, свой текст итога и «Закрыть», startedAt после создания', async ({ page }) => {
  await open(page, '/phone.html');
  const r = await page.evaluate(async () => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    const log: string[] = [];
    const card = B.createCallCard(document.body, { floating: true, state: 'incoming', name: 'Мария', number: '89991234567', onAnswer: () => log.push('answer'), onDecline: () => log.push('decline'), onClose: () => log.push('close') });
    const el = card.element;
    const minBtn = el.querySelector<HTMLElement>('.b24-callcard__min')!;
    const canMin = !minBtn.hidden;
    card.minimize();
    const miniVisible = getComputedStyle(el.querySelector('.b24-callcard__mini')!).display !== 'none';
    const answerShown = !el.querySelector<HTMLElement>('.b24-callcard__mini-answer')!.hidden;
    (el.querySelector('.b24-callcard__mini-answer') as HTMLElement).click();
    (el.querySelector('.b24-callcard__mini-end') as HTMLElement).click();           // в полоске у входящего — «Отклонить»
    card.restore();
    // ringing → talking: таймер от момента ответа на стороне сервера
    card.setState('active', { startedAt: Date.now() - 65000 });
    const timer = el.querySelector('.b24-callcard__status')!.textContent;
    card.setStartedAt(Date.now() - 125000);
    const timer2 = el.querySelector('.b24-callcard__status')!.textContent;
    card.setState('ended', { text: 'Ответил коллега' });
    const ended = el.querySelector('.b24-callcard__status')!.textContent;
    const closeBtn = el.querySelector<HTMLElement>('.b24-callcard__close');
    closeBtn?.click();
    card.minimize();
    const miniText = el.querySelector('.b24-callcard__mini-time')!.textContent;
    const miniClose = el.querySelector<HTMLElement>('.b24-callcard__mini-end')!.getAttribute('aria-label');
    (el.querySelector('.b24-callcard__mini-end') as HTMLElement).click();
    card.destroy();
    return { canMin, miniVisible, answerShown, log, timer, timer2, ended, hasClose: !!closeBtn, miniText, miniClose };
  });
  expect(r).toEqual({ canMin: true, miniVisible: true, answerShown: true, log: ['answer', 'decline', 'close', 'close'], timer: '1:05', timer2: '2:05', ended: 'Ответил коллега', hasClose: true, miniText: 'Ответил коллега', miniClose: 'Закрыть' });
});

test('клавиатура: internalMaxLength не трогает внутренние номера; поле не перебивается стилями input', async ({ page }) => {
  await open(page, '/phone.html');
  await page.addStyleTag({ content: 'input, input[type=tel] { border: 4px solid red !important; box-shadow: 0 0 0 3px blue !important; background: yellow !important; }' });
  const pad = page.locator('#phone-pad .b24-dialpad');
  await page.locator('#softchat').scrollIntoViewIfNeeded();
  await page.locator('#softchat .b24-chat-rail__item', { hasText: 'Телефон' }).click();
  if (mob(page)) await page.locator('#phone-open').click();
  const input = pad.locator('.b24-dialpad__input');
  await expect(input).toHaveCSS('border-top-width', '0px');
  await expect(input).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  for (const k of ['7', '5', '0']) await pad.locator(`[data-key="${k}"]`).click();
  await expect(input).toHaveValue('750');
  const r = await page.evaluate(() => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    return { a: B.normalizePhone('750', { internalMaxLength: 4 }), b: B.normalizePhone('89991234567', { internalMaxLength: 4 }), c: B.normalizePhone('1001', { internalMaxLength: 4 }), d: B.normalizePhone('750') };
  });
  expect(r).toEqual({ a: '750', b: '+79991234567', c: '1001', d: '+750' });
});

test('круглые кнопки вызова: «Позвонить», «Перезвонить», «Ответить», «Завершить» — круглые зелёные / красные значки с подписью в title', async ({ page }) => {
  await open(page, '/phone.html');
  const round = async (loc: import('@playwright/test').Locator) => {
    const b = (await loc.boundingBox())!;
    expect(Math.abs(b.width - b.height)).toBeLessThan(1.5);
    await expect(loc).toHaveCSS('border-radius', /50%|^\d+(\.\d+)?px$/);
    return b;
  };
  // клавиатура: круглая трубка по центру под кнопками
  const pad = page.locator('#dialpad .b24-dialpad');
  const call = pad.locator('.b24-dialpad__call');
  await expect(call).toHaveClass(/is-round/);
  await expect(call).toHaveAttribute('aria-label', 'Позвонить');
  await expect(call).toHaveAttribute('title', 'Позвонить');
  await expect(call).toHaveText('');
  await expect(call).toHaveCSS('background-color', 'rgb(27, 206, 123)');
  const cb = await round(call);
  const pb = (await pad.boundingBox())!;
  expect(Math.abs(cb.x + cb.width / 2 - (pb.x + pb.width / 2))).toBeLessThan(2);
  // широкая — по опции
  const wide = await page.evaluate(() => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    const host = document.createElement('div');
    document.body.append(host);
    B.createDialpad(host, { callButton: 'wide' });
    const el = host.querySelector('.b24-dialpad__call')!;
    const r = { wide: el.classList.contains('is-wide'), text: el.textContent };
    host.remove();
    return r;
  });
  expect(wide).toEqual({ wide: true, text: 'Позвонить' });
  // журнал: icon 'phone' — круглая зелёная; без иконки-трубки — обычная
  const act = page.locator('#phone-log .b24-calllog__action').first();
  await page.locator('#softchat').scrollIntoViewIfNeeded();
  await page.locator('#softchat .b24-chat-rail__item', { hasText: 'Телефон' }).click();
  await expect(act).toHaveClass(/is-round/);
  await expect(act).toHaveAttribute('title', 'Перезвонить');
  await expect(act).toHaveCSS('background-color', 'rgb(27, 206, 123)');
  await round(act);
  const plain = await page.evaluate(() => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    const host = document.createElement('div');
    document.body.append(host);
    B.createCallLog(host, { items: [{ id: '1', direction: 'out', title: 'А', time: new Date(), actions: [{ id: 'a', label: 'Заметка', icon: 'comment' }, { id: 'b', label: 'Круглая', icon: 'star', round: true }] }] });
    const r = Array.from(host.querySelectorAll('.b24-calllog__action')).map((e) => e.classList.contains('is-round'));
    host.remove();
    return r;
  });
  expect(plain).toEqual([false, true]);
  // карточка: «Ответить» зелёная, «Отклонить» и «Завершить» красные, все круглые
  const r = await page.evaluate(() => {
    const B = (window as unknown as { B24UI: Api }).B24UI;
    const host = document.createElement('div');
    document.body.append(host);
    const c = B.createCallCard(host, { state: 'incoming', name: 'Мария', number: '89991234567' });
    const inc = Array.from(host.querySelectorAll<HTMLElement>('.b24-callcard__round')).map((e) => [e.className.includes('is-answer'), e.getAttribute('title'), e.offsetWidth === e.offsetHeight]);
    c.setState('active');
    const end = host.querySelector<HTMLElement>('.b24-callcard__hangup')!;
    const res = { inc, end: [end.classList.contains('is-end'), end.getAttribute('aria-label'), end.offsetWidth === end.offsetHeight, getComputedStyle(end).borderRadius] };
    host.remove();
    return res;
  });
  expect(r.inc).toEqual([[true, 'Ответить', true], [false, 'Отклонить', true]]);
  expect(r.end.slice(0, 3)).toEqual([true, 'Завершить', true]);
  expect(r.end[3]).toMatch(/50%|^\d/);
});

test('карточка звонка floating: перетаскивание за шапку, clamp, запоминание, сброс, Alt+стрелки', async ({ page }) => {
  await open(page, '/phone.html');
  if ((page.viewportSize()?.width ?? 1280) <= 768) test.skip(true, 'на узком экране карточка на всю ширину и не двигается');
  await page.evaluate(() => {
    const B = (window as any).B24UI;
    (window as any).__store = {};
    B.setStorage({ get: (k: string) => (window as any).__store[k] ?? null, set: (k: string, v: string | null) => { if (v === null) delete (window as any).__store[k]; else (window as any).__store[k] = v; } });
    (window as any).__moves = [];
    (window as any).__cc = B.createCallCard(document.body, { floating: true, state: 'active', name: 'Мария', number: '89991234567', onMove: (p: any) => (window as any).__moves.push(p) });
  });
  const card = page.locator('.b24-callcard--floating').last();
  const who = card.locator('.b24-callcard__who');
  const rect = () => card.evaluate((c) => { const r = c.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; });
  const r0 = await rect();
  const wb = (await who.boundingBox())!;
  // мышь: тянем за имя
  await page.mouse.move(wb.x + 10, wb.y + 10);
  await page.mouse.down();
  await page.mouse.move(wb.x - 190, wb.y + 110, { steps: 5 });
  await page.mouse.up();
  const r1 = await rect();
  expect(r1.x).toBe(r0.x - 200);
  expect(r1.y).toBe(r0.y + 100);
  expect(await page.evaluate(() => (window as any).__moves.length)).toBe(1);
  expect(JSON.parse(await page.evaluate(() => (window as any).__store['b24-callcard:pos']))).toEqual({ x: r1.x, y: r1.y });
  // не за кнопки: клик по кнопке карточки не двигает
  // clamp: за пределы окна не уходит
  await page.evaluate(() => (window as any).__cc.setPosition({ x: -500, y: 99999 }));
  const r2 = await rect();
  expect(r2.x).toBe(8);
  expect(r2.y + r2.h).toBeLessThanOrEqual((page.viewportSize()!.height) - 8 + 1);
  // Alt + стрелки
  await who.focus();
  await page.keyboard.press('Alt+ArrowRight');
  expect((await rect()).x).toBe(r2.x + 16);
  await page.keyboard.press('Alt+Shift+ArrowUp');
  expect((await rect()).y).toBe(r2.y - 64);
  // resize: возвращается в видимую область
  await page.evaluate(() => (window as any).__cc.setPosition({ x: 700, y: 100 }));
  await page.setViewportSize({ width: 900, height: 700 });
  await expect.poll(async () => (await rect()).x + (await rect()).w).toBeLessThanOrEqual(900);
  // двойной щелчок — на место по умолчанию
  await who.dblclick();
  await expect(card).not.toHaveClass(/is-moved/);
  expect(await page.evaluate(() => (window as any).__store['b24-callcard:pos'])).toBeUndefined();
  expect(await page.evaluate(() => (window as any).__moves.at(-1))).toBeNull();
  // запомненная позиция подхватывается новой карточкой
  await page.evaluate(() => { (window as any).__cc.setPosition({ x: 300, y: 200 }); (window as any).__cc.destroy(); (window as any).__cc = (window as any).B24UI.createCallCard(document.body, { floating: true, state: 'incoming', name: 'Иван' }); });
  const again = await page.locator('.b24-callcard--floating').last().evaluate((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; });
  expect(again).toEqual([300, 200]);
});

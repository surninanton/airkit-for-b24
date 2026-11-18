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
  await expect(card.locator('.b24-callcard__foot .b24-btn')).toHaveText(['Ответить', 'Отклонить']);
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

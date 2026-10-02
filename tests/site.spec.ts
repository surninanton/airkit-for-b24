import { test, expect } from '@playwright/test';
import { open, noHorizontalScroll, isMobile } from './helpers';

const SITE_PAGES = ['site.html', 'landing.html', 'about.html', 'article.html', 'blog.html', 'docs.html'];

test.describe('страницы сайта', () => {
  for (const path of SITE_PAGES) {
    test(`${path}: без ошибок и горизонтальной прокрутки`, async ({ page }) => {
      const { errors } = await open(page, `/${path}`);
      await page.waitForLoadState('networkidle');
      await noHorizontalScroll(page);
      expect(errors()).toEqual([]);
    });
  }
});

test.describe('шапка', () => {
  test('бургер открывает и закрывает меню, Esc закрывает', async ({ page }) => {
    test.skip(!isMobile(page), 'бургер только на узком экране');
    await open(page, '/blog.html');
    const header = page.locator('.b24-site-header');
    const burger = page.locator('.b24-site-header__burger');
    await expect(burger).toHaveAttribute('aria-label', 'Открыть меню');
    await burger.click();
    await expect(header).toHaveClass(/is-menu-open/);
    await expect(burger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.b24-site-nav')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(header).not.toHaveClass(/is-menu-open/);
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
  });

  test('группа меню закрывается по Esc и кликом мимо', async ({ page }) => {
    test.skip(isMobile(page), 'на десктопе');
    await open(page, '/landing.html');
    const group = page.locator('details.b24-site-nav__group').first();
    await group.locator('summary').click();
    await expect(group).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(group).not.toHaveAttribute('open', '');
    await group.locator('summary').click();
    await page.mouse.click(640, 600);
    await expect(group).not.toHaveAttribute('open', '');
  });

  test('двойной клик по пункту меню не выделяет текст страницы', async ({ page }) => {
    test.skip(isMobile(page), 'на десктопе');
    await open(page, '/landing.html');
    await page.locator('details.b24-site-nav__group summary').first().dblclick();
    expect(await page.evaluate(() => String(getSelection()))).toBe('');
  });
});

test.describe('мегаменю с категориями', () => {
  const checked = (page: import('@playwright/test').Page) =>
    page.locator('.b24-megamenu--panes .b24-megamenu__cat-label input').evaluateAll((l) => l.map((i) => (i as HTMLInputElement).checked));

  test('десктоп: клик, наведение и стрелки переключают категорию', async ({ page }) => {
    test.skip(isMobile(page), 'на десктопе');
    await open(page, '/blog.html');
    await page.locator('.b24-site-nav__group:has(.b24-megamenu--panes) > summary').click();
    const menu = page.locator('.b24-megamenu--panes');
    await expect(menu).toBeVisible();
    expect((await menu.boundingBox())!.width).toBeLessThanOrEqual(900);
    expect(await checked(page)).toEqual([true, false, false]);
    const panes = menu.locator('.b24-megamenu__pane');
    await expect(panes.nth(0)).toBeVisible();

    await menu.locator('.b24-megamenu__cat-label').nth(1).click();
    expect(await checked(page)).toEqual([false, true, false]);
    await expect(panes.nth(1).locator('.b24-megamenu__empty')).toBeVisible();

    await menu.locator('.b24-megamenu__cat-label').nth(2).hover();
    await expect.poll(() => checked(page)).toEqual([false, false, true]);
    await expect(panes.nth(2).locator('.b24-megamenu__tag').first()).toBeVisible();

    await menu.locator('.b24-megamenu__cat-label input').nth(2).focus();
    await page.keyboard.press('ArrowUp');
    expect(await checked(page)).toEqual([false, true, false]);
  });

  test('мобильный: аккордеон, повторный тап сворачивает', async ({ page }) => {
    test.skip(!isMobile(page), 'на узком экране');
    await open(page, '/blog.html');
    await page.locator('.b24-site-header__burger').click();
    await page.locator('.b24-site-nav__group:has(.b24-megamenu--panes) > summary').click();
    expect(await checked(page)).toEqual([false, false, false]);
    const label = page.locator('.b24-megamenu__cat-label').nth(2);
    await label.click();
    expect(await checked(page)).toEqual([false, false, true]);
    const pane = page.locator('.b24-megamenu__pane').nth(2);
    await expect(pane).toBeVisible();
    // пункты идут под заголовком категории, а не во второй колонке
    expect((await pane.boundingBox())!.y).toBeGreaterThanOrEqual((await label.boundingBox())!.y + 30);
    await label.click();
    expect(await checked(page)).toEqual([false, false, false]);
    await noHorizontalScroll(page);
  });
});

test.describe('статья', () => {
  test('оглавление собирается из заголовков и подсвечивает раздел', async ({ page }) => {
    await open(page, '/article.html');
    const links = page.locator('.b24-toc a');
    await expect(links).toHaveText(['Зачем нужен регулярный запуск', 'Настройка за пять минут', 'Фильтр элементов', 'Расписание', 'Что дальше']);
    if (isMobile(page)) return; // на узком экране оглавление уходит из колонки — подсветку проверяем на десктопе
    for (const name of ['Настройка за пять минут', 'Расписание', 'Что дальше']) {
      await links.filter({ hasText: name }).click();
      await expect(page.locator('.b24-toc a.is-active')).toHaveText(name);
    }
  });
});

test.describe('якорное меню лендинга', () => {
  test('подсвечивает секцию, к которой перешли', async ({ page }) => {
    await open(page, '/landing.html');
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
    for (const id of ['pricing', 'compare', 'faq']) {
      await page.evaluate((id) => document.getElementById(id)!.scrollIntoView({ behavior: 'instant' }), id);
      await expect(page.locator('.b24-anchor-nav__link.is-active')).toHaveAttribute('href', `#${id}`);
    }
  });

  test('переключатель тарифа месяц/год без скриптов', async ({ page }) => {
    await open(page, '/landing.html');
    const month = page.locator('.b24-plan__amount[data-period="month"]').first();
    const year = page.locator('.b24-plan__amount[data-period="year"]').first();
    await expect(month).toBeVisible();
    await expect(year).toBeHidden();
    await page.locator('label[for="p-year"]').click();
    await expect(year).toBeVisible();
    await expect(month).toBeHidden();
  });
});

test.describe('уведомление о cookie и тема', () => {
  test('cookie: показывается один раз, согласие запоминается', async ({ page }) => {
    await open(page, '/docs.html');
    const cookie = page.locator('.b24-cookie');
    await expect(cookie).toBeVisible();
    await cookie.locator('[data-b24-cookie-accept]').click();
    await expect(cookie).toBeHidden();
    await page.reload();
    await expect(page.locator('.b24-site-header')).toHaveClass(/is-enhanced/);
    await expect(cookie).toBeHidden();
  });

  test('переключатель темы запоминает выбор', async ({ page }) => {
    test.skip(isMobile(page), 'кнопка в шапке на десктопе');
    await open(page, '/docs.html');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-b24-theme', 'light');
    await page.locator('[data-b24-theme-switch]').click();
    await expect(html).toHaveAttribute('data-b24-theme', 'dark');
    await expect(page.locator('[data-b24-theme-switch]')).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(html).toHaveAttribute('data-b24-theme', 'dark');
  });
});

test.describe('форма обратной связи', () => {
  test('ошибки полей после попытки отправки, затем состояние «отправлено»', async ({ page }) => {
    await open(page, '/about.html');
    const form = page.locator('#feedback');
    const status = form.locator('.b24-form-status--success');
    const hint = form.locator('.b24-field__error-hint').first();
    await expect(status).toBeHidden();
    await expect(hint).toBeHidden();

    await form.locator('button[type="submit"]').click();
    await expect(hint).toBeVisible();
    expect(await form.locator('#f-name').evaluate((i) => i.matches(':user-invalid'))).toBe(true);

    await form.locator('#f-name').fill('Тест');
    await form.locator('#f-mail').fill('test@example.com');
    await form.locator('.b24-consent input').check();
    await form.locator('button[type="submit"]').click();
    await expect(form).toHaveClass(/is-sent/);
    await expect(status).toBeVisible();
    await expect(form.locator('.b24-form-row')).toBeHidden();
  });

  test('галочка согласия на стеклянной форме видна', async ({ page }) => {
    await open(page, '/about.html');
    const bg = await page.locator('.b24-site-form--glass .b24-consent input').evaluate((i) => getComputedStyle(i).backgroundImage);
    expect(bg).toContain('0075ff');
  });
});

test.describe('печать', () => {
  test('документ печатается без шапки, подвала и вкладок', async ({ page }) => {
    await open(page, '/docs.html');
    await page.emulateMedia({ media: 'print' });
    for (const sel of ['.b24-site-header', '.b24-site-footer', '.b24-page-bar__tabs', '.b24-cookie']) {
      await expect(page.locator(sel).first()).toBeHidden();
    }
    await expect(page.locator('.b24-document h1')).toBeVisible();
  });
});

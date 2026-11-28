import { test, expect } from '@playwright/test';
import { open } from './helpers';

const makeImage = `(kind) => {
  const c = document.createElement('canvas'); c.width = 400; c.height = 300;
  const g = c.getContext('2d');
  for (let y = 0; y < 300; y += 6) for (let x = 0; x < 400; x += 6) {
    const n = Math.random();
    const v = kind === 'white' ? 245 + n * 10 : kind === 'dark' ? 10 + n * 6 : kind === 'busy-light' ? 150 + n * 100 : 40 + n * 90;
    g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v * 0.95) + ')'; g.fillRect(x, y, 6, 6);
  }
  return c.toDataURL('image/png');
}`;

test('обои страницы: светлая картинка затемняется сильно, тёмная — слабо, переменные и атрибут ставятся', async ({ page }) => {
  const { errors } = await open(page, '/screens.html');
  const run = (kind: string) => page.evaluate(async ({ kind, makeImage }) => {
    const B = (window as any).B24UI;
    const src = eval(makeImage)(kind);
    const a = await B.setAirWallpaper(src);
    const cs = getComputedStyle(document.documentElement);
    return { a, attr: document.documentElement.dataset.b24Wallpaper, side: cs.getPropertyValue('--b24-wp-a-side').trim(), bg: document.documentElement.style.getPropertyValue('--b24-air-bg-image') };
  }, { kind, makeImage });
  const white = await run('white');
  expect(white.a.fallback).toBe(false);
  // белый текст на почти белом: нужен контраст 4.5:1 → затемнение не меньше ≈0.82
  expect(white.a.sidebar).toBeGreaterThanOrEqual(0.8);
  expect(white.attr).toBe('light');
  expect(white.side).toBe(String(white.a.sidebar));
  expect(white.bg).toContain('url(');
  const dark = await run('dark');
  expect(dark.a.sidebar).toBeLessThan(0.45);
  expect(dark.attr).toBe('dark');
  const busy = await run('busy-light');
  expect(busy.a.sidebar).toBeGreaterThan(dark.a.sidebar);
  expect(busy.a.blur).toBeGreaterThan(dark.a.blur);
  // strength
  const strong = await page.evaluate(async ({ makeImage }) => (await (window as any).B24UI.setAirWallpaper(eval(makeImage)('mid'), { strength: 'strong' })).sidebar, { makeImage });
  const soft = await page.evaluate(async ({ makeImage }) => (await (window as any).B24UI.setAirWallpaper(eval(makeImage)('mid'), { strength: 'soft' })).sidebar, { makeImage });
  expect(strong).toBeGreaterThanOrEqual(soft);
  // нечитаемая картинка — осторожные значения по умолчанию
  const bad = await page.evaluate(async () => (window as any).B24UI.setAirWallpaper('data:image/png;base64,AAAA'));
  expect(bad.fallback).toBe(true);
  // сброс
  await page.evaluate(() => (window as any).B24UI.setAirWallpaper(null));
  expect(await page.evaluate(() => document.documentElement.dataset.b24Wallpaper ?? '')).toBe('');
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--b24-air-bg-image'))).toBe('');
  expect(errors().filter((e) => !/Failed to load resource|wallpaper/i.test(e))).toEqual([]);
});

test('обои страницы: scrimFor даёт нужный контраст белому тексту', async ({ page }) => {
  await open(page, '/screens.html');
  const r = await page.evaluate(() => {
    const B = (window as any).B24UI;
    const lin = (L: number, a: number) => (1 - a) * L + a * 0.005;
    const contrast = (L: number) => 1.05 / (L + 0.05);
    return [1, 0.6, 0.3, 0.1].map((L) => ({ L, a: B.scrimFor(L, 4.5), c: contrast(lin(L, B.scrimFor(L, 4.5))) }));
  });
  for (const x of r) expect(x.c).toBeGreaterThanOrEqual(4.49);
});

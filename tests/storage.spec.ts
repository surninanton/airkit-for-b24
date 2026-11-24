import { test, expect } from '@playwright/test';
import { open } from './helpers';

test('setStorage: состояние грида, размер страницы и тема идут через своё хранилище', async ({ page }) => {
  const { errors } = await open(page, '/index.html');
  const r = await page.evaluate(() => {
    const B24UI = (window as any).B24UI;
    const store: Record<string, string> = { 'b24-grid:srv': JSON.stringify({ hidden: ['b'], widths: { a: 222 } }) };
    const log: string[] = [];
    B24UI.setStorage({ get: (k: string) => store[k] ?? null, set: (k: string, v: string | null) => { log.push(k); if (v === null) delete store[k]; else store[k] = v; } });
    const mk = () => {
      const wrap = document.createElement('div');
      wrap.className = 'b24-table-wrap';
      wrap.innerHTML = '<table class="b24-table"><thead><tr><th data-key="a">A</th><th data-key="b">B</th><th data-key="c">C</th></tr></thead><tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table>';
      document.querySelector('.b24-page')!.append(wrap);
      return wrap.querySelector('table')!;
    };
    // состояние пришло из хранилища
    const changes: any[] = [];
    const g = B24UI.initGrid(mk(), { id: 'srv', onChange: (s: any) => changes.push(s) });
    const loaded = g.getState();
    // изменение уходит в хранилище и в onChange
    g.setState({ hidden: ['b', 'c'] });
    const saved = JSON.parse(store['b24-grid:srv']);
    // option state главнее хранилища
    const g2 = B24UI.initGrid(mk(), { id: 'srv2', state: { hidden: ['a'] } });
    const fromOpt = g2.getState().hidden;
    // сброс удаляет ключ
    g.reset();
    const afterReset = 'b24-grid:srv' in store;
    B24UI.setStorage(null);
    return { hidden: loaded.hidden, w: loaded.widths.a, saved: saved.hidden, changes: changes.length, fromOpt, afterReset, logged: log.includes('b24-grid:srv') };
  });
  expect(r.hidden).toEqual(['b']);
  expect(r.w).toBe(222);
  expect(r.saved).toEqual(['b', 'c']);
  expect(r.changes).toBeGreaterThan(0);
  expect(r.fromOpt).toEqual(['a']);
  expect(r.afterReset).toBe(false);
  expect(r.logged).toBe(true);
  expect(errors()).toEqual([]);
});

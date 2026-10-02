import { escapeHtml } from './dom';

/**
 * Клиентская сортировка таблицы: <table data-b24-sortable> и <th aria-sort="none">.
 * Значение ячейки берётся из data-sort-value, иначе из текста. Числа сравниваются как числа.
 */
export function initSortableTable(table: HTMLTableElement): void {
  if (table.dataset.b24Ready) return;
  table.dataset.b24Ready = '1';
  const heads = Array.from(table.tHead?.rows[0]?.cells ?? []);
  heads.forEach((th) => {
    if (!th.hasAttribute('aria-sort')) return;
    th.tabIndex = 0;
    const run = () => {
      // номер столбца — на момент клика: грид мог переставить или добавить столбцы
      const index = Array.from(th.parentElement!.children).indexOf(th);
      const allHeads = Array.from(th.parentElement!.children) as HTMLTableCellElement[];
      const dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
      allHeads.forEach((other) => other.hasAttribute('aria-sort') && other.setAttribute('aria-sort', 'none'));
      th.setAttribute('aria-sort', dir);
      const event = new CustomEvent('b24:sort', { detail: { index, key: th.dataset.key, dir }, bubbles: true, cancelable: true });
      if (!table.dispatchEvent(event)) return; // серверная сортировка: preventDefault()
      const body = table.tBodies[0];
      const rows = Array.from(body.rows);
      const value = (row: HTMLTableRowElement) => {
        const cell = row.cells[index];
        return cell?.dataset.sortValue ?? cell?.textContent?.trim() ?? '';
      };
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
      rows.sort((a, b) => {
        const va = value(a), vb = value(b);
        const na = Number(va.replace(/\s/g, '').replace(',', '.')), nb = Number(vb.replace(/\s/g, '').replace(',', '.'));
        const cmp = !isNaN(na) && !isNaN(nb) && va !== '' && vb !== '' ? na - nb : collator.compare(va, vb);
        return dir === 'ascending' ? cmp : -cmp;
      });
      body.append(...rows);
    };
    th.addEventListener('click', run);
    th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); } });
  });

  // «Выбрать все» — чекбокс в шапке с data-b24-check-all
  const all = table.querySelector<HTMLInputElement>('thead input[data-b24-check-all]');
  if (all) {
    const boxes = () => Array.from(table.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]'));
    const sync = () => {
      const list = boxes();
      const checked = list.filter((b) => b.checked).length;
      all.checked = checked > 0 && checked === list.length;
      all.indeterminate = checked > 0 && checked < list.length;
      list.forEach((b) => b.closest('tr')?.setAttribute('aria-selected', String(b.checked)));
      table.dispatchEvent(new CustomEvent('b24:selection', { detail: { count: checked }, bubbles: true }));
    };
    all.addEventListener('change', () => { boxes().forEach((b) => (b.checked = all.checked)); sync(); });
    table.addEventListener('change', (e) => { if ((e.target as HTMLElement).closest('tbody')) sync(); });
  }
}

/* ── Богатые ячейки ─────────────────────────────────────── */
export interface DiffOptions {
  /** подпись поля перед значениями */
  field?: string;
  /** текст пустого значения */
  emptyText?: string;
}

const isEmptyValue = (v: unknown) => v == null || v === '';

/** «Поле: ~~было~~ → станет»; одинаковые — «значение (без изменений)», пустые — «пусто» */
export function diffHtml(before: unknown, after: unknown, options: DiffOptions = {}): string {
  const empty = `<span class="b24-diff__empty">${escapeHtml(options.emptyText ?? 'пусто')}</span>`;
  const val = (v: unknown) => (isEmptyValue(v) ? empty : escapeHtml(String(v)));
  const field = options.field ? `<span class="b24-diff__field">${escapeHtml(options.field)}</span>` : '';
  if (String(before ?? '') === String(after ?? '')) return `<span class="b24-diff b24-diff--same">${field}<span class="b24-diff__value">${val(after)}</span></span>`;
  // «пусто» не зачёркиваем и не подсвечиваем — это не значение
  const old = isEmptyValue(before) ? empty : `<del>${val(before)}</del>`;
  const next = isEmptyValue(after) ? empty : `<ins>${val(after)}</ins>`;
  return `<span class="b24-diff">${field}${old}<span class="b24-diff__arrow" aria-label="станет">→</span>${next}</span>`;
}

/** Ссылка-чип на карточку: «#123 ООО Ромашка» */
export function chipHtml(title: string, options: { href?: string; id?: string | number; avatar?: string } = {}): string {
  const tag = options.href ? 'a' : 'span';
  const href = options.href ? ` href="${escapeHtml(options.href)}" target="_top"` : '';
  const id = options.id != null ? `<span class="b24-chip__id">#${escapeHtml(String(options.id))}</span>` : '';
  const avatar = options.avatar ? `<img class="b24-avatar" src="${escapeHtml(options.avatar)}" alt="">` : '';
  return `<${tag} class="b24-chip"${href}>${avatar}${id}<span>${escapeHtml(title)}</span></${tag}>`;
}

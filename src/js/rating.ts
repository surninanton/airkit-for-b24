import { h } from './dom';
import { t } from './i18n';

/* ── Оценка звёздами ───────────────────────────────────────
 * createRating(host, { name, value, max, readonly }) или разметкой:
 *   <div data-b24-rating data-name="rating" data-value="0" data-max="5"></div>   (data-readonly — только показ)
 * Скрытое поле name уходит с формой. Мышь: наведение подсвечивает, клик ставит, клик по текущей — сброс в 0.
 * Клавиатура: ←/→ (↑/↓) ±1, Home/End, цифры 0–9, Delete — 0. Событие b24:rating-change { value }.
 */
export interface RatingOptions {
  /** имя скрытого поля формы */
  name?: string;
  value?: number;
  /** число звёзд, по умолчанию 5 */
  max?: number;
  /** только показ: без наведения, клика и фокуса */
  readonly?: boolean;
  disabled?: boolean;
  /** повторный клик по текущей оценке сбрасывает её в 0 (по умолчанию да) */
  clearable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** подпись для скринридера, по умолчанию «Оценка» */
  label?: string;
  onChange?: (value: number) => void;
}
export interface RatingHandle {
  element: HTMLElement;
  getValue(): number;
  setValue(value: number, silent?: boolean): void;
  setReadonly(readonly: boolean): void;
  destroy(): void;
}

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.83 5.73 6.32.92-4.57 4.46 1.08 6.3L12 17.24l-5.66 2.97 1.08-6.3-4.57-4.46 6.32-.92z"/></svg>';
const registry = new WeakMap<HTMLElement, RatingHandle>();
export const getRating = (el: HTMLElement | null): RatingHandle | undefined => (el ? registry.get(el) : undefined);

export function createRating(host: HTMLElement, options: RatingOptions = {}): RatingHandle {
  const max = Math.max(1, Math.floor(options.max ?? 5));
  const clamp = (v: number) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
  let value = clamp(options.value ?? 0);
  const initial = value;
  let readonly = !!options.readonly;
  const disabled = !!options.disabled;
  const label = options.label ?? t('Оценка');

  const root = h('div', { class: `b24-rating${options.size && options.size !== 'md' ? ` b24-rating--${options.size}` : ''}` });
  const stars: HTMLElement[] = [];
  for (let i = 1; i <= max; i++) {
    const s = h('span', { class: 'b24-rating__star', 'data-value': String(i) });
    s.innerHTML = STAR;
    stars.push(s);
    root.append(s);
  }
  const input = options.name ? h('input', { type: 'hidden', name: options.name, value: String(value) }) as HTMLInputElement : null;
  if (input) root.append(input);
  host.append(root);

  const paint = (shown: number) => stars.forEach((s, i) => s.classList.toggle('is-on', i < shown));
  const sync = () => {
    paint(value);
    if (input) input.value = String(value);
    root.classList.toggle('is-readonly', readonly);
    root.classList.toggle('is-disabled', disabled);
    const text = t('{label}: {value} из {max}', { label, value, max });
    if (readonly) {
      root.setAttribute('role', 'img');
      root.setAttribute('aria-label', text);
      root.removeAttribute('tabindex');
      ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'aria-disabled'].forEach((a) => root.removeAttribute(a));
    } else {
      root.setAttribute('role', 'slider');
      root.setAttribute('aria-label', label);
      root.setAttribute('aria-valuemin', '0');
      root.setAttribute('aria-valuemax', String(max));
      root.setAttribute('aria-valuenow', String(value));
      root.setAttribute('aria-valuetext', text);
      if (disabled) { root.setAttribute('aria-disabled', 'true'); root.removeAttribute('tabindex'); } else root.tabIndex = 0;
    }
  };
  const set = (next: number, silent = false) => {
    const v = clamp(next);
    if (v === value) { sync(); return; }
    value = v;
    sync();
    if (silent) return;
    options.onChange?.(value);
    host.dispatchEvent(new CustomEvent('b24:rating-change', { detail: { value }, bubbles: true }));
    input?.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const active = () => !readonly && !disabled;

  const starOf = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>('.b24-rating__star');
  const onMove = (e: Event) => { const s = starOf(e); if (active() && s) paint(Number(s.dataset.value)); };
  const onLeave = () => paint(value);
  const onClick = (e: Event) => {
    const s = starOf(e);
    if (!active() || !s) return;
    const v = Number(s.dataset.value);
    set(v === value && options.clearable !== false ? 0 : v);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!active()) return;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = value + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = value - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = max;
    else if (e.key === 'Delete' || e.key === 'Backspace') next = 0;
    else if (/^\d$/.test(e.key) && Number(e.key) <= max) next = Number(e.key);
    if (next === null) return;
    e.preventDefault();
    set(next);
  };
  // сброс формы возвращает начальную оценку
  const form = host.closest('form');
  const onReset = () => setTimeout(() => set(initial, true));
  root.addEventListener('mouseover', onMove);
  root.addEventListener('mouseleave', onLeave);
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  form?.addEventListener('reset', onReset);
  sync();

  const handle: RatingHandle = {
    element: root,
    getValue: () => value,
    setValue: (v, silent = false) => set(v, silent),
    setReadonly(next) { readonly = next; paint(value); sync(); },
    destroy() { form?.removeEventListener('reset', onReset); root.remove(); registry.delete(host); registry.delete(root); },
  };
  registry.set(host, handle);
  registry.set(root, handle);
  return handle;
}

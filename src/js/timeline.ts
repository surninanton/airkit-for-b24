/**
 * Композер таймлайна: [data-b24-composer]
 *   .b24-tabs [data-b24-composer-tab="comment" data-placeholder="…"]
 *   textarea.b24-composer__input
 *   [data-b24-composer-submit], [data-b24-composer-cancel]
 * Событие b24:composer-submit { text, tab } (cancelable: preventDefault — не очищать поле).
 */
import { getLocale, intlLocale, t } from './i18n';
export interface ComposerHandle { focus(): void; clear(): void; destroy(): void }

export function autoResize(textarea: HTMLTextAreaElement): () => void {
  const fit = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };
  textarea.addEventListener('input', fit);
  fit();
  return () => textarea.removeEventListener('input', fit);
}

export function initComposer(root: HTMLElement, onSubmit?: (text: string, tab: string | null) => void | Promise<void>): ComposerHandle {
  const input = root.querySelector<HTMLTextAreaElement>('.b24-composer__input')!;
  const submitBtn = root.querySelector<HTMLButtonElement>('[data-b24-composer-submit]');
  let tab: string | null = root.querySelector<HTMLElement>('[data-b24-composer-tab][aria-selected="true"], [data-b24-composer-tab].is-active')?.dataset.b24ComposerTab ?? null;
  const unResize = autoResize(input);

  const expand = () => root.classList.add('is-expanded');
  const collapse = () => { if (!input.value.trim()) root.classList.remove('is-expanded'); };
  const sync = () => { if (submitBtn) submitBtn.disabled = !input.value.trim(); };

  const submit = async () => {
    const text = input.value.trim();
    if (!text) return;
    const ev = new CustomEvent('b24:composer-submit', { detail: { text, tab }, bubbles: true, cancelable: true });
    submitBtn?.classList.add('b24-btn--loading');
    try {
      await onSubmit?.(text, tab);
      if (root.dispatchEvent(ev)) { input.value = ''; input.dispatchEvent(new Event('input')); sync(); root.classList.remove('is-expanded'); }
    } finally {
      submitBtn?.classList.remove('b24-btn--loading');
    }
  };

  const onClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    const tabBtn = t.closest<HTMLElement>('[data-b24-composer-tab]');
    if (tabBtn) {
      tab = tabBtn.dataset.b24ComposerTab!;
      root.querySelectorAll<HTMLElement>('[data-b24-composer-tab]').forEach((b) => {
        const on = b === tabBtn;
        b.setAttribute('aria-selected', String(on));
        b.classList.toggle('is-active', on);
      });
      if (tabBtn.dataset.placeholder) input.placeholder = tabBtn.dataset.placeholder;
      expand();
      input.focus();
    }
    if (t.closest('[data-b24-composer-submit]')) void submit();
    if (t.closest('[data-b24-composer-cancel]')) { input.value = ''; input.dispatchEvent(new Event('input')); sync(); root.classList.remove('is-expanded'); }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); }
    if (e.key === 'Escape' && !input.value) { input.blur(); root.classList.remove('is-expanded'); }
  };

  input.addEventListener('focus', expand);
  input.addEventListener('blur', collapse);
  input.addEventListener('input', sync);
  input.addEventListener('keydown', onKey);
  root.addEventListener('click', onClick);
  sync();

  return {
    focus: () => input.focus(),
    clear: () => { input.value = ''; input.dispatchEvent(new Event('input')); sync(); },
    destroy() {
      unResize();
      input.removeEventListener('focus', expand);
      input.removeEventListener('blur', collapse);
      input.removeEventListener('input', sync);
      input.removeEventListener('keydown', onKey);
      root.removeEventListener('click', onClick);
    },
  };
}

/** «сегодня, 14:05» / «вчера, 09:12» / «12 сентября, 18:00» */
export function formatTimelineTime(date: Date, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(date)) / 86400000);
  if (diff === 0) return time;
  if (diff === 1) return t('вчера, {time}', { time });
  if (getLocale() !== 'ru') {
    const sameYear = date.getFullYear() === now.getFullYear();
    return `${date.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long', year: sameYear ? undefined : 'numeric' })}, ${time}`;
  }
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${date.getDate()} ${months[date.getMonth()]}${date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : ''}, ${time}`;
}

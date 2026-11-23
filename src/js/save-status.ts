/**
 * Индикатор автосохранения: «Сохраняю… / Сохранено · 14:32 / Не сохранено — повторяю».
 * Для шапки страницы (слот tools/extra) или шапки панели; `role="status"`, меняется без перехвата фокуса.
 *
 *   const st = createSaveStatus(slot);
 *   st.setState('saving');                 // спиннер + «Сохраняю…»
 *   st.setState('saved');                  // галочка + «Сохранено · 14:32» (время — сейчас; можно { time: Date })
 *   st.setState('error', { text: 'Нет сети — повторяю' });   // красный; text заменяет подпись любого состояния
 *   st.setState('neutral', { text: 'Опубликованная версия' });   // серый текст без значка
 *   st.setState('idle');                   // пусто
 */
import { icon } from '../icons';
import { h } from './dom';
import { t } from './i18n';

/** neutral — спокойная подпись без значка: «Опубликованная версия», «Новая статья» (текст — через setState(…, { text }) или labels.neutral) */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'neutral';
export interface SaveStatusOptions {
  state?: SaveState;
  /** свои подписи состояний */
  labels?: Partial<Record<Exclude<SaveState, 'idle'>, string>>;
  /** без текста, только значок (текст остаётся для скринридера и в title) */
  compact?: boolean;
}
export interface SaveStatusHandle {
  element: HTMLElement;
  state(): SaveState;
  setState(state: SaveState, opts?: { time?: Date; text?: string }): void;
  destroy(): void;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function createSaveStatus(host: HTMLElement, options: SaveStatusOptions = {}): SaveStatusHandle {
  const root = h('span', { class: `b24-savestatus${options.compact ? ' b24-savestatus--compact' : ''}`, role: 'status', 'aria-live': 'polite' });
  const ico = h('span', { class: 'b24-savestatus__icon', 'aria-hidden': 'true' });
  const text = h('span', { class: 'b24-savestatus__text' });
  root.append(ico, text);
  host.append(root);
  let current: SaveState = 'idle';

  const setState: SaveStatusHandle['setState'] = (state, opts = {}) => {
    current = state;
    root.dataset.state = state;
    root.hidden = state === 'idle' || (state === 'neutral' && !opts.text && !options.labels?.neutral);
    ico.replaceChildren();
    if (state === 'saving') ico.append(h('span', { class: 'b24-spinner b24-spinner--sm' }));
    else if (state === 'saved') ico.innerHTML = icon('check', { size: 14 });
    else if (state === 'error') ico.innerHTML = icon('warning', { size: 14 });
    let label = '';
    if (state === 'saving') label = options.labels?.saving ?? t('Сохраняю…');
    else if (state === 'saved') { const d = opts.time ?? new Date(); label = options.labels?.saved ?? t('Сохранено · {time}', { time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }); }
    else if (state === 'error') label = options.labels?.error ?? t('Не сохранено — повторяю');
    else if (state === 'neutral') label = options.labels?.neutral ?? '';
    if (opts.text) label = opts.text;
    text.textContent = label;
    root.title = label;
  };
  setState(options.state ?? 'idle');
  return { element: root, state: () => current, setState, destroy() { root.remove(); } };
}

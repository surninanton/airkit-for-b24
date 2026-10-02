/* ── Язык встроенных подписей ──────────────────────────────
 * Ключ — сама русская фраза: t('Сохранить'), t('Выбрано: {n}', { n: 3 }). Без перевода остаётся русский текст,
 * поэтому язык можно добавлять частично. Встроены ru (по умолчанию) и en.
 *
 *   B24UI.setLocale('en')                         — английский
 *   B24UI.addMessages('kk', { 'Сохранить': 'Сақтау' }); B24UI.setLocale('kk') — свой язык
 *
 * По умолчанию язык берётся из <html lang="…"> (en*, иначе ru). Язык выбирают до отрисовки компонентов:
 * уже показанные подписи не переводятся.
 */
import { en } from './i18n/en';

export type Messages = Record<string, string>;
const catalogs: Record<string, Messages> = { ru: {}, en };
let current: string | null = null;

const detect = (): string => {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang.toLowerCase() : '';
  return lang.startsWith('en') ? 'en' : 'ru';
};

export function getLocale(): string {
  return current ?? detect();
}

export function setLocale(locale: string): void {
  current = locale;
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('b24:locale-change', { detail: { locale } }));
}

/** добавить или дополнить словарь языка */
export function addMessages(locale: string, messages: Messages): void {
  catalogs[locale] = { ...catalogs[locale], ...messages };
}

/** Перевод фразы; {name} в тексте заменяются значениями params */
export function t(phrase: string, params?: Record<string, string | number>): string {
  const loc = getLocale();
  const text = loc === 'ru' ? phrase : catalogs[loc]?.[phrase] ?? phrase;
  return params ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : text;
}

/** Локаль для Intl (числа, даты) */
export const intlLocale = (): string => (getLocale() === 'ru' ? 'ru-RU' : getLocale());

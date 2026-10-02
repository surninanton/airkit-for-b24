import { scrollSpy } from './site';
import { t } from './i18n';

/* ── Страница настроек ─────────────────────────────────────
 * .b24-settings[data-b24-settings] с формой внутри (или внутри формы):
 *  - меню разделов .b24-settings__link[href="#раздел"] подсвечивает раздел при прокрутке;
 *  - при изменениях показывается .b24-savebar; [data-b24-settings-reset] возвращает сохранённые значения;
 *  - при отправке — событие b24:settings-save { values, resolve, reject }. preventDefault() в обработчике —
 *    сохраните сами (fetch/BX24) и вызовите resolve() или reject(); без него форма отправится как обычно.
 *  - уход со страницы с несохранёнными изменениями спрашивает подтверждение (data-warn-unsaved="false" — не спрашивать).
 */
export interface SettingsHandle {
  /** есть ли несохранённые изменения */
  isDirty(): boolean;
  /** считать текущие значения сохранёнными (например, после загрузки с сервера) */
  markSaved(): void;
  destroy(): void;
}

function serialize(form: HTMLFormElement): string {
  const out: string[] = [];
  for (const el of Array.from(form.elements) as HTMLInputElement[]) {
    if (!el.name || el.disabled || el.type === 'submit' || el.type === 'button') continue;
    if (el.type === 'checkbox' || el.type === 'radio') out.push(`${el.name}=${el.checked ? el.value : ''}`);
    else if (el instanceof HTMLSelectElement && el.multiple) out.push(`${el.name}=${Array.from(el.selectedOptions).map((o) => o.value).join(',')}`);
    else out.push(`${el.name}=${el.value}`);
  }
  return out.join('&');
}

export function initSettings(root: HTMLElement): SettingsHandle {
  const form = (root.querySelector('form') ?? root.closest('form')) as HTMLFormElement | null;
  const savebar = root.querySelector<HTMLElement>('.b24-savebar');
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a.b24-settings__link[href^="#"]'));
  const top = () => parseFloat(getComputedStyle(root).getPropertyValue('--b24-settings-top')) || 12;
  const offSpy = links.length ? scrollSpy(links, () => top() + 24, undefined, true) : () => {};
  if (!form) return { isDirty: () => false, markSaved() {}, destroy: offSpy };

  let saved = serialize(form);
  let saving = false;
  const isDirty = () => serialize(form) !== saved;
  const sync = () => { if (savebar) savebar.hidden = !isDirty(); };
  const submitBtn = () => (savebar ?? form).querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');

  const onInput = () => sync();
  const onReset = (e: Event) => {
    if (!(e.target as HTMLElement).closest('[data-b24-settings-reset]')) return;
    e.preventDefault();
    form.reset();
    // reset() вернёт значения из разметки; после markSaved() «сохранённые» могут отличаться — восстанавливаем их
    const pairs = new Map(saved.split('&').map((p) => { const i = p.indexOf('='); return [p.slice(0, i), p.slice(i + 1)] as const; }));
    for (const el of Array.from(form.elements) as HTMLInputElement[]) {
      if (!el.name || !pairs.has(el.name)) continue;
      const v = pairs.get(el.name)!;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = v === el.value;
      else if (!(el instanceof HTMLSelectElement && el.multiple)) el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    sync();
  };
  const onSubmit = (e: SubmitEvent) => {
    if (saving) { e.preventDefault(); return; }
    const btn = submitBtn();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      saving = false;
      btn?.classList.remove('b24-btn--loading');
      if (ok) saved = serialize(form);
      sync();
    };
    const ev = new CustomEvent('b24:settings-save', {
      bubbles: true, cancelable: true,
      detail: { values: Object.fromEntries(new FormData(form)), form, resolve: () => finish(true), reject: () => finish(false) },
    });
    root.dispatchEvent(ev);
    if (ev.defaultPrevented) {
      e.preventDefault();
      if (!settled) { saving = true; btn?.classList.add('b24-btn--loading'); }
    } else saved = serialize(form); // обычная отправка: уход со страницы не должен спрашивать подтверждение
  };
  const warn = root.dataset.warnUnsaved !== 'false';
  const onUnload = (e: BeforeUnloadEvent) => { if (warn && isDirty()) { e.preventDefault(); e.returnValue = ''; } };

  form.addEventListener('input', onInput);
  form.addEventListener('change', onInput);
  root.addEventListener('click', onReset);
  form.addEventListener('submit', onSubmit);
  window.addEventListener('beforeunload', onUnload);
  sync();

  return {
    isDirty,
    markSaved() { saved = serialize(form); sync(); },
    destroy() {
      offSpy();
      form.removeEventListener('input', onInput);
      form.removeEventListener('change', onInput);
      root.removeEventListener('click', onReset);
      form.removeEventListener('submit', onSubmit);
      window.removeEventListener('beforeunload', onUnload);
    },
  };
}

/* ── Мастер ────────────────────────────────────────────────
 * .b24-wizard[data-b24-wizard]: шаги .b24-wizard__step, степпер .b24-stepper в шапке (пункты по порядку шагов),
 * кнопки [data-b24-wizard-back], [data-b24-wizard-next], [data-b24-wizard-finish].
 * Без JS шаги идут подряд одной формой. С JS виден один шаг; «Далее» проверяет поля шага (required, pattern…)
 * и шлёт b24:wizard-next { index, step, waitUntil(promise) } — например, проверить подключение:
 * пока промис не выполнен, кнопка в загрузке; отклонён — шаг помечается ошибкой и мастер остаётся на месте.
 * «Готово» — b24:wizard-finish { values, waitUntil }; без preventDefault() форма отправляется.
 */
export interface WizardHandle {
  readonly index: number;
  go(index: number): void;
  next(): Promise<boolean>;
  back(): void;
  destroy(): void;
}

export function initWizard(root: HTMLElement): WizardHandle {
  const steps = Array.from(root.querySelectorAll<HTMLElement>('.b24-wizard__step'));
  const marks = Array.from(root.querySelectorAll<HTMLElement>('.b24-stepper__item'));
  const back = root.querySelector<HTMLButtonElement>('[data-b24-wizard-back]');
  const next = root.querySelector<HTMLButtonElement>('[data-b24-wizard-next]');
  const finish = root.querySelector<HTMLButtonElement>('[data-b24-wizard-finish]');
  const counter = root.querySelector<HTMLElement>('.b24-wizard__counter');
  const form = (root instanceof HTMLFormElement ? root : root.querySelector('form') ?? root.closest('form')) as HTMLFormElement | null;
  let index = Math.max(0, steps.findIndex((s) => s.classList.contains('is-current')));
  let busy = false;
  root.classList.add('is-enhanced');

  const render = (focus = false) => {
    steps.forEach((s, i) => { s.classList.toggle('is-current', i === index); s.setAttribute('aria-hidden', String(i !== index)); });
    marks.forEach((m, i) => {
      m.classList.toggle('is-current', i === index);
      m.classList.toggle('is-done', i < index);
      if (i >= index) m.classList.remove('is-error');
      if (i === index) m.setAttribute('aria-current', 'step'); else m.removeAttribute('aria-current');
    });
    const last = index === steps.length - 1;
    if (back) back.hidden = index === 0;
    if (next) next.hidden = last;
    if (finish) finish.hidden = !last;
    if (counter) counter.textContent = t('Шаг {n} из {m}', { n: index + 1, m: steps.length });
    if (focus) {
      const title = steps[index]?.querySelector<HTMLElement>('.b24-wizard__title, h2, h3');
      if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
      root.scrollIntoView({ block: 'nearest' });
    }
    root.dispatchEvent(new CustomEvent('b24:wizard-change', { bubbles: true, detail: { index } }));
  };

  const validStep = () => {
    const fields = Array.from(steps[index]?.querySelectorAll<HTMLInputElement>('input, select, textarea') ?? []);
    const bad = fields.find((f) => !f.disabled && !f.checkValidity());
    if (bad) { bad.reportValidity(); return false; }
    return true;
  };

  /** Шлёт событие с waitUntil и ждёт промисы обработчиков; false — отменено или ошибка */
  const ask = async (type: string, detail: Record<string, unknown>, btn: HTMLButtonElement | null): Promise<{ ok: boolean; prevented: boolean }> => {
    const waits: Promise<unknown>[] = [];
    const ev = new CustomEvent(type, { bubbles: true, cancelable: true, detail: { ...detail, waitUntil: (p: Promise<unknown>) => waits.push(p) } });
    root.dispatchEvent(ev);
    if (!waits.length) return { ok: true, prevented: ev.defaultPrevented };
    busy = true;
    btn?.classList.add('b24-btn--loading');
    try { await Promise.all(waits); return { ok: true, prevented: ev.defaultPrevented }; } catch { marks[index]?.classList.add('is-error'); return { ok: false, prevented: true }; } finally {
      busy = false;
      btn?.classList.remove('b24-btn--loading');
    }
  };

  const goNext = async () => {
    if (busy || index >= steps.length - 1 || !validStep()) return false;
    marks[index]?.classList.remove('is-error');
    const r = await ask('b24:wizard-next', { index, step: steps[index] }, next);
    // preventDefault() без waitUntil — обработчик сам решил не пускать дальше
    if (!r.ok || r.prevented) return false;
    index += 1;
    render(true);
    return true;
  };
  const goBack = () => { if (!busy && index > 0) { index -= 1; render(true); } };
  const onFinish = async (e: Event) => {
    e.preventDefault();
    if (busy || !validStep()) return;
    const r = await ask('b24:wizard-finish', { values: form ? Object.fromEntries(new FormData(form)) : {} }, finish);
    if (r.ok && !r.prevented && form) form.submit();
  };
  const onClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-b24-wizard-next]')) { e.preventDefault(); void goNext(); }
    else if (t.closest('[data-b24-wizard-back]')) { e.preventDefault(); goBack(); }
    else if (t.closest('[data-b24-wizard-finish]')) void onFinish(e);
    else {
      // в степпере можно вернуться к пройденному шагу
      const m = t.closest<HTMLElement>('.b24-stepper__item');
      const i = m ? marks.indexOf(m) : -1;
      if (i >= 0 && i < index && !busy) { e.preventDefault(); index = i; render(true); }
    }
  };
  // Enter в поле шага — «Далее», а не отправка всей формы
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (e.key !== 'Enter' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || index === steps.length - 1) return;
    if (t.closest('.b24-wizard__step')) { e.preventDefault(); void goNext(); }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  render();

  return {
    get index() { return index; },
    go(i) { index = Math.min(steps.length - 1, Math.max(0, i)); render(true); },
    next: goNext,
    back: goBack,
    destroy() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      root.classList.remove('is-enhanced');
      steps.forEach((s) => s.removeAttribute('aria-hidden'));
    },
  };
}

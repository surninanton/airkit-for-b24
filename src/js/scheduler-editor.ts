import { icon, type IconName } from '../icons';
import { h, html } from './dom';
import { t } from './i18n';
import { modal, type ModalButton } from './modal';
import { datepicker, type DatePickerHandle } from './calendar';
import { timepicker, parseTime, formatTime, type TimePickerHandle } from './timepicker';
import { formatDate, parseDate } from './date';
import { dropdown, type DropdownHandle } from './dropdown';
import type { SchedulerEvent, SchedulerEventType, SchedulerEditorField, SchedulerResource } from './scheduler';

/* ── Окно редактирования встречи и контекстное меню планировщика ──
 * Вынесены из scheduler.ts: планировщик передаёт сюда данные и колбэки сохранения/удаления.
 */

export interface SchedulerMenuItem {
  id: string;
  label?: string;
  icon?: IconName;
  /** подсказка справа, например сочетание клавиш */
  hint?: string;
  danger?: boolean;
  /** пункт-переключатель (тип события): отмечен галочкой */
  checked?: boolean;
  disabled?: boolean;
  /** разделитель */
  divider?: boolean;
  /** заголовок группы */
  title?: boolean;
  onClick?: () => void;
}

/** Меню у точки экрана (правая кнопка мыши) или у элемента (клавиша меню / Shift+F10). */
export function openMenuAt(items: SchedulerMenuItem[], cx: number, cy: number): () => void {
  const anchor = h('span', { 'aria-hidden': 'true', style: `position:fixed;left:${cx}px;top:${cy}px;width:1px;height:1px;pointer-events:none` });
  document.body.append(anchor);
  const popup = h('div', { class: 'b24-popup b24-scheduler-menu' });
  const menu = h('div', { class: 'b24-menu', role: 'menu' });
  popup.append(menu);
  for (const it of items) {
    if (it.divider) { menu.append(h('div', { class: 'b24-menu__divider', role: 'separator' })); continue; }
    if (it.title) { menu.append(h('div', { class: 'b24-menu__title' }, it.label ?? '')); continue; }
    const radio = it.checked !== undefined;
    const b = h('button', {
      type: 'button', class: `b24-menu__item${it.danger ? ' b24-menu__item--danger' : ''}`,
      role: radio ? 'menuitemradio' : 'menuitem', 'aria-checked': radio ? String(it.checked) : undefined, disabled: it.disabled, 'data-id': it.id,
    });
    if (it.icon) b.append(html(icon(it.icon)));
    b.append(h('span', {}, it.label ?? ''));
    if (it.hint) b.append(h('span', { class: 'b24-menu__hint' }, it.hint));
    b.addEventListener('click', () => it.onClick?.());
    menu.append(b);
  }
  let dd: DropdownHandle | null = null;
  const cleanup = () => { const d = dd; dd = null; setTimeout(() => { d?.destroy(); popup.remove(); anchor.remove(); }); };
  dd = dropdown(anchor, popup, { placement: 'bottom-start', offset: 2, onClose: cleanup });
  dd.open();
  menu.querySelector<HTMLElement>('.b24-menu__item:not([disabled])')?.focus();
  return () => dd?.close();
}

export interface EventEditorOptions {
  event: SchedulerEvent & { start: Date; end: Date };
  isNew: boolean;
  resources: SchedulerResource[];
  types?: SchedulerEventType[];
  fields?: SchedulerEditorField[];
  comment?: boolean;
  /** шаг минут в выборе времени */
  step: number;
  /** сохранить; отклонённый промис — окно остаётся открытым и показывает ошибку */
  save: (next: SchedulerEvent & { start: Date; end: Date }) => Promise<void>;
  remove?: () => Promise<void>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : typeof e === 'string' && e ? e : t('Не удалось сохранить'));

export function openEventEditor(o: EventEditorOptions): void {
  const ev = o.event;
  const typeOf = (id?: string) => o.types?.find((x) => x.id === id);
  const uid = Math.random().toString(36).slice(2, 7);
  const form = h('form', { class: 'b24-form b24-scheduler-editor', novalidate: true });
  const alert = h('div', { class: 'b24-alert b24-alert--danger', role: 'alert', hidden: true });
  form.append(alert);

  const field = (label: string, control: HTMLElement, id: string, required = false) => {
    const err = h('div', { class: 'b24-field__error', hidden: true });
    const f = h('div', { class: 'b24-field' }, h('label', { class: `b24-field__label${required ? ' b24-field__label--required' : ''}`, for: id }, label), control, err);
    return { f, err };
  };
  const setErr = (x: { err: HTMLElement; f: HTMLElement }, msg: string) => {
    x.err.textContent = msg;
    x.err.hidden = !msg;
    x.f.querySelector('input, select, textarea')?.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  const titleIn = h('input', { class: 'b24-input', id: `se-title-${uid}`, value: ev.title ?? '', autocomplete: 'off' }) as HTMLInputElement;
  const titleF = field(t('Название'), titleIn, titleIn.id, true);
  form.append(titleF.f);

  let typeSel: HTMLSelectElement | null = null;
  const row1 = h('div', { class: 'b24-form-row' });
  if (o.types?.length) {
    typeSel = h('select', { class: 'b24-select', id: `se-type-${uid}` }) as HTMLSelectElement;
    for (const ty of o.types) typeSel.append(h('option', { value: ty.id, selected: ty.id === ev.type }, ty.label));
    if (!ev.type) typeSel.value = o.types[0].id;
    row1.append(field(t('Тип'), typeSel, typeSel.id).f);
  }
  const resSel = h('select', { class: 'b24-select', id: `se-res-${uid}` }) as HTMLSelectElement;
  for (const r of o.resources) resSel.append(h('option', { value: r.id, selected: r.id === ev.resourceId }, r.name));
  row1.append(field(t('Сотрудник'), resSel, resSel.id).f);
  form.append(row1);

  const allDayIn = h('input', { type: 'checkbox', id: `se-allday-${uid}` }) as HTMLInputElement;
  allDayIn.checked = !!(ev.allDay ?? typeOf(ev.type)?.allDay);
  form.append(h('label', { class: 'b24-check' }, allDayIn, h('span', {}, t('Весь день'))));

  const pickers: Array<DatePickerHandle | TimePickerHandle> = [];
  const when = (label: string, d: Date, key: string) => {
    const date = h('input', { class: 'b24-input', id: `se-${key}-d-${uid}`, value: formatDate(d), inputmode: 'numeric', 'aria-label': `${label}: ${t('дата')}` }) as HTMLInputElement;
    const time = h('input', { class: 'b24-input b24-scheduler-editor__time', id: `se-${key}-t-${uid}`, value: formatTime(d.getHours() * 60 + d.getMinutes()), inputmode: 'numeric', 'aria-label': `${label}: ${t('время')}` }) as HTMLInputElement;
    pickers.push(datepicker(date), timepicker(time, { step: o.step }));
    const x = field(label, h('div', { class: 'b24-scheduler-editor__when' }, date, time), date.id, true);
    return { ...x, date, time };
  };
  const startF = when(t('Начало'), ev.start, 's');
  const endF = when(t('Конец'), ev.end, 'e');
  form.append(h('div', { class: 'b24-form-row' }, startF.f, endF.f));
  const syncAllDay = () => form.classList.toggle('is-all-day', allDayIn.checked);
  allDayIn.addEventListener('change', syncAllDay);
  typeSel?.addEventListener('change', () => { const ty = typeOf(typeSel!.value); if (ty?.allDay !== undefined) { allDayIn.checked = ty.allDay; syncAllDay(); } });
  syncAllDay();

  const custom: Array<{ def: SchedulerEditorField; el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement; x: ReturnType<typeof field> }> = [];
  const data = isRecord(ev.data) ? ev.data : {};
  for (const def of o.fields ?? []) {
    const id = `se-f-${def.name}-${uid}`;
    const val = data[def.name] == null ? '' : String(data[def.name]);
    let el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (def.type === 'select') {
      el = h('select', { class: 'b24-select', id }) as HTMLSelectElement;
      if (!def.required) el.append(h('option', { value: '' }, '—'));
      for (const op of def.options ?? []) el.append(h('option', { value: op.value, selected: op.value === val }, op.label));
    } else if (def.type === 'textarea') {
      el = h('textarea', { class: 'b24-textarea', id, rows: '3', placeholder: def.placeholder }) as HTMLTextAreaElement;
      el.value = val;
    } else {
      el = h('input', { class: 'b24-input', id, type: def.type === 'number' ? 'number' : 'text', value: val, placeholder: def.placeholder }) as HTMLInputElement;
    }
    const x = field(def.label, el, id, def.required);
    custom.push({ def, el, x });
    form.append(x.f);
  }

  let commentIn: HTMLTextAreaElement | null = null;
  if (o.comment !== false) {
    commentIn = h('textarea', { class: 'b24-textarea', id: `se-comment-${uid}`, rows: '3' }) as HTMLTextAreaElement;
    commentIn.value = ev.comment ?? '';
    form.append(field(t('Комментарий'), commentIn, commentIn.id).f);
  }

  const at = (dateIn: HTMLInputElement, timeIn: HTMLInputElement) => {
    const d = parseDate(dateIn.value);
    const m = parseTime(timeIn.value);
    if (!d || m == null) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60);
  };
  const read = (): (SchedulerEvent & { start: Date; end: Date }) | null => {
    let ok = true;
    const title = titleIn.value.trim();
    setErr(titleF, title ? '' : t('Укажите название'));
    if (!title) ok = false;
    const start = at(startF.date, startF.time);
    const end = at(endF.date, endF.time);
    setErr(startF, start ? '' : t('Укажите дату и время'));
    setErr(endF, !end ? t('Укажите дату и время') : start && end <= start ? t('Конец должен быть позже начала') : '');
    if (!start || !end || end <= start) ok = false;
    const extra: Record<string, unknown> = { ...data };
    for (const c of custom) {
      const v = c.el.value.trim();
      setErr(c.x, c.def.required && !v ? t('Заполните поле') : '');
      if (c.def.required && !v) ok = false;
      extra[c.def.name] = c.def.type === 'number' ? (v === '' ? null : Number(v)) : v;
    }
    if (!ok) { form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); return null; }
    const type = typeSel?.value || undefined;
    const ty = typeOf(type);
    const next: SchedulerEvent & { start: Date; end: Date } = {
      ...ev, title, resourceId: resSel.value, start: start!, end: end!,
      // «весь день» совпадает с типом — не храним явно, чтобы тип им управлял
      allDay: ty && ty.allDay === allDayIn.checked ? undefined : allDayIn.checked || undefined,
    };
    if (typeSel) {
      next.type = type;
      // сменили тип — цвет берётся из типа
      if (type !== ev.type) delete next.color;
    }
    if (commentIn) next.comment = commentIn.value.trim() || undefined;
    if (custom.length) next.data = extra;
    return next;
  };

  const showError = (e: unknown) => { alert.textContent = errText(e); alert.hidden = false; };
  const buttons: ModalButton[] = [
    {
      text: t('Сохранить'), variant: 'success', closes: true,
      onClick: async () => {
        alert.hidden = true;
        const next = read();
        if (!next) return false;
        try { await o.save(next); return true; } catch (e) { showError(e); return false; }
      },
    },
    { text: t('Отмена'), variant: 'secondary' },
  ];
  if (o.remove && !o.isNew) {
    buttons.push({
      text: t('Удалить'), variant: 'plain b24-scheduler-editor__delete', closes: true,
      onClick: async () => {
        alert.hidden = true;
        try { await o.remove!(); return true; } catch (e) { if (e instanceof Error && e.message && e.message !== 'cancel') showError(e); return false; }
      },
    });
  }
  const m = modal({
    title: o.isNew ? t('Новая встреча') : t('Изменить встречу'),
    content: form,
    autoInit: false,
    buttons,
    onClose: () => pickers.forEach((p) => p.destroy()),
  });
  // Enter в однострочном поле — «Сохранить» (в комментарии Enter — новая строка)
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'SELECT') return;
    // открыт выбор даты или времени — Enter выбирает значение в нём
    if (pickers.some((p) => 'isOpen' in p && p.isOpen()) || document.querySelector('.b24-datepicker-popup:not([hidden])')) return;
    e.preventDefault();
    m.element.querySelector<HTMLButtonElement>('.b24-modal__footer .b24-btn--success')?.click();
  });
  requestAnimationFrame(() => { titleIn.focus(); if (o.isNew) titleIn.select(); });
}

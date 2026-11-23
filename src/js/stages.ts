/**
 * Полоска этапов `.b24-stages`: вся пройденная часть, включая текущий этап, — цветом текущего этапа, будущие серые;
 * при наведении на этап полоска до него перекрашивается в его цвет, после ухода курсора — снова цвет текущего.
 * Работает и для своей разметки: `button.b24-stages__item.is-done|is-current` со `--stage-color` у каждого.
 *
 *   initStages(document);        // все .b24-stages (init() делает это сам)
 *   initStages(stagesEl);        // после того, как вы перерисовали разметку полоски
 */
const ITEM = '.b24-stages__item';

const items = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>(ITEM));
const currentIndex = (list: HTMLElement[]) => {
  let i = list.findIndex((x) => x.classList.contains('is-current') || x.classList.contains('is-fail') || x.getAttribute('aria-current') === 'step');
  if (i < 0) for (let k = 0; k < list.length; k++) if (list[k].classList.contains('is-done')) i = k;
  return i;
};
const colorOf = (item: HTMLElement) => (item.classList.contains('is-fail') ? 'var(--b24-color-danger)' : getComputedStyle(item).getPropertyValue('--stage-color').trim() || 'var(--b24-color-primary)');

/** hover — индекс этапа под курсором; без него — текущий */
function paint(el: HTMLElement, hover = -1): void {
  const list = items(el);
  const upTo = hover >= 0 ? hover : currentIndex(list);
  if (upTo < 0) { list.forEach((x) => x.classList.remove('is-lit')); return; }
  el.style.setProperty('--stages-lit', colorOf(list[upTo]));
  list.forEach((x, i) => x.classList.toggle('is-lit', i <= upTo));
}

export function initStages(root: ParentNode = document): void {
  const all = new Set<HTMLElement>(Array.from(root.querySelectorAll<HTMLElement>('.b24-stages')));
  if (root instanceof HTMLElement && root.matches('.b24-stages')) all.add(root);
  all.forEach((el) => {
    // цвет текущего считается при каждом вызове — для перерисованной разметки; обработчики вешаются один раз
    el.setAttribute('data-b24-stages', '');
    paint(el);
    if (el.dataset.b24StagesReady) return;
    el.dataset.b24StagesReady = '1';
    el.addEventListener('pointerover', (e) => {
      if ((e as PointerEvent).pointerType === 'touch') return;
      const item = (e.target as HTMLElement).closest<HTMLElement>(ITEM);
      if (item && el.contains(item)) paint(el, items(el).indexOf(item));
    });
    el.addEventListener('pointerleave', () => paint(el));
    el.addEventListener('focusin', (e) => { const item = (e.target as HTMLElement).closest<HTMLElement>(ITEM); if (item) paint(el, items(el).indexOf(item)); });
    el.addEventListener('focusout', () => paint(el));
  });
}

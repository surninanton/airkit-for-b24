/**
 * Переход «в карточку сущности»: [data-b24-entity-open="тип:id"] (имя клиента, номер заказа в карточке заказа…).
 * Клик по элементу (и Enter/пробел на кнопке) шлёт на сам элемент событие b24:entity-open { type, id, trigger }
 * (всплывает, cancelable). Кит не знает, что показывать, — приложение слушает событие и открывает
 * openSidePanel({ back: true, … }) поверх текущей панели:
 *   document.addEventListener('b24:entity-open', (e) => { e.preventDefault(); openCard(e.detail.type, e.detail.id); });
 * Подключается один раз на документ (init() делает это сам).
 */
let ready = false;

export function initEntityOpen(): void {
  if (ready || typeof document === 'undefined') return;
  ready = true;
  document.addEventListener('click', (e) => {
    const trigger = (e.target as HTMLElement).closest<HTMLElement>('[data-b24-entity-open]');
    if (!trigger || trigger.hasAttribute('disabled') || trigger.getAttribute('aria-disabled') === 'true') return;
    const [type, ...rest] = (trigger.dataset.b24EntityOpen ?? '').split(':');
    const id = rest.join(':');
    if (!type) return;
    e.preventDefault();
    trigger.dispatchEvent(new CustomEvent('b24:entity-open', { detail: { type, id, trigger }, bubbles: true, cancelable: true }));
  });
}

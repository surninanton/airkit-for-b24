/**
 * Вкладки: контейнер [data-b24-tabs] с кнопками [data-b24-tab="id"],
 * панели [data-b24-tab-panel="id"] ищутся в ближайшем [data-b24-tabs-scope] или документе.
 */
export function initTabs(container: HTMLElement, onChange?: (id: string) => void): void {
  if (container.dataset.b24Ready) return;
  container.dataset.b24Ready = '1';
  container.setAttribute('role', 'tablist');
  const scope: ParentNode = container.closest('[data-b24-tabs-scope]') ?? document;
  const tabs = () => Array.from(container.querySelectorAll<HTMLElement>('[data-b24-tab]'));

  const select = (id: string, focus = false) => {
    for (const tab of tabs()) {
      const active = tab.dataset.b24Tab === id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    }
    scope.querySelectorAll<HTMLElement>('[data-b24-tab-panel]').forEach((panel) => {
      if (!tabs().some((t) => t.dataset.b24Tab === panel.dataset.b24TabPanel)) return;
      panel.setAttribute('role', 'tabpanel');
      panel.hidden = panel.dataset.b24TabPanel !== id;
    });
    onChange?.(id);
    container.dispatchEvent(new CustomEvent('b24:tab-change', { detail: { id }, bubbles: true }));
  };

  container.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-b24-tab]');
    if (tab && container.contains(tab)) { e.preventDefault(); select(tab.dataset.b24Tab!); }
  });
  container.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const list = tabs();
    const i = list.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    const next = list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
    select(next.dataset.b24Tab!, true);
  });

  const initial = tabs().find((t) => t.getAttribute('aria-selected') === 'true' || t.classList.contains('is-active')) ?? tabs()[0];
  if (initial) select(initial.dataset.b24Tab!);
}

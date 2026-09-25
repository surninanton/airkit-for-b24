import { creditHtml } from '../js/credit';

/**
 * «Сделано на airkit-for-b24 ♥» со ссылкой на репозиторий — для подвала приложения.
 * Лицензия MIT этого не требует, но будем благодарны, если оставите.
 */
export function Credit({ label, footer = true }: { label?: string; footer?: boolean }) {
  const link = <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: creditHtml(label) }} />;
  return footer ? <footer className="b24-credit-footer">{link}</footer> : link;
}

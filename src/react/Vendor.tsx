import { useEffect, useRef } from 'react';
import { createVendor, type VendorHandle, type VendorOptions } from '../js/vendor';

/**
 * Блок разработчика (правило кита): логотип + меню «Поддержка / Политика / Контакты / Сайт / Маркетплейс».
 * Ставится последним справа в верхней строке — удобнее через проп vendor у <Toolbar> или <AppShell>.
 */
export function Vendor(props: VendorOptions) {
  const host = useRef<HTMLSpanElement>(null);
  const handlers = useRef(props);
  handlers.current = props;
  const vendor = useRef<VendorHandle | null>(null);
  // функции-ссылки берём из актуальных props, пересоздаём только при смене данных (счётчик — без пересоздания)
  const key = JSON.stringify({ ...props, counter: undefined }, (_k, v) => (typeof v === 'function' ? 'fn' : v));
  useEffect(() => {
    if (!host.current) return;
    const wrap = <T,>(link: T) => (typeof link === 'function' ? (() => (link as () => void)()) : link);
    const L = props.links;
    const v = vendor.current = createVendor(host.current, {
      ...props,
      links: { support: wrap(L.support), newTicket: wrap(L.newTicket), privacy: wrap(L.privacy), contacts: wrap(L.contacts), site: wrap(L.site), marketplace: wrap(L.marketplace) },
    });
    return () => { v.destroy(); vendor.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { vendor.current?.setCounter(props.counter ?? 0); }, [props.counter, key]);
  return <span ref={host} style={{ display: 'inline-flex' }} />;
}

export type { VendorOptions };

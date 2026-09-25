import { useEffect, useRef, useState } from 'react';

export type ClassValue = string | false | null | undefined | 0;
export const cx = (...list: ClassValue[]): string => list.filter(Boolean).join(' ');

/** Держит элемент смонтированным на время анимации закрытия. */
export function usePresence(open: boolean, duration = 250): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      timer.current = setTimeout(() => { setMounted(false); setClosing(false); }, duration);
    }
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return { mounted, closing };
}

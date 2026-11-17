import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createReceipt, type ReceiptHandle, type ReceiptLine, type ReceiptOptions } from '../js/receipt';
import { createQr, type QrHandle, type QrOptions } from '../js/qr';
import { createSortable, type SortableHandle, type SortableItem, type SortableOptions } from '../js/sortable';
import { cx } from './utils';

/** Предпросмотр чековой ленты: <Receipt lines={[{ text: 'ЧЕК', bold: true, align: 'center' }, { sep: '-' }]} paper={58} switcher /> */
export interface ReceiptProps extends Omit<ReceiptOptions, 'lines'> { lines: ReceiptLine[]; className?: string }
export function Receipt({ lines, paper, width, torn, switcher, onPaperChange, className }: ReceiptProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<ReceiptHandle | null>(null);
  const cb = useRef(onPaperChange);
  cb.current = onPaperChange;
  useEffect(() => {
    h.current = createReceipt(host.current!, { lines, paper, width, torn, switcher, onPaperChange: (p, w) => cb.current?.(p, w) });
    return () => h.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torn, switcher]);
  const key = JSON.stringify(lines);
  useEffect(() => { h.current?.setLines(lines); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (width != null) h.current?.setWidth(width); else if (paper) h.current?.setPaper(paper); }, [paper, width]);
  return <div ref={host} className={className} style={{ display: 'contents' }} />;
}

/** QR-код без зависимостей: <Qr value="https://example.com" size={120} label="Оцените заказ" /> */
export interface QrProps extends QrOptions { value: string; className?: string }
export function Qr({ value, className, ...options }: QrProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<QrHandle | null>(null);
  const optKey = JSON.stringify(options);
  useEffect(() => {
    h.current = createQr(host.current!, value, options);
    return () => h.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optKey]);
  useEffect(() => { h.current?.update(value); }, [value]);
  return <div ref={host} className={cx('b24-qr-host', className)} style={{ display: 'inline-block' }} />;
}

export interface SortableListItem extends SortableItem {
  /** своё содержимое строки вместо заголовка и подписи */
  content?: ReactNode;
  /** раскрывающаяся часть: строка раскрывается, если body есть хотя бы у одной */
  body?: ReactNode;
}
export interface SortableListProps extends Omit<SortableOptions, 'items' | 'renderBody' | 'renderItem'> {
  items: SortableListItem[];
  className?: string;
}
/**
 * Сортируемый список. Порядок хранит родитель: onReorder(ids) → переставьте items. Содержимое и body — обычные React-узлы.
 * <SortableList toggle items={blocks} onReorder={(ids) => setBlocks(sortBy(ids))} onToggle={(id, on) => …} />
 */
export function SortableList({ items, className, toggle, onReorder, onToggle, onExpand, label }: SortableListProps) {
  const host = useRef<HTMLDivElement>(null);
  const h = useRef<SortableHandle | null>(null);
  const [bodies, setBodies] = useState<Record<string, HTMLElement>>({});
  const [contents, setContents] = useState<Record<string, HTMLElement>>({});
  const cbs = useRef({ onReorder, onToggle, onExpand });
  cbs.current = { onReorder, onToggle, onExpand };
  const plain = (list: SortableListItem[]): SortableItem[] => list.map(({ content: _c, body: _b, ...rest }) => rest);
  const hasBody = items.some((i) => i.body != null);
  const hasContent = items.some((i) => i.content != null);
  useEffect(() => {
    h.current = createSortable(host.current!, {
      items: plain(items), toggle, label,
      renderBody: hasBody ? (item, el) => { setBodies((b) => ({ ...b, [item.id]: el })); return () => setBodies((b) => { const { [item.id]: _x, ...rest } = b; return rest; }); } : undefined,
      renderItem: hasContent ? (item, el) => { if (items.find((i) => i.id === item.id)?.content != null) setContents((c) => ({ ...c, [item.id]: el })); } : undefined,
      onReorder: (ids, moved) => cbs.current.onReorder?.(ids, moved),
      onToggle: (id, on, item) => cbs.current.onToggle?.(id, on, item),
      onExpand: (id, open) => cbs.current.onExpand?.(id, open),
    });
    return () => h.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggle, hasBody, hasContent]);
  const key = JSON.stringify(plain(items));
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } h.current?.setItems(plain(items)); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div ref={host} className={className} />
      {items.map((i) => (
        <span key={i.id} style={{ display: 'contents' }}>
          {i.body != null && bodies[i.id] ? createPortal(i.body, bodies[i.id]) : null}
          {i.content != null && contents[i.id] ? createPortal(i.content, contents[i.id]) : null}
        </span>
      ))}
    </>
  );
}

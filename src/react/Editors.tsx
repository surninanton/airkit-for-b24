import { useEffect, useRef } from 'react';
import { createFieldMapper, type FieldMapperHandle, type FieldMapperOptions, type FieldMapping } from '../js/field-mapper';
import { createKeyValue, type KeyValueHandle, type KeyValueOptions, type KeyValuePair } from '../js/repeater';
import { codeHtml, createLogViewer, jsonHtml, type CodeTone, type LogViewerHandle, type LogViewerOptions } from '../js/logs';

/* Обёртки над vanilla-редакторами: значение приходит в value, изменения — в onChange.
 * Редактор держит своё состояние; внешнее value применяется, только если отличается от последнего отданного
 * (иначе каждая правка пересоздавала бы строки и сбивала фокус). */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface KeyValueEditorProps extends Omit<KeyValueOptions, 'pairs' | 'onChange' | 'key' | 'value'> {
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
  /** левая колонка (в React нельзя назвать проп key) */
  keyField?: KeyValueOptions['key'];
  valueField?: KeyValueOptions['value'];
  className?: string;
}
export function KeyValueEditor({ pairs, onChange, keyField, valueField, className, ...options }: KeyValueEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const kv = useRef<KeyValueHandle | null>(null);
  const last = useRef(pairs);
  const cb = useRef(onChange);
  cb.current = onChange;
  const itemsKey = JSON.stringify([keyField?.items, valueField?.items]);
  const first = useRef(true);
  useEffect(() => {
    kv.current = createKeyValue(host.current!, { ...options, key: keyField, value: valueField, pairs, onChange: (p) => { last.current = p; cb.current(p); } });
    return () => kv.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!same(pairs, last.current)) { last.current = pairs; kv.current?.setPairs(pairs); } }, [pairs]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    kv.current?.setItems('key', keyField?.items ?? null);
    kv.current?.setItems('value', valueField?.items ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);
  return <div ref={host} className={className} />;
}

export interface FieldMapperProps extends Omit<FieldMapperOptions, 'value' | 'onChange'> {
  value: FieldMapping[];
  onChange: (value: FieldMapping[]) => void;
  /** ошибки по пути «индекс.поле» (например, из ответа сервера 422) */
  errors?: Record<string, string | string[]>;
  className?: string;
}
export function FieldMapper({ value, onChange, errors, className, ...options }: FieldMapperProps) {
  const host = useRef<HTMLDivElement>(null);
  const fm = useRef<FieldMapperHandle | null>(null);
  const last = useRef(value);
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    fm.current = createFieldMapper(host.current!, { ...options, value, onChange: (v) => { last.current = v; cb.current(v); } });
    return () => fm.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!same(value, last.current)) { last.current = value; fm.current?.setValue(value); } }, [value]);
  const srcKey = JSON.stringify(options.sourceFields);
  const tgtKey = JSON.stringify(options.targetFields);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    fm.current?.setSourceFields(options.sourceFields);
    fm.current?.setTargetFields(options.targetFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcKey, tgtKey]);
  useEffect(() => { if (errors && Object.keys(errors).length) fm.current?.setErrors(errors); else fm.current?.clearErrors(); }, [JSON.stringify(errors ?? {})]);
  return <div ref={host} className={className} />;
}

/* ── Логи и код ── */
export interface LogViewerProps<C> extends LogViewerOptions<C> { className?: string }
/** Тёмная консоль логов; load меняется — список загружается заново */
export function LogViewer<C>({ className, ...options }: LogViewerProps<C>) {
  const host = useRef<HTMLDivElement>(null);
  const lv = useRef<LogViewerHandle | null>(null);
  const opts = useRef(options);
  opts.current = options;
  useEffect(() => {
    lv.current = createLogViewer<C>(host.current!, { ...opts.current, load: (a) => opts.current.load(a) });
    return () => lv.current?.destroy();
  }, []);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } lv.current?.reload(); }, [options.load]);
  return <div ref={host} className={className} />;
}

export function CodeBlock({ lines, dark, copy }: { lines: Array<string | { text: string; tone?: CodeTone }>; dark?: boolean; copy?: boolean }) {
  return <div dangerouslySetInnerHTML={{ __html: codeHtml(lines, { dark, copy }) }} />;
}
export function JsonView({ value }: { value: unknown }) {
  return <pre className="b24-code"><code style={{ display: 'block', padding: '10px 12px', font: '12px/1.6 var(--b24-font-family-mono)', background: 'var(--b24-bg-surface-2)', borderRadius: 'var(--b24-radius-md)', overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: jsonHtml(value) }} /></pre>;
}

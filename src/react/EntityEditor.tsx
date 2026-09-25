import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createEntityEditor, type EditorField, type EditorSection, type EditorValues, type EntityEditorHandle, type EntityEditorOptions } from '../js/editor';

export interface EntityEditorProps extends EntityEditorOptions {
  className?: string;
  onEditingChange?: (editing: boolean) => void;
}

/**
 * Карточка с полями и редактированием по секциям (обёртка над createEntityEditor).
 * values можно менять снаружи — применяются, если карточка не в режиме редактирования.
 */
export const EntityEditor = forwardRef<EntityEditorHandle | null, EntityEditorProps>(function EntityEditor({ className, onEditingChange, ...options }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const inst = useRef<EntityEditorHandle | null>(null);
  const handlers = useRef(options);
  handlers.current = options;
  const editingCb = useRef(onEditingChange);
  editingCb.current = onEditingChange;

  useImperativeHandle(ref, () => inst.current!, []);

  const structure = JSON.stringify([options.fields.map((f) => [f.id, f.type, f.required, f.readonly, f.options]), options.sections, options.readonly]);
  useEffect(() => {
    if (!host.current) return;
    const editor = createEntityEditor(host.current, {
      ...options,
      onSave: (values, changed) => handlers.current.onSave?.(values, changed),
      onCancel: () => handlers.current.onCancel?.(),
    });
    inst.current = editor;
    let last = false;
    const mo = new MutationObserver(() => {
      const now = editor.isEditing();
      if (now !== last) { last = now; editingCb.current?.(now); }
    });
    mo.observe(host.current, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    return () => { mo.disconnect(); editor.destroy(); inst.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure]);

  useEffect(() => {
    if (inst.current && !inst.current.isEditing()) inst.current.setValues(options.values);
  }, [options.values]);

  return <div ref={host} className={className} />;
});

export type { EditorField, EditorSection, EditorValues, EntityEditorHandle };

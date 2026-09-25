import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createUploader, type UploaderFile, type UploaderHandle, type UploaderOptions } from '../js/uploader';

export interface UploaderProps extends UploaderOptions {
  className?: string;
}

/**
 * Загрузчик файлов (обёртка над vanilla createUploader; неконтролируемый).
 * Начальные файлы — через files, изменения — через onChange; ref даёт getFiles / clear / whenDone.
 */
export const Uploader = forwardRef<UploaderHandle | null, UploaderProps>(function Uploader({ className, ...options }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const inst = useRef<UploaderHandle | null>(null);
  const onChange = useRef(options.onChange);
  onChange.current = options.onChange;
  const upload = useRef(options.upload);
  upload.current = options.upload;

  useImperativeHandle(ref, () => inst.current!, []);

  // пересоздаём только при смене «структурных» опций
  const key = JSON.stringify([options.multiple, options.accept, options.maxSize, options.maxFiles, options.url, options.name, options.view, options.compact, options.disabled, !!options.upload]);
  useEffect(() => {
    if (!host.current) return;
    inst.current = createUploader(host.current, {
      ...options,
      upload: options.upload ? (file, ctx) => upload.current!(file, ctx) : undefined,
      onChange: (files: UploaderFile[]) => onChange.current?.(files),
    });
    return () => { inst.current?.destroy(); inst.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={host} className={className} />;
});

export type { UploaderFile, UploaderHandle };

import { icon } from '../icons';
import { escapeHtml, h, html } from './dom';
import { intlLocale, t } from './i18n';

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface UploaderFile {
  /** локальный id */
  uid: string;
  name: string;
  size: number;
  type: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  /** id на сервере (из ответа upload / уже загруженного файла) */
  id?: string | number;
  url?: string;
  preview?: string;
  file?: File;
}

export interface UploadContext {
  onProgress: (percent: number) => void;
  signal: AbortSignal;
}

export interface UploaderOptions {
  multiple?: boolean;
  /** как у <input accept>: "image/*,.pdf" */
  accept?: string;
  /** байты */
  maxSize?: number;
  maxFiles?: number;
  /** POST multipart на url; ответ — JSON { id, url } */
  url?: string;
  fieldName?: string;
  headers?: Record<string, string>;
  data?: Record<string, string>;
  /** своя загрузка (например, в Диск Битрикс24) */
  upload?: (file: File, ctx: UploadContext) => Promise<{ id?: string | number; url?: string } | void>;
  /**
   * Имя поля формы. Без url/upload — файлы уходят в <input type="file" name>.
   * С url/upload — в скрытые поля name[] пишутся id загруженных файлов.
   */
  name?: string;
  /** уже загруженные файлы */
  files?: Array<{ id: string | number; name: string; size?: number; url?: string; type?: string }>;
  view?: 'list' | 'grid';
  compact?: boolean;
  title?: string;
  hint?: string;
  disabled?: boolean;
  onChange?: (files: UploaderFile[]) => void;
}

export interface UploaderHandle {
  element: HTMLElement;
  getFiles(): UploaderFile[];
  addFiles(files: FileList | File[]): void;
  remove(uid: string): void;
  clear(): void;
  /** промис, который ждёт окончания всех загрузок */
  whenDone(): Promise<UploaderFile[]>;
  destroy(): void;
}

export function formatSize(bytes: number): string {
  if (!bytes) return '';
  const units = [t('Б'), t('КБ'), t('МБ'), t('ГБ')];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toLocaleString(intlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${units[i]}`;
}

const EXT_COLORS: Record<string, string> = {
  pdf: '#ff5752', doc: '#2f7bf5', docx: '#2f7bf5', rtf: '#2f7bf5', txt: '#828b95',
  xls: '#1bae5e', xlsx: '#1bae5e', csv: '#1bae5e', ppt: '#f5812f', pptx: '#f5812f',
  zip: '#8d6e63', rar: '#8d6e63', '7z': '#8d6e63', mp3: '#853af5', mp4: '#853af5', mov: '#853af5',
};
const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase().slice(0, 4) : '');

function matchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept.split(',').map((a) => a.trim().toLowerCase()).some((a) =>
    a.startsWith('.') ? name.endsWith(a) : a.endsWith('/*') ? file.type.startsWith(a.slice(0, -1)) : file.type === a);
}

function xhrUpload(url: string, file: File, opts: UploaderOptions, ctx: UploadContext): Promise<{ id?: string | number; url?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append(opts.fieldName ?? 'file', file);
    for (const [k, v] of Object.entries(opts.data ?? {})) form.append(k, v);
    xhr.open('POST', url);
    for (const [k, v] of Object.entries(opts.headers ?? {})) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) ctx.onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(t('Ошибка {status}', { status: xhr.status })));
      try { resolve(JSON.parse(xhr.responseText || '{}')); } catch { resolve({}); }
    };
    xhr.onerror = () => reject(new Error(t('Сеть недоступна')));
    ctx.signal.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });
}

/** Загрузчик файлов: drag & drop, вставка из буфера, превью, прогресс, повтор. */
export function createUploader(container: HTMLElement, options: UploaderOptions = {}): UploaderHandle {
  const {
    multiple = true, accept, maxSize, maxFiles, name, view = 'list', compact, disabled,
    title = multiple ? t('Перетащите файлы сюда') : t('Перетащите файл сюда'),
    hint,
  } = options;
  const remote = !!(options.url || options.upload);
  let files: UploaderFile[] = (options.files ?? []).map((f) => ({
    uid: `srv-${f.id}`, id: f.id, name: f.name, size: f.size ?? 0, type: f.type ?? '', url: f.url, status: 'done', progress: 100,
    preview: f.type?.startsWith('image/') ? f.url : undefined,
  }));
  const controllers = new Map<string, AbortController>();

  const root = h('div', { class: 'b24-uploader' });
  const input = h('input', { type: 'file', multiple: multiple || undefined, accept, tabindex: '-1', 'aria-hidden': 'true' });
  // В локальном режиме именно этот input уходит с формой
  if (name && !remote) input.name = multiple && !name.endsWith('[]') ? `${name}[]` : name;
  const zone = h('div', {
    class: `b24-dropzone${compact ? ' b24-dropzone--compact' : ''}`,
    role: 'button',
    tabindex: disabled ? '-1' : '0',
    'aria-disabled': disabled ? 'true' : undefined,
  });
  zone.append(html(icon('cloudUpload', { className: 'b24-dropzone__icon' })));
  zone.append(h('span', { class: 'b24-dropzone__title' }, html(t('{title} или <b>выберите</b>', { title: escapeHtml(title) }))));
  const limits = [accept && accept.replace(/,/g, ', '), maxSize && t('до {size}', { size: formatSize(maxSize) }), maxFiles && t('не больше {n} шт.', { n: maxFiles })].filter(Boolean).join(' · ');
  if (hint || limits) zone.append(h('span', { class: 'b24-dropzone__hint' }, hint ?? limits));
  zone.append(input);
  const list = h('ul', { class: `b24-file-list${view === 'grid' ? ' b24-file-list--grid' : ''}`, 'aria-live': 'polite' });
  const hidden = h('span', { hidden: true });
  root.append(zone, list, hidden);
  container.append(root);

  const emit = () => {
    options.onChange?.(files.map((f) => ({ ...f })));
    root.dispatchEvent(new CustomEvent('b24:files-change', { detail: { files }, bubbles: true }));
  };

  const syncForm = () => {
    if (!name) return;
    if (remote) {
      hidden.textContent = '';
      for (const f of files) if (f.status === 'done' && f.id != null) hidden.append(h('input', { type: 'hidden', name: multiple ? `${name}[]` : name, value: String(f.id) }));
    } else if (typeof DataTransfer !== 'undefined') {
      const dt = new DataTransfer();
      for (const f of files) if (f.file && f.status !== 'error') dt.items.add(f.file);
      input.files = dt.files;
    }
  };

  const render = () => {
    list.textContent = '';
    for (const f of files) {
      const ext = extOf(f.name);
      const li = h('li', { class: `b24-file is-${f.status}` });
      const thumb = h('span', { class: 'b24-file__thumb', style: `--_ext-color:${EXT_COLORS[ext] ?? 'var(--b24-text-disabled)'}` });
      if (f.preview) thumb.append(h('img', { src: f.preview, alt: '' }));
      else thumb.append(ext || '?');
      const info = h('span', { class: 'b24-file__info' });
      info.append(f.url && f.status === 'done'
        ? h('a', { class: 'b24-file__name', href: f.url, target: '_blank', rel: 'noopener', title: f.name }, f.name)
        : h('span', { class: 'b24-file__name', title: f.name }, f.name));
      const meta = f.status === 'error' ? f.error ?? t('Ошибка') : f.status === 'uploading' ? `${f.progress}% · ${formatSize(f.size)}` : formatSize(f.size);
      info.append(h('span', { class: 'b24-file__meta' }, meta));
      if (f.status === 'uploading' || f.status === 'pending') {
        info.append(h('span', { class: 'b24-progress b24-file__progress', style: `--_value:${f.progress}%`, role: 'progressbar', 'aria-valuenow': String(f.progress) }));
      }
      const actions = h('span', { class: 'b24-file__actions' });
      if (f.status === 'error' && f.file && remote) {
        const retry = h('button', { type: 'button', class: 'b24-btn b24-btn--plain b24-btn--xs b24-btn--icon', 'aria-label': t('Повторить') }, html(icon('refresh')));
        retry.addEventListener('click', () => void start(f));
        actions.append(retry);
      }
      if (!disabled) {
        const del = h('button', { type: 'button', class: 'b24-btn b24-btn--plain b24-btn--xs b24-btn--icon', 'aria-label': t('Удалить {name}', { name: f.name }) }, html(icon('close')));
        del.addEventListener('click', () => remove(f.uid));
        actions.append(del);
      }
      li.append(thumb, info, actions);
      list.append(li);
    }
    list.hidden = !files.length;
    zone.hidden = !multiple && files.length > 0;
  };

  const update = (uid: string, patch: Partial<UploaderFile>) => {
    files = files.map((f) => (f.uid === uid ? { ...f, ...patch } : f));
    render();
  };

  async function start(f: UploaderFile) {
    if (!f.file) return;
    const ctrl = new AbortController();
    controllers.set(f.uid, ctrl);
    update(f.uid, { status: 'uploading', progress: 0, error: undefined });
    let lastRender = 0;
    const ctx: UploadContext = {
      signal: ctrl.signal,
      onProgress(p) {
        const now = Date.now();
        if (now - lastRender < 80 && p < 100) return;
        lastRender = now;
        update(f.uid, { progress: p });
      },
    };
    try {
      const res = options.upload ? await options.upload(f.file, ctx) : await xhrUpload(options.url!, f.file, options, ctx);
      if (ctrl.signal.aborted) return;
      update(f.uid, { status: 'done', progress: 100, id: res?.id, url: res?.url ?? f.url });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      update(f.uid, { status: 'error', error: (err as Error)?.message ?? t('Ошибка загрузки') });
    } finally {
      controllers.delete(f.uid);
      syncForm();
      emit();
    }
  }

  function addFiles(list: FileList | File[]) {
    if (disabled) return;
    let incoming = Array.from(list);
    if (!multiple) { incoming = incoming.slice(0, 1); files.forEach((f) => remove(f.uid, false)); }
    const added: UploaderFile[] = [];
    for (const file of incoming) {
      if (maxFiles && files.length + added.length >= maxFiles) break;
      const f: UploaderFile = {
        uid: `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name, size: file.size, type: file.type, file,
        status: remote ? 'pending' : 'done', progress: remote ? 0 : 100,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      };
      if (!matchesAccept(file, accept)) { f.status = 'error'; f.error = t('Недопустимый тип файла'); }
      else if (maxSize && file.size > maxSize) { f.status = 'error'; f.error = t('Больше {size}', { size: formatSize(maxSize) }); }
      added.push(f);
    }
    files = [...files, ...added];
    render();
    syncForm();
    emit();
    if (remote) added.filter((f) => f.status === 'pending').forEach((f) => void start(f));
  }

  function remove(uid: string, notify = true) {
    const f = files.find((x) => x.uid === uid);
    controllers.get(uid)?.abort();
    if (f?.preview?.startsWith('blob:')) URL.revokeObjectURL(f.preview);
    files = files.filter((x) => x.uid !== uid);
    render();
    syncForm();
    if (notify) emit();
  }

  /* events */
  const pick = () => { if (!disabled) input.click(); };
  zone.addEventListener('click', (e) => { if (e.target !== input) pick(); });
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  input.addEventListener('change', () => {
    if (input.files?.length) {
      const picked = Array.from(input.files);
      addFiles(picked);
      if (remote) input.value = '';
    }
  });
  let depth = 0;
  zone.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; zone.classList.add('is-dragover'); });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
  zone.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; zone.classList.remove('is-dragover'); } });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    zone.classList.remove('is-dragover');
    if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
  });
  root.addEventListener('paste', (e) => {
    const pasted = Array.from(e.clipboardData?.files ?? []);
    if (pasted.length) { e.preventDefault(); addFiles(pasted); }
  });

  render();
  syncForm();
  return {
    element: root,
    getFiles: () => files.map((f) => ({ ...f })),
    addFiles,
    remove: (uid) => remove(uid),
    clear: () => [...files].forEach((f) => remove(f.uid)),
    whenDone: () => new Promise((resolve) => {
      const check = () => (files.some((f) => f.status === 'uploading' || f.status === 'pending') ? setTimeout(check, 100) : resolve(files.map((f) => ({ ...f }))));
      check();
    }),
    destroy() {
      controllers.forEach((c) => c.abort());
      files.forEach((f) => f.preview?.startsWith('blob:') && URL.revokeObjectURL(f.preview));
      root.remove();
    },
  };
}

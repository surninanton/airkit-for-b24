/**
 * Хранилище состояния кита: состояние грида, размер страницы, «частые» эмодзи, тема, принятое уведомление о cookie.
 * По умолчанию — localStorage; B24UI.setStorage(...) подменяет его (например, серверным хранилищем по пользователю).
 */
export interface B24Storage {
  /** синхронно; null — значения нет */
  get(key: string): string | null;
  /** value: null — удалить ключ; можно fire-and-forget */
  set(key: string, value: string | null): void;
}

const local: B24Storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* приватный режим */ } },
};
let current: B24Storage = local;

/** Подключить своё хранилище; без аргумента — вернуть localStorage. Вызывайте до init() / initGrid. */
export function setStorage(storage?: B24Storage | null): void { current = storage ?? local; }
export function getStorage(): B24Storage { return current; }

/** Чтение / запись через текущее хранилище; ошибки хранилища не ломают компонент. */
export function storageGet(key: string): string | null {
  try { const v = current.get(key); return v == null ? null : String(v); } catch { return null; }
}
export function storageSet(key: string, value: string | null): void {
  try { current.set(key, value); } catch (e) { console.error('[airkit-for-b24] storage.set:', e); }
}

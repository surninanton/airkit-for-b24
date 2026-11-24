// IIFE-сборка: <script src="b24ui.js"></script> → window.B24UI + автоинициализация
import * as api from './index';
import { delegateGlobalEvents, init, setStorage, type B24Storage } from './index';

export * from './index';

// window.B24UI — и при подключении модулем (в IIFE-сборке его ставит сам бандл): инлайн-скриптам страницы нужен getGrid и др.
(window as unknown as { B24UI?: typeof api }).B24UI ??= api;

// Хранилище состояния можно задать до автоинициализации: window.B24UI_CONFIG = { storage: { get, set } }
// (скрипт перед китом) или <script src="b24ui.js" data-b24-storage="PirPrefs.storage"> — путь к объекту в window.
const cfg = (window as unknown as { B24UI_CONFIG?: { storage?: B24Storage } }).B24UI_CONFIG;
const attr = (document.currentScript as HTMLScriptElement | null)?.dataset.b24Storage;
const fromAttr = attr ? (attr.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], window) as B24Storage | undefined) : undefined;
if (cfg?.storage || fromAttr) setStorage(cfg?.storage ?? fromAttr);

delegateGlobalEvents();
let started = false;
const start = () => { if (!started) { started = true; init(); } };
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else if (document.readyState === 'interactive') {
  // <script defer> / type=module: DOMContentLoaded ещё впереди, и следующие defer-скрипты (с setStorage) успеют выполниться;
  // если он уже прошёл — сработает load
  document.addEventListener('DOMContentLoaded', start);
  window.addEventListener('load', start);
} else {
  start();
}

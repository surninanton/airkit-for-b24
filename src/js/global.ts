// IIFE-сборка: <script src="b24ui.js"></script> → window.B24UI + автоинициализация
import * as api from './index';
import { delegateGlobalEvents, init } from './index';

export * from './index';

// window.B24UI — и при подключении модулем (в IIFE-сборке его ставит сам бандл): инлайн-скриптам страницы нужен getGrid и др.
(window as unknown as { B24UI?: typeof api }).B24UI ??= api;

delegateGlobalEvents();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}

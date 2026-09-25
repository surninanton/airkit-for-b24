// IIFE-сборка: <script src="b24ui.js"></script> → window.B24UI + автоинициализация
import { delegateGlobalEvents, init } from './index';

export * from './index';

delegateGlobalEvents();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}

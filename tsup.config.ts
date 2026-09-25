import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { 'js/index': 'src/js/index.ts', 'icons/index': 'src/icons/index.ts', 'react/index': 'src/react/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: false,
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    outDir: 'dist',
  },
  {
    // Подключение одним <script> в PHP/Jinja-шаблонах: window.B24UI
    entry: { b24ui: 'src/js/global.ts' },
    format: ['iife'],
    globalName: 'B24UI',
    minify: true,
    sourcemap: true,
    outDir: 'dist',
    outExtension: () => ({ js: '.js' }),
  },
]);

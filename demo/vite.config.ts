import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: { fs: { allow: [resolve(__dirname, '..')] } },
  build: {
    outDir: resolve(__dirname, '../dist-demo'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        react: resolve(__dirname, 'react.html'),
        site: resolve(__dirname, 'site.html'),
        landing: resolve(__dirname, 'landing.html'),
        article: resolve(__dirname, 'article.html'),
        blog: resolve(__dirname, 'blog.html'),
        about: resolve(__dirname, 'about.html'),
        docs: resolve(__dirname, 'docs.html'),
        screens: resolve(__dirname, 'screens.html'),
        editors: resolve(__dirname, 'editors.html'),
      },
    },
  },
});

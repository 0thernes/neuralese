import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

// The shell is built into src/shell/ (the legacy web root), so gh-pages, Electron and Capacitor ship it unchanged.
// Fixed file names: the legacy index.html references shell/shell.js and shell/shell.css directly (no inline script → CSP stays strict).
export default defineConfig({
  plugins: [solid(), tailwindcss()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  build: {
    outDir: '../src/shell',
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: false,
    chunkSizeWarningLimit: 800,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/main.tsx',
      output: { entryFileNames: 'shell.js', chunkFileNames: 'chunks/[name]-[hash].js', assetFileNames: (a) => (a.names?.[0]?.endsWith('.css') ? 'shell.css' : 'assets/[name]-[hash][extname]') },
    },
  },
});

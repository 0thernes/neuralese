import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'test/e2e',
  testMatch: 'blob-download.spec.mjs',
  timeout: 120000,
  workers: 1,
  reporter: [['line']],
  use: { headless: true },
});

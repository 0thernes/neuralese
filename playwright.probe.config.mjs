import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'test/e2e',
  testMatch: 'export-probe.spec.mjs',
  timeout: 600000,
  workers: 1,
  reporter: [['line']],
});

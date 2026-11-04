import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'test/e2e',
  testMatch: 'click-all.spec.mjs',
  timeout: 3600000,
  expect: { timeout: 20000 },
  retries: 0,
  fullyParallel: true,
  workers: 3,
  reporter: [['line'], ['json', { outputFile: 'test/e2e/playwright-report.json' }]],
  use: {
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROME || '/opt/google/chrome/chrome',
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
});

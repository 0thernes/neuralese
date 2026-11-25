// Same Chrome, SwiftShader, and long-animation-frame observer as click-all.
// The page only creates a blob and clicks a download link.
import { test, chromium } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const fixture = path.resolve('test/e2e/fixtures/blob-download.html');
const sizes = [4096, 262144, 2000000];

test('blob download LoAF', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(fs.readFileSync(fixture));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/google/chrome/chrome',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)); });
  const rows = [];
  for (const bytes of sizes) {
    await page.goto(`http://127.0.0.1:${port}/?bytes=${bytes}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.__scripts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          for (const s of e.scripts || []) {
            if (s.duration < 30) continue;
            window.__scripts.push({
              d: Math.round(s.duration),
              url: s.sourceURL || '',
              fn: s.sourceFunctionName || '',
              pos: s.sourceCharPosition,
              inv: s.invoker || '',
              type: s.invokerType || '',
            });
          }
        }
      }).observe({ type: 'long-animation-frame' });
    });
    for (const id of ['anchor', 'worker', 'bitmap']) {
      const before = await page.evaluate(() => window.__scripts.length);
      await page.click('#' + id);
      await page.waitForTimeout(1200);
      const hit = await page.evaluate((n) => ({ scripts: window.__scripts.slice(n), picker: window.__picker || '' }), before);
      const anon = hit.scripts.filter((s) => !s.url && s.pos < 0 && /setTimeout/.test(s.inv));
      rows.push({ bytes, id, picker: hit.picker, anon: anon.map((s) => s.d), all: hit.scripts });
      console.log(JSON.stringify({ bytes, id, picker: hit.picker, anon: anon.map((s) => s.d), scripts: hit.scripts }));
    }
  }
  fs.mkdirSync('test/e2e', { recursive: true });
  fs.writeFileSync('test/e2e/blob-download.json', JSON.stringify(rows, null, 2));
  await browser.close();
  server.close();
});

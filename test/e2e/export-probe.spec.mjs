import { test, chromium } from '@playwright/test';

const URL = process.env.PREVIEW_URL || 'https://0thernes.github.io/neuralese/preview/?notour&bud=v191probe';

test('name the export timer', async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/google/chrome/chrome',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => { if (/phase|PAGE/.test(m.text()) || m.type() === 'error') console.log(m.type(), m.text().slice(0, 240)); });
  await page.addInitScript(() => {
    const wrap = (obj, key) => {
      const orig = obj[key];
      obj[key] = function (...args) {
        const t0 = performance.now();
        const out = orig.apply(this, args);
        const done = (extra) => {
          const dt = performance.now() - t0;
          if (dt > 15) console.warn(`phase ${key} ${Math.round(dt)}ms ${extra || ''}`);
        };
        if (out && typeof out.then === 'function') out.then(() => done('async'), () => done('err'));
        else done('');
        return out;
      };
    };
    wrap(window, 'createImageBitmap');
    const origPost = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (msg, transfer) {
      const t0 = performance.now();
      const n = transfer && transfer.length;
      const out = origPost.apply(this, arguments);
      const dt = performance.now() - t0;
      if (dt > 15) console.warn(`phase postMessage ${Math.round(dt)}ms transfers ${n || 0} op ${msg && msg.op}`);
      return out;
    };
    const origURL = URL.createObjectURL;
    URL.createObjectURL = function (obj) {
      const t0 = performance.now();
      const u = origURL.call(URL, obj);
      const dt = performance.now() - t0;
      if (dt > 15) console.warn(`phase createObjectURL ${Math.round(dt)}ms size ${obj && obj.size}`);
      return u;
    };
    window.__scripts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) for (const s of e.scripts || []) {
        if (s.duration < 40) continue;
        window.__scripts.push({ d: Math.round(s.duration), url: (s.sourceURL || '').split('/').pop(), fn: s.sourceFunctionName || '', pos: s.sourceCharPosition, inv: s.invoker || '' });
      }
    }).observe({ type: 'long-animation-frame' });
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => document.body.dataset.modelReady === '1', null, { timeout: 400000 });
  console.log('ready');
  const injected = await page.evaluate(async () => {
    const before = window.__scripts.length;
    const u = new Uint8Array(32768);
    const blob = new Blob([u], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'injected.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    await new Promise((r) => setTimeout(r, 500));
    return window.__scripts.slice(before);
  });
  console.log('injected download', JSON.stringify(injected));
  await page.evaluate(() => { try { window.NEURALESE?.v5?.out?.timeline?.(); } catch (e) { console.warn('phase timeline ' + e.message); } });
  await page.waitForTimeout(800);
  const targets = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('canvas')) {
      const box = el.parentElement && el.parentElement.querySelector('.xb button');
      if (!box) continue;
      const id = el.id;
      if (!id) continue;
      out.push({ id, pack: !!(el._pack && el._pack.cols), thumb: !!el._thumb, bmp: !!el._bmp, cols: el._pack ? el._pack.cols.length : 0, n: el._pack && el._pack.cols[0] ? el._pack.cols[0].length : 0 });
    }
    return out;
  });
  console.log('targets', JSON.stringify(targets.slice(0, 12)), 'n', targets.length);
  for (const t of targets.filter((x) => x.pack || x.thumb).slice(0, 8)) {
    for (const kind of ['csv', 'png']) {
      const before = await page.evaluate(() => window.__scripts.length);
      await page.evaluate(({ id, kind }) => {
        const b = document.querySelector(`.xb[data-for="${id}"] button[data-x="${kind}"]`);
        window.__click = kind + ':' + id;
        b && b.click();
      }, { id: t.id, kind });
      await page.waitForTimeout(600);
      const scripts = await page.evaluate((n) => window.__scripts.slice(n), before);
      if (scripts.length) console.log('HIT', t.id, kind, JSON.stringify(scripts));
    }
  }
  await browser.close();
});

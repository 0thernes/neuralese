import { test, expect, chromium } from '@playwright/test';
import fs from 'node:fs';

const URL = process.env.PREVIEW_URL || 'https://0thernes.github.io/neuralese/preview/?notour';
const WIDTHS = [[390, 844, 'mobile'], [768, 1024, 'tablet'], [1440, 900, 'desktop']];

async function nonBlank(page, selector) {
  return page.evaluate((sel) => {
    const c = document.querySelector(sel);
    if (!(c instanceof HTMLCanvasElement) || c.clientWidth < 20 || c.clientHeight < 20) return { ok: false, reason: 'size', w: c?.clientWidth ?? 0, h: c?.clientHeight ?? 0 };
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { ok: c.width > 20, reason: 'no-gl-context', w: c.width, h: c.height };
    const pix = new Uint8Array(4);
    const samples = [];
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(((i % 3) + 0.5) * c.width / 3);
      const y = Math.floor((Math.floor(i / 3) + 0.5) * c.height / 3);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pix);
      samples.push(pix[0] + pix[1] + pix[2] + pix[3]);
    }
    return { ok: samples.some((v) => v > 0), samples, w: c.width, h: c.height };
  }, selector);
}

test('every workspace control, three widths, no console errors', async () => {
  test.setTimeout(2400000);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/google/chrome/chrome',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  const report = { url: URL, views: {} };
  const failures = [];
  for (const [w, h, name] of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.setDefaultTimeout(180000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', (e) => errors.push('PAGE ' + (e.message || '').slice(0, 400)));
    page.on('dialog', (d) => { void d.dismiss(); });
    page.on('filechooser', (fc) => { void fc.setFiles({ name: 'empty.json', mimeType: 'application/json', buffer: Buffer.from('{}') }); });
    await page.addInitScript(() => {
      localStorage.setItem('neuralese.v17.toured', '1');
      window.__blockedNav = 0;
      const block = () => { window.__blockedNav++; };
      location.reload = block;
      window.open = () => null;
    });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('#v17 .wsbar', { timeout: 240000 });
    await page.keyboard.press('Escape');
    const workspaces = await page.locator('.wsbar button[data-ws]').evaluateAll((els) => els.map((e) => e.getAttribute('data-ws')));
    expect(workspaces.length).toBeGreaterThanOrEqual(13);
    let clicked = 0;
    let disabled = 0;
    for (const id of workspaces) {
      const found = await page.evaluate((ws) => {
        const b = document.querySelector(`#v17 .wsbar button[data-ws="${ws}"]`);
        if (!b) return false;
        b.click();
        return true;
      }, id);
      if (!found) {
        failures.push(`${name} lost workspace button ${id} url=${page.url()}`);
        break;
      }
      fs.appendFileSync('/tmp/e2e-progress.txt', `${name} ${id}\n`);
      await page.waitForTimeout(150);
      const tabs = await page.locator('.tabstrip button[role=tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-panel')));
      for (const panel of tabs) {
        await page.evaluate((pid) => { document.querySelector(`.tabstrip button[data-panel="${CSS.escape(pid)}"]`)?.click(); }, panel);
        await page.waitForTimeout(40);
        const stats = await page.evaluate((pid) => {
          const host = document.querySelector(`.panel[data-panel="${CSS.escape(pid)}"]`);
          if (!host) return { missing: true, clicked: [], disabled: 0 };
          const clicked = [];
          let disabled = 0;
          for (const el of host.querySelectorAll('button, input[type="checkbox"]')) {
            if (el instanceof HTMLInputElement && el.type === 'file') continue;
            if (el.disabled) { disabled++; continue; }
            const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 80);
            const before = host.innerText.slice(0, 240);
            el.click();
            clicked.push({ label, changed: host.innerText.slice(0, 240) !== before });
          }
          return { clicked, disabled };
        }, panel);
        if (stats.missing) failures.push(`${name} missing panel ${panel}`);
        clicked += stats.clicked?.length || 0;
        disabled += stats.disabled || 0;
      }
    }
    const jump = async (ws, panel) => {
      await page.evaluate((id) => document.querySelector(`#v17 .wsbar button[data-ws="${id}"]`)?.click(), ws);
      await page.waitForFunction((id) => document.querySelector('#v17 .wsbar button.on')?.dataset.ws === id, ws, { timeout: 20000 });
      await page.evaluate((pid) => document.querySelector(`.tabstrip button[data-panel="${CSS.escape(pid)}"]`)?.click(), panel);
      await page.waitForTimeout(400);
    };
    await jump('overview', 'cosmos');
    await page.waitForTimeout(1000);
    const cosmos = await nonBlank(page, '.cosmos-canvas');
    await jump('model', 'legacy:viz');
    await page.waitForTimeout(600);
    const gl = await nonBlank(page, '#gl');
    if (!cosmos.ok) failures.push(`${name} cosmos blank ${JSON.stringify(cosmos)}`);
    if (!gl.ok) failures.push(`${name} stage blank ${JSON.stringify(gl)}`);
    if (errors.length) failures.push(`${name} console ${errors.slice(0, 5).join(' | ')}`);
    report.views[name] = { width: w, height: h, workspaces: workspaces.length, clicked, disabled, cosmos, gl, errors: errors.slice(0, 8) };
    await page.close();
  }
  fs.mkdirSync('test/e2e', { recursive: true });
  fs.writeFileSync('test/e2e/click-all-output.json', JSON.stringify({ report, failures }, null, 2));
  console.log(JSON.stringify(report, null, 2));
  expect(failures, failures.join('\n')).toEqual([]);
  await browser.close();
});

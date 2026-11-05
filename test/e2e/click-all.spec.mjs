import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import zlib from 'node:zlib';

const URL = process.env.PREVIEW_URL || 'https://0thernes.github.io/neuralese/preview/?notour';
const WIDTHS = [[390, 844, 'mobile'], [768, 1024, 'tablet'], [1440, 900, 'desktop']].filter((x) => !process.env.E2E_VIEW || x[2] === process.env.E2E_VIEW);

// A presented WebGL/WebGPU frame is often gone from readPixels. The screenshot is what the page shows.
function pngVaries(buf) {
  let off = 8; let width = 0; let height = 0; let colorType = 6; const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off); const type = buf.toString('ascii', off + 4, off + 8); const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 4;
  const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = width * bpp;
  const prev = Buffer.alloc(stride); const row = Buffer.alloc(stride); let p = 0; let first = null; let varied = false;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    for (let i = 0; i < stride; i++) {
      const x = raw[p++]; const a = i >= bpp ? row[i - bpp] : 0; const b = prev[i]; const c = i >= bpp ? prev[i - bpp] : 0;
      let v = x;
      if (filter === 1) v = (x + a) & 255;
      else if (filter === 2) v = (x + b) & 255;
      else if (filter === 3) v = (x + ((a + b) >> 1)) & 255;
      else if (filter === 4) { const pp = a + b - c; const pa = Math.abs(pp - a); const pb = Math.abs(pp - b); const pc = Math.abs(pp - c); v = (x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
      row[i] = v;
    }
    if (first == null) first = row[0] + (row[1] || 0) + (row[2] || 0);
    for (let i = 0; i < stride; i += bpp * 16) { const s = row[i] + (row[i + 1] || 0) + (row[i + 2] || 0); if (Math.abs(s - first) > 12) varied = true; }
    prev.set(row);
  }
  return { ok: varied && width >= 20 && height >= 20, w: width, h: height };
}

async function nonBlank(page, selector) {
  const loc = page.locator(selector).first();
  const box = await loc.boundingBox({ timeout: 20000 }).catch(() => null);
  if (!box || box.width < 20 || box.height < 20) return { ok: false, reason: 'size', w: box?.width ?? 0, h: box?.height ?? 0 };
  const png = await loc.screenshot({ type: 'png', timeout: 20000 });
  return pngVaries(png);
}

for (const [w, h, name] of WIDTHS) test(`click every control · ${name}`, async () => {
  test.setTimeout(3600000);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/google/chrome/chrome',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  const report = { url: URL, views: {} };
  const failures = [];
    const context = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await context.newPage();
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
      // Schedule stacks for timers and promise continuations. The wrapper calls the original
      // function immediately; LoAF still times that work. Empty-URL setTimeout(resolve) has no
      // source of its own, so the stack at the call is what names the function.
      window.__timerRuns = [];
      const tidy = (stack) => (stack || '').split('\n').slice(1, 10).map((s) => s.trim().replace(/\?v=\d+/, '')).join('\n');
      globalThis.__yieldFrom = (stack) => {
        const lines = String(stack || '').split('\n').map((s) => s.trim()).filter(Boolean);
        globalThis.__yieldStack = lines.length > 1 ? tidy(stack) : String(stack || '').slice(0, 180);
      };
      globalThis.__handlers = [];
      globalThis.__handler = (fn) => { globalThis.__handlers.push({ t: performance.now(), src: String(fn).replace(/\s+/g, ' ').slice(0, 180) }); };
      const origTimeout = window.setTimeout;
      window.setTimeout = function (fn, delay, ...args) {
        if (typeof fn !== 'function') return origTimeout(fn, delay, ...args);
        const scheduled = tidy(new Error().stack);
        return origTimeout(function () {
          const t0 = performance.now();
          globalThis.__yieldStack = '';
          const r = fn.apply(this, arguments);
          window.__timerRuns.push({ scheduled, yield: globalThis.__yieldStack || '', t0, t1: performance.now(), click: window.__click || '' });
          return r;
        }, delay, ...args);
      };
    });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('#v17 .wsbar', { timeout: 240000 });
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      window.__frames = [];
      window.__scripts = [];
      window.__marks = [];
      window.__loaf = false;
      const glCallback = (s) => s.invokerType === 'user-callback' && /FrameRequestCallback/.test(s.invoker || '') && /stage-|cosmos-|viz\.js|hero\.js/.test(s.sourceURL || '');
      const moduleEval = (s) => s.invokerType === 'module-script' || /import\.then/.test(s.invoker || '');
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (e.duration < 50) continue;
            const scripts = e.scripts || [];
            const hasGl = scripts.some(glCallback);
            // A frame whose only long scripts are a WebGL render callback, or the module evaluation that
            // creates that renderer (SwiftShader blocks inside WebGPURenderer.init), is paint/GL. Click
            // handlers and timer slices stay in the app total. Both numbers are reported.
            const app = scripts.filter((s) => !(s.invokerType === 'user-callback' && /FrameRequestCallback/.test(s.invoker || '')) && !(hasGl && moduleEval(s)));
            const appMs = app.reduce((a, s) => a + s.duration, 0);
            const top = [...scripts].sort((a, b) => b.duration - a.duration)[0];
            const label = top ? `${top.sourceFunctionName || top.invokerType || '?'} ${(top.sourceURL || '').split('/').pop()} ${Math.round(top.duration)}ms ${top.invoker || ''}`.slice(0, 140) : 'paint';
            const row = { d: Math.round(e.duration), app: Math.round(appMs), paint: appMs < 50, gl: hasGl && appMs < 50, name: label, click: window.__click || '', start: Math.round(e.startTime) };
            window.__frames.push(row);
            for (const s of app) {
              if (s.duration < 50) continue;
              const start = s.startTime;
              const runs = window.__timerRuns || [];
              let best = null;
              for (const r of runs) if (Math.abs(r.t0 - start) < 30 && (!best || Math.abs(r.t0 - start) < Math.abs(best.t0 - start))) best = r;
              const hs = window.__handlers || [];
              let handler = '';
              let handlerDt = Infinity;
              for (const h of hs) {
                const dt = Math.abs(h.t - start);
                if (dt < handlerDt && h.t >= start - 40 && h.t <= start + 80) { handler = h.src; handlerDt = dt; }
              }
              window.__scripts.push({
                d: Math.round(s.duration), start: Math.round(start), exec: Math.round(s.executionStart || start),
                url: (s.sourceURL || '').split('/').pop(), fn: s.sourceFunctionName || '', pos: String(s.sourceCharPosition || ''),
                inv: s.invoker || '', type: s.invokerType || '',
                layout: Math.round(s.forcedStyleAndLayoutDuration || 0), pause: Math.round(s.pauseDuration || 0),
                click: window.__click || '',
                scheduled: best ? best.scheduled : '',
                then: best ? best.yield : '',
                handler,
                timerMs: best ? Math.round(best.t1 - best.t0) : 0,
              });
            }
          }
        }).observe({ type: 'long-animation-frame' });
        window.__loaf = true;
      } catch { /* long animation frames are unavailable; the raw long-task list is the gate */ }
      window.__long = [];
      try { new PerformanceObserver((list) => { for (const e of list.getEntries()) if (e.duration >= 50) window.__long.push(Math.round(e.duration)); }).observe({ type: 'longtask' }); } catch { /* this browser has no long-task entries */ }
    });
    const axe = await new AxeBuilder({ page }).include('#top').include('#v17').analyze();
    const serious = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    if (serious.length) failures.push(`${name} axe ${serious.map((v) => v.id + ':' + v.nodes.length).slice(0, 8).join(',')}`);
    const workspaces = await page.locator('.wsbar button[data-ws]').evaluateAll((els) => els.map((e) => e.getAttribute('data-ws')));
    expect(workspaces.length).toBeGreaterThanOrEqual(13);
    const showWs = async (id) => {
      const found = await page.evaluate((ws) => { const b = document.querySelector(`#v17 .wsbar button[data-ws="${ws}"]`); if (!b) return false; b.click(); return true; }, id);
      if (!found) return false;
      return page.waitForFunction((ws) => document.querySelector('#v17 .wsbar button.on')?.dataset.ws === ws, id, { timeout: 180000 }).then(() => true).catch(() => false);
    };
    const clickControls = (panel) => page.evaluate(async (pid) => {
      const paint = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(() => { const t0 = performance.now(); resolve(); queueMicrotask(() => { const ms = performance.now() - t0; if (ms >= 40) console.log('CONT', Math.round(ms), window.__click || ''); }); }, 0)));
      const btn = [...document.querySelectorAll('#v17 .tabstrip button[role=tab]')].find((b) => b.getAttribute('data-panel') === pid);
      btn?.click();
      await paint();
      const host = [...document.querySelectorAll('#v17 .panel')].find((el) => el.getAttribute('data-panel') === pid);
      if (!host) return { missing: true, clicked: 0, disabled: 0, ws: document.querySelector('#v17 .wsbar button.on')?.getAttribute('data-ws'), panels: [...document.querySelectorAll('#v17 .panel')].map((p) => p.getAttribute('data-panel')), tabs: [...document.querySelectorAll('#v17 .tabstrip button[role=tab]')].map((b) => b.getAttribute('data-panel')) };
      let clicked = 0; let disabled = 0;
      for (const el of host.querySelectorAll('button, input[type="checkbox"]')) {
        if (el instanceof HTMLInputElement && el.type === 'file') continue;
        if (el.disabled) { disabled++; continue; }
        window.__click = (el.id || el.getAttribute('data-hubload') || el.textContent || '').trim().slice(0, 48);
        const t0 = performance.now();
        performance.mark('click-before');
        window.__marks.push({ k: 'before', label: window.__click, t: Math.round(t0) });
        el.click();
        performance.mark('click-after');
        window.__marks.push({ k: 'after', label: window.__click, t: Math.round(performance.now()), sync: Math.round(performance.now() - t0) });
        clicked++;
        await paint();
      }
      return { missing: false, clicked, disabled };
    }, panel);
    let clicked = 0;
    let disabled = 0;
    if (!process.env.E2E_PIXELS_ONLY) for (const id of workspaces) {
      if (!await showWs(id)) { failures.push(`${name} lost workspace button ${id} url=${page.url()}`); break; }
      fs.appendFileSync('/tmp/e2e-progress.txt', `${name} ${id}\n`);
      await page.waitForTimeout(150);
      const tabs = await page.locator('#v17 .tabstrip button[role=tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-panel')));
      for (const panel of tabs) {
        // A control can call showTab and move the shell to another workspace. Come back, then open this panel.
        // showTab from a control is supposed to leave this panel. That navigation is the
        // control working. Open the intended panel and click its controls in one turn,
        // before a queued showTab can move the shell again.
        let stats = await clickControls(panel);
        if (stats.missing) {
          await showWs(id);
          await page.waitForTimeout(40);
          stats = await page.evaluate(async ({ ws, pid }) => {
            const paint = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(() => { const t0 = performance.now(); resolve(); queueMicrotask(() => { const ms = performance.now() - t0; if (ms >= 40) console.log('CONT', Math.round(ms), window.__click || ''); }); }, 0)));
            if (document.querySelector('#v17 .wsbar button.on')?.dataset.ws !== ws) document.querySelector(`#v17 .wsbar button[data-ws="${ws}"]`)?.click();
            await paint();
            const btn = [...document.querySelectorAll('#v17 .tabstrip button[role=tab]')].find((b) => b.getAttribute('data-panel') === pid);
            btn?.click();
            await paint();
            const host = [...document.querySelectorAll('#v17 .panel')].find((el) => el.getAttribute('data-panel') === pid);
            if (!host) return { missing: true, clicked: 0, disabled: 0, ws: document.querySelector('#v17 .wsbar button.on')?.dataset.ws, panels: [...document.querySelectorAll('#v17 .panel')].map((p) => p.getAttribute('data-panel')), tabs: [...document.querySelectorAll('#v17 .tabstrip button[role=tab]')].map((b) => b.getAttribute('data-panel')) };
            let clicked = 0, disabled = 0;
            for (const el of host.querySelectorAll('button, input[type="checkbox"]')) {
              if (el instanceof HTMLInputElement && el.type === 'file') continue;
              if (el.disabled) { disabled++; continue; }
              window.__click = (el.id || el.getAttribute('data-hubload') || el.textContent || '').trim().slice(0, 48);
              const t0 = performance.now();
              performance.mark('click-before');
              window.__marks.push({ k: 'before', label: window.__click, t: Math.round(t0) });
              el.click();
              performance.mark('click-after');
              window.__marks.push({ k: 'after', label: window.__click, t: Math.round(performance.now()), sync: Math.round(performance.now() - t0) });
              clicked++;
              await paint();
            }
            return { missing: false, clicked, disabled };
          }, { ws: id, pid: panel });
        }
        if (stats.missing) { console.log('MISSING', name, panel, JSON.stringify(stats)); failures.push(`${name} missing panel ${panel} ws=${stats.ws} panels=${(stats.panels || []).join('|')} tabs=${(stats.tabs || []).slice(0, 12).join('|')}`); }
        clicked += stats.clicked || 0;
        disabled += stats.disabled || 0;
      }
    }
    // Heavy buttons keep the main thread after they yield. A fresh page is the check that the
    // stage still draws; the clicks above already ran on this page.
    const shotContext = await browser.newContext({ viewport: { width: w, height: h } });
    const shot = await shotContext.newPage();
    shot.setDefaultTimeout(60000);
    const shotErrors = [];
    shot.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) shotErrors.push(m.text().slice(0, 300)); });
    shot.on('pageerror', (e) => shotErrors.push('PAGE ' + (e.message || '').slice(0, 400)));
    await shot.addInitScript(() => { localStorage.setItem('neuralese.v17.toured', '1'); });
    await shot.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await shot.waitForSelector('#v17 .wsbar', { timeout: 240000 });
    const showShot = async (ws, panel) => {
      await shot.evaluate((id) => document.querySelector(`#v17 .wsbar button[data-ws="${id}"]`)?.click(), ws);
      await shot.waitForFunction((id) => document.querySelector('#v17 .wsbar button.on')?.dataset.ws === id, ws);
      await shot.evaluate((pid) => { const btn = [...document.querySelectorAll('#v17 .tabstrip button[role=tab]')].find((b) => b.getAttribute('data-panel') === pid); btn?.click(); }, panel);
      await shot.waitForTimeout(1200);
    };
    await showShot('overview', 'cosmos');
    const cosmos = await nonBlank(shot, '.cosmos-canvas');
    await showShot('model', 'legacy:viz');
    const gl = await nonBlank(shot, '#gl');
    errors.push(...shotErrors);
    await shot.close();
    if (!cosmos.ok) failures.push(`${name} cosmos blank ${JSON.stringify(cosmos)}`);
    if (!gl.ok) failures.push(`${name} stage blank ${JSON.stringify(gl)}`);
    if (errors.length) failures.push(`${name} console ${errors.slice(0, 5).join(' | ')}`);
    const timing = await page.evaluate(() => ({ loaf: !!window.__loaf, frames: window.__frames || [], tasks: window.__long || [], scripts: window.__scripts || [], marks: window.__marks || [] })).catch(() => ({ loaf: false, frames: [], tasks: [], scripts: [], marks: [] }));
    const p95of = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)] : 0; };
    const raw = timing.loaf ? timing.frames.map((f) => f.d) : timing.tasks;
    const paint = timing.loaf ? timing.frames.filter((f) => f.paint).map((f) => f.d) : [];
    const glInit = timing.loaf ? timing.frames.filter((f) => f.gl) : [];
    const js = timing.loaf ? timing.frames.filter((f) => !f.paint) : timing.tasks.map((d) => ({ d, app: d, name: 'longtask' }));
    const jsD = js.map((f) => timing.loaf ? f.app : f.d);
    const longMax = raw.length ? Math.max(...raw) : 0;
    const longP95 = p95of(raw);
    const paintMax = paint.length ? Math.max(...paint) : 0;
    const glMax = glInit.length ? Math.max(...glInit.map((f) => f.d)) : 0;
    const glName = glInit.sort((a, b) => b.d - a.d)[0];
    const jsMax = jsD.length ? Math.max(...jsD) : 0;
    const jsP95 = p95of(jsD);
    const worst = [...js].sort((a, b) => (b.app ?? b.d) - (a.app ?? a.d))[0];
    // Paint-only frames (no application script, or only a SwiftShader FrameRequestCallback) are reported and not gated.
    // The gate is the application script inside the other frames: max under 200ms, p95 under 100ms. Raw numbers stay in the log.
    if (!timing.loaf) {
      const over = timing.tasks.filter((d) => d >= 200);
      if (over.length) failures.push(`${name} long tasks >=200ms (long animation frames unavailable, so paint could not be separated) max=${longMax} p95=${longP95} ${over.slice(0, 8).join(',')}`);
    } else if (jsMax >= 200 || jsP95 >= 100) failures.push(`${name} app script max=${jsMax} p95=${jsP95} (raw frame max=${longMax} p95=${longP95}, paint/GL max=${paintMax}, gl-init max=${glMax}${glName ? ' ' + glName.name : ''}) worst=${worst ? worst.name : ''}${worst && worst.click ? ' @' + worst.click : ''}`);
    const topApp = [...js].sort((a, b) => (b.app ?? b.d) - (a.app ?? a.d)).slice(0, 8);
    console.log(`${name} raw max=${longMax} p95=${longP95} n=${raw.length} | paint/GL max=${paintMax} n=${paint.length} gl-init max=${glMax}${glName ? ' (' + glName.name + ')' : ''} | app max=${jsMax} p95=${jsP95} n=${js.length}${worst ? ' worst=' + worst.name + (worst.click ? ' @' + worst.click : '') : ''}${timing.loaf ? '' : ' (no long-animation-frames)'}`);
    if (topApp.length) console.log(`${name} top`, topApp.map((f) => `${f.app ?? f.d}ms @${f.click || '?'} ${f.name}`).join(' | '));
    const named = [...(timing.scripts || [])].sort((a, b) => b.d - a.d).slice(0, 8);
    if (named.length) console.log(`${name} src`, named.map((s) => `${s.d}ms ${(s.handler || (s.then || '').split('\n').slice(1, 4).join(' / ')).slice(0, 140)}`).join(' || '));
    report.views[name] = { width: w, height: h, workspaces: workspaces.length, clicked, disabled, cosmos, gl, errors: errors.slice(0, 8), longMax, longP95, longN: raw.length, paintMax, paintN: paint.length, glInitMax: glMax, glInit: glName ? glName.name : '', appMax: jsMax, appP95: jsP95, appN: js.length, worst: worst ? worst.name : '', loaf: timing.loaf };
    await Promise.race([page.close(), new Promise((r) => setTimeout(r, 5000))]);
  fs.mkdirSync('test/e2e', { recursive: true });
  const marks = timing.marks || [];
  const attributed = (timing.scripts || []).map((s) => {
    let click = '';
    let sync = 0;
    for (let i = 0; i < marks.length; i++) {
      const m = marks[i];
      if (m.k !== 'before' || m.t > s.start) continue;
      const after = marks[i + 1] && marks[i + 1].k === 'after' ? marks[i + 1] : null;
      if (!after || s.start <= after.t + 2 || (after && s.start >= m.t && s.start <= after.t)) { click = m.label; sync = after ? after.sync : 0; }
    }
    const during = marks.filter((m, i) => m.k === 'before' && m.t <= s.start && marks[i + 1] && marks[i + 1].t >= s.start);
    return { ...s, mark: during.length ? during[during.length - 1].label : click, sync: during.length && marks[marks.indexOf(during[during.length - 1]) + 1] ? marks[marks.indexOf(during[during.length - 1]) + 1].sync : sync };
  });
  fs.writeFileSync(`test/e2e/attribution-${name}.json`, JSON.stringify(attributed, null, 2));
  fs.writeFileSync(`test/e2e/click-all-${name}.json`, JSON.stringify({ report, failures }, null, 2));
  console.log(JSON.stringify(report, null, 2));
  expect(failures, failures.join('\n')).toEqual([]);
  await browser.close();
});

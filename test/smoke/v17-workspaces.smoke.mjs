/* global CSS, InputEvent */
// v17 smoke: every workspace and every panel (all 75 legacy tabs + v17 panels) at 1440x900, 1240x700 and 390x844,
// with zero console errors and zero CSP violations; verifies the feature-parity checklist (each legacy tab mounts,
// visible and non-empty, inside its new workspace) and the 3D cosmos/nested renderers. Optional SHOTS=dir for screenshots.
// Usage: node test/smoke/v17-workspaces.smoke.mjs http://localhost:8765/
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const url = process.argv[2] || 'http://localhost:8765/', SHOTS = process.env.SHOTS, VIEWS = process.env.VIEWS ? JSON.parse(process.env.VIEWS) : [[1440, 900], [1240, 700], [390, 844]];
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 1800000, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const fail = [], T = Date.now(), log = (...a) => console.log(`[${((Date.now() - T) / 1000).toFixed(0)}s]`, ...a), report = { views: {}, parity: {} };
const chk = (name, ok, info) => { log(name, ok ? 'OK' : 'FAIL', JSON.stringify(info ?? '').slice(0, 400)); if (!ok) fail.push(name); };
for (const [w, h] of VIEWS) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  await p.evaluateOnNewDocument(() => { localStorage.setItem('neuralese.v17.toured', '1'); window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sourceFile || '') + ':' + e.lineNumber)); });
  const t0 = Date.now(); await p.goto(url);
  await p.waitForFunction(() => document.querySelector('#v17 .wsbar') && window.NEURALESE_LAST, { timeout: +(process.env.LOAD_MS || 600000) });
  const loadMs = Date.now() - t0; const nav = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const fcp = performance.getEntriesByName('first-contentful-paint')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: fcp ? Math.round(fcp.startTime) : null }; });
  const res = await p.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = { ws: [], panels: {}, empty: [] };
    for (const btn of [...document.querySelectorAll('.wsbar button[data-ws]')]) {
      const ws = btn.dataset.ws; btn.click(); for (let k = 0; k < 100 && document.querySelector('.wsbar button.on')?.dataset.ws !== ws; k++) await sleep(50); await sleep(200); out.ws.push(ws);
      const ids = [...document.querySelectorAll('.tabstrip button[role=tab]')].map((x) => x.dataset.panel);
      for (const id of ids) {
        const tb = document.querySelector(`.tabstrip button[data-panel="${CSS.escape(id)}"]`); if (!tb) { out.empty.push(id + ' (tab vanished; now ws ' + document.querySelector('.wsbar button.on')?.dataset.ws + ')'); continue; } tb.click(); await sleep(id === 'cosmos' || id === 'nested3d' ? 1500 : 120);
        const panel = document.querySelector(`.panel[data-panel="${CSS.escape(id)}"]`);
        const el = id.startsWith('legacy:') ? document.getElementById('pane_' + id.slice(7)) : panel?.firstElementChild;
        const ok = !!(panel && el && panel.contains(el) && el.offsetParent !== null && (el.textContent.trim().length > 0 || el.querySelector('canvas')));
        out.panels[id] = { ws, ok }; if (!ok) out.empty.push(id);
      }
    }
    return out;
  });
  const legacyKeys = await p.evaluate(() => window.NEURALESE.order.map((o) => o[0]));
  const missing = legacyKeys.filter((k) => !res.panels['legacy:' + k]?.ok);
  chk(`${w}x${h}: ${res.ws.length} workspaces`, res.ws.length >= 8 && res.ws.length <= 12, res.ws);
  chk(`${w}x${h}: all ${legacyKeys.length} legacy tabs mounted + visible in a workspace`, legacyKeys.length === 75 && missing.length === 0, missing);
  chk(`${w}x${h}: every panel non-empty`, res.empty.length === 0, res.empty);
  // 3D: cosmos renders with real traces
  await p.evaluate(async () => { document.querySelector('.wsbar button[data-ws=overview]').click(); for (let k = 0; k < 100 && document.querySelector('.wsbar button.on')?.dataset.ws !== 'overview'; k++) await new Promise((r) => setTimeout(r, 50)); await new Promise((r) => setTimeout(r, 300)); document.querySelector('.tabstrip button[data-panel=cosmos]')?.click(); await new Promise((r) => setTimeout(r, 2500)); });
  const hud = await p.evaluate(() => document.querySelector('.cosmos-hud')?.textContent || '');
  chk(`${w}x${h}: cosmos renderer up with trace data`, /WebGPU|WebGL2/.test(hud) && /token \d+\/\d+/.test(hud), hud);
  // selection store drives the legacy inspector
  const selOk = await p.evaluate(async () => { document.querySelector('.tabstrip button[data-panel=selection]')?.click(); await new Promise((r) => setTimeout(r, 300)); const inp = document.querySelector('.selrow input'); if (!inp) return 'no selection panel'; inp.value = '3'; inp.dispatchEvent(new Event('change')); await new Promise((r) => setTimeout(r, 200)); return document.getElementById('selInfo').textContent; });
  chk(`${w}x${h}: selection store → legacy inspector`, /^L3/.test(selOk), selOk);
  // palette navigation
  const palOk = await p.evaluate(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); await new Promise((r) => setTimeout(r, 300)); const i = document.querySelector('.pal-in'); if (!i) return 'no palette'; i.value = 'MoE'; i.dispatchEvent(new InputEvent('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 100)); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); for (let k = 0; k < 100 && document.querySelector('.wsbar button.on')?.dataset.ws !== 'frontier'; k++) await new Promise((r) => setTimeout(r, 50)); return document.querySelector('.wsbar button.on')?.dataset.ws; });
  chk(`${w}x${h}: command palette navigates`, palOk === 'frontier', palOk);
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); for (const ws of ['overview', 'lens', 'frontier', 'experiments']) { await p.evaluate(async (x) => { document.querySelector(`.wsbar button[data-ws=${x}]`).click(); await new Promise((r) => setTimeout(r, 400)); if (x === 'frontier') { document.querySelector('.tabstrip button[data-panel=nested3d]')?.click(); await new Promise((r) => setTimeout(r, 2500)); } if (x === 'overview') { document.querySelector('.tabstrip button[data-panel=cosmos]')?.click(); await new Promise((r) => setTimeout(r, 2500)); } }, ws); await p.screenshot({ path: `${SHOTS}/after-${ws}-${w}x${h}.png` }); } }
  const csp = await p.evaluate(() => window.__csp);
  chk(`${w}x${h}: zero CSP violations`, csp.length === 0, csp.slice(0, 5)); chk(`${w}x${h}: zero console errors`, errs.length === 0, errs.slice(0, 5));
  report.views[`${w}x${h}`] = { loadMs, ...nav, panels: Object.keys(res.panels).length }; if (w === 1440) report.parity = Object.fromEntries(Object.entries(res.panels).map(([k, v]) => [k, v]));
  await p.close();
}
if (process.env.REPORT) fs.writeFileSync(process.env.REPORT, JSON.stringify(report, null, 1));
console.log('RESULT', JSON.stringify(report.views)); console.log(fail.length ? 'SMOKE FAIL: ' + fail.join(', ') : 'SMOKE OK'); await b.close(); process.exit(fail.length ? 1 : 0);

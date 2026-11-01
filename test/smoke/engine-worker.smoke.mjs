// v15.3 smoke: generation runs in the engine Web Worker and produces exactly the main-thread (?noworker) tokens; the stricter CSP
// (no 'unsafe-eval', no inline <style>) raises zero violations while every tab renders and a notebook cell runs; main-thread long tasks
// during generation are reported for both backends. Usage: node test/smoke/engine-worker.smoke.mjs http://localhost:8765/
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const url = process.argv[2] || 'http://localhost:8765/', VER = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url))).version;
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 1800000, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const fail = [], T = Date.now(), log = (...a) => console.log(`[${((Date.now() - T) / 1000).toFixed(0)}s]`, ...a), out = {};
async function open(q) {
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 }); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  await p.evaluateOnNewDocument(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sourceFile || '') + ':' + e.lineNumber)); });
  await p.goto(url + q);
  try { await p.waitForFunction(() => window.NEURALESE && window.NEURALESE_LAST, { timeout: +(process.env.LOAD_MS || 600000) }); }
  catch (e) { console.log('load timeout', q, errs, await p.evaluate(() => [document.getElementById('genInfo')?.textContent, JSON.stringify(window.NEURALESE?.perf), window.__csp])); throw e; }
  return { p, errs };
}
const chk = (name, ok, info) => { log(name, ok ? 'OK' : 'FAIL', JSON.stringify(info).slice(0, 300)); if (!ok) fail.push(name); };
const gen = (p) => p.evaluate(async () => {
  const lt = []; const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => lt.push(e.duration))); po.observe({ type: 'longtask' });
  document.getElementById('d_n').value = 24; document.getElementById('d_mode').value = 'greedy'; document.getElementById('prompt').value = 'Once upon a time, there was a little girl named Lily. She loved to';
  const t0 = performance.now(); await window.NEURALESE.generate(); const ms = performance.now() - t0; await new Promise((r) => setTimeout(r, 100)); po.disconnect();
  return { backend: window.NEURALESE.perf.backend, text: window.NEURALESE_LAST.hacked, ms, longTasks: lt.length, longestMs: Math.round(Math.max(0, ...lt)), tps: window.NEURALESE.perf.tps };
});
const A = await open(''); log('loaded worker page');
await A.p.evaluate(() => window.NEURALESE.generate()); // warm-up (worker start + weight transfer)
const gw = await gen(A.p); chk('version', (await A.p.evaluate(() => document.getElementById('ver').textContent)).startsWith('v' + VER), VER);
chk('worker backend live', gw.backend === 'worker', gw);
const B = await open('?noworker'); await B.p.evaluate(() => window.NEURALESE.generate()); const gm = await gen(B.p);
chk('main-thread fallback', gm.backend === 'main-thread', gm); chk('worker tokens == main-thread tokens', gw.text === gm.text && gw.text.length > 20, { w: gw.text, m: gm.text });
out.worker = gw; out.mainThread = gm;
const tabs = await A.p.evaluate(async () => { const ids = [...document.querySelectorAll('#tabs button[data-t]')].map((x) => x.dataset.t); for (const t of ids) { window.NEURALESE.v5.api.showTab(t); await new Promise((r) => setTimeout(r, 30)); } return ids.length; });
const nb = await A.p.evaluate(async () => { window.NEURALESE.v5.api.showTab('nb'); await new Promise((r) => setTimeout(r, 200)); const ta = document.querySelector('#nbCells textarea'); if (!ta) return { skip: 'no notebook tab' }; ta.value = 'print(6 * 7)'; ta.dispatchEvent(new Event('input')); document.querySelector('#nbCells [data-run="0"]').click(); await new Promise((r) => setTimeout(r, 800)); return { out: document.getElementById('nbO0')?.textContent }; });
chk('notebook cell runs without unsafe-eval', nb.skip || /42/.test(nb.out || ''), nb);
const csp = await A.p.evaluate(() => window.__csp); chk('zero CSP violations across ' + tabs + ' tabs', csp.length === 0, csp.slice(0, 5));
chk('no console errors', A.errs.length === 0 && B.errs.length === 0, [...A.errs, ...B.errs].slice(0, 5));
console.log('RESULT', JSON.stringify(out)); console.log(fail.length ? 'SMOKE FAIL: ' + fail.join(', ') : 'SMOKE OK'); await b.close(); process.exit(fail.length ? 1 : 0);

// v7 smoke: every tab, every RESEARCH tool, CSP violations, leak test (500-token generation + repeated tab cycling), long tasks, narrow layout.
import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'http://localhost:8765/', shots = process.argv[3] || '/workspace/neuralese-v7';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 900000, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-webgpu-adapter=swiftshader', '--js-flags=--expose-gc'] });
const p = await b.newPage(); await p.setViewport({ width: 1680, height: 1000 }); const errs = [];
p.on('console', (m) => { if (m.type() === 'error') { errs.push(m.text()); console.log('[console.error]', m.text()); } }); p.on('pageerror', (e) => { errs.push(e.message); console.log('[pageerror]', e.message); });
const T = Date.now(), log = (...a) => console.log(`[${((Date.now() - T) / 1000).toFixed(1)}s]`, ...a), S = { fail: [] }, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await p.evaluateOnNewDocument(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); window.__lt = []; try { new PerformanceObserver((l) => l.getEntries().forEach((x) => window.__lt.push(x.duration))).observe({ type: 'longtask', buffered: true }); } catch { /* */ } });
await p.goto(url); await p.waitForFunction(() => window.NEURALESE && window.NEURALESE_LAST, { timeout: 240000 }); log('loaded');
S.version = await p.$eval('#ver', (e) => e.textContent); S.title = await p.title();
S.ltBy = {}; const check = async (name, fn, pred, arg) => { try { const n0 = await p.evaluate(() => window.__lt.length); const r = await p.evaluate(fn, arg); S.ltBy[name] = await p.evaluate((n) => Math.round(Math.max(0, ...window.__lt.slice(n))), n0); const ok = pred(r); S[name] = r; log(name, ok ? 'OK' : 'FAIL', JSON.stringify(r).slice(0, 300)); if (!ok) S.fail.push(name); } catch (e) { S.fail.push(name + ': ' + e.message.slice(0, 200)); log(name, 'ERR', e.message.slice(0, 300)); } };
await check('threeVendored', () => [...performance.getEntriesByType('resource')].filter((r) => /three/.test(r.name)).map((r) => r.name.replace(location.origin, '')), (r) => r.length >= 2 && r.every((x) => !/jsdelivr/.test(x)));
await check('hash', async () => { await new Promise((r) => setTimeout(r, 1500)); return { chip: document.getElementById('wHash').textContent, h: await window.NEURALESE.v5.out.hashes() }; }, (r) => /sha256 [0-9a-f]{12}/.test(r.chip) && r.h.orig === r.h.cur);
// every tab
const tabs = await p.$$eval('#tabs button', (bs) => bs.map((x) => x.dataset.t)); S.nTabs = tabs.length;
for (const t of tabs) { await p.evaluate((k) => window.NEURALESE.v5.api.showTab(k), t); await sleep(120); } log('visited', tabs.length, 'tabs');
// research tools
await check('statsHeads', () => window.NEURALESE.v5.out.statsHeads(0, 6, 500).then((r) => ({ n: r.length, minP: Math.min(...r.map((x) => x.p)), anyHolm: r.some((x) => x.holm < 0.05) })), (r) => r.n === 16 && r.minP > 0);
await check('acdc', () => window.NEURALESE.v5.out.acdc(0.02).then((r) => ({ n: r.circuit.length, f: r.faithfulness })), (r) => r.n > 0 && r.n < 68 && r.f > 0.5);
await check('scrub', () => window.NEURALESE.v5.out.scrub(), (r) => Math.abs(r.faithfulness - S.acdc.f) < 1e-4);
await check('probe', () => window.NEURALESE.v5.out.probe([2, 6]).then((r) => r.map((x) => ({ l: x.l, acc: x.real.test, sel: x.selectivity }))), (r) => r.every((x) => x.acc > 0.7 && x.sel > 0.1));
await check('data', () => { document.getElementById('daT').value = 'Tom had a big red ball. He played with it in the park every day.\n\nLily saw a cat. The cat was soft and she gave it some milk.'; document.getElementById('daP').click(); return new Promise((r) => setTimeout(() => r({ name: document.getElementById('daName').textContent, n: window.NEURALESE.v5.out.dataView(1) }), 300)); }, (r) => r.n === 2 && /pasted/.test(r.name));
await p.evaluate(() => document.getElementById('daC').click());
await check('evalClean', () => window.NEURALESE.v5.out.evalh(6).then((r) => ({ a: r.clean.ppl, b: r.cur.ppl, f: r.clean.factTop1 })), (r) => Math.abs(r.a - r.b) < 1e-9 && r.f >= 0.5);
await check('editEvalReplay', async () => { const N = window.NEURALESE; await N.v5.exec('edit scale 3.proj 0'); const r = await N.v5.out.evalh(6), m = await N.v5.out.manifest(); N.v5.api.reset(); const h0 = await N.v5.out.hashes(); const ok = await N.v5.out.replay(m); return { pplCur: r.cur.ppl, pplClean: r.clean.ppl, edits: m.edits.length, resetToOrig: h0.cur === h0.orig, replayOk: ok }; }, (r) => r.pplCur > r.pplClean && r.edits >= 1 && r.resetToOrig && r.replayOk);
await check('nb', async () => { const o = window.NEURALESE.v5.out; const r0 = await o.nbRun(0), r1 = await o.nbRun(1); return { t0: r0.text.slice(0, 40), plot: !!r0.plot, t1: r1.text.trim().length }; }, (r) => /mean CE/.test(r.t0) && r.plot && r.t1 === 64);
await check('report', () => window.NEURALESE.v5.out.report(), (r) => r.sections >= 5 && r.figs >= 3);
await check('logDiff', () => { const o = window.NEURALESE.v5.out, n = o.logRefresh(), a = window.NEURALESE.v5.api.runs(); return { n, diff: o.logDiff(a[a.length - 1].id, a[a.length - 2].id) }; }, (r) => r.n >= 2 && r.diff > 0);
await check('state', async () => { const o = window.NEURALESE.v5.out, s = o.stateExport(); window.NEURALESE.v5.api.reset(); o.stateImport(JSON.parse(JSON.stringify(s))); const h = await o.hashes(); return { edits: s.edits.length, restoredEdited: h.cur !== h.orig, cells: o.nbCells().length }; }, (r) => r.edits >= 1 && r.restoredEdited && r.cells >= 2);
await p.evaluate(() => window.NEURALESE.v5.api.reset());
for (const cmd of ['help', 'stats 0 4 300', 'acdc 0.05', 'probe 4', 'evalh 4', 'hash', 'manifest']) await check('term:' + cmd, async (c) => { const r = await window.NEURALESE.v5.exec(c); return String(typeof r === 'object' ? JSON.stringify(r) : r).slice(0, 120); }, (r) => !/error|unknown/i.test(r), cmd);
// shots
const shot = async (tab, name, fn) => { await p.evaluate((k) => window.NEURALESE.v5.api.showTab(k), tab); if (fn) await p.evaluate(fn); await sleep(700); await p.screenshot({ path: `${shots}-${name}.png` }); log('shot', name); };
await shot('acdc', 'acdc', () => window.NEURALESE.v5.out.acdc(0.02)); await shot('stats', 'stats'); await shot('probe', 'probe', () => window.NEURALESE.v5.out.probe([0, 1, 2, 3, 4, 5, 6, 7, 8])); await shot('evalh', 'eval'); await shot('repro', 'repro', () => window.NEURALESE.v5.out.hashes());
// leak test
const mem = async () => { await p.evaluate(() => window.gc && window.gc()); await sleep(300); const m = await p.metrics(); const r = await p.evaluate(() => { const i = window.NEURALESE.viz.renderer?.info?.memory; return { geo: i?.geometries, tex: i?.textures, nodes: document.getElementsByTagName('*').length }; }); return { heapMB: +(m.JSHeapUsedSize / 1e6).toFixed(1), listeners: m.JSEventListeners, ...r }; };
await check('gen500', async () => { const N = window.NEURALESE, d = N.v5.api.decode(); const n0 = d.n; d.n = 500; const t = performance.now(); await N.generate(); d.n = n0; return { ms: Math.round(performance.now() - t), toks: window.NEURALESE_LAST?.ids?.length ?? window.NEURALESE.v5.api.S().gen?.ids?.length }; }, (r) => r.ms > 0);
const m0 = await mem(); for (let k = 0; k < 4; k++) { for (const t of tabs) { await p.evaluate((x) => window.NEURALESE.v5.api.showTab(x), t); await sleep(40); } } const m1 = await mem(); for (let k = 0; k < 4; k++) { for (const t of tabs) { await p.evaluate((x) => window.NEURALESE.v5.api.showTab(x), t); await sleep(40); } } const m2 = await mem();
S.memory = { m0, m1, m2 }; log('memory', JSON.stringify(S.memory)); if (m2.heapMB - m1.heapMB > 10 || m2.listeners - m1.listeners > 50 || m2.geo - m1.geo > 5 || m2.tex - m1.tex > 5) S.fail.push('leak');
S.longTasks = await p.evaluate(() => ({ n: window.__lt.length, maxMs: Math.round(Math.max(0, ...window.__lt)), over200: window.__lt.filter((x) => x > 200).length }));
// narrow
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 }); await sleep(800); await p.evaluate(() => window.NEURALESE.v5.api.showTab('acdc')); await sleep(500); await p.screenshot({ path: `${shots}-narrow.png` });
S.narrow = await p.evaluate(() => ({ docW: document.documentElement.scrollWidth, vw: innerWidth, tabsVisible: !!document.querySelector('#tabs button')?.getBoundingClientRect().width }));
S.csp = await p.evaluate(() => window.__csp); if (S.csp.length) S.fail.push('csp');
S.errors = errs; console.log(JSON.stringify(S, null, 1)); await b.close(); process.exit(S.fail.length || errs.length ? 1 : 0);

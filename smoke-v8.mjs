// v8 smoke: TSOTCHKE group — every tab renders, every live claim holds, WASM (quantum_rng + Moonlab) loads under the CSP,
// QRNG golden bytes equal the Node value (cross-runtime determinism), an edit produces a non-zero Fubini–Study angle.
import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'http://localhost:8765/', shots = process.argv[3] || '/workspace/neuralese-v8';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 900000, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage(); await p.setViewport({ width: 1680, height: 1000 }); const errs = [];
p.on('console', (m) => { if (m.type() === 'error') { errs.push(m.text()); console.log('[console.error]', m.text()); } }); p.on('pageerror', (e) => { errs.push(e.message); console.log('[pageerror]', e.message); });
const T = Date.now(), log = (...a) => console.log(`[${((Date.now() - T) / 1000).toFixed(1)}s]`, ...a), S = { fail: [] }, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await p.evaluateOnNewDocument(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); });
await p.goto(url); await p.waitForFunction(() => window.NEURALESE && window.NEURALESE_LAST, { timeout: 240000 }); log('loaded');
S.version = await p.$eval('#ver', (e) => e.textContent);
const check = async (name, fn, pred, arg) => { try { const r = await p.evaluate(fn, arg); const ok = pred(r); S[name] = r; log(name, ok ? 'OK' : 'FAIL', JSON.stringify(r).slice(0, 400)); if (!ok) S.fail.push(name); } catch (e) { S.fail.push(name + ': ' + e.message.slice(0, 200)); log(name, 'ERR', e.message.slice(0, 300)); } };
const tabs = await p.$$eval('#tabs button', (bs) => bs.map((x) => x.dataset.t)); S.nTabs = tabs.length; for (const t of tabs) { await p.evaluate((k) => window.NEURALESE.v5.api.showTab(k), t); await sleep(80); }
await check('groups', () => [...document.querySelectorAll('#tabs button')].filter((x) => ['tsk', 'qrng', 'qgeom', 'taylor', 'claims'].includes(x.dataset.t)).map((x) => x.textContent), (r) => r.length === 5);
await check('badges', () => document.querySelectorAll('.tsk-badge').length, (r) => r >= 5);
const sh = async (k, f) => { await p.evaluate((x) => { document.documentElement.style.setProperty('--dockW', '880px'); window.NEURALESE.v5.api.showTab(x); }, k); await sleep(400); await p.screenshot({ path: `${shots}-${f}.png` }); };
await check('claims', async () => (await window.NEURALESE.v5.out.claims()).map((r) => [r.id, r.ok, r.ev]), (r) => r.length >= 8 && r.every((x) => x[1])); await sh('claims', 'claims');
await check('golden', async () => { const Q = await import('./tsotchke/qrng.js?v=8'); return Q.hex(await Q.bytes(new TextEncoder().encode('neuralese-v8'), 64)); }, (r) => r.startsWith('52d659a0'));
await check('qseed', async () => { const r = await window.NEURALESE.v5.out.qseedApply(); return { seed: r.seed32, d_seed: +document.getElementById('d_seed').value, p: r.provenance }; }, (r) => r.seed === r.d_seed && /pass/.test(r.p.health) && r.p.nistAllPass !== undefined);
await check('chsh', async () => window.NEURALESE.v5.out.chsh(20000), (r) => r.S > 2.6); await sh('qrng', 'qrng');
await check('taylorSelf', () => Math.max(...window.NEURALESE.v5.out.taylorSelf(8).map((r) => r.relErr)), (r) => r < 1e-12);
await check('taylorJet', async () => { const r = await window.NEURALESE.v5.out.taylorJet(1, 4); const i = r.eps.indexOf(0.05); return { d1: r.jet.deriv(1), err005: Math.abs(r.poly[i] - r.act[i]) }; }, (r) => r.err005 < 1e-6); await sh('taylor', 'taylor');
await check('fsClean', async () => Math.max(...(await window.NEURALESE.v5.out.fsdist()).map((x) => x.fs)), (r) => r < 1e-6);
await check('fsEdit', async () => { const A = window.NEURALESE.v5.api; A.ed().push({ kind: 'elem', target: { type: 'head', l: 5, i: 3 }, fn: 'scale', amt: 4 }); const rows = await window.NEURALESE.v5.out.fsdist(); return { max: Math.max(...rows.map((x) => x.fs)), dF: Math.max(...rows.map((x) => x.dF)) }; }, (r) => r.max > 1e-4 && r.dF < 1e-12); await sh('qgeom', 'qgeom');
await check('qgMetric', async () => (await window.NEURALESE.v5.out.qgMetric(1)).rs.map((x) => x.err), (r) => r[2] < 1e-2 && r[2] < r[0]);
await sh('tsk', 'tsotchke');
S.csp = await p.evaluate(() => window.__csp); if (S.csp.length) S.fail.push('csp');
S.errors = errs; console.log(JSON.stringify(S, null, 1)); await b.close(); process.exit(S.fail.length || errs.length ? 1 : 0);

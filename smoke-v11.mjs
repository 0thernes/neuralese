// v11 smoke: FRONTIER group — every tab renders and loads its data, every live check holds, live grokking and live PCI run,
// terminal commands work, version is 11.0.0, no CSP violations or console errors.
import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'http://localhost:8765/', shots = process.argv[3] || '/workspace/neuralese-v11/local';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 900000, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage(); await p.setViewport({ width: 1680, height: 1000 }); const errs = [];
p.on('console', (m) => { if (m.type() === 'error') { errs.push(m.text()); console.log('[console.error]', m.text()); } }); p.on('pageerror', (e) => { errs.push(e.message); console.log('[pageerror]', e.message); });
const T = Date.now(), log = (...a) => console.log(`[${((Date.now() - T) / 1000).toFixed(1)}s]`, ...a), S = { fail: [] }, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await p.evaluateOnNewDocument(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); });
await p.goto(url); await p.waitForFunction(() => window.NEURALESE && window.NEURALESE_LAST, { timeout: 240000 }); log('loaded');
const check = async (name, fn, pred, arg) => { try { const r = await p.evaluate(fn, arg); const ok = pred(r); S[name] = r; log(name, ok ? 'OK' : 'FAIL', JSON.stringify(r).slice(0, 400)); if (!ok) S.fail.push(name); } catch (e) { S.fail.push(name + ': ' + e.message.slice(0, 200)); log(name, 'ERR', e.message.slice(0, 300)); } };
const sh = async (k, f) => { await p.evaluate((x) => { document.documentElement.style.setProperty('--dockW', '880px'); window.NEURALESE.v5.api.showTab(x); }, k); await sleep(2500); await p.screenshot({ path: `${shots}-${f}.png` }); };
await check('version', () => document.getElementById('ver').textContent, (r) => r.startsWith('v11.0.0'));
await check('groups', () => [...document.querySelectorAll('#tabs button')].filter((x) => ['fx', 'fsc', 'fmind', 'frsi', 'fgrok', 'fatlas', 'fclaims'].includes(x.dataset.t)).length, (r) => r === 7);
for (const [k, f] of [['fx', 'frontier'], ['fsc', 'scorecard'], ['fmind', 'mind'], ['frsi', 'selfimprove'], ['fgrok', 'grokking'], ['fatlas', 'atlas']]) await sh(k, f);
await check('loaded', () => ['fxOut', 'fscOut', 'fmP1o', 'fmP3o', 'frOut', 'frOut2', 'fgOut', 'faOut'].map((id) => [id, (document.getElementById(id)?.textContent || '').slice(0, 40)]), (r) => r.every(([, t]) => t && !/could not load|missing|loading/.test(t)));
await check('frontier', async () => (await window.NEURALESE.v5.out.frontier()).map((r) => [r.h, r.pass]), (r) => r.length === 14 && r.every((x) => typeof x[1] === 'boolean' || (/^H6/.test(x[0]) && /pending/.test(x[1]))));
await check('fclaims', async () => (await window.NEURALESE.v5.out.fclaims()).map((r) => [r.id, r.ok, r.ev.slice(0, 60)]), (r) => r.length >= 19 && r.every((x) => x[1])); await sh('fclaims', 'fclaims');
await check('grokLive', async () => window.NEURALESE.v5.out.grokLive(300, 1), (r) => r.steps === 300 && r.train > 0.2);
await check('pciLive', async () => window.NEURALESE.v5.out.pci(), (r) => /PCI trained 0\.\d+/.test(r));
await p.evaluate(() => window.NEURALESE.v5.api.showTab('term')); await sleep(500);
await check('term', async () => { const o = document.getElementById('tmOut'), i = document.getElementById('tmIn'), n0 = o.textContent.length; for (const c of ['scorecard', 'frontier']) { i.value = c; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await new Promise((r) => setTimeout(r, 3000)); } return o.textContent.slice(n0); }, (r) => /GWT-ign/.test(r) && /H6b/.test(r)); await sh('term', 'term');
S.csp = await p.evaluate(() => window.__csp); if (S.csp.length) S.fail.push('csp');
S.errors = errs; console.log(JSON.stringify({ fail: S.fail, csp: S.csp, errors: errs })); await b.close(); process.exit(S.fail.length || errs.length ? 1 : 0);

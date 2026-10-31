// v14 smoke: NEURON LENS tabs load the hash-checked DB, search, open a neuron, steer-test, render validation and the catalog sample; no console errors.
import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'http://localhost:8814/', shots = process.argv[3] || '/workspace/nlens/shot';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 1800000, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage(); await p.setViewport({ width: 1400, height: 900 }); const errs = [];
p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), fail = [], T = Date.now(), log = (...a) => console.log(`[${((Date.now() - T) / 1000).toFixed(0)}s]`, ...a);
const check = async (name, fn, pred, arg) => { try { const r = await p.evaluate(fn, arg); const ok = pred(r); log(name, ok ? 'OK' : 'FAIL', JSON.stringify(r).slice(0, 300)); if (!ok) fail.push(name); } catch (e) { log(name, 'ERROR', e.message.slice(0, 300)); fail.push(name); } };
const show = (k) => p.evaluate((x) => window.NEURALESE.v5.api.showTab(x), k);
await p.goto(url); await p.waitForFunction(() => window.NEURALESE && window.NEURALESE_LAST, { timeout: 300000 }); log('loaded');
await check('version', () => document.getElementById('ver').textContent, (r) => r.startsWith('v15.0.0'));
await show('nlens');
await check('dbLoad', async () => { document.getElementById('nlLoad').click(); for (let i = 0; i < 240 && !/✓/.test(document.getElementById('nlInfo').textContent); i++) await new Promise((r) => setTimeout(r, 500)); return document.getElementById('nlInfo').textContent; }, (r) => /✓ 8×1024 neurons/.test(r) && /sha256-verified/.test(r));
await check('search', async () => { document.getElementById('nlQ').value = ' happy'; document.getElementById('nlGo').click(); await new Promise((r) => setTimeout(r, 800)); return document.getElementById('nlHits').textContent.slice(0, 200); }, (r) => /^\d+ hits/.test(r) && !/^0 hits/.test(r));
await check('openNeuron', async () => { document.getElementById('nlL').value = '3'; document.getElementById('nlN').value = '100'; document.getElementById('nlOpen').click(); await new Promise((r) => setTimeout(r, 400)); return document.getElementById('nlCard').textContent.slice(0, 300); }, (r) => /L3N100/.test(r) && /out·R/.test(r));
await sleep(1500); await p.screenshot({ path: `${shots}-nlens.png` });
await check('steer', async () => { document.getElementById('nlSteer').click(); for (let i = 0; i < 120 && !/overlap/.test(document.getElementById('nlSteerRes').textContent); i++) await new Promise((r) => setTimeout(r, 500)); return document.getElementById('nlSteerRes').textContent; }, (r) => /overlap with actual top-10: \d+\/10/.test(r));
await show('nlval');
await check('validation', async () => { document.getElementById('nvLoad').click(); for (let i = 0; i < 60 && !/prereg/.test(document.getElementById('nvInfo').textContent); i++) await new Promise((r) => setTimeout(r, 250)); return { info: document.getElementById('nvInfo').textContent, rows: document.querySelectorAll('#nvTable tr').length }; }, (r) => /P1/.test(r.info) && r.rows > 40);
await sleep(800); await p.screenshot({ path: `${shots}-nlval.png` });
await check('refit', async () => { document.getElementById('nrK').value = 'S'; document.getElementById('nrGo').click(); for (let i = 0; i < 1200 && !/mean cosine/.test(document.getElementById('nrInfo').textContent); i++) await new Promise((r) => setTimeout(r, 500)); return document.getElementById('nrInfo').textContent; }, (r) => /mean cosine/.test(r));
await p.screenshot({ path: `${shots}-refit.png` });
await show('nlext');
await check('catalog', async () => { document.getElementById('neLoad').click(); for (let i = 0; i < 60 && !document.getElementById('neList').children.length; i++) await new Promise((r) => setTimeout(r, 250)); return { info: document.getElementById('neInfo').textContent, n: document.getElementById('neList').children.length, attr: document.getElementById('neAttr').textContent.slice(0, 80) }; }, (r) => r.n > 100 && /a9lim/.test(r.attr));
await sleep(500); await p.screenshot({ path: `${shots}-nlext.png` });
// v14.7/14.8 NESTED group
await show('nxlens');
await check('nested lens', async () => { document.getElementById('nxLoad').click(); for (let i = 0; i < 120 && !/C7/.test(document.getElementById('nxRes').textContent); i++) await new Promise((r) => setTimeout(r, 250)); document.getElementById('nxRead').click(); for (let i = 0; i < 80 && !document.getElementById('nxOut').textContent; i++) await new Promise((r) => setTimeout(r, 250)); return { res: document.getElementById('nxRes').textContent.slice(-260), out: document.getElementById('nxOut').textContent.slice(0, 120) }; }, (r) => /C7 supported/.test(r.res) && /out·R/.test(r.out));
await sleep(300); await p.screenshot({ path: `${shots}-nxlens.png` });
await show('nslm');
await check('nested slm frame', async () => { const f = document.querySelector('iframe[src*="nested/slm"]'); for (let i = 0; i < 160 && !(f.contentDocument && f.contentDocument.getElementById('c') && /KL/.test(f.contentDocument.getElementById('c').textContent)); i++) await new Promise((r) => setTimeout(r, 250)); return f.contentDocument.getElementById('c').textContent.slice(0, 200); }, (r) => /KL\(guest‖baked\)/.test(r));
await sleep(300); await p.screenshot({ path: `${shots}-nslm.png` });
for (const k of ['nriscv', 'nmoe']) { await show(k); await sleep(1500); }
log('console errors', errs.length, errs.slice(0, 5)); await b.close();
if (fail.length || errs.length) { console.log('SMOKE FAIL', fail); process.exit(1); } console.log('SMOKE OK');

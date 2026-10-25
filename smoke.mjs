import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'http://localhost:8765/', shots = process.argv[3] || '/workspace/neuralese-v2';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage(); await p.setViewport({ width: 1680, height: 1000 }); const errs = [];
p.on('console', (m) => { if (m.type() === 'error') { errs.push(m.text()); console.log('[console.error]', m.text()); } }); p.on('pageerror', (e) => { errs.push(e.message); console.log('[pageerror]', e.message); });
const T = Date.now(), log = (...a) => console.log(`[${((Date.now() - T) / 1000).toFixed(1)}s]`, ...a);
await p.goto(url); await p.waitForFunction(() => window.NEURALESE && window.NEURALESE_LAST, { timeout: 180000 }); log('loaded+generated', await p.evaluate(() => JSON.stringify(window.NEURALESE_LAST).slice(0, 200)));
const click = async (sel) => { await p.evaluate((s) => document.querySelector(s).click(), sel); };
const waitToast = async (re, ms = 120000) => p.waitForFunction((r) => new RegExp(r).test(document.getElementById('toast').textContent) && document.getElementById('toast').style.display !== 'none', { timeout: ms }, re);
const set = (sel, v) => p.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('change')); e.dispatchEvent(new Event('input')); }, sel, v);
const status = {};
// 1 edit → regen differs
const clean = await p.evaluate(() => window.NEURALESE_LAST.clean);
await set('#autoRegen', ''); await p.evaluate(() => (document.getElementById('autoRegen').checked = false));
await click('[data-t=surg]'); await set('#smL', '2'); await set('#smM', 'fc'); await click('#bSvd'); await p.waitForFunction(() => /recon rel.err/.test(document.getElementById('svdInfo').textContent), { timeout: 120000 }); status.svd = await p.$eval('#svdInfo', (e) => e.textContent); log('svd', status.svd);
await set('#svK', '8'); await click('#bSvTop'); await waitToast('SVD'); status.svdEdit = await p.$eval('#svdInfo', (e) => e.textContent);
await click('#bGen'); await p.waitForFunction((c) => window.NEURALESE_LAST && /tok/.test(document.getElementById('genInfo').textContent) && !/prompt \d+ tok · \d+ ms$/.test(document.getElementById('genInfo').textContent), { timeout: 120000 });
await new Promise((r) => setTimeout(r, 300)); status.afterSvd = await p.evaluate(() => [window.NEURALESE_LAST.hacked.slice(0, 120), document.getElementById('genInfo').textContent]); log('after svd', status.afterSvd);
// steering
await click('[data-t=steer]'); await click('#bCv'); await waitToast('steer'); status.steer = await p.$eval('#steerList', (e) => e.textContent.slice(0, 160)); log('steer', status.steer);
// analysis
await click('[data-t=an]'); await click('#bAn'); await p.waitForFunction(() => /ms$/.test(document.getElementById('anInfo').textContent), { timeout: 60000 }); status.dla = await p.$eval('#dlaSum', (e) => e.textContent); log('dla', status.dla);
await p.screenshot({ path: shots + '-analyze.png' });
// causal
await click('[data-t=causal]'); await click('#bPR'); await p.waitForFunction(() => /corrupted/.test(document.getElementById('caInfo').textContent), { timeout: 120000 }); status.patch = await p.$eval('#caInfo', (e) => e.textContent); log('patch', status.patch);
// undo all → identical to clean
await p.evaluate(() => { while (document.getElementById('bUndo').disabled === false) document.getElementById('bUndo').click(); });
status.editsAfterUndo = await p.evaluate(() => window.NEURALESE.ed.edits.length + ' edits, ' + window.NEURALESE.R.steer.length + ' vecs');
await click('#bGen'); await p.waitForFunction(() => /identical|diverges/.test(document.getElementById('genInfo').textContent), { timeout: 120000 }); status.undoGen = await p.$eval('#genInfo', (e) => e.textContent); log('after undo', status.editsAfterUndo, status.undoGen);
// SAE (small)
await click('[data-t=sae]'); await set('#statN', '600'); await set('#saeM', '256'); await set('#saeE', '2'); await click('#bSae'); await p.waitForFunction(() => /FVU/.test(document.getElementById('saeInfo').textContent), { timeout: 300000 }); status.sae = await p.$eval('#saeInfo', (e) => e.textContent); log('sae', status.sae);
// ROME
await click('[data-t=surg]'); await click('#bRome'); await p.waitForFunction(() => /real rank-1/.test(document.getElementById('roInfo').textContent), { timeout: 400000 }); status.rome = await p.$eval('#roInfo', (e) => e.textContent); log('rome', status.rome);
// 3D + dense shot
await click('[data-t=viz]'); await set('#vzL', '4'); await set('#vzM', 'proj'); await p.evaluate(() => (document.getElementById('vzDiff').checked = true)); await set('#vzMode', 'height');
await click('#bDense'); await click('#bGen'); await p.waitForFunction(() => /identical|diverges/.test(document.getElementById('genInfo').textContent), { timeout: 120000 }); await new Promise((r) => setTimeout(r, 1500));
await p.screenshot({ path: shots + '-3d-dense.png' }); status.errors = errs; console.log(JSON.stringify(status, null, 1)); await b.close();

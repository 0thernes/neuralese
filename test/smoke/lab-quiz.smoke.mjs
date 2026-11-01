import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'http://localhost:8765/', shots = process.argv[3] || '/workspace/neuralese-v6', quick = process.argv.includes('--quick');
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 900000, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-webgpu-adapter=swiftshader'] });
const p = await b.newPage(); await p.setViewport({ width: 1680, height: 1000 }); const errs = [];
p.on('console', (m) => { if (m.type() === 'error') { errs.push(m.text()); console.log('[console.error]', m.text()); } }); p.on('pageerror', (e) => { errs.push(e.message); console.log('[pageerror]', e.message); });
const T = Date.now(), log = (...a) => console.log(`[${((Date.now() - T) / 1000).toFixed(1)}s]`, ...a); const S = { fail: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await p.goto(url); await p.waitForFunction(() => window.NEURALESE && window.NEURALESE_LAST, { timeout: 240000 }); log('loaded');
S.version = await p.$eval('#ver', (e) => e.textContent); S.title = await p.title();
S.timeline = await p.evaluate(() => window.NEURALESE.v5.api.S().timeline.length); log('timeline entries after first gen (audio off):', S.timeline);
// every tab
const tabs = await p.$$eval('#tabs button', (bs) => bs.map((b) => b.dataset.t)); S.tabs = tabs;
for (const t of tabs) { await p.evaluate((t) => document.querySelector(`[data-t=${t}]`).click(), t); await sleep(150); const on = await p.$eval(`#pane_${t}`, (e) => e.classList.contains('on') && e.innerHTML.length > 50); if (!on) S.fail.push('tab ' + t); }
log('tabs ok', tabs.length);
// terminal: every command
const cmds = ['help', 'help steer', 'version', 'echo hi', 'history', 'tab arch', 'prompt Once upon a time', 'set n 12', 'set temp 0.9', 'get', 'gen 8', 'params', 'flops 128', 'spectrum 3 fc', 'edit chaos 5', 'undo', 'redo', 'undo', 'edit quant 4 2-3', 'undo', 'edit svd L2.fc 16', 'undo', 'edit scale L1.o 0.5', 'undo', 'edit head 4 3 zero', 'undo', 'edit neuron 2 10 zero', 'undo', 'edit interp 3 2 0.5', 'undo',
  'ablate head 5 4 zero', 'undo', 'ablate neuron 3 7 clamp 2', 'undo', 'steer happy sad 4 resid_pre 2-5 addnorm', 'gen 6', 'undo', 'steer cat dog 3 v 3 add 2', 'undo', 'bias dog:3', 'bias clear', 'hsteer cat 2', 'undo', 'heads', 'attn', 'circuit', 'nn king', 'neurons 3 200', 'impact', 'calib 40', 'sweep blend 0 1 3', 'sweep htemp 0.5 2 3 5,4', 'profile 8', 'ww', 'runs', 'sel 5 4', 'theme light', 'theme dark', 'run echo a; echo b', 'audio mute', 'reset', 'clear'];
cmds.push('drill model', 'drill L3', 'drill L3.attn', 'drill L3.attn.q', 'drill L3.attn.q.H5', 'drill L3.attn.q.H5.r2', 'drill L3.attn.q.H5.r2.w17', 'drill L2.mlp.fc.N7', 'attrib gxi', 'attrib ig play dance', 'atp', 'fisher 2', 'hess 7 ob', 'eigen', 'comp', 'induct', 'geom 2', 'superpos 3', 'land 1d 3 fc random', 'land 2d 3 q svd', 'mode surface', 'mode field', 'mode manifold', 'mode attn', 'mode circuit', 'cam iso', 'cam top', 'mode stack', 'gpu init', 'gpu bench', 'zoo 1M 8M', 'diff snap', 'edit chaos 3', 'diff orig cur', 'undo', 'share', 'help drill', 'version');
if (quick) cmds.length = 20;
for (const c of cmds) { const r = await p.evaluate(async (c) => { try { const o = await window.NEURALESE.v5.exec(c); return { ok: true, o: String(o ?? '').slice(0, 120) }; } catch (e) { return { ok: false, o: e.message }; } }, c); if (!r.ok) { S.fail.push(`cmd "${c}": ${r.o}`); log('✖', c, r.o); } else log('✔', c, '→', r.o.replace(/\n/g, ' ⏎ ').slice(0, 100)); }
// learning center: every quiz answered correctly, one wrong, glossary/index/search
await p.evaluate(() => document.querySelector('[data-t=learn]').click());
S.quiz = await p.evaluate(async () => { const { COURSE } = await import('./learn/course.js?v=6'); const res = []; const L = window.NEURALESE.v5.learn;
  for (const l of COURSE) { L.lesson(l.id); l.quiz.forEach((q, i) => { document.querySelector(`input[name=q${i}][value="${q.a}"]`).checked = true; }); document.querySelector('#lnQuiz button[type=submit]').click(); res.push(document.getElementById('lnScore').textContent); }
  return res; });
if (S.quiz.some((s) => !/passed/.test(s))) S.fail.push('quiz ' + S.quiz.join('|'));
S.learn = await p.evaluate(() => { const L = window.NEURALESE.v5.learn; L.show('gloss'); const g = document.querySelectorAll('.gloss dt').length; L.show('index'); const ix = document.querySelectorAll('.idx a').length; L.show('bible'); const bb = document.querySelectorAll('#lnBody section').length; const q = document.getElementById('lnQ'); q.value = 'induction'; q.dispatchEvent(new Event('input')); const sr = document.querySelectorAll('#lnBody [data-r]').length; return { g, ix, bb, sr, prog: document.getElementById('lnProg').title }; });
log('learn', S.learn, S.quiz.length);
// exports
S.exports = await p.evaluate(() => { const r = {}; for (const b of document.querySelectorAll('.xb')) r[b.dataset.for] = !!document.getElementById(b.dataset.for); return Object.values(r).every(Boolean) + ' ' + Object.keys(r).length; });
// screenshots
S.out = {}; for (const c of ['drill L3.attn.q.H5', 'atp', 'induct', 'gpu bench', 'zoo 1M 8M', 'diff orig cur']) S.out[c] = await p.evaluate(async (c) => String(await window.NEURALESE.v5.exec(c)).slice(0, 900), c);
S.share = await p.evaluate(async () => { await window.NEURALESE.v5.exec('edit chaos 4'); const u = await window.NEURALESE.v5.exec('share'); const n = window.NEURALESE.ed.edits.length; await window.NEURALESE.v5.exec('undo'); const st = await window.NEURALESE.v5.out.shareLoad(u.slice(u.indexOf('#'))); return { len: u.length, n, loaded: window.NEURALESE.ed.edits.length, ok: n === window.NEURALESE.ed.edits.length }; }); if (!S.share.ok) S.fail.push('share roundtrip');
const shot = async (tab, name, fn) => { await p.evaluate((t) => window.NEURALESE.v5.api.showTab(t), tab); if (fn) await p.evaluate(fn); await sleep(800); await p.screenshot({ path: `${shots}-${name}.png` }); };
await shot('drill', 'drill', async () => { await window.NEURALESE.v5.exec('drill L3.attn.q.H5'); });
await shot('v3d', '3d-surface', async () => { await window.NEURALESE.v5.exec('land 2d 3 q svd'); await window.NEURALESE.v5.exec('mode surface'); await window.NEURALESE.v5.exec('cam iso'); });
await shot('v3d', '3d-circuit', async () => { await window.NEURALESE.v5.exec('mode circuit'); });
await shot('v3d', '3d-field', async () => { await window.NEURALESE.v5.exec('mode field'); });
await shot('heads', 'heads', async () => { await window.NEURALESE.v5.exec('eigen'); await window.NEURALESE.v5.exec('induct'); });
await shot('grad', 'atp', async () => { await window.NEURALESE.v5.exec('atp'); });
await p.evaluate(() => window.NEURALESE.v5.setTheme('light')); await shot('geom', 'light-geom', async () => { await window.NEURALESE.v5.exec('geom 2'); }); await p.evaluate(() => window.NEURALESE.v5.setTheme('dark'));
await shot('zoo', 'zoo');
S.errors = errs; console.log(JSON.stringify(S, null, 1)); await b.close(); process.exit(S.fail.length || errs.length ? 1 : 0);

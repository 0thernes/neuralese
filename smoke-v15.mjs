// v15 smoke: every tab renders with 0 console errors at 1440×900, 1240×700 and 390×844; sidebar search/collapse works;
// no horizontal page overflow; honesty banners still present; v15 fonts load. Optional 3rd arg: directory for screenshots.
import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'http://localhost:8814/', shots = process.argv[3] || '';
const sizes = [['1440x900', 1440, 900], ['1240x700', 1240, 700], ['390x844', 390, 844]];
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 1800000, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), fail = [], T = Date.now(), log = (...a) => console.log(`[${((Date.now() - T) / 1000).toFixed(0)}s]`, ...a);
let nErr = 0;
for (const [nm, w, h] of sizes) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 }); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url); await p.waitForFunction(() => window.NEURALESE && window.NEURALESE_LAST, { timeout: 300000 }); await sleep(600);
  const chk = async (name, fn, pred, arg) => { const r = await p.evaluate(fn, arg).catch((e) => ({ error: e.message })); const ok = pred(r); log(nm, name, ok ? 'OK' : 'FAIL', JSON.stringify(r).slice(0, 220)); if (!ok) fail.push(nm + ':' + name); };
  await chk('version', () => document.getElementById('ver').textContent, (r) => /^v15\.0\.0/.test(r));
  await chk('fonts', async () => { await document.fonts.ready; return { sans: document.fonts.check('12px InterV'), mono: document.fonts.check('12px JBMonoV') }; }, (r) => r.sans && r.mono);
  await chk('sidebar', () => ({ groups: document.querySelectorAll('#tabs .ng').length, tabs: document.querySelectorAll('#tabs button[data-t]').length, search: !!document.getElementById('navQ') }), (r) => r.groups >= 13 && r.tabs >= 70 && r.search);
  await chk('search', async () => { const q = document.getElementById('navQ'); q.value = 'lens'; q.dispatchEvent(new Event('input')); const vis = [...document.querySelectorAll('#tabs button[data-t]')].filter((x) => !x.hidden && !x.closest('section').hidden).map((x) => x.dataset.t); q.value = ''; q.dispatchEvent(new Event('input')); return vis; }, (r) => r.includes('nlens') && r.includes('nxlens') && r.length < 20);
  await chk('collapse', () => { const g = document.querySelector('#tabs .ng[data-g="HUB"] .grp'); g.click(); const shut = getComputedStyle(document.querySelector('#tabs button[data-t="hemb"]')).display === 'none'; g.click(); return shut; }, (r) => r === true);
  const tabs = await p.$$eval('#tabs button[data-t]', (bs) => bs.map((x) => x.dataset.t)); const bad = []; let i = 0;
  for (const t of tabs) { i++; const e0 = errs.length; await p.evaluate((k) => window.NEURALESE.v5.api.showTab(k), t); await sleep(/^n(riscv|slm|moe)$/.test(t) ? 1200 : 200);
    const r = await p.evaluate((k) => { const el = document.getElementById('pane_' + k), hd = document.querySelector('#paneHead h2'); return { on: el.classList.contains('on'), hgt: el.getBoundingClientRect().height, txt: el.textContent.trim().length, head: hd?.textContent || '', ovf: document.documentElement.scrollWidth - innerWidth }; }, t);
    if (!r.on || r.hgt < 20 || !r.txt || !r.head || r.ovf > 1) bad.push(t + ':' + JSON.stringify(r)); if (errs.length > e0) bad.push(t + ':console');
    if (shots) await p.screenshot({ path: `${shots}/${nm}-${String(i).padStart(2, '0')}-${t}.png` }); }
  log(nm, 'tabs', tabs.length, bad.length ? 'FAIL ' + bad.slice(0, 6).join(' | ') : 'all render');
  if (bad.length) fail.push(nm + ':tabs');
  await chk('honesty banners', () => document.querySelectorAll('.prov').length, (r) => r >= 11); // v14.9 baseline: 11 provenance banners
  if (w < 500) await chk('mobile drawer', async () => { document.getElementById('bNav').click(); await new Promise((r) => setTimeout(r, 600)); const x = document.getElementById('tabs').getBoundingClientRect().left; document.getElementById('bNav').click(); return x; }, (r) => Math.abs(r) < 4);
  log(nm, 'console errors', errs.length, errs.slice(0, 4)); nErr += errs.length; await p.close(); }
await b.close();
if (fail.length || nErr) { console.log('SMOKE FAIL', fail, nErr); process.exit(1); } console.log('SMOKE OK');

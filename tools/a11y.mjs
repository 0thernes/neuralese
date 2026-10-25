// WCAG 2 A/AA audit of every tab with axe-core (npm i --no-save axe-core@4; node tools/a11y.mjs [url]).
import puppeteer from 'puppeteer-core'; import fs from 'fs';
const axe = fs.readFileSync('/workspace/neuralese/node_modules/axe-core/axe.min.js', 'utf8');
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage(); await p.setViewport({ width: 1500, height: 950 }); await p.goto(process.argv[2] || 'http://localhost:8765/'); await p.waitForFunction(() => window.NEURALESE && window.NEURALESE_LAST, { timeout: 240000 });
await p.evaluate(axe); const tabs = await p.$$eval('#tabs button', (bs) => bs.map((x) => x.dataset.t)); const agg = {};
for (const t of tabs) { const v = await p.evaluate(async (k) => { window.NEURALESE.v5.api.showTab(k); await new Promise((r) => setTimeout(r, 150)); const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'], resultTypes: ['violations'] }); return r.violations.map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, ex: x.nodes.slice(0, 3).map((n) => n.target.join(' ')) })); }, t);
  for (const x of v) { agg[x.id] = agg[x.id] || { impact: x.impact, tabs: [], n: 0, ex: new Set() }; agg[x.id].tabs.push(t); agg[x.id].n = Math.max(agg[x.id].n, x.n); x.ex.forEach((e) => agg[x.id].ex.add(e)); } }
for (const [k, v] of Object.entries(agg)) console.log(k, v.impact, 'max', v.n, 'tabs', v.tabs.length, [...v.ex].slice(0, 6).join(' | '));
await b.close();

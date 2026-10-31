// v14.9 C9a — fit the full TS-1M lens in headless Chrome through lens-worker.js and compare with the Node fit (lens/ts1m).
// Run from a directory where puppeteer-core is installed, against `python3 -m http.server 8814` in the repo root. Original Neuralese code.
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const REPO = process.env.REPO || '/workspace/neuralese-git', url = process.argv[2] || 'http://localhost:8814/', W = +(process.argv[3] || 4);
const { tokenizer, corpusText, stories, docsFrom, BLOCKS, sha256 } = await import(REPO + '/tools/nlens-common.mjs');
const man = JSON.parse(fs.readFileSync(REPO + '/lens/ts1m/manifest.json')), tok = tokenizer(REPO + '/model'), st = stories(await corpusText(REPO + '/model/TinyStories-valid.txt'));
const docs = man.corpus.stories.map((i) => tok.encode(st[i]).slice(0, man.corpus.T));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 7200000, args: ['--no-sandbox'] }), p = await b.newPage();
p.on('console', (m) => console.log('[page]', m.text())); p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(url + 'README.md'); const t0 = Date.now();
const res = await p.evaluate(async ({ docs, W }) => { const MJ = await import('/model.js?v=151'), buf = await (await fetch('/model/ts1M.safetensors')).arrayBuffer();
  const n = Number(new DataView(buf).getBigUint64(0, true)), hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, n))), Wt = MJ.buildWeights(MJ.parseSafetensors(buf.slice(8 + n), n, hdr)), d = Wt.wte.length / 50257;
  const cfg = { ...MJ.CFG, d, hd: d / 16, ff: 4 * d }, L = cfg.L, acc = { R: null, S: null }, q = docs.map((ids, i) => ({ ids, i })); let done = 0; const t = performance.now();
  await new Promise((resolve, reject) => { let live = 0; for (let w = 0; w < W; w++) { const wk = new Worker('/lens-worker.js?v=151', { type: 'module' }); live++;
    const next = () => { const j = q.shift(); if (!j) { wk.terminate(); if (--live === 0) resolve(); return; } wk.postMessage({ W: Wt, cfg, ids: j.ids, kinds: ['R', 'S'] }); };
    wk.onmessage = (e) => { const m = e.data; if (m.error) return reject(new Error(m.error)); if (!m.done) return;
      for (const k of ['R', 'S']) { const r = m.res[k]; if (!acc[k]) acc[k] = { out: r.out.map((a) => new Float64Array(a.length)), mid: r.mid.map((a) => new Float64Array(a.length)) }; for (const tg of ['out', 'mid']) r[tg].forEach((a, l) => { const A = acc[k][tg][l]; for (let i = 0; i < a.length; i++) A[i] += a[i] / docs.length; }); }
      if (++done % 8 === 0) console.log(`browser fit ${done}/${docs.length} ${((performance.now() - t) / 1000).toFixed(0)}s`); next(); };
    wk.onerror = (e) => reject(new Error(e.message)); next(); } });
  const pack = (a) => Array.from(a); return { L, d, seconds: (performance.now() - t) / 1000, R: { out: acc.R.out.map(pack), mid: acc.R.mid.map(pack) }, S: { out: acc.S.out.map(pack), mid: acc.S.mid.map(pack) } }; }, { docs, W });
await b.close();
const node = new Float32Array(fs.readFileSync(REPO + '/lens/ts1m/lenses.f32').buffer.slice(0)), dd = res.d * res.d, cos = {};
BLOCKS(res.L).forEach(([lens, tgt, l], k) => { const a = res[lens][tgt][l], o = k * dd; if (!a) return; let ab = 0, aa = 0, bb = 0; for (let i = 0; i < dd; i++) { ab += a[i] * node[o + i]; aa += a[i] ** 2; bb += node[o + i] ** 2; } (cos[`${lens}.${tgt}`] ||= [])[l] = +(ab / Math.sqrt(aa * bb)).toFixed(6); });
const min = Math.min(...Object.values(cos).flat().filter((x) => x != null)), PRE = fs.readFileSync(REPO + '/docs/PREREG-v14x.md');
const out = { prereg_sha256: sha256(PRE), date: new Date().toISOString(), browser: 'headless Chrome (CPU Web Workers, lens-worker.js)', workers: W, docs: docs.length, browserSeconds: Math.round(res.seconds), wallSeconds: Math.round((Date.now() - t0) / 1000), cos, minCos: min, C9a: { verdict: min >= 0.99 ? 'supported' : 'not supported' } };
fs.writeFileSync(REPO + '/lens/ts1m/v14x-browserfit.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out));

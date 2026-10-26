// v11 P6: complete single-unit causal atlas of TinyStories-8M. Exact zero-ablation of all 128 heads and 8192 MLP neurons
// on 4 test docs × 48 targets, vs the one-pass attribution-patching (AtP) estimate. Pre-registered in docs/PREREG-v11.md.
// Usage: node tools/frontier-atlas.mjs [workers=6] > site/frontier/data/atlas.json
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { load, corpus, SITE, prereg } from './_fload.mjs';
const DOCS = [27, 28, 29, 30], NT = 49;
const C = await import(SITE + 'frontier/core.js'); const G = await import(SITE + 'grad.js');
const W = await load('8M'), CORPUS = await corpus(), d = 256, H = 16, hd = 16, ff = 1024, L = 8;
const ctx = DOCS.map((k) => { const ids = CORPUS[k].slice(0, NT), r = G.grad(W, ids, { kind: 'ce' }); return { ids, A: r.A, act: r.act, base: C.mean(C.ceVec(W, r.A)) }; });
function exact(kind, l, u) { let s = 0; for (const c of ctx) { const sub = { cfg: W.cfg, wte: W.wte, wpe: W.wpe, lnfW: W.lnfW, lnfB: W.lnfB, layers: W.layers.slice(l) };
  const A = G.forward(sub, c.ids, { x0: c.A.layers[l].xin, patch: (site, ll, X) => { if (ll !== 0) return; if (kind === 'n' && site === 'mlp_act') for (let t = 0; t < NT; t++) X[t * ff + u] = 0; if (kind === 'h' && site === 'z') for (let t = 0; t < NT; t++) for (let i = u * hd; i < u * hd + hd; i++) X[t * d + i] = 0; } });
  A.ids = c.ids; s += C.mean(C.ceVec(W, A)) - c.base; } return s / ctx.length; }
function atp(kind, l, u) { let s = 0; for (const c of ctx) { const a = c.A.layers[l], g = c.act[l]; if (kind === 'n') for (let t = 0; t < NT; t++) s -= a.act[t * ff + u] * g.mlp_act[t * ff + u]; else for (let t = 0; t < NT; t++) for (let i = u * hd; i < u * hd + hd; i++) s -= a.z[t * d + i] * g.z[t * d + i]; } return s / ctx.length; }
if (!isMainThread) { const out = []; for (const [kind, l, u] of workerData.units) out.push([kind, l, u, exact(kind, l, u), atp(kind, l, u)]); parentPort.postMessage(out); }
else { const nw = +(process.argv[2] || 6), units = []; for (let l = 0; l < L; l++) { for (let h = 0; h < H; h++) units.push(['h', l, h]); for (let n = 0; n < ff; n++) units.push(['n', l, n]); }
  const t0 = Date.now(); const parts = await Promise.all([...Array(nw).keys()].map((w) => new Promise((res, rej) => { const wk = new Worker(new URL(import.meta.url), { workerData: { units: units.filter((_, i) => i % nw === w) } }); wk.on('message', res); wk.on('error', rej); })));
  const rows = parts.flat(), heads = rows.filter((r) => r[0] === 'h'), neur = rows.filter((r) => r[0] === 'n');
  const absN = neur.map((r) => Math.abs(r[3])).sort((a, b) => b - a), top1 = absN.slice(0, Math.ceil(absN.length / 100)).reduce((a, b) => a + b, 0) / absN.reduce((a, b) => a + b, 0);
  const rhoN = C.spearman(neur.map((r) => r[3]), neur.map((r) => r[4])), rhoH = C.spearman(heads.map((r) => r[3]), heads.map((r) => r[4]));
  const res = { prereg: prereg().sha256, docs: DOCS, targetsPerDoc: NT - 1, baseCE: C.mean(ctx.map((c) => c.base)), seconds: (Date.now() - t0) / 1000,
    H6a: { rhoNeurons: rhoN, rhoHeads: rhoH, pass: rhoN >= 0.5 && rhoH >= 0.5 }, H6b: { top1pctMass: top1, pass: top1 >= 0.25 },
    heads: heads.map((r) => [r[1], r[2], +r[3].toPrecision(5), +r[4].toPrecision(5)]), neurons: neur.map((r) => [r[1], r[2], +r[3].toPrecision(4), +r[4].toPrecision(4)]) };
  console.log(JSON.stringify(res)); }

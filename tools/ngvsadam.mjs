// v10 (c): natural gradient (Fisher = 4 × Fubini–Study metric of √p) vs Adam, equal step counts, seeded, with 95% CIs.
// Task: fine-tune the final LayerNorm (gain lnfW + bias lnfB, 512 params) of the real TinyStories-8M weights to minimise
// mean next-token CE on 16 positions of a corpus document; the backbone is frozen, so n_t (normalised pre-LN residual) is
// computed once. Held-out = the next 32 positions of the same document. Natural step: (F + λI) δ = g, solved by CG with
// exact Fisher-vector products Fv = (1/T) Σ_t J_tᵀ (diag p_t − p_t p_tᵀ) J_t v, J_t = E·[diag(n_t) | I] (E = tied wte).
// Learning rates: each method picks its best on tune seeds {0,1} by final TRAIN CE (default) or by those seeds' held-out
// CE (SELECT=heldout); seeds 2..9 are then reported. Tune seeds are never part of the reported statistics.
// Usage: [SELECT=heldout] node tools/ngvsadam.mjs [steps=20] > site/tsotchke/data/ngvsadam[-heldout].json
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
const SEL = process.env.SELECT === 'heldout' ? 'heldout' : 'train'; const ROOT = new URL('../', import.meta.url).pathname, STEPS = +(process.argv[2] || 20), NTR = 16, NHO = 32;
if (!isMainThread) {
  const { buildWeights, parseSafetensors } = await import(ROOT + 'site/model.js'); const { forward } = await import(ROOT + 'site/grad.js'); const { CORPUS } = await import(ROOT + 'site/corpus.js');
  const buf = fs.readFileSync((process.env.NEURALESE_MODEL || ROOT + 'model/') + 'model.safetensors'), n = Number(buf.readBigUInt64LE(0)), hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
  const W = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr)), E = W.wte, d = W.lnfW.length, V = E.length / d;
  const { seed, method, lr } = workerData; const ids = CORPUS[seed].slice(0, NTR + NHO + 1); const A = forward(W, ids), N = A.lnf.XH;
  const logits = (t, g, b) => { const y = new Float64Array(d); for (let i = 0; i < d; i++) y[i] = N[t * d + i] * g[i] + b[i]; const z = new Float64Array(V); let m = -Infinity; for (let o = 0; o < V; o++) { let s = 0; const off = o * d; for (let i = 0; i < d; i++) s += E[off + i] * y[i]; z[o] = s; if (s > m) m = s; } let Z = 0; for (let o = 0; o < V; o++) { z[o] = Math.exp(z[o] - m); Z += z[o]; } for (let o = 0; o < V; o++) z[o] /= Z; return z; };
  const Et = (t, r) => { const u = new Float64Array(d); for (let o = 0; o < V; o++) { const c = r[o]; if (!c) continue; const off = o * d; for (let i = 0; i < d; i++) u[i] += c * E[off + i]; } const out = new Float64Array(2 * d); for (let i = 0; i < d; i++) { out[i] = u[i] * N[t * d + i]; out[d + i] = u[i]; } return out; };
  const Jv = (t, v) => { const y = new Float64Array(d); for (let i = 0; i < d; i++) y[i] = N[t * d + i] * v[i] + v[d + i]; const z = new Float64Array(V); for (let o = 0; o < V; o++) { let s = 0; const off = o * d; for (let i = 0; i < d; i++) s += E[off + i] * y[i]; z[o] = s; } return z; };
  const ce = (g, b, lo, hi) => { let s = 0; for (let t = lo; t < hi; t++) s -= Math.log(logits(t, g, b)[ids[t + 1]]); return s / (hi - lo); };
  const g = Float64Array.from(W.lnfW), b = Float64Array.from(W.lnfB), P = 2 * d; const m1 = new Float64Array(P), m2 = new Float64Array(P);
  const ce0 = ce(g, b, 0, NTR), ho0 = ce(g, b, NTR, NTR + NHO); const curve = [ce0]; const lam = 1e-3;
  for (let step = 1; step <= STEPS; step++) {
    const ps = [], grad = new Float64Array(P);
    for (let t = 0; t < NTR; t++) { const p = logits(t, g, b); ps.push(p); const r = Float64Array.from(p); r[ids[t + 1]] -= 1; const gt = Et(t, r); for (let i = 0; i < P; i++) grad[i] += gt[i] / NTR; }
    let delta;
    if (method === 'adam') { const b1 = 0.9, b2 = 0.999; delta = new Float64Array(P); for (let i = 0; i < P; i++) { m1[i] = b1 * m1[i] + (1 - b1) * grad[i]; m2[i] = b2 * m2[i] + (1 - b2) * grad[i] ** 2; delta[i] = (m1[i] / (1 - b1 ** step)) / (Math.sqrt(m2[i] / (1 - b2 ** step)) + 1e-8); } }
    else { const Fv = (v) => { const out = new Float64Array(P); for (let t = 0; t < NTR; t++) { const p = ps[t], jv = Jv(t, v); let mu = 0; for (let o = 0; o < V; o++) mu += p[o] * jv[o]; const r = new Float64Array(V); for (let o = 0; o < V; o++) r[o] = p[o] * (jv[o] - mu); const o2 = Et(t, r); for (let i = 0; i < P; i++) out[i] += o2[i] / NTR; } for (let i = 0; i < P; i++) out[i] += lam * v[i]; return out; };
      const x = new Float64Array(P), r = Float64Array.from(grad), pp = Float64Array.from(r); let rr = r.reduce((s, v) => s + v * v, 0);
      for (let it = 0; it < 8 && rr > 1e-20; it++) { const Ap = Fv(pp); let pAp = 0; for (let i = 0; i < P; i++) pAp += pp[i] * Ap[i]; const al = rr / pAp; for (let i = 0; i < P; i++) { x[i] += al * pp[i]; r[i] -= al * Ap[i]; } const rn = r.reduce((s, v) => s + v * v, 0); for (let i = 0; i < P; i++) pp[i] = r[i] + (rn / rr) * pp[i]; rr = rn; }
      delta = x; }
    for (let i = 0; i < d; i++) { g[i] -= lr * delta[i]; b[i] -= lr * delta[d + i]; }
    curve.push(ce(g, b, 0, NTR));
  }
  parentPort.postMessage({ seed, method, lr, ce0, ho0, train: curve[STEPS], heldout: ce(g, b, NTR, NTR + NHO), curve });
} else {
  const run = (jobs) => new Promise((res) => { const out = []; let i = 0, live = 0; const next = () => { if (i >= jobs.length && !live) return res(out); while (live < 8 && i < jobs.length) { const j = jobs[i++]; live++; const w = new Worker(new URL(import.meta.url), { workerData: j }); w.on('message', (m) => out.push(m)); w.on('error', (e) => { console.error(e); }); w.on('exit', () => { live--; next(); }); } }; next(); });
  const GRID = { adam: [1e-3, 3e-3, 1e-2, 3e-2], ng: [0.1, 0.3, 1.0] };
  const tune = await run(Object.entries(GRID).flatMap(([method, lrs]) => lrs.flatMap((lr) => [0, 1].map((seed) => ({ seed, method, lr })))));
  const best = {}; for (const m of Object.keys(GRID)) { let bl = null, bv = Infinity; for (const lr of GRID[m]) { const rs = tune.filter((r) => r.method === m && r.lr === lr), v = rs.reduce((s, r) => s + (Number.isFinite(r[SEL]) ? r[SEL] : 1e9), 0) / rs.length; if (v < bv) { bv = v; bl = lr; } } best[m] = bl; }
  /* SEL: which tune-seed metric picks the learning rate (tune seeds 0,1 are never reported) */
  const SEEDS = [2, 3, 4, 5, 6, 7, 8, 9]; const ev = await run(Object.keys(GRID).flatMap((method) => SEEDS.map((seed) => ({ seed, method, lr: best[method] }))));
  const T975 = { 7: 2.365 }; const ci = (xs) => { const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)); return { mean: m, lo: m - T975[n - 1] * sd / Math.sqrt(n), hi: m + T975[n - 1] * sd / Math.sqrt(n), sd, n }; };
  const by = (m, k) => SEEDS.map((s) => ev.find((r) => r.method === m && r.seed === s)[k]);
  const summary = {}; for (const k of ['train', 'heldout']) { summary[k] = { adam: ci(by('adam', k)), ng: ci(by('ng', k)), ngMinusAdam: ci(by('ng', k).map((x, i) => x - by('adam', k)[i])) }; }
  summary.start = { train: ci(by('adam', 'ce0')), heldout: ci(by('adam', 'ho0')) };
  console.log(JSON.stringify({ steps: STEPS, nTrain: NTR, nHeldout: NHO, params: 'lnfW+lnfB (512)', damping: 1e-3, cgIters: 8, grid: GRID, selectBy: SEL, best, tuneSeeds: [0, 1], seeds: SEEDS, summary, tune, runs: ev, generated: new Date().toISOString() }, null, 1));
}

// v14.5 — cross-model neuron matching TS-3M ↔ TS-8M (PREREG-v14x §14.5). Original Neuralese code.
import { setup, steerDeltas, writeResult, r4, p99, q99, arg } from './v14x-lib.mjs'; import * as NL from '../src/neuronlens.js';
const t0 = Date.now(), A = await setup('/workspace/nlens/m3M', 'lens/ts3m'), B = await setup('model', 'lens/ts8m'), kept = A.kept, LAYERS = [2, 5], K = 50, nW = +arg('workers', 3);
const topSets = (S, l) => { const { ff } = S.M.cfg, KT = NL.tokMatT(S.M, kept, false), W = new Float32Array(ff * S.M.cfg.d); for (let n = 0; n < ff; n++) W.set(NL.neuronDirs(S.M, l, n).w, n * S.M.cfg.d);
  const R = NL.readsR(S.M, W, ff, S.Z.R.out[l], kept, KT), nk = kept.length; return Array.from({ length: ff }, (_, n) => new Set(NL.topK(R.subarray(n * nk, (n + 1) * nk), K))); };
// Rectangular Hungarian (rows ≤ cols), minimising cost; returns col for each row.
function hungarian(C, n, m) { const INF = 1e18, u = new Float64Array(n + 1), v = new Float64Array(m + 1), p = new Int32Array(m + 1), way = new Int32Array(m + 1);
  for (let i = 1; i <= n; i++) { p[0] = i; let j0 = 0; const minv = new Float64Array(m + 1).fill(INF), used = new Uint8Array(m + 1);
    do { used[j0] = 1; const i0 = p[j0]; let delta = INF, j1 = 0; for (let j = 1; j <= m; j++) if (!used[j]) { const cur = C[(i0 - 1) * m + j - 1] - u[i0] - v[j]; if (cur < minv[j]) { minv[j] = cur; way[j] = j0; } if (minv[j] < delta) { delta = minv[j]; j1 = j; } }
      for (let j = 0; j <= m; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; j0 = j1; } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0); }
  const a = new Int32Array(n); for (let j = 1; j <= m; j++) if (p[j]) a[p[j] - 1] = j - 1; return a; }
const dose = (S, l, ns) => { const acts = ns.map(() => []); S.evalDocs.forEach((ids) => { const f = NL.forward(S.M, ids, { acts: true }), ff = S.M.cfg.ff; for (let t = 0; t < 64; t++) ns.forEach((n, k) => acts[k].push(f.acts[l][t * ff + n])); }); return acts.map((a) => 4 * Math.max(0.05, p99(a))); };
const layers = [];
for (const l of LAYERS) { const sa = topSets(A, l), sb = topSets(B, l), n = sa.length, m = sb.length, J = new Float64Array(n * m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { let c = 0; for (const t of sa[i]) if (sb[j].has(t)) c++; J[i * m + j] = c / (2 * K - c); }
  const asg = hungarian(J.map((x) => -x), n, m), pairs = [...asg].map((j, i) => [i, j, J[i * m + j]]).sort((x, y) => y[2] - x[2]).slice(0, 24);
  const da = dose(A, l, pairs.map((p) => p[0])), db = dose(B, l, pairs.map((p) => p[1]));
  const vec = (S, n, a) => Array.from(NL.neuronDirs(S.M, l, n).w, (x) => x * a);
  const Da = await steerDeltas('/workspace/nlens/m3M', pairs.map((p, k) => ({ l, vec: vec(A, p[0], da[k]) })), A.evalDocs, kept, nW);
  const Db = await steerDeltas('model', pairs.map((p, k) => ({ l, vec: vec(B, p[1], db[k]) })), B.evalDocs, kept, nW);
  const r = pairs.map((_, k) => NL.pearson(Da[k], Db[k])), mis = []; pairs.forEach((_, i) => pairs.forEach((_, j) => { if (i !== j) mis.push(NL.pearson(Da[i], Db[j])); }));
  const tau = q99(mis); layers.push({ layer: l, pairs: pairs.map((p, k) => ({ n3M: p[0], n8M: p[1], jaccard: r4(p[2]), r: r4(r[k]) })), meanJaccardAll: r4([...asg].reduce((s, j, i) => s + J[i * m + j], 0) / n), tau99: r4(tau), pass: r.filter((x) => x > tau).length }); console.log('layer', l, tau, layers.at(-1).pass); }
const pass = layers.reduce((s, x) => s + x.pass, 0), rate = pass / 48;
writeResult('lens/v14x-match.json', { layers, C5: { pass, of: 48, rate: r4(rate), wilson: NL.wilson(pass, 48).map(r4), verdict: rate >= 0.3 ? 'supported' : 'not supported' }, seconds: Math.round((Date.now() - t0) / 1000) });

// v14.6 — Taylor check of the RelP linearisation on TS-8M (PREREG-v14x §14.6). Original Neuralese code.
import { setup, writeResult, r4, med } from './v14x-lib.mjs';
import { docsFrom } from './nlens-common.mjs';
import * as NL from '../src/neuronlens.js';
const t0 = Date.now(), { M, tok, st } = await setup(), { d, L } = M.cfg, S = NL.SKIP_FIRST, EPS = [1e-3, 1e-2, 1e-1], DELTA = +(process.argv[process.argv.indexOf('--delta') + 1] || 1e-4), OUT = process.argv.includes('--delta') ? 'lens/ts8m/v14x-taylor-delta' + DELTA + '-exploratory.json' : 'lens/ts8m/v14x-taylor.json';
const docs = docsFrom(tok, st, 21500, 4, 65).map((x) => x.ids), rng = NL.mulberry(14600), out = [];
const nrm = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0));
for (let l = 0; l < L - 1; l++) { const recs = [];
  for (const ids of docs) { const lin = NL.tapeRelP(M, ids), T = lin.T, x = ids.slice(0, T), N = lin.N;
    const base = NL.forward(M, x, { outs: true }); let ss = 0; for (let t = S; t < T; t++) for (let i = 0; i < d; i++) ss += base.outs[l][t * d + i] ** 2; const rms = Math.sqrt(ss / ((T - S) * d));
    const hf = (vec) => { const f = NL.forward(M, x, { steer: { layer: l, vec, from: S, to: T } }).h; return Float64Array.from({ length: N * d }, (_, k) => f[S * d + k]); };
    const h0 = Float64Array.from({ length: N * d }, (_, k) => base.h[S * d + k]);
    for (let k = 0; k < 3; k++) { let v = Float64Array.from({ length: d }, () => rng() * 2 - 1); const nv = nrm(v); v = v.map((a) => a / nv);
      let X = new Float32Array(N * d); for (let n = 0; n < N; n++) for (let i = 0; i < d; i++) X[n * d + i] = v[i] * rms;
      for (let m = l + 1; m < L; m++) X = NL.jvp(M, lin, m, X, 1).out; // J_RelP (rms·v)
      const sc = (s) => Float32Array.from(v, (a) => a * rms * s), hp = hf(sc(DELTA)), hm = hf(sc(-DELTA)), Jfd = hp.map((a, i) => (a - hm[i]) / (2 * DELTA));
      for (const e of EPS) { const D = hf(sc(e)).map((a, i) => a - h0[i]), nD = nrm(D);
        const eR = nrm(D.map((a, i) => a - e * X[i])) / nD, eF = nrm(D.map((a, i) => a - e * Jfd[i])) / nD;
        recs.push({ eps: e, eRelP: eR, eExact: eF, second: nrm(D.map((a, i) => a - e * Jfd[i])) / (e * e) }); } } }
  const row = { layer: l }; for (const e of EPS) { const R = recs.filter((r) => r.eps === e); row['eps' + e] = { eRelP: r4(med(R.map((r) => r.eRelP))), eExact: r4(med(R.map((r) => r.eExact))), second: r4(med(R.map((r) => r.second))), ratio: r4(med(R.map((r) => r.eExact / r.eRelP))) }; }
  out.push(row); console.log(JSON.stringify(row)); }
const fails = out.filter((r) => r['eps0.001'].ratio < 1).map((r) => r.layer);
writeResult(OUT, { delta: DELTA, eps: EPS, layers: out, C6: { failingLayers: fails, verdict: fails.length ? 'not supported (RelP is not first-order accurate)' : 'supported' }, seconds: Math.round((Date.now() - t0) / 1000) });

// v14.4 — auto-labels from S.mid reads, scored against exact drivers, with a calibrated confidence (PREREG-v14x §14.4). Original Neuralese code.
import fs from 'node:fs'; import { setup, writeResult, r4 } from './v14x-lib.mjs'; import * as NL from '../src/neuronlens.js';
const { M, kept, cnt, Z } = await setup(), { d, L, ff } = M.cfg, freq = kept.slice().sort((a, b) => cnt[b] - cnt[a]).slice(0, 3000), FcT = NL.tokMatT(M, freq, true), nf = freq.length;
const drv = JSON.parse(fs.readFileSync('lens/ts8m/drivers.json')).drivers, recs = [];
for (let l = 0; l < L; l++) { const Cs = new Float32Array(ff * d); for (let n = 0; n < ff; n++) Cs.set(NL.neuronDirs(M, l, n).c, n * d);
  const R = NL.readsS(M, Cs, ff, Z.S.mid[l], freq, FcT), lab = [], z = [];
  for (let n = 0; n < ff; n++) { const r = R.subarray(n * nf, (n + 1) * nf); let m = 0, s = 0, mx = -Infinity; for (const x of r) { m += x; if (x > mx) mx = x; } m /= nf; for (const x of r) s += (x - m) ** 2;
    z.push((mx - m) / Math.sqrt(s / nf)); lab.push(new Set(NL.topK(r, 3).map((i) => freq[i]))); }
  for (let n = 0; n < ff; n++) { const top = drv[l][n][0]; recs.push({ l, n, z: z[n], hit: +lab[n].has(top), shuf: +lab[(n + 517) % ff].has(top) }); } console.log('layer', l); }
// C4a: paired exact McNemar.
const b = recs.filter((r) => r.hit && !r.shuf).length, c = recs.filter((r) => !r.hit && r.shuf).length, nn = b + c;
let lp = -Infinity; const lc = (k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log((nn - k + i) / i); return s; }; // log C(nn,k)
const lse = (a, x) => (a === -Infinity ? x : Math.max(a, x) + Math.log1p(Math.exp(-Math.abs(a - x))));
for (let k = 0; k <= Math.min(b, c); k++) lp = lse(lp, lc(k) + nn * Math.log(0.5)); const p = Math.min(1, 2 * Math.exp(lp));
const hitRate = recs.reduce((s, r) => s + r.hit, 0) / recs.length, shufRate = recs.reduce((s, r) => s + r.shuf, 0) / recs.length;
// C4b: logistic(a·z+b) fit on even n by Newton, evaluated on odd n in 5 equal-count bins.
const tr = recs.filter((r) => r.n % 2 === 0), te = recs.filter((r) => r.n % 2 === 1), sg = (x) => 1 / (1 + Math.exp(-x)); let A = 0, B0 = 0;
for (let it = 0; it < 50; it++) { let ga = 0, gb = 0, haa = 1e-9, hab = 0, hbb = 1e-9; for (const r of tr) { const q = sg(A * r.z + B0), e = r.hit - q, w = q * (1 - q); ga += e * r.z; gb += e; haa += w * r.z * r.z; hab += w * r.z; hbb += w; }
  const det = haa * hbb - hab * hab; A += (hbb * ga - hab * gb) / det; B0 += (haa * gb - hab * ga) / det; }
te.sort((x, y) => x.z - y.z); const bins = []; for (let k = 0; k < 5; k++) { const s = te.slice(Math.floor(k * te.length / 5), Math.floor((k + 1) * te.length / 5)), acc = s.reduce((a, r) => a + r.hit, 0) / s.length, conf = s.reduce((a, r) => a + sg(A * r.z + B0), 0) / s.length; bins.push({ n: s.length, acc: r4(acc), conf: r4(conf), gap: r4(acc - conf) }); }
const C4a = hitRate > shufRate && p < 0.01, C4b = bins.every((x) => Math.abs(x.gap) <= 0.1);
writeResult('lens/ts8m/v14x-labels.json', { candidates: nf, neurons: recs.length, C4a: { hitRate: r4(hitRate), shuffledRate: r4(shufRate), b, c, p, verdict: C4a ? 'supported' : 'not supported' }, C4b: { a: r4(A), b: r4(B0), bins, verdict: C4b ? 'supported' : 'not supported' } });
console.log(hitRate, shufRate, p, bins);

// v14.7 + v14.8 — lens tests on the nested char LMs (PREREG-v14x §14.7, §14.8). Original Neuralese code.
import fs from 'node:fs'; import vm from 'node:vm';
import * as N from '../src/nestedlens.js'; import * as NL from '../src/neuronlens.js'; import { corpusText, stories } from './nlens-common.mjs'; import { writeResult, r4, q99, med, p99 } from './v14x-lib.mjs';
const t0 = Date.now(), idx = JSON.parse(fs.readFileSync('nested/slm/models.index.json')), raw = fs.readFileSync('nested/slm/models.f32'), f32 = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
const Z = N.loadNested(idx, f32), { vocab } = Z, st = stories(await corpusText('model/TinyStories-valid.txt'));
const docs = (from, n) => { const o = []; for (let i = from; o.length < n; i++) { const s = st[i].slice(0, 64); if (s.length === 64) o.push(N.encodeChars(vocab, s)); } return o; };
const fit = docs(0, 32), ev = docs(20000, 8), res = {};
// Fidelity gate: float32 composite (guest head) vs the float64 guest of neuralese-nested's own lm.js, 20 prompts.
{ const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync('/workspace/neuralese-nested/web/slm/lm.js', 'utf8'), ctx); const NLM = ctx.window.NLM, J64 = JSON.parse(fs.readFileSync('/workspace/neuralese-nested/web/slm/models.json', 'utf8'));
  const C = Z.models.composite, hg = N.head(C, 'out_g'); let mx = 0;
  for (const ids of docs(21000, 20)) { const g = NLM.softmax(NLM.forward(J64.guest, ids).logits), h = N.forward(C, ids).h, d = C.cfg.d, z = Array.from({ length: hg.weight.shape[0] }, (_, v) => { let s = hg.bias.a[v]; for (let j = 0; j < d; j++) s += hg.weight.a[v * d + j] * h[63 * d + j]; return s; });
    mx = Math.max(mx, NLM.kl(g, NLM.softmax(z))); }
  res.fidelity = { prompts: 20, maxKL: mx, pass: mx < 1e-5 }; console.log('fidelity', mx); }
const testA = (m, l, units, J, hdOf, mode) => { const dm = m.cfg.dm, A = units.map(() => []);
  for (const ids of ev) { const f = N.forward(m, ids, { mode, acts: true }); for (let t = 0; t < 64; t++) units.forEach((n, k) => A[k].push(f.acts[l][t * dm + n])); }
  const dose = A.map((a) => 4 * p99(a)), live = units.map((_, k) => dose[k] > 0), us = units.filter((_, k) => live[k]), ds = dose.filter((_, k) => live[k]);
  const base = ev.map((ids) => { const f = N.forward(m, ids, { mode }); return (hd) => N.logSoftmaxRows(m, f.h, 64, hd); }), cache = new Map();
  const Ds = us.map((n, k) => { const hd = hdOf(n), w = N.unitWrite(m, l, n).map((x) => x * ds[k]), D = new Float64Array(hd.weight.shape[0]);
    ev.forEach((ids, e) => { const key = e + (hd === hdOf(us[0]) ? 'a' : 'b'); if (!cache.has(key)) cache.set(key, base[e](hd)); const b = cache.get(key), s = N.logSoftmaxRows(m, N.forward(m, ids, { mode, addOut: { layer: l, vec: w } }).h, 64, hd); for (let v = 0; v < D.length; v++) D[v] += (s[v] - b[v]) / ev.length; }); return D; });
  const out = { units: units.length, dead: units.length - us.length };
  for (const [lens, JJ] of [['R.out', J], ['logit', null]]) { const reads = us.map((n) => N.read(m, N.unitWrite(m, l, n), JJ, hdOf(n))), r = reads.map((x, i) => NL.pearson(x, Ds[i])), mis = [];
    const rng = NL.mulberry(14700); for (let k = 0; k < 4000; k++) { const i = Math.floor(rng() * us.length); let j = Math.floor(rng() * us.length); if (j === i) j = (j + 1) % us.length; mis.push(NL.pearson(reads[i], Ds[j])); }
    const tau = q99(mis), pass = r.filter((x) => x > tau).length, ci = NL.wilson(pass, us.length), nullRate = mis.filter((x) => x > tau).length / mis.length;
    out[lens] = { n: us.length, medianR: r4(med(r)), tau99: r4(tau), passRate: r4(pass / us.length), passCI: ci.map(r4), nullPassRate: r4(nullRate), pass: ci[0] > nullRate }; }
  return { out, reads: (JJ, hd) => units.map((n) => N.read(m, N.unitWrite(m, l, n), JJ, hd)) }; };
// Composite: host units 0..255 read with the host head, guest units 256..383 with the guest head. Emulator: mode 1 (guest emulation).
const C = Z.models.composite, E = Z.models.emu, nHostU = 256;
const JC = N.fdLensR(C, fit, 0), JE1 = N.fdLensR(E, fit, 0, { mode: 1 }), JE0 = N.fdLensR(E, fit, 0, { mode: 0 }); console.log('lenses', (Date.now() - t0) / 1000);
const all = (n) => Array.from({ length: n }, (_, i) => i), hC = (n) => N.head(C, n < nHostU ? 'out_h' : 'out_g');
const tc = testA(C, 0, all(C.cfg.dm), JC, hC), te = testA(E, 0, all(E.cfg.dm), JE1, () => N.head(E), 1);
res.testA = { composite: tc.out, emulator_mode1: te.out }; res.C7 = { verdict: res.fidelity.pass && (tc.out['R.out'].pass || te.out['R.out'].pass) ? 'supported' : 'not supported' };
// 14.8 (a): host-head reads of guest-unit writes vs host units' host-head reads.
const HH = N.head(C, 'out_h'), rd = tc.reads(JC, HH), host = rd.slice(0, nHostU), guest = rd.slice(nHostU), ap = (a, b) => { const r = NL.pearson(a, b); return Number.isFinite(r) ? Math.abs(r) : 0; };
const ov = guest.map((g) => Math.max(...host.map((h) => ap(g, h)))), rng = NL.mulberry(14800), nul = Array.from({ length: 4000 }, () => { const i = Math.floor(rng() * nHostU); let j = Math.floor(rng() * nHostU); if (j === i) j = (j + 1) % nHostU; return ap(host[i], host[j]); });
const maxNorm = Math.max(...guest.map((g) => Math.sqrt(g.reduce((s, x) => s + x * x, 0))));
res.C8a = { medianOverlap: r4(med(ov)), tau99: r4(q99(nul)), maxGuestHostReadNorm: maxNorm, verdict: med(ov) > q99(nul) ? 'supported' : 'not supported' };
// 14.8 (b): emulator same-unit mode-0 vs mode-1 reads.
const r0 = all(E.cfg.dm).map((n) => N.read(E, N.unitWrite(E, 0, n), JE0, N.head(E))), r1 = all(E.cfg.dm).map((n) => N.read(E, N.unitWrite(E, 0, n), JE1, N.head(E)));
const same = r0.map((x, n) => NL.pearson(x, r1[n])), nb = Array.from({ length: 4000 }, () => { const i = Math.floor(rng() * r0.length); let j = Math.floor(rng() * r0.length); if (j === i) j = (j + 1) % r0.length; return NL.pearson(r0[i], r1[j]); });
const lensCos = (() => { let ab = 0, aa = 0, bb = 0; for (let i = 0; i < JE0.length; i++) { ab += JE0[i] * JE1[i]; aa += JE0[i] ** 2; bb += JE1[i] ** 2; } return ab / Math.sqrt(aa * bb); })();
res.C8b = { medianOverlap: r4(med(same)), tau99: r4(q99(nb)), lensCosineMode0vsMode1: r4(lensCos), verdict: med(same) > q99(nb) ? 'supported' : 'not supported' };
fs.writeFileSync('nested/slm/lens.json', JSON.stringify({ note: 'finite-difference R.out lenses (block 0 out → final residual), PREREG-v14x §14.7', composite: Array.from(JC, (x) => +x.toFixed(6)), emu_mode0: Array.from(JE0, (x) => +x.toFixed(6)), emu_mode1: Array.from(JE1, (x) => +x.toFixed(6)) }));
writeResult('nested/v14x-nested.json', { ...res, fitDocs: 32, evalDocs: 8, seconds: Math.round((Date.now() - t0) / 1000) }); console.log(JSON.stringify(res, null, 1));

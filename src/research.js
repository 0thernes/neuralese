// v7 research core (DOM-free, tested in Node): hypothesis tests, ACDC-style circuit discovery, causal scrubbing-lite,
// linear probes with control tasks, eval harness, weight hashing and experiment manifests.
import { forward, forwardAsync, logitsAt, logitsAtAsync, objective } from './grad.js?v=170';
import { rng } from './science.js?v=170';
import { frame } from './coop.js?v=170';
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
// ── hypothesis testing ──
// paired sign-flip permutation test on the mean difference (two-sided, add-one corrected p)
export function permPaired(a, b, B = 5000, seed = 1) { const d = a.map((x, i) => x - b[i]), obs = Math.abs(mean(d)), r = rng(seed); let c = 0;
  for (let k = 0; k < B; k++) { let s = 0; for (const x of d) s += r() < 0.5 ? -x : x; if (Math.abs(s / d.length) >= obs - 1e-15) c++; } return { diff: mean(d), p: (c + 1) / (B + 1), B }; }
// two-sample label permutation test on the difference of means
export function permTwo(a, b, B = 5000, seed = 1) { const all = [...a, ...b], na = a.length, obs = Math.abs(mean(a) - mean(b)), r = rng(seed); let c = 0;
  for (let k = 0; k < B; k++) { for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; } let sa = 0, sb = 0; for (let i = 0; i < all.length; i++) (i < na ? (sa += all[i]) : (sb += all[i])); if (Math.abs(sa / na - sb / (all.length - na)) >= obs - 1e-15) c++; }
  return { diff: mean(a) - mean(b), p: (c + 1) / (B + 1), B }; }
export const cohenDPaired = (a, b) => { const d = a.map((x, i) => x - b[i]); return mean(d) / (sd(d) || Infinity); };
export const cohenD = (a, b) => { const na = a.length, nb = b.length, sp = Math.sqrt(((na - 1) * sd(a) ** 2 + (nb - 1) * sd(b) ** 2) / Math.max(1, na + nb - 2)); return (mean(a) - mean(b)) / (sp || Infinity); };
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), m = ps.length, out = new Array(m); let run = 0; o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (m - k) * p)); out[i] = run; }); return out; }
export function bh(ps) { const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), m = ps.length, out = new Array(m); let run = 1; for (let k = m - 1; k >= 0; k--) { const [p, i] = o[k]; run = Math.min(run, (p * m) / (k + 1)); out[i] = Math.min(1, run); } return out; }
export function bootCI(xs, B = 2000, seed = 1, stat = mean) { const r = rng(seed), n = xs.length, v = []; for (let b = 0; b < B; b++) { let s = []; for (let i = 0; i < n; i++) s.push(xs[Math.floor(r() * n)]); v.push(stat(s)); } v.sort((x, y) => x - y); return { est: stat(xs), lo: v[Math.floor(0.025 * B)], hi: v[Math.floor(0.975 * B)] }; }
// ── per-document / per-token loss ──
export function tokenCE(W, ids) { const A = forward(W, ids), out = []; for (let t = 0; t < ids.length - 1; t++) { const l = logitsAt(W, A, t); let m = -Infinity; for (const x of l) if (x > m) m = x; let s = 0; for (const x of l) s += Math.exp(x - m); out.push(m + Math.log(s) - l[ids[t + 1]]); } return out; }
async function tokenCEAsync(W, ids) { const A = await forwardAsync(W, ids), out = []; for (let t = 0; t < ids.length - 1; t++) { const l = await logitsAtAsync(W, A, t); let m = -Infinity; for (const x of l) if (x > m) m = x; let s = 0; for (const x of l) s += Math.exp(x - m); out.push(m + Math.log(s) - l[ids[t + 1]]); } return out; }
export const docCE = (W, docs) => docs.map((d) => mean(tokenCE(W, d)));
// ── circuits: node-level ACDC-style pruning + causal scrubbing-lite ──
// nodes: every attention head (z slice) and every MLP (mlp_out). A "corrupted" node takes its activation from the corrupt run.
export function nodeList(W) { const H = (W.cfg || { H: 16 }).H || 16, out = []; for (let l = 0; l < W.layers.length; l++) { for (let h = 0; h < H; h++) out.push({ l, h, id: `L${l}H${h}` }); out.push({ l, mlp: true, id: `L${l}MLP` }); } return out; }
function runCorrupted(W, clean, Ac, set, obj) { const d = W.lnfW.length, H = (W.cfg || { H: 16 }).H || 16, hd = d / H;
  const A = forward(W, clean, { patch: (site, l, X) => { for (const n of set) if (n.l === l) { if (site === 'z' && !n.mlp) { for (let t = 0; t < clean.length; t++) for (let i = n.h * hd; i < n.h * hd + hd; i++) X[t * d + i] = Ac.layers[l].z[t * d + i]; } else if (site === 'mlp_out' && n.mlp) X.set(Ac.layers[l].mlpOut); } } });
  return objective(W, A, obj).value; }
function corruptRun(W, corr) { const mo = []; const A = forward(W, corr, { patch: (site, l, X) => { if (site === 'mlp_out') mo[l] = X.slice(); } }); A.layers.forEach((C, l) => (C.mlpOut = mo[l])); return A; }
async function corruptRunAsync(W, corr) { const mo = []; const A = await forwardAsync(W, corr, { patch: (site, l, X) => { if (site === 'mlp_out') mo[l] = X.slice(); } }); A.layers.forEach((C, l) => (C.mlpOut = mo[l])); return A; }
async function runCorruptedAsync(W, clean, Ac, set, obj) { const d = W.lnfW.length, H = (W.cfg || { H: 16 }).H || 16, hd = d / H;
  const A = await forwardAsync(W, clean, { patch: (site, l, X) => { for (const n of set) if (n.l === l) { if (site === 'z' && !n.mlp) { for (let t = 0; t < clean.length; t++) for (let i = n.h * hd; i < n.h * hd + hd; i++) X[t * d + i] = Ac.layers[l].z[t * d + i]; } else if (site === 'mlp_out' && n.mlp) X.set(Ac.layers[l].mlpOut); } } });
  return objective(W, A, obj).value; }
export function acdc(W, clean, corr, obj, tau = 0.02) { const g = acdcGen(W, clean, corr, obj, tau); for (;;) { const r = g.next(); if (r.done) return r.value; } }
// Same search as acdcGen, but each forward returns to the event loop between layers.
export async function acdcAsync(W, clean, corr, obj, tau = 0.02, onp = () => {}) {
  if (clean.length !== corr.length) throw new Error('clean and corrupt prompts must have equal token length');
  const Ac = await corruptRunAsync(W, corr), mClean = objective(W, await forwardAsync(W, clean), obj).value, mCorr = objective(W, Ac, obj).value, gap = mClean - mCorr;
  if (Math.abs(gap) < 1e-6) throw new Error('clean and corrupt metric are identical — nothing to explain');
  const nodes = nodeList(W), pruned = new Set(); let cur = mClean, evals = 2; const order = [...nodes].reverse();
  for (let k = 0; k < order.length; k++) { const n = order[k]; pruned.add(n); const m = await runCorruptedAsync(W, clean, Ac, pruned, obj); evals++; if (Math.abs(m - cur) / Math.abs(gap) < tau) cur = m; else pruned.delete(n); onp((k + 1) / order.length); }
  const circuit = nodes.filter((n) => !pruned.has(n));
  return { circuit: circuit.map((n) => n.id), nPruned: pruned.size, nNodes: nodes.length, mClean, mCorr, mCircuit: cur, faithfulness: (cur - mCorr) / gap, evals, tau };
}
export async function scrubAsync(W, clean, corr, obj, keepIds) {
  const Ac = await corruptRunAsync(W, corr), keep = new Set(keepIds), nodes = nodeList(W), bad = keepIds.filter((x) => !nodes.some((n) => n.id === x)); if (bad.length) throw new Error('unknown nodes: ' + bad.join(', '));
  const mClean = objective(W, await forwardAsync(W, clean), obj).value, mCorr = objective(W, Ac, obj).value, m = await runCorruptedAsync(W, clean, Ac, nodes.filter((n) => !keep.has(n.id)), obj);
  return { mClean, mCorr, mHyp: m, faithfulness: (m - mCorr) / (mClean - mCorr), kept: keep.size };
}
// generator form: yields progress in [0,1] after each node so a UI can stay responsive
export function* acdcGen(W, clean, corr, obj, tau = 0.02) {
  if (clean.length !== corr.length) throw new Error('clean and corrupt prompts must have equal token length');
  const Ac = corruptRun(W, corr), mClean = objective(W, forward(W, clean), obj).value, mCorr = objective(W, Ac, obj).value, gap = mClean - mCorr;
  if (Math.abs(gap) < 1e-6) throw new Error('clean and corrupt metric are identical — nothing to explain');
  const nodes = nodeList(W), pruned = new Set(); let cur = mClean, evals = 2; const order = [...nodes].reverse();
  for (let k = 0; k < order.length; k++) { const n = order[k]; pruned.add(n); const m = runCorrupted(W, clean, Ac, pruned, obj); evals++; if (Math.abs(m - cur) / Math.abs(gap) < tau) cur = m; else pruned.delete(n); yield (k + 1) / order.length; }
  const circuit = nodes.filter((n) => !pruned.has(n));
  return { circuit: circuit.map((n) => n.id), nPruned: pruned.size, nNodes: nodes.length, mClean, mCorr, mCircuit: cur, faithfulness: (cur - mCorr) / gap, evals, tau }; }
// causal scrubbing-lite: keep only the hypothesised nodes clean, resample every other node from the corrupt run.
export function scrub(W, clean, corr, obj, keepIds) { const Ac = corruptRun(W, corr), keep = new Set(keepIds), nodes = nodeList(W), bad = keepIds.filter((x) => !nodes.some((n) => n.id === x)); if (bad.length) throw new Error('unknown nodes: ' + bad.join(', '));
  const mClean = objective(W, forward(W, clean), obj).value, mCorr = objective(W, Ac, obj).value, m = runCorrupted(W, clean, Ac, nodes.filter((n) => !keep.has(n.id)), obj);
  return { mClean, mCorr, mHyp: m, faithfulness: (m - mCorr) / (mClean - mCorr), kept: keep.size }; }
// ── linear probes (softmax regression) with a Hewitt–Liang control task ──
// one forward per document; returns features for every requested layer (8 = final LN output)
function probeLabels(tok, lists) { const lab = new Map(); lists.forEach((ws, c) => ws.forEach((w) => { for (const v of [w, ' ' + w]) { const ids = tok.encode(v); if (ids.length === 1) lab.set(ids[0], c); } })); return lab; }
function probeTake(out, ids, layers, site, A, lab) { const dim = A.xf.length / ids.length;
  layers.forEach((layer, k) => { const R = layer < (A.layers || []).length ? (site === 'resid_mid' ? A.layers[layer].xmid : A.layers[layer].xin) : A.xf, o = out[k];
    ids.forEach((t, i) => { if (lab.has(t)) { o.X.push(Array.from(R.subarray(i * dim, i * dim + dim))); o.y.push(lab.get(t)); o.types.push(t); } }); }); }
export function probeDataLayers(W, tok, docs, lists, layers, site = 'resid_pre') {
  const lab = probeLabels(tok, lists), out = layers.map(() => ({ X: [], y: [], types: [] }));
  for (const ids of docs) { if (!ids.some((t) => lab.has(t))) continue; probeTake(out, ids, layers, site, forward(W, ids), lab); }
  return out.map((o) => ({ ...o, nTypes: new Set(o.types).size })); }
export async function probeDataLayersAsync(W, tok, docs, lists, layers, site = 'resid_pre') {
  const lab = probeLabels(tok, lists), out = layers.map(() => ({ X: [], y: [], types: [] }));
  for (const ids of docs) { if (!ids.some((t) => lab.has(t))) continue; probeTake(out, ids, layers, site, await forwardAsync(W, ids), lab); }
  return out.map((o) => ({ ...o, nTypes: new Set(o.types).size })); }
export const probeData = (W, tok, docs, lists, { layer = 4, site = 'resid_pre' } = {}) => probeDataLayers(W, tok, docs, lists, [layer], site)[0];
export function trainProbe(X, y, K, { l2 = 1e-3, epochs = 200, lr = 0.5, seed = 1 } = {}) { const n = X.length, d = X[0].length, mu = new Float64Array(d), s = new Float64Array(d);
  for (const x of X) for (let i = 0; i < d; i++) mu[i] += x[i] / n; for (const x of X) for (let i = 0; i < d; i++) s[i] += (x[i] - mu[i]) ** 2 / n; for (let i = 0; i < d; i++) s[i] = Math.sqrt(s[i]) || 1;
  const Z = X.map((x) => x.map((v, i) => (v - mu[i]) / s[i])), Wt = Array.from({ length: K }, () => new Float64Array(d + 1)); void seed;
  for (let e = 0; e < epochs; e++) { const G = Array.from({ length: K }, () => new Float64Array(d + 1));
    for (let k = 0; k < n; k++) { const z = Z[k], lg = Wt.map((w) => { let a = w[d]; for (let i = 0; i < d; i++) a += w[i] * z[i]; return a; }), m = Math.max(...lg), ex = lg.map((v) => Math.exp(v - m)), S = ex.reduce((a, b) => a + b, 0);
      for (let c = 0; c < K; c++) { const g = ex[c] / S - (c === y[k] ? 1 : 0); for (let i = 0; i < d; i++) G[c][i] += g * z[i] / n; G[c][d] += g / n; } }
    for (let c = 0; c < K; c++) for (let i = 0; i <= d; i++) Wt[c][i] -= lr * (G[c][i] + (i < d ? l2 * Wt[c][i] : 0)); }
  const predict = (x) => { const z = x.map((v, i) => (v - mu[i]) / s[i]); let b = 0, bv = -Infinity; Wt.forEach((w, c) => { let a = w[d]; for (let i = 0; i < d; i++) a += w[i] * z[i]; if (a > bv) { bv = a; b = c; } }); return b; };
  return { predict, W: Wt }; }
// split by word TYPE so the probe cannot memorise tokens; control task = random label per type with the same class balance
export function runProbe(data, K, o = {}) { const { X, y, types } = data; if (X.length < 8) throw new Error(`only ${X.length} labelled tokens found — add words or documents`);
  const r = rng(o.seed || 7), uniq = [...new Set(types)], test = new Set(uniq.filter(() => r() < 0.3)); if (!test.size || test.size === uniq.length) { test.clear(); uniq.forEach((t, i) => i % 3 === 0 && test.add(t)); }
  const typeLab = new Map(); types.forEach((t, i) => typeLab.set(t, y[i])); const shuffled = [...typeLab.values()]; for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  const ctl = new Map([...typeLab.keys()].map((t, i) => [t, shuffled[i]])), split = (lab) => { const tr = [], te = []; X.forEach((x, i) => (test.has(types[i]) ? te : tr).push([x, lab(i)])); return [tr, te]; };
  const fit = (lab) => { const [tr, te] = split(lab); if (!tr.length || !te.length) throw new Error('need words in both splits'); const p = trainProbe(tr.map((z) => z[0]), tr.map((z) => z[1]), K, o); const acc = (S) => mean(S.map(([x, c]) => (p.predict(x) === c ? 1 : 0))); return { train: acc(tr), test: acc(te), nTrain: tr.length, nTest: te.length }; };
  const real = fit((i) => y[i]), control = fit((i) => ctl.get(types[i])), counts = new Array(K).fill(0); y.forEach((c) => counts[c]++);
  return { real, control, selectivity: real.test - control.test, majority: Math.max(...counts) / y.length, nTypes: uniq.length, nTestTypes: test.size }; }
// ── eval harness ──
export const FACTS = [['Once upon a', ' time'], ['They lived happily ever', ' after'], ['Lily and Tom were best', ' friends'], ['The sky was', ' blue'], ['The sun was', ' shining'], ['She said, "Thank', ' you'], ['He wanted to play with his', ' friends'], ['The cat said, "', 'Me'], ['They went to the', ' park'], ['Lily was very', ' happy'], ['The bird flew up into the', ' sky'], ['The dog wagged its', ' tail']];
export function factProbe(W, tok, facts = FACTS) { return facts.map(([p, a]) => { const ids = tok.encode(p), tgt = tok.encode(a)[0], l = logitsAt(W, forward(W, ids), ids.length - 1); let m = -Infinity; for (const x of l) if (x > m) m = x; let s = 0, rank = 0; for (const x of l) { s += Math.exp(x - m); if (x > l[tgt]) rank++; } return { prompt: p, answer: a, rank, logp: l[tgt] - m - Math.log(s), top1: rank === 0 }; }); }
export function ngramStats(ids, n) { const g = []; for (let i = 0; i + n <= ids.length; i++) g.push(ids.slice(i, i + n).join(',')); const u = new Set(g); return { distinct: g.length ? u.size / g.length : 0, repeated: g.length ? 1 - u.size / g.length : 0 }; }
// greedy generation through any engine with step(seq,tok)/logits(h)/newSeq()
export function greedy(eng, ids, n) { const sq = eng.newSeq(ids.length), out = []; let h; for (const t of ids) h = eng.step(sq, t).h; for (let i = 0; i < n; i++) { const l = eng.logits(h); let b = 0; for (let j = 1; j < l.length; j++) if (l[j] > l[b]) b = j; out.push(b); h = eng.step(sq, b).h; } return out; }
async function greedyAsync(eng, ids, n, pause) { const sq = eng.newSeq(ids.length), out = []; let h; for (const t of ids) { h = eng.step(sq, t).h; if (pause) await pause(); } for (let i = 0; i < n; i++) { const l = eng.logits(h); let b = 0; for (let j = 1; j < l.length; j++) if (l[j] > l[b]) b = j; out.push(b); h = eng.step(sq, b).h; if (pause) await pause(); } return out; }
// async so a UI can pass a yield function (e.g. a 0 ms timeout) between documents / facts / generations
export async function evalSuite(W, eng, tok, docs, { genPrompts = ['Once upon a time', 'Tom had a red ball.', 'One day, Lily went to'], genN = 40, yieldFn = null } = {}) {
  const y = async () => { if (yieldFn) await yieldFn(); }, ce = []; for (const d of docs) { ce.push(mean(await tokenCEAsync(W, d))); await y(); }
  const facts = []; for (const f of FACTS) { const ids = tok.encode(f[0]), tgt = tok.encode(f[1])[0], A = await forwardAsync(W, ids), l = await logitsAtAsync(W, A, ids.length - 1); let m = -Infinity; for (const x of l) if (x > m) m = x; let s = 0, rank = 0; for (const x of l) { s += Math.exp(x - m); if (x > l[tgt]) rank++; } facts.push({ prompt: f[0], answer: f[1], rank, logp: l[tgt] - m - Math.log(s), top1: rank === 0 }); await y(); }
  const gens = []; for (const p of genPrompts) { gens.push(await greedyAsync(eng, tok.encode(p), genN, yieldFn)); await y(); }
  const d1 = mean(gens.map((g) => ngramStats(g, 1).distinct)), d2 = mean(gens.map((g) => ngramStats(g, 2).distinct)), rep4 = mean(gens.map((g) => ngramStats(g, 4).repeated));
  return { ce: mean(ce), ppl: Math.exp(mean(ce)), ceDocs: ce, factTop1: mean(facts.map((f) => (f.top1 ? 1 : 0))), factLogp: mean(facts.map((f) => f.logp)), facts, distinct1: d1, distinct2: d2, rep4, samples: gens.map((g) => tok.decode(g)) }; }
// ── reproducibility ──
export function tensorsOf(W) { return [['wte', W.wte], ['wpe', W.wpe], ['lnfW', W.lnfW], ['lnfB', W.lnfB], ...W.layers.flatMap((P, l) => Object.keys(P).sort().map((k) => [`L${l}.${k}`, P[k]]))]; }
const SHA_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotr = (x, n) => (x >>> n) | (x << (32 - n));
// Streaming SHA-256. The old hash built one Uint8Array of every weight (~80MB) on the main thread.
function sha256() {
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const block = new Uint8Array(64), w = new Uint32Array(64); let n = 0, bits = 0n;
  const view = new DataView(block.buffer);
  const compress = () => {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(i * 4);
    for (let i = 16; i < 64; i++) { const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0; }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + SHA_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), maj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  };
  return { update(u8) { bits += BigInt(u8.length) * 8n; for (let i = 0; i < u8.length; i++) { block[n++] = u8[i]; if (n === 64) { compress(); n = 0; } } }, hex() { block[n++] = 0x80; if (n > 56) { block.fill(0, n); compress(); n = 0; } block.fill(0, n, 56); view.setUint32(56, Number((bits >> 32n) & 0xffffffffn)); view.setUint32(60, Number(bits & 0xffffffffn)); compress(); return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, '0')).join(''); } };
}
export async function weightsHash(W) {
  const s = sha256();
  for (const [, a] of tensorsOf(W)) { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let n = 0; for (let i = 0; i < u.length; i += 65536) { s.update(u.subarray(i, Math.min(u.length, i + 65536))); if ((++n & 7) === 0) await frame(); } }
  return s.hex();
}
export function manifest({ version, modelId, origHash, curHash, edits, runtime, prompt, decode, seed, env, extra = {} }) { return { schema: 'neuralese.manifest/1', created: new Date().toISOString(), app: version, model: { id: modelId, sha256_original: origHash }, weights_sha256_current: curHash, seed, deterministic: decode?.mode === 'greedy' || seed != null, edits, runtime, prompt, decode, env, ...extra }; }

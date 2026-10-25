// v7 research core (DOM-free, tested in Node): hypothesis tests, ACDC-style circuit discovery, causal scrubbing-lite,
// linear probes with control tasks, eval harness, weight hashing and experiment manifests.
import { forward, logitsAt, objective } from './grad.js?v=7';
import { rng } from './science.js?v=7';
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
export const docCE = (W, docs) => docs.map((d) => mean(tokenCE(W, d)));
// ── circuits: node-level ACDC-style pruning + causal scrubbing-lite ──
// nodes: every attention head (z slice) and every MLP (mlp_out). A "corrupted" node takes its activation from the corrupt run.
export function nodeList(W) { const H = (W.cfg || { H: 16 }).H || 16, out = []; for (let l = 0; l < W.layers.length; l++) { for (let h = 0; h < H; h++) out.push({ l, h, id: `L${l}H${h}` }); out.push({ l, mlp: true, id: `L${l}MLP` }); } return out; }
function runCorrupted(W, clean, Ac, set, obj) { const d = W.lnfW.length, H = (W.cfg || { H: 16 }).H || 16, hd = d / H;
  const A = forward(W, clean, { patch: (site, l, X) => { for (const n of set) if (n.l === l) { if (site === 'z' && !n.mlp) { for (let t = 0; t < clean.length; t++) for (let i = n.h * hd; i < n.h * hd + hd; i++) X[t * d + i] = Ac.layers[l].z[t * d + i]; } else if (site === 'mlp_out' && n.mlp) X.set(Ac.layers[l].mlpOut); } } });
  return objective(W, A, obj).value; }
function corruptRun(W, corr) { const mo = []; const A = forward(W, corr, { patch: (site, l, X) => { if (site === 'mlp_out') mo[l] = X.slice(); } }); A.layers.forEach((C, l) => (C.mlpOut = mo[l])); return A; }
export function acdc(W, clean, corr, obj, tau = 0.02) { const g = acdcGen(W, clean, corr, obj, tau); for (;;) { const r = g.next(); if (r.done) return r.value; } }
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
export function probeDataLayers(W, tok, docs, lists, layers, site = 'resid_pre') {
  const lab = new Map(); lists.forEach((ws, c) => ws.forEach((w) => { for (const v of [w, ' ' + w]) { const ids = tok.encode(v); if (ids.length === 1) lab.set(ids[0], c); } }));
  const out = layers.map(() => ({ X: [], y: [], types: [] })), d = W.lnfW.length;
  for (const ids of docs) { if (!ids.some((t) => lab.has(t))) continue; const A = forward(W, ids);
    layers.forEach((layer, k) => { const R = layer < W.layers.length ? (site === 'resid_mid' ? A.layers[layer].xmid : A.layers[layer].xin) : A.xf, o = out[k];
      ids.forEach((t, i) => { if (lab.has(t)) { o.X.push(Array.from(R.subarray(i * d, i * d + d))); o.y.push(lab.get(t)); o.types.push(t); } }); }); }
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
// async so a UI can pass a yield function (e.g. a 0 ms timeout) between documents / facts / generations
export async function evalSuite(W, eng, tok, docs, { genPrompts = ['Once upon a time', 'Tom had a red ball.', 'One day, Lily went to'], genN = 40, yieldFn = null } = {}) {
  const y = async () => { if (yieldFn) await yieldFn(); }, ce = []; for (const d of docs) { ce.push(mean(tokenCE(W, d))); await y(); }
  const facts = []; for (const f of FACTS) { facts.push(factProbe(W, tok, [f])[0]); await y(); } const gens = []; for (const p of genPrompts) { gens.push(greedy(eng, tok.encode(p), genN)); await y(); }
  const d1 = mean(gens.map((g) => ngramStats(g, 1).distinct)), d2 = mean(gens.map((g) => ngramStats(g, 2).distinct)), rep4 = mean(gens.map((g) => ngramStats(g, 4).repeated));
  return { ce: mean(ce), ppl: Math.exp(mean(ce)), ceDocs: ce, factTop1: mean(facts.map((f) => (f.top1 ? 1 : 0))), factLogp: mean(facts.map((f) => f.logp)), facts, distinct1: d1, distinct2: d2, rep4, samples: gens.map((g) => tok.decode(g)) }; }
// ── reproducibility ──
export function tensorsOf(W) { return [['wte', W.wte], ['wpe', W.wpe], ['lnfW', W.lnfW], ['lnfB', W.lnfB], ...W.layers.flatMap((P, l) => Object.keys(P).sort().map((k) => [`L${l}.${k}`, P[k]]))]; }
export async function weightsHash(W) { const parts = tensorsOf(W), tot = parts.reduce((s, [, a]) => s + a.byteLength, 0), buf = new Uint8Array(tot); let o = 0; for (const [, a] of parts) { buf.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), o); o += a.byteLength; }
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', buf)); return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join(''); }
export function manifest({ version, modelId, origHash, curHash, edits, runtime, prompt, decode, seed, env, extra = {} }) { return { schema: 'neuralese.manifest/1', created: new Date().toISOString(), app: version, model: { id: modelId, sha256_original: origHash }, weights_sha256_current: curHash, seed, deterministic: decode?.mode === 'greedy' || seed != null, edits, runtime, prompt, decode, env, ...extra }; }

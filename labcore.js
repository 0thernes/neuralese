// NEURALESE lab core: pure, testable research computations behind every v5 visualization.
// Everything here runs on the live weights / engine; nothing is precomputed or faked.
import { CFG, mulberry32, cloneWeights } from './model.js?v=12';
import { Engine, defaultRuntime, logSoftmax, layerNorm, entropy } from './engine.js?v=12';
const { d, H, hd, L, ff, V } = CFG;
const tick = () => new Promise((r) => setTimeout(r, 0));

// ───────── architecture & parameters ─────────
// Parameter breakdown measured from the actual tensors in W (lengths), grouped for treemaps.
export function paramBreakdown(W) {
  const out = [{ name: 'wte (tied unembed)', group: 'embed', layer: -1, count: W.wte.length, shape: [W.wte.length / d, d] }, { name: 'wpe', group: 'embed', layer: -1, count: W.wpe.length, shape: [W.wpe.length / d, d] }];
  W.layers.forEach((P, l) => {
    out.push({ name: `L${l}.ln1`, group: 'norm', layer: l, count: P.ln1w.length + P.ln1b.length, shape: [2, d] });
    for (const m of ['q', 'k', 'v']) out.push({ name: `L${l}.${m}`, group: 'attn', layer: l, count: P[m].length, shape: [d, d] });
    out.push({ name: `L${l}.o`, group: 'attn', layer: l, count: P.o.length + P.ob.length, shape: [d, d] });
    out.push({ name: `L${l}.ln2`, group: 'norm', layer: l, count: P.ln2w.length + P.ln2b.length, shape: [2, d] });
    out.push({ name: `L${l}.fc`, group: 'mlp', layer: l, count: P.fc.length + P.fcb.length, shape: [P.fcb.length, d] });
    out.push({ name: `L${l}.proj`, group: 'mlp', layer: l, count: P.proj.length + P.projb.length, shape: [d, P.fcb.length] });
  });
  out.push({ name: 'ln_f', group: 'norm', layer: L, count: W.lnfW.length + W.lnfB.length, shape: [2, d] });
  return out;
}
// Forward FLOPs (multiply-add = 2 FLOPs) for one new token at context length T, per op. Odd layers use local attention (window 256).
export function flopsPerToken(T, n = { d, H, L, ff, V, window: CFG.window }) {
  const ops = [];
  for (let l = 0; l < n.L; l++) { const Te = l % 2 ? Math.min(T, n.window) : T;
    ops.push({ op: `L${l}.qkv`, l, kind: 'attn', f: 3 * 2 * n.d * n.d }, { op: `L${l}.scores`, l, kind: 'attn', f: 2 * Te * n.d }, { op: `L${l}.AV`, l, kind: 'attn', f: 2 * Te * n.d }, { op: `L${l}.o`, l, kind: 'attn', f: 2 * n.d * n.d },
      { op: `L${l}.fc`, l, kind: 'mlp', f: 2 * n.d * n.ff }, { op: `L${l}.proj`, l, kind: 'mlp', f: 2 * n.ff * n.d }); }
  ops.push({ op: 'unembed', l: n.L, kind: 'unembed', f: 2 * n.V * n.d });
  return { ops, total: ops.reduce((s, o) => s + o.f, 0) };
}
// Block graph of the real model (shapes taken from W and the runtime program, so duplicated/skipped slots show up).
export function archGraph(W, R) {
  const nodes = [{ id: 'tok', label: 'token ids', shape: '[T]' }, { id: 'emb', label: 'wte + wpe', shape: `[T, ${d}]`, params: W.wte.length + W.wpe.length }];
  R.program.forEach((s, i) => { const P = W.layers[s.layer], pa = P.q.length * 3 + P.o.length + P.ob.length + P.ln1w.length * 2, pm = P.fc.length + P.fcb.length + P.proj.length + P.projb.length + P.ln2w.length * 2;
    nodes.push({ id: `s${i}`, slot: i, layer: s.layer, attn: s.attn, mlp: s.mlp, label: `slot ${i} = L${s.layer}`, local: s.layer % 2 === 1, attnParams: pa, mlpParams: pm,
      attnShape: `LN → Q,K,V [${d}→${H}×${hd}] → ${s.layer % 2 ? 'local(256)' : 'global'} softmax(QKᵀ) V → O [${d}→${d}]`, mlpShape: `LN → fc [${d}→${P.fcb.length}] → GELU → proj [${P.fcb.length}→${d}]` }); });
  nodes.push({ id: 'lnf', label: 'ln_f', shape: `[${d}]`, params: W.lnfW.length * 2 }, { id: 'unemb', label: 'unembed (tied wte)ᵀ', shape: `[${d}→${V}]`, params: 0 }, { id: 'out', label: 'logits', shape: `[${V}]` });
  return nodes;
}

// ───────── weight statistics ─────────
export function moments(a) {
  const n = a.length; let m = 0, amax = 0, small = 0; for (let i = 0; i < n; i++) { m += a[i]; const x = Math.abs(a[i]); if (x > amax) amax = x; if (x < 1e-3) small++; } m /= n;
  let m2 = 0, m4 = 0; for (let i = 0; i < n; i++) { const c = a[i] - m; m2 += c * c; m4 += c * c * c * c; } m2 /= n; m4 /= n;
  return { n, mean: m, std: Math.sqrt(m2), kurtosis: m4 / (m2 * m2 || 1e-30) - 3, absmax: amax, nearZero: small / n };
}
export function histogram(a, bins = 60, lo, hi) {
  if (lo == null || hi == null) { lo = Infinity; hi = -Infinity; for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; } }
  if (!(hi > lo)) hi = lo + 1; const c = new Array(bins).fill(0), w = (hi - lo) / bins;
  for (const v of a) { const b = Math.floor((v - lo) / w); if (b >= 0 && b < bins) c[b]++; else if (v === hi) c[bins - 1]++; }
  return { counts: c, lo, hi, edges: Array.from({ length: bins + 1 }, (_, i) => lo + i * w) };
}
// Gram matrix of the smaller side (n×n, n = min(rows, cols)) in float64.
export function gram(A, rows, cols) {
  const n = Math.min(rows, cols), G = new Float64Array(n * n);
  if (cols <= rows) { for (let r = 0; r < rows; r++) { const o = r * cols; for (let i = 0; i < cols; i++) { const ai = A[o + i]; if (!ai) continue; for (let j = i; j < cols; j++) G[i * n + j] += ai * A[o + j]; } } }
  else { for (let i = 0; i < rows; i++) for (let j = i; j < rows; j++) { let s = 0; const oi = i * cols, oj = j * cols; for (let k = 0; k < cols; k++) s += A[oi + k] * A[oj + k]; G[i * n + j] = s; } }
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) G[i * n + j] = G[j * n + i]; return G;
}
// Eigenvalues of a symmetric matrix: Householder tridiagonalisation + implicit QL (Numerical Recipes tred2/tqli, values only).
export function symEigvals(A0, n) {
  const a = Array.from({ length: n }, (_, i) => Float64Array.from(A0.subarray ? A0.subarray(i * n, i * n + n) : A0.slice(i * n, i * n + n)));
  const dd = new Float64Array(n), e = new Float64Array(n);
  for (let i = n - 1; i > 0; i--) { const l = i - 1; let h = 0, scale = 0;
    if (l > 0) { for (let k = 0; k <= l; k++) scale += Math.abs(a[i][k]);
      if (scale === 0) e[i] = a[i][l];
      else { for (let k = 0; k <= l; k++) { a[i][k] /= scale; h += a[i][k] * a[i][k]; } let f = a[i][l]; const g = f >= 0 ? -Math.sqrt(h) : Math.sqrt(h); e[i] = scale * g; h -= f * g; a[i][l] = f - g; f = 0;
        for (let j = 0; j <= l; j++) { let g2 = 0; for (let k = 0; k <= j; k++) g2 += a[j][k] * a[i][k]; for (let k = j + 1; k <= l; k++) g2 += a[k][j] * a[i][k]; e[j] = g2 / h; f += e[j] * a[i][j]; }
        const hh = f / (h + h); for (let j = 0; j <= l; j++) { const fj = a[i][j]; const gj = (e[j] -= hh * fj); for (let k = 0; k <= j; k++) a[j][k] -= fj * e[k] + gj * a[i][k]; } }
    } else e[i] = a[i][l]; dd[i] = h; }
  for (let i = 0; i < n; i++) dd[i] = a[i][i];
  for (let i = 1; i < n; i++) e[i - 1] = e[i]; e[n - 1] = 0;
  for (let l = 0; l < n; l++) { let iter = 0, m;
    do { for (m = l; m < n - 1; m++) { const s = Math.abs(dd[m]) + Math.abs(dd[m + 1]); if (Math.abs(e[m]) <= 1e-15 * s) break; }
      if (m !== l) { if (iter++ === 60) break; let g = (dd[l + 1] - dd[l]) / (2 * e[l]); let r = Math.hypot(g, 1); g = dd[m] - dd[l] + e[l] / (g + (g >= 0 ? Math.abs(r) : -Math.abs(r)));
        let s = 1, c = 1, p = 0, i;
        for (i = m - 1; i >= l; i--) { let f = s * e[i]; const b = c * e[i]; r = Math.hypot(f, g); e[i + 1] = r; if (r === 0) { dd[i + 1] -= p; e[m] = 0; break; } s = f / r; c = g / r; g = dd[i + 1] - p; r = (dd[i] - g) * s + 2 * c * b; p = s * r; dd[i + 1] = g + p; g = c * r - b; }
        if (r === 0 && i >= l) continue; dd[l] -= p; e[l] = g; e[m] = 0; }
    } while (m !== l); }
  return Array.from(dd).sort((x, y) => y - x);
}
// Power-law fit of the empirical spectral density tail (WeightWatcher-style): Hill/Clauset MLE alpha, xmin chosen by minimum KS distance.
export function powerLawFit(eigs, minTail = 10) {
  const x = eigs.filter((v) => v > 0).sort((a, b) => a - b), n = x.length; let best = null;
  for (let s = 0; s <= n - minTail; s++) { const xmin = x[s], tail = x.slice(s), m = tail.length; let sl = 0; for (const v of tail) sl += Math.log(v / xmin); if (!(sl > 0)) continue;
    const alpha = 1 + m / sl; let D = 0; for (let i = 0; i < m; i++) { const emp = i / m, fit = 1 - Math.pow(tail[i] / xmin, 1 - alpha); D = Math.max(D, Math.abs(emp - fit)); }
    if (!best || D < best.D) best = { alpha, xmin, D, nTail: m }; }
  return best || { alpha: NaN, xmin: NaN, D: NaN, nTail: 0 };
}
// Full spectral report of one matrix (rows×cols): singular values, stable rank, entropy effective rank, ESD alpha.
export function spectral(A, rows, cols) {
  const N = Math.max(rows, cols), ev = symEigvals(gram(A, rows, cols), Math.min(rows, cols)).map((v) => Math.max(0, v));
  const sv = ev.map(Math.sqrt), fro2 = ev.reduce((a, b) => a + b, 0), ssum = sv.reduce((a, b) => a + b, 0); let Hs = 0; for (const s of sv) { const p = s / ssum; if (p > 0) Hs -= p * Math.log(p); }
  const esd = ev.map((v) => v / N); const pl = powerLawFit(esd);
  return { sv, stableRank: fro2 / (ev[0] || 1), effRank: Math.exp(Hs), fro: Math.sqrt(fro2), spectralNorm: sv[0], alpha: pl.alpha, xmin: pl.xmin, ks: pl.D, nTail: pl.nTail, esd };
}

// ───────── attention: head classification and rollout ─────────
export function repeatedTokens(n = 30, seed = 7) { const r = mulberry32(seed); const a = Array.from({ length: n }, () => 1000 + Math.floor(r() * 20000)); return [...a, ...a]; }
// Real scoring on the given engine. Returns per-layer per-head scores and a label.
// prev: mean attn(t→t−1) on text; sink: mean attn(t→0); induction: mean attn(n+i → i+1) on a repeated random sequence; duplicate: mean attn(n+i → i).
export function headScores(eng, textIds, n = 30) {
  const tx = eng.run(textIds, { trace: true }).traces, rp = eng.run(repeatedTokens(n), { trace: true }).traces, slots = eng.R.program.length;
  const out = [];
  for (let s = 0; s < slots; s++) { const row = [];
    for (let h = 0; h < H; h++) {
      let prev = 0, sink = 0, ent = 0, c = 0; for (let t = 1; t < tx.length; t++) { const p = tx[t].pattern[s]?.[h]; if (!p) continue; prev += p[t - 1]; sink += p[0]; let e = 0; for (const w of p) if (w > 0) e -= w * Math.log(w); ent += e / Math.log(t + 1); c++; }
      let ind = 0, dup = 0, c2 = 0; for (let i = 1; i < n - 1; i++) { const p = rp[n + i].pattern[s]?.[h]; if (!p) continue; ind += p[i + 1]; dup += p[i]; c2++; }
      const sc = { prev: prev / (c || 1), sink: sink / (c || 1), induction: ind / (c2 || 1), duplicate: dup / (c2 || 1), entropy: ent / (c || 1) };
      const best = Object.entries({ 'previous-token': sc.prev, induction: sc.induction, 'duplicate-token': sc.duplicate, 'positional/sink': sc.sink }).sort((a, b) => b[1] - a[1])[0];
      sc.label = best[1] >= 0.3 ? best[0] : sc.entropy > 0.7 ? 'diffuse' : 'mixed'; sc.layer = eng.R.program[s].layer; row.push(sc);
    } out.push(row); }
  return out;
}
// Attention rollout (Abnar & Zuidema 2020): per slot head-mean attention, Â = ½A + ½I, rows renormalised, multiplied through the stack. traces from Engine.run(...,{trace:true}).
export function attentionRollout(traces, slots) {
  const T = traces.length; let Rm = Array.from({ length: T }, (_, i) => { const r = new Float64Array(T); r[i] = 1; return r; });
  for (let s = 0; s < slots; s++) { const A = Array.from({ length: T }, (_, q) => { const r = new Float64Array(T); const pats = traces[q].pattern[s]; if (pats) for (const p of pats) for (let k = 0; k <= q; k++) r[k] += (p[k] || 0) / pats.length; else r[q] = 1; for (let k = 0; k < T; k++) r[k] = 0.5 * r[k] + (k === q ? 0.5 : 0); return r; });
    Rm = A.map((row) => { const o = new Float64Array(T); for (let k = 0; k < T; k++) if (row[k]) for (let j = 0; j < T; j++) o[j] += row[k] * Rm[k][j]; return o; }); }
  return Rm.map((r) => Array.from(r));
}

// ───────── composition scores & circuit graph ─────────
const headRows = (M, h) => { const A = new Float64Array(hd * d); for (let i = 0; i < hd; i++) for (let j = 0; j < d; j++) A[i * d + j] = M[(h * hd + i) * d + j]; return A; }; // hd×d (rows of q/k/v)
const headCols = (O, h) => { const A = new Float64Array(d * hd); for (let i = 0; i < d; i++) for (let j = 0; j < hd; j++) A[i * hd + j] = O[i * d + h * hd + j]; return A; }; // d×hd (columns of o)
const rowGram = (A) => { const G = new Float64Array(hd * hd); for (let i = 0; i < hd; i++) for (let j = 0; j < hd; j++) { let s = 0; for (let k = 0; k < d; k++) s += A[i * d + k] * A[j * d + k]; G[i * hd + j] = s; } return G; };
const colGram = (A) => { const G = new Float64Array(hd * hd); for (let i = 0; i < hd; i++) for (let j = 0; j < hd; j++) { let s = 0; for (let k = 0; k < d; k++) s += A[k * hd + i] * A[k * hd + j]; G[i * hd + j] = s; } return G; };
const mul = (X, Y, n = hd) => { const Z = new Float64Array(n * n); for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) { const x = X[i * n + k]; if (x) for (let j = 0; j < n; j++) Z[i * n + j] += x * Y[k * n + j]; } return Z; };
const rowsTimesCols = (Rw, Cl) => { const Z = new Float64Array(hd * hd); for (let i = 0; i < hd; i++) for (let j = 0; j < hd; j++) { let s = 0; for (let k = 0; k < d; k++) s += Rw[i * d + k] * Cl[k * hd + j]; Z[i * hd + j] = s; } return Z; };
const tr = (X, n = hd) => { let s = 0; for (let i = 0; i < n; i++) s += X[i * n + i]; return s; };
const T_ = (X, n = hd) => { const Y = new Float64Array(n * n); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Y[j * n + i] = X[i * n + j]; return Y; };
// ‖A M B‖_F² = tr(Mᵀ (AᵀA) M (B Bᵀ))
const fro2AMB = (GA, Mx, GB) => tr(mul(mul(mul(T_(Mx), GA), Mx), GB));
export function headFactors(W, l, h) { const P = W.layers[l]; const Q = headRows(P.q, h), K = headRows(P.k, h), Vv = headRows(P.v, h), O = headCols(P.o, h); return { Q, K, V: Vv, O, GQ: rowGram(Q), GK: rowGram(K), GV: rowGram(Vv), GO: colGram(O) }; }
// Elhage et al. (2021) composition scores between an earlier head (l1,h1) and later head (l2,h2). LayerNorm ignored (standard approximation).
export function compositionScores(W, a, b) {
  const A = a.GQ ? a : headFactors(W, a[0], a[1]), B = b.GQ ? b : headFactors(W, b[0], b[1]);
  const ov = Math.sqrt(Math.max(0, tr(mul(A.GO, A.GV)))), qk = Math.sqrt(Math.max(0, tr(mul(B.GQ, B.GK)))), ov2 = Math.sqrt(Math.max(0, tr(mul(B.GO, B.GV))));
  const kc = Math.sqrt(Math.max(0, fro2AMB(B.GQ, rowsTimesCols(B.K, A.O), A.GV))) / (qk * ov || 1);
  const qc = Math.sqrt(Math.max(0, fro2AMB(B.GK, rowsTimesCols(B.Q, A.O), A.GV))) / (qk * ov || 1);
  const vc = Math.sqrt(Math.max(0, fro2AMB(B.GO, rowsTimesCols(B.V, A.O), A.GV))) / (ov2 * ov || 1);
  return { q: qc, k: kc, v: vc };
}

// ───────── residual geometry ─────────
// Top-k principal components of rows of X (n×dim) by deflated power iteration; returns {comps, mu, var, proj(n×k)}.
export function pcaK(X, n, dim, k = 3, iters = 60) {
  const mu = new Float64Array(dim); for (let i = 0; i < n; i++) for (let j = 0; j < dim; j++) mu[j] += X[i * dim + j] / n;
  const C = new Float64Array(dim * dim); for (let i = 0; i < n; i++) for (let a = 0; a < dim; a++) { const xa = X[i * dim + a] - mu[a]; if (!xa) continue; for (let b = a; b < dim; b++) C[a * dim + b] += xa * (X[i * dim + b] - mu[b]); }
  for (let a = 0; a < dim; a++) for (let b = 0; b < a; b++) C[a * dim + b] = C[b * dim + a]; let totVar = 0; for (let a = 0; a < dim; a++) totVar += C[a * dim + a];
  const comps = [], vars = [];
  for (let c = 0; c < k; c++) { let v = new Float64Array(dim).map((_, i) => Math.sin(i * (c + 1) + 1)), lam = 0;
    for (let it = 0; it < iters; it++) { const w = new Float64Array(dim); for (let a = 0; a < dim; a++) { let s = 0; for (let b = 0; b < dim; b++) s += C[a * dim + b] * v[b]; w[a] = s; }
      for (const u of comps) { let p = 0; for (let a = 0; a < dim; a++) p += w[a] * u[a]; for (let a = 0; a < dim; a++) w[a] -= p * u[a]; }
      lam = Math.hypot(...w); v = w.map((x) => x / (lam || 1)); }
    comps.push(v); vars.push(lam / (totVar || 1)); }
  const proj = Array.from({ length: n }, (_, i) => comps.map((u) => { let s = 0; for (let j = 0; j < dim; j++) s += (X[i * dim + j] - mu[j]) * u[j]; return s; }));
  return { comps, mu, explained: vars, proj };
}
export function cosineMatrix(vs) { const n = vs.map((v) => Math.hypot(...v) || 1); return vs.map((a, i) => vs.map((b, j) => { let s = 0; for (let k = 0; k < a.length; k++) s += a[k] * b[k]; return s / (n[i] * n[j]); })); }

// ───────── embeddings ─────────
let _normCache = null;
export function embedNorms(W) { if (_normCache && _normCache.W === W.wte) return _normCache.n; const n = new Float32Array(W.wte.length / d); for (let i = 0; i < n.length; i++) { let s = 0; for (let j = 0; j < d; j++) s += W.wte[i * d + j] ** 2; n[i] = Math.sqrt(s) || 1; } _normCache = { W: W.wte, n }; return n; }
export function nearestTokens(W, vec, k = 12, exclude = -1) {
  const n = embedNorms(W), vn = Math.hypot(...vec) || 1, best = [];
  for (let i = 0; i < n.length; i++) { if (i === exclude) continue; let s = 0; const o = i * d; for (let j = 0; j < d; j++) s += W.wte[o + j] * vec[j]; s /= n[i] * vn;
    if (best.length < k || s > best[best.length - 1][1]) { best.push([i, s]); best.sort((a, b) => b[1] - a[1]); if (best.length > k) best.pop(); } }
  return best;
}
export const embedOf = (W, id) => W.wte.subarray(id * d, id * d + d);

// ───────── neurons ─────────
// Neuron atlas for one layer over corpus tokens: max/mean activation, firing frequency, top-k activating positions and a polysemanticity
// score = exp(entropy over token identities of the top-k activation mass) (1 = all top activations on one token type).
export async function neuronAtlas(Wc, docs, l, N = 400, k = 16, onp = () => {}) {
  const eng = new Engine(Wc, defaultRuntime()); const acts = new Float32Array(N * ff), ids = new Int32Array(N), where = []; let n = 0;
  for (let di = 0; di < docs.length && n < N; di++) { const s = eng.newSeq(docs[di].length);
    for (let t = 0; t < docs[di].length && n < N; t++) { eng.step(s, docs[di][t], { hook: (site, slot, layer, tt, x) => { if (site === 'mlp_act' && layer === l) acts.set(x, n * ff); } }); ids[n] = docs[di][t]; where.push([di, t]); n++; }
    onp(n / N); await tick(); }
  const neurons = [];
  for (let j = 0; j < ff; j++) { let mx = -Infinity, mean = 0, fire = 0; const top = [];
    for (let i = 0; i < n; i++) { const a = acts[i * ff + j]; mean += a; if (a > 0) fire++; if (a > mx) mx = a; if (top.length < k || a > top[top.length - 1][1]) { top.push([i, a]); top.sort((x, y) => y[1] - x[1]); if (top.length > k) top.pop(); } }
    const mass = new Map(); let tot = 0; for (const [i, a] of top) { const w = Math.max(0, a); mass.set(ids[i], (mass.get(ids[i]) || 0) + w); tot += w; }
    let Hh = 0; for (const w of mass.values()) { const p = w / (tot || 1); if (p > 0) Hh -= p * Math.log(p); }
    neurons.push({ n: j, max: mx, mean: mean / n, freq: fire / n, top: top.map(([i, a]) => ({ i, a, id: ids[i], doc: where[i][0], pos: where[i][1] })), poly: Math.exp(Hh) }); }
  return { l, N: n, neurons };
}

// ───────── evaluation ─────────
// Next-token NLL and top-1 confidence for each position of each doc (up to N predictions). engine = live (possibly hacked) model.
export async function evalCorpus(eng, docs, N = 160, onp = () => {}) {
  const rows = []; for (let di = 0; di < docs.length && rows.length < N; di++) { const s = eng.newSeq(docs[di].length);
    for (let t = 0; t < docs[di].length - 1 && rows.length < N; t++) { const r = eng.step(s, docs[di][t]); const lp = logSoftmax(eng.outLogits ? eng.outLogits(r.h) : eng.logits(r.h)); let am = 0; for (let i = 1; i < lp.length; i++) if (lp[i] > lp[am]) am = i;
      rows.push({ nll: -lp[docs[di][t + 1]], conf: Math.exp(lp[am]), correct: am === docs[di][t + 1], ent: entropy(lp) }); }
    onp(rows.length / N); await tick(); }
  return rows;
}
// Reliability diagram + expected calibration error from evalCorpus rows.
export function calibration(rows, bins = 10) {
  const B = Array.from({ length: bins }, (_, i) => ({ lo: i / bins, hi: (i + 1) / bins, n: 0, conf: 0, acc: 0 }));
  for (const r of rows) { const b = B[Math.min(bins - 1, Math.floor(r.conf * bins))]; b.n++; b.conf += r.conf; b.acc += r.correct ? 1 : 0; }
  let ece = 0; for (const b of B) { if (b.n) { b.conf /= b.n; b.acc /= b.n; ece += (b.n / rows.length) * Math.abs(b.acc - b.conf); } }
  const nll = rows.reduce((a, r) => a + r.nll, 0) / (rows.length || 1);
  return { bins: B, ece, ppl: Math.exp(nll), nll, acc: rows.filter((r) => r.correct).length / (rows.length || 1), meanEnt: rows.reduce((a, r) => a + r.ent, 0) / (rows.length || 1) };
}
export function klLogits(lpP, lpQ) { let k = 0; for (let i = 0; i < lpP.length; i++) { const p = Math.exp(lpP[i]); if (p > 1e-12) k += p * (lpP[i] - lpQ[i]); } return Math.max(0, k); }
// Edit impact: per-slot logit-lens KL(hacked‖clean) at the last position, per-position final KL, and top probability shifts.
export function editImpact(engC, engH, ids) {
  const a = engC.run(ids, { trace: true }).traces, b = engH.run(ids, { trace: true }).traces, T = ids.length;
  const sl = Math.min(engC.R.program.length, engH.R.program.length), perLayer = [];
  for (let s = 0; s < sl; s++) perLayer.push(klLogits(logSoftmax(engH.lensLogits(b[T - 1].resid_post[s])), logSoftmax(engC.lensLogits(a[T - 1].resid_post[s]))));
  const perPos = a.map((t, i) => klLogits(logSoftmax(engH.logits(b[i].h)), logSoftmax(engC.logits(t.h))));
  const pC = logSoftmax(engC.logits(a[T - 1].h)), pH = logSoftmax(engH.logits(b[T - 1].h)), dif = [];
  for (let i = 0; i < pC.length; i++) { const dlt = Math.exp(pH[i]) - Math.exp(pC[i]); if (Math.abs(dlt) > 1e-4) dif.push([i, dlt, Math.exp(pC[i]), Math.exp(pH[i])]); }
  dif.sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
  let tv = 0; for (let i = 0; i < pC.length; i++) tv += Math.abs(Math.exp(pH[i]) - Math.exp(pC[i])); 
  return { perLayer, perPos, shifts: dif.slice(0, 16), tv: tv / 2, finalKL: perPos[T - 1], entC: entropy(pC), entH: entropy(pH) };
}
// Weight blend W + α(M − W) into a scratch copy (for edit-strength sweeps). Returns scratch.
export function blendWeights(W, M, alpha, scratch) {
  scratch = scratch || cloneWeights(W); const mix = (a, b, o) => { for (let i = 0; i < a.length; i++) o[i] = a[i] + alpha * (b[i] - a[i]); };
  mix(W.wte, M.wte, scratch.wte); mix(W.wpe, M.wpe, scratch.wpe); mix(W.lnfW, M.lnfW, scratch.lnfW); mix(W.lnfB, M.lnfB, scratch.lnfB);
  W.layers.forEach((P, l) => { for (const k in P) mix(P[k], M.layers[l][k], scratch.layers[l][k]); }); return scratch;
}
// Per-op profiler: wall time between successive engine hooks (= real compute of each op) for one forward step per token.
export function profile(eng, ids) {
  const s = eng.newSeq(ids.length), rows = []; const order = ['resid_pre', 'z', 'attn_out', 'mlp_act', 'mlp_out', 'resid_post'], name = { z: 'ln1+qkv+attn', attn_out: 'o-proj', mlp_act: 'ln2+fc+gelu', mlp_out: 'proj', resid_post: 'resid/steer', resid_pre: 'embed/prev' };
  for (const id of ids) { let last = performance.now(); const t0 = last, seg = [];
    const r = eng.step(s, id, { hook: (site, slot, l) => { const now = performance.now(); seg.push({ op: name[site] || site, slot, l, ms: now - last, start: last - t0 }); last = now; } });
    const u0 = performance.now(); eng.logits(r.h); const u1 = performance.now(); seg.push({ op: 'lnf+unembed', slot: -1, l: L, ms: u1 - last, start: last - t0 });
    rows.push({ T: s.T, seg, total: u1 - t0 }); }
  const agg = {}; for (const r of rows) for (const g of r.seg) agg[g.op] = (agg[g.op] || 0) + g.ms; return { rows, agg };
}
export const memoryInfo = () => (typeof performance !== 'undefined' && performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize, limit: performance.memory.jsHeapSizeLimit } : null);
// Tiny CSV writer.
export const toCSV = (rows, header) => [header ? header.join(',') : null, ...rows.map((r) => r.map((v) => (typeof v === 'string' ? JSON.stringify(v) : Number.isFinite(v) ? +v.toPrecision(8) : v)).join(','))].filter((x) => x != null).join('\n');

// Key-cache geometry (Lyra Technique, Edrington, Watson & Wilkes, Liberation Labs, 2026).
// Original implementation. Formulas follow the paper's §3.1–3.2; we do not vendor their code.
// Singular values use the lab's existing one-sided Jacobi SVD (src/linalg.js).
//
// Scale: the paper's models were 0.5B–70B. Callers must treat a null result as a result.
import { svd } from '../linalg.js?v=170';
import { mulberry32 } from '../model.js?v=170';

// Live readout cadence. Full SVD also runs at prompt end and generation end.
// Head dim on TinyStories-8M is 16, so one layer is a small Gram matrix; the cadence is the
// contract for larger caches (a full SVD on every generated token is not promised).
export const KV_CADENCE = 8;
export const SV_EPS = 1e-10;

// Aggregates the paper's classifier uses, plus the two auxiliary features (§3.1.4).
// Per-layer spectra are averaged for the three SVD features and for rank10.
export const FEATURE_NAMES = [
  'spectral_entropy', 'effective_rank', 'top_sv_ratio', 'rank10',
  'key_norm', 'norm_per_token', 'layer_norm_entropy', 'layer_variance',
];

// Kflat is (nHeads * T) × headDim: one row per head-position, paper eq. (1).
export function flattenKeyCache(tokenVecs, nHeads, headDim) {
  const rows = [];
  for (let t = 0; t < tokenVecs.length; t++) {
    const v = tokenVecs[t];
    if (v.length !== nHeads * headDim) throw new Error(`key length ${v.length} != ${nHeads} heads × ${headDim}`);
    for (let h = 0; h < nHeads; h++) {
      const row = new Float64Array(headDim);
      for (let i = 0; i < headDim; i++) row[i] = v[h * headDim + i];
      rows.push(row);
    }
  }
  return rows;
}

export function svdvals(rows) {
  if (!rows.length || !rows[0].length) return [];
  const m = rows.length, n = rows[0].length;
  const A = new Float64Array(m * n);
  for (let i = 0; i < m; i++) {
    const r = rows[i];
    if (r.length !== n) throw new Error('ragged key matrix');
    for (let j = 0; j < n; j++) A[i * n + j] = r[j];
  }
  return Array.from(svd(A, m, n).S);
}

export function frobenius(rows) {
  let s = 0;
  for (const r of rows) for (let j = 0; j < r.length; j++) s += r[j] * r[j];
  return Math.sqrt(s);
}

// p_i = σ_i / Σσ , entropy in nats, effective rank = exp(H). Paper eqs. (3)–(6).
export function spectrumFeatures(sigmas) {
  let sum = 0;
  for (const s of sigmas) if (s > 0) sum += s;
  if (!(sum > 0)) return { spectral_entropy: 0, effective_rank: 0, top_sv_ratio: 0, rank10: 0 };
  let H = 0;
  const lead = sigmas[0] || 0;
  let rank10 = 0;
  for (const s of sigmas) {
    if (lead > 0 && s > 0.1 * lead) rank10++;
    const p = s / sum;
    if (p > SV_EPS) H -= p * Math.log(p);
  }
  return { spectral_entropy: H, effective_rank: Math.exp(H), top_sv_ratio: (sigmas[0] || 0) / sum, rank10 };
}

export function layerGeometry(rows) {
  const sv = svdvals(rows);
  const spec = spectrumFeatures(sv);
  const key_norm = frobenius(rows);
  return { ...spec, key_norm, n_rows: rows.length, head_dim: rows[0]?.length ?? 0, sv_head: sv.slice(0, 4) };
}

// keys[layer] = rows of Kflat. Global norms follow paper eqs. (7)–(9) and §3.1.4.
export function cacheGeometry(keys) {
  const layers = keys.map((rows) => layerGeometry(rows));
  const L = layers.length || 1;
  const meanOf = (k) => layers.reduce((a, x) => a + x[k], 0) / L;
  const norms = layers.map((x) => x.key_norm);
  const ntot = norms.reduce((a, b) => a + b, 0);
  let H = 0, mean = ntot / L, variance = 0;
  if (ntot > 0) {
    for (const n of norms) { const p = n / ntot; if (p > SV_EPS) H -= p * Math.log(p); }
  }
  for (const n of norms) variance += (n - mean) ** 2;
  variance = layers.length ? variance / layers.length : 0; // population variance of the L layer norms
  return {
    layers, n_layers: layers.length,
    spectral_entropy: meanOf('spectral_entropy'),
    effective_rank: meanOf('effective_rank'),
    top_sv_ratio: meanOf('top_sv_ratio'),
    rank10: meanOf('rank10'),
    key_norm: ntot,
    layer_norm_entropy: H,
    layer_variance: variance,
  };
}

// T is tokens, not flattened rows. Pass it in; norm_per_token = N_total / T (eq. 8).
export function snapshotGeometry(keys, { nTokens, phase = null, nPrompt = null } = {}) {
  const g = cacheGeometry(keys);
  const T = nTokens ?? 0;
  const features = {
    spectral_entropy: g.spectral_entropy,
    effective_rank: g.effective_rank,
    top_sv_ratio: g.top_sv_ratio,
    rank10: g.rank10,
    key_norm: g.key_norm,
    norm_per_token: T > 0 ? g.key_norm / T : 0,
    layer_norm_entropy: g.layer_norm_entropy,
    layer_variance: g.layer_variance,
  };
  return {
    phase, T, n_prompt: nPrompt,
    ...features,
    features,
    values: FEATURE_NAMES.map((k) => features[k]),
    names: FEATURE_NAMES,
    layers: g.layers.map((L) => ({
      spectral_entropy: L.spectral_entropy,
      effective_rank: L.effective_rank,
      top_sv_ratio: L.top_sv_ratio,
      rank10: L.rank10,
      key_norm: L.key_norm,
      norm_per_token: T > 0 ? L.key_norm / T : 0,
      sv_head: L.sv_head,
    })),
  };
}

export function geometryFromTokenKeys(tokenKeys, { nHeads, headDim, nTokens, phase, nPrompt }) {
  const flat = tokenKeys.map((toks) => flattenKeyCache(toks, nHeads, headDim));
  const T = nTokens ?? (tokenKeys[0]?.length ?? 0);
  return snapshotGeometry(flat, { nTokens: T, phase, nPrompt });
}

// seq.K[layer][t] is the engine's concatenated key (GPT-Neo: H * hd). Read-only.
export function geometryFromSeq(seq, { nHeads, headDim, phase = 'generation', upTo = null } = {}) {
  const T = upTo == null ? seq.T : upTo;
  const tokenKeys = seq.K.map((layer) => {
    const n = Math.min(T, layer?.length ?? 0);
    const toks = [];
    for (let t = 0; t < n; t++) toks.push(layer[t]);
    return toks;
  });
  return geometryFromTokenKeys(tokenKeys, { nHeads, headDim, nTokens: T, phase, nPrompt: seq.nPrompt ?? null });
}

export function deltaValues(gen, enc) {
  if (gen.length !== enc.length) throw new Error('feature length mismatch');
  return gen.map((v, i) => v - enc[i]);
}

// Gaussian elimination, partial pivot. Throws if a pivot is ~0 (caller drops constant columns).
export function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => row.concat([b[i]]));
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) throw new Error('singular design matrix');
    const tmp = M[c]; M[c] = M[piv]; M[piv] = tmp;
    const div = M[c][c];
    for (let j = c; j <= n; j++) M[c][j] /= div;
    for (let r = 0; r < n; r++) if (r !== c) {
      const f = M[r][c];
      for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((row) => row[n]);
}

export function ols(y, Z) {
  const n = y.length, k = Z[0].length;
  const G = Array.from({ length: k }, () => Array(k).fill(0));
  const rhs = Array(k).fill(0);
  for (let i = 0; i < n; i++) for (let a = 0; a < k; a++) {
    rhs[a] += Z[i][a] * y[i];
    for (let b = 0; b < k; b++) G[a][b] += Z[i][a] * Z[i][b];
  }
  const beta = solveLinear(G, rhs);
  const resid = y.map((yi, i) => {
    let p = 0; for (let a = 0; a < k; a++) p += Z[i][a] * beta[a];
    return yi - p;
  });
  return { beta, resid };
}

// Joint OLS on [1, covariates...]. Constant columns are dropped (equal-length prompts).
// This is the Frisch–Waugh–Lovell residual: the same residual as regressing y on the covariates.
// Double residualization is this regression with two covariates (paper eq. 13), not two ad-hoc passes.
export function residualize(features, covariates) {
  const n = features.length, p = features[0]?.length ?? 0;
  const raw = covariates?.length === n ? covariates : features.map(() => []);
  const c = raw[0]?.length ?? 0;
  const keep = [];
  for (let j = 0; j < c; j++) {
    let m = 0; for (let i = 0; i < n; i++) m += raw[i][j]; m /= n || 1;
    let v = 0; for (let i = 0; i < n; i++) v += (raw[i][j] - m) ** 2;
    if (v > 1e-18) keep.push(j);
  }
  const Z = raw.map((row) => [1, ...keep.map((j) => row[j])]);
  const residuals = Array.from({ length: n }, () => Array(p).fill(0));
  const betas = [];
  for (let j = 0; j < p; j++) {
    const y = features.map((r) => r[j]);
    const fit = n ? ols(y, Z) : { beta: [0], resid: [] };
    betas.push(fit.beta);
    for (let i = 0; i < n; i++) residuals[i][j] = fit.resid[i];
  }
  return { residuals, betas, kept: keep, droppedConstant: c - keep.length };
}

function sigmoid(z) {
  if (z >= 0) { const e = Math.exp(-z); return 1 / (1 + e); }
  const e = Math.exp(z); return e / (1 + e);
}

// ℓ2-regularized logistic on column-standardized features. Intercept is not penalized.
// Not a bit-match of scikit-learn; AUROC on separable synthetic data is the check we ship.
export function logisticFit(X, y, { l2 = 1, iters = 30 } = {}) {
  const n = X.length, p = X[0].length;
  const mean = Array(p).fill(0), scale = Array(p).fill(1);
  for (let j = 0; j < p; j++) {
    for (let i = 0; i < n; i++) mean[j] += X[i][j];
    mean[j] /= n;
    let v = 0; for (let i = 0; i < n; i++) v += (X[i][j] - mean[j]) ** 2;
    scale[j] = Math.sqrt(v / n) || 1;
  }
  const Z = X.map((r) => r.map((v, j) => (v - mean[j]) / scale[j]));
  const w = Array(p + 1).fill(0);
  for (let it = 0; it < iters; it++) {
    const k = p + 1;
    const G = Array.from({ length: k }, () => Array(k).fill(0));
    const rhs = Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      let eta = w[0]; for (let j = 0; j < p; j++) eta += w[j + 1] * Z[i][j];
      const pi = Math.min(1 - 1e-8, Math.max(1e-8, sigmoid(eta)));
      const wi = Math.max(1e-8, pi * (1 - pi));
      const zi = eta + (y[i] - pi) / wi;
      const xi = [1, ...Z[i]];
      for (let a = 0; a < k; a++) {
        rhs[a] += wi * xi[a] * zi;
        for (let b = 0; b < k; b++) G[a][b] += wi * xi[a] * xi[b];
      }
    }
    for (let j = 1; j < k; j++) G[j][j] += l2;
    const nw = solveLinear(G, rhs);
    let diff = 0;
    for (let j = 0; j < k; j++) { diff += (nw[j] - w[j]) ** 2; w[j] = nw[j]; }
    if (diff < 1e-14) break;
  }
  return {
    predictProba(row) {
      let z = w[0];
      for (let j = 0; j < p; j++) z += w[j + 1] * ((row[j] - mean[j]) / scale[j]);
      return sigmoid(z);
    },
  };
}

// Mann–Whitney AUROC. Ties count as 0.5. Returns NaN if a class is missing.
export function auroc(scores, labels) {
  const pos = [], neg = [];
  for (let i = 0; i < scores.length; i++) (labels[i] ? pos : neg).push(scores[i]);
  if (!pos.length || !neg.length) return NaN;
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

export function evalAUROC(X, y) {
  const model = logisticFit(X, y);
  return auroc(X.map((r) => model.predictProba(r)), y);
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

// Add-one permutation p: (1 + #{perm ≥ observed}) / (B + 1). The paper reports the raw fraction
// with B = 1000 (their eq. 15). p_paper is that fraction. Decisions in this lab use `p` so a
// small permutation budget cannot print p = 0.
export function permutationAUROC(X, y, { nPerm = 200, seed = 1 } = {}) {
  const obs = evalAUROC(X, y);
  const rng = mulberry32(seed >>> 0);
  let ge = 0;
  for (let b = 0; b < nPerm; b++) {
    const yp = shuffle(y, rng);
    if (new Set(yp).size < 2) continue;
    const a = evalAUROC(X, yp);
    if (a >= obs - 1e-12) ge++;
  }
  return { auroc: obs, p: (1 + ge) / (nPerm + 1), p_paper: ge / nPerm, nPerm, ge };
}

// Train on every prompt but one, score the held-out prompt, pool the scores.
export function lopoAUROC(X, y, groups) {
  const ids = [...new Set(groups)];
  if (ids.length < 3) return { auroc: null, n: 0, reason: 'need at least 3 prompts' };
  const scores = Array(X.length).fill(null);
  for (const g of ids) {
    const tr = [], te = [];
    groups.forEach((id, i) => (id === g ? te : tr).push(i));
    const ytr = tr.map((i) => y[i]);
    if (new Set(ytr).size < 2) continue;
    const model = logisticFit(tr.map((i) => X[i]), ytr);
    for (const i of te) scores[i] = model.predictProba(X[i]);
  }
  const keep = scores.map((s, i) => (s == null ? -1 : i)).filter((i) => i >= 0);
  if (new Set(keep.map((i) => y[i])).size < 2) return { auroc: null, n: keep.length, reason: 'held-out fold had one class' };
  return { auroc: auroc(keep.map((i) => scores[i]), keep.map((i) => y[i])), n: keep.length, reason: null };
}

export function geometryVerdict(delta, encoding) {
  const encChance = Number.isFinite(encoding.auroc) && encoding.p > 0.05;
  const signal = Number.isFinite(delta.auroc) && delta.auroc > 0.5 && delta.p < 0.05;
  let label = 'null';
  if (!encChance) label = 'leakage';
  else if (signal) label = 'above-chance';
  const text = label === 'leakage'
    ? 'Encoding-phase features already separate the conditions, so this run does not support a generation-phase claim. Check system-prompt length and wording.'
    : label === 'above-chance'
      ? 'Delta features beat the pre-registered permutation bar, and the encoding phase was not distinguishable from chance. This is not a reproduction of the paper’s large-model AUROC.'
      : 'Null. After equal-length prompts and FWL, delta features were not above the permutation bar. That is a valid result at this scale.';
  return { label, text, encoding_near_chance: encChance, delta_above_chance: label === 'above-chance' };
}

export function syntheticSelfTest() {
  const sepX = [], sepY = [];
  for (let i = 0; i < 20; i++) { sepX.push([i < 10 ? -2 : 2, 0]); sepY.push(i < 10 ? 0 : 1); }
  const tieX = [], tieY = [];
  for (let i = 0; i < 10; i++) { const row = [i / 10, 1 - i / 10]; tieX.push(row, row.slice()); tieY.push(0, 1); }
  return {
    separableAuroc: evalAUROC(sepX, sepY),
    tiedAuroc: evalAUROC(tieX, tieY),
    note: 'Synthetic matrices, not a model. Separable geometry should land near 1 and tied geometry near 0.5.',
  };
}

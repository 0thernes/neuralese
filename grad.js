// Analytic reverse-mode autodiff for GPT-Neo (TinyStories-8M family): full-sequence forward with stored activations,
// exact backward for every op (embeddings, LayerNorm, unscaled causal/local attention, GELU-tanh MLP, tied unembedding).
// Computes gradients w.r.t. activations at every hook site and (optionally) every weight. Runtime interventions are NOT
// applied here: gradients describe the current weight set M with the default forward pass.
import { CFG } from './model.js?v=8';
export const dims = (W) => W.cfg || CFG;
const GC = 0.7978845608028654, GA = 0.044715;
const gelu = (x) => 0.5 * x * (1 + Math.tanh(GC * (x + GA * x * x * x)));
const dgelu = (x) => { const t = Math.tanh(GC * (x + GA * x * x * x)); return 0.5 * (1 + t) + 0.5 * x * (1 - t * t) * GC * (1 + 3 * GA * x * x); };
// y[T×nOut] = X[T×nIn] · Wᵀ (+b);  W stored row-major [nOut][nIn]
function mm(X, T, W, nOut, nIn, b) { const Y = new Float32Array(T * nOut); for (let t = 0; t < T; t++) { const xo = t * nIn, yo = t * nOut; for (let o = 0; o < nOut; o++) { let s = b ? b[o] : 0; const wo = o * nIn; for (let i = 0; i < nIn; i++) s += W[wo + i] * X[xo + i]; Y[yo + o] = s; } } return Y; }
// dX[T×nIn] += dY[T×nOut] · W
function mmT(dY, T, W, nOut, nIn, dX) { for (let t = 0; t < T; t++) { const yo = t * nOut, xo = t * nIn; for (let o = 0; o < nOut; o++) { const g = dY[yo + o]; if (!g) continue; const wo = o * nIn; for (let i = 0; i < nIn; i++) dX[xo + i] += g * W[wo + i]; } } return dX; }
// dW[nOut×nIn] += dYᵀ X ; db += Σ dY
function outer(dY, X, T, nOut, nIn, dW, db) { for (let t = 0; t < T; t++) { const yo = t * nOut, xo = t * nIn; for (let o = 0; o < nOut; o++) { const g = dY[yo + o]; if (!g) continue; if (db) db[o] += g; const wo = o * nIn; for (let i = 0; i < nIn; i++) dW[wo + i] += g * X[xo + i]; } } }
function lnF(X, T, w, b) { const d = w.length; const Y = new Float32Array(T * d), XH = new Float32Array(T * d), RS = new Float32Array(T);
  for (let t = 0; t < T; t++) { const o = t * d; let m = 0; for (let i = 0; i < d; i++) m += X[o + i]; m /= d; let v = 0; for (let i = 0; i < d; i++) { const q = X[o + i] - m; v += q * q; } v /= d; const r = 1 / Math.sqrt(v + CFG.eps); RS[t] = r;
    for (let i = 0; i < d; i++) { const xh = (X[o + i] - m) * r; XH[o + i] = xh; Y[o + i] = xh * w[i] + b[i]; } } return { Y, XH, RS }; }
function lnB(dY, c, T, w, dX, dw, db) { const d = w.length; for (let t = 0; t < T; t++) { const o = t * d, r = c.RS[t]; let s1 = 0, s2 = 0; const dxh = new Float32Array(d);
  for (let i = 0; i < d; i++) { const g = dY[o + i]; if (dw) { dw[i] += g * c.XH[o + i]; db[i] += g; } dxh[i] = g * w[i]; s1 += dxh[i]; s2 += dxh[i] * c.XH[o + i]; }
  s1 /= d; s2 /= d; for (let i = 0; i < d; i++) dX[o + i] += r * (dxh[i] - s1 - c.XH[o + i] * s2); } }
const zerosLike = (W) => ({ wte: new Float32Array(W.wte.length), wpe: new Float32Array(W.wpe.length), lnfW: new Float32Array(W.lnfW.length), lnfB: new Float32Array(W.lnfB.length), layers: W.layers.map((P) => Object.fromEntries(Object.entries(P).map(([k, a]) => [k, new Float32Array(a.length)]))) });

// Forward over a whole sequence. o.x0: optional override of the input embeddings (T×d) — used by integrated gradients.
// o.patch(site, l, X): optional in-place edit of activations (site ∈ resid_pre, z, attn_out, mlp_act, mlp_out) — used by AtP validation.
export function forward(W, ids, o = {}) { const { d, H, hd, ff, V } = dims(W);
  const T = ids.length, L = W.layers.length, A = { T, ids, layers: [] };
  let X = new Float32Array(T * d);
  if (o.x0) X.set(o.x0); else for (let t = 0; t < T; t++) for (let i = 0; i < d; i++) X[t * d + i] = W.wte[ids[t] * d + i] + W.wpe[t * d + i];
  A.x0 = X.slice();
  for (let l = 0; l < L; l++) {
    const P = W.layers[l], C = {}; if (o.patch) o.patch('resid_pre', l, X); C.xin = X.slice();
    C.ln1 = lnF(X, T, P.ln1w, P.ln1b); C.q = mm(C.ln1.Y, T, P.q, d, d); C.k = mm(C.ln1.Y, T, P.k, d, d); C.v = mm(C.ln1.Y, T, P.v, d, d);
    const win = l % 2 ? CFG.window : 1e9; C.att = new Float32Array(H * T * T); const Z = new Float32Array(T * d);
    for (let h = 0; h < H; h++) { const off = h * hd; for (let t = 0; t < T; t++) { const lo = Math.max(0, t + 1 - win), row = (h * T + t) * T; let mx = -Infinity;
      for (let j = lo; j <= t; j++) { let s = 0; for (let i = 0; i < hd; i++) s += C.q[t * d + off + i] * C.k[j * d + off + i]; C.att[row + j] = s; if (s > mx) mx = s; }
      let sum = 0; for (let j = lo; j <= t; j++) { const e = Math.exp(C.att[row + j] - mx); C.att[row + j] = e; sum += e; }
      for (let j = lo; j <= t; j++) { const a = (C.att[row + j] /= sum); for (let i = 0; i < hd; i++) Z[t * d + off + i] += a * C.v[j * d + off + i]; } } }
    if (o.patch) o.patch('z', l, Z); C.z = Z;
    const AO = mm(Z, T, P.o, d, d, P.ob); if (o.patch) o.patch('attn_out', l, AO); for (let i = 0; i < X.length; i++) X[i] += AO[i];
    C.xmid = X.slice(); C.ln2 = lnF(X, T, P.ln2w, P.ln2b); C.pre = mm(C.ln2.Y, T, P.fc, ff, d, P.fcb);
    const Aa = new Float32Array(T * ff); for (let i = 0; i < Aa.length; i++) Aa[i] = gelu(C.pre[i]); if (o.patch) o.patch('mlp_act', l, Aa); C.act = Aa;
    const MO = mm(Aa, T, P.proj, d, ff, P.projb); if (o.patch) o.patch('mlp_out', l, MO); for (let i = 0; i < X.length; i++) X[i] += MO[i];
    A.layers.push(C);
  }
  A.xf = X; A.lnf = lnF(X, T, W.lnfW, W.lnfB); A.hf = A.lnf.Y; return A;
}
export function logitsAt(W, A, t) { const { d, H, hd, ff, V } = dims(W); const out = new Float32Array(V), h = A.hf; for (let v = 0; v < V; v++) { let s = 0; const o = v * d; for (let i = 0; i < d; i++) s += W.wte[o + i] * h[t * d + i]; out[v] = s; } return out; }
const logSm = (l) => { let m = -Infinity; for (const x of l) if (x > m) m = x; let s = 0; for (const x of l) s += Math.exp(x - m); const z = m + Math.log(s); return l.map((x) => x - z); };

// Objectives → dL/dlogits per position. 'ce': mean next-token cross-entropy over positions 0..T-2 (or o.positions).
// {kind:'logitdiff', a, b, t}: metric = logit[a]−logit[b] at position t (gradient of the metric, ascent direction).
export function objective(W, A, obj = { kind: 'ce' }) { const { d, H, hd, ff, V } = dims(W);
  const T = A.T, seeds = new Map(); let value = 0;
  if (obj.kind === 'ce') { const pos = obj.positions || [...Array(T - 1).keys()]; for (const t of pos) { const lp = logSm(logitsAt(W, A, t)), y = A.ids[t + 1]; value -= lp[y] / pos.length; const g = lp.map(Math.exp); g[y] -= 1; for (let i = 0; i < V; i++) g[i] /= pos.length; seeds.set(t, g); } }
  else if (obj.kind === 'logitdiff') { const t = obj.t ?? T - 1, l = logitsAt(W, A, t); value = l[obj.a] - l[obj.b]; const g = new Float32Array(V); g[obj.a] += 1; g[obj.b] -= 1; seeds.set(t, g); }
  else if (obj.kind === 'logprob') { const t = obj.t ?? T - 1, lp = logSm(logitsAt(W, A, t)); value = lp[obj.a]; const g = lp.map((x) => -Math.exp(x)); g[obj.a] += 1; seeds.set(t, g); }
  else throw new Error('unknown objective ' + obj.kind);
  return { value, seeds };
}
// Backward. Returns activation gradients per layer (same keys as forward caches) and optionally weight gradients.
export function backward(W, A, seeds, o = {}) { const { d, H, hd, ff, V } = dims(W);
  const T = A.T, L = W.layers.length, G = o.weights ? zerosLike(W) : null, act = [];
  const dHf = new Float32Array(T * d);
  for (const [t, g] of seeds) { for (let v = 0; v < V; v++) { const gv = g[v]; if (!gv) continue; const wo = v * d; for (let i = 0; i < d; i++) dHf[t * d + i] += gv * W.wte[wo + i]; if (G && o.unembed) for (let i = 0; i < d; i++) G.wte[wo + i] += gv * A.hf[t * d + i]; } }
  const dX = new Float32Array(T * d); lnB(dHf, A.lnf, T, W.lnfW, dX, G && G.lnfW, G && G.lnfB);
  for (let l = L - 1; l >= 0; l--) {
    const P = W.layers[l], C = A.layers[l], gP = G && G.layers[l], R = { resid_post: dX.slice() };
    // MLP
    R.mlp_out = dX.slice(); const dA = mmT(dX, T, P.proj, d, ff, new Float32Array(T * ff)); if (gP) outer(dX, C.act, T, d, ff, gP.proj, gP.projb); R.mlp_act = dA;
    const dPre = new Float32Array(T * ff); for (let i = 0; i < dPre.length; i++) dPre[i] = dA[i] * dgelu(C.pre[i]); R.mlp_pre = dPre;
    if (gP) outer(dPre, C.ln2.Y, T, ff, d, gP.fc, gP.fcb); const dH2 = mmT(dPre, T, P.fc, ff, d, new Float32Array(T * d));
    lnB(dH2, C.ln2, T, P.ln2w, dX, gP && gP.ln2w, gP && gP.ln2b); R.resid_mid = dX.slice();
    // attention
    R.attn_out = dX.slice(); if (gP) outer(dX, C.z, T, d, d, gP.o, gP.ob); const dZ = mmT(dX, T, P.o, d, d, new Float32Array(T * d)); R.z = dZ;
    const dQ = new Float32Array(T * d), dK = new Float32Array(T * d), dV = new Float32Array(T * d), win = l % 2 ? CFG.window : 1e9;
    for (let h = 0; h < H; h++) { const off = h * hd; for (let t = 0; t < T; t++) { const lo = Math.max(0, t + 1 - win), row = (h * T + t) * T; let dot = 0; const dAt = new Float32Array(t + 1);
      for (let j = lo; j <= t; j++) { let s = 0; for (let i = 0; i < hd; i++) s += dZ[t * d + off + i] * C.v[j * d + off + i]; dAt[j] = s; const a = C.att[row + j]; dot += a * s; for (let i = 0; i < hd; i++) dV[j * d + off + i] += a * dZ[t * d + off + i]; }
      for (let j = lo; j <= t; j++) { const ds = C.att[row + j] * (dAt[j] - dot); if (!ds) continue; for (let i = 0; i < hd; i++) { dQ[t * d + off + i] += ds * C.k[j * d + off + i]; dK[j * d + off + i] += ds * C.q[t * d + off + i]; } } } }
    R.q = dQ; R.k = dK; R.v = dV;
    if (gP) { outer(dQ, C.ln1.Y, T, d, d, gP.q); outer(dK, C.ln1.Y, T, d, d, gP.k); outer(dV, C.ln1.Y, T, d, d, gP.v); }
    const dH1 = new Float32Array(T * d); mmT(dQ, T, P.q, d, d, dH1); mmT(dK, T, P.k, d, d, dH1); mmT(dV, T, P.v, d, d, dH1);
    lnB(dH1, C.ln1, T, P.ln1w, dX, gP && gP.ln1w, gP && gP.ln1b); R.resid_pre = dX.slice(); act[l] = R;
  }
  if (G) for (let t = 0; t < T; t++) for (let i = 0; i < d; i++) { G.wte[A.ids[t] * d + i] += dX[t * d + i]; G.wpe[t * d + i] += dX[t * d + i]; }
  return { act, dx0: dX, G };
}
export function grad(W, ids, obj = { kind: 'ce' }, o = {}) { const A = forward(W, ids, o); const { value, seeds } = objective(W, A, obj); const B = backward(W, A, seeds, o); return { value, A, ...B }; }

// ── attribution methods ──
// gradient × input on the input embeddings: per-token Σ_i x_i ∂m/∂x_i
export function gradXInput(W, ids, obj) { const { d, H, hd, ff, V } = dims(W); const r = grad(W, ids, obj); const out = []; for (let t = 0; t < ids.length; t++) { let s = 0; for (let i = 0; i < d; i++) s += r.A.x0[t * d + i] * r.dx0[t * d + i]; out.push(s); } return { value: r.value, scores: out }; }
// integrated gradients from baseline x' = position embedding only (token removed), Riemann midpoint with m steps.
// Completeness check: Σ scores ≈ m(x) − m(x').
export function integratedGradients(W, ids, obj, m = 16) { const { d, H, hd, ff, V } = dims(W);
  const T = ids.length, x = forward(W, ids).x0, base = new Float32Array(T * d); for (let t = 0; t < T; t++) for (let i = 0; i < d; i++) base[t * d + i] = W.wpe[t * d + i];
  const tot = new Float32Array(T * d); for (let s = 0; s < m; s++) { const a = (s + 0.5) / m, xs = new Float32Array(T * d); for (let i = 0; i < xs.length; i++) xs[i] = base[i] + a * (x[i] - base[i]); const r = grad(W, ids, obj, { x0: xs }); for (let i = 0; i < tot.length; i++) tot[i] += r.dx0[i] / m; }
  const scores = []; for (let t = 0; t < T; t++) { let s = 0; for (let i = 0; i < d; i++) s += (x[t * d + i] - base[t * d + i]) * tot[t * d + i]; scores.push(s); }
  const fx = objective(W, forward(W, ids), obj).value, fb = objective(W, forward(W, ids, { x0: base }), obj).value;
  return { scores, sum: scores.reduce((a, b) => a + b, 0), delta: fx - fb, fx, fb };
}
// Attribution patching (Nanda 2023): Δm(patch head h of layer l from corrupt into clean) ≈ (z_corr − z_clean)_h · ∂m/∂z_h, summed over positions.
// Prompts must have equal length. Returns L×H estimates.
export function attributionPatching(W, clean, corr, obj) { const { d, H, hd, ff, V } = dims(W);
  if (clean.length !== corr.length) throw new Error('clean and corrupted prompts must have the same token length');
  const r = grad(W, clean, obj), Ac = forward(W, corr), T = clean.length, est = [];
  for (let l = 0; l < W.layers.length; l++) { const row = []; for (let h = 0; h < H; h++) { let s = 0; for (let t = 0; t < T; t++) for (let i = h * hd; i < h * hd + hd; i++) s += (Ac.layers[l].z[t * d + i] - r.A.layers[l].z[t * d + i]) * r.act[l].z[t * d + i]; row.push(s); } est.push(row); }
  return { est, clean: r.value, corrupt: objective(W, Ac, obj).value };
}
// Ground truth for AtP: actually patch each head's z (all positions) from the corrupted run and re-measure.
export function activationPatchingHeads(W, clean, corr, obj) { const { d, H, hd, ff, V } = dims(W);
  const Ac = forward(W, corr), base = objective(W, forward(W, clean), obj).value, out = [];
  for (let l = 0; l < W.layers.length; l++) { const row = []; for (let h = 0; h < H; h++) { const A = forward(W, clean, { patch: (site, ll, X) => { if (site === 'z' && ll === l) for (let t = 0; t < clean.length; t++) for (let i = h * hd; i < h * hd + hd; i++) X[t * d + i] = Ac.layers[l].z[t * d + i]; } }); row.push(objective(W, A, obj).value - base); } out.push(row); }
  return out;
}
// Empirical Fisher diagonal (mean squared per-sequence CE gradient) and saliency |θ·g| per matrix, over a set of docs.
export function fisherDiag(W, docs, maxT = 48, onp = () => {}) {
  const F = zerosLike(W), S = zerosLike(W); let n = 0;
  for (const doc of docs) { const r = grad(W, doc.slice(0, maxT), { kind: 'ce' }, { weights: true }); n++;
    const acc = (g, f, s, w) => { for (let i = 0; i < g.length; i++) { f[i] += g[i] * g[i]; s[i] += g[i] * w[i]; } };
    r.G.layers.forEach((P, l) => { for (const k in P) acc(P[k], F.layers[l][k], S.layers[l][k], W.layers[l][k]); }); acc(r.G.lnfW, F.lnfW, S.lnfW, W.lnfW); onp(n / docs.length); }
  const fin = (a) => { for (let i = 0; i < a.length; i++) a[i] /= n; };
  F.layers.forEach((P, l) => { for (const k in P) { fin(P[k]); fin(S.layers[l][k]); } }); fin(F.lnfW); fin(S.lnfW);
  return { F, S, n };
}
// Hessian-vector product of the CE loss w.r.t. one matrix along direction v (same shape), central finite difference of exact gradients.
export function hvp(W, ids, l, key, v, eps = 1e-3) {
  const a = W.layers[l][key], orig = a.slice(), g = (s) => { for (let i = 0; i < a.length; i++) a[i] = orig[i] + s * eps * v[i]; const r = grad(W, ids, { kind: 'ce' }, { weights: true }); return r.G.layers[l][key]; };
  try { const gp = g(1), gm = g(-1); const out = new Float32Array(a.length); for (let i = 0; i < a.length; i++) out[i] = (gp[i] - gm[i]) / (2 * eps); return out; } finally { a.set(orig); }
}
// Top Hessian eigenvalue of one matrix block by power iteration on HVPs.
export function topHessianEig(W, ids, l, key, iters = 6, seed = 1) {
  const n = W.layers[l][key].length; let v = new Float32Array(n), r = seed; for (let i = 0; i < n; i++) { r = (r * 16807) % 2147483647; v[i] = r / 2147483647 - 0.5; }
  const norm = (x) => Math.sqrt(x.reduce((s, y) => s + y * y, 0)); let nv = norm(v); v = v.map((x) => x / nv); let lam = 0;
  for (let k = 0; k < iters; k++) { const hv = hvp(W, ids, l, key, v); lam = hv.reduce((s, y, i) => s + y * v[i], 0); nv = norm(hv) || 1; v = hv.map((x) => x / nv); }
  return { lambda: lam, v };
}
export const _test = { gelu, dgelu, mm, lnF };

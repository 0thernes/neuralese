// v11 consciousness-science PROXIES (operational definitions only — see docs/FRONTIER.md for what they cannot show).
// P1 perturbational complexity (PCI-analog, Casali et al. 2013), P2 ignition (global-workspace proxy, Dehaene & Changeux 2011),
// P3a injection detection (after Lindsey 2025/2026), P3b self-prediction (Binder et al. 2024 cross-prediction).
import { forward, logitsAt, rng, gauss, pciNorm, lse, mean } from './core.js?v=12';
const dimOf = (W) => W.lnfW.length;
const residPost = (A, l) => (l + 1 < A.layers.length ? A.layers[l + 1].xin : A.xf);
const norm = (X, o, d) => { let s = 0; for (let i = 0; i < d; i++) s += X[o + i] ** 2; return Math.sqrt(s); };
// P1: returns the PCI of one perturbation (random unit direction, seed) of `ids` at layer 0, position t0.
export function pci(W, ids, seed, t0 = 8, base = null) { const d = dimOf(W), T = ids.length, L = W.layers.length, A = base || forward(W, ids), r = rng(seed);
  const u = Array.from({ length: d }, () => gauss(r)), un = Math.hypot(...u), sc = norm(A.x0, t0 * d, d) / un;
  const B = forward(W, ids, { patch: (site, l, X) => { if (site === 'resid_pre' && l === 0) for (let i = 0; i < d; i++) X[t0 * d + i] += sc * u[i]; } });
  const bits = []; let ones = 0;
  for (let l = 0; l < L; l++) { const a = residPost(A, l), b = residPost(B, l); let ss = 0; for (let i = 0; i < a.length; i++) ss += a[i] * a[i]; const th = 0.1 * Math.sqrt(ss / a.length);
    for (let t = t0; t < T; t++) for (let i = 0; i < d; i++) { const v = Math.abs(b[t * d + i] - a[t * d + i]) > th ? 1 : 0; bits.push(v); ones += v; } }
  return { pci: pciNorm(bits), active: ones / bits.length }; }
export const ALPHAS = Array.from({ length: 16 }, (_, i) => 0.05 * Math.pow(400, i / 15));
// P2: response curve (Δ log-prob of the concept token at the last position) to injection α·‖x‖·û at layer 0, position t0.
export function ignitionCurve(W, ids, tok, t0 = 4) { const d = dimOf(W), T = ids.length, A0 = forward(W, ids), nx = norm(A0.x0, t0 * d, d), e = W.wte.subarray(tok * d, tok * d + d), ne = norm(e, 0, d);
  const lp = (A) => { const l = logitsAt(W, A, T - 1); return l[tok] - lse(l); }, base = lp(A0);
  return ALPHAS.map((a) => { const B = forward(W, ids, { patch: (site, l, X) => { if (site === 'resid_pre' && l === 0) for (let i = 0; i < d; i++) X[t0 * d + i] += a * nx * e[i] / ne; } }); return lp(B) - base; }); }
// Hill fit by grid search: R(α) = Rmax αⁿ/(αⁿ + Kⁿ), Rmax = max response. Returns n, K and R² of the fit.
export function hill(xs, ys) { const Rm = Math.max(...ys); if (!(Rm > 0)) return null; let best = null;
  for (let ni = 0; ni <= 60; ni++) { const n = 0.25 * Math.pow(32, ni / 60); for (let ki = 0; ki <= 60; ki++) { const K = xs[0] * Math.pow(xs[xs.length - 1] / xs[0], ki / 60); let sse = 0; for (let i = 0; i < xs.length; i++) { const f = Rm * xs[i] ** n / (xs[i] ** n + K ** n); sse += (f - ys[i]) ** 2; } if (!best || sse < best.sse) best = { n, K, sse }; } }
  const m = mean(ys), sst = ys.reduce((s, y) => s + (y - m) ** 2, 0); return { n: best.n, K: best.K, Rmax: Rm, r2: 1 - best.sse / sst }; }
// P3a: feature vector read at the last position of layer `lr` resid_post, with optional concept injection at (li, ti).
export function injectFeature(W, ids, tok, li = 2, ti = 6, lr = 6) { const d = dimOf(W);
  const A = forward(W, ids, { patch: (site, l, X) => { if (tok == null || site !== 'resid_pre' || l !== li) return; const e = W.wte.subarray(tok * d, tok * d + d), ne = norm(e, 0, d), nx = norm(X, ti * d, d); for (let i = 0; i < d; i++) X[ti * d + i] += nx * e[i] / ne; } });
  return Array.from(residPost(A, lr).subarray((ids.length - 1) * d, ids.length * d)); }
export function logistic(X, y, lam = 1e-2, iters = 600, lr = 0.5) { const n = X.length, d = X[0].length, mu = new Array(d).fill(0), sg = new Array(d).fill(0);
  for (const x of X) for (let i = 0; i < d; i++) mu[i] += x[i] / n; for (const x of X) for (let i = 0; i < d; i++) sg[i] += (x[i] - mu[i]) ** 2 / n; for (let i = 0; i < d; i++) sg[i] = Math.sqrt(sg[i]) || 1;
  const Z = X.map((x) => x.map((v, i) => (v - mu[i]) / sg[i])), npos = y.filter(Boolean).length, wpos = n / (2 * npos), wneg = n / (2 * (n - npos)); const w = new Array(d).fill(0); let b = 0;
  for (let it = 0; it < iters; it++) { const g = new Array(d).fill(0); let gb = 0; for (let k = 0; k < n; k++) { let s = b; for (let i = 0; i < d; i++) s += w[i] * Z[k][i]; const p = 1 / (1 + Math.exp(-s)), e = (p - y[k]) * (y[k] ? wpos : wneg) / n; gb += e; for (let i = 0; i < d; i++) g[i] += e * Z[k][i]; } for (let i = 0; i < d; i++) w[i] -= lr * (g[i] + lam * w[i]); b -= lr * gb; }
  return (x) => { let s = b; for (let i = 0; i < d; i++) s += w[i] * (x[i] - mu[i]) / sg[i]; return s; }; }
export function auc(scores, y) { const pos = scores.filter((_, i) => y[i]), neg = scores.filter((_, i) => !y[i]); let s = 0; for (const p of pos) for (const q of neg) s += p > q ? 1 : p === q ? 0.5 : 0; return s / (pos.length * neg.length); }
// Ridge regression (closed form via Cholesky on the d×d normal equations), standardised features.
export function ridge(X, y, lam) { const n = X.length, d = X[0].length, mu = new Array(d).fill(0); for (const x of X) for (let i = 0; i < d; i++) mu[i] += x[i] / n; const my = mean(y);
  const Ap = new Float64Array(d * d), bv = new Float64Array(d); for (let k = 0; k < n; k++) { const x = X[k]; for (let i = 0; i < d; i++) { const xi = x[i] - mu[i]; bv[i] += xi * (y[k] - my); for (let j = 0; j <= i; j++) Ap[i * d + j] += xi * (x[j] - mu[j]); } }
  for (let i = 0; i < d; i++) { Ap[i * d + i] += lam * n; for (let j = 0; j < i; j++) Ap[j * d + i] = Ap[i * d + j]; }
  for (let i = 0; i < d; i++) { for (let j = 0; j <= i; j++) { let s = Ap[i * d + j]; for (let k = 0; k < j; k++) s -= Ap[i * d + k] * Ap[j * d + k]; Ap[i * d + j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / Ap[j * d + j]; } }
  const z = new Float64Array(d); for (let i = 0; i < d; i++) { let s = bv[i]; for (let k = 0; k < i; k++) s -= Ap[i * d + k] * z[k]; z[i] = s / Ap[i * d + i]; }
  const w = new Float64Array(d); for (let i = d - 1; i >= 0; i--) { let s = z[i]; for (let k = i + 1; k < d; k++) s -= Ap[k * d + i] * w[k]; w[i] = s / Ap[i * d + i]; }
  return (x) => { let s = my; for (let i = 0; i < d; i++) s += w[i] * (x[i] - mu[i]); return s; }; }
export const r2 = (yh, y) => { const m = mean(y); let a = 0, b = 0; for (let i = 0; i < y.length; i++) { a += (y[i] - yh[i]) ** 2; b += (y[i] - m) ** 2; } return 1 - a / b; };
export { residPost };

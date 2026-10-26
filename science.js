// Quantitative analyses for NEURALESE v6. Every function is deterministic given a seed and documented with its definition.
import { CFG } from './model.js?v=10';
import { svd } from './linalg.js?v=10';
import { forward, logitsAt, dims } from './grad.js?v=10';
export function rng(seed = 1) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

// ── moments / spectra ──
// mean, std, skew, excess kurtosis, sparsity (|w|<thr·std), L1/L2/L∞; for matrices also σ-spectrum based metrics.
export function moments(a, thr = 0.01) {
  const n = a.length; let m = 0, l1 = 0, mx = 0; for (let i = 0; i < n; i++) { m += a[i]; l1 += Math.abs(a[i]); mx = Math.max(mx, Math.abs(a[i])); } m /= n;
  let m2 = 0, m3 = 0, m4 = 0; for (let i = 0; i < n; i++) { const q = a[i] - m, q2 = q * q; m2 += q2; m3 += q2 * q; m4 += q2 * q2; } m2 /= n; m3 /= n; m4 /= n;
  const std = Math.sqrt(m2); let sp = 0; const t = thr * std; for (let i = 0; i < n; i++) if (Math.abs(a[i]) < t) sp++;
  return { n, mean: m, std, skew: m3 / (std ** 3 || 1), kurt: m4 / (m2 * m2 || 1) - 3, sparsity: sp / n, l1, l2: Math.sqrt(m2 * n + m * m * n), linf: mx };
}
export function spectral(a, rows, cols) {
  const S = Array.from(svd(a, rows, cols).S), s2 = S.map((x) => x * x), tot = s2.reduce((x, y) => x + y, 0), sum = S.reduce((x, y) => x + y, 0);
  const p = S.map((x) => x / sum); const H_ = -p.reduce((acc, x) => acc + (x > 0 ? x * Math.log(x) : 0), 0);
  const smin = S[S.length - 1], tail = s2.slice(0, Math.max(2, Math.floor(s2.length / 2))), lmin = tail[tail.length - 1];
  const alpha = 1 + tail.length / tail.reduce((acc, l) => acc + Math.log(l / lmin), 0);   // Hill/MLE power-law exponent of ESD tail (top 50% of λ=σ²)
  return { S, frob: Math.sqrt(tot), spec: S[0], nuclear: sum, effRank: Math.exp(H_), stableRank: tot / (S[0] * S[0]), cond: smin > 0 ? S[0] / smin : Infinity, alpha };
}
// ── bootstrap CI (percentile) for the mean of per-item values or any statistic ──
export function bootstrap(xs, stat = (v) => v.reduce((a, b) => a + b, 0) / v.length, B = 1000, seed = 7) {
  const r = rng(seed), n = xs.length, out = []; for (let b = 0; b < B; b++) { const s = new Array(n); for (let i = 0; i < n; i++) s[i] = xs[Math.floor(r() * n)]; out.push(stat(s)); }
  out.sort((a, b) => a - b); return { est: stat(xs), lo: out[Math.floor(0.025 * B)], hi: out[Math.floor(0.975 * B)], B };
}
// ── general real eigenvalues (Hessenberg + shifted QR, EISPACK hqr) for small n×n row-major ──
export function eig(Ain, n) {
  const a = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Ain[i * n + j]));
  for (let m = 1; m < n - 1; m++) { let x = 0, i = m; for (let j = m; j < n; j++) if (Math.abs(a[j][m - 1]) > Math.abs(x)) { x = a[j][m - 1]; i = j; }
    if (i !== m) { for (let j = m - 1; j < n; j++) [a[i][j], a[m][j]] = [a[m][j], a[i][j]]; for (let j = 0; j < n; j++) [a[j][i], a[j][m]] = [a[j][m], a[j][i]]; }
    if (x) for (i = m + 1; i < n; i++) { let y = a[i][m - 1]; if (y) { y /= x; a[i][m - 1] = y; for (let j = m; j < n; j++) a[i][j] -= y * a[m][j]; for (let j = 0; j < n; j++) a[j][m] += y * a[j][i]; } } }
  for (let i = 2; i < n; i++) for (let j = 0; j < i - 1; j++) a[i][j] = 0;
  const wr = new Array(n).fill(0), wi = new Array(n).fill(0); let nn = n - 1, t = 0, anorm = 0; for (let i = 0; i < n; i++) for (let j = Math.max(i - 1, 0); j < n; j++) anorm += Math.abs(a[i][j]);
  let p = 0, q = 0, r = 0, s, w, x, y, z;
  while (nn >= 0) { let its = 0, l;
    do { for (l = nn; l >= 1; l--) { s = Math.abs(a[l - 1][l - 1]) + Math.abs(a[l][l]); if (s === 0) s = anorm; if (Math.abs(a[l][l - 1]) + s === s) { a[l][l - 1] = 0; break; } }
      x = a[nn][nn];
      if (l === nn) { wr[nn] = x + t; wi[nn--] = 0; }
      else { y = a[nn - 1][nn - 1]; w = a[nn][nn - 1] * a[nn - 1][nn];
        if (l === nn - 1) { p = 0.5 * (y - x); q = p * p + w; z = Math.sqrt(Math.abs(q)); x += t;
          if (q >= 0) { z = p + (p >= 0 ? Math.abs(z) : -Math.abs(z)); wr[nn - 1] = wr[nn] = x + z; if (z) wr[nn] = x - w / z; wi[nn - 1] = wi[nn] = 0; }
          else { wr[nn - 1] = wr[nn] = x + p; wi[nn - 1] = -(wi[nn] = z); } nn -= 2; }
        else { if (its === 60) throw new Error('eig: no convergence');
          if (its === 10 || its === 20) { t += x; for (let i = 0; i <= nn; i++) a[i][i] -= x; s = Math.abs(a[nn][nn - 1]) + Math.abs(a[nn - 1][nn - 2]); y = x = 0.75 * s; w = -0.4375 * s * s; }
          ++its; let m;
          for (m = nn - 2; m >= l; m--) { z = a[m][m]; r = x - z; s = y - z; p = (r * s - w) / a[m + 1][m] + a[m][m + 1]; q = a[m + 1][m + 1] - z - r - s; r = a[m + 2][m + 1]; s = Math.abs(p) + Math.abs(q) + Math.abs(r); p /= s; q /= s; r /= s;
            if (m === l) break; const u = Math.abs(a[m][m - 1]) * (Math.abs(q) + Math.abs(r)), v = Math.abs(p) * (Math.abs(a[m - 1][m - 1]) + Math.abs(z) + Math.abs(a[m + 1][m + 1])); if (u + v === v) break; }
          for (let i = m + 2; i <= nn; i++) { a[i][i - 2] = 0; if (i !== m + 2) a[i][i - 3] = 0; }
          for (let k = m; k <= nn - 1; k++) {
            if (k !== m) { p = a[k][k - 1]; q = a[k + 1][k - 1]; r = 0; if (k !== nn - 1) r = a[k + 2][k - 1]; if ((x = Math.abs(p) + Math.abs(q) + Math.abs(r)) !== 0) { p /= x; q /= x; r /= x; } }
            const sg = Math.sqrt(p * p + q * q + r * r); s = p >= 0 ? sg : -sg;
            if (s !== 0) { if (k === m) { if (l !== m) a[k][k - 1] = -a[k][k - 1]; } else a[k][k - 1] = -s * x;
              p += s; x = p / s; y = q / s; z = r / s; q /= p; r /= p;
              for (let j = k; j <= nn; j++) { p = a[k][j] + q * a[k + 1][j]; if (k !== nn - 1) { p += r * a[k + 2][j]; a[k + 2][j] -= p * z; } a[k + 1][j] -= p * y; a[k][j] -= p * x; }
              const mmin = nn < k + 3 ? nn : k + 3;
              for (let i = l; i <= mmin; i++) { p = x * a[i][k] + y * a[i][k + 1]; if (k !== nn - 1) { p += z * a[i][k + 2]; a[i][k + 2] -= p * r; } a[i][k + 1] -= p * q; a[i][k] -= p; } } } } }
    } while (l < nn - 1);
  }
  return wr.map((re, i) => [re, wi[i]]);
}
// ── head circuits ──
const Vh = (P, h, d, hd) => { const o = new Float64Array(hd * d); for (let r = 0; r < hd; r++) for (let c = 0; c < d; c++) o[r * d + c] = P.v[(h * hd + r) * d + c]; return o; };
const Qh = (P, h, d, hd) => { const o = new Float64Array(hd * d); for (let r = 0; r < hd; r++) for (let c = 0; c < d; c++) o[r * d + c] = P.q[(h * hd + r) * d + c]; return o; };
const Kh = (P, h, d, hd) => { const o = new Float64Array(hd * d); for (let r = 0; r < hd; r++) for (let c = 0; c < d; c++) o[r * d + c] = P.k[(h * hd + r) * d + c]; return o; };
const Oh = (P, h, d, hd) => { const o = new Float64Array(d * hd); for (let r = 0; r < d; r++) for (let c = 0; c < hd; c++) o[r * hd + c] = P.o[r * d + h * hd + c]; return o; };
function mul(A, B, n, k, m) { const C = new Float64Array(n * m); for (let i = 0; i < n; i++) for (let p = 0; p < k; p++) { const a = A[i * k + p]; if (!a) continue; for (let j = 0; j < m; j++) C[i * m + j] += a * B[p * m + j]; } return C; }
const tr = (A, n, m) => { const T = new Float64Array(n * m); for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) T[j * n + i] = A[i * m + j]; return T; };
const trace = (A, n) => { let s = 0; for (let i = 0; i < n; i++) s += A[i * n + i]; return s; };
// Embedding Gram E = W_Eᵀ W_E (d×d) over all V tokens (tied unembedding ⇒ W_U = W_E). Raw embeddings, LayerNorm ignored (standard approximation).
export function embedGram(W) { const { d, H, hd, ff, V } = dims(W); const E = new Float64Array(d * d); for (let t = 0; t < V; t++) { const o = t * d; for (let i = 0; i < d; i++) { const a = W.wte[o + i]; if (!a) continue; for (let j = i; j < d; j++) E[i * d + j] += a * W.wte[o + j]; } } for (let i = 0; i < d; i++) for (let j = 0; j < i; j++) E[i * d + j] = E[j * d + i]; return E; }
// OV copying score (Elhage et al. 2021): Σλ / Σ|λ| of the full OV circuit W_U O_h V_h W_E; nonzero spectrum = eig(V_h E O_h) (hd×hd).
// QK "same-token" score: same for W_Eᵀ Q_hᵀ K_h W_E → eig(K_h E Q_hᵀ).
export function headEigenScores(W, E = embedGram(W)) { const { d, H, hd, ff, V } = dims(W);
  const out = [];
  for (let l = 0; l < W.layers.length; l++) { const P = W.layers[l], row = [];
    for (let h = 0; h < H; h++) { const V_ = Vh(P, h, d, hd), O_ = Oh(P, h, d, hd), Q_ = Qh(P, h, d, hd), K_ = Kh(P, h, d, hd);
      const ov = mul(mul(V_, E, hd, d, d), O_, hd, d, hd), qk = mul(mul(K_, E, hd, d, d), tr(Q_, hd, d), hd, d, hd);
      const sc = (M) => { const ev = eig(M, hd), s = ev.reduce((a, [re]) => a + re, 0), ab = ev.reduce((a, [re, im]) => a + Math.hypot(re, im), 0); return { score: s / (ab || 1), eig: ev }; };
      const a = sc(ov), b = sc(qk); row.push({ ov: a.score, qk: b.score, ovEig: a.eig, qkEig: b.eig, ovTrace: trace(ov, hd) }); }
    out.push(row); }
  return out;
}
// Composition scores between head h1 in layer l1 and h2 in a later layer (Elhage et al.): ‖M₂ · OV₁‖_F / (‖M₂‖_F ‖OV₁‖_F).
// Q: M₂ = (Q₂ᵀK₂)ᵀ, K: M₂ = Q₂ᵀK₂, V: M₂ = OV₂. All computed through hd×hd traces; LayerNorm ignored.
export function compositionScores(W) { const { d, H, hd, ff, V } = dims(W);
  const L = W.layers.length, F = []; for (let l = 0; l < L; l++) for (let h = 0; h < H; h++) { const P = W.layers[l]; F.push({ l, h, Q: Qh(P, h, d, hd), K: Kh(P, h, d, hd), V: Vh(P, h, d, hd), O: Oh(P, h, d, hd) }); }
  const G = (A, n, k) => mul(A, tr(A, n, k), n, k, n);    // A Aᵀ
  const pre = F.map((f) => { const VVt = G(f.V, hd, d), OtO = mul(tr(f.O, d, hd), f.O, hd, d, hd), QQt = G(f.Q, hd, d), KKt = G(f.K, hd, d);
    return { ...f, VVt, OtO, QQt, KKt, ovN: Math.sqrt(Math.max(0, trace(mul(OtO, VVt, hd, hd, hd), hd))), qkN: Math.sqrt(Math.max(0, trace(mul(QQt, KKt, hd, hd, hd), hd))) }; });
  const res = { Q: [], K: [], V: [] };
  // explicit (clear) implementation
  for (let i = 0; i < pre.length; i++) for (let j = 0; j < pre.length; j++) { const a = pre[i], b = pre[j]; if (b.l <= a.l) continue;
    // ‖X O₁ V₁‖² = tr((O₁ᵀ XᵀX O₁)(V₁V₁ᵀ))
    const nrm = (XtX) => Math.sqrt(Math.max(0, trace(mul(mul(tr(a.O, d, hd), mul(XtX, a.O, d, d, hd), hd, d, hd), a.VVt, hd, hd, hd), hd)));
    // Q-comp: X = Kᵀ Q ⇒ XᵀX = Qᵀ K Kᵀ Q ; K-comp: X = Qᵀ K ⇒ XᵀX = Kᵀ Q Qᵀ K ; V-comp: X = O₂V₂ ⇒ XᵀX = V₂ᵀ O₂ᵀO₂ V₂
    const qx = mul(mul(tr(b.Q, hd, d), b.KKt, d, hd, hd), b.Q, d, hd, d), kx = mul(mul(tr(b.K, hd, d), b.QQt, d, hd, hd), b.K, d, hd, d), vx = mul(mul(tr(b.V, hd, d), b.OtO, d, hd, hd), b.V, d, hd, d);
    const den = a.ovN; res.Q.push({ from: [a.l, a.h], to: [b.l, b.h], s: nrm(qx) / (den * b.qkN || 1) }); res.K.push({ from: [a.l, a.h], to: [b.l, b.h], s: nrm(kx) / (den * b.qkN || 1) });
    const ov2 = Math.sqrt(Math.max(0, trace(mul(b.OtO, b.VVt, hd, hd, hd), hd))); res.V.push({ from: [a.l, a.h], to: [b.l, b.h], s: nrm(vx) / (den * ov2 || 1) }); }
  // Baseline: expected score for random matrices of the same shapes (≈ sqrt(rank/d)-ish); report mean for context.
  for (const k of ['Q', 'K', 'V']) res[k].sort((x, y) => y.s - x.s);
  return res;
}
// ── induction / previous-token detection on repeated random token sequences ──
export function inductionScores(W, { n = 20, reps = 4, seed = 3 } = {}) { const { d, H, hd, ff, V } = dims(W);
  const r = rng(seed), L = W.layers.length, per = Array.from({ length: L }, () => Array.from({ length: H }, () => ({ ind: [], prev: [] })));
  for (let k = 0; k < reps; k++) { const half = Array.from({ length: n }, () => 1000 + Math.floor(r() * 20000)), ids = [50256, ...half, ...half], T = ids.length, A = forward(W, ids);
    for (let l = 0; l < L; l++) for (let h = 0; h < H; h++) { let si = 0, sp = 0, c = 0; const att = A.layers[l].att;
      for (let t = n + 1; t < T; t++) { const row = (h * T + t) * T; si += att[row + t - n + 1]; sp += att[row + t - 1]; c++; }
      per[l][h].ind.push(si / c); per[l][h].prev.push(sp / c); } }
  return per.map((row) => row.map((x) => ({ ind: bootstrap(x.ind, undefined, 400), prev: bootstrap(x.prev, undefined, 400) })));
}
// ── representation geometry on residual streams ──
export function residuals(W, docs, maxT = 48) { const { d, H, hd, ff, V } = dims(W); const L = W.layers.length, reps = Array.from({ length: L + 1 }, () => []);
  for (const ids of docs) { const A = forward(W, ids.slice(0, maxT)), T = A.T; for (let l = 0; l <= L; l++) { const X = l < L ? A.layers[l].xin : A.xf; for (let t = 1; t < T; t++) reps[l].push(X.slice(t * d, t * d + d)); } }
  return reps; }
// linear CKA (Kornblith 2019) between n×d representations: ‖YᵀX‖² / (‖XᵀX‖ ‖YᵀY‖) after centering
export function cka(X, Y) { const d = X[0].length, n = X.length, c = (Z) => { const m = new Float64Array(d); for (const z of Z) for (let i = 0; i < d; i++) m[i] += z[i] / n; return Z.map((z) => z.map((v, i) => v - m[i])); };
  const Xc = c(X), Yc = c(Y), cross = (A, B) => { const M = new Float64Array(d * d); for (let k = 0; k < n; k++) { const a = A[k], b = B[k]; for (let i = 0; i < d; i++) { const ai = a[i]; for (let j = 0; j < d; j++) M[i * d + j] += ai * b[j]; } } let s = 0; for (const v of M) s += v * v; return s; };
  return cross(Yc, Xc) / Math.sqrt(cross(Xc, Xc) * cross(Yc, Yc)); }
// TwoNN intrinsic dimension (Facco 2017): MLE d = N / Σ log(r2/r1)
export function twoNN(X) { const d = X[0].length, n = X.length; let s = 0, c = 0; for (let i = 0; i < n; i++) { let r1 = Infinity, r2 = Infinity; for (let j = 0; j < n; j++) { if (i === j) continue; let q = 0; for (let k = 0; k < d; k++) { const t = X[i][k] - X[j][k]; q += t * t; } if (q < r1) { r2 = r1; r1 = q; } else if (q < r2) r2 = q; } if (r1 > 0 && isFinite(r2)) { s += 0.5 * Math.log(r2 / r1); c++; } } return c / s; }
// anisotropy: mean cosine similarity between distinct token representations (Ethayarajh 2019) + participation ratio of covariance
export function anisotropy(X, pairs = 2000, seed = 5) { const d = X[0].length, r = rng(seed), n = X.length; let s = 0; const cos = (a, b) => { let p = 0, x = 0, y = 0; for (let k = 0; k < d; k++) { p += a[k] * b[k]; x += a[k] * a[k]; y += b[k] * b[k]; } return p / Math.sqrt(x * y); };
  const vals = []; for (let k = 0; k < pairs; k++) { const i = Math.floor(r() * n); let j = Math.floor(r() * n); if (j === i) j = (j + 1) % n; vals.push(cos(X[i], X[j])); s += vals[vals.length - 1]; } return bootstrap(vals, undefined, 300); }
// logit lens KL(final ‖ lens_l) averaged over positions, per layer l=0..L (l=L is 0 by construction)
export function logitLensKL(W, docs, maxT = 32) { const { d, H, hd, ff, V } = dims(W); const L = W.layers.length, kl = Array.from({ length: L + 1 }, () => []);
  const lsm = (x) => { let m = -Infinity; for (const v of x) if (v > m) m = v; let s = 0; for (const v of x) s += Math.exp(v - m); const z = m + Math.log(s); return x.map((v) => v - z); };
  const lnU = (x) => { let m = 0; for (const v of x) m += v; m /= d; let vv = 0; for (const v of x) vv += (v - m) ** 2; const r = 1 / Math.sqrt(vv / d + CFG.eps); return x.map((v, i) => (v - m) * r * W.lnfW[i] + W.lnfB[i]); };
  const un = (h) => { const o = new Float32Array(V); for (let v = 0; v < V; v++) { let s = 0; for (let i = 0; i < d; i++) s += W.wte[v * d + i] * h[i]; o[v] = s; } return o; };
  for (const ids of docs) { const A = forward(W, ids.slice(0, maxT)), T = A.T; for (let t = 0; t < T; t += 3) { const pf = lsm(logitsAt(W, A, t)); for (let l = 0; l <= L; l++) { const X = l < L ? A.layers[l].xin : A.xf, ql = lsm(un(lnU(X.slice(t * d, t * d + d)))); let s = 0; for (let v = 0; v < V; v++) s += Math.exp(pf[v]) * (pf[v] - ql[v]); kl[l].push(s); } } }
  return kl.map((v) => bootstrap(v, undefined, 300)); }
// ── loss landscape: L(θ + αu + βv) on one matrix (or 'all' layer matrices) along filter-normalized random or top-SVD directions ──
export function lossSlice(W, docs, { mats = [[7, 'fc']], dir = 'random', n = 9, span = 1, twoD = false, seed = 11, maxT = 24 } = {}) {
  const r = rng(seed), mk = () => mats.map(([l, k]) => { const a = W.layers[l][k], u = new Float32Array(a.length); if (dir === 'svd' && (k in { q: 1, k: 1, v: 1, o: 1, fc: 1, proj: 1 })) return null; for (let i = 0; i < u.length; i++) u[i] = gauss(r); let nu = 0, na = 0; for (let i = 0; i < u.length; i++) { nu += u[i] ** 2; na += a[i] ** 2; } const s = Math.sqrt(na / nu); for (let i = 0; i < u.length; i++) u[i] *= s; return u; });
  let U = mk(), Vd = twoD ? mk() : null;
  if (dir === 'svd') { const sv = mats.map(([l, k]) => { const { d, ff } = dims(W), a = W.layers[l][k], [rows, cols] = k === 'fc' ? [ff, d] : k === 'proj' ? [d, ff] : [d, d], R = svd(a, rows, cols); const rank1 = (j) => { const u = new Float32Array(a.length); for (let i = 0; i < rows; i++) for (let c = 0; c < cols; c++) u[i * cols + c] = R.U[j][i] * R.V[j][c] * R.S[0]; return u; }; return [rank1(0), rank1(1)]; }); U = sv.map((x) => x[0]); Vd = twoD ? sv.map((x) => x[1]) : null; }
  const orig = mats.map(([l, k]) => W.layers[l][k].slice()); const loss = () => { let s = 0; for (const ids of docs) { const A = forward(W, ids.slice(0, maxT)); const T = A.T; for (let t = 0; t < T - 1; t++) { const lg = logitsAt(W, A, t); let m = -Infinity; for (const x of lg) if (x > m) m = x; let z = 0; for (const x of lg) z += Math.exp(x - m); s += (m + Math.log(z) - lg[ids[t + 1]]) / (T - 1) / docs.length; } } return s; };
  const grid = [], ax = Array.from({ length: n }, (_, i) => -span + (2 * span * i) / (n - 1));
  try { for (const b of twoD ? ax : [0]) { const row = []; for (const a of ax) { mats.forEach(([l, k], m) => { const w = W.layers[l][k], o = orig[m]; for (let i = 0; i < w.length; i++) w[i] = o[i] + a * U[m][i] + (Vd ? b * Vd[m][i] : 0); }); row.push(loss()); } grid.push(row); } }
  finally { mats.forEach(([l, k], m) => W.layers[l][k].set(orig[m])); }
  return { ax, grid, twoD, dir, mats };
}
// ── superposition / interference geometry of neuron write directions (proj columns, ff=1024 in d=256) ──
// Feature dimensionality D_i = ‖w_i‖² / Σ_j (ŵ_i·w_j)²  (Elhage 2022 "Toy models"), interference = |cos(w_i,w_j)| distribution.
export function superposition(W, l) { const { d, H, hd, ff, V } = dims(W); const P = W.layers[l], n = ff, cols = Array.from({ length: n }, (_, j) => { const v = new Float64Array(d); for (let i = 0; i < d; i++) v[i] = P.proj[i * n + j]; return v; });
  const nr = cols.map((v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0))); const D = new Float64Array(n), hist = new Array(20).fill(0); let maxCos = 0, sumCos = 0, cnt = 0;
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) { let p = 0; for (let k = 0; k < d; k++) p += cols[i][k] * cols[j][k]; s += (p / (nr[i] || 1)) ** 2; if (j > i) { const c = Math.abs(p / (nr[i] * nr[j] || 1)); hist[Math.min(19, Math.floor(c * 20))]++; sumCos += c; cnt++; if (c > maxCos) maxCos = c; } } D[i] = nr[i] ** 2 / (s || 1); }
  const dimsPerFeature = Array.from(D).reduce((a, b) => a + b, 0); return { D, hist, meanAbsCos: sumCos / cnt, maxCos, sumD: dimsPerFeature, randomBaselineCos: Math.sqrt(2 / (Math.PI * d)) };
}

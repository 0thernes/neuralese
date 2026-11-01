// Small dense linear algebra kit (Float64, row-major unless noted).
// Cholesky solve of SPD system A X = B. A: n×n, B: n×m. Returns X (n×m).
export function cholSolve(A, n, B, m) {
  const Lm = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i * n + j]; for (let k = 0; k < j; k++) s -= Lm[i * n + k] * Lm[j * n + k];
    if (i === j) { if (s <= 0) s = 1e-12; Lm[i * n + i] = Math.sqrt(s); } else Lm[i * n + j] = s / Lm[j * n + j];
  }
  const X = new Float64Array(n * m);
  for (let c = 0; c < m; c++) {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) { let s = B[i * m + c]; for (let k = 0; k < i; k++) s -= Lm[i * n + k] * y[k]; y[i] = s / Lm[i * n + i]; }
    for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= Lm[k * n + i] * X[k * m + c]; X[i * m + c] = s / Lm[i * n + i]; }
  }
  return X;
}

// One-sided Jacobi SVD (Hestenes). A: rows×cols row-major (Float32/64). Returns {U (rows×r col-major cols), S, Vt (r×cols)} with r=min.
// Internally works on the orientation with rows >= cols.
export function svd(A, rows, cols, { tol = 1e-10, maxSweeps = 30 } = {}) {
  const tr = rows < cols; const m = tr ? cols : rows, n = tr ? rows : cols;
  const Ucol = Array.from({ length: n }, () => new Float64Array(m));
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const v = A[i * cols + j]; if (tr) Ucol[i][j] = v; else Ucol[j][i] = v; }
  const Vcol = Array.from({ length: n }, (_, j) => { const v = new Float64Array(n); v[j] = 1; return v; });
  let sweeps = 0;
  for (; sweeps < maxSweeps; sweeps++) {
    let off = 0;
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
      const up = Ucol[p], uq = Ucol[q]; let a = 0, b = 0, g = 0;
      for (let i = 0; i < m; i++) { a += up[i] * up[i]; b += uq[i] * uq[i]; g += up[i] * uq[i]; }
      if (Math.abs(g) <= tol * Math.sqrt(a * b) || g === 0) continue;
      off = Math.max(off, Math.abs(g) / Math.sqrt(a * b));
      const zeta = (b - a) / (2 * g), t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta)), c = 1 / Math.sqrt(1 + t * t), s = c * t;
      for (let i = 0; i < m; i++) { const x = up[i], y = uq[i]; up[i] = c * x - s * y; uq[i] = s * x + c * y; }
      const vp = Vcol[p], vq = Vcol[q];
      for (let i = 0; i < n; i++) { const x = vp[i], y = vq[i]; vp[i] = c * x - s * y; vq[i] = s * x + c * y; }
    }
    if (off < tol) break;
  }
  const S = Ucol.map((u) => Math.hypot(...u));
  const order = S.map((_, i) => i).sort((i, j) => S[j] - S[i]);
  const Ss = new Float64Array(n), Us = [], Vs = [];
  order.forEach((k, r) => { Ss[r] = S[k]; const u = Ucol[k], sk = S[k] || 1; Us.push(u.map((x) => x / sk)); Vs.push(Vcol[k]); });
  // A = U S V^T in (m×n) orientation; if transposed, swap roles.
  return tr ? { U: Vs, S: Ss, V: Us, sweeps, rows, cols } : { U: Us, S: Ss, V: Vs, sweeps, rows, cols };
}
// Reconstruct rows×cols from SVD with modified singular values S2.
export function svdReconstruct(R, S2, out) {
  const { U, V, rows, cols } = R; out = out || new Float32Array(rows * cols); out.fill(0);
  for (let k = 0; k < S2.length; k++) { const s = S2[k]; if (!s) continue; const u = U[k], v = V[k];
    for (let i = 0; i < rows; i++) { const us = u[i] * s; if (!us) continue; const o = i * cols; for (let j = 0; j < cols; j++) out[o + j] += us * v[j]; } }
  return out;
}
// Top principal direction of rows of X (n×d) via power iteration on centered covariance (or uncentered if center=false).
export function pca1(X, n, d, { center = true, iters = 100 } = {}) {
  const mu = new Float64Array(d); if (center) { for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) mu[j] += X[i * d + j] / n; }
  let v = new Float64Array(d).map((_, i) => Math.sin(i + 1)); let lam = 0;
  for (let it = 0; it < iters; it++) {
    const w = new Float64Array(d);
    for (let i = 0; i < n; i++) { let p = 0; for (let j = 0; j < d; j++) p += (X[i * d + j] - mu[j]) * v[j]; for (let j = 0; j < d; j++) w[j] += p * (X[i * d + j] - mu[j]); }
    lam = Math.hypot(...w); v = w.map((x) => x / (lam || 1));
  }
  return { v, lambda: lam / n, mu };
}
export const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
export const norm = (a) => Math.sqrt(dot(a, a));
export const cosine = (a, b) => dot(a, b) / (norm(a) * norm(b) || 1);

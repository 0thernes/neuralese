// NEURALESE v14 Neuron Lens: R-lens, S-lens and their mid targets for GPT-Neo (TinyStories-8M).
// Original implementation written from scratch for Neuralese. No code is copied. The method (R/S lenses under RelP rules) is
// prior art from stdlogits/neuron-lens (a9lim & treetown, 2026); it is credited and described in docs/NEURON_LENS_METHOD.md. Choices for GPT-Neo:
//  - LN rule: each LayerNorm holds its rstd constant; the mean subtraction is linear and kept.
//  - identity rule: GELU(g) = g·φ(g) is linearised as φ(g)·dg, φ = 0.5(1+tanh(c(g+0.044715g³))).
//  - attention keeps its true derivative (softmax over q·k; GPT-Neo has no 1/√hd scale, no RoPE, no q/k norm).
//  - SKIP_FIRST = 16: tangents/cotangents live only at valid positions [16, T−1); the primal drops the last token.
//  - R-lens J_L = mean_t Σ_{t'≥t} ∂h_final(t')/∂h_L(t) (h_final = last layer output before ln_f), targets out (L0..L-2) and mid (all L).
//  - S-lens K_L = mean_t Σ_{s≤t} ∂h_L(t)/∂e(s), targets mid and out (all L).
// Matrices are row-major Float32Array; J[l] is d×d with J·v mapping a layer vector to h_final; K[l] is d_res×d_emb.
export const SKIP_FIRST = 16;

// C[M×N] = A[M×K]·B[K×N] (row-major), 4-row unrolled.
export function mm(A, B, C, M, K, N, acc = false) {
  if (!acc) C.fill(0, 0, M * N);
  let i = 0;
  for (; i + 3 < M; i += 4) {
    const c0 = i * N, c1 = c0 + N, c2 = c1 + N, c3 = c2 + N, a0 = i * K, a1 = a0 + K, a2 = a1 + K, a3 = a2 + K;
    for (let k = 0; k < K; k++) {
      const x0 = A[a0 + k], x1 = A[a1 + k], x2 = A[a2 + k], x3 = A[a3 + k]; if (x0 === 0 && x1 === 0 && x2 === 0 && x3 === 0) continue;
      const bk = k * N;
      for (let j = 0; j < N; j++) { const b = B[bk + j]; C[c0 + j] += x0 * b; C[c1 + j] += x1 * b; C[c2 + j] += x2 * b; C[c3 + j] += x3 * b; }
    }
  }
  for (; i < M; i++) { const ci = i * N, ai = i * K; for (let k = 0; k < K; k++) { const a = A[ai + k]; if (a === 0) continue; const bk = k * N; for (let j = 0; j < N; j++) C[ci + j] += a * B[bk + j]; } }
  return C;
}
export function transpose(W, R, Cn) { const T = new Float32Array(R * Cn); for (let i = 0; i < R; i++) for (let j = 0; j < Cn; j++) T[j * R + i] = W[i * Cn + j]; return T; }
const GC = Math.sqrt(2 / Math.PI);
export const phi = (g) => 0.5 * (1 + Math.tanh(GC * (g + 0.044715 * g * g * g)));
export const gelu = (g) => g * phi(g);

// cfg: {d,H,hd,L,ff,V,eps}; W: model.js buildWeights() layout (PyTorch [out][in]).
export function prepare(W, cfg) {
  const { d, ff } = cfg;
  return { cfg, W, layers: W.layers.map((P) => ({ ...P, qT: transpose(P.q, d, d), kT: transpose(P.k, d, d), vT: transpose(P.v, d, d), oT: transpose(P.o, d, d), fcT: transpose(P.fc, ff, d), projT: transpose(P.proj, d, ff) })) };
}

function lnRows(X, T, d, w, b, eps, out, rs) { // LayerNorm each row; rs[t] = rstd
  for (let t = 0; t < T; t++) { const o = t * d; let m = 0; for (let i = 0; i < d; i++) m += X[o + i]; m /= d; let v = 0; for (let i = 0; i < d; i++) { const q = X[o + i] - m; v += q * q; }
    const r = 1 / Math.sqrt(v / d + eps); rs[t] = r; for (let i = 0; i < d; i++) out[o + i] = (X[o + i] - m) * r * w[i] + (b ? b[i] : 0); }
}
function addBias(X, T, n, b) { for (let t = 0; t < T; t++) for (let i = 0; i < n; i++) X[t * n + i] += b[i]; }

// Full-sequence forward. opts.steer = {layer, vec, from, to}: add vec to layer's MLP output at positions [from,to).
// opts.record: keep per-layer constants for the lens maps. Returns {logits?, h (final pre-ln_f), rec, acts}.
export function forward(M, ids, opts = {}) {
  const { d, H, hd, L, ff, eps } = M.cfg, W = M.W, T = ids.length;
  const h = new Float32Array(T * d);
  for (let t = 0; t < T; t++) for (let i = 0; i < d; i++) h[t * d + i] = W.wte[ids[t] * d + i] + W.wpe[t * d + i];
  const x = new Float32Array(T * d), q = new Float32Array(T * d), k = new Float32Array(T * d), v = new Float32Array(T * d), z = new Float32Array(T * d), o = new Float32Array(T * d);
  const u = new Float32Array(T * ff), y = new Float32Array(T * d), rec = [], acts = opts.acts ? [] : null, outs = opts.outs ? [] : null;
  for (let l = 0; l < L; l++) {
    const P = M.layers[l], r1 = new Float32Array(T), r2 = new Float32Array(T);
    lnRows(h, T, d, P.ln1w, P.ln1b, eps, x, r1);
    mm(x, P.qT, q, T, d, d); mm(x, P.kT, k, T, d, d); mm(x, P.vT, v, T, d, d);
    const Pm = new Float32Array(H * T * T); // probs [h][t][s]
    for (let hh = 0; hh < H; hh++) { const off = hh * hd;
      for (let t = 0; t < T; t++) { let mx = -Infinity; const row = Pm.subarray((hh * T + t) * T, (hh * T + t + 1) * T);
        for (let s = 0; s <= t; s++) { let a = 0; for (let e = 0; e < hd; e++) a += q[t * d + off + e] * k[s * d + off + e]; row[s] = a; if (a > mx) mx = a; }
        let Z = 0; for (let s = 0; s <= t; s++) { row[s] = Math.exp(row[s] - mx); Z += row[s]; } for (let s = 0; s <= t; s++) row[s] /= Z;
        for (let e = 0; e < hd; e++) { let a = 0; for (let s = 0; s <= t; s++) a += row[s] * v[s * d + off + e]; z[t * d + off + e] = a; } } }
    if (opts.ablate && opts.ablate[l]) for (const hh of opts.ablate[l]) for (let t = 0; t < T; t++) z.fill(0, t * d + hh * hd, t * d + hh * hd + hd); // zero-ablate heads
    if (opts.zs) opts.zs.push(z.slice());
    mm(z, P.oT, o, T, d, d); addBias(o, T, d, P.ob);
    for (let i = 0; i < T * d; i++) h[i] += o[i];
    const mid = opts.record ? h.slice() : null;
    lnRows(h, T, d, P.ln2w, P.ln2b, eps, x, r2);
    mm(x, P.fcT, u, T, d, ff); addBias(u, T, ff, P.fcb);
    const ph = opts.record ? new Float32Array(T * ff) : null;
    for (let i = 0; i < T * ff; i++) { const g = u[i], p = phi(g); if (ph) ph[i] = p; u[i] = g * p; }
    if (acts) acts.push(u.slice());
    mm(u, P.projT, y, T, ff, d); addBias(y, T, d, P.projb);
    const S = opts.steer; if (S && S.layer === l) for (let t = S.from; t < Math.min(S.to, T); t++) for (let i = 0; i < d; i++) y[t * d + i] += S.vec[i];
    for (let i = 0; i < T * d; i++) h[i] += y[i];
    if (outs) outs.push(h.slice());
    if (opts.record) rec.push({ r1, r2, q: q.slice(), k: k.slice(), v: v.slice(), P: Pm, phi: ph, mid });
  }
  const out = { h, rec, acts, outs };
  if (opts.logits) out.logits = unembed(M, h, T, opts.logitRows);
  return out;
}
// logits for the given rows (positions) of h: ln_f then tied wte. Returns Float32Array[rows.length*V].
export function unembed(M, h, T, rows) {
  const { d, V, eps } = M.cfg, W = M.W; rows = rows || [...Array(T).keys()];
  const xf = new Float32Array(rows.length * d), rs = new Float32Array(rows.length), hr = new Float32Array(rows.length * d);
  rows.forEach((t, i) => hr.set(h.subarray(t * d, t * d + d), i * d)); lnRows(hr, rows.length, d, W.lnfW, W.lnfB, eps, xf, rs);
  if (!M.wteT) M.wteT = transpose(W.wte, V, d);
  return mm(xf, M.wteT, new Float32Array(rows.length * V), rows.length, d, V);
}

// Per-layer linear maps on the valid rows. lin(M, ids) runs the primal on ids[:-1].
export function tapeRelP(M, ids) {
  const T = ids.length - 1; if (T - 1 <= SKIP_FIRST) throw new Error(`${T} tokens leave no valid positions after the first ${SKIP_FIRST}`);
  const f = forward(M, ids.slice(0, T), { record: true });
  return { T, N: T - 1 - SKIP_FIRST, rec: f.rec };
}
function centerScale(X, rows, d, w, rstd, rowPos, out) { // out = (w*r) ⊙ C(X) per row; rowPos(row)→position
  for (let r = 0; r < rows; r++) { const o = r * d, sc = rstd[rowPos(r)]; let m = 0; for (let i = 0; i < d; i++) m += X[o + i]; m /= d; for (let i = 0; i < d; i++) out[o + i] = (X[o + i] - m) * sc * w[i]; }
}
function scaleCenter(X, rows, d, w, rstd, rowPos, out) { // out = C((w*r) ⊙ X) per row (transpose of centerScale)
  for (let r = 0; r < rows; r++) { const o = r * d, sc = rstd[rowPos(r)]; let m = 0; for (let i = 0; i < d; i++) { out[o + i] = X[o + i] * sc * w[i]; m += out[o + i]; } m /= d; for (let i = 0; i < d; i++) out[o + i] -= m; }
}

// Push tangents X ([b][N][d] at valid rows) through layer l; returns {out, mid}.
export function jvp(M, lin, l, X, b) {
  const { d, H, hd, ff } = M.cfg, P = M.layers[l], R = lin.rec[l], N = lin.N, T = lin.T, S = SKIP_FIRST, rows = b * N, pos = (r) => S + (r % N);
  const xn = new Float32Array(rows * d); centerScale(X, rows, d, P.ln1w, R.r1, pos, xn);
  const dq = mm(xn, P.qT, new Float32Array(rows * d), rows, d, d), dk = mm(xn, P.kT, new Float32Array(rows * d), rows, d, d), dv = mm(xn, P.vT, new Float32Array(rows * d), rows, d, d);
  const dz = new Float32Array(rows * d), ds = new Float64Array(T);
  for (let bi = 0; bi < b; bi++) for (let hh = 0; hh < H; hh++) { const off = hh * hd;
    for (let n = 0; n < N; n++) { const t = S + n, rq = (bi * N + n) * d + off, prow = (hh * T + t) * T; let mean = 0;
      for (let s = 0; s <= t; s++) { let a = 0; for (let e = 0; e < hd; e++) a += dq[rq + e] * R.k[s * d + off + e];
        if (s >= S) { const rk = (bi * N + s - S) * d + off; for (let e = 0; e < hd; e++) a += R.q[t * d + off + e] * dk[rk + e]; }
        ds[s] = a; mean += R.P[prow + s] * a; }
      for (let e = 0; e < hd; e++) { let a = 0; for (let s = 0; s <= t; s++) { const p = R.P[prow + s]; a += p * (ds[s] - mean) * R.v[s * d + off + e]; if (s >= S) a += p * dv[(bi * N + s - S) * d + off + e]; } dz[rq + e] = a; } } }
  const mid = mm(dz, P.oT, new Float32Array(rows * d), rows, d, d); for (let i = 0; i < rows * d; i++) mid[i] += X[i];
  centerScale(mid, rows, d, P.ln2w, R.r2, pos, xn);
  const out = mid.slice(), CH = 64, u = new Float32Array(CH * ff);
  for (let r0 = 0; r0 < rows; r0 += CH) { const m = Math.min(CH, rows - r0);
    mm(xn.subarray(r0 * d, (r0 + m) * d), P.fcT, u, m, d, ff);
    for (let r = 0; r < m; r++) { const po = pos(r0 + r) * ff; for (let j = 0; j < ff; j++) u[r * ff + j] *= R.phi[po + j]; }
    mm(u, P.projT, out.subarray(r0 * d, (r0 + m) * d), m, ff, d, true); }
  return { out, mid };
}
// Pull cotangents G ([b][N][d] at a layer's output) back through layer l; returns {inp, mid}.
export function vjp(M, lin, l, G, b) {
  const { d, H, hd, ff } = M.cfg, P = M.layers[l], R = lin.rec[l], N = lin.N, T = lin.T, S = SKIP_FIRST, rows = b * N, pos = (r) => S + (r % N);
  const gm = new Float32Array(rows * d), CH = 64, u = new Float32Array(CH * ff), tmp = new Float32Array(CH * d);
  for (let r0 = 0; r0 < rows; r0 += CH) { const m = Math.min(CH, rows - r0);
    mm(G.subarray(r0 * d, (r0 + m) * d), P.proj, u, m, d, ff);
    for (let r = 0; r < m; r++) { const po = pos(r0 + r) * ff; for (let j = 0; j < ff; j++) u[r * ff + j] *= R.phi[po + j]; }
    mm(u, P.fc, tmp, m, ff, d); scaleCenter(tmp, m, d, P.ln2w, R.r2, (r) => pos(r0 + r), tmp);
    for (let i = 0; i < m * d; i++) gm[r0 * d + i] = G[r0 * d + i] + tmp[i]; }
  const go = mm(gm, P.o, new Float32Array(rows * d), rows, d, d);
  const gq = new Float32Array(rows * d), gk = new Float32Array(rows * d), gv = new Float32Array(rows * d), gs = new Float64Array(T);
  for (let bi = 0; bi < b; bi++) for (let hh = 0; hh < H; hh++) { const off = hh * hd;
    for (let n = 0; n < N; n++) { const t = S + n, rg = (bi * N + n) * d + off, prow = (hh * T + t) * T; let mean = 0;
      for (let s = 0; s <= t; s++) { let a = 0; for (let e = 0; e < hd; e++) a += go[rg + e] * R.v[s * d + off + e]; gs[s] = a; mean += R.P[prow + s] * a; }
      for (let s = 0; s <= t; s++) { const p = R.P[prow + s], g = p * (gs[s] - mean);
        for (let e = 0; e < hd; e++) gq[rg + e] += g * R.k[s * d + off + e];
        if (s >= S) { const rk = (bi * N + s - S) * d + off; for (let e = 0; e < hd; e++) { gk[rk + e] += g * R.q[t * d + off + e]; gv[rk + e] += p * go[rg + e]; } } } } }
  const gx = mm(gq, P.q, new Float32Array(rows * d), rows, d, d); mm(gk, P.k, gx, rows, d, d, true); mm(gv, P.v, gx, rows, d, d, true);
  scaleCenter(gx, rows, d, P.ln1w, R.r1, pos, gx);
  for (let i = 0; i < rows * d; i++) gx[i] += gm[i];
  return { inp: gx, mid: gm };
}
const meanRows = (X, b, N, d) => { const o = new Float64Array(b * d); for (let bi = 0; bi < b; bi++) for (let n = 0; n < N; n++) { const r = (bi * N + n) * d; for (let i = 0; i < d; i++) o[bi * d + i] += X[r + i] / N; } return o; };
function seed(b, N, d, start) { const X = new Float32Array(b * N * d); for (let bi = 0; bi < b; bi++) for (let n = 0; n < N; n++) X[(bi * N + n) * d + start + bi] = 1; return X; }

// One document's R-lens estimate: {out: [L-1] d×d (Float64), mid: [L] d×d}. J[i][j] = ∂h_final_i / ∂h_j.
export function docJacobianR(M, ids, dimBatch = M.cfg.d, onLayer) {
  const { d, L } = M.cfg, lin = tapeRelP(M, ids), N = lin.N;
  const out = Array.from({ length: L - 1 }, () => new Float64Array(d * d)), mid = Array.from({ length: L }, () => new Float64Array(d * d));
  for (let st = 0; st < d; st += dimBatch) { const b = Math.min(dimBatch, d - st); let G = seed(b, N, d, st);
    for (let l = L - 1; l >= 0; l--) { const r = vjp(M, lin, l, G, b); G = r.inp;
      const em = meanRows(r.mid, b, N, d); for (let bi = 0; bi < b; bi++) for (let j = 0; j < d; j++) mid[l][(st + bi) * d + j] += em[bi * d + j];
      if (l > 0) { const eo = meanRows(G, b, N, d); for (let bi = 0; bi < b; bi++) for (let j = 0; j < d; j++) out[l - 1][(st + bi) * d + j] += eo[bi * d + j]; }
      onLayer && onLayer(l); } }
  return { out, mid };
}
// One document's S-lens estimate: {mid: [L], out: [L]} as d_res×d_emb.
export function docJacobianS(M, ids, dimBatch = M.cfg.d, onLayer) {
  const { d, L } = M.cfg, lin = tapeRelP(M, ids), N = lin.N;
  const out = Array.from({ length: L }, () => new Float64Array(d * d)), mid = Array.from({ length: L }, () => new Float64Array(d * d));
  for (let st = 0; st < d; st += dimBatch) { const b = Math.min(dimBatch, d - st); let X = seed(b, N, d, st);
    for (let l = 0; l < L; l++) { const r = jvp(M, lin, l, X, b); X = r.out;
      for (const [acc, est] of [[mid[l], meanRows(r.mid, b, N, d)], [out[l], meanRows(r.out, b, N, d)]]) for (let bi = 0; bi < b; bi++) for (let i = 0; i < d; i++) acc[i * d + st + bi] += est[bi * d + i];
      onLayer && onLayer(l); } }
  return { out, mid };
}

// ---- reads ----
export const matvec = (A, v, d) => { const o = new Float32Array(d); for (let i = 0; i < d; i++) { let s = 0; for (let j = 0; j < d; j++) s += A[i * d + j] * v[j]; o[i] = s; } return o; };
export const matTvec = (A, v, d) => { const o = new Float32Array(d); for (let i = 0; i < d; i++) { const a = v[i]; for (let j = 0; j < d; j++) o[j] += A[i * d + j] * a; } return o; };
// LayerNorm shape without bias: centre, unit rms, ⊙γ (readout.rms_norm_columns, LayerNorm form).
export function lnDir(x, gamma) { const d = x.length; let m = 0; for (const a of x) m += a; m /= d; let v = 0; for (const a of x) v += (a - m) ** 2; const r = 1 / Math.sqrt(v / d + 1e-12); const o = new Float32Array(d); for (let i = 0; i < d; i++) o[i] = (x[i] - m) * r * (gamma ? gamma[i] : 1); return o; }
// R-lens logits of vector w (J=null: logit lens; affine {A,b}: tuned-lens style). Over all V tokens.
export function rRead(M, w, J) { const { d, V } = M.cfg, E = M.W.wte; const t = lnDir(J ? matvec(J, w, d) : w, M.W.lnfW); const o = new Float32Array(V); for (let v = 0; v < V; v++) { let s = 0; const r = v * d; for (let i = 0; i < d; i++) s += E[r + i] * t[i]; o[v] = s; } return o; }
// S-lens scores: token v scores w · K (E_v − ē).
export function sRead(M, w, K) { const { d, V } = M.cfg, E = M.W.wte, eb = embMean(M); const u = matTvec(K, w, d); let c = 0; for (let i = 0; i < d; i++) c += eb[i] * u[i]; const o = new Float32Array(V); for (let v = 0; v < V; v++) { let s = -c; const r = v * d; for (let i = 0; i < d; i++) s += E[r + i] * u[i]; o[v] = s; } return o; }
export function embMean(M) { if (M.ebar) return M.ebar; const { d, V } = M.cfg, E = M.W.wte, o = new Float32Array(d); for (let v = 0; v < V; v++) for (let i = 0; i < d; i++) o[i] += E[v * d + i] / V; return (M.ebar = o); }
export function topK(scores, k, mask, neg = false) { const idx = []; for (let v = 0; v < scores.length; v++) if (!mask || mask[v]) idx.push(v); idx.sort((a, b) => (neg ? scores[a] - scores[b] : scores[b] - scores[a])); return idx.slice(0, k); }
// MLP neuron n of layer l: input direction c = C(γ2 ⊙ W_fc[n]) (residual covector) and write w = W_proj[:, n].
export function neuronDirs(M, l, n) { const { d, ff } = M.cfg, P = M.layers[l]; const c = new Float32Array(d); for (let i = 0; i < d; i++) c[i] = P.ln2w[i] * P.fc[n * d + i]; let m = 0; for (const a of c) m += a; m /= d; for (let i = 0; i < d; i++) c[i] -= m; const w = new Float32Array(d); for (let i = 0; i < d; i++) w[i] = P.proj[i * ff + n]; return { c, w }; }
export function pearson(a, b, mask) { let n = 0, sa = 0, sb = 0; for (let i = 0; i < a.length; i++) if (!mask || mask[i]) { n++; sa += a[i]; sb += b[i]; } const ma = sa / n, mb = sb / n; let c = 0, va = 0, vb = 0; for (let i = 0; i < a.length; i++) if (!mask || mask[i]) { const x = a[i] - ma, y = b[i] - mb; c += x * y; va += x * x; vb += y * y; } return c / Math.sqrt(va * vb || 1); }
export function wilson(k, n, z = 1.96) { if (!n) return [0, 1]; const p = k / n, den = 1 + z * z / n, c = (p + z * z / (2 * n)) / den, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / den; return [Math.max(0, c - h), Math.min(1, c + h)]; }
export function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Unpack lenses.f32 (blocks named "R.out.L0", …) into {R:{out:[],mid:[]}, S:{out:[],mid:[]}}.
export function unpackLenses(f32, man) { const dd = man.d * man.d, Z = { R: { out: [], mid: [] }, S: { out: [], mid: [] } };
  man.blocks.forEach((name, k) => { const [a, b, l] = name.split('.'); Z[a][b][+l.slice(1)] = f32.subarray(k * dd, (k + 1) * dd); }); return Z; }
export function spearman(a, b) { const rk = (x) => { const idx = [...x.keys()].sort((i, j) => x[i] - x[j]), r = new Float64Array(x.length); for (let k = 0; k < idx.length;) { let e = k; while (e + 1 < idx.length && x[idx[e + 1]] === x[idx[k]]) e++; for (let q = k; q <= e; q++) r[idx[q]] = (k + e) / 2; k = e + 1; } return r; }; return pearson(rk(a), rk(b)); }
// Affine least squares (ridge λ) Y ≈ X·A^T + b over rows; returns A (dout×din). Normal equations solved by Cholesky.
export function ridgeLinear(X, Y, n, din, dout, lam = 1e-3) {
  const mx = new Float64Array(din), my = new Float64Array(dout); for (let r = 0; r < n; r++) { for (let i = 0; i < din; i++) mx[i] += X[r * din + i] / n; for (let i = 0; i < dout; i++) my[i] += Y[r * dout + i] / n; }
  const G = new Float64Array(din * din), C = new Float64Array(din * dout);
  for (let r = 0; r < n; r++) for (let i = 0; i < din; i++) { const xi = X[r * din + i] - mx[i]; for (let j = 0; j < din; j++) G[i * din + j] += xi * (X[r * din + j] - mx[j]); for (let j = 0; j < dout; j++) C[i * dout + j] += xi * (Y[r * dout + j] - my[j]); }
  let tr = 0; for (let i = 0; i < din; i++) tr += G[i * din + i]; for (let i = 0; i < din; i++) G[i * din + i] += lam * tr / din;
  const Lc = new Float64Array(din * din); for (let i = 0; i < din; i++) for (let j = 0; j <= i; j++) { let s = G[i * din + j]; for (let k = 0; k < j; k++) s -= Lc[i * din + k] * Lc[j * din + k]; Lc[i * din + j] = i === j ? Math.sqrt(s) : s / Lc[j * din + j]; }
  const A = new Float32Array(dout * din); for (let o = 0; o < dout; o++) { const z = new Float64Array(din); for (let i = 0; i < din; i++) { let s = C[i * dout + o]; for (let k = 0; k < i; k++) s -= Lc[i * din + k] * z[k]; z[i] = s / Lc[i * din + i]; }
    for (let i = din - 1; i >= 0; i--) { let s = z[i]; for (let k = i + 1; k < din; k++) s -= Lc[k * din + i] * A[o * din + k]; A[o * din + i] = s / Lc[i * din + i]; } } return A;
}
// Batched reads over a token subset: rows of vecs (n×d) → n×|tok| scores. J/K null = identity (logit lens / raw embedding read).
export function tokMatT(M, tok, centred) { const { d } = M.cfg, E = M.W.wte, eb = embMean(M), m = tok.length, T = new Float32Array(d * m); tok.forEach((v, k) => { for (let i = 0; i < d; i++) T[i * m + k] = E[v * d + i] - (centred ? eb[i] : 0); }); return T; }
export function readsR(M, vecs, n, J, tok, tokT = tokMatT(M, tok, false)) { const { d } = M.cfg, t = J ? mm(vecs, transpose(J, d, d), new Float32Array(n * d), n, d, d) : Float32Array.from(vecs);
  for (let r = 0; r < n; r++) t.set(lnDir(t.subarray(r * d, r * d + d), M.W.lnfW), r * d); return mm(t, tokT, new Float32Array(n * tok.length), n, d, tok.length); }
export function readsS(M, vecs, n, K, tok, tokT = tokMatT(M, tok, true)) { const { d } = M.cfg, u = K ? mm(vecs, K, new Float32Array(n * d), n, d, d) : vecs; return mm(u, tokT, new Float32Array(n * tok.length), n, d, tok.length); }

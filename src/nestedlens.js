// Neuralese v14.7 — float32-weight forward pass + finite-difference R-lens for the nested char LMs (guest, emulator, baked composite).
// Original Neuralese code. Models come from neuralese-nested (E2): norm-free, ReLU MLP, scaled dot-product attention.
export function loadNested(index, f32) {
  const out = { vocab: index.vocab, models: {} }, view = (e) => ({ a: f32.subarray(e.off, e.off + e.shape.reduce((x, y) => x * y, 1)), shape: e.shape });
  for (const [name, m] of Object.entries(index.models)) { const w = {}; for (const [k, e] of Object.entries(m.w)) w[k] = view(e);
    const mm = { name, cfg: m.cfg, w, dH: m.dH }; for (const h of ['out_h', 'out_g']) if (m[h]) mm[h] = { weight: view(m[h].weight), bias: view(m[h].bias) }; out.models[name] = mm; }
  return out;
}
const mv = (W, x, b, o) => { const [R, C] = W.shape, A = W.a; o = o || new Float64Array(R); for (let i = 0; i < R; i++) { let s = b ? b.a[i] : 0; const r = i * C; for (let j = 0; j < C; j++) s += A[r + j] * x[j]; o[i] = s; } return o; };
// opts: mode (emulator), addOut {layer, vec(d) or full(T*d)} added to a block's output, acts:true (ReLU hidden per layer).
export function forward(m, ids, opts = {}) {
  const { d, L, nh, dh } = m.cfg, w = m.w, T = ids.length, X = new Float64Array(T * d), sc = 1 / Math.sqrt(dh), acts = [], outs = [];
  for (let t = 0; t < T; t++) for (let j = 0; j < d; j++) X[t * d + j] = w['emb.weight'].a[ids[t] * d + j] + w.pos.a[t * d + j] + (opts.mode != null && w['mode.weight'] ? w['mode.weight'].a[opts.mode * d + j] : 0);
  for (let l = 0; l < L; l++) { const P = (k) => w[`blocks.${l}.${k}`], Q = new Float64Array(T * d), K = new Float64Array(T * d), Vv = new Float64Array(T * d);
    for (let t = 0; t < T; t++) { const x = X.subarray(t * d, t * d + d); mv(P('q.weight'), x, null, Q.subarray(t * d, t * d + d)); mv(P('k.weight'), x, null, K.subarray(t * d, t * d + d)); mv(P('v.weight'), x, null, Vv.subarray(t * d, t * d + d)); }
    const dm = P('w1.weight').shape[0], A = opts.acts ? new Float64Array(T * dm) : null, o = new Float64Array(nh * dh), s = new Float64Array(T);
    for (let t = 0; t < T; t++) { o.fill(0);
      for (let h = 0; h < nh; h++) { let mx = -Infinity; for (let u = 0; u <= t; u++) { let a = 0; for (let i = 0; i < dh; i++) a += Q[t * d + h * dh + i] * K[u * d + h * dh + i]; s[u] = a * sc; if (s[u] > mx) mx = s[u]; }
        let Z = 0; for (let u = 0; u <= t; u++) { s[u] = Math.exp(s[u] - mx); Z += s[u]; } for (let u = 0; u <= t; u++) { const p = s[u] / Z; for (let i = 0; i < dh; i++) o[h * dh + i] += p * Vv[u * d + h * dh + i]; } }
      const x1 = X.slice(t * d, t * d + d), ao = mv(P('o.weight'), o); for (let j = 0; j < d; j++) x1[j] += ao[j];
      const hid = mv(P('w1.weight'), x1, P('w1.bias')); for (let i = 0; i < dm; i++) if (hid[i] < 0) hid[i] = 0; if (A) A.set(hid, t * dm);
      const y = mv(P('w2.weight'), hid, P('w2.bias')); for (let j = 0; j < d; j++) X[t * d + j] = x1[j] + y[j]; }
    const S = opts.addOut; if (S && S.layer === l) for (let t = (S.from || 0); t < T; t++) for (let j = 0; j < d; j++) X[t * d + j] += S.full ? S.full[t * d + j] : S.vec[j];
    if (A) acts.push(A); outs.push(X.slice()); }
  return { h: X, acts, outs };
}
export const head = (m, which) => (which && m[which]) || { weight: m.w['out.weight'], bias: m.w['out.bias'] };
export function logSoftmaxRows(m, h, T, hd, from = 0) { const d = m.cfg.d, V = hd.weight.shape[0], out = new Float64Array(V); // mean over rows from..T-1
  for (let t = from; t < T; t++) { const z = mv(hd.weight, h.subarray(t * d, t * d + d), hd.bias); let mx = -Infinity; for (const a of z) mx = Math.max(mx, a); let s = 0; for (const a of z) s += Math.exp(a - mx); const c = mx + Math.log(s); for (let v = 0; v < V; v++) out[v] += (z[v] - c) / (T - from); }
  return out; }
// Finite-difference R-lens from block l's output to the final residual: column i = mean_t' Σ ∂h_final[t']/∂out_l[t] e_i with all positions perturbed together.
export function fdLensR(m, docs, l, { mode, delta = 1e-3, from = 0 } = {}) { const d = m.cfg.d, J = new Float64Array(d * d);
  for (const ids of docs) { const T = ids.length;
    for (let i = 0; i < d; i++) { const e = new Float64Array(d); e[i] = delta; const hp = forward(m, ids, { mode, addOut: { layer: l, vec: e, from } }).h; e[i] = -delta; const hm = forward(m, ids, { mode, addOut: { layer: l, vec: e, from } }).h;
      for (let t = from; t < T; t++) for (let j = 0; j < d; j++) J[j * d + i] += (hp[t * d + j] - hm[t * d + j]) / (2 * delta) / ((T - from) * docs.length); } }
  return J; }
export const matvec = (J, v, d) => { const o = new Float64Array(d); for (let j = 0; j < d; j++) { let s = 0; for (let i = 0; i < d; i++) s += J[j * d + i] * v[i]; o[j] = s; } return o; };
// Token read of a residual-space write w through lens J (null = logit lens) and an output head.
export const read = (m, w, J, hd) => { const d = m.cfg.d, x = J ? matvec(J, w, d) : w; return mv(hd.weight, x); };
export const unitWrite = (m, l, n) => { const W2 = m.w[`blocks.${l}.w2.weight`], [d, dm] = W2.shape, o = new Float64Array(d); for (let j = 0; j < d; j++) o[j] = W2.a[j * dm + n]; return o; };
export const encodeChars = (vocab, s) => [...s].map((c) => Math.max(0, vocab.indexOf(c)));

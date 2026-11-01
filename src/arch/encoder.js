// v16 encoder forwards for the HUB families, written from the HF reference implementations so that hidden states and attention
// patterns are available (the transformers.js ONNX exports the HUB uses for inference expose neither). Weights come from the HF
// safetensors of: ViT (ViTForImageClassification), CLIP vision tower (CLIPModel.vision_model + visual_projection), Whisper encoder.
// All run in float64 activations; checked against HF float64 in test/encoder.test.mjs.
// encode(E, W, input, {attnLayers}) → { hidden: [L+1][N][d] (HF output_hidden_states convention), patterns: {l: [H] Float32Array N*N}, out }
// E = encoderFromHF(config) ; W = mapEncoder(E, tensors) ; input = pixel_values Float32Array [3*S*S] or input_features [mels*3000].
export function encoderFromHF(c) {
  if (c.model_type === 'vit') return { kind: 'vit', d: c.hidden_size, H: c.num_attention_heads, L: c.num_hidden_layers, ff: c.intermediate_size, eps: c.layer_norm_eps, act: c.hidden_act, img: c.image_size, patch: c.patch_size, ch: c.num_channels || 3, labels: c.id2label || null };
  if (c.model_type === 'clip') { const v = c.vision_config; return { kind: 'clip', d: v.hidden_size, H: v.num_attention_heads, L: v.num_hidden_layers, ff: v.intermediate_size, eps: v.layer_norm_eps || 1e-5, act: v.hidden_act || 'quick_gelu', img: v.image_size, patch: v.patch_size, ch: 3, proj: c.projection_dim }; }
  if (c.model_type === 'whisper') return { kind: 'whisper', d: c.d_model, H: c.encoder_attention_heads, L: c.encoder_layers, ff: c.encoder_ffn_dim, eps: 1e-5, act: c.activation_function, mels: c.num_mel_bins, frames: 2 * c.max_source_positions };
  throw new Error('unsupported encoder model_type ' + c.model_type + ' (vit, clip, whisper)');
}
export function mapEncoder(E, T) {
  const g = (k) => { if (!T[k]) throw new Error('missing tensor ' + k); return T[k].data; }, W = { layers: [] };
  if (E.kind === 'vit') { const p = 'vit.'; Object.assign(W, { patchW: g(p + 'embeddings.patch_embeddings.projection.weight'), patchB: g(p + 'embeddings.patch_embeddings.projection.bias'), cls: g(p + 'embeddings.cls_token'), pos: g(p + 'embeddings.position_embeddings'), nfw: g(p + 'layernorm.weight'), nfb: g(p + 'layernorm.bias'), head: T['classifier.weight']?.data, headB: T['classifier.bias']?.data });
    for (let l = 0; l < E.L; l++) { const q = `${p}encoder.layer.${l}.`; W.layers.push({ n1w: g(q + 'layernorm_before.weight'), n1b: g(q + 'layernorm_before.bias'), q: g(q + 'attention.attention.query.weight'), qb: g(q + 'attention.attention.query.bias'), k: g(q + 'attention.attention.key.weight'), kb: g(q + 'attention.attention.key.bias'), v: g(q + 'attention.attention.value.weight'), vb: g(q + 'attention.attention.value.bias'), o: g(q + 'attention.output.dense.weight'), ob: g(q + 'attention.output.dense.bias'), n2w: g(q + 'layernorm_after.weight'), n2b: g(q + 'layernorm_after.bias'), up: g(q + 'intermediate.dense.weight'), upb: g(q + 'intermediate.dense.bias'), down: g(q + 'output.dense.weight'), downb: g(q + 'output.dense.bias') }); } }
  else if (E.kind === 'clip') { const p = 'vision_model.'; Object.assign(W, { patchW: g(p + 'embeddings.patch_embedding.weight'), cls: g(p + 'embeddings.class_embedding'), pos: g(p + 'embeddings.position_embedding.weight'), prew: g(p + 'pre_layrnorm.weight'), preb: g(p + 'pre_layrnorm.bias'), nfw: g(p + 'post_layernorm.weight'), nfb: g(p + 'post_layernorm.bias'), proj: T['visual_projection.weight']?.data });
    for (let l = 0; l < E.L; l++) { const q = `${p}encoder.layers.${l}.`, a = q + 'self_attn.'; W.layers.push({ n1w: g(q + 'layer_norm1.weight'), n1b: g(q + 'layer_norm1.bias'), q: g(a + 'q_proj.weight'), qb: g(a + 'q_proj.bias'), k: g(a + 'k_proj.weight'), kb: g(a + 'k_proj.bias'), v: g(a + 'v_proj.weight'), vb: g(a + 'v_proj.bias'), o: g(a + 'out_proj.weight'), ob: g(a + 'out_proj.bias'), n2w: g(q + 'layer_norm2.weight'), n2b: g(q + 'layer_norm2.bias'), up: g(q + 'mlp.fc1.weight'), upb: g(q + 'mlp.fc1.bias'), down: g(q + 'mlp.fc2.weight'), downb: g(q + 'mlp.fc2.bias') }); } }
  else { const p = T['model.encoder.conv1.weight'] ? 'model.encoder.' : 'encoder.'; Object.assign(W, { c1w: g(p + 'conv1.weight'), c1b: g(p + 'conv1.bias'), c2w: g(p + 'conv2.weight'), c2b: g(p + 'conv2.bias'), pos: g(p + 'embed_positions.weight'), nfw: g(p + 'layer_norm.weight'), nfb: g(p + 'layer_norm.bias') });
    for (let l = 0; l < E.L; l++) { const q = `${p}layers.${l}.`, a = q + 'self_attn.'; W.layers.push({ n1w: g(q + 'self_attn_layer_norm.weight'), n1b: g(q + 'self_attn_layer_norm.bias'), q: g(a + 'q_proj.weight'), qb: g(a + 'q_proj.bias'), k: g(a + 'k_proj.weight'), kb: null, v: g(a + 'v_proj.weight'), vb: g(a + 'v_proj.bias'), o: g(a + 'out_proj.weight'), ob: g(a + 'out_proj.bias'), n2w: g(q + 'final_layer_norm.weight'), n2b: g(q + 'final_layer_norm.bias'), up: g(q + 'fc1.weight'), upb: g(q + 'fc1.bias'), down: g(q + 'fc2.weight'), downb: g(q + 'fc2.bias') }); } }
  return W;
}
// erf to ~1e-15: Taylor series for |x| < 2.5, continued fraction for erfc beyond
export function erf(x) { const ax = Math.abs(x); let r;
  if (ax < 2.5) { let s = ax, t = ax; for (let n = 1; n < 80; n++) { t *= (-ax * ax) / n; const term = t / (2 * n + 1); s += term; if (Math.abs(term) < 1e-17) break; } r = (2 / Math.sqrt(Math.PI)) * s; }
  else { let f = 0; for (let n = 60; n >= 1; n--) f = n / 2 / (ax + f); r = 1 - Math.exp(-ax * ax) / Math.sqrt(Math.PI) / (ax + f); }
  return x < 0 ? -r : r; }
const ACT = { gelu: (x) => 0.5 * x * (1 + erf(x / Math.SQRT2)), quick_gelu: (x) => x / (1 + Math.exp(-1.702 * x)), gelu_new: (x) => 0.5 * x * (1 + Math.tanh(0.7978845608028654 * (x + 0.044715 * x * x * x))) };
// X: [N*nIn] (float64) → [N*nOut]
export function mm(X, N, Wm, nOut, nIn, b) { const O = new Float64Array(N * nOut); for (let n = 0; n < N; n++) { const xo = n * nIn, oo = n * nOut; for (let i = 0; i < nOut; i++) { let s = 0; const r = i * nIn; for (let j = 0; j < nIn; j++) s += Wm[r + j] * X[xo + j]; O[oo + i] = s + (b ? b[i] : 0); } } return O; }
export function lnRows(X, N, d, w, b, eps) { const O = new Float64Array(N * d); for (let n = 0; n < N; n++) { const o = n * d; let m = 0; for (let i = 0; i < d; i++) m += X[o + i]; m /= d; let v = 0; for (let i = 0; i < d; i++) v += (X[o + i] - m) ** 2; v /= d; const r = 1 / Math.sqrt(v + eps); for (let i = 0; i < d; i++) O[o + i] = (X[o + i] - m) * r * w[i] + b[i]; } return O; }
function patchEmbed(E, W, px) { // px: [ch, S, S] → [1+P, d] with CLS + positions
  const S = E.img, p = E.patch, g = S / p, P = g * g, d = E.d, ch = E.ch, X = new Float64Array((P + 1) * d), K = ch * p * p, col = new Float64Array(K);
  for (let gy = 0; gy < g; gy++) for (let gx = 0; gx < g; gx++) { let k = 0; for (let c = 0; c < ch; c++) for (let y = 0; y < p; y++) for (let x = 0; x < p; x++) col[k++] = px[c * S * S + (gy * p + y) * S + gx * p + x];
    const o = (1 + gy * g + gx) * d; for (let i = 0; i < d; i++) { let s = W.patchB ? W.patchB[i] : 0; const r = i * K; for (let j = 0; j < K; j++) s += W.patchW[r + j] * col[j]; X[o + i] = s; } }
  for (let i = 0; i < d; i++) X[i] = W.cls[i]; for (let n = 0; n <= P; n++) for (let i = 0; i < d; i++) X[n * d + i] += W.pos[n * d + i]; return { X, N: P + 1 };
}
function conv1d(x, Cin, Tin, w, b, Cout, k, stride, pad) { const Tout = Math.floor((Tin + 2 * pad - k) / stride) + 1, o = new Float64Array(Cout * Tout);
  for (let co = 0; co < Cout; co++) for (let t = 0; t < Tout; t++) { let s = b[co]; for (let ci = 0; ci < Cin; ci++) for (let j = 0; j < k; j++) { const ti = t * stride - pad + j; if (ti >= 0 && ti < Tin) s += w[(co * Cin + ci) * k + j] * x[ci * Tin + ti]; } o[co * Tout + t] = s; } return { o, Tout }; }
export function encode(E, W, input, opts = {}) {
  const d = E.d, H = E.H, hd = d / H, act = ACT[E.act]; if (!act) throw new Error('activation ' + E.act);
  let X, N;
  if (E.kind === 'whisper') { const T0 = E.frames, gl = ACT.gelu; const c1 = conv1d(input, E.mels, T0, W.c1w, W.c1b, d, 3, 1, 1); for (let i = 0; i < c1.o.length; i++) c1.o[i] = gl(c1.o[i]);
    const c2 = conv1d(c1.o, d, c1.Tout, W.c2w, W.c2b, d, 3, 2, 1); for (let i = 0; i < c2.o.length; i++) c2.o[i] = gl(c2.o[i]); N = c2.Tout; X = new Float64Array(N * d); for (let t = 0; t < N; t++) for (let i = 0; i < d; i++) X[t * d + i] = c2.o[i * N + t] + W.pos[t * d + i]; }
  else { ({ X, N } = patchEmbed(E, W, input)); if (E.kind === 'clip') X = lnRows(X, N, d, W.prew, W.preb, E.eps); }
  const hidden = [X], patterns = {}, want = (l) => (opts.attnLayers === 'all' ? true : (opts.attnLayers || []).includes(l)), scl = 1 / Math.sqrt(hd);
  for (let l = 0; l < E.L; l++) { const P = W.layers[l], h = lnRows(X, N, d, P.n1w, P.n1b, E.eps), Q = mm(h, N, P.q, d, d, P.qb), K = mm(h, N, P.k, d, d, P.kb), V = mm(h, N, P.v, d, d, P.vb), Z = new Float64Array(N * d), pats = want(l) ? [] : null, sc = new Float64Array(N);
    for (let hh = 0; hh < H; hh++) { const o = hh * hd, pm = pats ? new Float32Array(N * N) : null;
      for (let t = 0; t < N; t++) { let mx = -Infinity; for (let s = 0; s < N; s++) { let z = 0; for (let i = 0; i < hd; i++) z += Q[t * d + o + i] * K[s * d + o + i]; sc[s] = z * scl; if (sc[s] > mx) mx = sc[s]; }
        let Zs = 0; for (let s = 0; s < N; s++) { sc[s] = Math.exp(sc[s] - mx); Zs += sc[s]; }
        for (let s = 0; s < N; s++) { const p = sc[s] / Zs; if (pm) pm[t * N + s] = p; for (let i = 0; i < hd; i++) Z[t * d + o + i] += p * V[s * d + o + i]; } }
      if (pats) pats.push(pm); }
    if (pats) patterns[l] = pats;
    const A = mm(Z, N, P.o, d, d, P.ob), R1 = new Float64Array(N * d); for (let i = 0; i < R1.length; i++) R1[i] = X[i] + A[i];
    const u = mm(lnRows(R1, N, d, P.n2w, P.n2b, E.eps), N, P.up, E.ff, d, P.upb); for (let i = 0; i < u.length; i++) u[i] = act(u[i]);
    const m = mm(u, N, P.down, d, E.ff, P.downb); X = new Float64Array(N * d); for (let i = 0; i < X.length; i++) X[i] = R1[i] + m[i]; hidden.push(X); if (opts.onLayer) opts.onLayer(l); }
  if (E.kind === 'whisper') hidden[E.L] = lnRows(X, N, d, W.nfw, W.nfb, E.eps); // HF convention: Whisper's last hidden state is post-layer_norm
  return { hidden, patterns, N };
}
// --- interpretability on encoder states ---
// ViT logit lens: the model's own final LayerNorm + classifier applied to the CLS state after every layer (the last row is the model's real output).
export function vitLens(E, W, hidden) { if (!W.head) throw new Error('no classifier head'); const C = W.head.length / E.d;
  return hidden.map((X) => mm(lnRows(X.subarray(0, E.d), 1, E.d, W.nfw, W.nfb, E.eps), 1, W.head, C, E.d, W.headB)); }
// CLIP: per-layer CLS embedding in the joint space (post_layernorm + visual_projection); the last one is CLIP's image embedding.
export function clipLensEmb(E, W, hidden) { return hidden.map((X) => { const e = mm(lnRows(X.subarray(0, E.d), 1, E.d, W.nfw, W.nfb, E.eps), 1, W.proj, E.proj, E.d); let n = 0; for (const v of e) n += v * v; n = Math.sqrt(n); return e.map((v) => v / n); }); }
// attention rollout (Abnar & Zuidema 2020): mean over heads, add identity, renormalise rows, multiply through layers; row 0 = CLS → patches
export function rollout(patterns, N, layers) { let R = null; for (const l of layers) { const P = patterns[l], A = new Float64Array(N * N); for (const pm of P) for (let i = 0; i < N * N; i++) A[i] += pm[i] / P.length;
  for (let t = 0; t < N; t++) { A[t * N + t] += 1; let s = 0; for (let j = 0; j < N; j++) s += A[t * N + j]; for (let j = 0; j < N; j++) A[t * N + j] /= s; }
  if (!R) R = A; else { const M = new Float64Array(N * N); for (let i = 0; i < N; i++) for (let k = 0; k < N; k++) { const a = A[i * N + k]; if (a) for (let j = 0; j < N; j++) M[i * N + j] += a * R[k * N + j]; } R = M; } } return R; }
// linear probe: ridge-regularised least squares on ±1 labels with a train/test split; returns held-out accuracy and the majority baseline
export function linearProbe(feats, labels, { lambda = 1e-2, trainFrac = 0.5, seed = 1 } = {}) {
  const n = feats.length, d = feats[0].length, idx = [...Array(n).keys()]; let s = seed >>> 0; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const nt = Math.max(2, Math.floor(n * trainFrac)), tr = idx.slice(0, nt), te = idx.slice(nt), D = d + 1, A = new Float64Array(D * D), y = new Float64Array(D), row = (i) => [...feats[i], 1];
  for (const i of tr) { const x = row(i), t = labels[i] ? 1 : -1; for (let a = 0; a < D; a++) { y[a] += x[a] * t; for (let b = 0; b < D; b++) A[a * D + b] += x[a] * x[b]; } } for (let a = 0; a < d; a++) A[a * D + a] += lambda * nt;
  const w = solve(A, y, D), acc = (S) => S.filter((i) => (row(i).reduce((z, v, k) => z + v * w[k], 0) > 0) === !!labels[i]).length / S.length, maj = (S) => { const p = S.filter((i) => labels[i]).length / S.length; return Math.max(p, 1 - p); };
  return { trainAcc: acc(tr), testAcc: te.length ? acc(te) : NaN, testMajority: te.length ? maj(te) : NaN, nTrain: tr.length, nTest: te.length }; }
function solve(A, b, n) { const M = A.slice(), x = b.slice(); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r * n + c]) > Math.abs(M[p * n + c])) p = r;
  if (p !== c) { for (let k = 0; k < n; k++) [M[c * n + k], M[p * n + k]] = [M[p * n + k], M[c * n + k]]; [x[c], x[p]] = [x[p], x[c]]; } const v = M[c * n + c] || 1e-12;
  for (let r = c + 1; r < n; r++) { const f = M[r * n + c] / v; if (f) { for (let k = c; k < n; k++) M[r * n + k] -= f * M[c * n + k]; x[r] -= f * x[c]; } } }
  for (let c = n - 1; c >= 0; c--) { let s = x[c]; for (let k = c + 1; k < n; k++) s -= M[c * n + k] * x[k]; x[c] = s / (M[c * n + c] || 1e-12); } return x; }
// Whisper log-mel front end (port of transformers WhisperFeatureExtractor numpy path): pad/trim to 30 s @16 kHz, centred reflect-padded
// STFT (n_fft 400, hop 160, periodic Hann), power spectrum, Slaney mel filter bank (0–8 kHz), log10(max(·,1e-10)), drop last frame,
// clamp to max−8, (x+4)/4. Checked against HF in test/encoder.test.mjs.
const hzToMel = (f) => (f < 1000 ? (3 * f) / 200 : 15 + (27 * Math.log(f / 1000)) / Math.log(6.4)), melToHz = (m) => (m < 15 ? (200 * m) / 3 : 1000 * Math.exp((Math.log(6.4) * (m - 15)) / 27));
export function melFilters(nMel = 80, nFft = 400, sr = 16000) { const nb = nFft / 2 + 1, fb = new Float64Array(nMel * nb), lo = hzToMel(0), hi = hzToMel(sr / 2), pts = [];
  for (let i = 0; i < nMel + 2; i++) pts.push(melToHz(lo + ((hi - lo) * i) / (nMel + 1)));
  for (let m = 0; m < nMel; m++) { const enorm = 2 / (pts[m + 2] - pts[m]); for (let k = 0; k < nb; k++) { const f = (k * sr) / nFft, up = (f - pts[m]) / (pts[m + 1] - pts[m]), dn = (pts[m + 2] - f) / (pts[m + 2] - pts[m + 1]); fb[m * nb + k] = Math.max(0, Math.min(up, dn)) * enorm; } }
  return fb; }
export function whisperLogMel(audio, { nMel = 80, nFft = 400, hop = 160, n = 480000 } = {}) {
  const x = new Float64Array(n); x.set(audio.length > n ? audio.subarray(0, n) : audio); const pad = nFft / 2, P = new Float64Array(n + 2 * pad);
  for (let i = 0; i < P.length; i++) { let j = i - pad; if (j < 0) j = -j; else if (j >= n) j = 2 * (n - 1) - j; P[i] = x[j]; }
  const nb = nFft / 2 + 1, T = n / hop, win = new Float64Array(nFft), cs = new Float64Array(nFft), sn = new Float64Array(nFft), fb = melFilters(nMel, nFft);
  for (let i = 0; i < nFft; i++) { win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / nFft); cs[i] = Math.cos((2 * Math.PI * i) / nFft); sn[i] = Math.sin((2 * Math.PI * i) / nFft); }
  const out = new Float64Array(nMel * T), fr = new Float64Array(nFft), pw = new Float64Array(nb); let mx = -Infinity;
  for (let t = 0; t < T; t++) { const o = t * hop; for (let i = 0; i < nFft; i++) fr[i] = P[o + i] * win[i];
    for (let k = 0; k < nb; k++) { let re = 0, im = 0; for (let i = 0, idx = 0; i < nFft; i++, idx = (idx + k) % nFft) { re += fr[i] * cs[idx]; im -= fr[i] * sn[idx]; } pw[k] = re * re + im * im; }
    for (let m = 0; m < nMel; m++) { let s = 0; for (let k = 0; k < nb; k++) s += fb[m * nb + k] * pw[k]; const v = Math.log10(Math.max(s, 1e-10)); out[m * T + t] = v; if (v > mx) mx = v; } }
  for (let i = 0; i < out.length; i++) out[i] = (Math.max(out[i], mx - 8) + 4) / 4; return out; }

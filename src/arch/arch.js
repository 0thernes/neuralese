// v16 Arch interface: one decoder-only transformer forward for several HF families, replacing the single hard-wired GPT-Neo config
// for code that goes through it. An Arch is a plain description:
//   { arch, d, H, Hkv, hd, L, ff, V, ctx, eps, norm:'ln'|'rms', pos:'learned'|'rope', ropeTheta, mlp:'gelu'|'swiglu', scale, window(l) }
// derived from a HF config.json (archFromHF), plus a weight mapper (mapWeights) that turns HF tensor names into one unified layout:
//   { wte[V*d], wpe?[ctx*d], nfw, nfb?, lm[V*d], layers:[{ n1w,n1b?, q,qb?, k,kb?, v,vb?, o,ob?, n2w,n2b?, up,upb?, gate?, down,downb? }] }
// (all matrices row-major [out, in]). forward() runs the full sequence in float64 arithmetic and returns logits plus every
// residual-stream state (hidden[0] = embeddings, hidden[l+1] = after block l, the HF output_hidden_states convention) and,
// optionally, attention patterns — the hooks the lens/probe/attention tools use.
// Supported: GPT-Neo (local/global attention, unscaled), GPT-2 (Conv1D, fused c_attn), Llama-style (RoPE, RMSNorm, SwiGLU, GQA;
// covers Llama, SmolLM, Mistral-without-sliding-window, and Qwen2 which adds q/k/v biases). Checked against HF in test/arch.test.mjs.
export const GPT_NEO_8M = { arch: 'gpt_neo', d: 256, H: 16, Hkv: 16, hd: 16, L: 8, ff: 1024, V: 50257, ctx: 2048, eps: 1e-5, norm: 'ln', pos: 'learned', mlp: 'gelu', scale: false, windowSize: 256, attnTypes: ['global', 'local', 'global', 'local', 'global', 'local', 'global', 'local'], tie: true };

export function archFromHF(c) {
  const t = c.model_type;
  if (t === 'gpt_neo') { const types = []; for (const [pat, n] of c.attention_layers ? [[c.attention_layers, 1]] : c.attention_types) for (let i = 0; i < n; i++) types.push(...pat);
    return { arch: t, d: c.hidden_size, H: c.num_heads, Hkv: c.num_heads, hd: c.hidden_size / c.num_heads, L: c.num_layers, ff: c.intermediate_size || 4 * c.hidden_size, V: c.vocab_size, ctx: c.max_position_embeddings, eps: c.layer_norm_epsilon, norm: 'ln', pos: 'learned', mlp: 'gelu', scale: false, windowSize: c.window_size, attnTypes: types.slice(0, c.num_layers), tie: true }; }
  if (t === 'gpt2') return { arch: t, d: c.n_embd, H: c.n_head, Hkv: c.n_head, hd: c.n_embd / c.n_head, L: c.n_layer, ff: c.n_inner || 4 * c.n_embd, V: c.vocab_size, ctx: c.n_positions, eps: c.layer_norm_epsilon, norm: 'ln', pos: 'learned', mlp: 'gelu', scale: true, tie: true };
  if (t === 'llama' || t === 'qwen2' || t === 'mistral') {
    if (c.rope_scaling && c.rope_scaling.rope_type && c.rope_scaling.rope_type !== 'default') throw new Error('rope_scaling ' + c.rope_scaling.rope_type + ' not implemented');
    if (t === 'mistral' && c.sliding_window) throw new Error('mistral sliding window not implemented');
    const H = c.num_attention_heads, hd = c.head_dim || c.hidden_size / H;
    return { arch: t, d: c.hidden_size, H, Hkv: c.num_key_value_heads || H, hd, L: c.num_hidden_layers, ff: c.intermediate_size, V: c.vocab_size, ctx: c.max_position_embeddings, eps: c.rms_norm_eps, norm: 'rms', pos: 'rope', ropeTheta: c.rope_theta || 10000, mlp: 'swiglu', scale: true, qkvBias: t === 'qwen2' || !!c.attention_bias, tie: !!c.tie_word_embeddings };
  }
  throw new Error('unsupported model_type ' + t + ' (supported: gpt_neo, gpt2, llama, qwen2, mistral)');
}
export const windowOf = (A, l) => (A.arch === 'gpt_neo' && A.attnTypes[l] === 'local' ? A.windowSize : 0);

// --- safetensors (F32 / F16 / BF16 → Float32Array) ---
export function readSafetensors(buf) { // buf: Uint8Array of the whole file; non-float buffers (e.g. GPT-Neo's BOOL attn.bias masks) are skipped
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), n = Number(dv.getBigUint64(0, true));
  const header = JSON.parse(new TextDecoder().decode(buf.subarray(8, 8 + n))), base = 8 + n, T = {};
  for (const [k, v] of Object.entries(header)) { if (k === '__metadata__' || !['F32', 'F16', 'BF16'].includes(v.dtype)) continue; const [a, b] = v.data_offsets, raw = buf.subarray(base + a, base + b); T[k] = { shape: v.shape, data: toF32(raw, v.dtype) }; }
  return T;
}
export function toF32(raw, dtype) {
  if (dtype === 'F32') return new Float32Array(Uint8Array.prototype.slice.call(raw).buffer); // copy (Buffer.slice would alias): weights are mutable and must not alias the file buffer
  const u16 = raw.byteOffset % 2 === 0 ? new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2) : new Uint16Array(Uint8Array.prototype.slice.call(raw).buffer), o = new Float32Array(u16.length), ou = new Uint32Array(o.buffer);
  if (dtype === 'BF16') { for (let i = 0; i < u16.length; i++) ou[i] = u16[i] << 16; return o; }
  if (dtype === 'F16') { for (let i = 0; i < u16.length; i++) { const h = u16[i], s = (h & 0x8000) << 16, e = (h >> 10) & 31, m = h & 1023;
    if (e === 0) o[i] = (s ? -1 : 1) * m * 2 ** -24; else if (e === 31) ou[i] = s | 0x7f800000 | (m << 13); else ou[i] = s | ((e + 112) << 23) | (m << 13); } return o; }
  throw new Error('dtype ' + dtype + ' not supported');
}
const transpose = (a, rows, cols) => { const o = new Float32Array(a.length); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) o[c * rows + r] = a[r * cols + c]; return o; };

export function mapWeights(A, T) {
  const g = (k, opt) => { const t = T[k]; if (!t) { if (opt) return undefined; throw new Error('missing tensor ' + k); } return t.data; };
  const W = { layers: [] };
  if (A.arch === 'gpt_neo' || A.arch === 'gpt2') {
    const p = T['transformer.wte.weight'] ? 'transformer.' : '';
    W.wte = g(p + 'wte.weight'); W.wpe = g(p + 'wpe.weight'); W.nfw = g(p + 'ln_f.weight'); W.nfb = g(p + 'ln_f.bias'); W.lm = g('lm_head.weight', true) || W.wte;
    for (let l = 0; l < A.L; l++) { const q = `${p}h.${l}.`, d = A.d, ff = A.ff, X = { n1w: g(q + 'ln_1.weight'), n1b: g(q + 'ln_1.bias'), n2w: g(q + 'ln_2.weight'), n2b: g(q + 'ln_2.bias') };
      if (A.arch === 'gpt_neo') { const a = q + 'attn.attention.'; Object.assign(X, { q: g(a + 'q_proj.weight'), k: g(a + 'k_proj.weight'), v: g(a + 'v_proj.weight'), o: g(a + 'out_proj.weight'), ob: g(a + 'out_proj.bias'), up: g(q + 'mlp.c_fc.weight'), upb: g(q + 'mlp.c_fc.bias'), down: g(q + 'mlp.c_proj.weight'), downb: g(q + 'mlp.c_proj.bias') }); }
      else { // GPT-2 Conv1D stores [in, out]
        const ca = transpose(g(q + 'attn.c_attn.weight'), d, 3 * d), cb = g(q + 'attn.c_attn.bias');
        Object.assign(X, { q: ca.slice(0, d * d), k: ca.slice(d * d, 2 * d * d), v: ca.slice(2 * d * d), qb: cb.slice(0, d), kb: cb.slice(d, 2 * d), vb: cb.slice(2 * d), o: transpose(g(q + 'attn.c_proj.weight'), d, d), ob: g(q + 'attn.c_proj.bias'),
          up: transpose(g(q + 'mlp.c_fc.weight'), d, ff), upb: g(q + 'mlp.c_fc.bias'), down: transpose(g(q + 'mlp.c_proj.weight'), ff, d), downb: g(q + 'mlp.c_proj.bias') }); }
      W.layers.push(X); }
  } else {
    W.wte = g('model.embed_tokens.weight'); W.nfw = g('model.norm.weight'); W.lm = g('lm_head.weight', true) || W.wte;
    for (let l = 0; l < A.L; l++) { const q = `model.layers.${l}.`, a = q + 'self_attn.';
      W.layers.push({ n1w: g(q + 'input_layernorm.weight'), n2w: g(q + 'post_attention_layernorm.weight'), q: g(a + 'q_proj.weight'), k: g(a + 'k_proj.weight'), v: g(a + 'v_proj.weight'), o: g(a + 'o_proj.weight'),
        qb: g(a + 'q_proj.bias', true), kb: g(a + 'k_proj.bias', true), vb: g(a + 'v_proj.bias', true), gate: g(q + 'mlp.gate_proj.weight'), up: g(q + 'mlp.up_proj.weight'), down: g(q + 'mlp.down_proj.weight') }); }
  }
  return W;
}

// --- forward (float64 activations) ---
function mv(Wm, x, nOut, nIn, b) { const o = new Float64Array(nOut); for (let i = 0; i < nOut; i++) { let s = 0; const r = i * nIn; for (let j = 0; j < nIn; j++) s += Wm[r + j] * x[j]; o[i] = (b ? b[i] : 0) + s; } return o; }
export function norm(A, x, w, b) { const n = x.length, o = new Float64Array(n);
  if (A.norm === 'rms') { let s = 0; for (let i = 0; i < n; i++) s += x[i] * x[i]; const r = 1 / Math.sqrt(s / n + A.eps); for (let i = 0; i < n; i++) o[i] = w[i] * (x[i] * r); return o; }
  let m = 0; for (let i = 0; i < n; i++) m += x[i]; m /= n; let v = 0; for (let i = 0; i < n; i++) v += (x[i] - m) ** 2; v /= n; const r = 1 / Math.sqrt(v + A.eps);
  for (let i = 0; i < n; i++) o[i] = (x[i] - m) * r * w[i] + (b ? b[i] : 0); return o; }
const geluNew = (x) => 0.5 * x * (1 + Math.tanh(0.7978845608028654 * (x + 0.044715 * x * x * x)));
const silu = (x) => x / (1 + Math.exp(-x));
function rope(A, vec, nh, pos) { const hd = A.hd, half = hd / 2; for (let h = 0; h < nh; h++) { const o = h * hd; for (let i = 0; i < half; i++) {
  const f = pos / A.ropeTheta ** ((2 * i) / hd), c = Math.cos(f), s = Math.sin(f), a = vec[o + i], b = vec[o + i + half]; vec[o + i] = a * c - b * s; vec[o + i + half] = b * c + a * s; } } }
export const unembed = (A, W, h) => mv(W.lm, h, A.V, A.d);

// opts: { attn: bool (return patterns[l][h][t][s]), hook(l, site, vec, t) → optional replacement vector, lastOnly: logits only for the last position }
export function forward(A, W, ids, opts = {}) {
  const T = ids.length, d = A.d, hd = A.hd, H = A.H, Hkv = A.Hkv, grp = H / Hkv, hidden = [], patterns = [];
  let x = ids.map((id, t) => { const e = new Float64Array(d); for (let i = 0; i < d; i++) e[i] = W.wte[id * d + i] + (W.wpe ? W.wpe[t * d + i] : 0); return e; });
  hidden.push(x.map((v) => v.slice()));
  for (let l = 0; l < A.L; l++) {
    const P = W.layers[l], win = windowOf(A, l), Q = [], K = [], Vv = [];
    for (let t = 0; t < T; t++) { const h = norm(A, x[t], P.n1w, P.n1b); const q = mv(P.q, h, H * hd, d, P.qb), k = mv(P.k, h, Hkv * hd, d, P.kb), v = mv(P.v, h, Hkv * hd, d, P.vb);
      if (A.pos === 'rope') { rope(A, q, H, t); rope(A, k, Hkv, t); } Q.push(q); K.push(k); Vv.push(v); }
    const scl = A.scale ? 1 / Math.sqrt(hd) : 1, pat = opts.attn ? [] : null;
    for (let h = 0; h < H; h++) { const kh = Math.floor(h / grp); if (pat) pat.push([]);
      for (let t = 0; t < T; t++) { const lo = win ? Math.max(0, t - win + 1) : 0, sc = new Float64Array(t + 1).fill(-Infinity); let mx = -Infinity;
        for (let s = lo; s <= t; s++) { let z = 0; for (let i = 0; i < hd; i++) z += Q[t][h * hd + i] * K[s][kh * hd + i]; sc[s] = z * scl; if (sc[s] > mx) mx = sc[s]; }
        let Z = 0; for (let s = lo; s <= t; s++) { sc[s] = Math.exp(sc[s] - mx); Z += sc[s]; } for (let s = 0; s <= t; s++) sc[s] = s < lo ? 0 : sc[s] / Z;
        if (pat) pat[h].push(Array.from(sc));
        const z = (Q[t].z ||= new Float64Array(H * hd)); for (let s = lo; s <= t; s++) { const p = sc[s]; for (let i = 0; i < hd; i++) z[h * hd + i] += p * Vv[s][kh * hd + i]; } } }
    if (pat) patterns.push(pat);
    const nx = [];
    for (let t = 0; t < T; t++) { let a = mv(P.o, Q[t].z, d, H * hd, P.ob); if (opts.hook) a = opts.hook(l, 'attn_out', a, t) || a;
      const r = new Float64Array(d); for (let i = 0; i < d; i++) r[i] = x[t][i] + a[i];
      const h2 = norm(A, r, P.n2w, P.n2b); let m;
      if (A.mlp === 'swiglu') { const gt = mv(P.gate, h2, A.ff, d), u = mv(P.up, h2, A.ff, d); for (let i = 0; i < A.ff; i++) u[i] *= silu(gt[i]); if (opts.hook) opts.hook(l, 'mlp_act', u, t); m = mv(P.down, u, d, A.ff); }
      else { const u = mv(P.up, h2, A.ff, d, P.upb); for (let i = 0; i < A.ff; i++) u[i] = geluNew(u[i]); if (opts.hook) opts.hook(l, 'mlp_act', u, t); m = mv(P.down, u, d, A.ff, P.downb); }
      if (opts.hook) m = opts.hook(l, 'mlp_out', m, t) || m;
      for (let i = 0; i < d; i++) r[i] += m[i]; nx.push(opts.hook ? opts.hook(l, 'resid_post', r, t) || r : r); }
    x = nx; hidden.push(x.map((v) => v.slice()));
  }
  const fin = x.map((v) => norm(A, v, W.nfw, W.nfb)), from = opts.lastOnly ? T - 1 : 0, logits = [];
  for (let t = from; t < T; t++) logits.push(unembed(A, W, fin[t]));
  return { logits, hidden, final: fin, patterns: opts.attn ? patterns : null };
}
// logit lens: decode an intermediate residual state with the model's own final norm + unembedding (HF hidden_states[-1] is already normed for these families,
// so lensLogits(hidden[L]) is NOT used for the last layer; callers use forward().logits there).
export const lensLogits = (A, W, h) => unembed(A, W, norm(A, h, W.nfw, W.nfb));

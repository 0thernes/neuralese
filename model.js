// Tiny GPT-Neo forward pass in plain JS. Weights are mutable Float32Arrays.
export const CFG = { d: 256, H: 16, hd: 16, L: 8, ff: 1024, V: 50257, window: 256, eps: 1e-5 };

export function parseSafetensors(buf, hdrLen, header) {
  // buf: ArrayBuffer containing the data section (starting at byte 0 of data)
  const T = {};
  for (const [k, v] of Object.entries(header)) {
    if (k === '__metadata__' || v.dtype !== 'F32') continue;
    const [a, b] = v.data_offsets;
    T[k] = new Float32Array(buf.slice(a, b));
  }
  return T;
}

export function buildWeights(T) {
  const p = 'transformer.';
  const W = { wte: T[p + 'wte.weight'], wpe: T[p + 'wpe.weight'], lnfW: T[p + 'ln_f.weight'], lnfB: T[p + 'ln_f.bias'], layers: [] };
  for (let l = 0; l < CFG.L; l++) {
    const q = `${p}h.${l}.`;
    W.layers.push({
      ln1w: T[q + 'ln_1.weight'], ln1b: T[q + 'ln_1.bias'],
      q: T[q + 'attn.attention.q_proj.weight'], k: T[q + 'attn.attention.k_proj.weight'],
      v: T[q + 'attn.attention.v_proj.weight'], o: T[q + 'attn.attention.out_proj.weight'], ob: T[q + 'attn.attention.out_proj.bias'],
      ln2w: T[q + 'ln_2.weight'], ln2b: T[q + 'ln_2.bias'],
      fc: T[q + 'mlp.c_fc.weight'], fcb: T[q + 'mlp.c_fc.bias'], proj: T[q + 'mlp.c_proj.weight'], projb: T[q + 'mlp.c_proj.bias'],
    });
  }
  return W;
}

export function cloneWeights(W) {
  const c = (a) => new Float32Array(a);
  return { wte: c(W.wte), wpe: c(W.wpe), lnfW: c(W.lnfW), lnfB: c(W.lnfB), layers: W.layers.map((L) => Object.fromEntries(Object.entries(L).map(([k, v]) => [k, c(v)]))) };
}
export function copyWeightsInto(dst, src) {
  dst.wte.set(src.wte); dst.wpe.set(src.wpe); dst.lnfW.set(src.lnfW); dst.lnfB.set(src.lnfB);
  dst.layers.forEach((L, i) => { for (const k in L) L[k].set(src.layers[i][k]); });
}

function layerNorm(x, w, b, out) {
  const n = x.length; let m = 0; for (let i = 0; i < n; i++) m += x[i]; m /= n;
  let v = 0; for (let i = 0; i < n; i++) { const d = x[i] - m; v += d * d; } v /= n;
  const r = 1 / Math.sqrt(v + CFG.eps);
  for (let i = 0; i < n; i++) out[i] = (x[i] - m) * r * w[i] + b[i];
  return out;
}
function matvec(W, x, out, nOut, nIn, bias) {
  for (let i = 0; i < nOut; i++) {
    let s = bias ? bias[i] : 0; const o = i * nIn;
    for (let j = 0; j < nIn; j++) s += W[o + j] * x[j];
    out[i] = s;
  }
  return out;
}
const gelu = (x) => 0.5 * x * (1 + Math.tanh(0.7978845608028654 * (x + 0.044715 * x * x * x)));

// A generation stream: holds KV cache. Runtime "hooks" come from opts.
export class Stream {
  constructor(W) { this.W = W; this.reset(); }
  reset() {
    this.pos = 0;
    this.K = Array.from({ length: CFG.L }, () => []);
    this.Vc = Array.from({ length: CFG.L }, () => []);
    this.attnHist = []; // per token: Float32Array rows [L][H][t+1]
  }
  // opts: {headMask:[L][H] numbers(1 keep, 0 ablate), layerOrder:[...], steer:{layer, vec, alpha}, record:bool}
  step(tok, opts = {}) {
    const { d, H, hd, ff } = CFG, W = this.W, t = this.pos;
    const x = new Float32Array(d);
    const te = tok * d, pe = Math.min(t, 2047) * d;
    for (let i = 0; i < d; i++) x[i] = W.wte[te + i] + W.wpe[pe + i];
    const h = new Float32Array(d), q = new Float32Array(d), k = new Float32Array(d), v = new Float32Array(d);
    const ctx = new Float32Array(d), ao = new Float32Array(d), f = new Float32Array(ff), mo = new Float32Array(d);
    const order = opts.layerOrder || [0, 1, 2, 3, 4, 5, 6, 7];
    const rec = opts.record ? { heads: [], neurons: [], resid: [], x: [] } : null;
    const attnRows = [];
    for (let li = 0; li < order.length; li++) {
      const l = order[li], P = W.layers[l];
      layerNorm(x, P.ln1w, P.ln1b, h);
      matvec(P.q, h, q, d, d); matvec(P.k, h, k, d, d); matvec(P.v, h, v, d, d);
      // cache is keyed by slot li (position in the stack), so swapped layers stay consistent
      this.K[li].push(k.slice()); this.Vc[li].push(v.slice());
      const Ks = this.K[li], Vs = this.Vc[li], T = Ks.length;
      const local = l % 2 === 1; const start = local ? Math.max(0, T - CFG.window) : 0;
      const headNorm = rec ? new Float32Array(H) : null; const rows = [];
      for (let hh = 0; hh < H; hh++) {
        const o = hh * hd; const sc = new Float32Array(T); let mx = -Infinity;
        for (let s = start; s < T; s++) { let a = 0; const ks = Ks[s]; for (let j = 0; j < hd; j++) a += q[o + j] * ks[o + j]; sc[s] = a; if (a > mx) mx = a; }
        let sum = 0; for (let s = start; s < T; s++) { sc[s] = Math.exp(sc[s] - mx); sum += sc[s]; }
        const m = opts.headMask ? opts.headMask[l][hh] : 1;
        for (let j = 0; j < hd; j++) ctx[o + j] = 0;
        for (let s = start; s < T; s++) { const w = sc[s] / sum; sc[s] = w; const vs = Vs[s]; for (let j = 0; j < hd; j++) ctx[o + j] += w * vs[o + j]; }
        for (let j = 0; j < hd; j++) ctx[o + j] *= m;
        rows.push(sc);
        if (rec) { let n = 0; for (let j = 0; j < hd; j++) n += ctx[o + j] * ctx[o + j]; headNorm[hh] = Math.sqrt(n); }
      }
      attnRows.push(rows);
      matvec(P.o, ctx, ao, d, d, P.ob);
      for (let i = 0; i < d; i++) x[i] += ao[i];
      layerNorm(x, P.ln2w, P.ln2b, h);
      matvec(P.fc, h, f, ff, d, P.fcb);
      for (let i = 0; i < ff; i++) f[i] = gelu(f[i]);
      matvec(P.proj, f, mo, d, ff, P.projb);
      for (let i = 0; i < d; i++) x[i] += mo[i];
      if (opts.steer && opts.steer.vec && opts.steer.layer === li && opts.steer.alpha) {
        const sv = opts.steer.vec, a = opts.steer.alpha; for (let i = 0; i < d; i++) x[i] += a * sv[i];
      }
      if (rec) { rec.heads[l] = headNorm; rec.neurons[l] = f.slice(); let n = 0; for (let i = 0; i < d; i++) n += x[i] * x[i]; rec.resid[li] = Math.sqrt(n); rec.x[li] = x.slice(); }
    }
    this.attnHist.push(attnRows);
    layerNorm(x, W.lnfW, W.lnfB, h);
    this.pos++;
    return { hidden: h, rec };
  }
  logits(h) {
    const { d, V } = CFG, W = this.W, out = new Float32Array(V);
    for (let i = 0; i < V; i++) { let s = 0; const o = i * d; for (let j = 0; j < d; j++) s += W.wte[o + j] * h[j]; out[i] = s; }
    return out;
  }
}

export function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function gauss(rng) { let u = 0, v = 0; while (u === 0) u = rng(); v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function sample(logits, temp, topK, rng) {
  if (temp <= 0.01) { let b = 0; for (let i = 1; i < logits.length; i++) if (logits[i] > logits[b]) b = i; return b; }
  // top-k
  const idx = []; for (let i = 0; i < logits.length; i++) { if (!Number.isFinite(logits[i])) continue; idx.push(i); }
  idx.sort((a, b) => logits[b] - logits[a]);
  const top = idx.slice(0, topK || 50); const mx = logits[top[0]];
  const p = top.map((i) => Math.exp((logits[i] - mx) / temp)); const s = p.reduce((a, b) => a + b, 0);
  let r = rng() * s; for (let i = 0; i < top.length; i++) { r -= p[i]; if (r <= 0) return top[i]; }
  return top[top.length - 1];
}

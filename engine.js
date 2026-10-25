// NEURALESE engine: GPT-Neo forward pass with a full intervention/hook system.
// Every runtime control lives in `R` (serialisable). Weight edits live in surgery.js.
import { CFG, mulberry32 } from './model.js';
const { d, H, hd, L, ff, V } = CFG;
export const SITES = ['resid_pre', 'z', 'attn_out', 'mlp_act', 'mlp_out', 'resid_post'];

export function defaultRuntime() {
  return {
    program: Array.from({ length: L }, (_, l) => ({ layer: l, attn: true, mlp: true })),
    headTemp: Array.from({ length: L }, () => new Array(H).fill(1)),
    headAbl: Array.from({ length: L }, () => new Array(H).fill(null)), // null|'zero'|'mean'|'resample'
    attnMask: Array.from({ length: L }, () => ({ mode: 'causal', window: 0 })), // causal|self|noself|bos|uniform|nobos
    pos: { scale: 1, shift: 0, freeze: -1 },
    steer: [], // {id,name,site,vecs:[L][d],coef,sched:[L],mask:{kind,a,b},on}
    sae: { clamps: [] }, // {f, mode:'clamp'|'add'|'scale', value}
    neuronAbl: [], // {l, n, mode:'zero'|'mean'|'clamp', value}
    seed: 1234,
  };
}

export function layerNorm(x, w, b, out) {
  const n = x.length; let m = 0; for (let i = 0; i < n; i++) m += x[i]; m /= n;
  let v = 0; for (let i = 0; i < n; i++) { const q = x[i] - m; v += q * q; } v /= n;
  const r = 1 / Math.sqrt(v + CFG.eps);
  for (let i = 0; i < n; i++) out[i] = (x[i] - m) * r * w[i] + b[i];
  return { mean: m, rstd: r };
}
export function matvec(Wm, x, out, nOut, nIn, bias) { // nIn must be a multiple of 4
  for (let i = 0; i < nOut; i++) {
    let s0 = 0, s1 = 0, s2 = 0, s3 = 0; const o = i * nIn;
    for (let j = 0; j < nIn; j += 4) { s0 += Wm[o + j] * x[j]; s1 += Wm[o + j + 1] * x[j + 1]; s2 += Wm[o + j + 2] * x[j + 2]; s3 += Wm[o + j + 3] * x[j + 3]; }
    out[i] = (bias ? bias[i] : 0) + s0 + s1 + s2 + s3;
  }
  return out;
}
export const gelu = (x) => 0.5 * x * (1 + Math.tanh(0.7978845608028654 * (x + 0.044715 * x * x * x)));
export function posIndex(P, t) {
  let p = P.freeze >= 0 ? Math.min(t, P.freeze) : Math.round(t * P.scale) + P.shift;
  return Math.max(0, Math.min(2047, p));
}

export class Seq {
  constructor(n) { this.K = Array.from({ length: n }, () => []); this.V = Array.from({ length: n }, () => []); this.T = 0; this.ids = []; this.nPrompt = 0; }
  clone() { const s = new Seq(0); s.K = this.K.map((a) => a.slice()); s.V = this.V.map((a) => a.slice()); s.T = this.T; s.ids = this.ids.slice(); s.nPrompt = this.nPrompt; return s; }
}

export class Engine {
  constructor(W, R) { this.W = W; this.R = R || defaultRuntime(); this.stats = null; this.sae = null; }
  newSeq(nPrompt = 0) { const s = new Seq(this.R.program.length); s.nPrompt = nPrompt; return s; }

  _steer(site, l, t, isGen, x) {
    for (const v of this.R.steer) {
      if (!v.on || v.site !== site) continue; const a = v.sched[l] * v.coef; if (!a) continue;
      const m = v.mask || { kind: 'all' };
      if (m.kind === 'prompt' && isGen) continue; if (m.kind === 'gen' && !isGen) continue;
      if (m.kind === 'range' && (t < m.a || t > m.b)) continue;
      const vec = v.vecs[l]; for (let i = 0; i < d; i++) x[i] += a * vec[i];
    }
  }
  _sae(l, x) {
    const S = this.sae, C = this.R.sae.clamps; if (!S || !C.length || S.layer !== l) return;
    for (const c of C) {
      const f = c.f; let pre = S.benc[f]; const o = f * d;
      for (let i = 0; i < d; i++) pre += S.Wenc[o + i] * (x[i] - S.bdec[i]);
      const a = Math.max(0, pre);
      const na = c.mode === 'clamp' ? c.value : c.mode === 'add' ? a + c.value : a * c.value;
      const dl = na - a; if (!dl) continue;
      for (let i = 0; i < d; i++) x[i] += dl * S.Wdec[o + i]; // Wdec stored [m][d]
    }
  }

  // One token through the stack. o: {trace:bool, hook(site,slot,layer,t,vec), rng}
  step(seq, tok, o = {}) {
    const W = this.W, R = this.R, t = seq.T, isGen = t >= seq.nPrompt, hook = o.hook;
    const tr = o.trace ? { tok, t, resid_pre: [], z: [], attn_out: [], mlp_act: [], mlp_out: [], resid_post: [], pattern: [], slotLayer: [] } : null;
    const p = posIndex(R.pos, t);
    const x = new Float32Array(d);
    for (let i = 0; i < d; i++) x[i] = W.wte[tok * d + i] + W.wpe[p * d + i];
    if (tr) tr.embed = x.slice();
    const h = new Float32Array(d);
    const rng = o.rng || mulberry32((R.seed + t * 7919) | 0);
    for (let s = 0; s < R.program.length; s++) {
      const slot = R.program[s], l = slot.layer, P = W.layers[l];
      if (tr) tr.slotLayer[s] = l;
      if (hook) hook('resid_pre', s, l, t, x);
      if (tr) tr.resid_pre[s] = x.slice();
      if (slot.attn) {
        layerNorm(x, P.ln1w, P.ln1b, h);
        const q = matvec(P.q, h, new Float32Array(d), d, d), k = matvec(P.k, h, new Float32Array(d), d, d), v = matvec(P.v, h, new Float32Array(d), d, d);
        if (!seq.K[s]) { seq.K[s] = []; seq.V[s] = []; }
        seq.K[s].push(k); seq.V[s].push(v);
        const Ks = seq.K[s], Vs = seq.V[s], T = Ks.length, me = T - 1;
        const M = R.attnMask[l], win = M.window > 0 ? M.window : l % 2 ? CFG.window : 1e9, lo = Math.max(0, T - win);
        const z = new Float32Array(d); const pats = tr ? [] : null;
        for (let hh = 0; hh < H; hh++) {
          const off = hh * hd, tau = R.headTemp[l][hh] || 1e-6, sc = new Float32Array(T); let mx = -Infinity;
          for (let j = 0; j < T; j++) {
            let ok = j >= lo;
            if (M.mode === 'self') ok = j === me; else if (M.mode === 'noself') ok = ok && (j !== me || T === 1);
            else if (M.mode === 'bos') ok = j === 0 || j === me; else if (M.mode === 'nobos') ok = ok && (j !== 0 || T === 1);
            if (!ok) { sc[j] = -Infinity; continue; }
            let a = 0; if (M.mode !== 'uniform') { const kj = Ks[j]; for (let i = 0; i < hd; i++) a += q[off + i] * kj[off + i]; a /= tau; }
            sc[j] = a; if (a > mx) mx = a;
          }
          let sum = 0; for (let j = 0; j < T; j++) { const e = sc[j] === -Infinity ? 0 : Math.exp(sc[j] - mx); sc[j] = e; sum += e; }
          for (let j = 0; j < T; j++) { const w = sc[j] / sum; sc[j] = w; if (w) { const vj = Vs[j]; for (let i = 0; i < hd; i++) z[off + i] += w * vj[off + i]; } }
          const ab = R.headAbl[l][hh];
          if (ab === 'zero') for (let i = 0; i < hd; i++) z[off + i] = 0;
          else if (ab === 'mean' && this.stats) { const mz = this.stats.meanZ[l]; for (let i = 0; i < hd; i++) z[off + i] = mz[off + i]; }
          else if (ab === 'resample' && this.stats) { const src = this.stats.sampleZ(l, rng); for (let i = 0; i < hd; i++) z[off + i] = src[off + i]; }
          if (pats) pats.push(sc);
        }
        if (hook) hook('z', s, l, t, z);
        if (tr) { tr.z[s] = z.slice(); tr.pattern[s] = pats; }
        const ao = matvec(P.o, z, new Float32Array(d), d, d, P.ob);
        this._steer('attn_out', l, t, isGen, ao);
        if (hook) hook('attn_out', s, l, t, ao);
        if (tr) tr.attn_out[s] = ao.slice();
        for (let i = 0; i < d; i++) x[i] += ao[i];
      }
      if (slot.mlp) {
        layerNorm(x, P.ln2w, P.ln2b, h);
        const a = matvec(P.fc, h, new Float32Array(ff), ff, d, P.fcb);
        for (let i = 0; i < ff; i++) a[i] = gelu(a[i]);
        for (const na of R.neuronAbl) if (na.l === l) a[na.n] = na.mode === 'zero' ? 0 : na.mode === 'mean' && this.stats ? this.stats.meanAct[l][na.n] : na.value;
        if (hook) hook('mlp_act', s, l, t, a);
        if (tr) tr.mlp_act[s] = a.slice();
        const mo = matvec(P.proj, a, new Float32Array(d), d, ff, P.projb);
        this._steer('mlp_out', l, t, isGen, mo);
        if (hook) hook('mlp_out', s, l, t, mo);
        if (tr) tr.mlp_out[s] = mo.slice();
        for (let i = 0; i < d; i++) x[i] += mo[i];
      }
      this._steer('resid_post', l, t, isGen, x);
      this._sae(l, x);
      if (hook) hook('resid_post', s, l, t, x);
      if (tr) tr.resid_post[s] = x.slice();
    }
    const st = layerNorm(x, W.lnfW, W.lnfB, h);
    if (tr) { tr.final = x.slice(); tr.lnf = st; tr.h = h.slice(); }
    seq.T++; seq.ids.push(tok);
    return { h, trace: tr, x };
  }
  logits(h) { if (this.gpu && this.gpu.ready && this.gpu.W === this.W) return this.gpu.unembedSync ? this.gpu.unembedSync(h) : matvec(this.W.wte, h, new Float32Array(V), V, d); return matvec(this.W.wte, h, new Float32Array(V), V, d); }
  logitOf(h, id) { let s = 0; const o = id * d; for (let j = 0; j < d; j++) s += this.W.wte[o + j] * h[j]; return s; }
  // unembed an arbitrary residual vector through ln_f
  lensLogits(x) { const h = new Float32Array(d); layerNorm(x, this.W.lnfW, this.W.lnfB, h); return this.logits(h); }
  run(ids, o = {}) {
    const s = this.newSeq(o.nPrompt ?? ids.length); const traces = []; let r;
    for (const t of ids) { r = this.step(s, t, o); if (o.trace) traces.push(r.trace); }
    return { seq: s, last: r, traces };
  }
}

export function logSoftmax(l) {
  let m = -Infinity; for (let i = 0; i < l.length; i++) if (l[i] > m) m = l[i];
  let s = 0; for (let i = 0; i < l.length; i++) s += Math.exp(l[i] - m);
  const z = m + Math.log(s), out = new Float32Array(l.length); for (let i = 0; i < l.length; i++) out[i] = l[i] - z; return out;
}
export function topK(arr, k) {
  const idx = []; let minV = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]; if (idx.length < k) { idx.push(i); if (idx.length === k) { idx.sort((a, b) => arr[b] - arr[a]); minV = arr[idx[k - 1]]; } }
    else if (v > minV) { let j = k - 1; while (j > 0 && arr[idx[j - 1]] < v) { idx[j] = idx[j - 1]; j--; } idx[j] = i; minV = arr[idx[k - 1]]; }
  }
  if (idx.length < k) idx.sort((a, b) => arr[b] - arr[a]);
  return idx;
}
export function entropy(lp) { let e = 0; for (let i = 0; i < lp.length; i++) { const p = Math.exp(lp[i]); if (p > 0) e -= p * lp[i]; } return e; }

// Weight surgery: a replayable list of edit ops applied to a fresh copy of the original weights.
import { CFG, copyWeightsInto, mulberry32, gauss } from './model.js?v=10';
import { svd, svdReconstruct } from './linalg.js?v=10';
import { resolve, fromPath } from './drill.js?v=10';
const { d, ff, L } = CFG;
export const MATS = ['q', 'k', 'v', 'o', 'fc', 'proj'];
export const SHAPE = { q: [d, d], k: [d, d], v: [d, d], o: [d, d], fc: [ff, d], proj: [d, ff] };

export function getMat(W, path) {
  if (path === 'wte') return { a: W.wte, rows: CFG.V, cols: d }; if (path === 'wpe') return { a: W.wpe, rows: 2048, cols: d };
  const m = path.match(/^L(\d)\.(\w+)$/); const [r, c] = SHAPE[m[2]]; return { a: W.layers[+m[1]][m[2]], rows: r, cols: c };
}
export function tensorStd(a) { let m = 0, v = 0; const n = Math.min(a.length, 300000); for (let i = 0; i < n; i++) m += a[i]; m /= n; for (let i = 0; i < n; i++) v += (a[i] - m) ** 2; return Math.sqrt(v / n) || 1e-3; }
const fnOf = (e, std, rng) => e.fn === 'scale' ? (x) => x * e.amt : e.fn === 'zero' ? () => 0 : e.fn === 'invert' ? (x) => -x : e.fn === 'add' ? (x) => x + e.amt : (x) => x + Math.abs(e.amt) * std * gauss(rng);
export function quantize(a, rows, cols, bits) {
  const qmax = 2 ** (bits - 1) - 1; let err = 0;
  for (let i = 0; i < rows; i++) { const o = i * cols; let mx = 0; for (let j = 0; j < cols; j++) mx = Math.max(mx, Math.abs(a[o + j])); const s = mx / qmax || 1;
    for (let j = 0; j < cols; j++) { const q = Math.max(-qmax - (bits > 1 ? 1 : 0), Math.min(qmax, Math.round(a[o + j] / s))) * s; err += (q - a[o + j]) ** 2; a[o + j] = q; } }
  return Math.sqrt(err / (rows * cols));
}

export class Editor {
  constructor(orig, mod) { this.orig = orig; this.mod = mod; this.edits = []; this.std = new Map(); this.svdCache = new Map(); this.nextId = 1; this.onRebuild = null; }
  sd(a) { if (!this.std.has(a)) this.std.set(a, tensorStd(a)); return this.std.get(a); }
  push(e) { e.id = e.id || this.nextId++; this.nextId = Math.max(this.nextId, e.id + 1); this.edits.push(e); this.apply(e); this.onRebuild && this.onRebuild(); return e; }
  setEdits(list) { this.edits = list; this.nextId = list.reduce((a, e) => Math.max(a, e.id + 1), 1); this.rebuild(); }
  rebuild() { copyWeightsInto(this.mod, this.orig); for (const e of this.edits) this.apply(e); this.onRebuild && this.onRebuild(); }
  // SVD of the ORIGINAL matrix (cached) – edits that need the current matrix compute fresh.
  svdOf(path, current = false) {
    const W = current ? this.mod : this.orig; const { a, rows, cols } = getMat(W, path);
    if (!current && this.svdCache.has(path)) return this.svdCache.get(path);
    const r = svd(a, rows, cols); if (!current) this.svdCache.set(path, r); return r;
  }
  apply(e) {
    const W = this.mod, O = this.orig, rng = mulberry32((e.seed ?? e.id) * 7919 + 1);
    switch (e.kind) {
      case 'elem': {
        const t = e.target; const ed = (arr, oarr, idx) => { const f = fnOf(e, this.sd(oarr), rng); for (const i of idx) arr[i] = f(arr[i]); };
        const P = t.l != null ? W.layers[t.l] : null, Q = t.l != null ? O.layers[t.l] : null;
        if (t.type === 'head') { const idx = []; for (let i = 0; i < d; i++) for (let j = 0; j < 16; j++) idx.push(i * d + t.i * 16 + j); ed(P.o, Q.o, idx);
          if (e.fn === 'noise') { const r = []; for (let j = 0; j < 16; j++) for (let i = 0; i < d; i++) r.push((t.i * 16 + j) * d + i); for (const k of ['q', 'k', 'v']) ed(P[k], Q[k], r); } }
        else if (t.type === 'neuron') { const idx = []; for (let i = 0; i < d; i++) idx.push(i * ff + t.i); ed(P.proj, Q.proj, idx); if (e.fn === 'noise') { const r = []; for (let i = 0; i < d; i++) r.push(t.i * d + i); ed(P.fc, Q.fc, r); } }
        else if (t.type === 'matrix') { const { a } = getMat(W, t.path), { a: oa } = getMat(O, t.path); ed(a, oa, a.keys()); }
        else if (t.type === 'sel') { for (const p of resolve(W, fromPath(t.path))) { const arr = W.layers[p.l][p.key], oarr = O.layers[p.l][p.key]; ed(arr, oarr, p.idx || arr.keys()); } }
        else if (t.type === 'embed') for (const tk of t.toks) { const r = []; for (let i = 0; i < d; i++) r.push(tk * d + i); ed(W.wte, O.wte, r); }
        break;
      }
      case 'svd': { // modify singular values of the CURRENT matrix: mode topk | drop | scale
        const { a, rows, cols } = getMat(W, e.path); const R = svd(a, rows, cols); const S2 = Float64Array.from(R.S);
        for (let k = 0; k < S2.length; k++) {
          if (e.mode === 'topk' && k >= e.k) S2[k] = 0;
          if (e.mode === 'drop' && k >= e.from && k <= e.to) S2[k] = 0;
          if (e.mode === 'scale' && k >= e.from && k <= e.to) S2[k] *= e.factor;
          if (e.mode === 'flatten' && k < e.k) S2[k] = R.S[0] ? R.S.slice(0, e.k).reduce((x, y) => x + y, 0) / e.k : 0;
        }
        svdReconstruct(R, S2, a); e._err = null; break;
      }
      case 'lowrank': { const { a, rows, cols } = getMat(W, e.path), s = this.sd(getMat(O, e.path).a) * e.sigma;
        for (let r = 0; r < e.rank; r++) { const u = Float64Array.from({ length: rows }, () => gauss(rng)), v = Float64Array.from({ length: cols }, () => gauss(rng)); const c = s / Math.sqrt(e.rank);
          for (let i = 0; i < rows; i++) { const o = i * cols, ui = u[i] * c; for (let j = 0; j < cols; j++) a[o + j] += ui * v[j]; } } break; }
      case 'quant': { for (const l of e.layers) for (const m of e.mats) { const { a, rows, cols } = getMat(W, `L${l}.${m}`); quantize(a, rows, cols, e.bits); } break; }
      case 'interp': { const D = W.layers[e.dst], S = O.layers[e.src], D0 = O.layers[e.dst]; for (const k in D) { const a = D[k], b = S[k], c = D0[k]; for (let i = 0; i < a.length; i++) a[i] = a[i] + e.t * (b[i] - c[i]); } break; }
      case 'ln': { const v = e.which === 'lnf' ? [W.lnfW, W.lnfB] : [W.layers[e.l][e.which + 'w'], W.layers[e.l][e.which + 'b']]; for (let i = 0; i < d; i++) { v[0][i] *= e.gScale; v[1][i] += e.bAdd; } break; }
      case 'rome': { const P = W.layers[e.l].proj; for (let i = 0; i < d; i++) { const o = i * ff, vi = e.v[i]; for (let j = 0; j < ff; j++) P[o + j] += vi * e.u[j]; } break; }
      case 'wpe': { const a = W.wpe;
        if (e.fn === 'zero') a.fill(0); else if (e.fn === 'scale') for (let i = 0; i < a.length; i++) a[i] *= e.amt;
        else if (e.fn === 'shuffle') { const n = Math.min(e.n || 256, 2048), perm = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; } const src = O.wpe; for (let i = 0; i < n; i++) a.set(src.subarray(perm[i] * d, perm[i] * d + d), i * d); }
        else if (e.fn === 'noise') { const s = this.sd(O.wpe) * e.amt; for (let i = 0; i < a.length; i++) a[i] += s * gauss(rng); } break; }
      case 'chaos': { const s = (e.pct / 100) ** 1.6 * 1.2; W.layers.forEach((P, l) => { for (const k of MATS) { const a = P[k], sd = this.sd(O.layers[l][k]) * s; for (let i = 0; i < a.length; i++) a[i] += sd * gauss(rng); } }); break; }
      default: throw new Error('unknown edit ' + e.kind);
    }
  }
  label(e) {
    switch (e.kind) {
      case 'elem': { const t = e.target, a = e.fn === 'scale' ? `×${e.amt}` : e.fn === 'noise' ? `+${e.amt}σ noise` : e.fn === 'add' ? `+${e.amt}` : e.fn; return `${t.type === 'head' ? `L${t.l}H${t.i}.o` : t.type === 'neuron' ? `L${t.l}N${t.i}` : t.type === 'matrix' || t.type === 'sel' ? t.path : `emb[${t.word}]`} ${a}`; }
      case 'svd': return `SVD ${e.path} ${e.mode === 'topk' ? `keep top-${e.k}` : e.mode === 'flatten' ? `flatten top-${e.k}` : `${e.mode} σ${e.from}..${e.to}${e.mode === 'scale' ? ' ×' + e.factor : ''}`}`;
      case 'lowrank': return `rank-${e.rank} perturb ${e.path} ${e.sigma}σ`;
      case 'quant': return `int${e.bits} L[${e.layers.join(',')}] {${e.mats.join(',')}}`;
      case 'interp': return `L${e.dst} ← lerp(L${e.dst}, L${e.src}, ${e.t})`;
      case 'ln': return `${e.which === 'lnf' ? 'ln_f' : `L${e.l}.${e.which}`} γ×${e.gScale} β+${e.bAdd}`;
      case 'rome': return `ROME L${e.l}: "${e.subject}" → "${e.target}"`;
      case 'wpe': return `wpe ${e.fn}${e.amt != null ? ' ' + e.amt : ''}`;
      case 'chaos': return `chaos ${e.pct}%`;
    }
    return e.kind;
  }
}

// Safetensors writer (F32) for the modified weights, using the original HF tensor names.
export function toSafetensors(W) {
  const T = { 'transformer.wte.weight': [W.wte, [CFG.V, d]], 'transformer.wpe.weight': [W.wpe, [2048, d]], 'transformer.ln_f.weight': [W.lnfW, [d]], 'transformer.ln_f.bias': [W.lnfB, [d]] };
  const names = { ln1w: 'ln_1.weight', ln1b: 'ln_1.bias', q: 'attn.attention.q_proj.weight', k: 'attn.attention.k_proj.weight', v: 'attn.attention.v_proj.weight', o: 'attn.attention.out_proj.weight', ob: 'attn.attention.out_proj.bias', ln2w: 'ln_2.weight', ln2b: 'ln_2.bias', fc: 'mlp.c_fc.weight', fcb: 'mlp.c_fc.bias', proj: 'mlp.c_proj.weight', projb: 'mlp.c_proj.bias' };
  const shapes = { ln1w: [d], ln1b: [d], q: [d, d], k: [d, d], v: [d, d], o: [d, d], ob: [d], ln2w: [d], ln2b: [d], fc: [ff, d], fcb: [ff], proj: [d, ff], projb: [d] };
  W.layers.forEach((P, l) => { for (const k in names) T[`transformer.h.${l}.${names[k]}`] = [P[k], shapes[k]]; });
  const hdr = { __metadata__: { format: 'pt', source: 'NEURALESE edited TinyStories-8M' } }; let off = 0; const parts = [];
  for (const [k, [a, sh]] of Object.entries(T)) { hdr[k] = { dtype: 'F32', shape: sh, data_offsets: [off, off + a.byteLength] }; off += a.byteLength; parts.push(a); }
  let hs = JSON.stringify(hdr); while ((8 + hs.length) % 8) hs += ' ';
  const hb = new TextEncoder().encode(hs), out = new Uint8Array(8 + hb.length + off); new DataView(out.buffer).setBigUint64(0, BigInt(hb.length), true); out.set(hb, 8);
  let p = 8 + hb.length; for (const a of parts) { out.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), p); p += a.byteLength; }
  return out;
}

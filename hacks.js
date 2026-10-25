// Weight-edit engine: every edit is replayed on a fresh copy of the original weights.
import { CFG, copyWeightsInto, mulberry32, gauss, Stream } from './model.js';

export function tensorStd(a) { let m = 0, v = 0; const n = Math.min(a.length, 200000); for (let i = 0; i < n; i++) m += a[i]; m /= n; for (let i = 0; i < n; i++) v += (a[i] - m) ** 2; return Math.sqrt(v / n) || 1e-3; }

function opFn(op, amt, std, rng) {
  if (op === 'scale') return (x) => x * amt;
  if (op === 'zero') return () => 0;
  if (op === 'invert') return (x) => -x;
  return (x) => x + Math.abs(amt) * 0.5 * std * gauss(rng); // noise
}

export class Hacker {
  constructor(orig, mod, tok) {
    this.orig = orig; this.mod = mod; this.tok = tok;
    this.edits = []; this.ablated = new Set(); this.order = [0, 1, 2, 3, 4, 5, 6, 7];
    this.chaos = 0; this.steer = { layer: 2, alpha: 0, a: ' dragon', b: ' dog', vec: null };
    this.std = new Map(); this.nextId = 1;
  }
  sd(a) { if (!this.std.has(a)) this.std.set(a, tensorStd(a)); return this.std.get(a); }
  headMask() { return Array.from({ length: CFG.L }, (_, l) => Array.from({ length: CFG.H }, (_, h) => (this.ablated.has(l * 16 + h) ? 0 : 1))); }
  runtime() { return { headMask: this.headMask(), layerOrder: this.order, steer: this.steer.vec ? { layer: this.steer.layer, alpha: this.steer.alpha, vec: this.steer.vec } : null }; }
  add(e) { e.id = this.nextId++; this.edits.push(e); this.rebuild(); return e; }
  remove(id) { this.edits = this.edits.filter((e) => e.id !== id); this.rebuild(); }
  resetAll() { this.edits = []; this.ablated.clear(); this.order = [0, 1, 2, 3, 4, 5, 6, 7]; this.chaos = 0; this.steer.alpha = 0; this.rebuild(); }
  rebuild() {
    copyWeightsInto(this.mod, this.orig);
    for (const e of this.edits) this.apply(e);
    if (this.chaos > 0) {
      const rng = mulberry32(1337), s = (this.chaos / 100) ** 1.6 * 1.2;
      for (const P of this.mod.layers) for (const k of ['q', 'k', 'v', 'o', 'fc', 'proj']) {
        const a = P[k], sd = this.sd(this.orig.layers[this.mod.layers.indexOf(P)][k]) * s;
        for (let i = 0; i < a.length; i++) a[i] += sd * gauss(rng);
      }
    }
  }
  apply(e) {
    const W = this.mod, O = this.orig, rng = mulberry32(e.id * 7919), d = CFG.d, ff = CFG.ff;
    const edit = (arr, oarr, idxs) => { const f = opFn(e.op, e.amt, this.sd(oarr), rng); for (const i of idxs) arr[i] = f(arr[i]); };
    const all = (n) => { const r = new Array(n); for (let i = 0; i < n; i++) r[i] = i; return r; };
    if (e.type === 'head') {
      const P = W.layers[e.l], Q = O.layers[e.l], cols = [];
      for (let i = 0; i < d; i++) for (let j = 0; j < 16; j++) cols.push(i * d + e.i * 16 + j);
      edit(P.o, Q.o, cols);
      if (e.op === 'noise') { const rows = []; for (let j = 0; j < 16; j++) for (let i = 0; i < d; i++) rows.push((e.i * 16 + j) * d + i); edit(P.q, Q.q, rows); edit(P.k, Q.k, rows); edit(P.v, Q.v, rows); }
    } else if (e.type === 'neuron') {
      const P = W.layers[e.l], Q = O.layers[e.l], col = [];
      for (let i = 0; i < d; i++) col.push(i * ff + e.i);
      edit(P.proj, Q.proj, col);
      if (e.op === 'noise') { const row = []; for (let i = 0; i < d; i++) row.push(e.i * d + i); edit(P.fc, Q.fc, row); }
    } else if (e.type === 'layer') {
      const P = W.layers[e.l], Q = O.layers[e.l];
      edit(P.o, Q.o, all(P.o.length)); edit(P.proj, Q.proj, all(P.proj.length));
      if (e.op !== 'noise') { edit(P.ob, Q.ob, all(d)); edit(P.projb, Q.projb, all(d)); }
      else for (const k of ['q', 'k', 'v', 'fc']) edit(P[k], Q[k], all(P[k].length));
    } else if (e.type === 'embed') {
      for (const t of e.toks) { const r = []; for (let i = 0; i < d; i++) r.push(t * d + i); edit(W.wte, O.wte, r); }
    } else if (e.type === 'wpe') {
      edit(W.wpe, O.wpe, all(W.wpe.length));
    }
  }
  label(e) {
    const a = e.op === 'scale' ? `×${e.amt}` : e.op === 'noise' ? `≈${Math.abs(e.amt)}σ` : e.op;
    if (e.type === 'head') return `L${e.l}·H${e.i} ${a}`;
    if (e.type === 'neuron') return `L${e.l}·N${e.i} ${a}`;
    if (e.type === 'layer') return `Layer ${e.l} ${a}`;
    if (e.type === 'wpe') return `positions ${a}`;
    return `emb "${e.word}" ${a}`;
  }
  // ActAdd-style steering: residual(A) − residual(B) at the injection layer, from the clean model
  computeSteer() {
    const { a, b, layer } = this.steer;
    const act = (w) => { const s = new Stream(this.orig); let r; for (const t of this.tok.encode(w)) r = s.step(t, { record: true }); return r.rec.x[layer]; };
    const xa = act(a), xb = act(b); this.steer.vec = xa.map((v, i) => v - xb[i]);
  }
}

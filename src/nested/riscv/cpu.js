// Browser/Node runtime for the hand-compiled RV32I transformer (artifacts/riscv_spec.json).
// Same math as e1_riscv/runtime.py fast path, Float64. No reference interpreter is used to step the machine.
(function (root) {
  const NREG = 8, NROM = 64, NRAM = 32;
  function prep(spec) {
    const L = spec.layers.map(l => {
      if (l.type === 'ffn') {
        const rows = Array.from({ length: l.H }, () => []); for (const [h, d, w] of l.W1) rows[h].push(d, w);
        const outs = Array.from({ length: l.H }, () => []); for (const [d, h, w] of l.W2) outs[h].push(d, w);
        return { type: 'ffn', name: l.name, rows, outs, b1: l.b1 };
      }
      const g = (lst) => { let n = 0; for (const [, c] of lst) n = Math.max(n, c + 1); return { lst, n }; };
      return { type: 'attn', name: l.name, q: g(l.q), k: g(l.k), v: g(l.v), o: l.o };
    });
    return { D: spec.D, S: spec.slots, L };
  }
  const proj = (x, m) => { const r = new Float64Array(m.n); for (const [a, c, w] of m.lst) r[c] += x[a] * w; return r; };
  function bitsInto(x, dims, v) { for (let k = 0; k < 32; k++) x[dims[k]] = (v >>> k) & 1; }
  function toInt(x, dims) {
    let v = 0; for (let k = 0; k < 32; k++) { const b = x[dims[k]]; if (b !== 0 && b !== 1) throw new Error('non-binary'); v |= b << k; }
    return v >>> 0;
  }
  class CPU {
    constructor(model, rom, ram) {
      this.m = model; this.rom = rom.concat(Array(NROM - rom.length).fill(0)); this.pc = 0; this.x = Array(NREG).fill(0); this.t = 0;
      this.ramTok = ram.map((v, s) => [s, v >>> 0, 0]);
      this.romX = this.rom.map((w, s) => { const x = new Float64Array(model.D); x[model.S.romkey[s]] = 1; bitsInto(x, model.S.romval, w); return x; });
    }
    ramX() { const S = this.m.S; return this.ramTok.map(([s, v, t]) => { const x = new Float64Array(this.m.D); x[S.ramkey[s]] = 1; bitsInto(x, S.ramval, v); x[S.time[0]] = t; return x; }); }
    step(record) {
      const { S, D, L } = this.m; const ctx = this.romX.concat(this.ramX());
      const y = new Float64Array(D); y[S.one[0]] = 1; bitsInto(y, S.pc, this.pc);
      for (let r = 0; r < NREG; r++) bitsInto(y, S['x' + r], this.x[r]);
      const all = ctx.concat([y]);
      for (const l of L) {
        if (l.type === 'ffn') {
          const delta = new Float64Array(D);
          for (let h = 0; h < l.rows.length; h++) {
            const r = l.rows[h]; let a = l.b1[h]; for (let i = 0; i < r.length; i += 2) a += y[r[i]] * r[i + 1];
            if (a > 0) { const o = l.outs[h]; for (let i = 0; i < o.length; i += 2) delta[o[i]] += a * o[i + 1]; }
          }
          if (record) { const act = new Float64Array(l.rows.length); for (let h = 0; h < l.rows.length; h++) { const r = l.rows[h]; let a = l.b1[h]; for (let i = 0; i < r.length; i += 2) a += y[r[i]] * r[i + 1]; act[h] = a > 0 ? 1 : 0; } record[l.name] = act; }
          for (let d = 0; d < D; d++) y[d] += delta[d];
        } else {
          const q = proj(y, l.q); const sc = all.map(x => { const k = proj(x, l.k); let s = 0; for (let i = 0; i < q.length; i++) s += q[i] * k[i]; return s; });
          const mx = Math.max(...sc); const p = sc.map(s => Math.exp(s - mx)); const Z = p.reduce((a, b) => a + b, 0);
          for (let i = 0; i < p.length; i++) p[i] /= Z;
          if (record) record[l.name] = p;
          const v = new Float64Array(l.v.n); all.forEach((x, j) => { if (p[j] === 0) return; const vj = proj(x, l.v); for (let i = 0; i < v.length; i++) v[i] += p[j] * vj[i]; });
          const delta = new Float64Array(D); for (const [a, c, w] of l.o) delta[c] += v[a] * w;
          for (let d = 0; d < D; d++) y[d] += delta[d];
        }
      }
      this.pc = toInt(y, S.next_pc); this.x = [0]; for (let r = 1; r < NREG; r++) this.x.push(toInt(y, S['nx' + r]));
      this.t++;
      if (y[S.st_valid[0]] === 1) {
        let s = -1; S.st_oh.forEach((d, i) => { if (y[d] === 1) s = i; }); this.ramTok.push([s, toInt(y, S.st_val), this.t]);
      }
      return y;
    }
    ram() { const r = Array(NRAM).fill(0); for (const [s, v] of this.ramTok) r[s] = v; return r; }  // tokens appended in time order
  }
  const api = { prep, CPU };
  if (typeof module !== 'undefined') module.exports = api; else root.RVTransformer = api;
})(this);

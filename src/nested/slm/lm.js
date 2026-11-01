// Norm-free causal transformer forward pass (Float64), mirrors e2_slm/model.py. Returns logits + residual of last position.
window.NLM = {
  forward(M, ids, mode, out) {
    const c = M.cfg, w = M.w, T = ids.length, d = c.d, dh = c.dh, nh = c.nh;
    const mv = (W, x, b) => W.map((r, i) => r.reduce((s, v, j) => s + v * x[j], b ? b[i] : 0));
    let X = ids.map((t, p) => w['emb.weight'][t].map((v, j) => v + w.pos[p][j] + (mode != null && w['mode.weight'] ? w['mode.weight'][mode][j] : 0)));
    const heads = [];
    for (let l = 0; l < c.L; l++) {
      const P = k => w[`blocks.${l}.${k}`];
      const Q = X.map(x => mv(P('q.weight'), x)), K = X.map(x => mv(P('k.weight'), x)), Vv = X.map(x => mv(P('v.weight'), x));
      const att = Array.from({ length: nh }, () => []);
      X = X.map((x, t) => {
        const o = new Array(nh * dh).fill(0);
        for (let h = 0; h < nh; h++) {
          const s = []; for (let u = 0; u <= t; u++) { let a = 0; for (let i = 0; i < dh; i++) a += Q[t][h * dh + i] * K[u][h * dh + i]; s.push(a / Math.sqrt(dh)); }
          const m = Math.max(...s), e = s.map(v => Math.exp(v - m)), Z = e.reduce((a, b) => a + b, 0);
          if (t === T - 1) att[h] = e.map(v => v / Z);
          for (let u = 0; u <= t; u++) for (let i = 0; i < dh; i++) o[h * dh + i] += e[u] / Z * Vv[u][h * dh + i];
        }
        const x1 = x.map((v, j) => v + P('o.weight')[j].reduce((s, wv, i) => s + wv * o[i], 0));
        const hid = mv(P('w1.weight'), x1, P('w1.bias')).map(v => Math.max(0, v));
        return x1.map((v, j) => v + P('w2.bias')[j] + P('w2.weight')[j].reduce((s, wv, i) => s + wv * hid[i], 0));
      });
      heads.push(att);
    }
    const r = X[T - 1], head = out || { weight: w['out.weight'], bias: w['out.bias'] };
    return { logits: mv(head.weight, r, head.bias), resid: r, att: heads };
  },
  softmax(z) { const m = Math.max(...z), e = z.map(v => Math.exp(v - m)), Z = e.reduce((a, b) => a + b, 0); return e.map(v => v / Z); },
  kl(p, q) { return p.reduce((s, v, i) => s + (v > 0 ? v * (Math.log(v) - Math.log(q[i])) : 0), 0); }
};

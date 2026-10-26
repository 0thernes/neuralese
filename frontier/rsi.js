// v11 P4: a closed self-improvement loop on TinyStories-8M. Editable θ = ln_f gain/bias (512) + output gains γ of the 1024
// layer-7 MLP neurons. The frozen backbone is run once per document; everything after layer-7's MLP is recomputed exactly.
import { forward, lse, mean, tLess, rng, gauss } from './core.js?v=13';
export function precompute(W, ids) { const A = forward(W, ids), C = A.layers[A.layers.length - 1]; return { ids, T: ids.length, act: C.act, xf0: A.xf }; }
export const theta0 = (W) => ({ g: Float64Array.from(W.lnfW), b: Float64Array.from(W.lnfB), gam: new Float64Array(W.layers[0].fcb.length).fill(1) });
export const clone = (th) => ({ g: Float64Array.from(th.g), b: Float64Array.from(th.b), gam: Float64Array.from(th.gam) });
export const flatTheta = (th) => [...th.g, ...th.b, ...th.gam];
export function addTheta(th, dv, s = 1) { const o = clone(th), d = th.g.length; for (let i = 0; i < d; i++) { o.g[i] += s * dv[i]; o.b[i] += s * dv[d + i]; } for (let n = 0; n < th.gam.length; n++) o.gam[n] += s * dv[2 * d + n]; return o; }
// Per-position CE (and entropy) for positions [lo, hi); with wantGrad, the gradient of the MEAN CE w.r.t. θ (flat vector).
export function evalDoc(W, th, pre, lo = 0, hi = pre.T - 1, wantGrad = false, G = null, nTot = 1) { const d = th.g.length, ff = th.gam.length, P = W.layers[W.layers.length - 1].proj, E = W.wte, V = E.length / d, ce = [], ent = [];
  const x = new Float64Array(d), nh = new Float64Array(d), y = new Float64Array(d), z = new Float64Array(V);
  for (let t = lo; t < hi; t++) { for (let i = 0; i < d; i++) x[i] = pre.xf0[t * d + i]; for (let n = 0; n < ff; n++) { const c = (th.gam[n] - 1) * pre.act[t * ff + n]; if (c) for (let i = 0; i < d; i++) x[i] += c * P[i * ff + n]; }
    let m = 0; for (let i = 0; i < d; i++) m += x[i]; m /= d; let v = 0; for (let i = 0; i < d; i++) v += (x[i] - m) ** 2; v /= d; const r = 1 / Math.sqrt(v + 1e-5); for (let i = 0; i < d; i++) { nh[i] = (x[i] - m) * r; y[i] = nh[i] * th.g[i] + th.b[i]; }
    for (let o = 0; o < V; o++) { let s = 0; const off = o * d; for (let i = 0; i < d; i++) s += E[off + i] * y[i]; z[o] = s; } const Z = lse(z), tgt = pre.ids[t + 1]; ce.push(Z - z[tgt]); let h = 0; for (let o = 0; o < V; o++) { const lp = z[o] - Z; h -= Math.exp(lp) * lp; } ent.push(h);
    if (wantGrad) { const dy = new Float64Array(d); for (let o = 0; o < V; o++) { const p = Math.exp(z[o] - Z) - (o === tgt ? 1 : 0); if (Math.abs(p) < 1e-12) continue; const off = o * d; for (let i = 0; i < d; i++) dy[i] += p * E[off + i]; }
      const s = 1 / nTot, dn = new Float64Array(d); let s1 = 0, s2 = 0; for (let i = 0; i < d; i++) { G[i] += s * dy[i] * nh[i]; G[d + i] += s * dy[i]; dn[i] = dy[i] * th.g[i]; s1 += dn[i]; s2 += dn[i] * nh[i]; } s1 /= d; s2 /= d;
      const dx = new Float64Array(d); for (let i = 0; i < d; i++) dx[i] = r * (dn[i] - s1 - nh[i] * s2);
      for (let n = 0; n < ff; n++) { const a = pre.act[t * ff + n]; if (!a) continue; let q = 0; for (let i = 0; i < d; i++) q += dx[i] * P[i * ff + n]; G[2 * d + n] += s * a * q; } } }
  return { ce, ent }; }
export function evalSet(W, th, pres, wantGrad = false, lo = 0, hi = null) { const N = pres.reduce((s, p) => s + ((hi ?? p.T - 1) - lo), 0), G = wantGrad ? new Float64Array(2 * th.g.length + th.gam.length) : null; const perDoc = pres.map((p) => evalDoc(W, th, p, lo, hi ?? p.T - 1, wantGrad, G, N));
  const all = perDoc.flatMap((r) => r.ce); return { ce: mean(all), perPos: all, perDoc: perDoc.map((r) => mean(r.ce)), ent: mean(perDoc.flatMap((r) => r.ent)), G }; }
const l2 = (v) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
// The loop. Each iteration: (A) own-gradient step, (B) zero the neuron with the best attribution-patching estimate, (C) random control.
export function loop(W, sets, iters = 30, onIter = null, seed = 1) { const r = rng(seed), th0 = theta0(W); let th = clone(th0); const log = [];
  let cur = { sel: evalSet(W, th, sets.select), test: evalSet(W, th, sets.test) }; log.push({ it: 0, select: cur.sel.ce, test: cur.test.ce, ent: cur.test.ent, editL2: 0, accepted: null });
  for (let it = 1; it <= iters; it++) { const pr = evalSet(W, th, sets.propose, true), g = pr.G, gn = l2(Array.from(g)); const dA = Array.from(g, (x) => -0.05 * x / gn);
    const d = th.g.length; let bestN = -1, bestE = 0; for (let n = 0; n < th.gam.length; n++) { if (th.gam[n] === 0) continue; const e = -th.gam[n] * g[2 * d + n]; if (e < bestE) { bestE = e; bestN = n; } }
    const dB = new Array(g.length).fill(0); if (bestN >= 0) dB[2 * d + bestN] = -th.gam[bestN]; const u = Array.from(g, () => gauss(r)), un = l2(u), dC = u.map((x) => 0.05 * x / un);
    const cands = [['A:gradient', dA], ['B:neuron-ablate', dB], ['C:random-control', dC]].map(([name, dv]) => { const t2 = addTheta(th, dv), s = evalSet(W, t2, sets.select), diff = s.perPos.map((x, i) => x - cur.sel.perPos[i]), tt = tLess(diff); return { name, th: t2, sel: s, mean: mean(diff), p: tt.p, ok: tt.p < 0.01 && mean(diff) < 0, extra: name.startsWith('B') ? { neuron: bestN, atp: bestE } : {} }; });
    const win = cands.filter((c) => c.ok).sort((a, b) => a.sel.ce - b.sel.ce)[0]; if (win) { th = win.th; cur = { sel: win.sel, test: evalSet(W, th, sets.test) }; }
    const e = { it, propose: pr.ce, select: cur.sel.ce, test: cur.test.ce, ent: cur.test.ent, editL2: l2(flatTheta(th).map((x, i) => x - flatTheta(th0)[i])), accepted: win ? win.name : null, cands: cands.map((c) => ({ name: c.name, dSelect: c.mean, p: c.p, ok: c.ok, ...c.extra })) };
    log.push(e); if (onIter) onIter(e); }
  return { log, theta: th, testPerDoc: { before: evalSet(W, th0, sets.test).perDoc, after: cur.test.perDoc } }; }
// Adam fine-tuning of θ on a set of precomputed docs (used by self-distillation and test-time training).
export function adamFit(W, th, pres, steps, lr, lo = 0, hi = null) { let t = clone(th); const P = 2 * t.g.length + t.gam.length, m = new Float64Array(P), v = new Float64Array(P);
  for (let s = 1; s <= steps; s++) { const { G } = evalSet(W, t, pres, true, lo, hi), dv = new Array(P); for (let i = 0; i < P; i++) { m[i] = 0.9 * m[i] + 0.1 * G[i]; v[i] = 0.999 * v[i] + 0.001 * G[i] ** 2; dv[i] = -lr * (m[i] / (1 - 0.9 ** s)) / (Math.sqrt(v[i] / (1 - 0.999 ** s)) + 1e-8); } t = addTheta(t, dv); }
  return t; }

// ROME-style rank-one fact edit on an MLP output matrix (c_proj).
//  k*  = MLP activation at the subject's last token (layer l)
//  C   = E[k kᵀ] over the reference corpus (+ ridge λ)   →  u = C⁻¹k* / (k*ᵀC⁻¹k*)
//  v*  = found by iterative ascent of log p(target) in the residual direction γ⊙(w_t − E_p[w])  (gradient of log-softmax wrt the final hidden state)
//  ΔW  = (v* − W k*) uᵀ         (rank one, so W' k* = v* exactly)
import { CFG } from './model.js?v=7';
import { logSoftmax } from './engine.js?v=7';
import { cholSolve, dot, norm } from './linalg.js?v=7';
const { d, ff, V } = CFG;
export function findSubject(tok, ids, subject) {
  for (const s of [subject, ' ' + subject.trim(), subject.trim()]) { const sid = tok.encode(s); for (let i = ids.length - sid.length; i >= 0; i--) if (sid.every((x, j) => ids[i + j] === x)) return i + sid.length - 1; }
  return -1;
}
export async function computeRome(eng, tok, C, { prompt, subject, target, layer, lambda = 0.05, maxIter = 150, goal = 0.5, eta = 0.3 }, onp = () => {}) {
  const ids = tok.encode(prompt), ps = findSubject(tok, ids, subject); if (ps < 0) throw new Error(`subject "${subject}" not found in prompt tokens`);
  const tgt = tok.encode(target)[0]; const slot = eng.R.program.findIndex((s) => s.layer === layer && s.mlp); if (slot < 0) throw new Error('layer not in program');
  const tr = eng.run(ids, { trace: true }).traces; const k = Float64Array.from(tr[ps].mlp_act[slot]);
  let trc = 0; for (let i = 0; i < ff; i++) trc += C[i * ff + i]; const A = Float64Array.from(C); for (let i = 0; i < ff; i++) A[i * ff + i] += lambda * trc / ff;
  const ci = cholSolve(A, ff, k, 1); const den = dot(k, ci); const u = Float32Array.from(ci, (x) => x / den);
  const P = eng.W.layers[layer].proj; let v0n = 0;
  for (let i = 0; i < d; i++) { let s = 0; for (let j = 0; j < ff; j++) s += P[i * ff + j] * k[j]; v0n += s * s; } v0n = Math.sqrt(v0n);
  const W = eng.W, dv = new Float64Array(d), rest = ids.slice(ps);
  // ROME-style value optimisation: add dv to the MLP output at (layer, subject position) via a hook, prefix cached.
  const pre = eng.newSeq(ids.length); for (let t = 0; t < ps; t++) eng.step(pre, ids[t]);
  const evalLp = (delta) => { const s = pre.clone(); let r; for (const t of rest) r = eng.step(s, t, { hook: (site, sl, l, tt, x) => { if (site === 'mlp_out' && sl === slot && tt === ps) for (let i = 0; i < d; i++) x[i] += delta[i]; } }); return logSoftmax(eng.logits(r.h)); };
  const f = (delta) => evalLp(delta)[tgt];
  // 1) warm start: ascent along γ⊙(w_t − E_p[w])
  let lp = evalLp(dv), p = Math.exp(lp[tgt]), it = 0, top = 0;
  const argmax = (a) => { let b = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; };
  for (; it < 12 && !(p >= goal && argmax(lp) === tgt); it++) {
    const g = new Float64Array(d); for (let i = 0; i < d; i++) g[i] = W.wte[tgt * d + i];
    for (let t = 0; t < V; t++) { const q = Math.exp(lp[t]); if (q < 1e-5) continue; const o = t * d; for (let i = 0; i < d; i++) g[i] -= q * W.wte[o + i]; }
    for (let i = 0; i < d; i++) g[i] *= W.lnfW[i]; const gn = norm(g) || 1;
    const cand = dv.map((x, i) => x + eta * v0n * g[i] / gn); const lc = evalLp(cand);
    if (lc[tgt] > lp[tgt]) { dv.set(cand); lp = lc; p = Math.exp(lp[tgt]); } else break;
    onp({ it, p }); await new Promise((r) => setTimeout(r, 0));
  }
  // 2) SPSA refinement with Adam (2·K forward passes per step, gradient-free, works through attention)
  const m1 = new Float64Array(d), m2 = new Float64Array(d), K = 4, c = 0.05 * v0n, lr = 0.08 * v0n; let rng = 12345;
  const rnd = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) & 1 ? 1 : -1);
  for (let s = 1; s <= maxIter && !(p >= goal && argmax(lp) === tgt); s++, it++) {
    const g = new Float64Array(d);
    for (let k = 0; k < K; k++) { const D = Float64Array.from({ length: d }, rnd); const fp = f(dv.map((x, i) => x + c * D[i])), fm = f(dv.map((x, i) => x - c * D[i])); for (let i = 0; i < d; i++) g[i] += ((fp - fm) / (2 * c)) * D[i] / K; }
    for (let i = 0; i < d; i++) { m1[i] = 0.9 * m1[i] + 0.1 * g[i]; m2[i] = 0.999 * m2[i] + 0.001 * g[i] * g[i]; dv[i] += lr * (m1[i] / (1 - 0.9 ** s)) / (Math.sqrt(m2[i] / (1 - 0.999 ** s)) + 1e-8); }
    lp = evalLp(dv); p = Math.exp(lp[tgt]); onp({ it, p }); if (s % 4 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  top = argmax(lp);
  return { kind: 'rome', l: layer, u: Array.from(u), v: Array.from(dv), subject, target, prompt, iters: it, p, top };
}

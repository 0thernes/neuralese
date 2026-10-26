// Interpretability toolkit: corpus statistics, logit/tuned lens, DLA, activation & path patching, control vectors.
import { CFG, mulberry32 } from './model.js?v=9';
import { Engine, defaultRuntime, layerNorm, logSoftmax, topK, entropy } from './engine.js?v=9';
import { cholSolve, pca1, dot } from './linalg.js?v=9';
const { d, H, hd, L, ff } = CFG;
const tick = () => new Promise((r) => setTimeout(r, 0));

// ───────── corpus statistics (always computed on the CLEAN model with default runtime) ─────────
export async function computeStats(Wclean, corpus, maxTok = 1200, onp = () => {}) {
  const eng = new Engine(Wclean, defaultRuntime());
  const docs = []; let n = 0; for (const doc of corpus) { if (n >= maxTok) break; const dd = doc.slice(0, maxTok - n); docs.push(dd); n += dd.length; }
  const N = n, Z = Array.from({ length: L }, () => new Float32Array(N * d)), Rp = Array.from({ length: L }, () => new Float32Array(N * d));
  const fin = new Float32Array(N * d), meanAct = Array.from({ length: L }, () => new Float64Array(ff)), ids = new Int32Array(N), docOf = new Int32Array(N), posOf = new Int32Array(N);
  let k = 0;
  for (let di = 0; di < docs.length; di++) {
    const s = eng.newSeq(docs[di].length);
    for (let t = 0; t < docs[di].length; t++) {
      const r = eng.step(s, docs[di][t], { trace: true }); const tr = r.trace;
      for (let l = 0; l < L; l++) { Z[l].set(tr.z[l], k * d); Rp[l].set(tr.resid_post[l], k * d); const a = tr.mlp_act[l], ma = meanAct[l]; for (let i = 0; i < ff; i++) ma[i] += a[i]; }
      fin.set(tr.final, k * d); ids[k] = docs[di][t]; docOf[k] = di; posOf[k] = t; k++;
    }
    onp(k / N); await tick();
  }
  const meanZ = Z.map((z) => { const m = new Float32Array(d); for (let i = 0; i < N; i++) for (let j = 0; j < d; j++) m[j] += z[i * d + j] / N; return m; });
  meanAct.forEach((m) => m.forEach((v, i) => (m[i] = v / N)));
  const stats = { N, Z, resid: Rp, final: fin, meanZ, meanAct: meanAct.map((m) => Float32Array.from(m)), ids, docOf, posOf, docs, tuned: null,
    sampleZ(l, rng) { const i = Math.floor(rng() * N); return Z[l].subarray(i * d, i * d + d); },
    context(i, w = 8) { const di = docOf[i], p = posOf[i], doc = docs[di]; return { before: doc.slice(Math.max(0, p - w), p), tok: doc[p], after: doc.slice(p + 1, p + 1 + Math.floor(w / 3)) }; } };
  return stats;
}

// Second moment E[k k^T] of MLP activations at layer l over the stats corpus (for ROME). Clean model.
export async function actCovariance(Wclean, stats, l, onp = () => {}) {
  const eng = new Engine(Wclean, defaultRuntime()); const C = new Float64Array(ff * ff); let n = 0;
  for (let di = 0; di < stats.docs.length; di++) {
    const s = eng.newSeq(stats.docs[di].length);
    for (const t of stats.docs[di]) {
      eng.step(s, t, { hook: (site, slot, layer, tt, a) => { if (site !== 'mlp_act' || layer !== l) return; for (let i = 0; i < ff; i++) { const ai = a[i]; if (!ai) continue; const o = i * ff; for (let j = 0; j <= i; j++) C[o + j] += ai * a[j]; } n++; } });
    }
    onp((di + 1) / stats.docs.length); await tick();
  }
  for (let i = 0; i < ff; i++) for (let j = 0; j <= i; j++) { C[i * ff + j] /= n; C[j * ff + i] = C[i * ff + j]; }
  return C;
}

// Tuned-lens-style translators: per layer affine map resid_post[l] -> final residual, ridge least squares on the corpus.
export function fitTunedLens(stats, lambda = 1e-2) {
  const N = stats.N, D = d + 1, Y = stats.final, maps = [];
  for (let l = 0; l < L; l++) {
    const X = stats.resid[l], A = new Float64Array(D * D), B = new Float64Array(D * d);
    for (let i = 0; i < N; i++) {
      const xo = i * d;
      for (let a = 0; a < D; a++) { const xa = a < d ? X[xo + a] : 1; if (!xa) continue; const ar = a * D;
        for (let b = 0; b <= a; b++) A[ar + b] += xa * (b < d ? X[xo + b] : 1);
        const br = a * d; for (let j = 0; j < d; j++) B[br + j] += xa * Y[xo + j]; }
    }
    let tr = 0; for (let a = 0; a < D; a++) tr += A[a * D + a];
    for (let a = 0; a < D; a++) { for (let b = 0; b < a; b++) A[b * D + a] = A[a * D + b]; A[a * D + a] += lambda * tr / D; }
    maps.push(Float32Array.from(cholSolve(A, D, B, d))); // (D×d): y = [x,1] @ M
  }
  stats.tuned = maps; return maps;
}
export function applyTuned(M, x) { const y = new Float32Array(d); for (let a = 0; a <= d; a++) { const xa = a < d ? x[a] : 1; const o = a * d; for (let j = 0; j < d; j++) y[j] += xa * M[o + j]; } return y; }

// Logit lens grid. rows = [embed, slot0..slotN-1]; for each token position returns top-k ids/probs + entropy.
export function lensGrid(eng, traces, { k = 5, tuned = null, positions = null } = {}) {
  const pos = positions || traces.map((_, i) => i); const out = [];
  for (const p of pos) {
    const tr = traces[p]; const col = [];
    const vecs = [tr.embed, ...tr.resid_post];
    vecs.forEach((x, r) => {
      let xx = x; if (tuned && r > 0 && tuned[tr.slotLayer[r - 1]] && r < vecs.length) xx = r === vecs.length - 1 ? x : applyTuned(tuned[tr.slotLayer[r - 1]], x);
      const lp = logSoftmax(eng.lensLogits(xx)); const ids = topK(lp, k);
      col.push({ ids, probs: ids.map((i) => Math.exp(lp[i])), ent: entropy(lp), lp });
    });
    out.push(col);
  }
  return out;
}

// Direct logit attribution for one trace (position) and target token. Exact decomposition of the final logit:
// logit = Σ_c rstd·(c − mean(c))·(γ⊙w_t) + β·w_t  over components c that sum to the final residual.
export function dla(eng, tr, target) {
  const W = eng.W, u = new Float64Array(d); let ub = 0;
  for (let i = 0; i < d; i++) { u[i] = W.lnfW[i] * W.wte[target * d + i]; ub += W.lnfB[i] * W.wte[target * d + i]; }
  const um = u.reduce((a, b) => a + b, 0) / d; for (let i = 0; i < d; i++) u[i] -= um;
  const r = tr.lnf.rstd, c = (v) => r * dot(v, u);
  const res = { embed: c(tr.embed), heads: [], neurons: [], biases: [], other: 0, beta: ub, total: 0 };
  let acc = Float64Array.from(tr.embed);
  tr.slotLayer.forEach((l, s) => {
    const P = W.layers[l];
    if (tr.z[s]) {
      const OtU = new Float64Array(d); for (let i = 0; i < d; i++) { const ui = u[i]; const o = i * d; for (let j = 0; j < d; j++) OtU[j] += P.o[o + j] * ui; }
      for (let h = 0; h < H; h++) { let v = 0; for (let j = h * hd; j < (h + 1) * hd; j++) v += tr.z[s][j] * OtU[j]; res.heads.push({ slot: s, l, h, v: r * v }); }
      res.biases.push({ slot: s, l, kind: 'attn_bias', v: c(P.ob) });
      for (let i = 0; i < d; i++) acc[i] += tr.attn_out[s][i];
    }
    if (tr.mlp_act[s]) {
      const PtU = new Float64Array(ff); for (let i = 0; i < d; i++) { const ui = u[i]; const o = i * ff; for (let j = 0; j < ff; j++) PtU[j] += P.proj[o + j] * ui; }
      const a = tr.mlp_act[s]; for (let n = 0; n < ff; n++) if (a[n]) res.neurons.push({ slot: s, l, n, v: r * a[n] * PtU[n] });
      res.biases.push({ slot: s, l, kind: 'mlp_bias', v: c(P.projb) });
      for (let i = 0; i < d; i++) acc[i] += tr.mlp_out[s][i];
    }
  });
  // anything injected outside attn/mlp outputs (steering at resid, SAE clamps) or applied inside outputs is caught here
  const known = res.embed + res.heads.reduce((a, b) => a + b.v, 0) + res.neurons.reduce((a, b) => a + b.v, 0) + res.biases.reduce((a, b) => a + b.v, 0);
  const resid = new Float64Array(d); for (let i = 0; i < d; i++) resid[i] = tr.final[i] - acc[i]; res.other = c(resid);
  // steering added to attn/mlp outputs is inside attn_out/mlp_out but not in head/neuron terms:
  let inside = 0; tr.slotLayer.forEach((l, s) => { const P = W.layers[l];
    if (tr.z[s]) { const ao = new Float64Array(d); for (let i = 0; i < d; i++) { let v = P.ob[i]; const o = i * d; for (let j = 0; j < d; j++) v += P.o[o + j] * tr.z[s][j]; ao[i] = tr.attn_out[s][i] - v; } inside += c(ao); }
    if (tr.mlp_act[s]) { const mo = new Float64Array(d); for (let i = 0; i < d; i++) { let v = P.projb[i]; const o = i * ff; for (let j = 0; j < ff; j++) v += P.proj[o + j] * tr.mlp_act[s][j]; mo[i] = tr.mlp_out[s][i] - v; } inside += c(mo); } });
  res.other += inside;
  for (const v of eng.R.hSteer || []) if (v.on !== false) { let s = 0; for (let i = 0; i < d; i++) s += v.coef * v.vec[i] * W.wte[target * d + i]; res.other += s; } // unembedding-space steering
  res.total = known + res.other + ub;
  res.heads.sort((a, b) => Math.abs(b.v) - Math.abs(a.v)); res.neurons.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  return res;
}

// ───────── causal tools ─────────
export function metricFromH(eng, h, ans, wrong) { return eng.logitOf(h, ans) - eng.logitOf(h, wrong); }
function runMetric(eng, ids, ans, wrong, hook) { const r = eng.run(ids, { hook }); return metricFromH(eng, r.last.h, ans, wrong); }

export async function patchResid(eng, clean, corr, ans, wrong, onp = () => {}) {
  if (clean.length !== corr.length) throw new Error(`clean (${clean.length} tok) and corrupted (${corr.length} tok) prompts must tokenize to the same length`);
  const cr = eng.run(clean, { trace: true }), C = metricFromH(eng, cr.last.h, ans, wrong), X = runMetric(eng, corr, ans, wrong);
  const S = eng.R.program.length, T = clean.length, M = [];
  for (let s = 0; s < S; s++) {
    const row = [];
    for (let p = 0; p < T; p++) {
      const src = cr.traces[p].resid_pre[s];
      const m = runMetric(eng, corr, ans, wrong, (site, slot, l, t, x) => { if (site === 'resid_pre' && slot === s && t === p) x.set(src); });
      row.push({ raw: m, norm: (m - X) / (C - X || 1e-9) });
    }
    M.push(row); onp((s + 1) / S); await tick();
  }
  return { clean: C, corrupt: X, M };
}
export async function patchHeads(eng, clean, corr, ans, wrong, onp = () => {}) {
  if (clean.length !== corr.length) throw new Error('clean/corrupted prompts must tokenize to the same length');
  const cr = eng.run(clean, { trace: true }), C = metricFromH(eng, cr.last.h, ans, wrong), X = runMetric(eng, corr, ans, wrong);
  const S = eng.R.program.length, M = [];
  for (let s = 0; s < S; s++) {
    const row = [];
    for (let h = 0; h < H; h++) {
      const m = runMetric(eng, corr, ans, wrong, (site, slot, l, t, z) => { if (site === 'z' && slot === s) { const src = cr.traces[t].z[s]; for (let j = h * hd; j < (h + 1) * hd; j++) z[j] = src[j]; } });
      row.push({ raw: m, norm: (m - X) / (C - X || 1e-9) });
    }
    M.push(row); onp((s + 1) / S); await tick();
  }
  return { clean: C, corrupt: X, M };
}
// Path patching sender head -> logits (direct path only): add O_h (z_clean − z_corr) at the last position to the corrupted final residual.
export function pathPatchHeadsToLogits(eng, clean, corr, ans, wrong) {
  if (clean.length !== corr.length) throw new Error('clean/corrupted prompts must tokenize to the same length');
  const cr = eng.run(clean, { trace: true }), xr = eng.run(corr, { trace: true }), C = metricFromH(eng, cr.last.h, ans, wrong), X = metricFromH(eng, xr.last.h, ans, wrong);
  const tc = cr.traces[clean.length - 1], tx = xr.traces[corr.length - 1], M = [], hbuf = new Float32Array(d);
  for (let s = 0; s < eng.R.program.length; s++) {
    const P = eng.W.layers[tc.slotLayer[s]], row = [];
    for (let h = 0; h < H; h++) {
      const x = Float32Array.from(tx.final);
      if (tc.z[s]) for (let i = 0; i < d; i++) { let v = 0; const o = i * d; for (let j = h * hd; j < (h + 1) * hd; j++) v += P.o[o + j] * (tc.z[s][j] - tx.z[s][j]); x[i] += v; }
      layerNorm(x, eng.W.lnfW, eng.W.lnfB, hbuf); const m = metricFromH(eng, hbuf, ans, wrong);
      row.push({ raw: m, norm: (m - X) / (C - X || 1e-9) });
    }
    M.push(row);
  }
  return { clean: C, corrupt: X, M };
}
// Head ablation sweep on the clean prompt with zero/mean/resample ablation. Value = metric after ablation.
export async function ablationSweep(eng, ids, ans, wrong, type, onp = () => {}) {
  const base = runMetric(eng, ids, ans, wrong), M = [];
  for (let l = 0; l < L; l++) {
    const row = [];
    for (let h = 0; h < H; h++) { const prev = eng.R.headAbl[l][h]; eng.R.headAbl[l][h] = type; const m = runMetric(eng, ids, ans, wrong); eng.R.headAbl[l][h] = prev; row.push({ raw: m, norm: (m - base) / (Math.abs(base) || 1e-9) }); }
    M.push(row); onp((l + 1) / L); await tick();
  }
  return { base, M };
}

// ───────── control vectors (contrastive activation addition / repeng-style) ─────────
function siteAct(tr, site, l, agg, from) {
  const idx = tr.map((x) => x.slotLayer.indexOf(l)); const vs = [];
  for (let p = from; p < tr.length; p++) { const s = idx[p]; const a = tr[p][site][s]; if (a) vs.push(a); }
  if (!vs.length) return new Float32Array(d);
  if (agg === 'last') return vs[vs.length - 1];
  const m = new Float32Array(d); for (const v of vs) for (let i = 0; i < d; i++) m[i] += v[i] / vs.length; return m;
}
export function buildControlVector(eng, tok, pairs, { site = 'resid_post', method = 'mean', agg = 'last' } = {}) {
  const diffs = Array.from({ length: L }, () => []);
  for (const [pos, neg] of pairs) {
    const tp = eng.run(tok.encode(pos), { trace: true }).traces, tn = eng.run(tok.encode(neg), { trace: true }).traces;
    for (let l = 0; l < L; l++) { const a = siteAct(tp, site, l, agg, 0), b = siteAct(tn, site, l, agg, 0); diffs[l].push(Float32Array.from(a, (v, i) => v - b[i])); }
  }
  const vecs = diffs.map((D) => {
    const mean = new Float32Array(d); for (const v of D) for (let i = 0; i < d; i++) mean[i] += v[i] / D.length;
    if (method === 'mean' || D.length < 2) return mean;
    const X = new Float64Array(D.length * d); D.forEach((v, i) => X.set(v, i * d));
    const { v } = pca1(X, D.length, d, { center: false });
    let proj = 0; for (const x of D) proj += dot(x, v) / D.length; // sign + scale aligned to the mean difference
    return Float32Array.from(v, (x) => x * proj);
  });
  return vecs;
}
export function vectorArithmetic(expr, vectors) {
  // expr like "1.0*joy - 0.5*fear + anger"
  const terms = expr.replace(/\s+/g, '').match(/[+-]?[^+-]+/g) || []; const out = Array.from({ length: L }, () => new Float32Array(d));
  for (const t of terms) {
    const m = t.match(/^([+-]?)(?:([0-9.]+)\*)?(.+)$/); if (!m) throw new Error('bad term ' + t);
    const c = (m[1] === '-' ? -1 : 1) * (m[2] ? +m[2] : 1); const v = vectors.find((x) => x.name === m[3]); if (!v) throw new Error('unknown vector ' + m[3]);
    for (let l = 0; l < L; l++) for (let i = 0; i < d; i++) out[l][i] += c * v.vecs[l][i];
  }
  return out;
}
export function tokenStats(eng, traces, ids) {
  // per position: entropy of next-token dist, surprisal of actual next token, resid norms per slot, cosine to previous slot
  const rows = [];
  for (let p = 0; p < traces.length; p++) {
    const tr = traces[p], lp = logSoftmax(eng.logits(tr.h));
    const nx = ids[p + 1]; const vs = [tr.embed, ...tr.resid_post];
    const norms = vs.map((v) => Math.sqrt(dot(v, v))); const cos = vs.slice(1).map((v, i) => dot(v, vs[i]) / (norms[i + 1] * norms[i] || 1));
    const acts = []; tr.mlp_act.forEach((a, s) => { if (!a) return; for (let n = 0; n < ff; n++) acts.push([a[n], s, n]); });
    acts.sort((a, b) => b[0] - a[0]);
    rows.push({ ent: entropy(lp), nll: nx != null ? -lp[nx] : null, norms, cos, topNeurons: acts.slice(0, 8), top: topK(lp, 5).map((i) => [i, Math.exp(lp[i])]) });
  }
  const nl = rows.filter((r) => r.nll != null); const ppl = Math.exp(nl.reduce((a, b) => a + b.nll, 0) / (nl.length || 1));
  return { rows, ppl };
}

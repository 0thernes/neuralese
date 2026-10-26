// Decoding: logit processors, samplers, contrastive decoding, CFG, beam search.
import { logSoftmax, topK } from './engine.js?v=13';
export const defaultDecode = () => ({ mode: 'sample', temp: 0.7, topk: 50, topp: 1, minp: 0, typical: 1, rep: 1, freq: 0, pres: 0, bias: {}, beams: 4, lenpen: 1, cdAlpha: 0.1, cdBeta: 0.5, cfg: 1.5, neg: '', seed: 42, n: 80 });

// HF-style repetition penalty + OpenAI-style frequency/presence penalties + additive logit bias. Mutates and returns l.
export function applyPenalties(l, ctx, genIds, o) {
  for (const [id, b] of Object.entries(o.bias || {})) l[+id] += b;
  if (o.rep && o.rep !== 1) { const seen = new Set(ctx); for (const id of seen) l[id] = l[id] > 0 ? l[id] / o.rep : l[id] * o.rep; }
  if (o.freq || o.pres) { const c = new Map(); for (const id of genIds) c.set(id, (c.get(id) || 0) + 1); for (const [id, n] of c) l[id] -= o.freq * n + o.pres; }
  return l;
}
// Returns candidate list after temperature + truncation filters: {ids, probs} (renormalised), plus the full logprobs.
export function filterDist(l, o) {
  const lp = logSoftmax(l.map((x) => x / Math.max(o.temp, 1e-6)));
  let ids = topK(lp, Math.min(o.topk > 0 ? o.topk : 2000, 2000));
  let p = ids.map((i) => Math.exp(lp[i]));
  if (o.minp > 0) { const thr = o.minp * p[0]; const keep = p.map((x) => x >= thr); ids = ids.filter((_, i) => keep[i]); p = p.filter((_, i) => keep[i]); }
  if (o.topp < 1) { let c = 0, k = 0; for (; k < p.length; k++) { c += p[k]; if (c >= o.topp) { k++; break; } } ids = ids.slice(0, Math.max(1, k)); p = p.slice(0, Math.max(1, k)); }
  if (o.typical < 1) {
    let H = 0; for (let i = 0; i < lp.length; i++) { const q = Math.exp(lp[i]); if (q > 0) H -= q * lp[i]; }
    const ord = ids.map((id, i) => [Math.abs(-lp[id] - H), i]).sort((a, b) => a[0] - b[0]); let c = 0; const keep = [];
    for (const [, i] of ord) { keep.push(i); c += p[i]; if (c >= o.typical) break; }
    keep.sort((a, b) => a - b); ids = keep.map((i) => ids[i]); p = keep.map((i) => p[i]);
  }
  const s = p.reduce((a, b) => a + b, 0); return { ids, probs: p.map((x) => x / s), lp };
}
export function pick(dist, rng, greedy) { if (greedy) return dist.ids[0]; let r = rng(); for (let i = 0; i < dist.ids.length; i++) { r -= dist.probs[i]; if (r <= 0) return dist.ids[i]; } return dist.ids[dist.ids.length - 1]; }
// Contrastive decoding (Li et al. 2023): score = log p_exp − β·log p_ama over tokens with p_exp ≥ α·max p_exp.
export function contrastiveLogits(lExp, lAma, alpha, beta) {
  const le = logSoftmax(lExp), la = logSoftmax(lAma); let mx = -Infinity; for (const v of le) if (v > mx) mx = v;
  const thr = mx + Math.log(alpha), out = new Float32Array(le.length);
  for (let i = 0; i < le.length; i++) out[i] = le[i] >= thr ? le[i] - beta * la[i] : -1e9;
  return out;
}
// Classifier-free guidance: log p_neg + γ (log p_pos − log p_neg)
export function cfgLogits(lPos, lNeg, g) { const a = logSoftmax(lPos), b = logSoftmax(lNeg), out = new Float32Array(a.length); for (let i = 0; i < a.length; i++) out[i] = b[i] + g * (a[i] - b[i]); return out; }

// Beam search with length penalty. step(seq,tok)->h ; returns best {ids, score, logp}
export function beamSearch(eng, seq0, h0, { beams = 4, n = 40, lenpen = 1, eos = 50256, o }) {
  let live = [{ seq: seq0, h: h0, ids: [], logp: 0 }]; const done = [];
  for (let t = 0; t < n && live.length; t++) {
    const cand = [];
    for (const b of live) {
      const l = applyPenalties(eng.logits(b.h), b.seq.ids, b.ids, o); const lp = logSoftmax(l);
      for (const id of topK(lp, beams)) cand.push({ b, id, logp: b.logp + lp[id] });
    }
    cand.sort((a, b) => b.logp - a.logp); live = [];
    for (const c of cand) {
      if (live.length >= beams) break;
      if (c.id === eos) { done.push({ ids: c.b.ids, logp: c.logp, score: c.logp / Math.max(1, c.b.ids.length) ** lenpen }); continue; }
      const s = c.b.seq.clone(); const r = eng.step(s, c.id); live.push({ seq: s, h: r.h, ids: [...c.b.ids, c.id], logp: c.logp });
    }
  }
  for (const b of live) done.push({ ids: b.ids, logp: b.logp, score: b.logp / Math.max(1, b.ids.length) ** lenpen });
  done.sort((a, b) => b.score - a.score); return done[0];
}

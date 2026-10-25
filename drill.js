// Drill-down hierarchy: model → layer → sublayer → matrix → unit (head / neuron) → row|col → weight.
// A node is a plain object; resolve() maps it to the exact parameter indices it denotes so stats, sensitivity, Fisher and edits
// all act on the same set.  Weight layout: row-major [out][in]; head h owns q/k/v rows and o columns h·hd … h·hd+hd−1;
// neuron n owns fc row n (+fcb[n]) and proj column n.
import { CFG } from './model.js?v=7';
const dims = (W) => W.cfg || CFG;
export const SUB = { ln1: ['ln1w', 'ln1b'], attn: ['q', 'k', 'v', 'o', 'ob'], ln2: ['ln2w', 'ln2b'], mlp: ['fc', 'fcb', 'proj', 'projb'] };
export const shapeOf = (W, key) => { const { d, ff } = dims(W); return { q: [d, d], k: [d, d], v: [d, d], o: [d, d], fc: [ff, d], proj: [d, ff], ob: [1, d], fcb: [1, ff], projb: [1, d], ln1w: [1, d], ln1b: [1, d], ln2w: [1, d], ln2b: [1, d] }[key]; };
export const LEVELS = ['model', 'layer', 'sublayer', 'matrix', 'unit', 'line', 'weight'];
export function level(n) { return n.w != null ? 6 : n.line != null ? 5 : n.unit != null ? 4 : n.key ? 3 : n.sub ? 2 : n.l != null ? 1 : 0; }
export function label(n) { const p = ['model']; if (n.l != null) p.push(`L${n.l}`); if (n.sub) p.push(n.sub); if (n.key) p.push(n.key); if (n.unit != null) p.push(unitName(n) + n.unit); if (n.line != null) p.push(`${n.lineAxis}${n.line}`); if (n.w != null) p.push(`w${n.w}`); return p; }
export const unitName = (n) => (n.sub === 'attn' ? 'H' : n.sub === 'mlp' ? 'N' : 'i');
export const crumbs = (n) => { const out = [{}]; const keys = ['l', 'sub', 'key', 'unit', 'line', 'w']; let cur = {}; for (const k of keys) { if (n[k] == null) continue; cur = { ...cur, [k]: n[k] }; if (k === 'line') cur.lineAxis = n.lineAxis; out.push(cur); } return out; };
// children of a node (for the navigator)
export function children(W, n) {
  const { L, H, hd, d, ff } = { L: W.layers.length, ...dims(W) }, lv = level(n);
  if (lv === 0) return [...Array(L).keys()].map((l) => ({ l }));
  if (lv === 1) return Object.keys(SUB).map((sub) => ({ ...n, sub }));
  if (lv === 2) return SUB[n.sub].map((key) => ({ ...n, key }));
  if (lv === 3) { const [r, c] = shapeOf(W, n.key); if (r === 1) return [...Array(c).keys()].map((w) => ({ ...n, w }));
    if (n.sub === 'attn') return [...Array(H).keys()].map((u) => ({ ...n, unit: u })); return [...Array(ff).keys()].map((u) => ({ ...n, unit: u })); }
  if (lv === 4) { const ax = lineAxisFor(n); const cnt = ax.len; return [...Array(cnt).keys()].map((line) => ({ ...n, line, lineAxis: ax.axis })); }
  if (lv === 5) { const L2 = lineLen(W, n); return [...Array(L2).keys()].map((w) => ({ ...n, w })); }
  return [];
  function lineAxisFor(m) { if (m.sub === 'attn') return m.key === 'o' ? { axis: 'c', len: hd } : m.key === 'ob' ? { axis: 'r', len: 1 } : { axis: 'r', len: hd }; return m.key === 'fc' || m.key === 'fcb' ? { axis: 'r', len: 1 } : m.key === 'proj' ? { axis: 'c', len: 1 } : { axis: 'r', len: 1 }; }
}
const lineLen = (W, n) => { const [r, c] = shapeOf(W, n.key); return n.lineAxis === 'c' ? r : c; };
// Indices (into W.layers[l][key]) for a node at matrix level or below; for higher levels returns a list of parts.
export function resolve(W, n) {
  const { hd } = dims(W), L = W.layers.length, lv = level(n), parts = [];
  if (lv === 0) { for (let l = 0; l < L; l++) for (const k in W.layers[l]) parts.push({ l, key: k, idx: null }); return parts; }
  if (lv === 1) { for (const k of Object.values(SUB).flat()) parts.push({ l: n.l, key: k, idx: null }); return parts; }
  if (lv === 2) return SUB[n.sub].map((k) => ({ l: n.l, key: k, idx: null }));
  if (lv === 3) return [{ l: n.l, key: n.key, idx: null }];
  const [rows, cols] = shapeOf(W, n.key), idx = [];
  if (rows === 1) { if (n.w == null) return [{ l: n.l, key: n.key, idx: null }]; idx.push(n.w); return [{ l: n.l, key: n.key, idx: Int32Array.from(idx) }]; }
  // unit → row/column block
  let rset, cset;
  if (n.sub === 'attn') { const blk = [...Array(hd).keys()].map((i) => n.unit * hd + i); if (n.key === 'o') { rset = [...Array(rows).keys()]; cset = blk; } else { rset = blk; cset = [...Array(cols).keys()]; } }
  else if (n.key === 'fc') { rset = [n.unit]; cset = [...Array(cols).keys()]; } else { rset = [...Array(rows).keys()]; cset = [n.unit]; }
  if (n.line != null) { if (n.lineAxis === 'r') rset = [rset[n.line]]; else cset = [cset[n.line]]; }
  if (n.w != null) { if (n.lineAxis === 'r') cset = [cset[n.w]]; else rset = [rset[n.w]]; }
  for (const r of rset) for (const c of cset) idx.push(r * cols + c);
  return [{ l: n.l, key: n.key, idx: Int32Array.from(idx), rows: rset.length, cols: cset.length, rset, cset }];
}
export function gather(W, parts) { let n = 0; for (const p of parts) n += p.idx ? p.idx.length : W.layers[p.l][p.key].length; const out = new Float32Array(n); let o = 0;
  for (const p of parts) { const a = W.layers[p.l][p.key]; if (p.idx) for (const i of p.idx) out[o++] = a[i]; else { out.set(a, o); o += a.length; } } return out; }
export function scatterSet(W, parts, vals) { let o = 0; for (const p of parts) { const a = W.layers[p.l][p.key]; if (p.idx) for (const i of p.idx) a[i] = vals[o++]; else for (let i = 0; i < a.length; i++) a[i] = vals[o++]; } }
export function scatterAdd(W, parts, dirVals, s) { let o = 0; for (const p of parts) { const a = W.layers[p.l][p.key]; if (p.idx) for (const i of p.idx) a[i] += s * dirVals[o++]; else for (let i = 0; i < a.length; i++) a[i] += s * dirVals[o++]; } }
export function gatherGrad(G, parts) { return gather(G, parts); }
export function count(W, parts) { return parts.reduce((s, p) => s + (p.idx ? p.idx.length : W.layers[p.l][p.key].length), 0); }
// 2-D view of the node's parameters for spectral metrics (null for vectors)
export function matrixView(W, n) { const lv = level(n); if (lv < 3) return null; const [rows, cols] = shapeOf(W, n.key); if (rows === 1) return null; if (lv === 3) return { a: W.layers[n.l][n.key], rows, cols };
  const p = resolve(W, n)[0]; if (p.rows < 2 || p.cols < 2) return null; return { a: gather(W, [p]), rows: p.rows, cols: p.cols }; }
// parse / format node paths like "L3.attn.q.H5.r2.w17"
export function toPath(n) { return label(n).slice(1).join('.'); }
export function fromPath(s) { const n = {}; if (!s || s === 'model') return n; for (const t of s.split('.')) { let m;
  if ((m = t.match(/^L(\d+)$/))) n.l = +m[1]; else if (SUB[t]) n.sub = t; else if (/^(q|k|v|o|ob|fc|fcb|proj|projb|ln[12][wb])$/.test(t)) { n.key = t; if (!n.sub) n.sub = Object.keys(SUB).find((s2) => SUB[s2].includes(t)); }
  else if ((m = t.match(/^[HNi](\d+)$/))) n.unit = +m[1]; else if ((m = t.match(/^([rc])(\d+)$/))) { n.lineAxis = m[1]; n.line = +m[2]; } else if ((m = t.match(/^w(\d+)$/))) n.w = +m[1]; else throw new Error('bad path segment ' + t); } return n; }

// ── inspector: everything measured on the same parameter set ──
import { forward, logitsAt, grad } from './grad.js?v=7';
import { moments, spectral } from './science.js?v=7';
function tokenLosses(W, ids) { const A = forward(W, ids), out = []; for (let t = 0; t < ids.length - 1; t++) { const lg = logitsAt(W, A, t); let m = -Infinity; for (const x of lg) if (x > m) m = x; let z = 0; for (const x of lg) z += Math.exp(x - m); out.push(m + Math.log(z) - lg[ids[t + 1]]); } return out; }
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
export function inspect(W, n, docs, { eps = 1e-2, spectralMax = 300000, tok = null } = {}) {
  const parts = resolve(W, n), theta = gather(W, parts), N = theta.length, res = { path: toPath(n) || 'model', level: LEVELS[level(n)], count: N, stats: moments(theta) };
  const mv = matrixView(W, n); if (mv && mv.rows * mv.cols <= spectralMax && Math.min(mv.rows, mv.cols) >= 2) { const sp = spectral(mv.a, mv.rows, mv.cols); res.spectral = { ...sp, S: Array.from(sp.S).slice(0, 64), shape: [mv.rows, mv.cols] }; }
  // gradients / Fisher / saliency on the docs (mean next-token CE)
  let gsum = new Float64Array(N), g2 = new Float64Array(N), base = []; for (const ids of docs) { const r = grad(W, ids, { kind: 'ce' }, { weights: true }); const g = gather(r.G, parts); for (let i = 0; i < N; i++) { gsum[i] += g[i] / docs.length; g2[i] += g[i] * g[i] / docs.length; } base.push(r.value); }
  let gn = 0, fis = 0, sal = 0, gu = 0, tn = 0; for (let i = 0; i < N; i++) { gn += gsum[i] ** 2; fis += g2[i]; sal += Math.abs(theta[i] * gsum[i]); tn += theta[i] ** 2; } tn = Math.sqrt(tn);
  for (let i = 0; i < N; i++) gu += gsum[i] * theta[i] / (tn || 1);
  const L0 = mean(base), lossAt = (s, dir) => { scatterAdd(W, parts, dir, s); try { return mean(docs.map((ids) => grad(W, ids, { kind: 'ce' }).value)); } finally { scatterSet(W, parts, theta); } };
  const u = theta.map((x) => x / (tn || 1)), step = eps * (tn / Math.sqrt(N) || 1) * Math.sqrt(N);
  const fd = tn ? (lossAt(step, u) - lossAt(-step, u)) / (2 * step) : 0;
  res.grad = { loss: L0, gradNorm: Math.sqrt(gn), fisherTrace: fis, fisherMean: fis / N, saliency: sal, dirDeriv: gu, finiteDiff: fd, fdStep: step, fdRelErr: Math.abs(fd - gu) / Math.max(1e-9, Math.abs(gu)) };
  // ablation (zero the set) + per-token provenance
  const tlBase = docs.map((ids) => tokenLosses(W, ids)), saved = theta.slice(); scatterAdd(W, parts, saved, -1);
  let tlAbl; try { tlAbl = docs.map((ids) => tokenLosses(W, ids)); } finally { scatterSet(W, parts, saved); }
  const deltas = []; docs.forEach((ids, di) => tlBase[di].forEach((b, t) => deltas.push({ doc: di, t, tok: ids[t + 1], ctx: ids[t], d: tlAbl[di][t] - b })));
  res.ablation = { dLoss: mean(deltas.map((x) => x.d)), maxUp: Math.max(...deltas.map((x) => x.d)), n: deltas.length };
  deltas.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)); res.provenance = deltas.slice(0, 12).map((x) => ({ ...x, str: tok ? tok.tokenStr(x.tok) : String(x.tok), ctxStr: tok ? tok.tokenStr(x.ctx) : String(x.ctx) }));
  // unit-level logit provenance through the tied unembedding (ignores later layers — direct path only)
  if (n.unit != null && n.sub === 'mlp') { const { d, V } = dims(W), P = W.layers[n.l], col = new Float32Array(d); for (let i = 0; i < d; i++) col[i] = P.proj[i * dims(W).ff + n.unit]; res.logitDirect = topTokens(W, col, d, V, tok); }
  if (n.unit != null && n.sub === 'attn') { const { d, hd, V } = dims(W), P = W.layers[n.l]; let best = null; // top singular output direction of O_h
    const col = new Float32Array(d); for (let c = 0; c < hd; c++) { let nn = 0; for (let i = 0; i < d; i++) nn += P.o[i * d + n.unit * hd + c] ** 2; if (!best || nn > best[1]) best = [c, nn]; } for (let i = 0; i < d; i++) col[i] = P.o[i * d + n.unit * hd + best[0]]; res.logitDirect = topTokens(W, col, d, V, tok); res.logitDirect.note = `largest-norm column ${best[0]} of O_h`; }
  return res;
}
function topTokens(W, dir, d, V, tok, k = 8) { const sc = new Float32Array(V); for (let v = 0; v < V; v++) { let s = 0; for (let i = 0; i < d; i++) s += W.wte[v * d + i] * dir[i]; sc[v] = s; } const idx = [...sc.keys()].sort((a, b) => sc[b] - sc[a]); const f = (i) => ({ id: i, s: sc[i], str: tok ? tok.tokenStr(i) : String(i) }); return { up: idx.slice(0, k).map(f), down: idx.slice(-k).reverse().map(f) }; }

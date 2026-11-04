// Tiny GPT-Neo config + seeded weights shared by the Eshkol AD cross-check (tools/eshkol-ad-crosscheck.mjs writes the
// golden data/eshkol_ad_golden.json from Eshkol's tape; test/eshkol-ad.test.mjs and claim C7a compare grad.js against it).
export const TINY = { d: 8, H: 2, hd: 4, L: 2, ff: 16, V: 13, window: 256, eps: 1e-5 }, IDS = [3, 7, 1, 12, 7, 5];
export const KEYS = ['ln1w', 'ln1b', 'q', 'k', 'v', 'o', 'ob', 'ln2w', 'ln2b', 'fc', 'fcb', 'proj', 'projb'];
export function tinyWeights(seed = 7) { let s = seed >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 - 0.5; };
  const { d, ff, V, L } = TINY, T = IDS.length, f = (n, sc, off = 0) => Float32Array.from({ length: n }, () => off + sc * r());
  const sz = { ln1w: d, ln1b: d, q: d * d, k: d * d, v: d * d, o: d * d, ob: d, ln2w: d, ln2b: d, fc: ff * d, fcb: ff, proj: d * ff, projb: d };
  return { cfg: TINY, wte: f(V * d, 1.2), wpe: f(T * d, 0.4), lnfW: f(d, 0.3, 1), lnfB: f(d, 0.2), layers: Array.from({ length: L }, () => Object.fromEntries(KEYS.map((k) => [k, k.startsWith('ln') && k.endsWith('w') ? f(sz[k], 0.3, 1) : f(sz[k], 0.9)]))) }; }
export const flat = (W) => [W.wte, W.wpe, W.lnfW, W.lnfB, ...W.layers.flatMap((P) => KEYS.map((k) => P[k]))].flatMap((a) => Array.from(a));
export function compare(grad, golden) { const W = tinyWeights(golden.seed), r = grad(W, IDS, { kind: 'ce' }, { weights: true, unembed: true }), g = r.G;
  const mine = flat(g); let mx = 0, err = 0; for (let i = 0; i < mine.length; i++) { mx = Math.max(mx, Math.abs(golden.grads[i])); err = Math.max(err, Math.abs(mine[i] - golden.grads[i])); }
  return { n: mine.length, nGolden: golden.grads.length, err, maxAbs: mx, loss: r.value, lossGolden: golden.loss, ok: mine.length === golden.grads.length && err <= 1e-5 * mx && Math.abs(r.value - golden.loss) < 1e-5 }; }

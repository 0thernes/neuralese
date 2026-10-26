// v11 P5: grokking on a + b mod p (Power et al. 2022; MLP construction after Gromov 2023), trainable in the browser.
// Model: h = W1a[:, a] + W1b[:, b] (N hidden), φ(h) = h², logits = W2 φ(h) / N. Full-batch AdamW, cross-entropy.
// Config list (the FIRST entry is the pre-registered one; see docs/PREREG-v11.md P5).
import { rng, gauss } from './core.js?v=13';
export const CONFIGS = [{ p: 31, N: 256, lr: 3e-3, wd: 1.0, frac: 0.5, steps: 6000, seed: 1 }];
export function init(cfg = CONFIGS[0]) { const { p, N, seed, frac } = cfg, r = rng(seed); const W1a = new Float64Array(N * p), W1b = new Float64Array(N * p), W2 = new Float64Array(p * N);
  for (let i = 0; i < W1a.length; i++) { W1a[i] = gauss(r); W1b[i] = gauss(r); } for (let i = 0; i < W2.length; i++) W2[i] = gauss(r);
  const pairs = []; for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) pairs.push([a, b]); for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }
  const nTr = Math.round(frac * pairs.length); const P = [W1a, W1b, W2];
  return { cfg, P, m: P.map((x) => new Float64Array(x.length)), v: P.map((x) => new Float64Array(x.length)), t: 0, train: pairs.slice(0, nTr), test: pairs.slice(nTr), log: [] }; }
function pass(S, set, grads) { const { p, N } = S.cfg, [W1a, W1b, W2] = S.P, h = new Float64Array(N), z = new Float64Array(p); let loss = 0, correct = 0;
  for (const [a, b] of set) { const y = (a + b) % p; for (let j = 0; j < N; j++) h[j] = W1a[j * p + a] + W1b[j * p + b];
    let mx = -Infinity, arg = 0; for (let k = 0; k < p; k++) { let s = 0; for (let j = 0; j < N; j++) s += W2[k * N + j] * h[j] * h[j]; z[k] = s / N; if (z[k] > mx) { mx = z[k]; arg = k; } }
    let se = 0; for (let k = 0; k < p; k++) se += Math.exp(z[k] - mx); loss += mx + Math.log(se) - z[y]; if (arg === y) correct++;
    if (grads) { const [gA, gB, g2] = grads; for (let k = 0; k < p; k++) { const dz = (Math.exp(z[k] - mx) / se - (k === y ? 1 : 0)) / set.length / N; if (!dz) continue; for (let j = 0; j < N; j++) g2[k * N + j] += dz * h[j] * h[j]; }
      for (let j = 0; j < N; j++) { let dphi = 0; for (let k = 0; k < p; k++) dphi += (Math.exp(z[k] - mx) / se - (k === y ? 1 : 0)) * W2[k * N + j]; const dh = dphi * 2 * h[j] / set.length / N; gA[j * p + a] += dh; gB[j * p + b] += dh; } } }
  return { loss: loss / set.length, acc: correct / set.length }; }
export const evaluate = (S, set) => pass(S, set, null);
export function step(S) { const G = S.P.map((x) => new Float64Array(x.length)); const tr = pass(S, S.train, G); S.t++; const { lr, wd } = S.cfg, b1 = 0.9, b2 = 0.98, eps = 1e-8;
  for (let q = 0; q < 3; q++) { const P = S.P[q], g = G[q], m = S.m[q], v = S.v[q]; for (let i = 0; i < P.length; i++) { m[i] = b1 * m[i] + (1 - b1) * g[i]; v[i] = b2 * v[i] + (1 - b2) * g[i] * g[i];
    P[i] -= lr * ((m[i] / (1 - b1 ** S.t)) / (Math.sqrt(v[i] / (1 - b2 ** S.t)) + eps) + wd * P[i]); } } return tr; }
// Per-neuron Fourier concentration of the a-input weights: share of non-DC power in the single strongest frequency.
export function fourier(S) { const { p, N } = S.cfg, W = S.P[0], K = (p - 1) / 2, share = [], freq = [], spectrum = new Float64Array(K + 1);
  for (let j = 0; j < N; j++) { const pw = new Float64Array(K + 1); for (let k = 1; k <= K; k++) { let c = 0, s = 0; for (let a = 0; a < p; a++) { c += W[j * p + a] * Math.cos(2 * Math.PI * k * a / p); s += W[j * p + a] * Math.sin(2 * Math.PI * k * a / p); } pw[k] = c * c + s * s; spectrum[k] += pw[k]; }
    let tot = 0, best = 1; for (let k = 1; k <= K; k++) { tot += pw[k]; if (pw[k] > pw[best]) best = k; } share.push(pw[best] / tot); freq.push(best); }
  return { share, freq, spectrum: Array.from(spectrum), fracConcentrated: share.filter((x) => x >= 0.5).length / N }; }
export function run(cfg = CONFIGS[0], every = 50, onLog = null) { const S = init(cfg); const f0 = fourier(S); let sMem = null, sGen = null;
  for (let s = 1; s <= cfg.steps; s++) { step(S); if (s % every === 0 || s === 1) { const tr2 = evaluate(S, S.train), te = evaluate(S, S.test), e = { step: s, trainLoss: tr2.loss, trainAcc: tr2.acc, testLoss: te.loss, testAcc: te.acc }; S.log.push(e); if (sMem === null && tr2.acc >= 0.99) sMem = s; if (sGen === null && te.acc >= 0.95) sGen = s; if (onLog) onLog(e, S); } }
  return { cfg, log: S.log, sMem, sGen, fourierInit: f0, fourierFinal: fourier(S), S }; }
export const _pass = pass;

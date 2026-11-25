// Small spectral and scoring helpers. Tested against hand-computed values in test/analytics.test.mjs.
// Jacobi SVD is the same routine the weight lab uses.
import { svd } from './linalg.js';

function rng(seed) {
  let x = seed >>> 0;
  return () => { x = (Math.imul(1664525, x) + 1013904223) >>> 0; return x / 4294967296; };
}

export function spectralEntropy(s) {
  let z = 0;
  for (const v of s) z += v * v;
  if (!(z > 0)) return 0;
  let h = 0;
  for (const v of s) { const p = (v * v) / z; if (p > 0) h -= p * Math.log(p); }
  return h;
}
export function effectiveRank(s) { return Math.exp(spectralEntropy(s)); }
export function conditionNumber(s) {
  const pos = [...s].filter((v) => v > 0);
  if (!pos.length) return Infinity;
  return Math.max(...pos) / Math.min(...pos);
}
export function ols(xs, ys) {
  const n = xs.length;
  if (!n) return { slope: 0, intercept: 0, r2: 0, n: 0 };
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  let num = 0, den = 0, sst = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; sst += (ys[i] - my) ** 2; }
  const slope = den ? num / den : 0;
  const intercept = my - slope * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i] - (intercept + slope * xs[i])) ** 2;
  return { slope, intercept, r2: sst ? 1 - sse / sst : 1, n };
}
export function powerLawFit(s) {
  const xs = [], ys = [];
  for (let i = 0; i < s.length; i++) if (s[i] > 0) { xs.push(Math.log(i + 1)); ys.push(Math.log(s[i])); }
  return ols(xs, ys);
}
export function spectrum(values, rows, cols) {
  const { S } = svd(values, rows, cols);
  const singularValues = [...S].filter((v) => Number.isFinite(v)).sort((a, b) => b - a);
  return {
    singularValues,
    spectralEntropyNats: spectralEntropy(singularValues),
    effectiveRank: effectiveRank(singularValues),
    conditionNumber: conditionNumber(singularValues),
    powerLaw: powerLawFit(singularValues),
    rows, cols, n: rows * cols,
    method: 'one-sided Jacobi SVD; H is Shannon entropy of s^2/||s||^2 in nats; effective rank is exp(H); condition number is s_max/s_min over positive values; power law is OLS of log singular-value on log rank',
    unit: 'singular value, same unit as the matrix',
  };
}
export function kl(p, q) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] === 0) continue;
    if (!(q[i] > 0)) return Infinity;
    s += p[i] * Math.log(p[i] / q[i]);
  }
  return s;
}
export function jsDivergence(p, q) {
  const m = p.map((v, i) => 0.5 * (v + q[i]));
  return 0.5 * kl(p, m) + 0.5 * kl(q, m);
}
export function auroc(scores, labels) {
  const P = labels.reduce((a, b) => a + (b === 1 ? 1 : 0), 0);
  const N = labels.length - P;
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  let tp = 0, fp = 0, area = 0, prevF = 0, prevT = 0;
  for (const i of order) {
    if (labels[i] === 1) tp++; else fp++;
    const fpr = N ? fp / N : 0, tpr = P ? tp / P : 0;
    area += (fpr - prevF) * (tpr + prevT) / 2;
    prevF = fpr; prevT = tpr;
  }
  return { auroc: area, n: labels.length, positives: P, negatives: N, method: 'trapezoid on the ROC from sorting scores descending' };
}
export function signFlipP(diffs) {
  const n = diffs.length;
  const stat = Math.abs(diffs.reduce((a, b) => a + b, 0));
  const N = 1 << n;
  let ge = 0;
  for (let m = 0; m < N; m++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += (m >> i) & 1 ? -diffs[i] : diffs[i];
    if (Math.abs(s) >= stat - 1e-12) ge++;
  }
  return { p: ge / N, n, trials: N, method: 'exact two-sided sign-flip of paired differences' };
}
export function powerIteration(matvec, n, iters = 32, seed = 1) {
  const r = rng(seed);
  let x = Array.from({ length: n }, () => r() * 2 - 1);
  let lambda = 0;
  for (let it = 0; it < iters; it++) {
    const y = matvec(x);
    let ny = 0, num = 0, den = 0;
    for (let i = 0; i < n; i++) { ny += y[i] * y[i]; num += x[i] * y[i]; den += x[i] * x[i]; }
    lambda = num / (den || 1);
    ny = Math.sqrt(ny) || 1;
    x = y.map((v) => v / ny);
  }
  return { lambda, vector: x, iters, n, method: 'power iteration, Rayleigh quotient' };
}
export function csv(headers, rows) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
  return [headers.map(esc).join(','), ...rows.map((row) => row.map(esc).join(','))].join('\n') + '\n';
}

export const FORMULAS = {
  entropy: 'H(p)=-\\sum_i p_i\\log p_i',
  effectiveRank: '\\mathrm{erank}=\\exp(H)',
  condition: '\\kappa=s_{\\max}/s_{\\min}',
  powerLaw: '\\log s_r = a + b\\log r',
  kl: 'D_{\\mathrm{KL}}(p\\|q)=\\sum_i p_i\\log(p_i/q_i)',
  auroc: '\\mathrm{AUROC}=\\int_0^1 \\mathrm{TPR}\\,d\\mathrm{FPR}',
};

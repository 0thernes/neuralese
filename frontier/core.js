// v11 FRONTIER shared core: null models, cross-entropy, statistics, LZ76 complexity. Pure ES module (Node + browser).
import { forward, logitsAt } from '../grad.js?v=12';
export const SPLITS = { propose: [...Array(14).keys()], select: [...Array(13).keys()].map((i) => i + 14), test: [...Array(13).keys()].map((i) => i + 27) };
export function rng(seed = 1) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
const mapW = (W, f) => { const o = { cfg: W.cfg, wte: f(W.wte, 'wte'), wpe: f(W.wpe, 'wpe'), lnfW: f(W.lnfW, 'lnfW'), lnfB: f(W.lnfB, 'lnfB'), layers: W.layers.map((P) => Object.fromEntries(Object.entries(P).map(([k, a]) => [k, f(a, k)]))) }; return o; };
// GPT-Neo init: weights N(0, 0.02²), biases 0, LayerNorm gain 1.
export function randomInit(W, seed = 1) { const r = rng(seed); return mapW(W, (a, k) => { const o = new Float32Array(a.length); if (/^ln.*w$|^lnfW$/.test(k)) o.fill(1); else if (/b$|^lnfB$/.test(k)) o.fill(0); else for (let i = 0; i < o.length; i++) o[i] = 0.02 * gauss(r); return o; }); }
// Each tensor independently permuted (Fisher–Yates): same value distribution, no structure.
export function shuffled(W, seed = 1) { const r = rng(seed); return mapW(W, (a) => { const o = Float32Array.from(a); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = o[i]; o[i] = o[j]; o[j] = t; } return o; }); }
export function lse(l) { let m = -Infinity; for (let i = 0; i < l.length; i++) if (l[i] > m) m = l[i]; let s = 0; for (let i = 0; i < l.length; i++) s += Math.exp(l[i] - m); return m + Math.log(s); }
// Per-position next-token CE (nats) for positions [lo, hi).
export function ceVec(W, A, lo = 0, hi = A.T - 1) { const out = []; for (let t = lo; t < hi; t++) { const l = logitsAt(W, A, t); out.push(lse(l) - l[A.ids[t + 1]]); } return out; }
export function entropyAt(W, A, t) { const l = logitsAt(W, A, t), z = lse(l); let h = 0; for (let i = 0; i < l.length; i++) { const lp = l[i] - z; h -= Math.exp(lp) * lp; } return h; }
export const mean = (x) => x.reduce((a, b) => a + b, 0) / x.length;
export const sd = (x) => { const m = mean(x); return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1)); };
export function bootCI(groups, stat = mean, B = 2000, seed = 7) { const r = rng(seed), n = groups.length, vals = []; for (let b = 0; b < B; b++) { const s = []; for (let i = 0; i < n; i++) s.push(groups[Math.floor(r() * n)]); vals.push(stat(s)); } vals.sort((a, b) => a - b); return { est: stat(groups), lo: vals[Math.floor(0.025 * B)], hi: vals[Math.floor(0.975 * B) - 1] }; }
export function rank(x) { const idx = x.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]), r = new Array(x.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2; i = j + 1; } return r; }
export function pearson(a, b) { const ma = mean(a), mb = mean(b); let s = 0, sa = 0, sb = 0; for (let i = 0; i < a.length; i++) { s += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; } return s / Math.sqrt(sa * sb); }
export const spearman = (a, b) => pearson(rank(a), rank(b));
// Student-t one-sided p for mean(x) < 0 (normal approximation of the t tail is NOT used: exact via regularized incomplete beta).
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; d = 1 / d; let h = d; for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; }
function lgamma(z) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let x = z, y = z, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); } // eslint-disable-line no-loss-of-precision -- Numerical Recipes coefficients, quoted verbatim
export function ibeta(x, a, b) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
export function tLess(x) { const n = x.length, m = mean(x), s = sd(x), t = m / (s / Math.sqrt(n)), df = n - 1, p2 = ibeta(df / (df + t * t), df / 2, 0.5); return { t, df, p: t < 0 ? p2 / 2 : 1 - p2 / 2 }; }
// Lempel–Ziv 1976 complexity (Kaspar–Schuster counting) of a 0/1 array; PCI normalisation as in Casali et al. 2013.
export function lz76(s) { const n = s.length; if (n < 2) return n; let c = 1, l = 1, i = 0, k = 1, kmax = 1; for (;;) { if (s[i + k - 1] === s[l + k - 1]) { k++; if (l + k > n) { c++; break; } } else { if (k > kmax) kmax = k; i++; if (i === l) { c++; l += kmax; if (l + 1 > n) break; i = 0; k = 1; kmax = 1; } else k = 1; } } return c; }
export function pciNorm(bits) { const n = bits.length; let ones = 0; for (const b of bits) ones += b; const p = ones / n; if (p === 0 || p === 1) return 0; const H = -p * Math.log2(p) - (1 - p) * Math.log2(1 - p); return lz76(bits) * Math.log2(n) / (n * H); }
export { forward, logitsAt };

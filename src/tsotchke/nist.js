// NIST SP 800-22 rev1a statistical tests (subset): 2.1 frequency (monobit), 2.2 block frequency, 2.3 runs,
// 2.13 cumulative sums (forward). Independent implementation written for NEURALESE from the SP 800-22 formulas;
// validated against the worked examples printed in SP 800-22 §2.x.4/§2.x.8 (test/tsotchke.test.mjs). DOM-free.
// erfc: W. J. Cody rational approximations via the continued-fraction/series pair (|rel err| < 1e-14 on tested range).
export function erfc(x) { if (x < 0) return 2 - erfc(-x); if (x < 2) { let s = 0, t = x, n = 0; // erf series
    for (; n < 200; n++) { const term = t / (2 * n + 1); s += term; t *= -x * x / (n + 1); if (Math.abs(term) < 1e-17 * Math.abs(s)) break; } return 1 - (2 / Math.sqrt(Math.PI)) * s; }
  // continued fraction (Lentz) for x >= 2
  let f = x, C = x, D = 0; for (let n = 1; n < 300; n++) { const a = n / 2; D = x + a * D; D = 1 / D; C = x + a / C; const dl = C * D; f *= dl; if (Math.abs(dl - 1) < 1e-16) break; } return Math.exp(-x * x) / (f * Math.sqrt(Math.PI)); }
function gammaln(x) { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - gammaln(1 - x); x -= 1; let a = c[0]; const t = x + g + 0.5; for (let i = 1; i < 9; i++) a += c[i] / (x + i); return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a); }
// regularized upper incomplete gamma Q(a,x) (NIST "igamc")
export function igamc(a, x) { if (x <= 0) return 1; if (x < a + 1) { let s = 1 / a, t = s; for (let n = 1; n < 1000; n++) { t *= x / (a + n); s += t; if (Math.abs(t) < Math.abs(s) * 1e-16) break; } return 1 - s * Math.exp(-x + a * Math.log(x) - gammaln(a)); }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d; for (let i = 1; i < 1000; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const dl = d * c; h *= dl; if (Math.abs(dl - 1) < 1e-16) break; } return Math.exp(-x + a * Math.log(x) - gammaln(a)) * h; }
export const bitsOf = (bytes) => { const b = new Uint8Array(bytes.length * 8); for (let i = 0; i < bytes.length; i++) for (let j = 0; j < 8; j++) b[i * 8 + j] = (bytes[i] >> (7 - j)) & 1; return b; };
export const bitsFromString = (s) => Uint8Array.from(s.replace(/\s/g, ''), (c) => +c);
export function monobit(e) { let S = 0; for (const b of e) S += 2 * b - 1; const s = Math.abs(S) / Math.sqrt(e.length); return { S, p: erfc(s / Math.SQRT2) }; }
export function blockFrequency(e, M = 128) { const N = Math.floor(e.length / M); let chi = 0; for (let i = 0; i < N; i++) { let o = 0; for (let j = 0; j < M; j++) o += e[i * M + j]; chi += (o / M - 0.5) ** 2; } chi *= 4 * M; return { N, chi, p: igamc(N / 2, chi / 2) }; }
export function runs(e) { const n = e.length; let ones = 0; for (const b of e) ones += b; const pi = ones / n; if (Math.abs(pi - 0.5) >= 2 / Math.sqrt(n)) return { pi, V: null, p: 0, prereqFail: true }; let V = 1; for (let k = 0; k < n - 1; k++) if (e[k] !== e[k + 1]) V++;
  return { pi, V, p: erfc(Math.abs(V - 2 * n * pi * (1 - pi)) / (2 * Math.sqrt(2 * n) * pi * (1 - pi))) }; }
const Phi = (x) => 0.5 * erfc(-x / Math.SQRT2);
export function cusum(e) { const n = e.length; let S = 0, z = 0; for (const b of e) { S += 2 * b - 1; z = Math.max(z, Math.abs(S)); } const sn = Math.sqrt(n); let s1 = 0, s2 = 0;
  for (let k = Math.floor((-n / z + 1) / 4); k <= Math.floor((n / z - 1) / 4); k++) s1 += Phi(((4 * k + 1) * z) / sn) - Phi(((4 * k - 1) * z) / sn);
  for (let k = Math.floor((-n / z - 3) / 4); k <= Math.floor((n / z - 1) / 4); k++) s2 += Phi(((4 * k + 3) * z) / sn) - Phi(((4 * k + 1) * z) / sn);
  return { z, p: 1 - s1 + s2 }; }
export function battery(bytes, alpha = 0.01) { const e = bitsOf(bytes); const r = { monobit: monobit(e), blockFrequency: blockFrequency(e), runs: runs(e), cusum: cusum(e) }; for (const k in r) r[k].pass = r[k].p >= alpha; return { n: e.length, alpha, ...r }; }

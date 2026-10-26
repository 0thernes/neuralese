// Univariate truncated-Taylor ("jet") arithmetic to order K — a faithful JavaScript port of the recurrence table in
// tsotchke/eshkol lib/core/taylor_recurrences.def (commit 341ac812, MIT, © 2025 tsotchke), design in
// docs/design/AD_TAYLOR_TOWER.md. A jet stores Taylor coefficients c[k] = f^(k)(x0)/k!, so f^(k) = k!·c[k].
// Only the recurrences are ported (no Eshkol compiler/runtime code); perturbation tags, exact/bignum coefficients and
// Taylor models are NOT ported. DOM-free; used by the TAYLOR tab and test/tsotchke.test.mjs.
export const SOURCE = { repo: 'tsotchke/eshkol', commit: '341ac812ed600fd9d27c28e9509d66ab71363947', file: 'lib/core/taylor_recurrences.def', license: 'MIT' };
export const K_MAX = 16;
export class Jet {
  constructor(c) { this.c = Float64Array.from(c); }
  static const(x, K) { const c = new Float64Array(K + 1); c[0] = x; return new Jet(c); }
  static vari(x, K) { const c = new Float64Array(K + 1); c[0] = x; if (K >= 1) c[1] = 1; return new Jet(c); }
  get K() { return this.c.length - 1; }
  deriv(k) { let f = 1; for (let i = 2; i <= k; i++) f *= i; return this.c[k] * f; }
}
const J = (x, K) => (x instanceof Jet ? x : Jet.const(x, K));
const Kof = (...a) => Math.max(...a.map((x) => (x instanceof Jet ? x.K : 0)));
// --- binary rows: add sub mul div ---
export const add = (u, w) => { const K = Kof(u, w); u = J(u, K); w = J(w, K); return new Jet(u.c.map((x, k) => x + w.c[k])); };
export const sub = (u, w) => { const K = Kof(u, w); u = J(u, K); w = J(w, K); return new Jet(u.c.map((x, k) => x - w.c[k])); };
export const mul = (u, w) => { const K = Kof(u, w); u = J(u, K); w = J(w, K); const s = new Float64Array(K + 1); for (let k = 0; k <= K; k++) { let t = 0; for (let j = 0; j <= k; j++) t += u.c[j] * w.c[k - j]; s[k] = t; } return new Jet(s); };
export const div = (u, w) => { const K = Kof(u, w); u = J(u, K); w = J(w, K); const s = new Float64Array(K + 1); for (let k = 0; k <= K; k++) { let t = u.c[k]; for (let j = 1; j <= k; j++) t -= w.c[j] * s[k - j]; s[k] = t / w.c[0]; } return new Jet(s); };
// --- unary rows ---
export const neg = (u) => new Jet(u.c.map((x) => -x));
export function exp(u) { const K = u.K, s = new Float64Array(K + 1); s[0] = Math.exp(u.c[0]); for (let k = 1; k <= K; k++) { let t = 0; for (let j = 1; j <= k; j++) t += j * u.c[j] * s[k - j]; s[k] = t / k; } return new Jet(s); }
export function log(u) { const K = u.K, s = new Float64Array(K + 1); s[0] = Math.log(u.c[0]); for (let k = 1; k <= K; k++) { let t = 0; for (let j = 1; j < k; j++) t += j * s[j] * u.c[k - j]; s[k] = (u.c[k] - t / k) / u.c[0]; } return new Jet(s); }
export function sincos(u) { const K = u.K, s = new Float64Array(K + 1), c = new Float64Array(K + 1); s[0] = Math.sin(u.c[0]); c[0] = Math.cos(u.c[0]); for (let k = 1; k <= K; k++) { let a = 0, b = 0; for (let j = 1; j <= k; j++) { a += j * u.c[j] * c[k - j]; b += j * u.c[j] * s[k - j]; } s[k] = a / k; c[k] = -b / k; } return [new Jet(s), new Jet(c)]; }
export const sin = (u) => sincos(u)[0], cos = (u) => sincos(u)[1];
export const tan = (u) => { const [s, c] = sincos(u); return div(s, c); };
// power recurrence for constant r (row `pow`, constant-exponent branch): s_k = (1/(k u0)) Σ_{j=1..k} ((r+1)j − k) u_j s_{k−j}
export function powc(u, r) { const K = u.K, s = new Float64Array(K + 1); s[0] = Math.pow(u.c[0], r); for (let k = 1; k <= K; k++) { let t = 0; for (let j = 1; j <= k; j++) t += ((r + 1) * j - k) * u.c[j] * s[k - j]; s[k] = t / (k * u.c[0]); } return new Jet(s); }
export const sqrt = (u) => powc(u, 0.5);
export const sinh = (u) => { const e = exp(u), f = exp(neg(u)); return new Jet(e.c.map((x, k) => (x - f.c[k]) / 2)); };
export const cosh = (u) => { const e = exp(u), f = exp(neg(u)); return new Jet(e.c.map((x, k) => (x + f.c[k]) / 2)); };
export const tanh = (u) => div(sinh(u), cosh(u));
export const sigmoid = (u) => div(1, add(1, exp(neg(u))));
export const relu = (u) => (u.c[0] > 0 ? new Jet(u.c) : Jet.const(0, u.K));
// integral family: s_0 = f(u_0), s_k = (1/k) Σ_{j=1..k} j u_j d_{k−j}, d = f'(u) as a series
const integ = (u, f0, d) => { const K = u.K, s = new Float64Array(K + 1); s[0] = f0; for (let k = 1; k <= K; k++) { let t = 0; for (let j = 1; j <= k; j++) t += j * u.c[j] * d.c[k - j]; s[k] = t / k; } return new Jet(s); };
export const atan = (u) => integ(u, Math.atan(u.c[0]), div(1, add(1, mul(u, u))));
export const asin = (u) => integ(u, Math.asin(u.c[0]), powc(sub(1, mul(u, u)), -0.5));
// The d=8 analytic self-test rows (same functions and test points as the TAYLOR_UN rows of the .def table).
export const SELFTEST = [['exp', exp, Math.exp, 0.5], ['log', log, Math.log, 1.3], ['sin', sin, Math.sin, 0.7], ['cos', cos, Math.cos, 0.7], ['tan', tan, Math.tan, 0.4], ['sqrt', sqrt, Math.sqrt, 2.0], ['sinh', sinh, Math.sinh, 0.6], ['cosh', cosh, Math.cosh, 0.6], ['tanh', tanh, Math.tanh, 0.6], ['sigmoid', sigmoid, (x) => 1 / (1 + Math.exp(-x)), 0.6], ['atan', atan, Math.atan, 0.7], ['asin', asin, Math.asin, 0.3]];
// Closed-form k-th derivatives (exact references) for rows where one exists.
const fact = (k) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return f; };
export const CLOSED = { exp: (x, k) => Math.exp(x), log: (x, k) => (k === 0 ? Math.log(x) : ((k % 2 ? 1 : -1) * fact(k - 1)) / x ** k), sin: (x, k) => Math.sin(x + (k * Math.PI) / 2), cos: (x, k) => Math.cos(x + (k * Math.PI) / 2),
  sqrt: (x, k) => { let c = 1; for (let i = 0; i < k; i++) c *= 0.5 - i; return c * x ** (0.5 - k); }, sinh: (x, k) => (k % 2 ? Math.cosh(x) : Math.sinh(x)), cosh: (x, k) => (k % 2 ? Math.sinh(x) : Math.cosh(x)) };
// Algebraic identities that must hold coefficient-by-coefficient (all orders) if every recurrence is right.
export const IDENTITIES = [
  ['sin²+cos² = 1', (u) => add(mul(sin(u), sin(u)), mul(cos(u), cos(u))), () => 1],
  ['exp(log u) = u', (u) => exp(log(u)), (u) => u], ['cosh²−sinh² = 1', (u) => sub(mul(cosh(u), cosh(u)), mul(sinh(u), sinh(u))), () => 1],
  ['σ(u)+σ(−u) = 1', (u) => add(sigmoid(u), sigmoid(neg(u))), () => 1], ['atan(tan u) = u', (u) => atan(tan(u)), (u) => u], ['asin(sin u) = u', (u) => asin(sin(u)), (u) => u],
  ['(√u)² = u', (u) => mul(sqrt(u), sqrt(u)), (u) => u], ['tanh = sinh/cosh, tanh·cosh = sinh', (u) => sub(mul(tanh(u), cosh(u)), sinh(u)), () => 0]];
export function selfTest(K = 8) {
  const rows = [];
  for (const [name, F, f, x0] of SELFTEST) { const jet = F(Jet.vari(x0, K)); let err = Math.abs(jet.c[0] - f(x0)), ref = 'primal';
    if (CLOSED[name]) { ref = 'closed form, k≤' + K; for (let k = 0; k <= K; k++) { const e = CLOSED[name](x0, k); err = Math.max(err, Math.abs(jet.deriv(k) - e) / (1 + Math.abs(e))); } }
    rows.push({ name, x0, ref, relErr: err }); }
  for (const [name, F, R] of IDENTITIES) { const x0 = 0.37, u = Jet.vari(x0, K), lhs = F(u), rhs = J(R(u), K); let err = 0; for (let k = 0; k <= K; k++) err = Math.max(err, Math.abs(lhs.c[k] - rhs.c[k])); rows.push({ name, x0, ref: 'identity, all ' + (K + 1) + ' coeffs', relErr: err }); }
  return rows;
}
// Directional Taylor expansion of mean next-token CE along a final-LayerNorm-weight direction v:
//   g(ε) = mean_t CE( softmax( wte · (LN(x_t)·(w + ε v) + b) ) ), returned as a K-jet (c_k = g^(k)(0)/k!).
// xPre is the residual stream entering ln_f (T×d). Logits are affine in ε, so each logit jet is [a, b, 0, …];
// log-sum-exp is evaluated with the ported exp/log recurrences in a numerically stable shifted form.
export function ceJetLnf(W, xPre, ids, v, K = 3) {
  const d = W.lnfW.length, V = W.wte.length / d, T = ids.length, eps = 1e-5; let acc = Jet.const(0, K);
  const n = new Float64Array(d), y0 = new Float64Array(d), y1 = new Float64Array(d), a = new Float64Array(V), b = new Float64Array(V);
  for (let t = 0; t < T - 1; t++) {
    let mu = 0; for (let i = 0; i < d; i++) mu += xPre[t * d + i]; mu /= d; let va = 0; for (let i = 0; i < d; i++) va += (xPre[t * d + i] - mu) ** 2; va /= d; const r = 1 / Math.sqrt(va + eps);
    for (let i = 0; i < d; i++) { n[i] = (xPre[t * d + i] - mu) * r; y0[i] = n[i] * W.lnfW[i] + W.lnfB[i]; y1[i] = n[i] * v[i]; }
    let m = -Infinity; for (let o = 0; o < V; o++) { let s0 = 0, s1 = 0; const off = o * d; for (let i = 0; i < d; i++) { s0 += W.wte[off + i] * y0[i]; s1 += W.wte[off + i] * y1[i]; } a[o] = s0; b[o] = s1; if (s0 > m) m = s0; }
    let Z = Jet.const(0, K); for (let o = 0; o < V; o++) { const u = Jet.const(a[o] - m, K); u.c[1] = b[o]; Z = add(Z, exp(u)); }
    const tg = ids[t + 1], lt = Jet.const(a[tg] - m, K); lt.c[1] = b[tg]; acc = add(acc, sub(log(Z), lt));
  }
  return new Jet(acc.c.map((x) => x / (T - 1)));
}
// v10: diff against Eshkol's REAL tr_* kernels (golden from wasm/eshkol_taylor/build.sh, data/eshkol_taylor_golden.json).
// Error = |Δ| / max(1, |coefficient|). Returns the worst case and the per-op maximum.
export function eshkolDiff(G) { const F = { exp, log, sin, cos, tan, sqrt, sinh, cosh, tanh, sigmoid, atan, asin, relu, mul, div }; let worst = { err: 0 }; const per = {};
  for (const c of G.cases) { const u = new Jet(Float64Array.from(c.u)), w = c.w.length ? new Jet(Float64Array.from(c.w)) : null, got = (w ? F[c.op](u, w) : F[c.op](u)).c;
    for (let k = 0; k < G.n; k++) { const e = Math.abs(got[k] - c.s[k]) / Math.max(1, Math.abs(c.s[k])); per[c.op] = Math.max(per[c.op] ?? 0, e); if (e > worst.err) worst = { err: e, op: c.op, k, u0: c.u[0] }; } }
  return { worst, per, cases: G.cases.length, ok: worst.err < 1e-12 }; }

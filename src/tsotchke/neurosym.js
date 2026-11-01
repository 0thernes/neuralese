// Port of Eshkol's lib/core/ml/neurosymbolic.esk (tsotchke/eshkol@341ac81, MIT): differentiable symbol embeddings and
// soft unification, soft-unify(a, b) = sigmoid(⟨e_a, e_b⟩ / √dim). Operation order follows the Scheme source (and the
// tape rules in lib/core/ad/tape.esk) so the port can be checked bit-for-bit against a real eshkol-run trace
// (data/eshkol_neurosym_golden.txt, produced by wasm/eshkol_neurosym/golden.esk; test N1, claim C9a).
export const SOURCE = { repo: 'tsotchke/eshkol', commit: '341ac812ed600fd9d27c28e9509d66ab71363947', file: 'lib/core/ml/neurosymbolic.esk', license: 'MIT' };
export const makeTable = (dim) => ({ dim, entries: new Map() });
const vdot = (a, b) => { let s = 0.0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
// djb2 over the symbol's characters (unbounded integers, as Eshkol promotes to bignum), then mod 2^31; LCG init.
function seedOf(sym) { let h = 5381n; for (const ch of sym) h = h * 33n + BigInt(ch.codePointAt(0)); return h % 2147483648n; }
function init(dim, seed) { const v = new Float64Array(dim); let s = seed; for (let i = 0; i < dim; i++) { const s2 = (s * 1103515245n + 12345n) % 2147483648n; v[i] = Number(s2 % 2000n) / 1000.0 - 1.0; s = s2; } return v; }
export function embed(tbl, sym) { let v = tbl.entries.get(sym); if (!v) { v = init(tbl.dim, seedOf(sym)); tbl.entries.set(sym, v); } return v; }
export const sigmoid = (z) => 1.0 / (1.0 + Math.exp(-z));
export function softUnify(tbl, a, b) { const va = embed(tbl, a), vb = embed(tbl, b), scale = 1.0 / Math.sqrt(tbl.dim); return sigmoid(scale * vdot(va, vb)); }
export function softUnifyLoss(tbl, a, b, target) { const c = softUnify(tbl, a, b); return (c - target) * (c - target); }
// One SGD step through the match (the tape's backward rules written out): returns the loss before the update.
export function softUnifyTrain(tbl, a, b, target, lr) { const va = embed(tbl, a), vb = embed(tbl, b), scale = 1.0 / Math.sqrt(tbl.dim);
  const dot = scale * vdot(va, vb), conf = sigmoid(dot), err = conf - target, loss = err * err;
  const gErr = 1 * 2.0 * err, gDot = gErr * conf * (1.0 - conf), s = scale * gDot;
  const ga = Float64Array.from(vb, (x) => s * x), gb = Float64Array.from(va, (x) => s * x);
  for (let i = 0; i < va.length; i++) va[i] -= lr * ga[i]; for (let i = 0; i < vb.length; i++) vb[i] -= lr * gb[i]; return loss; }
export function kbAttention(tbl, keys, query) { const q = embed(tbl, query), scale = 1.0 / Math.sqrt(tbl.dim), raw = keys.map((k) => scale * vdot(q, embed(tbl, k)));
  let mx = -1.0e30; for (const x of raw) if (x > mx) mx = x; const ex = raw.map((x) => Math.exp(x - mx)); let sum = 0.0; for (const e of ex) sum += e; return keys.map((k, i) => [k, ex[i] / sum]); }
// Replays golden.esk and returns the same quantities, for comparison with the eshkol-run trace.
export function replayGolden() { const t = makeTable(8), o = { init: { cat: Array.from(embed(t, 'cat')), feline: Array.from(embed(t, 'feline')), rock: Array.from(embed(t, 'rock')) } };
  o.s0 = softUnify(t, 'cat', 'feline'); o.loss = [];
  for (let i = 0; i < 200; i++) { const l1 = softUnifyTrain(t, 'cat', 'feline', 1.0, 0.5), l2 = softUnifyTrain(t, 'cat', 'rock', 0.0, 0.5); if (i % 20 === 0) o.loss.push(l1, l2); }
  o.sFel = softUnify(t, 'cat', 'feline'); o.sRock = softUnify(t, 'cat', 'rock'); o.final = Array.from(embed(t, 'cat')); o.kb = kbAttention(t, ['feline', 'rock', 'water'], 'cat'); return o; }
export function parseGolden(txt) { const L = Object.fromEntries(txt.trim().split('\n').map((l) => { const m = l.match(/^(init \w+|s0|loss|s-fel|s-rock|final cat|kb) (.*)$/); return m ? [m[1], m[2].trim().split(/\s+/)] : null; }).filter(Boolean));
  const n = (a) => a.map(Number); return { init: { cat: n(L['init cat']), feline: n(L['init feline']), rock: n(L['init rock']) }, s0: +L.s0[0], loss: n(L.loss), sFel: +L['s-fel'][0], sRock: +L['s-rock'][0], final: n(L['final cat']), kb: [0, 2, 4].map((i) => [L.kb[i], +L.kb[i + 1]]) }; }
export function compareGolden(txt) { const g = parseGolden(txt), r = replayGolden(); let err = 0; const up = (a, b) => { err = Math.max(err, Math.abs(a - b)); };
  for (const k of ['cat', 'feline', 'rock']) g.init[k].forEach((x, i) => up(x, r.init[k][i])); up(g.s0, r.s0); g.loss.forEach((x, i) => up(x, r.loss[i])); up(g.sFel, r.sFel); up(g.sRock, r.sRock); g.final.forEach((x, i) => up(x, r.final[i]));
  g.kb.forEach(([k, x], i) => { if (k !== r.kb[i][0]) err = Infinity; up(x, r.kb[i][1]); }); return { err, n: 3 * 8 + 1 + g.loss.length + 2 + 8 + 3, ok: err < 1e-12, sFel: r.sFel, sRock: r.sRock }; }

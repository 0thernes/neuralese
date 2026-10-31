// v14.3 — lens attribution of attention heads vs zero-ablation ground truth (PREREG-v14x §14.3). Original Neuralese code.
import { setup, writeResult, r4 } from './v14x-lib.mjs'; import * as NL from '../neuronlens.js';
const { M, tok, kept, cnt, Z } = await setup(), { d, L, H, hd, V } = M.cfg, E = M.W.wte, g = M.W.lnfW, eb = NL.embMean(M), rng = NL.mulberry(14300);
const freq = kept.slice().sort((a, b) => cnt[b] - cnt[a]).slice(50, 1050);
const NAMES = ['Tom', 'Lily', 'Ben', 'Sue', 'Max', 'Mia', 'Sam', 'Anna', 'Tim', 'Lucy', 'Jack', 'Sara', 'Bob', 'Amy', 'Jill', 'Kate'], pick = (a) => a[Math.floor(rng() * a.length)];
const tasks = { induction: Array.from({ length: 24 }, () => { const s = Array.from({ length: 12 }, () => pick(freq)); const ids = [...s, ...s];
    return { ids, terms: Array.from({ length: 11 }, (_, k) => ({ t: 12 + k, tgt: ids[13 + k], base: null })) }; }),
  ioi: Array.from({ length: 24 }, () => { const A = pick(NAMES); let B = pick(NAMES); while (B === A) B = pick(NAMES); const ids = tok.encode(`${A} and ${B} went to the park. ${A} gave the ball to`);
    return { ids, terms: [{ t: ids.length - 1, tgt: tok.encode(' ' + B)[0], base: tok.encode(' ' + A)[0] }] }; }) };
// Objective: induction = mean log-prob of the repeated token; IOI = logit(B) − logit(A).
const objective = (P, ablate) => { const f = NL.forward(M, P.ids, { ablate }), lg = NL.unembed(M, f.h, P.ids.length, P.terms.map((x) => x.t)); let s = 0;
  P.terms.forEach((x, r) => { const o = r * V; if (x.base !== null) { s += lg[o + x.tgt] - lg[o + x.base]; return; } let mx = -Infinity; for (let v = 0; v < V; v++) mx = Math.max(mx, lg[o + v]); let z = 0; for (let v = 0; v < V; v++) z += Math.exp(lg[o + v] - mx); s += lg[o + x.tgt] - mx - Math.log(z); });
  return s / P.terms.length; };
const auroc = (sc, y) => { const pos = sc.filter((_, i) => y[i]), neg = sc.filter((_, i) => !y[i]); let w = 0; for (const p of pos) for (const q of neg) w += p > q ? 1 : p === q ? 0.5 : 0; return w / (pos.length * neg.length); };
const out = {};
for (const [name, ps] of Object.entries(tasks)) {
  const base = ps.map((P) => objective(P)), eff = []; for (let l = 0; l < L; l++) for (let h = 0; h < H; h++) { const ab = { [l]: [h] }; eff.push(ps.reduce((s, P, i) => s + base[i] - objective(P, ab), 0) / ps.length); }
  const ord = [...eff.keys()].sort((a, b) => eff[b] - eff[a]), keep = new Set(ord.filter((i) => eff[i] > 0.05)); ord.slice(0, 5).forEach((i) => keep.add(i));
  const score = { 'R.out': new Float64Array(L * H), 'R.mid': new Float64Array(L * H), logit: new Float64Array(L * H) };
  for (const P of ps) { const zs = [], f = NL.forward(M, P.ids, { zs }), T = P.ids.length;
    for (const x of P.terms) { const hf = f.h.subarray(x.t * d, x.t * d + d); let m = 0; for (const a of hf) m += a; m /= d; let vv = 0; for (const a of hf) vv += (a - m) ** 2; const rstd = 1 / Math.sqrt(vv / d + M.cfg.eps);
      const u = Float64Array.from({ length: d }, (_, i) => (E[x.tgt * d + i] - (x.base === null ? eb[i] : E[x.base * d + i])) * g[i] * rstd);
      for (let l = 0; l < L; l++) { const oT = M.layers[l].oT; for (let h = 0; h < H; h++) { const o = new Float32Array(d), off = h * hd;
        for (let e = 0; e < hd; e++) { const zz = zs[l][x.t * d + off + e]; for (let j = 0; j < d; j++) o[j] += zz * oT[(off + e) * d + j]; }
        for (const [lens, J] of [['R.out', l < L - 1 ? Z.R.out[l] : null], ['R.mid', Z.R.mid[l]], ['logit', null]]) { const y = J ? NL.matvec(J, o, d) : o; let mm = 0; for (const a of y) mm += a; mm /= d; let s = 0; for (let i = 0; i < d; i++) s += u[i] * (y[i] - mm); score[lens][l * H + h] += s; } } } } }
  const y = eff.map((_, i) => keep.has(i)), res = {};
  for (const [lens, sc] of Object.entries(score)) { const a = Array.from(sc, Math.abs), top = [...a.keys()].sort((i, j) => a[j] - a[i]).slice(0, 20), rec = top.filter((i) => keep.has(i)).length / keep.size;
    res[lens] = { recallTop20: r4(rec), auroc: r4(auroc(a, y)), pass: rec >= 0.5 && auroc(a, y) > 0.7 }; }
  out[name] = { baseObjective: r4(base.reduce((s, x) => s + x, 0) / ps.length), kept: [...keep].map((i) => `L${Math.floor(i / H)}H${i % H}`), topEffects: ord.slice(0, 10).map((i) => [`L${Math.floor(i / H)}H${i % H}`, r4(eff[i])]), lenses: res }; console.log(name, JSON.stringify(out[name])); }
const pass = Object.values(out).every((t) => t.lenses['R.out'].pass);
writeResult('lens/ts8m/v14x-heads.json', { note: 'R.out is the pre-registered lens; R.mid (which includes the layer-l MLP the head writes into) is exploratory.', tasks: out, C3: { verdict: pass ? 'supported' : 'not supported' } });

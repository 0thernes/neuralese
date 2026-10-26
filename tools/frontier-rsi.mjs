// v11 P4 (H4a/H4b loop, H4c self-distillation, H4d test-time training). Usage: node tools/frontier-rsi.mjs [loop|distill|ttt] > out.json
import { load, corpus, SITE, prereg } from './_fload.mjs';
const R = await import(SITE + 'frontier/rsi.js'), C = await import(SITE + 'frontier/core.js'); const W = await load('8M'), CO = await corpus(), TOK = 48;
const S = C.SPLITS, pre = (r) => r.map((i) => R.precompute(W, CO[i].slice(0, TOK))); const err = (...a) => process.stderr.write(a.join(' ') + '\n');
const ciDiff = (b, a) => C.bootCI(a.map((x, i) => x - b[i]));
const mode = process.argv[2] || 'loop', out = { prereg: prereg().sha256, mode, started: new Date().toISOString() }, th0 = R.theta0(W);
const sets = { propose: pre(S.propose), select: pre(S.select), test: pre(S.test) };
if (mode === 'loop') { const res = R.loop(W, sets, 30, (e) => err(JSON.stringify({ it: e.it, sel: e.select, test: e.test, acc: e.accepted }))); const acc = res.log.slice(1).map((e) => e.accepted);
  out.log = res.log; out.H4a = { ci: ciDiff(res.testPerDoc.before, res.testPerDoc.after), pass: null }; out.H4a.pass = out.H4a.ci.hi < 0;
  out.acceptCounts = Object.fromEntries(['A:gradient', 'B:neuron-ablate', 'C:random-control', null].map((k) => [String(k), acc.filter((a) => a === k).length]));
  out.H4b = { randomAcceptRate: acc.filter((a) => a === 'C:random-control').length / 30, randomOkRate: res.log.slice(1).filter((e) => e.cands[2].ok).length / 30 }; out.H4b.pass = out.H4b.randomOkRate <= 0.1; }
if (mode === 'distill') { const r = C.rng(1), stories = [];
  for (let k = 0; k < 28; k++) { const ids = CO[S.propose[0] + (k % 14)].slice(0, 4); while (ids.length < 64) { const A = C.forward(W, ids), z = C.logitsAt(W, A, ids.length - 1), Z = C.lse(z.map((x) => x / 0.8)); let u = r(), c = 0, pick = 0; for (let o = 0; o < z.length; o++) { c += Math.exp(z[o] / 0.8 - Z); if (u < c) { pick = o; break; } } ids.push(pick); } stories.push(ids); err('story', k); }
  const sp = stories.map((ids) => R.precompute(W, ids.slice(0, TOK))), ppl = sp.map((p) => R.evalSet(W, th0, [p]).ce), keep = ppl.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).slice(0, 14).map((x) => x[1]);
  const th = R.adamFit(W, th0, keep.map((i) => sp[i]), 20, 1e-3), b = R.evalSet(W, th0, sets.test).perDoc, a = R.evalSet(W, th, sets.test).perDoc;
  out.ownPPL = ppl; out.kept = keep; out.testBefore = C.mean(b); out.testAfter = C.mean(a); out.H4c = { ci: ciDiff(b, a) }; out.H4c.pass = !(out.H4c.ci.hi < 0); out.sample = stories[keep[0]]; }
if (mode === 'ttt') { const gain = (ps, lr) => ps.filter((p) => p.T >= 34).map((p) => { const b = C.mean(R.evalDoc(W, th0, p, 31, p.T - 1).ce), t = R.adamFit(W, th0, [p], 5, lr, 0, 31); return C.mean(R.evalDoc(W, t, p, 31, p.T - 1).ce) - b; });
  out.lrSelect = {}; for (const lr of [1e-3, 3e-3, 1e-2]) { out.lrSelect[lr] = C.mean(gain(sets.select, lr)); err('lr', lr, out.lrSelect[lr]); }
  const lr = +Object.entries(out.lrSelect).sort((a, b) => a[1] - b[1])[0][0]; const d = gain(sets.test, lr); out.lr = lr; out.perDoc = d; out.H4d = { ci: C.bootCI(d) }; out.H4d.pass = out.H4d.ci.hi < 0; }
out.finished = new Date().toISOString(); console.log(JSON.stringify(out));

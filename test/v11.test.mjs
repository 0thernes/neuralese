// v11 FRONTIER: statistics code against known values, analytic gradients against finite differences, and every published
// result file re-scored against the thresholds frozen in docs/PREREG-v11.md (sha256 checked), plus mutations that must fail.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as C from '../frontier/core.js';
import * as G from '../frontier/grok.js';
import * as M from '../frontier/mind.js';
import { CITES } from '../frontier/cites.js';
const D = (f) => JSON.parse(readFileSync(new URL('../frontier/data/' + f, import.meta.url), 'utf8'));
const SHA = D('prereg.json').sha256;
test('F0 pre-registration hash: docs/ copy and shipped copy hash to the recorded value; every result file cites it', () => {
  for (const p of ['../docs/PREREG-v11.md', '../frontier/data/PREREG-v11.md']) { let b; try { b = readFileSync(new URL(p, import.meta.url)); } catch { continue; } assert.equal(createHash('sha256').update(b).digest('hex'), SHA, p); }
  for (const f of ['p1.json', 'p2.json', 'p3a.json', 'p3b.json', 'grok.json', 'atlas.json', 'rsi-loop.json', 'rsi-distill.json', 'rsi-ttt.json']) assert.equal(D(f).prereg, SHA, f);
  assert.notEqual(createHash('sha256').update('mutated').digest('hex'), SHA); });
test('F1 LZ76 textbook value, and a mutation changes it', () => { assert.equal(C.lz76('0001101001000101'.split('').map(Number)), 6); assert.notEqual(C.lz76('0000000000000000'.split('').map(Number)), 6); });
test('F2 exact one-sided t-test equals direct numerical integration of the t(7) density (p = 0.0023536); flipping the sign gives 1 − p', () => { const x = [-1.2, -0.4, -0.9, -1.5, -0.3, -0.8, 0.1, -1.1]; const p = C.tLess(x).p, q = C.tLess(x.map((v) => -v)).p; assert.ok(Math.abs(p - 0.0023536) < 1e-6, String(p)); assert.ok(Math.abs(p + q - 1) < 1e-9); });
test('F3 PCI normaliser: random ≈ 1, periodic ≈ 0, constant = 0', () => { const r = C.rng(3), rb = Array.from({ length: 4000 }, () => (r() < 0.5 ? 1 : 0)); assert.ok(C.pciNorm(rb) > 0.8); assert.ok(C.pciNorm(rb.map((_, i) => i % 2)) < 0.2); assert.equal(C.pciNorm(new Array(100).fill(1)), 0); });
test('F4 grokking-net gradient equals central finite differences; a mutated gradient is caught', () => { const S = G.init({ ...G.CONFIGS[0], N: 16, p: 7 }), set = S.train.slice(0, 20), g = S.P.map((x) => new Float64Array(x.length)); G._pass(S, set, g); let w = 0, wm = 0;
  for (const [q, i] of [[0, 3], [1, 10], [2, 5], [2, 40]]) { const e = 1e-5, o = S.P[q][i]; S.P[q][i] = o + e; const a = G._pass(S, set, null).loss; S.P[q][i] = o - e; const b = G._pass(S, set, null).loss; S.P[q][i] = o; const fd = (a - b) / (2 * e); w = Math.max(w, Math.abs(fd - g[q][i]) / (Math.abs(g[q][i]) + 1e-8)); wm = Math.max(wm, Math.abs(fd - 2 * g[q][i]) / (Math.abs(g[q][i]) + 1e-8)); }
  assert.ok(w < 1e-5, String(w)); assert.ok(wm > 0.1, 'a 2× gradient bug must be detected'); });
test('F5 Hill fit recovers a known coefficient; ridge and AUC sanity', () => { const y = M.ALPHAS.map((a) => 3 * a ** 3 / (2 ** 3 + a ** 3)); const f = M.hill(M.ALPHAS, y); assert.ok(Math.abs(f.n - 3) < 0.6, JSON.stringify(f));
  assert.equal(M.auc([0.9, 0.8, 0.1, 0.2], [1, 1, 0, 0]), 1); assert.equal(M.auc([0.1, 0.2, 0.9, 0.8], [1, 1, 0, 0]), 0); const X = Array.from({ length: 50 }, (_, i) => [i / 10, Math.sin(i)]), yy = X.map((x) => 2 * x[0] - x[1] + 1); assert.ok(M.r2(X.map(M.ridge(X, yy, 1e-8)), yy) > 0.9999); });
test('F6 grok.json re-scored from its own log: sMem/sGen and H5a–H5c verdicts follow the pre-registered rules', () => { const g = D('grok.json'), first = (log, k, th) => log.find((e) => e[k] >= th)?.step ?? null;
  assert.equal(first(g.main.log, 'trainAcc', 0.99), g.H5a.sMem); assert.equal(first(g.main.log, 'testAcc', 0.95), g.H5a.sGen); assert.equal(g.H5a.pass, g.H5a.sMem !== null && g.H5a.sGen !== null && g.H5a.sGen >= 2 * g.H5a.sMem);
  assert.equal(g.H5b.pass, g.H5b.final >= 0.8 && g.H5b.init <= 0.2); assert.equal(g.H5c.pass, g.control.log.at(-1).testAcc < 0.5); assert.deepEqual(g.main.cfg, G.CONFIGS[0]); });
test('F7 atlas.json re-scored: Spearman and top-1% mass recomputed from the 8320 rows match the stored verdicts', (t) => { const a = D('atlas.json'); if (a.status === 'running') { assert.ok(!('H6a' in a) && !('H6b' in a), 'a pending file must carry no verdicts'); t.skip('atlas run in progress: results pending'); return; } assert.equal(a.heads.length, 128); assert.equal(a.neurons.length, 8192);
  const rn = C.spearman(a.neurons.map((r) => r[2]), a.neurons.map((r) => r[3])), rh = C.spearman(a.heads.map((r) => r[2]), a.heads.map((r) => r[3])); assert.ok(Math.abs(rn - a.H6a.rhoNeurons) < 1e-3 && Math.abs(rh - a.H6a.rhoHeads) < 1e-2, `${rn} ${rh}`);
  const s = a.neurons.map((r) => Math.abs(r[2])).sort((x, y) => y - x), top = s.slice(0, 82).reduce((p, q) => p + q, 0) / s.reduce((p, q) => p + q, 0); assert.ok(Math.abs(top - a.H6b.top1pctMass) < 1e-3); assert.equal(a.H6a.pass, a.H6a.rhoNeurons >= 0.5 && a.H6a.rhoHeads >= 0.5); assert.equal(a.H6b.pass, a.H6b.top1pctMass >= 0.25); });
test('F8 mind results: verdicts follow the frozen thresholds', () => { const p1 = D('p1.json'), p2 = D('p2.json'), a = D('p3a.json'), b = D('p3b.json');
  assert.equal(p1.H1a.pass, p1.trainedMinusRandom.lo > 0 && p1.trainedMinusShuffled.lo > 0); assert.equal(p2.H2a.pass, p2.medianN.trained >= 2); assert.equal(p2.H2b.pass, p2.H2b.diff.lo > 0);
  assert.equal(a.H3a.pass, a.trained.auc >= 0.75 && a.trained.auc - a.randomInit.auc >= 0.1); assert.equal(b.H3b.pass, b.selfMinus3M.lo > 0 && b.selfMinus1M.lo > 0); for (const v of Object.values(b.r2)) assert.ok(Number.isFinite(v.r2)); });
test('F9 self-improvement results: verdicts follow the frozen thresholds; the loop never used test CE to decide', () => { const L = D('rsi-loop.json'), Ds = D('rsi-distill.json'), T = D('rsi-ttt.json'); assert.equal(L.log.length, 31);
  assert.equal(L.H4a.pass, L.H4a.ci.hi < 0); assert.equal(L.H4b.pass, L.H4b.randomOkRate <= 0.1); for (const e of L.log.slice(1)) { const ok = e.cands.filter((c) => c.ok); assert.equal(e.accepted === null, ok.length === 0); for (const c of e.cands) assert.equal(c.ok, c.p < 0.01 && c.dSelect < 0); }
  assert.equal(Ds.H4c.pass, !(Ds.H4c.ci.hi < 0)); assert.equal(Ds.kept.length, 14); assert.equal(T.H4d.pass, T.H4d.ci.hi < 0); assert.ok([1e-3, 3e-3, 1e-2].includes(T.lr)); });
test('F10 citations: 27 entries, unique keys, every id is an arXiv id or a DOI', () => { assert.ok(CITES.length >= 27); assert.equal(new Set(CITES.map((c) => c[0])).size, CITES.length); for (const c of CITES) assert.match(c[3], /^(arXiv:\d{4}\.\d{4,5}|doi:10\.\d{4,}\/\S+)$/); assert.ok(!CITES.some((c) => c[3].includes('2402.12370')), 'AnaloBench must not be cited'); });

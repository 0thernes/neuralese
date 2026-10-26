// v11 P1–P3: consciousness-science proxies with null models. Usage: node tools/frontier-mind.mjs <P1|P2|P3a|P3b> > site/frontier/data/<p>.json
import { load, corpus, SITE, prereg } from './_fload.mjs';
const C = await import(SITE + 'frontier/core.js'), M = await import(SITE + 'frontier/mind.js');
const which = process.argv[2], W = await load('8M'), CO = await corpus(), TEST = C.SPLITS.test, t0 = Date.now();
const nulls = { trained: W, randomInit: C.randomInit(W, 1), shuffled: C.shuffled(W, 1) };
const CONCEPT_IDS = JSON.parse(process.env.CONCEPTS || '[]');
const diffCI = (a, b) => C.bootCI(a.map((x, i) => [x, b[i]]), (s) => C.mean(s.map((p) => p[0] - p[1])));
let out = { prereg: prereg().sha256, test: which };
if (which === 'P1') { const per = {}; for (const [k, Wm] of Object.entries(nulls)) per[k] = TEST.map((doc) => { const ids = CO[doc].slice(0, 48), A = C.forward(Wm, ids); const r = [...Array(10).keys()].map((s) => M.pci(Wm, ids, 100 + s, 8, A)); return { pci: C.mean(r.map((x) => x.pci)), active: C.mean(r.map((x) => x.active)) }; });
  const v = (k) => per[k].map((x) => x.pci); const dR = diffCI(v('trained'), v('randomInit')), dS = diffCI(v('trained'), v('shuffled'));
  out = { ...out, perDoc: per, mean: Object.fromEntries(Object.keys(per).map((k) => [k, C.mean(v(k))])), trainedMinusRandom: dR, trainedMinusShuffled: dS, H1a: { pass: dR.lo > 0 && dS.lo > 0 } }; }
if (which === 'P2') { const curves = {}, fits = {}; for (const k of ['trained', 'randomInit']) { curves[k] = []; fits[k] = []; for (const doc of TEST) { const ids = CO[doc].slice(0, 25); for (const c of CONCEPT_IDS.slice(0, 8)) { const y = M.ignitionCurve(nulls[k], ids, c); curves[k].push(y); fits[k].push(M.hill(M.ALPHAS, y)); } } }
  const med = (a) => { const s = a.filter(Boolean).map((f) => f.n).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const pairs = fits.trained.map((f, i) => [f, fits.randomInit[i]]).filter((p) => p[0] && p[1]); const ci = C.bootCI(pairs, (s) => { const a = s.map((p) => p[0].n).sort((x, y) => x - y), b = s.map((p) => p[1].n).sort((x, y) => x - y); return a[a.length >> 1] - b[b.length >> 1]; });
  out = { ...out, alphas: M.ALPHAS, concepts: CONCEPT_IDS.slice(0, 8), curves, fits, medianN: { trained: med(fits.trained), randomInit: med(fits.randomInit) }, fitted: { trained: fits.trained.filter(Boolean).length, randomInit: fits.randomInit.filter(Boolean).length, of: fits.trained.length }, H2a: { pass: med(fits.trained) >= 2 }, H2b: { diff: ci, pass: ci.lo > 0 } }; }
if (which === 'P3a') { const tr = CONCEPT_IDS.slice(0, 16), ho = CONCEPT_IDS.slice(16, 32), res = {};
  const windows = (docs) => docs.flatMap((doc) => [0, 8, 16, 24].map((s) => CO[doc].slice(s, s + 18)).filter((w) => w.length === 18));
  for (const k of ['trained', 'randomInit']) { const Wm = nulls[k], X = [], y = [], Xt = [], yt = [];
    for (const ids of windows([...C.SPLITS.propose, ...C.SPLITS.select])) { X.push(M.injectFeature(Wm, ids, null)); y.push(0); for (const c of tr) { X.push(M.injectFeature(Wm, ids, c)); y.push(1); } }
    for (const ids of windows(TEST)) { Xt.push(M.injectFeature(Wm, ids, null)); yt.push(0); for (const c of ho) { Xt.push(M.injectFeature(Wm, ids, c)); yt.push(1); } }
    const f = M.logistic(X, y); res[k] = { auc: M.auc(Xt.map(f), yt), nTrain: X.length, nTest: Xt.length }; }
  out = { ...out, trainConcepts: tr, heldoutConcepts: ho, ...res, H3a: { pass: res.trained.auc >= 0.75 && res.trained.auc - res.randomInit.auc >= 0.1 } }; }
if (which === 'P3b') { const models = { '8M': W, '3M': await load('3M'), '1M': await load('1M'), randomInit8M: nulls.randomInit }, docs = [...Array(40).keys()], feats = {}, ent = {};
  for (const [k, Wm] of Object.entries(models)) { feats[k] = []; for (const doc of docs) { const ids = CO[doc].slice(0, 48), A = C.forward(Wm, ids), R = M.residPost(A, Wm.layers.length / 2 - 1), d = Wm.lnfW.length; const f = []; for (let t = 0; t < ids.length; t++) f.push(Array.from(R.subarray(t * d, t * d + d))); feats[k].push(f);
      if (k === '8M' || k === '3M') { (ent[k] ??= []).push([...Array(ids.length).keys()].map((t) => C.entropyAt(Wm, A, t))); } } }
  const fit = (reader, target) => { const XY = (ds) => [ds.flatMap((i) => feats[reader][i]), ds.flatMap((i) => ent[target][i])]; const [Xp, yp] = XY(C.SPLITS.propose), [Xs, ys] = XY(C.SPLITS.select);
    let best = null; for (const lam of [1e-4, 1e-3, 1e-2, 1e-1, 1, 10]) { const f = M.ridge(Xp, yp, lam), s = M.r2(Xs.map(f), ys); if (!best || s > best.s) best = { lam, s, f }; }
    const perDoc = TEST.map((i) => ({ yh: feats[reader][i].map(best.f), y: ent[target][i] })); return { lam: best.lam, perDoc }; };
  const R2 = (pd) => M.r2(pd.flatMap((p) => p.yh), pd.flatMap((p) => p.y)); const res = {}, runs = {};
  for (const [r, t] of [['8M', '8M'], ['3M', '8M'], ['1M', '8M'], ['randomInit8M', '8M'], ['3M', '3M'], ['8M', '3M']]) { runs[`${r}->${t}`] = fit(r, t); res[`${r}->${t}`] = { r2: R2(runs[`${r}->${t}`].perDoc), lam: runs[`${r}->${t}`].lam }; }
  const dci = (a, b) => C.bootCI(TEST.map((_, i) => i), (s) => R2(s.map((i) => runs[a].perDoc[i])) - R2(s.map((i) => runs[b].perDoc[i])));
  const d3 = dci('8M->8M', '3M->8M'), d1 = dci('8M->8M', '1M->8M'), dsym = dci('3M->3M', '8M->3M');
  out = { ...out, layerRead: 'resid_post of layer L/2−1 (middle)', r2: res, selfMinus3M: d3, selfMinus1M: d1, symmetric3M: dsym, H3b: { pass: d3.lo > 0 && d1.lo > 0, symmetricPass: dsym.lo > 0 } }; }
out.seconds = (Date.now() - t0) / 1000; console.log(JSON.stringify(out));

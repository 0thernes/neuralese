// Pre-registered validation of Neuron Lens reads on TinyStories-8M (docs/PREREG-v14.md; its sha256 is recorded in the output).
// Usage: node tools/nlens-validate.mjs [--workers 8] [--out lens/ts8m/validation.json] [--quick]  (--quick: tiny smoke run for tests)
import fs from 'node:fs'; import os from 'node:os'; import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { loadModel, tokenizer, corpusText, stories, docsFrom, sha256 } from './nlens-common.mjs';
import * as NL from '../src/neuronlens.js';
const arg = (k, v) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : v; };
function logSoftmaxRows(lg, R, V) { for (let r = 0; r < R; r++) { const o = r * V; let mx = -Infinity; for (let v = 0; v < V; v++) if (lg[o + v] > mx) mx = lg[o + v]; let z = 0; for (let v = 0; v < V; v++) z += Math.exp(lg[o + v] - mx); const c = mx + Math.log(z); for (let v = 0; v < V; v++) lg[o + v] -= c; } return lg; }
const ROWS = Array.from({ length: 48 }, (_, i) => 16 + i);
function meanLP(M, ids, steer) { const V = M.cfg.V, f = NL.forward(M, ids, { steer, logits: true, logitRows: ROWS }), lp = logSoftmaxRows(f.logits, ROWS.length, V), m = new Float64Array(V);
  for (let r = 0; r < ROWS.length; r++) for (let v = 0; v < V; v++) m[v] += lp[r * V + v] / ROWS.length; return m; }
if (!isMainThread) {
  const M = loadModel(workerData.model), { evalDocs, kept } = workerData, base = new Map();
  parentPort.on('message', (job) => {
    if (job.kind === 'A') { const { l, n, alpha } = job, { w } = NL.neuronDirs(M, l, n), vec = w.map((x) => x * alpha), D = new Float64Array(kept.length);
      evalDocs.forEach((ids, di) => { if (!base.has(di)) base.set(di, meanLP(M, ids)); const b = base.get(di), s = meanLP(M, ids, { layer: l, vec, from: 16, to: 64 }); kept.forEach((v, k) => { D[k] += (s[v] - b[v]) / evalDocs.length; }); });
      parentPort.postMessage({ kind: 'A', l, n, D: Float32Array.from(D) }); }
    else { const { ids, pos, toks } = job, { L, ff } = M.cfg, out = new Float32Array(toks.length * L * ff);
      toks.forEach((tk, i) => { const x = ids.slice(0, pos + 1); x[pos] = tk; const f = NL.forward(M, x, { acts: true }); for (let l = 0; l < L; l++) out.set(f.acts[l].subarray(pos * ff, pos * ff + ff), (i * L + l) * ff); });
      parentPort.postMessage({ kind: 'B', job: job.id, out }); }
  });
} else {
  const quick = process.argv.includes('--quick'), model = arg('model', 'model'), nW = +arg('workers', os.cpus().length), outPath = arg('out', quick ? '/tmp/nlens-validation-quick.json' : 'lens/ts8m/validation.json');
  const lensDir = arg('lens', 'lens/ts8m'), prereg = sha256(fs.readFileSync(arg('prereg', 'docs/PREREG-v14.md'))), t0 = Date.now();
  const M = loadModel(model), { d, L, ff, V } = M.cfg, man = JSON.parse(fs.readFileSync(`${lensDir}/manifest.json`, 'utf8'));
  const lensBuf = fs.readFileSync(`${lensDir}/lenses.f32`); if (sha256(lensBuf) !== man.sha256) throw new Error('lens hash mismatch');
  const Z = NL.unpackLenses(new Float32Array(lensBuf.buffer.slice(lensBuf.byteOffset, lensBuf.byteOffset + lensBuf.length)), man);
  const tok = tokenizer(model), st = stories(await corpusText(`${model}/TinyStories-valid.txt`));
  const cnt = new Uint32Array(V); for (let i = 0; i < (quick ? 2000 : 20000); i++) for (const t of tok.encode(st[i])) cnt[t]++;
  const kept = []; for (let v = 0; v < V; v++) if (cnt[v] >= 5) kept.push(v);
  const nPer = quick ? 3 : +arg('nper', 24), nEval = quick ? 2 : 16, evalDocs = docsFrom(tok, st, 20000, nEval, 64).map((x) => x.ids);
  // tuned-lens-style affine translators from the fit documents
  const fitDocs = docsFrom(tok, st, 0, quick ? 8 : 64, 64).map((x) => x.ids), nRow = fitDocs.length * 48, Xs = Array.from({ length: L }, () => new Float32Array(nRow * d)), Yf = new Float32Array(nRow * d);
  fitDocs.forEach((ids, di) => { const f = NL.forward(M, ids, { outs: true }); for (let r = 0; r < 48; r++) { const t = 16 + r; for (let l = 0; l < L; l++) Xs[l].set(f.outs[l].subarray(t * d, t * d + d), (di * 48 + r) * d); Yf.set(f.h.subarray(t * d, t * d + d), (di * 48 + r) * d); } });
  const tuned = Xs.map((X) => NL.ridgeLinear(X, Yf, nRow, d, d));
  // doses
  const acts = Array.from({ length: L }, () => Array.from({ length: ff }, () => [])); evalDocs.forEach((ids) => { const f = NL.forward(M, ids, { acts: true }); for (let l = 0; l < L; l++) for (let t = 0; t < 64; t++) for (let n = 0; n < ff; n++) acts[l][n].push(f.acts[l][t * ff + n]); });
  const p99 = (a) => { const s = Float32Array.from(a).sort(); return s[Math.floor(0.99 * (s.length - 1))]; };
  const sample = Array.from({ length: L }, (_, l) => { const r = NL.mulberry(14000 + l), idx = [...Array(ff).keys()]; for (let i = ff - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } return idx.slice(0, nPer); });
  const jobsA = sample.flatMap((ns, l) => ns.map((n) => ({ kind: 'A', l, n, alpha: 4 * Math.max(0.05, p99(acts[l][n])) })));
  const drvDocs = docsFrom(tok, st, 21000, 2, 25).map((x) => x.ids), freq = kept.slice().sort((a, b) => cnt[b] - cnt[a]).slice(0, quick ? 60 : 3000), CH = 50;
  const noB = process.argv.includes('--no-testb'), jobsB = []; if (!noB) drvDocs.forEach((ids, di) => { for (let i = 0; i < freq.length; i += CH) jobsB.push({ kind: 'B', id: jobsB.length, di, i, ids, pos: 24, toks: freq.slice(i, i + CH) }); });
  const resA = {}, truth = Array.from({ length: L }, () => new Float32Array(freq.length * ff));
  await new Promise((res) => { const jobs = [...jobsA, ...jobsB], tot = jobs.length; let live = 0, done = 0;
    for (let w = 0; w < Math.min(nW, jobs.length); w++) { const Wk = new Worker(new URL(import.meta.url), { workerData: { model, evalDocs, kept } }); live++;
      const next = () => { const j = jobs.shift(); if (!j) { Wk.terminate(); if (--live === 0) res(); return; } Wk.postMessage(j); };
      Wk.on('message', (m) => { done++; if (m.kind === 'A') resA[`${m.l}:${m.n}`] = m.D; else { const j = jobsB[m.job]; for (let i = 0; i < j.toks.length; i++) for (let l = 0; l < L; l++) for (let n = 0; n < ff; n++) truth[l][(j.i + i) * ff + n] += m.out[(i * L + l) * ff + n] / drvDocs.length; }
        if (done % 25 === 0) console.log(`${done}/${tot} ${((Date.now() - t0) / 1000).toFixed(0)}s`); next(); }); next(); } });
    const KT = NL.tokMatT(M, kept, false), KcT = NL.tokMatT(M, kept, true), writeReads = (l, w) => { const r = { logit: NL.readsR(M, w, 1, null, kept, KT), tuned: NL.readsR(M, w, 1, tuned[l], kept, KT), 'R.mid': NL.readsR(M, w, 1, Z.R.mid[l], kept, KT), 'S.out': NL.readsS(M, w, 1, Z.S.out[l], kept, KcT), 'S.mid': NL.readsS(M, w, 1, Z.S.mid[l], kept, KcT) }; if (l < L - 1) r['R.out'] = NL.readsR(M, w, 1, Z.R.out[l], kept, KT); return r; };
  const boot = (xs, B = 2000) => { const r = NL.mulberry(99), m = []; for (let b = 0; b < B; b++) { const s = xs.map(() => xs[Math.floor(r() * xs.length)]).sort((a, c) => a - c); m.push(s[s.length >> 1]); } m.sort((a, c) => a - c); return [m[Math.floor(0.025 * B)], m[Math.floor(0.975 * B)]]; };
  const med = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s[s.length >> 1]; }, q99 = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(0.99 * (s.length - 1))]; };
  const A = [];
  for (let l = 0; l < L; l++) { const ns = sample[l], reads = ns.map((n) => writeReads(l, NL.neuronDirs(M, l, n).w)), Ds = ns.map((n) => resA[`${l}:${n}`]);
    for (const lens of Object.keys(reads[0])) { const r = reads.map((rd, i) => NL.pearson(rd[lens], Ds[i])), mis = []; reads.forEach((rd, i) => Ds.forEach((D, j) => { if (i !== j) mis.push(NL.pearson(rd[lens], D)); }));
      const tau = q99(mis), pass = r.filter((x) => x > tau).length;
      const rise = reads.map((rd, i) => { const top = NL.topK(rd[lens], 10), rr = NL.mulberry(7 + ns[i]), rnd = Array.from({ length: 10 }, () => Math.floor(rr() * kept.length)); const m = (ix) => ix.reduce((s, k) => s + Ds[i][k], 0) / ix.length; return m(top) - m(rnd); });
      const risePass = rise.filter((x) => x > 0).length, misPass = mis.filter((x) => x > tau).length;
      A.push({ layer: l, lens, n: ns.length, medianR: +med(r).toFixed(4), medianR_CI: boot(r).map((x) => +x.toFixed(4)), tau99: +tau.toFixed(4), passRate: +(pass / ns.length).toFixed(4), passCI: NL.wilson(pass, ns.length).map((x) => +x.toFixed(4)), nullPassRate: +(misPass / mis.length).toFixed(4),
        top10Rise: +(risePass / ns.length).toFixed(4), top10RiseCI: NL.wilson(risePass, ns.length).map((x) => +x.toFixed(4)), medianRiseNats: +med(rise).toFixed(5) }); } }
  const B = [], NM = noB ? 0 : quick ? 40 : ff;
  const FT = NL.tokMatT(M, freq, false), FcT = NL.tokMatT(M, freq, true), nf = freq.length, rows = (A) => Array.from({ length: NM }, (_, n) => A.subarray(n * nf, (n + 1) * nf));
  for (let l = 0; l < (NM ? L : 0); l++) { const Cs = new Float32Array(NM * d), tr = []; for (let n = 0; n < NM; n++) { Cs.set(NL.neuronDirs(M, l, n).c, n * d); tr.push(Float32Array.from(freq, (_, i) => truth[l][i * ff + n])); }
    const reads = { 'S.mid': rows(NL.readsS(M, Cs, NM, Z.S.mid[l], freq, FcT)), 'R.mid': rows(NL.readsR(M, Cs, NM, Z.R.mid[l], freq, FT)), logit: rows(NL.readsR(M, Cs, NM, null, freq, FT)), 'S.out[L-1]': rows(NL.readsS(M, Cs, NM, l ? Z.S.out[l - 1] : null, freq, FcT)) };
    if (l) reads['R.out[L-1]'] = rows(NL.readsR(M, Cs, NM, Z.R.out[l - 1], freq, FT));
    const rr = NL.mulberry(500 + l), pairs = Array.from({ length: Math.min(2000, NM * 4) }, () => { const i = Math.floor(rr() * NM); let j = Math.floor(rr() * NM); if (j === i) j = (j + 1) % NM; return [i, j]; });
    for (const [lens, rd] of Object.entries(reads)) { const rho = rd.map((x, i) => NL.spearman(x, tr[i])), mis = pairs.map(([i, j]) => NL.spearman(rd[i], tr[j])), tau = q99(mis), pass = rho.filter((x) => x > tau).length;
      B.push({ layer: l, lens, n: NM, medianRho: +med(rho).toFixed(4), tau99: +tau.toFixed(4), passRate: +(pass / NM).toFixed(4), passCI: NL.wilson(pass, NM).map((x) => +x.toFixed(4)), nullPassRate: +(mis.filter((x) => x > tau).length / mis.length).toFixed(4) }); } }
  if (!quick && !noB && !process.argv.includes('--no-drivers')) { const drv = {}; for (let l = 0; l < L; l++) { drv[l] = []; for (let n = 0; n < ff; n++) { const col = Float32Array.from(freq, (_, i) => truth[l][i * ff + n]); drv[l].push(NL.topK(col, 8).map((i) => freq[i])); } } fs.writeFileSync(`${lensDir}/drivers.json`, JSON.stringify({ note: 'top-8 exact drivers per neuron: token substituted at position 24 of 2 stories (21000..), mean activation at that position, 3000 most frequent kept tokens', drivers: drv })); }
  const out = { prereg_sha256: prereg, lens_sha256: man.sha256, quick, kept: kept.length, driverTokens: freq.length, evalDocs: evalDocs.length, seconds: Math.round((Date.now() - t0) / 1000), testA: A, testB: B };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1)); console.log('wrote', outPath, out.seconds + 's');
}

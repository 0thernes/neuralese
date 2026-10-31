// Fits the R-lens and S-lens (out and mid targets) of TinyStories-8M offline, the neuron-lens recipe
// (the neuron-lens method, implemented from scratch for GPT-Neo in ../neuronlens.js; prior art in docs/NEURON_LENS_METHOD.md).
// Usage: node tools/nlens-fit.mjs [--docs 64] [--T 65] [--workers 8] [--jobs /tmp/nlens-jobs] [--out lens/ts8m]
// Each (lens, document) job is cached as a file, so an interrupted fit resumes. Documents alternate even/odd halves.
import fs from 'node:fs'; import os from 'node:os'; import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { loadModel, tokenizer, corpusText, stories, docsFrom, sha256, BLOCKS, TS_VALID } from './nlens-common.mjs';
import { docJacobianR, docJacobianS } from '../neuronlens.js';
const arg = (k, v) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : v; };
if (!isMainThread) {
  const M = loadModel(workerData.model);
  parentPort.on('message', ({ lens, i, ids, file }) => {
    const r = (lens === 'R' ? docJacobianR : docJacobianS)(M, ids);
    const parts = lens === 'R' ? [...r.out, ...r.mid] : [...r.mid, ...r.out];
    const buf = new Float64Array(parts.length * parts[0].length); parts.forEach((p, k) => buf.set(p, k * p.length));
    fs.writeFileSync(file + '.tmp', Buffer.from(buf.buffer)); fs.renameSync(file + '.tmp', file); parentPort.postMessage({ lens, i });
  });
} else {
  const nDocs = +arg('docs', 64), T = +arg('T', 65), nW = +arg('workers', os.cpus().length), jobsDir = arg('jobs', '/tmp/nlens-jobs'), outDir = arg('out', 'lens/ts8m'), model = arg('model', 'model');
  fs.mkdirSync(jobsDir, { recursive: true }); fs.mkdirSync(outDir, { recursive: true });
  const tok = tokenizer(model), st = stories(await corpusText(`${model}/TinyStories-valid.txt`)), docs = docsFrom(tok, st, 0, nDocs, T);
  const jobs = []; for (const lens of ['R', 'S']) docs.forEach((doc, i) => { const file = `${jobsDir}/${lens}-T${T}-${i}.bin`; if (!fs.existsSync(file)) jobs.push({ lens, i, ids: doc.ids, file }); });
  console.log(`${docs.length} docs × T=${T}; ${jobs.length} jobs left; ${nW} workers`); const t0 = Date.now(); let done = 0;
  await new Promise((res) => { if (!jobs.length) return res(); let live = 0;
    for (let w = 0; w < Math.min(nW, jobs.length); w++) { const W = new Worker(new URL(import.meta.url), { workerData: { model } }); live++;
      const next = () => { const j = jobs.shift(); if (!j) { W.terminate(); if (--live === 0) res(); return; } W.postMessage(j); };
      W.on('message', (m) => { done++; console.log(`${m.lens} doc ${m.i} done (${done}) ${((Date.now() - t0) / 1000).toFixed(0)}s`); next(); }); next(); } });
  const { d, L } = loadModel(model).cfg, B = BLOCKS(L), dd = d * d;
  const half = [0, 1].map(() => B.map(() => new Float64Array(dd))), nh = [0, 0];
  docs.forEach((_, i) => { nh[i % 2]++; for (const lens of ['R', 'S']) { const a = new Float64Array(fs.readFileSync(`${jobsDir}/${lens}-T${T}-${i}.bin`).buffer.slice(0));
    const nb = lens === 'R' ? 2 * L - 1 : 2 * L, off = B.findIndex((b) => b[0] === lens); for (let k = 0; k < nb; k++) { const h = half[i % 2][off + k]; for (let j = 0; j < dd; j++) h[j] += a[k * dd + j]; } } });
  nh.forEach((n, hh) => half[hh].forEach((b) => { for (let j = 0; j < dd; j++) b[j] /= n; }));
  const lensBuf = new Float32Array(B.length * dd), splitHalf = {};
  B.forEach(([lens, tgt, l], k) => { let num = 0, den = 0; for (let j = 0; j < dd; j++) { const a = half[0][k][j], b = half[1][k][j], m = (a * nh[0] + b * nh[1]) / (nh[0] + nh[1]); lensBuf[k * dd + j] = m; num += (a - b) ** 2; den += m * m; }
    (splitHalf[`${lens}.${tgt}`] ||= [])[l] = +Math.sqrt(num / den).toFixed(4); });
  const bin = Buffer.from(lensBuf.buffer); fs.writeFileSync(`${outDir}/lenses.f32`, bin);
  const man = { format: 'neuralese-lens-v1', model: 'roneneldan/TinyStories-8M', d, L, blocks: B.map(([a, b, c]) => `${a}.${b}.L${c}`), dtype: 'float32', layout: 'row-major d×d per block; R: J[i][j]=∂h_final_i/∂h_j; S: K[i][j]=∂h_i/∂e_j',
    sha256: sha256(bin), bytes: bin.length, corpus: { ...TS_VALID, stories: docs.map((x) => x.story), T, skipFirst: 16 }, nDocs: docs.length, halves: nh, splitHalf,
    method: 'original Neuralese implementation of the neuron-lens R/S-lens method (prior art: stdlogits/neuron-lens; see docs/NEURON_LENS_METHOD.md)', fitSeconds: Math.round((Date.now() - t0) / 1000) };
  fs.writeFileSync(`${outDir}/manifest.json`, JSON.stringify(man, null, 1)); console.log('wrote', outDir, man.sha256, JSON.stringify(splitHalf));
}

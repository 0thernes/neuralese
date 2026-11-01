// Shared harness pieces for the v14.1–v14.9 experiments (docs/PREREG-v14x.md). Original Neuralese code.
import fs from 'node:fs'; import os from 'node:os'; import { Worker } from 'node:worker_threads';
import { loadModel, tokenizer, corpusText, stories, docsFrom, sha256 } from './nlens-common.mjs';
import * as NL from '../src/neuronlens.js';
export const PREREG = 'docs/PREREG-v14x.md', preregSha = () => sha256(fs.readFileSync(PREREG));
export const arg = (k, v) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : v; };
// Same corpus objects as tools/nlens-validate.mjs: kept vocab (≥5 occurrences in stories 0..19999) and 16 eval docs from story 20000.
export async function setup(modelDir = 'model', lensDir = 'lens/ts8m') {
  const M = loadModel(modelDir), tok = tokenizer('model'), st = stories(await corpusText('model/TinyStories-valid.txt'));
  const cnt = new Uint32Array(M.cfg.V); for (let i = 0; i < 20000; i++) for (const t of tok.encode(st[i])) cnt[t]++;
  const kept = []; for (let v = 0; v < M.cfg.V; v++) if (cnt[v] >= 5) kept.push(v);
  const evalDocs = docsFrom(tok, st, 20000, 16, 64).map((x) => x.ids);
  const man = JSON.parse(fs.readFileSync(`${lensDir}/manifest.json`, 'utf8')), buf = fs.readFileSync(`${lensDir}/lenses.f32`);
  if (sha256(buf) !== man.sha256) throw new Error('lens hash mismatch ' + lensDir);
  const Z = NL.unpackLenses(new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)), man);
  return { M, tok, st, cnt, kept, evalDocs, Z, man, modelDir };
}
export const p99 = (a) => { const s = Float32Array.from(a).sort(); return s[Math.floor(0.99 * (s.length - 1))]; };
export const med = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s[s.length >> 1]; };
export const q99 = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(0.99 * (s.length - 1))]; };
export function boot(xs, B = 2000) { const r = NL.mulberry(99), m = []; for (let b = 0; b < B; b++) { const s = xs.map(() => xs[Math.floor(r() * xs.length)]).sort((a, c) => a - c); m.push(s[s.length >> 1]); } m.sort((a, c) => a - c); return [m[Math.floor(0.025 * B)], m[Math.floor(0.975 * B)]]; }
export const r4 = (x) => +(+x).toFixed(4);
// Δ mean log-prob over kept tokens for each steer item {l, vec}, in a worker pool.
export function steerDeltas(modelDir, items, evalDocs, kept, nW = Math.max(1, os.cpus().length - 1)) {
  const out = new Array(items.length); let done = 0;
  return new Promise((res) => { if (!items.length) return res(out); const q = items.map((it, i) => ({ ...it, i })); let live = 0;
    for (let w = 0; w < Math.min(nW, q.length); w++) { const W = new Worker(new URL('./v14x-worker.mjs', import.meta.url), { workerData: { modelDir, evalDocs, kept } }); live++;
      const next = () => { const j = q.shift(); if (!j) { W.terminate(); if (--live === 0) res(out); return; } W.postMessage(j); };
      W.on('message', (m) => { out[m.i] = m.D; if (++done % 10 === 0) console.log(`steer ${done}/${items.length}`); next(); }); W.on('error', (e) => { console.error(e); process.exit(1); }); next(); } });
}
// Test A scoring of reads[i] vs Ds[i] with the mismatched-pair τ99 null.
export function scoreA(reads, Ds) {
  const n = reads.length, r = reads.map((rd, i) => NL.pearson(rd, Ds[i])), mis = []; reads.forEach((rd, i) => Ds.forEach((D, j) => { if (i !== j) mis.push(NL.pearson(rd, D)); }));
  const tau = q99(mis), pass = r.filter((x) => x > tau).length;
  return { n, medianR: r4(med(r)), medianR_CI: boot(r).map(r4), tau99: r4(tau), passRate: r4(pass / n), passCI: NL.wilson(pass, n).map(r4), nullPassRate: r4(mis.filter((x) => x > tau).length / mis.length), r: r.map(r4) };
}
export function writeResult(path, obj) { fs.writeFileSync(path, JSON.stringify({ prereg_sha256: preregSha(), date: new Date().toISOString(), ...obj }, null, 1)); console.log('wrote', path); }

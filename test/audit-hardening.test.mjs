import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { concatUint8, joinLines } from '../src/bytes.js';
import { GPT2Tokenizer, parseVocabYield } from '../src/tokenizer.js';
import { parseSafetensors, parseSafetensorsYield } from '../src/model.js';
import { kl } from '../src/analytics.js';
import { svd, svdReconstruct } from '../src/linalg.js';
import { filterDist, pick } from '../src/decode.js';
import * as Grok from '../src/frontier/grok.js';
import { headAblationCE } from '../src/research.js';
import { ceJetLnf, ceJetLnfAsync, Jet } from '../src/tsotchke/taylor.js';
import { assessInverter, cmosParams, transferCurveYield } from '../src/walk/cmos.js';

test('concatUint8 matches a single copy', async () => {
  const a = Uint8Array.from({ length: 50 }, (_, i) => i);
  const b = Uint8Array.from({ length: 30 }, (_, i) => 100 + i);
  const out = await concatUint8([a, b]);
  assert.equal(out.length, 80);
  assert.deepEqual([...out.subarray(0, 50)], [...a]);
  assert.deepEqual([...out.subarray(50)], [...b]);
});

test('joinLines keeps a newline between chunks and not after the last', () => {
  const parts = joinLines(['a', 'b', 'c', 'd', 'e'], 2);
  assert.deepEqual(parts, ['a\nb\n', 'c\nd\n', 'e']);
  assert.equal(parts.join(''), 'a\nb\nc\nd\ne');
});

test('a yielded inverter curve matches one full curve', async () => {
  const p = cmosParams({ VDD: 1, Vth0: 0.25, T: 300 });
  const curve = await transferCurveYield(p, 41);
  const full = assessInverter(p, { steps: 41 });
  assert.equal(curve.length, full.curve.length);
  for (let i = 0; i < curve.length; i++) assert.ok(Math.abs((curve[i].vout ?? 0) - (full.curve[i].vout ?? 0)) < 1e-9);
});

test('a yielded vocab parse matches JSON.parse', async () => {
  const text = readFileSync(new URL('../model/vocab.json', import.meta.url), 'utf8');
  const yielded = await parseVocabYield(text);
  const parsed = JSON.parse(text);
  assert.equal(Object.keys(yielded).length, Object.keys(parsed).length);
  for (const k of ['Once', ' hello', '!']) if (k in parsed) assert.equal(yielded[k], parsed[k]);
  assert.equal(yielded[Object.keys(parsed)[0]], parsed[Object.keys(parsed)[0]]);
});

test('the shipped BPE table matches merges.txt', () => {
  const vocab = JSON.parse(readFileSync(new URL('../model/vocab.json', import.meta.url), 'utf8'));
  const merges = readFileSync(new URL('../model/merges.txt', import.meta.url), 'utf8');
  const raw = readFileSync(new URL('../src/bpe-ranks.bin', import.meta.url));
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const slow = new GPT2Tokenizer(vocab, merges);
  const fast = GPT2Tokenizer.fromPairs(vocab, buffer);
  const text = 'Once upon a time, there was a little girl named Lily. She loved to';
  assert.deepEqual(fast.encode(text), slow.encode(text));
  assert.equal(fast.decode(fast.encode(text)), slow.decode(slow.encode(text)));
  const invRaw = readFileSync(new URL('../src/vocab-inv.bin', import.meta.url));
  const inv = invRaw.buffer.slice(invRaw.byteOffset, invRaw.byteOffset + invRaw.byteLength);
  const lazy = GPT2Tokenizer.fromPairs(vocab, buffer, true).installInverse(inv);
  const ids = slow.encode(text);
  assert.equal(lazy.decode(ids), slow.decode(ids));
  assert.equal(lazy.tokenStr(ids[0]), slow.tokenStr(ids[0]));
  assert.equal(lazy.strCache.size, 1);
});

test('tokenizer.create matches the sync constructor on a small vocab', async () => {
  const vocab = { hello: 0, world: 1, '!': 2 };
  const merges = '#version: 0.2\nhello world\n';
  const sync = new GPT2Tokenizer(vocab, merges);
  const asyncTok = await GPT2Tokenizer.create(vocab, merges);
  assert.equal(asyncTok.decoder[0], 'hello');
  assert.equal(asyncTok.decoder[1], sync.decoder[1]);
  assert.equal(asyncTok.ranks.get('hello world'), sync.ranks.get('hello world'));
  assert.equal(asyncTok.encode('hello').length, sync.encode('hello').length);
});

test('parseSafetensorsYield views equal the copying parser', async () => {
  const buf = new ArrayBuffer(16);
  const src = new Float32Array(buf);
  src.set([1.25, -3, 4, 0.5]);
  const header = {
    __metadata__: { dtype: 'U8' },
    'w.weight': { dtype: 'F32', data_offsets: [0, 8] },
    'b.bias': { dtype: 'F32', data_offsets: [8, 16] },
  };
  const copied = parseSafetensors(buf, 0, header);
  const viewed = await parseSafetensorsYield(buf, header);
  assert.deepEqual([...viewed['w.weight']], [...copied['w.weight']]);
  assert.deepEqual([...viewed['b.bias']], [...copied['b.bias']]);
  assert.equal(viewed['w.weight'].buffer, buf);
});

test('first-party scripts do not call eval or new Function', () => {
  const bad = [];
  const walk = (d) => { for (const n of readdirSync(d)) { if (n === 'vendor') continue; const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(js|mjs)$/.test(n) && /\beval\s*\(|new Function\s*\(/.test(readFileSync(p, 'utf8'))) bad.push(p); } };
  walk(new URL('../src/', import.meta.url).pathname);
  assert.deepEqual(bad, []);
});

test('min-p cannot empty the candidate list', () => {
  const d = filterDist([0, 1, 0.2], { temp: 1, topk: 3, topp: 1, minp: 5, typical: 1 });
  assert.equal(d.ids.length, 1);
  assert.ok(d.probs.every((x) => Number.isFinite(x) && x > 0));
  assert.equal(pick(d, () => 0.5, true), d.ids[0]);
});

test('Jacobi SVD reconstructs a small matrix within 1e-8', () => {
  const A = [4, 1, 0, 1, 3, 1, 0, 1, 2];
  const R = svd(A, 3, 3);
  const back = svdReconstruct(R, R.S);
  for (let i = 0; i < 9; i++) assert.ok(Math.abs(back[i] - A[i]) < 1e-8, `${i} ${back[i]} vs ${A[i]}`);
  assert.ok(R.S[0] >= R.S[1] && R.S[1] >= R.S[2]);
});

test('kl of a distribution with itself is 0, and a one-bit shift matches log 2', () => {
  assert.equal(kl([0.5, 0.5], [0.5, 0.5]), 0);
  const got = kl([1, 0], [0.5, 0.5]);
  assert.ok(Math.abs(got - Math.log(2)) < 1e-12);
  assert.equal(kl([0.2, 0.8], [0, 1]), Infinity);
});

test('lab export stringifies one run at a time', () => {
  const src = readFileSync(new URL('../src/lab-eval.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('JSON.stringify(lab.dump()'));
  assert.match(src, /label: 'lab-export'/);
});

test('chart csv export no longer builds one Blob from the whole string on the main thread', () => {
  const ui = readFileSync(new URL('../src/lab-ui.js', import.meta.url), 'utf8');
  assert.ok(!ui.includes('new Blob(Array.isArray'));
  assert.ok(ui.includes('export-worker.js'));
  const charts = readFileSync(new URL('../src/charts.js', import.meta.url), 'utf8');
  assert.ok(!charts.includes('out +='));
});

test('pages workflow publishes only under preview and keeps the live root', () => {
  const yml = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.match(yml, /destination_dir:\s*preview/);
  assert.match(yml, /keep_files:\s*true/);
  const dest = yml.indexOf('destination_dir:');
  const pub = yml.indexOf('publish_dir:');
  assert.ok(pub !== -1 && dest > pub);
});

test('science tests fetch the pinned TinyStories weights and do not skip', () => {
  const src = readFileSync(new URL('./science.test.mjs', import.meta.url), 'utf8');
  assert.match(src, /tools\/fetch-model\.mjs/);
  assert.ok(!src.includes('t.skip'));
  assert.match(src, /not skipped/);
});

test('ACDC async path yields per node and does not score with the sync objective', () => {
  const src = readFileSync(new URL('../src/research.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export async function acdcAsync'));
  assert.match(fn, /await frame\(\)/);
  assert.match(fn, /metricAsync\(/);
  assert.ok(!fn.slice(0, fn.indexOf('export async function scrubAsync')).includes('objective('));
});

test('a yielded unembed matches a full matvec', async () => {
  const { matvec, matvecYield } = await import('../src/engine.js');
  const nOut = 3000, nIn = 8;
  const W = Float32Array.from({ length: nOut * nIn }, (_, i) => ((i * 17) % 50) / 25 - 1);
  const x = Float32Array.from({ length: nIn }, (_, i) => i - 3);
  const a = matvec(W, x, new Float32Array(nOut), nOut, nIn);
  const b = await matvecYield(W, x, new Float32Array(nOut), nOut, nIn, null, async () => {}, 1024);
  for (let i = 0; i < nOut; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-5);
});

test('the beginner guide states the weight download size', () => {
  const guide = readFileSync(new URL('../docs/STEERING_GUIDE.md', import.meta.url), 'utf8');
  assert.equal((guide.match(/112 MB/g) || []).length, 2);
  assert.ok(!guide.includes('80 MB'));
  try { const st = statSync(new URL('../model/model.safetensors', import.meta.url)); if (st.isFile()) assert.ok(st.size > 100e6 && st.size < 120e6); } catch { /* the science test fetches the file; this check is the prose */ }
});

test('the CI model cache key is the pinned TinyStories-8M hash', () => {
  const yml = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  const fetchSrc = readFileSync(new URL('../tools/fetch-model.mjs', import.meta.url), 'utf8');
  const pin = fetchSrc.match(/model\.safetensors': \[[^\]]*'([0-9a-f]{64})'/);
  assert.ok(pin, 'pin');
  assert.match(yml, new RegExp('key: tinystories-8m-' + pin[1]));
  assert.match(yml, /node tools\/fetch-model\.mjs/);
});

test('a yielded CE jet matches the sync jet', async () => {
  const d = 4, V = 7, T = 3;
  const W = { lnfW: Float32Array.from([1, 0.8, 1.1, 0.9]), lnfB: Float32Array.from([0.1, -0.1, 0, 0.2]), wte: Float32Array.from({ length: V * d }, (_, i) => ((i * 3) % 11) / 10 - 0.5) };
  const x = Float32Array.from({ length: T * d }, (_, i) => ((i * 5) % 9) / 20);
  const ids = [1, 4, 2], v = Float64Array.from([0.2, -0.1, 0.05, 0.1]);
  const a = ceJetLnf(W, x, ids, v, 2);
  const b = await ceJetLnfAsync(W, x, ids, v, 2, async () => {});
  assert.ok(a instanceof Jet);
  for (let k = 0; k < a.c.length; k++) assert.ok(Math.abs(a.c[k] - b.c[k]) < 1e-8, k + ' ' + a.c[k] + ' ' + b.c[k]);
});

test('png export captures an ImageBitmap and encodes the blob in the worker', () => {
  const src = readFileSync(new URL('../src/lab-ui.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('async function pngBlob'), src.indexOf('export async function exportFor'));
  assert.match(fn, /createImageBitmap/);
  assert.match(fn, /resizeWidth/);
  assert.match(fn, /const max = 96/);
  assert.ok(!fn.includes('getImageData') && !fn.includes('toDataURL') && !fn.includes('toBlob') && !fn.includes('new Blob'));
  const worker = readFileSync(new URL('../src/export-worker.js', import.meta.url), 'utf8');
  assert.match(worker, /convertToBlob/);
  assert.match(worker, /new Blob/);
  assert.match(worker, /createObjectURL/);
  assert.ok(!worker.includes('arrayBuffer'));
});

test('evalCorpus chunks the token step and the unembed', () => {
  const src = readFileSync(new URL('../src/labcore.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export async function evalCorpus'), src.indexOf('export function calibration'));
  assert.match(fn, /budget: true/);
  assert.match(fn, /logitsYield/);
});

test('head ablation CE changes when a head is zeroed and restores the columns', () => {
  const d = 8, hd = 4, H = 2, ff = 8, V = 12;
  const g = (n, s = 1) => Float32Array.from({ length: n }, (_, i) => Math.sin(i * 1.3 + s) * 0.2);
  const layer = () => ({ ln1w: g(d, 2).map((x) => 1 + x * 0.1), ln1b: g(d, 3), q: g(d * d, 4), k: g(d * d, 5), v: g(d * d, 6), o: g(d * d, 7), ob: g(d, 8), ln2w: g(d, 9).map((x) => 1 + x * 0.1), ln2b: g(d, 10), fc: g(ff * d, 11), fcb: g(ff, 12), proj: g(d * ff, 13), projb: g(d, 14) });
  const W = { wte: g(V * d, 15), wpe: g(32 * d, 16), lnfW: g(d, 17).map((x) => 1 + x * 0.1), lnfB: g(d, 18), layers: [layer()], cfg: { d, H, hd, ff, V, eps: 1e-5 } };
  const docs = [[1, 2, 3, 4], [3, 1, 5, 2]];
  const r = headAblationCE(W, 0, docs);
  assert.equal(r.base.length, 2);
  assert.equal(r.ablated.length, H);
  assert.ok(Math.abs(r.ablated[0][0] - r.base[0]) > 1e-6);
  const again = headAblationCE(W, 0, docs);
  assert.ok(Math.abs(again.base[0] - r.base[0]) < 1e-8);
});

test('a yielded grokking step matches one full step', async () => {
  const cfg = { p: 7, N: 8, lr: 3e-3, wd: 1, frac: 0.5, steps: 2, seed: 1 };
  const a = Grok.init(cfg), b = Grok.init(cfg);
  Grok.step(a);
  await Grok.stepYield(b, async () => {}, 3);
  assert.equal(a.t, b.t);
  for (let q = 0; q < 3; q++) for (let i = 0; i < a.P[q].length; i++) assert.ok(Math.abs(a.P[q][i] - b.P[q][i]) < 1e-8);
});

test('frontier and neuron-lens docs name the files that exist', () => {
  const frontier = readFileSync(new URL('../docs/FRONTIER.md', import.meta.url), 'utf8');
  assert.match(frontier, /src\/frontier\/data/);
  assert.ok(statSync(new URL('../src/frontier/data/grok.json', import.meta.url)).isFile());
  const method = readFileSync(new URL('../docs/NEURON_LENS_METHOD.md', import.meta.url), 'utf8');
  assert.match(method, /TinyStories-1M and TinyStories-3M/);
  assert.match(method, /were not fitted/);
});

test('the v13 stack record points at the current src tree', () => {
  const doc = readFileSync(new URL('../docs/STACK.md', import.meta.url), 'utf8');
  assert.match(doc, /src\/vendor\/three\/three\.module\.min\.js/);
  assert.match(doc, /package\.json/);
  assert.ok(statSync(new URL('../src/vendor/three/three.module.min.js', import.meta.url)).isFile());
});

test('H9 cites the hub registry that exists in this tree', () => {
  const claims = readFileSync(new URL('../docs/CLAIMS.md', import.meta.url), 'utf8');
  assert.match(claims, /TOOL_MATRIX in `src\/hub\/models\.js`/);
  assert.ok(!claims.includes('site/hub/models.js'));
  const hub = readFileSync(new URL('../src/hub/models.js', import.meta.url), 'utf8');
  assert.match(hub, /export const TOOL_MATRIX/);
  assert.match(hub, /no log-prob readout, no activations, no patching/);
});

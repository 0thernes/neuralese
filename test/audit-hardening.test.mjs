import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { concatUint8, joinLines } from '../src/bytes.js';
import { GPT2Tokenizer } from '../src/tokenizer.js';
import { parseSafetensors, parseSafetensorsYield } from '../src/model.js';
import { kl } from '../src/analytics.js';
import { svd, svdReconstruct } from '../src/linalg.js';
import { filterDist, pick } from '../src/decode.js';

test('concatUint8 matches a single copy and yields between steps', async () => {
  const a = Uint8Array.from({ length: 50 }, (_, i) => i);
  const b = Uint8Array.from({ length: 30 }, (_, i) => 100 + i);
  let pauses = 0;
  const out = await concatUint8([a, b], 16, async () => { pauses++; });
  assert.equal(out.length, 80);
  assert.deepEqual([...out.subarray(0, 50)], [...a]);
  assert.deepEqual([...out.subarray(50)], [...b]);
  assert.ok(pauses >= 2);
});

test('joinLines keeps a newline between chunks and not after the last', () => {
  const parts = joinLines(['a', 'b', 'c', 'd', 'e'], 2);
  assert.deepEqual(parts, ['a\nb\n', 'c\nd\n', 'e']);
  assert.equal(parts.join(''), 'a\nb\nc\nd\ne');
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

// v12 MODEL HUB + fine-tune tests. The in-browser model runs (Whisper, MMS-TTS, MiniLM, TrOCR, CLIP, ViT-GPT2, DistilGPT-2)
// are exercised by smoke-v12.mjs in headless Chrome; here: the pure helpers, the pinned vendored runtime, wiring, and the
// fine-tune (exact-gradient Adam on 1,536 params, held-out CE) including bit-for-bit equivalence of the 'ft' weight edit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MODELS, ORT_WASM, TFJS, TFJS_VERSION, cosine, resample, wav, wer, cer, pca3, TRANSFORMS, byKey } from '../hub/models.js';
import { chunks, split, fineTune, toEdit } from '../hub/finetune.js';
import { load } from '../tools/_fload.mjs';
import { GPT2Tokenizer } from '../tokenizer.js';
import { Editor } from '../surgery.js';
import { cloneWeights } from '../model.js';
import { theta0, evalSet, precompute } from '../frontier/rsi.js';
const S = (p) => readFileSync(new URL('../' + p, import.meta.url));
const sha = (b) => createHash('sha256').update(b).digest('hex');
test('V12-1 registry: 8 hub models, unique keys, each a public ONNX repo id with task and size', () => {
  assert.equal(MODELS.length, 8); assert.equal(new Set(MODELS.map((m) => m.key)).size, 8);
  for (const m of MODELS) { assert.match(m.repo, /^[\w-]+\/[\w.-]+$/); assert.ok(m.task && m.mb > 0 && m.mb < 300, m.key); }
  assert.deepEqual(['embed', 'asr', 'tts', 'ocr', 'caption', 'clip'].map((k) => byKey(k).task), ['feature-extraction', 'automatic-speech-recognition', 'text-to-speech', 'image-to-text', 'image-to-text', 'zero-shot-image-classification']);
  assert.throws(() => byKey('nope')); });
test('V12-2 runtime pins: transformers.js 4.3.1 and ORT wasm by version + SHA-256; vendored ORT loader hash; worker verifies before executing', () => {
  assert.equal(TFJS_VERSION, '4.3.1'); assert.equal(TFJS.sha256, '8d6716d9086f57c30a4bf367dba61b887593573c770c454465e8019b2703e743'); assert.match(TFJS.url, /@huggingface\/transformers@4\.3\.1\/dist\/transformers\.min\.js$/);
  assert.equal(sha(S('hub/vendor/ort-wasm-simd-threaded.jsep.mjs')), 'c2f80e915e9df63289788a99d434d8c4e00e64e9c1f030f4b80b022458dd2c99');
  assert.match(ORT_WASM.sha256, /^[0-9a-f]{64}$/); assert.match(ORT_WASM.url, /^https:\/\/cdn\.jsdelivr\.net\/npm\/onnxruntime-web@1\.31\.0-dev\.20260914-8d85527a0\//);
  const w = S('hub/worker.js').toString(); assert.match(w, /SHA-256 mismatch/); assert.match(w, /wasmBinary = buf/); assert.match(w, /verified\(TFJS\.url, TFJS\.sha256/); assert.ok(!/from '\.\/vendor\/transformers/.test(w)); });
test('V12-3 wiring: HUB group has 6 tabs, CSP allows workers from self and HF downloads, version 13.0.0', async () => {
  const html = S('index.html').toString(); assert.match(html, /worker-src 'self' blob:/); assert.match(html, /connect-src[^;]*https:\/\/huggingface\.co/); assert.match(html, /v13\.0\.0/);
  const ui = S('lab-ui.js').toString(); assert.match(ui, /\['HUB', \['hub', 'hemb', 'hspeech', 'hvision', 'hgen', 'hft'\]\]/);
  assert.match(S('term.js').toString(), /VERSION = '13\.0\.0'/); assert.ok(!/\?v=11/.test(S('lab-hub.js').toString())); });
test('V12-4 cosine, resample, WAV header', () => {
  assert.equal(cosine([1, 0], [0, 1]), 0); assert.ok(Math.abs(cosine([1, 2, 3], [2, 4, 6]) - 1) < 1e-12);
  const x = Float32Array.from({ length: 48000 }, (_, i) => Math.sin(2 * Math.PI * 440 * i / 48000)), y = resample(x, 48000, 16000); assert.equal(y.length, 16000);
  let zc = 0; for (let i = 1; i < y.length; i++) if (y[i - 1] < 0 && y[i] >= 0) zc++; assert.ok(Math.abs(zc - 440) <= 1, 'frequency preserved: ' + zc);
  const w = wav(new Float32Array([0, 1, -1]), 16000), v = new DataView(w.buffer); assert.equal(String.fromCharCode(...w.slice(0, 4)), 'RIFF'); assert.equal(v.getUint32(24, true), 16000); assert.equal(v.getInt16(46, true), 32767); assert.equal(v.getInt16(48, true), -32767); assert.equal(w.length, 50); });
test('V12-5 WER and CER match hand-computed values', () => {
  assert.equal(wer('the cat sat', 'the cat sat'), 0); assert.equal(wer('the cat sat', 'the bat sat'), 1 / 3); assert.equal(wer('the cat sat', 'the cat'), 1 / 3); assert.equal(wer('Hello, world!', 'hello world'), 0);
  assert.equal(cer('ABC', 'ABC'), 0); assert.equal(cer('ABCD', 'ABXD'), 0.25); assert.equal(cer('lab  2026', 'LAB 2026'), 0); });
test('V12-6 pca3 recovers a planted 3D structure and orders variance', () => {
  const r = (s) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5); const g = r(7), basis = [0, 1, 2].map(() => Array.from({ length: 20 }, g));
  const rows = Array.from({ length: 60 }, () => { const c = [3 * g(), 2 * g(), 1 * g()]; return Array.from({ length: 20 }, (_, j) => c[0] * basis[0][j] + c[1] * basis[1][j] + c[2] * basis[2][j] + 1e-4 * g()); });
  const P = pca3(rows, 200); const tot = P.explained.reduce((a, b) => a + b, 0); assert.ok(tot > 0.999, 'top-3 explain ' + tot); assert.ok(P.explained[0] >= P.explained[1] && P.explained[1] >= P.explained[2]); assert.equal(P.coords[0].length, 3); });
test('V12-7 speech-to-speech transforms are deterministic', () => { assert.equal(TRANSFORMS.reverse('a b c'), 'c b a'); assert.equal(TRANSFORMS.pirate('hello you'), 'ahoy ye'); assert.equal(TRANSFORMS.summary('One. Two.'), 'One.'); });
test('V12-8 chunking + held-out split never overlap', () => { const cs = chunks([...Array(100).keys()], 32, 16); assert.equal(cs.length, 3); const { train, held } = split(chunks([...Array(320).keys()], 32), 3); assert.equal(train.length + held.length, 10); assert.equal(held.length, 3); for (const h of held) for (const t of train) assert.ok(h[0] !== t[0]); });
const W = await load('8M'), M = '../model/', tok = new GPT2Tokenizer(JSON.parse(readFileSync(new URL(M + 'vocab.json', import.meta.url))), readFileSync(new URL(M + 'merges.txt', import.meta.url), 'utf8'));
const TXT = 'The robot named Zork beeped twice. Zork the robot loved to eat bolts and gears. Every morning Zork said beep boop to the sun. One day Zork met a cat named Fizz. Fizz did not like bolts, but Fizz liked Zork. Zork and Fizz played in the park all day. When the sun went down, Zork said beep boop to the moon. Fizz purred and fell asleep next to Zork. The next morning Zork beeped twice and Fizz woke up. They ate breakfast together: bolts for Zork and fish for Fizz. Zork the robot was happy. Fizz the cat was happy too.';
let FT = null;
test('V12-9 fine-tune lowers HELD-OUT cross-entropy (95% CI below 0) with 1,536 params', { timeout: 600000 }, async () => {
  FT = await fineTune(W, tok.encode(TXT), { steps: 3, lr: 0.01 }); assert.equal(FT.params, 1536); assert.ok(FT.heldChunks >= 1 && FT.trainChunks >= 2); assert.ok(FT.after < FT.before, `${FT.before} → ${FT.after}`); assert.ok(FT.delta.hi < 0, JSON.stringify(FT.delta)); assert.equal(FT.improved, true); });
test('V12-10 applying the ft edit to the weights reproduces the fine-tuned CE exactly (edit is replayable from clean weights)', { timeout: 600000 }, async () => {
  if (!FT) FT = await fineTune(W, tok.encode(TXT), { steps: 1, lr: 0.01 });
  const Wm = cloneWeights(W), ed = new Editor(W, Wm); ed.push(toEdit(FT, 3)); const ids = tok.encode(TXT).slice(0, 32);
  const a = evalSet(W, FT.theta, [precompute(W, ids)]).ce, b = evalSet(Wm, theta0(Wm), [precompute(Wm, ids)]).ce; assert.ok(Math.abs(a - b) < 1e-4, `${a} vs ${b}`);
  ed.setEdits([]); assert.equal(sha(Buffer.from(Wm.lnfW.buffer)), sha(Buffer.from(W.lnfW.buffer)), 'undo restores ln_f bit-for-bit'); });

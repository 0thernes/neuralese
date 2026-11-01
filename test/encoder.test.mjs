// v16 HUB-model interpretability: our JS ViT / CLIP-vision / Whisper-encoder forwards reproduce HF (float64) logits, embeddings,
// every hidden state and attention patterns, so the lens/probe/attention tools read real internals. Skips (loudly) if weights are absent.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { readSafetensors } from '../src/arch/arch.js'; import { encoderFromHF, mapEncoder, encode, vitLens, clipLensEmb, rollout, linearProbe, erf, whisperLogMel, melFilters } from '../src/arch/encoder.js';
const REF = JSON.parse(fs.readFileSync(new URL('./ref/ref_encoder.json', import.meta.url))), TOL = 1e-4;
const img = (S) => { const a = new Float32Array(3 * S * S); for (let c = 0; c < 3; c++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) a[c * S * S + y * S + x] = Math.sin(0.11 * x + 0.7 * c) * Math.cos(0.13 * y - 0.3 * c) * 0.9; return a; };
const mel = (M, T) => { const a = new Float64Array(M * T); for (let m = 0; m < M; m++) for (let t = 0; t < T; t++) a[m * T + t] = Math.sin(0.02 * t + 0.3 * m) * 0.8 - 0.2; return a; };
const load = (dir) => { const p = new URL(`../model/arch/${dir}/`, import.meta.url); if (!fs.existsSync(new URL('model.safetensors', p))) return null; const E = encoderFromHF(JSON.parse(fs.readFileSync(new URL('config.json', p)))); return { E, W: mapEncoder(E, readSafetensors(fs.readFileSync(new URL('model.safetensors', p)))) }; };
const maxd = (a, b) => { let m = 0; for (let i = 0; i < b.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };
function cmpHidden(o, R, d) { let m = 0; R.hidden.forEach((H, l) => H.forEach((row, t) => { m = Math.max(m, maxd(o.hidden[l].subarray(t * d, t * d + 16), row)); })); return m; }
function cmpAttn(o, R, L, N) { let m = 0; R.attn0.forEach((row, t) => { m = Math.max(m, maxd(o.patterns[0][0].subarray(t * N, t * N + N), row)); }); R.attnL.forEach((row, t) => { m = Math.max(m, maxd(o.patterns[L - 1][5].subarray(t * N, t * N + N), row)); }); return m; }
test('ENC-0 erf matches known values to 1e-14', () => { for (const [x, v] of [[0.5, 0.5204998778130465], [1, 0.8427007929497149], [2, 0.9953222650189527], [3, 0.9999779095030014], [-1.5, -0.9661051464753108]]) assert.ok(Math.abs(erf(x) - v) < 1e-14, x); });
const vit = load('vit-base-patch16-224');
test('ENC-1 ViT-B/16: logits, all 13 hidden states, attention match HF; logit lens ends at the real prediction', { skip: !vit && 'weights missing' }, () => {
  const { E, W } = vit, o = encode(E, W, img(224), { attnLayers: [0, E.L - 1] }), lens = vitLens(E, W, o.hidden), R = REF.vit;
  const ml = maxd(lens[E.L], R.logits), mh = cmpHidden(o, R, E.d), ma = cmpAttn(o, R, E.L, o.N); console.log(`  vit: |Δlogit| ${ml.toExponential(2)} |Δhidden| ${mh.toExponential(2)} |Δattn| ${ma.toExponential(2)}`);
  assert.ok(ml <= TOL && mh <= TOL && ma <= 1e-6); const top = (v) => v.indexOf(Math.max(...v)); console.log('  vit lens top-1 per layer:', lens.map((v) => E.labels[top(v)]).join(' | ').slice(0, 300));
  const R0 = rollout(o.patterns, o.N, [0]); for (let t = 0; t < o.N; t++) { let s = 0; for (let j = 0; j < o.N; j++) s += R0[t * o.N + j]; assert.ok(Math.abs(s - 1) < 1e-9); }
});
const clip = load('CLIP-ViT-B-32-laion2B-s34B-b79K');
test('ENC-2 CLIP ViT-B/32 vision tower: image embedding, hidden states, attention match HF; linear probe beats majority on a real feature', { skip: !clip && 'weights missing' }, () => {
  const { E, W } = clip, o = encode(E, W, img(224), { attnLayers: [0, E.L - 1] }), R = REF.clip, emb = clipLensEmb(E, W, o.hidden);
  let n = 0; for (const v of R.image_embeds) n += v * v; n = Math.sqrt(n); const me = maxd(emb[E.L], R.image_embeds.map((v) => v / n)), mh = cmpHidden(o, R, E.d), ma = cmpAttn(o, R, E.L, o.N);
  console.log(`  clip: |Δemb| ${me.toExponential(2)} |Δhidden| ${mh.toExponential(2)} |Δattn| ${ma.toExponential(2)}`); assert.ok(me <= TOL && mh <= TOL && ma <= 1e-6);
  // probe sanity on real activations: patch tokens of the top half vs bottom half of the image are linearly separable from layer-6 states
  const d = E.d, X = o.hidden[6], g = E.img / E.patch, feats = [], labels = []; for (let p = 0; p < g * g; p++) { feats.push(Array.from(X.subarray((p + 1) * d, (p + 2) * d)).slice(0, 64)); labels.push(Math.floor(p / g) < g / 2); }
  const pr = linearProbe(feats, labels, { lambda: 1e-1 }); console.log('  clip probe (top vs bottom half, layer 6, 64 dims):', pr); assert.ok(pr.testAcc > pr.testMajority);
});
const wh = load('whisper-tiny.en');
test('ENC-3 Whisper-tiny.en encoder: all hidden states (last post-LN) and attention match HF', { skip: !wh && 'weights missing' }, () => {
  const { E, W } = wh, o = encode(E, W, mel(E.mels, E.frames), { attnLayers: [0, E.L - 1] }), R = REF.whisper, d = E.d;
  const mh = cmpHidden(o, R, d); let mt = 0; R.last_tail.forEach((row, k) => { const t = o.N - 3 + k; mt = Math.max(mt, maxd(o.hidden[E.L].subarray(t * d, t * d + 32), row)); }); const ma = cmpAttn(o, R, E.L, o.N);
  console.log(`  whisper: |Δhidden| ${mh.toExponential(2)} |Δtail| ${mt.toExponential(2)} |Δattn| ${ma.toExponential(2)}`); assert.ok(mh <= TOL && mt <= TOL && ma <= 1e-6);
});
test('ENC-4 Whisper log-mel front end matches HF WhisperFeatureExtractor (chirp + tone)', () => {
  const R = JSON.parse(fs.readFileSync(new URL('./ref/ref_mel.json', import.meta.url))), sr = 16000, a = new Float64Array(2 * sr);
  for (let i = 0; i < a.length; i++) { const t = i / sr; a[i] = 0.3 * Math.sin(2 * Math.PI * (200 * t + 400 * t * t)) + 0.1 * Math.sin(2 * Math.PI * 1000 * t); }
  const f = whisperLogMel(a), fb = melFilters(); let m = 0, mf = 0; R.cols.forEach((row, k) => row.forEach((v, j) => { m = Math.max(m, Math.abs(f[k * 3000 + j * R.stride] - v)); }));
  R.filters_mel10.forEach((v, k) => { mf = Math.max(mf, Math.abs(fb[10 * 201 + k] - v)); }); console.log(`  mel: |Δfeat| ${m.toExponential(2)} |Δfilter| ${mf.toExponential(2)}`); assert.ok(m < 1e-4 && mf < 1e-6);
});

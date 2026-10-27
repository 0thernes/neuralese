import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { GPT2Tokenizer } from '../tokenizer.js';
import { buildWeights, parseSafetensors, cloneWeights, CFG } from '../model.js';
import { Engine, defaultRuntime, logSoftmax } from '../engine.js';
import { computeStats, actCovariance, fitTunedLens, lensGrid, dla, patchResid, patchHeads, pathPatchHeadsToLogits, ablationSweep, buildControlVector, vectorArithmetic, tokenStats } from '../analysis.js';
import { Editor, getMat, toSafetensors, quantize } from '../surgery.js';
import { svd, svdReconstruct } from '../linalg.js';
import { computeRome } from '../rome.js';
import { SAE } from '../sae.js';
import { applyPenalties, filterDist, beamSearch, cfgLogits, contrastiveLogits } from '../decode.js';
import { CORPUS } from '../corpus.js';

const M = 'model/';
const buf = fs.readFileSync(M + 'model.safetensors'); const n = Number(buf.readBigUInt64LE(0)); const hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
const ORIG = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr));
const tok = new GPT2Tokenizer(JSON.parse(fs.readFileSync(M + 'vocab.json')), fs.readFileSync(M + 'merges.txt', 'utf8'));
const REF = JSON.parse(fs.readFileSync('ref.json'));
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
const MOD = cloneWeights(ORIG); const ed = new Editor(ORIG, MOD);
const clean = () => new Engine(ORIG, defaultRuntime());
const lastLogits = (eng, s) => eng.logits(eng.run(tok.encode(s)).last.h);
const P0 = 'Once upon a time, there was a little girl named Lily. She loved to';
const maxDiff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };
let STATS;

test('tokenizer matches HF ids', () => assert.deepEqual(tok.encode(P0), REF.lens_ids));
test('forward pass matches PyTorch logits', () => { const l = lastLogits(clean(), P0); for (let i = 0; i < 20; i++) close(l[i], REF.final_logits_last[i], 1e-4, 'logit ' + i); });
test('logit lens matches PyTorch (all 9 rows × all positions)', () => {
  const e = clean(); const tr = e.run(REF.lens_ids, { trace: true }).traces; const G = lensGrid(e, tr, { k: 1 });
  for (let r = 0; r < 9; r++) for (let p = 0; p < tr.length; p++) { assert.equal(G[p][r].ids[0], REF.lens[r].top[p], `row ${r} pos ${p}`); close(Math.log(G[p][r].probs[0]), REF.lens[r].lp[p], 1e-3, `lp ${r},${p}`); }
});
test('DLA per head matches PyTorch, and the decomposition is exact', () => {
  const e = clean(); const tr = e.run(REF.lens_ids, { trace: true }).traces; const t = tr[tr.length - 1]; const R = dla(e, t, REF.dla_target);
  for (const h of R.heads) close(h.v, REF.dla_heads[h.l * 16 + h.h], 1e-3, `head L${h.l}H${h.h}`);
  close(R.total, e.logitOf(t.h, REF.dla_target), 1e-4, 'sum of components = logit');
  close(R.other, 0, 1e-4, 'no unexplained residual on clean model');
});
test('activation patching (resid × position) matches PyTorch', async () => {
  const p = REF.patch, e = clean(); const r = await patchResid(e, tok.encode(p.clean), tok.encode(p.corr), p.ans, p.wrong);
  close(r.clean, REF.patch_clean, 1e-3, 'clean'); close(r.corrupt, REF.patch_corr, 1e-3, 'corrupt');
  r.M.forEach((row, l) => row.forEach((c, q) => close(c.raw, REF.patch_resid[l][q], 2e-3, `L${l} p${q}`)));
});
test('head patching + path patching (head→logits) match PyTorch', async () => {
  const p = REF.patch, e = clean(); const r = await patchHeads(e, tok.encode(p.clean), tok.encode(p.corr), p.ans, p.wrong);
  r.M.forEach((row, l) => row.forEach((c, h) => close(c.raw, REF.patch_heads[l][h], 2e-3, `L${l}H${h}`)));
  const q = pathPatchHeadsToLogits(e, tok.encode(p.clean), tok.encode(p.corr), p.ans, p.wrong);
  q.M.forEach((row, l) => row.forEach((c, h) => close(c.raw, REF.path_heads[l][h], 2e-3, `path L${l}H${h}`)));
});
test('SVD: singular values match numpy, reconstruction error tiny', () => {
  for (const [path, ref, k] of [['L0.q', REF.svd_L0q, 256], ['L3.fc', REF.svd_L3fc, 32]]) {
    const { a, rows, cols } = getMat(ORIG, path); const R = svd(a, rows, cols); for (let i = 0; i < k; i++) close(R.S[i], ref[i], 1e-5, `${path} σ${i}`);
    const rec = svdReconstruct(R, R.S); const err = Math.sqrt(a.reduce((s, x, i) => s + (x - rec[i]) ** 2, 0) / a.reduce((s, x) => s + x * x, 0));
    assert.ok(err < 1e-5, `${path} relative recon error ${err}`); console.log(`  ${path}: rel. reconstruction error ${err.toExponential(2)}, sweeps ${R.sweeps}`);
  }
});
test('SVD top-k edit produces a rank-k matrix; undo restores bit-exact', () => {
  ed.setEdits([]); ed.push({ kind: 'svd', path: 'L2.v', mode: 'topk', k: 8 });
  const { a } = getMat(MOD, 'L2.v'); const R = svd(a, 256, 256); assert.ok(R.S[8] < 1e-4 * R.S[0], 'σ9 ≈ 0 ' + R.S[8]);
  ed.setEdits([]); assert.equal(maxDiff(MOD.layers[2].v, ORIG.layers[2].v), 0);
});
test('stats + tuned lens beats logit lens on intermediate layers', async () => {
  STATS = await computeStats(ORIG, CORPUS, 500); fitTunedLens(STATS, 1e-3);
  const e = clean(); e.stats = STATS; const ids = CORPUS[39].slice(0, 40); const tr = e.run(ids, { trace: true }).traces;
  const G = lensGrid(e, tr, { k: 1 }), T = lensGrid(e, tr, { k: 1, tuned: STATS.tuned });
  const kl = (G2) => { let s = 0; for (let p = 0; p < tr.length; p++) { const fin = G2[p][8].lp; for (const r of [2, 3, 4]) { const q = G2[p][r].lp; for (let i = 0; i < fin.length; i++) { const pf = Math.exp(fin[i]); if (pf > 1e-6) s += pf * (fin[i] - q[i]); } } } return s / tr.length / 3; };
  const a = kl(G), b = kl(T); console.log(`  KL(final‖lens) layers1-3 on held-out story: logit lens ${a.toFixed(3)}, tuned ${b.toFixed(3)}`); assert.ok(b < a);
});
test('every runtime control changes the computation', () => {
  const base = lastLogits(clean(), P0); const e = clean(); e.stats = STATS;
  const vec = buildControlVector(clean(), tok, [[' happy', ' sad']], {});
  const cases = {
    headTemp: (R) => (R.headTemp[0][3] = 3), abl_zero: (R) => (R.headAbl[1][5] = 'zero'), abl_mean: (R) => (R.headAbl[1][5] = 'mean'), abl_resample: (R) => (R.headAbl[1][5] = 'resample'),
    mask_self: (R) => (R.attnMask[2].mode = 'self'), mask_noself: (R) => (R.attnMask[2].mode = 'noself'), mask_bos: (R) => (R.attnMask[2].mode = 'bos'), mask_uniform: (R) => (R.attnMask[2].mode = 'uniform'), mask_nobos: (R) => (R.attnMask[2].mode = 'nobos'), mask_window: (R) => (R.attnMask[0].window = 3),
    pos_scale: (R) => (R.pos.scale = 2), pos_shift: (R) => (R.pos.shift = 50), pos_freeze: (R) => (R.pos.freeze = 2),
    skip_attn: (R) => (R.program[3].attn = false), skip_mlp: (R) => (R.program[3].mlp = false), delete_layer: (R) => R.program.splice(4, 1), dup_layer: (R) => R.program.splice(2, 0, { layer: 2, attn: true, mlp: true }), swap: (R) => ([R.program[1], R.program[5]] = [R.program[5], R.program[1]]),
    steer_resid: (R) => R.steer.push({ id: 1, name: 'h', site: 'resid_post', vecs: vec, coef: 4, sched: [0, 0, 1, 0, 0, 0, 0, 0], mask: { kind: 'all' }, on: true }),
    steer_attn: (R) => R.steer.push({ id: 1, name: 'h', site: 'attn_out', vecs: vec, coef: 4, sched: [0, 0, 1, 1, 0, 0, 0, 0], mask: { kind: 'all' }, on: true }),
    steer_mlp: (R) => R.steer.push({ id: 1, name: 'h', site: 'mlp_out', vecs: vec, coef: 4, sched: [0, 0, 1, 1, 0, 0, 0, 0], mask: { kind: 'range', a: 0, b: 3 }, on: true }),
    neuron_zero: (R) => R.neuronAbl.push({ l: 1, n: 7, mode: 'clamp', value: 5 }),
  };
  for (const [name, f] of Object.entries(cases)) { e.R = defaultRuntime(); f(e.R); const l = lastLogits(e, P0); const dm = maxDiff(l, base); assert.ok(dm > 1e-4, `${name} had no effect (${dm})`); }
  e.R = defaultRuntime(); assert.equal(maxDiff(lastLogits(e, P0), base), 0, 'default runtime == clean');
});
test('every weight-edit kind changes the computation; undo is exact', () => {
  const base = lastLogits(clean(), P0); const e = new Engine(MOD, defaultRuntime());
  const edits = [{ kind: 'elem', target: { type: 'head', l: 2, i: 3 }, fn: 'scale', amt: 4 }, { kind: 'elem', target: { type: 'neuron', l: 4, i: 9 }, fn: 'invert' }, { kind: 'elem', target: { type: 'matrix', path: 'L5.k' }, fn: 'noise', amt: 1 },
    { kind: 'elem', target: { type: 'embed', toks: tok.encode(' loved'), word: ' loved' }, fn: 'zero' }, { kind: 'svd', path: 'L1.o', mode: 'scale', from: 0, to: 2, factor: 3 }, { kind: 'svd', path: 'L6.fc', mode: 'drop', from: 0, to: 0 }, { kind: 'svd', path: 'L2.q', mode: 'flatten', k: 16 },
    { kind: 'lowrank', path: 'L3.v', rank: 2, sigma: 2 }, { kind: 'quant', layers: [0, 1, 2, 3, 4, 5, 6, 7], mats: ['q', 'k', 'v', 'o', 'fc', 'proj'], bits: 4 }, { kind: 'interp', dst: 3, src: 5, t: 0.5 },
    { kind: 'ln', l: 2, which: 'ln1', gScale: 0.5, bAdd: 0.1 }, { kind: 'ln', which: 'lnf', gScale: 1.5, bAdd: 0 }, { kind: 'wpe', fn: 'shuffle', n: 64 }, { kind: 'wpe', fn: 'noise', amt: 1 }, { kind: 'chaos', pct: 20 }];
  for (const x of edits) { ed.setEdits([]); ed.push(structuredClone(x)); const dm = maxDiff(lastLogits(e, P0), base); assert.ok(dm > 1e-3, `${ed.label(x)} no effect (${dm})`); }
  ed.setEdits([]); assert.equal(maxDiff(lastLogits(e, P0), base), 0);
});
test('quantisation error shrinks with more bits', () => { const errs = [2, 4, 8].map((b) => quantize(Float32Array.from(ORIG.layers[0].q), 256, 256, b)); assert.ok(errs[0] > errs[1] && errs[1] > errs[2]); console.log('  int2/int4/int8 RMS error', errs.map((x) => x.toExponential(2)).join(' ')); });
test('ROME rank-one edit flips the target completion', async () => {
  ed.setEdits([]); const prompt = 'Once upon a time, there was a little girl named'; const e = new Engine(MOD, defaultRuntime());
  const before = tok.decode([lastLogits(e, prompt).reduce((b, v, i, a) => (v > a[b] ? i : b), 0)]);
  const C = await actCovariance(ORIG, STATS, 4); const op = await computeRome(e, tok, C, { prompt, subject: 'girl', target: ' Max', layer: 4 });
  ed.push(op); const l = lastLogits(e, prompt); const after = tok.decode([l.reduce((b, v, i, a) => (v > a[b] ? i : b), 0)]);
  console.log(`  ROME: "${prompt}" ${JSON.stringify(before)} → ${JSON.stringify(after)} (iters ${op.iters}, p=${op.p.toFixed(2)})`);
  const gen = (s) => { const r = e.run(tok.encode(s)); return tok.decode([e.logits(r.last.h).reduce((b, v, i, a) => (v > a[b] ? i : b), 0)]); };
  console.log('  generalises? "One day, the little girl named" →', JSON.stringify(gen('One day, the little girl named')), '| unrelated "The dog ran to the" →', JSON.stringify(gen('The dog ran to the')));
  assert.equal(after, ' Max'); assert.notEqual(before, ' Max');
  // rank one: W' k* = v*
  ed.setEdits([]);
});
test('SAE trains (loss falls), features are sparse, clamping changes output', async () => {
  const X = STATS.resid[3], N = STATS.N; const sae = new SAE(3, 256); const H = await sae.train(X, N, { epochs: 3 });
  console.log('  SAE loss per epoch', H.map((h) => h.loss.toFixed(4)).join(' → '), 'L0', H[2].l0.toFixed(1));
  assert.ok(H[2].loss < H[0].loss); const an = sae.analyse(X, N); console.log(`  FVU ${an.fvu.toFixed(3)}, alive ${an.alive}/256`); assert.ok(an.fvu < 0.5);
  const e = clean(); e.sae = sae; const base = lastLogits(e, P0); const f = an.mx.indexOf(Math.max(...an.mx)); e.R.sae.clamps.push({ f, mode: 'clamp', value: 20 });
  assert.ok(maxDiff(lastLogits(e, P0), base) > 1e-3);
});
test('control vectors: mean vs PCA agree in direction; arithmetic works', () => {
  const pairs = [['I love this. It is wonderful', 'I hate this. It is terrible'], ['She was so happy', 'She was so sad'], ['What a great day', 'What a awful day']];
  const a = buildControlVector(clean(), tok, pairs, { method: 'mean' }), b = buildControlVector(clean(), tok, pairs, { method: 'pca' });
  for (const l of [2, 4, 6]) { let s = 0, na = 0, nb = 0; for (let i = 0; i < 256; i++) { s += a[l][i] * b[l][i]; na += a[l][i] ** 2; nb += b[l][i] ** 2; } const c = s / Math.sqrt(na * nb); assert.ok(c > 0.5, `cos L${l} ${c}`); }
  const v = vectorArithmetic('2*x - 0.5*x', [{ name: 'x', vecs: a }]); assert.ok(Math.abs(v[3][5] - 1.5 * a[3][5]) < 1e-6);
});
test('decoding: penalties, filters, CFG, contrastive, beam', () => {
  const l = new Float32Array([2, 1, 0, -1]); applyPenalties(l, [0, 3], [0, 0], { rep: 2, freq: 0.5, pres: 0.25, bias: { 2: 3 } });
  assert.deepEqual(Array.from(l), [2 / 2 - 1.25, 1, 3, -2]);
  const z = Float32Array.from({ length: 50 }, (_, i) => -i * 0.3); const D = filterDist(z, { temp: 1, topk: 0, topp: 0.5, minp: 0, typical: 1 });
  assert.ok(D.ids.length < 10 && Math.abs(D.probs.reduce((a, b) => a + b) - 1) < 1e-6);
  const Dm = filterDist(z, { temp: 1, topk: 0, topp: 1, minp: 0.2, typical: 1 }); assert.ok(Dm.ids.every((i) => Math.exp(-i * 0.3) >= 0.2 - 1e-6));
  const x = Float32Array.from([1, 2, 3]), y = Float32Array.from([3, 2, 1]); const c1 = cfgLogits(x, y, 1), lx = logSoftmax(x); for (let i = 0; i < 3; i++) close(c1[i], lx[i], 1e-6, 'cfg γ=1');
  const cd = contrastiveLogits(x, x, 0.2, 1); assert.ok(cd[0] < -1e8 && Math.abs(cd[2]) < 1e-6);
  const e = clean(); const ids = tok.encode('Once upon a time'); const r = e.run(ids); const b = beamSearch(e, r.seq, r.last.h, { beams: 4, n: 12, lenpen: 0, o: {} });
  let s = r.seq.clone(), h = r.last.h, g = 0; for (let k = 0; k < b.ids.length; k++) { const lp = logSoftmax(e.logits(h)); let am = 0; for (let i = 0; i < lp.length; i++) if (lp[i] > lp[am]) am = i; g += lp[am]; h = e.step(s, am).h; }
  assert.ok(b.logp >= g - 1e-4, `beam ${b.logp} >= greedy ${g}`); console.log(`  beam logp ${b.logp.toFixed(3)} vs greedy ${g.toFixed(3)}: ${JSON.stringify(tok.decode(b.ids))}`);
});
test('safetensors export round-trips', () => {
  ed.setEdits([{ kind: 'elem', id: 1, target: { type: 'head', l: 1, i: 1 }, fn: 'invert' }]); const bytes = toSafetensors(MOD);
  const n2 = Number(new DataView(bytes.buffer).getBigUint64(0, true)); const h2 = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + n2)));
  const W2 = buildWeights(parseSafetensors(bytes.buffer.slice(8 + n2), n2, h2)); assert.equal(maxDiff(W2.layers[1].o, MOD.layers[1].o), 0); assert.equal(maxDiff(W2.wte, MOD.wte), 0); ed.setEdits([]);
});
test('token stats: perplexity finite, entropies sane', () => { const e = clean(); const ids = CORPUS[38].slice(0, 30); const T = tokenStats(e, e.run(ids, { trace: true }).traces, ids); assert.ok(T.ppl > 1 && T.ppl < 50, 'ppl ' + T.ppl); console.log('  corpus-story perplexity', T.ppl.toFixed(2)); });

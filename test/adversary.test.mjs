// Adversary Lab: key-cache geometry, FWL, padding, detector, neuron rule, prereg lock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GPT2Tokenizer } from '../src/tokenizer.js';
import { forward } from '../src/arch/arch.js';
import {
  FEATURE_NAMES, auroc, deltaValues, evalAUROC, flattenKeyCache, frobenius, geometryFromSeq,
  geometryFromTokenKeys, geometryVerdict, lopoAUROC, ols, permutationAUROC, residualize,
  spectrumFeatures, svdvals, syntheticSelfTest,
} from '../src/adversary/geometry.js';
import { cohensD, randomSets, rankNeurons, scoreText, steeringVerdict, unitKey } from '../src/adversary/neurons.js';
import { equalLengthPrompts, padTokenIds, verifyEqualLength } from '../src/adversary/prompts.js';
import { canonical, sha256Hex } from '../src/prereg.js';
import { PreregLockError, assertUnlocked, parseSpec, preregBody, reproBundle, revisePrereg, toYAML, verifyAdversaryBundle } from '../src/adversary/prereg.js';
import { executeGeometry, executeNeurons, finishBundle, planCampaign } from '../src/adversary/campaign.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('SVD singular values match a known diagonal spectrum, and Frobenius matches the spectrum', () => {
  const rows = [[5, 0, 0], [0, 2, 0], [0, 0, 0.5]];
  const sv = svdvals(rows);
  close(sv[0], 5); close(sv[1], 2); close(sv[2], 0.5);
  close(frobenius(rows), Math.hypot(5, 2, 0.5));
  const eye = [[1, 0], [0, 1]];
  const spec = spectrumFeatures(svdvals(eye));
  close(spec.spectral_entropy, Math.log(2));
  close(spec.effective_rank, 2);
  close(spec.top_sv_ratio, 0.5);
  close(spectrumFeatures([10, 2, 0.5]).rank10, 2);
});

test('flatten is (heads × tokens) by head dim, the paper’s Kflat', () => {
  const toks = [Float32Array.from([3, 0, 0, 1])];
  const rows = flattenKeyCache(toks, 2, 2);
  assert.equal(rows.length, 2);
  assert.deepEqual(Array.from(rows[0]), [3, 0]);
  assert.deepEqual(Array.from(rows[1]), [0, 1]);
  const g = geometryFromTokenKeys([toks], { nHeads: 2, headDim: 2, nTokens: 1, phase: 'encoding' });
  close(g.key_norm, Math.hypot(3, 1));
  close(g.norm_per_token, Math.hypot(3, 1));
  assert.equal(g.values.length, FEATURE_NAMES.length);
});

test('FWL recovers a known beta, and double residualization matches sequential FWL', () => {
  const x = [1, 2, 3, 4, 5];
  const y = x.map((t) => 2 + 3 * t);
  const fit = ols(y, x.map((t) => [1, t]));
  close(fit.beta[0], 2, 1e-8); close(fit.beta[1], 3, 1e-8);
  assert.ok(fit.resid.every((r) => Math.abs(r) < 1e-8));
  const a = [1, 2, 1, 2, 3, 0], b = [0, 1, 2, 3, 1, 4];
  const y2 = a.map((ai, i) => 1 + 4 * ai + 5 * b[i]);
  const joint = ols(y2, a.map((ai, i) => [1, ai, b[i]]));
  close(joint.beta[0], 1, 1e-6); close(joint.beta[1], 4, 1e-6); close(joint.beta[2], 5, 1e-6);
  const y1 = ols(y2, a.map((ai) => [1, ai])).resid;
  const b1 = ols(b, a.map((ai) => [1, ai])).resid;
  const seq = ols(y1, b1.map((v) => [1, v])).resid;
  seq.forEach((r, i) => close(r, joint.resid[i], 1e-6));
  const mat = residualize(y2.map((v) => [v]), a.map((ai, i) => [ai, b[i]]));
  mat.residuals.forEach((r) => close(r[0], 0, 1e-6));
  assert.deepEqual(mat.kept, [0, 1]);
});

test('a pure length confound does not survive FWL, and separable geometry does', () => {
  const T = [1, 2, 3, 4, 8, 9, 10, 11];
  const y = T.map((t) => (t > 5 ? 1 : 0));
  const raw = T.map((t) => [3 * t]);
  assert.ok(evalAUROC(raw, y) > 0.95);
  const fw = residualize(raw, T.map((t) => [t]));
  const cleaned = evalAUROC(fw.residuals, y);
  assert.ok(Math.abs(cleaned - 0.5) < 0.05, 'cleaned ' + cleaned);
  const syn = syntheticSelfTest();
  assert.ok(syn.separableAuroc > 0.95, syn.separableAuroc);
  assert.ok(Math.abs(syn.tiedAuroc - 0.5) < 0.05, syn.tiedAuroc);
});

test('equal-length padding is checked after tokenization; character padding is not assumed', () => {
  const tok = new GPT2Tokenizer(JSON.parse(fs.readFileSync('model/vocab.json', 'utf8')), fs.readFileSync('model/merges.txt', 'utf8'));
  const a = tok.encode('Tell the next part plainly.');
  const b = tok.encode('Hide what the key opens and mislead the reader.');
  assert.notEqual(a.length, b.length);
  assert.equal(verifyEqualLength([a, b]), false);
  let padId = null;
  for (const s of ['\n', '.', ' the']) { const ids = tok.encode(s); if (ids.length === 1) { padId = ids[0]; break; } }
  assert.equal(Number.isInteger(padId), true);
  const eq = equalLengthPrompts([a, b], tok.encode('A girl found a key.'), padId);
  assert.equal(eq.equal, true);
  assert.equal(eq.system[0].length, eq.system[1].length);
  assert.equal(eq.full[0].length, eq.full[1].length);
  const padded = padTokenIds([a, b], padId);
  assert.equal(padded.equal, true);
});

test('delta features are generation minus encoding', () => {
  const seq = { T: 2, nPrompt: 1, K: [[Float32Array.from([1, 0, 0, 0]), Float32Array.from([0, 1, 0, 0])]] };
  const enc = geometryFromSeq(seq, { nHeads: 2, headDim: 2, phase: 'encoding', upTo: 1 });
  const gen = geometryFromSeq(seq, { nHeads: 2, headDim: 2, phase: 'generation' });
  assert.equal(enc.phase, 'encoding'); assert.equal(enc.T, 1); assert.equal(gen.T, 2);
  const d = deltaValues(gen.values, enc.values);
  assert.equal(d.length, FEATURE_NAMES.length);
  assert.ok(d.every((v) => Number.isFinite(v)));
  assert.notDeepEqual(gen.values, enc.values);
});

test('detector: synthetic separable campaign is above chance; encoding phase stays at chance', async () => {
  const encode = (s) => s.split(/\s+/).filter(Boolean).map((w) => w.length + 1);
  // Eight prompts: with only four, an in-sample AUROC of 1 can still miss a permutation bar, and the verdict is then null.
  const prompts = Array.from({ length: 8 }, (_, i) => ({ id: 'p' + i, user: 'story ' + i + ' goes on from here', system: { honest: 'Tell it plainly now', deceptive: 'Hide the ending and mislead the reader please' } }));
  const plan = await planCampaign({ encode, padId: 0, genTokens: 4, nPerm: 80, prompts, conditions: ['honest', 'deceptive'], positive: ['deceptive'], modelId: 'synthetic' });
  assert.equal(plan.equal, true);
  assert.equal(plan.prereg.locked, true);
  const keys = (label, phase, T) => {
    const toks = [];
    for (let t = 0; t < T; t++) {
      const v = new Float64Array([1, 0, 0, 0.2]);
      if (phase === 'generation' && label === 1) { v[1] = 4; v[2] = 4; }
      toks.push(v);
    }
    return [toks];
  };
  const geo = await executeGeometry(plan, {
    nHeads: 2, headDim: 2,
    complete: async ({ ids, condition, genTokens }) => {
      const label = condition === 'honest' ? 0 : 1;
      const genIds = [1, 2, 3, 4].slice(0, genTokens);
      return { promptKeys: keys(label, 'encoding', ids.length), fullKeys: keys(label, 'generation', ids.length + genIds.length), genIds, text: 'x' };
    },
  });
  assert.ok(geo.detector.delta.auroc > 0.95, JSON.stringify(geo.detector.delta));
  assert.ok(geo.detector.delta.p < 0.05, 'p ' + geo.detector.delta.p);
  assert.ok(Math.abs(geo.detector.encoding.auroc - 0.5) < 0.05, 'enc ' + geo.detector.encoding.auroc);
  assert.equal(geo.verdict.label, 'above-chance');
  assert.equal(geometryVerdict({ auroc: 0.9, p: 0.2 }, { auroc: 0.5, p: 0.4 }).label, 'null');
  assert.equal(geometryVerdict({ auroc: 0.9, p: 0.01 }, { auroc: 0.9, p: 0.01 }).label, 'leakage');
  const bundle = await finishBundle(plan.prereg, geo, null);
  assert.deepEqual(await verifyAdversaryBundle(bundle), { ok: true, problems: [] });
  const tampered = structuredClone(bundle); tampered.results.geometry.verdict.label = 'null';
  assert.equal((await verifyAdversaryBundle(tampered)).ok, false);
});

test('leave-one-prompt-out runs when prompts are separable and there are at least three', () => {
  const X = [], y = [], g = [];
  for (let p = 0; p < 4; p++) { X.push([-2], [2]); y.push(0, 1); g.push('p' + p, 'p' + p); }
  const r = lopoAUROC(X, y, g);
  assert.ok(r.auroc > 0.95, r.auroc);
  assert.equal(lopoAUROC(X.slice(0, 2), y.slice(0, 2), ['only', 'only']).reason, 'need at least 3 prompts');
  assert.ok(Math.abs(auroc([0, 0, 1, 1], [0, 1, 0, 1]) - 0.5) < 1e-9);
});

test('neuron ranking, random sets, and the pre-registered pair rule', async () => {
  const acts = (label) => { const a = new Float64Array(4); a[0] = label ? 5 : 0; a[1] = 1; return [a]; };
  const samples = [1, 1, 0, 0].map((label) => ({ label, acts: acts(label) }));
  const ranked = rankNeurons(samples);
  assert.equal(ranked[0].neuron, 0);
  assert.ok(ranked[0].d > ranked[1].d);
  assert.ok(cohensD([0, 0], [0, 0]) === 0);
  const sets = randomSets(1, 4, 2, 3, 1713, [[{ layer: 0, neuron: 0 }, { layer: 0, neuron: 1 }]]);
  assert.equal(sets.length, 3);
  assert.ok(sets.every((s) => unitKey(s) !== '0:0|0:1'));
  const again = randomSets(1, 4, 2, 3, 1713, [[{ layer: 0, neuron: 0 }, { layer: 0, neuron: 1 }]]);
  assert.deepEqual(again, sets);
  const evil = scoreText('they hide the truth and lie to the child in the garden tonight');
  const calm = scoreText('the small boat sat by the school and the dog came home');
  assert.equal(evil.evilCoherent, true);
  assert.equal(calm.evilCoherent, false);
  assert.equal(steeringVerdict([true, true], [[false, false], [true, false]]).pass, true);
  assert.equal(steeringVerdict([true, false], [[true, false]]).pass, false);
  const encode = (s) => s.split(/\s+/).filter(Boolean).map((w) => w.length + 1);
  const plan = await planCampaign({ encode, padId: 0, nPairs: 3, nPerm: 19, modelId: 'synthetic', prompts: (await import('../src/adversary/prompts.js')).PROMPT_BANK.slice(0, 2) });
  const by = new Map(plan.trials.map((t) => [t.ids.join(','), t.label]));
  const expectKey = '0:0|0:1';
  const neurons = await executeNeurons(plan, {
    activate: async (ids) => acts(by.get(ids.join(','))),
    generate: async ({ pushes }) => (unitKey(pushes) === expectKey ? 'they hide the truth and lie to the child in the garden tonight' : 'the small boat sat by the school and the dog came home'),
  });
  assert.equal(neurons.candidateKey, expectKey);
  assert.equal(neurons.verdict.pass, true);
  assert.ok(neurons.verdict.randomCounts.every((c) => c < neurons.verdict.candidateCount));
});

test('prereg lock rejects mutation and revise() opens a new version', async () => {
  const encode = (s) => s.split(/\s+/).filter(Boolean).map((w) => w.length + 1);
  const plan = await planCampaign({ encode, padId: 7, nPerm: 20, modelId: 'synthetic' });
  const locked = plan.prereg;
  assert.throws(() => { locked.hypothesis = 'this edit must not stick at all'; }, TypeError);
  assert.equal(locked.hypothesis.startsWith('On this small model'), true);
  assert.throws(() => assertUnlocked(locked), PreregLockError);
  const next = await revisePrereg(locked, { hypothesis: 'A revised hypothesis that is definitely long enough.' });
  assert.equal(next.version, locked.version + 1);
  assert.equal(next.parent_sha256, locked.sha256);
  assert.notEqual(next.sha256, locked.sha256);
  assert.equal(locked.version < next.version, true);
  const again = await planCampaign({ encode, padId: 7, nPerm: 20, modelId: 'synthetic', previous: locked });
  assert.equal(again.prereg.sha256, locked.sha256);
  const changed = await planCampaign({ encode, padId: 7, nPerm: 21, modelId: 'synthetic', previous: locked });
  assert.equal(changed.prereg.version, locked.version + 1);
  const parsed = parseSpec(toYAML(preregBody(locked)));
  assert.equal(await sha256Hex(canonical(parsed)), await sha256Hex(canonical(preregBody(locked))));
  const bundle = await reproBundle(locked, { geometry: null, neurons: null, caveats: ['test'] });
  assert.equal((await verifyAdversaryBundle(bundle)).ok, true);
});

test('Arch forward can return per-layer keys, and the same geometry reads them', () => {
  const A = { arch: 'llama', d: 4, H: 2, Hkv: 2, hd: 2, L: 1, ff: 4, V: 6, ctx: 8, eps: 1e-5, norm: 'rms', pos: 'rope', ropeTheta: 10000, mlp: 'swiglu', scale: true };
  const rand = (n) => Float64Array.from({ length: n }, (_, i) => Math.sin(i + 1) * 0.05);
  const W = {
    wte: rand(A.V * A.d), nfw: Float64Array.from({ length: A.d }, () => 1), lm: rand(A.V * A.d),
    layers: [{
      n1w: Float64Array.from({ length: A.d }, () => 1), n2w: Float64Array.from({ length: A.d }, () => 1),
      q: rand(A.H * A.hd * A.d), k: rand(A.Hkv * A.hd * A.d), v: rand(A.Hkv * A.hd * A.d), o: rand(A.d * A.H * A.hd),
      gate: rand(A.ff * A.d), up: rand(A.ff * A.d), down: rand(A.d * A.ff),
    }],
  };
  const plain = forward(A, W, [1, 2, 3]);
  assert.equal(plain.keys, undefined);
  const withKeys = forward(A, W, [1, 2, 3], { keys: true });
  assert.equal(withKeys.keys.length, 1);
  assert.equal(withKeys.keys[0].length, 3);
  assert.equal(withKeys.keys[0][0].length, A.Hkv * A.hd);
  const g = geometryFromTokenKeys(withKeys.keys, { nHeads: A.Hkv, headDim: A.hd, nTokens: 3, phase: 'encoding' });
  assert.ok(FEATURE_NAMES.every((name) => Number.isFinite(g[name])));
});

test('the engine worker exposes kvgeom and generation samples on a cadence', () => {
  const worker = fs.readFileSync(new URL('../src/engine-worker.js', import.meta.url), 'utf8');
  const client = fs.readFileSync(new URL('../src/engine-client.js', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(worker, /m\.op === 'kvgeom'/);
  assert.match(client, /kvgeom\(seq, phase\)/);
  assert.match(app, /KV_CADENCE/);
  assert.match(app, /neuralese:kvgeom/);
  const perm = permutationAUROC([[0, 1], [0, 1], [0, 1], [0, 1]], [0, 1, 0, 1], { nPerm: 20, seed: 1 });
  assert.ok(Math.abs(perm.auroc - 0.5) < 0.05, perm.auroc);
});

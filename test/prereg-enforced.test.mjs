// v16 enforced pre-registration: schema, hash freeze, commit pinning, REPRO bundle round-trip and tamper detection.
import test from 'node:test'; import assert from 'node:assert/strict';
import { validate, preregHash, startRun, reproBundle, verifyBundle, PreregError, canonical } from '../src/prereg.js';
const C = 'a'.repeat(40), doc = { hypothesis: 'Zero-ablating L0H3 raises mean CE on the probe text', metric: { name: 'head_ablation_delta_ce', params: { layer: 0, head: 3 } }, null: 'Ablation changes CE by at most 0.01 nats', threshold: { op: '>', value: 0.01 }, seed: 7, commit_sha: C };
test('PREREG-1 schema: valid doc passes; each missing/invalid field is named', () => {
  assert.deepEqual(validate(doc), []);
  for (const k of ['hypothesis', 'metric', 'null', 'threshold', 'seed', 'commit_sha']) { const d = { ...doc }; delete d[k]; assert.ok(validate(d).some((e) => e.includes(k)), k); }
  assert.ok(validate({ ...doc, seed: 1.5 }).length); assert.ok(validate({ ...doc, commit_sha: 'abc' }).length); assert.ok(validate({ ...doc, extra: 1 }).length); assert.ok(validate({ ...doc, threshold: { op: '!=', value: 1 } }).length);
});
test('PREREG-2 hash is key-order independent; any edit changes it', async () => {
  const re = Object.fromEntries(Object.entries(doc).reverse()); assert.equal(await preregHash(re), await preregHash(doc));
  assert.notEqual(await preregHash({ ...doc, threshold: { op: '>', value: 0.011 } }), await preregHash(doc)); assert.equal(canonical({ b: 1, a: [2, { d: 1, c: 0 }] }), '{"a":[2,{"c":0,"d":1}],"b":1}');
});
test('PREREG-3 a run refuses to start on hash mismatch, commit mismatch or invalid doc', async () => {
  const h = await preregHash(doc);
  await assert.rejects(startRun({ ...doc, threshold: { op: '>', value: 0 } }, { expectedHash: h, commit: C }), PreregError);
  await assert.rejects(startRun(doc, { expectedHash: h, commit: 'b'.repeat(40) }), /commit mismatch/);
  await assert.rejects(startRun(doc, { expectedHash: undefined, commit: C }), /hash mismatch/);
  await assert.rejects(startRun({ ...doc, seed: -1 }, { expectedHash: h, commit: C }), /invalid/);
  const run = await startRun(doc, { expectedHash: h, commit: C }); assert.equal(run.prereg_sha256, h); assert.ok(Object.isFrozen(run));
});
test('PREREG-4 REPRO bundle verifies, and tampering with results, prereg or verdict is detected', async () => {
  const run = await startRun(doc, { expectedHash: await preregHash(doc), commit: C }), b = await reproBundle(run, { results: { metric: 0.05 }, weights_sha256: 'f'.repeat(64) });
  assert.equal(b.verdict.hypothesis_supported, true); assert.deepEqual(await verifyBundle(b), { ok: true, problems: [] });
  const t1 = structuredClone(b); t1.results.metric = 0.001; assert.equal((await verifyBundle(t1)).ok, false);
  const t2 = structuredClone(b); t2.prereg.threshold.value = 0.0; assert.ok((await verifyBundle(t2)).problems.some((p) => /prereg_sha256/.test(p)));
});

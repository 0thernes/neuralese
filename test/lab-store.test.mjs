import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryLab, fromTracker } from '../src/agent/schema.js';
test('a page tracker row imports into the CLI lab without a second schema', () => {
  const lab = createMemoryLab();
  const n = lab.importState([fromTracker({ id: 'r1', t: '2026-11-04T00:00:00.000Z', kind: 'sweep', label: 'alpha', metrics: { ppl: 12 } })]);
  assert.equal(n, 1);
  const run = lab.getRun('r1');
  assert.equal(run.project, 'sweep');
  assert.equal(run.metrics.ppl, 12);
  assert.equal(lab.importState(lab.dump()), 1);
});

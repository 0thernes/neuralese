import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFeatures } from '../tools/check-features.mjs';

test('never-subtract: current manifest covers every release and every source tab', () => {
  const problems = checkFeatures();
  assert.deepEqual(problems, [], problems.join('\n'));
});

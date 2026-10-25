import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
const CLI = fileURLToPath(new URL('../cli.mjs', import.meta.url)), run = (...a) => execFileSync('node', [CLI, '--model', '/workspace/neuralese/model', ...a], { encoding: 'utf8', timeout: 240000 });
test('cli: version, greedy generation matches web engine, drill finite-difference check', () => {
  assert.match(run('version'), /v6\.0\.0/);
  assert.match(run('gen', '6', 'Once upon a time'), /there was a little girl/);
  const d = run('drill', 'L3.attn.q.H5'); assert.match(d, /stableRank/); const m = d.match(/rel err ([\d.]+)%/); assert.ok(m && +m[1] < 5, d);
});

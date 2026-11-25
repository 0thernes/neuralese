import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
const VER = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const CLI = fileURLToPath(new URL('../src/cli.mjs', import.meta.url)), run = (...a) => execFileSync('node', [CLI, '--model', 'model', ...a], { encoding: 'utf8', timeout: 240000 });
test('cli: version, greedy generation matches web engine, drill finite-difference check', () => {
  assert.match(run('version'), new RegExp('v' + VER.replace(/\./g, '\\.')));
  assert.match(run('gen', '6', 'Once upon a time'), /there was a little girl/);
  const d = run('drill', 'L3.attn.q.H5'); assert.match(d, /stableRank/); const m = d.match(/rel err ([\d.]+)%/); assert.ok(m && +m[1] < 5, d);
});

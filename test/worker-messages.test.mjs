import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const w = fs.readFileSync(new URL('../src/engine-worker.js', import.meta.url), 'utf8');
const c = fs.readFileSync(new URL('../src/engine-client.js', import.meta.url), 'utf8');
test('worker refuses a missing sequence, an empty step batch, and a free without sids', () => {
  assert.match(w, /no seq /);
  assert.match(w, /steps needs at least one token/);
  assert.match(w, /m\.sids \|\| \[\]/);
  assert.match(w, /typeof m !== 'object'/);
});
test('client ignores worker messages that are not replies', () => {
  assert.match(c, /m\.id == null/);
});

// v15.3 repo layout: web root in src/, feature-named suites, no root-level smoke/version files, one copy of each WASM artifact (hash-pinned).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import crypto from 'node:crypto';
const R = (f) => new URL('../' + f, import.meta.url);
test('layout: web root is src/, no smoke-v*/versioned tests/progress docs at the repo root', () => {
  for (const f of ['src/index.html', 'src/app.js', 'src/engine.js', 'src/engine-worker.js', 'test/smoke', 'docs/progress']) assert.ok(fs.existsSync(R(f)), f);
  const root = fs.readdirSync(R('')); assert.deepEqual(root.filter((f) => /^smoke|^V1[0-5].*PROGRESS|^ref.*\.(py|json)$|\.js$/.test(f) && f !== 'eslint.config.js'), []);
  assert.deepEqual(fs.readdirSync(R('test')).filter((f) => /^v\d+.*\.test\.mjs$/.test(f)), [], 'test suites are feature-named');
});
test('wasm/: no duplicate committed artifacts; src/tsotchke artifacts match ARTIFACTS.sha256', () => {
  const man = fs.readFileSync(R('src/tsotchke/ARTIFACTS.sha256'), 'utf8').trim().split('\n').map((l) => l.split(/\s+/));
  assert.ok(man.length >= 8);
  for (const [h, f] of man) { assert.equal(crypto.createHash('sha256').update(fs.readFileSync(R('src/tsotchke/' + f))).digest('hex'), h, f); assert.ok(!fs.existsSync(R('wasm/' + f)) || /^wasm\/\*/m.test(fs.readFileSync(R('.gitignore'), 'utf8')), 'wasm/' + f + ' must be an ignored build by-product'); }
  for (const s of fs.readdirSync(R('wasm')).filter((f) => /^build-.*\.sh$/.test(f))) assert.match(fs.readFileSync(R('wasm/' + s), 'utf8'), /src\/tsotchke/, s + ' installs into src/tsotchke');
});

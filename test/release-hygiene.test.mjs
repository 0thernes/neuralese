// v16 release hygiene: exact dependency pins, npm ci only, hash-pinned model downloads, Android signing path, versionCode wired.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const R = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8'), J = (p) => JSON.parse(R(p));
test('HYG-1 every dependency (root + desktop, incl. Electron) is pinned to an exact version that matches its lockfile', () => {
  for (const [pj, lj] of [['package.json', 'package-lock.json'], ['desktop/package.json', 'desktop/package-lock.json']]) { const p = J(pj), l = J(lj);
    for (const sec of ['dependencies', 'devDependencies']) for (const [k, v] of Object.entries(p[sec] || {})) { assert.match(v, /^\d+\.\d+\.\d+$/, `${pj} ${k}@${v} not exact`); assert.equal(l.packages['node_modules/' + k].version, v, `${lj} ${k}`); } }
  assert.equal(J('desktop/package.json').devDependencies.electron, '42.11.16');
});
test('HYG-2 CI installs with npm ci only; versionCode comes from VERSION_CODE; APK is release-signed when keystore secrets exist', () => {
  const w = R('.github/workflows/release.yml'); assert.ok(!/npm (i|install)\b/.test(w)); assert.ok((w.match(/npm ci/g) || []).length >= 4);
  assert.match(w, /VERSION_CODE: \d+/); assert.match(w, /versionCode \$VERSION_CODE/); assert.match(w, /apksigner" sign/); assert.match(w, /ANDROID_KEYSTORE_B64/);
});
test('HYG-3 model downloads are pinned: SHA-256 for every TinyStories file; immutable revision + SHA-256 for every arch/encoder checkpoint', async () => {
  const fm = R('tools/fetch-model.mjs'); assert.equal((fm.match(/'[0-9a-f]{64}'/g) || []).length, 5);
  const { ARCH_MODELS } = await import('../tools/fetch-arch-models.mjs'); for (const [n, [, rev, files]] of Object.entries(ARCH_MODELS)) { assert.match(rev, /^[0-9a-f]{40}$/, n); for (const h of Object.values(files)) assert.match(h, /^[0-9a-f]{64}$/, n); }
  const wk = R('src/arch/encoder-worker.js'); for (const m of wk.matchAll(/rev: '([^']+)'/g)) assert.match(m[1], /^[0-9a-f]{40}$/);
});

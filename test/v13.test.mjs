// v13.0.0: packaging. One version everywhere; the app bundle (www/) is exactly the gh-pages file set; model pins match the tests' expectations.
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { wwwFiles, DIRS } from '../tools/build-www.mjs';
const J = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')), S = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('V13-1 version 13.0.0 in package.json, desktop/package.json, term.js and index.html', () => {
  assert.equal(J('package.json').version, '13.0.0'); assert.equal(J('desktop/package.json').version, '13.0.0');
  assert.match(S('term.js'), /VERSION = '13\.0\.0'/); assert.ok(S('index.html').includes('v13.0.0')); });
test('V13-2 www/ file set: every script index.html loads is shipped, dev files are not', () => {
  const f = wwwFiles(new URL('..', import.meta.url).pathname); for (const x of ['index.html', 'style.css', 'app.js', 'engine.js', ...DIRS]) assert.ok(f.includes(x), x);
  for (const x of ['eslint.config.js', 'test', 'model', 'node_modules', 'desktop', 'tools']) assert.ok(!f.includes(x), x);
  for (const m of S('index.html').matchAll(/<script[^>]+src="([^"?]+)/g)) assert.ok(f.includes(m[1].split('/')[0]) || fs.existsSync(new URL('../' + m[1], import.meta.url)), m[1]); });
test('V13-3 Capacitor + Electron config point at the built www/ and pin the app id', () => {
  const c = J('capacitor.config.json'), d = J('desktop/package.json'); assert.equal(c.webDir, 'www'); assert.equal(c.appId, 'io.github.othernes.neuralese'); assert.equal(d.build.appId, c.appId);
  assert.ok(d.build.files.includes('www/**/*')); assert.match(S('desktop/main.cjs'), /registerSchemesAsPrivileged/); });
test('V13-4 fetch-model pins one SHA-256 per test weight file', () => {
  const s = S('tools/fetch-model.mjs'); for (const f of ['model.safetensors', 'vocab.json', 'merges.txt', 'ts1M.safetensors', 'ts3M.safetensors']) assert.match(s, new RegExp(`'${f.replace('.', '\\.')}': \\[[^\\]]+'[0-9a-f]{64}'\\]`)); });

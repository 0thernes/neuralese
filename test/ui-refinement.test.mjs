// v15.2 polish: GPU tiering + quality ladder, theme default, busy/error states, sidebar wrapping, atlas skeleton, version.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rp } from './_paths.mjs';
import { VER } from './_paths.mjs';
const S = (f) => fs.readFileSync(new URL(rp(f), import.meta.url), 'utf8');
const U = await import('../src/ui152.js');
test('V152-1 one version in every manifest', () => {
  for (const f of ['package.json', 'desktop/package.json']) assert.equal(JSON.parse(S(f)).version, VER, f);
  assert.ok(S('term.js').includes(`VERSION = '${VER}'`)); assert.ok(S('index.html').includes('v' + VER)); assert.ok(S('.github/workflows/release.yml').includes('VER: ' + VER));
  assert.ok(!/\?v=151\b/.test(S('index.html') + S('app.js') + S('v5.js') + S('viz.js')), 'no stale ?v=151');
});
test('V152-2 classifyGpu: software and weak GPUs are low tier', () => {
  for (const r of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)', 'llvmpipe (LLVM 15.0.7, 256 bits)', 'Microsoft Basic Render Driver', 'Mali-400 MP', 'Intel(R) HD Graphics 3000'])
    assert.equal(U.classifyGpu(r, 8, 8), 'low', r);
  assert.equal(U.classifyGpu('ANGLE (NVIDIA GeForce RTX 4070)', 2, 8), 'low', '2 cores');
  assert.equal(U.classifyGpu('Apple M2', 8, 8, true), 'mid', 'coarse pointer');
  assert.equal(U.classifyGpu('ANGLE (NVIDIA GeForce RTX 4070)', 16, 8), 'high');
  assert.equal(U.classifyGpu('Adreno (TM) 740', 8, 4), 'mid');
});
test('V152-3 startLevel takes the safer of tier default and saved adaptive level; ladder is monotone', () => {
  assert.equal(U.startLevel('high', NaN), 0); assert.equal(U.startLevel('mid', undefined), 1); assert.equal(U.startLevel('low', 0), 3);
  assert.equal(U.startLevel('high', 2), 2); assert.equal(U.startLevel('high', 99), 0, 'invalid saved ignored');
  const cost = (q) => (q.bloom ? 2 : 0) + (q.dof ? 1 : 0) + q.px; for (let i = 1; i < U.LADDER.length; i++) assert.ok(cost(U.LADDER[i]) < cost(U.LADDER[i - 1]));
  const v = S('viz.js'); for (const k of ['classifyGpu', 'startLevel', "store.set('neuralese.q3d'", 'setLevel(']) assert.ok(v.includes(k), k);
});
test('V152-4 initialTheme follows the OS until the user picks', () => {
  assert.equal(U.initialTheme(null, true), 'light'); assert.equal(U.initialTheme(null, false), 'dark');
  assert.equal(U.initialTheme('dark', true), 'dark'); assert.equal(U.initialTheme('bogus', true), 'light');
  assert.match(S('v5.js'), /initialTheme\(localStorage/);
});
test('V152-5 global action guard drives busy + inline error states', () => {
  const a = S('app.js'); assert.match(a, /U152\.busy\(el, true\)/); assert.match(a, /U152\.panelNote\(el, e\.message\)/); assert.match(a, /finally \{ U152\.busy\(el, false\)/);
  const css = S('style.css'); for (const k of ['button.busy', '.errnote', '@keyframes spin152']) assert.ok(css.includes(k), k);
});
test('V152-6 sidebar labels wrap (2-line clamp) with tooltips; wider rail', () => {
  const css = S('style.css').split('v15.2 polish layer')[1]; assert.ok(css); assert.match(css, /#tabs button\{white-space:normal/); assert.match(css, /-webkit-line-clamp:2/); assert.match(css, /--rail:184px/);
  assert.match(S('v5.js'), /navTooltips\(\)/);
});
test('V152-7 Neuron Lens atlas: skeleton idle/loading/off states, honest copy, error path', () => {
  const l = S('lab-lens.js'); assert.match(l, /skeleton\(c, 'idle'/); assert.match(l, /skeleton\(\$\('nlAtlas'\), 'loading'/); assert.match(l, /skeleton\(c, 'off'\)/); assert.match(l, /Load failed/);
  const css = S('style.css'); for (const k of ['.skel3', '@keyframes shim152', 'canvas.skelhid']) assert.ok(css.includes(k), k);
  assert.match(css.split('v15.2 polish layer')[1], /prefers-reduced-motion:reduce\)\{\.skel3::before/);
});
test('V152-8 mobile: 16px inputs (no iOS zoom), 38px touch targets, safe-area padding', () => {
  const css = S('style.css').split('v15.2 polish layer')[1]; assert.match(css, /font-size:16px;min-height:38px/); assert.match(css, /safe-area-inset-bottom/);
});

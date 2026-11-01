// v15 visual overhaul: design tokens, self-hosted fonts with licences, perceptual colormaps, sidebar nav wiring, 3D upgrades.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rp } from './_paths.mjs';
const S = (f) => fs.readFileSync(new URL(rp(f), import.meta.url), 'utf8');
test('V15-1 design tokens + fonts are self-hosted with OFL licences', () => {
  const css = S('style.css'); for (const k of ['--sans:', '--mono:', '--rad:', '--e2:', '--ease:', '--rail:', 'prefers-reduced-motion', '#paneHead', '.navsearch']) assert.ok(css.includes(k), k);
  for (const f of ['inter-var.woff2', 'jbmono-var.woff2', 'LICENSE-Inter-OFL.txt', 'LICENSE-JetBrainsMono-OFL.txt']) assert.ok(fs.existsSync(new URL('../src/vendor/fonts/' + f, import.meta.url)), f);
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(css + S('index.html')), 'no third-party font CDN');
});
test('V15-2 colormaps: viridis/magma endpoints, diverging is monotone in blue→orange', async () => {
  const { cmap, divColor, seqColor } = await import('../src/charts.js');
  assert.equal(cmap('viridis', 0), 'rgb(68,1,84)'); assert.equal(cmap('viridis', 1), 'rgb(253,231,37)'); assert.equal(cmap('magma', 1), 'rgb(252,253,191)'); assert.equal(seqColor(0.5), cmap('viridis', 0.5));
  const rgb = (s) => s.match(/\d+/g).map(Number), lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const v = [-1, -0.5, 0, 0.5, 1].map((x) => rgb(divColor(x, 1))); assert.ok(v[0][2] > v[0][0] && v[4][0] > v[4][2], 'blue for negative, orange for positive');
  assert.ok(lum(v[2]) < lum(v[0]) && lum(v[2]) < lum(v[4]), 'dark neutral at zero on the dark theme');
  let prev = -1; for (let k = 0; k <= 20; k++) { const l = lum(rgb(cmap('viridis', k / 20))); assert.ok(l >= prev - 1e-9, 'viridis luminance monotone'); prev = l; }
});
test('V15-3 sidebar: grouped sections, search, mobile drawer button; tab buttons keep data-t', () => {
  const a = S('app.js'); assert.ok(a.includes("sec.className = 'ng'") && a.includes("id=\"navQ\"") && a.includes("b.dataset.t = k") && a.includes("'navopen'"));
  assert.ok(S('index.html').includes('id="bNav"'));
});
test('V15-4 3D: tone mapping, halos, soft points, labels; grid excluded from fit-to-view', () => {
  const v = S('viz.js'); for (const k of ['ACESFilmicToneMapping', 'AdditiveBlending', 'textSprite(', 'EdgesGeometry', 'noFit = true', 'prefers-reduced-motion']) assert.ok(v.includes(k), k);
  assert.ok(S('viz3d.js').includes('!o.userData?.noFit'));
});

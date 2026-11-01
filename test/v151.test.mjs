// v15.1 polish: overview dashboard, icon set, accents, shortcut overlay, post-processing chain, arc diagram + token strip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const S = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('V151-1 version 15.2.0 everywhere + cache busters', () => {
  assert.equal(JSON.parse(S('package.json')).version, '15.2.0'); assert.match(S('index.html'), /v15\.2\.0 · build 2026-10-31\.5/);
  assert.ok(!/\?v=15["']/.test(S('index.html') + S('app.js')), 'no stale busters');
});
test('V151-2 ui15: icons, group meta, overview + keys markup', async () => {
  const u = await import('../ui15.js'); assert.ok(Object.keys(u.ICONS).length >= 14); assert.match(u.icon(Object.keys(u.ICONS)[0]), /^<svg class="ic"/);
  const h = u.homeMarkup(); for (const id of ['heroCv', 'hmStats', 'hmTps', 'hmStrip']) assert.ok(h.includes(`id="${id}"`), id);
  assert.ok(/honest|real|stylised/i.test(h), 'hero copy states what is real vs stylised');
  const { GROUPS } = await import('../lab-ui.js'); assert.equal(GROUPS[0][1][0], 'home'); for (const [g] of GROUPS) assert.ok(u.GMETA[g], 'accent+icon for ' + g);
});
test('V151-3 charts: arcs + heatStrip exported; reduced-motion + bus helpers', async () => {
  const c = await import('../charts.js'); for (const k of ['arcs', 'heatStrip', 'emit', 'lines', 'heatmap']) assert.equal(typeof c[k], 'function', k);
  assert.ok(S('lab-interpret.js').includes("sync: 'atok'"));
});
test('V151-4 3D: instanced heads, flow particles, hover card, adaptive post (bloom + DoF), fps()', () => {
  const v = S('viz.js'), p = S('post.js'); for (const k of ['InstancedMesh', 'flowField', 'hov3d', 'flyTo', 'fps()', 'reduced']) assert.ok(v.includes(k), k);
  for (const k of ['DepthTexture', 'HalfFloatType', 'tonemapping_fragment', 'coc']) assert.ok(p.includes(k), k);
});
test('V151-5 css: accents, focus-visible, AA muted tokens, reduced-motion', () => {
  const css = S('style.css'); for (const k of ['--sa', ':focus-visible', '#keys', '#hov3d', '.stats', '--m2:#7a87a1']) assert.ok(css.includes(k), k);
});

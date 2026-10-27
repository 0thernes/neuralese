// v12.1.0 regression tests, one per fix from the 26 Oct 2026 65-tab exploration audit (audit-inputs/codex-65tab-exploration.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as T from '../tsotchke/taylor.js';
import { resolveTok, fmtSmall, vecToJSON, vecFromJSON } from '../labcore.js';
import { GPT2Tokenizer } from '../tokenizer.js';
import { MODELS } from '../hub/models.js';
import { stampText, markStale, modelGen } from '../charts.js';
import { PROVENANCE, KINDS, banner } from '../provenance.js';
import { GUIDE } from '../guide.js';
const S = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const M = '../model/', tok = new GPT2Tokenizer(JSON.parse(readFileSync(new URL(M + 'vocab.json', import.meta.url))), readFileSync(new URL(M + 'merges.txt', import.meta.url), 'utf8'));

test('A1 Taylor summary: derivative rows contain numbers, never NaN (Float64Array.map coerced HTML to NaN)', () => {
  const j = T.exp(new T.Jet(Float64Array.from([0, 1, 0, 0, 0, 0])));
  const h = T.derivRows(j); assert.ok(!/NaN/.test(h)); assert.equal((h.match(/<tr>/g) || []).length, 6); assert.match(h, /1\.000000e\+0/);
  assert.ok(S('lab-tsotchke.js').includes('T.derivRows(j)'));
});

test('A2 EMBED search: no two lab modules assign the same out.<name> (lab-hub out.embed overwrote INTERPRET embed)', () => {
  const seen = new Map();
  for (const f of readdirSync(new URL('../', import.meta.url)).filter((x) => /^(lab-.*|v5|app|app5)\.js$/.test(x)))
    for (const m of S(f).matchAll(/\bout\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) { const p = seen.get(m[1]); if (p && p !== f) assert.fail(`out.${m[1]} assigned in ${p} and ${f}`); seen.set(m[1], f); }
  assert.ok(seen.get('hubEmbed') === 'lab-hub.js' && seen.get('embed') !== 'lab-hub.js');
});

test('A3 bias sweep: tokens resolved exactly as typed, ids shown, small effects not rounded away', () => {
  const a = resolveTok(tok, ' dog'), b = resolveTok(tok, 'dog');
  assert.notEqual(a.id, b.id); assert.equal(a.piece, ' dog'); assert.equal(a.multi, false);
  assert.throws(() => resolveTok(tok, ''), /empty/); assert.equal(resolveTok(tok, ' robotics').multi, tok.encode(' robotics').length > 1);
  assert.equal(fmtSmall(0.00001234), '1.23e-5'); assert.equal(fmtSmall(0.5792), '0.5792'); assert.equal(fmtSmall(0), '0.0000');
  const src = S('lab-intervene.js'); assert.ok(src.includes('C.resolveTok(') && src.includes('xWres') && src.includes('fmtSmall'));
});

test('A4 LM swap: GPT-2 loads an existing ONNX dtype, worker passes repetition penalty, GPU checkbox says benchmark-only', () => {
  const g = MODELS.find((m) => /Xenova\/gpt2$/.test(m.id || m.repo || '')) || MODELS.find((m) => m.key === 'gen-gpt2');
  assert.equal(g.dtype, 'uint8');
  const w = S('hub/worker.js'); assert.ok(w.includes("m.dtype || 'q8'") && w.includes('repetition_penalty') && w.includes('no_repeat_ngram_size'));
  const h = S('lab-hub.js'); assert.ok(h.includes('hgPlain') && /whitespace/.test(h) && h.includes('failed: '));
  assert.ok(S('lab-science.js').includes('generation stays CPU/JS') && S('app.js').includes('benchmark only'));
});

test('A5 3D framing: fit distance contains the sphere in the narrower FOV; visible rect excludes the dock', () => {
  const src = S('viz3d.js'), fn = (n) => new Function('return ' + src.match(new RegExp(`export function ${n}(\\([^]*?\\n)`))[1].replace(/^/, `function ${n}`))();
  const fitDistance = fn('fitDistance'), visibleRect = fn('visibleRect');
  const r = visibleRect(1240, 700, 460, 0); assert.equal(r.w, 780); assert.equal(r.h, 666);
  const d = fitDistance(10, 50, r.aspect, 1); assert.ok(Math.abs(d * Math.sin((25 * Math.PI) / 180) - 10) < 1e-9);
  const dn = fitDistance(10, 50, 0.5, 1); assert.ok(dn > d, 'a narrow view needs more distance');
  assert.ok(src.includes('viz.fit =') && src.includes('setViewOffset') && /layer stack: one slab/.test(src) && src.includes('viz.info3d = STACK_INFO'));
  assert.ok(S('v5.js').includes("k === 'v3d' && $('mInfo')"));
  assert.ok(S('app.js').includes('vzFit') && S('lab-science.js').includes('m_fit') && S('v5.js').includes("preset('stack', 0)"));
});

test('A5 stale charts: stamp says current until the model changes, then "last run at"', () => {
  const g0 = modelGen(); assert.match(stampText(Date.now(), g0, g0), /current model state/);
  const g1 = markStale(); assert.equal(g1, g0 + 1); assert.match(stampText(Date.now(), g0, g1), /last run at .* model changed since/);
  assert.ok(/afterChange\(\) \{[^}]*markStale\(\)/.test(S('app.js')) || S('app.js').includes('markStale();'));
});

test('A6 provenance: stored author results and classical simulation labelled on every relevant tab', () => {
  for (const k of ['fx', 'fsc', 'frsi', 'fatlas']) assert.equal(PROVENANCE[k][0], 'stored');
  for (const k of ['fmind', 'fgrok']) assert.equal(PROVENANCE[k][0], 'mixed');
  assert.equal(PROVENANCE.fclaims[0], 'checks'); assert.match(KINDS.checks[1], /do not rerun/);
  for (const k of ['tsk', 'qrng', 'qgeom']) { assert.equal(PROVENANCE[k][0], 'sim'); assert.match(banner(k), /CLASSICAL SIMULATION.*no quantum hardware/); }
  assert.equal(banner('gen'), ''); assert.ok(S('v5.js').includes('banner(k) + html'));
});

test('A7 STEER export/import round-trip is bit-identical (old toFixed(6) zeroed tiny components)', () => {
  const v = { name: 'w', vecs: [Float32Array.from([1e-7, -3.3e-9, 0.1, 123.456, 1 / 3, -2.5e-38])] };
  const back = vecFromJSON(JSON.parse(JSON.stringify(vecToJSON(v))));
  assert.deepEqual(new Uint32Array(back.vecs[0].buffer), new Uint32Array(v.vecs[0].buffer)); assert.equal(back.name, 'w');
  assert.ok(S('app.js').includes('vecToJSON = _v2j'));
});

test('A7 guided path: ten stops, every stop is a real tab, button wired', () => {
  const keys = new Set([...S('lab-ui.js').match(/GROUPS = (\[.*\]);/)[1].matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]));
  assert.equal(GUIDE.length, 10); for (const [k] of GUIDE) assert.ok(keys.has(k), k);
  assert.ok(S('v5.js').includes('installGuide('));
});

test('A8 cache busters are ?v=13 everywhere', () => {
  for (const f of ['index.html', 'app.js', 'v5.js', 'labcore.js']) { assert.ok(!/\?v=12\b/.test(S(f)), f); }
  assert.ok(S('index.html').includes('v13.0.0'));
});

test('A9 narrow dock (1240x700): fieldsets may shrink, canvases never exceed the pane; 3D framing counts the fixed output panel', () => {
  const css = S('style.css'); assert.ok(css.includes('fieldset{min-width:0') && css.includes('#panes canvas{max-width:100%}'));
  assert.ok(S('viz3d.js').includes("getComputedStyle(o).display !== 'none'"), 'offsetParent is null for position:fixed #out');
});

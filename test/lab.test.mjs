import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { buildWeights, parseSafetensors, cloneWeights, CFG } from '../model.js';
import { Engine, defaultRuntime, logSoftmax, timeMul } from '../engine.js';
import * as C from '../labcore.js';
import { COMMANDS, complete, VERSION } from '../term.js';
import { GLOSSARY, BIBLE, COURSE, gradeQuiz, search, buildIndex, md } from '../learn/learn.js';
const { d, L } = CFG;
const vecOp = (op, vec, coef, extra = {}) => ({ id: 1, name: 't', site: 'resid_pre', vecs: Array.from({ length: L }, () => vec), coef, sched: Array(L).fill(0).map((_, l) => (l === 2 ? 1 : 0)), mask: { kind: 'all' }, on: true, op, ...extra });
const unit = () => { const v = new Float32Array(d); v[0] = 1; return v; };
const rnd = (s = 1) => Float32Array.from({ length: d }, (_, i) => Math.sin(i * 1.7 + s) * 2);
const steer = (v, x, l = 2) => { const e = new Engine(null, { ...defaultRuntime(), steer: [v] }); e._steer('resid_pre', l, 0, false, x); return x; };
const nrm = (x) => Math.hypot(...x);
test('steer add / addnorm / ablate / clamp', () => {
  const x0 = rnd(); let x = steer(vecOp('add', unit(), 3), Float32Array.from(x0)); assert.ok(Math.abs(x[0] - (x0[0] + 3)) < 1e-5); assert.equal(x[1], x0[1]);
  x = steer(vecOp('addnorm', unit(), 3), Float32Array.from(x0)); assert.ok(Math.abs(nrm(x) - nrm(x0)) < 1e-3, 'norm preserved'); assert.ok(x[0] > x0[0] * nrm(x0) / nrm(x) - 1e-6);
  x = steer(vecOp('ablate', unit(), 1), Float32Array.from(x0)); assert.ok(Math.abs(x[0]) < 1e-6); assert.equal(x[5], x0[5]);
  x = steer(vecOp('clamp', unit(), 2.5), Float32Array.from(x0)); assert.ok(Math.abs(x[0] - 2.5) < 1e-5);
});
test('steer respects schedule, mask and head slice', () => {
  const x0 = rnd(); assert.deepEqual([...steer(vecOp('clamp', unit(), 9), Float32Array.from(x0), 3)], [...x0], 'unscheduled layer untouched (clamp)');
  const v = Float32Array.from({ length: d }, () => 1); const x = steer(vecOp('add', v, 1, { head: 2 }), Float32Array.from(x0));
  for (let i = 0; i < d; i++) assert.ok(Math.abs(x[i] - x0[i] - (i >= 32 && i < 48 ? 1 : 0)) < 1e-6);
  const e = new Engine(null, { ...defaultRuntime(), steer: [vecOp('add', unit(), 1, { mask: { kind: 'gen' } })] }); const y = Float32Array.from(x0); e._steer('resid_pre', 2, 0, false, y); assert.equal(y[0], x0[0]);
});
test('timeMul schedules', () => {
  assert.equal(timeMul({ kind: 'const' }, 5), 1); assert.equal(timeMul({ kind: 'ramp', T: 4 }, 1), 0.5); assert.ok(Math.abs(timeMul({ kind: 'decay', T: 2 }, 2) - Math.exp(-1)) < 1e-9);
  assert.equal(timeMul({ kind: 'pulse', T: 3 }, 3), 1); assert.equal(timeMul({ kind: 'pulse', T: 3 }, 4), 0); assert.equal(timeMul({ kind: 'window', T: 2 }, 2), 0); assert.equal(timeMul({ kind: 'ramp', T: 4 }, -1), 1);
});
test('labcore pure functions', () => {
  const pb = C.paramBreakdown ? null : null; void pb;
  const f = C.flopsPerToken(64); assert.ok(f.total > 3e7 && f.total < 6e7, 'flops ' + f.total);
  const h = C.histogram([0, 1, 1, 2], 2, 0, 2); assert.equal(h.counts.reduce((a, b) => a + b, 0), 4);
  const pl = C.powerLawFit(Array.from({ length: 2000 }, (_, i) => Math.pow(1 - (i + 0.5) / 2000, -1 / 2))); assert.ok(Math.abs(pl.alpha - 3) < 0.35, 'alpha ' + pl.alpha);
  const cal = C.calibration([{ conf: 0.9, correct: true, nll: 0.1, ent: 1 }, { conf: 0.9, correct: false, nll: 2, ent: 1 }]); assert.ok(Math.abs(cal.ece - 0.4) < 1e-9); assert.equal(cal.acc, 0.5);
  const lp = logSoftmax(Float32Array.from([1, 2, 3])); assert.equal(C.klLogits(lp, lp), 0); assert.ok(C.klLogits(lp, logSoftmax(Float32Array.from([3, 2, 1]))) > 0.5);
  assert.equal(C.toCSV([[1, 'a']], ['x', 'y']), 'x,y\n1,"a"');
  const cm = C.cosineMatrix([[1, 0], [0, 1], [1, 1]]); assert.ok(Math.abs(cm[0][2] - Math.SQRT1_2) < 1e-9);
});
test('terminal: command table, completion, version', () => {
  assert.equal(VERSION, '6.0.0'); assert.ok(Object.keys(COMMANDS).length >= 52); for (const k of ['drill', 'atp', 'eigen', 'induct', 'geom', 'land', 'mode', 'cam', 'gpu', 'zoo', 'diff', 'share']) assert.ok(COMMANDS[k], k);
  assert.deepEqual(complete('ver'), ['version']); assert.ok(complete('sweep bl').includes('sweep blend')); assert.ok(complete('theme l').includes('theme light')); assert.ok(complete('tab ti').includes('tab timeline'));
});
test('learning center data: glossary ≥100 unique, cross-links resolve, labs use real commands', () => {
  assert.ok(GLOSSARY.length >= 100); const names = new Set(GLOSSARY.map((g) => g[0])); assert.equal(names.size, GLOSSARY.length);
  for (const [, , rel] of GLOSSARY) for (const r of rel) assert.ok(names.has(r), 'dangling ' + r);
  assert.ok(BIBLE.length >= 25); assert.equal(COURSE.length, 12); assert.ok(BIBLE.length >= 36);
  for (const l of COURSE) { for (const c of l.lab) assert.ok(COMMANDS[c.split(' ')[0]], `lesson ${l.id}: unknown command ${c}`); for (const q of l.quiz) assert.ok(q.a >= 0 && q.a < q.options.length); }
  const l = COURSE[0]; assert.ok(gradeQuiz(l, l.quiz.map((q) => q.a)).pass); assert.ok(!gradeQuiz(l, l.quiz.map(() => -1)).pass);
  assert.ok(search('induction').length >= 2); assert.ok(buildIndex().length === GLOSSARY.length + BIBLE.length + COURSE.length);
  assert.ok(!md('<script>').includes('<script>'));
});
const MP = '/workspace/neuralese/model/model.safetensors';
test('model: logit bias, h-steer, blend of identical weights is identity', { skip: !fs.existsSync(MP) }, () => {
  const buf = fs.readFileSync(MP), ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); const n = Number(new DataView(ab).getBigUint64(0, true)); const header = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 8, n)));
  const W = buildWeights(parseSafetensors(new Uint8Array(ab), n, header)), R = defaultRuntime(), e = new Engine(W, R), ids = [7454, 2402, 257, 640];
  const h = e.run(ids).last.h, base = e.outLogits(h); R.logitBias = { 3797: 5 }; const b2 = e.outLogits(h); assert.ok(Math.abs(b2[3797] - base[3797] - 5) < 1e-4); assert.equal(b2[1], base[1]); R.logitBias = {};
  const tgt = 3797, u = Float32Array.from(W.wte.subarray(tgt * d, tgt * d + d)); R.hSteer = [{ vec: u, coef: 0.5, on: true }];
  const p1 = logSoftmax(e.outLogits(e.run(ids).last.h))[tgt]; R.hSteer = []; const p0 = logSoftmax(e.outLogits(e.run(ids).last.h))[tgt]; assert.ok(p1 > p0, 'h-steer raises target');
  const S2 = C.blendWeights(W, cloneWeights(W), 0.7); assert.equal(S2.layers[3].fc[100], W.layers[3].fc[100]);
});

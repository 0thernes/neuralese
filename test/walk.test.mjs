import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mulberry32, buildWeights, parseSafetensors } from '../src/model.js';
import { Engine, defaultRuntime } from '../src/engine.js';
import { GPT2Tokenizer } from '../src/tokenizer.js';
import { buildSession, cellOf } from '../src/walk/record.js';
import { forward } from '../src/arch/arch.js';
import { recordArch } from '../src/walk/archwalk.js';
import { FAULT_SPEC, bernoulliMask, runStudy, specHash } from '../src/walk/fault.js';
import { mulInt, simulate } from '../src/walk/gates.js';
import { assessInverter, cmosParams, idSquare, logicOf, nandTruth, solveInverter, stageDelay, vthAt, CMOS_BANNER } from '../src/walk/cmos.js';
import { applyFaults, f32bits, faultFloatBit } from '../src/walk/bits.js';
import { sampleNote, takeSample, topSample } from '../src/walk/sample.js';
import { buildAluNet, intAlu, lowerForge, significandProduct } from '../src/walk/forgealu.js';
import { VM } from '../src/forge/vm.js';
import { enc, OP } from '../src/forge/isa.js';
import { compile } from '../src/forge/nestlang.js';
import { DEMO_SOURCE } from '../src/forge/cells.js';

const rng = mulberry32(1729);

test('ripple-array multipliers match integer products', () => {
  for (let n = 1; n <= 8; n++) {
    const trials = n <= 4 ? 40 : 20;
    for (let t = 0; t < trials; t++) {
      const a = Math.floor(rng() * 2 ** n);
      const b = Math.floor(rng() * 2 ** n);
      const got = mulInt(n, a, b);
      assert.equal(got.p, BigInt(a) * BigInt(b), `${n}-bit ${a}*${b}`);
    }
  }
});

test('a short sample time drops an add that has not finished propagating', () => {
  const full = lowerForge('ADD', 1, 0);
  assert.equal(full.value, 1);
  assert.equal(full.match, true);
  const early = lowerForge('ADD', 1, 0, { sample: 1 });
  assert.equal(early.value, 0);
  const done = lowerForge('ADD', 1, 0, { sample: full.depth });
  assert.equal(done.value, 1);
  const carry = lowerForge('ADD', -1, 1);
  assert.equal(carry.value, 0);
  assert.equal(carry.match, true);
  assert.ok(carry.depth > 8);
});

test('stuck-at on the sum LSB changes an add', () => {
  const net = buildAluNet('ADD');
  const lsb = net.outputs[0].bits[0];
  const stuck = simulate(net, { a: 1, b: 0 }, { stuck: { [lsb]: 0 } });
  assert.equal(Number(stuck.out.y & 1n), 0);
  assert.notEqual(Number(stuck.out.y & 0xffffffffn) | 0, 1);
  const clean = lowerForge('ADD', 1, 0);
  assert.equal(clean.value, 1);
});

test('Forge ALU netlists match integer arithmetic, including the demo program', () => {
  const ops = ['ADD', 'SUB', 'AND', 'OR', 'XOR', 'ADDI', 'SLT', 'BEQ', 'BNE', 'BLT'];
  const samples = [0, 1, -1, 2, -2, 35, 22, 2147483647, -2147483648, 99, -99];
  for (const name of ops) {
    for (const a of samples) for (const b of samples) {
      const g = lowerForge(name, a, b);
      assert.equal(g.match, true, `${name} ${a} ${b} → ${g.value} vs ${g.expected}`);
      assert.equal(g.value, intAlu(name, a, b));
    }
  }
  const compiled = compile(DEMO_SOURCE);
  assert.equal(compiled.ok, true);
  const vm = new VM(compiled.rom);
  let steps = 0;
  let checked = 0;
  while (!vm.halted && !vm.fail && steps < 200) {
    const word = vm.rom[vm.pc];
    const op = word & 15;
    const rs1 = (word >>> 7) & 7;
    const rs2 = (word >>> 10) & 7;
    const imm = (word << 16) >> 16;
    const names = { 1: 'ADD', 2: 'SUB', 3: 'AND', 4: 'OR', 5: 'XOR', 6: 'ADDI', 14: 'SLT' };
    const name = names[op];
    const a = vm.x[rs1] | 0;
    const b = op === OP.ADDI ? imm : (vm.x[rs2] | 0);
    vm.step();
    steps++;
    if (!name) continue;
    const g = lowerForge(name, a, b);
    assert.equal(g.value, intAlu(name, a, b), `demo ${name}`);
    checked++;
  }
  assert.ok(checked > 10, 'demo trace had ALU ops');
  assert.equal(enc(OP.ADD, 1, 2, 3) & 15, OP.ADD);
});

test('LUI is wiring, and a normal significand multiply matches integer math', () => {
  const lui = lowerForge('LUI', 0, 7);
  assert.equal(lui.kind, 'wire');
  assert.equal(lui.value, (7 << 16) | 0);
  const s = significandProduct(1.5, -2.5);
  assert.equal(s.ok, true);
  assert.equal(s.match, true);
  const z = significandProduct(0, 1);
  assert.equal(z.ok, false);
});

test('CMOS inverter is logically correct at nominal VDD and fails below threshold', () => {
  assert.match(CMOS_BANNER, /Simulated circuit/);
  const nom = cmosParams();
  const hi = solveInverter(nom, 0);
  const lo = solveInverter(nom, nom.VDD);
  assert.equal(logicOf(hi.vout, nom.VDD), 1);
  assert.equal(logicOf(lo.vout, nom.VDD), 0);
  const mid = solveInverter(nom, nom.VDD / 2);
  assert.ok(Math.abs(mid.vout - nom.VDD / 2) < 0.05, 'matched threshold near VDD/2, got ' + mid.vout);
  const report = assessInverter(nom);
  assert.equal(report.validHigh, true);
  assert.equal(report.validLow, true);
  assert.ok(report.nml > 0 && report.nmh > 0, `margins ${report.nml} ${report.nmh}`);
  const bad = assessInverter(cmosParams({ VDD: 0.2, Vth0: 0.25 }));
  assert.equal(bad.validLow, false);
  assert.equal(bad.failed, true);
  assert.equal(solveInverter(cmosParams({ VDD: 0.2, Vth0: 0.25 }), 0.2).defined, false);
  for (const row of nandTruth(nom)) assert.equal(row.ok, true, JSON.stringify(row));
  const hot = vthAt(cmosParams({ T: 360 }));
  assert.ok(hot.n < 0.25);
  const d1 = stageDelay(nom);
  const d2 = stageDelay(cmosParams({ Cload: nom.Cload * 2 }));
  assert.ok(Math.abs(d2.fall_s / d1.fall_s - 2) < 1e-9);
  const starved = stageDelay(cmosParams({ VDD: 0.4 }));
  assert.ok(starved.fall_s > d1.fall_s);
  assert.equal(idSquare(0.1, 1, 1e-4, 0.25, 0), 0);
});

test('sampling says when a tensor is capped, and bit faults are deterministic', () => {
  const s = takeSample(Float32Array.from({ length: 100 }, (_, i) => i), 10, 17);
  assert.equal(s.capped, true);
  assert.ok(s.indices.includes(17));
  assert.match(sampleNote(s, 'values'), /showing 10 of 100/);
  const top = topSample(Float32Array.from([1, 5, 3, 9]), 2, null);
  assert.deepEqual(top.indices, [3, 1]);
  const vec = Float32Array.from([1, 2, 3]);
  const a = faultFloatBit(vec, 1, 23, 'flip');
  const again = new Float32Array([1, 2, 3]);
  const b = applyFaults(again, { indices: [1], bit: 23, mode: 'flip' })[0];
  assert.equal(a.after, b.after);
  assert.notEqual(a.before, a.after);
  assert.equal(f32bits(1).kind, 'normal');
  assert.equal(f32bits(0).kind, 'zero');
});

test('a recorded TinyStories forward matches engine logits and cell arithmetic', () => {
  const buf = fs.readFileSync('model/model.safetensors');
  const n = Number(buf.readBigUInt64LE(0));
  const hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
  const W = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr));
  const tok = new GPT2Tokenizer(JSON.parse(fs.readFileSync('model/vocab.json', 'utf8')), fs.readFileSync('model/merges.txt', 'utf8'));
  const eng = new Engine(W, defaultRuntime());
  const ids = tok.encode('Once upon a time');
  const session = buildSession(eng, { ids, prompt: 'Once upon a time' });
  const live = eng.logits(eng.run(ids).last.h);
  let diff = 0;
  for (let i = 0; i < live.length; i++) diff = Math.max(diff, Math.abs(live[i] - session.logits[i]));
  assert.ok(diff <= 1e-5, 'logit diff ' + diff);
  assert.equal(session.logitGap, 0);
  for (const [id, index] of [['embed', 3], ['s0.L0.ln1', 3], ['s0.L0.q', 7], ['s0.L0.H0.score', 0], ['s0.L0.H0.prob', 0], ['s0.L0.resid_attn', 3], ['s0.L0.mlp_act', 3], ['s3.L3.mo', 1], ['logits', session.argmax]]) {
    const cell = cellOf(session, id, index, 0);
    assert.ok(cell.gap != null && cell.gap <= 1e-5, `${id} gap ${cell.gap}`);
  }
  assert.equal(session.ops.find((o) => o.id === 'logits').values.length, 50257);
});

test('an Arch forward’s logits are the walk’s logits', () => {
  const rngA = mulberry32(3);
  const A = { arch: 'gpt_neo', d: 8, H: 2, Hkv: 2, hd: 4, L: 2, ff: 16, V: 20, ctx: 32, eps: 1e-5, norm: 'ln', pos: 'learned', mlp: 'gelu', scale: false, windowSize: 8, attnTypes: ['global', 'global'], tie: true };
  const rnd = (k) => { const a = new Float32Array(k); for (let i = 0; i < k; i++) a[i] = (rngA() - 0.5) * 0.2; return a; };
  const W = { wte: rnd(A.V * A.d), wpe: rnd(A.ctx * A.d), nfw: Float32Array.from({ length: A.d }, () => 1), nfb: new Float32Array(A.d), layers: [] };
  W.lm = W.wte;
  for (let l = 0; l < A.L; l++) W.layers.push({ n1w: rnd(A.d), n1b: rnd(A.d), n2w: rnd(A.d), n2b: rnd(A.d), q: rnd(A.d * A.d), k: rnd(A.d * A.d), v: rnd(A.d * A.d), o: rnd(A.d * A.d), ob: rnd(A.d), up: rnd(A.ff * A.d), upb: rnd(A.ff), down: rnd(A.d * A.ff), downb: rnd(A.d) });
  const ids = [1, 4, 2];
  const session = recordArch(A, W, ids, { attn: true });
  const ref = forward(A, W, ids, { attn: true }).logits[ids.length - 1];
  let diff = 0;
  for (let i = 0; i < ref.length; i++) diff = Math.max(diff, Math.abs(session.logits[i] - ref[i]));
  assert.ok(diff <= 1e-5, 'arch diff ' + diff);
});

test('DW-FAULT-1 is deterministic and matches the stored measurement', async () => {
  const buf = fs.readFileSync('model/model.safetensors');
  const n = Number(buf.readBigUInt64LE(0));
  const hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
  const W = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr));
  const tok = new GPT2Tokenizer(JSON.parse(fs.readFileSync('model/vocab.json', 'utf8')), fs.readFileSync('model/merges.txt', 'utf8'));
  const ids = tok.encode(FAULT_SPEC.prompt);
  const a = runStudy(new Engine(W, defaultRuntime()), ids, FAULT_SPEC);
  const b = runStudy(new Engine(W, defaultRuntime()), ids, FAULT_SPEC);
  assert.equal(a.meanKlExponent, b.meanKlExponent);
  assert.equal(a.meanKlMantissa, b.meanKlMantissa);
  assert.equal(a.rateExponent, b.rateExponent);
  assert.deepEqual(a.rows.map((r) => r.indices), b.rows.map((r) => r.indices));
  assert.deepEqual(bernoulliMask(8, 0.5, 5), bernoulliMask(8, 0.5, 5));
  const stored = JSON.parse(fs.readFileSync('src/walk/data/dw-fault-1.json', 'utf8'));
  assert.equal(stored.spec_sha256, await specHash(FAULT_SPEC));
  assert.equal(stored.meanKlExponent, a.meanKlExponent);
  assert.equal(stored.meanKlMantissa, a.meanKlMantissa);
  assert.equal(stored.rateExponent, a.rateExponent);
  assert.equal(stored.rateMantissa, a.rateMantissa);
  assert.equal(stored.predictionHolds, a.meanKlExponent > a.meanKlMantissa);
  assert.match(a.whatFlipped, /bit 23/);
  assert.match(a.whatFlipped, /bit 0/);
});

test('unit-delay sample is exported on the raw multiplier', () => {
  const sim = mulInt(4, 15, 1);
  const early = simulate(sim.net, { a: 15, b: 1 }, { sample: 1 });
  assert.notEqual(early.out.p, 15n);
  assert.equal(sim.p, 15n);
});

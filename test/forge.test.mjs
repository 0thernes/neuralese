import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enc, OP, FUNCT_HALT } from '../src/forge/isa.js';
import { runVM } from '../src/forge/vm.js';
import { PRECISION, residualUntouched, runEngine, stampSubspace, SUBSPACE } from '../src/forge/engine.js';
import { compile } from '../src/forge/nestlang.js';
import { BAD_PROGRAMS, CELLS, DEMO_SOURCE, programFor } from '../src/forge/cells.js';
import { hostExec, propose } from '../src/forge/mdcc.js';
import { openRun, reproBundle, runLanes, tracesEqual, verifyForgeBundle } from '../src/forge/session.js';

const halt = (rd) => enc(OP.HALT, rd, 0, 0, 0, FUNCT_HALT);
const addi = (rd, rs1, imm) => enc(OP.ADDI, rd, rs1, 0, imm);
const r = (op, rd, rs1, rs2) => enc(op, rd, rs1, rs2, 0);

function agree(rom) {
  const vm = runVM(rom);
  const f32 = runEngine(rom, Float32Array);
  const f64 = runEngine(rom, Float64Array);
  assert.equal(f32.faults.length, 0, JSON.stringify(f32.faults.slice(0, 6)));
  assert.equal(f64.faults.length, 0, JSON.stringify(f64.faults.slice(0, 6)));
  assert.equal(tracesEqual(vm, f32), true, JSON.stringify({ vm: vm.trace.map((s) => [s.pc, s.name, s.result, s.fail]), f32: f32.trace.map((s) => [s.pc, s.name, s.result, s.fail]), vf: vm.fail, ef: f32.fail, vr: vm.result, er: f32.result }));
  assert.equal(tracesEqual(vm, f64), true);
  assert.deepEqual(f32.regs, vm.regs);
  assert.deepEqual(f32.ram, vm.ram);
  assert.deepEqual(f64.regs, vm.regs);
  return vm;
}

test('ISA reference VM: add, sub, and, or, xor, slt, load, store, branch, jal, halt', () => {
  const add = agree([addi(1, 0, 20), addi(2, 0, 22), r(OP.ADD, 3, 1, 2), halt(3)]);
  assert.equal(add.result, 42);
  const sub = agree([addi(1, 0, 5), addi(2, 0, 9), r(OP.SUB, 3, 1, 2), halt(3)]);
  assert.equal(sub.result, -4);
  const logic = agree([addi(1, 0, 0b1100), addi(2, 0, 0b1010), r(OP.AND, 3, 1, 2), r(OP.OR, 4, 1, 2), r(OP.XOR, 5, 1, 2), halt(3)]);
  assert.equal(logic.regs[3], 0b1000);
  assert.equal(logic.regs[4], 0b1110);
  assert.equal(logic.regs[5], 0b0110);
  const mem = agree([addi(1, 0, 42), enc(OP.SW, 0, 0, 1, 4), enc(OP.LW, 2, 0, 0, 4), halt(2)]);
  assert.equal(mem.result, 42);
  assert.equal(mem.ram[4], 42);
  // r3 = 3 via a taken loop: add 1, three times
  const loop = agree([
    addi(1, 0, 3), addi(2, 0, 1),
    enc(OP.BEQ, 0, 1, 0, 4),
    r(OP.ADD, 3, 3, 2),
    addi(1, 1, -1),
    enc(OP.JAL, 0, 0, 0, -3),
    halt(3),
  ]);
  assert.equal(loop.result, 3);
  assert.equal(loop.halted, true);
  const skip = agree([addi(1, 0, 1), enc(OP.BNE, 0, 1, 0, 3), addi(2, 0, 9), halt(2), addi(2, 0, 4), halt(2)]);
  assert.equal(skip.result, 4);
  const blt = agree([addi(1, 0, -2), enc(OP.BLT, 0, 1, 0, 3), addi(2, 0, 9), halt(2), addi(2, 0, 6), halt(2)]);
  assert.equal(blt.result, 6);
  const link = agree([enc(OP.JAL, 1, 0, 0, 2), halt(0), halt(1)]);
  assert.equal(link.result, 1);
  const z = agree([addi(0, 0, 5), halt(0)]);
  assert.equal(z.result, 0);
  assert.equal(z.regs[0], 0);
});

test('signed compare covers the overflow corners the ALU has to get right', () => {
  const slt = agree([addi(1, 0, -1), addi(2, 0, 1), r(OP.SLT, 3, 1, 2), r(OP.SLT, 4, 2, 1), halt(3)]);
  assert.equal(slt.regs[3], 1);
  assert.equal(slt.regs[4], 0);
  const min = agree([enc(OP.LUI, 1, 0, 0, 0x8000), addi(2, 0, 1), r(OP.SLT, 3, 1, 2), halt(3)]);
  assert.equal(min.result, 1);
  assert.equal(min.regs[1], -2147483648);
  const max = openRun('dup i32 a = 2147483647\ndup i32 b = -1\nif a < b {\n  halt 1\n} else {\n  halt 0\n}\n');
  assert.equal(max.ok, true, JSON.stringify(max.errors));
  assert.equal(max.vm.result, 0);
  assert.equal(max.eq32, true, JSON.stringify(max.diff32));
  const minNest = openRun('dup i32 a = -2147483648\ndup i32 b = 1\nif a < b {\n  halt 1\n} else {\n  halt 0\n}\n');
  assert.equal(minNest.vm.result, 1);
  assert.equal(minNest.eq32, true, JSON.stringify(minNest.diff32));
});

test('illegal zero word fails closed and does not pretend to halt', () => {
  const vm = agree([addi(1, 0, 1), 0]);
  assert.equal(vm.fail, 'illegal');
  assert.equal(vm.halted, false);
  assert.equal(vm.result, null);
});

test('typecheck rejects affine, type, and termination failures', () => {
  for (const bad of BAD_PROGRAMS) {
    const c = compile(bad.src);
    assert.equal(c.ok, false, bad.id);
    assert.ok(c.errors.some((e) => e.code === bad.code), bad.id + ' ' + JSON.stringify(c.errors));
  }
  const good = compile('dup i32 x = 1\nhalt x + x\n');
  assert.equal(good.ok, true, JSON.stringify(good.errors));
});

test('NestLang demo and the cell programs match the int32 VM and both gadget widths', () => {
  const demo = openRun(DEMO_SOURCE, { lmTokens: ['sum of 22 copies of 35', '⟦forge⟧'], seed: 7 });
  assert.equal(demo.ok, true, JSON.stringify(demo.errors));
  assert.equal(demo.vm.result, 770);
  assert.equal(demo.eq32, true, JSON.stringify(demo.diff32));
  assert.equal(demo.eq64, true);
  assert.equal(demo.engine.faults.length, 0);
  assert.ok(demo.tokens.some((t) => t.lane === 'lm'));
  assert.ok(demo.tokens.some((t) => t.kind === 'INS'));
  assert.ok(demo.tokens.some((t) => t.kind === 'HALT' && t.result === 770));
  const wide = openRun('dup i32 x = 65537\nhalt x\n');
  assert.equal(wide.vm.result, 65537);
  assert.equal(wide.eq32, true, JSON.stringify(wide.diff32));
  const bit15 = openRun('dup i32 x = 32768\nhalt x\n');
  assert.equal(bit15.vm.result, 32768);
  assert.equal(bit15.eq32, true, JSON.stringify(bit15.diff32));
  const flag = openRun('dup bool flag = false\ndup i32 a = 3\ndup i32 b = 4\nif flag {\n  halt a\n} else {\n  halt b\n}\n');
  assert.equal(flag.ok, true, JSON.stringify(flag.errors));
  assert.equal(flag.vm.result, 4);
  assert.equal(flag.eq32, true, JSON.stringify(flag.diff32));
});

test('engine trace matches the VM on every pre-registered cell, and the host residual is not written', () => {
  for (const c of CELLS) {
    const run = openRun(programFor(c), { seed: 1 });
    assert.equal(run.ok, true, c.id + JSON.stringify(run.errors));
    assert.equal(run.vm.result, c.expect, c.id);
    assert.equal(run.eq32, true, c.id + JSON.stringify(run.diff32));
    assert.equal(run.eq64, true, c.id);
  }
  const residual = Float32Array.from([0.25, -1, 3, 0]);
  const rom = [addi(1, 0, 2), addi(2, 0, 3), r(OP.ADD, 3, 1, 2), halt(3)];
  const guard = residualUntouched(residual, () => runEngine(rom, Float32Array));
  assert.equal(guard.same, true);
  assert.equal(guard.out.result, 5);
  const stamp = stampSubspace({ kind: 'INS', op: OP.ADD, result: 5, pc: 2 });
  assert.equal(stamp.length, SUBSPACE.width);
  assert.equal(stamp[1], 1);
  assert.equal(stamp[8 + OP.ADD], 1);
  let ones = 0;
  for (const x of stamp) ones += x === 1 ? 1 : 0;
  assert.ok(ones >= 1);
});

test('MDCC lane is exact on the cell set; WeightCPU reports the same answers with more tokens', () => {
  const lanes = runLanes();
  assert.equal(lanes.mdcc.accuracy, 1);
  assert.equal(lanes.mdcc.correct, CELLS.length);
  assert.equal(lanes.weightcpu.accuracy, 1);
  assert.equal(lanes.weightcpu.engineMatch, 1);
  assert.ok(lanes.weightcpu.tokens > lanes.mdcc.tokens);
  assert.equal(lanes.weightcpu.memoryWords, 256);
  assert.equal(lanes.mdcc.memoryWords, 0);
  assert.equal(lanes.criteria.bf16Claimed, false);
  for (const c of CELLS) {
    const plan = propose(c.task);
    assert.equal(hostExec(plan), BigInt(c.expect));
  }
  assert.equal(propose('not a task').op, null);
});

test('REPRO bundle hashes, records the ISA, and does not claim bf16', async () => {
  const run = openRun(DEMO_SOURCE, { seed: 3 });
  const lanes = runLanes();
  const b = await reproBundle(run, { lanes });
  const v = await verifyForgeBundle(b);
  assert.equal(v.ok, true, v.problems.join(';'));
  assert.equal(b.isa, 'ForgeISA/1');
  assert.equal(b.equality.f32, true);
  assert.equal(b.equality.bf16, 'not-run');
  assert.equal(b.precision.bf16, 'not-run');
  assert.match(PRECISION.note, /not claimed/);
  b.precision = { ...b.precision, bf16: 'exact' };
  const bad = await verifyForgeBundle(b);
  assert.equal(bad.ok, false);
});

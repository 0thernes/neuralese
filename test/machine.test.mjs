import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compile } from '../src/forge/nestlang.js';
import { runVM } from '../src/forge/vm.js';
import { DEMO_SOURCE } from '../src/forge/cells.js';
import { mulberry32 } from '../src/model.js';
import { CMOS_BANNER } from '../src/walk/cmos.js';
import {
  compareMatmul, expectedPattern, fbChecksum, gadgetSelfCheck, measure, runMachine, runMlp, storageFileFromWords, zoomView,
} from '../src/machine/machine.js';
import { HELLO, PROGRAMS, SIGNATURE, identityRam, vecRam } from '../src/machine/programs.js';
import { grantRef, matmulInt, sext8 } from '../src/machine/ref.js';
import { saveStorage } from '../src/machine/weight.js';
import { grantBits, mul8signedBits, intBits, wordOf } from '../src/machine/gadget.js';
import { FB_PIXELS, TPU_N } from '../src/machine/isa.js';

test('gadgets: AND layer, NOT layer, int8 multiply corners', () => {
  const g = gadgetSelfCheck();
  assert.equal(g.andOk, true);
  assert.equal(g.notOk, true);
  assert.equal(g.relu, true);
  assert.equal(g.sext, true);
  const corners = [-128, -127, -1, 0, 1, 2, 127];
  const faults = [];
  for (const a of corners) for (const b of corners) {
    const bits = mul8signedBits(intBits(Float32Array, a & 255, 8), intBits(Float32Array, b & 255, 8), faults, 'c');
    assert.equal(wordOf(bits), (sext8(a) * sext8(b)) | 0, a + '*' + b);
  }
  assert.equal(faults.length, 0);
});

test('TPU schedule: 2×2 hand product and 8×8 identity', () => {
  const A = [1, 2, 3, 4];
  const B = [5, 6, 7, 8];
  const small = compareMatmul(A, B, 2);
  assert.equal(small.exact, true);
  assert.deepEqual(small.ref, [19, 22, 43, 50]);
  assert.equal(small.cycles, 4);
  const I = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) I.push(r === c ? 1 : 0);
  const id = compareMatmul(I, I, 8);
  assert.equal(id.exact, true);
  assert.equal(id.schedule, true);
  assert.deepEqual(id.weight, I);
});

test('MLP layer matches the int32 matmul and engine.matvec', () => {
  const rng = mulberry32(9);
  const X = []; const W = []; const bias = [];
  for (let i = 0; i < 64; i++) { X.push((rng() * 15 | 0) - 7); W.push((rng() * 15 | 0) - 7); }
  for (let i = 0; i < 8; i++) bias.push((rng() * 9 | 0) - 4);
  const mlp = runMlp(X, W, bias);
  assert.equal(mlp.exact, true, JSON.stringify({ faults: mlp.faults.length, host: mlp.hostExact, mat: mlp.matmulExact }));
  assert.equal(mlp.weight.length, TPU_N * TPU_N);
});

test('hello, memory, gpu, tpu, multi, irq match the reference', () => {
  const hello = runMachine({ program: 'hello' });
  assert.equal(hello.exact, true, JSON.stringify(hello.diverge));
  assert.equal(hello.packetExact, true);
  assert.equal(hello.weight.console, HELLO);
  assert.equal(hello.weight.result, 0);
  assert.ok(hello.packets.some((p) => p.src === 'cpu' && p.dst === 'console'));

  const mem = runMachine({ program: 'memtest', limit: 12000 });
  assert.equal(mem.exact, true, JSON.stringify(mem.diverge || mem.weight.fail));
  assert.equal(mem.weight.result, 1);
  assert.equal(mem.packetExact, true);

  const gpu = runMachine({ program: 'gpu-pattern', limit: 8000 });
  assert.equal(gpu.exact, true, JSON.stringify(gpu.diverge || gpu.weight.fail));
  const expectFb = expectedPattern();
  assert.equal(fbChecksum(gpu.weight.fb), fbChecksum(expectFb));
  assert.equal(gpu.weight.fb.length, FB_PIXELS);

  const a = [1, 2, 3, 4, 5, -1, 8, 9, 0, 11, 12, 13, 14, 15, -4, 7];
  const b = [3, 3, 3, 3, 1, 2, 0, -8, 5, 1, 1, 1, 1, 1, 4, 1];
  const vec = runMachine({ program: 'gpu-vec', ram: vecRam(a, b), limit: 400 });
  assert.equal(vec.exact, true, JSON.stringify(vec.diverge || vec.faults));
  assert.equal(vec.packetExact, true);
  for (let i = 0; i < 16; i++) assert.equal(vec.weight.ram[32 + i], (a[i] + b[i]) | 0);

  const tpu = runMachine({ program: 'tpu', ram: identityRam(), limit: 8000 });
  assert.equal(tpu.exact, true, JSON.stringify(tpu.diverge || tpu.weight.fail || tpu.faults.slice(0, 4)));
  assert.equal(tpu.weight.result, 1);
  assert.equal(tpu.packetExact, true);

  const multi = runMachine({ program: 'multi', limit: 8000 });
  assert.equal(multi.exact, true, JSON.stringify(multi.diverge || multi.weight.fail));
  assert.equal(multi.weight.result, 13);
  assert.equal(multi.weight.console, 'M');
  assert.equal(multi.weight.ssd[1 * 16 + 4], 13);
  const links = new Set(multi.packets.map((p) => p.src + '>' + p.dst));
  assert.ok(links.has('cpu>ram'));
  assert.ok(links.has('cpu>ssd'));
  assert.ok(links.has('ssd>ram'));
  assert.ok(links.has('cpu>console'));

  const irq = runMachine({ program: 'irq', limit: 8000 });
  assert.equal(irq.exact, true, JSON.stringify(irq.diverge || irq.weight.fail));
  assert.equal(irq.weight.result, 7);
  assert.equal(irq.weight.irqTaken, 1);
});

test('pipeline matches the scalar result; a stall flushes the prefetch', () => {
  const compiled = compile('dup i32 a = 7\ndup i32 b = 13\nhalt a + b\n');
  const scalar = runMachine({ rom: compiled.rom, limit: 64 });
  const pipe = runMachine({ rom: compiled.rom, pipeline: true, limit: 64 });
  assert.equal(pipe.exact, true, JSON.stringify(pipe.diverge));
  assert.equal(pipe.weight.result, scalar.weight.result);
  assert.equal(pipe.cycles, scalar.cycles + 1);
  const helloS = runMachine({ program: 'hello' });
  const helloP = runMachine({ program: 'hello', pipeline: true });
  assert.equal(helloP.exact, true, JSON.stringify(helloP.diverge));
  assert.equal(helloP.weight.console, helloS.weight.console);
  assert.ok(helloP.cycles > helloS.cycles);
  const mem = runMachine({ program: 'memtest', pipeline: true, limit: 20000 });
  assert.equal(mem.exact, true, JSON.stringify(mem.diverge || mem.weight.fail));
  assert.equal(mem.weight.result, 1);
});

test('storage survives a reboot from the weight file', () => {
  const write = runMachine({ program: 'storage-write', limit: 8000 });
  assert.equal(write.exact, true, JSON.stringify(write.diverge || write.weight.fail));
  assert.equal(write.weight.result, SIGNATURE);
  assert.equal(write.weight.console, 'S');
  const saved = saveStorage(write.weightState);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-ssd-'));
  const p = path.join(dir, 'ssd.json');
  fs.writeFileSync(p, JSON.stringify(saved));
  const loaded = JSON.parse(fs.readFileSync(p, 'utf8'));
  const read = runMachine({ program: 'storage-read', storage: loaded, limit: 8000 });
  assert.equal(read.exact, true, JSON.stringify(read.diverge || read.weight.fail));
  assert.equal(read.weight.result, SIGNATURE);
  assert.equal(read.weight.ram[4], SIGNATURE);
  loaded.words[0] = (loaded.words[0] | 0) + 1;
  assert.throws(() => runMachine({ program: 'storage-read', storage: loaded, limit: 20 }), /decode|bits/);
});

test('faults spread: ram bit rot, dropped console packet, stuck MAC', () => {
  const probe = runMachine({ program: 'rot-probe', trace: true });
  assert.equal(probe.exact, true, JSON.stringify(probe.diverge));
  assert.equal(probe.weight.result, 7);
  const storeDone = probe.packets.find((p) => p.op === 'write' && p.dst === 'ram' && p.addr === 3);
  assert.ok(storeDone);
  const at = storeDone.arrive + 1;
  const rot = runMachine({ program: 'rot-probe', fault: { kind: 'ram-bit', word: 3, bit: 0, atCycle: at } });
  assert.equal(rot.ref.result, 7);
  assert.notEqual(rot.weight.result, 7);
  assert.equal(rot.exact, false);
  assert.equal(rot.diverge.field, 'ram');
  assert.equal(rot.precisionOk, true);

  const drop = runMachine({ program: 'hello', fault: { kind: 'drop', dst: 'console' } });
  assert.equal(drop.ref.console, HELLO);
  assert.notEqual(drop.weight.console, HELLO);
  assert.equal(drop.exact, false);
  assert.ok(drop.injected.some((e) => e.kind === 'drop'));
  assert.equal(drop.weight.halted, true);

  const stuck = runMachine({ program: 'tpu', ram: identityRam(), fault: { kind: 'tpu-stuck', r: 0, c: 0, bit: 0, value: 0 }, limit: 8000 });
  assert.equal(stuck.ref.result, 1);
  assert.equal(stuck.weight.result, 0);
  assert.equal(stuck.exact, false);
  assert.ok(stuck.injected.some((e) => e.kind === 'tpu-stuck'));
});

test('randomized bus grant matches the integer scan', () => {
  const rng = mulberry32(3);
  for (let i = 0; i < 40; i++) {
    const mask = (rng() * 16) | 0;
    const rr = (rng() * 4) | 0;
    const bits = new Float32Array(4);
    for (let k = 0; k < 4; k++) bits[k] = (mask >>> k) & 1;
    const faults = [];
    assert.equal(grantBits(bits, rr, faults).index, grantRef(mask, rr, 4));
    assert.equal(faults.length, 0);
  }
});

test('Forge programs still halt with the Forge VM result', () => {
  const src = 'dup i32 a = 7\ndup i32 b = 13\nhalt a + b\n';
  const compiled = compile(src);
  assert.equal(compiled.ok, true);
  const vm = runVM(compiled.rom);
  const run = runMachine({ rom: compiled.rom, limit: 64 });
  assert.equal(run.exact, true, JSON.stringify(run.diverge || run.faults.slice(0, 3)));
  assert.equal(run.weight.result, 20);
  assert.equal(run.weight.result, vm.result);
  const demo = compile(DEMO_SOURCE);
  assert.equal(demo.ok, true);
  const vmDemo = runVM(demo.rom);
  const runDemo = runMachine({ rom: demo.rom, limit: 20000 });
  assert.equal(runDemo.exact, true, JSON.stringify(runDemo.diverge || runDemo.weight.fail));
  assert.equal(runDemo.weight.result, vmDemo.result);
  assert.equal(runDemo.weight.result, 770);
});

test('zoom chain: weights, gates, simulated voltage', () => {
  const ram = runMachine({ program: 'memtest', limit: 12000 });
  const weights = zoomView('ram', 'weights', ram.weightState);
  assert.equal(weights.level, 'weights');
  assert.equal(weights.simulated, false);
  assert.equal(weights.and.check, true);
  assert.ok(weights.values.length > 0);
  const gates = zoomView('cpu', 'gates');
  assert.equal(gates.level, 'gates');
  assert.equal(gates.simulated, false);
  assert.ok(gates.logic > 0);
  assert.equal(Number(gates.out.y), 7);
  const tpu = zoomView('tpu', 'gates');
  assert.equal(tpu.out.p, 15n);
  const volt = zoomView('tpu', 'voltage');
  assert.equal(volt.simulated, true);
  assert.match(volt.banner, /Simulated/);
  assert.equal(volt.banner, CMOS_BANNER);
  assert.equal(volt.validHigh, true);
  assert.equal(volt.validLow, true);
  assert.ok(volt.nand.every((row) => row.ok));
});

test('float64 cross-check of hello matches float32', () => {
  const f32 = runMachine({ program: 'hello' });
  const f64 = runMachine({ program: 'hello', ArrayType: Float64Array });
  assert.equal(f64.exact, true);
  assert.equal(f64.weight.console, f32.weight.console);
  assert.equal(f64.cycles, f32.cycles);
});

test('component names and program list are the machine room set', () => {
  for (const id of ['hello', 'memtest', 'gpu-pattern', 'gpu-vec', 'tpu', 'storage-write', 'storage-read', 'multi', 'irq', 'rot-probe']) {
    assert.equal(typeof PROGRAMS[id].rom, 'function');
    assert.ok(PROGRAMS[id].title);
  }
  const file = storageFileFromWords(new Array(512).fill(0));
  assert.equal(file.format, 'neuralese-wm-ssd-v1');
  assert.equal(file.words.length, 512);
});

test('measure table is exact on every row', async () => {
  const report = await measure({ seed: 11, cpu: 12, ram: 12, ssd: 6, gpu: 4, tpu: 3, bus: 16, mlp: 2 });
  for (const row of report.rows) assert.equal(row.exact, row.trials, row.component + ' ' + row.mismatches);
  for (const p of report.programs) {
    assert.equal(p.exact, true, p.id + ' ' + JSON.stringify(p.diverge || p.fail));
    assert.equal(p.cycles, p.refCycles, p.id);
    assert.equal(p.faults, 0, p.id);
    assert.equal(typeof p.msWeight, 'number');
    assert.ok(p.msRef > 0, p.id);
  }
  const out = path.join(os.tmpdir(), 'wm-measure.json');
  fs.writeFileSync(out, JSON.stringify(report));
  assert.ok(matmulInt([1, 0, 0, 1], [1, 0, 0, 1], 2).acc[0] === 1);
});

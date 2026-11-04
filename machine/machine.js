// Host stepper. The weight machine and the int32 reference run the same program.
// Exact means every architectural field matches and the weight path recorded no precision fault.
// Wall-clock overhead is measured by running the two machines separately.

import { enc } from '../forge/isa.js';
import { matvec } from '../engine.js';
import { mulberry32 } from '../model.js';
import {
  BUS_LAT, COMPONENTS, FB_H, FB_PIXELS, FB_W, LANES, RAM_WORDS, SSD_PAGES, SSD_TOTAL,
  SSD_WORDS, STEP_LIMIT, TPU_N, WM_VERSION, WORD_BITS, macCycles,
} from './isa.js';
import { AND_LAYER, applyAndLayer, applyNotLayer, grantBits, intBits, readPaged, readWord, routeBits, wordOf, writePaged, writeWord } from './gadget.js';
import { PROGRAMS, identityRam, programIds, programRom, vecRam } from './programs.js';
import {
  archRef, createRef, grantRef, matmulInt, packetsOf as packetsRef, patternPixel, reluInt,
  routeRef, runRef, sext8, stepRef,
} from './ref.js';
import {
  archWeight, createWeight, matmulBits, packetsOf as packetsWeight, runWeight, saveStorage, stepWeight,
} from './weight.js';
import { zoomView } from './zoom.js';

export { COMPONENTS, PROGRAMS, WM_VERSION, identityRam, programIds, programRom, saveStorage, vecRam, zoomView };

export const PRECISION = Object.freeze({
  shipped: 'float32',
  reference: 'int32',
  voltage: 'simulated',
  bf16: 'not-run',
  softmax: 'not-used',
  note: 'Gadgets are {0,1} combinations and hard attention. float32 holds those integers exactly. The int32 reference is ground truth. The CMOS view is simulated. bf16 was not run. A softmax is not used; RAM attention is an exact one-hot.',
});

export const LIMITS = Object.freeze({
  RAM_WORDS, SSD_PAGES, SSD_WORDS, SSD_TOTAL, FB_W, FB_H, FB_PIXELS, LANES, TPU_N, BUS_LAT,
  macCycles: macCycles(TPU_N),
});

function diffArch(w, r) {
  const fields = ['cycle', 'pc', 'console', 'halted', 'fail', 'result', 'ei', 'irq', 'inHandler', 'epc', 'irqTaken'];
  for (const f of fields) if (w[f] !== r[f]) return { field: f, weight: w[f], ref: r[f] };
  for (let i = 0; i < 8; i++) if (w.regs[i] !== r.regs[i]) return { field: 'regs', index: i, weight: w.regs[i], ref: r.regs[i] };
  for (let i = 0; i < w.ram.length; i++) if (w.ram[i] !== r.ram[i]) return { field: 'ram', index: i, weight: w.ram[i], ref: r.ram[i] };
  for (let i = 0; i < w.ssd.length; i++) if (w.ssd[i] !== r.ssd[i]) return { field: 'ssd', index: i, weight: w.ssd[i], ref: r.ssd[i] };
  for (let i = 0; i < w.fb.length; i++) if (w.fb[i] !== r.fb[i]) return { field: 'fb', index: i, weight: w.fb[i], ref: r.fb[i] };
  return null;
}

function packetsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i]; const q = b[i];
    const keys = ['id', 'src', 'dst', 'op', 'addr', 'data', 'len', 'port', 'aux', 'issue', 'arrive', 'status'];
    for (const k of keys) if (p[k] !== q[k]) return false;
  }
  return true;
}

function romOf(opts) {
  if (opts.rom) return opts.rom.slice();
  if (opts.program) return programRom(opts.program);
  throw new Error('program or rom required');
}

export function runMachine(opts = {}) {
  const rom = romOf(opts);
  const limit = opts.limit || STEP_LIMIT;
  const common = { rom, ram: opts.ram || null, storage: opts.storage || null, pipeline: !!opts.pipeline };
  const weight = createWeight({ ...common, fault: opts.fault || null, ArrayType: opts.ArrayType });
  const ref = createRef(common);
  const frames = [];
  let diverge = null;
  let matched = 0;
  let compared = 0;
  while (weight.cycle < limit && ref.cycle < limit) {
    const wDone = !!(weight.halted || weight.fail);
    const rDone = !!(ref.halted || ref.fail);
    if (wDone && rDone) break;
    if (!wDone) stepWeight(weight);
    if (!rDone) stepRef(ref);
    const aw = archWeight(weight);
    const ar = archRef(ref);
    const d = diffArch(aw, ar);
    compared++;
    if (!d) matched++;
    else if (!diverge) diverge = { cycle: weight.cycle, ...d };
    if (opts.trace) {
      frames.push({
        cycle: aw.cycle, pc: aw.pc, regs: aw.regs.slice(), console: aw.console, halted: aw.halted,
        fail: aw.fail, result: aw.result, ei: aw.ei, irq: aw.irq, fb: aw.fb.slice(),
        busy: { ssd: weight.ssdS.phase, gpu: weight.gpuS.phase, tpu: weight.tpuS.phase },
        eq: !d,
      });
    }
    if (d && opts.stopOnDiff) break;
  }
  if (!weight.halted && !weight.fail && weight.cycle >= limit) weight.fail = 'step-limit';
  if (!ref.halted && !ref.fail && ref.cycle >= limit) ref.fail = 'step-limit';
  const aw = archWeight(weight);
  const ar = archRef(ref);
  const pw = packetsWeight(weight);
  const pr = packetsRef(ref);
  const precisionOk = weight.faults.length === 0;
  return {
    version: WM_VERSION,
    program: opts.program || null,
    exact: !diverge && precisionOk && aw.cycle === ar.cycle && aw.fail === ar.fail,
    packetExact: packetsEqual(pw, pr),
    precisionOk,
    matched, compared, rate: compared ? matched / compared : 1,
    diverge, cycles: aw.cycle, refCycles: ar.cycle,
    weight: aw, ref: ar,
    faults: weight.faults.slice(),
    injected: weight.injected.slice(),
    packets: pw,
    frames,
    weightState: weight,
    refState: ref,
  };
}

export function timeProgram(opts) {
  const rom = romOf(opts);
  const limit = opts.limit || STEP_LIMIT;
  const common = { rom, ram: opts.ram || null, storage: opts.storage || null, pipeline: !!opts.pipeline };
  const weight = createWeight({ ...common, fault: opts.fault || null });
  const ref = createRef(common);
  const t0 = performance.now();
  runWeight(weight, limit);
  const msWeight = performance.now() - t0;
  const t1 = performance.now();
  runRef(ref, limit);
  const msRef = performance.now() - t1;
  return { msWeight, msRef, cycles: weight.cycle, refCycles: ref.cycle, overhead: msRef > 0 ? msWeight / msRef : null };
}

function overheadOf(msWeight, msRef) {
  return msRef > 0 ? msWeight / msRef : null;
}

export function compareMatmul(A, B, n = TPU_N, bias = null) {
  const w = matmulBits(A, B, n, bias);
  const r = matmulInt(A, B, n, bias);
  let exact = w.faults.length === 0 && w.cycles === r.cycles;
  for (let i = 0; i < n * n && exact; i++) if (w.acc[i] !== (r.acc[i] | 0)) exact = false;
  let schedule = w.trace.length === r.trace.length;
  for (let i = 0; i < w.trace.length && schedule; i++) if (w.trace[i] !== r.trace[i]) schedule = false;
  return { exact, schedule, weight: w.acc, ref: Array.from(r.acc), cycles: w.cycles, faults: w.faults };
}

export function runMlp(X, W, bias) {
  const n = TPU_N;
  const B = new Array(n * n);
  for (let c = 0; c < n; c++) for (let k = 0; k < n; k++) B[k * n + c] = W[c * n + k] | 0;
  const mat = compareMatmul(X, B, n, bias);
  const weight = mat.weight.map(reluInt);
  const ref = mat.ref.map(reluInt);
  const Wm = Float32Array.from(W);
  const b = Float32Array.from(bias);
  const host = [];
  for (let r = 0; r < n; r++) {
    const x = Float32Array.from(X.slice(r * n, r * n + n));
    const out = new Float32Array(n);
    matvec(Wm, x, out, n, n, b);
    for (let c = 0; c < n; c++) host.push(reluInt(out[c]));
  }
  let hostExact = host.length === weight.length;
  for (let i = 0; i < host.length && hostExact; i++) if (host[i] !== weight[i]) hostExact = false;
  return {
    exact: mat.exact && hostExact && weight.every((v, i) => v === ref[i]),
    hostExact, matmulExact: mat.exact, cycles: mat.cycles, faults: mat.faults,
    weight, ref, host,
    note: 'The linear map is engine.matvec, the GPT-Neo primitive. ReLU is integer max(y, 0). TinyStories uses GELU; that activation was not compared.',
  };
}

function i32(rng) { return (rng() * 0x100000000) | 0; }
function i8(rng) { return (rng() * 256 | 0) - 128; }

function aluRom(kind, a, b) {
  const words = [
    enc(6, 1, 0, 0, a) >>> 0,
    enc(6, 2, 0, 0, b) >>> 0,
  ];
  if (kind === 0) words.push(enc(1, 3, 1, 2, 0) >>> 0);
  else if (kind === 1) words.push(enc(2, 3, 1, 2, 0) >>> 0);
  else if (kind === 2) words.push(enc(3, 3, 1, 2, 0) >>> 0);
  else if (kind === 3) words.push(enc(5, 3, 1, 2, 0) >>> 0);
  else if (kind === 4) words.push(enc(14, 3, 1, 2, 0) >>> 0);
  else words.push(enc(6, 3, 1, 0, b) >>> 0);
  words.push(enc(0, 3, 0, 0, 0, 1) >>> 0);
  return words;
}

export function storageFileFromWords(words) {
  const w = createWeight({ rom: [0] });
  for (let i = 0; i < SSD_TOTAL; i++) if ((words[i] | 0) !== 0) writeWord(w.ssdB, i, words[i] | 0, WORD_BITS, w.faults, 'poke');
  return saveStorage(w);
}

export function fbChecksum(fb) {
  let s = 0;
  for (let i = 0; i < fb.length; i++) s = (s + fb[i] * (i + 1)) | 0;
  return s >>> 0;
}

export function expectedPattern() {
  const fb = new Uint8Array(FB_PIXELS);
  for (let i = 0; i < FB_PIXELS; i++) fb[i] = patternPixel(i);
  return fb;
}

export function gadgetSelfCheck() {
  return {
    andOk: applyAndLayer(1, 1) === 1 && applyAndLayer(1, 0) === 0 && applyAndLayer(0, 1) === 0 && applyAndLayer(0, 0) === 0,
    notOk: applyNotLayer(0) === 1 && applyNotLayer(1) === 0,
    and: AND_LAYER,
    relu: reluInt(-3) === 0 && reluInt(4) === 4,
    sext: sext8(255) === -1 && sext8(128) === -128,
  };
}

export function linkNames(packets) {
  const seen = new Set();
  const links = [];
  for (const p of packets) {
    const key = p.src + '>' + p.dst;
    if (!seen.has(key)) { seen.add(key); links.push({ src: p.src, dst: p.dst }); }
  }
  return links;
}

export function packetStatusAt(p, cycle) {
  if (cycle < p.issue) return 'future';
  if (p.arrive == null) return 'queued';
  if (cycle < p.arrive) return 'inflight';
  return p.status === 'drop' ? 'drop' : 'done';
}

export function measure(opts = {}) {
  const seed = opts.seed >>> 0 || 1;
  const rng = mulberry32(seed);
  const nCpu = opts.cpu ?? 24;
  const nRam = opts.ram ?? 24;
  const nSsd = opts.ssd ?? 12;
  const nGpu = opts.gpu ?? 8;
  const nTpu = opts.tpu ?? 4;
  const nBus = opts.bus ?? 32;
  const nMlp = opts.mlp ?? 2;
  const rows = [];

  {
    let exact = 0; let msW = 0; let msR = 0; let cycles = 0;
    for (let i = 0; i < nCpu; i++) {
      const rom = aluRom(i % 6, (i32(rng) % 2000) - 1000, (i32(rng) % 2000) - 1000);
      const w = createWeight({ rom });
      const r = createRef({ rom });
      const t0 = performance.now();
      runWeight(w, 64);
      msW += performance.now() - t0;
      const t1 = performance.now();
      runRef(r, 64);
      msR += performance.now() - t1;
      cycles += w.cycle;
      if (!diffArch(archWeight(w), archRef(r)) && w.faults.length === 0) exact++;
    }
    rows.push({ component: 'CPU', trials: nCpu, exact, mismatches: nCpu - exact, msWeight: msW, msRef: msR, cyclesWeight: cycles, cyclesRef: cycles, overhead: overheadOf(msW, msR), note: 'Program load is outside the clock. The clock is the gadget steps.' });
  }

  {
    let exact = 0; let msW = 0; let msR = 0;
    const w = createWeight({ rom: [0] });
    const r = createRef({ rom: [0] });
    const addrs = []; const values = [];
    for (let i = 0; i < nRam; i++) { addrs.push((rng() * RAM_WORDS) | 0); values.push(i32(rng)); }
    const t0 = performance.now();
    for (let i = 0; i < nRam; i++) {
      writeWord(w.ramB, addrs[i], values[i], WORD_BITS, w.faults, 'mw');
      const got = wordOf(readWord(w.ramB, addrs[i], WORD_BITS, w.faults, 'mr'));
      if (got !== (values[i] | 0)) exact--;
    }
    msW += performance.now() - t0;
    const t1 = performance.now();
    for (let i = 0; i < nRam; i++) {
      r.ram[addrs[i]] = values[i] | 0;
      if ((r.ram[addrs[i]] | 0) !== (values[i] | 0)) exact--;
    }
    msR += performance.now() - t1;
    exact += nRam;
    if (w.faults.length) exact = 0;
    rows.push({ component: 'RAM', trials: nRam, exact, mismatches: nRam - exact, msWeight: msW, msRef: msR, cyclesWeight: nRam, cyclesRef: nRam, overhead: overheadOf(msW, msR), note: 'One delta-rule write and one hard-attention read per trial. Bank construction is outside the clock.' });
  }

  {
    let exact = 0; let msW = 0; let msR = 0;
    const w = createWeight({ rom: [0] });
    const r = createRef({ rom: [0] });
    const pages = []; const slots = []; const values = [];
    for (let i = 0; i < nSsd; i++) {
      pages.push((rng() * SSD_PAGES) | 0);
      slots.push(i % SSD_WORDS);
      values.push(i32(rng));
    }
    const t0 = performance.now();
    for (let i = 0; i < nSsd; i++) {
      writePaged(w.ssdB, pages[i], slots[i], values[i], SSD_PAGES, SSD_WORDS, WORD_BITS, w.faults, 'sw');
      const got = wordOf(readPaged(w.ssdB, pages[i], slots[i], SSD_PAGES, SSD_WORDS, WORD_BITS, w.faults, 'sr'));
      if (got !== (values[i] | 0)) exact--;
    }
    msW += performance.now() - t0;
    const t1 = performance.now();
    for (let i = 0; i < nSsd; i++) {
      r.ssd[pages[i] * SSD_WORDS + slots[i]] = values[i] | 0;
      if ((r.ssd[pages[i] * SSD_WORDS + slots[i]] | 0) !== (values[i] | 0)) exact--;
    }
    msR += performance.now() - t1;
    exact += nSsd;
    if (w.faults.length) exact = 0;
    rows.push({ component: 'SSD', trials: nSsd, exact, mismatches: nSsd - exact, msWeight: msW, msRef: msR, cyclesWeight: nSsd, cyclesRef: nSsd, overhead: overheadOf(msW, msR), note: 'One paged attention write and read per trial.' });
  }

  {
    let exact = 0; let msW = 0; let msR = 0; let cycles = 0;
    for (let i = 0; i < nGpu; i++) {
      const a = []; const b = [];
      for (let k = 0; k < LANES; k++) { a.push(i8(rng)); b.push(i8(rng)); }
      const ram = vecRam(a, b);
      const rom = programRom('gpu-vec');
      const w = createWeight({ rom, ram });
      const r = createRef({ rom, ram });
      const t0 = performance.now();
      runWeight(w, 400);
      msW += performance.now() - t0;
      const t1 = performance.now();
      runRef(r, 400);
      msR += performance.now() - t1;
      cycles += w.cycle;
      const run = runMachine({ program: 'gpu-vec', ram, limit: 400 });
      let ok = run.exact && run.packetExact;
      for (let k = 0; k < LANES && ok; k++) if (run.weight.ram[32 + k] !== ((a[k] + b[k]) | 0)) ok = false;
      if (ok) exact++;
    }
    rows.push({ component: 'GPU', trials: nGpu, exact, mismatches: nGpu - exact, msWeight: msW, msRef: msR, cyclesWeight: cycles, cyclesRef: cycles, overhead: overheadOf(msW, msR), note: 'Clock is the vecadd program after the ROM is installed.' });
  }

  {
    let exact = 0; let msW = 0; let msR = 0; let cycles = 0;
    for (let i = 0; i < nTpu; i++) {
      const A = []; const B = [];
      for (let k = 0; k < TPU_N * TPU_N; k++) { A.push(i8(rng)); B.push(i8(rng)); }
      const t0 = performance.now();
      const cmp = compareMatmul(A, B);
      const dt = performance.now() - t0;
      // compareMatmul runs weight then the integer loop. Split a second pair for the ratio.
      const tW = performance.now();
      matmulBits(A, B);
      const wdt = performance.now() - tW;
      const tR = performance.now();
      matmulInt(A, B);
      const rdt = performance.now() - tR;
      msW += wdt; msR += rdt; cycles += cmp.cycles;
      if (cmp.exact && cmp.schedule) exact++;
      void dt;
    }
    rows.push({ component: 'TPU', trials: nTpu, exact, mismatches: nTpu - exact, msWeight: msW, msRef: msR, cyclesWeight: cycles, cyclesRef: cycles, overhead: overheadOf(msW, msR) });
  }

  {
    let exact = 0; let msW = 0; let msR = 0;
    for (let i = 0; i < nBus; i++) {
      const mask = (rng() * 16) | 0;
      const rr = (rng() * 4) | 0;
      const bits = new Float32Array(4);
      for (let k = 0; k < 4; k++) bits[k] = (mask >>> k) & 1;
      const faults = [];
      const t0 = performance.now();
      const g = grantBits(bits, rr, faults);
      const dest = (rng() * 4) | 0;
      const routed = routeBits(intBits(Float32Array, dest, 2), intBits(Float32Array, (rng() * 256) | 0, 8), 4, faults, 'route');
      msW += performance.now() - t0;
      const t1 = performance.now();
      const expect = grantRef(mask, rr, 4);
      const ports = routeRef(dest, 1, 4);
      msR += performance.now() - t1;
      let ok = g.index === expect && faults.length === 0;
      for (let p = 0; p < 4 && ok; p++) if ((routed.scores[p] === 1 ? 1 : 0) !== (ports[p] ? 1 : 0)) ok = false;
      if (ok) exact++;
    }
    rows.push({ component: 'Bus', trials: nBus, exact, mismatches: nBus - exact, msWeight: msW, msRef: msR, cyclesWeight: nBus, cyclesRef: nBus, overhead: overheadOf(msW, msR) });
  }

  {
    let exact = 0; let msW = 0; let cycles = 0;
    for (let i = 0; i < nMlp; i++) {
      const X = []; const W = []; const bias = [];
      for (let k = 0; k < TPU_N * TPU_N; k++) { X.push(i8(rng)); W.push(i8(rng)); }
      for (let k = 0; k < TPU_N; k++) bias.push(i8(rng));
      const t0 = performance.now();
      const mlp = runMlp(X, W, bias);
      msW += performance.now() - t0;
      cycles += mlp.cycles;
      if (mlp.exact && mlp.faults.length === 0) exact++;
    }
    rows.push({
      component: 'MLP', trials: nMlp, exact, mismatches: nMlp - exact, msWeight: msW, msRef: null, cyclesWeight: cycles, cyclesRef: cycles, overhead: null,
      note: 'Timed together with engine.matvec. Exact covers the gadget, the int32 matmul, and matvec.',
    });
  }

  const programs = [];
  for (const id of ['hello', 'memtest', 'gpu-pattern', 'tpu', 'multi', 'irq']) {
    const ram = id === 'tpu' ? identityRam() : null;
    const limit = id === 'gpu-pattern' || id === 'tpu' || id === 'memtest' ? 12000 : STEP_LIMIT;
    const run = runMachine({ program: id, ram, limit });
    const timed = timeProgram({ program: id, ram, limit });
    programs.push({
      id, exact: run.exact, packetExact: run.packetExact, rate: run.rate,
      cycles: run.cycles, refCycles: run.refCycles,
      msWeight: timed.msWeight, msRef: timed.msRef, overhead: timed.overhead,
      result: run.weight.result, console: run.weight.console, faults: run.faults.length,
      fail: run.weight.fail, diverge: run.diverge,
    });
  }
  return { seed, version: WM_VERSION, precision: PRECISION.note, busLat: BUS_LAT, macCycles: macCycles(TPU_N), rows, programs, voltage: 'simulated', bf16: 'not-run' };
}

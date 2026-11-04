// Integer reference machine. Ground truth for Weight-Machine. Words are int32. No float rounding.
// The phase order in stepRef is the spec. src/machine/weight.js repeats it with gadgets.

import { dec } from '../forge/isa.js';
import {
  BUS_LAT, COMPONENTS, DEV, F, FB_PIXELS, FUNCT_HALT, IRQ_VECTOR, LANES, MASTERS, OP, OP_SYS,
  RAM_WORDS, SSD_PAGES, SSD_TOTAL, SSD_WORDS, STEP_LIMIT, TPU_N, isForgeOp, macCycles,
} from './isa.js';

export function sext8(u) {
  u &= 255;
  return (u & 128) ? (u - 256) : u;
}

export function grantRef(mask, rr, n = MASTERS.length) {
  for (let i = 0; i < n; i++) {
    const k = (rr + i) % n;
    if ((mask >>> k) & 1) return k;
  }
  return -1;
}

export function routeRef(dest, data, nPorts) {
  const ports = new Array(nPorts).fill(0);
  if (dest >= 0 && dest < nPorts) ports[dest] = data;
  return ports;
}

export function matmulInt(A, B, n = TPU_N, bias = null) {
  const acc = new Int32Array(n * n);
  if (bias) for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) acc[r * n + c] = bias[c] | 0;
  const cycles = macCycles(n);
  const trace = [];
  for (let t = 0; t < cycles; t++) {
    let active = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const k = t - r - c;
      if (k < 0 || k >= n) continue;
      active++;
      const prod = (sext8(A[r * n + k]) * sext8(B[k * n + c])) | 0;
      acc[r * n + c] = (acc[r * n + c] + prod) | 0;
    }
    trace.push(active);
  }
  return { acc, cycles, trace };
}

export function reluInt(x) { return x < 0 ? 0 : x | 0; }

function blank(rom) {
  const words = rom.slice(0, RAM_WORDS);
  while (words.length < RAM_WORDS) words.push(0);
  return {
    kind: 'ref',
    rom: words,
    x: new Int32Array(8),
    ram: new Int32Array(RAM_WORDS),
    ssd: new Int32Array(SSD_TOTAL),
    fb: new Uint8Array(FB_PIXELS),
    console: '',
    pc: 0,
    epc: 0,
    ei: 0,
    irq: 0,
    inHandler: 0,
    halted: false,
    fail: null,
    result: null,
    cycle: 0,
    rr: 0,
    nextId: 1,
    pkts: [],
    wait: null,
    pipeline: false,
    ir: 0,
    irValid: false,
    ssdS: { phase: 'idle', page: 0, base: 0, write: 0, i: 0 },
    gpuS: { phase: 'idle', shader: 0, a: 0, b: 0, dest: 0, i: 0, hold: null },
    tpuS: { phase: 'idle', a: 0, b: 0, c: 0, t: 0, A: null, B: null, acc: null },
    irqTaken: 0,
    faults: [],
  };
}

export function createRef(opts = {}) {
  const m = blank(opts.rom || []);
  m.pipeline = !!opts.pipeline;
  if (opts.ram) {
    const src = opts.ram;
    for (let i = 0; i < RAM_WORDS && i < src.length; i++) m.ram[i] = src[i] | 0;
  }
  if (opts.storage) loadSsdInts(m, opts.storage);
  return m;
}

export function ssdInts(m) { return Array.from(m.ssd); }

export function loadSsdInts(m, file) {
  if (!file || file.format !== 'neuralese-wm-ssd-v1') throw new Error('ssd file format');
  if (!Array.isArray(file.words) || file.words.length !== SSD_TOTAL) throw new Error('ssd file length');
  for (let i = 0; i < SSD_TOTAL; i++) m.ssd[i] = file.words[i] | 0;
}

function outstanding(m, src) {
  return m.pkts.some((p) => p.port === 'bus' && p.src === src && (p.status === 'queued' || p.status === 'inflight'));
}

function post(m, req) {
  const p = {
    id: m.nextId++, src: req.src, dst: req.dst, op: req.op, addr: req.addr | 0,
    data: req.data == null ? null : req.data | 0, len: req.len || 1, bytes: req.bytes ? req.bytes.slice() : null,
    port: 'bus', aux: req.aux ?? null, reg: req.reg || 0, issue: m.cycle, arrive: null, status: 'queued',
  };
  m.pkts.push(p);
  return p;
}

function postWide(m, req) {
  m.pkts.push({
    id: m.nextId++, src: req.src, dst: req.dst, op: req.op, addr: req.addr | 0,
    data: req.data == null ? null : req.data | 0, len: req.len || 1, bytes: null,
    port: 'wide', aux: req.aux ?? null, reg: 0, issue: m.cycle, arrive: m.cycle, status: 'done',
  });
}

function busBusy(m) {
  return m.pkts.some((p) => p.port === 'bus' && p.status === 'inflight');
}

function signal(m, kind) {
  if (m.wait && m.wait.kind === kind) m.wait.ready = true;
}

function deliver(m) {
  for (const p of m.pkts) {
    if (p.port !== 'bus' || p.status !== 'inflight' || p.arrive !== m.cycle) continue;
    p.status = 'done';
    if (p.op === 'read' && p.dst === 'ram') {
      if (p.len > 1) {
        const bytes = [];
        for (let i = 0; i < p.len; i++) bytes.push(m.ram[(p.addr + i) & 255] | 0);
        p.bytes = bytes;
      } else p.data = m.ram[p.addr & 255] | 0;
      if (p.src === 'ssd' && p.aux && p.aux.role === 'fill') {
        m.ssd[p.aux.page * SSD_WORDS + p.aux.i] = p.data | 0;
        ssdAdvance(m, p.aux.i);
      }
    } else if (p.op === 'write' && p.dst === 'ram') {
      if (p.len > 1 && p.bytes) {
        for (let i = 0; i < p.len; i++) m.ram[(p.addr + i) & 255] = p.bytes[i] | 0;
      } else m.ram[p.addr & 255] = p.data | 0;
      if (p.src === 'ssd' && p.aux && p.aux.role === 'spill') ssdAdvance(m, p.aux.i);
    } else if (p.op === 'write' && p.dst === 'console') {
      m.console += String.fromCharCode(p.data & 255);
    } else if (p.op === 'write' && p.dst === 'fb') {
      const bytes = p.bytes || [];
      for (let i = 0; i < bytes.length; i++) m.fb[(p.addr + i) % FB_PIXELS] = bytes[i] & 255;
    } else if (p.op === 'read' && p.dst === 'ssd') {
      p.data = m.ssdS.phase === 'idle' ? 0 : (SSD_WORDS - m.ssdS.i) | 0;
    } else if (p.op === 'read' && (p.dst === 'gpu' || p.dst === 'tpu')) {
      const unit = p.dst === 'gpu' ? m.gpuS : m.tpuS;
      p.data = unit.phase === 'idle' ? 0 : 1;
    } else if (p.op === 'cmd' && p.dst === 'ssd') {
      m.ssdS = { phase: 'xfer', page: p.addr & (SSD_PAGES - 1), base: p.aux.base & 255, write: p.aux.write ? 1 : 0, i: 0 };
    } else if (p.op === 'cmd' && p.dst === 'gpu') {
      m.gpuS = { phase: 'run', shader: p.aux.shader | 0, a: p.aux.a | 0, b: p.aux.b | 0, dest: p.aux.dest | 0, i: 0, hold: null };
    } else if (p.op === 'cmd' && p.dst === 'tpu') {
      m.tpuS = { phase: 'load', a: p.aux.a | 0, b: p.aux.b | 0, c: p.aux.c | 0, t: 0, A: null, B: null, acc: null };
    }
    if (m.wait && m.wait.kind === 'packet' && m.wait.id === p.id) {
      m.wait.ready = true;
      m.wait.data = p.data | 0;
    }
  }
}

function ssdAdvance(m, i) {
  m.ssdS.i = i + 1;
  if (m.ssdS.i >= SSD_WORDS) { m.ssdS.phase = 'idle'; m.irq = 1; }
  else m.ssdS.phase = 'xfer';
}

function deviceTick(m) {
  const s = m.ssdS;
  if ((s.phase === 'xfer') && !outstanding(m, 'ssd')) {
    if (s.i >= SSD_WORDS) { s.phase = 'idle'; m.irq = 1; }
    else if (s.write) post(m, { src: 'ssd', dst: 'ram', op: 'read', addr: (s.base + s.i) & 255, aux: { role: 'fill', page: s.page, i: s.i } });
    else {
      const v = m.ssd[s.page * SSD_WORDS + s.i] | 0;
      post(m, { src: 'ssd', dst: 'ram', op: 'write', addr: (s.base + s.i) & 255, data: v, aux: { role: 'spill', page: s.page, i: s.i } });
    }
  }
  tickGpu(m);
  tickTpu(m);
}

function tickGpu(m) {
  const g = m.gpuS;
  if (g.phase !== 'run' || outstanding(m, 'gpu')) return;
  if (g.shader === 1) {
    if (g.i >= FB_PIXELS) { g.phase = 'idle'; signal(m, 'gpu'); return; }
    const bytes = [];
    for (let lane = 0; lane < LANES; lane++) bytes.push(patternPixel(g.i + lane));
    post(m, { src: 'gpu', dst: 'fb', op: 'write', addr: g.i, bytes, len: LANES, data: bytes[0] });
    g.i += LANES;
    return;
  }
  if (g.hold == null) {
    const n = LANES;
    const a = []; const b = [];
    for (let i = 0; i < n; i++) { a.push(m.ram[(g.a + i) & 255] | 0); b.push(m.ram[(g.b + i) & 255] | 0); }
    g.hold = a.map((v, i) => (v + b[i]) | 0);
    postWide(m, { src: 'gpu', dst: 'ram', op: 'read', addr: g.a, len: n * 2, data: a[0], aux: 'wide-port' });
  }
  post(m, { src: 'gpu', dst: 'ram', op: 'write', addr: g.dest & 255, bytes: g.hold, len: LANES, data: g.hold[0] });
  g.phase = 'drain';
}

function tickGpuDrain(m) {
  const g = m.gpuS;
  if (g.phase === 'drain' && !outstanding(m, 'gpu')) { g.phase = 'idle'; g.hold = null; signal(m, 'gpu'); }
}

export function patternPixel(i) {
  if (i < 0 || i >= FB_PIXELS) return 0;
  const x = i % 32;
  const y = (i / 32) | 0;
  return (x ^ y) & 1 ? 0xe2 : 0x14;
}

function tickTpu(m) {
  const t = m.tpuS;
  if (t.phase === 'idle') return;
  const n = TPU_N;
  if (t.phase === 'load') {
    t.A = new Int32Array(n * n);
    t.B = new Int32Array(n * n);
    t.acc = new Int32Array(n * n);
    for (let i = 0; i < n * n; i++) {
      t.A[i] = m.ram[(t.a + i) & 255] | 0;
      t.B[i] = m.ram[(t.b + i) & 255] | 0;
    }
    postWide(m, { src: 'tpu', dst: 'ram', op: 'read', addr: t.a, len: n * n * 2, data: t.A[0], aux: 'wide-port' });
    t.t = 0;
    t.phase = 'mac';
    return;
  }
  if (t.phase === 'mac') {
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const k = t.t - r - c;
      if (k < 0 || k >= n) continue;
      const prod = (sext8(t.A[r * n + k]) * sext8(t.B[k * n + c])) | 0;
      t.acc[r * n + c] = (t.acc[r * n + c] + prod) | 0;
    }
    t.t++;
    if (t.t >= macCycles(n)) t.phase = 'store';
    return;
  }
  if (t.phase === 'store') {
    for (let i = 0; i < n * n; i++) m.ram[(t.c + i) & 255] = t.acc[i] | 0;
    postWide(m, { src: 'tpu', dst: 'ram', op: 'write', addr: t.c, len: n * n, data: t.acc[0], aux: 'wide-port' });
    t.phase = 'idle';
    signal(m, 'tpu');
  }
}

function prefetch(m, pc) {
  m.ir = m.rom[pc & 255] >>> 0;
  m.irValid = true;
}

function takeIrq(m) {
  m.epc = m.pc & 255;
  m.pc = IRQ_VECTOR;
  m.inHandler = 1;
  m.irq = 0;
  m.irValid = false;
  m.irqTaken++;
}

function execute(m) {
  const pc = m.pc & 255;
  const word = m.pipeline ? m.ir : m.rom[pc];
  const d = dec(word >>> 0);
  const a = m.x[d.rs1] | 0;
  const b = m.x[d.rs2] | 0;
  const forge = isForgeOp(d.op, d.funct);
  const sys = d.op === OP_SYS && d.funct <= F.IRET;
  if (!forge && !sys) { m.fail = 'illegal'; m.irValid = false; return; }
  if (d.op === OP.HALT && d.funct === FUNCT_HALT) {
    m.halted = true;
    m.result = m.x[d.rd] | 0;
    m.irValid = false;
    return;
  }
  let next = (pc + 1) & 255;
  let branch = false;
  if (d.op === OP.ADD) write(m, d.rd, (a + b) | 0);
  else if (d.op === OP.SUB) write(m, d.rd, (a - b) | 0);
  else if (d.op === OP.AND) write(m, d.rd, (a & b) | 0);
  else if (d.op === OP.OR) write(m, d.rd, (a | b) | 0);
  else if (d.op === OP.XOR) write(m, d.rd, (a ^ b) | 0);
  else if (d.op === OP.ADDI) write(m, d.rd, (a + d.simm) | 0);
  else if (d.op === OP.LUI) write(m, d.rd, (d.imm << 16) | 0);
  else if (d.op === OP.SLT) write(m, d.rd, a < b ? 1 : 0);
  else if (d.op === OP.BEQ || d.op === OP.BNE || d.op === OP.BLT) {
    const take = d.op === OP.BEQ ? a === b : d.op === OP.BNE ? a !== b : a < b;
    if (take) { next = (pc + d.simm) & 255; branch = true; }
  } else if (d.op === OP.JAL) {
    write(m, d.rd, next);
    next = (pc + d.simm) & 255;
    branch = true;
  } else if (d.op === OP.LW) {
    const addr = (a + d.simm) & 255;
    const p = post(m, { src: 'cpu', dst: 'ram', op: 'read', addr, reg: d.rd });
    m.wait = { kind: 'packet', id: p.id, reg: d.rd, ready: false, data: 0 };
    m.pc = next; m.irValid = false; return;
  } else if (d.op === OP.SW) {
    const addr = (a + d.simm) & 255;
    const p = post(m, { src: 'cpu', dst: 'ram', op: 'write', addr, data: b });
    m.wait = { kind: 'packet', id: p.id, reg: 0, ready: false, data: 0 };
    m.pc = next; m.irValid = false; return;
  } else if (d.op === OP_SYS && d.funct === F.OUT) {
    const p = post(m, { src: 'cpu', dst: 'console', op: 'write', addr: 0, data: a & 255 });
    m.wait = { kind: 'packet', id: p.id, reg: 0, ready: false, data: 0 };
    m.pc = next; m.irValid = false; return;
  } else if (d.op === OP_SYS && d.funct === F.DLD) {
    const dst = devName(d.imm & 255);
    const p = post(m, { src: 'cpu', dst, op: 'read', addr: 0, reg: d.rd });
    m.wait = { kind: 'packet', id: p.id, reg: d.rd, ready: false, data: 0 };
    m.pc = next; m.irValid = false; return;
  } else if (d.op === OP_SYS && d.funct === F.SSD) {
    post(m, { src: 'cpu', dst: 'ssd', op: 'cmd', addr: a & 255, data: 0, aux: { base: b & 255, write: d.imm & 1 } });
    m.pc = next;
  } else if (d.op === OP_SYS && d.funct === F.GPU) {
    post(m, { src: 'cpu', dst: 'gpu', op: 'cmd', addr: 0, data: d.rd, aux: { shader: d.rd, a, b, dest: d.imm & 255 } });
    m.wait = { kind: 'gpu', id: 0, reg: 0, ready: false, data: 0 };
    m.pc = next; m.irValid = false; return;
  } else if (d.op === OP_SYS && d.funct === F.TPU) {
    post(m, { src: 'cpu', dst: 'tpu', op: 'cmd', addr: d.imm & 255, data: 0, aux: { a: a & 255, b: b & 255, c: d.imm & 255 } });
    m.wait = { kind: 'tpu', id: 0, reg: 0, ready: false, data: 0 };
    m.pc = next; m.irValid = false; return;
  } else if (d.op === OP_SYS && d.funct === F.EI) {
    m.ei = d.imm & 1;
    m.pc = next;
  } else if (d.op === OP_SYS && d.funct === F.IRET) {
    m.pc = m.epc & 255;
    m.inHandler = 0;
    m.irValid = false;
    return;
  }
  m.x[0] = 0;
  m.pc = next;
  if (m.pipeline) {
    if (branch) m.irValid = false;
    else prefetch(m, next);
  }
}

function write(m, rd, value) {
  if (rd !== 0) m.x[rd] = value | 0;
  m.x[0] = 0;
}

function devName(id) {
  if (id === DEV.ssd) return 'ssd';
  if (id === DEV.gpu) return 'gpu';
  if (id === DEV.tpu) return 'tpu';
  if (id === DEV.console) return 'console';
  if (id === DEV.fb) return 'fb';
  return 'ram';
}

function arbitrate(m) {
  if (busBusy(m)) return;
  let mask = 0;
  for (let k = 0; k < MASTERS.length; k++) {
    if (m.pkts.some((p) => p.port === 'bus' && p.status === 'queued' && p.src === MASTERS[k])) mask |= 1 << k;
  }
  const g = grantRef(mask, m.rr, MASTERS.length);
  if (g < 0) return;
  const src = MASTERS[g];
  const req = m.pkts.find((p) => p.port === 'bus' && p.status === 'queued' && p.src === src);
  req.status = 'inflight';
  req.arrive = m.cycle + BUS_LAT;
  m.rr = (g + 1) % MASTERS.length;
}

export function stepRef(m) {
  if (m.halted || m.fail) return m;
  m.cycle++;
  deliver(m);
  deviceTick(m);
  tickGpuDrain(m);
  let skip = false;
  if (m.wait && m.wait.ready) {
    if (m.wait.reg) m.x[m.wait.reg] = m.wait.data | 0;
    m.x[0] = 0;
    m.wait = null;
    skip = true;
  } else if (m.wait) skip = true;
  else if (m.irq && m.ei && !m.inHandler) { takeIrq(m); skip = true; }
  else if (m.pipeline && !m.irValid) { prefetch(m, m.pc); skip = true; }
  if (!skip) execute(m);
  arbitrate(m);
  return m;
}

export function runRef(m, limit = STEP_LIMIT) {
  while (!m.halted && !m.fail && m.cycle < limit) stepRef(m);
  if (!m.halted && !m.fail) m.fail = 'step-limit';
  return m;
}

export function archRef(m) {
  return {
    cycle: m.cycle,
    pc: m.pc & 255,
    regs: Array.from(m.x),
    ram: Array.from(m.ram),
    ssd: Array.from(m.ssd),
    fb: Array.from(m.fb),
    console: m.console,
    halted: m.halted,
    fail: m.fail,
    result: m.result,
    ei: m.ei,
    irq: m.irq,
    inHandler: m.inHandler,
    epc: m.epc & 255,
    irqTaken: m.irqTaken,
  };
}

export function packetsOf(m) {
  return m.pkts.map((p) => ({
    id: p.id, src: p.src, dst: p.dst, op: p.op, addr: p.addr, data: p.data, len: p.len,
    port: p.port, aux: p.aux && p.aux.role ? p.aux.role : (typeof p.aux === 'string' ? p.aux : null),
    issue: p.issue, arrive: p.arrive, status: p.status,
  }));
}

export const REF_COMPONENTS = COMPONENTS;

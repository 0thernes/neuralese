// Weight-Machine datapath. Same phase order as ref.js. ALU, memory, MAC, lanes, grant, and
// routing are gadgets from gadget.js. The host only sequences cycles and moves packets.

import { dec } from '../forge/isa.js';
import { sltBit } from '../forge/bits.js';
import {
  BUS_LAT, DEV, F, FB_PIXELS, FUNCT_HALT, IRQ_VECTOR, LANES, MASTERS, OP, OP_SYS,
  RAM_WORDS, SSD_PAGES, SSD_TOTAL, SSD_WORDS, STEP_LIMIT, TPU_N, WORD_BITS, isForgeOp, macCycles,
} from './isa.js';
import {
  addBits, and2, attentionRead, checkBit, copyBits, deltaWrite, grantBits, intBits,
  mul8signedBits, not, or2, readPaged, readWord, reluBits, sliceBits, wordOf, writePaged,
  writeWord, xor2, zeros,
} from './gadget.js';
import { patternPixel } from './ref.js';

function eqAll(a, b, faults) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff = or2(diff, xor2(a[i], b[i]));
  return checkBit(not(diff), faults, 'eq');
}

export function createWeight(opts = {}) {
  const T = opts.ArrayType || Float32Array;
  const rom = (opts.rom || []).slice(0, RAM_WORDS);
  while (rom.length < RAM_WORDS) rom.push(0);
  const romB = new T(RAM_WORDS * WORD_BITS);
  for (let i = 0; i < RAM_WORDS; i++) writeWord(romB, i, rom[i] | 0, WORD_BITS, [], 'rom');
  const m = {
    kind: 'weight', T, rom, romB,
    regs: new T(8 * WORD_BITS),
    ramB: new T(RAM_WORDS * WORD_BITS),
    ssdB: new T(SSD_TOTAL * WORD_BITS),
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
    pipeline: !!opts.pipeline,
    ir: 0,
    irValid: false,
    ssdS: { phase: 'idle', page: 0, base: 0, write: 0, i: 0 },
    gpuS: { phase: 'idle', shader: 0, a: 0, b: 0, dest: 0, i: 0, hold: null, holdBits: null },
    tpuS: { phase: 'idle', a: 0, b: 0, c: 0, t: 0, A: null, B: null, acc: null },
    irqTaken: 0,
    faults: [],
    injected: [],
    fault: opts.fault || null,
  };
  if (opts.ram) {
    const src = opts.ram;
    for (let i = 0; i < RAM_WORDS && i < src.length; i++) writeWord(m.ramB, i, src[i] | 0, WORD_BITS, m.faults, 'preload');
  }
  if (opts.storage) loadStorage(m, opts.storage);
  return m;
}

export function bankInts(bank, words, width = WORD_BITS) {
  const out = [];
  for (let i = 0; i < words; i++) out.push(wordOf(sliceBits(bank, i * width, width)));
  return out;
}

function regBits(m, i) {
  if (i === 0) return zeros(m.T, WORD_BITS);
  return sliceBits(m.regs, i * WORD_BITS, WORD_BITS);
}

function writeReg(m, rd, bits) {
  if (rd !== 0) copyBits(m.regs, rd * WORD_BITS, bits);
  for (let k = 0; k < WORD_BITS; k++) m.regs[k] = 0;
}

function writeRegInt(m, rd, value) {
  if (rd === 0) return;
  const bits = intBits(m.T, value | 0, WORD_BITS);
  writeReg(m, rd, bits);
}

function outstanding(m, src) {
  return m.pkts.some((p) => p.port === 'bus' && p.src === src && (p.status === 'queued' || p.status === 'inflight'));
}

function post(m, req) {
  const p = {
    id: m.nextId++, src: req.src, dst: req.dst, op: req.op, addr: req.addr | 0,
    data: req.data == null ? null : req.data | 0, bits: req.bits || null, len: req.len || 1,
    bytes: req.bytes ? req.bytes.slice() : null, bitRows: req.bitRows || null,
    port: 'bus', aux: req.aux ?? null, reg: req.reg || 0, issue: m.cycle, arrive: null, status: 'queued',
  };
  m.pkts.push(p);
  return p;
}

function postWide(m, req) {
  m.pkts.push({
    id: m.nextId++, src: req.src, dst: req.dst, op: req.op, addr: req.addr | 0,
    data: req.data == null ? null : req.data | 0, bits: null, len: req.len || 1, bytes: null, bitRows: null,
    port: 'wide', aux: req.aux ?? null, reg: 0, issue: m.cycle, arrive: m.cycle, status: 'done',
  });
}

function busBusy(m) {
  return m.pkts.some((p) => p.port === 'bus' && p.status === 'inflight');
}

function signal(m, kind) {
  if (m.wait && m.wait.kind === kind) m.wait.ready = true;
}

function dropThis(m, p) {
  const f = m.fault;
  if (!f || f.kind !== 'drop') return false;
  if (f.dst && p.dst !== f.dst) return false;
  if (f.src && p.src !== f.src) return false;
  return true;
}

function deliver(m) {
  for (const p of m.pkts) {
    if (p.port !== 'bus' || p.status !== 'inflight' || p.arrive !== m.cycle) continue;
    if (dropThis(m, p)) {
      p.status = 'drop';
      m.injected.push({ cycle: m.cycle, kind: 'drop', id: p.id, dst: p.dst });
      if (m.wait && m.wait.kind === 'packet' && m.wait.id === p.id) {
        m.wait.ready = true;
        m.wait.data = 0;
        m.wait.bits = zeros(m.T, WORD_BITS);
      }
      if (p.src === 'ssd' && p.aux && p.aux.role) ssdAdvance(m, p.aux.i);
      continue;
    }
    p.status = 'done';
    if (p.op === 'read' && p.dst === 'ram') {
      if (p.len > 1) {
        const bytes = [];
        const rows = [];
        for (let i = 0; i < p.len; i++) {
          const bits = readWord(m.ramB, (p.addr + i) & 255, WORD_BITS, m.faults, 'burst');
          rows.push(bits);
          bytes.push(wordOf(bits));
        }
        p.bytes = bytes;
        p.bitRows = rows;
      } else {
        p.bits = readWord(m.ramB, p.addr & 255, WORD_BITS, m.faults, 'lw');
        p.data = wordOf(p.bits);
      }
      if (p.src === 'ssd' && p.aux && p.aux.role === 'fill') {
        writePaged(m.ssdB, p.aux.page, p.aux.i, p.bits, SSD_PAGES, SSD_WORDS, WORD_BITS, m.faults, 'ssd-w');
        ssdAdvance(m, p.aux.i);
      }
    } else if (p.op === 'write' && p.dst === 'ram') {
      if (p.len > 1 && (p.bitRows || p.bytes)) {
        for (let i = 0; i < p.len; i++) {
          const bits = p.bitRows ? p.bitRows[i] : intBits(m.T, p.bytes[i] | 0, WORD_BITS);
          writeWord(m.ramB, (p.addr + i) & 255, bits, WORD_BITS, m.faults, 'swb');
        }
      } else {
        const bits = p.bits || intBits(m.T, p.data | 0, WORD_BITS);
        writeWord(m.ramB, p.addr & 255, bits, WORD_BITS, m.faults, 'sw');
      }
      if (p.src === 'ssd' && p.aux && p.aux.role === 'spill') ssdAdvance(m, p.aux.i);
    } else if (p.op === 'write' && p.dst === 'console') {
      m.console += String.fromCharCode(p.data & 255);
    } else if (p.op === 'write' && p.dst === 'fb') {
      const bytes = p.bytes || [];
      for (let i = 0; i < bytes.length; i++) m.fb[(p.addr + i) % FB_PIXELS] = bytes[i] & 255;
    } else if (p.op === 'read' && p.dst === 'ssd') {
      p.data = m.ssdS.phase === 'idle' ? 0 : (SSD_WORDS - m.ssdS.i) | 0;
      p.bits = intBits(m.T, p.data, WORD_BITS);
    } else if (p.op === 'read' && (p.dst === 'gpu' || p.dst === 'tpu')) {
      const unit = p.dst === 'gpu' ? m.gpuS : m.tpuS;
      p.data = unit.phase === 'idle' ? 0 : 1;
      p.bits = intBits(m.T, p.data, WORD_BITS);
    } else if (p.op === 'cmd' && p.dst === 'ssd') {
      m.ssdS = { phase: 'xfer', page: p.addr & (SSD_PAGES - 1), base: p.aux.base & 255, write: p.aux.write ? 1 : 0, i: 0 };
    } else if (p.op === 'cmd' && p.dst === 'gpu') {
      m.gpuS = { phase: 'run', shader: p.aux.shader | 0, a: p.aux.a | 0, b: p.aux.b | 0, dest: p.aux.dest | 0, i: 0, hold: null, holdBits: null };
    } else if (p.op === 'cmd' && p.dst === 'tpu') {
      m.tpuS = { phase: 'load', a: p.aux.a | 0, b: p.aux.b | 0, c: p.aux.c | 0, t: 0, A: null, B: null, acc: null };
    }
    if (m.wait && m.wait.kind === 'packet' && m.wait.id === p.id) {
      m.wait.ready = true;
      m.wait.data = p.data | 0;
      m.wait.bits = p.bits || intBits(m.T, p.data | 0, WORD_BITS);
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
  if (s.phase === 'xfer' && !outstanding(m, 'ssd')) {
    if (s.i >= SSD_WORDS) { s.phase = 'idle'; m.irq = 1; }
    else if (s.write) post(m, { src: 'ssd', dst: 'ram', op: 'read', addr: (s.base + s.i) & 255, aux: { role: 'fill', page: s.page, i: s.i } });
    else {
      const bits = readPaged(m.ssdB, s.page, s.i, SSD_PAGES, SSD_WORDS, WORD_BITS, m.faults, 'ssd-r');
      post(m, { src: 'ssd', dst: 'ram', op: 'write', addr: (s.base + s.i) & 255, data: wordOf(bits), bits, aux: { role: 'spill', page: s.page, i: s.i } });
    }
  }
  tickGpu(m);
  tickTpu(m);
}

function pixelColor(m, i) {
  if (i < 0 || i >= FB_PIXELS) return 0;
  const x = i % 32;
  const y = (i / 32) | 0;
  const xb = intBits(m.T, x, 5);
  const yb = intBits(m.T, y, 5);
  const bit = checkBit(xor2(xb[0], yb[0]), m.faults, 'pix');
  const color = bit === 1 ? 0xe2 : 0x14;
  if (color !== patternPixel(i)) m.faults.push('pix-mismatch');
  return color;
}

function tickGpu(m) {
  const g = m.gpuS;
  if (g.phase !== 'run' || outstanding(m, 'gpu')) return;
  if (g.shader === 1) {
    if (g.i >= FB_PIXELS) { g.phase = 'idle'; signal(m, 'gpu'); return; }
    const bytes = [];
    for (let lane = 0; lane < LANES; lane++) bytes.push(pixelColor(m, g.i + lane));
    post(m, { src: 'gpu', dst: 'fb', op: 'write', addr: g.i, bytes, len: LANES, data: bytes[0] });
    g.i += LANES;
    return;
  }
  if (g.hold == null) {
    const hold = [];
    const holdBits = [];
    let firstA = 0;
    for (let i = 0; i < LANES; i++) {
      const ab = readWord(m.ramB, (g.a + i) & 255, WORD_BITS, m.faults, 'laneA');
      const bb = readWord(m.ramB, (g.b + i) & 255, WORD_BITS, m.faults, 'laneB');
      if (i === 0) firstA = wordOf(ab);
      const sum = addBits(ab, bb, 0, WORD_BITS, m.faults, 'lane').out;
      holdBits.push(sum);
      hold.push(wordOf(sum));
    }
    g.hold = hold;
    g.holdBits = holdBits;
    postWide(m, { src: 'gpu', dst: 'ram', op: 'read', addr: g.a, len: LANES * 2, data: firstA, aux: 'wide-port' });
  }
  post(m, { src: 'gpu', dst: 'ram', op: 'write', addr: g.dest & 255, bytes: g.hold, bitRows: g.holdBits, len: LANES, data: g.hold[0] });
  g.phase = 'drain';
}

function tickGpuDrain(m) {
  const g = m.gpuS;
  if (g.phase === 'drain' && !outstanding(m, 'gpu')) { g.phase = 'idle'; g.hold = null; g.holdBits = null; signal(m, 'gpu'); }
}

function cellBits(m, acc, r, c) {
  const n = TPU_N;
  if (!acc[r * n + c]) acc[r * n + c] = zeros(m.T, WORD_BITS);
  return acc[r * n + c];
}

function tickTpu(m) {
  const t = m.tpuS;
  if (t.phase === 'idle') return;
  const n = TPU_N;
  if (t.phase === 'load') {
    t.A = [];
    t.B = [];
    t.acc = new Array(n * n);
    for (let i = 0; i < n * n; i++) {
      t.A.push(wordOf(readWord(m.ramB, (t.a + i) & 255, WORD_BITS, m.faults, 'tpuA')));
      t.B.push(wordOf(readWord(m.ramB, (t.b + i) & 255, WORD_BITS, m.faults, 'tpuB')));
      t.acc[i] = zeros(m.T, WORD_BITS);
    }
    postWide(m, { src: 'tpu', dst: 'ram', op: 'read', addr: t.a, len: n * n * 2, data: t.A[0], aux: 'wide-port' });
    t.t = 0;
    t.phase = 'mac';
    return;
  }
  if (t.phase === 'mac') {
    const stuck = m.fault && m.fault.kind === 'tpu-stuck' ? m.fault : null;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const k = t.t - r - c;
      if (k < 0 || k >= n) continue;
      const aBits = intBits(m.T, t.A[r * n + k] & 255, 8);
      const bBits = intBits(m.T, t.B[k * n + c] & 255, 8);
      const prod = mul8signedBits(aBits, bBits, m.faults, 'mac');
      let acc = addBits(cellBits(m, t.acc, r, c), prod, 0, WORD_BITS, m.faults, 'acc').out;
      if (stuck && stuck.r === r && stuck.c === c) {
        acc = sliceBits(acc, 0, WORD_BITS);
        acc[stuck.bit & 31] = stuck.value ? 1 : 0;
        if (!m.injected.some((e) => e.kind === 'tpu-stuck' && e.t === t.t)) m.injected.push({ cycle: m.cycle, kind: 'tpu-stuck', r, c, t: t.t });
      }
      t.acc[r * n + c] = acc;
    }
    t.t++;
    if (t.t >= macCycles(n)) t.phase = 'store';
    return;
  }
  if (t.phase === 'store') {
    let first = 0;
    for (let i = 0; i < n * n; i++) {
      let bits = t.acc[i];
      if (m.fault && m.fault.kind === 'tpu-relu') bits = reluBits(bits, m.faults, 'relu');
      writeWord(m.ramB, (t.c + i) & 255, bits, WORD_BITS, m.faults, 'tpu-s');
      if (i === 0) first = wordOf(bits);
    }
    postWide(m, { src: 'tpu', dst: 'ram', op: 'write', addr: t.c, len: n * n, data: first, aux: 'wide-port' });
    t.phase = 'idle';
    signal(m, 'tpu');
  }
}

function romAt(m, pc) {
  const bits = readWord(m.romB, pc & 255, WORD_BITS, m.faults, 'fetch');
  const w = wordOf(bits) >>> 0;
  if (w !== (m.rom[pc & 255] >>> 0)) m.faults.push('fetch-mismatch');
  return w;
}

function prefetch(m, pc) {
  m.ir = romAt(m, pc);
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
  const word = m.pipeline ? m.ir : romAt(m, pc);
  const d = dec(word >>> 0);
  const aBits = regBits(m, d.rs1);
  const bBits = regBits(m, d.rs2);
  const a = wordOf(aBits) | 0;
  const b = wordOf(bBits) | 0;
  const forge = isForgeOp(d.op, d.funct);
  const sys = d.op === OP_SYS && d.funct <= F.IRET;
  if (!forge && !sys) { m.fail = 'illegal'; m.irValid = false; return; }
  if (d.op === OP.HALT && d.funct === FUNCT_HALT) {
    m.halted = true;
    m.result = wordOf(regBits(m, d.rd)) | 0;
    m.irValid = false;
    return;
  }
  let next = (pc + 1) & 255;
  let branch = false;
  const T = m.T;
  if (d.op === OP.ADD) writeReg(m, d.rd, addBits(aBits, bBits, 0, WORD_BITS, m.faults, 'add').out);
  else if (d.op === OP.SUB) {
    const nb = new T(WORD_BITS);
    for (let k = 0; k < WORD_BITS; k++) nb[k] = not(bBits[k]);
    writeReg(m, d.rd, addBits(aBits, nb, 1, WORD_BITS, m.faults, 'sub').out);
  } else if (d.op === OP.AND || d.op === OP.OR || d.op === OP.XOR) {
    const out = new T(WORD_BITS);
    for (let k = 0; k < WORD_BITS; k++) {
      const ab = and2(aBits[k], bBits[k]);
      if (d.op === OP.AND) out[k] = checkBit(ab, m.faults, 'and');
      else if (d.op === OP.OR) out[k] = checkBit(aBits[k] + bBits[k] - ab, m.faults, 'or');
      else out[k] = checkBit(aBits[k] + bBits[k] - 2 * ab, m.faults, 'xor');
    }
    writeReg(m, d.rd, out);
  } else if (d.op === OP.ADDI) writeReg(m, d.rd, addBits(aBits, intBits(T, d.simm, WORD_BITS), 0, WORD_BITS, m.faults, 'addi').out);
  else if (d.op === OP.LUI) {
    const lui = zeros(T, WORD_BITS);
    const ins = intBits(T, word >>> 0, WORD_BITS);
    for (let k = 16; k < 32; k++) lui[k] = ins[k];
    writeReg(m, d.rd, lui);
  } else if (d.op === OP.SLT) {
    const w = zeros(T, WORD_BITS);
    w[0] = sltBit(aBits, bBits, m.faults);
    writeReg(m, d.rd, w);
  } else if (d.op === OP.BEQ || d.op === OP.BNE || d.op === OP.BLT) {
    const eq = eqAll(aBits, bBits, m.faults);
    const lt = d.op === OP.BLT ? sltBit(aBits, bBits, m.faults) : 0;
    const take = d.op === OP.BEQ ? eq === 1 : d.op === OP.BNE ? eq === 0 : lt === 1;
    if (take) { next = (pc + d.simm) & 255; branch = true; }
  } else if (d.op === OP.JAL) {
    writeRegInt(m, d.rd, next);
    next = (pc + d.simm) & 255;
    branch = true;
  } else if (d.op === OP.LW) {
    const addrBits = addBits(aBits, intBits(T, d.simm, WORD_BITS), 0, 8, m.faults, 'addr').out;
    const addr = bitsToUintSafe(addrBits);
    const p = post(m, { src: 'cpu', dst: 'ram', op: 'read', addr, reg: d.rd });
    m.wait = { kind: 'packet', id: p.id, reg: d.rd, ready: false, data: 0, bits: null };
    m.pc = next; m.irValid = false; return;
  } else if (d.op === OP.SW) {
    const addrBits = addBits(aBits, intBits(T, d.simm, WORD_BITS), 0, 8, m.faults, 'addr').out;
    const addr = bitsToUintSafe(addrBits);
    const p = post(m, { src: 'cpu', dst: 'ram', op: 'write', addr, data: b, bits: sliceBits(bBits, 0, WORD_BITS) });
    m.wait = { kind: 'packet', id: p.id, reg: 0, ready: false, data: 0, bits: null };
    m.pc = next; m.irValid = false; return;
  } else if (d.op === OP_SYS && d.funct === F.OUT) {
    const p = post(m, { src: 'cpu', dst: 'console', op: 'write', addr: 0, data: a & 255, bits: sliceBits(aBits, 0, WORD_BITS) });
    m.wait = { kind: 'packet', id: p.id, reg: 0, ready: false, data: 0, bits: null };
    m.pc = next; m.irValid = false; return;
  } else if (d.op === OP_SYS && d.funct === F.DLD) {
    const dst = devName(d.imm & 255);
    const p = post(m, { src: 'cpu', dst, op: 'read', addr: 0, reg: d.rd });
    m.wait = { kind: 'packet', id: p.id, reg: d.rd, ready: false, data: 0, bits: null };
    m.pc = next; m.irValid = false; return;
  } else if (d.op === OP_SYS && d.funct === F.SSD) {
    post(m, { src: 'cpu', dst: 'ssd', op: 'cmd', addr: a & 255, data: 0, aux: { base: b & 255, write: d.imm & 1 } });
    m.pc = next;
  } else if (d.op === OP_SYS && d.funct === F.GPU) {
    post(m, { src: 'cpu', dst: 'gpu', op: 'cmd', addr: 0, data: d.rd, aux: { shader: d.rd, a, b, dest: d.imm & 255 } });
    m.wait = { kind: 'gpu', id: 0, reg: 0, ready: false, data: 0, bits: null };
    m.pc = next; m.irValid = false; return;
  } else if (d.op === OP_SYS && d.funct === F.TPU) {
    post(m, { src: 'cpu', dst: 'tpu', op: 'cmd', addr: d.imm & 255, data: 0, aux: { a: a & 255, b: b & 255, c: d.imm & 255 } });
    m.wait = { kind: 'tpu', id: 0, reg: 0, ready: false, data: 0, bits: null };
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
  for (let k = 0; k < WORD_BITS; k++) m.regs[k] = 0;
  m.pc = next;
  if (m.pipeline) {
    if (branch) m.irValid = false;
    else prefetch(m, next);
  }
}

function bitsToUintSafe(bits) {
  let u = 0;
  for (let k = 0; k < bits.length; k++) if (bits[k] === 1) u += 2 ** k;
  return u;
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
  const req = new m.T(MASTERS.length);
  for (let k = 0; k < MASTERS.length; k++) {
    req[k] = m.pkts.some((p) => p.port === 'bus' && p.status === 'queued' && p.src === MASTERS[k]) ? 1 : 0;
  }
  const g = grantBits(req, m.rr, m.faults);
  if (g.index < 0) return;
  const src = MASTERS[g.index];
  const pkt = m.pkts.find((p) => p.port === 'bus' && p.status === 'queued' && p.src === src);
  pkt.status = 'inflight';
  pkt.arrive = m.cycle + BUS_LAT;
  m.rr = (g.index + 1) % MASTERS.length;
}

function applyRamRot(m) {
  const f = m.fault;
  if (!f || f.kind !== 'ram-bit' || f.done) return;
  if ((f.atCycle | 0) !== m.cycle) return;
  const i = (f.word | 0) * WORD_BITS + (f.bit & 31);
  m.ramB[i] = m.ramB[i] ? 0 : 1;
  f.done = true;
  m.injected.push({ cycle: m.cycle, kind: 'ram-bit', word: f.word | 0, bit: f.bit & 31 });
}

export function stepWeight(m) {
  if (m.halted || m.fail) return m;
  m.cycle++;
  applyRamRot(m);
  deliver(m);
  deviceTick(m);
  tickGpuDrain(m);
  let skip = false;
  if (m.wait && m.wait.ready) {
    if (m.wait.reg) writeReg(m, m.wait.reg, m.wait.bits || intBits(m.T, m.wait.data | 0, WORD_BITS));
    for (let k = 0; k < WORD_BITS; k++) m.regs[k] = 0;
    m.wait = null;
    skip = true;
  } else if (m.wait) skip = true;
  else if (m.irq && m.ei && !m.inHandler) { takeIrq(m); skip = true; }
  else if (m.pipeline && !m.irValid) { prefetch(m, m.pc); skip = true; }
  if (!skip) execute(m);
  arbitrate(m);
  return m;
}

export function runWeight(m, limit = STEP_LIMIT) {
  while (!m.halted && !m.fail && m.cycle < limit) stepWeight(m);
  if (!m.halted && !m.fail) m.fail = 'step-limit';
  return m;
}

export function archWeight(m) {
  const regs = bankInts(m.regs, 8);
  return {
    cycle: m.cycle,
    pc: m.pc & 255,
    regs,
    ram: bankInts(m.ramB, RAM_WORDS),
    ssd: bankInts(m.ssdB, SSD_TOTAL),
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

function packBits(bank) {
  let hex = '';
  for (let i = 0; i < bank.length; i += 4) {
    let n = 0;
    for (let k = 0; k < 4 && i + k < bank.length; k++) n |= (bank[i + k] ? 1 : 0) << k;
    hex += n.toString(16);
  }
  return hex;
}

function unpackBits(hex, T, n) {
  const bank = new T(n);
  for (let i = 0; i < n; i++) {
    const nib = parseInt(hex[i >> 2], 16);
    bank[i] = (nib >> (i & 3)) & 1;
  }
  return bank;
}

export function saveStorage(m) {
  const words = bankInts(m.ssdB, SSD_TOTAL);
  const bits = packBits(m.ssdB);
  return {
    format: 'neuralese-wm-ssd-v1',
    pages: SSD_PAGES,
    pageWords: SSD_WORDS,
    words,
    bits,
    note: 'bits are the float32 page bank, packed 4 per hex digit, low bit first. words are the decoded int32 image and must match.',
  };
}

export function loadStorage(m, file) {
  if (!file || file.format !== 'neuralese-wm-ssd-v1') throw new Error('ssd file format');
  if (typeof file.bits !== 'string' || file.bits.length !== Math.ceil((SSD_TOTAL * WORD_BITS) / 4)) throw new Error('ssd bit length');
  const bank = unpackBits(file.bits, m.T, SSD_TOTAL * WORD_BITS);
  const words = bankInts(bank, SSD_TOTAL);
  if (!Array.isArray(file.words) || file.words.length !== SSD_TOTAL) throw new Error('ssd file length');
  for (let i = 0; i < SSD_TOTAL; i++) if ((file.words[i] | 0) !== words[i]) throw new Error('ssd bits do not decode to words at ' + i);
  m.ssdB = bank;
}

export function matmulBits(A, B, n = TPU_N, bias = null, ArrayType = Float32Array) {
  const faults = [];
  const acc = new Array(n * n);
  for (let i = 0; i < n * n; i++) {
    const c = i % n;
    acc[i] = bias ? intBits(ArrayType, bias[c] | 0, WORD_BITS) : zeros(ArrayType, WORD_BITS);
  }
  const cycles = macCycles(n);
  const trace = [];
  for (let t = 0; t < cycles; t++) {
    let active = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const k = t - r - c;
      if (k < 0 || k >= n) continue;
      active++;
      const prod = mul8signedBits(intBits(ArrayType, A[r * n + k] & 255, 8), intBits(ArrayType, B[k * n + c] & 255, 8), faults, 'm');
      acc[r * n + c] = addBits(acc[r * n + c], prod, 0, WORD_BITS, faults, 'a').out;
    }
    trace.push(active);
  }
  const out = acc.map((bits) => wordOf(bits));
  return { acc: out, bits: acc, cycles, trace, faults };
}

export function reluWord(bits, faults = []) {
  return wordOf(reluBits(bits, faults, 'relu'));
}

export { deltaWrite, attentionRead };

// Demo programs for WM-ISA. They are assembled here, not borrowed from another machine.
// Branch offsets are from the current PC, matching ForgeISA.

import { enc } from '../forge/isa.js';
import { F, FUNCT_HALT, IRQ_VECTOR, OP, OP_SYS, RAM_WORDS } from './isa.js';

const op = (emit) => ({ emit });
const at = (label, item) => ({ label, emit: item.emit });
const addi = (rd, rs, imm) => op(() => enc(OP.ADDI, rd, rs, 0, imm));
const add = (rd, rs1, rs2) => op(() => enc(OP.ADD, rd, rs1, rs2, 0));
const halt = (rd) => op(() => enc(OP.HALT, rd, 0, 0, 0, FUNCT_HALT));
const beq = (rs1, rs2, label) => op((pc, L) => enc(OP.BEQ, 0, rs1, rs2, L[label] - pc));
const bne = (rs1, rs2, label) => op((pc, L) => enc(OP.BNE, 0, rs1, rs2, L[label] - pc));
const sw = (rs2, imm, rs1) => op(() => enc(OP.SW, 0, rs1, rs2, imm));
const lw = (rd, imm, rs1) => op(() => enc(OP.LW, rd, rs1, 0, imm));
const out = (rs) => op(() => enc(OP_SYS, 0, rs, 0, 0, F.OUT));
const dld = (rd, dev) => op(() => enc(OP_SYS, rd, 0, 0, dev, F.DLD));
const ssd = (page, base, write) => op(() => enc(OP_SYS, 0, page, base, write ? 1 : 0, F.SSD));
const gpu = (shader, rs1, rs2, dest) => op(() => enc(OP_SYS, shader, rs1, rs2, dest, F.GPU));
const tpu = (a, b, c) => op(() => enc(OP_SYS, 0, a, b, c, F.TPU));
const ei = (flag) => op(() => enc(OP_SYS, 0, 0, 0, flag ? 1 : 0, F.EI));
const iret = () => op(() => enc(OP_SYS, 0, 0, 0, 0, F.IRET));

function emit(items) {
  const labels = {};
  items.forEach((it, i) => { if (it.label) labels[it.label] = i; });
  return items.map((it, i) => it.emit(i, labels) >>> 0);
}

function pad(words, into) {
  const rom = into ? into.slice() : new Array(RAM_WORDS).fill(0);
  if (!into) rom.fill(0);
  for (let i = 0; i < words.length && i < RAM_WORDS; i++) rom[i] = words[i] >>> 0;
  return rom;
}

export const SIGNATURE = 4242;
export const HELLO = 'hello world\n';
export const STORE_PAGE = 2;

function hello() {
  const items = [];
  for (const ch of HELLO) {
    items.push(addi(1, 0, ch.charCodeAt(0)));
    items.push(out(1));
  }
  items.push(halt(0));
  return pad(emit(items));
}

function memtest() {
  return pad(emit([
    addi(5, 0, 32),
    addi(1, 0, 0),
    at('w', addi(3, 0, 1)),
    add(3, 3, 1),
    add(3, 3, 1),
    add(3, 3, 1),
    sw(3, 0, 1),
    addi(1, 1, 1),
    bne(1, 5, 'w'),
    addi(1, 0, 0),
    at('r', addi(3, 0, 1)),
    add(3, 3, 1),
    add(3, 3, 1),
    add(3, 3, 1),
    lw(4, 0, 1),
    bne(4, 3, 'bad'),
    addi(1, 1, 1),
    bne(1, 5, 'r'),
    addi(1, 0, 1),
    halt(1),
    at('bad', addi(1, 0, 0)),
    halt(1),
  ]));
}

function gpuPattern() {
  return pad(emit([gpu(1, 0, 0, 0), halt(0)]));
}

function gpuVec() {
  return pad(emit([
    addi(1, 0, 0),
    addi(2, 0, 16),
    gpu(0, 1, 2, 32),
    halt(0),
  ]));
}

function tpuDemo() {
  return pad(emit([
    addi(1, 0, 0),
    addi(2, 0, 64),
    tpu(1, 2, 128),
    lw(3, 128, 0),
    halt(3),
  ]));
}

function storageWrite() {
  return pad(emit([
    addi(1, 0, SIGNATURE),
    sw(1, 4, 0),
    addi(4, 0, STORE_PAGE),
    addi(5, 0, 0),
    ssd(4, 5, 1),
    at('poll', dld(6, 1)),
    bne(6, 0, 'poll'),
    addi(1, 0, 83),
    out(1),
    lw(3, 4, 0),
    halt(3),
  ]));
}

function storageRead() {
  return pad(emit([
    addi(4, 0, STORE_PAGE),
    addi(5, 0, 0),
    ssd(4, 5, 0),
    at('poll', dld(6, 1)),
    bne(6, 0, 'poll'),
    lw(3, 4, 0),
    halt(3),
  ]));
}

function multi() {
  return pad(emit([
    addi(1, 0, 7),
    addi(2, 0, 6),
    add(3, 1, 2),
    sw(3, 4, 0),
    addi(4, 0, 1),
    addi(5, 0, 0),
    ssd(4, 5, 1),
    at('poll', dld(6, 1)),
    bne(6, 0, 'poll'),
    addi(1, 0, 77),
    out(1),
    halt(3),
  ]));
}

function irq() {
  const rom = new Array(RAM_WORDS).fill(0);
  const body = emit([
    addi(1, 0, 2),
    addi(2, 0, 0),
    ssd(1, 2, 1),
    ei(1),
    at('loop', addi(3, 0, 7)),
    beq(4, 3, 'done'),
    beq(0, 0, 'loop'),
    at('done', halt(4)),
  ]);
  body.forEach((w, i) => { rom[i] = w; });
  const handler = emit([addi(4, 0, 7), iret()]);
  handler.forEach((w, i) => { rom[IRQ_VECTOR + i] = w; });
  return rom;
}

function rotProbe() {
  return pad(emit([
    addi(1, 0, 7),
    sw(1, 3, 0),
    lw(2, 3, 0),
    halt(2),
  ]));
}

export const PROGRAMS = Object.freeze({
  hello: Object.freeze({ id: 'hello', title: 'Hello world', blurb: 'The CPU writes each byte of "hello world" to the console.', rom: hello, expect: { console: HELLO, result: 0 } }),
  memtest: Object.freeze({ id: 'memtest', title: 'Memory test', blurb: 'Write 3·i+1 into 32 RAM words and read them back. Halt 1 if they match.', rom: memtest, expect: { result: 1 } }),
  'gpu-pattern': Object.freeze({ id: 'gpu-pattern', title: 'GPU pattern', blurb: '16 lanes fill the 32×32 framebuffer with a checker from x xor y.', rom: gpuPattern, expect: { result: 0 } }),
  'gpu-vec': Object.freeze({ id: 'gpu-vec', title: 'GPU vector add', blurb: '16 lanes add RAM[0..15] to RAM[16..31] and store RAM[32..47].', rom: gpuVec, expect: { result: 0 } }),
  tpu: Object.freeze({ id: 'tpu', title: 'TPU 8×8', blurb: 'Identity times identity. The CPU halts with C[0], which is 1.', rom: tpuDemo, expect: { result: 1 } }),
  'storage-write': Object.freeze({ id: 'storage-write', title: 'Storage write', blurb: 'Store 4242 in RAM, copy the page to the SSD, print S.', rom: storageWrite, expect: { result: SIGNATURE, console: 'S' } }),
  'storage-read': Object.freeze({ id: 'storage-read', title: 'Storage read', blurb: 'After a reboot, copy the saved page back and halt with 4242.', rom: storageRead, expect: { result: SIGNATURE } }),
  multi: Object.freeze({ id: 'multi', title: 'Bus program', blurb: 'Add 7+6, store it, copy the page to the SSD, print M, halt 13.', rom: multi, expect: { result: 13, console: 'M' } }),
  irq: Object.freeze({ id: 'irq', title: 'SSD interrupt', blurb: 'Start a page write, enable IRQ, spin, and halt 7 from the handler.', rom: irq, expect: { result: 7 } }),
  'rot-probe': Object.freeze({ id: 'rot-probe', title: 'RAM probe', blurb: 'Store 7 and load it. A bit rot between the two changes the halt value.', rom: rotProbe, expect: { result: 7 } }),
});

export function programIds() { return Object.keys(PROGRAMS); }

export function programRom(id) {
  const p = PROGRAMS[id];
  if (!p) throw new Error('no program ' + id);
  return p.rom().slice();
}

export function identityRam() {
  const ram = new Array(RAM_WORDS).fill(0);
  for (let i = 0; i < 8; i++) {
    ram[i * 8 + i] = 1;
    ram[64 + i * 8 + i] = 1;
  }
  return ram;
}

export function vecRam(a, b) {
  const ram = new Array(RAM_WORDS).fill(0);
  for (let i = 0; i < 16; i++) {
    ram[i] = a[i] | 0;
    ram[16 + i] = b[i] | 0;
  }
  return ram;
}

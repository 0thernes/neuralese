// Weight-constructed Forge engine. One step is one clock: fetch, decode, ALU, writeback.
// State lives in an isolated bit bank (Float32 or Float64). It is not concatenated onto a host residual.
// Gadgets are the functions in bits.js. A fault is recorded if any bit leaves {0, 1}.

import { FUNCT_HALT, OP, OP_NAME, ROM_WORDS, STEP_LIMIT, WORD_BITS, padRom } from './isa.js';
import { addBits, bitsToInt32, bitsToUint, checkBit, mux, muxBank, not, oneHot, or2, orN, sltBit, writeBank, writeBits, xor2 } from './bits.js';

export const PRECISION = Object.freeze({
  shipped: 'float32',
  reference: 'int32',
  crosscheck: 'float64-gadgets',
  bf16: 'not-run',
  hostResidual: 'not-mixed',
  note: 'Forge gadgets use only {0,1} and sums of those bits. float32 represents every integer through 2^24 exactly, and these intermediates are 0 or 1. The test suite compares this trace to the int32 VM. bf16 was not executed, so bf16 bit-exactness is not claimed. TinyStories residual dimensions are not the carrier.',
});

export const SUBSPACE = Object.freeze({
  name: 'forge-engine-subspace',
  width: 64,
  hostResidual: 'not-mixed',
  layout: Object.freeze({ tokenKind: [0, 8], opcode: [8, 24], valueBits: [24, 56], pc: [56, 64] }),
});

function sliceBits(src, lo, n) {
  const out = new src.constructor(n);
  for (let i = 0; i < n; i++) out[i] = src[lo + i];
  return out;
}

function eqBit(a, b, faults) {
  let m = 1;
  for (let k = 0; k < a.length; k++) m = (m + not(xor2(a[k], b[k])) - 1) > 0 ? (m + not(xor2(a[k], b[k])) - 1) : 0;
  return checkBit(m, faults, 'eq');
}

export class ForgeEngine {
  constructor(words, ArrayType = Float32Array) {
    this.ArrayType = ArrayType;
    this.kind = ArrayType === Float32Array ? 'f32' : ArrayType === Float64Array ? 'f64' : 'other';
    const T = ArrayType;
    this.rom = new T(ROM_WORDS * WORD_BITS);
    this.ram = new T(ROM_WORDS * WORD_BITS);
    this.regs = new T(8 * WORD_BITS);
    this.pc = new T(8);
    this.faults = [];
    this.halted = false;
    this.fail = null;
    this.result = null;
    const rom = padRom(words);
    for (let i = 0; i < ROM_WORDS; i++) writeBits(this.rom, i * WORD_BITS, rom[i] >>> 0, WORD_BITS);
  }

  ints(bank) {
    const out = [];
    for (let i = 0; i < 8; i++) out.push(bitsToInt32(sliceBits(this.regs, i * WORD_BITS, WORD_BITS)));
    return out;
  }

  ramInts() {
    const out = [];
    for (let i = 0; i < ROM_WORDS; i++) out.push(bitsToInt32(sliceBits(this.ram, i * WORD_BITS, WORD_BITS)));
    return out;
  }

  step() {
    const faults = this.faults;
    const T = this.ArrayType;
    if (this.halted || this.fail) {
      return { pc: bitsToUint(this.pc, 8), op: 0, name: 'HALT', rd: 0, result: this.result | 0, halted: true, fail: this.fail, mem: null, regs: this.ints(), ram: this.ramInts() };
    }
    const pcBits = this.pc.slice();
    const pc = bitsToUint(pcBits, 8);
    const pcOh = oneHot(pcBits, 8, faults, 'pc');
    const ins = muxBank(pcOh, this.rom, WORD_BITS, faults, 'fetch');
    const opBits = sliceBits(ins, 0, 4);
    const rdBits = sliceBits(ins, 4, 3);
    const rs1Bits = sliceBits(ins, 7, 3);
    const rs2Bits = sliceBits(ins, 10, 3);
    const functBits = sliceBits(ins, 13, 3);
    const opOh = oneHot(opBits, 4, faults, 'op');
    const rdOh = oneHot(rdBits, 3, faults, 'rd');
    const rs1 = muxBank(oneHot(rs1Bits, 3, faults, 'rs1'), this.regs, WORD_BITS, faults, 'read1');
    const rs2 = muxBank(oneHot(rs2Bits, 3, faults, 'rs2'), this.regs, WORD_BITS, faults, 'read2');
    const functOh = oneHot(functBits, 3, faults, 'funct');
    const isHalt = checkBit((opOh[OP.HALT] + functOh[FUNCT_HALT] - 1) > 0 ? (opOh[OP.HALT] + functOh[FUNCT_HALT] - 1) : 0, faults, 'halt');
    const opKnown = orN(Array.from({ length: 14 }, (_, i) => opOh[i + 1]));
    const isOp = checkBit((functOh[0] + opKnown - 1) > 0 ? (functOh[0] + opKnown - 1) : 0, faults, 'isop');
    const isIll = not(or2(isHalt, isOp));
    checkBit(isIll, faults, 'ill');

    const imm = new T(WORD_BITS);
    for (let k = 0; k < 16; k++) imm[k] = ins[16 + k];
    for (let k = 16; k < 32; k++) imm[k] = ins[31];
    const lui = new T(WORD_BITS);
    for (let k = 0; k < 16; k++) lui[k] = 0;
    for (let k = 16; k < 32; k++) lui[k] = ins[k];

    const add = addBits(rs1, rs2, 0, WORD_BITS, faults, 'add').out;
    const sub = addBits(rs1, rs2.map((bit) => not(bit)), 1, WORD_BITS, faults, 'sub').out;
    const andW = new T(WORD_BITS), orW = new T(WORD_BITS), xorW = new T(WORD_BITS);
    for (let k = 0; k < WORD_BITS; k++) {
      const ab = (rs1[k] + rs2[k] - 1) > 0 ? (rs1[k] + rs2[k] - 1) : 0;
      andW[k] = checkBit(ab, faults, 'and');
      orW[k] = checkBit(rs1[k] + rs2[k] - ab, faults, 'or');
      xorW[k] = checkBit(rs1[k] + rs2[k] - 2 * ab, faults, 'xor');
    }
    const addi = addBits(rs1, imm, 0, WORD_BITS, faults, 'addi').out;
    const addr = addBits(rs1, imm, 0, 8, faults, 'addr').out;
    const addrOh = oneHot(addr, 8, faults, 'addrh');
    const loaded = muxBank(addrOh, this.ram, WORD_BITS, faults, 'load');
    const one = new T(8); one[0] = 1;
    const seq = addBits(pcBits, one, 0, 8, faults, 'seq').out;
    const tgt = addBits(pcBits, sliceBits(imm, 0, 8), 0, 8, faults, 'tgt').out;
    const eq = eqBit(rs1, rs2, faults);
    const slt = sltBit(rs1, rs2, faults);
    const takeBranch = or2(or2((opOh[OP.BEQ] + eq - 1) > 0 ? (opOh[OP.BEQ] + eq - 1) : 0, (opOh[OP.BNE] + not(eq) - 1) > 0 ? (opOh[OP.BNE] + not(eq) - 1) : 0), (opOh[OP.BLT] + slt - 1) > 0 ? (opOh[OP.BLT] + slt - 1) : 0);
    const take = or2(takeBranch, opOh[OP.JAL]);
    const next = new T(8);
    for (let k = 0; k < 8; k++) next[k] = checkBit(mux(take, tgt[k], seq[k]), faults, 'next');
    const stop = or2(isHalt, isIll);
    for (let k = 0; k < 8; k++) this.pc[k] = checkBit(mux(stop, pcBits[k], next[k]), faults, 'pcw');

    const link = new T(WORD_BITS);
    for (let k = 0; k < 8; k++) link[k] = seq[k];
    const sltWord = new T(WORD_BITS); sltWord[0] = slt;
    const choices = [add, sub, andW, orW, xorW, addi, loaded, lui, link, sltWord];
    const choiceOh = [opOh[OP.ADD], opOh[OP.SUB], opOh[OP.AND], opOh[OP.OR], opOh[OP.XOR], opOh[OP.ADDI], opOh[OP.LW], opOh[OP.LUI], opOh[OP.JAL], opOh[OP.SLT]];
    const resultBits = new T(WORD_BITS);
    for (let k = 0; k < WORD_BITS; k++) {
      let s = 0;
      for (let c = 0; c < choices.length; c++) s += choiceOh[c] * choices[c][k];
      resultBits[k] = checkBit(s, faults, 'alu');
    }
    const writeEn = not(or2(or2(or2(isHalt, isIll), or2(opOh[OP.SW], opOh[OP.BEQ])), or2(opOh[OP.BNE], opOh[OP.BLT])));
    for (let r = 1; r < 8; r++) {
      const row = new T(WORD_BITS);
      for (let k = 0; k < WORD_BITS; k++) row[k] = resultBits[k];
      const selOh = new T(8); selOh[r] = writeEn * rdOh[r];
      writeBank(selOh, this.regs, row, 1, WORD_BITS);
    }
    for (let k = 0; k < WORD_BITS; k++) this.regs[k] = 0;
    const storeEn = checkBit((opOh[OP.SW] + not(isIll) - 1) > 0 ? (opOh[OP.SW] + not(isIll) - 1) : 0, faults, 'sten');
    writeBank(addrOh, this.ram, rs2, storeEn, WORD_BITS);

    const op = bitsToUint(opBits, 4);
    const rd = bitsToUint(rdBits, 3);
    const halted = isHalt === 1;
    const fail = isIll === 1 ? 'illegal' : null;
    let result = 0;
    if (halted) result = bitsToInt32(sliceBits(this.regs, rd * WORD_BITS, WORD_BITS));
    else if (writeEn === 1 && rd !== 0) result = bitsToInt32(resultBits);
    if (storeEn === 1) result = 0;
    if (halted) { this.halted = true; this.result = result; }
    if (fail) this.fail = fail;
    const mem = storeEn === 1 ? { addr: bitsToUint(addr, 8), value: bitsToInt32(rs2) } : null;
    return {
      pc, op, name: fail ? 'ILL' : (OP_NAME[op] || 'ILL'), rd, result: result | 0,
      halted, fail, mem, regs: this.ints(), ram: this.ramInts(),
    };
  }
}

export function runEngine(words, ArrayType = Float32Array, limit = STEP_LIMIT) {
  const eng = new ForgeEngine(words, ArrayType);
  const trace = [];
  while (!eng.halted && !eng.fail && trace.length < limit && eng.faults.length === 0) trace.push(eng.step());
  if (!eng.halted && !eng.fail && eng.faults.length === 0) eng.fail = 'step-limit';
  return {
    trace, regs: eng.ints(), ram: eng.ramInts(), pc: bitsToUint(eng.pc, 8),
    halted: eng.halted, fail: eng.fail, result: eng.result, faults: eng.faults.slice(), kind: eng.kind,
  };
}

export function stampSubspace(step) {
  const x = new Float32Array(SUBSPACE.width);
  const kind = step.kind === 'INS' ? 1 : step.kind === 'VAL' ? 2 : step.kind === 'FAIL' ? 3 : step.kind === 'HALT' ? 4 : step.kind === 'END' ? 5 : step.kind === 'LM' ? 0 : 7;
  x[kind] = 1;
  if (Number.isInteger(step.op)) x[8 + (step.op & 15)] = 1;
  const v = (step.result ?? 0) >>> 0;
  for (let k = 0; k < 32; k++) x[24 + k] = (v >>> k) & 1;
  const pc = (step.pc ?? 0) & 255;
  for (let k = 0; k < 8; k++) x[56 + k] = (pc >>> k) & 1;
  return x;
}

export function residualUntouched(residual, fn) {
  const before = Float32Array.from(residual);
  const out = fn();
  let same = before.length === residual.length;
  for (let i = 0; i < before.length && same; i++) if (before[i] !== residual[i]) same = false;
  return { same, out };
}

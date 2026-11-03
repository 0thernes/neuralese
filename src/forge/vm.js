// Integer reference VM for ForgeISA/1. Ground truth. Words are int32. No float rounding.

import { FUNCT_HALT, FUNCT_OP, OP, STEP_LIMIT, dec, padRom } from './isa.js';

export class VM {
  constructor(words) {
    this.rom = padRom(words);
    this.ram = new Int32Array(256);
    this.x = new Int32Array(8);
    this.pc = 0;
    this.halted = false;
    this.fail = null;
    this.result = null;
  }

  step() {
    if (this.halted || this.fail) return this._row(this.pc, dec(0), 0, null, true);
    const pc = this.pc;
    const d = dec(this.rom[pc]);
    const a = this.x[d.rs1] | 0;
    const b = this.x[d.rs2] | 0;
    let next = (pc + 1) & 255;
    let wrote = null;
    let mem = null;
    let halted = false;
    let fail = null;
    const bad = d.op === OP.HALT ? d.funct !== FUNCT_HALT : d.funct !== FUNCT_OP || d.op < 1 || d.op > OP.SLT;
    if (bad) fail = 'illegal';
    else if (d.op === OP.HALT) { halted = true; next = pc; this.result = this.x[d.rd] | 0; }
    else if (d.op === OP.ADD) wrote = (a + b) | 0;
    else if (d.op === OP.SUB) wrote = (a - b) | 0;
    else if (d.op === OP.AND) wrote = (a & b) | 0;
    else if (d.op === OP.OR) wrote = (a | b) | 0;
    else if (d.op === OP.XOR) wrote = (a ^ b) | 0;
    else if (d.op === OP.ADDI) wrote = (a + d.simm) | 0;
    else if (d.op === OP.LW) wrote = this.ram[(a + d.simm) & 255] | 0;
    else if (d.op === OP.SW) { const addr = (a + d.simm) & 255; this.ram[addr] = b; mem = { addr, value: b | 0 }; }
    else if (d.op === OP.BEQ) { if (a === b) next = (pc + d.simm) & 255; }
    else if (d.op === OP.BNE) { if (a !== b) next = (pc + d.simm) & 255; }
    else if (d.op === OP.BLT) { if (a < b) next = (pc + d.simm) & 255; }
    else if (d.op === OP.LUI) wrote = (d.imm << 16) | 0;
    else if (d.op === OP.JAL) { wrote = next; next = (pc + d.simm) & 255; }
    else if (d.op === OP.SLT) wrote = a < b ? 1 : 0;
    if (wrote !== null && d.rd !== 0 && !fail) this.x[d.rd] = wrote;
    this.x[0] = 0;
    if (fail) this.fail = fail;
    else { this.halted = halted; this.pc = next; }
    const result = halted ? this.result : (wrote !== null && d.rd !== 0 ? (this.x[d.rd] | 0) : 0);
    return {
      pc, op: d.op, name: fail ? 'ILL' : d.name, rd: d.rd, result: result | 0,
      halted, fail, mem, regs: Array.from(this.x), ram: Array.from(this.ram),
    };
  }

  _row(pc, d, result, mem, halted) {
    return { pc, op: d.op, name: d.name, rd: d.rd, result, halted, fail: this.fail, mem, regs: Array.from(this.x), ram: Array.from(this.ram) };
  }
}

export function runVM(words, limit = STEP_LIMIT) {
  const vm = new VM(words);
  const trace = [];
  while (!vm.halted && !vm.fail && trace.length < limit) trace.push(vm.step());
  if (!vm.halted && !vm.fail) vm.fail = 'step-limit';
  return { trace, regs: Array.from(vm.x), ram: Array.from(vm.ram), pc: vm.pc, halted: vm.halted, fail: vm.fail, result: vm.result };
}

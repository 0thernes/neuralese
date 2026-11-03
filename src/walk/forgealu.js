// Lower a ForgeISA arithmetic op to the gate netlist, or say when the op is wiring or memory.
// The integer VM remains the authority. This file checks the netlist against that integer result.
// LW and SW use the address adder and do not expand RAM into gates.

import { OP } from '../forge/isa.js';
import { f32bits } from './bits.js';
import { VM } from '../forge/vm.js';
import { dec } from '../forge/isa.js';
import { addInput, addOutput, constBit, createNet, gate, mulInt, rippleAdd, simulate, windowGates } from './gates.js';

const ALU = new Set(['ADD', 'SUB', 'AND', 'OR', 'XOR', 'ADDI', 'SLT', 'BEQ', 'BNE', 'BLT']);

export function intAlu(name, a, b) {
  a |= 0;
  b |= 0;
  if (name === 'ADD' || name === 'ADDI') return (a + b) | 0;
  if (name === 'SUB') return (a - b) | 0;
  if (name === 'AND') return (a & b) | 0;
  if (name === 'OR') return (a | b) | 0;
  if (name === 'XOR') return (a ^ b) | 0;
  if (name === 'SLT' || name === 'BLT') return a < b ? 1 : 0;
  if (name === 'BEQ') return a === b ? 1 : 0;
  if (name === 'BNE') return a !== b ? 1 : 0;
  if (name === 'LUI') return (b << 16) | 0;
  return null;
}

function notBits(net, bits) {
  return bits.map((id) => gate(net, 'NOT', id));
}

function bitwise(net, op, a, b) {
  return a.map((id, i) => gate(net, op, id, b[i]));
}

function orReduce(net, bits) {
  let a = constBit(net, 0);
  for (const id of bits) a = gate(net, 'OR', a, id);
  return a;
}

function subBits(net, a, b) {
  return rippleAdd(net, a, notBits(net, b), constBit(net, 1));
}

// Signed less-than, matching the Forge note: sign of (a - b), flipped when the subtract overflows.
function sltBit(net, a, b) {
  const { sum } = subBits(net, a, b);
  const signsDiffer = gate(net, 'XOR', a[31], b[31]);
  const ovf = gate(net, 'AND', signsDiffer, gate(net, 'XOR', sum[31], a[31]));
  return gate(net, 'XOR', sum[31], ovf);
}

export function buildAluNet(name) {
  if (!ALU.has(name)) return null;
  const net = createNet();
  const a = addInput(net, 'a', 32);
  const b = addInput(net, 'b', 32);
  let bits;
  if (name === 'ADD' || name === 'ADDI') bits = rippleAdd(net, a, b, constBit(net, 0)).sum;
  else if (name === 'SUB') bits = subBits(net, a, b).sum;
  else if (name === 'AND' || name === 'OR' || name === 'XOR') bits = bitwise(net, name, a, b);
  else if (name === 'SLT' || name === 'BLT') bits = [sltBit(net, a, b)];
  else if (name === 'BEQ') bits = [gate(net, 'NOT', orReduce(net, bitwise(net, 'XOR', a, b)))];
  else if (name === 'BNE') bits = [orReduce(net, bitwise(net, 'XOR', a, b))];
  else throw new Error(name);
  addOutput(net, 'y', bits);
  return net;
}

const netCache = new Map();
function aluNet(name) {
  let net = netCache.get(name);
  if (!net) { net = buildAluNet(name); netCache.set(name, net); }
  return net;
}

function asInt(u, width) {
  if (width === 1) return Number(u & 1n);
  return Number(u & 0xffffffffn) | 0;
}

export function lowerForge(name, a, b, opts = {}) {
  a |= 0;
  b |= 0;
  if (name === 'LUI') {
    const value = (b << 16) | 0;
    return {
      kind: 'wire',
      name, a, b, value, expected: value, match: true,
      note: 'LUI is a wire shift of the immediate into bits 31:16. No arithmetic gate is in this op.',
      logic: 0, depth: 0, shown: [], hidden: 0,
    };
  }
  if (name === 'LW' || name === 'SW') {
    const addr = (a + b) | 0;
    const alu = lowerForge('ADDI', a, b, opts);
    return {
      ...alu,
      kind: 'address',
      name,
      value: addr & 255,
      expected: addr & 255,
      match: alu.match && ((alu.value & 255) === (addr & 255) || (a + b) | 0 === alu.value),
      note: `${name} adds the address with the ADDI netlist, then masks to 8 bits. The RAM word itself is not a gate netlist in this view. Address add ${alu.match ? 'matches' : 'DIFFERS FROM'} integer arithmetic.`,
    };
  }
  if (name === 'JAL') {
    const alu = lowerForge('ADD', a, b, opts);
    return { ...alu, kind: 'address', name, note: 'JAL adds a word offset to the PC. The link register is PC+1 and is not an ALU gate. ' + alu.note };
  }
  if (name === 'HALT' || name === 'ILL') {
    return { kind: 'none', name, a, b, value: null, expected: null, match: true, note: `${name} does not use the ALU.`, logic: 0, depth: 0, shown: [], hidden: 0 };
  }
  const net = aluNet(name);
  if (!net) return { kind: 'none', name, a, b, value: null, expected: null, match: false, note: 'no netlist for ' + name, logic: 0, depth: 0, shown: [], hidden: 0 };
  const sim = simulate(net, { a: a >>> 0, b: b >>> 0 }, { sample: opts.sample, stuck: opts.stuck });
  const width = net.outputs[0].bits.length;
  const value = asInt(sim.out.y, width);
  const expected = intAlu(name, a, b);
  const win = windowGates(net, sim, opts.limit ?? 64, opts.focus);
  return {
    kind: 'net',
    name, a, b, value, expected,
    match: value === expected,
    depth: sim.depth,
    logic: sim.logic,
    constants: sim.constants,
    shown: win.shown,
    hidden: win.hidden,
    note: `Gate netlist for ${name}: ${sim.logic} AND/OR/XOR/NOT gates, unit-delay depth ${sim.depth}. Integer result ${value} ${value === expected ? 'matches' : 'DIFFERS FROM'} the VM arithmetic (${expected}).`,
  };
}

export function forgeOpName(op) {
  return Object.entries(OP).find(([, v]) => v === op)?.[0] || 'ILL';
}

// One normal-float32 product, opened as a 24-bit significand multiply.
// This is the integer multiply of the hidden-bit significands. It is not the FMA the engine ran.
export function significandProduct(a, b, opts = {}) {
  const A = f32bits(a);
  const B = f32bits(b);
  if (A.kind !== 'normal' || B.kind !== 'normal') {
    return {
      ok: false,
      kind: A.kind === 'normal' ? B.kind : A.kind,
      note: 'Significand netlist covers normal float32 values only. Zero, denormal, infinity, and NaN are not expanded into this multiplier.',
    };
  }
  const ma = (1 << 23) | A.frac;
  const mb = (1 << 23) | B.frac;
  const sim = mulInt(24, ma, mb, opts.sample == null ? undefined : { sample: opts.sample });
  const expect = BigInt(ma) * BigInt(mb);
  const win = windowGates(sim.net, sim, opts.limit ?? 48, null);
  return {
    ok: true,
    match: sim.p === expect,
    product: sim.p.toString(),
    expect: expect.toString(),
    sign: A.sign ^ B.sign,
    expSum: A.exp + B.exp - 127,
    logic: sim.logic,
    depth: sim.depth,
    shown: win.shown,
    hidden: win.hidden,
    note: `24-bit array multiplier on the two normal significands, including the hidden 1. ${win.logicCount} logic gates, unit-delay depth ${sim.depth}. Showing ${win.shown.length}. The engine multiplied the float32 values in JavaScript; it did not clock this netlist. The integer product is checked against ma × mb.`,
  };
}

const IMM_OPS = new Set(['ADDI', 'LW', 'SW']);

export function vmOperands(rom, index) {
  const vm = new VM(rom);
  for (let i = 0; i < index && !vm.halted && !vm.fail; i++) vm.step();
  const d = dec(vm.rom[vm.pc] || 0);
  let a = vm.x[d.rs1] | 0;
  let b = vm.x[d.rs2] | 0;
  if (IMM_OPS.has(d.name)) b = d.simm | 0;
  if (d.name === 'LUI') b = d.imm;
  if (d.name === 'JAL') { a = vm.pc; b = d.simm | 0; }
  return { name: d.name, a, b, rd: d.rd, pc: vm.pc, op: d.op };
}

// Frozen arithmetic cells for the WeightCPU / MDCC comparison.
// The NestLang programs are the WeightCPU lane. The task strings are what the MDCC proposer reads.
// Criteria were written with the suite, before treating a run as evidence.

export const CELLS = Object.freeze([
  Object.freeze({ id: 'sum-22x35', task: 'sum of 22 copies of 35', op: 'mul', a: 22, b: 35, expect: 770 }),
  Object.freeze({ id: 'sum-5x9', task: 'sum of 5 copies of 9', op: 'mul', a: 5, b: 9, expect: 45 }),
  Object.freeze({ id: 'sum-1x-4', task: 'sum of 1 copies of -4', op: 'mul', a: 1, b: -4, expect: -4 }),
  Object.freeze({ id: 'sum-0x12', task: 'sum of 0 copies of 12', op: 'mul', a: 0, b: 12, expect: 0 }),
  Object.freeze({ id: 'add-7-13', task: '7 + 13', op: 'add', a: 7, b: 13, expect: 20 }),
  Object.freeze({ id: 'sub-100-37', task: '100 - 37', op: 'sub', a: 100, b: 37, expect: 63 }),
  Object.freeze({ id: 'sub-3-8', task: '3 - 8', op: 'sub', a: 3, b: 8, expect: -5 }),
  Object.freeze({ id: 'add-0-0', task: '0 + 0', op: 'add', a: 0, b: 0, expect: 0 }),
]);

export const DEMO_SOURCE = `dup i32 acc = 0
dup i32 y = 35
nat n = 22n
rec n {
  acc = acc + y
}
halt acc
`;

export function programFor(cell) {
  if (cell.op === 'mul') return `dup i32 acc = 0\ndup i32 y = ${cell.b}\nnat n = ${cell.a}n\nrec n {\n  acc = acc + y\n}\nhalt acc\n`;
  if (cell.op === 'add') return `dup i32 a = ${cell.a}\ndup i32 b = ${cell.b}\nhalt a + b\n`;
  if (cell.op === 'sub') return `dup i32 a = ${cell.a}\ndup i32 b = ${cell.b}\nhalt a - b\n`;
  throw new Error('no program for ' + cell.op);
}

export const BAD_PROGRAMS = Object.freeze([
  Object.freeze({ id: 'affine', code: 'affine', src: 'once i32 x = 1\nhalt x + x\n' }),
  Object.freeze({ id: 'type-plus', code: 'type', src: 'bool b = true\nb = b + 1\nhalt 0\n' }),
  Object.freeze({ id: 'term-i32', code: 'termination', src: 'i32 n = 3\nrec n {\n}\nhalt 0\n' }),
  Object.freeze({ id: 'term-missing', code: 'termination', src: 'i32 x = 1\n' }),
  Object.freeze({ id: 'nat-literal', code: 'type', src: 'nat n = 4\nhalt n\n' }),
]);

export const CRITERIA = Object.freeze({
  id: 'forge-v1',
  version: 1,
  mdccAccuracy: 1,
  vmAccuracy: 1,
  engineTraceMatch: 1,
  typecheckRejectsBad: 1,
  bf16Claimed: false,
  note: 'MDCC must be exact on CELLS. The int32 VM must match expect. The float32 and float64 gadget engines must match the VM trace, with zero precision faults. Every BAD_PROGRAMS entry must fail typecheck with its code. bf16 parity is not a criterion because that path is not shipped.',
});

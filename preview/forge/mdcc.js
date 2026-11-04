// MDCC lane: a deterministic proposer reads the task string, then the host computes with bigint.
// The proposer is not TinyStories. Once a plan exists, the arithmetic is host decimal code.
// That is the contrast with the in-weight clock: same questions, different place of computation.

export function propose(task) {
  const s = String(task).trim();
  let m = s.match(/^sum of (-?\d+) copies of (-?\d+)$/);
  if (m) return { op: 'mul', a: Number(m[1]), b: Number(m[2]), tokens: 3 };
  m = s.match(/^(-?\d+) \+ (-?\d+)$/);
  if (m) return { op: 'add', a: Number(m[1]), b: Number(m[2]), tokens: 3 };
  m = s.match(/^(-?\d+) - (-?\d+)$/);
  if (m) return { op: 'sub', a: Number(m[1]), b: Number(m[2]), tokens: 3 };
  return { op: null, a: null, b: null, tokens: 0, error: 'unparsed' };
}

export function hostExec(plan) {
  const a = BigInt(plan.a), b = BigInt(plan.b);
  if (plan.op === 'add') return a + b;
  if (plan.op === 'sub') return a - b;
  if (plan.op === 'mul') return a * b;
  throw new Error('no op');
}

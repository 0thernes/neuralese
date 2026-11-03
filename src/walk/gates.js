// Gate netlist. Every gate is AND, OR, XOR, or NOT, plus constant 0/1 sources.
// Simulation is a unit-delay Boolean circuit. It is not a SPICE deck and it is not the CPU
// that happens to be evaluating this file. Integer results are checked against integer arithmetic.

export function createNet() {
  return { gates: [], inputs: [], outputs: [], n: 0 };
}

export function addInput(net, name, width) {
  const bits = [];
  for (let i = 0; i < width; i++) {
    const id = net.n++;
    net.inputs.push({ id, name, bit: i });
    bits.push(id);
  }
  return bits;
}

export function constBit(net, v) {
  const id = net.n++;
  net.gates.push({ id, op: 'CONST', a: null, b: null, v: v ? 1 : 0 });
  return id;
}

export function gate(net, op, a, b = null) {
  if (op !== 'AND' && op !== 'OR' && op !== 'XOR' && op !== 'NOT') throw new Error('gate ' + op);
  const id = net.n++;
  net.gates.push({ id, op, a, b, v: null });
  return id;
}

export function addOutput(net, name, bits) {
  net.outputs.push({ name, bits: bits.slice() });
  return net;
}

function toBits(v) {
  if (typeof v === 'bigint') return v;
  if (!Number.isFinite(v)) throw new Error('net input is not finite');
  if (v < 0) return BigInt(v | 0) & 0xffffffffn;
  return BigInt(Math.trunc(v));
}

function bitAt(v, i) {
  return Number((toBits(v) >> BigInt(i)) & 1n);
}

// opts.stuck: { [gateOrInputId]: 0|1 } forces that node.
// opts.sample: if set, a gate whose unit-delay time is later than sample reads as 0.
// Unit delay: inputs and constants are ready at 0. Each logic gate is ready one step after its slower input.
export function simulate(net, env, opts = {}) {
  const stuck = opts.stuck || {};
  const sample = opts.sample;
  const val = new Map();
  const ready = new Map();
  for (const inp of net.inputs) {
    const forced = stuck[inp.id];
    val.set(inp.id, forced == null ? bitAt(env[inp.name] ?? 0, inp.bit) : (forced ? 1 : 0));
    ready.set(inp.id, 0);
  }
  let depth = 0;
  let logic = 0;
  let constants = 0;
  for (const g of net.gates) {
    if (g.op === 'CONST') {
      constants++;
      val.set(g.id, stuck[g.id] == null ? g.v : (stuck[g.id] ? 1 : 0));
      ready.set(g.id, 0);
      continue;
    }
    logic++;
    const ta = ready.get(g.a);
    const tb = g.b == null ? 0 : ready.get(g.b);
    if (ta == null || (g.b != null && tb == null)) throw new Error('gate ' + g.id + ' reads an unknown node');
    const t = stuck[g.id] == null ? Math.max(ta, tb) + 1 : 0;
    ready.set(g.id, t);
    if (t > depth) depth = t;
    if (stuck[g.id] != null) { val.set(g.id, stuck[g.id] ? 1 : 0); continue; }
    if (sample != null && t > sample) { val.set(g.id, 0); continue; }
    const a = val.get(g.a) & 1;
    const b = g.b == null ? 0 : (val.get(g.b) & 1);
    let y = 0;
    if (g.op === 'AND') y = a & b;
    else if (g.op === 'OR') y = a | b;
    else if (g.op === 'XOR') y = a ^ b;
    else y = a ^ 1;
    val.set(g.id, y);
  }
  const out = {};
  for (const o of net.outputs) {
    let u = 0n;
    for (let i = 0; i < o.bits.length; i++) if (val.get(o.bits[i])) u |= 1n << BigInt(i);
    out[o.name] = u;
  }
  return { out, val, ready, depth, logic, constants };
}

export function fullAdder(net, a, b, cin) {
  const x = gate(net, 'XOR', a, b);
  const sum = gate(net, 'XOR', x, cin);
  const ab = gate(net, 'AND', a, b);
  const xc = gate(net, 'AND', x, cin);
  const cout = gate(net, 'OR', ab, xc);
  return { sum, cout };
}

export function rippleAdd(net, aBits, bBits, cin) {
  if (aBits.length !== bBits.length) throw new Error('adder width');
  const sum = [];
  let c = cin;
  for (let i = 0; i < aBits.length; i++) {
    const s = fullAdder(net, aBits[i], bBits[i], c);
    sum.push(s.sum);
    c = s.cout;
  }
  return { sum, cout: c };
}

// n-bit × m-bit array multiplier. Partial products are AND gates. Rows are ripple-added.
// The product fits in n+m bits; the final carry is kept and must be 0 for a full-width result.
export function arrayMul(net, aBits, bBits) {
  const n = aBits.length;
  const m = bBits.length;
  const width = n + m;
  let acc = [];
  for (let k = 0; k < width; k++) acc.push(constBit(net, 0));
  for (let i = 0; i < m; i++) {
    const row = [];
    for (let k = 0; k < width; k++) {
      const j = k - i;
      row.push(j < 0 || j >= n ? constBit(net, 0) : gate(net, 'AND', aBits[j], bBits[i]));
    }
    const added = rippleAdd(net, acc, row, constBit(net, 0));
    acc = added.sum;
    acc.push(added.cout);
    acc = acc.slice(0, width);
  }
  return acc;
}

export function multiplierNet(width) {
  const net = createNet();
  const a = addInput(net, 'a', width);
  const b = addInput(net, 'b', width);
  addOutput(net, 'p', arrayMul(net, a, b));
  return net;
}

const mulCache = new Map();
export function cachedMultiplier(width) {
  let net = mulCache.get(width);
  if (!net) { net = multiplierNet(width); mulCache.set(width, net); }
  return net;
}

export function mulInt(width, a, b, opts) {
  const net = cachedMultiplier(width);
  const sim = simulate(net, { a, b }, opts);
  return { net, ...sim, p: sim.out.p };
}

export function windowGates(net, sim, limit, focusId) {
  const logic = [];
  for (const g of net.gates) {
    if (g.op === 'CONST') continue;
    logic.push({ id: g.id, op: g.op, y: sim.val.get(g.id) ? 1 : 0, t: sim.ready.get(g.id) });
  }
  const shown = logic.slice(0, Math.max(0, limit));
  if (focusId != null && !shown.some((g) => g.id === focusId)) {
    const hit = logic.find((g) => g.id === focusId);
    if (hit) shown.push(hit);
  }
  return { shown, logicCount: logic.length, hidden: Math.max(0, logic.length - shown.length) };
}

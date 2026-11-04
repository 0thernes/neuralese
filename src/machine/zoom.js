// Deep Walk chain for one Weight-Machine component: gadget weights, then a Boolean
// gate netlist, then the simulated CMOS model. The voltage banner is the walk's banner.

import { CMOS_BANNER, assessInverter, cmosParams, nandTruth } from '../walk/cmos.js';
import { buildAluNet } from '../walk/forgealu.js';
import { addInput, addOutput, createNet, gate, mulInt, simulate, windowGates } from '../walk/gates.js';
import { AND_LAYER, NOT_LAYER, applyAndLayer } from './gadget.js';
import { WORD_BITS } from './isa.js';

function muxNet() {
  const net = createNet();
  const s = addInput(net, 's', 1);
  const a = addInput(net, 'a', 1);
  const b = addInput(net, 'b', 1);
  const ns = gate(net, 'NOT', s[0]);
  const ta = gate(net, 'AND', s[0], a[0]);
  const tb = gate(net, 'AND', ns, b[0]);
  addOutput(net, 'y', [gate(net, 'OR', ta, tb)]);
  return net;
}

function xorNet() {
  const net = createNet();
  const a = addInput(net, 'a', 1);
  const b = addInput(net, 'b', 1);
  addOutput(net, 'y', [gate(net, 'XOR', a[0], b[0])]);
  return net;
}

function andNet() {
  const net = createNet();
  const a = addInput(net, 'a', 1);
  const b = addInput(net, 'b', 1);
  addOutput(net, 'y', [gate(net, 'AND', a[0], b[0])]);
  return net;
}

function showGates(net, env, sample) {
  const sim = simulate(net, env);
  const win = windowGates(net, sim, 36);
  return {
    level: 'gates',
    simulated: false,
    banner: 'Boolean gate netlist, the same model Deep Walk uses. Not a transistor and not silicon.',
    sample,
    out: sim.out,
    logic: win.logicCount,
    hidden: win.hidden,
    depth: sim.depth,
    gates: win.shown.map((g) => ({ id: g.id, op: g.op, y: g.y, t: g.t })),
  };
}

function matrixFrom(rows) {
  const cols = rows[0] ? rows[0].length : 0;
  return { rows: rows.length, cols, values: rows };
}

function ramSlice(state) {
  const bank = state && state.ramB;
  if (!bank) return matrixFrom([[0, 0, 0, 0]]);
  const rows = [];
  for (let w = 0; w < 8; w++) {
    const row = [];
    for (let b = 0; b < 16; b++) row.push(bank[w * WORD_BITS + b] ? 1 : 0);
    rows.push(row);
  }
  return matrixFrom(rows);
}

const NOTES = {
  cpu: 'The ALU is the Forge ripple-carry and logic gadgets. Fetch is hard attention over the ROM bit bank. The AND weights below sit inside every bitwise op.',
  ram: 'A read is hard attention: the address one-hot is the score vector and the bit rows are V. A write is the delta rule with step size 1 on that row. The grid is the first 8 words, low 16 bits, of the live bank.',
  ssd: 'Same attention and delta rule as RAM, indexed by a 5-bit page and a word slot. The transfer waits on the bus, one word at a time. The saved file is this bit bank.',
  gpu: 'Each lane is the same adder or the same XOR. The pattern shader keeps the low bit of x xor y and selects one of two byte constants.',
  tpu: 'Each active cell is an int8 MAC: an array multiply of AND gates and a ripple add into the accumulator. The array is output-stationary.',
  bus: 'A grant is a round-robin scan of AND/OR gates. A route is a one-hot that passes the payload to one port.',
  console: 'The low 8 bits of the stored word are the byte. The strobe is an AND with the write enable.',
  fb: 'Bytes land from the GPU burst. The checker bit is the same XOR gadget as the shader.',
};

export function zoomView(component, level, state) {
  const id = NOTES[component] ? component : 'cpu';
  if (level === 'voltage') {
    const p = cmosParams();
    const report = assessInverter(p, { steps: 21 });
    const nand = nandTruth(p);
    return {
      level: 'voltage',
      simulated: true,
      banner: CMOS_BANNER,
      component: id,
      vol: report.vol,
      voh: report.voh,
      validLow: report.validLow,
      validHigh: report.validHigh,
      curve: report.curve.map((pt) => ({ vin: pt.vin, vout: pt.vout })),
      nand: nand.map((row) => ({ a: row.a, b: row.b, y: row.y, ok: row.ok, vout: row.vout })),
      note: 'Simulated square-law CMOS. It does not measure the CPU or GPU running this page.',
    };
  }
  if (level === 'gates') {
    if (id === 'cpu') {
      const net = buildAluNet('ADD');
      const view = showGates(net, { a: 3, b: 4 }, 'ADD 3 + 4');
      view.component = id;
      view.expect = 7;
      return view;
    }
    if (id === 'tpu') {
      const sim = mulInt(4, 3, 5);
      const win = windowGates(sim.net, sim, 36);
      return {
        level: 'gates', simulated: false, component: id,
        banner: 'Boolean gate netlist, the same model Deep Walk uses. Not a transistor and not silicon.',
        sample: '4-bit multiply 3 × 5',
        out: { p: sim.p },
        logic: win.logicCount, hidden: win.hidden, depth: sim.depth,
        gates: win.shown.map((g) => ({ id: g.id, op: g.op, y: g.y, t: g.t })),
        expect: 15,
      };
    }
    if (id === 'gpu' || id === 'fb') {
      const view = showGates(xorNet(), { a: 1, b: 0 }, 'XOR 1, 0 (checker bit)');
      view.component = id;
      view.expect = 1;
      return view;
    }
    if (id === 'bus' || id === 'console') {
      const view = showGates(andNet(), { a: 1, b: 1 }, id === 'bus' ? 'request AND not-seen' : 'bit AND write strobe');
      view.component = id;
      view.expect = 1;
      return view;
    }
    const view = showGates(muxNet(), { s: 1, a: 1, b: 0 }, 'mux sel=1, a=1, b=0');
    view.component = id;
    view.expect = 1;
    return view;
  }
  const live = id === 'ram' || id === 'ssd' ? ramSlice(state) : matrixFrom([AND_LAYER.W.slice(), [AND_LAYER.b]]);
  return {
    level: 'weights',
    simulated: false,
    component: id,
    note: NOTES[id],
    and: { ...AND_LAYER, check: applyAndLayer(1, 1) === 1 && applyAndLayer(1, 0) === 0 },
    not: NOT_LAYER,
    attention: id === 'ram' || id === 'ssd' || id === 'cpu',
    delta: id === 'ram' || id === 'ssd',
    rows: live.rows,
    cols: live.cols,
    values: live.values,
  };
}

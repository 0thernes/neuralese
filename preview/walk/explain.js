// How one recorded cell was computed. The arithmetic matches the engine's loops, including the four-lane matvec.

import { f32bits, f32hex, bitString } from './bits.js';

const GELU_K = 0.7978845608028654;

export function geluAt(x) {
  return 0.5 * x * (1 + Math.tanh(GELU_K * (x + 0.044715 * x * x * x)));
}

export function lanes4(Wm, x, i, nIn, bias) {
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
  const o = i * nIn;
  const terms = [];
  for (let j = 0; j < nIn; j += 4) {
    const w0 = Wm[o + j], w1 = Wm[o + j + 1], w2 = Wm[o + j + 2], w3 = Wm[o + j + 3];
    const x0 = x[j], x1 = x[j + 1], x2 = x[j + 2], x3 = x[j + 3];
    const p0 = w0 * x0, p1 = w1 * x1, p2 = w2 * x2, p3 = w3 * x3;
    s0 += p0; s1 += p1; s2 += p2; s3 += p3;
    terms.push({ j, w: w0, x: x0, prod: p0 }, { j: j + 1, w: w1, x: x1, prod: p1 }, { j: j + 2, w: w2, x: x2, prod: p2 }, { j: j + 3, w: w3, x: x3, prod: p3 });
  }
  const b = bias ? bias[i] : 0;
  return { sum: b + s0 + s1 + s2 + s3, bias: b, terms };
}

export function serialDot(Wm, x, i, nIn, bias) {
  let s = bias ? bias[i] : 0;
  const o = i * nIn;
  const terms = [];
  for (let j = 0; j < nIn; j++) {
    const prod = Wm[o + j] * x[j];
    s += prod;
    terms.push({ j, w: Wm[o + j], x: x[j], prod });
  }
  return { sum: s, bias: bias ? bias[i] : 0, terms };
}

function topTerms(terms, focus, k = 8) {
  const ranked = terms.slice().sort((a, b) => Math.abs(b.prod) - Math.abs(a.prod));
  const out = ranked.slice(0, k);
  if (focus != null) {
    const hit = terms.find((t) => t.j === focus);
    if (hit && !out.some((t) => t.j === hit.j)) out.push(hit);
  }
  return out.map((t) => ({ j: t.j, w: t.w, x: t.x, prod: t.prod }));
}

function layerOf(eng, op) {
  if (op.layer == null) return null;
  return eng.W.layers[op.layer];
}

function matrixOf(eng, op) {
  if (op.weight === 'wte') return eng.W.wte;
  if (op.weight === 'lnf') return eng.W.lnfW;
  const P = layerOf(eng, op);
  return P ? P[op.weight] : null;
}

function biasOf(eng, op) {
  if (!op.bias) return null;
  if (op.bias === 'lnfB') return eng.W.lnfB;
  const P = layerOf(eng, op);
  return P ? P[op.bias] : null;
}

function lnVectors(eng, op) {
  if (op.weight === 'lnf') return { w: eng.W.lnfW, b: eng.W.lnfB };
  const P = layerOf(eng, op);
  return { w: P[op.weight], b: P[op.bias] };
}

export function explainOp(session, opId, index, termJ = null) {
  const op = session.ops.find((o) => o.id === opId);
  if (!op) throw new Error('no op ' + opId);
  const byId = (id) => session.ops.find((o) => o.id === id);
  const recorded = op.values && index != null && index >= 0 && index < op.values.length ? op.values[index] : null;
  const lines = [];
  const finite = (v) => v == null || Number.isFinite(v) ? v : null;

  if (op.kind === 'add' || op.id === 'embed') {
    const a = byId('embed.wte');
    const b = byId('embed.wpe');
    const value = a.values[index] + b.values[index];
    lines.push(`token row[${index}] = ${a.values[index]}`);
    lines.push(`position row[${index}] (position ${op.pos}) = ${b.values[index]}`);
    lines.push(`sum = ${value}`);
    return pack(op, index, value, recorded, 'wte[token, i] + wpe[position, i]', lines, [{ j: 0, w: a.values[index], x: 1, prod: a.values[index] }, { j: 1, w: b.values[index], x: 1, prod: b.values[index] }]);
  }

  if (op.kind === 'ln') {
    const src = byId(op.src);
    const { w, b } = lnVectors(session.eng, op);
    const n = src.values.length;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += src.values[i];
    mean /= n;
    let v = 0;
    for (let i = 0; i < n; i++) { const q = src.values[i] - mean; v += q * q; }
    v /= n;
    const rstd = 1 / Math.sqrt(v + op.eps);
    const value = (src.values[index] - mean) * rstd * w[index] + b[index];
    lines.push(`mean = ${mean}`);
    lines.push(`rstd = 1 / sqrt(variance + ${op.eps}) = ${rstd}`);
    lines.push(`(${src.values[index]} − ${mean}) × ${rstd} × ${w[index]} + ${b[index]} = ${value}`);
    return pack(op, index, value, recorded, '(x − mean) × rstd × weight + bias', lines, []);
  }

  if (op.kind === 'matvec') {
    const src = byId(op.src);
    const Wm = matrixOf(session.eng, op);
    const bias = biasOf(session.eng, op);
    const dot = op.acc === 'serial' ? serialDot(Wm, src.values, index, op.nIn, bias) : lanes4(Wm, src.values, index, op.nIn, bias);
    const focus = termJ == null ? null : termJ;
    const terms = topTerms(dot.terms, focus);
    const shown = terms[0];
    lines.push(`output[${index}] = bias + Σ_j W[${index}, j] · x[j]`);
    lines.push(`bias = ${dot.bias}`);
    lines.push(op.acc === 'serial' ? 'Arch matvec adds in index order.' : 'Engine.matvec accumulates four partial sums, then adds them to the bias.');
    lines.push(`full sum = ${dot.sum}`);
    if (shown) lines.push(`largest |term|: j=${shown.j}, W=${shown.w}, x=${shown.x}, product=${shown.prod}`);
    const picked = termJ == null ? shown : dot.terms.find((t) => t.j === termJ) || shown;
    const out = pack(op, index, dot.sum, recorded, 'bias[i] + Σ_j W[i, j] · x[j]', lines, terms);
    if (picked) {
      out.term = { j: picked.j, w: picked.w, x: picked.x, prod: picked.prod };
      out.float = floatView(picked.w, picked.x, picked.prod);
    }
    out.nTerms = dot.terms.length;
    out.termsShown = terms.length;
    return out;
  }

  if (op.kind === 'score') {
    if (!Number.isFinite(recorded)) {
      return pack(op, index, null, null, 'masked', [`position ${index} is outside this head’s mask (${op.mode})`], []);
    }
    const q = byId(op.srcQ).values;
    const keys = byId(op.srcK).values;
    const d = session.cfg.d;
    const hd = session.cfg.hd;
    let acc = 0;
    const terms = [];
    if (op.mode === 'uniform') {
      lines.push('uniform mask: the score is 0 before softmax');
      return pack(op, index, 0, recorded, '0 (uniform mask)', lines, []);
    }
    for (let i = 0; i < hd; i++) {
      const w = q[op.off + i];
      const x = keys[index * d + op.off + i];
      const prod = w * x;
      acc += prod;
      terms.push({ j: i, w, x, prod });
    }
    const value = acc / op.tau;
    lines.push(`dot of head slice (${hd} lanes) = ${acc}`);
    lines.push(`divide by head temperature ${op.tau} → ${value}`);
    const out = pack(op, index, value, recorded, 'dot(q_head, k_head) / temperature', lines, topTerms(terms, termJ));
    const picked = termJ == null ? terms.slice().sort((a, b) => Math.abs(b.prod) - Math.abs(a.prod))[0] : terms[termJ];
    if (picked) {
      out.term = picked;
      out.float = floatView(picked.w, picked.x, picked.prod);
    }
    return out;
  }

  if (op.kind === 'softmax') {
    const scores = byId(op.src).values;
    let mx = -Infinity;
    for (let i = 0; i < scores.length; i++) if (scores[i] > mx) mx = scores[i];
    let sum = 0;
    const exps = new Array(scores.length);
    for (let i = 0; i < scores.length; i++) {
      exps[i] = scores[i] === -Infinity || !Number.isFinite(scores[i]) ? 0 : Math.exp(scores[i] - mx);
      sum += exps[i];
    }
    const value = exps[index] / sum;
    lines.push(`max score = ${finite(mx)}`);
    lines.push(`exp(score − max) = ${exps[index]}`);
    lines.push(`sum of exp = ${sum}`);
    lines.push(`weight = ${value}`);
    return pack(op, index, value, recorded, 'exp(s − max) / Σ exp(s − max)', lines, []);
  }

  if (op.kind === 'residual') {
    const a = byId(op.src).values;
    const b = byId(op.add).values;
    const value = a[index] + b[index];
    lines.push(`${op.src}[${index}] = ${a[index]}`);
    lines.push(`${op.add}[${index}] = ${b[index]}`);
    lines.push(`sum = ${value}`);
    return pack(op, index, value, recorded, 'x[i] + added[i]', lines, [{ j: 0, w: a[index], x: 1, prod: a[index] }, { j: 1, w: b[index], x: 1, prod: b[index] }]);
  }

  if (op.kind === 'gelu') {
    const pre = byId(op.src).values[index];
    const value = geluAt(pre);
    lines.push(`pre-activation = ${pre}`);
    lines.push(`GELU(x) = 0.5 · x · (1 + tanh(0.7978845608028654 · (x + 0.044715 · x³)))`);
    lines.push(`GELU = ${value}`);
    lines.push('Neuron ablations in the runtime, if any name this unit, have already replaced the stored activation.');
    return pack(op, index, value, recorded, 'GELU(pre)', lines, []);
  }

  if (op.kind === 'vec' || op.kind === 'embed' || op.kind === 'mix') {
    lines.push(`${op.id}[${index}] = ${recorded}`);
    if (op.kind === 'mix') lines.push('This channel is the attention mix after any head ablation and residual-stream steering on z.');
    return pack(op, index, recorded, recorded, 'stored activation', lines, []);
  }

  return pack(op, index, recorded, recorded, op.kind, ['no expansion for this op'], []);
}

function pack(op, index, value, recorded, formula, lines, terms) {
  // The engine writes Float32Array entries, so the block shows that rounded value.
  const stored = value == null || !Number.isFinite(value) ? value : Math.fround(value);
  const gap = stored == null || recorded == null || !Number.isFinite(stored) || !Number.isFinite(recorded) ? null : Math.abs(stored - recorded);
  if (stored != null && value != null && stored !== value) lines.push(`JavaScript sum ${value}; the stored float32 value is ${stored}.`);
  return {
    opId: op.id, index, value: stored, wide: value, recorded, formula, lines, terms,
    gap,
    shape: [op.values.length],
    layer: op.layer ?? null,
    head: op.head ?? null,
  };
}

export function floatView(a, b, prod) {
  const A = f32bits(a);
  const B = f32bits(b);
  const P = f32bits(prod);
  return {
    note: 'Factors are rounded to float32 for the bit view. The product shown is the JavaScript multiply, then rounded to float32 for its own bits. The engine’s accumulator is float64.',
    a: field(A), b: field(B), prod: field(P),
    jsProd: prod,
  };
}

function field(B) {
  return { value: B.f32, hex: f32hex(B.f32), bits: bitString(B.u), sign: B.sign, exp: B.exp, frac: B.frac, kind: B.kind };
}

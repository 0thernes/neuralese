// One real forward, with the engine's own tensors copied out. Logits are Engine.matvec on the final hidden state.

import { CFG } from '../model.js';
import { Engine, defaultRuntime, matvec, topK } from '../engine.js';
import { chapterOf, titleOf } from './chapters.js';
import { explainOp } from './explain.js';
import { takeSample, topSample } from './sample.js';
import { applyFaults } from './bits.js';

export function forwardDetailed(eng, ids, opts = {}) {
  const token = opts.token == null ? ids.length - 1 : opts.token;
  const detail = [];
  const flipped = [];
  const fault = opts.fault || null;
  const hook = fault ? (site, slot, layer, t, vec) => {
    if (t !== token || site !== fault.site || layer !== fault.layer) return;
    if (fault.slot != null && slot !== fault.slot) return;
    flipped.push(...applyFaults(vec, fault));
  } : undefined;
  const run = eng.run(ids, { hook, detail, detailToken: token, nPrompt: opts.nPrompt ?? ids.length });
  const h = run.last.h;
  const logits = matvec(eng.W.wte, h, new Float32Array(CFG.V), CFG.V, CFG.d);
  const live = eng.logits(h);
  let logitGap = 0;
  for (let i = 0; i < logits.length; i++) logitGap = Math.max(logitGap, Math.abs(logits[i] - live[i]));
  detail.push({
    id: 'logits', kind: 'matvec', t: token, values: logits,
    weight: 'wte', src: 'lnf', nIn: CFG.d, nOut: CFG.V, acc: 'lanes4',
  });
  return { detail, h, logits, logitGap, flipped, ids, token, eng };
}

export function buildSession(eng, opts) {
  const ids = opts.ids;
  const rec = forwardDetailed(eng, ids, opts);
  const ops = rec.detail.map((op) => ({ ...op, title: titleOf(op), chapter: chapterOf(op) }));
  let argmax = 0;
  for (let i = 1; i < rec.logits.length; i++) if (rec.logits[i] > rec.logits[argmax]) argmax = i;
  return {
    backend: 'engine',
    modelLabel: opts.modelLabel || 'TinyStories-8M',
    prompt: opts.prompt || '',
    ids, token: rec.token, eng,
    cfg: { d: CFG.d, H: CFG.H, hd: CFG.hd, L: CFG.L, ff: CFG.ff, V: CFG.V, eps: CFG.eps },
    ops, logits: rec.logits, argmax, logitGap: rec.logitGap,
    fault: rec.flipped.length ? { spec: opts.fault, flipped: rec.flipped } : null,
  };
}

const HIDDEN_KIND = new Set(['cache']);

export function present(session, opts = {}) {
  const cap = opts.cap ?? 48;
  const focusOp = opts.focusOp || null;
  const focusIndex = opts.focusIndex ?? null;
  const ops = [];
  for (const op of session.ops) {
    if (HIDDEN_KIND.has(op.kind)) continue;
    const focus = op.id === focusOp ? focusIndex : (op.kind === 'matvec' && op.id === 'logits' ? session.argmax : null);
    const sampled = op.id === 'logits' ? topSample(op.values, Math.min(cap, 24), focus) : takeSample(op.values, cap, focus);
    ops.push({
      id: op.id, kind: op.kind, title: op.title, chapter: op.chapter,
      layer: op.layer ?? null, head: op.head ?? null,
      length: op.values.length,
      indices: sampled.indices,
      shown: sampled.shown,
      note: sampled.note,
      capped: sampled.capped,
    });
  }
  const topIdx = topK(session.logits, 8);
  return {
    backend: session.backend,
    model: session.modelLabel,
    prompt: session.prompt,
    ids: session.ids.slice(),
    token: session.token,
    cfg: session.cfg,
    argmax: session.argmax,
    logitGap: session.logitGap,
    logitCount: session.logits.length,
    logitsTop: topIdx.map((id) => ({ id, logit: session.logits[id] })),
    ops,
    fault: session.fault ? {
      site: session.fault.spec.site,
      layer: session.fault.spec.layer,
      bit: session.fault.spec.bit,
      mode: session.fault.spec.mode || 'flip',
      n: session.fault.flipped.length,
      flips: session.fault.flipped.map((f) => ({ index: f.index, bit: f.bit, before: f.before, after: f.after })),
    } : null,
    real: true,
  };
}

export function cellOf(session, opId, index, term) {
  return explainOp(session, opId, index, term);
}

export function freshEngine(W, R) {
  return new Engine(W, R || defaultRuntime());
}

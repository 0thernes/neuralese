// Walk an Arch forward (src/arch/arch.js) when that model is actually loaded.
// Arch.forward already returns residuals, the final norm, attention, and logits.
// Those are the blocks this walker shows. It does not invent QKV tapes the Arch call did not return.
// The per-head score tape lives on the GPT-Neo Engine path, which is what TinyStories uses in the lab.

import { forward } from '../arch/arch.js';
import { chapterOf, titleOf } from './chapters.js';
import { takeSample, topSample } from './sample.js';

const registry = [];

export function registerArchModel(entry) {
  if (!entry || !entry.id || !entry.arch || !entry.weights) throw new Error('arch model needs id, arch, weights');
  const i = registry.findIndex((m) => m.id === entry.id);
  if (i >= 0) registry[i] = entry;
  else registry.push(entry);
  return entry.id;
}

export function listArchModels() {
  return registry.map((m) => ({ id: m.id, label: m.label || m.id, kind: 'arch' }));
}

export function archById(id) {
  return registry.find((m) => m.id === id) || null;
}

export function clearArchModels() { registry.length = 0; }

export function recordArch(A, W, ids, opts = {}) {
  const token = opts.token == null ? ids.length - 1 : opts.token;
  const out = forward(A, W, ids, { attn: !!opts.attn, lastOnly: false });
  const ops = [];
  const embed = floatOf(out.hidden[0][token]);
  ops.push({ id: 'embed', kind: 'vec', layer: null, head: null, values: embed, title: 'Embeddings', chapter: 'embed' });
  for (let l = 0; l < A.L; l++) {
    const values = floatOf(out.hidden[l + 1][token]);
    const op = { id: `L${l}.resid`, kind: 'vec', layer: l, head: null, values };
    op.title = titleOf({ ...op, id: `s0.L${l}.resid_post` });
    op.chapter = chapterOf(op);
    ops.push(op);
    if (out.patterns) {
      const pat = out.patterns[l];
      for (let h = 0; h < A.H; h++) {
        const row = pat[h][token];
        const p = { id: `L${l}.H${h}.prob`, kind: 'softmax', layer: l, head: h, values: Float32Array.from(row) };
        p.title = titleOf(p);
        p.chapter = 'softmax';
        ops.push(p);
      }
    }
  }
  const fin = floatOf(out.final[token]);
  ops.push({ id: 'lnf', kind: 'vec', layer: null, values: fin, title: 'Final norm', chapter: 'logits' });
  const logits = floatOf(out.logits[token]);
  ops.push({ id: 'logits', kind: 'matvec', layer: null, values: logits, weight: 'lm', src: 'lnf', nIn: A.d, nOut: A.V, acc: 'serial', title: 'Logits', chapter: 'logits' });
  let argmax = 0;
  for (let i = 1; i < logits.length; i++) if (logits[i] > logits[argmax]) argmax = i;
  return {
    backend: 'arch',
    modelLabel: opts.modelLabel || A.arch,
    prompt: opts.prompt || '',
    ids: ids.slice(),
    token,
    eng: { W: { wte: W.lm, lnfW: W.nfw, lnfB: W.nfb || new Float32Array(A.d), layers: [] }, arch: true },
    cfg: { d: A.d, H: A.H, hd: A.hd, L: A.L, ff: A.ff, V: A.V, eps: A.eps },
    ops, logits, argmax, logitGap: 0,
    fault: null,
    referenceLogits: out.logits[token],
  };
}

function floatOf(v) {
  return v instanceof Float32Array ? v : Float32Array.from(v);
}

export function presentArch(session, opts = {}) {
  const cap = opts.cap ?? 48;
  const ops = session.ops.map((op) => {
    const sampled = op.id === 'logits' ? topSample(op.values, Math.min(cap, 24), session.argmax) : takeSample(op.values, cap, null);
    return {
      id: op.id, kind: op.kind, title: op.title, chapter: op.chapter,
      layer: op.layer ?? null, head: op.head ?? null,
      length: op.values.length, indices: sampled.indices, shown: sampled.shown, note: sampled.note, capped: sampled.capped,
    };
  });
  const top = [];
  const idx = ops.find((o) => o.id === 'logits');
  void idx;
  const order = [];
  for (let i = 0; i < session.logits.length; i++) order.push(i);
  order.sort((a, b) => session.logits[b] - session.logits[a]);
  for (let i = 0; i < Math.min(8, order.length); i++) top.push({ id: order[i], logit: session.logits[order[i]] });
  return {
    backend: 'arch',
    model: session.modelLabel,
    prompt: session.prompt,
    ids: session.ids.slice(),
    token: session.token,
    cfg: session.cfg,
    argmax: session.argmax,
    logitGap: 0,
    logitCount: session.logits.length,
    logitsTop: top,
    ops,
    fault: null,
    real: true,
    archNote: 'Arch models show the residual after each block, the attention weights when requested, the final norm, and the logits. Those arrays are forward()’s. The QKV tape is the TinyStories engine path.',
  };
}

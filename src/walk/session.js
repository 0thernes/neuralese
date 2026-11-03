// Worker and main-thread entry for a walk. The last session stays here so a cell query can explain it.
// A worker and the page each have their own copy of this module.

import { buildSession, cellOf, present } from './record.js';
import { archById, listArchModels, presentArch, recordArch, registerArchModel } from './archwalk.js';
import { CITATIONS, FAULT_SPEC, argmax, klLogits, publicStudy, runClean, runStudy, specHash } from './fault.js';
import { lowerForge, significandProduct } from './forgealu.js';
import { CMOS_BANNER, assessInverter, cmosParams, nandTruth } from './cmos.js';

let last = null;

export function models() {
  return [{ id: 'tinystories-8m', label: 'TinyStories-8M', kind: 'engine' }, ...listArchModels()];
}

export function runWalkOp(eng, msg) {
  const session = buildSession(eng, {
    ids: msg.ids, token: msg.token, prompt: msg.prompt, fault: msg.fault || null,
    modelLabel: msg.modelLabel || 'TinyStories-8M', nPrompt: msg.nPrompt,
  });
  last = session;
  const view = present(session, { cap: msg.cap, focusOp: msg.focusOp, focusIndex: msg.focusIndex });
  if (msg.fault) {
    const clean = runClean(eng, msg.ids);
    view.cleanArgmax = argmax(clean);
    view.faultKl = klLogits(clean, session.logits);
    view.faultTokenChanged = view.cleanArgmax !== session.argmax;
    view.faultReal = true;
  }
  return view;
}

export function runArchOp(msg) {
  const model = archById(msg.archId);
  if (!model) throw new Error('no Arch model is loaded');
  const session = recordArch(model.arch, model.weights, msg.ids, { token: msg.token, prompt: msg.prompt, modelLabel: model.label || model.id, attn: true });
  last = session;
  return presentArch(session, { cap: msg.cap });
}

export function runWalkCellOp(msg) {
  if (!last) throw new Error('no walk yet');
  const op = last.ops.find((o) => o.id === msg.opId);
  if (!op) throw new Error('no op ' + msg.opId);
  if (last.backend === 'arch' && op.kind !== 'matvec') {
    const value = op.values[msg.index];
    return {
      opId: op.id, index: msg.index, value, recorded: value, gap: 0,
      formula: 'value returned by Arch.forward',
      lines: ['This block is an array Arch.forward returned. It is not a reimplementation of that forward.'],
      terms: [], shape: [op.values.length], layer: op.layer ?? null, head: op.head ?? null,
    };
  }
  return cellOf(last, msg.opId, msg.index, msg.term ?? null);
}

export function runFaultOp(eng, ids) {
  return publicStudy(runStudy(eng, ids, FAULT_SPEC));
}

export function runForgeOp(msg) {
  return lowerForge(msg.name, msg.a | 0, msg.b | 0, { sample: msg.sample, stuck: msg.stuck, limit: msg.limit ?? 64, focus: msg.focus });
}

export function runSignificandOp(msg) {
  return significandProduct(msg.a, msg.b, { sample: msg.sample });
}

export function runVoltageOp(msg = {}) {
  const p = cmosParams(msg.params || {});
  const inv = assessInverter(p, {
    noiseSigma: msg.noiseSigma || 0,
    noiseDraws: msg.noiseDraws || 0,
    seed: msg.seed >>> 0,
    steps: msg.steps || 61,
  });
  const nand = nandTruth(p).map((r) => ({ a: r.a, b: r.b, y: r.y, expect: r.expect, ok: r.ok, vout: r.vout, defined: r.defined }));
  return { banner: CMOS_BANNER, params: p, inverter: { ...inv, curve: inv.curve }, nand };
}

export function registerOp(entry) { return registerArchModel(entry); }

export { FAULT_SPEC, CITATIONS, specHash };

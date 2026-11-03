// Real bit faults in a real forward. The mask is deterministic for a fixed seed.
// Voltage and gate faults are not applied here; a caller that has a simulated logic error
// passes the bit it wants flipped, and this file flips that bit in the activation.

import { CFG, mulberry32 } from '../model.js';
import { logSoftmax, matvec } from '../engine.js';
import { applyFaults } from './bits.js';
import { canonical, sha256Hex } from '../prereg.js';

export const CITATIONS = Object.freeze([
  { id: 'hong2019', claim: 'Flipping exponent bits of DNN values is much more damaging than flipping mantissa bits.', cite: 'Sanghyun Hong, Pietro Frigo, Yiğitcan Kaya, Cristiano Giuffrida, Tudor Dumitraș. Terminal Brain Damage: Exposing the Graceless Degradation in Deep Neural Networks Under Hardware Fault Attacks. USENIX Security, 2019.', url: 'https://www.usenix.org/conference/usenixsecurity19/presentation/hong' },
  { id: 'rakin2019', claim: 'A small number of adversarial bit flips in weights can collapse network accuracy.', cite: 'Adnan Siraj Rakin, Zhezhi He, Deliang Fan. Bit-Flip Attack: Crushing Neural Network with Progressive Bit Search. ICCV, 2019.', url: 'https://arxiv.org/abs/1903.12269' },
  { id: 'li2017', claim: 'Faults inside a DNN accelerator propagate to application-level error, and the effect depends on where the bit sits.', cite: 'Guanpeng Li, Siva Kumar Sastry Hari, Michael Sullivan, Timothy Tsai, Karthik Pattabiraman, Joel Emer, Stephen W. Keckler. Understanding Error Propagation in Deep Learning Neural Network (DNN) Accelerators and Applications. SC, 2017.', url: 'https://doi.org/10.1145/3126908.3126964' },
  { id: 'leng2014', claim: 'GPU supply noise is a real circuit phenomenon. This page does not measure it; the voltage view is a separate simulated CMOS model.', cite: 'Jingwen Leng, Yazhou Zu, Minsoo Rhu, Meeta S. Gupta, Vijay Janapa Reddi. GPUVolt: Modeling and Characterizing Voltage Noise in GPU Architectures. ISLPED, 2014.', url: 'https://doi.org/10.1145/2627369.2627605' },
  { id: 'shichman1968', claim: 'The voltage panel uses the square-law MOSFET equation from the SPICE level-1 model.', cite: 'H. Shichman, D. A. Hodges. Modeling and simulation of insulated-gate field-effect transistor switching circuits. IEEE Journal of Solid-State Circuits, 1968.', url: 'https://doi.org/10.1109/JSSC.1968.1049902' },
  { id: 'bycroft', claim: 'The walkthrough is inspired by the idea of showing every tensor op as blocks of numbers. No asset, shader, or sentence is taken from that page.', cite: 'Brendan Bycroft. LLM Visualization.', url: 'https://bbycroft.net/llm' },
]);

// Frozen before the measured run. Paired Bernoulli masks, two bits, one prompt.
export const FAULT_SPEC = Object.freeze({
  id: 'DW-FAULT-1',
  hypothesis: 'On TinyStories-8M, flipping IEEE-754 bit 23 (least significant exponent bit) of layer-3 residual-stream activations at the last prompt token, on a shared Bernoulli mask with p=0.05, yields a larger mean KL(clean || faulty) than flipping bit 0 (least significant mantissa bit) on that same mask, and changes the greedy token at least as often.',
  model: 'TinyStories-8M',
  prompt: 'Once upon a time',
  site: 'resid_post',
  layer: 3,
  p: 0.05,
  seed: 1729,
  n: 12,
  bits: Object.freeze({ exponent: 23, mantissa: 0 }),
  metric: 'mean KL(clean || faulty) in nats, and the fraction of trials whose greedy token changes',
  prediction: 'mean_kl_exponent > mean_kl_mantissa',
  null: 'The two mean KLs are equal on this prompt.',
});

export function bernoulliMask(n, p, seed) {
  const rng = mulberry32(seed >>> 0);
  const idx = [];
  for (let i = 0; i < n; i++) if (rng() < p) idx.push(i);
  return idx;
}

export function klLogits(clean, faulty) {
  const lp = logSoftmax(clean);
  const lq = logSoftmax(faulty);
  let s = 0;
  for (let i = 0; i < lp.length; i++) {
    const p = Math.exp(lp[i]);
    if (p > 0 && Number.isFinite(lq[i])) s += p * (lp[i] - lq[i]);
  }
  return s;
}

export function argmax(a) {
  let b = 0;
  for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i;
  return b;
}

function logitsOf(eng, h) {
  return matvec(eng.W.wte, h, new Float32Array(CFG.V), CFG.V, CFG.d);
}

export function runFaulted(eng, ids, spec) {
  const token = ids.length - 1;
  const flipped = [];
  const hook = (site, slot, layer, t, vec) => {
    if (t !== token || site !== spec.site || layer !== spec.layer) return;
    if (spec.slot != null && slot !== spec.slot) return;
    flipped.push(...applyFaults(vec, spec));
  };
  const run = eng.run(ids, { hook, nPrompt: ids.length });
  return { logits: logitsOf(eng, run.last.h), flipped, h: run.last.h };
}

export function runClean(eng, ids) {
  const run = eng.run(ids, { nPrompt: ids.length });
  return logitsOf(eng, run.last.h);
}

export function runStudy(eng, ids, spec = FAULT_SPEC) {
  if (!ids.length) throw new Error('empty prompt');
  const clean = runClean(eng, ids);
  const cleanId = argmax(clean);
  const rows = [];
  for (let trial = 0; trial < spec.n; trial++) {
    const indices = bernoulliMask(CFG.d, spec.p, (spec.seed + trial + 1) >>> 0);
    const base = { site: spec.site, layer: spec.layer, indices, mode: 'flip' };
    const exp = runFaulted(eng, ids, { ...base, bit: spec.bits.exponent });
    const man = runFaulted(eng, ids, { ...base, bit: spec.bits.mantissa });
    const expId = argmax(exp.logits);
    const manId = argmax(man.logits);
    rows.push({
      trial,
      nFlip: indices.length,
      indices,
      klExponent: klLogits(clean, exp.logits),
      klMantissa: klLogits(clean, man.logits),
      tokenExponent: expId,
      tokenMantissa: manId,
      exponentChanged: expId !== cleanId,
      mantissaChanged: manId !== cleanId,
    });
  }
  const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
  const rate = (k) => rows.reduce((s, r) => s + (r[k] ? 1 : 0), 0) / rows.length;
  const meanKlExponent = mean('klExponent');
  const meanKlMantissa = mean('klMantissa');
  return {
    spec: { ...spec, bits: { ...spec.bits } },
    promptIds: ids.slice(),
    cleanToken: cleanId,
    rows,
    meanKlExponent,
    meanKlMantissa,
    rateExponent: rate('exponentChanged'),
    rateMantissa: rate('mantissaChanged'),
    predictionHolds: meanKlExponent > meanKlMantissa,
    whatFlipped: `bit ${spec.bits.exponent} or bit ${spec.bits.mantissa} of ${spec.site} at layer ${spec.layer}, last token, each selected index of a Bernoulli(p=${spec.p}) mask. Seed per trial is ${spec.seed} + trial + 1. The forward is the real Engine; weights are not modified.`,
  };
}

export async function specHash(spec = FAULT_SPEC) {
  const body = { ...spec, bits: { ...spec.bits } };
  return sha256Hex(canonical(body));
}

export function publicStudy(study) {
  return {
    id: study.spec.id,
    hypothesis: study.spec.hypothesis,
    model: study.spec.model,
    prompt: study.spec.prompt,
    cleanToken: study.cleanToken,
    meanKlExponent: study.meanKlExponent,
    meanKlMantissa: study.meanKlMantissa,
    rateExponent: study.rateExponent,
    rateMantissa: study.rateMantissa,
    predictionHolds: study.predictionHolds,
    whatFlipped: study.whatFlipped,
    n: study.spec.n,
    rows: study.rows.map((r) => ({
      trial: r.trial, nFlip: r.nFlip,
      klExponent: r.klExponent, klMantissa: r.klMantissa,
      exponentChanged: r.exponentChanged, mantissaChanged: r.mantissaChanged,
      tokenExponent: r.tokenExponent, tokenMantissa: r.tokenMantissa,
    })),
  };
}

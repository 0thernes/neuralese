// v12 in-browser fine-tuning of TinyStories-8M on the user's own text. Honest scope: parameter-efficient, 1,536 trainable
// parameters — ln_f gain + bias (2 × 256) and an output gain γ for each of the 1,024 layer-7 MLP neurons — trained with Adam
// on exact gradients (frontier/rsi.js, verified against finite differences in test/v11). The rest of the network is frozen,
// so its activations are computed once per chunk. The user text is split into chunks; every 3rd chunk is HELD OUT and never
// used for training; the held-out cross-entropy before vs after, with a paired bootstrap CI, is the acceptance test.
import { precompute, theta0, evalSet, addTheta, flatTheta } from '../frontier/rsi.js?v=12';
import { bootCI, mean } from '../frontier/core.js?v=12';
export function chunks(ids, len = 48, minLen = 16) { const out = []; for (let i = 0; i + minLen <= ids.length; i += len) out.push(ids.slice(i, i + len)); return out; }
export function split(cs, every = 5) { const train = [], held = []; cs.forEach((c, i) => ((i % every === every - 1) ? held : train).push(c)); return { train, held }; }
export async function fineTune(W, ids, { steps = 6, lr = 1e-2, len = 32, maxChunks = 9, every: heldEvery = 3, onStep = null } = {}) {
  const cs = chunks(ids, len).slice(0, maxChunks); const { train, held } = split(cs, heldEvery); if (train.length < 2 || held.length < 1) throw new Error(`need more text: ${cs.length} chunks of ${len} tokens (≥ 5 chunks, ~${5 * len} tokens)`);
  const pt = train.map((c) => precompute(W, c)), ph = held.map((c) => precompute(W, c)), th0 = theta0(W);
  const b0 = evalSet(W, th0, ph), tr0 = evalSet(W, th0, pt); let th = th0; const opt = { m: null, v: null }; const curve = [{ step: 0, train: tr0.ce, held: b0.ce }];
  for (let s = 1; s <= steps; s++) { th = adamFitFrom(W, th, pt, lr, s, opt); const e = { step: s, held: evalSet(W, th, ph).ce }; curve.push(e); await onStep?.(e); await new Promise((r) => setTimeout(r, 0)); }
  const b1 = evalSet(W, th, ph), diff = b1.perPos.map((x, i) => x - b0.perPos[i]), ci = bootCI(diff, mean, 1000, 3), l2 = Math.sqrt(flatTheta(th).reduce((s, x, i) => s + (x - flatTheta(th0)[i]) ** 2, 0));
  const tr1 = evalSet(W, th, pt).ce; return { theta: th, trainAfter: tr1, params: flatTheta(th).length, trainChunks: train.length, heldChunks: held.length, heldTokens: diff.length, before: b0.ce, after: b1.ce, delta: ci, improved: ci.hi < 0, curve, editL2: l2 };
}
// Edit record for surgery.js ('ft' kind): absolute ln_f, multiplicative neuron gains, so replay from clean weights is exact.
export const toEdit = (r, steps) => ({ kind: 'ft', layer: 7, steps, before: r.before, after: r.after, g: Array.from(r.theta.g), b: Array.from(r.theta.b), gam: Array.from(r.theta.gam) });
// One Adam step that keeps its moments across calls (adamFit in rsi.js restarts them each call).
function adamFitFrom(W, th, pres, lr, s, o) { const { G } = evalSet(W, th, pres, true), P = G.length; o.m ??= new Float64Array(P); o.v ??= new Float64Array(P); const dv = new Array(P);
  for (let i = 0; i < P; i++) { o.m[i] = 0.9 * o.m[i] + 0.1 * G[i]; o.v[i] = 0.999 * o.v[i] + 0.001 * G[i] ** 2; dv[i] = -lr * (o.m[i] / (1 - 0.9 ** s)) / (Math.sqrt(o.v[i] / (1 - 0.999 ** s)) + 1e-8); } return addTheta(th, dv); }

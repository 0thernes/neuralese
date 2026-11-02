// One honest TinyStories-8M pass of the Adversary Lab defaults.
// Writes a small summary. This is not a reproduction of the Lyra paper's AUROCs.
// Usage: node tools/adversary-measure.mjs [out.json]
import fs from 'node:fs';
import { buildWeights, parseSafetensors, CFG } from '../src/model.js';
import { Engine, defaultRuntime } from '../src/engine.js';
import { GPT2Tokenizer } from '../src/tokenizer.js';
import { attachAdversary } from '../src/adversary/campaign.js';

const buf = fs.readFileSync('model/model.safetensors');
const n = Number(buf.readBigUInt64LE(0));
const hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
const W = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr));
const tok = new GPT2Tokenizer(JSON.parse(fs.readFileSync('model/vocab.json', 'utf8')), fs.readFileSync('model/merges.txt', 'utf8'));
const eng = new Engine(W, defaultRuntime());
const adv = attachAdversary({ eng: () => eng, tok: () => tok, cfg: CFG });
const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
const plan = await adv.plan({ nPerm: 200, genTokens: 8, nPairs: 4, steerTokens: 8, magnitude: 5 });
console.log(stamp(), 'locked', plan.prereg.sha256.slice(0, 16), 'trials', plan.trials.length, 'systemLen', plan.trials[0].systemLen);
const geo = await adv.runGeometry(plan);
console.log(stamp(), 'geometry', geo.verdict.label, 'delta', geo.detector.delta.auroc.toFixed(3), 'p', geo.detector.delta.p.toFixed(3), 'enc', geo.detector.encoding.auroc.toFixed(3), 'lopo', geo.detector.lopo.auroc);
const neurons = await adv.runNeurons(plan);
console.log(stamp(), 'neurons', neurons.verdict.pass ? 'pass' : 'fail', neurons.verdict.candidateCount, neurons.verdict.randomCounts.join(','));
const bundle = await adv.finish(plan.prereg, geo, neurons);
const summary = {
  model: 'roneneldan/TinyStories-8M',
  params_note: 'GPT-Neo, 8 layers, d=256, 16 heads, ff=1024. Far below the paper’s 0.5B–70B range.',
  prereg_sha256: bundle.prereg_sha256,
  bundle_sha256: bundle.bundle_sha256,
  settings: { gen_tokens: plan.prereg.gen_tokens, n_permutations: plan.prereg.n_permutations, n_random_sets: plan.prereg.n_random_sets, steer_tokens: plan.prereg.steer_tokens, magnitude: plan.prereg.magnitude, prompts: plan.trials.length / 2 },
  geometry: { verdict: geo.verdict, detector: geo.detector, fwl: { names: geo.fwl.names, kept: geo.fwl.kept, droppedConstant: geo.fwl.droppedConstant }, compliance: geo.compliance },
  neurons: { top: neurons.top.slice(0, 8), candidate: neurons.candidate, magnitude: neurons.magnitude, verdict: neurons.verdict },
  caveats: bundle.results.caveats,
  seconds: (Date.now() - t0) / 1000,
};
const out = process.argv[2] || 'src/adversary/measured-tinystories.json';
fs.writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(stamp(), 'wrote', out);

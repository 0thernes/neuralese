// v16 Arch interface: GPT-Neo, GPT-2 and Llama/Qwen-style blocks match HF transformers (float64 reference, test/ref/ref_arch.py)
// within 1e-4 max |Δlogit| on a real small model for each family. Models are local copies fetched by tools/fetch-arch-models.mjs;
// a family whose weights are absent is reported as skipped, never silently passed.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { archFromHF, readSafetensors, mapWeights, forward } from '../src/arch/arch.js';
const REF = JSON.parse(fs.readFileSync(new URL('./ref/ref_arch.json', import.meta.url)));
const DIRS = { gpt_neo: 'TinyStories-8M', gpt2: 'distilgpt2', llama: 'SmolLM-135M', qwen2: 'Qwen2.5-0.5B' };
const TOL = 1e-4;
for (const [fam, dir] of Object.entries(DIRS)) {
  const p = new URL(`../model/arch/${dir}/`, import.meta.url), have = fs.existsSync(new URL('model.safetensors', p)) && REF[fam];
  test(`ARCH ${fam} (${dir}) logits, hidden states (HF convention: last one is post-final-norm) and attention match HF within ${TOL}`, { skip: have ? false : `model/arch/${dir} or its reference missing` }, () => {
    const A = archFromHF(JSON.parse(fs.readFileSync(new URL('config.json', p)))), W = mapWeights(A, readSafetensors(fs.readFileSync(new URL('model.safetensors', p)))), R = REF[fam];
    const o = forward(A, W, REF.ids, { attn: true }); let mx = 0;
    const last = o.logits[o.logits.length - 1]; for (let i = 0; i < A.V; i++) mx = Math.max(mx, Math.abs(last[i] - R.last[i]));
    R.head.forEach((row, t) => row.forEach((v, i) => { mx = Math.max(mx, Math.abs(o.logits[t][i] - v)); }));
    let mh = 0; R.hidden.forEach((H, l) => H.forEach((row, t) => row.forEach((v, i) => { mh = Math.max(mh, Math.abs((l === A.L ? o.final : o.hidden[l])[t][i] - v)); })));
    let ma = 0; R.attn0.forEach((row, t) => row.forEach((v, s) => { ma = Math.max(ma, Math.abs((o.patterns[0][0][t][s] || 0) - v)); }));
    console.log(`  ${fam}: max|Δlogit| ${mx.toExponential(2)} · max|Δhidden| ${mh.toExponential(2)} · max|Δattn| ${ma.toExponential(2)} (torch f32 vs f64: ${R.f32_vs_f64_maxabs.toExponential(2)})`);
    assert.ok(mx <= TOL, 'logits ' + mx); assert.ok(mh <= TOL, 'hidden ' + mh); assert.ok(ma <= 1e-5, 'attn ' + ma);
  });
}
test('ARCH archFromHF rejects unsupported families loudly', () => { assert.throws(() => archFromHF({ model_type: 'bert' }), /unsupported/); assert.throws(() => archFromHF({ model_type: 'llama', rope_scaling: { rope_type: 'yarn' } }), /not implemented/); });

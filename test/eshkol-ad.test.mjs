// v10 (d): every weight gradient of site/grad.js's analytic backward pass vs Eshkol's reverse-mode tape
// (lib/backend/vm_autodiff.c @341ac81, built by wasm/eshkol_ad/build.sh; golden by tools/eshkol-ad-crosscheck.mjs).
// Tiny config (d=8, H=2, L=2, ff=16, V=13, T=6), seeded weights. grad.js keeps activations in float32, so the bound is
// 1e-5 × max|g| rather than 1e-12.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { grad } from '../grad.js';
import { compare } from '../tsotchke/adcheck.js';
const G = JSON.parse(readFileSync(new URL('../tsotchke/data/eshkol_ad_golden.json', import.meta.url), 'utf8'));
test('D1 grad.js full backward (all 1320 weight gradients + loss) matches Eshkol ad_backward', () => {
  const r = compare(grad, G); console.log(`  eshkol-ad loss ${r.loss} vs ${r.lossGolden}; max|Δg| ${r.err.toExponential(2)} / max|g| ${r.maxAbs.toFixed(3)}; tape ${G.tape} nodes`);
  assert.equal(r.n, 1320); assert.ok(r.ok, JSON.stringify(r)); });
test('D2 the check can fail: one golden gradient entry shifted by 0.01 is rejected', () => {
  const g2 = { ...G, grads: G.grads.slice() }, i = 13 * 8 + 6 * 8; g2.grads[i] += 0.01; assert.equal(compare(grad, g2).ok, false); });

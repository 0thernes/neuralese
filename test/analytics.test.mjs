import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spectrum, kl, jsDivergence, auroc, signFlipP, powerIteration, powerLawFit, effectiveRank, csv } from '../src/analytics.js';

test('diagonal 4 and 2: singular values, condition number, entropy', () => {
  const s = spectrum(Float64Array.from([4, 0, 0, 2]), 2, 2);
  assert.ok(Math.abs(s.singularValues[0] - 4) < 1e-6);
  assert.ok(Math.abs(s.singularValues[1] - 2) < 1e-6);
  assert.ok(Math.abs(s.conditionNumber - 2) < 1e-6);
  // p = (16/20, 4/20) = (0.8, 0.2); H = -0.8 ln 0.8 - 0.2 ln 0.2
  const H = -0.8 * Math.log(0.8) - 0.2 * Math.log(0.2);
  assert.ok(Math.abs(s.spectralEntropyNats - H) < 1e-6);
  assert.ok(Math.abs(s.effectiveRank - Math.exp(H)) < 1e-6);
  assert.equal(s.n, 4);
});

test('power law of 1, 1/2, 1/3, 1/4 has slope -1', () => {
  const fit = powerLawFit([1, 1 / 2, 1 / 3, 1 / 4]);
  assert.ok(Math.abs(fit.slope + 1) < 1e-9);
  assert.ok(Math.abs(fit.r2 - 1) < 1e-9);
  assert.equal(effectiveRank([1, 0]), 1);
});

test('KL, JS, AUROC, and an exact sign-flip p-value', () => {
  assert.equal(kl([0.5, 0.5], [0.5, 0.5]), 0);
  assert.ok(Math.abs(kl([1, 0], [0.5, 0.5]) - Math.log(2)) < 1e-12);
  assert.equal(jsDivergence([0.5, 0.5], [0.5, 0.5]), 0);
  const perfect = auroc([0, 1, 2], [0, 0, 1]);
  assert.equal(perfect.auroc, 1);
  assert.equal(perfect.positives, 1);
  const flip = signFlipP([1, 1, 1]);
  assert.equal(flip.trials, 8);
  assert.equal(flip.p, 0.25);
});

test('power iteration recovers eigenvalue 3 of diag(3, 1)', () => {
  const top = powerIteration((x) => [3 * x[0], x[1]], 2, 40, 2);
  assert.ok(Math.abs(top.lambda - 3) < 1e-6);
  assert.match(csv(['s'], [[1], [2]]), /s\n1\n2\n/);
});

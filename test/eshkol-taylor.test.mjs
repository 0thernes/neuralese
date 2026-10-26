// v10 (b): site/tsotchke/taylor.js vs Eshkol's REAL Taylor kernels (tr_* in lib/core/runtime_taylor.c @341ac81, op-codes
// from lib/core/taylor_recurrences.def), compiled natively by wasm/eshkol_taylor/build.sh, which writes the golden file.
// Fail if any coefficient differs by ≥ 1e-12 (absolute, or relative to |coefficient| when that exceeds 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from '../tsotchke/taylor.js';
const G = JSON.parse(readFileSync(new URL('../tsotchke/data/eshkol_taylor_golden.json', import.meta.url), 'utf8'));
const diffAll = () => T.eshkolDiff(G);
test('E1 taylor.js matches Eshkol tr_* kernels to < 1e-12 on all 44 cases × 17 coefficients', () => {
  const r = diffAll(); console.log('  eshkol-taylor', JSON.stringify(r.worst), JSON.stringify(Object.fromEntries(Object.entries(r.per).map(([k, v]) => [k, +v.toExponential(2)]))));
  assert.equal(r.cases, 44); assert.ok(r.worst.err < 1e-12, `worst ${JSON.stringify(r.worst)}`); });

import { expect, test } from 'bun:test';
import { cosmosData, topNeurons } from '../src/core/cosmos-data';
import type { Trace } from '../src/core/engine-api';
const cfg = { L: 2, H: 2, ff: 3, d: 4 };
const tr = (k: number): Trace => ({ tok: k, t: k, slotLayer: [0, 1], resid_pre: [new Float32Array([3, 4, 0, 0]), new Float32Array(4)], resid_post: [new Float32Array([0, 0, 6, 8]), new Float32Array([1, 0, 0, 0])], z: [new Float32Array([3, 4, 0, 1]), new Float32Array([0, 0, 0, 0])], mlp_act: [new Float32Array([1, -5, 2]), new Float32Array([0, 0, k])], attn_out: [], mlp_out: [], pattern: [] });
test('cosmos derives neuron, head and residual magnitudes from traces only', () => {
  expect(cosmosData([], cfg)).toBeNull();
  const c = cosmosData([tr(0), tr(7)], cfg)!;
  expect(c.token).toBe(1); expect(Array.from(c.neurons)).toEqual([1, -5, 2, 0, 0, 7]); expect(c.maxNeuron).toBe(7);
  expect(c.heads[0]).toBeCloseTo(5); expect(c.heads[1]).toBeCloseTo(1); expect(c.resid[0]).toBeCloseTo(5); expect(c.resid[2]).toBeCloseTo(10); expect(c.resid[2 * 2 + 1]).toBeCloseTo(1);
  expect(topNeurons(c, 0, 2).map((r) => r.n)).toEqual([1, 2]);
});

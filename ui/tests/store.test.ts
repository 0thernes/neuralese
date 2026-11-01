import { describe, expect, test } from 'bun:test';
import { createSelection, validate, DEFAULT_SEL } from '../src/core/selection';
const B = { L: 8, H: 16, ff: 1024 };
describe('selection store', () => {
  test('notifies subscribers with prev/next and skips no-op sets', () => {
    const s = createSelection(B); const log: string[] = [];
    s.subscribe((n, p) => log.push(`${p.layer}->${n.layer}`)); s.set({ layer: 3 }); s.set({ layer: 3 }); s.set({ layer: 5 });
    expect(log).toEqual(['0->3', '3->5']);
  });
  test('neuron and head are mutually exclusive', () => {
    const s = createSelection(B); s.set({ neuron: 12 }); expect(s.get().head).toBeNull(); s.set({ head: 2 }); expect(s.get().neuron).toBeNull();
  });
  test('rejects out-of-range indices and leaves state untouched', () => {
    const s = createSelection(B); expect(() => s.set({ layer: 8 })).toThrow(RangeError); expect(() => s.set({ neuron: 1024 })).toThrow(); expect(() => s.set({ head: -1 })).toThrow(); expect(s.get()).toEqual(DEFAULT_SEL);
  });
  test('validate reports every problem', () => { expect(validate({ ...DEFAULT_SEL, layer: 9, head: 99, token: -2 }, B)).toHaveLength(3); });
  test('silent sets do not notify; unsubscribe works', () => {
    const s = createSelection(B); let n = 0; const off = s.subscribe(() => n++); s.set({ layer: 1 }, { silent: true }); off(); s.set({ layer: 2 }); expect(n).toBe(0); expect(s.get().layer).toBe(2);
  });
});

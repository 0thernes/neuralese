import { expect, test } from 'bun:test';
import { newNotebook, parseNotebook, drift, toHTML } from '../src/core/notebook';
const pin = { app: '17.0.0', commit: 'abc', weightsSha256: 'w1', preregSha256: null, bundleSha256: null, prompt: 'Once' };
test('notebooks round-trip, reject foreign JSON, report drift and escape HTML', () => {
  const nb = newNotebook('<t>', pin, new Date(0)); expect(parseNotebook(JSON.stringify(nb))).toEqual(nb);
  expect(() => parseNotebook('{"v":2}')).toThrow(); expect(() => parseNotebook(JSON.stringify({ ...nb, cells: [{ id: 'x', kind: 'chart', source: 'fake', layer: 0 }] }))).toThrow();
  expect(drift(pin, { ...pin, weightsSha256: 'w2', prompt: 'x' })).toHaveLength(2); expect(drift(pin, pin)).toEqual([]);
  const h = toHTML(nb, {}); expect(h).toContain('&lt;t&gt;'); expect(h).toContain('was not rendered');
});

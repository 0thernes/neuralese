import { describe, expect, test } from 'bun:test';
import { tabs, split, splitPanel, closePanel, addPanel, movePanel, resize, panels, serialize, deserialize, ensurePanels, find, type Node } from '../src/core/layout';
import { WORKSPACES, allLegacy, panelsOf } from '../src/core/workspaces';
describe('layout tree', () => {
  test('split moves a panel into a new group without losing any', () => {
    const g = tabs(['a', 'b', 'c']); const r = splitPanel(g, g.id, 'b', 'right');
    expect(r.kind).toBe('split'); expect(panels(r).sort()).toEqual(['a', 'b', 'c']); expect(r.kind === 'split' && r.dir).toBe('row');
    expect(() => splitPanel(tabs(['x']), 'nope', 'x', 'left')).toThrow('no panel');
  });
  test('closing the last panel of a group collapses the split', () => {
    const r = split('row', [tabs(['a']), tabs(['b', 'c'])]); const c = closePanel(r, 'a') as Node;
    expect(c.kind).toBe('tabs'); expect(panels(c)).toEqual(['b', 'c']); expect(closePanel(tabs(['z']), 'z')).toBeNull();
  });
  test('move, add (idempotent) and resize (normalised, clamped)', () => {
    const a = tabs(['a', 'b']), b = tabs(['c']); let r = split('col', [a, b]);
    r = movePanel(r, 'b', b.id); expect((find(r, b.id) as { panels: string[] }).panels).toEqual(['c', 'b']);
    r = addPanel(r, 'c'); expect(panels(r).filter((p) => p === 'c')).toHaveLength(1);
    r = resize(r, r.id, [0, 3]); const s = (r as { sizes: number[] }).sizes; expect(s[0]! + s[1]!).toBeCloseTo(1); expect(s[0]!).toBeGreaterThan(0.02);
    expect(() => resize(r, r.id, [1])).toThrow();
  });
  test('save/load round trip; corrupt or foreign layouts are rejected; unknown panels are pruned', () => {
    const r = split('row', [tabs(['a', 'gone']), tabs(['b'])]); const known = new Set(['a', 'b']);
    expect(panels(deserialize(serialize(r), known)!)).toEqual(['a', 'b']);
    expect(deserialize('{bad', known)).toBeNull(); expect(deserialize(JSON.stringify({ v: 99, n: r }), known)).toBeNull(); expect(deserialize(JSON.stringify({ v: 1, n: { kind: 'x' } }), known)).toBeNull();
    expect(panels(ensurePanels(tabs(['a']), ['a', 'b']))).toEqual(['a', 'b']);
  });
  test('workspaces: 75 legacy tabs, each exactly once, 13 workspaces; default layouts contain every panel', () => {
    const all = allLegacy(); expect(all).toHaveLength(75); expect(new Set(all).size).toBe(75); expect(WORKSPACES).toHaveLength(13);
    expect(WORKSPACES.map((w) => w.id)).toContain('adversary'); expect(WORKSPACES.find((w) => w.id === 'adversary')?.legacy).toEqual([]);
    expect(WORKSPACES.map((w) => w.id)).toContain('forge'); expect(WORKSPACES.find((w) => w.id === 'forge')?.legacy).toEqual([]);
    expect(WORKSPACES.map((w) => w.id)).toContain('walk'); expect(WORKSPACES.find((w) => w.id === 'walk')?.legacy).toEqual([]);
    expect(WORKSPACES.map((w) => w.id)).toContain('machine'); expect(WORKSPACES.find((w) => w.id === 'machine')?.legacy).toEqual([]);
    for (const w of WORKSPACES) expect(panels(w.layout()).sort()).toEqual(panelsOf(w).sort());
  });
});

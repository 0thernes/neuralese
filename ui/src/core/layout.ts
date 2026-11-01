// Dockable, splittable panel layout as an immutable tree. Pure functions → unit-tested; persisted per workspace.
export type Node = { kind: 'tabs'; id: string; panels: string[]; active: number } | { kind: 'split'; id: string; dir: 'row' | 'col'; sizes: number[]; children: Node[] };
let seq = 0; export const nid = (p = 'n'): string => `${p}${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const tabs = (panels: string[], active = 0): Node => ({ kind: 'tabs', id: nid('t'), panels, active });
export const split = (dir: 'row' | 'col', children: Node[], sizes?: number[]): Node => ({ kind: 'split', id: nid('s'), dir, children, sizes: sizes ?? children.map(() => 1 / children.length) });
export function panels(n: Node): string[] { return n.kind === 'tabs' ? [...n.panels] : n.children.flatMap(panels); }
export function find(n: Node, id: string): Node | null { if (n.id === id) return n; if (n.kind === 'split') for (const c of n.children) { const f = find(c, id); if (f) return f; } return null; }
function map(n: Node, f: (n: Node) => Node | null): Node | null {
  const m = f(n); if (m !== n) return m;
  if (n.kind === 'tabs') return n;
  const kids = n.children.map((c) => map(c, f)); const keep = kids.map((k, i) => [k, n.sizes[i] ?? 0] as const).filter((x): x is readonly [Node, number] => x[0] !== null);
  if (!keep.length) return null; if (keep.length === 1) return keep[0]![0];
  const tot = keep.reduce((a, x) => a + x[1], 0) || 1;
  return { ...n, children: keep.map((x) => x[0]), sizes: keep.map((x) => x[1] / tot) };
}
// Split a tab group: move `panel` out of group `gid` into a new group placed on `side`.
export function splitPanel(root: Node, gid: string, panel: string, side: 'left' | 'right' | 'top' | 'bottom'): Node {
  const g = find(root, gid); if (!g || g.kind !== 'tabs' || !g.panels.includes(panel)) throw new Error(`no panel ${panel} in ${gid}`);
  if (g.panels.length < 2) return root;
  return map(root, (n) => {
    if (n.id !== gid || n.kind !== 'tabs') return n;
    const rest: Node = { ...n, panels: n.panels.filter((p) => p !== panel), active: 0 }, fresh = tabs([panel]);
    const dir = side === 'left' || side === 'right' ? 'row' : 'col';
    return split(dir, side === 'left' || side === 'top' ? [fresh, rest] : [rest, fresh]);
  }) as Node;
}
export function closePanel(root: Node, panel: string): Node | null {
  return map(root, (n) => (n.kind === 'tabs' && n.panels.includes(panel) ? (n.panels.length === 1 ? null : { ...n, panels: n.panels.filter((p) => p !== panel), active: 0 }) : n));
}
export function addPanel(root: Node, panel: string, gid?: string): Node {
  if (panels(root).includes(panel)) return activate(root, panel);
  const target = gid ? find(root, gid) : firstTabs(root);
  return map(root, (n) => (n === target && n.kind === 'tabs' ? { ...n, panels: [...n.panels, panel], active: n.panels.length } : n)) as Node;
}
export function movePanel(root: Node, panel: string, toGid: string): Node {
  if (!find(root, toGid)) throw new Error(`no group ${toGid}`);
  const t = find(root, toGid); if (t?.kind === 'tabs' && t.panels.includes(panel)) return root;
  const without = closePanel(root, panel); if (!without) return tabs([panel]);
  return find(without, toGid) ? addPanel(without, panel, toGid) : addPanel(without, panel);
}
export function activate(root: Node, panel: string): Node { return map(root, (n) => (n.kind === 'tabs' && n.panels.includes(panel) ? { ...n, active: n.panels.indexOf(panel) } : n)) as Node; }
export function resize(root: Node, sid: string, sizes: number[]): Node {
  return map(root, (n) => {
    if (n.id !== sid || n.kind !== 'split') return n;
    if (sizes.length !== n.children.length) throw new Error('sizes length mismatch');
    const c = sizes.map((s) => Math.max(0.08, s)), t = c.reduce((a, b) => a + b, 0); return { ...n, sizes: c.map((s) => s / t) };
  }) as Node;
}
function firstTabs(n: Node): Node | null { return n.kind === 'tabs' ? n : n.children.map(firstTabs).find(Boolean) ?? null; }
// Persistence: versioned, validated; unknown panels are dropped, so an old saved layout can never hide a feature.
export const LAYOUT_VERSION = 1;
export function isNode(x: unknown): x is Node {
  if (!x || typeof x !== 'object') return false; const n = x as Record<string, unknown>;
  if (n.kind === 'tabs') return typeof n.id === 'string' && Array.isArray(n.panels) && n.panels.every((p) => typeof p === 'string') && typeof n.active === 'number';
  if (n.kind === 'split') return typeof n.id === 'string' && (n.dir === 'row' || n.dir === 'col') && Array.isArray(n.children) && Array.isArray(n.sizes) && n.children.length === n.sizes.length && n.children.every(isNode);
  return false;
}
export function serialize(n: Node): string { return JSON.stringify({ v: LAYOUT_VERSION, n }); }
export function deserialize(s: string | null, known: Set<string>): Node | null {
  if (!s) return null; let o: unknown; try { o = JSON.parse(s); } catch { return null; }
  const r = o as { v?: number; n?: unknown }; if (r?.v !== LAYOUT_VERSION || !isNode(r.n)) return null;
  const pruned = map(r.n, (n) => (n.kind === 'tabs' ? (n.panels.some((p) => !known.has(p)) ? (n.panels.filter((p) => known.has(p)).length ? { ...n, panels: n.panels.filter((p) => known.has(p)), active: 0 } : null) : n) : n));
  return pruned;
}
// Make sure every required panel is present (a saved layout may predate a new panel).
export function ensurePanels(n: Node, required: string[]): Node { let r = n; for (const p of required) if (!panels(r).includes(p)) r = addPanel(r, p); return r; }

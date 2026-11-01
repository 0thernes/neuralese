// Global typed selection: one source of truth that every panel reads. Framework-agnostic core (unit-tested);
// the Solid binding lives in store.ts. Indices are validated against the model config so a panel can never
// select a head or neuron that does not exist.
export interface Selection { model: string; prompt: string; token: number | null; layer: number; head: number | null; neuron: number | null }
export interface Bounds { L: number; H: number; ff: number }
export const DEFAULT_SEL: Selection = { model: 'TinyStories-8M', prompt: '', token: null, layer: 0, head: 0, neuron: null };
type Listener = (s: Selection, prev: Selection) => void;
const inRange = (v: number | null, n: number): boolean => v === null || (Number.isInteger(v) && v >= 0 && v < n);
export function validate(s: Selection, b: Bounds): string[] {
  const e: string[] = [];
  if (!inRange(s.layer, b.L)) e.push(`layer ${s.layer} outside 0..${b.L - 1}`);
  if (!inRange(s.head, b.H)) e.push(`head ${s.head} outside 0..${b.H - 1}`);
  if (!inRange(s.neuron, b.ff)) e.push(`neuron ${s.neuron} outside 0..${b.ff - 1}`);
  if (s.token !== null && !(Number.isInteger(s.token) && s.token >= 0)) e.push(`token ${s.token} invalid`);
  return e;
}
export function createSelection(bounds: Bounds, init: Partial<Selection> = {}) {
  let cur: Selection = { ...DEFAULT_SEL, ...init };
  const ls = new Set<Listener>();
  return {
    get: (): Selection => cur,
    set(patch: Partial<Selection>, opts: { silent?: boolean } = {}): Selection {
      const nx = { ...cur, ...patch };
      // choosing a neuron clears the head and vice versa (the legacy inspector shows one unit at a time)
      if (patch.neuron != null && patch.head === undefined) nx.head = null;
      if (patch.head != null && patch.neuron === undefined) nx.neuron = null;
      const err = validate(nx, bounds); if (err.length) throw new RangeError(err.join('; '));
      if (JSON.stringify(nx) === JSON.stringify(cur)) return cur;
      const prev = cur; cur = nx; if (!opts.silent) for (const f of ls) f(cur, prev); return cur;
    },
    subscribe(f: Listener): () => void { ls.add(f); return () => ls.delete(f); },
    setBounds(b: Bounds): void { bounds = b; },
  };
}
export type SelectionStore = ReturnType<typeof createSelection>;

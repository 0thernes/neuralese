// Notebook / report documents. Cells hold *recipes* (which live data source to chart), never baked numbers, so a
// reopened notebook recomputes from the current engine; the pinned fingerprint shows whether that is still the same
// model state (weights SHA-256, app version, commit) and, optionally, which pre-registration / REPRO bundle it belongs to.
export type Source = 'resid' | 'heads' | 'neurons';
export type Cell = { id: string; kind: 'md'; text: string } | { id: string; kind: 'chart'; source: Source; layer: number } | { id: string; kind: 'table'; layer: number } | { id: string; kind: 'repro' };
export interface Fingerprint { app: string; commit: string | null; weightsSha256: string | null; preregSha256: string | null; bundleSha256: string | null; prompt: string }
export interface Notebook { v: 1; id: string; title: string; created: string; cells: Cell[]; pin: Fingerprint }
export const newId = (): string => Math.random().toString(36).slice(2, 10);
export function newNotebook(title: string, pin: Fingerprint, now = new Date()): Notebook {
  return { v: 1, id: newId(), title, created: now.toISOString(), pin, cells: [{ id: newId(), kind: 'md', text: 'Question, method and pre-registered threshold go here.' }, { id: newId(), kind: 'chart', source: 'resid', layer: 0 }, { id: newId(), kind: 'repro' }] };
}
const isCell = (c: unknown): c is Cell => { const x = c as Record<string, unknown>; if (!x || typeof x.id !== 'string') return false;
  return (x.kind === 'md' && typeof x.text === 'string') || (x.kind === 'chart' && ['resid', 'heads', 'neurons'].includes(x.source as string) && Number.isInteger(x.layer)) || (x.kind === 'table' && Number.isInteger(x.layer)) || x.kind === 'repro'; };
export function parseNotebook(s: string): Notebook {
  const o = JSON.parse(s) as Partial<Notebook>; if (o.v !== 1 || typeof o.title !== 'string' || !Array.isArray(o.cells) || !o.cells.every(isCell) || !o.pin) throw new Error('not a NEURALESE v17 notebook');
  return o as Notebook;
}
export function drift(pin: Fingerprint, now: Fingerprint): string[] {
  const d: string[] = []; if (pin.weightsSha256 && now.weightsSha256 && pin.weightsSha256 !== now.weightsSha256) d.push('weights changed since this notebook was pinned');
  if (pin.app !== now.app) d.push(`pinned on ${pin.app}, now ${now.app}`); if (pin.prompt !== now.prompt) d.push('prompt differs'); return d;
}
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
// Static HTML report: text cells escaped, charts embedded as PNG snapshots taken from the live canvases.
export function toHTML(nb: Notebook, images: Record<string, string>): string {
  const body = nb.cells.map((c) => c.kind === 'md' ? `<p>${esc(c.text).replace(/\n/g, '<br>')}</p>` : c.kind === 'repro' ? `<pre>${esc(JSON.stringify(nb.pin, null, 2))}</pre>` : images[c.id] ? `<figure><img alt="${c.kind} ${esc(String((c as { source?: string }).source ?? 'table'))} layer ${(c as { layer: number }).layer}" src="${images[c.id]}"></figure>` : `<p><em>${c.kind} cell (layer ${(c as { layer: number }).layer}) was not rendered when exported</em></p>`).join('\n');
  return `<!doctype html><meta charset="utf-8"><title>${esc(nb.title)}</title><h1>${esc(nb.title)}</h1><p>created ${esc(nb.created)}</p>\n${body}\n`;
}

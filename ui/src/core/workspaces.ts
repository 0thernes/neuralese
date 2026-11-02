// The 75 v16 tabs stay in the original 9 workspaces. Every legacy tab key appears exactly once.
// v17.1 adds a tenth workspace, Adversary, with native panels only (no legacy tabs moved).
// Alt+1…9 keep their keys. Adversary is Alt+0 so the phone bar does not rename the older labels.
import { split, tabs, type Node } from './layout';
export interface Workspace { id: string; title: string; key: string; blurb: string; legacy: string[]; native: string[]; layout: () => Node }
const L = (k: string): string => `legacy:${k}`;
const ws = (id: string, title: string, key: string, blurb: string, legacy: string[], native: string[], shape: (p: string[]) => Node): Workspace => ({ id, title, key, blurb, legacy, native, layout: () => shape([...native, ...legacy.map(L)]) });
// default shape: native panels left, legacy tabs right
const two = (nNative: number) => (p: string[]): Node => (nNative ? split('row', [tabs(p.slice(0, nNative)), tabs(p.slice(nNative))], [0.5, 0.5]) : tabs(p));
export const WORKSPACES: Workspace[] = [
  ws('overview', 'Overview', '1', 'Generate, compare hacked vs clean, and see the whole model at once.', ['home', 'v16', 'gen', 'ctrl', 'audio', 'timeline', 'runs'], ['cosmos', 'output', 'selection'], (p) => split('row', [split('col', [tabs(['cosmos', 'selection']), tabs(['output'])], [0.6, 0.4]), tabs(p.slice(3))], [0.52, 0.48])),
  ws('model', 'Model', '2', 'Architecture, parameters, weights, embeddings, performance and backends.', ['arch', 'params', 'weights', 'embed', 'gpu', 'zoo', 'prof', 'viz', 'v3d'], ['cosmos'], two(1)),
  ws('lens', 'Lens', '3', 'Logit/tuned lens, residual stream, neurons, SAEs and neuron lenses.', ['an', 'resid', 'neurons', 'nlens', 'nlval', 'nlext', 'sae', 'saed'], ['selection'], two(1)),
  ws('circuits', 'Circuits', '4', 'Attention, circuits, head roles, ACDC, probes, geometry and loss landscape.', ['attn', 'circuit', 'heads', 'acdc', 'probe', 'geom', 'land'], ['selection'], two(1)),
  ws('interventions', 'Interventions', '5', 'Steering, causal patching, surgery, runtime edits, sweeps, gradients and drills.', ['steer', 'causal', 'surg', 'rt', 'sweep', 'ops', 'impact', 'calib', 'grad', 'drill'], [], two(0)),
  ws('experiments', 'Experiments', '6', 'Pre-registration, REPRO bundles, statistics, data, evals, notebooks and reports.', ['repro', 'stats', 'data', 'evalh', 'nb', 'report', 'log', 'share'], ['notebook'], two(1)),
  ws('hub', 'Hub', '7', 'Other Hugging Face models: text, vision, speech encoders and fine-tuning.', ['hub', 'hinterp', 'hemb', 'hspeech', 'hvision', 'hgen', 'hft'], [], two(0)),
  ws('frontier', 'Nested & Frontier', '8', 'Nested RISC-V / SLM-in-SLM / MoE-in-MoE, pre-registered frontier studies, Tsotchke components.', ['nriscv', 'nslm', 'nmoe', 'nxlens', 'fx', 'fsc', 'fmind', 'frsi', 'fgrok', 'fatlas', 'fclaims', 'tsk', 'qrng', 'qgeom', 'types', 'taylor', 'claims'], ['nested3d'], two(1)),
  ws('learn', 'Learn', '9', 'Course, glossary and the terminal.', ['learn', 'term'], [], two(0)),
  ws('adversary', 'Adversary', '0', 'Experimental key-cache geometry and MLP-unit comparison. Not a detector. Small models often show a null.', [], ['adv-live', 'adv-run', 'adv-det', 'adv-hunt', 'adv-steer', 'adv-repro', 'selection'], (p) => split('row', [split('col', [tabs(p.slice(0, 3)), tabs(p.slice(3, 5))], [0.58, 0.42]), split('col', [tabs(p.slice(5, 6)), tabs(p.slice(6))], [0.62, 0.38])], [0.62, 0.38])),
];
export const NATIVE_PANELS: Record<string, string> = {
  cosmos: 'Model cosmos (3D)', nested3d: 'Nested experiments (3D)', notebook: 'Notebook / report', selection: 'Selection & inspector', output: 'Generation output',
  'adv-live': 'Live geometry', 'adv-run': 'Condition runner', 'adv-det': 'Detector results', 'adv-hunt': 'Neuron hunt', 'adv-steer': 'Steering compare', 'adv-repro': 'Prereg & REPRO',
};
export function workspaceOfLegacy(k: string): Workspace | undefined { return WORKSPACES.find((w) => w.legacy.includes(k)); }
export function allLegacy(): string[] { return WORKSPACES.flatMap((w) => w.legacy); }
export function panelsOf(w: Workspace): string[] { return [...w.native, ...w.legacy.map(L)]; }

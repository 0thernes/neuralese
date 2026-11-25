// Rebuild features.json and features/releases/*.json from the source tree.
// Adding a feature: give it a since-version below, run this, commit both the source and the JSON.
// Do not delete an id that an older release file already lists. tools/check-features.mjs is the gate.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const ver = JSON.parse(read('package.json')).version;

const TAB_SINCE = {
  home: '15.0.0', v16: '16.0.0', hinterp: '16.0.1',
  nlens: '14.0.0', nlval: '14.0.0', nlext: '14.9.0',
  nriscv: '14.9.0', nslm: '14.9.0', nmoe: '14.9.0', nxlens: '14.9.0',
};
const TAB_TITLE = {
  home: 'Overview dashboard', v16: 'Architecture interface', gen: 'Generate', steer: 'Steering', ctrl: 'Control vectors', audio: 'Audio sonification',
  arch: 'Architecture', params: 'Parameters', weights: 'Weights', embed: 'Embeddings', gpu: 'WebGPU benchmark', zoo: 'Model zoo', prof: 'Profiler', viz: '3D stage', v3d: '3D modes',
  an: 'Analyze / logit lens', attn: 'Attention', resid: 'Residual stream', circuit: 'Circuits', neurons: 'Neuron atlas', sae: 'Sparse autoencoder', saed: 'SAE dashboard',
  nlens: 'Neuron Lens', nlval: 'Lens validation', nlext: 'Lens catalog',
  causal: 'Causal patching', surg: 'Weight surgery', rt: 'Runtime program', sweep: 'Sweeps', ops: 'Edit history', impact: 'Impact', calib: 'Calibration', grad: 'Gradients', drill: 'Drill',
  timeline: 'Timeline', runs: 'Runs', heads: 'Head roles', geom: 'Geometry', land: 'Loss landscape', acdc: 'ACDC', probe: 'Probes',
  repro: 'REPRO bundle', stats: 'Statistics', data: 'Dataset', evalh: 'Eval scoreboard', nb: 'Notebook cells', report: 'Report', log: 'Run log', share: 'Share link',
  hub: 'Model hub', hinterp: 'Encoder interpretability', hemb: 'Sentence embeddings', hspeech: 'Speech', hvision: 'Vision', hgen: 'Swappable language models', hft: 'Fine-tune',
  nriscv: 'RISC-V in a transformer', nslm: 'SLM in an SLM', nmoe: 'MoE in an MoE', nxlens: 'Nested lenses',
  fx: 'Frontier hypotheses', fsc: 'Consciousness-indicator scorecard', fmind: 'PCI / introspection proxies', frsi: 'Self-improvement loop', fgrok: 'Grokking', fatlas: 'Causal atlas', fclaims: 'Frontier claim checks',
  tsk: 'Tsotchke overview', qrng: 'QRNG simulation', qgeom: 'Quantum geometry', types: 'Eshkol types', taylor: 'Taylor jets', claims: 'Claims and evidence',
  term: 'Terminal', learn: 'Learning center',
};
const PANEL_SINCE = { cosmos: '17.0.0', nested3d: '17.0.0', notebook: '17.0.0', selection: '17.0.0', output: '17.0.0' };
const PANEL_TITLE = {
  cosmos: 'Model cosmos', nested3d: 'Nested experiments', notebook: 'Notebook / report', selection: 'Selection inspector', output: 'Generation output',
  'adv-live': 'Live geometry', 'adv-run': 'Condition runner', 'adv-det': 'Detector results', 'adv-hunt': 'Neuron hunt', 'adv-steer': 'Steering compare', 'adv-repro': 'Adversary prereg',
  'forge-prog': 'NestLang', 'forge-cpu': 'Forge CPU', 'forge-mem': 'Forge memory', 'forge-trace': 'Token lanes', 'forge-mdcc': 'WeightCPU / MDCC', 'forge-repro': 'Forge REPRO',
  'walk-stage': 'Deep walk stage', 'walk-read': 'Walk narration', 'walk-cell': 'Cell arithmetic', 'walk-zoom': 'Zoom ladder', 'walk-fault': 'Fault study', 'walk-forge': 'Forge gates',
  'wm-room': 'Machine Room board', 'wm-control': 'Machine cycle', 'wm-io': 'Console and framebuffer', 'wm-packets': 'Packets', 'wm-zoom': 'Gadget zoom', 'wm-report': 'Exact match',
};
function panelSince(id) {
  if (PANEL_SINCE[id]) return PANEL_SINCE[id];
  if (id.startsWith('adv-')) return '17.1.0';
  if (id.startsWith('forge-') || id.startsWith('walk-')) return '17.2.0';
  if (id.startsWith('wm-')) return '17.3.0';
  throw new Error('no since for panel ' + id);
}

const wsSrc = read('ui/src/core/workspaces.ts');
const wsRe = /ws\('([^']+)', '([^']+)', '([^']*)', '([^']*)', \[([^\]]*)\], \[([^\]]*)\]/g;
const workspaces = [];
let m;
while ((m = wsRe.exec(wsSrc))) {
  const keys = (s) => [...s.matchAll(/'([^']+)'/g)].map((x) => x[1]);
  workspaces.push({ id: m[1], title: m[2], blurb: m[4], legacy: keys(m[5]), native: keys(m[6]) });
}
const WS_SINCE = { overview: '17.0.0', model: '17.0.0', lens: '17.0.0', circuits: '17.0.0', interventions: '17.0.0', experiments: '17.0.0', hub: '17.0.0', frontier: '17.0.0', learn: '17.0.0', adversary: '17.1.0', forge: '17.2.0', walk: '17.2.0', machine: '17.3.0' };
const tabWs = new Map();
for (const w of workspaces) for (const k of w.legacy) tabWs.set(k, w.id);

const lab = read('src/lab-ui.js');
const groups = [...lab.matchAll(/\['([^']+)',\s*\[([^\]]*)\]\]/g)].map((g) => [g[1], [...g[2].matchAll(/'([^']+)'/g)].map((x) => x[1])]);
const tabs = groups.flatMap((g) => g[1]);

const nativeBlock = wsSrc.match(/export const NATIVE_PANELS[^=]*= \{([\s\S]*?)\};/);
if (!nativeBlock) throw new Error('NATIVE_PANELS missing');
const natives = [...nativeBlock[1].matchAll(/(?:'([^']+)'|([A-Za-z0-9-]+))\s*:/g)].map((x) => x[1] || x[2]);

const features = [];
const add = (f) => features.push({ ...f, testId: 'feature-' + f.id.replaceAll('.', '-') });

for (const w of workspaces) add({ id: `ws.${w.id}`, title: `${w.title} workspace`, kind: 'workspace', route: w.id, since: WS_SINCE[w.id], workspace: w.id, panel: '' });
for (const [group, keys] of groups) for (const k of keys) {
  const ws = tabWs.get(k);
  if (!ws) throw new Error('tab ' + k + ' is not in a workspace');
  add({ id: `tab.${k}`, title: TAB_TITLE[k] || k, kind: 'tab', route: `${ws}/legacy:${k}`, since: TAB_SINCE[k] || '12.1.0', workspace: ws, panel: `legacy:${k}`, group });
}
for (const id of natives) {
  const ws = workspaces.find((w) => w.native.includes(id));
  if (!ws) throw new Error('native panel ' + id + ' is not in a workspace');
  add({ id: `panel.${id}`, title: PANEL_TITLE[id] || id, kind: 'panel', route: `${ws.id}/${id}`, since: panelSince(id), workspace: ws.id, panel: id });
}
const actions = [
  ['undo', 'Undo', '12.1.0'], ['redo', 'Redo', '12.1.0'], ['dense', 'Dense layout', '15.0.0'],
  ['theme', 'Light / dark theme', '12.1.0'], ['keys', 'Shortcut overlay', '12.1.0'],
  ['palette', 'Command palette', '15.3.0'], ['palette-legacy', 'Legacy command palette', '12.1.0'],
];
for (const [id, title, since] of actions) add({ id: `action.${id}`, title, kind: 'action', route: `action/${id}`, since, workspace: '', panel: '' });

const caps = [
  ['lens.r-out', 'R.out lens', '14.0.0', 'lens/legacy:nlens', 'lens', 'legacy:nlens', 'out·R'],
  ['lens.r-mid', 'R.mid lens', '14.0.0', 'lens/legacy:nlens', 'lens', 'legacy:nlens', 'in·R'],
  ['lens.s-out', 'S.out lens', '14.0.0', 'lens/legacy:nlens', 'lens', 'legacy:nlens', 'out·S'],
  ['lens.s-mid', 'S.mid lens', '14.0.0', 'lens/legacy:nlens', 'lens', 'legacy:nlens', 'in·S'],
  ['lens.logit', 'Logit lens baseline', '12.1.0', 'lens/legacy:an', 'lens', 'legacy:an', 'logit'],
  ['hub.speech', 'Speech models', '12.1.0', 'hub/legacy:hspeech', 'hub', 'legacy:hspeech', 'Whisper'],
  ['hub.vision', 'Vision models', '12.1.0', 'hub/legacy:hvision', 'hub', 'legacy:hvision', 'CLIP'],
  ['hub.swap', 'Swappable LM', '12.1.0', 'hub/legacy:hgen', 'hub', 'legacy:hgen', 'DistilGPT'],
  ['zoo.tinystories', 'TinyStories 1M / 3M / 8M', '12.1.0', 'model/legacy:zoo', 'model', 'legacy:zoo', 'TinyStories'],
  ['frontier.scorecard', 'Consciousness-indicator scorecard', '12.1.0', 'frontier/legacy:fsc', 'frontier', 'legacy:fsc', 'indicator'],
  ['frontier.mind', 'PCI and introspection proxies', '12.1.0', 'frontier/legacy:fmind', 'frontier', 'legacy:fmind', 'PCI'],
  ['frontier.rsi', 'Self-improvement loop', '12.1.0', 'frontier/legacy:frsi', 'frontier', 'legacy:frsi', 'self-improvement'],
  ['view.stage', 'Adaptive 3D stage (bloom, depth of field, GPU tier)', '15.1.0', 'model/legacy:viz', 'model', 'legacy:viz', 'bloom'],
  ['view.modes', '3D modes (field, surface, manifold, attention, circuit)', '12.1.0', 'model/legacy:v3d', 'model', 'legacy:v3d', 'fit to view'],
];
for (const [id, title, since, route, workspace, panel, expect] of caps) add({ id: `cap.${id}`, title, kind: 'capability', route, since, workspace, panel, expect });

const cmp = (a, b) => a.localeCompare(b);
features.sort((a, b) => cmp(a.id, b.id));
const ids = new Set(features.map((f) => f.id));
if (ids.size !== features.length) throw new Error('duplicate feature id');

const sem = (s) => s.split('.').map((n) => Number(n));
const le = (a, b) => { const x = sem(a), y = sem(b); for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] < y[i]; } return true; };

const doc = { version: ver, rule: 'never-subtract', features };
fs.writeFileSync(path.join(root, 'features.json'), JSON.stringify(doc, null, 2) + '\n');
const relDir = path.join(root, 'features', 'releases');
fs.mkdirSync(relDir, { recursive: true });
const releases = ['12.1.0', '13.0.1', '14.0.0', '14.9.0', '15.3.0', '16.0.1', '17.0.0', '17.1.0', '17.2.0', '17.3.0'];
for (const r of releases) {
  const subset = features.filter((f) => le(f.since, r));
  fs.writeFileSync(path.join(relDir, `v${r}.json`), JSON.stringify({ version: r, rule: 'never-subtract', features: subset }, null, 2) + '\n');
}
console.log(`features.json: ${features.length} (tabs ${tabs.length}, panels ${natives.length}, workspaces ${workspaces.length})`);

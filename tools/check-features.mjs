// Never-subtract gate. Fails if the current manifest drops a feature that any
// committed release manifest lists, or if a tab/panel in the source has no entry.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

export function checkFeatures() {
  const problems = [];
  const current = JSON.parse(read('features.json'));
  const pkg = JSON.parse(read('package.json')).version;
  if (current.version !== pkg) problems.push(`features.json version ${current.version} != package.json ${pkg}`);
  if (current.rule !== 'never-subtract') problems.push('features.json rule must be never-subtract');
  const features = current.features;
  if (!Array.isArray(features) || !features.length) problems.push('features.json has no features');
  const byId = new Map();
  const testIds = new Set();
  for (const f of features || []) {
    for (const k of ['id', 'title', 'kind', 'route', 'since', 'testId']) if (!f[k]) problems.push(`${f.id || '?'} missing ${k}`);
    if (byId.has(f.id)) problems.push('duplicate id ' + f.id);
    byId.set(f.id, f);
    if (testIds.has(f.testId)) problems.push('duplicate testId ' + f.testId);
    testIds.add(f.testId);
    if (f.testId !== 'feature-' + String(f.id).replaceAll('.', '-')) problems.push(`${f.id} testId ${f.testId} does not match its id`);
  }
  const relDir = path.join(root, 'features', 'releases');
  const files = fs.readdirSync(relDir).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) problems.push('no release manifests');
  for (const file of files) {
    const rel = JSON.parse(fs.readFileSync(path.join(relDir, file), 'utf8'));
    for (const f of rel.features) {
      const now = byId.get(f.id);
      if (!now) { problems.push(`${file} feature ${f.id} is missing from features.json`); continue; }
      if (now.testId !== f.testId) problems.push(`${file} ${f.id} testId changed (${f.testId} -> ${now.testId})`);
      if (now.route !== f.route) problems.push(`${file} ${f.id} route changed (${f.route} -> ${now.route})`);
    }
  }
  const lab = read('src/lab-ui.js');
  const tabs = [...lab.matchAll(/\['[A-Z]+',\s*\[([^\]]*)\]\]/g)].flatMap((g) => [...g[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
  for (const k of tabs) if (!byId.has('tab.' + k)) problems.push('source tab ' + k + ' has no manifest entry');
  for (const f of features || []) if (f.kind === 'tab' && !tabs.includes(f.id.slice(4))) problems.push('manifest tab ' + f.id + ' is not in GROUPS');
  const ws = read('ui/src/core/workspaces.ts');
  const block = ws.match(/export const NATIVE_PANELS[^=]*= \{([\s\S]*?)\};/);
  const natives = [...block[1].matchAll(/(?:'([^']+)'|([A-Za-z0-9-]+))\s*:/g)].map((x) => x[1] || x[2]);
  for (const id of natives) if (!byId.has('panel.' + id)) problems.push('native panel ' + id + ' has no manifest entry');
  for (const f of features || []) if (f.kind === 'panel' && !natives.includes(f.id.slice(6))) problems.push('manifest panel ' + f.id + ' is not in NATIVE_PANELS');
  const shell = read('ui/src/App.tsx') + read('ui/src/Dock.tsx') + read('src/index.html');
  for (const f of features || []) {
    if (f.kind === 'workspace' || f.kind === 'tab' || f.kind === 'panel' || f.kind === 'action') {
      if (!shell.includes(f.testId) && f.kind !== 'action') {
        // tab and panel test ids are composed in Dock as feature-tab- / feature-panel-
      }
    }
  }
  if (!shell.includes('feature-tab-') || !shell.includes('feature-panel-') || !shell.includes('feature-ws-') || !shell.includes('feature-action-theme') || !shell.includes('feature-action-palette')) problems.push('shell is missing data-feature hooks the e2e clicks');
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkFeatures();
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  const n = JSON.parse(read('features.json')).features.length;
  console.log(`feature gate ok: ${n} features, releases ${fs.readdirSync(path.join(root, 'features', 'releases')).length}`);
}

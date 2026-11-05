// Notebook cells run here, not on the page. They get the research functions and a copy of the
// weights. They do not get the DOM, localStorage, or the editor.
import * as research from './research.js?v=170';
import { docs, DS } from './dataset.js?v=170';

let W = null;
let M = null;
const parts = new Map();
function take(name) {
  const rec = parts.get(name);
  if (!rec) return null;
  parts.delete(name);
  return rec;
}
function modelFrom(prefix) {
  const get = (k) => take(prefix + k);
  const layers = [];
  for (let l = 0; ; l++) {
    const q = get('L' + l + '.q');
    if (!q) break;
    const layer = { q };
    for (const k of ['k', 'v', 'o', 'ob', 'ln1w', 'ln1b', 'ln2w', 'ln2b', 'fc', 'fcb', 'proj', 'projb']) layer[k] = get('L' + l + '.' + k);
    layers.push(layer);
  }
  return { wte: get('wte'), wpe: get('wpe'), lnfW: get('lnfW'), lnfB: get('lnfB'), layers };
}
const lab = {
  M: () => M,
  W: () => W,
  R: () => { throw new Error('the sandbox does not receive runtime state'); },
  ed: () => { throw new Error('the sandbox cannot read the editor'); },
  tok: () => { throw new Error('the tokenizer stays on the page'); },
  commit: () => { throw new Error('the sandbox cannot commit edits'); },
  showTab: () => { throw new Error('the sandbox cannot change tabs'); },
};

self.onmessage = async (e) => {
  const m = e.data;
  if (!m || typeof m !== 'object') return;
  if (m.op === 'chunk') {
    let rec = parts.get(m.name);
    if (!rec || rec.length !== m.len) { rec = new Float32Array(m.len); parts.set(m.name, rec); }
    rec.set(m.buf, m.off);
    return;
  }
  if (m.op === 'weights-done') {
    W = modelFrom(m.shared ? '' : 'W.');
    M = m.shared ? W : modelFrom('M.');
    if (m.user) DS.user = m.user;
    self.postMessage({ id: m.id, weights: true });
    return;
  }
  if (m.op !== 'run') return;
  const print = (...a) => {
    const line = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x, (_k, v) => (ArrayBuffer.isView(v) ? Array.from(v).slice(0, 64) : v)))).join(' ');
    self.postMessage({ id: m.id, print: line });
  };
  const plot = (ys) => self.postMessage({ id: m.id, plot: ys });
  const url = URL.createObjectURL(new Blob([`export default async (lab, research, docs, print, plot) => {\n${m.code}\n};`], { type: 'text/javascript' }));
  try {
    const fn = (await import(/* webpackIgnore: true */ url)).default;
    const value = await fn(lab, research, docs, print, plot);
    self.postMessage({ id: m.id, done: true, value: value === undefined ? null : value });
  } catch (err) {
    self.postMessage({ id: m.id, err: String(err && err.message ? err.message : err) });
  } finally { URL.revokeObjectURL(url); }
};

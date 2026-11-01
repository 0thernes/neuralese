// v15.3 repo layout: the web app lives in src/. rp('engine.js') → '../src/engine.js'; rp('docs/x.md') → '../docs/x.md' (relative to test/).
import fs from 'node:fs';
const SRC = new Set(fs.readdirSync(new URL('../src/', import.meta.url)));
export const rp = (f) => (SRC.has(String(f).split(/[/?]/)[0]) ? '../src/' : '../') + f;
export const VER = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version; // single source of truth (tools/bump-version.mjs)

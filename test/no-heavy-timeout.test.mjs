import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const skip = new Set(['vendor', 'shell', 'node_modules', 'dist']);

function files(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) files(p, out);
    else if (/\.(js|mjs|tsx)$/.test(name) && !p.includes(`${path.sep}test${path.sep}`)) out.push(p);
  }
  return out;
}

const HEAVY = /querySelectorAll|innerHTML|weightsHash|\ba11y\b|\blines\(|\bheatmap\(|\bmeasure\(|\blowerForge\b|\bfor\s*\(|\bwhile\s*\(/;

test('timer callbacks do not do heavy work', () => {
  const hits = [];
  for (const file of [...files(path.join(root, 'src')), ...files(path.join(root, 'ui', 'src'))]) {
    const text = fs.readFileSync(file, 'utf8');
    const re = /set(?:Timeout|Interval)\s*\(([\s\S]{0,500}?)\s*,\s*[^)]+\)/g;
    let m;
    while ((m = re.exec(text))) {
      const body = m[1];
      if (HEAVY.test(body)) hits.push(`${path.relative(root, file)}: ${body.replace(/\s+/g, ' ').slice(0, 140)}`);
    }
  }
  assert.deepEqual(hits, []);
});

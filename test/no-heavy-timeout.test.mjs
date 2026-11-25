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

test('app code does not do work from setTimeout(0)', () => {
  const hits = [];
  for (const file of [...files(path.join(root, 'src')), ...files(path.join(root, 'ui', 'src'))]) {
    const text = fs.readFileSync(file, 'utf8');
    const re = /setTimeout\s*\([\s\S]{0,180}?,\s*0\s*\)/g;
    let m;
    while ((m = re.exec(text))) hits.push(`${path.relative(root, file)}: ${m[0].replace(/\s+/g, ' ').slice(0, 120)}`);
  }
  assert.deepEqual(hits, []);
});

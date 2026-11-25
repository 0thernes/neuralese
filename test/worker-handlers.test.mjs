import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const skip = new Set(['vendor', 'shell', 'node_modules', 'dist']);
const DOM = /\binnerHTML\b|\blines\s*\(|\bheatmap\s*\(|\.textContent\s*=/;
const YIELD = /requestAnimationFrame|yieldHost|\bframe\s*\(|waitNextFrame/;

function files(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) files(p, out);
    else if (p.endsWith('.js') && !p.includes(`${path.sep}test${path.sep}`)) out.push(p);
  }
  return out;
}

function bodies(text) {
  const out = [];
  const re = /(?<!self\.)onmessage\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_][\w]*)\s*=>\s*\{/g;
  let m;
  while ((m = re.exec(text))) {
    let i = m.index + m[0].length - 1;
    let depth = 0;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) break;
    }
    out.push(text.slice(m.index, i + 1));
  }
  return out;
}

test('page-side worker handlers do not render in the message turn', () => {
  const hits = [];
  for (const file of files(path.join(root, 'src'))) {
    for (const body of bodies(fs.readFileSync(file, 'utf8'))) {
      const dom = body.search(DOM);
      const yieldAt = body.search(YIELD);
      if (dom >= 0 && (yieldAt < 0 || yieldAt > dom)) hits.push(`${path.relative(root, file)}: ${body.slice(dom, dom + 80).replace(/\s+/g, ' ')}`);
    }
  }
  assert.deepEqual(hits, []);
});

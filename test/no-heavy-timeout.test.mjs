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
// A bare resolver has no script URL. The synchronous work after the await is charged to that timer.
const RESOLVE_TIMER = /setTimeout\(\s*(?:resolve|res|rej|r)\s*[,)]|scheduler\.yield\s*\(|\b(?:async\s+)?function\s+sleep\s*\(|\b(?:const|let|var)\s+sleep\s*=/;

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

test('timer awaits do not pass the native resolver or hide behind a sleep helper', () => {
  const hits = [];
  const roots = [path.join(root, 'src'), path.join(root, 'ui', 'src')];
  for (const file of roots.flatMap((dir) => files(dir))) {
    if (file.includes(`${path.sep}shell${path.sep}`)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (RESOLVE_TIMER.test(text)) hits.push(path.relative(root, file));
  }
  const htmlRoot = path.join(root, 'src');
  const htmls = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name === 'vendor' || name === 'shell') continue;
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.html')) htmls.push(p);
    }
  })(htmlRoot);
  for (const file of htmls) {
    const text = fs.readFileSync(file, 'utf8');
    if (/setTimeout\(\s*(?:resolve|res|rej|r)\s*[,)]/.test(text)) hits.push(path.relative(root, file));
  }
  assert.deepEqual(hits, []);
});

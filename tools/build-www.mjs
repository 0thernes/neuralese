// Assembles the deployable web app into www/: exactly the file set served on gh-pages.
// Since v15.3 the web root is src/ (index.html, style.css, cli.mjs, every *.js, and frontier/ hub/ learn/ lens/ nested/ tsotchke/ vendor/),
// plus the repo README.md. Used by the gh-pages deploy, the Electron desktop builds and the Capacitor Android/iOS builds.
// Usage: node tools/build-www.mjs [outDir]
import fs from 'node:fs'; import path from 'node:path';
export const DIRS = ['frontier', 'hub', 'learn', 'lens', 'nested', 'tsotchke', 'vendor'];
// root = repo root; returns names relative to the web root (src/), plus README.md (copied from the repo root)
export function wwwFiles(root = '.') { const src = path.join(root, 'src'); return [...fs.readdirSync(src).filter((f) => /\.js$/.test(f) || ['index.html', 'style.css', 'cli.mjs'].includes(f)), 'README.md'].sort().concat(DIRS); }
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] || 'www'; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  for (const f of wwwFiles()) fs.cpSync(f === 'README.md' ? f : path.join('src', f), path.join(out, f), { recursive: true, filter: (s) => !s.endsWith('moonlab/dist/moonlab.wasm') }); // that .wasm is a test by-product (gitignored)
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  let n = 0, b = 0; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { n++; b += fs.statSync(p).size; } } })(out);
  console.log(`${out}/: ${n} files, ${(b / 1e6).toFixed(1)} MB`);
}

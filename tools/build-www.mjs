// Assembles the deployable web app into www/: exactly the file set served on gh-pages
// (index.html, style.css, README.md, cli.mjs, every root *.js except eslint.config.js, and frontier/ hub/ learn/ tsotchke/ vendor/).
// Used by the gh-pages deploy, the Electron desktop builds and the Capacitor Android/iOS builds. Usage: node tools/build-www.mjs [outDir]
import fs from 'node:fs'; import path from 'node:path';
export const DIRS = ['frontier', 'hub', 'learn', 'tsotchke', 'vendor'];
export function wwwFiles(root = '.') { return [...fs.readdirSync(root).filter((f) => (/\.js$/.test(f) && f !== 'eslint.config.js') || ['index.html', 'style.css', 'README.md', 'cli.mjs'].includes(f)).sort(), ...DIRS]; }
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] || 'www'; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  for (const f of wwwFiles()) fs.cpSync(f, path.join(out, f), { recursive: true, filter: (s) => !s.endsWith('moonlab/dist/moonlab.wasm') }); // that .wasm is a test by-product (gitignored)
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  let n = 0, b = 0; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { n++; b += fs.statSync(p).size; } } })(out);
  console.log(`${out}/: ${n} files, ${(b / 1e6).toFixed(1)} MB`);
}

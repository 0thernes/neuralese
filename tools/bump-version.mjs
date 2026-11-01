// Sets one version everywhere: package.json, package-lock.json, desktop/package.json, src/term.js, src/index.html (title/logo/build
// stamp), .github/workflows/release.yml (VER, versionCode). Usage: node tools/bump-version.mjs 15.3.0 [build-stamp]
import fs from 'node:fs';
const [v, stamp = new Date().toISOString().slice(0, 10) + '.1'] = process.argv.slice(2); if (!/^\d+\.\d+\.\d+$/.test(v)) throw new Error('usage: bump-version X.Y.Z');
const [maj, min, pat] = v.split('.').map(Number), short = `${maj}.${min}`, code = maj * 100 + min * 10 + pat;
const edit = (f, fn) => { const a = fs.readFileSync(f, 'utf8'), b = fn(a); if (a === b) console.warn('unchanged:', f); fs.writeFileSync(f, b); };
for (const f of ['package.json', 'desktop/package.json']) edit(f, (s) => s.replace(/("version":\s*")[^"]+"/, `$1${v}"`));
edit('package-lock.json', (s) => s.replace(/("name": "neuralese",\s*"version": ")[^"]+"/g, `$1${v}"`));
edit('src/term.js', (s) => s.replace(/VERSION = '[^']+'/, `VERSION = '${v}'`));
edit('src/index.html', (s) => s.replace(/<title>NEURALESE v[\d.]+ —/, `<title>NEURALESE v${short} —`).replace(/NEURALESE<span>v[\d.]+<\/span>/, `NEURALESE<span>v${short}</span>`).replace(/<i>v[\d.]+<\/i>/, `<i>v${short}</i>`).replace(/v\d+\.\d+\.\d+ · build [\d.-]+/, `v${v} · build ${stamp}`));
edit('.github/workflows/release.yml', (s) => s.replace(/VER: [\d.]+/, `VER: ${v}`).replace(/VERSION_CODE: \d+/, `VERSION_CODE: ${code}`));
console.log('version', v, 'build', stamp, 'versionCode', code);

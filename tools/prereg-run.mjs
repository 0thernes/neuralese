// v16 enforced pre-registered run (Node). Refuses to start unless the pre-registration validates, hashes to the frozen hash, and pins
// the commit actually checked out (clean working tree required). Writes a REPRO bundle.
// Usage: node tools/prereg-run.mjs <prereg.json> --hash <sha256> [--text "probe text"] [--out bundle.json]
import fs from 'node:fs'; import { execSync } from 'node:child_process';
import { load, ROOT, SITE } from './_fload.mjs';
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf(k); return i < 0 ? d : a[i + 1]; };
const { startRun, runMetric, reproBundle, preregHash, PreregError } = await import(SITE + 'prereg.js');
const doc = JSON.parse(fs.readFileSync(a[0], 'utf8')), expectedHash = arg('--hash');
let commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); const dirty = execSync('git status --porcelain --untracked-files=no', { cwd: ROOT }).toString().trim();
if (dirty && !process.env.NEURALESE_ALLOW_DIRTY) commit = commit + '-dirty'; // a dirty tree never matches a 40-hex commit_sha
let run; try { run = await startRun(doc, { expectedHash, commit }); } catch (e) { if (e instanceof PreregError) { console.error('REFUSED:', e.message, '\n(this document hashes to', await preregHash(doc) + ')'); process.exit(2); } throw e; }
const { Engine, defaultRuntime } = await import(SITE + 'engine.js'), { GPT2Tokenizer } = await import(SITE + 'tokenizer.js');
const W = await load('8M'), tok = new GPT2Tokenizer(JSON.parse(fs.readFileSync(ROOT + 'model/vocab.json', 'utf8')), fs.readFileSync(ROOT + 'model/merges.txt', 'utf8'));
const ids = tok.encode(arg('--text', 'Once upon a time, there was a little girl named Lily. She loved to play outside with her dog.'));
const results = runMetric(run.prereg, new Engine(W, defaultRuntime()), ids), { createHash } = await import('node:crypto');
const h = createHash('sha256'); for (const t of [W.wte, W.wpe, W.lnfW, W.lnfB, ...W.layers.flatMap((L) => Object.values(L))]) h.update(Buffer.from(t.buffer, t.byteOffset, t.byteLength));
const b = await reproBundle(run, { results, weights_sha256: h.digest('hex'), env: { node: process.version, platform: process.platform } });
fs.writeFileSync(arg('--out', 'repro-bundle.json'), JSON.stringify(b, null, 1)); console.log(b.verdict.text, '\nbundle', b.bundle_sha256);

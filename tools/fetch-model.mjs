// Downloads the TinyStories weights the tests use into model/ (not in git: ~230 MB) and verifies pinned SHA-256s.
// The app itself streams the same files from Hugging Face at runtime. Usage: node tools/fetch-model.mjs
import fs from 'node:fs'; import crypto from 'node:crypto';
const HF = 'https://huggingface.co/roneneldan';
const FILES = {
  'model.safetensors': [`${HF}/TinyStories-8M/resolve/refs%2Fpr%2F1/model.safetensors`, 'd40feb886ae2039dc1d2afffa63400acd0df65663c25eea2f6f554dce2d656aa'],
  'vocab.json': [`${HF}/TinyStories-8M/resolve/main/vocab.json`, '3ba3c3109ff33976c4bd966589c11ee14fcaa1f4c9e5e154c2ed7f99d80709e7'],
  'merges.txt': [`${HF}/TinyStories-8M/resolve/main/merges.txt`, '1ce1664773c50f3e0cc8842619a93edc4624525b728b188a9e0be33b7726adc5'],
  'ts1M.safetensors': [`${HF}/TinyStories-1M/resolve/refs%2Fpr%2F1/model.safetensors`, 'eb9c5893cb5dc6f78b9b5703ab77b9e94f0b056b7bd920c8fa0146c78af5b55b'],
  'ts3M.safetensors': [`${HF}/TinyStories-3M/resolve/refs%2Fpr%2F1/model.safetensors`, '6492ddc2a84bc0e75efbfb0a35b5756e55ea3f35a9fa1a12a722bc86a73da1c7'],
};
const dir = process.argv[2] || 'model'; fs.mkdirSync(dir, { recursive: true });
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
for (const [f, [url, want]] of Object.entries(FILES)) { const p = `${dir}/${f}`;
  if (fs.existsSync(p) && sha(fs.readFileSync(p)) === want) { console.log('ok (cached)', f); continue; }
  let b; for (let i = 0; i < 4; i++) { try { const r = await fetch(url); if (!r.ok) throw new Error(r.status + ' ' + url); b = Buffer.from(await r.arrayBuffer()); break; } catch (e) { if (i === 3) throw e; await new Promise((s) => setTimeout(s, 3000 * (i + 1))); } }
  const got = sha(b); if (got !== want) throw new Error(`${f}: sha256 ${got} != pinned ${want}`); fs.writeFileSync(p, b); console.log('ok', f, b.length);
}

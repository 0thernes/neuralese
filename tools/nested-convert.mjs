// Convert neuralese-nested's float64 models.json into one Float32 binary + a JSON index (v14.7). Original Neuralese code.
import fs from 'node:fs'; import crypto from 'node:crypto';
const src = process.argv[2] || '/workspace/neuralese-nested/web/slm/models.json', J = JSON.parse(fs.readFileSync(src, 'utf8')), parts = [], index = { vocab: J.vocab, models: {} }; let off = 0;
const put = (arr) => { const flat = arr.flat(Infinity), shape = Array.isArray(arr[0]) ? [arr.length, arr[0].length] : [arr.length]; parts.push(Float32Array.from(flat)); const e = { off, shape }; off += flat.length; return e; };
for (const [name, m] of Object.entries(J)) { if (name === 'vocab') continue; const e = { cfg: m.cfg, w: {} }; for (const [k, v] of Object.entries(m.w)) e.w[k] = put(v);
  for (const h of ['out_h', 'out_g']) if (m[h]) e[h] = { weight: put(m[h].weight), bias: put(m[h].bias) }; if (m.dH != null) e.dH = m.dH; index.models[name] = e; }
const buf = new Float32Array(off); let p = 0; for (const a of parts) { buf.set(a, p); p += a.length; }
const bin = Buffer.from(buf.buffer); fs.writeFileSync('nested/slm/models.f32', bin); index.sha256 = crypto.createHash('sha256').update(bin).digest('hex'); index.floats = off; index.source = 'neuralese-nested web/slm/models.json (float64), converted to float32';
fs.writeFileSync('nested/slm/models.index.json', JSON.stringify(index)); console.log(off, 'floats', bin.length, 'bytes', index.sha256);

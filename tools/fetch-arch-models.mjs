// v16: downloads the HF checkpoints used by test/arch.test.mjs and test/encoder.test.mjs into model/arch/<name>/, each pinned to an
// immutable Hub commit and verified against a pinned SHA-256 (refuses on mismatch). ~3 GB total. Usage:
//   node tools/fetch-arch-models.mjs [dir=model/arch] [--only=name,name] [--configs-only]
// TinyStories-8M reuses model/model.safetensors from tools/fetch-model.mjs (symlink).
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
export const ARCH_MODELS = {
  'TinyStories-8M': ['roneneldan/TinyStories-8M', '8612e3b15c66ffa94eaa6ee0de5c96edd2d630af', { 'config.json': '5ff16b03beb4466bde520469a815a2d439e16896655d1151c3b44686b387a42d' }],
  distilgpt2: ['distilbert/distilgpt2', '2290a62682d06624634c1f46a6ad5be0f47f38aa', { 'config.json': '4ec5947c1d59fee6212cdf3b0ec1a53eac02092554c5ff0a733488cbd2c64f3a', 'model.safetensors': 'e1ff18884359fe8beb795a5f414feb85a6ce3d929ad019c0d958c039d2b94a1b' }],
  'SmolLM-135M': ['HuggingFaceTB/SmolLM-135M', '1d461723eec654e65efdc40cf49301c89c0c92f4', { 'config.json': 'a1fe6f43e20f7a6c6dbc6380222af9526b5cef262446391a281c038249e3e3b7', 'model.safetensors': 'c7a387d6fe81ca6dd304aeb809bda3932ff1bbef3ca41c9484502f2f448dc093' }],
  'Qwen2.5-0.5B': ['Qwen/Qwen2.5-0.5B', '060db6499f32faf8b98477b0a26969ef7d8b9987', { 'config.json': '479dcf0c5286339e41ad3992cd08ae88a467c4187587936248e2b7c96283484b', 'model.safetensors': '88c142557820ccad55bb59756bfcfcf891de9cc6202816bd346445188a0ed342' }],
  'vit-base-patch16-224': ['google/vit-base-patch16-224', '3f49326eb077187dfe1c2a2bb15fbd74e6ab91e3', { 'config.json': 'abdf73cc4ce79495a83f32a8c9265daa7a1363f5a3efa4704c88a6e7f45ad19d', 'model.safetensors': '1cea07110a4a47edc51420b2dda6f3b8b58e7256e8f44b4ea6aa9696162ccb5d' }],
  'CLIP-ViT-B-32-laion2B-s34B-b79K': ['laion/CLIP-ViT-B-32-laion2B-s34B-b79K', '1a25a446712ba5ee05982a381eed697ef9b435cf', { 'config.json': '1284cbff35169abb23a1c5525a8b0f543c7bd191d4b9aed63880c1571bc4191c', 'model.safetensors': '74813fbcdc750f235c9784c367ca1394d2a5c25eb0aac92761752ac239db7cff' }],
  'whisper-tiny.en': ['openai/whisper-tiny.en', '87c7102498dcde7456f24cfd30239ca606ed9063', { 'config.json': 'b5366317df280f79e6cc366f259f379674f81a8721d458acf2e00680ccb10b1d', 'model.safetensors': 'db59695928ded6043adaef491a53ef4e12da9611184d77c53baa691a60b958ad' }],
};
const sha = (p) => new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(p).on('data', (d) => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), dir = args.find((a) => !a.startsWith('--')) || 'model/arch', only = args.find((a) => a.startsWith('--only='))?.slice(7).split(','), cfgOnly = args.includes('--configs-only');
  for (const [name, [repo, rev, files]] of Object.entries(ARCH_MODELS)) { if (only && !only.includes(name)) continue; const d = path.join(dir, name); fs.mkdirSync(d, { recursive: true });
    if (name === 'TinyStories-8M' && !fs.existsSync(path.join(d, 'model.safetensors')) && fs.existsSync(path.join(dir, '..', 'model.safetensors'))) fs.symlinkSync('../../model.safetensors', path.join(d, 'model.safetensors'));
    for (const [f, want] of Object.entries(files)) { if (cfgOnly && f !== 'config.json') continue; const p = path.join(d, f);
      if (fs.existsSync(p) && (await sha(p)) === want) { console.log('ok (cached)', name, f); continue; }
      const url = `https://huggingface.co/${repo}/resolve/${rev}/${f}`, tmp = p + '.part'; let ok = false;
      for (let i = 0; i < 4 && !ok; i++) { try { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); const w = fs.createWriteStream(tmp); for await (const c of r.body) if (!w.write(c)) await new Promise((s) => w.once('drain', s)); await new Promise((s) => w.end(s)); ok = true; } catch (e) { if (i === 3) throw e; await new Promise((s) => setTimeout(s, 3000)); } }
      const got = await sha(tmp); if (got !== want) { fs.rmSync(tmp); throw new Error(`${name}/${f}: sha256 ${got} != pinned ${want}`); } fs.renameSync(tmp, p); console.log('ok', name, f, fs.statSync(p).size);
    } }
}

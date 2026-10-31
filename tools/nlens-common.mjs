// Shared Node helpers for the v14 Neuron Lens pipeline (fit, database, validation).
import fs from 'node:fs'; import crypto from 'node:crypto';
import { CFG, buildWeights, parseSafetensors } from '../model.js';
import { prepare } from '../neuronlens.js';
import { GPT2Tokenizer } from '../tokenizer.js';
export const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
export const TS_VALID = { url: 'https://huggingface.co/datasets/roneneldan/TinyStories/resolve/main/TinyStories-valid.txt', sha256: '94e431816c4cce81ff71e4408ff8d3bda9a42e8d2663986697c3954288cb38b4' };
export function loadModel(dir = 'model') {
  const b = fs.readFileSync(`${dir}/model.safetensors`); const n = Number(b.readBigUInt64LE(0)); const hdr = JSON.parse(b.subarray(8, 8 + n).toString());
  return prepare(buildWeights(parseSafetensors(b.buffer.slice(b.byteOffset + 8 + n, b.byteOffset + b.length), n, hdr)), CFG);
}
export function tokenizer(dir = 'model') { return new GPT2Tokenizer(JSON.parse(fs.readFileSync(`${dir}/vocab.json`, 'utf8')), fs.readFileSync(`${dir}/merges.txt`, 'utf8')); }
export async function corpusText(path = 'model/TinyStories-valid.txt') {
  if (!fs.existsSync(path)) { const r = await fetch(TS_VALID.url); if (!r.ok) throw new Error(r.status); fs.writeFileSync(path, Buffer.from(await r.arrayBuffer())); }
  const b = fs.readFileSync(path); if (sha256(b) !== TS_VALID.sha256) throw new Error('TinyStories-valid.txt sha256 mismatch'); return b.toString('utf8');
}
// Stories in file order; doc i = first T tokens of story i (stories shorter than T skipped). Splits are disjoint ranges of stories.
export function stories(text) { return text.split('<|endoftext|>').map((s) => s.trim()).filter(Boolean); }
export function docsFrom(tok, st, from, n, T) { const out = []; for (let i = from; i < st.length && out.length < n; i++) { const ids = tok.encode(st[i]); if (ids.length >= T) out.push({ story: i, ids: ids.slice(0, T) }); } return out; }
// Lens file layout: Float32 blocks of d×d in order R.out[0..L-2], R.mid[0..L-1], S.mid[0..L-1], S.out[0..L-1].
export const BLOCKS = (L) => [...Array.from({ length: L - 1 }, (_, l) => ['R', 'out', l]), ...Array.from({ length: L }, (_, l) => ['R', 'mid', l]), ...Array.from({ length: L }, (_, l) => ['S', 'mid', l]), ...Array.from({ length: L }, (_, l) => ['S', 'out', l])];

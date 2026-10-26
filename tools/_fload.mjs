// Shared loader for v11 FRONTIER tools: reads the local safetensors (8M, plus 3M/1M from the model zoo).
import fs from 'node:fs';
export const ROOT = new URL('../', import.meta.url).pathname;
export const SITE = fs.existsSync(ROOT + 'site/model.js') ? ROOT + 'site/' : ROOT;
export async function load(which = '8M') { const { buildWeights, parseSafetensors } = await import(SITE + 'model.js'); const { cfgFor } = await import(SITE + 'zoo.js');
  const f = (process.env.NEURALESE_MODEL || ROOT + 'model/') + (which === '8M' ? 'model.safetensors' : `ts${which}.safetensors`);
  const buf = fs.readFileSync(f), n = Number(buf.readBigUInt64LE(0)), hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
  for (const k of Object.keys(hdr)) if (k !== '__metadata__' && hdr[k].dtype !== 'F32') delete hdr[k];
  const W = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr)); W.cfg = cfgFor(W.wte.length / 50257); return W; }
export const corpus = async () => (await import(SITE + 'corpus.js')).CORPUS;
export const prereg = () => JSON.parse(fs.readFileSync(SITE + 'frontier/data/prereg.json', 'utf8'));

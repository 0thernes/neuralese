// v16: read only the tensors you need from a remote .safetensors with HTTP Range requests (e.g. the CLIP vision tower out of a
// 605 MB vision+text checkpoint). Hugging Face resolve URLs send CORS + Accept-Ranges. Falls back to a full GET if Range is ignored.
import { toF32 } from './arch.js?v=170';
async function rng(url, a, b, sig) { const r = await fetch(url, { headers: { Range: `bytes=${a}-${b - 1}` }, signal: sig }); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); const u = new Uint8Array(await r.arrayBuffer()); return r.status === 206 ? u : u.subarray(a, b); }
export async function remoteSafetensors(url, keep = () => true, { signal, onProgress } = {}) {
  const h8 = await rng(url, 0, 8, signal), n = Number(new DataView(h8.buffer, h8.byteOffset, 8).getBigUint64(0, true));
  const header = JSON.parse(new TextDecoder().decode(await rng(url, 8, 8 + n, signal))), base = 8 + n;
  const want = Object.entries(header).filter(([k, v]) => k !== '__metadata__' && ['F32', 'F16', 'BF16'].includes(v.dtype) && keep(k)); if (!want.length) throw new Error('no matching tensors');
  const lo = Math.min(...want.map(([, v]) => v.data_offsets[0])), hi = Math.max(...want.map(([, v]) => v.data_offsets[1]));
  onProgress?.(`fetching ${((hi - lo) / 1e6).toFixed(0)} MB of ${want.length} tensors`); const buf = await rng(url, base + lo, base + hi, signal), T = {};
  for (const [k, v] of want) T[k] = { shape: v.shape, data: toF32(buf.subarray(v.data_offsets[0] - lo, v.data_offsets[1] - lo), v.dtype) };
  return { T, bytes: hi - lo };
}

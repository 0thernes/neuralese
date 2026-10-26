// Model zoo: other TinyStories GPT-Neo checkpoints (same tokenizer, same 8-layer local/global layout), loaded by HTTP Range
// requests for only the F32 tensors (the BOOL causal-mask buffers in these files are skipped). Weights carry their own cfg.
import { buildWeights } from './model.js?v=9';
const HF = (m) => `https://huggingface.co/roneneldan/TinyStories-${m}/resolve/refs%2Fpr%2F1/model.safetensors`;
export const ZOO = [
  { id: '1M', d: 64, url: HF('1M'), note: 'd=64 · 16 heads of 4 · ff 256 · 3.7M params (3.2M in embeddings)' },
  { id: '3M', d: 128, url: HF('3M'), note: 'd=128 · 16 heads of 8 · ff 512 · 8.3M params (6.4M in embeddings)' },
  { id: '8M', d: 256, url: HF('8M'), note: 'd=256 · 16 heads of 16 · ff 1024 · the main lab model' },
];
export const cfgFor = (d) => ({ d, H: 16, hd: d / 16, L: 8, ff: 4 * d, V: 50257, window: 256, eps: 1e-5 });
// Build from a parsed header + an async byte-range reader. Merges adjacent tensor ranges (gap < 256 kB) into few requests.
export async function loadZoo(url, readRange, onp = () => {}) {
  const head = new DataView(await readRange(url, 0, 7)); const n = Number(head.getBigUint64(0, true));
  const hdr = JSON.parse(new TextDecoder().decode(await readRange(url, 8, 8 + n - 1))), base = 8 + n;
  const ts = Object.entries(hdr).filter(([k, v]) => k !== '__metadata__' && v.dtype === 'F32' && v.shape.length).sort((a, b) => a[1].data_offsets[0] - b[1].data_offsets[0]);
  const groups = []; for (const t of ts) { const g = groups[groups.length - 1], [a, b] = t[1].data_offsets; if (g && a - g.b < 262144) { g.b = Math.max(g.b, b); g.items.push(t); } else groups.push({ a, b, items: [t] }); }
  const T = {}; let done = 0, tot = groups.reduce((s, g) => s + g.b - g.a, 0);
  for (const g of groups) { const buf = await readRange(url, base + g.a, base + g.b - 1); for (const [k, v] of g.items) T[k] = new Float32Array(buf.slice(v.data_offsets[0] - g.a, v.data_offsets[1] - g.a)); done += g.b - g.a; onp(done / tot); }
  const W = buildWeights(T); W.cfg = cfgFor(T['transformer.wte.weight'].length / 50257); return { W, bytes: tot, requests: groups.length + 2 };
}
export const httpRange = async (url, a, b) => { const r = await fetch(url, { headers: { Range: `bytes=${a}-${b}` } }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); };
// Weight-space diff between two models of identical shape: per-tensor ‖ΔW‖_F, relative change, cosine, max |Δ|, and changed fraction.
export function weightDiff(A, B, tol = 0) {
  const out = [], one = (name, a, b) => { let dd = 0, na = 0, nb = 0, dot = 0, mx = 0, ch = 0; for (let i = 0; i < a.length; i++) { const x = b[i] - a[i]; dd += x * x; na += a[i] * a[i]; nb += b[i] * b[i]; dot += a[i] * b[i]; const ax = Math.abs(x); if (ax > mx) mx = ax; if (ax > tol) ch++; }
    out.push({ name, n: a.length, dF: Math.sqrt(dd), rel: Math.sqrt(dd / (na || 1)), cos: dot / Math.sqrt(na * nb || 1), maxAbs: mx, changed: ch / a.length }); };
  one('wte', A.wte, B.wte); one('wpe', A.wpe, B.wpe); one('ln_f.w', A.lnfW, B.lnfW); one('ln_f.b', A.lnfB, B.lnfB);
  A.layers.forEach((P, l) => { for (const k in P) one(`L${l}.${k}`, P[k], B.layers[l][k]); }); return out;
}

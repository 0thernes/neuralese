// Derives what the model cosmos draws from real engine traces (Engine.step(…, {trace:true}) records).
// No synthetic values: when there is no trace the cosmos shows nothing but an explanation.
import type { Cfg, Trace } from './engine-api';
export interface CosmosData { T: number; L: number; H: number; ff: number; token: number; neurons: Float32Array; heads: Float32Array; resid: Float32Array; maxNeuron: number; maxHead: number; maxResid: number }
const norm = (v: ArrayLike<number>, a = 0, b = v.length): number => { let s = 0; for (let i = a; i < b; i++) { const x = v[i]!; s += x * x; } return Math.sqrt(s); };
// first slot that belongs to layer l (programs can repeat layers; the first occurrence is the canonical one)
export function slotOf(tr: Trace, l: number): number { return tr.slotLayer.indexOf(l); }
export function cosmosData(traces: Trace[], cfg: Pick<Cfg, 'L' | 'H' | 'ff' | 'd'>, token = traces.length - 1): CosmosData | null {
  if (!traces.length) return null; const t = Math.min(Math.max(0, token), traces.length - 1); const tr = traces[t]!;
  const { L, H, ff, d } = cfg, hd = d / H, T = traces.length;
  const neurons = new Float32Array(L * ff), heads = new Float32Array(L * H), resid = new Float32Array((L + 1) * T);
  let maxNeuron = 0, maxHead = 0, maxResid = 0;
  for (let l = 0; l < L; l++) {
    const s = slotOf(tr, l); if (s < 0) continue;
    const act = tr.mlp_act[s], z = tr.z[s];
    if (act) for (let n = 0; n < ff; n++) { const v = act[n]!; neurons[l * ff + n] = v; if (Math.abs(v) > maxNeuron) maxNeuron = Math.abs(v); }
    if (z) for (let h = 0; h < H; h++) { const v = norm(z, h * hd, (h + 1) * hd); heads[l * H + h] = v; if (v > maxHead) maxHead = v; }
  }
  for (let ti = 0; ti < T; ti++) {
    const tt = traces[ti]!; const s0 = slotOf(tt, 0); if (s0 >= 0 && tt.resid_pre[s0]) { const v = norm(tt.resid_pre[s0]!); resid[ti] = v; maxResid = Math.max(maxResid, v); }
    for (let l = 0; l < L; l++) { const s = slotOf(tt, l); const rp = s >= 0 ? tt.resid_post[s] : undefined; if (rp) { const v = norm(rp); resid[(l + 1) * T + ti] = v; maxResid = Math.max(maxResid, v); } }
  }
  return { T, L, H, ff, token: t, neurons, heads, resid, maxNeuron, maxHead, maxResid };
}
// top-k neurons of one layer by |activation| (for tables and the notebook)
export function topNeurons(c: CosmosData, layer: number, k = c.ff): { n: number; v: number }[] {
  const rows = Array.from({ length: c.ff }, (_, n) => ({ n, v: c.neurons[layer * c.ff + n]! })); rows.sort((a, b) => Math.abs(b.v) - Math.abs(a.v)); return rows.slice(0, k);
}

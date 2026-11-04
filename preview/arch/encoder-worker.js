// v16 HUB interpretability worker: loads a revision-pinned HF safetensors checkpoint (ViT, CLIP vision tower, Whisper encoder), runs
// our float64 JS forward (matches HF, test/encoder.test.mjs) and returns compact interpretability summaries so the page stays responsive.
import { encoderFromHF, mapEncoder, encode, vitLens, clipLensEmb, rollout, linearProbe, whisperLogMel } from './encoder.js?v=170';
import { remoteSafetensors } from './remote.js?v=170';
export const MODELS = {
  vit: { repo: 'google/vit-base-patch16-224', rev: '3f49326eb077187dfe1c2a2bb15fbd74e6ab91e3', sha: '1cea07110a4a47edc51420b2dda6f3b8b58e7256e8f44b4ea6aa9696162ccb5d', keep: () => true },
  clip: { repo: 'laion/CLIP-ViT-B-32-laion2B-s34B-b79K', rev: '1a25a446712ba5ee05982a381eed697ef9b435cf', sha: null, keep: (k) => k.startsWith('vision_model.') || k === 'visual_projection.weight' },
  whisper: { repo: 'openai/whisper-tiny.en', rev: '87c7102498dcde7456f24cfd30239ca606ed9063', sha: 'db59695928ded6043adaef491a53ef4e12da9611184d77c53baa691a60b958ad', keep: (k) => k.includes('encoder.') },
};
const C = {}, url = (m, f) => `https://huggingface.co/${m.repo}/resolve/${m.rev}/${f}`, say = (id, msg) => self.postMessage({ id, progress: msg });
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function load(key, id) { if (C[key]) return C[key]; const m = MODELS[key]; if (!m) throw new Error('unknown model ' + key);
  const cfg = await (await fetch(url(m, 'config.json'))).json(), E = encoderFromHF(cfg); let T, verified;
  if (m.sha) { say(id, `downloading ${m.repo}@${m.rev.slice(0, 7)} (full file, sha256-checked)`); const r = await fetch(url(m, 'model.safetensors')); if (!r.ok) throw new Error('HTTP ' + r.status); const buf = await r.arrayBuffer();
    const got = hex(await crypto.subtle.digest('SHA-256', buf)); if (got !== m.sha) throw new Error(`sha256 mismatch: got ${got}`); verified = 'sha256 ' + got.slice(0, 16) + '…';
    const { readSafetensors } = await import('./arch.js?v=170'); const all = readSafetensors(new Uint8Array(buf)); T = Object.fromEntries(Object.entries(all).filter(([k]) => m.keep(k))); }
  else { ({ T } = await remoteSafetensors(url(m, 'model.safetensors'), m.keep, { onProgress: (s) => say(id, s) })); verified = `revision-pinned ${m.rev.slice(0, 7)} (range fetch: whole-file sha256 not computed)`; }
  return (C[key] = { E, W: mapEncoder(E, T), verified }); }
const cos = (a, b) => { let s = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return s / Math.sqrt(na * nb); };
const topk = (v, k) => { const mx = Math.max(...v); let z = 0; const p = v.map((x) => { const e = Math.exp(x - mx); z += e; return e; }); return [...p.keys()].sort((a, b) => p[b] - p[a]).slice(0, k).map((i) => [i, p[i] / z]); };
function probeLayers(hidden, d, idx, labels, dims = 128) { return hidden.map((X) => { const f = idx.map((t) => Array.from(X.subarray(t * d, t * d + Math.min(dims, d)))); return linearProbe(f, labels, { lambda: 1e-1 }); }); }
async function run({ key, input, audio }, id) {
  const { E, W, verified } = await load(key, id), d = E.d, t0 = performance.now(); let feat = input;
  if (key === 'whisper') { say(id, 'log-mel features'); feat = whisperLogMel(audio); }
  say(id, `forward (${E.L} layers, float64 JS — tens of seconds)`); const o = encode(E, W, feat, { attnLayers: key === 'whisper' ? [E.L - 1] : [...Array(E.L).keys()] }), res = { key, verified, L: E.L, N: o.N, H: E.H, ms: 0 };
  if (key === 'whisper') { const N = o.N, P = o.patterns[E.L - 1], S = 100, f = N / S, A = new Float32Array(S * S); for (const pm of P) for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) A[Math.floor(i / f) * S + Math.floor(j / f)] += pm[i * N + j] / P.length;
    res.attn = A; res.S = S; res.norms = o.hidden.map((X) => { let s = 0; for (let i = 0; i < X.length; i++) s += X[i] * X[i]; return Math.sqrt(s / N); });
    // probe: does a frame carry signal? label = mean log-mel of its 2 input frames above the clip median
    const en = [...Array(N).keys()].map((t) => { let s = 0; for (let m = 0; m < E.mels; m++) s += feat[m * E.frames + 2 * t] + feat[m * E.frames + 2 * t + 1]; return s; }), med = [...en].sort((a, b) => a - b)[N >> 1];
    const idx = [...Array(N).keys()].filter((t) => t % 3 === 0); res.probe = { task: 'frame energy above median', rows: probeLayers(o.hidden, d, idx, idx.map((t) => en[t] > med)) }; }
  else { const N = o.N, g = Math.round(Math.sqrt(N - 1)), R = rollout(o.patterns, N, [...Array(E.L).keys()]); res.g = g; res.rollout = Float32Array.from(R.subarray(1, N));
    const P = o.patterns[E.L - 1], last = new Float32Array(N - 1); for (const pm of P) for (let j = 1; j < N; j++) last[j - 1] += pm[j] / P.length; res.lastCls = last;
    if (key === 'vit') res.lens = vitLens(E, W, o.hidden).map((v) => topk(Array.from(v), 3).map(([i, p]) => [E.labels?.[i] ?? String(i), p]));
    else { const em = clipLensEmb(E, W, o.hidden); res.cos = em.map((e) => cos(e, em[E.L])); }
    const bright = [...Array(N - 1).keys()].map((p) => { const py = Math.floor(p / g), px = p % g, ps = E.patch, S = E.img; let s = 0; for (let c = 0; c < 3; c++) for (let y = 0; y < ps; y++) for (let x = 0; x < ps; x++) s += input[c * S * S + (py * ps + y) * S + px * ps + x]; return s; });
    const med = [...bright].sort((a, b) => a - b)[bright.length >> 1], idx = [...Array(N - 1).keys()].map((p) => p + 1);
    res.probe = { task: 'patch brighter than median', rows: probeLayers(o.hidden, d, idx, idx.map((t) => bright[t - 1] > med)) }; }
  res.ms = Math.round(performance.now() - t0); return res; }
self.onmessage = async ({ data: { id, op, args } }) => { try { const r = op === 'run' ? await run(args, id) : await load(args.key, id).then((c) => ({ verified: c.verified })); self.postMessage({ id, ok: r }); } catch (e) { self.postMessage({ id, err: String(e?.message || e) }); } };

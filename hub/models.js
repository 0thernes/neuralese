// v12 MODEL HUB registry. Every entry is a real, public ONNX repo on the Hugging Face Hub, run by transformers.js 4.3.1
// (pinned + hash-checked) inside a Web Worker. Sizes are the quantized (q8) ONNX files, measured from the Hub file tree
// on 2026-10-26. "interp" says which Neuralese interpretability tools work on the model (none, for every hub model: they
// run through onnxruntime as black boxes; the white-box tools need the JS engine, which only runs the TinyStories zoo).
export const TFJS_VERSION = '4.3.1';
export const ORT_VERSION = '1.31.0-dev.20260914-8d85527a0';
// transformers.js itself is fetched from jsDelivr at the pinned version and SHA-256-checked, then imported from a blob URL
// (GitHub's secret scanner rejects the minified file — it flags the class name Mistral3ForConditionalGeneration as an API key).
export const TFJS = { url: `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TFJS_VERSION}/dist/transformers.min.js`, sha256: '8d6716d9086f57c30a4bf367dba61b887593573c770c454465e8019b2703e743', bytes: 586230 };
// The 28 MB onnxruntime-web WASM binary is too large to vendor in the Pages repo; it is fetched from jsDelivr at the pinned
// version and its SHA-256 is checked before use (a mismatch aborts — nothing unverified is executed).
export const ORT_WASM = { url: `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort-wasm-simd-threaded.jsep.wasm`, sha256: '62ff86b2f2fa3a79eb87a7e4720e8ea9051942bf975f314181bf7dcef2feac06', bytes: 28352885 };
export const MODELS = [
  { key: 'embed', task: 'feature-extraction', repo: 'Xenova/all-MiniLM-L6-v2', mb: 22, what: 'sentence embeddings (384-d, mean-pooled, L2-normalised)' },
  { key: 'asr', task: 'automatic-speech-recognition', repo: 'Xenova/whisper-tiny.en', mb: 40, what: 'English speech recognition (Whisper tiny.en, 39M params)' },
  { key: 'tts', task: 'text-to-speech', repo: 'Xenova/mms-tts-eng', mb: 38, what: 'English text-to-speech (Meta MMS VITS, 16 kHz)' },
  { key: 'ocr', task: 'image-to-text', repo: 'Xenova/trocr-small-printed', mb: 63, what: 'OCR of a single printed text line (TrOCR small)' },
  { key: 'caption', task: 'image-to-text', repo: 'Xenova/vit-gpt2-image-captioning', mb: 245, what: 'image captioning (ViT encoder + GPT-2 decoder)' },
  { key: 'clip', task: 'zero-shot-image-classification', repo: 'Xenova/clip-vit-base-patch32', mb: 153, what: 'zero-shot image classification (CLIP ViT-B/32)' },
  { key: 'gen-distilgpt2', task: 'text-generation', repo: 'Xenova/distilgpt2', mb: 84, what: 'text generation (DistilGPT-2, 82M) — generation only' },
  { key: 'gen-gpt2', task: 'text-generation', repo: 'Xenova/gpt2', dtype: 'uint8', mb: 125, what: 'text generation (GPT-2 small, 124M) — generation only' },
];
export const byKey = (k) => { const m = MODELS.find((x) => x.key === k); if (!m) throw new Error('unknown hub model ' + k); return m; };
// Which lab tools work on which model (shown in the HUB tab; tested in test/v12.test.mjs).
export const TOOL_MATRIX = [
  ['TinyStories-8M (main, JS engine)', 'all tools: lens, patching, SAE, ROME, steering, ACDC, probes, FRONTIER, fine-tune'],
  ['TinyStories-1M / 3M (TOOLS → ZOO)', 'zoo comparisons, gradients, FRONTIER nulls (same architecture, loaded by range requests)'],
  ['DistilGPT-2 / GPT-2 (HUB, ONNX)', 'greedy generation only — no log-prob readout, no activations, no patching (ONNX graph is a black box here)'],
  ['MiniLM, Whisper, MMS-TTS, TrOCR, ViT-GPT2, CLIP (HUB, ONNX)', 'their own task only; MiniLM embeddings feed the 3D embedding view'],
];
// Pure helpers (unit-tested in Node).
export function cosine(a, b) { let s = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return s / (Math.sqrt(na * nb) || 1); }
// Resample mono PCM to 16 kHz by linear interpolation (Whisper input rate).
export function resample(x, from, to = 16000) { if (from === to) return Float32Array.from(x); const n = Math.max(1, Math.round(x.length * to / from)), y = new Float32Array(n), r = from / to; for (let i = 0; i < n; i++) { const p = i * r, j = Math.floor(p), f = p - j; y[i] = (x[j] ?? 0) * (1 - f) + (x[j + 1] ?? x[j] ?? 0) * f; } return y; }
// 16-bit PCM WAV encoder for TTS output download.
export function wav(samples, rate) { const n = samples.length, b = new ArrayBuffer(44 + 2 * n), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + 2 * n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, 2 * n, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + 2 * i, Math.max(-1, Math.min(1, samples[i])) * 32767, true); return new Uint8Array(b); }
// Word error rate (Levenshtein over words, case/punctuation-insensitive) for the ASR round-trip check.
export function wer(ref, hyp) { const t = (s) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean), r = t(ref), h = t(hyp); if (!r.length) return h.length ? 1 : 0; let p = Array.from({ length: h.length + 1 }, (_, j) => j);
  for (let i = 1; i <= r.length; i++) { const c = [i]; for (let j = 1; j <= h.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1)); p = c; } return p[h.length] / r.length; }
// Text transforms for the speech-to-speech chain (deterministic, so the chain is testable).
export const TRANSFORMS = { echo: (s) => s, upper: (s) => s.toUpperCase(), reverse: (s) => s.split(/\s+/).reverse().join(' '), pirate: (s) => s.replace(/\bhello\b/gi, 'ahoy').replace(/\bmy\b/gi, 'me').replace(/\byou\b/gi, 'ye').replace(/\bis\b/gi, 'be'), summary: (s) => s.split(/(?<=[.!?])\s+/)[0] };
// Top-3 principal-component projection (power iteration with deflation) for the 3D embedding view. rows: array of equal-length vectors.
export function pca3(rows, iters = 100) { const n = rows.length, D = rows[0].length, mu = new Float64Array(D); for (const r of rows) for (let j = 0; j < D; j++) mu[j] += r[j] / n; const X = rows.map((r) => Float64Array.from(r, (x, j) => x - mu[j])), comps = [], vars = [];
  for (let k = 0; k < Math.min(3, D); k++) { let v = Float64Array.from({ length: D }, (_, j) => Math.sin(1 + j * (k + 1.7))); let lam = 0;
    for (let it = 0; it < iters; it++) { const w = new Float64Array(D); for (const x of X) { let s = 0; for (let j = 0; j < D; j++) s += x[j] * v[j]; for (let j = 0; j < D; j++) w[j] += s * x[j]; } for (const c of comps) { let s = 0; for (let j = 0; j < D; j++) s += w[j] * c[j]; for (let j = 0; j < D; j++) w[j] -= s * c[j]; } const nw = Math.hypot(...w) || 1; lam = nw / Math.max(1, n - 1); v = w.map((x) => x / nw); }
    comps.push(v); vars.push(lam); }
  const tot = X.reduce((s, x) => s + x.reduce((a, b) => a + b * b, 0), 0) / Math.max(1, n - 1); return { coords: X.map((x) => comps.map((c) => x.reduce((s, xj, j) => s + xj * c[j], 0))), explained: vars.map((v) => v / (tot || 1)), comps }; }
// Character error rate (Levenshtein over characters, case- and whitespace-normalised) for the OCR self-test.
export const cer = (a, b) => { const r = a.toUpperCase().replace(/\s+/g, ' ').trim(), h = b.toUpperCase().replace(/\s+/g, ' ').trim(); let p = Array.from({ length: h.length + 1 }, (_, j) => j); for (let i = 1; i <= r.length; i++) { const c = [i]; for (let j = 1; j <= h.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1)); p = c; } return p[h.length] / Math.max(1, r.length); };

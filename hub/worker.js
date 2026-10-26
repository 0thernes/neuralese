// v12 MODEL HUB worker: runs transformers.js pipelines off the main thread. Messages: {id, op:'load'|'run'|'info', key, input, opts}.
import { byKey, ORT_WASM, TFJS } from './models.js?v=13';
const P = {}; let wasmReady = null, T = null;
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function verified(url, sha, what) { const r = await fetch(url); if (!r.ok) throw new Error(`${what} HTTP ${r.status}`); const buf = await r.arrayBuffer(), h = hex(await crypto.subtle.digest('SHA-256', buf)); if (h !== sha) throw new Error(`${what} SHA-256 mismatch: got ${h}`); return buf; }
async function lib() { // transformers.js: pinned version, hash-checked, imported from a blob URL (nothing unverified is executed)
  if (!T) T = verified(TFJS.url, TFJS.sha256, 'transformers.js').then(async (buf) => { const u = URL.createObjectURL(new Blob([buf], { type: 'text/javascript' })); const m = await import(u); m.env.allowLocalModels = false; m.env.useBrowserCache = true; return m; }).catch((e) => { T = null; throw e; });
  return T; }
async function prepWasm(post) { // fetch the pinned ORT binary once, verify SHA-256, hand it to onnxruntime as bytes
  if (!wasmReady) wasmReady = (async () => { post({ stage: 'ort-wasm', progress: 0 }); const { env } = await lib(), buf = await verified(ORT_WASM.url, ORT_WASM.sha256, 'ORT wasm'), h = ORT_WASM.sha256;
    const o = env.backends.onnx.wasm; o.wasmBinary = buf; o.wasmPaths = { mjs: new URL('./vendor/ort-wasm-simd-threaded.jsep.mjs', import.meta.url).href }; o.proxy = false; if (!self.crossOriginIsolated) o.numThreads = 1;
    post({ stage: 'ort-wasm', progress: 1, sha256: h }); return h; })().catch((e) => { wasmReady = null; throw e; });
  return wasmReady; }
async function load(key, post, device) { const m = byKey(key); if (P[key]) return P[key]; await prepWasm(post); const t0 = performance.now();
  const opts = { dtype: m.dtype || 'q8', device: device || 'wasm', progress_callback: (p) => { if (p.status === 'progress') post({ stage: 'download', file: p.file, progress: p.progress / 100, loaded: p.loaded, total: p.total }); } };
  const { pipeline } = await lib(); P[key] = await pipeline(m.task, m.repo, opts); post({ stage: 'ready', ms: performance.now() - t0 }); return P[key]; }
async function run(key, input, o, post) { const p = await load(key, post, o.device), { RawImage } = await lib(); const t0 = performance.now(); let out;
  if (key === 'embed') { const t = await p(input, { pooling: 'mean', normalize: true }); out = { dims: t.dims, data: Array.from(t.data) }; }
  else if (key === 'asr') out = await p(new Float32Array(input), { chunk_length_s: 30, stride_length_s: 5 });
  else if (key === 'tts') { const r = await p(input); out = { audio: r.audio, rate: r.sampling_rate }; }
  else if (key === 'ocr' || key === 'caption') out = await p(new RawImage(new Uint8ClampedArray(input.data), input.width, input.height, 4), { max_new_tokens: 48 });
  else if (key === 'clip') out = await p(new RawImage(new Uint8ClampedArray(input.data), input.width, input.height, 4), o.labels);
  else if (key.startsWith('gen-')) out = await p(input, { max_new_tokens: o.n ?? 40, do_sample: false, repetition_penalty: o.rp ?? 1, no_repeat_ngram_size: o.nr ?? 0 });
  else throw new Error('no runner for ' + key);
  return { out, ms: performance.now() - t0 }; }
self.onmessage = async (e) => { const { id, op, key, input, opts = {} } = e.data, post = (x) => self.postMessage({ id, evt: true, ...x });
  try { let r; if (op === 'load') { await load(key, post, opts.device); r = { ok: true }; } else if (op === 'run') r = await run(key, input, opts, post); else if (op === 'info') r = { loaded: Object.keys(P), isolated: self.crossOriginIsolated, gpu: !!self.navigator?.gpu, wasm: await wasmReady?.catch(() => null) };
    self.postMessage({ id, ok: true, result: r }); } catch (err) { self.postMessage({ id, ok: false, error: String(err?.message || err) }); } };

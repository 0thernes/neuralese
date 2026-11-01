// v16 tabs: HUB interpretability (logit lens / CLIP embedding lens, attention rollout, linear probes on ViT, CLIP-vision and
// Whisper-encoder internals, via our own HF-matched forwards in a worker) and "What's new in v16" with the opt-in WebGPU path.
import { $, esc, tipq } from './lab-ui.js?v=160';
const kv = (rows) => `<table class="kv">${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`;
const CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073], CLIP_STD = [0.26862954, 0.26130258, 0.27577711];
export const WORKS = [
  ['ViT-B/16 (google/vit-base-patch16-224)', 'logit lens (own LN + classifier on CLS, every layer) · attention rollout + last-layer CLS attention · brightness probe per layer', 'works — forward matches HF to 2.6e-7 logits'],
  ['CLIP ViT-B/32 vision tower (laion2B)', 'layer-wise image-embedding lens (cos to final embedding) · rollout · probes', 'works — image embedding matches HF to 1e-8; no text tower, so no zero-shot lens'],
  ['Whisper-tiny.en encoder', 'log-mel front end · last-layer attention map · per-layer state norm · frame-energy probe', 'works — encoder matches HF to 1e-14; decoder lens NOT implemented'],
  ['MiniLM / TTS / OCR / captioning / distilgpt2 (transformers.js ONNX)', 'none: the ONNX exports expose no hidden states', 'not available (inference only)'],
];
export const markup = {
  hinterp: ['H-INTERP', 'HUB model interpretability', `<fieldset><legend>model ${tipq('Weights are fetched from the Hugging Face Hub at a pinned commit (ViT and Whisper are SHA-256-checked; the CLIP vision tower is range-fetched out of the 605 MB checkpoint, so only the revision is pinned). The forward pass is our own float64 JavaScript port of the HF code, tested against HF to ≤1e-4, so the internals shown are the real model’s.')}</legend>
<div class="r"><select id="hiM" aria-label="hub model"><option value="vit">ViT-B/16 classifier (346 MB)</option><option value="clip">CLIP ViT-B/32 vision (~350 MB of 605)</option><option value="whisper">Whisper-tiny.en encoder (151 MB)</option></select>
<input type="file" id="hiFile" accept="image/*,audio/*" aria-label="image or audio file"/><button id="hiTest">use test input</button><button class="pri" id="hiGo">run</button></div>
<div class="sm" id="hiSt" aria-live="polite">Runs in a worker; a ViT forward takes ~10–30 s on a laptop CPU.</div><canvas id="hiCv" width="448" height="224" class="ch" aria-label="input and attention overlay"></canvas><div id="hiOut"></div></fieldset>
<fieldset><legend>which tools work on which HUB model</legend><div id="hiWorks">${kv([['<b>model</b>', '<b>tools · status</b>'], ...WORKS.map(([m, t, s]) => [esc(m), `${esc(t)}<br><span class="sm">${esc(s)}</span>`])])}</div></fieldset>`],
  v16: ['NEW v16', "What's new in v16", `<fieldset><legend>new in v16.0.0</legend><ul class="sm">
<li><b>Arch interface</b> (src/arch/arch.js): one forward for GPT-Neo, GPT-2 and Llama/Qwen2/Mistral-style checkpoints, matching HF within 1e-4 (tested on TinyStories-8M, distilgpt2, SmolLM-135M, Qwen2.5-0.5B). The lab tabs still use the specialised TinyStories-8M engine.</li>
<li><b>WebGPU path</b> (opt-in, below): WGSL kernels for the clean forward, refused unless a logits-match gate passes; otherwise JS.</li>
<li><b>HUB interpretability</b> (H-INTERP tab): logit/embedding lens, rollout, probes on ViT, CLIP vision and Whisper encoder.</li>
<li><b>Enforced pre-registration</b> (REPRO tab): schema-validated, hashed, commit-pinned runs with a downloadable REPRO bundle; tools/prereg-run.mjs for the CLI.</li>
<li><b>Release hygiene</b>: Electron pinned exactly, npm ci, hash-pinned model downloads; signing status in RELEASE_NOTES.</li></ul></fieldset>
<fieldset><legend>WebGPU (opt-in) ${tipq('Builds the WGSL engine from the current clean weights, runs every position of a fixed prompt through both it and the JS engine, and refuses it if any logit differs by more than 2e-3. Then times 32 steps on each. Only the clean forward is on the GPU: steering, ablations and hooks always use JS.')}</legend>
<div class="r"><button class="pri" id="wgGo">gate + benchmark</button><span class="sm">benchmark only: generation, steering and lab tools always run on the JS engine</span></div><div id="wgOut" class="sm" aria-live="polite">${typeof navigator !== 'undefined' && navigator.gpu ? 'navigator.gpu present' : 'navigator.gpu not present in this browser: JS only'}</div></fieldset>`],
};
let W = null, seq = 0; const pend = {};
function worker() { if (W) return W; W = new Worker(new URL('./arch/encoder-worker.js?v=160', import.meta.url), { type: 'module' });
  W.onmessage = ({ data }) => { const p = pend[data.id]; if (!p) return; if (data.progress) return p.say?.(data.progress); delete pend[data.id]; data.err ? p.rej(new Error(data.err)) : p.res(data.ok); }; return W; }
const call = (op, args, say, transfer = []) => new Promise((res, rej) => { const id = ++seq; pend[id] = { res, rej, say }; worker().postMessage({ id, op, args }, transfer); });
function testImage(S = 224) { const c = new OffscreenCanvas(S, S), g = c.getContext('2d'); g.fillStyle = '#2b6cb0'; g.fillRect(0, 0, S, S); g.fillStyle = '#f6e05e'; g.beginPath(); g.arc(S * 0.62, S * 0.4, S * 0.22, 0, 7); g.fill(); g.fillStyle = '#2f855a'; g.fillRect(0, S * 0.75, S, S * 0.25); return c; }
function pixels(src, key, S = 224) { const c = new OffscreenCanvas(S, S), g = c.getContext('2d'), w = src.width, h = src.height;
  if (key === 'clip') { const s = S / Math.min(w, h); g.drawImage(src, (S - w * s) / 2, (S - h * s) / 2, w * s, h * s); } else g.drawImage(src, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S).data, px = new Float32Array(3 * S * S);
  for (let i = 0; i < S * S; i++) for (let ch = 0; ch < 3; ch++) { const v = d[i * 4 + ch] / 255; px[ch * S * S + i] = key === 'clip' ? (v - CLIP_MEAN[ch]) / CLIP_STD[ch] : (v - 0.5) / 0.5; } return { px, canvas: c }; }
async function audio16k(file) { const AC = self.OfflineAudioContext; if (!file) { const a = new Float32Array(3 * 16000); for (let i = 0; i < a.length; i++) { const t = i / 16000; a[i] = (t > 0.5 && t < 2.2 ? 0.3 : 0) * Math.sin(2 * Math.PI * (200 * t + 300 * t * t)); } return a; }
  const buf = await new AudioContext().decodeAudioData(await file.arrayBuffer()), n = Math.min(30, buf.duration) * 16000, oc = new AC(1, Math.ceil(n), 16000), s = oc.createBufferSource(); s.buffer = buf; s.connect(oc.destination); s.start(); return (await oc.startRendering()).getChannelData(0); }
const heat = (v) => { const x = Math.max(0, Math.min(1, v)); return `rgba(${Math.round(255 * x)},${Math.round(80 + 120 * x)},${Math.round(255 * (1 - x))},${0.25 + 0.6 * x})`; };
function overlay(cv, img, grid, g) { const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0, 224, 224); c.drawImage(img, 224, 0, 224, 224); const mx = Math.max(...grid), s = 224 / g;
  for (let p = 0; p < grid.length; p++) { c.fillStyle = heat(grid[p] / mx); c.fillRect(224 + (p % g) * s, Math.floor(p / g) * s, s, s); } }
function matrix(cv, A, S) { const c = cv.getContext('2d'), w = cv.width, h = cv.height, mx = Math.max(...A); c.clearRect(0, 0, w, h); const cs = Math.min(w, h) / S; for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) { c.fillStyle = heat(Math.sqrt(A[i * S + j] / mx)); c.fillRect(j * cs, i * cs, cs, cs); } }
const probeTable = (p) => kv([[`<b>layer</b>`, `<b>probe: ${esc(p.task)}</b> (first 128 residual dims, ridge, held-out half)`], ...p.rows.map((r, l) => [l === 0 ? 'embed' : 'L' + l, `test acc ${(100 * r.testAcc).toFixed(1)}% vs majority ${(100 * r.testMajority).toFixed(1)}% <span class="sm">(n=${r.nTest})</span>`])]);
export function install(A, out) {
  const on = A.on, say = (s) => { const e = $('hiSt'); if (e) e.textContent = s; };
  let input = null; on('hiFile', 'change', () => { input = $('hiFile').files?.[0] || null; say(input ? `selected ${input.name}` : ''); }); on('hiTest', 'click', () => { input = null; if ($('hiFile')) $('hiFile').value = ''; say('using the built-in test input'); });
  out.hubInterp = async (key = $('hiM')?.value || 'vit') => { const isImg = key !== 'whisper'; let r;
    if (isImg) { const src = input && input.type.startsWith('image/') ? await createImageBitmap(input) : testImage(), { px, canvas } = pixels(src, key); r = await call('run', { key, input: px }, say, [px.buffer]); if ($('hiCv')) overlay($('hiCv'), canvas, r.rollout, r.g); }
    else { const a = await audio16k(input && input.type.startsWith('audio/') ? input : null); r = await call('run', { key, audio: a }, say); if ($('hiCv')) matrix($('hiCv'), r.attn, r.S); }
    const head = [['weights', esc(r.verified)], ['tokens × layers × heads', `${r.N} × ${r.L} × ${r.H}`], ['forward time', `${(r.ms / 1000).toFixed(1)} s (float64 JS in a worker)`]];
    let body = ''; if (r.lens) body = kv([['<b>layer</b>', '<b>logit lens top-3 (CLS → final LN → classifier)</b>'], ...r.lens.map((t, l) => [l === 0 ? 'embed' : 'L' + l, t.map(([n, p]) => `${esc(n)} <span class="sm">${(100 * p).toFixed(1)}%</span>`).join(' · ')])]);
    if (r.cos) body = kv([['<b>layer</b>', '<b>cos(layer CLS embedding, final image embedding)</b>'], ...r.cos.map((c, l) => [l === 0 ? 'embed' : 'L' + l, c.toFixed(4)])]);
    if (r.norms) body = kv([['<b>layer</b>', '<b>RMS of encoder state</b>'], ...r.norms.map((c, l) => [l === 0 ? 'embed' : 'L' + l, c.toFixed(3)])]);
    if ($('hiOut')) $('hiOut').innerHTML = kv(head) + `<div class="sm">${isImg ? 'left: input · right: attention rollout from CLS (all layers)' : 'last-layer attention, head mean, 1500 frames binned to 100×100 (sqrt colour)'}</div>` + body + probeTable(r.probe);
    say(`done in ${(r.ms / 1000).toFixed(1)} s`); A.logRun?.({ kind: 'hinterp', label: key, metrics: { ms: r.ms, N: r.N } }); return r; };
  on('hiGo', 'click', () => out.hubInterp());
  // ── opt-in WebGPU ──
  let gpu = null;
  out.webgpu = async () => { const o = $('wgOut'), N = window.NEURALESE, eng = N?.engClean; if (!eng) throw new Error('model not loaded yet'); if (o) o.textContent = 'building WGSL engine + running logits gate…';
    const [{ WebGPUEngine }, { CFG }] = await Promise.all([import('./gpu/webgpu-engine.js?v=160'), import('./model.js?v=160')]); gpu?.destroy?.(); gpu = null;
    const { eng: g, reason, gate } = await WebGPUEngine.create(eng.W, CFG, { gateEngine: eng }); if (!g) { if (o) o.textContent = `WebGPU refused: ${reason} → JS engine stays in use`; return { ok: false, reason }; }
    const n = 32; let s = g.newSeq(), t0 = performance.now(); for (let i = 0; i < n; i++) await g.step(s, 100 + i); const gpuTps = n / ((performance.now() - t0) / 1000);
    s = eng.newSeq(1); t0 = performance.now(); for (let i = 0; i < n; i++) eng.logits(eng.step(s, 100 + i).h); const jsTps = n / ((performance.now() - t0) / 1000); gpu = g;
    const res = { ok: true, adapter: g.adapterInfo, gateMaxAbs: gate.maxAbs, gpuTps, jsTps }; if (o) o.innerHTML = kv([['adapter', esc(g.adapterInfo || '?')], ['gate max |Δlogit|', gate.maxAbs.toExponential(2) + ' ≤ 2e-3 ✔'], ['WebGPU', gpuTps.toFixed(1) + ' tok/s'], ['JS (main thread)', jsTps.toFixed(1) + ' tok/s'], ['note', /swiftshader/i.test(g.adapterInfo || '') ? 'software adapter: numbers say nothing about real GPUs' : 'single-token decode of an 8M model is launch-bound; JS can win']]);
    A.logRun?.({ kind: 'webgpu', label: 'gate+bench', metrics: { gate: gate.maxAbs, gpuTps, jsTps } }); return res; };
  out.webgpuEngine = () => gpu; // gated engine for scripting via NEURALESE.v6.out (not used by the UI's generation)
  on('wgGo', 'click', () => out.webgpu());
}

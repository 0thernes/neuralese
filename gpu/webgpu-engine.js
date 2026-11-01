// v16 WebGPU forward path (WGSL) for the GPT-Neo-8M engine — the clean path only: default runtime R, no hooks, steering, ablations or
// traces. The JS Engine stays the reference: create() runs a logits-match gate (every position of a fixed prompt, max |Δlogit| ≤ tol
// against Engine) and returns null if WebGPU is missing or the gate fails, so callers fall back to JS. f32 throughout; one token per
// step with a GPU-resident KV cache (maxT positions).
const WG = 64;
const SHADERS = /* wgsl */ `
struct P { nOut: u32, nIn: u32, flags: u32, outOff: u32, layer: u32, pos: u32, win: u32, a: u32 };
@group(0) @binding(0) var<storage, read> Wm: array<f32>;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read_write> o: array<f32>;
@group(0) @binding(3) var<storage, read> bias: array<f32>;
@group(0) @binding(4) var<uniform> p: P;
fn gelu(v: f32) -> f32 { return 0.5 * v * (1.0 + tanh(0.7978845608028654 * (v + 0.044715 * v * v * v))); }
// out[outOff+i] = (flags&2 ? out[outOff+i] : 0) + (flags&1 ? bias[i] : 0) + sum_j W[i*nIn+j] x[j]; flags&4 → gelu
@compute @workgroup_size(${WG}) fn matvec(@builtin(global_invocation_id) g: vec3<u32>) {
  let i = g.x + g.y * 65535u * ${WG}u; if (i >= p.nOut) { return; }
  var s = 0.0; let r = i * p.nIn; for (var j = 0u; j < p.nIn; j++) { s += Wm[r + j] * x[j]; }
  if ((p.flags & 1u) != 0u) { s += bias[i]; } if ((p.flags & 4u) != 0u) { s = gelu(s); }
  if ((p.flags & 2u) != 0u) { s += o[p.outOff + i]; } o[p.outOff + i] = s; }
var<workgroup> red: array<f32, 256>;
// layernorm over nIn ≤ 256 elements: o = (x-m)/sqrt(v+eps)*W + bias  (Wm = gain)
@compute @workgroup_size(256) fn layernorm(@builtin(local_invocation_id) l: vec3<u32>) {
  let i = l.x; let n = p.nIn; var xv = 0.0; if (i < n) { xv = x[i]; }
  red[i] = xv; workgroupBarrier(); for (var s = 128u; s > 0u; s >>= 1u) { if (i < s) { red[i] += red[i + s]; } workgroupBarrier(); }
  let m = red[0] / f32(n); workgroupBarrier(); var q = 0.0; if (i < n) { q = (xv - m) * (xv - m); } red[i] = q; workgroupBarrier();
  for (var s = 128u; s > 0u; s >>= 1u) { if (i < s) { red[i] += red[i + s]; } workgroupBarrier(); }
  let r = 1.0 / sqrt(red[0] / f32(n) + 1e-5); if (i < n) { o[i] = (xv - m) * r * Wm[i] + bias[i]; } }
`;
const ATTN = /* wgsl */ `
struct P { nOut: u32, nIn: u32, flags: u32, outOff: u32, layer: u32, pos: u32, win: u32, a: u32 };
@group(0) @binding(0) var<storage, read> K: array<f32>;
@group(0) @binding(1) var<storage, read> q: array<f32>;
@group(0) @binding(2) var<storage, read_write> z: array<f32>;
@group(0) @binding(3) var<storage, read> V: array<f32>;
@group(0) @binding(4) var<uniform> p: P;
var<workgroup> sc: array<f32, MAXT>;
var<workgroup> red: array<f32, 64>;
// one workgroup per head; K/V caches are [layer][t][d]; unscaled dot products (GPT-Neo), local window when p.win > 0
@compute @workgroup_size(64) fn attn(@builtin(workgroup_id) w: vec3<u32>, @builtin(local_invocation_id) l: vec3<u32>) {
  let h = w.x; let d = p.nIn; let hd = p.nOut; let T = p.pos + 1u; let base = p.layer * MAXTu * d; let tid = l.x;
  var lo = 0u; if (p.win > 0u && T > p.win) { lo = T - p.win; }
  var mx = -3.4e38;
  for (var j = lo + tid; j < T; j += 64u) { var a = 0.0; for (var i = 0u; i < hd; i++) { a += q[h * hd + i] * K[base + j * d + h * hd + i]; } sc[j] = a; mx = max(mx, a); }
  red[tid] = mx; workgroupBarrier(); for (var s = 32u; s > 0u; s >>= 1u) { if (tid < s) { red[tid] = max(red[tid], red[tid + s]); } workgroupBarrier(); }
  let M = red[0]; workgroupBarrier(); var sum = 0.0;
  for (var j = lo + tid; j < T; j += 64u) { let e = exp(sc[j] - M); sc[j] = e; sum += e; }
  red[tid] = sum; workgroupBarrier(); for (var s = 32u; s > 0u; s >>= 1u) { if (tid < s) { red[tid] += red[tid + s]; } workgroupBarrier(); }
  let Z = red[0]; workgroupBarrier();
  if (tid < hd) { var acc = 0.0; for (var j = lo; j < T; j++) { acc += sc[j] * V[base + j * d + h * hd + tid]; } z[h * hd + tid] = acc / Z; } }
`;
export class WebGPUEngine {
  static async create(W, CFG, { maxT = 512, gateEngine = null, gatePrompt = [464, 2068, 7586, 21831, 18045, 625, 262, 16931], tol = 2e-3 } = {}) {
    if (typeof navigator === 'undefined' || !navigator.gpu) return { eng: null, reason: 'navigator.gpu unavailable' };
    const ad = await navigator.gpu.requestAdapter(); if (!ad) return { eng: null, reason: 'no WebGPU adapter' };
    const need = CFG.V * CFG.d * 4; if (ad.limits.maxStorageBufferBindingSize < need) return { eng: null, reason: 'maxStorageBufferBindingSize too small' };
    const dev = await ad.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: need, maxBufferSize: Math.max(need, maxT * CFG.L * CFG.d * 4) } });
    const e = new WebGPUEngine(dev, W, CFG, maxT); e.adapterInfo = ad.info ? `${ad.info.vendor || ''} ${ad.info.architecture || ''} ${ad.info.description || ''}`.trim() : '';
    if (gateEngine) { const g = await e.gate(gateEngine, gatePrompt); e.gateResult = g; if (!(g.maxAbs <= tol)) { e.destroy(); return { eng: null, reason: `logits-match gate failed: max |Δlogit| ${g.maxAbs} > ${tol}`, gate: g }; } }
    return { eng: e, reason: 'ok', gate: e.gateResult };
  }
  constructor(dev, W, CFG, maxT) {
    this.dev = dev; this.C = CFG; this.maxT = maxT; const { d, L, ff } = CFG;
    const mk = (n, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC) => dev.createBuffer({ size: Math.max(16, n * 4), usage });
    const up = (a) => { const b = mk(a.length); dev.queue.writeBuffer(b, 0, a); return b; };
    this.mk = mk; this.up = up; this.upload(W);
    this.x = mk(d); this.h = mk(d); this.q = mk(d); this.z = mk(d); this.a = mk(ff); this.lg = mk(CFG.V); this.zero = mk(ff);
    this.K = mk(L * maxT * d); this.Vc = mk(L * maxT * d);
    this.read = dev.createBuffer({ size: CFG.V * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const m1 = dev.createShaderModule({ code: SHADERS }), m2 = dev.createShaderModule({ code: ATTN.replaceAll('MAXTu', maxT + 'u').replaceAll('MAXT', String(maxT)) });
    this.pMat = dev.createComputePipeline({ layout: 'auto', compute: { module: m1, entryPoint: 'matvec' } });
    this.pLn = dev.createComputePipeline({ layout: 'auto', compute: { module: m1, entryPoint: 'layernorm' } });
    this.pAt = dev.createComputePipeline({ layout: 'auto', compute: { module: m2, entryPoint: 'attn' } });
    this.ops = this.buildOps(); this.ready = true;
  }
  upload(W) { this.W = W; const u = this.up; this.gw = { wte: u(W.wte), wpe: W.wpe, lnfW: u(W.lnfW), lnfB: u(W.lnfB), layers: W.layers.map((P) => Object.fromEntries(Object.entries(P).map(([k, v]) => [k, u(v)]))) }; if (this.ops) this.ops = this.buildOps(); }
  buildOps() { // static op list; only the pos field of some uniforms changes per step
    const { d, L, ff, V, H, hd } = this.C, dev = this.dev, ops = [], G = this.gw;
    const U = (vals) => { const b = dev.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); dev.queue.writeBuffer(b, 0, new Uint32Array(vals)); return b; };
    const bg = (pipe, bufs, u) => dev.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [...bufs, u].map((b, i) => ({ binding: i, resource: { buffer: b } })) });
    const mat = (Wb, xb, ob, bb, nOut, nIn, flags, outOff = 0, posDep = false) => { const u = U([nOut, nIn, flags, outOff, 0, 0, 0, 0]); ops.push({ k: 'mat', bg: bg(this.pMat, [Wb, xb, ob, bb || this.zero], u), n: nOut, u, posDep, outOffBase: outOff }); };
    const ln = (gain, b, xb, ob) => { const u = U([d, d, 0, 0, 0, 0, 0, 0]); ops.push({ k: 'ln', bg: bg(this.pLn, [gain, xb, ob, b], u) }); };
    for (let l = 0; l < L; l++) { const P = G.layers[l];
      ln(P.ln1w, P.ln1b, this.x, this.h); mat(P.q, this.h, this.q, null, d, d, 0);
      mat(P.k, this.h, this.K, null, d, d, 0, l * this.maxT * d, true); mat(P.v, this.h, this.Vc, null, d, d, 0, l * this.maxT * d, true);
      const u = U([hd, d, 0, 0, l, 0, l % 2 ? this.C.window : 0, 0]); ops.push({ k: 'attn', bg: bg(this.pAt, [this.K, this.q, this.z, this.Vc], u), u, l });
      mat(P.o, this.z, this.x, P.ob, d, d, 1 | 2); ln(P.ln2w, P.ln2b, this.x, this.h); mat(P.fc, this.h, this.a, P.fcb, ff, d, 1 | 4); mat(P.proj, this.a, this.x, P.projb, d, ff, 1 | 2); }
    ln(G.lnfW, G.lnfB, this.x, this.h); mat(G.wte, this.h, this.lg, null, V, d, 0); return ops; }
  newSeq() { return { T: 0, ids: [] }; }
  // one token → Float32Array logits (V). Matches Engine.step + Engine.logits for the default runtime.
  async step(seq, tok) {
    const { d } = this.C, t = seq.T; if (t >= this.maxT) throw new Error('WebGPU KV cache full (maxT ' + this.maxT + ')');
    if (this.lastSeq !== seq) { this.lastSeq = seq; } // KV cache is single-sequence: callers use one GPU engine per stream
    const x0 = new Float32Array(d); for (let i = 0; i < d; i++) x0[i] = this.W.wte[tok * d + i] + this.W.wpe[t * d + i]; this.dev.queue.writeBuffer(this.x, 0, x0);
    for (const op of this.ops) { if (op.posDep) this.dev.queue.writeBuffer(op.u, 12, new Uint32Array([op.outOffBase + t * d])); else if (op.k === 'attn') this.dev.queue.writeBuffer(op.u, 20, new Uint32Array([t])); }
    const enc = this.dev.createCommandEncoder();
    for (const op of this.ops) { const pass = enc.beginComputePass(); if (op.k === 'mat') { pass.setPipeline(this.pMat); pass.setBindGroup(0, op.bg); const wg = Math.ceil(op.n / WG); pass.dispatchWorkgroups(Math.min(wg, 65535), Math.ceil(wg / 65535)); }
      else if (op.k === 'ln') { pass.setPipeline(this.pLn); pass.setBindGroup(0, op.bg); pass.dispatchWorkgroups(1); } else { pass.setPipeline(this.pAt); pass.setBindGroup(0, op.bg); pass.dispatchWorkgroups(this.C.H); } pass.end(); }
    enc.copyBufferToBuffer(this.lg, 0, this.read, 0, this.C.V * 4); this.dev.queue.submit([enc.finish()]);
    await this.read.mapAsync(GPUMapMode.READ); const out = new Float32Array(this.read.getMappedRange().slice(0)); this.read.unmap(); seq.T++; seq.ids.push(tok); return out;
  }
  async gate(eng, ids) { const s = eng.newSeq(ids.length), g = this.newSeq(); let maxAbs = 0; const t0 = performance.now();
    for (const id of ids) { const r = eng.step(s, id), a = eng.logits(r.h), b = await this.step(g, id); for (let i = 0; i < a.length; i++) { const dd = Math.abs(a[i] - b[i]); if (!(dd <= maxAbs)) maxAbs = dd; } }
    return { maxAbs, n: ids.length, ms: performance.now() - t0 }; }
  destroy() { this.ready = false; try { this.dev.destroy(); } catch { /* already gone */ } }
}

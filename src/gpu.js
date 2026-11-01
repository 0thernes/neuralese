// WebGPU compute backend: matrix–vector / matrix–matrix products in WGSL (f32), with CPU fallback and a verification harness.
// Used for the 50257×d unembedding (the single largest op per token) and batched y = W·x for any weight matrix.
const WGSL = `
struct Dims { rows: u32, cols: u32, n: u32, pad: u32 };
@group(0) @binding(0) var<storage, read> W: array<f32>;
@group(0) @binding(1) var<storage, read> X: array<f32>;
@group(0) @binding(2) var<storage, read_write> Y: array<f32>;
@group(0) @binding(3) var<uniform> D: Dims;
var<workgroup> part: array<f32, 64>;
// one workgroup of 64 threads per (row, vector) pair; strided dot product + tree reduction
@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) li: vec3<u32>, @builtin(num_workgroups) nw: vec3<u32>) {
  let row = wg.x + wg.y * nw.x; let v = wg.z; if (row >= D.rows) { return; }
  var s: f32 = 0.0; let wo = row * D.cols; let xo = v * D.cols;
  for (var i: u32 = li.x; i < D.cols; i = i + 64u) { s = s + W[wo + i] * X[xo + i]; }
  part[li.x] = s; workgroupBarrier();
  var k: u32 = 32u; loop { if (k == 0u) { break; } if (li.x < k) { part[li.x] = part[li.x] + part[li.x + k]; } workgroupBarrier(); k = k / 2u; }
  if (li.x == 0u) { Y[v * D.rows + row] = part[0]; }
}`;
export function cpuMatVec(W, rows, cols, X, n = 1) { const Y = new Float32Array(rows * n); for (let v = 0; v < n; v++) for (let r = 0; r < rows; r++) { let s = 0; const o = r * cols, xo = v * cols; for (let i = 0; i < cols; i++) s += W[o + i] * X[xo + i]; Y[v * rows + r] = s; } return Y; }
export class GPU {
  static async create() {
    if (typeof navigator === 'undefined' || !navigator.gpu) return { ok: false, why: 'navigator.gpu is not available in this browser/context' };
    const adapter = await navigator.gpu.requestAdapter(); if (!adapter) return { ok: false, why: 'no WebGPU adapter (GPU blocklisted or headless without GPU)' };
    const dev = await adapter.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: Math.min(adapter.limits.maxStorageBufferBindingSize, 256 * 1024 * 1024), maxBufferSize: Math.min(adapter.limits.maxBufferSize, 256 * 1024 * 1024) } });
    const g = new GPU(); g.dev = dev; g.info = adapter.info || {}; g.pipe = dev.createComputePipeline({ layout: 'auto', compute: { module: dev.createShaderModule({ code: WGSL }), entryPoint: 'main' } }); g.mats = new Map(); return { ok: true, gpu: g };
  }
  upload(key, W, rows, cols) { const old = this.mats.get(key); if (old) old.buf.destroy(); const buf = this.dev.createBuffer({ size: W.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }); this.dev.queue.writeBuffer(buf, 0, W); this.mats.set(key, { buf, rows, cols, src: W }); }
  // Y[n×rows] = X[n×cols] · Wᵀ
  async matvec(key, X, n = 1) {
    const m = this.mats.get(key); if (!m) throw new Error('matrix not uploaded: ' + key); const dev = this.dev;
    const xb = dev.createBuffer({ size: X.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }); dev.queue.writeBuffer(xb, 0, X);
    const size = m.rows * n * 4, yb = dev.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }), rb = dev.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const ub = dev.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); dev.queue.writeBuffer(ub, 0, new Uint32Array([m.rows, m.cols, n, 0]));
    const bg = dev.createBindGroup({ layout: this.pipe.getBindGroupLayout(0), entries: [xb, yb, ub].reduce((a, b, i) => (a.push({ binding: i + 1, resource: { buffer: b } }), a), [{ binding: 0, resource: { buffer: m.buf } }]) });
    const enc = dev.createCommandEncoder(), p = enc.beginComputePass(); p.setPipeline(this.pipe); p.setBindGroup(0, bg); const gx = Math.min(m.rows, 65535); p.dispatchWorkgroups(gx, Math.ceil(m.rows / gx), n); p.end(); enc.copyBufferToBuffer(yb, 0, rb, 0, size); dev.queue.submit([enc.finish()]);
    await rb.mapAsync(GPUMapMode.READ); const Y = new Float32Array(rb.getMappedRange().slice(0)); rb.unmap(); [xb, yb, rb, ub].forEach((b) => b.destroy()); return Y;
  }
  // Verification: max |GPU − CPU| relative to max |CPU| on random inputs, plus timing for both paths.
  async verify(key, trials = 3) { const m = this.mats.get(key); let worst = 0; for (let t = 0; t < trials; t++) { const X = new Float32Array(m.cols).map(() => Math.random() * 2 - 1); const a = await this.matvec(key, X), b = cpuMatVec(m.src, m.rows, m.cols, X); let mx = 0, sc = 0; for (let i = 0; i < a.length; i++) { mx = Math.max(mx, Math.abs(a[i] - b[i])); sc = Math.max(sc, Math.abs(b[i])); } worst = Math.max(worst, mx / (sc || 1)); } return worst; }
}
// Benchmark: tokens/s of the unembedding step and of a full engine step, CPU vs GPU (GPU path only replaces the unembedding).
export async function bench(g, eng, W, ids, reps = 20) {
  const d = W.lnfW.length, V = W.wte.length / d, X = new Float32Array(d).map(() => Math.random()); const now = () => performance.now();
  let t0 = now(); for (let i = 0; i < reps; i++) cpuMatVec(W.wte, V, d, X); const cpuU = (now() - t0) / reps; let gpuU = null, gpuB = null;
  if (g) { await g.matvec('wte', X); t0 = now(); for (let i = 0; i < reps; i++) await g.matvec('wte', X); gpuU = (now() - t0) / reps; const B = new Float32Array(d * 16).map(() => Math.random()); t0 = now(); await g.matvec('wte', B, 16); gpuB = (now() - t0) / 16; }
  const s = eng.newSeq(ids.length + 2); t0 = now(); let r; for (const t of ids) r = eng.step(s, t); const stepCpu = (now() - t0) / ids.length; t0 = now(); for (let i = 0; i < 4; i++) eng.logits(r.h); const lgCpu = (now() - t0) / 4;
  return { cpuUnembedMs: cpuU, gpuUnembedMs: gpuU, gpuBatchedPerVecMs: gpuB, stepMs: stepCpu, logitsMs: lgCpu,
    cpuTokS: 1000 / (stepCpu + lgCpu), gpuTokS: gpuU == null ? null : 1000 / (stepCpu + gpuU) };
}

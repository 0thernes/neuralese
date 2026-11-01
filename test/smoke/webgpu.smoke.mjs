// v16 smoke: the WGSL forward path passes the logits-match gate against the JS Engine (clean weights, default runtime) and reports
// honest tok/s for both. Headless Chrome here uses SwiftShader's *software* WebGPU adapter, so speed numbers say nothing about real GPUs.
// Usage: node test/smoke/webgpu.smoke.mjs http://localhost:8765/
import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'http://localhost:8765/';
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 1200000, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-webgpu-adapter=swiftshader'] });
const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url + '?noworker'); await p.waitForFunction(() => window.NEURALESE && window.NEURALESE_LAST, { timeout: 600000 });
const r = await p.evaluate(async () => {
  const { WebGPUEngine } = await import('./gpu/webgpu-engine.js?v=160'); const { CFG } = await import('./model.js?v=160'); const N = window.NEURALESE, eng = N.engClean;
  const ids = [464, 2068, 7586, 21831, 18045, 625, 262, 16931, 3290, 13, 1881, 1110];
  const { eng: g, reason, gate } = await WebGPUEngine.create(eng.W, CFG, { gateEngine: eng, gatePrompt: ids }); if (!g) return { reason, gate };
  const n = 32; let s = g.newSeq(), t0 = performance.now(); for (let i = 0; i < n; i++) await g.step(s, 100 + i); const gpuTps = n / ((performance.now() - t0) / 1000);
  s = eng.newSeq(1); t0 = performance.now(); for (let i = 0; i < n; i++) eng.logits(eng.step(s, 100 + i).h); const jsTps = n / ((performance.now() - t0) / 1000);
  // a corrupted weight must make the gate fail (proves the gate is live, not a rubber stamp)
  const bad = { ...eng.W, lnfW: eng.W.lnfW.map((v, i) => (i === 3 ? v * 1.5 : v)) }; const { CFG: C2 } = await import('./model.js?v=160');
  const b2 = await WebGPUEngine.create(bad, C2, { gateEngine: eng, gatePrompt: ids.slice(0, 3) });
  return { reason, gate, adapter: g.adapterInfo, gpuTps, jsTps, corruptedGateRejected: !b2.eng, corruptedReason: b2.reason };
});
console.log(JSON.stringify(r)); const ok = r.gate && r.gate.maxAbs <= 2e-3 && r.corruptedGateRejected && !errs.length; console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL', errs); await b.close(); process.exit(ok ? 0 : 1);

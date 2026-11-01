// Neuron Lens in-browser refit: fits one document's R-lens and S-lens on the current weights (same code path as tools/nlens-fit.mjs).
import { prepare, docJacobianR, docJacobianS } from './neuronlens.js?v=152';
self.onmessage = (e) => {
  const { W, cfg, ids, kinds } = e.data; const t0 = performance.now();
  try {
    const M = prepare(W, cfg), res = {}; let done = 0; const total = kinds.length * cfg.L;
    const tick = () => self.postMessage({ progress: ++done / total });
    for (const k of kinds) { const r = (k === 'R' ? docJacobianR : docJacobianS)(M, ids, 32, tick); res[k] = { out: r.out.map((a) => Float32Array.from(a)), mid: r.mid.map((a) => Float32Array.from(a)) }; }
    self.postMessage({ done: true, res, seconds: (performance.now() - t0) / 1000 });
  } catch (err) { self.postMessage({ error: String(err?.stack || err) }); }
};

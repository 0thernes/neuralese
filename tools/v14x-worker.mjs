// Worker for tools/v14x-lib.mjs steerDeltas: Δ mean log-prob (rows 16..63, kept vocab) from adding vec at layer l's MLP output.
import { parentPort, workerData } from 'node:worker_threads';
import { loadModel } from './nlens-common.mjs';
import * as NL from '../neuronlens.js';
const M = loadModel(workerData.modelDir), { evalDocs, kept } = workerData, V = M.cfg.V, ROWS = Array.from({ length: 48 }, (_, i) => 16 + i), base = new Map();
function meanLP(ids, steer) { const f = NL.forward(M, ids, { steer, logits: true, logitRows: ROWS }), lg = f.logits, m = new Float64Array(kept.length);
  for (let r = 0; r < ROWS.length; r++) { const o = r * V; let mx = -Infinity; for (let v = 0; v < V; v++) if (lg[o + v] > mx) mx = lg[o + v]; let z = 0; for (let v = 0; v < V; v++) z += Math.exp(lg[o + v] - mx); const c = mx + Math.log(z);
    for (let k = 0; k < kept.length; k++) m[k] += (lg[o + kept[k]] - c) / ROWS.length; } return m; }
parentPort.on('message', ({ i, l, vec }) => { const D = new Float32Array(kept.length);
  evalDocs.forEach((ids, di) => { if (!base.has(di)) base.set(di, meanLP(ids)); const b = base.get(di), s = meanLP(ids, { layer: l, vec: Float32Array.from(vec), from: 16, to: 64 }); for (let k = 0; k < kept.length; k++) D[k] += (s[k] - b[k]) / evalDocs.length; });
  parentPort.postMessage({ i, D }); });

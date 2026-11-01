// v14.2 — SAE features vs MLP neurons through the R-lens (PREREG-v14x §14.2). Usage: node tools/v14x-sae.mjs [--workers 4]
import { setup, steerDeltas, scoreA, writeResult, p99, arg, r4 } from './v14x-lib.mjs';
import { docsFrom } from './nlens-common.mjs';
import { SAE } from '../src/sae.js';
import * as NL from '../src/neuronlens.js';
const t0 = Date.now(), S = await setup(), { M, kept, evalDocs, Z, tok, st } = S, { d } = M.cfg, LAY = 3;
const rows = (docs) => { const X = []; for (const ids of docs) { const f = NL.forward(M, ids, { outs: true }); for (let t = 16; t < 64; t++) X.push(f.outs[LAY].subarray(t * d, t * d + d)); } const B = new Float32Array(X.length * d); X.forEach((x, i) => B.set(x, i * d)); return [B, X.length]; };
const [X, N] = rows(docsFrom(tok, st, 0, 64, 64).map((x) => x.ids)), sae = new SAE(LAY, 1024, 1);
await sae.train(X, N, { epochs: 3, lr: 2e-3, l1: 3e-3 }); const an = sae.analyse(X, N); console.log('SAE fvu', an.fvu, 'alive', an.alive);
const alive = []; for (let f = 0; f < 1024; f++) if (an.dens[f] >= 0.005) alive.push(f);
const r = NL.mulberry(14200); for (let i = alive.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [alive[i], alive[j]] = [alive[j], alive[i]]; }
const feats = alive.slice(0, 64), [XE, NE] = rows(evalDocs), fa = feats.map(() => []), buf = new Float32Array(1024);
for (let i = 0; i < NE; i++) { sae.encode(XE.subarray(i * d, i * d + d), buf); feats.forEach((f, k) => fa[k].push(buf[f])); }
const dirs = feats.map((f) => sae.Wdec.slice(f * d, f * d + d)), items = dirs.map((w, k) => ({ l: LAY, vec: Array.from(w, (x) => x * 4 * Math.max(0.05, p99(fa[k]))) }));
const Ds = await steerDeltas('model', items, evalDocs, kept, +arg('workers', 4)), KT = NL.tokMatT(M, kept, false);
const rd = (J) => dirs.map((w) => NL.readsR(M, w, 1, J, kept, KT));
const res = { 'R.out': scoreA(rd(Z.R.out[LAY]), Ds), logit: scoreA(rd(null), Ds) };
writeResult('lens/ts8m/v14x-sae.json', { layer: LAY, sae: { m: 1024, l1: 3e-3, epochs: 3, trainRows: N, fvu: r4(an.fvu), alive: an.alive, aliveDense: alive.length }, features: feats, doses: items.map((it, k) => r4(4 * Math.max(0.05, p99(fa[k])))), testA: res, seconds: Math.round((Date.now() - t0) / 1000) });

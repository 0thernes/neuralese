// v10 (d): full backward pass of site/grad.js vs Eshkol's reverse-mode tape (wasm/eshkol_ad, build with its build.sh first).
// Tiny GPT-Neo config with seeded weights (the full 8M-parameter model would need ~10^9 scalar tape nodes).
// Writes site/tsotchke/data/eshkol_ad_golden.json.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { TINY, IDS, tinyWeights, flat } from '../tsotchke/adcheck.js';
const W = tinyWeights(7), { d, H, hd, L, ff, V, eps } = TINY;
const input = [d, H, hd, L, ff, V, IDS.length, eps, ...IDS, ...flat(W).map((x) => x.toPrecision(17))].join(' ');
const out = JSON.parse(execFileSync(new URL('../wasm/eshkol_ad/eshkol_ad', import.meta.url).pathname, { input, maxBuffer: 1 << 26 }).toString());
fs.writeFileSync(new URL('../tsotchke/data/eshkol_ad_golden.json', import.meta.url), JSON.stringify({ source: 'tsotchke/eshkol@341ac81 lib/backend/vm_autodiff.c (ad_backward)', cfg: TINY, ids: IDS, seed: 7, ...out }));
console.log('loss', out.loss, 'tape nodes', out.tape, 'grads', out.grads.length);

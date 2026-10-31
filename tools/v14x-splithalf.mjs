// v14.1 C1b — cosine between even/odd half-fits for every lens block, from the fit's per-document job cache. Original Neuralese code.
import fs from 'node:fs'; import { BLOCKS } from './nlens-common.mjs'; import { writeResult, r4 } from './v14x-lib.mjs';
const res = {};
for (const [name, jobs, lensDir] of [['ts1m', '/workspace/nlens/jobs1M', 'lens/ts1m'], ['ts3m', '/workspace/nlens/jobs3M', 'lens/ts3m'], ['ts8m', '/workspace/nlens/jobs', 'lens/ts8m']]) {
  const man = JSON.parse(fs.readFileSync(lensDir + '/manifest.json')), { d, L } = man, dd = d * d, B = BLOCKS(L), T = man.corpus.T, nD = man.nDocs;
  const half = [0, 1].map(() => B.map(() => new Float64Array(dd)));
  for (let i = 0; i < nD; i++) for (const lens of ['R', 'S']) { const a = new Float64Array(fs.readFileSync(`${jobs}/${lens}-T${T}-${i}.bin`).buffer.slice(0)), nb = lens === 'R' ? 2 * L - 1 : 2 * L, off = B.findIndex((b) => b[0] === lens);
    for (let k = 0; k < nb; k++) { const h = half[i % 2][off + k]; for (let j = 0; j < dd; j++) h[j] += a[k * dd + j]; } }
  const cos = {}; B.forEach(([lens, tgt, l], k) => { let ab = 0, aa = 0, bb = 0; for (let j = 0; j < dd; j++) { const a = half[0][k][j], b = half[1][k][j]; ab += a * b; aa += a * a; bb += b * b; } (cos[`${lens}.${tgt}`] ||= [])[l] = r4(ab / Math.sqrt(aa * bb)); });
  const min = Math.min(...Object.values(cos).flat()); res[name] = { cos, min, pass: min >= 0.9 }; console.log(name, min); }
writeResult('lens/v14x-splithalf.json', { C1b: res, verdict: Object.values(res).every((r) => r.pass) ? 'supported' : 'not supported' });

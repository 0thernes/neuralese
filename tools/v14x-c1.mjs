// v14.1 C1a / C1c / C2 verdicts from the validation outputs (PREREG-v14x §14.1–14.2). Original Neuralese code.
import fs from 'node:fs'; import { writeResult, r4 } from './v14x-lib.mjs';
const J = (f) => JSON.parse(fs.readFileSync(f)), g = (v, l, x) => v.testA.find((r) => r.layer === l && r.lens === x), L7 = [0, 1, 2, 3, 4, 5, 6];
const c1a = {}; for (const m of ['ts1m', 'ts3m']) { const v = J(`lens/${m}/validation.json`), beats = L7.filter((l) => g(v, l, 'R.out').medianR > g(v, l, 'logit').medianR).length, nullMax = Math.max(...L7.map((l) => g(v, l, 'R.out').nullPassRate));
  c1a[m] = { layersBeatingLogit: beats, maxNullPassRate: nullMax, verdict: beats >= 5 && nullMax <= 0.02 ? 'supported' : 'not supported' }; }
const a = J('lens/ts8m/v14x-testA64.json'), o = J('lens/ts8m/validation.json'), w = (r) => r.medianR_CI[1] - r.medianR_CI[0];
const rows = L7.map((l) => ({ layer: l, ciWidth24: r4(w(g(o, l, 'R.out'))), ciWidth64: r4(w(g(a, l, 'R.out'))), medianR64: g(a, l, 'R.out').medianR, logit64: g(a, l, 'logit').medianR }));
const narrower = rows.filter((r) => r.ciWidth64 < r.ciWidth24).length, beats = rows.filter((r) => r.medianR64 > r.logit64).length;
const sae = J('lens/ts8m/v14x-sae.json'), nL3 = g(a, 3, 'R.out').passRate;
writeResult('lens/v14x-c1.json', { C1a: c1a, C1c: { rows, narrower, beats, verdict: narrower >= 6 && beats >= 6 ? 'supported' : 'not supported' }, C2: { saePassRate: sae.testA['R.out'].passRate, neuronPassRateL3: nL3, verdict: sae.testA['R.out'].passRate >= nL3 ? 'supported' : 'not supported' } });
console.log(JSON.stringify(c1a), narrower, beats, sae.testA['R.out'].passRate, nL3);

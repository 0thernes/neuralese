// v11 P5: runs the pre-registered grokking config and the weight-decay-0 control. Usage: node tools/frontier-grok.mjs > site/frontier/data/grok.json
import { SITE, prereg } from './_fload.mjs';
const G = await import(SITE + 'frontier/grok.js'); const t0 = Date.now();
const main = G.run(G.CONFIGS[0], 50), ctl = G.run({ ...G.CONFIGS[0], wd: 0 }, 50);
const strip = (r) => ({ cfg: r.cfg, log: r.log, sMem: r.sMem, sGen: r.sGen, fourierInit: { fracConcentrated: r.fourierInit.fracConcentrated, spectrum: r.fourierInit.spectrum }, fourierFinal: { fracConcentrated: r.fourierFinal.fracConcentrated, spectrum: r.fourierFinal.spectrum, freqHist: r.fourierFinal.freq.reduce((h, k) => (h[k] = (h[k] || 0) + 1, h), {}) } });
const fin = (r) => r.log[r.log.length - 1];
console.log(JSON.stringify({ prereg: prereg().sha256, seconds: (Date.now() - t0) / 1000, main: strip(main), control: strip(ctl),
  H5a: { sMem: main.sMem, sGen: main.sGen, pass: main.sMem !== null && main.sGen !== null && main.sGen >= 2 * main.sMem },
  H5b: { init: main.fourierInit.fracConcentrated, final: main.fourierFinal.fracConcentrated, pass: main.fourierFinal.fracConcentrated >= 0.8 && main.fourierInit.fracConcentrated <= 0.2 },
  H5c: { finalTestAcc: fin(ctl).testAcc, pass: fin(ctl).testAcc < 0.5 } }));

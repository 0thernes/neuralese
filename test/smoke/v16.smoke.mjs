// v16 smoke on the built www/ (has build.json): NEW v16 tab renders; WebGPU gate+bench button (SwiftShader software adapter);
// enforced pre-registration refuses a wrong hash and completes with the right one; H-INTERP Whisper encoder end-to-end
// (151 MB from HF, revision- and sha256-pinned). Usage: node tools/build-www.mjs && node tools/serve.mjs 8766 www & node test/smoke/v16.smoke.mjs http://localhost:8766/
import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'http://localhost:8766/', skipHub = process.env.SKIP_HUB === '1';
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 1800000, args: ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-webgpu-adapter=swiftshader'] });
const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (/Content.Security.Policy|Refused/.test(m.text())) errs.push(m.text()); });
await p.goto(url + '?noworker'); await p.waitForFunction(() => window.NEURALESE && window.NEURALESE_LAST, { timeout: 900000 });
const r = await p.evaluate(async (skipHub) => {
  const out = window.NEURALESE.v6.out, res = {}; res.newTab = !!document.getElementById('pane_v16') && document.getElementById('pane_v16').textContent.includes('Arch interface');
  res.hinterpTab = !!document.getElementById('pane_hinterp');
  res.webgpu = await out.webgpu().catch((e) => ({ err: String(e) }));
  const P = await import('./prereg.js?v=170'), commit = (await (await fetch('build.json')).json()).commit;
  const doc = { hypothesis: 'Zero-ablating L0H3 raises mean CE on the probe text', metric: { name: 'head_ablation_delta_ce', params: { layer: 0, head: 3 } }, null: 'Ablation changes CE by less than the threshold', threshold: { op: '>', value: 0.01 }, seed: 1, commit_sha: commit };
  const errsV = P.validate(doc); if (errsV.length) return { ...res, prereg: { invalid: errsV } }; const h = await P.preregHash(doc);
  const bad = await out.preregRun(JSON.stringify(doc), '0'.repeat(64)); const good = await out.preregRun(JSON.stringify(doc), h);
  res.prereg = { commit, refusedWrongHash: !!bad.refused, verdict: good.verdict?.text, bundle: good.bundle_sha256 };
  if (!skipHub) { const t0 = performance.now(); const w = await out.hubInterp('whisper'); res.whisper = { N: w.N, L: w.L, ms: w.ms, wall: Math.round(performance.now() - t0), verified: w.verified, probe: w.probe.rows.map((x) => +x.testAcc.toFixed(3)), maj: w.probe.rows[0].testMajority }; }
  return res; }, skipHub);
console.log(JSON.stringify(r, null, 1));
const ok = r.newTab && r.hinterpTab && r.prereg?.refusedWrongHash && r.prereg?.bundle && (skipHub || r.whisper?.N === 1500) && !errs.length; console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL', errs); await b.close(); process.exit(ok ? 0 : 1);

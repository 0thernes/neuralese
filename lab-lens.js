// v14 NEURON LENS group: browsable, searchable DB of every TinyStories-8M MLP neuron and attention head read through the fitted
// R-lens / S-lens / mid-lenses (our own implementation of the neuron-lens method; prior art credited in docs/NEURON_LENS_METHOD.md), a rotating 3D atlas, pre-registered validation results,
// an in-browser one-document refit, and an attributed CC BY 4.0 sample of the neuron-lens Qwen3-8B / Gemma-4-12B catalog.
import * as NL from './neuronlens.js?v=152';
import { bars, lines, showTip, seqColor } from './charts.js?v=152';
import { $, esc, fmt, opts, lOpts, cv, tipq, pal, prog, canvasFit, chartBg, tick, d, H, L, ff, V } from './lab-ui.js?v=152';
import { CFG } from './model.js?v=152';
import { skeleton } from './ui152.js?v=152';
const BASE = 'lens/ts8m/', EXT = 'lens/ext/neuron-lens-sample.json';
const READS = [['in_S', 'in·S (what drives it, S.mid)'], ['in_R', 'in·R (input read, R.mid)'], ['out_R', 'out·R (what it promotes, R.out)'], ['out_S', 'out·S (write footprint, S.out)'], ['out_logit', 'logit lens (baseline)'], ['out_R_neg', 'out·R suppressed'], ['drivers', 'exact drivers (measured)']];
const HREADS = [['ov_R', 'OV copy (R)'], ['ov_S', 'OV copy (S)'], ['ov_R_neg', 'OV suppressed'], ['writes_R', 'mean write (R)'], ['qk_S', 'keys sought (QK·S)'], ['qk_self', 'self-seeking tokens']];
const COLOR = [['rate', 'firing rate'], ['act_max', 'max activation'], ['w_norm', '‖W_out‖'], ['agree', 'out·R ∩ logit-lens overlap'], ['inout', 'in·S ∩ in·R overlap']];
export const markup = {
  nlens: ['NEURON LENS', 'Neuron Lens — every neuron & head read through R/S lenses', `<fieldset><legend>Neuron Lens database ${tipq('Every MLP neuron (8×1024) and attention head (8×16) of TinyStories-8M, read through lenses fitted offline (tools/nlens-fit.mjs). Method: stdlogits/neuron-lens (a9lim & treetown, 2026), R-lens = J-lens (Gurnee et al.) and S-lens = K-lens (Theia Vogel) under RelP rules. Files are SHA-256-checked against db-manifest.json before display.')}</legend>
<div class="r"><button class="pri" id="nlLoad">load database</button><span id="nlInfo" class="sm">not loaded · ~${'6'} MB, fetched once</span></div>
<div class="r"><input id="nlQ" style="flex:1" placeholder="search a token (e.g. ' dog', ' happy', '.') or L3N512 / L2H5"/><label>in</label><select id="nlQIn">${opts([['any', 'any read'], ...READS, ['heads', 'head reads']])}</select><button id="nlGo">search</button></div><div id="nlHits" class="sm"></div></fieldset>
<fieldset><legend>3D atlas ${tipq('Each dot is a neuron: x = layer, angle = neuron index, radius and colour = the chosen metric. Drag to rotate, wheel to zoom, click a dot to open it. Heads are the bright cubes on the axis.')}</legend><div class="r"><label>colour</label><select id="nlC">${opts(COLOR)}</select><label><input type="checkbox" id="nlSpin" checked/> spin</label><span id="nlAInfo" class="sm"></span></div><canvas class="ch" id="nlAtlas" style="cursor:grab"></canvas></fieldset>
<fieldset><legend>inspector</legend><div class="r"><label>layer</label><select id="nlL">${lOpts(3)}</select><label>neuron</label><input type="number" id="nlN" value="0" min="0" max="${ff - 1}"/><button id="nlOpen">open neuron</button><label>head</label><input type="number" id="nlH" value="0" min="0" max="${H - 1}"/><button id="nlOpenH">open head</button></div><div id="nlCard"></div>
<div class="r"><input id="nlSP" style="flex:1" value="Once upon a time, there was a little girl named Lily. She loved to"/><label>dose ×p99</label><input type="number" id="nlDose" value="4" step="0.5" style="width:60px"/><button id="nlSteer">steer-test this neuron</button>${tipq('Adds dose·act_max·W_out[:,n] to the MLP output at this layer for every position (the §3 causal check of neuron-lens), on the CURRENT weights, and compares the tokens whose log-prob rose most at the last position with what out·R predicted.')}</div><div id="nlSteerRes" class="sm"></div></fieldset>`],
  nlval: ['LENS VALID', 'Neuron Lens — pre-registered validation & in-browser refit', `<fieldset><legend>pre-registered validation ${tipq('docs/PREREG-v14.md was frozen (sha256 pinned in test/v14.test.mjs) before tools/nlens-validate.mjs ran on the fitted lens. Test A: steer neurons, Pearson r between Δlog-prob and each lens read, pass if r > τ99 of mismatched-neuron pairs. Test B: exact drivers (substitute every frequent token, measure the activation) vs input reads, Spearman ρ.')}</legend><div class="r"><button class="pri" id="nvLoad">load results</button><label>metric</label><select id="nvM">${opts([['medianR', 'A: median r'], ['passRate', 'A: pass rate vs τ99'], ['top10Rise', 'A: top-10 rise'], ['B_medianRho', 'B: median ρ (drivers)'], ['B_passRate', 'B: pass rate']])}</select><span id="nvInfo" class="sm"></span></div>${cv('nvChart', 'per-layer result by lens (CIs in the table)', 'png csv')}<div id="nvTable" class="sm" style="max-height:320px;overflow:auto"></div></fieldset>
<fieldset><legend>in-browser refit ${tipq('Runs the exact fitting code (neuronlens.js docJacobianR/docJacobianS) in a Web Worker on ONE short document of your choosing, using the current weights, then compares each per-layer map with the shipped 64-document lens (cosine of the flattened matrices). One document is a noisy estimate: expect agreement well above 0 but below 1.')}</legend><div class="r"><input id="nrP" style="flex:1" value="One day, a little boy named Tom found a big red ball in the park. He was very happy and ran to show his mom. His mom smiled and said"/><label>lens</label><select id="nrK">${opts([['R', 'R-lens'], ['S', 'S-lens'], ['R,S', 'both']])}</select><button class="pri" id="nrGo">refit</button></div><div class="prog" id="nrProg"><i></i></div><div id="nrInfo" class="sm"></div>${cv('nrChart', 'cosine(refit, shipped) per layer and target')}</fieldset>`],
  nlext: ['LENS CATALOG', 'neuron-lens catalog sample (Qwen3-8B · Gemma-4-12B, CC BY 4.0)', `<fieldset><legend>neuron-lens catalog sample ${tipq('A small, attributed subset of the CC BY 4.0 neuron-lens catalog (huggingface.co/datasets/stdlogits/neuron-lens, revision b5bf11a): all attention-head labels and legibility z-scores, and the 300 most confidently labelled layer-8 neuron poles per model. Labels were written by a model (Claude) from lens reads and contexts; they are hypotheses, not ground truth.')}</legend>
<div class="sm" id="neAttr">By <a href="https://x.com/_a9lim" target="_blank" rel="noopener">@_a9lim</a> and <a href="https://x.com/treetowntree" target="_blank" rel="noopener">@treetowntree</a> with Claude (Anthropic), 2026 — <a href="https://huggingface.co/datasets/stdlogits/neuron-lens" target="_blank" rel="noopener">dataset</a> · <a href="https://github.com/stdlogits/neuron-lens" target="_blank" rel="noopener">code</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Subset and rounded by Neuralese; label text unchanged (see lens/ext/ATTRIBUTION.md).</div>
<div class="r"><button class="pri" id="neLoad">load sample</button><label>model</label><select id="neM">${opts([['qwen3-8b', 'Qwen3-8B'], ['gemma-4-12b', 'Gemma-4-12B']])}</select><label>show</label><select id="neK">${opts([['heads', 'heads (all)'], ['neuronsL8', 'layer-8 neurons (top 300)']])}</select><input id="neQ" placeholder="filter text" style="width:160px"/><span id="neInfo" class="sm"></span></div>
${cv('neChart', 'heads: copy z (ov_copy_z) by layer — cross-model contrast with TinyStories-8M in the NEURON LENS tab')}<div id="neList" class="sm" style="max-height:420px;overflow:auto"></div></fieldset>`],
};
async function sha256Hex(buf) { const h = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
async function getVerified(path, sha) { const r = await fetch(path); if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`); const b = await r.arrayBuffer(); if (sha) { const s = await sha256Hex(b); if (s !== sha) throw new Error(`${path}: sha256 mismatch (${s.slice(0, 12)}… ≠ ${sha.slice(0, 12)}…)`); } return b; }
const jsonOf = (b) => JSON.parse(new TextDecoder().decode(b));
const overlap = (a, b) => { const s = new Set(a); return b.filter((x) => s.has(x)).length / Math.max(1, Math.min(a.length, b.length)); };

export function install(A, out) {
  const on = A.on, S = { man: null, layers: [], tok: {}, sel: { l: 3, n: 0, head: null }, M: null, lens: null, lensMan: null };
  const ts = (v) => { const s = S.tok[v] ?? A.tok().decode([v]); return JSON.stringify(s).slice(1, -1); };
  const chips = (pair, cls = '') => pair && pair[0] ? pair[0].map((v, i) => `<span class="chip ${cls}" title="id ${v}${pair[1] ? ' · ' + fmt(pair[1][i]) : ''}">${esc(ts(v))}</span>`).join(' ') : '<i>–</i>';
  const metric = (nr, k) => k === 'agree' ? overlap(nr.out_R[0], nr.out_logit[0]) : k === 'inout' ? overlap(nr.in_S[0], nr.in_R[0]) : nr[k] || 0;
  async function load() {
    if (S.man) return S.man; if (S.loading) return S.loading; S.loading = (async () => { try { return await load0(); } catch (e) { skeleton($('nlAtlas'), 'idle', 'Load failed: ' + e.message + ' — press “load database” to retry.'); throw e; } finally { S.loading = null; } })(); return S.loading; }
  async function load0() { const t0 = performance.now(); $('nlInfo').textContent = 'fetching manifest…'; skeleton($('nlAtlas'), 'loading', 'fetching manifest…');
    const man = jsonOf(await getVerified(BASE + 'db-manifest.json')); S.lensMan = jsonOf(await getVerified(BASE + 'manifest.json'));
    if (man.lens_sha256 !== S.lensMan.sha256) throw new Error('db-manifest lens hash ≠ manifest.json');
    S.tok = jsonOf(await getVerified(BASE + 'db/tokens.json', man.files['db/tokens.json']));
    for (let l = 0; l < man.layers; l++) { $('nlInfo').textContent = `layer ${l + 1}/${man.layers} (sha256-checking)…`; skeleton($('nlAtlas'), 'loading', `layer ${l + 1} of ${man.layers} · sha256-checking`); S.layers[l] = jsonOf(await getVerified(BASE + `db/L${l}.json`, man.files[`db/L${l}.json`])); await tick(); }
    S.man = man; $('nlInfo').innerHTML = `✓ ${man.layers}×${man.neurons} neurons, ${man.layers}×${man.heads} heads · every file sha256-verified · lens ${man.lens_sha256.slice(0, 12)}… (fit on ${S.lensMan.nDocs} docs × T=${S.lensMan.corpus.T}, ${fmt(S.lensMan.fitSeconds / 60, 0)} min) · loaded in ${fmt((performance.now() - t0) / 1000, 1)} s`;
    atlas.reset(); return man; }
  async function lensMats() { if (S.lens) return S.lens; await load(); const b = await getVerified(BASE + 'lenses.f32', S.lensMan.sha256); return (S.lens = NL.unpackLenses(new Float32Array(b), S.lensMan)); }
  function neuronCard(l, n) { const nr = S.layers[l].neurons[n]; S.sel = { l, n, head: null }; $('nlL').value = l; $('nlN').value = n;
    $('nlCard').innerHTML = `<div class="r"><b style="color:${pal(l)}">L${l}N${n}</b><span>rate ${fmt(nr.rate)} · max act ${fmt(nr.act_max)} · ‖w‖ ${fmt(nr.w_norm)} · out·R∩logit ${fmt(metric(nr, 'agree'), 2)}</span></div>
<div class="sm">top context: …${esc(nr.ctx[0])}<b class="chip hot">${esc(nr.ctx[1])}</b></div>
<table class="sm">${READS.map(([k, t]) => `<tr><td style="white-space:nowrap;padding-right:8px">${t}</td><td>${k === 'drivers' ? (nr.drivers ? chips([nr.drivers]) : '<i>not computed</i>') : chips(nr[k], k.endsWith('neg') ? 'neg' : '')}</td></tr>`).join('')}</table>`; atlas.draw(); }
  function headCard(l, h) { const hr = S.layers[l].heads[h]; S.sel = { l, n: null, head: h };
    $('nlCard').innerHTML = `<div class="r"><b style="color:${pal(l)}">L${l}H${h}</b><span>attn prev ${fmt(hr.attn_prev, 2)} · first ${fmt(hr.attn_first, 2)} · self ${fmt(hr.attn_self, 2)} · copy frac ${fmt(hr.copy_frac, 3)} · qk_self median z ${fmt(hr.qk_self_median, 2)}</span></div>
<table class="sm">${HREADS.map(([k, t]) => `<tr><td style="white-space:nowrap;padding-right:8px">${t}</td><td>${chips(hr[k], k.endsWith('neg') ? 'neg' : '')}</td></tr>`).join('')}</table>`; atlas.draw(); }
  // search: token text → neurons/heads whose reads contain it
  out.nlSearch = async () => { await load(); const q = $('nlQ').value, where = $('nlQIn').value; let m;
    if ((m = q.trim().match(/^L(\d)N(\d+)$/i))) return neuronCard(+m[1], +m[2]); if ((m = q.trim().match(/^L(\d)H(\d+)$/i))) return headCard(+m[1], +m[2]);
    const ids = new Set(); for (const [v, s] of Object.entries(S.tok)) if (s === q || s.trim().toLowerCase() === q.trim().toLowerCase()) ids.add(+v);
    if (!ids.size) { $('nlHits').textContent = `no token "${q}" appears in any stored top-10 read`; return; }
    const hits = []; S.layers.forEach((Ld, l) => { if (where !== 'heads') Ld.neurons.forEach((nr) => { for (const [k] of READS) { if (where !== 'any' && where !== k) continue; const arr = k === 'drivers' ? nr.drivers || [] : nr[k]?.[0] || []; const r = arr.findIndex((v) => ids.has(v)); if (r >= 0) hits.push({ l, n: nr.n, k, r }); } });
      if (where === 'any' || where === 'heads') Ld.heads.forEach((hr) => { for (const [k] of HREADS) { const r = (hr[k]?.[0] || []).findIndex((v) => ids.has(v)); if (r >= 0) hits.push({ l, h: hr.h, k, r }); } }); });
    hits.sort((a, b) => a.r - b.r || a.l - b.l); S.hits = hits;
    $('nlHits').innerHTML = `${hits.length} hits for ${[...ids].map((v) => `<span class="chip">${esc(ts(v))}</span>`).join(' ')} (rank shown) · ` + hits.slice(0, 160).map((x, i) => `<a href="#" data-i="${i}">${x.h == null ? `L${x.l}N${x.n}` : `L${x.l}H${x.h}`}<sub>${x.k}#${x.r + 1}</sub></a>`).join(' ');
    atlas.draw(); };
  $('nlHits').addEventListener('click', (e) => { const a = e.target.closest('a[data-i]'); if (!a) return; e.preventDefault(); const x = S.hits[+a.dataset.i]; x.h == null ? neuronCard(x.l, x.n) : headCard(x.l, x.h); });
  // 3D atlas
  const atlas = (() => { let yaw = 0.6, pitch = 0.35, zoom = 1, raf = 0, pts = [], drag = null; const c = $('nlAtlas');
    function proj(x, y, z, W, Hh) { const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch); const X = x * cy - z * sy, Z1 = x * sy + z * cy, Y = y * cp - Z1 * sp, Z = y * sp + Z1 * cp; const f = 3.2 / (3.2 + Z) * zoom * Math.min(W, Hh) * 0.36; return [W / 2 + X * f, Hh / 2 - Y * f, Z, f]; }
    function draw() { const [ctx, W] = canvasFit(c, 380), Hh = 380; ctx.fillStyle = chartBg(); ctx.fillRect(0, 0, W, Hh); pts = [];
      if (!S.man) { if (!S.loading) skeleton(c, 'idle', 'Press “load database” above to light up 8,192 neurons and 128 heads (~6 MB, sha256-verified).'); return; }
      skeleton(c, 'off');
      const key = $('nlC').value, hitSet = new Set((S.hits || []).map((x) => x.h == null ? `${x.l}:${x.n}` : `${x.l}:h${x.h}`));
      const all = S.layers.flatMap((Ld) => Ld.neurons.map((nr) => metric(nr, key))).sort((a, b) => a - b), hi = all[Math.floor(all.length * 0.99)] || 1;
      const P = [];
      S.layers.forEach((Ld, l) => { const x = (l - (L - 1) / 2) / (L / 2) * 1.25;
        Ld.neurons.forEach((nr, n) => { const v = Math.min(1, metric(nr, key) / hi), a = n / ff * Math.PI * 2, r = 0.25 + 0.75 * v; P.push({ l, n, v, x, y: Math.sin(a) * r, z: Math.cos(a) * r }); });
        Ld.heads.forEach((hr) => P.push({ l, h: hr.h, v: 1, x, y: (hr.h - 7.5) / 40, z: 0, head: true })); });
      for (const p of P) { const [sx, sy, z, f] = proj(p.x, p.y, p.z, W, Hh); p.sx = sx; p.sy = sy; p.zz = z; p.f = f; }
      P.sort((a, b) => b.zz - a.zz);
      for (const p of P) { const sel = p.l === S.sel.l && (p.head ? p.h === S.sel.head : p.n === S.sel.n), hit = hitSet.has(p.head ? `${p.l}:h${p.h}` : `${p.l}:${p.n}`);
        const s = Math.max(1, (p.head ? 3.5 : 1 + 2.2 * p.v) * p.f / 120); ctx.globalAlpha = sel || hit ? 1 : 0.25 + 0.6 * p.v;
        ctx.fillStyle = sel ? '#ffffff' : hit ? '#fbbf24' : p.head ? pal(p.l) : seqColor(p.v);
        if (p.head) ctx.fillRect(p.sx - s, p.sy - s, 2 * s, 2 * s); else { ctx.beginPath(); ctx.arc(p.sx, p.sy, sel || hit ? s + 2 : s, 0, 7); ctx.fill(); }
        pts.push(p); }
      ctx.globalAlpha = 1; ctx.fillStyle = '#cfd8ea'; ctx.font = '11px system-ui'; for (let l = 0; l < L; l++) { const [sx, sy] = proj((l - (L - 1) / 2) / (L / 2) * 1.25, -1.15, 0, W, Hh); ctx.fillText('L' + l, sx - 6, sy); }
      $('nlAInfo').textContent = `colour = ${COLOR.find((x) => x[0] === key)[1]} (99th pct = ${fmt(hi, 3)}) · ${hitSet.size} search hits highlighted`; }
    function loop() { if ($('nlSpin').checked && c.offsetParent && !drag) { yaw += 0.004; draw(); } raf = requestAnimationFrame(loop); }
    c.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; c.style.cursor = 'grabbing'; });
    window.addEventListener('mouseup', (e) => { if (!drag) return; const click = drag.moved < 4; drag = null; c.style.cursor = 'grab';
      if (click && S.man && e.target === c) { const r = c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; let best = null, bd = 64; for (const p of pts) { const dd = (p.sx - mx) ** 2 + (p.sy - my) ** 2; if (dd < bd) { bd = dd; best = p; } } if (best) best.head ? headCard(best.l, best.h) : neuronCard(best.l, best.n); } });
    window.addEventListener('mousemove', (e) => { if (drag) { yaw += (e.clientX - drag.x) * 0.01; pitch = Math.max(-1.4, Math.min(1.4, pitch + (e.clientY - drag.y) * 0.01)); drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; draw(); return; }
      if (e.target !== c || !S.man) return; const r = c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; let best = null, bd = 49; for (const p of pts) { const dd = (p.sx - mx) ** 2 + (p.sy - my) ** 2; if (dd < bd) { bd = dd; best = p; } }
      if (!best) return showTip(e, ''); if (best.head) { const hr = S.layers[best.l].heads[best.h]; showTip(e, `L${best.l}H${best.h} · OV(R): ${hr.ov_R[0].slice(0, 5).map(ts).join(' ')}`); } else { const nr = S.layers[best.l].neurons[best.n]; showTip(e, `L${best.l}N${best.n} · in·S: ${nr.in_S[0].slice(0, 4).map(ts).join(' ')} → out·R: ${nr.out_R[0].slice(0, 4).map(ts).join(' ')}`); } });
    c.addEventListener('mouseleave', (e) => showTip(e, ''));
    c.addEventListener('wheel', (e) => { e.preventDefault(); zoom = Math.max(0.4, Math.min(4, zoom * (e.deltaY < 0 ? 1.1 : 0.9))); draw(); }, { passive: false });
    c._redraw = draw; return { draw, reset() { cancelAnimationFrame(raf); draw(); loop(); } }; })();
  atlas.draw();
  on('nlLoad', 'click', async () => { await load(); neuronCard(S.sel.l, S.sel.n); });
  on('nlGo', 'click', out.nlSearch); $('nlQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('nlGo').click(); });
  on('nlC', 'change', () => atlas.draw());
  on('nlOpen', 'click', async () => { await load(); neuronCard(+$('nlL').value, Math.max(0, Math.min(ff - 1, +$('nlN').value | 0))); });
  on('nlOpenH', 'click', async () => { await load(); headCard(+$('nlL').value, Math.max(0, Math.min(H - 1, +$('nlH').value | 0))); });
  // steer test (current weights)
  on('nlSteer', 'click', async () => { await load(); const { l, n } = S.sel; if (n == null) throw new Error('open a neuron first'); const nr = S.layers[l].neurons[n];
    if (!S.M || S.Mw !== A.W()) { S.Mw = A.W(); S.M = NL.prepare(S.Mw, CFG); }
    const ids = A.tok().encode($('nlSP').value).slice(-CFG.window), T = ids.length; if (T < 2) throw new Error('prompt too short');
    const { w } = NL.neuronDirs(S.M, l, n), a = +$('nlDose').value * Math.max(nr.act_max, 1e-3), vec = w.map((x) => x * a);
    const lp = (z) => { let mx = -Infinity; for (const x of z) if (x > mx) mx = x; let s = 0; for (const x of z) s += Math.exp(x - mx); const c = mx + Math.log(s); return z.map((x) => x - c); };
    // v14.x weak-spot fix: average Δlog-prob over every position (not just the last), and rank only tokens in the DB vocabulary (frequent
    // TinyStories tokens), so rare-token softmax noise cannot crowd the top-10. Same Δ definition as the pre-registered Test A.
    const rows = [...Array(T).keys()].slice(Math.min(16, T >> 1)), V = CFG.V, B = NL.forward(S.M, ids, { logits: true, logitRows: rows }).logits, St = NL.forward(S.M, ids, { logits: true, logitRows: rows, steer: { layer: l, vec, from: 0, to: T } }).logits;
    const dl = new Float32Array(V); rows.forEach((_, r) => { const b = lp(B.subarray(r * V, (r + 1) * V)), s = lp(St.subarray(r * V, (r + 1) * V)); for (let v = 0; v < V; v++) dl[v] += (s[v] - b[v]) / rows.length; });
    const keptIds = Object.keys(S.tok).map(Number), mask = new Uint8Array(V); keptIds.forEach((v) => (mask[v] = 1)); const top = NL.topK(dl, 10, keptIds.length ? mask : null);
    const pred = nr.out_R[0], hitR = pred.filter((v) => top.includes(v)).length, hitLg = nr.out_logit[0].filter((v) => top.includes(v)).length;
    const rise = pred.filter((v) => dl[v] > 0).length;
    $('nlSteerRes').innerHTML = `Δlog-prob averaged over ${rows.length} position${rows.length > 1 ? 's' : ''}, dose ${$('nlDose').value}×act_max (${fmt(a, 2)}), ranked over the ${keptIds.length} DB tokens, current weights:<br>top-10 risers: ${chips([top, top.map((v) => dl[v])])}<br>out·R prediction overlap with actual top-10: <b>${hitR}/10</b> (logit lens: ${hitLg}/10) · ${rise}/10 out·R tokens rose. Single-prompt demo; the pre-registered statistics are in LENS VALID.`; });
  // validation tab
  let VAL = null; const LENS_ORDER = ['R.out', 'R.mid', 'S.out', 'S.mid', 'logit', 'tuned', 'random', 'R.out[L-1]', 'S.out[L-1]'];
  function drawVal() { if (!VAL) return; const m = $('nvM').value, B = m.startsWith('B_'), key = B ? m.slice(2) : m, rows = B ? VAL.testB : VAL.testA, lenses = [...new Set(rows.map((r) => r.lens))].sort((a, b) => LENS_ORDER.indexOf(a) - LENS_ORDER.indexOf(b));
    const ci = { medianR: 'medianR_CI', passRate: 'passCI', top10Rise: 'top10RiseCI' }[key];
    const series = lenses.map((ln, i) => ({ label: ln, color: ['#5eead4', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c', '#94a3b8', '#4ade80', '#e879f9'][LENS_ORDER.indexOf(ln) % 9 >= 0 ? LENS_ORDER.indexOf(ln) % 9 : i], ys: [...Array(L).keys()].map((l) => rows.find((r) => r.layer === l && r.lens === ln)?.[key] ?? NaN) }));
    lines($('nvChart'), series, { xs: [...Array(L).keys()].map((l) => 'L' + l), h: 200, title: lenses.join(' · ') });
    $('nvTable').innerHTML = `<table><tr><th>layer</th><th>lens</th><th>n</th><th>${key}</th><th>95% CI</th><th>τ99 (null)</th><th>pass</th><th>null pass</th></tr>${rows.filter((r) => r[key] != null).map((r) => `<tr><td>${r.layer}</td><td>${r.lens}</td><td>${r.n}</td><td>${fmt(r[key], 3)}</td><td>${ci && r[ci] ? r[ci].map((x) => fmt(x, 2)).join('–') : '–'}</td><td>${fmt(r.tau99, 3)}</td><td>${fmt(r.passRate, 2)}</td><td>${fmt(r.nullPassRate, 2)}</td></tr>`).join('')}</table>`; }
  on('nvLoad', 'click', async () => { const vb = await getVerified(BASE + 'validation.json'); VAL = jsonOf(vb); const s = await sha256Hex(vb);
    $('nvInfo').innerHTML = `prereg ${VAL.prereg_sha256?.slice(0, 12) ?? '?'}… · lens ${VAL.lens_sha256?.slice(0, 12) ?? '?'}… · ran ${fmt(VAL.seconds / 60, 1)} min · file ${s.slice(0, 12)}…` + (VAL.verdicts ? '<br>' + Object.entries(VAL.verdicts).map(([k, v]) => `<b>${k}</b> ${v.pass ? '✓ supported' : '✗ not supported'} — ${esc(v.detail)}`).join('<br>') : ''); drawVal(); });
  on('nvM', 'change', drawVal);
  on('nrGo', 'click', async () => { const Z = await lensMats(), ids = A.tok().encode($('nrP').value); if (ids.length < NL.SKIP_FIRST + 4) throw new Error(`need ≥ ${NL.SKIP_FIRST + 4} tokens (SKIP_FIRST=${NL.SKIP_FIRST}); have ${ids.length}`);
    const kinds = $('nrK').value.split(','), use = ids.slice(0, 48), wk = new Worker(new URL('./lens-worker.js?v=152', import.meta.url), { type: 'module' }); $('nrInfo').textContent = `fitting ${kinds.join('+')} on ${use.length} tokens (${use.length - 1 - NL.SKIP_FIRST} valid positions) in a worker…`;
    const res = await new Promise((ok, bad) => { wk.onmessage = (e) => { if (e.data.progress != null) prog('nrProg', e.data.progress); else if (e.data.error) bad(new Error(e.data.error)); else ok(e.data); }; wk.onerror = (e) => bad(new Error(e.message)); wk.postMessage({ W: A.W(), cfg: CFG, ids: use, kinds }); }); wk.terminate();
    const cos = (a, b) => { let s = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return s / Math.sqrt(na * nb || 1); };
    const series = []; for (const k of kinds) for (const tg of ['out', 'mid']) series.push({ label: `${k}.${tg}`, color: ['#5eead4', '#60a5fa', '#a78bfa', '#f472b6'][series.length], ys: [...Array(L).keys()].map((l) => (res.res[k][tg][l] && Z[k][tg][l] ? cos(res.res[k][tg][l], Z[k][tg][l]) : NaN)) });
    lines($('nrChart'), series, { xs: [...Array(L).keys()].map((l) => 'L' + l), h: 180, title: series.map((s) => s.label).join(' · ') });
    $('nrInfo').textContent = `refit in ${fmt(res.seconds, 1)} s on ${use.length} tokens (current weights${A.W() === S.Mw ? '' : ''}) · mean cosine with shipped lens: ` + series.map((s) => `${s.label} ${fmt(s.ys.filter(isFinite).reduce((a, b) => a + b, 0) / s.ys.filter(isFinite).length, 3)}`).join(' · '); });
  // external catalog
  let EXTD = null; function drawExt() { if (!EXTD) return; const m = EXTD.models[$('neM').value], k = $('neK').value, q = $('neQ').value.trim().toLowerCase(), rows = m[k].filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q));
    if (k === 'heads') { const Lm = Math.max(...m.heads.map((r) => r.layer)) + 1, ys = [...Array(Lm).keys()].map((l) => { const a = m.heads.filter((r) => r.layer === l).map((r) => r.ov_copy_z ?? 0); return a.reduce((x, y) => x + y, 0) / (a.length || 1); }); bars($('neChart'), ys, { xlabel: 'layer', ylabel: 'mean ov_copy_z' }); }
    $('neInfo').textContent = `${rows.length}/${m[k].length} rows`;
    $('neList').innerHTML = rows.slice(0, 300).map((r) => `<div style="border-bottom:1px solid var(--b);padding:4px 0"><b>L${r.layer}${k === 'heads' ? 'H' + r.head : 'N' + r.neuron + (r.pole < 0 ? '−' : '+')}</b> ${r.dark ? '<span class="chip neg">dark</span>' : ''}${r.pattern ? '<span class="chip">pattern</span>' : ''}<br><b>fires</b> ${esc(r.fires || '')} <span class="sm">(${fmt(r.fires_conf, 2)})</span>${r.attends ? `<br><b>attends</b> ${esc(r.attends)} <span class="sm">(${fmt(r.attends_conf, 2)})</span>` : ''}<br><b>writes</b> ${esc(r.writes || '')} <span class="sm">(${fmt(r.writes_conf, 2)})</span>${r.note ? `<br><i>${esc(r.note)}</i>` : ''}</div>`).join(''); }
  on('neLoad', 'click', async () => { EXTD = jsonOf(await getVerified(EXT)); $('neInfo').textContent = `${EXTD.license} · rev ${EXTD.revision.slice(0, 7)}`; drawExt(); });
  for (const id of ['neM', 'neK']) on(id, 'change', drawExt); $('neQ').addEventListener('input', () => drawExt());
  out.nlens = () => $('nlLoad').click();
}

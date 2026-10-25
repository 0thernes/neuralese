// NEURALESE v2 — UI wiring. All numerics live in engine/analysis/surgery/decode/sae/rome (unit-tested vs PyTorch).
import { GPT2Tokenizer } from './tokenizer.js?v=7';
import { CFG, buildWeights, parseSafetensors, cloneWeights, mulberry32 } from './model.js?v=7';
import { Engine, defaultRuntime, logSoftmax, topK, SITES } from './engine.js?v=7';
import { computeStats, actCovariance, fitTunedLens, lensGrid, dla, patchResid, patchHeads, pathPatchHeadsToLogits, ablationSweep, buildControlVector, vectorArithmetic, tokenStats } from './analysis.js?v=7';
import { Editor, MATS, getMat, toSafetensors, quantize } from './surgery.js?v=7';
import { defaultDecode, applyPenalties, filterDist, pick, contrastiveLogits, cfgLogits, beamSearch } from './decode.js?v=7';
import { SAE } from './sae.js?v=7';
import { computeRome } from './rome.js?v=7';
import { CORPUS } from './corpus.js?v=7';
import { heatmap, lines, bars, showTip, seqColor, divColor } from './charts.js?v=7';
import { Viz } from './viz.js?v=7';
import { AudioEngine, editKind, STYLES } from './audio.js?v=7';
import { buildV5 } from './v5.js?v=7';
const audio = new AudioEngine();
const { d, H, L, ff, V } = CFG;
const $ = (id) => document.getElementById(id), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const tick = () => new Promise((r) => setTimeout(r, 0));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const toast = (m, bad) => { const t = $('toast'); t.textContent = m; t.style.borderColor = bad ? '#f87171' : ''; t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => (t.style.display = 'none'), bad ? 6000 : 2500); };
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { console.error(e); toast('✖ ' + e.message, true); } };

// ───────── loading (HTTP Range: only the fp32 tensors, skipping the bool attn.bias buffers) ─────────
const REPO = 'https://huggingface.co/roneneldan/TinyStories-8M/resolve', ST_URL = `${REPO}/refs%2Fpr%2F1/model.safetensors`;
const setLoad = (m, f) => { $('loadmsg').textContent = m; if (f != null) $('loadbar').style.width = (f * 100).toFixed(1) + '%'; };
// network: up to 4 attempts with exponential backoff (0.5 s, 1 s, 2 s); 4xx other than 408/429 fail fast
async function withRetry(what, fn, tries = 4) {
  for (let k = 0; ; k++) { try { return await fn(); } catch (e) { if (k >= tries - 1 || e.fatal) throw new Error(`${what}: ${e.message}${k ? ` (after ${k + 1} attempts)` : ''}`); const ms = 500 * 2 ** k; setLoad(`${what}: ${e.message} — retrying in ${(ms / 1000).toFixed(1)} s (attempt ${k + 2}/${tries})`); await new Promise((r) => setTimeout(r, ms)); } }
}
const httpErr = (r) => { const e = new Error('HTTP ' + r.status); e.fatal = r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429; return e; };
async function fetchRange(url, a, b, onp) { return withRetry(`bytes ${a}–${b}`, async () => {
  const r = await fetch(url, { headers: { Range: `bytes=${a}-${b}` } }); if (!r.ok) throw httpErr(r);
  const total = b - a + 1, rd = r.body.getReader(), chunks = []; let got = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); got += value.length; onp && onp(got / total); }
  const out = new Uint8Array(got); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  if (r.status === 206 && got !== total) throw new Error(`short read ${got}/${total} bytes`);
  return r.status === 206 ? out.buffer : out.buffer.slice(a, b + 1); }); }
const fetchText = (url, json) => withRetry(url.split('/').pop(), async () => { const r = await fetch(url); if (!r.ok) throw httpErr(r); return json ? r.json() : r.text(); });
async function loadModel() {
  setLoad('reading safetensors header…', 0.01);
  const n = Number(new DataView(await fetchRange(ST_URL, 0, 7)).getBigUint64(0, true));
  const header = JSON.parse(new TextDecoder().decode(await fetchRange(ST_URL, 8, 8 + n - 1)));
  let end = 0; for (const v of Object.values(header)) if (v.dtype === 'F32') end = Math.max(end, v.data_offsets[1]);
  const vocabP = fetchText(`${REPO}/main/vocab.json`, true), mergesP = fetchText(`${REPO}/main/merges.txt`); vocabP.catch(() => {}); mergesP.catch(() => {});
  const data = await fetchRange(ST_URL, 8 + n, 8 + n + end - 1, (f) => setLoad(`streaming fp32 weights ${(f * end / 1e6).toFixed(1)} / ${(end / 1e6).toFixed(1)} MB`, f * 0.95));
  setLoad('building tensors + tokenizer…', 0.97);
  return { W: buildWeights(parseSafetensors(data, n, header)), tok: new GPT2Tokenizer(await vocabP, await mergesP), mb: end / 1e6 };
}

// ───────── state ─────────
let W, M, tok, ed, R, eng, engClean, stats = null, sae = null, saeA = null, viz, cov = new Map();
const D = defaultDecode(); D.n = 60;
const S = { timeline: [], sel: { l: 0, h: 0, n: null, mat: 'q' }, undo: [], redo: [], gen: null, lastTraces: null, perf: { tps: 0, ms: 0 }, an: null, wmode: 'height', wdiff: false };
const snap = () => ({ edits: structuredClone(ed.edits.map(({ _err, ...e }) => e)), R: structuredClone(R) });
function restore(s) { R = structuredClone(s.R); eng.R = R; ed.setEdits(structuredClone(s.edits)); afterChange(); }
// every state-changing action goes through commit → undoable, then a full refresh of dependent views
function commit(label, fn) { const before = snap(); fn(); S.undo.push({ label, s: before }); S.redo = []; afterChange(); toast('✔ ' + label); audio.edit(editKind(label), { bits: +((label.match(/int(\d)/) || [])[1] || 0), coef: R.steer.length ? R.steer[R.steer.length - 1].coef : 1 }); }
function undo() { const u = S.undo.pop(); if (!u) return; S.redo.push({ label: u.label, s: snap() }); restore(u.s); toast('↶ ' + u.label); audio.edit('undo'); }
function redo() { const u = S.redo.pop(); if (!u) return; S.undo.push({ label: u.label, s: snap() }); restore(u.s); toast('↷ ' + u.label); audio.edit('undo'); }
let regenT = null;
let hashT; function afterChange() { clearTimeout(hashT); hashT = setTimeout(() => V5?.out?.hashes?.().catch(() => {}), 400); renderOps(); renderSteerList(); renderProgram(); renderHeadGrid(); refreshWeights(); hud(); clearTimeout(regenT); if ($('autoRegen').checked) regenT = setTimeout(() => generate(), 120); }
async function ensureStats() {
  if (stats) return stats; const n = +$('statN').value;
  stats = await computeStats(W, CORPUS, n, (f) => prog('statP', f)); eng.stats = stats; engClean.stats = stats;
  $('statInfo').textContent = `${stats.N} tokens · ${stats.docs.length} stories`; prog('statP', 1); hud(); return stats;
}
async function ensureTuned() { await ensureStats(); if (!stats.tuned) { $('statInfo').textContent += ' · fitting tuned lens…'; await tick(); fitTunedLens(stats, 1e-3); $('statInfo').textContent = `${stats.N} tok · tuned lens ✔`; } return stats.tuned; }
async function ensureCov(l) { if (!cov.has(l)) { await ensureStats(); cov.set(l, await actCovariance(W, stats, l, (f) => prog('romeP', f * 0.3))); } return cov.get(l); }
const prog = (id, f) => { const e = $(id); if (e) e.firstElementChild.style.width = (f * 100).toFixed(0) + '%'; };
function hud() {
  const mem = performance.memory ? `${(performance.memory.usedJSHeapSize / 1e6).toFixed(0)} MB heap` : 'heap n/a';
  $('hud').innerHTML = `<span>TinyStories-8M · <b>${R.program.length}</b> slots</span><span><b>${S.perf.tps.toFixed(1)}</b> tok/s</span><span><b>${S.perf.ms.toFixed(1)}</b> ms/tok</span><span>${mem}</span><span>edits <b>${ed.edits.length}</b></span><span>steer <b>${R.steer.filter((v) => v.on).length}</b></span><span>stats <b>${stats ? stats.N : '–'}</b></span><span>SAE <b>${sae ? `L${sae.layer}×${sae.m}` : '–'}</b></span><span>backend <b>CPU/JS f32</b></span>`;
}

// ───────── UI construction ─────────
const TABS = { gen: 'GEN', steer: 'STEER', an: 'ANALYZE', causal: 'CAUSAL', sae: 'SAE', surg: 'SURGERY', rt: 'RUNTIME', ops: 'OPS', viz: '3D', audio: 'AUDIO' };
const opts = (a, v) => a.map((x) => { const [k, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${k}"${k == v ? ' selected' : ''}>${t}</option>`; }).join('');
const layerOpts = (v = 0) => opts([...Array(L).keys()], v);
const P = {};
P.gen = `
<fieldset><legend>prompt</legend><textarea id="prompt" rows="3">Once upon a time, there was a little girl named Lily. She loved to</textarea>
<div class="r"><button class="pri" id="bGen">▶ generate</button><button id="bStop">■ stop</button><label><input type="checkbox" id="autoRegen" checked/> auto-regen on edit</label></div></fieldset>
<fieldset><legend>decoding</legend>
<div class="r"><label>mode</label><select id="d_mode">${opts([['sample', 'sample'], ['greedy', 'greedy'], ['beam', 'beam search'], ['contrastive', 'contrastive (CD)'], ['cfg', 'CFG / negative prompt']], D.mode)}</select><label>tokens</label><input type="number" id="d_n" value="${D.n}" min="1" max="400"/><label>seed</label><input type="number" id="d_seed" value="${D.seed}"/></div>
<div class="r"><label>temp</label><input type="number" step="0.05" id="d_temp" value="${D.temp}"/><label>top-k</label><input type="number" id="d_topk" value="${D.topk}"/><label>top-p</label><input type="number" step="0.01" id="d_topp" value="${D.topp}"/></div>
<div class="r"><label>min-p</label><input type="number" step="0.01" id="d_minp" value="${D.minp}"/><label>typical</label><input type="number" step="0.01" id="d_typical" value="${D.typical}"/></div>
<div class="r"><label>repetition</label><input type="number" step="0.05" id="d_rep" value="${D.rep}"/><label>frequency</label><input type="number" step="0.05" id="d_freq" value="${D.freq}"/><label>presence</label><input type="number" step="0.05" id="d_pres" value="${D.pres}"/></div>
<div class="r"><label>logit bias</label><input id="d_bias" style="flex:1" placeholder=" dragon:+5,  the:-3   (token text : delta)"/></div>
<div class="r"><label>beams</label><input type="number" id="d_beams" value="${D.beams}"/><label>len-pen</label><input type="number" step="0.1" id="d_lenpen" value="${D.lenpen}"/></div>
<div class="r"><label>CD α</label><input type="number" step="0.01" id="d_cdAlpha" value="${D.cdAlpha}"/><label>β</label><input type="number" step="0.1" id="d_cdBeta" value="${D.cdBeta}"/><label>expert</label><select id="d_cdRole">${opts([['hacked', 'hacked (amateur=clean)'], ['clean', 'clean (amateur=hacked)']])}</select></div>
<div class="r"><label>CFG γ</label><input type="number" step="0.1" id="d_cfg" value="${D.cfg}"/><label>neg prompt</label><input id="d_neg" style="flex:1" placeholder="e.g. Once upon a time, there was a sad"/></div>
<div class="sm">CD = log p<sub>exp</sub> − β·log p<sub>ama</sub> on tokens with p<sub>exp</sub> ≥ α·max. CFG = log p<sub>neg</sub> + γ(log p<sub>pos</sub> − log p<sub>neg</sub>). Penalties apply after CD/CFG. Live top-k under the output: highlighted = survived filters.</div></fieldset>`;
P.steer = `
<fieldset><legend>build control vector (contrastive pairs, computed on the CLEAN model)</legend>
<textarea id="cvPairs" rows="5">Lily was very happy and | Lily was very sad and
The sun was bright and warm. | The rain was cold and dark.
She laughed and smiled. | She cried and frowned.
It was a wonderful day. | It was a terrible day.</textarea>
<div class="r"><label>name</label><input id="cvName" value="joy" style="width:80px"/><label>site</label><select id="cvSite">${opts(['resid_post', 'resid_pre', 'attn_out', 'mlp_out'])}</select><label>method</label><select id="cvMethod">${opts([['mean', 'mean-diff'], ['pca', 'PCA-1 of diffs']])}</select><label>agg</label><select id="cvAgg">${opts([['last', 'last tok'], ['mean', 'mean tok']])}</select></div>
<div class="r"><label>schedule</label><select id="cvSched">${opts([['band', 'band'], ['all', 'all layers'], ['single', 'single layer'], ['gauss', 'gaussian'], ['custom', 'custom list']])}</select><label>center</label><select id="cvC">${layerOpts(3)}</select><label>width</label><input type="number" id="cvW" value="1" step="0.5"/><input id="cvCustom" placeholder="0,0,1,1,1,0,0,0" style="width:120px"/></div>
<div class="r"><label>coef</label><input type="number" id="cvCoef" value="4" step="0.5"/><label>mask</label><select id="cvMask">${opts([['all', 'all tokens'], ['prompt', 'prompt only'], ['gen', 'generated only'], ['range', 'position range']])}</select><input type="number" id="cvA" value="0"/><input type="number" id="cvB" value="999"/></div>
<div class="r"><button class="pri" id="bCv">+ build &amp; add</button><span id="cvInfo" class="sm"></span></div></fieldset>
<fieldset><legend>vector arithmetic</legend><div class="r"><input id="cvExpr" style="flex:1" placeholder="1.0*joy - 0.5*fear"/><input id="cvExprName" value="mix" style="width:70px"/><button id="bCvExpr">= add</button></div></fieldset>
<fieldset><legend>stack (stacked vectors are summed)</legend><div id="steerList"></div>
<div class="r"><button id="bCvExport">export JSON</button><label class="sm">import</label><input type="file" id="cvImport" accept=".json"/></div></fieldset>
<fieldset><legend>projection readout</legend><div class="sm">Select a vector in the "readout" dropdown above the output: each token is colored by (resid at the vector's site, at its peak layer) · v̂, z-scored over the sequence.</div><canvas class="ch" id="cvProj"></canvas></fieldset>`;
P.an = `
<fieldset><legend>input</legend><textarea id="anText" rows="2">Lily and Tom went to the park. Lily gave the ball to</textarea>
<div class="r"><button class="pri" id="bAn">▶ analyze (hacked model)</button><label><input type="checkbox" id="anTuned"/> tuned lens</label><label>DLA target</label><input id="anTgt" placeholder="auto = top-1" style="width:90px"/><label>pos</label><input type="number" id="anPos" value="-1"/></div><div class="sm" id="anInfo"></div></fieldset>
<fieldset><legend>logit / tuned lens (rows = embed + slots, cols = positions; cell = top-1, color = p)</legend><div class="scroll"><table class="grid" id="lensT"></table></div></fieldset>
<fieldset><legend>direct logit attribution</legend><div id="dlaSum" class="sm"></div><canvas class="ch" id="dlaHeads"></canvas><div class="r" style="align-items:flex-start"><div style="flex:1"><table id="dlaHT"></table></div><div style="flex:1"><table id="dlaNT"></table></div></div></fieldset>
<fieldset><legend>attention — every head (click a cell to zoom; rows=query, cols=key)</legend><canvas class="ch" id="attAll"></canvas><div class="r"><label>slot</label><select id="attS">${layerOpts()}</select><label>head</label><select id="attH">${opts([...Array(H).keys()])}</select></div><canvas class="ch" id="attOne"></canvas></fieldset>
<fieldset><legend>residual norm & cosine(prev slot) trajectory</legend><canvas class="ch" id="normC"></canvas><canvas class="ch" id="cosC"></canvas></fieldset>
<fieldset><legend>per-token entropy / surprisal</legend><div id="pplInfo" class="sm"></div><canvas class="ch" id="entC"></canvas></fieldset>
<fieldset><legend>top neurons per token</legend><div class="scroll"><table id="neuT"></table></div></fieldset>`;
P.causal = `
<fieldset><legend>clean / corrupted (must tokenize to equal length)</legend>
<input id="caClean" style="width:100%" value="Lily and Tom went to the park. Lily gave the ball to"/><input id="caCorr" style="width:100%" value="Lily and Tom went to the park. Tom gave the ball to"/>
<div class="r"><label>answer</label><input id="caAns" value=" Tom" style="width:70px"/><label>wrong</label><input id="caWrong" value=" Lily" style="width:70px"/><span class="sm" id="caLen"></span></div>
<div class="r"><button class="pri" id="bPR">resid patch L×pos</button><button id="bPH">head patch</button><button id="bPP">path: head→logits</button></div>
<div class="r"><button id="bAbl">ablation sweep</button><select id="caAblT">${opts(['zero', 'mean', 'resample'])}</select><span class="sm">mean/resample use corpus stats</span></div>
<div class="prog" id="caP"><i></i></div><div id="caInfo" class="sm"></div></fieldset>
<fieldset><legend id="caTitle">result</legend><canvas class="ch" id="caMap"></canvas><div class="sm">metric = logit(ans) − logit(wrong). Patching shows (m − m_corr)/(m_clean − m_corr): 1 = fully restores. Click a head cell to select it.</div></fieldset>`;
P.sae = `
<fieldset><legend>corpus statistics (clean model)</legend><div class="r"><label>tokens</label><input type="number" id="statN" value="1200" step="100"/><button id="bStats">compute</button><span id="statInfo" class="sm">not computed (${CORPUS.length} stories built in)</span></div><div class="prog" id="statP"><i></i></div></fieldset>
<fieldset><legend>train sparse autoencoder on resid_post</legend><div class="r"><label>layer</label><select id="saeL">${layerOpts(3)}</select><label>features</label><input type="number" id="saeM" value="512"/><label>epochs</label><input type="number" id="saeE" value="6"/></div>
<div class="r"><label>lr</label><input type="number" id="saeLr" value="0.002" step="0.001"/><label>L1</label><input type="number" id="saeL1" value="0.003" step="0.001"/><button class="pri" id="bSae">train</button><button id="bSaeStop">stop</button></div>
<div class="prog" id="saeP"><i></i></div><div id="saeInfo" class="sm"></div><canvas class="ch" id="saeLoss"></canvas></fieldset>
<fieldset><legend>features (sorted by max act)</legend><div class="r"><label>sort</label><select id="saeSort">${opts(['max', 'density'])}</select><input id="saeQ" placeholder="filter by top-context text" style="flex:1"/></div><div class="scroll"><table id="saeT"></table></div><div id="saeCtx" class="sm"></div></fieldset>
<fieldset><legend>clamps during generation</legend><div class="r"><label>feature</label><input type="number" id="clF" value="0"/><select id="clMode">${opts(['clamp', 'add', 'scale'])}</select><input type="number" id="clV" value="10" step="0.5"/><button id="bClamp">+ add</button></div><div id="clList"></div></fieldset>`;
P.surg = `
<fieldset><legend>matrix</legend><div class="r"><label>layer</label><select id="smL">${layerOpts()}</select><label>mat</label><select id="smM">${opts([...MATS, 'wte', 'wpe'])}</select><button id="bSvd">SVD spectrum</button><span id="svdInfo" class="sm"></span></div><canvas class="ch" id="svdC"></canvas>
<div class="r"><label>keep top-k</label><input type="number" id="svK" value="32"/><button id="bSvTop">apply</button><label>flatten top-k</label><button id="bSvFlat">apply</button></div>
<div class="r"><label>σ range</label><input type="number" id="svA" value="0"/><input type="number" id="svB" value="3"/><button id="bSvDrop">drop</button><label>×</label><input type="number" id="svF" value="3" step="0.5"/><button id="bSvScale">scale</button></div>
<div class="r"><label>low-rank noise rank</label><input type="number" id="lrR" value="4"/><label>σ</label><input type="number" id="lrS" value="0.5" step="0.1"/><button id="bLr">perturb</button></div>
<div class="r"><label>element op</label><select id="elT">${opts(['matrix', 'head', 'neuron', 'embed'])}</select><label>idx</label><input type="number" id="elI" value="0"/><input id="elWords" placeholder="embed words: dragon,cat" style="width:130px"/></div>
<div class="r"><select id="elF">${opts(['scale', 'zero', 'invert', 'add', 'noise'])}</select><input type="number" id="elA" value="2" step="0.1"/><button id="bEl">apply</button></div></fieldset>
<fieldset><legend>quantization (per-row absmax, symmetric)</legend><div class="r"><select id="qB">${opts([['8', 'int8'], ['4', 'int4'], ['2', 'int2']])}</select><label>layers</label><input id="qL" value="0-7" style="width:60px"/><label>mats</label><input id="qM" value="q,k,v,o,fc,proj" style="width:120px"/><button id="bQ">quantize</button><span id="qInfo" class="sm"></span></div></fieldset>
<fieldset><legend>layer transplant / interpolation</legend><div class="r"><label>dst</label><select id="ipD">${layerOpts(4)}</select><label>← src</label><select id="ipS">${layerOpts(3)}</select><label>t</label><input type="number" id="ipT" value="0.5" step="0.1"/><button id="bIp">apply</button><span class="sm">t=1 = full transplant</span></div></fieldset>
<fieldset><legend>LayerNorm γ/β</legend><div class="r"><select id="lnW">${opts(['ln1', 'ln2', 'lnf'])}</select><select id="lnL">${layerOpts()}</select><label>γ×</label><input type="number" id="lnG" value="1.5" step="0.1"/><label>β+</label><input type="number" id="lnB" value="0" step="0.05"/><button id="bLn">apply</button></div></fieldset>
<fieldset><legend>positional embeddings (weights)</legend><div class="r"><select id="wpF">${opts(['scale', 'zero', 'shuffle', 'noise'])}</select><input type="number" id="wpA" value="0" step="0.1"/><button id="bWp">apply</button></div></fieldset>
<fieldset><legend>ROME rank-one fact edit</legend><div class="r"><input id="roP" style="width:100%" value="Once upon a time, there was a little girl named"/></div>
<div class="r"><label>subject</label><input id="roS" value="girl" style="width:70px"/><label>target</label><input id="roT" value=" Max" style="width:70px"/><label>layer</label><select id="roL">${layerOpts(4)}</select><button class="pri" id="bRome">compute + apply</button></div><div class="prog" id="romeP"><i></i></div><div id="roInfo" class="sm"></div></fieldset>
<fieldset><legend>chaos</legend><div class="r"><input type="range" id="chP" min="0" max="100" value="20"/><span class="v" id="chV">20%</span><button class="dan" id="bChaos">inject gaussian noise everywhere</button></div></fieldset>`;
P.rt = `
<fieldset><legend>layer program (duplicate / delete / skip / reorder — runtime, not weights)</legend><div id="progList"></div><div class="r"><button id="bProgReset">reset program</button></div></fieldset>
<fieldset><legend>heads of layer <select id="hgL">${layerOpts()}</select> — temperature (logits ÷ τ) & ablation</legend><div id="headGrid"></div></fieldset>
<fieldset><legend>attention mask override</legend><div id="maskList"></div></fieldset>
<fieldset><legend>positional tampering (runtime index remap)</legend><div class="r"><label>scale</label><input type="number" id="psS" value="1" step="0.1"/><label>shift</label><input type="number" id="psH" value="0"/><label>freeze @</label><input type="number" id="psF" value="-1"/><button id="bPos">set</button></div><div class="sm">p' = freeze≥0 ? min(t, freeze) : round(t·scale) + shift, clamped to [0, 2047]</div></fieldset>
<fieldset><legend>neuron overrides</legend><div class="r"><label>L</label><select id="naL">${layerOpts()}</select><label>neuron</label><input type="number" id="naN" value="0"/><select id="naM">${opts(['zero', 'mean', 'clamp'])}</select><input type="number" id="naV" value="5"/><button id="bNa">+ add</button></div><div id="naList"></div></fieldset>`;
P.ops = `
<fieldset><legend>history (edit stack — click to jump)</legend><div class="r"><button id="bU2">↶ undo</button><button id="bR2">↷ redo</button><button class="dan" id="bReset">reset everything</button></div><div class="hist" id="histL"></div></fieldset>
<fieldset><legend>active weight edits (replayed from original on every rebuild)</legend><div class="hist" id="editL"></div></fieldset>
<fieldset><legend>snapshot (edit diffs + runtime, not weights)</legend><div class="r"><button id="bSnapE">export .json</button><input type="file" id="snapI" accept=".json"/></div></fieldset>
<fieldset><legend>weights</legend><div class="r"><button id="bST">download modified model.safetensors (HF names, F32)</button></div><div class="sm">Runtime interventions (program, steering, head temps, masks, SAE clamps) are not representable as weights and are kept in the snapshot.</div></fieldset>`;
P.viz = `
<fieldset><legend>weight-matrix view</legend><div class="r"><label>layer</label><select id="vzL">${layerOpts()}</select><label>mat</label><select id="vzM">${opts(MATS)}</select><select id="vzMode">${opts([['height', 'height-field'], ['points', 'point cloud']])}</select><label><input type="checkbox" id="vzDiff"/> diff vs original</label></div><div id="vzInfo" class="sm"></div></fieldset>
<fieldset><legend>legend</legend><div class="sm">Slabs = layers. Spheres = heads (glow/size = ‖z<sub>h</sub>‖ at last token). Grid of points = 1024 MLP neurons (red +, blue −). Teal tube = residual stream (radius ∝ ‖x‖). Click a head, neuron or slab to select it everywhere.</div></fieldset>`;

P.audio = `
<fieldset><legend>engine</legend><div class="r"><button class="pri" id="auStart">▶ start audio</button><button id="auMute">mute (M)</button><span id="auInfo" class="sm">audio starts on your first click/key (browser autoplay policy)</span></div>
<div class="r"><label>style</label><select id="auStyle">${opts(Object.entries(STYLES).map(([k, v]) => [k, v.name]), 'lab')}</select><label>reverb size</label><input type="range" id="auRev" min="0.2" max="2.5" step="0.1" value="1"/></div>
<div class="r"><label>BPM</label><input type="number" id="auBpm" value="96" min="30" max="200"/><label><input type="checkbox" id="auSync"/> quantize token notes to 8th-note grid</label></div></fieldset>
<fieldset><legend>mixer</legend>${['master', 'score', 'tokens', 'choir', 'sfx'].map((k) => `<div class="r"><label style="width:60px">${k}</label><input type="range" min="0" max="1" step="0.01" value="${audio.vol[k]}" data-bus="${k}" style="flex:1"/></div>`).join('')}</fieldset>
<fieldset><legend>live sonification state</legend><div id="auState" class="sm"></div><canvas class="ch" id="auScope"></canvas></fieldset>
<fieldset><legend>edit SFX audition</legend><div class="r">${['svd', 'ablate', 'rome', 'quant', 'chaos', 'steer', 'swap', 'undo'].map((k) => `<button data-sfx="${k}">${k}</button>`).join('')}</div><div class="r">${['entropy_collapse', 'repetition_loop', 'superposition', 'residual_explosion'].map((k) => `<button data-anom="${k}">${k}</button>`).join('')}</div></fieldset>
<fieldset><legend>what drives what</legend><div class="sm">
<b>harmony</b>: key ← argmax dim of the final residual, scale colour (pentatonic / ionian / lydian without #4) ← its kurtosis; re-read every 8 tokens. Pad = root·3rd·5th·6th only.<br>
<b>tokens</b>: pitch ← log p and logit rank (scale tones only); brightness of pluck/bell ← residual-norm growth; pan ← attention centre of mass (left = BOS, right = self); improbable tokens (−ln p &gt; 4) add a soft bell an octave up. Rate-limited (min gap and polyphony cap per style).<br>
<b>pad</b>: filter opening ← next-token entropy.<br>
<b>choir</b>: 8 quiet sines, gain ← ‖resid‖ of each layer; FM shimmer ← mean attention entropy.<br>
<b>divergence</b>: KL(hacked‖clean) on the same context adds a consonant voice (5th → octave → octave+5th) above the pad.<br>
<b>phenomena</b>: entropy collapse, repetition loop, superposition, residual explosion → soft two-note chime + small badge in the top bar.</div></fieldset>`;
let V5 = null;
function buildUI() {
  const tabs = $('tabs'), panes = $('panes'); V5 = buildV5(TABS, P);
  for (const [k, t] of V5.order) { if (V5.groupStart[k]) { const g = document.createElement('span'); g.className = 'grp'; g.textContent = V5.groupStart[k]; tabs.appendChild(g); } const b = document.createElement('button'); b.textContent = t; b.dataset.t = k; b.onclick = () => showTab(k); b.setAttribute('role', 'tab'); b.title = V5.long[k] || t; tabs.appendChild(b); const p = document.createElement('div'); p.className = 'pane'; p.setAttribute('role', 'tabpanel'); p.id = 'pane_' + k; p.innerHTML = P[k]; panes.appendChild(p); }
  showTab('gen');
}
function showTab(k) { if (!$('pane_' + k)) throw new Error('no tab ' + k); V5 && V5.onShow(k); $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === k)); $$('.pane').forEach((p) => p.classList.toggle('on', p.id === 'pane_' + k)); }

// ───────── generation ─────────
function readDecode() {
  for (const k of ['n', 'seed', 'temp', 'topk', 'topp', 'minp', 'typical', 'rep', 'freq', 'pres', 'beams', 'lenpen', 'cdAlpha', 'cdBeta', 'cfg']) D[k] = +$('d_' + k).value;
  D.mode = $('d_mode').value; D.neg = $('d_neg').value; D.cdRole = $('d_cdRole').value; D.bias = {};
  for (const part of $('d_bias').value.split(',').map((s) => s.trim()).filter(Boolean)) { const m = part.match(/^(.*):\s*([+-]?[0-9.]+)$/); if (!m) throw new Error('bad logit bias: ' + part); const ids = tok.encode(m[1].startsWith(' ') ? m[1] : ' ' + m[1].trim()); D.bias[ids[0]] = (D.bias[ids[0]] || 0) + +m[2]; }
}
function tokSpan(id, cls, info) { const s = document.createElement('span'); s.className = 't ' + (cls || ''); s.textContent = tok.tokenStr(id); if (info) s._info = info; return s; }
function attachTips(box) { box.onmousemove = (e) => { const t = e.target._info; showTip(e, t ? t() : ''); }; box.onmouseleave = () => showTip(null, ''); }
let genId = 0;
async function generate() {
  const my = ++genId; readDecode(); const ids = tok.encode($('prompt').value); if (!ids.length) return;
  const outB = $('outB'), outA = $('outA'); outB.innerHTML = ''; outA.innerHTML = ''; const cmp = $('cmpOn').checked; outA.style.display = cmp ? '' : 'none';
  for (const id of ids) { outB.appendChild(tokSpan(id, 'pr')); if (cmp) outA.appendChild(tokSpan(id, 'pr')); }
  const t0 = performance.now();
  const seq = eng.newSeq(ids.length); const traces = []; let r; for (const id of ids) { r = eng.step(seq, id, { trace: true }); traces.push(r.trace); }
  const amaEng = D.cdRole === 'clean' ? eng : engClean, expEng = D.cdRole === 'clean' ? engClean : eng;
  let sA = null, rA = null, sN = null, rN = null, sC = null, rC = null;
  if (D.mode === 'contrastive') { // run the other model over the prompt
    const other = D.cdRole === 'clean' ? engClean : engClean; sA = other.newSeq(ids.length); for (const id of ids) rA = other.step(sA, id);
  }
  if (D.mode === 'cfg' && D.neg) { const nids = tok.encode(D.neg); sN = eng.newSeq(nids.length); for (const id of nids) rN = eng.step(sN, id); }
  if (cmp) { sC = engClean.newSeq(ids.length); for (const id of ids) rC = engClean.step(sC, id); }
  // shadow clean model on the HACKED token stream → KL(hacked‖clean) at identical context, for the divergence beating
  let sSh = null, rSh = null; const sonify = audio.on && !audio.muted; if (sonify && audio.vol.score > 0) { sSh = engClean.newSeq(ids.length); for (const id of ids) rSh = engClean.step(sSh, id); } audio.resetHistory(); S.timeline = [];
  const rng = mulberry32(D.seed), rngC = mulberry32(D.seed); const gen = [], genC = []; let nTok = 0, tStart = performance.now(), cDone = !cmp, bDone = false;
  $('genInfo').textContent = `prompt ${ids.length} tok · ${(performance.now() - t0).toFixed(0)} ms`;
  if (D.mode === 'beam') {
    await tick(); const best = beamSearch(eng, seq, r.h, { beams: D.beams, n: D.n, lenpen: D.lenpen, o: D }); if (my !== genId) return;
    for (const id of best.ids) outB.appendChild(tokSpan(id)); gen.push(...best.ids); bDone = true; nTok = best.ids.length;
    $('genInfo').textContent += ` · beam ${D.beams}: logp ${best.logp.toFixed(2)} score ${best.score.toFixed(3)}`;
  }
  for (let step = 0; step < D.n && my === genId && !(bDone && cDone); step++) {
    if (!bDone) {
      let l;
      if (D.mode === 'contrastive') { const lH = eng.logits(r.h), lO = engClean.logits(rA.h); l = D.cdRole === 'clean' ? contrastiveLogits(lO, lH, D.cdAlpha, D.cdBeta) : contrastiveLogits(lH, lO, D.cdAlpha, D.cdBeta); }
      else if (D.mode === 'cfg' && sN) l = cfgLogits(eng.logits(r.h), eng.logits(rN.h), D.cfg); else l = eng.outLogits(r.h);
      const lpRaw = logSoftmax(l); applyPenalties(l, seq.ids, gen, D); const dist = filterDist(l, D), id = pick(dist, rng, D.mode === 'greedy');
      const kept = new Set(dist.ids), top = topK(dist.lp, 10).map((i) => [i, Math.exp(dist.lp[i]), kept.has(i)]), pc = dist.probs[dist.ids.indexOf(id)];
      const sp = tokSpan(id, '', () => `p(${JSON.stringify(tok.tokenStr(id))}) = ${pc.toFixed(4)}  (post-filter)\n` + top.map(([i, p, k]) => `${k ? '●' : '○'} ${JSON.stringify(tok.tokenStr(i)).padEnd(14)} ${p.toFixed(4)}`).join('\n'));
      sp.style.background = `rgba(244,114,182,${Math.min(0.55, -Math.log(pc + 1e-9) / 12)})`; sp._pos = seq.T; outB.appendChild(sp); gen.push(id);
      $('topk').innerHTML = top.map(([i, p, k]) => `<div class="${k ? '' : 'x'}">${esc(JSON.stringify(tok.tokenStr(i)))} ${(p * 100).toFixed(1)}%<i style="width:${(p * 100).toFixed(0)}%"></i></div>`).join('');
      if (sonify) { const tr0 = r.trace, rank = lpRaw ? (() => { let k = 0; const v = lpRaw[id]; for (let i = 0; i < lpRaw.length; i++) if (lpRaw[i] > v) k++; return k; })() : 0; let ent = 0; for (let i = 0; i < lpRaw.length; i++) { const q = Math.exp(lpRaw[i]); if (q > 1e-12) ent -= q * lpRaw[i]; }
        const t2 = topK(lpRaw, 2); audio.token({ id, text: tok.tokenStr(id), p: Math.exp(lpRaw[id]), rank, ent, norms: [tr0.embed, ...tr0.resid_post].map((v) => Math.hypot(...v)), pats: tr0.pattern.flat().filter(Boolean), lp: lpRaw, lpClean: rSh ? logSoftmax(engClean.logits(rSh.h)) : null, top2: t2.map((i) => Math.exp(lpRaw[i])), resid: tr0.final }); }
      { let ent = 0, rk = 0; const v = lpRaw[id]; for (let i = 0; i < lpRaw.length; i++) { const q = Math.exp(lpRaw[i]); if (q > 1e-12) ent -= q * lpRaw[i]; if (lpRaw[i] > v) rk++; } const t2 = topK(lpRaw, 2); S.timeline.push({ id, p: Math.exp(v), p1: Math.exp(lpRaw[t2[0]]), p2: Math.exp(lpRaw[t2[1]]), ent, rank: rk }); }
      if (id === 50256) bDone = true;
      else { if (sSh) rSh = engClean.step(sSh, id); r = eng.step(seq, id, { trace: true }); traces.push(r.trace); if (sA) rA = engClean.step(sA, id); if (sN) rN = eng.step(sN, id); nTok++; }
    }
    if (!cDone) { const l = applyPenalties(engClean.logits(rC.h), sC.ids, genC, D), dist = filterDist(l, D), id = pick(dist, rngC, D.mode === 'greedy'); const k = genC.length; genC.push(id);
      outA.appendChild(tokSpan(id, gen[k] !== undefined && gen[k] !== id ? 'dv' : '')); if (id === 50256) cDone = true; else rC = engClean.step(sC, id); }
    if (step % 2 === 0) { const dt = performance.now() - tStart; S.perf.tps = nTok / (dt / 1000) || 0; S.perf.ms = dt / Math.max(1, nTok); hud(); viz.activations(r.trace); await tick(); }
  }
  const dt = performance.now() - tStart; if (nTok) { S.perf.tps = nTok / (dt / 1000); S.perf.ms = dt / nTok; }
  S.lastTraces = traces; S.lastIds = seq.ids.slice(); viz.activations(r.trace); hud();
  const first = gen.findIndex((x, i) => genC[i] !== undefined && genC[i] !== x); $('genInfo').textContent += ` · ${nTok} tok${cmp ? first < 0 ? ' · identical to clean' : ` · diverges from clean at +${first}` : ''}`;
  attachTips(outB); readout();
  window.NEURALESE_LAST = { hacked: tok.decode(gen), clean: tok.decode(genC) };
}
// per-token projection of the residual onto a steering vector
function readout() {
  const id = $('readSel').value, tr = S.lastTraces; if (!tr) return; const spans = [...$('outB').children];
  const v = R.steer.find((x) => String(x.id) === id); if (!v) { spans.forEach((s) => { if (s.classList.contains('pr')) s.style.background = ''; }); return; }
  let pl = 0; v.sched.forEach((x, l) => { if (Math.abs(x) > Math.abs(v.sched[pl])) pl = l; }); const vec = v.vecs[pl]; let nn = 0; for (const x of vec) nn += x * x; nn = Math.sqrt(nn) || 1;
  const proj = tr.map((t) => { const s = t.slotLayer.indexOf(pl); const a = s >= 0 ? (t[v.site][s] || t.resid_post[s]) : null; if (!a) return 0; let p = 0; for (let i = 0; i < d; i++) p += a[i] * vec[i]; return p / nn; });
  const mu = proj.reduce((a, b) => a + b, 0) / proj.length, sd = Math.sqrt(proj.reduce((a, b) => a + (b - mu) ** 2, 0) / proj.length) || 1;
  spans.forEach((s, i) => { if (i >= proj.length) return; const z = (proj[i] - mu) / sd; s.style.background = divColor(z, 2.5); const old = s._info; s._info = () => `proj on "${v.name}" @L${pl}: ${proj[i].toFixed(3)} (z ${z.toFixed(2)})` + (old ? '\n' + old() : ''); });
  lines($('cvProj'), [{ ys: proj, color: '#fbbf24', label: 'proj' }], { xs: tr.map((t) => tok.tokenStr(t.tok)), title: `projection on ${v.name} @ L${pl} (${v.site})` }); attachTips($('outB'));
}

// ───────── steering ─────────
function schedule() {
  const k = $('cvSched').value, c = +$('cvC').value, w = +$('cvW').value;
  if (k === 'all') return Array(L).fill(1); if (k === 'single') return Array.from({ length: L }, (_, l) => (l === c ? 1 : 0));
  if (k === 'band') return Array.from({ length: L }, (_, l) => (Math.abs(l - c) <= w ? 1 : 0)); if (k === 'gauss') return Array.from({ length: L }, (_, l) => +Math.exp(-((l - c) ** 2) / (2 * Math.max(w, 0.3) ** 2)).toFixed(3));
  const a = $('cvCustom').value.split(',').map(Number); if (a.length !== L || a.some(isNaN)) throw new Error(`custom schedule needs ${L} numbers`); return a;
}
const maskOf = () => ({ kind: $('cvMask').value, a: +$('cvA').value, b: +$('cvB').value });
let nextVec = 1;
function addVector(name, site, vecs, meta = {}) { commit(`steer + ${name}`, () => R.steer.push({ id: nextVec++, name, site, vecs, coef: +$('cvCoef').value, sched: schedule(), mask: maskOf(), on: true, ...meta })); }
function renderSteerList() {
  const box = $('steerList'); if (!box) return; const sel = $('readSel'), cur = sel.value;
  sel.innerHTML = '<option value="">surprisal</option>' + R.steer.map((v) => `<option value="${v.id}">proj: ${esc(v.name)}</option>`).join(''); sel.value = R.steer.some((v) => String(v.id) === cur) ? cur : '';
  box.innerHTML = R.steer.length ? '' : '<div class="sm">no vectors</div>';
  R.steer.forEach((v, i) => {
    const norms = v.vecs.map((x) => Math.hypot(...x)); const row = document.createElement('div'); row.className = 'r';
    row.innerHTML = `<input type="checkbox" ${v.on ? 'checked' : ''} data-k="on"/><b>${esc(v.name)}</b><span class="sm">${v.site} · sched [${v.sched.map((x) => +(+x).toFixed(2)).join(',')}] · mask ${v.mask.kind}${v.mask.kind === 'range' ? ` ${v.mask.a}-${v.mask.b}` : ''} · ‖v‖ ${norms.map((x) => x.toFixed(1)).join('/')}</span><label>coef</label><input type="number" step="0.5" value="${v.coef}" data-k="coef"/><button data-k="del">✕</button>`;
    row.querySelector('[data-k=on]').onchange = (e) => commit(`steer ${v.name} ${e.target.checked ? 'on' : 'off'}`, () => (R.steer[i].on = e.target.checked));
    row.querySelector('[data-k=coef]').onchange = (e) => commit(`steer ${v.name} coef ${e.target.value}`, () => (R.steer[i].coef = +e.target.value));
    row.querySelector('[data-k=del]').onclick = () => commit(`steer − ${v.name}`, () => R.steer.splice(i, 1)); box.appendChild(row);
  });
}
const download = (name, data, type = 'application/json') => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
const vecToJSON = (v) => ({ ...v, vecs: v.vecs.map((x) => Array.from(x, (y) => +y.toFixed(6))) });
const vecFromJSON = (v) => ({ ...v, vecs: v.vecs.map((x) => Float32Array.from(x)) });

// ───────── analysis ─────────
const tstr = (id) => JSON.stringify(tok.tokenStr(id)).slice(1, -1);
async function analyze() {
  const ids = tok.encode($('anText').value); if (!ids.length) return; if (ids.length > 64) throw new Error('analysis input capped at 64 tokens');
  const t0 = performance.now(); const run = eng.run(ids, { trace: true }), trs = run.traces, slots = R.program.length; const tuned = $('anTuned').checked ? await ensureTuned() : null;
  S.an = { ids, trs }; const grid = lensGrid(eng, trs, { k: 5, tuned });
  const rows = ['embed', ...R.program.map((s, i) => `s${i}:L${s.layer}`)];
  let html = '<tr><th></th>' + ids.map((id) => `<th>${esc(tstr(id))}</th>`).join('') + '</tr>';
  rows.forEach((rn, r) => { html += `<tr><th>${rn}</th>` + grid.map((col, p) => { const c = col[r]; return `<td data-p="${p}" data-r="${r}" style="background:${seqColor(c.probs[0])}">${esc(tstr(c.ids[0]))}</td>`; }).join('') + '</tr>'; });
  const T = $('lensT'); T.innerHTML = html; T.onmousemove = (e) => { const td = e.target.closest('td'); if (!td) return showTip(e, ''); const c = grid[+td.dataset.p][+td.dataset.r]; showTip(e, `${rows[+td.dataset.r]} @ pos ${td.dataset.p} (${tuned ? 'tuned' : 'logit'} lens)  H=${c.ent.toFixed(2)} nats\n` + c.ids.map((id, i) => `${JSON.stringify(tok.tokenStr(id)).padEnd(14)} ${c.probs[i].toFixed(4)}`).join('\n')); }; T.onmouseleave = () => showTip(null, '');
  // DLA
  let pos = +$('anPos').value; if (pos < 0) pos = ids.length + pos; const tr = trs[pos]; const lp = logSoftmax(eng.logits(tr.h));
  const tgt = $('anTgt').value ? tok.encode($('anTgt').value)[0] : topK(lp, 1)[0]; const r = dla(eng, tr, tgt), logit = eng.logitOf(tr.h, tgt);
  $('dlaSum').innerHTML = `target <b>${esc(JSON.stringify(tok.tokenStr(tgt)))}</b> @ pos ${pos} (p=${Math.exp(lp[tgt]).toFixed(4)}) · logit ${logit.toFixed(4)} = Σ ${r.total.toFixed(4)} (err ${(logit - r.total).toExponential(1)}) · embed ${r.embed.toFixed(3)} · biases ${r.biases.reduce((a, b) => a + b.v, 0).toFixed(3)} · other(steer/SAE) ${r.other.toFixed(3)}`;
  const HM = Array.from({ length: slots }, () => Array(H).fill(0)); for (const x of r.heads) HM[x.slot][x.h] = x.v;
  heatmap($('dlaHeads'), HM, { rows: rows.slice(1), cols: [...Array(H).keys()], label: (i, j) => `slot ${i} L${R.program[i].layer} H${j}: ${HM[i][j].toFixed(4)}`, onClick: (i, j) => setSel({ l: R.program[i].layer, h: j }) });
  $('dlaHT').innerHTML = '<tr><th>head</th><th>DLA</th></tr>' + r.heads.slice(0, 12).map((x) => `<tr><td>L${x.l}H${x.h}</td><td style="color:${x.v > 0 ? '#5eead4' : '#f87171'}">${x.v.toFixed(4)}</td></tr>`).join('');
  $('dlaNT').innerHTML = '<tr><th>neuron</th><th>DLA</th></tr>' + r.neurons.slice(0, 12).map((x) => `<tr><td>L${x.l}N${x.n}</td><td style="color:${x.v > 0 ? '#5eead4' : '#f87171'}">${x.v.toFixed(4)}</td></tr>`).join('');
  drawAttention();
  // trajectories + entropy + neurons
  const st = tokenStats(eng, trs, ids), pal = ['#5eead4', '#f472b6', '#fbbf24', '#60a5fa', '#a78bfa', '#f87171', '#34d399', '#e879f9'];
  const xs = rows; lines($('normC'), st.rows.map((x, p) => ({ ys: x.norms, color: p === ids.length - 1 ? '#fff' : pal[p % 8] + '88', width: p === ids.length - 1 ? 2 : 1, label: p === ids.length - 1 ? 'last' : null })), { xs, title: '‖resid‖ per slot (each line = one token, white = last)' });
  lines($('cosC'), st.rows.map((x, p) => ({ ys: x.cos, color: p === ids.length - 1 ? '#fff' : pal[p % 8] + '88', width: p === ids.length - 1 ? 2 : 1, label: p === ids.length - 1 ? 'last' : null })), { xs: xs.slice(1), title: 'cos(x_s, x_{s−1})' });
  lines($('entC'), [{ ys: st.rows.map((x) => x.ent), color: '#5eead4', label: 'entropy' }, { ys: st.rows.map((x) => x.nll ?? NaN), color: '#f472b6', label: 'surprisal next' }], { xs: ids.map(tstr), title: 'entropy (teal) / −log p(next actual) (pink), nats' });
  $('pplInfo').textContent = `perplexity on this text: ${st.ppl.toFixed(3)} (hacked model, ${ids.length - 1} predictions)`;
  $('neuT').innerHTML = '<tr><th>token</th><th>top MLP neurons (act)</th></tr>' + st.rows.map((x, p) => `<tr><td>${esc(tstr(ids[p]))}</td><td>${x.topNeurons.slice(0, 6).map(([a, s, n]) => `L${R.program[s].layer}N${n} ${a.toFixed(2)}`).join(' · ')}</td></tr>`).join('');
  $('anInfo').textContent = `${ids.length} tokens · ${slots} slots · ${(performance.now() - t0).toFixed(0)} ms`;
  viz.activations(tr);
}
function drawAttention() {
  if (!S.an) return; const trs = S.an.trs, T = trs.length, slots = R.program.length;
  const big = Array.from({ length: slots * T }, () => Array(H * T).fill(0));
  for (let s = 0; s < slots; s++) for (let q = 0; q < T; q++) { const pats = trs[q].pattern[s]; if (!pats) continue; for (let h = 0; h < H; h++) for (let k = 0; k <= q; k++) big[s * T + q][h * T + k] = pats[h][k] ?? 0; }
  heatmap($('attAll'), big, { diverging: false, max: 1, padL: 4, padT: 2, h: Math.min(520, slots * T * 3 + 10), rows: Array(slots * T).fill(''), label: (i, j) => `slot ${(i / T) | 0} H${(j / T) | 0} q=${i % T} k=${j % T}: ${big[i][j].toFixed(3)}`, onClick: (i, j) => { $('attS').value = (i / T) | 0; $('attH').value = (j / T) | 0; setSel({ l: R.program[(i / T) | 0].layer, h: (j / T) | 0 }); } });
  const s = Math.min(+$('attS').value, slots - 1), h = +$('attH').value, one = Array.from({ length: T }, (_, q) => Array.from({ length: T }, (_, k) => trs[q].pattern[s]?.[h]?.[k] ?? 0)), lab = S.an.ids.map(tstr);
  heatmap($('attOne'), one, { diverging: false, max: 1, rows: lab, cols: lab, padL: 60, h: Math.max(160, T * 14 + 20), label: (q, k) => `slot ${s} H${h}: ${lab[q]} → ${lab[k]}  ${one[q][k].toFixed(4)}` });
}

// ───────── causal ─────────
function caInputs() { const c = tok.encode($('caClean').value), x = tok.encode($('caCorr').value), a = tok.encode($('caAns').value)[0], w = tok.encode($('caWrong').value)[0]; $('caLen').textContent = `${c.length} vs ${x.length} tok`; return [c, x, a, w]; }
function showCausal(res, kind, ids) {
  const isHead = kind !== 'resid', M = res.M.map((row) => row.map((c) => c.norm));
  $('caTitle').textContent = { resid: 'residual-stream patching (slot × position)', heads: 'head-output (z) patching, all positions', path: 'path patching: head → logits (direct)', abl: 'ablation: Δmetric / |base|' }[kind];
  heatmap($('caMap'), M, { rows: R.program.map((s, i) => `s${i}L${s.layer}`), cols: isHead ? [...Array(H).keys()] : ids.map(tstr), label: (i, j) => `${isHead ? `L${R.program[i]?.layer ?? i}H${j}` : `slot ${i} @ ${tstr(ids[j])}`}: norm ${M[i][j].toFixed(4)} raw ${res.M[i][j].raw.toFixed(4)}`, onClick: isHead ? (i, j) => setSel({ l: kind === 'abl' ? i : R.program[i].layer, h: j }) : null });
  $('caInfo').textContent = res.base != null ? `base metric ${res.base.toFixed(4)}` : `clean ${res.clean.toFixed(4)} · corrupted ${res.corrupt.toFixed(4)}`;
}

// ───────── SAE ─────────
let saeStop = false;
async function trainSae() {
  await ensureStats(); const l = +$('saeL').value, m = +$('saeM').value; saeStop = false; const s = new SAE(l, m, 1); const pts = [];
  await s.train(stats.resid[l], stats.N, { epochs: +$('saeE').value, lr: +$('saeLr').value, l1: +$('saeL1').value, onp: (p) => { prog('saeP', p.frac); pts.push(p); $('saeInfo').textContent = `ep ${p.ep} · loss ${p.loss.toFixed(4)} · nMSE ${p.mse.toFixed(4)} · L0 ${p.l0.toFixed(1)}`; lines($('saeLoss'), [{ ys: pts.map((x) => x.mse), color: '#5eead4', label: 'nMSE' }, { ys: pts.map((x) => x.l0 / m), color: '#f472b6', label: 'L0/m' }], { title: 'nMSE (teal) · L0/m (pink)', min: 0 }); }, shouldStop: () => saeStop });
  sae = s; saeA = s.analyse(stats.resid[l], stats.N, 10); eng.sae = s; prog('saeP', 1);
  $('saeInfo').textContent += ` · FVU ${saeA.fvu.toFixed(4)} · alive ${saeA.alive}/${m}`; renderSae(); hud();
}
function ctxStr(i) { const c = stats.context(i, 10); return `${esc(tok.decode(c.before))}<b style="color:#fbbf24">${esc(tok.tokenStr(c.tok))}</b>${esc(tok.decode(c.after))}`; }
function renderSae() {
  if (!sae) return; const q = $('saeQ').value.toLowerCase(), by = $('saeSort').value;
  let fs = [...Array(sae.m).keys()].filter((f) => saeA.dens[f] > 0); fs.sort((a, b) => by === 'max' ? saeA.mx[b] - saeA.mx[a] : saeA.dens[b] - saeA.dens[a]);
  if (q) fs = fs.filter((f) => saeA.tops[f].some(([, i]) => tok.decode(stats.context(i, 6).before.concat([stats.ids[i]])).toLowerCase().includes(q)));
  $('saeT').innerHTML = '<tr><th>f</th><th>max</th><th>dens</th><th>top context</th></tr>' + fs.slice(0, 150).map((f) => `<tr data-f="${f}" style="cursor:pointer"><td>${f}</td><td>${saeA.mx[f].toFixed(2)}</td><td>${(saeA.dens[f] * 100).toFixed(1)}%</td><td>${ctxStr(saeA.tops[f][0][1])}</td></tr>`).join('');
  $$('#saeT tr[data-f]').forEach((tr) => (tr.onclick = () => { const f = +tr.dataset.f; $('clF').value = f; $('saeCtx').innerHTML = `<b>feature ${f}</b> top activations:<br>` + saeA.tops[f].map(([a, i]) => `${a.toFixed(2)} · ${ctxStr(i)}`).join('<br>'); }));
  $('clList').innerHTML = R.sae.clamps.map((c, i) => `<div class="r">f${c.f} ${c.mode} ${c.value} <button data-i="${i}">✕</button></div>`).join('') || '<div class="sm">none</div>';
  $$('#clList button').forEach((b) => (b.onclick = () => commit('SAE clamp −', () => R.sae.clamps.splice(+b.dataset.i, 1))));
}

// ───────── surgery ─────────
const matPath = () => { const m = $('smM').value; return m === 'wte' || m === 'wpe' ? m : `L${$('smL').value}.${m}`; };
const frob = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s); };
function weightEdit(label, e, path) { // records relative Frobenius change of the touched matrix
  const before = path ? Float32Array.from(getMat(M, path).a) : null; commit(label, () => ed.push(e));
  if (path) { const a = getMat(M, path).a; let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - before[i]) ** 2; $('svdInfo').textContent = `‖ΔW‖/‖W‖ = ${(Math.sqrt(s) / frob(before)).toExponential(3)}`; }
}
async function showSvd() {
  const path = matPath(); if (path === 'wte') throw new Error('wte SVD (50257×256) is too slow for the browser here; use a layer matrix or wpe'); $('svdInfo').textContent = 'running one-sided Jacobi SVD…'; await tick();
  const t0 = performance.now(), { a, rows, cols } = getMat(M, path), r = ed.svdOf(path, true), S2 = r.S; const tot = S2.reduce((x, y) => x + y * y, 0); let c = 0; const cum = S2.map((s) => (c += s * s) / tot);
  const out = new Float32Array(rows * cols); (await import('./linalg.js?v=7')).svdReconstruct(r, Float64Array.from(S2), out); let e = 0; for (let i = 0; i < out.length; i++) e += (out[i] - a[i]) ** 2;
  bars($('svdC'), Array.from(S2), { log: true, title: `σ spectrum ${path} (${rows}×${cols}, log) · hover for energy`, label: (i) => `σ${i} = ${S2[i].toPrecision(5)}  cum energy ${(cum[i] * 100).toFixed(2)}%`, onClick: (i) => ($('svK').value = i + 1) });
  $('svdInfo').textContent = `${S2.length} σ · ${r.sweeps} sweeps · ${(performance.now() - t0).toFixed(0)} ms · recon rel.err ${(Math.sqrt(e) / frob(a)).toExponential(2)} · 90% energy @ k=${cum.findIndex((x) => x >= 0.9) + 1}`;
}
const parseLayers = (s) => { const out = new Set(); for (const p of s.split(',')) { const m = p.trim().match(/^(\d)(?:-(\d))?$/); if (!m) throw new Error('bad layer list ' + s); for (let l = +m[1]; l <= +(m[2] ?? m[1]); l++) out.add(l); } return [...out].filter((l) => l < L); };

// ───────── runtime: program, heads, masks ─────────
function renderProgram() {
  const box = $('progList'); if (!box) return; box.innerHTML = '';
  R.program.forEach((s, i) => { const r = document.createElement('div'); r.className = 'r';
    r.innerHTML = `<b>s${i}</b><select data-k="layer" aria-label="program step ${i} layer">${layerOpts(s.layer)}</select><label><input type="checkbox" data-k="attn" ${s.attn ? 'checked' : ''}/>attn</label><label><input type="checkbox" data-k="mlp" ${s.mlp ? 'checked' : ''}/>mlp</label><button data-k="up">↑</button><button data-k="dn">↓</button><button data-k="dup">dup</button><button data-k="del">✕</button>`;
    r.querySelector('[data-k=layer]').onchange = (e) => commit(`slot ${i} ← L${e.target.value}`, () => (R.program[i].layer = +e.target.value));
    for (const k of ['attn', 'mlp']) r.querySelector(`[data-k=${k}]`).onchange = (e) => commit(`slot ${i} ${k} ${e.target.checked ? 'on' : 'skip'}`, () => (R.program[i][k] = e.target.checked));
    r.querySelector('[data-k=up]').onclick = () => i > 0 && commit(`swap s${i}↔s${i - 1}`, () => R.program.splice(i - 1, 2, R.program[i], R.program[i - 1]));
    r.querySelector('[data-k=dn]').onclick = () => i < R.program.length - 1 && commit(`swap s${i}↔s${i + 1}`, () => R.program.splice(i, 2, R.program[i + 1], R.program[i]));
    r.querySelector('[data-k=dup]').onclick = () => commit(`duplicate s${i} (L${s.layer})`, () => R.program.splice(i + 1, 0, { ...s }));
    r.querySelector('[data-k=del]').onclick = () => R.program.length > 1 && commit(`delete s${i} (L${s.layer})`, () => R.program.splice(i, 1)); box.appendChild(r); });
  const mb = $('maskList'); mb.innerHTML = '';
  R.attnMask.forEach((m, l) => { const r = document.createElement('div'); r.className = 'r'; r.innerHTML = `<b>L${l}</b><select>${opts(['causal', 'self', 'noself', 'bos', 'nobos', 'uniform'], m.mode)}</select><label>window</label><input type="number" value="${m.window}"/><span class="sm">${m.window ? '' : l % 2 ? '(native local 256)' : '(native global)'}</span>`;
    r.querySelector('select').onchange = (e) => commit(`L${l} mask ${e.target.value}`, () => (R.attnMask[l].mode = e.target.value)); r.querySelector('input').onchange = (e) => commit(`L${l} window ${e.target.value}`, () => (R.attnMask[l].window = +e.target.value)); mb.appendChild(r); });
  $('naList').innerHTML = R.neuronAbl.map((n, i) => `<div class="r">L${n.l}N${n.n} ${n.mode}${n.mode === 'clamp' ? ' ' + n.value : ''} <button data-i="${i}">✕</button></div>`).join('') || '<div class="sm">none</div>';
  $$('#naList button').forEach((b) => (b.onclick = () => commit('neuron override −', () => R.neuronAbl.splice(+b.dataset.i, 1))));
  $('psS').value = R.pos.scale; $('psH').value = R.pos.shift; $('psF').value = R.pos.freeze; if (sae) renderSae();
}
function renderHeadGrid() {
  const box = $('headGrid'); if (!box) return; const l = +$('hgL').value; box.innerHTML = '';
  for (let h = 0; h < H; h++) { const r = document.createElement('div'); r.className = 'r'; if (S.sel.l === l && S.sel.h === h) r.style.background = '#1a2a44';
    r.innerHTML = `<b style="width:28px">H${h}</b><label>τ</label><input type="number" step="0.1" value="${R.headTemp[l][h]}" aria-label="L${l}H${h} temperature"/><select aria-label="L${l}H${h} ablation">${opts([['', 'active'], 'zero', 'mean', 'resample'], R.headAbl[l][h] || '')}</select><button aria-label="select L${l}H${h}">select</button>`;
    r.querySelector('input').onchange = (e) => commit(`L${l}H${h} τ=${e.target.value}`, () => (R.headTemp[l][h] = +e.target.value));
    r.querySelector('select').onchange = guard(async (e) => { const v = e.target.value || null; if (v === 'mean' || v === 'resample') await ensureStats(); commit(`L${l}H${h} ${v || 'restore'}`, () => (R.headAbl[l][h] = v)); });
    r.querySelector('button').onclick = () => setSel({ l, h }); box.appendChild(r); }
}

// ───────── ops ─────────
function renderOps() {
  const hl = $('histL'); if (!hl) return;
  hl.innerHTML = [...S.undo.map((u, i) => `<div data-u="${i}"><b>${i + 1}</b>${esc(u.label)}</div>`), ...S.redo.slice().reverse().map((u) => `<div class="undone">${esc(u.label)}</div>`)].join('') || '<div class="sm">empty</div>';
  $$('#histL div[data-u]').forEach((dv) => (dv.onclick = () => { const k = +dv.dataset.u; while (S.undo.length > k + 1) undo(); }));
  $('editL').innerHTML = ed.edits.map((e) => `<div><b>#${e.id}</b>${esc(ed.label(e))}</div>`).join('') || '<div class="sm">no weight edits — model is bit-identical to the original</div>';
  $('bUndo').disabled = !S.undo.length; $('bRedo').disabled = !S.redo.length;
}
function exportSnap() { const s = snap(); s.R.steer = R.steer.map(vecToJSON); download('neuralese-snapshot.json', JSON.stringify({ format: 'neuralese-snapshot', version: 2, model: 'roneneldan/TinyStories-8M', decode: D, ...s })); }
async function importSnap(file) {
  const j = JSON.parse(await file.text()); if (j.format !== 'neuralese-snapshot') throw new Error('not a neuralese snapshot'); j.R.steer = j.R.steer.map(vecFromJSON);
  const needs = j.R.headAbl.flat().some((x) => x === 'mean' || x === 'resample') || j.R.neuronAbl.some((n) => n.mode === 'mean'); if (needs) await ensureStats();
  if (j.R.sae.clamps.length && !sae) toast('snapshot has SAE clamps: train an SAE on the same layer to activate them', true);
  nextVec = Math.max(nextVec, ...j.R.steer.map((v) => v.id + 1)); const before = snap(); restore({ edits: j.edits, R: j.R }); S.undo.push({ label: 'import snapshot', s: before }); S.redo = []; renderOps();
}

// ───────── selection sync ─────────
function setSel(s) {
  Object.assign(S.sel, { h: null, n: null }, s); const { l, h, n } = S.sel; viz.select(S.sel);
  $('selInfo').textContent = `L${l}${h != null ? ` H${h}` : ''}${n != null ? ` N${n}` : ''}`;
  $('hgL').value = l; $('smL').value = l; $('vzL').value = l; $('naL').value = l; if (h != null) { $('attH').value = h; const s2 = R.program.findIndex((p) => p.layer === l); if (s2 >= 0) $('attS').value = s2; $('elT').value = 'head'; $('elI').value = h; drawAttention(); }
  if (n != null) { $('naN').value = n; $('elT').value = 'neuron'; $('elI').value = n; }
  renderHeadGrid(); refreshWeights(); inspector();
}
function inspector() {
  const { l, h, n } = S.sel, Pm = M.layers[l], Po = W.layers[l]; let html = `<div class="sm">layer ${l} (${l % 2 ? 'local attention, window 256' : 'global attention'})</div>`;
  const nrm = (a, idx) => { let s = 0; for (const i of idx) s += a[i] * a[i]; return Math.sqrt(s); };
  if (h != null) { const oc = [], qr = []; for (let i = 0; i < d; i++) for (let j = h * 16; j < h * 16 + 16; j++) oc.push(i * d + j); for (let j = h * 16; j < h * 16 + 16; j++) for (let i = 0; i < d; i++) qr.push(j * d + i);
    html += `<table><tr><th>head ${h}</th><th>now</th><th>orig</th></tr>${['q', 'k', 'v'].map((k) => `<tr><td>‖W${k}[h]‖</td><td>${nrm(Pm[k], qr).toFixed(3)}</td><td>${nrm(Po[k], qr).toFixed(3)}</td></tr>`).join('')}<tr><td>‖Wo[:,h]‖</td><td>${nrm(Pm.o, oc).toFixed(3)}</td><td>${nrm(Po.o, oc).toFixed(3)}</td></tr><tr><td>τ / ablation</td><td colspan=2>${R.headTemp[l][h]} / ${R.headAbl[l][h] || 'active'}</td></tr></table>`;
    if (S.an) { const s = R.program.findIndex((p) => p.layer === l), T = S.an.trs.length, pat = S.an.trs[T - 1].pattern[s]?.[h]; if (pat) html += `<div class="sm">last-token attention:</div>` + [...pat].map((w, k) => [w, k]).sort((a, b) => b[0] - a[0]).slice(0, 6).map(([w, k]) => `${esc(tstr(S.an.ids[k]))} ${w.toFixed(3)}`).join('<br>'); } }
  if (n != null) { const ir = [], oc = []; for (let i = 0; i < d; i++) { ir.push(n * d + i); oc.push(i * ff + n); }
    html += `<table><tr><th>neuron ${n}</th><th>now</th><th>orig</th></tr><tr><td>‖w_in‖</td><td>${nrm(Pm.fc, ir).toFixed(3)}</td><td>${nrm(Po.fc, ir).toFixed(3)}</td></tr><tr><td>‖w_out‖</td><td>${nrm(Pm.proj, oc).toFixed(3)}</td><td>${nrm(Po.proj, oc).toFixed(3)}</td></tr></table>`;
    const u = new Float32Array(d); for (let i = 0; i < d; i++) u[i] = Pm.proj[i * ff + n] * M.lnfW[i]; const lg = eng.logits(u); html += `<div class="sm">w_out·W_U top tokens: ${topK(lg, 8).map((i) => esc(tstr(i))).join(' · ')}<br>bottom: ${topK(lg.map((x) => -x), 6).map((i) => esc(tstr(i))).join(' · ')}</div>`; }
  $('insp').innerHTML = html;
}
function refreshWeights() { if (!viz) return; const path = `L${$('vzL').value}.${$('vzM').value}`; const r = viz.weights(M, W, path, $('vzMode').value, $('vzDiff').checked); $('vzInfo').textContent = `${path} ${r.rows}×${r.cols} shown at ${r.R}×${r.C} (max-|·| pooling), height = w/σ_orig (σ=${r.sd.toFixed(4)})${$('vzDiff').checked ? ', showing W − W_orig' : ''}`; }

// ───────── command palette ─────────
const CMDS = () => [
  ['Generate', () => generate()], ['Toggle mute', () => $('auMute').click()], ['Start audio', () => $('auStart').click()], ['Stop generation', () => genId++], ['Undo', undo], ['Redo', redo], ['Toggle dense layout', () => document.body.classList.toggle('dense')],
  ...Object.entries(TABS).map(([k, t]) => [`Go to ${t}`, () => showTab(k)]), ['Toggle light/dark theme', () => V5.toggleTheme()], ['Open terminal', () => showTab('term')], ['Open learning center', () => showTab('learn')], ['Analyze input', () => $('bAn').click()], ['Compute corpus stats', () => $('bStats').click()],
  ['Export snapshot', exportSnap], ['Download safetensors', () => $('bST').click()], ['Reset everything', () => $('bReset').click()], ['Resid patching', () => $('bPR').click()], ['Head patching', () => $('bPH').click()], ['Train SAE', () => $('bSae').click()], ['SVD spectrum of selected matrix', () => $('bSvd').click()],
  ...[...Array(L).keys()].map((l) => [`Select layer ${l}`, () => setSel({ l })]),
];
let palSel = 0;
function palOpen() { $('pal').classList.remove('hidden'); $('palIn').value = ''; palSel = 0; palRender(); $('palIn').focus(); }
function palRender() { const q = $('palIn').value.toLowerCase(); const list = CMDS().filter(([n]) => n.toLowerCase().includes(q)); palSel = Math.min(palSel, Math.max(0, list.length - 1)); $('palList').innerHTML = list.map(([n], i) => `<div class="${i === palSel ? 'on' : ''}" data-i="${i}">${esc(n)}</div>`).join(''); $$('#palList div').forEach((dv) => (dv.onclick = () => { $('pal').classList.add('hidden'); list[+dv.dataset.i][1](); })); return list; }

// ───────── wiring ─────────
function wire() {
  const on = (id, ev, fn) => $(id).addEventListener(ev, guard(fn));
  V5.wire({ on, guard });
  on('bGen', 'click', generate); on('bStop', 'click', () => genId++); on('bUndo', 'click', undo); on('bRedo', 'click', redo); on('bU2', 'click', undo); on('bR2', 'click', redo);
  on('bDense', 'click', () => document.body.classList.toggle('dense')); on('bPal', 'click', palOpen); on('readSel', 'change', readout);
  // steering
  on('bCv', 'click', async () => { const pairs = $('cvPairs').value.split('\n').map((s) => s.split('|').map((x) => x.trim())).filter((p) => p.length === 2 && p[0] && p[1]); if (!pairs.length) throw new Error('need lines "positive | negative"');
    const t0 = performance.now(), site = $('cvSite').value, vecs = buildControlVector(engClean, tok, pairs, { site, method: $('cvMethod').value, agg: $('cvAgg').value });
    addVector($('cvName').value || 'v', site, vecs, { method: $('cvMethod').value, pairs: pairs.length }); $('cvInfo').textContent = `${pairs.length} pairs · ${(performance.now() - t0).toFixed(0)} ms`; });
  on('bCvExpr', 'click', () => { const vecs = vectorArithmetic($('cvExpr').value, R.steer); addVector($('cvExprName').value || 'mix', R.steer[0]?.site || 'resid_post', vecs, { expr: $('cvExpr').value }); });
  on('bCvExport', 'click', () => download('neuralese-vectors.json', JSON.stringify({ format: 'neuralese-vectors', vectors: R.steer.map(vecToJSON) })));
  on('cvImport', 'change', async (e) => { const j = JSON.parse(await e.target.files[0].text()); const vs = (j.vectors || []).map(vecFromJSON); if (!vs.length || vs.some((v) => v.vecs.length !== L || v.vecs[0].length !== d)) throw new Error(`expected vectors with ${L}×${d}`); commit(`import ${vs.length} vectors`, () => vs.forEach((v) => R.steer.push({ ...v, id: nextVec++ }))); });
  // analysis
  on('bAn', 'click', analyze); on('anTuned', 'change', analyze); on('attS', 'change', drawAttention); on('attH', 'change', drawAttention);
  // causal
  for (const id of ['caClean', 'caCorr']) on(id, 'input', caInputs);
  const ca = (kind, f) => async () => { const [c, x, a, w] = caInputs(); prog('caP', 0); const t0 = performance.now(); const res = await f(c, x, a, w); prog('caP', 1); showCausal(res, kind, c); $('caInfo').textContent += ` · ${(performance.now() - t0).toFixed(0)} ms`; };
  on('bPR', 'click', ca('resid', (c, x, a, w) => patchResid(eng, c, x, a, w, (f) => prog('caP', f))));
  on('bPH', 'click', ca('heads', (c, x, a, w) => patchHeads(eng, c, x, a, w, (f) => prog('caP', f))));
  on('bPP', 'click', ca('path', (c, x, a, w) => pathPatchHeadsToLogits(eng, c, x, a, w)));
  on('bAbl', 'click', ca('abl', async (c, x, a, w) => { const t = $('caAblT').value; if (t !== 'zero') await ensureStats(); return ablationSweep(eng, c, a, w, t, (f) => prog('caP', f)); }));
  // stats + SAE
  on('bStats', 'click', async () => { stats = null; cov.clear(); await ensureStats(); });
  on('bSae', 'click', trainSae); on('bSaeStop', 'click', () => (saeStop = true)); on('saeSort', 'change', renderSae); on('saeQ', 'input', renderSae);
  on('bClamp', 'click', () => { if (!sae) throw new Error('train an SAE first'); const f = +$('clF').value; if (!(f >= 0 && f < sae.m)) throw new Error('feature out of range'); commit(`SAE L${sae.layer} f${f} ${$('clMode').value} ${$('clV').value}`, () => R.sae.clamps.push({ f, mode: $('clMode').value, value: +$('clV').value })); });
  // surgery
  on('bSvd', 'click', showSvd);
  on('bSvTop', 'click', () => weightEdit(`SVD keep top-${$('svK').value} ${matPath()}`, { kind: 'svd', path: matPath(), mode: 'topk', k: +$('svK').value }, matPath()));
  on('bSvFlat', 'click', () => weightEdit(`SVD flatten ${matPath()}`, { kind: 'svd', path: matPath(), mode: 'flatten', k: +$('svK').value }, matPath()));
  on('bSvDrop', 'click', () => weightEdit(`SVD drop ${matPath()}`, { kind: 'svd', path: matPath(), mode: 'drop', from: +$('svA').value, to: +$('svB').value }, matPath()));
  on('bSvScale', 'click', () => weightEdit(`SVD scale ${matPath()}`, { kind: 'svd', path: matPath(), mode: 'scale', from: +$('svA').value, to: +$('svB').value, factor: +$('svF').value }, matPath()));
  on('bLr', 'click', () => weightEdit(`low-rank ${matPath()}`, { kind: 'lowrank', path: matPath(), rank: +$('lrR').value, sigma: +$('lrS').value, seed: Date.now() % 1e6 }, matPath()));
  on('bEl', 'click', () => { const t = $('elT').value, l = +$('smL').value, i = +$('elI').value, fn = $('elF').value, amt = +$('elA').value; let target;
    if (t === 'matrix') target = { type: 'matrix', path: matPath() }; else if (t === 'head') { if (!(i >= 0 && i < H)) throw new Error('head 0..15'); target = { type: 'head', l, i }; } else if (t === 'neuron') { if (!(i >= 0 && i < ff)) throw new Error('neuron 0..1023'); target = { type: 'neuron', l, i }; }
    else { const words = $('elWords').value.split(',').map((s) => s.trim()).filter(Boolean); if (!words.length) throw new Error('enter embed words'); target = { type: 'embed', word: words.join(','), toks: [...new Set(words.flatMap((w) => [tok.encode(' ' + w)[0], tok.encode(w)[0]]))] }; }
    const e = { kind: 'elem', target, fn, amt, seed: Date.now() % 1e6 }; weightEdit(ed.label(e), e, t === 'matrix' ? matPath() : null); });
  on('bQ', 'click', () => { const bits = +$('qB').value, layers = parseLayers($('qL').value), mats = $('qM').value.split(',').map((s) => s.trim()).filter((m) => MATS.includes(m)); if (!mats.length) throw new Error('no valid mats');
    let err = 0, n = 0; for (const l of layers) for (const m of mats) { const { a, rows, cols } = getMat(M, `L${l}.${m}`); const c = Float32Array.from(a); err += quantize(c, rows, cols, bits) ** 2; n++; } // preview error on a copy
    commit(`int${bits} quantize`, () => ed.push({ kind: 'quant', bits, layers, mats })); $('qInfo').textContent = `RMS weight error ≈ ${Math.sqrt(err / n).toExponential(2)}`; });
  on('bIp', 'click', () => commit(`L${$('ipD').value} ← lerp L${$('ipS').value} t=${$('ipT').value}`, () => ed.push({ kind: 'interp', dst: +$('ipD').value, src: +$('ipS').value, t: +$('ipT').value })));
  on('bLn', 'click', () => { const e = { kind: 'ln', which: $('lnW').value, l: +$('lnL').value, gScale: +$('lnG').value, bAdd: +$('lnB').value }; commit(ed.label(e), () => ed.push(e)); });
  on('bWp', 'click', () => { const e = { kind: 'wpe', fn: $('wpF').value, amt: +$('wpA').value, n: 256, seed: Date.now() % 1e6 }; commit(ed.label(e), () => ed.push(e)); });
  on('bRome', 'click', async () => { const l = +$('roL').value; $('roInfo').textContent = 'computing activation covariance on corpus…'; const C = await ensureCov(l); const prompt = $('roP').value, target = $('roT').value;
    const before = tok.tokenStr(topK(logSoftmax(eng.logits(eng.run(tok.encode(prompt)).last.h)), 1)[0]);
    const op = await computeRome(eng, tok, C, { prompt, subject: $('roS').value, target, layer: l }, ({ it, p }) => { prog('romeP', 0.3 + 0.7 * Math.min(1, it / 150)); $('roInfo').textContent = `optimising v* · iter ${it} · p(target) ${p.toFixed(3)}`; });
    commit(ed.label({ kind: 'rome', l, subject: op.subject, target }), () => ed.push({ kind: 'rome', l, u: op.u, v: op.v, subject: op.subject, target, prompt }));
    const after = tok.tokenStr(topK(logSoftmax(eng.logits(eng.run(tok.encode(prompt)).last.h)), 1)[0]); prog('romeP', 1);
    $('roInfo').innerHTML = `${op.iters} iters · hook p=${op.p.toFixed(3)} · real rank-1 weight edit: top-1 ${esc(JSON.stringify(before))} → <b class="${after === target ? 'ok' : 'err'}">${esc(JSON.stringify(after))}</b>`; });
  on('chP', 'input', () => ($('chV').textContent = $('chP').value + '%')); on('bChaos', 'click', () => commit(`chaos ${$('chP').value}%`, () => ed.push({ kind: 'chaos', pct: +$('chP').value, seed: Date.now() % 1e6 })));
  on('smL', 'change', () => setSel({ l: +$('smL').value }));
  // runtime
  on('bProgReset', 'click', () => commit('reset program', () => (R.program = defaultRuntime().program))); on('hgL', 'change', renderHeadGrid);
  on('bPos', 'click', () => commit(`pos scale ${$('psS').value} shift ${$('psH').value} freeze ${$('psF').value}`, () => (R.pos = { scale: +$('psS').value, shift: +$('psH').value, freeze: +$('psF').value })));
  on('bNa', 'click', async () => { const m = $('naM').value; if (m === 'mean') await ensureStats(); const n = +$('naN').value; if (!(n >= 0 && n < ff)) throw new Error('neuron 0..1023'); commit(`L${$('naL').value}N${n} ${m}`, () => R.neuronAbl.push({ l: +$('naL').value, n, mode: m, value: +$('naV').value })); });
  // ops
  on('bReset', 'click', () => commit('reset everything', () => { R = defaultRuntime(); eng.R = R; ed.setEdits([]); }));
  on('bSnapE', 'click', exportSnap); on('snapI', 'change', (e) => importSnap(e.target.files[0]));
  on('bST', 'click', () => download('model.safetensors', toSafetensors(M), 'application/octet-stream'));
  // 3D
  for (const id of ['vzL', 'vzM', 'vzMode', 'vzDiff']) on(id, 'change', () => (id === 'vzL' ? setSel({ l: +$('vzL').value }) : refreshWeights()));
  // audio
  const startAudio = guard(async () => { await audio.start(); $('auInfo').textContent = `running · ${audio.ctx.sampleRate} Hz · base latency ${(audio.ctx.baseLatency * 1000 || 0).toFixed(1)} ms`; });
  addEventListener('pointerdown', startAudio, { once: true }); addEventListener('keydown', startAudio, { once: true }); on('auStart', 'click', startAudio);
  const mute = () => { audio.setMute(!audio.muted); $('auMute').textContent = audio.muted ? 'unmute (M)' : 'mute (M)'; toast(audio.muted ? '🔇 muted' : '🔊 audio on'); };
  on('auMute', 'click', mute); on('auStyle', 'change', () => { audio.style = $('auStyle').value; audio.applyStyle(); }); on('auRev', 'change', () => { audio.revSize = +$('auRev').value; audio.ctx && audio.makeIR(); });
  on('auBpm', 'change', () => (audio.bpm = Math.max(30, Math.min(200, +$('auBpm').value)))); on('auSync', 'change', () => (audio.sync = $('auSync').checked));
  $$('[data-bus]').forEach((el) => el.addEventListener('input', () => { audio.vol[el.dataset.bus] = +el.value; audio.applyVol(); }));
  $$('[data-sfx]').forEach((b) => b.addEventListener('click', guard(async () => { await startAudio(); audio.edit(b.dataset.sfx); })));
  $$('[data-anom]').forEach((b) => b.addEventListener('click', guard(async () => { await startAudio(); audio.anomaly(b.dataset.anom); })));
  audio.onAnomaly = (t) => { const b = $('anomBadge'); b.textContent = '◆ ' + t.replace('_', ' '); b.style.opacity = 1; clearTimeout(b._t); b._t = setTimeout(() => (b.style.opacity = 0), 4000); };
  setInterval(() => { if (!audio.on || !$('pane_audio').classList.contains('on')) return; const h = audio.hist, n = h.ent.length;
    $('auState').textContent = `mode ${audio.harm.mode} · root ${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][audio.harm.root % 12]}${Math.floor(audio.harm.root / 12) - 1} (MIDI ${audio.harm.root}) · last entropy ${n ? h.ent[n - 1].toFixed(2) : '–'} nats · KL(hacked‖clean) ${audio.lastKL != null ? audio.lastKL.toFixed(4) : '–'} · level ${audio.level.toFixed(2)} · anomalies ${audio.events.length}`;
    const buf = new Uint8Array(audio.an.fftSize); audio.an.getByteTimeDomainData(buf); lines($('auScope'), [{ ys: Array.from(buf, (x) => x / 128 - 1), color: '#5eead4' }], { min: -1, max: 1, h: 80 }); }, 120);
  // keyboard
  addEventListener('keydown', (e) => { const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palOpen(); return; }
    if (!$('pal').classList.contains('hidden')) { if (e.key === 'Escape') $('pal').classList.add('hidden'); else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { palSel += e.key === 'ArrowDown' ? 1 : -1; palSel = Math.max(0, palSel); palRender(); e.preventDefault(); } else if (e.key === 'Enter') { const l = palRender(); $('pal').classList.add('hidden'); l[palSel] && guard(l[palSel][1])(); } return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); generate(); }
    if (!typing && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'm') mute(); });
  $('palIn').addEventListener('input', () => { palSel = 0; palRender(); });
}

// ───────── boot ─────────
(async () => {
  try {
    const r = await loadModel(); W = r.W; tok = r.tok; M = cloneWeights(W); ed = new Editor(W, M); R = defaultRuntime(); eng = new Engine(M, R); engClean = new Engine(W, defaultRuntime());
    buildUI(); viz = new Viz($('gl'), (s) => setSel(s)); wire(); caInputs(); afterChange(); setSel({ l: 0, h: 0 }); $('loader').style.display = 'none'; hud();
    V5.mount({ viz, W: () => W, M: () => M, eng: () => eng, engClean: () => engClean, tok: () => tok, R: () => R, ed: () => ed, S: () => S, stats: () => stats, sae: () => sae, setSel, showTab, commit, weightEdit, download, generate, analyze, undo, redo, ensureStats, guard, toast, audio, decode: () => D, defaultRuntime,
      applyShared: (st) => commit('load shared experiment', () => { R = Object.assign(defaultRuntime(), st.R || {}); eng.R = R; ed.setEdits(st.edits || []); }),
      reset: () => commit('reset everything', () => { R = defaultRuntime(); eng.R = R; ed.setEdits([]); }), nextVecId: () => nextVec++,
      makeEngine: (w, r) => { const e = new Engine(w, r); e.stats = stats; e.sae = eng.sae; return e; } });
    window.NEURALESE = { v6: V5, v5: V5, viz, audio, W, M, tok, ed, get R() { return R; }, eng, engClean, commit, generate, analyze, undo, redo, get stats() { return stats; }, mb: r.mb };
    if (/#x=/.test(location.hash)) { try { await V5.out.shareLoad(location.hash); } catch (e) { toast('share link: ' + e.message); } }
    await generate();
  } catch (e) { console.error(e); setLoad('✖ ' + e.message + ' — check your connection'); const b = $('loadRetry'); if (b) { b.classList.remove('hidden'); b.onclick = () => location.reload(); b.focus(); } }
})();

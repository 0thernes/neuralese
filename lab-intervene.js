// INTERVENE/RUN extras: parameter sweeps, batch experiments, advanced steering controls (all act on the real engine).
import * as C from './labcore.js?v=10';
import { logSoftmax } from './engine.js?v=10';
import { CORPUS } from './corpus.js?v=10';
import { lines } from './charts.js?v=10';
import { $, esc, opts, hOpts, cv, tipq, prog, tick, tokId, parseLayers, d, H, hd, L, ff } from './lab-ui.js?v=10';
const PROMPT = 'Once upon a time, there was a little girl named Lily. She loved to';
export const markup = {
  sweep: ['SWEEP', 'Sweeps & batch', `<fieldset><legend>parameter sweep ${tipq('Each point builds a fresh engine with that parameter value (weights blended or runtime cloned) and measures perplexity on corpus tokens, KL vs the clean model at the prompt end, and p(target).')}</legend>
<div class="r"><label>parameter</label><select id="xWp">${opts([['blend', 'edit strength α (W + α·ΔW)'], ['steer', 'steering coef (arg = vector id)'], ['htemp', 'head temperature (arg = L,H)'], ['neuron', 'neuron clamp value (arg = L,N)'], ['lbias', 'logit bias (arg = token)'], ['window', 'attention window (arg = L)'], ['hsteer', 'unembed-space steer (arg = token)']])}</select><input id="xWa" placeholder="arg" style="width:90px"/></div>
<div class="r"><label>from</label><input type="number" id="xW0" value="0" step="0.1"/><label>to</label><input type="number" id="xW1" value="1.5" step="0.1"/><label>steps</label><input type="number" id="xWn" value="7"/><label>corpus tok</label><input type="number" id="xWc" value="48"/></div>
<div class="r"><label>prompt</label><input id="xWP" style="flex:1" value="${PROMPT}"/><label>target</label><input id="xWt" value=" play" style="width:70px"/></div><div class="r"><button class="pri" id="xWgo">run sweep</button><button id="xWstop">stop</button><div class="prog" id="xWprog"><i></i></div></div>
${cv('xWppl', 'perplexity (corpus)')}${cv('xWkl', 'KL(variant‖clean) at prompt end')}${cv('xWpt', 'p(target)')}<div id="xWtab" class="scroll"></div></fieldset>
<fieldset><legend>batch experiments ${tipq('One terminal command per line, executed in order. Results are logged in RUNS.')}</legend><textarea id="xBatch" rows="6" aria-label="batch script">reset
calib 80
edit chaos 10
calib 80
impact
undo</textarea><div class="r"><button id="xBgo">run batch</button><span id="xBInfo" class="sm"></span></div></fieldset>`],
  ctrl: ['CONTROL', 'Advanced steering', `<fieldset><legend>direction source</legend><div class="r"><select id="xKs" aria-label="direction source">${opts([['tok', 'token embedding A − B'], ['vec', 'existing steering vector (A = id)'], ['neuron', 'neuron output w_out (A = L,N)'], ['sae', 'SAE decoder row (A = feature)'], ['rand', 'random (A = seed)']])}</select><input id="xKa" value=" happy" style="width:80px" aria-label="A"/><input id="xKb" value=" sad" style="width:80px" aria-label="B"/></div></fieldset>
<fieldset><legend>activation op ${tipq('add: x += c·s(t)·û. addnorm: add then rescale x to its original norm. ablate: remove min(1,|c·s|) of the projection on û. clamp: set the projection on û to c. For q/k/v the direction is mapped through that layer’s W_Q/W_K/W_V (key-steering = site k); for z through W_Oᵀ. head restricts the op to one head’s 16-dim slice.')}</legend><div class="r"><label>site</label><select id="xKsite">${opts(['resid_pre', 'resid_post', 'attn_out', 'mlp_out', 'z', 'q', 'k', 'v'])}</select><label>head</label><select id="xKh"><option value="">all</option>${hOpts('')}</select><label>op</label><select id="xKop">${opts([['add', 'add'], ['addnorm', 'add (norm-preserving)'], ['ablate', 'directional ablation'], ['clamp', 'clamp projection']])}</select></div>
<div class="r"><label>coef</label><input type="number" id="xKc" value="4" step="0.5"/><label>layers</label><input id="xKl" value="2-5" style="width:60px"/><label>mask</label><select id="xKm">${opts(['all', 'prompt', 'gen'])}</select></div>
<div class="r"><label>time schedule</label><select id="xKt">${opts([['const', 'constant'], ['ramp', 'ramp-in over T'], ['decay', 'exp decay τ=T'], ['pulse', 'every T-th token'], ['window', 'first T tokens']])}</select><label>T</label><input type="number" id="xKT" value="8"/><button class="pri" id="xKgo">add op</button></div></fieldset>
<fieldset><legend>logit-space steering</legend><div class="r"><input id="xKlb" value=" dog:3, cat:-2" style="flex:1" aria-label="logit biases"/><button id="xKlbGo">set logit bias</button></div>
<div class="r"><label>unembed direction</label><input id="xKhT" value=" happy" style="width:80px"/><label>coef</label><input type="number" id="xKhC" value="0.5" step="0.1"/><button id="xKhGo">add h-steer</button><button id="xKclr">clear logit controls</button></div><div id="xKInfo" class="sm"></div></fieldset>`],
};

export function install(A, out) {
  const on = A.on, tstr = (id) => JSON.stringify(A.tok().tokenStr(id)).slice(1, -1);
  let stop = false;
  out.sweep = async (cfg = {}) => { const p = cfg.p || $('xWp').value, arg = String(cfg.arg ?? $('xWa').value), a0 = +(cfg.from ?? $('xW0').value), a1 = +(cfg.to ?? $('xW1').value), n = Math.max(2, Math.min(25, +(cfg.steps ?? $('xWn').value) || 7)), nc = Math.max(8, Math.min(400, +(cfg.corpus ?? $('xWc').value) || 48));
    const tok = A.tok(), ids = tok.encode(cfg.prompt || $('xWP').value), tgt = tokId(tok, cfg.target || $('xWt').value), docs = CORPUS.slice(-8), Rb = A.R(), ec = A.engClean(), lpC = logSoftmax(ec.logits(ec.run(ids).last.h)), aa = arg.split(',').map((s) => s.trim()); stop = false;
    let scratch = null; const res = [];
    for (let i = 0; i < n && !stop; i++) { const v = a0 + ((a1 - a0) * i) / (n - 1); let Wx = A.M(); const R2 = structuredClone(Rb);
      if (p === 'blend') { scratch = C.blendWeights(A.W(), A.M(), v, scratch); Wx = scratch; }
      else if (p === 'steer') { const vec = R2.steer.find((s) => String(s.id) === aa[0]) || R2.steer[R2.steer.length - 1]; if (!vec) throw new Error('no steering vector to sweep'); vec.coef = v; vec.on = true; }
      else if (p === 'htemp') { const [l, h] = aa.map(Number); if (!(l >= 0 && l < L && h >= 0 && h < H)) throw new Error('arg must be L,H'); R2.headTemp[l][h] = v; }
      else if (p === 'neuron') { const [l, nn] = aa.map(Number); if (!(l >= 0 && l < L && nn >= 0 && nn < ff)) throw new Error('arg must be L,N'); R2.neuronAbl = R2.neuronAbl.filter((x) => !(x.l === l && x.n === nn)); R2.neuronAbl.push({ l, n: nn, mode: 'clamp', value: v }); }
      else if (p === 'lbias') R2.logitBias = { ...(R2.logitBias || {}), [tokId(tok, aa[0] || ' dog')]: v };
      else if (p === 'window') { const l = +aa[0]; if (!(l >= 0 && l < L)) throw new Error('arg must be a layer'); R2.attnMask[l] = { ...R2.attnMask[l], window: Math.max(1, Math.round(v)) }; }
      else if (p === 'hsteer') { const t = tokId(tok, aa[0] || ' happy'), u = Float32Array.from(C.embedOf(A.M(), t)), nu = Math.hypot(...u) || 1; R2.hSteer = [...(R2.hSteer || []), { vec: Array.from(u, (x) => x / nu), coef: v, on: true }]; }
      else throw new Error('unknown sweep parameter ' + p);
      const e = A.makeEngine(Wx, R2), lp = logSoftmax(e.outLogits(e.run(ids).last.h)), cal = C.calibration(await C.evalCorpus(e, docs, nc));
      res.push({ v, ppl: cal.ppl, kl: C.klLogits(lp, lpC), pt: Math.exp(lp[tgt]), acc: cal.acc }); prog('xWprog', (i + 1) / n); await tick(); }
    const xl = res.map((r) => r.v.toFixed(3)); lines($('xWppl'), [{ ys: res.map((r) => r.ppl), color: '#5eead4', label: 'ppl' }], { xs: xl }); lines($('xWkl'), [{ ys: res.map((r) => r.kl), color: '#f472b6', label: 'KL' }], { xs: xl, min: 0 }); lines($('xWpt'), [{ ys: res.map((r) => r.pt), color: '#fbbf24', label: 'p' }], { xs: xl, min: 0 });
    $('xWtab').innerHTML = `<table><tr><th>${esc(p)}</th><th>ppl</th><th>KL</th><th>p(target)</th><th>acc</th></tr>${res.map((r) => `<tr><td>${r.v.toFixed(3)}</td><td>${r.ppl.toFixed(3)}</td><td>${r.kl.toExponential(2)}</td><td>${r.pt.toFixed(4)}</td><td>${(100 * r.acc).toFixed(1)}%</td></tr>`).join('')}</table>`;
    A.logRun({ kind: 'sweep', label: `sweep ${p}${arg ? ' ' + arg : ''} [${a0}..${a1}]`, metrics: { ppl_min: Math.min(...res.map((r) => r.ppl)), kl_max: Math.max(...res.map((r) => r.kl)) }, series: { x: res.map((r) => r.v), ppl: res.map((r) => r.ppl), kl: res.map((r) => r.kl), pt: res.map((r) => r.pt) } }); return res; };
  on('xWgo', 'click', () => out.sweep()); on('xWstop', 'click', () => (stop = true));
  out.batch = async (text) => { const ls = String(text ?? $('xBatch').value).split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#')); let i = 0; for (const ln of ls) { $('xBInfo').textContent = `${++i}/${ls.length}: ${ln}`; await A.term(ln); } $('xBInfo').textContent = `${ls.length} commands done`; return ls.length; };
  on('xBgo', 'click', () => out.batch());

  out.direction = (src = $('xKs').value, a = $('xKa').value, b = $('xKb').value) => { const W = A.M(), tok = A.tok(); let u;
    if (src === 'vec') { const v = A.R().steer.find((s) => String(s.id) === String(a).trim()) || A.R().steer[A.R().steer.length - 1]; if (!v) throw new Error('no steering vector'); u = new Float32Array(d); for (const x of v.vecs) if (x.length === d) for (let i = 0; i < d; i++) u[i] += x[i]; }
    else if (src === 'tok') { const ea = C.embedOf(W, tokId(tok, a)), eb = C.embedOf(W, tokId(tok, b)); u = Float32Array.from(ea, (x, i) => x - eb[i]); }
    else if (src === 'neuron') { const [l, n] = String(a).split(',').map(Number); if (!(l >= 0 && l < L && n >= 0 && n < ff)) throw new Error('neuron source needs L,N'); u = new Float32Array(d); for (let i = 0; i < d; i++) u[i] = W.layers[l].proj[i * ff + n]; }
    else if (src === 'sae') { const s = A.sae(); if (!s) throw new Error('no SAE trained'); const f = +a; if (!(f >= 0 && f < s.m)) throw new Error('feature out of range'); u = Float32Array.from(s.Wdec.subarray(f * d, f * d + d)); }
    else { let x = (+a || 1) | 0; const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647; u = Float32Array.from({ length: d }, () => rnd() - 0.5); }
    const nn = Math.hypot(...u); if (!nn) throw new Error('zero direction'); return u.map((x) => x / nn); };
  const mapDir = (u, site, l, h) => { const P = A.M().layers[l];
    if (site === 'q' || site === 'k' || site === 'v') { const M = P[site], o = new Float32Array(d); for (let i = 0; i < d; i++) { let s = 0; for (let j = 0; j < d; j++) s += M[i * d + j] * u[j]; o[i] = s; } return o; }
    if (site === 'z') { const o = new Float32Array(d); for (let i = 0; i < d; i++) { const ui = u[i]; for (let j = 0; j < d; j++) o[j] += P.o[i * d + j] * ui; } return o; } return Float32Array.from(u); };
  out.addOp = (o = {}) => { const site = o.site || $('xKsite').value, hv = o.head ?? $('xKh').value, head = hv === '' || hv == null ? null : +hv, op = o.op || $('xKop').value, coef = +(o.coef ?? $('xKc').value), layers = parseLayers(o.layers || $('xKl').value), u = o.u || out.direction();
    if (head != null && !(head >= 0 && head < H)) throw new Error('head 0..15');
    const vecs = Array.from({ length: L }, (_, l) => { const v = mapDir(u, site, l, head); if (head != null) for (let j = 0; j < d; j++) if (Math.floor(j / hd) !== head) v[j] = 0; const nv = Math.hypot(...v) || 1; return v.map((x) => x / nv); });
    const name = o.name || `${op} ${o.src || $('xKs').value} @${site}${head != null ? ' H' + head : ''}`, tk = o.tkind || $('xKt').value, T = +(o.T ?? $('xKT').value);
    A.commit(`steer + ${name}`, () => A.R().steer.push({ id: A.nextVecId(), name, site, vecs, coef, sched: Array.from({ length: L }, (_, l) => (layers.has(l) ? 1 : 0)), mask: { kind: o.mask || $('xKm').value, a: 0, b: 0 }, on: true, op, head, tsched: { kind: tk, T } }));
    $('xKInfo').textContent = `added "${name}" (coef ${coef}, layers ${[...layers].join(',')}, schedule ${tk} T=${T})`; return name; };
  on('xKgo', 'click', () => out.addOp());
  out.logitBias = (s) => { const tok = A.tok(), B = {}; for (const part of String(s ?? $('xKlb').value).split(',').map((x) => x.trim()).filter(Boolean)) { const m = part.match(/^(.*):\s*([+-]?[0-9.]+)$/); if (!m) throw new Error('bad item ' + part); const t = m[1].trim(); B[tokId(tok, ' ' + t)] = +m[2]; }
    A.commit(`logit bias (${Object.keys(B).length})`, () => (A.R().logitBias = B)); $('xKInfo').textContent = `logit bias: ${Object.entries(B).map(([k, v]) => `"${tstr(+k)}" ${v}`).join(', ') || 'none'}`; return B; };
  on('xKlbGo', 'click', () => out.logitBias());
  out.hsteer = (t, c) => { const tok = A.tok(), id = tokId(tok, t ?? $('xKhT').value), u = Float32Array.from(C.embedOf(A.M(), id)), n = Math.hypot(...u) || 1, coef = +(c ?? $('xKhC').value);
    A.commit(`h-steer "${tstr(id)}" ${coef}`, () => (A.R().hSteer = [...(A.R().hSteer || []), { vec: Array.from(u, (x) => x / n), coef, on: true, tok: id }])); return id; };
  on('xKhGo', 'click', () => out.hsteer()); on('xKclr', 'click', () => A.commit('clear logit controls', () => { A.R().logitBias = {}; A.R().hSteer = []; }));
}

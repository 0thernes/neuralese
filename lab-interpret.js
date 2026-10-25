// INTERPRET group: attention grid/rollout/head classes, residual geometry, circuit graph, neuron atlas, embeddings, SAE dashboard.
import * as C from './labcore.js?v=7';
import { logSoftmax, topK, entropy } from './engine.js?v=7';
import { dla } from './analysis.js?v=7';
import { CORPUS } from './corpus.js?v=7';
import { allDocs } from './dataset.js?v=7';
import { heatmap, lines, bars, scatter, showTip, seqColor } from './charts.js?v=7';
import { $, esc, fmt, opts, lOpts, XB, cv, tipq, pal, PAL, prog, svgEl, tick, tokId, canvasFit, d, H, L, ff, V } from './lab-ui.js?v=7';
const IOI = 'When Mary and John went to the store, John gave a drink to';
export const markup = {
  attn: ['ATTENTION', 'Attention patterns', `<fieldset><legend>input</legend><div class="r"><input id="xAP" style="flex:1" value="${IOI}"/><button class="pri" id="xA">run</button></div><div id="xAInfo" class="sm"></div></fieldset>
<fieldset><legend>all heads (rows = slots, cols = heads) — click a tile</legend>${cv('xAGrid', 'attention patterns')}${cv('xAOne', 'selected head (query × key)')}</fieldset>
<fieldset><legend>rollout &amp; flow ${tipq('Abnar & Zuidema (2020) rollout: per slot Â = ½·mean_h(A) + ½·I, multiplied through the stack. Approximates how much each input token can reach each position.')}</legend>${cv('xARoll', 'attention rollout (query × key)')}${cv('xAFlow', 'last-token rollout per source token')}</fieldset>
<fieldset><legend>head classification ${tipq('prev = mean attn(t→t−1) on the text; induction = attn(n+i → i+1) and duplicate = attn(n+i → i) on a repeated random-token sequence; sink = attn(t→0). Label = argmax if ≥0.3, else diffuse (normalised entropy >0.7) or mixed.')}</legend><div class="r"><label>metric</label><select id="xHSm">${opts(['label', 'prev', 'induction', 'duplicate', 'sink', 'entropy'])}</select><button id="xHS">score heads</button></div>${cv('xHSC', 'head scores (slots × heads)')}<div id="xHSLeg" class="sm"></div></fieldset>`],
  resid: ['RESIDUAL', 'Residual stream', `<fieldset><legend>input</legend><div class="r"><input id="xRP" style="flex:1" value="Once upon a time, there was a little girl named Lily. She loved to"/><button class="pri" id="xR">run</button></div></fieldset>
${cv('xRN', '‖residual‖ (tokens × [embed, slot outputs])')}${cv('xRC', 'cosine similarity between slots (mean over tokens)')}
<fieldset><legend>PCA token trajectories ${tipq('PCA over all (token, slot) residual vectors; each grey line is one token moving through the stack; dot colour = slot (grey = embedding).')}</legend><div class="r"><label>axes</label><select id="xRAx">${opts([['0,1', 'PC1/PC2'], ['1,2', 'PC2/PC3'], ['0,2', 'PC1/PC3']])}</select><span id="xRInfo" class="sm"></span></div>${cv('xRPca', 'trajectories')}</fieldset>`],
  circuit: ['CIRCUIT', 'Circuit graph', `<fieldset><legend>attribution circuit ${tipq('Nodes = top heads (circles) and MLPs (boxes) by direct logit attribution to the target at the last position. Edges = Elhage et al. Q/K/V composition scores between earlier and later heads computed from the weights (LayerNorm ignored).')}</legend>
<div class="r"><input id="xCP" style="flex:1" value="${IOI}"/></div><div class="r"><label>target</label><input id="xCT" placeholder="top-1" style="width:90px"/><label>heads</label><input type="number" id="xCN" value="14"/><label>edge ≥</label><input type="number" id="xCE" value="0.12" step="0.01"/><button class="pri" id="xC">build</button>${XB('xCSvg', 'svg')}</div><div id="xCInfo" class="sm"></div><div id="xCSvg" class="svgbox"></div></fieldset>`],
  neurons: ['NEURONS', 'Neuron atlas', `<fieldset><legend>neuron atlas ${tipq('Runs the current weights over corpus tokens and records all MLP neurons of one layer. Polysemanticity = exp(entropy of token identities among its top-k activations): 1 = monosemantic token detector.')}</legend><div class="r"><label>layer</label><select id="xNL">${lOpts(3)}</select><label>tokens</label><input type="number" id="xNN" value="400"/><label>colour</label><select id="xNm">${opts(['max', 'freq', 'poly', 'mean'])}</select><button class="pri" id="xN">build atlas</button><div class="prog" id="xNP"><i></i></div></div>
${cv('xNGrid', '1024 neurons as 32×32 — click one')}${cv('xNSc', 'firing frequency (x) vs polysemanticity (y)')}<div id="xNOne" class="sm"></div></fieldset>`],
  embed: ['EMBED', 'Embedding space', `<fieldset><legend>token search &amp; nearest neighbours (cosine, current wte)</legend><div class="r"><input id="xEQ" value=" dog" style="width:120px"/><label>k</label><input type="number" id="xEK" value="12"/><button class="pri" id="xE">search</button></div><div id="xERes" class="sm"></div>${cv('xEG', 'kNN graph (query, neighbours, 2nd hop) in local PCA')}</fieldset>
<fieldset><legend>embedding map</legend><div class="r"><label>sample</label><input type="number" id="xES" value="1500"/><button id="xEM">project</button><span class="sm" id="xEMI"></span></div>${cv('xEMap', 'PCA of token embeddings (corpus tokens first); query + neighbours in amber')}</fieldset>`],
  saed: ['SAE DASH', 'SAE feature dashboard', `<fieldset><legend>SAE feature dashboard ${tipq('Requires an SAE trained in the SAE tab. Densities encode every cached corpus residual at the SAE layer.')}</legend><div class="r"><button class="pri" id="xS">compute densities</button><label>feature</label><input type="number" id="xSF" value="0"/><button id="xSOne">inspect</button></div><div id="xSInfo" class="sm"></div>
${cv('xSDen', 'feature density histogram (log10 firing frequency)')}${cv('xSAct', 'non-zero activation histogram of the selected feature')}<div id="xSTop" class="sm"></div></fieldset>`],
};

export function install(A, out) {
  const on = A.on, tstr = (id) => JSON.stringify(A.tok().tokenStr(id)).slice(1, -1);
  // ATTENTION
  let AT = null;
  const drawOne = (s, h) => { const T = AT.ids.length, M = Array.from({ length: T }, (_, q) => Array.from({ length: T }, (_, k) => AT.tr[q].pattern[s]?.[h]?.[k] ?? 0)), lab = AT.ids.map(tstr);
    heatmap($('xAOne'), M, { rows: lab, cols: lab, diverging: false, max: 1, padL: 70, label: (i, j) => `slot ${s} H${h}: "${lab[i]}" → "${lab[j]}" = ${M[i][j].toFixed(4)}` }); };
  out.attn = () => { const eng = A.eng(), ids = A.tok().encode($('xAP').value).slice(0, 48); if (ids.length < 2) throw new Error('need at least 2 tokens'); const tr = eng.run(ids, { trace: true }).traces, slots = eng.R.program.length, T = ids.length; AT = { ids, tr };
    const cvs = $('xAGrid'), w0 = cvs.clientWidth || 420, tile = Math.max(6, Math.floor((w0 - 20) / H)), [c, w] = canvasFit(cvs, tile * slots + 4); c.fillStyle = '#000'; c.fillRect(0, 0, w, tile * slots + 4);
    const cell = (tile - 2) / T; for (let s = 0; s < slots; s++) for (let h = 0; h < H; h++) { const x0 = 18 + h * tile, y0 = s * tile; for (let q = 0; q < T; q++) for (let k = 0; k <= q; k++) { const v = tr[q].pattern[s]?.[h]?.[k] ?? 0; if (v < 0.02) continue; c.fillStyle = seqColor(Math.sqrt(v)); c.fillRect(x0 + k * cell, y0 + q * cell, Math.max(1, cell), Math.max(1, cell)); } }
    c.fillStyle = '#7d8aa6'; c.font = '9px monospace'; for (let s = 0; s < slots; s++) c.fillText(String(eng.R.program[s].layer), 2, s * tile + tile / 2 + 3);
    cvs._csv = () => ['slot,head,query,key,weight', ...tr.flatMap((t, q) => t.pattern.flatMap((ps, s) => (ps || []).flatMap((p, h) => Array.from(p, (v, k) => `${s},${h},${q},${k},${v}`))))].join('\n');
    const at = (e) => { const r = cvs.getBoundingClientRect(), h = Math.floor((e.clientX - r.left - 18) / tile), s = Math.floor((e.clientY - r.top) / tile); return h >= 0 && h < H && s >= 0 && s < slots ? [s, h] : null; };
    cvs.onclick = (e) => { const p = at(e); if (p) { drawOne(p[0], p[1]); A.setSel({ l: eng.R.program[p[0]].layer, h: p[1] }); } };
    cvs.onmousemove = (e) => { const p = at(e); showTip(e, p ? `slot ${p[0]} (L${eng.R.program[p[0]].layer}) head ${p[1]} — click to enlarge` : ''); }; cvs.onmouseleave = () => showTip(null, '');
    const sel = A.S().sel, s0 = Math.max(0, eng.R.program.findIndex((p) => p.layer === (sel.l ?? 0))); drawOne(s0, sel.h ?? 0);
    const ro = C.attentionRollout(tr, slots), lab = ids.map(tstr); heatmap($('xARoll'), ro.map((r) => Array.from(r)), { rows: lab, cols: lab, diverging: false, padL: 70, label: (i, j) => `rollout "${lab[i]}" ← "${lab[j]}" ${ro[i][j].toFixed(4)}` });
    bars($('xAFlow'), Array.from(ro[T - 1]), { label: (i) => `"${lab[i]}" ${ro[T - 1][i].toFixed(4)}` });
    let ent = 0, n = 0; for (let s = 0; s < slots; s++) for (let h = 0; h < H; h++) { const p = tr[T - 1].pattern[s]?.[h]; if (p) { let e = 0; for (const x of p) if (x > 0) e -= x * Math.log(x); ent += e; n++; } }
    $('xAInfo').textContent = `${T} tokens · ${slots} slots · mean last-token head entropy ${(ent / (n || 1)).toFixed(3)} nats (uniform = ln T = ${Math.log(T).toFixed(2)})`; return ro; };
  on('xA', 'click', out.attn);
  let HS = null; const CL = { 'previous-token': '#60a5fa', induction: '#f472b6', 'duplicate-token': '#fbbf24', 'positional/sink': '#4ade80', diffuse: '#334155', mixed: '#64748b' };
  const drawHS = () => { if (!HS) return; const m = $('xHSm').value, cvs = $('xHSC');
    if (m === 'label') { const w0 = cvs.clientWidth || 420, tile = (w0 - 20) / H, [c] = canvasFit(cvs, tile * HS.length);
      HS.forEach((row, s) => row.forEach((sc, h) => { c.fillStyle = CL[sc.label]; c.fillRect(18 + h * tile, s * tile, tile - 2, tile - 2); })); c.fillStyle = '#7d8aa6'; c.font = '9px monospace'; HS.forEach((row, s) => c.fillText(String(row[0].layer), 2, s * tile + tile / 2 + 3));
      const at = (e) => { const r = cvs.getBoundingClientRect(), h = Math.floor((e.clientX - r.left - 18) / tile), s = Math.floor((e.clientY - r.top) / tile); return HS[s]?.[h] ? [s, h] : null; };
      cvs.onmousemove = (e) => { const p = at(e), sc = p && HS[p[0]][p[1]]; showTip(e, sc ? `L${sc.layer}H${p[1]}: ${sc.label}\nprev ${sc.prev.toFixed(3)} · induction ${sc.induction.toFixed(3)} · dup ${sc.duplicate.toFixed(3)} · sink ${sc.sink.toFixed(3)} · entropy ${sc.entropy.toFixed(3)}` : ''); };
      cvs.onclick = (e) => { const p = at(e); if (p) A.setSel({ l: HS[p[0]][p[1]].layer, h: p[1] }); };
      cvs._csv = () => ['slot,layer,head,label,prev,induction,duplicate,sink,entropy', ...HS.flatMap((row, s) => row.map((x, h) => [s, x.layer, h, x.label, x.prev, x.induction, x.duplicate, x.sink, x.entropy].join(',')))].join('\n');
    } else heatmap(cvs, HS.map((r) => r.map((x) => x[m])), { diverging: false, rows: HS.map((r) => 'L' + r[0].layer), label: (s, h) => `L${HS[s][h].layer}H${h} ${m} = ${HS[s][h][m].toFixed(4)} (${HS[s][h].label})`, onClick: (s, h) => A.setSel({ l: HS[s][h].layer, h }) });
    const cnt = {}; HS.flat().forEach((x) => (cnt[x.label] = (cnt[x.label] || 0) + 1)); $('xHSLeg').innerHTML = Object.entries(CL).map(([k, c]) => `<span style="color:${c}">■</span> ${k} ${cnt[k] || 0}`).join(' · '); };
  out.heads = () => { HS = C.headScores(A.eng(), A.tok().encode($('xAP').value + ' Once upon a time, there was a little girl named Lily. She loved to play with her ball in the park.')); drawHS(); return HS; };
  on('xHS', 'click', out.heads); on('xHSm', 'change', drawHS);

  // RESIDUAL
  let RS = null;
  const drawPca = () => { if (!RS) return; const [a, b] = $('xRAx').value.split(',').map(Number), { P, T, S, lab } = RS, pts = [], lns = [];
    for (let t = 0; t < T; t++) { const traj = []; for (let s = 0; s <= S; s++) { const p = P.proj[t * (S + 1) + s]; pts.push({ x: p[a], y: p[b], c: s === 0 ? '#94a3b8' : pal(s - 1), r: s === S ? 3.5 : 2, label: `"${lab[t]}" ${s === 0 ? 'embedding' : 'after slot ' + (s - 1)}`, text: s === S && T <= 24 ? lab[t] : '' }); traj.push([p[a], p[b]]); } lns.push({ pts: traj, color: '#47556966' }); }
    scatter($('xRPca'), pts, { lines: lns, h: 320 }); $('xRInfo').textContent = `explained variance PC1 ${(100 * P.explained[0]).toFixed(1)}% · PC2 ${(100 * P.explained[1]).toFixed(1)}% · PC3 ${(100 * P.explained[2]).toFixed(1)}%`; };
  out.resid = () => { const eng = A.eng(), ids = A.tok().encode($('xRP').value).slice(0, 64), tr = eng.run(ids, { trace: true }).traces, S = eng.R.program.length, T = ids.length, lab = ids.map(tstr), nm = ['emb', ...[...Array(S).keys()].map((s) => 's' + s)];
    const vecs = tr.map((t) => [t.embed, ...t.resid_post]); heatmap($('xRN'), vecs.map((v) => v.map((x) => Math.hypot(...x))), { rows: lab, cols: nm, diverging: false, padL: 70 });
    const cs = Array.from({ length: S + 1 }, () => new Array(S + 1).fill(0)); for (const v of vecs) { const m = C.cosineMatrix(v); for (let i = 0; i <= S; i++) for (let j = 0; j <= S; j++) cs[i][j] += m[i][j] / T; }
    heatmap($('xRC'), cs, { rows: nm, cols: nm, max: 1 });
    const Xf = new Float32Array(T * (S + 1) * d); vecs.forEach((v, t) => v.forEach((x, s) => Xf.set(x, (t * (S + 1) + s) * d))); RS = { P: C.pcaK(Xf, T * (S + 1), d, 3), T, S, lab }; drawPca(); return RS; };
  on('xR', 'click', out.resid); on('xRAx', 'change', drawPca);

  // CIRCUIT
  out.circuit = () => { const eng = A.eng(), tok = A.tok(), W = A.M(), ids = tok.encode($('xCP').value); if (!ids.length) throw new Error('empty prompt'); const run = eng.run(ids, { trace: true }), tr = run.traces[ids.length - 1], lp = logSoftmax(eng.outLogits(run.last.h));
    const tgt = $('xCT').value ? tokId(tok, $('xCT').value) : topK(lp, 1)[0], r = dla(eng, tr, tgt), N = Math.max(4, Math.min(40, +$('xCN').value || 14)), thr = +$('xCE').value || 0.1;
    const heads = r.heads.slice(0, N), mlpBy = new Map(); for (const n of r.neurons) mlpBy.set(n.slot, (mlpBy.get(n.slot) || 0) + n.v);
    const mlps = [...mlpBy].map(([slot, v]) => ({ slot, l: eng.R.program[slot].layer, v })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 4);
    const nodes = [...heads.map((n) => ({ k: `${n.slot}.${n.h}`, ...n, type: 'head' })), ...mlps.map((m) => ({ k: `m${m.slot}`, ...m, type: 'mlp' }))], maxV = Math.max(1e-9, ...nodes.map((n) => Math.abs(n.v)));
    const S = eng.R.program.length, w = 440, rowH = 54, h = S * rowH + 90, pos = new Map(), bySlot = {}; nodes.forEach((n) => (bySlot[n.slot] = bySlot[n.slot] || []).push(n));
    for (const s in bySlot) bySlot[s].forEach((n, i, arr) => pos.set(n.k, [50 + ((i + 0.5) * (w - 70)) / arr.length, h - 40 - +s * rowH]));
    const fac = new Map(), F = (l, hh) => { const k = l * H + hh; if (!fac.has(k)) fac.set(k, C.headFactors(W, l, hh)); return fac.get(k); }, edges = [], hn = nodes.filter((n) => n.type === 'head');
    for (const a of hn) for (const b of hn) if (a.slot < b.slot) { const cs = C.compositionScores(W, F(a.l, a.h), F(b.l, b.h)), best = Object.entries(cs).sort((x, y) => y[1] - x[1])[0]; if (best[1] >= thr) edges.push({ a, b, type: best[0], v: best[1], cs }); }
    const ec = { q: '#60a5fa', k: '#f472b6', v: '#fbbf24' }; let g = '';
    for (let s = 0; s < S; s++) g += `<text x="2" y="${h - 36 - s * rowH}" class="t2">s${s}·L${eng.R.program[s].layer}</text><line x1="40" x2="${w}" y1="${h - 40 - s * rowH}" y2="${h - 40 - s * rowH}" stroke="#334155" stroke-dasharray="2 4"/>`;
    const lx = w / 2, ly = 22; for (const n of nodes) { const [x, y] = pos.get(n.k); g += `<line x1="${x}" y1="${y}" x2="${lx}" y2="${ly}" stroke="${n.v >= 0 ? '#5eead4' : '#f87171'}" stroke-width="${(0.5 + (3 * Math.abs(n.v)) / maxV).toFixed(2)}" opacity=".22"/>`; }
    for (const e of edges) { const [x1, y1] = pos.get(e.a.k), [x2, y2] = pos.get(e.b.k); g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ec[e.type]}" stroke-width="${(1 + 6 * e.v).toFixed(2)}" opacity=".6"><title>${e.type.toUpperCase()}-composition L${e.a.l}H${e.a.h} → L${e.b.l}H${e.b.h}: q ${e.cs.q.toFixed(3)} k ${e.cs.k.toFixed(3)} v ${e.cs.v.toFixed(3)}</title></line>`; }
    for (const n of nodes) { const [x, y] = pos.get(n.k), rr = 5 + (13 * Math.abs(n.v)) / maxV; g += n.type === 'head' ? `<circle cx="${x}" cy="${y}" r="${rr}" fill="${n.v >= 0 ? '#0f3b37' : '#4a1d1d'}" stroke="${n.v >= 0 ? '#5eead4' : '#f87171'}" data-l="${n.l}" data-h="${n.h}" class="clk"><title>L${n.l}H${n.h} DLA ${n.v.toFixed(4)}</title></circle><text x="${x - 14}" y="${y + rr + 10}" class="t2">L${n.l}H${n.h}</text>` : `<rect x="${x - rr}" y="${y - rr / 2}" width="${2 * rr}" height="${rr}" fill="#22162e" stroke="#a78bfa"><title>MLP L${n.l} DLA ${n.v.toFixed(4)}</title></rect><text x="${x - 14}" y="${y + rr + 6}" class="t2">MLP${n.l}</text>`; }
    g += `<rect x="${lx - 80}" y="4" width="160" height="26" rx="4" fill="#14213a" stroke="#5eead4"/><text x="${lx - 72}" y="21" class="t1">logit "${esc(tstr(tgt))}"</text>`;
    const s = svgEl($('xCSvg'), w, h, `<style>.t1{font:600 11px monospace;fill:#e2e8f0}.t2{font:9px monospace;fill:#94a3b8}.clk{cursor:pointer}</style><rect width="${w}" height="${h}" fill="#0b1020"/>${g}`);
    s.querySelectorAll('[data-h]').forEach((e) => e.addEventListener('click', () => A.setSel({ l: +e.dataset.l, h: +e.dataset.h })));
    $('xCInfo').innerHTML = `target "${esc(tstr(tgt))}" p=${Math.exp(lp[tgt]).toFixed(4)} · Σ DLA = ${r.total.toFixed(3)} · ${nodes.length} nodes · ${edges.length} composition edges ≥ ${thr} (<span style="color:#60a5fa">Q</span>/<span style="color:#f472b6">K</span>/<span style="color:#fbbf24">V</span>) · size ∝ |DLA|; teal promotes, red suppresses`; return { nodes, edges, tgt }; };
  on('xC', 'click', out.circuit);

  // NEURONS
  let NA = null;
  const showN = (j) => { const n = NA.neurons[j], W = A.M(), P = W.layers[NA.l], u = new Float32Array(d); for (let i = 0; i < d; i++) u[i] = P.proj[i * ff + j] * W.lnfW[i]; const lg = A.eng().logits(u), tok = A.tok();
    $('xNOne').innerHTML = `<b>L${NA.l}N${j}</b> max ${n.max.toFixed(3)} · fires on ${(100 * n.freq).toFixed(1)}% · polysemanticity ${n.poly.toFixed(2)}<br>top activations:<br>${n.top.slice(0, 10).map((t) => { const doc = CORPUS[t.doc]; return `<span class="ok">${t.a.toFixed(2)}</span> …${esc(tok.decode(doc.slice(Math.max(0, t.pos - 8), t.pos)))}<b class="hl">${esc(tstr(t.id))}</b>${esc(tok.decode(doc.slice(t.pos + 1, t.pos + 3)))}`; }).join('<br>')}<br>w_out·W_U promotes: ${topK(lg, 8).map((i) => esc(tstr(i))).join(' · ')}<br>suppresses: ${topK(lg.map((x) => -x), 6).map((i) => esc(tstr(i))).join(' · ')}`;
    A.setSel({ l: NA.l, n: j }); };
  const drawN = () => { if (!NA) return; const m = $('xNm').value, vals = NA.neurons.map((n) => n[m]), mx = Math.max(...vals.map(Math.abs)) || 1, grid = []; for (let i = 0; i < 32; i++) grid.push(vals.slice(i * 32, i * 32 + 32));
    heatmap($('xNGrid'), grid, { diverging: m === 'mean', max: mx, padL: 4, padT: 4, h: 260, label: (i, j) => { const n = NA.neurons[i * 32 + j]; return `L${NA.l}N${n.n} max ${n.max.toFixed(3)} mean ${n.mean.toFixed(3)} freq ${(100 * n.freq).toFixed(1)}% poly ${n.poly.toFixed(2)}`; }, onClick: (i, j) => showN(i * 32 + j) });
    const mxa = Math.max(...NA.neurons.map((n) => n.max)) || 1; scatter($('xNSc'), NA.neurons.map((n) => ({ x: n.freq, y: n.poly, c: seqColor(n.max / mxa), r: 2, label: `N${n.n} freq ${(100 * n.freq).toFixed(1)}% poly ${n.poly.toFixed(2)} max ${n.max.toFixed(2)}`, n: n.n })), { h: 200, onClick: (p) => showN(p.n) }); };
  out.neurons = async (l0, N0) => { if (l0 != null) $('xNL').value = l0; NA = await C.neuronAtlas(A.M(), CORPUS, +$('xNL').value, Math.max(32, Math.min(2000, +(N0 ?? $('xNN').value) || 400)), 16, (f) => prog('xNP', f)); drawN(); return NA; };
  on('xN', 'click', () => out.neurons()); on('xNm', 'change', drawN);

  // EMBED
  let EM = null, MAP = null;
  const drawMap = () => { const hl = new Set(EM ? [EM.id, ...EM.nn.map((x) => x[0])] : []); scatter($('xEMap'), MAP.ids.map((t, i) => ({ x: MAP.P.proj[i][0], y: MAP.P.proj[i][1], c: hl.has(t) ? '#fbbf24' : '#5eead455', r: hl.has(t) ? 4 : 1.5, text: hl.has(t) ? tstr(t) : '', label: `"${tstr(t)}" id ${t}` })), { h: 320 }); };
  out.embed = (q) => { if (q != null) $('xEQ').value = q; const tok = A.tok(), W = A.M(), id = tokId(tok, $('xEQ').value), k = Math.max(2, Math.min(40, +$('xEK').value || 12)), nn = C.nearestTokens(W, C.embedOf(W, id), k, id);
    $('xERes').innerHTML = `"${esc(tstr(id))}" (id ${id}, ‖e‖ ${C.embedNorms(W)[id].toFixed(3)}) → ` + nn.map(([i, s]) => `${esc(tstr(i))} <span class="sm">${s.toFixed(3)}</span>`).join(' · ');
    const set = new Map([[id, 0]]); nn.forEach(([i]) => set.set(i, 1)); const edges = nn.map(([i, s]) => [id, i, s]); for (const [i] of nn.slice(0, 6)) for (const [j, s] of C.nearestTokens(W, C.embedOf(W, i), 4, i)) { if (!set.has(j)) set.set(j, 2); edges.push([i, j, s]); }
    const ids = [...set.keys()], Xf = new Float32Array(ids.length * d); ids.forEach((t, i) => Xf.set(C.embedOf(W, t), i * d)); const P = C.pcaK(Xf, ids.length, d, 2), at = new Map(ids.map((t, i) => [t, P.proj[i]]));
    scatter($('xEG'), ids.map((t) => ({ x: at.get(t)[0], y: at.get(t)[1], c: ['#fbbf24', '#5eead4', '#64748b'][set.get(t)], r: set.get(t) ? 3 : 5, text: tstr(t), label: `"${tstr(t)}" id ${t}` })), { h: 300, lines: edges.map(([a, b]) => ({ pts: [at.get(a), at.get(b)], color: '#47556999' })) });
    EM = { id, nn }; if (MAP) drawMap(); return nn; };
  out.embmap = () => { const n = Math.max(100, Math.min(5000, +$('xES').value || 1500)), W = A.M(), seen = new Set(); for (const doc of CORPUS) for (const t of doc) if (seen.size < n) seen.add(t); for (let t = 0; seen.size < n && t < V; t++) seen.add(t);
    const ids = [...seen], Xf = new Float32Array(ids.length * d); ids.forEach((t, i) => Xf.set(C.embedOf(W, t), i * d)); const P = C.pcaK(Xf, ids.length, d, 2, 40); MAP = { ids, P }; $('xEMI').textContent = `${ids.length} tokens · PC1 ${(100 * P.explained[0]).toFixed(1)}% · PC2 ${(100 * P.explained[1]).toFixed(1)}%`; drawMap(); return MAP; };
  on('xE', 'click', () => out.embed()); on('xEM', 'click', out.embmap);

  // SAE dashboard
  const need = () => { const sae = A.sae(), st = A.stats(); if (!sae || !st) throw new Error('train an SAE in the SAE tab first'); return [sae, st]; };
  out.saed = async () => { const [sae, st] = need(), X0 = st.resid[sae.layer], N = st.N, m = sae.m, cnt = new Float64Array(m), code = new Float32Array(m);
    for (let i = 0; i < N; i++) { sae.encode(X0.subarray(i * d, i * d + d), code); for (let f = 0; f < m; f++) if (code[f] > 0) cnt[f]++; if (i % 256 === 0) await tick(); }
    const lf = Array.from(cnt, (c) => Math.log10(Math.max(c, 0.5) / N)), hg = C.histogram(lf, 40); bars($('xSDen'), hg.counts, { label: (i) => `log10 freq ∈ [${hg.edges[i].toFixed(2)}, ${hg.edges[i + 1].toFixed(2)}): ${hg.counts[i]} features` });
    const arr = Array.from(cnt); $('xSInfo').textContent = `layer ${sae.layer} · ${m} features · mean L0 ${(arr.reduce((a, b) => a + b, 0) / N).toFixed(1)} · dead ${arr.filter((c) => c === 0).length} · dense (>10%) ${arr.filter((c) => c / N > 0.1).length}`; return arr; };
  out.saeOne = (f0) => { const [sae, st] = need(); if (f0 != null) $('xSF').value = f0; const f = Math.max(0, Math.min(sae.m - 1, +$('xSF').value || 0)), X0 = st.resid[sae.layer], code = new Float32Array(sae.m), vals = [];
    for (let i = 0; i < st.N; i++) { sae.encode(X0.subarray(i * d, i * d + d), code); if (code[f] > 0) vals.push([code[f], i]); }
    vals.sort((a, b) => b[0] - a[0]); const hg = C.histogram(vals.length ? vals.map((v) => v[0]) : [0], 40); bars($('xSAct'), hg.counts, { label: (i) => `act ∈ [${hg.edges[i].toFixed(3)}, ${hg.edges[i + 1].toFixed(3)}): ${hg.counts[i]}` });
    const W = A.M(), u = new Float32Array(d); for (let i = 0; i < d; i++) u[i] = sae.Wdec[f * d + i] * W.lnfW[i]; const lg = A.eng().logits(u), tok = A.tok();
    $('xSTop').innerHTML = `<b>feature ${f}</b> fires on ${vals.length}/${st.N} tokens (${((100 * vals.length) / st.N).toFixed(2)}%)<br>${vals.slice(0, 8).map(([a, i]) => { const c = st.context(i, 8); return `<span class="ok">${a.toFixed(2)}</span> ${esc(tok.decode(c.before))}<b class="hl">${esc(tok.tokenStr(c.tok))}</b>${esc(tok.decode(c.after))}`; }).join('<br>')}<br>decoder·W_U promotes: ${topK(lg, 8).map((i) => esc(tstr(i))).join(' · ')}<br>suppresses: ${topK(lg.map((x) => -x), 6).map((i) => esc(tstr(i))).join(' · ')}`; return vals.length; };
  on('xS', 'click', out.saed); on('xSOne', 'click', () => out.saeOne());
}

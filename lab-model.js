// MODEL group: architecture schematic, parameter/FLOP breakdown, weight statistics (live tensors).
import * as C from './labcore.js?v=13';
import { getMat, MATS } from './surgery.js?v=13';
import { CFG } from './model.js?v=13';
import { heatmap, lines, bars, scatter } from './charts.js?v=13';
import { $, esc, fmt, human, opts, lOpts, hOpts, XB, cv, tipq, pal, prog, svgEl, tick, d, H, hd, L, V } from './lab-ui.js?v=13';

export const markup = {
  arch: ['ARCH', 'Architecture schematic', `<fieldset><legend>architecture schematic ${tipq('Generated from the live weights and the runtime layer program: duplicated, reordered or skipped slots appear here. Click a block to select that layer.')}</legend><div class="r"><button class="pri" id="xArch">render</button><span class="sm" id="xArchInfo"></span>${XB('xArchSvg', 'svg')}</div><div id="xArchSvg" class="svgbox"></div></fieldset><fieldset><legend>config</legend><div id="xCfg" class="sm"></div></fieldset>`],
  params: ['PARAMS', 'Parameters & FLOPs', `<fieldset><legend>parameter treemap ${tipq('Area ∝ parameter count measured from the tensors. Hover for tensor name and share.')}</legend><div class="r"><button class="pri" id="xPar">compute</button><span id="xParInfo" class="sm"></span>${XB('xTree', 'svg')}${XB('xParTab', 'csv')}</div><div id="xTree" class="svgbox"></div><div id="xParTab" class="scroll"></div></fieldset>
<fieldset><legend>FLOPs per generated token ${tipq('Multiply-add = 2 FLOPs. Attention scores/AV scale with context T (local layers cap at the 256 window). LayerNorm/GELU/softmax omitted (<1%).')}</legend><div class="r"><label>context T</label><input type="number" id="xFlT" value="128" min="1" max="2048"/><button id="xFl">compute</button><span id="xFlInfo" class="sm"></span></div>${cv('xFlC', 'FLOPs per op (log)')}<div id="xFlTab" class="sm"></div></fieldset>`],
  weights: ['WEIGHTS', 'Weight statistics', `<fieldset><legend>matrix</legend><div class="r"><label>layer</label><select id="xWL">${lOpts()}</select><label>matrix</label><select id="xWM">${opts(MATS)}</select><label>head</label><select id="xWH"><option value="">all</option>${hOpts('')}</select><button class="pri" id="xW">analyse</button></div><div id="xWInfo" class="sm"></div>
${cv('xWHist', 'value histogram, log10(1+count): teal original · pink current')}${cv('xWSv', 'singular values (log10): teal original · pink current')}${cv('xWEsd', 'ESD tail rank plot: log10 λ vs log10 rank')}
<div class="two"><div>${cv('xWHm', 'matrix (current, subsampled)')}</div><div>${cv('xWDf', 'Δ = current − original')}</div></div></fieldset>
<fieldset><legend>WeightWatcher-style scan ${tipq('ESD = eigenvalues of WᵀW/N. α from the Clauset–Shalizi–Newman MLE with KS-optimal xmin. Heuristic: α≈2–4 typical of well-trained layers; α>6 random-like; α<2 very heavy-tailed.')}</legend><div class="r"><button id="xWW">scan all ${L * MATS.length} matrices</button><div class="prog" id="xWWP"><i></i></div>${XB('xWWTab', 'csv')}</div>${cv('xWWC', 'α per matrix (click a bar to open it)')}<div id="xWWTab" class="scroll"></div></fieldset>`],
};

export function install(A, out) {
  const on = A.on;
  out.arch = () => { const W = A.M(), R = A.R(), nodes = C.archGraph(W, R), slots = nodes.filter((n) => n.slot != null), w = 430, rowH = 74; let y = 10, g = '';
    const box = (x, y, bw, bh, fill, t1, t2, extra = '') => `<g ${extra}><rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="5" fill="${fill}" stroke="#334155"/><text x="${x + 8}" y="${y + 15}" class="t1">${esc(t1)}</text>${t2 ? `<text x="${x + 8}" y="${y + 29}" class="t2">${esc(t2)}</text>` : ''}</g>`;
    g += box(60, y, 310, 34, '#14213a', `tokens → wte[${V}×${d}] + wpe[${W.wpe.length / d}×${d}]`, `${human(W.wte.length + W.wpe.length)} params`); y += 50;
    g += `<line x1="215" y1="${y - 16}" x2="215" y2="${y + slots.length * rowH}" stroke="#5eead4" stroke-width="3" opacity=".5"/>`;
    for (const s of slots) { g += `<text x="2" y="${y + 33}" class="t2">s${s.slot}</text>`;
      g += box(22, y, 172, 58, s.attn ? '#0f2433' : '#1a1a1a', `L${s.layer} attention ${s.local ? '(local 256)' : '(global)'}`, `${H}×${hd} heads · ${human(s.attnParams)} p`, `data-sel="${s.layer}" class="clk"`);
      g += box(236, y, 172, 58, s.mlp ? '#22162e' : '#1a1a1a', `L${s.layer} MLP ${d}→${W.layers[s.layer].fcb.length}→${d}`, `GELU · ${human(s.mlpParams)} p`, `data-sel="${s.layer}" class="clk"`);
      g += `<text x="30" y="${y + 50}" class="t3">${s.attn ? 'LN·QKV·softmax(QKᵀ)V·O' : 'skipped'}</text><text x="244" y="${y + 50}" class="t3">${s.mlp ? 'LN·fc·GELU·proj' : 'skipped'}</text><circle cx="215" cy="${y + 29}" r="7" fill="#0b1020" stroke="#5eead4"/><text x="211" y="${y + 33}" class="t2">+</text>`; y += rowH; }
    g += box(60, y, 310, 34, '#14213a', `ln_f → wteᵀ unembed [${d}→${V}]`, 'tied weights → logits'); y += 50;
    g += `<text x="6" y="${y}" class="t2">runtime: ${R.steer.filter((v) => v.on).length} steering ops · ${Object.keys(R.logitBias || {}).length} logit biases · ${(R.hSteer || []).length} h-steers · ${A.ed().edits.length} weight edits</text>`;
    const s = svgEl($('xArchSvg'), w, y + 14, `<style>.t1{font:600 11px monospace;fill:#e2e8f0}.t2{font:10px monospace;fill:#94a3b8}.t3{font:9px monospace;fill:#94a3b8}.clk{cursor:pointer}</style><rect width="${w}" height="${y + 14}" fill="#0b1020"/>${g}`);
    s.querySelectorAll('[data-sel]').forEach((e) => e.addEventListener('click', () => A.setSel({ l: +e.dataset.sel })));
    const tot = C.paramBreakdown(W).reduce((a, b) => a + b.count, 0);
    $('xArchInfo').textContent = `${slots.length} slots · ${human(tot)} params (${human(tot - W.wte.length - W.wpe.length)} non-embedding)`;
    $('xCfg').innerHTML = `GPT-Neo · d_model ${d} · ${H} heads × ${hd} · ${L} layers · d_ff ${CFG.ff} · vocab ${V} · context 2048 · global attention on even layers, local window ${CFG.window} on odd · <b>no 1/√d_head score scaling</b> (GPT-Neo convention) · GELU (tanh) · pre-LN, ε=${CFG.eps} · tied embeddings · q/k/v have no bias`; return slots.length; };
  on('xArch', 'click', out.arch);

  out.params = () => { const pb = C.paramBreakdown(A.M()), tot = pb.reduce((a, b) => a + b.count, 0), col = { embed: '#1e3a5f', attn: '#0f3b37', mlp: '#3b1f4a', norm: '#3b3418' }, W0 = 430, H0 = 300; let g = '', x = 0;
    for (const k of ['embed', 'mlp', 'attn', 'norm']) { const items = pb.filter((p) => p.group === k), gs = items.reduce((a, b) => a + b.count, 0); if (!gs) continue; const gw = (gs / tot) * W0; let y = 0;
      for (const it of items) { const ih = (it.count / gs) * H0; g += `<rect x="${x}" y="${y}" width="${gw}" height="${ih}" fill="${col[k]}" stroke="#0b1020" stroke-width=".5"><title>${it.name} [${it.shape.join('×')}] ${it.count.toLocaleString()} (${((100 * it.count) / tot).toFixed(2)}%)</title></rect>`; if (ih > 11 && gw > 40) g += `<text x="${x + 3}" y="${y + 10}" class="t2">${it.name}</text>`; y += ih; }
      if (gw > 30) g += `<text x="${x + 3}" y="${H0 + 14}" class="t1">${k} ${((100 * gs) / tot).toFixed(1)}%</text>`; x += gw; }
    svgEl($('xTree'), W0, H0 + 22, `<style>.t1{font:600 10px monospace;fill:#e2e8f0}.t2{font:8px monospace;fill:#e5e7eb}</style><rect width="${W0}" height="${H0 + 22}" fill="#0b1020"/>${g}`);
    $('xParInfo').textContent = `${tot.toLocaleString()} parameters · wte ${((100 * pb[0].count) / tot).toFixed(1)}%`;
    const rows = pb.map((p) => [p.name, p.group, p.shape.join('×'), p.count]); const t = $('xParTab'); t._csv = () => C.toCSV(rows, ['tensor', 'group', 'shape', 'params']);
    t.innerHTML = `<table><tr><th>tensor</th><th>group</th><th>shape</th><th>params</th></tr>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3].toLocaleString()}</td></tr>`).join('')}</table>`; return tot; };
  on('xPar', 'click', out.params);
  out.flops = (T0) => { const T = Math.max(1, Math.min(2048, +(T0 ?? $('xFlT').value) || 1)), f = C.flopsPerToken(T);
    bars($('xFlC'), f.ops.map((o) => o.f), { log: true, colors: f.ops.map((o) => (o.kind === 'attn' ? '#5eead4' : o.kind === 'mlp' ? '#a78bfa' : '#fbbf24')), label: (i) => `${f.ops[i].op}: ${human(f.ops[i].f)} FLOPs`, title: 'teal attn · violet MLP · amber unembed' });
    const by = {}; for (const o of f.ops) by[o.kind] = (by[o.kind] || 0) + o.f; const tps = A.S().perf.tps || 0;
    $('xFlInfo').textContent = `${human(f.total)} FLOPs/token at T=${T}`; $('xFlTab').innerHTML = Object.entries(by).map(([k, v]) => `${k}: ${human(v)} (${((100 * v) / f.total).toFixed(1)}%)`).join(' · ') + (tps ? ` · at ${tps.toFixed(1)} tok/s ≈ ${human(f.total * tps)} FLOP/s achieved` : ''); return f.total; };
  on('xFl', 'click', () => out.flops());

  const matOf = (W, l, m, h) => { const { a, rows, cols } = getMat(W, `L${l}.${m}`); if (h === '' || h == null) return { a, rows, cols };
    if (m === 'o') { const b = new Float32Array(rows * hd); for (let i = 0; i < rows; i++) for (let j = 0; j < hd; j++) b[i * hd + j] = a[i * cols + h * hd + j]; return { a: b, rows, cols: hd }; }
    if (m === 'q' || m === 'k' || m === 'v') return { a: a.subarray(h * hd * cols, (h + 1) * hd * cols), rows: hd, cols }; return { a, rows, cols }; };
  const sample2d = (a, rows, cols, R = 64, Cc = 96) => { const sr = Math.max(1, Math.ceil(rows / R)), sc = Math.max(1, Math.ceil(cols / Cc)), M = []; for (let i = 0; i < rows; i += sr) { const r = []; for (let j = 0; j < cols; j += sc) r.push(a[i * cols + j]); M.push(r); } return M; };
  out.weights = (l0, m0, h0) => { const l = +(l0 ?? $('xWL').value), m = m0 ?? $('xWM').value, hv = h0 ?? $('xWH').value, h = hv === '' || hv == null ? '' : +hv; $('xWL').value = l; $('xWM').value = m;
    const Wc = matOf(A.M(), l, m, h), Wo = matOf(A.W(), l, m, h), mc = C.moments(Wc.a), mo = C.moments(Wo.a), lo = -Math.max(mo.absmax, mc.absmax), hc = C.histogram(Wc.a, 80, lo, -lo), ho = C.histogram(Wo.a, 80, lo, -lo);
    lines($('xWHist'), [{ ys: ho.counts.map((c) => Math.log10(1 + c)), color: '#5eead4', label: 'original' }, { ys: hc.counts.map((c) => Math.log10(1 + c)), color: '#f472b6', label: 'current' }], { xs: ho.edges.map((e) => e.toFixed(3)) });
    const sc = C.spectral(Wc.a, Wc.rows, Wc.cols), so = C.spectral(Wo.a, Wo.rows, Wo.cols);
    lines($('xWSv'), [{ ys: so.sv.map((s) => Math.log10(s + 1e-12)), color: '#5eead4', label: 'original' }, { ys: sc.sv.map((s) => Math.log10(s + 1e-12)), color: '#f472b6', label: 'current' }]);
    const tail = (S) => S.esd.filter((v) => v >= S.xmin && v > 0).sort((a, b) => b - a);
    scatter($('xWEsd'), [...tail(so).map((v, i) => ({ x: Math.log10(v), y: Math.log10(i + 1), c: '#5eead4', r: 2, label: `original λ=${v.toExponential(2)} rank ${i + 1}` })), ...tail(sc).map((v, i) => ({ x: Math.log10(v), y: Math.log10(i + 1), c: '#f472b6', r: 2, label: `current λ=${v.toExponential(2)} rank ${i + 1}` }))], { h: 180 });
    const df = Float32Array.from(Wc.a, (v, i) => v - Wo.a[i]), dm = sample2d(df, Wc.rows, Wc.cols); let dmax = 0; for (const r of dm) for (const v of r) dmax = Math.max(dmax, Math.abs(v));
    heatmap($('xWHm'), sample2d(Wc.a, Wc.rows, Wc.cols), { padL: 4, padT: 4, h: 160 }); heatmap($('xWDf'), dm, { padL: 4, padT: 4, h: 160, max: dmax || 1e-9 });
    let dn = 0, n0 = 0; for (let i = 0; i < Wc.a.length; i++) { dn += df[i] ** 2; n0 += Wo.a[i] ** 2; }
    $('xWInfo').innerHTML = `L${l}.${m}${h !== '' ? ` head ${h}` : ''} [${Wc.rows}×${Wc.cols}] · std ${fmt(mc.std, 4)} (orig ${fmt(mo.std, 4)}) · kurtosis ${fmt(mc.kurtosis, 2)} · |max| ${fmt(mc.absmax)} · σ₁ ${fmt(sc.spectralNorm)} · stable rank ${fmt(sc.stableRank, 2)} (orig ${fmt(so.stableRank, 2)}) · effective rank ${fmt(sc.effRank, 1)} · α ${fmt(sc.alpha, 2)} (orig ${fmt(so.alpha, 2)}; KS ${fmt(sc.ks, 3)}, tail n=${sc.nTail}) · ‖ΔW‖/‖W‖ ${fmt(Math.sqrt(dn / (n0 || 1)), 4)}`;
    A.setSel({ l, h: h === '' ? null : h }); return sc; };
  on('xW', 'click', () => out.weights());
  out.ww = async () => { const rows = []; let k = 0; for (let l = 0; l < L; l++) for (const m of MATS) { const { a, rows: r, cols } = getMat(A.M(), `L${l}.${m}`); const s = C.spectral(a, r, cols), mm = C.moments(a); rows.push([`L${l}.${m}`, l, m, s.alpha, s.ks, s.stableRank, s.effRank, s.spectralNorm, mm.std, mm.kurtosis]); prog('xWWP', ++k / (L * MATS.length)); await tick(); }
    bars($('xWWC'), rows.map((r) => (isFinite(r[3]) ? r[3] : 0)), { colors: rows.map((r) => pal(r[1])), label: (i) => `${rows[i][0]} α=${fmt(rows[i][3], 2)} · stable rank ${fmt(rows[i][5], 1)}`, onClick: (i) => { A.showTab('weights'); out.weights(rows[i][1], rows[i][2], ''); } });
    const hdr = ['matrix', 'layer', 'mat', 'alpha', 'KS', 'stable_rank', 'eff_rank', 'spectral_norm', 'std', 'kurtosis'], t = $('xWWTab'); t._csv = () => C.toCSV(rows, hdr);
    t.innerHTML = `<table><tr>${hdr.map((x) => `<th>${x}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((v) => `<td>${typeof v === 'number' ? fmt(v, 2) : v}</td>`).join('')}</tr>`).join('')}</table>`;
    const al = rows.map((r) => r[3]).filter(isFinite); A.logRun({ kind: 'weightwatcher', label: 'α scan', metrics: { alpha_mean: al.reduce((a, b) => a + b, 0) / (al.length || 1), alpha_max: Math.max(...al), edits: A.ed().edits.length } }); return rows; };
  on('xWW', 'click', out.ww);
}

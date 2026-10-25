// EVALUATE group: token timeline, calibration, edit impact, profiler, experiment tracker.
import * as C from './labcore.js?v=7';
import { topK } from './engine.js?v=7';
import { CORPUS } from './corpus.js?v=7';
import { lines, bars } from './charts.js?v=7';
import { $, $$, esc, fmt, opts, cv, tipq, PAL, prog, canvasFit, chartBg, exportFor, runs, L } from './lab-ui.js?v=7';

export const markup = {
  timeline: ['TIMELINE', 'Token timeline', `<fieldset><legend>per-token timeline of the last generation ${tipq('Recorded from the raw (pre-filter) distribution of the hacked model at every generated step, including the first generation after load.')}</legend><div class="r"><button class="pri" id="xT">refresh</button><span id="xTInfo" class="sm"></span></div>${cv('xTP', 'p(chosen) teal · top-1 p pink')}${cv('xTH', 'entropy (nats) teal · surprisal −ln p pink')}${cv('xTM', 'top-1 − top-2 probability margin')}</fieldset>`],
  calib: ['CALIBRATION', 'Calibration', `<fieldset><legend>corpus evaluation ${tipq('Teacher-forced next-token predictions on the reference corpus: perplexity = exp(mean NLL), top-1 accuracy, expected calibration error over 10 confidence bins.')}</legend><div class="r"><label>predictions</label><input type="number" id="xQN" value="160"/><button class="pri" id="xQ">evaluate clean + current</button><div class="prog" id="xQP"><i></i></div></div><div id="xQInfo"></div>${cv('xQRel', 'reliability diagram: bars = accuracy per confidence bin (teal clean, pink current); dashed = perfect calibration')}${cv('xQHist', 'confidence histogram')}</fieldset>`],
  impact: ['IMPACT', 'Edit impact', `<fieldset><legend>edit-impact dashboard ${tipq('Clean model (original weights, default runtime) vs the current hacked model on the same input.')}</legend><div class="r"><input id="xIP" style="flex:1" value="Once upon a time, there was a little girl named Lily. She loved to"/><button class="pri" id="xI">measure</button></div><div id="xIInfo"></div>
${cv('xIL', 'logit-lens KL(hacked‖clean) per slot, last token')}${cv('xIPos', 'final-layer KL per position')}${cv('xIS', 'largest probability shifts at the last token')}<div class="two"><div><b>clean (greedy)</b><div id="xIA" class="otext"></div></div><div><b>hacked (greedy)</b><div id="xIB" class="otext"></div></div></div></fieldset>`],
  prof: ['PROFILER', 'Performance profiler', `<fieldset><legend>per-op profiler ${tipq('Wall time between successive engine hooks during real forward steps of the current model, plus final LayerNorm + unembedding.')}</legend><div class="r"><label>tokens</label><input type="number" id="xPN" value="24"/><button class="pri" id="xP">profile</button><span id="xPInfo" class="sm"></span></div>${cv('xPFl', 'flame chart: one row per token, x = time inside the step')}${cv('xPAgg', 'total ms per op')}<div id="xPTab" class="sm"></div></fieldset>`],
  runs: ['RUNS', 'Experiment tracker', `<fieldset><legend>experiment tracker ${tipq('Every calibration, impact, sweep, profile, α-scan and terminal batch is logged here (localStorage). Tick runs to compare.')}</legend><div class="r"><label>metric</label><select id="xRm"></select><button id="xRr">refresh</button><button id="xRcsv">export CSV</button><button id="xRjson">export JSON</button><button class="dan" id="xRclr">clear</button></div>${cv('xRch', 'metric across selected runs')}${cv('xRsw', 'sweep curves (perplexity) of selected runs')}<div id="xRtab" class="scroll"></div></fieldset>`],
};

export function install(A, out) {
  const on = A.on, tstr = (id) => JSON.stringify(A.tok().tokenStr(id)).slice(1, -1);
  out.timeline = () => { const tl = A.S().timeline || []; if (!tl.length) { $('xTInfo').textContent = 'no generation recorded yet'; return []; } const xs = tl.map((r) => tstr(r.id));
    lines($('xTP'), [{ ys: tl.map((r) => r.p), color: '#5eead4', label: 'p(chosen)' }, { ys: tl.map((r) => r.p1), color: '#f472b6', label: 'top-1 p' }], { xs, min: 0, max: 1 });
    lines($('xTH'), [{ ys: tl.map((r) => r.ent), color: '#5eead4', label: 'entropy' }, { ys: tl.map((r) => -Math.log(Math.max(r.p, 1e-30))), color: '#f472b6', label: 'surprisal' }], { xs, min: 0 });
    lines($('xTM'), [{ ys: tl.map((r) => r.p1 - r.p2), color: '#fbbf24', label: 'margin' }], { xs, min: 0, max: 1 });
    const ms = tl.reduce((a, r) => a - Math.log(Math.max(r.p, 1e-30)), 0) / tl.length; $('xTInfo').textContent = `${tl.length} tokens · mean surprisal ${ms.toFixed(3)} nats (sample perplexity ${Math.exp(ms).toFixed(2)}) · mean entropy ${(tl.reduce((a, r) => a + r.ent, 0) / tl.length).toFixed(3)}`; return tl; };
  on('xT', 'click', out.timeline);

  out.calib = async (N0) => { const N = Math.max(16, Math.min(1000, +(N0 ?? $('xQN').value) || 160)), docs = CORPUS.slice(-20);
    const rc = await C.evalCorpus(A.engClean(), docs, N, (f) => prog('xQP', f * 0.5)), rh = await C.evalCorpus(A.eng(), docs, N, (f) => prog('xQP', 0.5 + f * 0.5)), a = C.calibration(rc), b = C.calibration(rh);
    const cvs = $('xQRel'), hh = 220, [c, w] = canvasFit(cvs, hh); c.fillStyle = chartBg(); c.fillRect(0, 0, w, hh);
    const pw = w - 40, ph = hh - 30, ox = 30, oy = hh - 20, bw = pw / 10; c.strokeStyle = '#64748b'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + pw, oy - ph); c.stroke(); c.setLineDash([]);
    a.bins.forEach((bn, i) => { c.fillStyle = '#5eead4bb'; if (bn.n) c.fillRect(ox + i * bw + 1, oy - bn.acc * ph, bw / 2 - 2, bn.acc * ph); const bb = b.bins[i]; c.fillStyle = '#f472b6bb'; if (bb.n) c.fillRect(ox + i * bw + bw / 2, oy - bb.acc * ph, bw / 2 - 2, bb.acc * ph); });
    c.fillStyle = '#7d8aa6'; c.font = '9px monospace'; c.fillText('confidence →', ox + pw - 70, oy + 14); c.fillText('accuracy', 2, 10); for (let i = 0; i <= 10; i += 2) c.fillText((i / 10).toFixed(1), ox + (i / 10) * pw - 6, oy + 10);
    cvs._csv = () => ['bin_lo,bin_hi,clean_n,clean_conf,clean_acc,cur_n,cur_conf,cur_acc', ...a.bins.map((x, i) => [x.lo, x.hi, x.n, x.conf, x.acc, b.bins[i].n, b.bins[i].conf, b.bins[i].acc].join(','))].join('\n');
    const hc = C.histogram(rc.map((r) => r.conf), 20, 0, 1), hh2 = C.histogram(rh.map((r) => r.conf), 20, 0, 1); lines($('xQHist'), [{ ys: hc.counts, color: '#5eead4', label: 'clean' }, { ys: hh2.counts, color: '#f472b6', label: 'current' }], { xs: hc.edges.map((e) => e.toFixed(2)), min: 0 });
    const row = (n, x) => `<tr><td>${n}</td><td>${x.ppl.toFixed(3)}</td><td>${(100 * x.acc).toFixed(1)}%</td><td>${(100 * x.ece).toFixed(2)}%</td><td>${x.meanEnt.toFixed(3)}</td></tr>`;
    $('xQInfo').innerHTML = `<table><tr><th>model</th><th>perplexity</th><th>top-1 acc</th><th>ECE</th><th>mean entropy</th></tr>${row('clean', a)}${row('current', b)}</table><div class="sm">${rc.length} predictions from the last 20 reference stories. These stories were sampled from the clean model itself, so clean perplexity is optimistic: use the numbers for clean-vs-hacked comparison, not as a benchmark.</div>`;
    A.logRun({ kind: 'calib', label: `calib N=${rc.length}`, metrics: { ppl: b.ppl, acc: b.acc, ece: b.ece, ppl_clean: a.ppl, edits: A.ed().edits.length } }); return { clean: a, cur: b }; };
  on('xQ', 'click', () => out.calib());

  const greedy = (eng, ids, n) => { const s = eng.newSeq(ids.length); let r; for (const t of ids) r = eng.step(s, t); const o = []; for (let i = 0; i < n; i++) { const id = topK(eng.outLogits(r.h), 1)[0]; o.push(id); if (id === 50256) break; r = eng.step(s, id); } return o; };
  out.impact = (p) => { if (p != null) $('xIP').value = p; const tok = A.tok(), ids = tok.encode($('xIP').value); if (!ids.length) throw new Error('empty prompt'); const r = C.editImpact(A.engClean(), A.eng(), ids), lab = ids.map(tstr);
    bars($('xIL'), r.perLayer, { label: (i) => `slot ${i}: KL ${r.perLayer[i].toExponential(3)}` }); lines($('xIPos'), [{ ys: r.perPos, color: '#f472b6', label: 'KL' }], { xs: lab, min: 0 });
    bars($('xIS'), r.shifts.map((s) => s[1]), { label: (i) => `"${tstr(r.shifts[i][0])}" ${r.shifts[i][2].toFixed(4)} → ${r.shifts[i][3].toFixed(4)} (Δ ${r.shifts[i][1] >= 0 ? '+' : ''}${r.shifts[i][1].toFixed(4)})` });
    $('xIInfo').innerHTML = `final KL(hacked‖clean) <b>${r.finalKL.toExponential(3)}</b> nats · total variation ${r.tv.toFixed(4)} · entropy ${r.entC.toFixed(3)} → ${r.entH.toFixed(3)} · largest shift ${r.shifts[0] ? `"${esc(tstr(r.shifts[0][0]))}" ${r.shifts[0][1] >= 0 ? '+' : ''}${r.shifts[0][1].toFixed(4)}` : 'none (identical)'}`;
    $('xIA').textContent = tok.decode(greedy(A.engClean(), ids, 20)); $('xIB').textContent = tok.decode(greedy(A.eng(), ids, 20));
    A.logRun({ kind: 'impact', label: `impact "${$('xIP').value.slice(0, 24)}"`, metrics: { final_kl: r.finalKL, tv: r.tv, max_layer_kl: Math.max(...r.perLayer), edits: A.ed().edits.length } }); return r; };
  on('xI', 'click', () => out.impact());

  out.prof = (n0) => { const ids = A.tok().encode('Once upon a time, there was a little girl named Lily. She loved to play outside in the sun with her friends every day.').slice(0, Math.max(2, Math.min(64, +(n0 ?? $('xPN').value) || 24))), pr = C.profile(A.eng(), ids);
    const ops = Object.keys(pr.agg), col = Object.fromEntries(ops.map((o, i) => [o, PAL[i % 8]])), cvs = $('xPFl'), rh = 8, hh = pr.rows.length * rh + 24, [c, w] = canvasFit(cvs, hh); c.fillStyle = chartBg(); c.fillRect(0, 0, w, hh);
    const mx = Math.max(...pr.rows.map((r) => r.total)); pr.rows.forEach((r, i) => r.seg.forEach((s) => { c.fillStyle = col[s.op]; c.fillRect((s.start / mx) * (w - 4), i * rh, Math.max(1, (s.ms / mx) * (w - 4)), rh - 1); }));
    c.font = '9px monospace'; let x = 2; for (const o of ops) { c.fillStyle = col[o]; c.fillRect(x, hh - 12, 8, 8); c.fillStyle = '#94a3b8'; c.fillText(o, x + 10, hh - 4); x += c.measureText(o).width + 18; }
    cvs._csv = () => ['token,op,slot,layer,start_ms,ms', ...pr.rows.flatMap((r, i) => r.seg.map((s) => [i, s.op, s.slot, s.l, s.start.toFixed(4), s.ms.toFixed(4)].join(',')))].join('\n');
    const tot = pr.rows.reduce((a, r) => a + r.total, 0), T = ids.length; bars($('xPAgg'), ops.map((o) => pr.agg[o]), { colors: ops.map((o) => col[o]), label: (i) => `${ops[i]}: ${pr.agg[ops[i]].toFixed(2)} ms (${((100 * pr.agg[ops[i]]) / tot).toFixed(1)}%)` });
    const fl = C.flopsPerToken(T).total, mem = C.memoryInfo(), np = C.paramBreakdown(A.M()).reduce((a, b) => a + b.count, 0);
    $('xPInfo').textContent = `${T} steps · ${(tot / T).toFixed(2)} ms/step · ${((1000 * T) / tot).toFixed(1)} steps/s · ≈${(fl / (tot / T / 1000) / 1e9).toFixed(2)} GFLOP/s (CPU, f32 JS)`;
    $('xPTab').innerHTML = `${ops.map((o) => `${o} ${(pr.agg[o] / T).toFixed(3)} ms/step`).join(' · ')}<br>memory: ${mem ? `JS heap ${(mem.used / 1e6).toFixed(0)} / ${(mem.total / 1e6).toFixed(0)} MB (limit ${(mem.limit / 1e6).toFixed(0)} MB)` : 'performance.memory unavailable in this browser'} · weights 2 × ${((4 * np) / 1e6).toFixed(0)} MB (original + working copy)`;
    A.logRun({ kind: 'profile', label: `profile T=${T}`, metrics: { ms_per_step: tot / T, gflops: fl / (tot / T / 1000) / 1e9 } }); return pr; };
  on('xP', 'click', () => out.prof());

  out.runs = () => { const all = runs.all(), keys = [...new Set(all.flatMap((r) => Object.keys(r.metrics || {})))], cur = $('xRm').value; $('xRm').innerHTML = opts(keys, keys.includes(cur) ? cur : keys[0]);
    $('xRtab').innerHTML = `<table><tr><th></th><th>time</th><th>kind</th><th>label</th><th>metrics</th></tr>${all.map((r, i) => `<tr><td><input type="checkbox" aria-label="select run" data-run="${i}" ${r.sel !== false ? 'checked' : ''}/></td><td>${esc(r.t.slice(11, 19))}</td><td>${esc(r.kind)}</td><td>${esc(r.label || '')}</td><td>${Object.entries(r.metrics || {}).map(([k, v]) => `${esc(k)}=${typeof v === 'number' ? fmt(v) : esc(v)}`).join(' ')}</td></tr>`).reverse().join('')}</table>`;
    $$('#xRtab [data-run]').forEach((cb) => cb.addEventListener('change', () => { const a = runs.all(); a[+cb.dataset.run].sel = cb.checked; runs.save(a); out.runs(); }));
    const m = $('xRm').value, sel = all.filter((r) => r.sel !== false && r.metrics && typeof r.metrics[m] === 'number'); if (m && sel.length) bars($('xRch'), sel.map((r) => r.metrics[m]), { label: (i) => `${sel[i].label}: ${m}=${fmt(sel[i].metrics[m])}` });
    const sw = all.filter((r) => r.sel !== false && r.series); if (sw.length) lines($('xRsw'), sw.map((r, i) => ({ ys: r.series.ppl, color: PAL[i % 8], label: r.label })), { xs: sw[0].series.x.map((x) => (+x).toFixed(2)) });
    $('xRtab')._csv = () => C.toCSV(all.map((r) => [r.t, r.kind, r.label || '', JSON.stringify(r.metrics || {})]), ['time', 'kind', 'label', 'metrics']); return all; };
  on('xRr', 'click', out.runs); on('xRm', 'change', out.runs); on('xRclr', 'click', () => { runs.save([]); out.runs(); });
  on('xRcsv', 'click', () => { out.runs(); exportFor('xRtab', 'csv'); });
  on('xRjson', 'click', () => A.download('neuralese-runs.json', JSON.stringify(runs.all(), null, 1)));
}

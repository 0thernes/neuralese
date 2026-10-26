// In-app terminal: a small, safe command language over the real app API (no eval). Shared by the batch runner.
import { $, esc, MATS_OK } from './term-util.js?v=10';
export const VERSION = '10.0.0';
import { CMDS as SCI_CMDS } from './lab-science.js?v=10';
import { CMDS as RES_CMDS } from './lab-research.js?v=10';
import { CMDS as TSK_CMDS } from './lab-tsotchke.js?v=10';
const SET_KEYS = ['n', 'seed', 'temp', 'topk', 'topp', 'minp', 'typical', 'rep', 'freq', 'pres', 'mode'];
export const COMMANDS = {
  help: ['help [cmd]', 'list commands or show usage of one'],
  version: ['version', 'app + model version'],
  clear: ['clear', 'clear the terminal'],
  history: ['history', 'show command history'],
  tab: ['tab <name>', 'open a tab (arch, params, weights, attn, resid, circuit, neurons, embed, saed, timeline, calib, impact, prof, runs, sweep, ctrl, gen, steer, an, causal, sae, surg, rt, ops, viz, audio, learn, term)'],
  prompt: ['prompt <text>', 'set the generation prompt'],
  gen: ['gen [n] [text…]', 'generate n tokens (optionally from a new prompt); prints the hacked output'],
  set: ['set <key> <value>', `set a decoding option: ${SET_KEYS.join(', ')}`],
  get: ['get', 'show decoding options and runtime summary'],
  edit: ['edit <kind> …', 'weight edit: chaos <pct> | quant <bits> [layers] | svd <L.m> <k> | scale <L.m> <factor> | head <L> <H> zero|noise | neuron <L> <N> zero|noise | interp <dst> <src> <t>'],
  ablate: ['ablate head <L> <H> [zero|mean] | neuron <L> <N> [zero|clamp v]', 'runtime ablation (reversible)'],
  steer: ['steer <A> <B> <coef> [site] [layers] [op] [head]', 'add a direction e(A)−e(B) as a steering op; op = add|addnorm|ablate|clamp'],
  bias: ['bias <tok:v,…> | bias clear', 'set logit biases'],
  hsteer: ['hsteer <token> <coef>', 'add unembedding-space steering toward a token'],
  undo: ['undo', 'undo last change'], redo: ['redo', 'redo'], reset: ['reset', 'reset all weights and runtime'],
  analyze: ['analyze', 'run the ANALYZE tab on the current prompt'],
  impact: ['impact [prompt]', 'edit-impact KL dashboard'],
  calib: ['calib [N]', 'perplexity / accuracy / ECE, clean vs current'],
  heads: ['heads', 'classify all heads (prev/induction/dup/sink)'],
  attn: ['attn', 'render attention grid + rollout'],
  circuit: ['circuit', 'build the attribution circuit graph'],
  neurons: ['neurons <L> [N]', 'build the neuron atlas of layer L'],
  nn: ['nn <token>', 'nearest tokens in embedding space'],
  spectrum: ['spectrum <L> <mat>', 'weight statistics + power-law α of one matrix'],
  ww: ['ww', 'WeightWatcher α scan over all matrices'],
  sweep: ['sweep <param> <from> <to> [steps] [arg]', 'parameter sweep: blend|steer|htemp|neuron|lbias|window|hsteer'],
  profile: ['profile [T]', 'per-op timing'],
  flops: ['flops [T]', 'FLOPs per token at context T'],
  params: ['params', 'parameter breakdown'],
  runs: ['runs', 'list logged experiment runs'],
  theme: ['theme dark|light', 'switch colour theme'],
  audio: ['audio on|off|mute', 'sonification control'],
  sel: ['sel <L> [H]', 'select a layer/head (syncs 3D + panels)'],
  run: ['run <line1; line2; …>', 'execute a ;-separated script'],
  echo: ['echo <text>', 'print text'],
};
export function complete(prefix) { const p = prefix.trimStart(); if (p.includes(' ')) { const [c, ...r] = p.split(/\s+/); const last = r[r.length - 1] || ''; const pool = c === 'tab' ? Object.keys(COMMANDS.tab[1].match(/\(([^)]*)\)/)[1].split(', ').reduce((a, k) => ((a[k] = 1), a), {})) : c === 'help' ? Object.keys(COMMANDS) : c === 'theme' ? ['dark', 'light'] : c === 'edit' ? ['chaos', 'quant', 'svd', 'scale', 'head', 'neuron', 'interp'] : c === 'sweep' ? ['blend', 'steer', 'htemp', 'neuron', 'lbias', 'window', 'hsteer'] : c === 'set' ? SET_KEYS : c === 'spectrum' && r.length === 2 ? MATS_OK : []; return pool.filter((k) => k.startsWith(last)).map((k) => [c, ...r.slice(0, -1), k].join(' ')); } return Object.keys(COMMANDS).filter((k) => k.startsWith(p)); }

for (const [k, v] of Object.entries({ ...SCI_CMDS, ...RES_CMDS, ...TSK_CMDS })) if (!COMMANDS[k]) COMMANDS[k] = v;
export function makeTerminal(A, out) {
  const hist = JSON.parse(localStorage.getItem('neuralese.term.hist') || '[]');
  const num = (x, name, lo = -Infinity, hi = Infinity) => { const v = +x; if (x == null || x === '' || !isFinite(v) || v < lo || v > hi) throw new Error(`${name} must be a number in [${lo}, ${hi}]`); return v; };
  const layer = (x) => num(x, 'layer', 0, 7) | 0, mat = (x) => { const m = String(x || '').match(/^L?(\d)\.(\w+)$/); if (!m || !MATS_OK.includes(m[2])) throw new Error('matrix must look like L3.q (' + MATS_OK.join('|') + ')'); return `L${m[1]}.${m[2]}`; };
  async function exec(line) {
    line = String(line).trim(); if (!line || line.startsWith('#')) return '';
    if (hist[hist.length - 1] !== line) { hist.push(line); localStorage.setItem('neuralese.term.hist', JSON.stringify(hist.slice(-200))); }
    const [cmd, ...a] = line.split(/\s+/), rest = line.slice(cmd.length).trim();
    switch (cmd) {
      case 'help': if (a[0]) { const c = COMMANDS[a[0]]; if (!c) throw new Error('unknown command ' + a[0]); return `${c[0]}\n  ${c[1]}`; } return Object.values(COMMANDS).map(([u, h]) => `${u.padEnd(44)} ${h}`).join('\n');
      case 'version': return `NEURALESE v${VERSION} · model roneneldan/TinyStories-8M (GPT-Neo, 8 layers, d=256) · CPU f32 JavaScript inference (WebGPU unembedding optional, see "gpu")`;
      case 'clear': A.termClear(); return '';
      case 'history': return hist.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join('\n');
      case 'echo': return rest;
      case 'tab': if (!A.hasTab(a[0])) throw new Error('unknown tab ' + a[0]); A.showTab(a[0]); return `→ ${a[0]}`;
      case 'prompt': $('prompt').value = rest; return 'prompt set';
      case 'gen': { let n = 40, txt = rest; if (a[0] && /^\d+$/.test(a[0])) { n = num(a[0], 'n', 1, 400); txt = a.slice(1).join(' '); } if (txt) $('prompt').value = txt; $('d_n').value = n; await A.generate(); return ($('outB')?.textContent || '').trim(); }
      case 'set': { const k = a[0]; if (!SET_KEYS.includes(k)) throw new Error('key must be one of ' + SET_KEYS.join(', ')); const el = $('d_' + k); if (k === 'mode') { if (![...el.options].some((o) => o.value === a[1])) throw new Error('mode: ' + [...el.options].map((o) => o.value).join('|')); el.value = a[1]; } else el.value = num(a[1], k); return `${k} = ${el.value}`; }
      case 'get': { const R = A.R(); return SET_KEYS.map((k) => `${k}=${$('d_' + k).value}`).join(' ') + `\nweight edits ${A.ed().edits.length} · steering ops ${R.steer.length} · logit biases ${Object.keys(R.logitBias || {}).length} · h-steers ${(R.hSteer || []).length} · head ablations ${R.headAbl.flat().filter(Boolean).length} · neuron ablations ${R.neuronAbl.length}`; }
      case 'edit': { const k = a[0], seed = Date.now() % 1e6;
        if (k === 'chaos') { const p = num(a[1], 'pct', 0, 100); A.commit(`chaos ${p}%`, () => A.ed().push({ kind: 'chaos', pct: p, seed })); }
        else if (k === 'quant') { const bits = num(a[1], 'bits', 1, 8) | 0, ls = a[2] ? A.parseLayers(a[2]) : new Set([0, 1, 2, 3, 4, 5, 6, 7]); A.commit(`int${bits} quantize`, () => A.ed().push({ kind: 'quant', bits, layers: [...ls], mats: MATS_OK })); }
        else if (k === 'svd') { const p = mat(a[1]), kk = num(a[2], 'k', 1, 1024) | 0; A.weightEdit(`SVD keep top-${kk} ${p}`, { kind: 'svd', path: p, mode: 'topk', k: kk }, p); }
        else if (k === 'scale') { const p = mat(a[1]), f = num(a[2], 'factor'); A.weightEdit(`scale ${p} ×${f}`, { kind: 'elem', target: { type: 'matrix', path: p }, fn: 'scale', amt: f, seed }, p); }
        else if (k === 'head' || k === 'neuron') { const l = layer(a[1]), i = num(a[2], k, 0, k === 'head' ? 15 : 1023) | 0, fn = a[3] || 'zero'; if (!['zero', 'noise', 'invert'].includes(fn)) throw new Error('fn: zero|noise|invert'); A.commit(`L${l}${k === 'head' ? 'H' : 'N'}${i} ${fn} (weights)`, () => A.ed().push({ kind: 'elem', target: { type: k, l, i }, fn, amt: 1, seed })); }
        else if (k === 'interp') { const dst = layer(a[1]), src = layer(a[2]), t = num(a[3], 't', 0, 1); A.commit(`L${dst} ← lerp L${src} t=${t}`, () => A.ed().push({ kind: 'interp', dst, src, t })); }
        else throw new Error('usage: ' + COMMANDS.edit[0] + ' — ' + COMMANDS.edit[1]);
        return `✔ ${A.ed().edits.length} weight edits active`; }
      case 'ablate': { const R = A.R(); if (a[0] === 'head') { const l = layer(a[1]), h = num(a[2], 'head', 0, 15) | 0, m = a[3] || 'zero'; if (!['zero', 'mean', 'resample'].includes(m)) throw new Error('mode zero|mean|resample'); if (m !== 'zero') await A.ensureStats(); A.commit(`L${l}H${h} ${m}`, () => (A.R().headAbl[l][h] = m)); return `head L${l}H${h} → ${m}`; }
        if (a[0] === 'neuron') { const l = layer(a[1]), n = num(a[2], 'neuron', 0, 1023) | 0, m = a[3] || 'zero', v = m === 'clamp' ? num(a[4], 'value') : 0; A.commit(`L${l}N${n} ${m}`, () => A.R().neuronAbl.push({ l, n, mode: m, value: v })); return `neuron L${l}N${n} → ${m}`; }
        void R; throw new Error('usage: ' + COMMANDS.ablate[0]); }
      case 'steer': { if (a.length < 3) throw new Error('usage: ' + COMMANDS.steer[0]); const name = out.addOp({ src: 'tok', u: out.direction('tok', ' ' + a[0], ' ' + a[1]), coef: num(a[2], 'coef'), site: a[3] || 'resid_pre', layers: a[4] || '2-5', op: a[5] || 'add', head: a[6] ?? '', mask: 'all', tkind: 'const', T: 8, name: `${a[5] || 'add'} ${a[0]}−${a[1]} @${a[3] || 'resid_pre'}` }); return `✔ ${name}`; }
      case 'bias': if (a[0] === 'clear') { A.commit('clear logit bias', () => (A.R().logitBias = {})); return 'cleared'; } return 'bias ' + JSON.stringify(out.logitBias(rest));
      case 'hsteer': out.hsteer(' ' + a[0], num(a[1], 'coef')); return `✔ h-steer toward "${a[0]}"`;
      case 'undo': A.undo(); return `undo · ${A.ed().edits.length} edits`; case 'redo': A.redo(); return 'redo';
      case 'reset': A.reset(); return 'reset: model is bit-identical to the original';
      case 'analyze': A.showTab('an'); await A.analyze(); return 'analysis done (ANALYZE tab)';
      case 'impact': { if (rest) $('xIP').value = rest; const r = out.impact(); return `final KL ${r.finalKL.toExponential(3)} nats · TV ${r.tv.toFixed(4)} · per-slot KL ${r.perLayer.map((x) => x.toExponential(1)).join(' ')}`; }
      case 'calib': { const r = await out.calib(a[0] ? num(a[0], 'N', 16, 1000) : 160); return `clean ppl ${r.clean.ppl.toFixed(3)} acc ${(100 * r.clean.acc).toFixed(1)}% ECE ${(100 * r.clean.ece).toFixed(2)}%\ncurrent ppl ${r.cur.ppl.toFixed(3)} acc ${(100 * r.cur.acc).toFixed(1)}% ECE ${(100 * r.cur.ece).toFixed(2)}%`; }
      case 'heads': { const hs = out.heads(), c = {}; hs.flat().forEach((x) => (c[x.label] = (c[x.label] || 0) + 1)); const top = (k) => hs.flat().map((x, i) => [x[k], `L${x.layer}H${i % 16}`]).sort((p, q) => q[0] - p[0]).slice(0, 3).map(([v, n]) => `${n} ${v.toFixed(2)}`).join(', '); return Object.entries(c).map(([k, v]) => `${k}: ${v}`).join(' · ') + `\ntop prev: ${top('prev')}\ntop induction: ${top('induction')}`; }
      case 'attn': A.showTab('attn'); out.attn(); return 'attention rendered';
      case 'circuit': { A.showTab('circuit'); const r = out.circuit(); return `${r.nodes.length} nodes, ${r.edges.length} edges, target id ${r.tgt}`; }
      case 'neurons': { A.showTab('neurons'); const r = await out.neurons(layer(a[0]), a[1] ? num(a[1], 'N', 32, 2000) : 300); const top = [...r.neurons].sort((p, q) => q.max - p.max).slice(0, 5); return top.map((n) => `N${n.n} max ${n.max.toFixed(2)} freq ${(100 * n.freq).toFixed(1)}% poly ${n.poly.toFixed(2)}`).join('\n'); }
      case 'nn': { const r = out.embed(' ' + rest.replace(/^\s+/, '')); return r.map(([i, s]) => `${JSON.stringify(A.tok().tokenStr(i))} ${s.toFixed(3)}`).join('\n'); }
      case 'spectrum': { const l = layer(a[0]); if (!MATS_OK.includes(a[1])) throw new Error('mat: ' + MATS_OK.join('|')); const s = out.weights(l, a[1], ''); return `σ1 ${s.spectralNorm.toFixed(3)} · stable rank ${s.stableRank.toFixed(2)} · eff rank ${s.effRank.toFixed(1)} · α ${s.alpha.toFixed(2)} (KS ${s.ks.toFixed(3)})`; }
      case 'ww': { const r = await out.ww(); return r.map((x) => `${x[0].padEnd(8)} α ${x[3].toFixed(2)}`).join('\n'); }
      case 'sweep': { const r = await out.sweep({ p: a[0], from: num(a[1], 'from'), to: num(a[2], 'to'), steps: a[3] ? num(a[3], 'steps', 2, 25) : 5, arg: a[4] || '', corpus: 32 }); return r.map((x) => `${a[0]}=${x.v.toFixed(3)}  ppl ${x.ppl.toFixed(3)}  KL ${x.kl.toExponential(2)}  p(target) ${x.pt.toFixed(4)}`).join('\n'); }
      case 'profile': { const r = out.prof(a[0] ? num(a[0], 'T', 2, 64) : 16), tot = Object.values(r.agg).reduce((x, y) => x + y, 0); return Object.entries(r.agg).map(([k, v]) => `${k.padEnd(14)} ${v.toFixed(2)} ms ${((100 * v) / tot).toFixed(1)}%`).join('\n'); }
      case 'flops': return `${(out.flops(a[0] ? num(a[0], 'T', 1, 2048) : 128) / 1e6).toFixed(2)} MFLOPs per token`;
      case 'params': return `${out.params().toLocaleString()} parameters (see PARAMS tab)`;
      case 'runs': return A.runs().slice(-20).map((r) => `${r.t.slice(11, 19)} ${r.kind.padEnd(10)} ${r.label} ${JSON.stringify(r.metrics)}`).join('\n') || 'no runs yet';
      case 'theme': if (!['dark', 'light'].includes(a[0])) throw new Error('theme dark|light'); A.setTheme(a[0]); return 'theme ' + a[0];
      case 'audio': if (a[0] === 'on') await A.audioOn(); else if (a[0] === 'off' || a[0] === 'mute') A.audioMute(); else throw new Error('audio on|off|mute'); return 'audio ' + a[0];
      case 'sel': { const l = layer(a[0]); A.setSel(a[1] != null ? { l, h: num(a[1], 'head', 0, 15) | 0 } : { l }); return `selected L${l}${a[1] != null ? 'H' + a[1] : ''}`; }
      case 'run': { const outp = []; for (const s of rest.split(';')) { const r = await exec(s); if (r) outp.push(`$ ${s.trim()}\n${r}`); } return outp.join('\n'); }
      default: if (A.ext && A.ext[cmd]) return A.ext[cmd](a); throw new Error(`unknown command "${cmd}" — type help`);
    }
  }
  return { exec, hist };
}
export const termMarkup = ['TERMINAL', 'Terminal', `<div class="term" role="log" aria-live="polite" id="tmOut"></div><div class="r tmin"><span class="ps">neuralese$</span><input id="tmIn" autocomplete="off" spellcheck="false" aria-label="terminal input" placeholder="type help · Tab completes · ↑↓ history"/></div>
<fieldset><legend>script</legend><textarea id="tmScript" rows="4" aria-label="script">version
params
flops 256
spectrum 3 fc
heads</textarea><div class="r"><button id="tmRun">run script</button></div></fieldset>`];
export function mountTerminal(A, T) {
  const o = $('tmOut'), inp = $('tmIn'); let hi = T.hist.length;
  const print = (s, cls = '') => { const d = document.createElement('div'); d.className = cls; d.textContent = s; o.appendChild(d); while (o.childNodes.length > 600) o.firstChild.remove(); o.scrollTop = o.scrollHeight; };
  A.termClear = () => (o.innerHTML = '');
  const run = async (line) => { print('neuralese$ ' + line, 'cmd'); try { const r = await T.exec(line); if (r) print(r); return r; } catch (e) { print('✖ ' + e.message, 'err'); return null; } };
  inp.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') { const v = inp.value; inp.value = ''; hi = T.hist.length + 1; await run(v); }
    else if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); inp.value = T.hist[hi] || ''; e.preventDefault(); }
    else if (e.key === 'ArrowDown') { hi = Math.min(T.hist.length, hi + 1); inp.value = T.hist[hi] || ''; e.preventDefault(); }
    else if (e.key === 'Tab') { e.preventDefault(); const c = complete(inp.value); if (c.length === 1) inp.value = c[0] + ' '; else if (c.length) print(c.join('   '), 'sm'); }
  });
  $('tmRun').addEventListener('click', async () => { for (const l of $('tmScript').value.split('\n')) await run(l); });
  print(`NEURALESE v${VERSION} terminal — type "help". Tab completes, ↑/↓ history, "run a; b; c" chains.`, 'sm');
  return run;
}
void esc;

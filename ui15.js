// v15.1 front-end layer: inline SVG icon set, per-section accent colours, overview dashboard (live stats + hero 3D network),
// keyboard-shortcut overlay generated from the real bindings, and small motion/micro-interaction helpers.
import { GROUPS } from './lab-ui.js?v=152';
import { lines, heatStrip, reduced } from './charts.js?v=152';
const P = (d) => `<path d="${d}"/>`;
export const ICONS = {
  home: P('M3 11l9-7 9 7') + P('M5 10v10h14V10') + P('M10 20v-6h4v6'),
  play: P('M7 4l13 8-13 8z'), cube: P('M12 2l9 5v10l-9 5-9-5V7z') + P('M3 7l9 5 9-5') + P('M12 12v10'),
  eye: P('M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z') + '<circle cx="12" cy="12" r="3"/>',
  scalpel: P('M14 3l7 7-11 11H3v-7z') + P('M11 6l7 7'), chart: P('M4 20V4') + P('M4 20h16') + P('M8 16l4-5 3 3 5-7'),
  flask: P('M9 3h6') + P('M10 3v6L4 19a2 2 0 002 3h12a2 2 0 002-3l-6-10V3') + P('M7 15h10'),
  book: P('M4 4h7a3 3 0 013 3v13a2 2 0 00-2-2H4z') + P('M20 4h-5a3 3 0 00-3 3'), atom: '<circle cx="12" cy="12" r="1.6"/>' + '<ellipse cx="12" cy="12" rx="10" ry="4"/>' + '<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/>' + '<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>',
  nest: '<rect x="3" y="3" width="18" height="18" rx="3"/><rect x="7" y="7" width="10" height="10" rx="2"/><rect x="10.5" y="10.5" width="3" height="3" rx="1"/>',
  rocket: P('M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2') + P('M9 15l-3-3c1-4 4.5-9 13-9 0 8.5-5 12-9 13z') + '<circle cx="15" cy="9" r="1.5"/>',
  layers: P('M12 3l9 5-9 5-9-5z') + P('M3 13l9 5 9-5') + P('M3 17.5l9 5 9-5'), hub: '<circle cx="12" cy="12" r="3"/><circle cx="4" cy="5" r="2"/><circle cx="20" cy="5" r="2"/><circle cx="4" cy="19" r="2"/><circle cx="20" cy="19" r="2"/>' + P('M6 6.5l4 3.5M18 6.5l-4 3.5M6 17.5l4-3.5M18 17.5l-4-3.5'),
  tool: P('M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z'), bolt: P('M13 2L4 14h7l-1 8 9-12h-7z'), key: '<rect x="2" y="6" width="20" height="12" rx="2"/>' + P('M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10'),
  search: '<circle cx="11" cy="11" r="7"/>' + P('M20 20l-3.5-3.5'), alert: P('M12 3l10 18H2z') + P('M12 10v4M12 17h.01'), inbox: P('M3 13l3-8h12l3 8v6H3z') + P('M3 13h5l1 3h6l1-3h5'),
  wave: P('M2 12h3l3-8 4 16 3-8h7'), head: '<circle cx="12" cy="12" r="4"/>' + P('M12 2v4M12 18v4M2 12h4M18 12h4'),
};
export const icon = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[n] || ICONS.cube}</svg>`;
// one accent per section (all ≥ 4.5:1 on the dark panel background; darkened automatically in the light theme via CSS)
export const GMETA = { RUN: ['play', '#4fd8c4'], MODEL: ['layers', '#8ea2ff'], INTERPRET: ['eye', '#f472b6'], INTERVENE: ['scalpel', '#f5b94a'], EVALUATE: ['chart', '#4ade80'], SCIENCE: ['flask', '#b794f6'], RESEARCH: ['book', '#38bdf8'], TSOTCHKE: ['atom', '#fb923c'], NESTED: ['nest', '#a3e635'], FRONTIER: ['rocket', '#fb7185'], VIEW: ['cube', '#22d3ee'], HUB: ['hub', '#facc15'], TOOLS: ['tool', '#a5b4cf'], MORE: ['cube', '#a5b4cf'] };
const QUICK = [['gen', 'Generate', 'play', 'Sample text from the live (hacked) model'], ['v3d', '3D scene', 'cube', 'Layer stack, flow, voxel fields'], ['attn', 'Attention', 'eye', 'Every head, arc diagrams, rollout'], ['nlens', 'Neuron Lens', 'head', 'Read every neuron through R/S lenses'], ['an', 'Analyze', 'chart', 'Logit lens, DLA, perplexity'], ['surg', 'Lab: surgery', 'scalpel', 'Edit weights, ablate, ROME'], ['nriscv', 'Nested', 'nest', 'A CPU compiled into weights']];
export const homeMarkup = () => `<div class="home">
<section class="hero"><canvas id="heroCv" aria-label="animated network: ${8} layers × 16 heads, coloured by the last forward pass"></canvas>
<div class="heroTxt"><div class="kick">${icon('bolt')} live in your browser</div><h1>Look inside a transformer<br/>while it thinks.</h1><p>TinyStories-8M runs locally on CPU/JS. Every number below is read from the running model; the network shown here is a stylised layout coloured by the real per-head ‖z<sub>h</sub>‖ of the last forward pass.</p>
<div class="heroBtns"><button class="pri" data-go="gen">${icon('play')} Generate</button><button data-go="v3d">${icon('cube')} Open 3D</button><button data-go="attn">${icon('eye')} Attention</button></div></div></section>
<div class="stats" id="hmStats">${['params', 'layers · heads', 'd_model · d_mlp', 'tok/s', 'ms / token', 'edits · steer', 'JS heap', 'weights'].map((k) => `<div class="stat"><span>${k}</span><b data-k="${k}" class="skel">&nbsp;</b></div>`).join('')}</div>
<div class="two hm2"><fieldset><legend>${icon('wave')} throughput (last 60 updates)</legend><canvas class="ch" id="hmTps"></canvas></fieldset>
<fieldset><legend>${icon('inbox')} last generation · surprisal per token</legend><canvas class="ch" id="hmStrip"></canvas><div id="hmLast" class="sm">waiting for the first generation…</div></fieldset></div>
<fieldset><legend>${icon('rocket')} jump in</legend><div class="quick">${QUICK.map(([k, t, ic, d]) => `<button class="qc" data-go="${k}">${icon(ic, 'ic qi')}<b>${t}</b><span>${d}</span></button>`).join('')}</div></fieldset>
<div class="sm hmNote">Press <kbd>?</kbd> for keyboard shortcuts · <kbd>/</kbd> to search tabs · <kbd>Ctrl/⌘ K</kbd> command palette.</div></div>`;
export function keysMarkup() {
  const rows = [['Ctrl/⌘ Enter', 'generate'], ['Ctrl/⌘ Z', 'undo'], ['Ctrl/⌘ Shift Z', 'redo'], ['Ctrl/⌘ K', 'command palette'], ['/', 'search tabs'], ['[ / ]', 'previous / next tab'], ['H', 'overview'], ['`', 'terminal'], ['M', 'mute audio'], ['?', 'this overlay'], ['Esc', 'close']];
  const grp = GROUPS.slice(0, 10).map(([g], i) => [String((i + 1) % 10), g.toLowerCase()]);
  const kb = (s) => s.split(' ').map((x) => (x === '/' && s.length > 1 ? ' / ' : `<kbd>${x}</kbd>`)).join('');
  return `<div class="khd"><b>Keyboard shortcuts</b><button class="kx" aria-label="close shortcuts">✕</button></div><div class="kgrid"><div><h4>General</h4>${rows.map(([k, v]) => `<div class="kr">${kb(k)}<span>${v}</span></div>`).join('')}</div>
<div><h4>Jump to section</h4>${grp.map(([k, v]) => `<div class="kr"><kbd>${k}</kbd><span>${v}</span></div>`).join('')}<h4>Terminal</h4><div class="kr"><kbd>Tab</kbd><span>complete</span></div><div class="kr"><kbd>↑</kbd><kbd>↓</kbd><span>history</span></div><div class="kr"><code>run a; b</code><span>chains</span></div></div></div>`;
}
export function install(api) {
  const root = document.documentElement;
  for (const s of document.querySelectorAll('#tabs .ng')) { const [ic, c] = GMETA[s.dataset.g] || GMETA.MORE; s.style.setProperty('--ga', c); const g = s.querySelector('.grp'); if (g && !g.querySelector('svg')) g.insertAdjacentHTML('afterbegin', icon(ic, 'ic gi')); }
  const hb = document.querySelector('#tabs button[data-t=home]'); if (hb) hb.insertAdjacentHTML('afterbegin', icon('home', 'ic ti'));
  const nb = document.getElementById('bNav'); if (nb) nb.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  const k = document.getElementById('keys'); if (k) { k.innerHTML = keysMarkup(); k.querySelector('.kx').onclick = () => k.classList.add('hidden'); }
  const order = [...document.querySelectorAll('#tabs button[data-t]')].map((b) => b.dataset.t);
  addEventListener('keydown', (e) => { const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable; if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') document.getElementById('keys')?.classList.add('hidden');
    if (e.key === '[' || e.key === ']') { const cur = document.querySelector('#tabs button.on')?.dataset.t, i = order.indexOf(cur); api.showTab(order[(i + (e.key === ']' ? 1 : -1) + order.length) % order.length]); }
    if (e.key === 'h' || e.key === 'H') api.showTab('home'); });
  // press feedback ripple on buttons (skipped under reduced motion)
  document.addEventListener('pointerdown', (e) => { const b = e.target.closest?.('button'); if (!b || reduced()) return; const r = b.getBoundingClientRect(), s = document.createElement('i'); s.className = 'rip'; s.style.left = e.clientX - r.left + 'px'; s.style.top = e.clientY - r.top + 'px'; b.appendChild(s); setTimeout(() => s.remove(), 500); });
  document.querySelector('.home')?.addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g) api.showTab(g.dataset.go); });
  mountHome(api); root.dataset.ui = '15.1';
}
export function onTab(k, g) { const root = document.documentElement, [ic, c] = GMETA[g] || GMETA.MORE; root.dataset.g = k === 'home' ? 'HOME' : g || 'MORE'; root.style.setProperty('--sa', k === 'home' ? '#4fd8c4' : c);
  const ph = document.getElementById('paneHead'), pg = ph?.querySelector('.phg'); if (pg && !pg.querySelector('svg')) pg.insertAdjacentHTML('afterbegin', icon(k === 'home' ? 'home' : ic, 'ic pi')); if (hero) hero.active = k === 'home'; }
// ── overview dashboard: live stats from the 'nl-hud' event (fired by hud()), throughput sparkline, last-generation strip
let hero = null;
function mountHome(api) {
  const tps = [], set = (k, v) => { const el = document.querySelector(`#hmStats b[data-k="${k}"]`); if (el) { el.classList.remove('skel'); if (el.textContent !== v) { el.textContent = v; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } } };
  document.addEventListener('nl-hud', (e) => { const s = e.detail; set('params', s.params); set('layers · heads', `${s.L} · ${s.H}`); set('d_model · d_mlp', `${s.d} · ${s.ff}`); set('tok/s', s.tps.toFixed(1)); set('ms / token', s.ms.toFixed(1)); set('edits · steer', `${s.edits} · ${s.steer}`); set('JS heap', s.mem); set('weights', s.hash || 'hashing…');
    if (s.tps > 0 && Math.abs((tps[tps.length - 1] ?? -1) - s.tps) > 1e-9) { tps.push(s.tps); if (tps.length > 60) tps.shift(); } const cv = document.getElementById('hmTps'); if (cv && cv.offsetParent && tps.length) lines(cv, [{ ys: tps.slice(), label: 'tok/s' }], { h: 120, min: 0 }); });
  document.addEventListener('nl-gen', (e) => { const { toks, sur, text } = e.detail, cv = document.getElementById('hmStrip'); if (cv && toks.length) heatStrip(cv, toks, sur, { h: 34, min: 0, name: 'surprisal −ln p (nats)', sync: 'gtok' }); const el = document.getElementById('hmLast'); if (el) el.textContent = text.slice(0, 220) + (text.length > 220 ? '…' : ''); });
  const cv = document.getElementById('heroCv'); if (cv) import('./hero.js?v=152').then((m) => { hero = new m.Hero(cv); hero.active = document.getElementById('pane_home')?.classList.contains('on'); }).catch((e) => console.warn('hero', e));
}

// v5 shell: grouped tabs, module install, theme, resizable dock, export bar, shortcuts, terminal + learning center.
import { GROUPS, runs, exportFor, parseLayers, $, $$ } from './lab-ui.js?v=6';
import * as LM from './lab-model.js?v=6';
import * as LI from './lab-interpret.js?v=6';
import * as LV from './lab-intervene.js?v=6';
import * as LE from './lab-eval.js?v=6';
import * as LS from './lab-science.js?v=6';
import { installModes } from './viz3d.js?v=6';
import { redrawAll } from './charts.js?v=6';
import { makeTerminal, termMarkup, mountTerminal, VERSION } from './term.js?v=6';
import { learnMarkup, mountLearn } from './learn/learn.js?v=6';
export { VERSION };
const MODS = [LM, LI, LV, LE, LS];
const AUTO = { arch: 'arch', params: 'params', timeline: 'timeline', runs: 'runs' }; // cheap views rendered on open
export function buildV5(TABS, P) {
  const long = {};
  for (const m of MODS) for (const [k, [t, lt, html]] of Object.entries(m.markup)) { TABS[k] = t; long[k] = lt; P[k] = html; }
  for (const [k, [t, lt, html]] of [['term', termMarkup], ['learn', learnMarkup]]) { TABS[k] = t; long[k] = lt; P[k] = html; }
  TABS.ctrl = TABS.ctrl || 'CONTROL';
  const order = [], groupStart = {}, seen = new Set();
  for (const [g, ks] of GROUPS) { let first = true; for (const k of ks) if (TABS[k]) { if (first) groupStart[k] = g; first = false; order.push([k, TABS[k]]); seen.add(k); } }
  for (const k of Object.keys(TABS)) if (!seen.has(k)) order.push([k, TABS[k]]);
  let api = null, out = {}, autoDone = new Set();
  const V = { order, groupStart, long, out, version: VERSION,
    onShow(k) { if (!api) return; if (AUTO[k] && (k === 'timeline' || k === 'runs' || !autoDone.has(k))) { autoDone.add(k); try { out[AUTO[k]](); } catch (e) { console.warn(e); } } if (k === 'term') setTimeout(() => $('tmIn')?.focus(), 0); },
    setTheme(t) { document.documentElement.dataset.theme = t; setTimeout(redrawAll, 0); try { localStorage.setItem('neuralese.theme', t); } catch { /* */ } (api?.viz || window.NEURALESE?.viz)?.setBg?.(t === 'light'); const b = $('bTheme'); if (b) b.textContent = t === 'light' ? '☾ dark' : '☀ light'; },
    toggleTheme() { V.setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'); },
    wire({ guard }) {
      V.setTheme(localStorage.getItem('neuralese.theme') || 'dark');
      $('bTheme')?.addEventListener('click', V.toggleTheme);
      // export bars: one delegated handler
      document.addEventListener('click', guard((e) => { const b = e.target.closest('.xb button'); if (!b) return; const id = b.parentElement.dataset.for; if (!exportFor(id, b.dataset.x)) throw new Error(`nothing to export as ${b.dataset.x} yet — render the chart first`); }));
      // resizable dock
      const sp = $('split'), dock = $('dock'); if (sp && dock) { const w0 = +localStorage.getItem('neuralese.dockW') || 0; if (w0) document.documentElement.style.setProperty('--dockW', w0 + 'px');
        sp.addEventListener('pointerdown', (e) => { sp.setPointerCapture(e.pointerId); const mv = (ev) => { const w = Math.max(320, Math.min(innerWidth - 200, innerWidth - ev.clientX)); document.documentElement.style.setProperty('--dockW', w + 'px'); localStorage.setItem('neuralese.dockW', w); }; sp.onpointermove = mv; sp.onpointerup = () => (sp.onpointermove = null); });
        sp.addEventListener('keydown', (e) => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; const cur = dock.getBoundingClientRect().width + (e.key === 'ArrowLeft' ? 30 : -30); document.documentElement.style.setProperty('--dockW', Math.max(320, cur) + 'px'); }); }
      // shortcuts: ` terminal · ? help · 1–7 groups
      addEventListener('keydown', (e) => { if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === '`') { e.preventDefault(); api.showTab('term'); }
        else if (e.key === '?') $('keys')?.classList.toggle('hidden');
        else if (e.key === 'Escape') $('keys')?.classList.add('hidden');
        else if (/^[1-8]$/.test(e.key)) { const g = GROUPS[+e.key - 1]; if (g) api.showTab(g[1][0]); } });
    },
    mount(base) {
      api = { ...base, on: (id, ev, fn) => { const el = $(id); if (!el) throw new Error('missing element #' + id); el.addEventListener(ev, base.guard(fn)); },
        logRun: (r) => runs.add(r), runs: () => runs.all(), parseLayers: (s) => [...parseLayers(s)], hasTab: (k) => !!$('pane_' + k), setTheme: V.setTheme,
        audioOn: async () => { await base.audio.start(); if (base.audio.muted) base.audio.setMute(false); }, audioMute: () => base.audio.setMute(true) };
      if (base.viz && !base.viz.mode) installModes(base.viz);
      for (const m of MODS) m.install(api, out);
      const T = makeTerminal(api, out); api.term = mountTerminal(api, T); V.exec = T.exec; V.term = api.term;
      V.learn = mountLearn(api); V.api = api; V.setTheme(document.documentElement.dataset.theme || 'dark');
      $$('#tabs button').forEach((b) => b.setAttribute('aria-controls', 'pane_' + b.dataset.t));
    },
  };
  return V;
}

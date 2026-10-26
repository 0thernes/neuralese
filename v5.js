// v5 shell: grouped tabs, module install, theme, resizable dock, export bar, shortcuts, terminal + learning center.
import { GROUPS, runs, exportFor, parseLayers, $, $$ } from './lab-ui.js?v=9';
import * as LM from './lab-model.js?v=9';
import * as LI from './lab-interpret.js?v=9';
import * as LV from './lab-intervene.js?v=9';
import * as LE from './lab-eval.js?v=9';
import * as LS from './lab-science.js?v=9';
import * as LR from './lab-research.js?v=9';
import * as LT from './lab-tsotchke.js?v=9';
import { installModes } from './viz3d.js?v=9';
import { redrawAll } from './charts.js?v=9';
import { makeTerminal, termMarkup, mountTerminal, VERSION } from './term.js?v=9';
import { learnMarkup, mountLearn } from './learn/learn.js?v=9';
export { VERSION };
const MODS = [LM, LI, LV, LE, LS, LR, LT];
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
      $('bKeys')?.addEventListener('click', () => $('keys')?.classList.toggle('hidden'));
      // export bars: one delegated handler
      document.addEventListener('click', guard((e) => { const b = e.target.closest('.xb button'); if (!b) return; const id = b.parentElement.dataset.for; if (!exportFor(id, b.dataset.x)) throw new Error(`nothing to export as ${b.dataset.x} yet — render the chart first`); }));
      // resizable dock
      const sp = $('split'), dock = $('dock'); if (sp && dock) { const w0 = +localStorage.getItem('neuralese.dockW') || 0; if (w0) document.documentElement.style.setProperty('--dockW', w0 + 'px');
        sp.addEventListener('pointerdown', (e) => { sp.setPointerCapture(e.pointerId); const mv = (ev) => { const w = Math.max(320, Math.min(innerWidth - 200, innerWidth - ev.clientX)); document.documentElement.style.setProperty('--dockW', w + 'px'); localStorage.setItem('neuralese.dockW', w); }; sp.onpointermove = mv; sp.onpointerup = () => (sp.onpointermove = null); });
        sp.addEventListener('keydown', (e) => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; const cur = dock.getBoundingClientRect().width + (e.key === 'ArrowLeft' ? 30 : -30); document.documentElement.style.setProperty('--dockW', Math.max(320, cur) + 'px'); }); }
      // shortcuts: ` terminal · ? help · 1–9, 0 groups
      addEventListener('keydown', (e) => { if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === '`') { e.preventDefault(); api.showTab('term'); }
        else if (e.key === '?') $('keys')?.classList.toggle('hidden');
        else if (e.key === 'Escape') $('keys')?.classList.add('hidden');
        else if (/^[0-9]$/.test(e.key)) { const g = GROUPS[e.key === '0' ? 9 : +e.key - 1]; if (g) api.showTab(g[1][0]); } });
    },
    // a11y: give every unlabelled form control an accessible name (from its preceding <label>, placeholder, title or id),
    // make scroll containers keyboard-focusable, and expose the splitter's value.
    a11y(root = document) { for (const el of root.querySelectorAll('input:not([type=hidden]),select,textarea')) { if (el.getAttribute('aria-label') || el.labels?.length || el.closest('label')) continue; let p = el.previousElementSibling; while (p && p.tagName !== 'LABEL' && !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(p.tagName)) p = p.previousElementSibling;
        const name = (p?.tagName === 'LABEL' && p.textContent.trim()) || el.placeholder || el.title || (el.closest('.r')?.querySelector('b')?.textContent.trim() ? el.closest('.r').querySelector('b').textContent.trim() + ' ' + (el.dataset.k || el.tagName.toLowerCase()) : '') || el.id.replace(/^[a-z]+/, '').replace(/([A-Z])/g, ' $1').trim() || el.id; if (name) el.setAttribute('aria-label', name); }
      for (const id of ['outA', 'xArchSvg', 'xParTab']) $(id)?.setAttribute('tabindex', '0');
      const sp = $('split'), dock = $('dock'); if (sp && dock) { sp.setAttribute('aria-valuemin', '320'); sp.setAttribute('aria-valuemax', String(innerWidth)); sp.setAttribute('aria-valuenow', String(Math.round(dock.getBoundingClientRect().width))); } },
    mount(base) {
      api = { ...base, on: (id, ev, fn) => { const el = $(id); if (!el) throw new Error('missing element #' + id); el.addEventListener(ev, base.guard(fn)); },
        logRun: (r) => runs.add(r), runs: () => runs.all(), importRuns: (a) => runs.save(a.slice(-300)), appVersion: VERSION, parseLayers: (s) => [...parseLayers(s)], hasTab: (k) => !!$('pane_' + k), setTheme: V.setTheme,
        audioOn: async () => { await base.audio.start(); if (base.audio.muted) base.audio.setMute(false); }, audioMute: () => base.audio.setMute(true) };
      if (base.viz && !base.viz.mode) installModes(base.viz);
      for (const m of MODS) m.install(api, out);
      const T = makeTerminal(api, out); api.term = mountTerminal(api, T); V.exec = T.exec; V.term = api.term;
      V.learn = mountLearn(api); V.api = api; V.setTheme(document.documentElement.dataset.theme || 'dark');
      $$('#tabs button').forEach((b) => b.setAttribute('aria-controls', 'pane_' + b.dataset.t));
      V.a11y(); let a11yT; new MutationObserver(() => { clearTimeout(a11yT); a11yT = setTimeout(() => V.a11y(), 200); }).observe($('panes') || document.body, { childList: true, subtree: true });
    },
  };
  return V;
}

// Shared helpers for the v5 research tabs (markup builders, export, run tracker).
import { CFG } from './model.js?v=170';
import { frame } from './coop.js?v=170';
import { createLab, fromTracker } from './agent/schema.js?v=170';
export const { d, H, hd, L, ff, V } = CFG;
export const $ = (id) => document.getElementById(id), $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const tick = () => frame();
export const fmt = (x, p = 3) => (x == null || !isFinite(x) ? '–' : Math.abs(x) >= 1e4 || (Math.abs(x) < 1e-3 && x !== 0) ? (+x).toExponential(2) : (+x).toFixed(p));
export const human = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'G' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n));
export const opts = (a, v) => a.map((x) => { const [k, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${k}"${k == v ? ' selected' : ''}>${t}</option>`; }).join('');
export const lOpts = (v = 0) => opts([...Array(L).keys()], v), hOpts = (v = 0) => opts([...Array(H).keys()], v);
export const XB = (id, kinds = 'png csv') => `<span class="xb" data-for="${id}">${kinds.split(' ').map((k) => `<button data-x="${k}" title="export ${k.toUpperCase()}">${k}</button>`).join('')}</span>`;
export const cv = (id, title, kinds) => `<div class="chd"><span class="ct">${title}</span>${XB(id, kinds)}</div><canvas class="ch" id="${id}"></canvas>`;
export const tipq = (t) => `<i class="q" tabindex="0" title="${esc(t)}">?</i>`;
export const PAL = ['#4fd8c4', '#8ea2ff', '#b794f6', '#f472b6', '#f5b94a', '#fb923c', '#4ade80', '#38bdf8'];
export const pal = (l) => PAL[((l % 8) + 8) % 8];
export const prog = (id, f) => { const e = $(id); if (e && e.firstElementChild) e.firstElementChild.style.width = (Math.max(0, Math.min(1, f)) * 100).toFixed(0) + '%'; };
export function svgEl(box, w, h, inner) { box.innerHTML = `<svg class="chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%">${inner}</svg>`; return box.firstChild; }
export function tokId(tok, s) { const ids = tok.encode(s); if (!ids.length) throw new Error('empty token'); return ids[0]; }
export function parseLayers(s) { const out = new Set(); for (const p of String(s).split(',')) { const m = p.trim().match(/^(\d+)(?:-(\d+))?$/); if (!m) throw new Error('bad layer list ' + s); for (let l = +m[1]; l <= +(m[2] ?? m[1]); l++) if (l < L) out.add(l); } if (!out.size) throw new Error('no valid layers'); return out; }
export function canvasFit(cvs, h) { const w = cvs.clientWidth || 420; cvs.width = w * devicePixelRatio; cvs.height = h * devicePixelRatio; cvs.style.height = h + 'px'; const c = cvs.getContext('2d'); c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); return [c, w]; }
export const chartBg = () => getComputedStyle(document.documentElement).getPropertyValue('--chart-bg').trim() || '#060a12';
export async function exportFor(id, kind) {
  await tick();
  const el = $(id); if (!el) return false; const name = `neuralese-${id}-${Date.now()}`;
  const dl = (blob, ext) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.${ext}`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  if (kind === 'png') { if (el.tagName !== 'CANVAS') return false; await new Promise((resolve) => requestAnimationFrame(() => { el.toBlob((b) => { if (b) dl(b, 'png'); resolve(); }); })); return true; }
  if (kind === 'svg') { const s = el.tagName === 'svg' ? el : el.querySelector('svg'); if (!s) return false; const parts = [s.cloneNode(false).outerHTML.replace(/<\/[^>]+>$/, '')]; const kids = [...s.childNodes]; for (let i = 0; i < kids.length; i++) { parts.push(kids[i].nodeType === 1 ? kids[i].outerHTML : (kids[i].textContent || '')); if ((i & 7) === 7) await tick(); } parts.push(`</${s.tagName}>`); dl(new Blob(parts, { type: 'image/svg+xml' }), 'svg'); return true; }
  if (kind === 'csv') { const c = el._csv ? await el._csv() : null; if (!c || (Array.isArray(c) && !c.length)) return false; await tick(); dl(new Blob(Array.isArray(c) ? c : [c], { type: 'text/csv' }), 'csv'); return true; }
  return false;
}
const RKEY = 'neuralese.runs.v5';
const LABKEY = 'neuralese.lab.v1';
export const lab = createLab({
  load() { try { return JSON.parse(localStorage.getItem(LABKEY) || ''); } catch { return { runs: [], artifacts: [] }; } },
  save(state) { try { localStorage.setItem(LABKEY, JSON.stringify(state)); } catch { /* quota */ } },
});
function mirror(row) { try { if (!lab.getRun(row.id)) lab.logRun(fromTracker(row)); } catch { /* the tracker still has the row */ } }
export const runs = {
  all() { try { return JSON.parse(localStorage.getItem(RKEY) || '[]'); } catch { return []; } },
  add(r) { const a = runs.all(); const x = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: new Date().toISOString(), sel: true, ...r }; a.push(x); runs.save(a.slice(-300)); mirror(x); return x; },
  save(a) { try { localStorage.setItem(RKEY, JSON.stringify(a)); } catch { /* quota: drop oldest */ localStorage.setItem(RKEY, JSON.stringify(a.slice(-50))); } for (const row of a) mirror(row); },
};
export const GROUPS = [['RUN', ['home', 'v16', 'gen', 'steer', 'ctrl', 'audio']], ['MODEL', ['arch', 'params', 'weights']], ['INTERPRET', ['an', 'attn', 'resid', 'circuit', 'neurons', 'embed', 'sae', 'saed', 'nlens', 'nlval', 'nlext']], ['INTERVENE', ['causal', 'surg', 'rt', 'sweep', 'ops']], ['EVALUATE', ['timeline', 'calib', 'impact', 'prof', 'runs']], ['SCIENCE', ['drill', 'grad', 'heads', 'geom', 'land']], ['RESEARCH', ['repro', 'stats', 'acdc', 'probe', 'data', 'evalh', 'nb', 'report', 'log']], ['TSOTCHKE', ['tsk', 'qrng', 'qgeom', 'types', 'taylor', 'claims']], ['NESTED', ['nriscv', 'nslm', 'nmoe', 'nxlens']], ['FRONTIER', ['fx', 'fsc', 'fmind', 'frsi', 'fgrok', 'fatlas', 'fclaims']], ['VIEW', ['viz', 'v3d']], ['HUB', ['hub', 'hinterp', 'hemb', 'hspeech', 'hvision', 'hgen', 'hft']], ['TOOLS', ['term', 'learn', 'gpu', 'zoo', 'share']]];

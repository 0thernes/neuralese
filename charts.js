// Minimal canvas charts: heatmap (with hover/click), multi-line, bars. No dependencies.
const tip = () => document.getElementById('tip');
const css = (v, f) => (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue(v).trim()) || f;
export const BG = () => css('--chart-bg', '#060a12'), FG = () => css('--m', '#7d8aa6'), GRID = () => css('--b', '#1d2740'), TX = () => css('--t', '#cfd8ea');
export function showTip(e, text) { const t = tip(); if (!text) { t.style.display = 'none'; return; } t.textContent = text; t.style.display = 'block'; t.style.left = Math.min(e.clientX + 14, innerWidth - 300) + 'px'; t.style.top = (e.clientY + 14) + 'px'; }
export function divColor(v, mx) { const x = Math.max(-1, Math.min(1, v / (mx || 1))); return x >= 0 ? `rgb(${20 + 220 * x | 0},${30 + 60 * x | 0},${50 + 40 * x | 0})` : `rgb(${20 | 0},${30 + 150 * -x | 0},${50 + 200 * -x | 0})`; }
export function seqColor(v) { const x = Math.max(0, Math.min(1, v)); return `rgb(${10 + 240 * x | 0},${20 + 200 * x * x | 0},${40 + 60 * (1 - x) | 0})`; }
function fit(cv, h) { const w = cv.clientWidth || 420; cv.width = w * devicePixelRatio; cv.height = h * devicePixelRatio; cv.style.height = h + 'px'; const c = cv.getContext('2d'); c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); return [c, w]; }
// M: rows × cols numbers. opts: {rows,cols labels, diverging, max, label(i,j) -> tooltip, onClick(i,j), h}
export function heatmap(cv, M, o = {}) {
  stamp(cv); cv._redraw = () => { cv._inRedraw = true; try { heatmap(cv, M, o); } finally { cv._inRedraw = false; } };
  cv._csv = () => [['row', ...(o.cols || M[0].map((_, j) => j))].join(','), ...M.map((r, i) => [JSON.stringify(String(o.rows ? o.rows[i] : i)), ...Array.from(r, (v) => +(+v).toPrecision(6))].join(','))].join('\n');
  const R = M.length, C = M[0]?.length || 0, padL = o.padL ?? 34, padT = o.padT ?? 14; const h = o.h || Math.max(120, Math.min(420, R * 18 + padT + 4));
  const [c, w] = fit(cv, h); const cw = (w - padL - 2) / C, ch = (h - padT - 2) / R;
  let mx = o.max; if (mx == null) { mx = 0; for (const r of M) for (const v of r) if (isFinite(v)) mx = Math.max(mx, Math.abs(v)); }
  c.fillStyle = BG(); c.fillRect(0, 0, w, h); c.font = '9px monospace'; c.fillStyle = FG();
  for (let i = 0; i < R; i++) { c.fillText(o.rows ? o.rows[i] : i, 1, padT + i * ch + ch / 2 + 3); for (let j = 0; j < C; j++) { const v = M[i][j]; c.fillStyle = !isFinite(v) ? '#000' : o.diverging === false ? seqColor(v / (mx || 1)) : divColor(v, mx); c.fillRect(padL + j * cw, padT + i * ch, Math.ceil(cw) - (cw > 4 ? 1 : 0), Math.ceil(ch) - (ch > 4 ? 1 : 0)); } c.fillStyle = FG(); }
  if (o.cols) { const step = Math.max(1, Math.ceil(C / ((w - padL) / 28))); for (let j = 0; j < C; j += step) c.fillText(String(o.cols[j]).slice(0, 5), padL + j * cw, 10); }
  if (o.mark) { c.strokeStyle = '#fbbf24'; c.lineWidth = 2; c.strokeRect(padL + o.mark[1] * cw, padT + o.mark[0] * ch, cw, ch); }
  const at = (e) => { const r = cv.getBoundingClientRect(); const j = Math.floor((e.clientX - r.left - padL) / cw), i = Math.floor((e.clientY - r.top - padT) / ch); return i >= 0 && i < R && j >= 0 && j < C ? [i, j] : null; };
  cv.onmousemove = (e) => { const p = at(e); showTip(e, p ? (o.label ? o.label(p[0], p[1]) : `[${p[0]},${p[1]}] ${M[p[0]][p[1]].toFixed(4)}`) : ''); };
  cv.onmouseleave = () => showTip(null, ''); cv.onclick = (e) => { const p = at(e); if (p && o.onClick) o.onClick(p[0], p[1]); };
}
// series: [{ys:[...], color, width, label}], xs labels optional
export function lines(cv, series, o = {}) {
  stamp(cv); cv._redraw = () => { cv._inRedraw = true; try { lines(cv, series, o); } finally { cv._inRedraw = false; } };
  cv._csv = () => { const n = Math.max(...series.map((s) => s.ys.length)); return ['x,' + series.map((s, i) => JSON.stringify(s.label || 's' + i)).join(','), ...Array.from({ length: n }, (_, i) => [JSON.stringify(String(o.xs ? o.xs[i] : i)), ...series.map((s) => s.ys[i] ?? '')].join(','))].join('\n'); };
  const h = o.h || 140, [c, w] = fit(cv, h), pad = 26; let lo = o.min ?? Infinity, hi = o.max ?? -Infinity;
  for (const s of series) for (const y of s.ys) if (isFinite(y)) { if (o.min == null) lo = Math.min(lo, y); if (o.max == null) hi = Math.max(hi, y); }
  if (!(hi > lo)) { hi = lo + 1; } const n = Math.max(...series.map((s) => s.ys.length)); const X = (i) => pad + (i / Math.max(1, n - 1)) * (w - pad - 6), Y = (v) => h - 14 - ((v - lo) / (hi - lo)) * (h - 24);
  c.fillStyle = BG(); c.fillRect(0, 0, w, h); c.strokeStyle = GRID(); c.beginPath(); c.moveTo(pad, 4); c.lineTo(pad, h - 14); c.lineTo(w, h - 14); c.stroke();
  c.fillStyle = FG(); c.font = '9px monospace'; c.fillText(hi.toPrecision(3), 1, 10); c.fillText(lo.toPrecision(3), 1, h - 16); if (o.xs) { const st = Math.max(1, Math.ceil(n / 12)); for (let i = 0; i < n; i += st) c.fillText(String(o.xs[i]).slice(0, 6), X(i) - 4, h - 3); }
  for (const s of series) { c.strokeStyle = s.color || '#5eead4'; c.lineWidth = s.width || 1; c.beginPath(); s.ys.forEach((y, i) => { if (!isFinite(y)) return; i ? c.lineTo(X(i), Y(y)) : c.moveTo(X(i), Y(y)); }); c.stroke(); }
  if (o.title) { c.fillStyle = TX(); c.fillText(o.title, pad + 4, 12); }
  cv.onmousemove = (e) => { const r = cv.getBoundingClientRect(); const i = Math.round(((e.clientX - r.left - pad) / (w - pad - 6)) * (n - 1)); if (i < 0 || i >= n) return showTip(e, ''); showTip(e, (o.xs ? o.xs[i] + '\n' : `x=${i}\n`) + series.filter((s) => s.label).map((s) => `${s.label}: ${s.ys[i]?.toFixed?.(4)}`).join('\n')); };
  cv.onmouseleave = () => showTip(null, '');
}
export function bars(cv, ys, o = {}) {
  stamp(cv); cv._redraw = () => { cv._inRedraw = true; try { bars(cv, ys, o); } finally { cv._inRedraw = false; } };
  cv._csv = () => ['i,label,value', ...ys.map((y, i) => `${i},${JSON.stringify(o.label ? o.label(i) : String(i))},${y}`)].join('\n');
  const h = o.h || 110, [c, w] = fit(cv, h); const n = ys.length; let mx = o.max ?? Math.max(...ys.map(Math.abs)), lo = o.log ? Math.log10(Math.max(1e-12, Math.min(...ys.filter((y) => y > 0)))) : 0;
  c.fillStyle = BG(); c.fillRect(0, 0, w, h); const bw = (w - 4) / n;
  ys.forEach((y, i) => { let f = o.log ? (Math.log10(Math.max(y, 1e-12)) - lo) / (Math.log10(mx) - lo || 1) : Math.abs(y) / (mx || 1); f = Math.max(0, f); c.fillStyle = o.colors ? o.colors[i] : y < 0 ? '#60a5fa' : '#5eead4'; c.fillRect(2 + i * bw, h - 12 - f * (h - 20), Math.max(1, bw - (bw > 3 ? 1 : 0)), f * (h - 20)); });
  c.fillStyle = FG(); c.font = '9px monospace'; if (o.title) c.fillText(o.title, 4, 10);
  cv.onmousemove = (e) => { const r = cv.getBoundingClientRect(); const i = Math.floor((e.clientX - r.left - 2) / bw); showTip(e, i >= 0 && i < n ? (o.label ? o.label(i) : `${i}: ${ys[i].toPrecision(4)}`) : ''); }; cv.onmouseleave = () => showTip(null, '');
  if (o.onClick) cv.onclick = (e) => { const r = cv.getBoundingClientRect(); const i = Math.floor((e.clientX - r.left - 2) / bw); if (i >= 0 && i < n) o.onClick(i); };
}

// scatter: pts [{x,y,c,r,label}], optional polylines [{pts:[[x,y]..], color}]
export function scatter(cv, pts, o = {}) {
  stamp(cv); cv._redraw = () => { cv._inRedraw = true; try { scatter(cv, pts, o); } finally { cv._inRedraw = false; } };
  const h = o.h || 260, [c, w] = fit(cv, h), pad = 8; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); } if (!(x1 > x0)) x1 = x0 + 1; if (!(y1 > y0)) y1 = y0 + 1;
  const X = (x) => pad + ((x - x0) / (x1 - x0)) * (w - 2 * pad), Y = (y) => h - pad - ((y - y0) / (y1 - y0)) * (h - 2 * pad);
  c.fillStyle = BG(); c.fillRect(0, 0, w, h);
  for (const ln of o.lines || []) { c.strokeStyle = ln.color || GRID(); c.lineWidth = ln.width || 1; c.beginPath(); ln.pts.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.stroke(); }
  for (const p of pts) { c.fillStyle = p.c || '#5eead4'; c.beginPath(); c.arc(X(p.x), Y(p.y), p.r || 2.5, 0, 7); c.fill(); if (p.text) { c.fillStyle = TX(); c.font = '10px monospace'; c.fillText(p.text, X(p.x) + 4, Y(p.y) - 3); } }
  if (o.title) { c.fillStyle = TX(); c.font = '10px monospace'; c.fillText(o.title, 6, 12); }
  cv._csv = () => ['x,y,label', ...pts.map((p) => `${p.x},${p.y},${JSON.stringify(p.label || '')}`)].join('\n');
  const near = (e) => { const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; let b = null, bd = 100; for (const p of pts) { const dd = (X(p.x) - mx) ** 2 + (Y(p.y) - my) ** 2; if (dd < bd) { bd = dd; b = p; } } return b; };
  cv.onmousemove = (e) => { const p = near(e); showTip(e, p ? p.label || `${p.x.toFixed(3)}, ${p.y.toFixed(3)}` : ''); }; cv.onmouseleave = () => showTip(null, '');
  if (o.onClick) cv.onclick = (e) => { const p = near(e); if (p) o.onClick(p); };
}

export function redrawAll() { for (const c of document.querySelectorAll('canvas')) if (c._redraw && c.offsetParent) try { c._redraw(); } catch (e) { console.warn(e); } }

// v12.1 freshness stamps: every chart records when it was computed and under which model state ("generation", bumped on
// every weight/runtime edit). When the model changes, older charts are labelled stale instead of silently showing old results.
let GEN = 0; export const modelGen = () => GEN;
export function stampText(at, gen, cur) { const t = new Date(at).toTimeString().slice(0, 8); return gen === cur ? `computed ${t} · current model state` : `last run at ${t} · ⚠ model changed since (state #${gen} → #${cur}); rerun for the current state`; }
function stamp(cv) { if (cv._inRedraw || typeof document === 'undefined') return; cv._at = Date.now(); cv._gen = GEN; let el = cv.nextElementSibling; if (!el || !el.classList?.contains('cstamp')) { el = document.createElement('div'); el.className = 'cstamp sm'; cv.after(el); } el.classList.remove('stale'); el.textContent = stampText(cv._at, GEN, GEN); }
export function markStale() { GEN++; if (typeof document === 'undefined') return GEN; for (const c of document.querySelectorAll('canvas')) if (c._at && c.nextElementSibling?.classList?.contains('cstamp')) { const el = c.nextElementSibling, st = c._gen !== GEN; el.classList.toggle('stale', st); el.textContent = stampText(c._at, c._gen, GEN); } return GEN; }

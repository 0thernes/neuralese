// Canvas charts (v15): HiDPI, axes + gridlines + nice ticks, legends, colorbars, perceptual colormaps, hover crosshairs.
// heatmap (hover/click), multi-line, bars, scatter. No dependencies.
const tip = () => document.getElementById('tip');
const css = (v, f) => (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue(v).trim()) || f;
export const BG = () => css('--chart-bg', '#0a0f1a'), FG = () => css('--m', '#7c89a3'), GRID = () => css('--b', '#1f2a42'), TX = () => css('--t', '#dbe4f3');
const light = () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light';
const MONO = () => css('--mono', 'ui-monospace,monospace'), SANS = () => css('--sans', 'system-ui,sans-serif');
const gridC = () => (light() ? '#0f172a12' : '#ffffff0e'), axisC = () => (light() ? '#0f172a40' : '#ffffff2a');
export const SERIES = ['#4fd8c4', '#8ea2ff', '#f472b6', '#f5b94a', '#b794f6', '#fb923c', '#4ade80', '#38bdf8'];
export function showTip(e, text) { const t = tip(); if (!t) return; if (!text) { t.style.display = 'none'; return; } t.textContent = text; t.style.display = 'block'; const w = t.offsetWidth || 200, hh = t.offsetHeight || 40; t.style.left = Math.max(4, Math.min(e.clientX + 14, innerWidth - w - 8)) + 'px'; t.style.top = Math.max(4, Math.min(e.clientY + 14, innerHeight - hh - 8)) + 'px'; }
// ── colormaps: piecewise-linear interpolation through published anchor colors (perceptually uniform sequential maps)
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const MAPS = {
  viridis: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'].map(hex),
  magma: ['#000004', '#180f3d', '#440f76', '#721f81', '#9e2f7f', '#cd4071', '#f1605d', '#fd9668', '#feca8d', '#fcfdbf'].map(hex),
};
const DIV_DARK = ['#9ccfff', '#4f8fe0', '#2b4f8a', '#1a2233', '#8a3a28', '#d9653a', '#ffc078'].map(hex), DIV_LIGHT = ['#1d4f9c', '#4a86d4', '#a9c8ee', '#f4f5f7', '#f0b09a', '#d4593a', '#8f2412'].map(hex);
function ramp(stops, x) { x = Math.max(0, Math.min(1, x)); const f = x * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), t = f - i, a = stops[i], b = stops[i + 1]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
export const cmap = (name, x) => rgb(ramp(MAPS[name] || MAPS.viridis, x));
// signed value in [-mx, mx] → diverging blue · neutral · orange (neutral matches the chart background in each theme)
export function divColor(v, mx) { const x = Math.max(-1, Math.min(1, v / (mx || 1))); return rgb(ramp(light() ? DIV_LIGHT : DIV_DARK, (x + 1) / 2)); }
// [0,1] → viridis
export function seqColor(v) { return cmap('viridis', isFinite(v) ? v : 0); }
function fit(cv, h) { const w = cv.clientWidth || 420; cv.width = Math.round(w * devicePixelRatio); cv.height = Math.round(h * devicePixelRatio); cv.style.height = h + 'px'; const c = cv.getContext('2d'); c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); c.lineJoin = 'round'; c.lineCap = 'round'; return [c, w]; }
function niceTicks(lo, hi, n = 5) { const span = hi - lo || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), st = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => span / k <= n) || 10 * mag; const out = []; for (let v = Math.ceil(lo / st) * st; v <= hi + st * 1e-9; v += st) out.push(+v.toPrecision(12)); return out; }
const tfmt = (v) => { const a = Math.abs(v); return a === 0 ? '0' : a >= 1e4 || a < 1e-3 ? v.toExponential(1) : a >= 100 ? v.toFixed(0) : a >= 1 ? +v.toFixed(2) + '' : +v.toPrecision(2) + ''; };
function rrect(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function title(c, t, x) { if (!t) return; c.fillStyle = TX(); c.font = `600 11px ${SANS()}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText(t, x, 14); }
function colorbar(c, x, y, w, h, lo, hi, f) { const g = c.createLinearGradient(0, y + h, 0, y); for (let k = 0; k <= 16; k++) g.addColorStop(k / 16, f(lo + (hi - lo) * (k / 16))); c.fillStyle = g; rrect(c, x, y, w, h, 3); c.fill(); c.strokeStyle = axisC(); c.lineWidth = 1; c.stroke(); c.fillStyle = FG(); c.font = `9.5px ${MONO()}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(tfmt(hi), x + w + 4, y + 4); c.fillText(tfmt((lo + hi) / 2), x + w + 4, y + h / 2); c.fillText(tfmt(lo), x + w + 4, y + h - 4); }
// M: rows × cols numbers. opts: {rows,cols labels, diverging, max, label(i,j) -> tooltip, onClick(i,j), h, cmap:'viridis'|'magma', colorbar:false}
export function heatmap(cv, M, o = {}) {
  stamp(cv); cv._redraw = () => { cv._inRedraw = true; try { heatmap(cv, M, o); } finally { cv._inRedraw = false; } };
  cv._csv = () => [['row', ...(o.cols || M[0].map((_, j) => j))].join(','), ...M.map((r, i) => [JSON.stringify(String(o.rows ? o.rows[i] : i)), ...Array.from(r, (v) => +(+v).toPrecision(6))].join(','))].join('\n');
  const R = M.length, C = M[0]?.length || 0, padL = o.padL ?? 38, padT = o.padT ?? (o.cols ? 18 : 8), cb = o.colorbar !== false, padR = cb ? 50 : 4; const h = o.h || Math.max(130, Math.min(440, R * 18 + padT + 8));
  const [c, w] = fit(cv, h); const cw = (w - padL - padR) / C, ch = (h - padT - 6) / R;
  let mx = o.max; if (mx == null) { mx = 0; for (const r of M) for (const v of r) if (isFinite(v)) mx = Math.max(mx, Math.abs(v)); }
  const seq = o.diverging === false, col = (v) => (!isFinite(v) ? (light() ? '#e5e7eb' : '#05070c') : seq ? cmap(o.cmap || 'viridis', v / (mx || 1)) : divColor(v, mx));
  c.fillStyle = BG(); c.fillRect(0, 0, w, h); const gap = cw > 6 && ch > 6 ? 1 : 0, rad = cw > 10 && ch > 10 ? 2 : 0;
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { c.fillStyle = col(M[i][j]); const x = padL + j * cw, y = padT + i * ch; if (rad) { rrect(c, x, y, cw - gap, ch - gap, rad); c.fill(); } else c.fillRect(x, y, Math.ceil(cw) - gap, Math.ceil(ch) - gap); }
  c.fillStyle = FG(); c.font = `9.5px ${MONO()}`; c.textBaseline = 'middle'; c.textAlign = 'right'; const rs = Math.max(1, Math.ceil(11 / ch));
  for (let i = 0; i < R; i += rs) c.fillText(String(o.rows ? o.rows[i] : i).slice(0, 7), padL - 5, padT + i * ch + ch / 2);
  if (o.cols) { c.textAlign = 'left'; c.textBaseline = 'alphabetic'; const step = Math.max(1, Math.ceil(C / ((w - padL - padR) / 34))); for (let j = 0; j < C; j += step) c.fillText(String(o.cols[j]).slice(0, 6), padL + j * cw + 1, padT - 5); }
  if (cb && mx > 0) colorbar(c, w - padR + 10, padT, 9, Math.min(h - padT - 6, 160), seq ? 0 : -mx, mx, (v) => col(v));
  if (o.mark) { c.strokeStyle = css('--w', '#f5b94a'); c.lineWidth = 2; c.shadowColor = c.strokeStyle; c.shadowBlur = 8; c.strokeRect(padL + o.mark[1] * cw, padT + o.mark[0] * ch, cw, ch); c.shadowBlur = 0; }
  const at = (e) => { const r = cv.getBoundingClientRect(); const j = Math.floor((e.clientX - r.left - padL) / cw), i = Math.floor((e.clientY - r.top - padT) / ch); return i >= 0 && i < R && j >= 0 && j < C ? [i, j] : null; };
  cv.style.cursor = o.onClick ? 'pointer' : 'crosshair';
  cv.onmousemove = (e) => { const p = at(e); showTip(e, p ? (o.label ? o.label(p[0], p[1]) : `[${o.rows ? o.rows[p[0]] : p[0]}, ${o.cols ? o.cols[p[1]] : p[1]}]  ${(+M[p[0]][p[1]]).toFixed(4)}`) : ''); };
  cv.onmouseleave = () => showTip(null, ''); cv.onclick = (e) => { const p = at(e); if (p && o.onClick) o.onClick(p[0], p[1]); };
}
// series: [{ys:[...], color, width, label}], xs labels optional
export function lines(cv, series, o = {}) {
  stamp(cv); cv._redraw = () => { cv._inRedraw = true; try { lines(cv, series, o); } finally { cv._inRedraw = false; } };
  cv._csv = () => { const n = Math.max(...series.map((s) => s.ys.length)); return ['x,' + series.map((s, i) => JSON.stringify(s.label || 's' + i)).join(','), ...Array.from({ length: n }, (_, i) => [JSON.stringify(String(o.xs ? o.xs[i] : i)), ...series.map((s) => s.ys[i] ?? '')].join(','))].join('\n'); };
  const h = o.h || 160; let lo = o.min ?? Infinity, hi = o.max ?? -Infinity;
  for (const s of series) for (const y of s.ys) if (isFinite(y)) { if (o.min == null) lo = Math.min(lo, y); if (o.max == null) hi = Math.max(hi, y); }
  if (!isFinite(lo)) { lo = 0; hi = 1; } if (!(hi > lo)) hi = lo + 1; if (o.min == null && o.max == null) { const pd = (hi - lo) * 0.06; lo -= lo >= 0 && lo - pd < 0 ? lo : pd; hi += pd; }
  const ticks = niceTicks(lo, hi, Math.max(3, Math.round(h / 40))), padL = 44, padT = o.title ? 22 : 10, padB = 20, padR = 10, n = Math.max(...series.map((s) => s.ys.length), 1);
  const labeled = series.filter((s) => s.label); let hover = -1;
  const draw = () => {
    const [c, w] = fit(cv, h), X = (i) => padL + (i / Math.max(1, n - 1)) * (w - padL - padR), Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
    c.fillStyle = BG(); c.fillRect(0, 0, w, h);
    c.font = `9.5px ${MONO()}`; c.textBaseline = 'middle'; c.textAlign = 'right'; c.lineWidth = 1;
    for (const t of ticks) { const y = Math.round(Y(t)) + 0.5; c.strokeStyle = t === 0 ? axisC() : gridC(); c.beginPath(); c.moveTo(padL, y); c.lineTo(w - padR, y); c.stroke(); c.fillStyle = FG(); c.fillText(tfmt(t), padL - 6, y); }
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; const st = Math.max(1, Math.ceil(n / Math.max(2, (w - padL) / 52)));
    for (let i = 0; i < n; i += st) { const x = Math.round(X(i)) + 0.5; c.strokeStyle = gridC(); c.beginPath(); c.moveTo(x, padT); c.lineTo(x, h - padB); c.stroke(); c.fillStyle = FG(); c.fillText(String(o.xs ? o.xs[i] : i).slice(0, 7), x, h - 6); }
    c.strokeStyle = axisC(); c.beginPath(); c.moveTo(padL + 0.5, padT); c.lineTo(padL + 0.5, h - padB + 0.5); c.lineTo(w - padR, h - padB + 0.5); c.stroke();
    series.forEach((s, si) => { const color = s.color || SERIES[si % SERIES.length]; const pts = []; s.ys.forEach((y, i) => { if (isFinite(y)) pts.push([X(i), Y(y)]); }); if (!pts.length) return;
      if (series.length <= 2 && (s.width || 1) >= 1 && color.length <= 7) { const g = c.createLinearGradient(0, padT, 0, h - padB); g.addColorStop(0, color + '38'); g.addColorStop(1, color + '00'); c.fillStyle = g; c.beginPath(); c.moveTo(pts[0][0], h - padB); for (const [x, y] of pts) c.lineTo(x, y); c.lineTo(pts[pts.length - 1][0], h - padB); c.closePath(); c.fill(); }
      c.strokeStyle = color; c.lineWidth = Math.max(1.25, (s.width || 1) * 1.4); if (series.length <= 4) { c.shadowColor = color; c.shadowBlur = 6; } c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.shadowBlur = 0;
      if (pts.length === 1) { c.fillStyle = color; c.beginPath(); c.arc(pts[0][0], pts[0][1], 3, 0, 7); c.fill(); } });
    title(c, o.title, padL);
    if (labeled.length > 1 && labeled.length <= 8) { c.font = `10px ${SANS()}`; c.textBaseline = 'middle'; c.textAlign = 'left'; let x = w - padR; const y = o.title ? 14 : padT + 8; for (const s of [...labeled].reverse()) { const tw = c.measureText(s.label).width; x -= tw + 22; c.fillStyle = s.color || SERIES[series.indexOf(s) % SERIES.length]; rrect(c, x, y - 3, 12, 6, 3); c.fill(); c.fillStyle = TX(); c.fillText(s.label, x + 16, y); } }
    if (hover >= 0) { const x = X(hover); c.strokeStyle = axisC(); c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x, padT); c.lineTo(x, h - padB); c.stroke(); c.setLineDash([]); series.forEach((s, si) => { const y = s.ys[hover]; if (!isFinite(y)) return; c.fillStyle = BG(); c.strokeStyle = s.color || SERIES[si % SERIES.length]; c.lineWidth = 2; c.beginPath(); c.arc(x, Y(y), 3.5, 0, 7); c.fill(); c.stroke(); }); }
    return w;
  };
  const w = draw();
  cv.onmousemove = (e) => { const r = cv.getBoundingClientRect(); const i = Math.round(((e.clientX - r.left - padL) / (r.width - padL - padR)) * (n - 1)); if (i < 0 || i >= n) { hover = -1; draw(); return showTip(e, ''); } if (i !== hover) { hover = i; draw(); } showTip(e, (o.xs ? o.xs[i] + '\n' : `x=${i}\n`) + series.filter((s) => s.label).map((s) => `${s.label}: ${s.ys[i]?.toFixed?.(4)}`).join('\n')); };
  cv.onmouseleave = () => { hover = -1; draw(); showTip(null, ''); }; void w;
}
export function bars(cv, ys, o = {}) {
  stamp(cv); cv._redraw = () => { cv._inRedraw = true; try { bars(cv, ys, o); } finally { cv._inRedraw = false; } };
  cv._csv = () => ['i,label,value', ...ys.map((y, i) => `${i},${JSON.stringify(o.label ? o.label(i) : String(i))},${y}`)].join('\n');
  const h = o.h || 130, n = ys.length; let mx = o.max ?? Math.max(...ys.map(Math.abs)), lo = o.log ? Math.log10(Math.max(1e-12, Math.min(...ys.filter((y) => y > 0)))) : 0; if (!(mx > 0)) mx = 1;
  const padT = o.title ? 22 : 8, padB = 8, padL = 4; let hover = -1;
  const draw = () => { const [c, w] = fit(cv, h), bw = (w - padL - 4) / n, base = h - padB, H2 = base - padT;
    c.fillStyle = BG(); c.fillRect(0, 0, w, h); c.lineWidth = 1; for (let k = 1; k <= 3; k++) { const y = Math.round(base - (H2 * k) / 4) + 0.5; c.strokeStyle = gridC(); c.beginPath(); c.moveTo(padL, y); c.lineTo(w - 4, y); c.stroke(); }
    c.strokeStyle = axisC(); c.beginPath(); c.moveTo(padL, base + 0.5); c.lineTo(w - 4, base + 0.5); c.stroke();
    ys.forEach((y, i) => { let f = o.log ? (Math.log10(Math.max(y, 1e-12)) - lo) / (Math.log10(mx) - lo || 1) : Math.abs(y) / mx; f = Math.max(0, Math.min(1, f)); const col = o.colors ? o.colors[i] : y < 0 ? '#8ea2ff' : '#4fd8c4', bh = Math.max(f > 0 ? 1 : 0, f * H2), x = padL + i * bw + (bw > 4 ? bw * 0.12 : 0), ww = Math.max(1, bw > 4 ? bw * 0.76 : bw - (bw > 2 ? 0.5 : 0));
      if (bw > 3 && /^#[0-9a-f]{6}$/i.test(col)) { const g = c.createLinearGradient(0, base - bh, 0, base); g.addColorStop(0, col); g.addColorStop(1, col + '66'); c.fillStyle = g; } else c.fillStyle = col;
      if (i === hover) { c.shadowColor = col; c.shadowBlur = 10; } if (bw > 6) { rrect(c, x, base - bh, ww, bh, Math.min(3, ww / 2)); c.fill(); } else c.fillRect(x, base - bh, ww, bh); c.shadowBlur = 0; });
    if (hover >= 0) { c.fillStyle = '#ffffff10'; c.fillRect(padL + hover * bw, padT, bw, H2); }
    c.font = `9.5px ${MONO()}`; c.fillStyle = FG(); c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(o.log ? '1e' + Math.log10(mx).toFixed(1) : tfmt(mx), w - 6, padT + 1); title(c, o.title, 6); return bw; };
  let bw = draw(); const idx = (e) => { const r = cv.getBoundingClientRect(); return Math.floor((e.clientX - r.left - padL) / ((r.width - padL - 4) / n)); };
  cv.onmousemove = (e) => { const i = idx(e); const ok = i >= 0 && i < n; if ((ok ? i : -1) !== hover) { hover = ok ? i : -1; bw = draw(); } showTip(e, ok ? (o.label ? o.label(i) : `${i}: ${ys[i].toPrecision(4)}`) : ''); }; cv.onmouseleave = () => { hover = -1; draw(); showTip(null, ''); };
  if (o.onClick) { cv.style.cursor = 'pointer'; cv.onclick = (e) => { const i = idx(e); if (i >= 0 && i < n) o.onClick(i); }; } void bw;
}

// scatter: pts [{x,y,c,r,label}], optional polylines [{pts:[[x,y]..], color}]
export function scatter(cv, pts, o = {}) {
  stamp(cv); cv._redraw = () => { cv._inRedraw = true; try { scatter(cv, pts, o); } finally { cv._inRedraw = false; } };
  const h = o.h || 260, [c, w] = fit(cv, h), pad = 14, padT = o.title ? 24 : pad; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); } if (!(x1 > x0)) x1 = x0 + 1; if (!(y1 > y0)) y1 = y0 + 1;
  const X = (x) => pad + ((x - x0) / (x1 - x0)) * (w - 2 * pad), Y = (y) => h - pad - ((y - y0) / (y1 - y0)) * (h - pad - padT);
  c.fillStyle = BG(); c.fillRect(0, 0, w, h); c.lineWidth = 1;
  for (const t of niceTicks(x0, x1, 6)) { const x = Math.round(X(t)) + 0.5; c.strokeStyle = t === 0 ? axisC() : gridC(); c.beginPath(); c.moveTo(x, padT); c.lineTo(x, h - pad); c.stroke(); }
  for (const t of niceTicks(y0, y1, 5)) { const y = Math.round(Y(t)) + 0.5; c.strokeStyle = t === 0 ? axisC() : gridC(); c.beginPath(); c.moveTo(pad, y); c.lineTo(w - pad, y); c.stroke(); }
  for (const ln of o.lines || []) { c.strokeStyle = ln.color || axisC(); c.lineWidth = (ln.width || 1) * 1.2; c.beginPath(); ln.pts.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.stroke(); }
  const many = pts.length > 600; c.globalCompositeOperation = light() ? 'source-over' : 'lighter';
  for (const p of pts) { const col = p.c || '#4fd8c4', r = p.r || 2.5; if (!many && r >= 2) { c.fillStyle = col.length === 7 ? col + '2a' : col; c.beginPath(); c.arc(X(p.x), Y(p.y), r * 2.2, 0, 7); c.fill(); } c.fillStyle = col; c.beginPath(); c.arc(X(p.x), Y(p.y), r, 0, 7); c.fill(); }
  c.globalCompositeOperation = 'source-over';
  for (const p of pts) if (p.text) { c.fillStyle = TX(); c.font = `10px ${SANS()}`; c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.fillText(p.text, X(p.x) + 5, Y(p.y) - 4); }
  title(c, o.title, 8);
  cv._csv = () => ['x,y,label', ...pts.map((p) => `${p.x},${p.y},${JSON.stringify(p.label || '')}`)].join('\n');
  const near = (e) => { const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; let b = null, bd = 100; for (const p of pts) { const dd = (X(p.x) - mx) ** 2 + (Y(p.y) - my) ** 2; if (dd < bd) { bd = dd; b = p; } } return b; };
  cv.onmousemove = (e) => { const p = near(e); cv.style.cursor = p ? 'pointer' : 'crosshair'; showTip(e, p ? p.label || `${p.x.toFixed(3)}, ${p.y.toFixed(3)}` : ''); }; cv.onmouseleave = () => showTip(null, '');
  if (o.onClick) cv.onclick = (e) => { const p = near(e); if (p) o.onClick(p); };
}

export function redrawAll() { for (const c of document.querySelectorAll('canvas')) if (c._redraw && c.offsetParent) try { c._redraw(); } catch (e) { console.warn(e); } }

// v12.1 freshness stamps: every chart records when it was computed and under which model state ("generation", bumped on
// every weight/runtime edit). When the model changes, older charts are labelled stale instead of silently showing old results.
let GEN = 0; export const modelGen = () => GEN;
export function stampText(at, gen, cur) { const t = new Date(at).toTimeString().slice(0, 8); return gen === cur ? `computed ${t} · current model state` : `last run at ${t} · ⚠ model changed since (state #${gen} → #${cur}); rerun for the current state`; }
function stamp(cv) { if (cv._inRedraw || typeof document === 'undefined') return; cv._at = Date.now(); cv._gen = GEN; let el = cv.nextElementSibling; if (!el || !el.classList?.contains('cstamp')) { el = document.createElement('div'); el.className = 'cstamp sm'; cv.after(el); } el.classList.remove('stale'); el.textContent = stampText(cv._at, GEN, GEN); }
export function markStale() { GEN++; if (typeof document === 'undefined') return GEN; for (const c of document.querySelectorAll('canvas')) if (c._at && c.nextElementSibling?.classList?.contains('cstamp')) { const el = c.nextElementSibling, st = c._gen !== GEN; el.classList.toggle('stale', st); el.textContent = stampText(c._at, c._gen, GEN); } return GEN; }

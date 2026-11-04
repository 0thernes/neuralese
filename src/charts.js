// Canvas charts (v15): HiDPI, axes + gridlines + nice ticks, legends, colorbars, perceptual colormaps, hover crosshairs.
// heatmap (hover/click), multi-line, bars, scatter. No dependencies.
const tip = () => document.getElementById('tip');
const css = (v, f) => (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue(v).trim()) || f;
export const BG = () => css('--chart-bg', '#0a0f1a'), FG = () => css('--m', '#7c89a3'), GRID = () => css('--b', '#1f2a42'), TX = () => css('--t', '#dbe4f3');
const light = () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light';
const MONO = () => css('--mono', 'ui-monospace,monospace'), SANS = () => css('--sans', 'system-ui,sans-serif');
const gridC = () => (light() ? '#0f172a12' : '#ffffff0e'), axisC = () => (light() ? '#0f172a40' : '#ffffff2a');
export const SERIES = ['#4fd8c4', '#8ea2ff', '#f472b6', '#f5b94a', '#b794f6', '#fb923c', '#4ade80', '#38bdf8'];
// v15.1 helpers: reduced-motion check and a tiny cross-highlight bus (charts with the same o.sync key share a hovered index)
export const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export function emit(key, i) { if (!key || typeof document === 'undefined') return; document.dispatchEvent(new CustomEvent('nl-hl', { detail: { key, i } })); }
function listen(cv, key, f) { if (!key || typeof document === 'undefined') return; if (cv._hlOff) cv._hlOff(); const h = (e) => { if (e.detail.key === key && cv.isConnected) f(e.detail.i); }; document.addEventListener('nl-hl', h); cv._hlOff = () => document.removeEventListener('nl-hl', h); }
export function showTip(e, text) { const t = tip(); if (!t) return; if (!text) { t.style.display = 'none'; return; } t.textContent = text; t.style.display = 'block'; const w = t.offsetWidth || 200, hh = t.offsetHeight || 40; t.style.left = Math.max(4, Math.min(e.clientX + 14, innerWidth - w - 8)) + 'px'; t.style.top = Math.max(4, Math.min(e.clientY + 14, innerHeight - hh - 8)) + 'px'; }
// ── colormaps: piecewise-linear interpolation through published anchor colors (perceptually uniform sequential maps)
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const MAPS = {
  viridis: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'].map(hex),
  magma: ['#000004', '#180f3d', '#440f76', '#721f81', '#9e2f7f', '#cd4071', '#f1605d', '#fd9668', '#feca8d', '#fcfdbf'].map(hex),
};
const DIV_DARK = ['#9ccfff', '#4f8fe0', '#2b4f8a', '#1a2233', '#8a3a28', '#d9653a', '#ffc078'].map(hex), DIV_LIGHT = ['#1d4f9c', '#4a86d4', '#a9c8ee', '#f4f5f7', '#f0b09a', '#d4593a', '#8f2412'].map(hex);
function ramp(stops, x) { x = Math.max(0, Math.min(1, x)); const f = x * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), t = f - i, a = stops[i], b = stops[i + 1]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rasterHeat(cv, c, M, g, done) {
  const { R, C, w, h, padL, padT, cw, ch, mx, seq } = g;
  const Off = typeof OffscreenCanvas === 'function' ? OffscreenCanvas : null;
  const off = Off ? new Off(C, R) : Object.assign(document.createElement('canvas'), { width: C, height: R });
  const ic = off.getContext('2d', { willReadFrequently: true });
  const img = ic.createImageData(C, R), data = img.data;
  const stops = seq ? (MAPS[g.cmap] || MAPS.viridis) : (g.light ? DIV_LIGHT : DIV_DARK);
  const empty = g.light ? [229, 231, 235] : [5, 7, 12];
  const gen = (cv._paintGen = (cv._paintGen || 0) + 1);
  let row = 0;
  const blit = () => {
    if (cv._paintGen !== gen || !cv.isConnected) return;
    ic.putImageData(img, 0, 0);
    c.setTransform(devicePixelRatio || 1, 0, 0, devicePixelRatio || 1, 0, 0);
    c.fillStyle = BG(); c.fillRect(0, 0, w, h);
    c.imageSmoothingEnabled = false;
    c.drawImage(off, padL, padT, Math.max(1, C * cw), Math.max(1, R * ch));
  };
  const step = () => {
    if (cv._paintGen !== gen || !cv.isConnected) return;
    const t0 = performance.now();
    while (row < R && performance.now() - t0 < 16) {
      const mr = M[row], base = row * C * 4;
      for (let j = 0; j < C; j++) {
        const v = mr[j]; let rgb = empty;
        if (isFinite(v)) { if (seq) rgb = ramp(stops, mx ? v / mx : 0); else { const x = Math.max(-1, Math.min(1, v / (mx || 1))); rgb = ramp(stops, (x + 1) / 2); } }
        const p = base + j * 4; data[p] = rgb[0]; data[p + 1] = rgb[1]; data[p + 2] = rgb[2]; data[p + 3] = 255;
      }
      row++;
    }
    blit();
    if (row < R) setTimeout(step, 0);
    else if (done) done();
  };
  step();
}
const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
export const cmap = (name, x) => rgb(ramp(MAPS[name] || MAPS.viridis, x));
export const viridisBytes = (t) => ramp(MAPS.viridis, Math.max(0, Math.min(1, t)));
export function stampGrid(ctx, x, y, dw, dh, cols, rows, colorAt) {
  if (!cols || !rows || dw <= 0 || dh <= 0) return;
  const Off = typeof OffscreenCanvas === 'function' ? OffscreenCanvas : null;
  const off = Off ? new Off(cols, rows) : Object.assign(document.createElement('canvas'), { width: cols, height: rows });
  const ic = off.getContext('2d'); const img = ic.createImageData(cols, rows), d = img.data;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const c = colorAt(i, j) || [0, 0, 0, 0]; const p = (i * cols + j) * 4;
    d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = c[3] ?? 255;
  }
  ic.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(off, x, y, dw, dh);
}
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
  const labels = () => {
    c.setTransform(devicePixelRatio || 1, 0, 0, devicePixelRatio || 1, 0, 0);
    c.fillStyle = FG(); c.font = `9.5px ${MONO()}`; c.textBaseline = 'middle'; c.textAlign = 'right'; const rs = Math.max(1, Math.ceil(11 / ch));
    for (let i = 0; i < R; i += rs) c.fillText(String(o.rows ? o.rows[i] : i).slice(0, 7), padL - 5, padT + i * ch + ch / 2);
    if (o.cols) { c.textAlign = 'left'; c.textBaseline = 'alphabetic'; const step = Math.max(1, Math.ceil(C / ((w - padL - padR) / 34))); for (let j = 0; j < C; j += step) c.fillText(String(o.cols[j]).slice(0, 6), padL + j * cw + 1, padT - 5); }
    if (cb && mx > 0) colorbar(c, w - padR + 10, padT, 9, Math.min(h - padT - 6, 160), seq ? 0 : -mx, mx, (v) => col(v));
  };
  // A head×token map is hundreds of thousands of cells. fillRect plus a colour string per cell
  // was a 0.5–2s main-thread task. Large maps rasterise on an OffscreenCanvas in 16ms slices.
  if (R * C > 4096 && C > 0) rasterHeat(cv, c, M, { R, C, w, h, padL, padT, cw, ch, mx, seq, cmap: o.cmap, light: light() }, labels);
  else { for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { c.fillStyle = col(M[i][j]); const x = padL + j * cw, y = padT + i * ch; if (rad) { rrect(c, x, y, cw - gap, ch - gap, rad); c.fill(); } else c.fillRect(x, y, Math.ceil(cw) - gap, Math.ceil(ch) - gap); } labels(); }
  if (o.mark) { c.strokeStyle = css('--w', '#f5b94a'); c.lineWidth = 2; c.shadowColor = c.strokeStyle; c.shadowBlur = 8; c.strokeRect(padL + o.mark[1] * cw, padT + o.mark[0] * ch, cw, ch); c.shadowBlur = 0; }
  if (o.sync && cv._hl >= 0) { const ax = o.syncAxis || 'both'; c.strokeStyle = TX(); c.lineWidth = 1; c.globalAlpha = 0.85; if (ax !== 'col' && cv._hl < R) c.strokeRect(padL + 0.5, padT + cv._hl * ch + 0.5, C * cw - 1, ch - 1); if (ax !== 'row' && cv._hl < C) c.strokeRect(padL + cv._hl * cw + 0.5, padT + 0.5, cw - 1, R * ch - 1); c.globalAlpha = 1; }
  listen(cv, o.sync, (i) => { if (i !== cv._hl) { cv._hl = i; cv._redraw(); } });
  const at = (e) => { const r = cv.getBoundingClientRect(); const j = Math.floor((e.clientX - r.left - padL) / cw), i = Math.floor((e.clientY - r.top - padT) / ch); return i >= 0 && i < R && j >= 0 && j < C ? [i, j] : null; };
  cv.style.cursor = o.onClick ? 'pointer' : 'crosshair';
  cv.onmousemove = (e) => { const p = at(e); if (o.sync) { const ii = p ? p[o.syncAxis === 'col' ? 1 : 0] : -1; if (ii !== cv._hl) { cv._hl = ii; emit(o.sync, ii); } } showTip(e, p ? (o.label ? o.label(p[0], p[1]) : `[${o.rows ? o.rows[p[0]] : p[0]}, ${o.cols ? o.cols[p[1]] : p[1]}]  ${(+M[p[0]][p[1]]).toFixed(4)}`) : ''); };
  cv.onmouseleave = () => { showTip(null, ''); if (o.sync) emit(o.sync, -1); }; cv.onclick = (e) => { const p = at(e); if (p && o.onClick) o.onClick(p[0], p[1]); };
}
// series: [{ys:[...], color, width, label}], xs labels optional.
// v15.1: animated transitions between consecutive draws of the same canvas, drag-to-zoom (brush) on x, double-click to reset,
// and synced cross-highlighting: charts sharing o.sync ('tok', …) show the same hovered index.
export function lines(cv, series, o = {}) {
  stamp(cv); cv._redraw = () => { cv._inRedraw = true; try { lines(cv, series, o); } finally { cv._inRedraw = false; } };
  cv._csv = () => { const n = Math.max(...series.map((s) => s.ys.length)); return ['x,' + series.map((s, i) => JSON.stringify(s.label || 's' + i)).join(','), ...Array.from({ length: n }, (_, i) => [JSON.stringify(String(o.xs ? o.xs[i] : i)), ...series.map((s) => s.ys[i] ?? '')].join(','))].join('\n'); };
  const h = o.h || 160, n = Math.max(...series.map((s) => s.ys.length), 1); let view = cv._view && cv._view.n === n ? cv._view : { a: 0, b: n - 1, n }; cv._view = view;
  const prev = !cv._inRedraw && !reduced() && typeof requestAnimationFrame === 'function' && cv._lastYs && cv._lastYs.length === series.length && cv._lastYs.every((p, i) => p.length === series[i].ys.length) ? cv._lastYs : null;
  cv._lastYs = series.map((s) => Array.from(s.ys)); let k = prev ? 0 : 1, hover = -1, brush = null;
  const val = (si, i) => { const y = series[si].ys[i]; if (k >= 1 || !prev) return y; const p = prev[si][i]; return isFinite(p) && isFinite(y) ? p + (y - p) * k : y; };
  const range = () => { let lo = o.min ?? Infinity, hi = o.max ?? -Infinity; for (const s of series) for (let i = view.a; i <= view.b; i++) { const y = s.ys[i]; if (isFinite(y)) { if (o.min == null) lo = Math.min(lo, y); if (o.max == null) hi = Math.max(hi, y); } }
    if (!isFinite(lo)) { lo = 0; hi = 1; } if (!(hi > lo)) hi = lo + 1; if (o.min == null && o.max == null) { const pd = (hi - lo) * 0.06; lo -= lo >= 0 && lo - pd < 0 ? lo : pd; hi += pd; } return [lo, hi]; };
  const padL = 44, padT = o.title ? 22 : 10, padB = 20, padR = 10, labeled = series.filter((s) => s.label);
  const draw = () => {
    const [lo, hi] = range(), ticks = niceTicks(lo, hi, Math.max(3, Math.round(h / 40))), span = Math.max(1, view.b - view.a);
    const [c, w] = fit(cv, h), X = (i) => padL + ((i - view.a) / span) * (w - padL - padR), Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
    c.fillStyle = BG(); c.fillRect(0, 0, w, h);
    c.font = `9.5px ${MONO()}`; c.textBaseline = 'middle'; c.textAlign = 'right'; c.lineWidth = 1;
    for (const t of ticks) { const y = Math.round(Y(t)) + 0.5; c.strokeStyle = t === 0 ? axisC() : gridC(); c.beginPath(); c.moveTo(padL, y); c.lineTo(w - padR, y); c.stroke(); c.fillStyle = FG(); c.fillText(tfmt(t), padL - 6, y); }
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; const st = Math.max(1, Math.ceil((span + 1) / Math.max(2, (w - padL) / 52)));
    for (let i = view.a; i <= view.b; i += st) { const x = Math.round(X(i)) + 0.5; c.strokeStyle = gridC(); c.beginPath(); c.moveTo(x, padT); c.lineTo(x, h - padB); c.stroke(); c.fillStyle = FG(); c.fillText(String(o.xs ? o.xs[i] : i).slice(0, 7), x, h - 6); }
    c.strokeStyle = axisC(); c.beginPath(); c.moveTo(padL + 0.5, padT); c.lineTo(padL + 0.5, h - padB + 0.5); c.lineTo(w - padR, h - padB + 0.5); c.stroke();
    c.save(); c.beginPath(); c.rect(padL, 0, w - padL - padR + 1, h); c.clip();
    series.forEach((s, si) => { const color = s.color || SERIES[si % SERIES.length]; const pts = []; for (let i = Math.max(0, view.a - 1); i <= Math.min(s.ys.length - 1, view.b + 1); i++) { const y = val(si, i); if (isFinite(y)) pts.push([X(i), Y(y)]); } if (!pts.length) return;
      if (series.length <= 2 && (s.width || 1) >= 1 && color.length <= 7) { const g = c.createLinearGradient(0, padT, 0, h - padB); g.addColorStop(0, color + '38'); g.addColorStop(1, color + '00'); c.fillStyle = g; c.beginPath(); c.moveTo(pts[0][0], h - padB); for (const [x, y] of pts) c.lineTo(x, y); c.lineTo(pts[pts.length - 1][0], h - padB); c.closePath(); c.fill(); }
      c.strokeStyle = color; c.lineWidth = Math.max(1.25, (s.width || 1) * 1.4); c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      if (pts.length === 1) { c.fillStyle = color; c.beginPath(); c.arc(pts[0][0], pts[0][1], 3, 0, 7); c.fill(); } });
    c.restore();
    title(c, o.title, padL);
    if (labeled.length > 1 && labeled.length <= 8) { c.font = `10px ${SANS()}`; c.textBaseline = 'middle'; c.textAlign = 'left'; let x = w - padR; const y = o.title ? 14 : padT + 8; for (const s of [...labeled].reverse()) { const tw = c.measureText(s.label).width; x -= tw + 22; c.fillStyle = s.color || SERIES[series.indexOf(s) % SERIES.length]; rrect(c, x, y - 3, 12, 6, 3); c.fill(); c.fillStyle = TX(); c.fillText(s.label, x + 16, y); } }
    if (view.a > 0 || view.b < n - 1) { c.font = `10px ${SANS()}`; c.fillStyle = css('--acc', '#4fd8c4'); c.textAlign = 'right'; c.textBaseline = 'alphabetic'; c.fillText(`zoom ${view.a}–${view.b} · double-click to reset`, w - padR, h - padB - 4); }
    if (brush) { const x0 = Math.min(brush[0], brush[1]), x1 = Math.max(brush[0], brush[1]); c.fillStyle = light() ? '#0f172a14' : '#ffffff14'; c.fillRect(x0, padT, x1 - x0, h - padT - padB); c.strokeStyle = axisC(); c.strokeRect(x0 + 0.5, padT + 0.5, x1 - x0, h - padT - padB); }
    if (hover >= view.a && hover <= view.b) { const x = X(hover); c.strokeStyle = axisC(); c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x, padT); c.lineTo(x, h - padB); c.stroke(); c.setLineDash([]); series.forEach((s, si) => { const y = s.ys[hover]; if (!isFinite(y)) return; c.fillStyle = BG(); c.strokeStyle = s.color || SERIES[si % SERIES.length]; c.lineWidth = 2; c.beginPath(); c.arc(x, Y(y), 3.5, 0, 7); c.fill(); c.stroke(); }); }
    return w;
  };
  draw();
  if (prev) { const t0 = performance.now(), step = (t) => { k = Math.min(1, (t - t0) / 320); k = 1 - (1 - k) ** 3; draw(); if (k < 1 && cv.isConnected) requestAnimationFrame(step); }; requestAnimationFrame(step); }
  const idxAt = (e) => { const r = cv.getBoundingClientRect(); return Math.round(view.a + ((e.clientX - r.left - padL) / (r.width - padL - padR)) * Math.max(1, view.b - view.a)); };
  cv.onpointerdown = (e) => { if (n < 4 || e.button !== 0) return; const r = cv.getBoundingClientRect(); brush = [e.clientX - r.left, e.clientX - r.left]; };
  cv.onmousemove = (e) => { const r = cv.getBoundingClientRect(); if (brush && e.buttons & 1) { brush[1] = Math.max(padL, Math.min(r.width - padR, e.clientX - r.left)); draw(); return; } const i = idxAt(e); if (i < view.a || i > view.b) { hover = -1; draw(); emit(o.sync, -1); return showTip(e, ''); } if (i !== hover) { hover = i; draw(); emit(o.sync, i); } showTip(e, (o.xs ? o.xs[i] + '\n' : `x=${i}\n`) + series.filter((s) => s.label).map((s) => `${s.label}: ${s.ys[i]?.toFixed?.(4)}`).join('\n')); };
  cv.onpointerup = (e) => { if (!brush) return; const r = cv.getBoundingClientRect(), span = Math.max(1, view.b - view.a), toI = (px) => Math.round(view.a + ((px - padL) / (r.width - padL - padR)) * span), a = toI(Math.min(...brush)), b = toI(Math.max(...brush)); const wide = Math.abs(brush[1] - brush[0]) > 8; brush = null; if (wide && b - a >= 2) { view = cv._view = { a: Math.max(0, a), b: Math.min(n - 1, b), n }; } draw(); void e; };
  cv.ondblclick = () => { view = cv._view = { a: 0, b: n - 1, n }; draw(); };
  cv.onmouseleave = () => { hover = -1; brush = null; draw(); showTip(null, ''); emit(o.sync, -1); };
  listen(cv, o.sync, (i) => { if (i !== hover) { hover = i; draw(); } });
}
export function bars(cv, ys, o = {}) {
  stamp(cv); cv._redraw = () => { cv._inRedraw = true; try { bars(cv, ys, o); } finally { cv._inRedraw = false; } };
  cv._csv = () => ['i,label,value', ...ys.map((y, i) => `${i},${JSON.stringify(o.label ? o.label(i) : String(i))},${y}`)].join('\n');
  const h = o.h || 130, n = ys.length; let mx = o.max ?? Math.max(...ys.map(Math.abs)), lo = o.log ? Math.log10(Math.max(1e-12, Math.min(...ys.filter((y) => y > 0)))) : 0; if (!(mx > 0)) mx = 1;
  const padT = o.title ? 22 : 8, padB = 8, padL = 4; let hover = -1, k = !cv._inRedraw && !reduced() && typeof requestAnimationFrame === 'function' ? 0 : 1;
  const draw = () => { const [c, w] = fit(cv, h), bw = (w - padL - 4) / n, base = h - padB, H2 = base - padT;
    c.fillStyle = BG(); c.fillRect(0, 0, w, h); c.lineWidth = 1; for (let k = 1; k <= 3; k++) { const y = Math.round(base - (H2 * k) / 4) + 0.5; c.strokeStyle = gridC(); c.beginPath(); c.moveTo(padL, y); c.lineTo(w - 4, y); c.stroke(); }
    c.strokeStyle = axisC(); c.beginPath(); c.moveTo(padL, base + 0.5); c.lineTo(w - 4, base + 0.5); c.stroke();
    ys.forEach((y, i) => { let f = o.log ? (Math.log10(Math.max(y, 1e-12)) - lo) / (Math.log10(mx) - lo || 1) : Math.abs(y) / mx; f = Math.max(0, Math.min(1, f)); const col = o.colors ? o.colors[i] : y < 0 ? '#8ea2ff' : '#4fd8c4', bh = Math.max(f > 0 ? 1 : 0, f * H2 * k), x = padL + i * bw + (bw > 4 ? bw * 0.12 : 0), ww = Math.max(1, bw > 4 ? bw * 0.76 : bw - (bw > 2 ? 0.5 : 0));
      if (bw > 3 && /^#[0-9a-f]{6}$/i.test(col)) { const g = c.createLinearGradient(0, base - bh, 0, base); g.addColorStop(0, col); g.addColorStop(1, col + '66'); c.fillStyle = g; } else c.fillStyle = col;
      if (i === hover) { c.shadowColor = col; c.shadowBlur = 10; } if (bw > 6) { rrect(c, x, base - bh, ww, bh, Math.min(3, ww / 2)); c.fill(); } else c.fillRect(x, base - bh, ww, bh); c.shadowBlur = 0; });
    if (hover >= 0) { c.fillStyle = '#ffffff10'; c.fillRect(padL + hover * bw, padT, bw, H2); }
    c.font = `9.5px ${MONO()}`; c.fillStyle = FG(); c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(o.log ? '1e' + Math.log10(mx).toFixed(1) : tfmt(mx), w - 6, padT + 1); title(c, o.title, 6); return bw; };
  let bw = draw(); if (k < 1) { const t0 = performance.now(), step = (t) => { k = Math.min(1, (t - t0) / 380); k = 1 - (1 - k) ** 3; bw = draw(); if (k < 1 && cv.isConnected) requestAnimationFrame(step); }; requestAnimationFrame(step); }
  const idx = (e) => { const r = cv.getBoundingClientRect(); return Math.floor((e.clientX - r.left - padL) / ((r.width - padL - 4) / n)); };
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

// v15.1 attention arc diagram: tokens along a baseline, arcs from each query q to its keys k (height ∝ distance,
// width/opacity ∝ weight). Hovering a token isolates its arcs; o.sync shares the hovered token with other charts.
export function arcs(cv, labels, A, o = {}) {
  stamp(cv); cv._redraw = () => { cv._inRedraw = true; try { arcs(cv, labels, A, o); } finally { cv._inRedraw = false; } };
  const T = labels.length, h = o.h || 210, thr = o.min ?? 0.04; let hover = -1, k = !cv._inRedraw && !reduced() && typeof requestAnimationFrame === 'function' ? 0 : 1;
  cv._csv = () => ['query,key,weight', ...A.flatMap((r, q) => Array.from(r, (v, j) => `${q},${j},${v}`))].join('\n');
  const draw = () => { const [c, w] = fit(cv, h), padX = 18, base = h - 34, dx = (w - 2 * padX) / Math.max(1, T - 1), X = (i) => padX + i * dx;
    c.fillStyle = BG(); c.fillRect(0, 0, w, h); title(c, o.title, padX);
    c.strokeStyle = axisC(); c.lineWidth = 1; c.beginPath(); c.moveTo(padX - 6, base + 0.5); c.lineTo(w - padX + 6, base + 0.5); c.stroke();
    const acc = css('--acc', '#4fd8c4'); c.globalCompositeOperation = light() ? 'source-over' : 'lighter';
    for (let q = 0; q < T; q++) for (let j = 0; j < q; j++) { const v = A[q]?.[j] ?? 0; if (v < thr) continue; const on = hover < 0 || hover === q || hover === j; if (!on) continue;
      const x0 = X(j), x1 = X(q), r = (x1 - x0) / 2, top = Math.min(base - 8, r * 0.9 + 6) * k; c.strokeStyle = hover >= 0 ? (hover === q ? acc : '#f472b6') : cmap('viridis', 0.25 + 0.75 * Math.sqrt(v)); c.globalAlpha = Math.min(1, 0.18 + v * 1.1); c.lineWidth = 0.6 + 4.2 * v;
      c.beginPath(); c.moveTo(x0, base); c.bezierCurveTo(x0, base - top * 1.33, x1, base - top * 1.33, x1, base); c.stroke(); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    const fs = Math.max(8, Math.min(11, dx * 0.9)); c.font = `${fs}px ${MONO()}`; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (let i = 0; i < T; i++) { const self = A[i]?.[i] ?? 0; c.fillStyle = cmap('viridis', 0.2 + 0.8 * self); c.beginPath(); c.arc(X(i), base, i === hover ? 4.5 : 3, 0, 7); c.fill();
      c.save(); c.translate(X(i), base + 8); c.rotate(-Math.PI / 3); c.fillStyle = i === hover ? TX() : FG(); c.fillText(String(labels[i]).slice(0, 10), 0, 0); c.restore(); }
    return [X, dx]; };
  let [, dx] = draw();
  if (k < 1) { const t0 = performance.now(), step = (t) => { k = Math.min(1, (t - t0) / 450); k = 1 - (1 - k) ** 3; [, dx] = draw(); if (k < 1 && cv.isConnected) requestAnimationFrame(step); }; requestAnimationFrame(step); }
  const at = (e) => { const r = cv.getBoundingClientRect(), i = Math.round((e.clientX - r.left - 18) / dx); return i >= 0 && i < T ? i : -1; };
  cv.onmousemove = (e) => { const i = at(e); if (i !== hover) { hover = i; draw(); emit(o.sync, i); } if (i < 0) return showTip(e, ''); const row = A[i] || [], top = [...row.keys()].filter((j) => j <= i).sort((a, b) => row[b] - row[a]).slice(0, 4); showTip(e, `${labels[i]} (q=${i}) attends to\n` + top.map((j) => `  ${labels[j]} [${j}]  ${(+row[j]).toFixed(3)}`).join('\n')); };
  cv.onmouseleave = () => { hover = -1; draw(); showTip(null, ''); emit(o.sync, -1); };
  listen(cv, o.sync, (i) => { if (i !== hover) { hover = i; draw(); } });
}
// v15.1 token heat strip: one cell per token coloured by a value (magma by default), label inside; o.sync cross-highlights.
export function heatStrip(cv, labels, vals, o = {}) {
  stamp(cv); cv._redraw = () => { cv._inRedraw = true; try { heatStrip(cv, labels, vals, o); } finally { cv._inRedraw = false; } };
  cv._csv = () => ['i,token,value', ...vals.map((v, i) => `${i},${JSON.stringify(String(labels[i]))},${v}`)].join('\n');
  const T = vals.length, h = o.h || 40; let lo = o.min ?? Math.min(...vals.filter(isFinite)), hi = o.max ?? Math.max(...vals.filter(isFinite)); if (!(hi > lo)) hi = lo + 1; let hover = -1;
  const draw = () => { const [c, w] = fit(cv, h), cbw = 64, cw = (w - cbw - 10) / Math.max(1, T), y0 = o.title ? 16 : 2, ch = h - y0 - 3; c.fillStyle = BG(); c.fillRect(0, 0, w, h); title(c, o.title, 2);
    const f = (v) => cmap(o.cmap || 'magma', 0.08 + 0.9 * (v - lo) / (hi - lo));
    for (let i = 0; i < T; i++) { c.fillStyle = isFinite(vals[i]) ? f(vals[i]) : gridC(); rrect(c, i * cw + 0.5, y0, Math.max(1, cw - 1.5), ch, Math.min(3, cw / 3)); c.fill(); if (i === hover) { c.strokeStyle = TX(); c.lineWidth = 1.5; c.stroke(); }
      if (cw > 22) { const t = (vals[i] - lo) / (hi - lo); c.fillStyle = t > 0.6 ? '#120a1c' : '#f4f1ff'; c.font = `${Math.min(10, cw / 4)}px ${MONO()}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(labels[i]).trim().slice(0, Math.floor(cw / 6)), i * cw + cw / 2, y0 + ch / 2); } }
    const g = c.createLinearGradient(w - cbw, 0, w - 4, 0); for (let s = 0; s <= 8; s++) g.addColorStop(s / 8, f(lo + ((hi - lo) * s) / 8)); c.fillStyle = g; rrect(c, w - cbw, y0 + ch / 2 - 4, cbw - 6, 8, 3); c.fill();
    c.fillStyle = FG(); c.font = `9px ${MONO()}`; c.textBaseline = 'bottom'; c.textAlign = 'left'; c.fillText(tfmt(lo), w - cbw, y0 + ch / 2 - 5); c.textAlign = 'right'; c.fillText(tfmt(hi), w - 6, y0 + ch / 2 - 5); return cw; };
  let cw = draw(); const at = (e) => { const r = cv.getBoundingClientRect(), i = Math.floor((e.clientX - r.left) / cw); return i >= 0 && i < T ? i : -1; };
  cv.onmousemove = (e) => { const i = at(e); if (i !== hover) { hover = i; cw = draw(); emit(o.sync, i); } showTip(e, i >= 0 ? `${labels[i]} [${i}]  ${o.name || 'value'} ${(+vals[i]).toFixed(3)}` : ''); };
  cv.onmouseleave = () => { hover = -1; cw = draw(); showTip(null, ''); emit(o.sync, -1); };
  if (o.onClick) { cv.style.cursor = 'pointer'; cv.onclick = (e) => { const i = at(e); if (i >= 0) o.onClick(i); }; }
  listen(cv, o.sync, (i) => { if (i !== hover) { hover = i; cw = draw(); } });
}

export function redrawAll() { for (const c of document.querySelectorAll('canvas')) if (c._redraw && c.offsetParent) try { c._redraw(); } catch (e) { console.warn(e); } }

// v12.1 freshness stamps: every chart records when it was computed and under which model state ("generation", bumped on
// every weight/runtime edit). When the model changes, older charts are labelled stale instead of silently showing old results.
let GEN = 0; export const modelGen = () => GEN;
export function stampText(at, gen, cur) { const t = new Date(at).toTimeString().slice(0, 8); return gen === cur ? `computed ${t} · current model state` : `last run at ${t} · ⚠ model changed since (state #${gen} → #${cur}); rerun for the current state`; }
function stamp(cv) { if (cv._inRedraw || typeof document === 'undefined') return; cv._at = Date.now(); cv._gen = GEN; let el = cv.nextElementSibling; if (!el || !el.classList?.contains('cstamp')) { el = document.createElement('div'); el.className = 'cstamp sm'; cv.after(el); } el.classList.remove('stale'); el.textContent = stampText(cv._at, GEN, GEN); }
export function markStale() { GEN++; if (typeof document === 'undefined') return GEN; for (const c of document.querySelectorAll('canvas')) if (c._at && c.nextElementSibling?.classList?.contains('cstamp')) { const el = c.nextElementSibling, st = c._gen !== GEN; el.classList.toggle('stale', st); el.textContent = stampText(c._at, c._gen, GEN); } return GEN; }

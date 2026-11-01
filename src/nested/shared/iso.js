// Tiny original isometric renderer: stacked layer slabs with glowing cells (no external libs).
window.Iso = {
  draw(cv, layers, opt = {}) {
    const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight || 320; cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
    const n = layers.length, gap = Math.min(n < 4 ? 110 : 28, (H - 140) / n), sx = Math.min(16, (W * 0.55) / 32), ox = W * 0.5, oy = H - 30;
    const P = (x, y, z) => [ox + (x - y) * sx * 0.87, oy - (x + y) * sx * 0.5 - z];
    for (let l = 0; l < n; l++) {
      const L = layers[l], z = l * gap, cells = L.cells || [], cols = L.cols || 16, rows = Math.ceil(cells.length / cols) || 1;
      const s = 16 / Math.max(cols, rows);
      const quad = (x0, y0, x1, y1) => { const a = P(x0, y0, z), b = P(x1, y0, z), c = P(x1, y1, z), d = P(x0, y1, z); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); };
      quad(-8, -8, 8, 8); g.fillStyle = l === opt.active ? 'rgba(90,169,255,.16)' : 'rgba(40,52,80,.30)'; g.fill(); g.strokeStyle = l === opt.active ? '#5aa9ff' : '#2b3757'; g.stroke();
      cells.forEach((v, i) => {
        if (!v) return; const cx = -8 + (i % cols) * s, cy = -8 + Math.floor(i / cols) * s; quad(cx + .1 * s, cy + .1 * s, cx + .9 * s, cy + .9 * s);
        const col = L.color || '#5cf2a6'; g.globalAlpha = Math.min(1, .25 + Math.abs(v)); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 8; g.fill(); g.shadowBlur = 0; g.globalAlpha = 1;
      });
      const t = P(8, -8, z); g.fillStyle = l === opt.active ? '#dfe6f5' : '#7d89a6'; g.font = '11px ui-monospace,monospace'; g.fillText(L.name, t[0] + 10, t[1] + 4);
    }
  }
};

// Chart CSV/PNG assembly off the main thread. The page posts small strings or bitmaps.
let parts = [];
let canvas = null;
let ctx = null;
onmessage = async (e) => {
  const m = e.data;
  if (m.op === 'part') { parts.push(m.s); return; }
  if (m.op === 'end') {
    const b = new Blob(parts, { type: m.type || 'text/csv' });
    parts = [];
    postMessage(b);
    return;
  }
  if (m.op === 'png-init') {
    canvas = new OffscreenCanvas(m.w, m.h);
    ctx = canvas.getContext('2d');
    return;
  }
  if (m.op === 'png-bitmap') {
    ctx.drawImage(m.bmp, 0, m.y);
    m.bmp.close();
    return;
  }
  if (m.op === 'png-end') postMessage(await canvas.convertToBlob({ type: 'image/png' }));
};

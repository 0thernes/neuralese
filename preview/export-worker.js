// Chart CSV and PNG assembly. The page posts UTF-8 bytes or one ImageBitmap.
// The reply is a Blob built here, so the page never copies the bytes.
let chunks = [];
onmessage = async (e) => {
  const m = e.data;
  if (m && m.op === 'bytes') {
    chunks.push(new Uint8Array(m.buf));
    return;
  }
  if (m && m.op === 'end') {
    const blob = new Blob(chunks, { type: m.type || 'application/octet-stream' });
    chunks = [];
    postMessage(blob);
    return;
  }
  if (m && m.op === 'png' && m.bmp) {
    const max = m.max || 96;
    const scale = Math.min(1, max / Math.max(m.bmp.width, m.bmp.height));
    const w = Math.max(1, Math.round(m.bmp.width * scale));
    const h = Math.max(1, Math.round(m.bmp.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(m.bmp, 0, 0, w, h);
    m.bmp.close();
    postMessage(await canvas.convertToBlob({ type: 'image/png' }));
  }
};

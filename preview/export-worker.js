// Chart CSV and PNG assembly. The page posts UTF-8 bytes or one ImageBitmap.
// The reply is a transferred ArrayBuffer. The page wraps it in a Blob.
let chunks = [];
let total = 0;
onmessage = async (e) => {
  const m = e.data;
  if (m && m.op === 'bytes') {
    const u = new Uint8Array(m.buf);
    chunks.push(u);
    total += u.byteLength;
    return;
  }
  if (m && m.op === 'end') {
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.byteLength; }
    chunks = [];
    total = 0;
    postMessage(out.buffer, [out.buffer]);
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
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const buf = await blob.arrayBuffer();
    postMessage(buf, [buf]);
  }
};

// Copy byte chunks without one set() of the whole buffer.
export async function concatUint8(chunks, step = 65536, pause) {
  let n = 0;
  for (const c of chunks) n += c.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) {
    for (let i = 0; i < c.length; i += step) {
      const k = Math.min(step, c.length - i);
      out.set(c.subarray(i, i + k), o);
      o += k;
      if (pause && c.length > step) await pause();
    }
  }
  return out;
}

// Join CSV lines into small strings. A growing `out +=` copied the whole file on the last chunk.
export function joinLines(lines, n) {
  const parts = [];
  for (let i = 0; i < lines.length; i += n) {
    const slice = lines.slice(i, i + n).join('\n');
    parts.push(i + n < lines.length ? slice + '\n' : slice);
  }
  return parts;
}

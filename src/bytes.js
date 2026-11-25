// Copy byte chunks. The host decides the slice from the clock, not from a fixed step.
import { runBudgeted } from './coop.js?v=171';
export async function concatUint8(chunks) {
  let n = 0;
  for (const c of chunks) n += c.length;
  if (!n) return new Uint8Array(0);
  const out = new Uint8Array(new ArrayBuffer(0, { maxByteLength: n }));
  let o = 0;
  await runBudgeted((function* () {
    for (const c of chunks) {
      for (let i = 0; i < c.length; i++) {
        if (o === out.buffer.byteLength) out.buffer.resize(Math.min(n, o + 4096));
        out[o++] = c[i];
        yield;
      }
    }
  })(), { budgetMs: 8 });
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

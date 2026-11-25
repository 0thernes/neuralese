// Join byte chunks into one fixed ArrayBuffer. TextDecoder and DataView reject a resizable buffer.
// The zero-fill happens in a worker. The page only posts the pieces, on the time budget.
import { runBudgeted } from './coop.js?v=191';
const CONCAT_SRC = 'let o=0,dst=null;onmessage=(e)=>{const m=e.data;if(m&&m.n){dst=new Uint8Array(m.n);return;}if(m&&m.done){postMessage(dst.buffer,[dst.buffer]);return;}const u=new Uint8Array(m);dst.set(u,o);o+=u.byteLength;};';
export async function concatUint8(chunks) {
  let n = 0;
  for (const c of chunks) n += c.length;
  if (!n) return new Uint8Array(0);
  if (typeof Worker === 'undefined' || typeof document === 'undefined') {
    const out = new Uint8Array(n);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }
  const w = new Worker(URL.createObjectURL(new Blob([CONCAT_SRC], { type: 'text/javascript' })));
  const done = new Promise((resolve, reject) => {
    w.onmessage = (e) => { w.terminate(); resolve(new Uint8Array(e.data)); };
    w.onerror = () => { w.terminate(); reject(new Error('concat worker failed')); };
  });
  w.postMessage({ n });
  await runBudgeted((function* () {
    for (const c of chunks) { const copy = c.slice(); w.postMessage(copy.buffer, [copy.buffer]); yield; }
  })(), { budgetMs: 8 });
  w.postMessage({ done: 1 });
  return done;
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

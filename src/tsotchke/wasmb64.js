// The deploy pipeline for this site (GitHub contents API via text-only tooling) cannot carry raw binary files, so each
// WebAssembly binary is stored as base64 text next to its loader and verified against a pinned SHA-256 of the original
// .wasm before it is instantiated. A mismatch throws, so a corrupted or substituted binary can never run silently.
export const PINS = {
  qrng: { url: new URL('./qrng.wasm.b64', import.meta.url), sha256: 'a82a9b44efcdb5d0177c0eb6bc63b76910fefdc97482ce014d846dcd19fba86e' },
  eshkolTypes: { url: new URL('./eshkol_types.wasm.b64', import.meta.url), sha256: '555920a752d9e5f8f8b9e8c98afd3d2218129d18414b2555d705289fc8d226a7' },
  qgtl: { url: new URL('./qgtl.wasm.b64', import.meta.url), sha256: '2c56f678d447e7c0f430c20849e70cd239756ca8d90c209792f4e8bb1765371d' },
  moonlabQgt: { url: new URL('./moonlab_qgt.wasm.b64', import.meta.url), sha256: '96d92eb7d8ad25144d8f9c73d44795c6b7b5efe2c040e6dedeea4b5b11fb9598' },
  moonlab: { url: new URL('../vendor/moonlab/dist/moonlab.wasm.b64', import.meta.url), sha256: 'fef4f0192641af2299b097bb1ccb535cd76f2d5d10f731c5723fe6e3f71229c1' },
};
const isNode = typeof process !== 'undefined' && !!process.versions?.node;
export const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
let decoder = null;
function decodeWorker() {
  if (decoder) return decoder;
  const src = `onmessage=async(e)=>{try{const text=(await(await fetch(e.data.url)).text()).trim();const bin=atob(text);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);postMessage({id:e.data.id,bytes},[bytes.buffer]);}catch(err){postMessage({id:e.data.id,err:String(err&&err.message||err)});}}`;
  decoder = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })));
  return decoder;
}
export async function wasmBytes(name) {
  const { url, sha256 } = PINS[name];
  let bytes;
  if (isNode) { const text = (await import('node:fs')).readFileSync(url, 'utf8'); const bin = atob(text.trim()); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); }
  else bytes = await new Promise((resolve, reject) => { const w = decodeWorker(), id = wasmBytes.n = (wasmBytes.n || 0) + 1; const on = (e) => { if (e.data.id !== id) return; w.removeEventListener('message', on); e.data.err ? reject(new Error(e.data.err)) : resolve(e.data.bytes); }; w.addEventListener('message', on); w.postMessage({ id, url: url.href }); });
  const got = hex(await crypto.subtle.digest('SHA-256', bytes));
  if (got !== sha256) throw new Error(`${name}.wasm integrity check failed: sha256 ${got} ≠ pinned ${sha256}`);
  return bytes;
}

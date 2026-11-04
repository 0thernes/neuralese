import { frame } from './coop.js?v=170';
// v15.3 main-thread client for engine-worker.js. RemoteEngine mirrors the Engine calls used by generation, but async:
//   const re = await RemoteEngine.create(); await re.sync('main', eng); const s = await re.newSeq('main', n); const r = await re.step(s, tok, {trace})
// r = {h, trace, l}: l are the raw logits (Engine.logits); add R.logitBias on the main thread for Engine.outLogits.
// The synchronous Engine in engine.js is unchanged and still used by every lab tool (hooks need same-thread callbacks).
// Scan in ~1MB slices. One pass over wte is ~200ms on the page thread; the slices stay under a frame.
export async function weightsChecksum(W) {
  let h = 2166136261 | 0;
  const mix = async (a) => {
    if (!a || !a.length) return;
    const u = new Int32Array(a.buffer, a.byteOffset, a.length);
    const N = 262144;
    for (let i = 0; i < u.length; i += N) {
      const end = Math.min(u.length, i + N);
      for (let j = i; j < end; j++) h = Math.imul(h ^ u[j], 16777619);
      if (u.length > N) await frame();
    }
  };
  await mix(W.wte); await mix(W.wpe); await mix(W.lnfW); await mix(W.lnfB);
  for (const L of W.layers) for (const k of Object.keys(L).sort()) await mix(L[k]);
  return h >>> 0;
}
async function copyArr(a) {
  if (!a || a.length <= 65536) return a.slice();
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i += 65536) { out.set(a.subarray(i, Math.min(a.length, i + 65536)), i); await frame(); }
  return out;
}
async function plainW(W) {
  const layers = [];
  for (const L of W.layers) { const o = {}; for (const k of Object.keys(L)) o[k] = await copyArr(L[k]); layers.push(o); }
  return { wte: await copyArr(W.wte), wpe: await copyArr(W.wpe), lnfW: await copyArr(W.lnfW), lnfB: await copyArr(W.lnfB), layers };
}
// structuredClone keeps Float32Array steer vectors typed (JSON turned them into slow plain objects: ~35x slower steps)
const cloneR = (R) => { try { return structuredClone(R); } catch { return JSON.parse(JSON.stringify(R)); } };
const plainStats = (s) => s && { N: s.N, Z: s.Z, meanZ: s.meanZ, meanAct: s.meanAct };
const plainSae = (s) => s && { layer: s.layer, Wenc: s.Wenc, benc: s.benc, bdec: s.bdec, Wdec: s.Wdec };
export class RemoteEngine {
  static async create(url = new URL('./engine-worker.js?v=170', import.meta.url)) {
    if (typeof Worker === 'undefined') throw new Error('Worker unavailable');
    const w = new Worker(url, { type: 'module' }), re = new RemoteEngine(w);
    await new Promise((res, rej) => { const to = setTimeout(() => rej(new Error('engine worker did not start')), 15000); w.addEventListener('message', function f(e) { if (e.data && e.data.ready) { clearTimeout(to); w.removeEventListener('message', f); res(); } }); w.addEventListener('error', (e) => { clearTimeout(to); rej(new Error('engine worker error: ' + (e.message || 'load failed'))); }); });
    return re;
  }
  constructor(w) { this.w = w; this.n = 0; this.pend = new Map(); this.sums = {}; this.stamp = {}; this.calls = 0;
    w.onmessage = (e) => { const m = e.data; if (!m || typeof m !== 'object' || m.id == null) return; const p = this.pend.get(m.id); if (!p) return; if (m.progress) { p.onp?.(m.frac, m.note); return; } this.pend.delete(m.id); m.err ? p.rej(new Error(m.err)) : p.res(m.out); }; }
  heavy(key, kind, payload, onp) { const id = ++this.n; this.calls++; return new Promise((res, rej) => { this.pend.set(id, { res, rej, onp }); this.w.postMessage({ id, op: 'heavy', key, kind, ...payload }); }); }
  cancelJob() { this.w.postMessage({ op: 'cancelJob' }); }
  call(msg, transfer = []) { const id = ++this.n; this.calls++; return new Promise((res, rej) => { this.pend.set(id, { res, rej }); this.w.postMessage({ id, ...msg }, transfer); }); }
  // Push the current state of a main-thread Engine into worker slot `key`. Weights are re-sent only when their checksum changed.
  async sync(key, eng) {
    const sum = await weightsChecksum(eng.W), msg = { op: 'sync', key, R: cloneR(eng.R) }, tr = [];
    if (this.sums[key] !== sum) { msg.W = await plainW(eng.W); this.sums[key] = sum; for (const v of [msg.W.wte, msg.W.wpe, msg.W.lnfW, msg.W.lnfB, ...msg.W.layers.flatMap((L) => Object.values(L))]) tr.push(v.buffer); }
    const st = eng.stats || null, sa = eng.sae || null; if (this.stamp[key + 's'] !== st) { msg.stats = plainStats(st); this.stamp[key + 's'] = st; } if (this.stamp[key + 'a'] !== sa) { msg.sae = plainSae(sa); this.stamp[key + 'a'] = sa; }
    return this.call(msg, tr);
  }
  async newSeq(key, nPrompt = 0) { const { sid } = await this.call({ op: 'seq', key, nPrompt }); return { key, sid, T: 0, ids: [], nPrompt }; }
  async step(seq, tok, o = {}) { const r = await this.call({ op: 'step', key: seq.key, sid: seq.sid, tok, trace: !!o.trace }); seq.T = r.T; seq.ids = r.ids; return r; }
  async steps(seq, toks, o = {}) { const r = await this.call({ op: 'steps', key: seq.key, sid: seq.sid, toks, trace: !!o.trace }); seq.T = r.T; seq.ids = r.ids; return r; }
  kvgeom(seq, phase) { return this.call({ op: 'kvgeom', key: seq.key, sid: seq.sid, phase }); }
  beam(seq, h0, opts) { return this.call({ op: 'beam', key: seq.key, sid: seq.sid, h0, opts }); }
  walk(key, ids, opts = {}) { return this.call({ op: 'walk', key, ids, ...opts }); }
  walkCell(opId, index, term = null) { return this.call({ op: 'walkCell', opId, index, term }); }
  walkForge(name, a, b, opts = {}) { return this.call({ op: 'walkForge', name, a, b, ...opts }); }
  walkVoltage(params) { return this.call({ op: 'walkVoltage', ...params }); }
  walkStudy(key, ids) { return this.call({ op: 'walkStudy', key, ids }); }
  free(seqs) { return this.call({ op: 'free', sids: seqs.filter(Boolean).map((s) => s.sid) }); }
  terminate() { this.w.terminate(); }
}
// Engine.outLogits equivalent for worker logits
export function withBias(l, R) { const B = (R && R.logitBias) || {}; const o = l.slice(); for (const k in B) o[+k] += B[k]; return o; }

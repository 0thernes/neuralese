// v15.3 engine worker: runs the GPT-Neo forward pass (Engine) off the UI thread. Protocol (all messages {id, op, ...}):
//   sync   {key, W?, R, stats?, sae?}  install/refresh an engine slot ('main' | 'clean'); W is sent only when its checksum changed
//   seq    {key, nPrompt}              → {sid}
//   step   {key, sid, tok, trace}      → {h, trace, l} (l = raw unembedding logits, Float32Array, transferred)
//   steps  {key, sid, toks, trace}     → like step for the last token, plus traces[] for all (batched prefill: one round-trip)
//   free   {sid}
//   beam   {key, sid, h0, opts}        → beamSearch result (decode.js), computed entirely in the worker
// Hooks (JS functions) cannot cross the thread boundary; callers that need hooks use the main-thread Engine (still exported).
import { Engine } from './engine.js?v=153';
import { beamSearch } from './decode.js?v=153';
const E = {}, seqs = new Map(); let nextSid = 1;
function statsOf(s) { if (!s) return null; const d = s.meanZ[0].length, N = s.N, Z = s.Z;
  return { ...s, sampleZ(l, rng) { const i = Math.floor(rng() * N); return Z[l].subarray(i * d, i * d + d); } }; }
self.onmessage = (ev) => {
  const m = ev.data; let out, tr = [];
  try {
    if (m.op === 'sync') { const e = E[m.key] || (E[m.key] = new Engine(m.W, m.R)); if (m.W) e.W = m.W; e.R = m.R; if ('stats' in m) e.stats = statsOf(m.stats); if ('sae' in m) e.sae = m.sae; e.invalidate(); out = { ok: true }; }
    else if (m.op === 'seq') { const sid = nextSid++; seqs.set(sid, { key: m.key, s: E[m.key].newSeq(m.nPrompt) }); out = { sid }; }
    else if (m.op === 'step') { const t0 = performance.now(), e = E[m.key], q = seqs.get(m.sid), r = e.step(q.s, m.tok, { trace: !!m.trace }), l = e.logits(r.h); out = { h: r.h, trace: r.trace, l, T: q.s.T, ids: q.s.ids, ms: performance.now() - t0 }; tr = [l.buffer]; }
    else if (m.op === 'steps') { const t0 = performance.now(), e = E[m.key], q = seqs.get(m.sid), traces = []; let r; for (const t of m.toks) { r = e.step(q.s, t, { trace: !!m.trace }); traces.push(r.trace); } const l = e.logits(r.h); out = { h: r.h, traces, trace: r.trace, l, T: q.s.T, ids: q.s.ids, ms: performance.now() - t0 }; tr = [l.buffer]; }
    else if (m.op === 'free') { for (const s of m.sids) seqs.delete(s); out = { ok: true }; }
    else if (m.op === 'beam') { const e = E[m.key], q = seqs.get(m.sid); out = beamSearch(e, q.s, m.h0, m.opts); }
    else throw new Error('unknown op ' + m.op);
    self.postMessage({ id: m.id, out }, tr);
  } catch (err) { self.postMessage({ id: m.id, err: String(err && err.stack || err) }); }
};
self.postMessage({ ready: true });

// v15.3 engine worker: runs the GPT-Neo forward pass (Engine) off the UI thread. Protocol (all messages {id, op, ...}):
//   sync   {key, W?, R, stats?, sae?}  install/refresh an engine slot ('main' | 'clean'); W is sent only when its checksum changed
//   seq    {key, nPrompt}              → {sid}
//   step   {key, sid, tok, trace}      → {h, trace, l} (l = raw unembedding logits, Float32Array, transferred)
//   steps  {key, sid, toks, trace}     → like step for the last token, plus traces[] for all (batched prefill: one round-trip)
//   free   {sid}
//   beam   {key, sid, h0, opts}        → beamSearch result (decode.js), computed entirely in the worker
// Hooks (JS functions) cannot cross the thread boundary; callers that need hooks use the main-thread Engine (still exported).
import { Engine } from './engine.js?v=170';
import { beamSearch } from './decode.js?v=170';
import { CFG } from './model.js?v=170';
import { geometryFromSeq } from './adversary/geometry.js?v=170';
import { runFaultOp, runWalkOp, runWalkCellOp, runForgeOp, runSignificandOp, runVoltageOp } from './walk/session.js?v=170';
import { cancelJobs } from './coop.js?v=170';
const E = {}, seqs = new Map(); let nextSid = 1;
function statsOf(s) { if (!s) return null; const d = s.meanZ[0].length, N = s.N, Z = s.Z;
  return { ...s, sampleZ(l, rng) { const i = Math.floor(rng() * N); return Z[l].subarray(i * d, i * d + d); } }; }
function runHeavy(m) {
  import('./heavy.js?v=170').then(async ({ dispatchHeavy }) => {
    const onp = (frac, note) => self.postMessage({ id: m.id, progress: true, frac, note });
    const out = await dispatchHeavy(E[m.key], m, onp);
    self.postMessage({ id: m.id, out });
  }).catch((err) => self.postMessage({ id: m.id, err: String(err && err.stack || err) }));
}
self.onmessage = (ev) => {
  const m = ev.data;
  if (!m || typeof m !== 'object') return;
  if (m.op === 'cancelJob') { cancelJobs(); return; }
  if (m.op === 'heavy') { runHeavy(m); return; }
  let out, tr = [];
  const needSeq = m.op === 'step' || m.op === 'steps' || m.op === 'beam' || m.op === 'kvgeom';
  try {
    if (needSeq) { if (!E[m.key]) throw new Error('no engine ' + m.key); if (!seqs.get(m.sid)) throw new Error('no seq ' + m.sid); }
    if (m.op === 'steps' && (!Array.isArray(m.toks) || !m.toks.length)) throw new Error('steps needs at least one token');
    if (m.op === 'sync') { if (!m.W && !E[m.key]) throw new Error('sync needs weights on first use'); const e = E[m.key] || (E[m.key] = new Engine(m.W, m.R)); if (m.W) e.W = m.W; e.R = m.R; if ('stats' in m) e.stats = statsOf(m.stats); if ('sae' in m) e.sae = m.sae; e.invalidate(); out = { ok: true }; }
    else if (m.op === 'seq') { if (!E[m.key]) throw new Error('no engine ' + m.key); const sid = nextSid++; seqs.set(sid, { key: m.key, s: E[m.key].newSeq(m.nPrompt) }); out = { sid }; }
    else if (m.op === 'step') { const t0 = performance.now(), e = E[m.key], q = seqs.get(m.sid), r = e.step(q.s, m.tok, { trace: !!m.trace }), l = e.logits(r.h); out = { h: r.h, trace: r.trace, l, T: q.s.T, ids: q.s.ids, ms: performance.now() - t0 }; tr = [l.buffer]; }
    else if (m.op === 'steps') { const t0 = performance.now(), e = E[m.key], q = seqs.get(m.sid), traces = []; let r; for (const t of m.toks) { r = e.step(q.s, t, { trace: !!m.trace }); traces.push(r.trace); } const l = e.logits(r.h); out = { h: r.h, traces, trace: r.trace, l, T: q.s.T, ids: q.s.ids, ms: performance.now() - t0 }; tr = [l.buffer]; }
    else if (m.op === 'kvgeom') {
      const q = seqs.get(m.sid);
      const T = m.upTo == null ? q.s.T : m.upTo;
      out = geometryFromSeq(q.s, { nHeads: CFG.H, headDim: CFG.hd, phase: m.phase || (q.s.nPrompt != null && T <= q.s.nPrompt ? 'encoding' : 'generation'), upTo: T });
    }
    else if (m.op === 'free') { for (const s of m.sids || []) seqs.delete(s); out = { ok: true }; }
    else if (m.op === 'beam') { const e = E[m.key], q = seqs.get(m.sid); out = beamSearch(e, q.s, m.h0, m.opts); }
    else if (m.op === 'walk') { out = runWalkOp(E[m.key], m); }
    else if (m.op === 'walkCell') { out = runWalkCellOp(m); }
    else if (m.op === 'walkForge') { out = runForgeOp(m); }
    else if (m.op === 'walkSignificand') { out = runSignificandOp(m); }
    else if (m.op === 'walkVoltage') { out = runVoltageOp(m); }
    else if (m.op === 'walkStudy') { out = runFaultOp(E[m.key], m.ids); }
    else throw new Error('unknown op ' + m.op);
    self.postMessage({ id: m.id, out }, tr);
  } catch (err) { self.postMessage({ id: m.id, err: String(err && err.stack || err) }); }
};
self.postMessage({ ready: true });

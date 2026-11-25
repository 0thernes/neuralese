// Page-side handle for mf-worker.js. The worker runs machine and Forge compute.
// The page only receives plain results (structured clone, or a transferred Float32Array).
let worker = null;
let seq = 0;
const pending = new Map();
const current = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('mf-worker.js', document.baseURI), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data;
    const p = pending.get(m?.id);
    if (!p) return;
    if (m.type === 'progress') { p.onProgress?.(m); return; }
    pending.delete(m.id);
    if (m.type === 'error') p.rej(new Error(m.error));
    else p.res(m.result);
  };
  worker.onerror = (e) => {
    const err = new Error(e.message || 'machine worker failed');
    for (const p of pending.values()) p.rej(err);
    pending.clear();
    worker = null;
  };
  return worker;
}

export function start(op, body = {}, onProgress) {
  const prev = current.get(op);
  if (prev) prev.cancel();
  const id = ++seq;
  const transfer = body.transfer || [];
  const msg = { op, id, ...body };
  delete msg.transfer;
  const done = new Promise((res, rej) => {
    pending.set(id, { res, rej, onProgress });
    getWorker().postMessage(msg, transfer);
  });
  const job = {
    id,
    done,
    cancel() {
      getWorker().postMessage({ op: 'cancel', id });
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      p.res({ cancelled: true });
    },
  };
  current.set(op, job);
  void done.then(() => {}, () => {});
  void done.finally(() => { if (current.get(op) === job) current.delete(op); });
  return job;
}

const run = (op, body, onProgress) => start(op, body, onProgress).done;
export const ping = () => run('ping');
export const measure = (opts, onProgress) => run('measure', { opts }, onProgress);
export const machine = (body, onProgress) => run('machine', body, onProgress);
export const machineFrame = (id, index) => run('machineFrame', { runId: id, index });
export const forge = (body, onProgress) => run('forge', body, onProgress);
export const forgeStep = (id, index) => run('forgeStep', { runId: id, index });
export const lower = (name, a, b, opts) => run('lower', { name, a, b, opts });
export const moe = (sample = 0) => run('moe', { sample });
export const lanes = (onProgress) => run('lanes', {}, onProgress);
export function spectral(a, rows, cols) {
  const copy = new Float32Array(a);
  return run('spectral', { a: copy, rows, cols, transfer: [copy.buffer] });
}

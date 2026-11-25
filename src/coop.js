// One scheduler for every long loop. A slice runs until budgetMs of wall time, then yields.
// scheduler.yield() hands the frame back to the browser. MessageChannel is the next choice.
// requestAnimationFrame is the last. setTimeout is not used: it clamps and bunches.
let stop = false;
let t0 = 0;
export function cancelJobs() { stop = true; }
export function resetCancel() { stop = false; t0 = 0; }
export function cancelled() { return stop; }
function noteYield(label) {
  if (typeof globalThis.__yieldFrom === 'function') globalThis.__yieldFrom(label || '');
}
export function yieldHost(label) {
  noteYield(label || '');
  const sched = globalThis.scheduler;
  if (sched && typeof sched.yield === 'function') return sched.yield();
  const Channel = globalThis.MessageChannel;
  if (typeof Channel === 'function') {
    return new Promise((resolve) => {
      const ch = new Channel();
      ch.port1.onmessage = () => { ch.port1.close(); ch.port2.close(); resolve(); };
      ch.port2.postMessage(null);
    });
  }
  if (typeof requestAnimationFrame === 'function') return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  return Promise.resolve();
}
function asIterator(iter) {
  if (iter && typeof iter.next === 'function') return iter;
  if (iter && typeof iter[Symbol.iterator] === 'function') return iter[Symbol.iterator]();
  if (typeof iter === 'function') {
    const g = iter();
    if (g && typeof g.next === 'function') return g;
  }
  throw new Error('runBudgeted needs an iterator');
}
// iter is an iterator or a generator function. Each next() is one step. When performance.now()
// shows the budget is spent, the host is yielded and the clock restarts.
export async function runBudgeted(iter, opts = {}) {
  const budget = opts.budgetMs ?? 8;
  const it = asIterator(iter);
  const label = opts.label || new Error().stack || '';
  let start = performance.now();
  for (;;) {
    const step = it.next();
    if (step.done) return step.value;
    if (step.value && typeof step.value.then === 'function') await step.value;
    if (stop) { stop = false; throw new Error('cancelled'); }
    if (performance.now() - start >= budget) {
      await yieldHost(label);
      start = performance.now();
    }
  }
}
globalThis.neuraleseBudget = { runBudgeted, yieldHost };
export function frame() { return yieldHost(new Error().stack); }
export function namedFrame(label) { return yieldHost(String(label || '')); }
export function slice() {
  const now = performance.now();
  if (!t0) t0 = now;
  if (!stop && now - t0 < 8) return null;
  return yieldHost(new Error().stack).then(() => {
    t0 = performance.now();
    if (stop) { stop = false; throw new Error('cancelled'); }
  });
}

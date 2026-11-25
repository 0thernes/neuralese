// One queue, one frame budget. Every concurrent job spends the same ~8 ms, then waits for the
// next paint. requestAnimationFrame, then a MessageChannel post, so the continuation runs after
// the browser has rendered. scheduler.yield() is not used: its continuations pile into one frame.
const FRAME_MS = 8;
const SLOW_STEP_MS = 16;
let stop = false;
let frameStart = 0;
let gate = null;

export function cancelJobs() { stop = true; }
export function resetCancel() { stop = false; frameStart = 0; gate = null; }
export function cancelled() { return stop; }

function noteYield(label) {
  if (typeof globalThis.__yieldFrom === 'function') globalThis.__yieldFrom(label || '');
}

function armFrame() {
  if (!frameStart) frameStart = performance.now();
}

export function frameBudgetSpent() {
  armFrame();
  return performance.now() - frameStart >= FRAME_MS;
}

// rAF marks the next frame. The MessageChannel task runs after that frame's paint.
function nextPaint(label) {
  noteYield(label || '');
  return new Promise((resolve) => {
    const post = () => {
      const Channel = globalThis.MessageChannel;
      if (typeof Channel === 'function') {
        const ch = new Channel();
        ch.port1.onmessage = () => { ch.port1.close(); ch.port2.close(); resolve(); };
        ch.port2.postMessage(0);
        return;
      }
      resolve();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => post());
    else post();
  });
}

export function waitNextFrame(label) {
  if (!gate) {
    gate = nextPaint(label).then(() => {
      frameStart = performance.now();
      gate = null;
    });
  }
  return gate;
}

export function yieldHost(label) { return waitNextFrame(label); }

function asIterator(iter) {
  if (iter && typeof iter.next === 'function') return iter;
  if (iter && typeof iter[Symbol.iterator] === 'function') return iter[Symbol.iterator]();
  if (typeof iter === 'function') {
    const g = iter();
    if (g && typeof g.next === 'function') return g;
  }
  throw new Error('runBudgeted needs an iterator');
}

function noteSlow(label, ms) {
  if (ms > SLOW_STEP_MS) console.warn(`budget: step ${label} took ${ms.toFixed(1)} ms`);
}

// All callers share frameStart. A job waits when the frame is already spent, including by another job.
export async function runBudgeted(iter, opts = {}) {
  const it = asIterator(iter);
  const label = opts.label || 'anonymous';
  for (;;) {
    if (stop) { stop = false; throw new Error('cancelled'); }
    if (gate || frameBudgetSpent()) await waitNextFrame(label);
    const t0 = performance.now();
    const step = it.next();
    noteSlow(label, performance.now() - t0);
    if (step.done) return step.value;
    if (step.value && typeof step.value.then === 'function') await step.value;
  }
}

globalThis.neuraleseBudget = { runBudgeted, yieldHost, waitNextFrame, frameBudgetSpent };
export function frame() { return waitNextFrame(new Error().stack); }
export function namedFrame(label) { return waitNextFrame(String(label || '')); }
export function slice() {
  if (stop) { stop = false; throw new Error('cancelled'); }
  if (gate) return waitNextFrame(new Error().stack);
  if (!frameBudgetSpent()) return null;
  return waitNextFrame(new Error().stack);
}

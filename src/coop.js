// Keep a long compute off a single animation frame. slice() returns a promise only when 32ms
// have passed, and that promise resolves after the next paint.
let stop = false;
let t0 = 0;
export function cancelJobs() { stop = true; }
export function resetCancel() { stop = false; t0 = 0; }
export function cancelled() { return stop; }
// One continuation per paint. If several slice() calls each scheduled their own frame callback,
// Chrome ran all of those timers before the next paint and the frame was still 1–3s.
let paint = Promise.resolve();
function nextFrame(stack) {
  const wait = paint.then(() => new Promise((resolve) => {
    const fire = () => {
      if (typeof globalThis.__yieldFrom === 'function') globalThis.__yieldFrom(stack || '');
      resolve();
    };
    if (typeof requestAnimationFrame !== 'function') { setTimeout(fire, 0); return; }
    requestAnimationFrame(() => setTimeout(fire, 0));
  }));
  paint = wait.then(() => {}, () => {});
  return wait;
}
// Always let the browser paint before the next chunk. setTimeout(0) does not.
export function frame() { return nextFrame(new Error().stack); }
// Same paint slot as frame(), but the stack recorded for the suite is the caller's label.
export function namedFrame(label) { return nextFrame(String(label || '')); }
export function slice() {
  const now = performance.now();
  if (!t0) t0 = now;
  if (!stop && now - t0 < 32) return null;
  return nextFrame(new Error().stack).then(() => {
    t0 = performance.now();
    if (stop) { stop = false; throw new Error('cancelled'); }
  });
}

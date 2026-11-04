// Keep a long compute off a single animation frame. slice() returns a promise only when 32ms
// have passed, and that promise resolves after the next paint.
let stop = false;
let t0 = 0;
export function cancelJobs() { stop = true; }
export function resetCancel() { stop = false; t0 = 0; }
export function cancelled() { return stop; }
function nextFrame() {
  // scheduler.yield() starts a new task but Chrome still runs several of those tasks before the next
  // paint, so a long job stayed one long animation frame (the 2–5s frames). A frame callback, then a
  // timer, resolves only after that paint.
  if (typeof requestAnimationFrame === 'function') return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  return new Promise((resolve) => setTimeout(resolve, 0));
}
// Always let the browser paint before the next chunk. setTimeout(0) does not.
export function frame() { return nextFrame(); }
export function slice() {
  const now = performance.now();
  if (!t0) t0 = now;
  if (!stop && now - t0 < 32) return null;
  return nextFrame().then(() => {
    t0 = performance.now();
    if (stop) { stop = false; throw new Error('cancelled'); }
  });
}

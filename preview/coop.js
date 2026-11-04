// Keep a long compute off a single main-thread task. slice() returns a promise only when 32ms
// have passed, and that promise waits a macrotask (setTimeout), which is what the event loop
// can paint through. Awaiting a resolved promise would only queue a microtask and the UI would still freeze.
let stop = false;
let t0 = 0;
export function cancelJobs() { stop = true; }
export function resetCancel() { stop = false; t0 = 0; }
export function cancelled() { return stop; }
export function slice() {
  const now = performance.now();
  if (!t0) t0 = now;
  if (!stop && now - t0 < 32) return null;
  return new Promise((resolve, reject) => setTimeout(() => {
    t0 = performance.now();
    if (stop) { stop = false; reject(new Error('cancelled')); }
    else resolve();
  }, 0));
}

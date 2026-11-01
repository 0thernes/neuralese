// Spring motion that respects prefers-reduced-motion (then it snaps), and View Transitions with a plain fallback.
export const reducedMotion = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export interface Spring { x: number; v: number; target: number }
// critically-damped-ish semi-implicit Euler step; returns true while still moving
export function stepSpring(s: Spring, dt: number, k = 120, c = 22): boolean {
  if (reducedMotion()) { s.x = s.target; s.v = 0; return false; }
  const a = -k * (s.x - s.target) - c * s.v; s.v += a * dt; s.x += s.v * dt;
  if (Math.abs(s.x - s.target) < 1e-4 && Math.abs(s.v) < 1e-4) { s.x = s.target; s.v = 0; return false; }
  return true;
}
type VT = { finished?: Promise<unknown>; ready?: Promise<unknown>; updateCallbackDone?: Promise<unknown> };
type VTDoc = Document & { startViewTransition?: (cb: () => void) => VT };
export function viewTransition(cb: () => void): void {
  const d = document as VTDoc; if (!d.startViewTransition || reducedMotion()) { cb(); return; }
  const vt = d.startViewTransition(cb); const quiet = (): void => { /* a newer transition superseded this one */ };
  vt.finished?.catch(quiet); vt.ready?.catch(quiet); vt.updateCallbackDone?.catch(quiet);
}

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
  // The View Transition callback runs on a later frame. A tab click in between was overwritten
  // by the stale callback, so the panel the control asked for was not active yet. Apply the
  // navigation immediately; the transition call only animates and must not own the state.
  cb();
  const d = document as VTDoc; if (!d.startViewTransition || reducedMotion()) return;
  // The legacy panes stay in the document. Snapshotting that tree is a long task, and the
  // shell already animates the incoming panel. Skip the capture once the page is large.
  if (document.body.classList.contains('v17-on') && document.getElementsByTagName('*').length > 1500) return;
  let vt: VT;
  try { vt = d.startViewTransition(() => {}); } catch { return; }
  const quiet = (): void => { /* a newer transition superseded this one */ };
  vt.finished?.catch(quiet); vt.ready?.catch(quiet); vt.updateCallbackDone?.catch(quiet);
}

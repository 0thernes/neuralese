// v15.2 polish helpers (original Neuralese code): GPU tiering for the 3D default quality, persisted adaptive quality,
// busy/error states for actions, sidebar label tooltips, first-run theme from the OS preference, atlas skeleton.
const SOFT = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|mesa offscreen/i;
const WEAK = /mali-[2-4]\d{2}|mali-t[67]|adreno \(tm\) [2-5]\d{2}|powervr sgx|intel\(r\) hd graphics( [2-5]\d{3})?\b|gma |intel\(r\) uhd graphics 6[01]0/i;
/** Classify a WebGL renderer string + device hints into 'low' | 'mid' | 'high'. Pure, so it is unit-tested. */
export function classifyGpu(renderer = '', cores = 8, memGB = 8, mobile = false) {
  const r = String(renderer);
  if (SOFT.test(r)) return 'low';
  if (WEAK.test(r) || cores <= 2 || (memGB && memGB <= 2)) return 'low';
  if (mobile || cores <= 4 || (memGB && memGB <= 4)) return 'mid';
  return 'high';
}
/** Quality ladder shared by the adaptive loop and the start-up default. Level 0 = full. */
export const LADDER = [
  { name: 'full (bloom + DoF)', bloom: true, dof: true, px: 2 },
  { name: 'bloom only', bloom: true, dof: false, px: 2 },
  { name: 'no post', bloom: false, dof: false, px: 2 },
  { name: 'no post · 1× pixels', bloom: false, dof: false, px: 1 },
];
/** Start level: the lower (safer) of the GPU-tier default and the level the adaptive loop settled on last session. */
export function startLevel(tier, saved) {
  const t = tier === 'low' ? 3 : tier === 'mid' ? 1 : 0, s = Number.isInteger(saved) && saved >= 0 && saved < LADDER.length ? saved : 0;
  return Math.max(t, s);
}
export function readRenderer(gl) {
  try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch { return ''; }
}
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
/** Busy state on the control that started an action (spinner + aria-busy), inline error note on its panel. */
export function busy(el, on) {
  if (!el || el.tagName !== 'BUTTON') return;
  el.classList.toggle('busy', on); if (on) el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy');
}
export function panelNote(el, msg) {
  const fs = el?.closest?.('fieldset'); if (!fs) return;
  let n = fs.querySelector(':scope > .errnote');
  if (!msg) { n?.remove(); return; }
  if (!n) { n = document.createElement('div'); n.className = 'errnote'; n.setAttribute('role', 'alert'); fs.appendChild(n); }
  n.textContent = '✖ ' + msg; n.title = 'Click to dismiss'; n.onclick = () => n.remove();
}
/** Full labels as native tooltips on every sidebar item (labels now wrap to 2 lines; this covers anything clamped). */
export function navTooltips(root = document) {
  for (const b of root.querySelectorAll('#tabs button[data-t]')) if (!b.title) b.title = b.textContent.trim();
}
/** First visit: follow the OS colour scheme; afterwards the saved choice wins. */
export function initialTheme(saved, prefersLight) { return saved === 'light' || saved === 'dark' ? saved : prefersLight ? 'light' : 'dark'; }
/** Skeleton overlay for a canvas that waits on a download; states: idle (call to action), loading (shimmer + progress), off. */
export function skeleton(canvas, state, text = '') {
  if (!canvas) return; let w = canvas.parentElement.querySelector(':scope > .skel3');
  if (state === 'off') { w?.remove(); canvas.classList.remove('skelhid'); return; }
  if (!w) { w = document.createElement('div'); w.className = 'skel3'; w.innerHTML = '<div class="skr"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="skt"><b></b><span></span></div>'; canvas.after(w); }
  canvas.classList.add('skelhid'); w.dataset.state = state; w.querySelector('.skt b').textContent = state === 'loading' ? 'Loading atlas…' : 'Atlas not loaded';
  w.querySelector('.skt span').textContent = text;
}

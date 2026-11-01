// Solid binding for the selection store + app-level UI state; mirrors to/from the legacy app.
import { createSignal } from 'solid-js';
import { createSelection, type Selection } from './selection';
import { legacy } from './bridge';
export const selection = createSelection({ L: 8, H: 16, ff: 1024 });
const [sel, setSelSig] = createSignal<Selection>(selection.get());
export { sel };
selection.subscribe((s) => setSelSig(s));
let echo = false;
// store → legacy (one direction per change; the echo guard stops ping-pong)
selection.subscribe((s, p) => {
  const lg = legacy(); if (!lg || echo) return;
  if (s.layer !== p.layer || s.head !== p.head || s.neuron !== p.neuron) lg.setSel({ l: s.layer, h: s.head, n: s.neuron });
});
// legacy → store
export function bindLegacySelection(): void {
  document.addEventListener('neuralese:sel', (e) => {
    const d = (e as CustomEvent<{ l: number; h: number | null; n: number | null }>).detail;
    echo = true; try { selection.set({ layer: d.l, head: d.h ?? null, neuron: d.n ?? null }); } catch { /* out-of-range from a hub model: ignore */ } finally { echo = false; }
  });
  const lg = legacy(); if (lg) selection.setBounds({ L: lg.cfg.L, H: lg.cfg.H, ff: lg.cfg.ff });
}
export const [traceTick, setTraceTick] = createSignal(0);
export const [theme, setThemeSig] = createSignal<'dark' | 'light'>('dark');

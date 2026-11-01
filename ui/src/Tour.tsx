import { Dialog } from '@kobalte/core/dialog';
import { createSignal, type JSX } from 'solid-js';
const STEPS: [string, string][] = [
  ['Welcome to NEURALESE v17', 'An in-browser interpretability lab running the real TinyStories-8M weights on your device. Everything you see is computed from this model; nothing is mocked.'],
  ['Workspaces', 'The 75 v16 tools are grouped into nine workspaces (top bar, or keys Alt+1…9). Every old tab still exists.'],
  ['Command palette', 'Press Ctrl/⌘+K (or /) and type to jump to any panel, workspace or action. This is the fastest way around.'],
  ['Panels', 'Split a panel right or down, drag tabs between groups, resize with the gutters (arrow keys work too). Layouts are saved per workspace; “reset layout” restores the default.'],
  ['One selection', 'Picking a layer, head, neuron or token anywhere updates every panel: the 3D cosmos, inspector, lens and attention views.'],
];
export const TOUR_KEY = 'neuralese.v17.toured';
export function Tour(p: { open: boolean; setOpen: (b: boolean) => void }): JSX.Element {
  const [i, setI] = createSignal(0); const done = (): void => { try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* */ } p.setOpen(false); setI(0); };
  return <Dialog open={p.open} onOpenChange={(o) => (o ? p.setOpen(true) : done())}>
    <Dialog.Portal><Dialog.Overlay class="pal-ov" /><div class="pal-pos"><Dialog.Content class="tour">
      <Dialog.Title class="tour-t">{STEPS[i()]![0]}</Dialog.Title><Dialog.Description>{STEPS[i()]![1]}</Dialog.Description>
      <div class="tour-b"><span>{i() + 1}/{STEPS.length}</span><button onClick={done}>skip</button>{i() > 0 && <button onClick={() => setI(i() - 1)}>back</button>}<button class="pri" onClick={() => (i() < STEPS.length - 1 ? setI(i() + 1) : done())}>{i() < STEPS.length - 1 ? 'next' : 'start'}</button></div>
    </Dialog.Content></div></Dialog.Portal>
  </Dialog>;
}

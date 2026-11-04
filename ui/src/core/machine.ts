// Signals for the Machine Room. The gadgets live in src/machine.
import { createSignal } from 'solid-js';
import { identityRam, runMachine, vecRam, type WmRun } from '../../../src/machine/machine.js';

export const WM_HELP = 'Each block is a weight gadget. The int32 reference is the ground truth. Voltage is simulated. Exact is a trace match, not a claim that the program was the right one.';

export const [wmProgram, setWmProgram] = createSignal('hello');
export const [wmRun, setWmRun] = createSignal<WmRun | null>(null);
export const [wmCursor, setWmCursor] = createSignal(0);
export const [wmBusy, setWmBusy] = createSignal('');
export const [wmErr, setWmErr] = createSignal('');
export const [wmPipe, setWmPipe] = createSignal(false);
export const [wmSelected, setWmSelected] = createSignal('cpu');
export const [wmZoom, setWmZoom] = createSignal<'board' | 'weights' | 'gates' | 'voltage'>('board');
export const [wmPlaying, setWmPlaying] = createSignal(false);

const VEC_A = [1, 2, 3, 4, 5, -1, 8, 9, 0, 11, 12, 13, 14, 15, -4, 7];
const VEC_B = [3, 3, 3, 3, 1, 2, 0, -8, 5, 1, 1, 1, 1, 1, 4, 1];

export function ramFor(id: string): number[] | null {
  if (id === 'tpu') return identityRam();
  if (id === 'gpu-vec') return vecRam(VEC_A, VEC_B);
  return null;
}

export function launch(id: string, extra: { pipeline?: boolean; fault?: object | null } = {}): WmRun {
  const limit = id === 'memtest' || id === 'gpu-pattern' || id === 'tpu' ? 12000 : 8000;
  return runMachine({ program: id, ram: ramFor(id), trace: true, limit, pipeline: extra.pipeline ?? wmPipe(), fault: extra.fault ?? null });
}

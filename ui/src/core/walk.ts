// Signals for the Deep Walk workspace. The tensors themselves stay in the engine;
// this module holds the view the panels share.
import { createSignal } from 'solid-js';

export type Zoom = 'model' | 'layer' | 'unit' | 'matmul' | 'dot' | 'float' | 'gates' | 'voltage';
export const ZOOMS: readonly Zoom[] = ['model', 'layer', 'unit', 'matmul', 'dot', 'float', 'gates', 'voltage'];

export interface WalkOp {
  id: string; kind: string; title: string; chapter: string;
  layer: number | null; head: number | null;
  length: number; indices: number[]; shown: (number | null)[]; note: string; capped: boolean;
}
export interface WalkView {
  backend: string; model: string; prompt: string; ids: number[]; pieces?: string[];
  token: number; cfg: { d: number; H: number; hd: number; L: number; ff: number; V: number; eps: number };
  argmax: number; greedy?: string; logitGap: number; logitCount: number;
  logitsTop: { id: number; logit: number; piece?: string }[];
  ops: WalkOp[];
  fault: { site: string; layer: number; bit: number; mode: string; n: number; flips: { index: number; bit: number; before: number; after: number }[] } | null;
  faultKl?: number; faultTokenChanged?: boolean; cleanArgmax?: number; faultReal?: boolean;
  where?: string;
  real: boolean; archNote?: string;
}
export interface WalkCell {
  opId: string; index: number; value: number | null; recorded: number | null; wide?: number | null;
  formula: string; lines: string[]; gap: number | null;
  terms: { j: number; w: number; x: number; prod: number }[];
  term?: { j: number; w: number; x: number; prod: number };
  float?: { note: string; a: BitField; b: BitField; prod: BitField; jsProd: number };
  shape: number[]; layer: number | null; head: number | null; nTerms?: number; termsShown?: number;
}
export interface BitField { value: number; hex: string; bits: string; sign: number; exp: number; frac: number; kind: string }
export interface FaultReport {
  id: string; hypothesis: string; model: string; prompt: string; cleanToken: number;
  meanKlExponent: number; meanKlMantissa: number; rateExponent: number; rateMantissa: number;
  predictionHolds: boolean; whatFlipped: string; n: number;
  rows: { trial: number; nFlip: number; klExponent: number; klMantissa: number; exponentChanged: boolean; mantissaChanged: boolean; tokenExponent: number; tokenMantissa: number }[];
}

export const [walkPrompt, setWalkPrompt] = createSignal('Once upon a time');
export const [walkView, setWalkView] = createSignal<WalkView | null>(null);
export const [walkZoom, setWalkZoom] = createSignal<Zoom>('model');
export const [walkOp, setWalkOp] = createSignal(0);
export const [walkPlaying, setWalkPlaying] = createSignal(false);
export const [walkBusy, setWalkBusy] = createSignal('');
export const [walkErr, setWalkErr] = createSignal('');
export const [walkCell, setWalkCell] = createSignal<WalkCell | null>(null);
export const [walkHead, setWalkHead] = createSignal(0);
export const [faultReport, setFaultReport] = createSignal<FaultReport | null>(null);
export const [walkCurve, setWalkCurve] = createSignal<{ vin: number; vout: number | null }[] | null>(null);

export function visibleOps(view: WalkView | null, head: number): WalkOp[] {
  if (!view) return [];
  return view.ops.filter((o) => o.head == null || o.head === head);
}

export function opAt(view: WalkView | null, head: number, index: number): WalkOp | null {
  const ops = visibleOps(view, head);
  if (!ops.length) return null;
  return ops[Math.max(0, Math.min(index, ops.length - 1))] ?? null;
}

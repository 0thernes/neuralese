// Shared Forge workspace state. The machine lives in src/forge.
import { createSignal } from 'solid-js';
import { DEMO_SOURCE } from '../../../src/forge/cells.js';
import { HELP } from '../../../src/forge/session.js';

export const FORGE_HELP = HELP;
export const DEMO = DEMO_SOURCE;

export interface ForgeError { code: string; msg: string }
export interface ForgeStep {
  pc: number; op: number; name: string; rd: number; result: number; halted: boolean;
  fail: string | null; mem: { addr: number; value: number } | null; regs: number[]; ram: number[];
}
export interface ForgeToken { lane: string; kind: string; text: string; pc?: number; op?: number; result?: number; byte?: number }
export interface ForgeRun {
  ok: boolean; source: string; seed: number; errors: ForgeError[];
  eq32: boolean; eq64: boolean; result: number | null;
  diff32: { i?: number; why?: string; faults?: string[] } | null;
  tokens: ForgeToken[];
  vm: { trace: ForgeStep[]; result: number | null; fail: string | null; ram: number[]; regs: number[] } | null;
  engine: { faults: string[]; kind: string; result: number | null } | null;
}
export interface LaneReport {
  criteria: { bf16Claimed: boolean; note: string };
  weightcpu: { correct: number; n: number; accuracy: number; ms: number; tokens: number; memoryWords: number; engineMatch: number };
  mdcc: { correct: number; n: number; accuracy: number; ms: number; tokens: number; memoryWords: number };
  weightRows: { id: string; expect: number; got: number | null; ok: boolean; eq32: boolean; faults: number | null }[];
  mdccRows: { id: string; ok: boolean; got: string | null }[];
}

export const [forgeSource, setForgeSource] = createSignal(DEMO);
export const [forgeRun, setForgeRun] = createSignal<ForgeRun | null>(null);
export const [forgeLanes, setForgeLanes] = createSignal<LaneReport | null>(null);
export const [forgeCursor, setForgeCursor] = createSignal(0);
export const [forgeHost, setForgeHost] = createSignal('');
export const [forgeClockMs, setForgeClockMs] = createSignal<number | null>(null);
export const [forgeBusy, setForgeBusy] = createSignal('');
export const [forgeErr, setForgeErr] = createSignal('');
export const [forgeBundle, setForgeBundle] = createSignal<string>('');

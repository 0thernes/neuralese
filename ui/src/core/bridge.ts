// Typed view of the legacy app (src/app.js publishes window.NEURALESE and fires neuralese:ready / neuralese:sel).
import type { Cfg, Trace } from './engine-api';
import type { AdversaryApi } from './adv';
import type { FaultReport, WalkCell, WalkView } from './walk';
export interface LegacySel { l: number; h: number | null; n: number | null; mat?: string }
export interface LegacyApp {
  showTab(k: string): void;
  setSel(s: Partial<LegacySel>): void;
  readonly sel: LegacySel;
  readonly order: [string, string][];
  readonly long: Record<string, string>;
  readonly cfg: Cfg;
  readonly lastTraces: Trace[] | null;
  readonly lastIds: number[] | null;
  viz?: { tier?: string };
  tok?: { encode(s: string): number[]; tokenStr(id: number): string };
  generate(): Promise<void>;
  analyze(): Promise<void>;
  adversary?: AdversaryApi;
  eng?: { newSeq(n: number): object; step(seq: object, id: number, o?: { trace?: boolean }): { h: Float32Array }; logits(h: ArrayLike<number>): ArrayLike<number> };
  hostForward?(): Promise<{ ms: number } | null>;
  hostGreedy?(text: string, n: number): Promise<{ ids: number[] } | null>;
  deepWalk?(prompt: string, opts?: { token?: number | null; cap?: number; fault?: { site: string; layer: number; bit: number; mode: string; indices: number[] } | null; edited?: boolean }): Promise<WalkView>;
  deepCell?(opId: string, index: number, term?: number | null): Promise<WalkCell | null>;
  deepFault?(): Promise<FaultReport>;
  deepMeta?(): { hypothesis: string; citations: { id: string; claim: string; cite: string; url: string }[] };
  mf?: {
    measure(opts: object, onProgress?: (p: { label?: string }) => void): Promise<unknown>;
    machine(body: object, onProgress?: (p: { label?: string }) => void): Promise<WmRunLike>;
    machineFrame(id: number, index: number): Promise<{ fb?: number[] } | null>;
    forge(body: object, onProgress?: (p: { label?: string }) => void): Promise<{ run: ForgeRunLike; bundle: string }>;
    forgeStep(id: number, index: number): Promise<{ ram?: number[] } | null>;
    lower(name: string, a: number, b: number, opts?: object): Promise<unknown>;
    moe(sample?: number): Promise<{ pos: Float32Array; colors: Float32Array; info: string; center: number[]; dist: number }>;
    lanes(onProgress?: (p: { label?: string }) => void): Promise<unknown>;
    ping(): Promise<unknown>;
    spectral(a: ArrayLike<number>, rows: number, cols: number): Promise<{ sv: number[]; stableRank: number; effRank: number; fro: number; spectralNorm: number; alpha: number; xmin: number; ks: number; nTail: number; esd: number[] }>;
  };
}
interface WmRunLike { id: number; frames: { fb?: number[] }[]; exact: boolean }
interface ForgeRunLike { id: number; ok: boolean; eq32: boolean; eq64: boolean; vm: { trace: unknown[] } | null; engine: { faults: unknown[] } | null; tokens: unknown[]; compiled?: { rom: number[] } }
declare global { interface Window { NEURALESE?: LegacyApp } }
export function legacy(): LegacyApp | null { return window.NEURALESE && 'showTab' in window.NEURALESE ? window.NEURALESE : null; }
export function whenReady(): Promise<LegacyApp> {
  const l = legacy(); if (l) return Promise.resolve(l);
  return new Promise((res) => document.addEventListener('neuralese:ready', () => res(legacy() as LegacyApp), { once: true }));
}

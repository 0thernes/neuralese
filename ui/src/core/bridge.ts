// Typed view of the legacy app (src/app.js publishes window.NEURALESE and fires neuralese:ready / neuralese:sel).
import type { Cfg, Trace } from './engine-api';
import type { AdversaryApi } from './adv';
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
}
declare global { interface Window { NEURALESE?: LegacyApp } }
export function legacy(): LegacyApp | null { return window.NEURALESE && 'showTab' in window.NEURALESE ? window.NEURALESE : null; }
export function whenReady(): Promise<LegacyApp> {
  const l = legacy(); if (l) return Promise.resolve(l);
  return new Promise((res) => document.addEventListener('neuralese:ready', () => res(legacy() as LegacyApp), { once: true }));
}

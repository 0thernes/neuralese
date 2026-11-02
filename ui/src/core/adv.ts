// Shared Adversary Lab state. The math lives in src/adversary and runs through the legacy bridge.
import { createSignal } from 'solid-js';

export interface KvPoint {
  phase: string; T: number; spectral_entropy: number; effective_rank: number; norm_per_token: number;
  key_norm: number; top_sv_ratio: number; rank10?: number; layer_norm_entropy?: number;
}
const buf: KvPoint[] = [];
const [kvTick, setKvTick] = createSignal(0);
export { kvTick };
export function resetKv(): void { buf.length = 0; setKvTick(kvTick() + 1); }
export function pushKv(p: KvPoint): void { buf.push(p); setKvTick(kvTick() + 1); }
export function kvPoints(): KvPoint[] { kvTick(); return buf.slice(); }

export interface Locked { locked: true; sha256: string; version: number; hypothesis: string; n_permutations: number; gen_tokens: number; n_random_sets: number; magnitude: number; steer_tokens: number; fwl_covariates: string[]; conditions: string[]; positive: string[]; feature_set: string[] }
export interface Plan { prereg: Locked; trials: { promptId: string; condition: string; systemLen: number; totalLen: number }[]; equal: boolean; yaml: string; fwl: string[] }
export interface AurocRep { auroc: number; p: number; p_paper: number; nPerm: number }
export interface GeoPart {
  kind: 'geometry';
  feature_names: string[];
  rows: { promptId: string; condition: string; label: number; systemLen: number; totalLen: number; T: number; T_gen: number; text: string; delta: number[] }[];
  fwl: { names: string[]; kept: number[]; droppedConstant: number };
  detector: { delta: AurocRep; encoding: AurocRep; lopo: { auroc: number | null; n: number; reason: string | null } };
  verdict: { label: 'above-chance' | 'null' | 'leakage'; text: string };
  compliance: { rate: null; note: string };
  caveats: string[];
}
export interface Unit { layer: number; neuron: number }
export interface NeuronPart {
  kind: 'neurons';
  top: { layer: number; neuron: number; d: number; meanPos: number; meanNeg: number }[];
  candidate: Unit[];
  magnitude: number;
  random: { units: Unit[]; key: string; evilCoherent: number }[];
  verdict: { candidateCount: number; randomCounts: number[]; n: number; pass: boolean; text: string };
  caveat: string;
}
export interface Bundle { kind: string; prereg_sha256: string; bundle_sha256: string; notebook_markdown?: string; prereg: Locked; results: { geometry: GeoPart | null; neurons: NeuronPart | null; caveats: string[] } }

export interface AdversaryApi {
  KV_CADENCE: number;
  synthetic(): { separableAuroc: number; tiedAuroc: number; note: string };
  plan(opts?: { conditions?: string[]; positive?: string[]; genTokens?: number; nPerm?: number; nPairs?: number; magnitude?: number; steerTokens?: number; previous?: Locked }): Promise<Plan>;
  runGeometry(plan: Plan): Promise<GeoPart>;
  runNeurons(plan: Plan): Promise<NeuronPart>;
  finish(prereg: Locked, geometry: GeoPart | null, neurons: NeuronPart | null): Promise<Bundle>;
}

const [plan, setPlan] = createSignal<Plan | null>(null);
const [geo, setGeo] = createSignal<GeoPart | null>(null);
const [neu, setNeu] = createSignal<NeuronPart | null>(null);
const [bundle, setBundle] = createSignal<Bundle | null>(null);
const [busy, setBusy] = createSignal('');
const [err, setErr] = createSignal('');
const [syn, setSyn] = createSignal<{ separableAuroc: number; tiedAuroc: number; note: string } | null>(null);
export { plan, setPlan, geo, setGeo, neu, setNeu, bundle, setBundle, busy, setBusy, err, setErr, syn, setSyn };

export const HELP = 'Two tracks, both experimental. Lyra Technique reads the singular-value geometry of the key cache (Edrington, Watson and Wilkes, Liberation Labs, 2026). That paper measured models from 0.5B to 70B parameters. The models here are smaller, and a null after the length controls is a valid result. The neuron track ranks MLP units that fire more on a labeled prompt set than on matched controls, then pushes the top pair and compares it with random pairs of the same size and magnitude. A unit firing is not a desire. The same unit can fire on a crime story or a cybersecurity sentence. The judge is a fixed word list plus a coherence check.';

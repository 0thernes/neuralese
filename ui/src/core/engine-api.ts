// Types for the existing worker protocols in src/ (engine-worker.js, arch/encoder-worker.js, lens-worker.js).
// These describe, not reimplement: the math stays in the verified JS.
import type { ApiMap } from './rpc';
export interface Trace { tok: number; t: number; resid_pre: Float32Array[]; z: Float32Array[]; attn_out: Float32Array[]; mlp_act: Float32Array[]; mlp_out: Float32Array[]; resid_post: Float32Array[]; pattern: Float32Array[][]; slotLayer: number[] }
export interface StepOut { h: Float32Array; trace: Trace | null; l: Float32Array; T: number; ids: number[] }
export interface EngineApi extends ApiMap {
  sync: [{ key: string; R: unknown; W?: unknown; stats?: unknown; sae?: unknown }, unknown];
  seq: [{ key: string; nPrompt: number }, { sid: number }];
  step: [{ key: string; sid: number; tok: number; trace: boolean }, StepOut];
  steps: [{ key: string; sid: number; toks: number[]; trace: boolean }, StepOut];
  beam: [{ key: string; sid: number; h0: Float32Array; opts: unknown }, unknown];
  free: [{ sids: number[] }, unknown];
}
export interface Cfg { d: number; H: number; hd: number; L: number; ff: number; V: number; window: number; eps: number }

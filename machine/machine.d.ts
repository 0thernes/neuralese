export const COMPONENTS: { id: string; name: string; x: number; y: number; z: number; color: number; blurb: string }[];
export const PROGRAMS: Record<string, { id: string; title: string; blurb: string }>;
export const PRECISION: { note: string; voltage: string; bf16: string; shipped: string; reference: string };
export const LIMITS: { FB_W: number; FB_H: number; LANES: number; TPU_N: number; BUS_LAT: number; macCycles: number };
export function identityRam(): number[];
export function vecRam(a: number[], b: number[]): number[];
export function packetStatusAt(p: WmPacket, cycle: number): string;
export function saveStorage(state: object): { format: string; words: number[]; bits: string; note?: string };
export function zoomView(component: string, level: string, state?: object | null): ZoomView;
export function runMachine(opts: WmOpts): WmRun;
export function measure(opts?: { seed?: number; cpu?: number; ram?: number; ssd?: number; gpu?: number; tpu?: number; bus?: number; mlp?: number }): WmMeasure;

export interface WmPacket {
  id: number; src: string; dst: string; op: string; addr: number; data: number | null;
  len: number; port: string; aux: string | null; issue: number; arrive: number | null; status: string;
}
export interface WmFrame {
  cycle: number; pc: number; regs: number[]; console: string; halted: boolean;
  fail: string | null; result: number | null; ei: number; irq: number; fb: number[];
  busy: { ssd: string; gpu: string; tpu: string }; eq: boolean;
}
export interface WmArch {
  cycle: number; pc: number; regs: number[]; ram: number[]; console: string;
  halted: boolean; fail: string | null; result: number | null; fb: number[];
}
export interface WmRun {
  program: string | null; exact: boolean; packetExact: boolean; precisionOk: boolean;
  rate: number; cycles: number; refCycles: number;
  diverge: { cycle: number; field: string; index?: number; weight: unknown; ref: unknown } | null;
  weight: WmArch; ref: WmArch; faults: string[]; injected: { cycle: number; kind: string }[];
  packets: WmPacket[]; frames: WmFrame[]; weightState: object;
}
export interface WmOpts {
  program?: string; rom?: number[]; ram?: number[] | null; storage?: object | null;
  pipeline?: boolean; fault?: object | null; trace?: boolean; limit?: number; ArrayType?: object;
}
export interface ZoomView {
  level: string; simulated: boolean; banner?: string; note?: string; component?: string;
  values?: number[][]; gates?: { id: number; op: string; y: number; t: number }[];
  logic?: number; hidden?: number; depth?: number; sample?: string; expect?: number;
  curve?: { vin: number; vout: number | null }[];
  nand?: { a: number; b: number; y: number | string; ok: boolean; vout: number | null }[];
  validHigh?: boolean; validLow?: boolean; vol?: number | null; voh?: number | null;
  and?: { check: boolean; note: string };
  out?: { y?: bigint; p?: bigint };
}
export interface WmMeasure {
  seed: number; rows: { component: string; trials: number; exact: number; msWeight: number; msRef: number | null; overhead: number | null; cyclesWeight: number }[];
  programs: { id: string; exact: boolean; cycles: number; msWeight: number; msRef: number; overhead: number | null; result: number | null; faults: number }[];
}

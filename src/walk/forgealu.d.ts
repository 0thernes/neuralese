export function lowerForge(name: string, a: number, b: number, opts?: { sample?: number; stuck?: Record<number, number>; limit?: number; focus?: number }): ForgeGate;
export function significandProduct(a: number, b: number, opts?: { sample?: number; limit?: number }): SigProduct;
export function vmOperands(rom: number[], index: number): { name: string; a: number; b: number; rd: number; pc: number; op: number };
export interface ForgeGate {
  kind: string; name?: string; a?: number; b?: number; value: number | null; expected: number | null; match: boolean;
  note: string; logic?: number; depth?: number; shown?: { id: number; op: string; y: number; t: number }[]; hidden?: number;
}
export interface SigProduct {
  ok: boolean; match?: boolean; product?: string; note: string; kind?: string;
  logic?: number; depth?: number; shown?: { id: number; op: string; y: number; t: number }[]; hidden?: number;
  sign?: number; expSum?: number;
}

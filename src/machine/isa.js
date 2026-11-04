// Weight-Machine / WM-ISA. ForgeISA/1 plus a SYS opcode for the devices around it.
// The opcode field is four bits. Forge uses 0..14. 15 is SYS. Nothing here is a Minecraft
// schematic or a Packet Tracer file; those are named in docs/WEIGHT_MACHINE.md as ideas only.

import { FUNCT_HALT, FUNCT_OP, OP } from '../forge/isa.js';

export const WM_VERSION = 'WM-ISA/1';
export const OP_SYS = 15;

export const F = Object.freeze({
  OUT: 0,
  DLD: 1,
  SSD: 2,
  GPU: 3,
  TPU: 4,
  EI: 5,
  IRET: 6,
});

export const F_NAME = Object.freeze({
  0: 'OUT', 1: 'DLD', 2: 'SSD', 3: 'GPU', 4: 'TPU', 5: 'EI', 6: 'IRET',
});

export const DEV = Object.freeze({
  ram: 0, ssd: 1, gpu: 2, tpu: 3, console: 4, fb: 5,
});

export const RAM_WORDS = 256;
export const WORD_BITS = 32;
export const SSD_PAGES = 32;
export const SSD_WORDS = 16;
export const SSD_TOTAL = SSD_PAGES * SSD_WORDS;
export const FB_W = 32;
export const FB_H = 32;
export const FB_PIXELS = FB_W * FB_H;
export const LANES = 16;
export const TPU_N = 8;
export const BUS_LAT = 2;
export const IRQ_VECTOR = 200;
export const STEP_LIMIT = 20000;
export const MASTERS = Object.freeze(['cpu', 'tpu', 'gpu', 'ssd']);

export const COMPONENTS = Object.freeze([
  Object.freeze({ id: 'cpu', name: 'CPU', x: -2.2, y: 0.6, z: 0.2, color: 0x2dd4bf, blurb: 'Forge core, plus SYS. Optional two-stage pipeline and one IRQ line.' }),
  Object.freeze({ id: 'ram', name: 'RAM', x: 0.2, y: 0.7, z: -2.4, color: 0x38bdf8, blurb: '256 words. Read is hard attention. Write is a delta rule.' }),
  Object.freeze({ id: 'ssd', name: 'SSD', x: -4.6, y: 0.55, z: 1.4, color: 0xfbbf24, blurb: '32 pages × 16 words. Slower than RAM. The page bits are the saved state file.' }),
  Object.freeze({ id: 'gpu', name: 'GPU', x: 2.6, y: 0.65, z: -1.2, color: 0xa78bfa, blurb: '16 lanes of one gadget. Pattern shader or a 16-wide add.' }),
  Object.freeze({ id: 'tpu', name: 'TPU', x: 4.8, y: 0.6, z: 1.1, color: 0xfb7185, blurb: '8×8 output-stationary systolic array of MAC gadgets.' }),
  Object.freeze({ id: 'console', name: 'Console', x: -2.4, y: 0.4, z: 2.8, color: 0x94a3b8, blurb: 'Byte writes become the console string.' }),
  Object.freeze({ id: 'fb', name: 'Framebuffer', x: 1.4, y: 0.45, z: 2.8, color: 0x4ade80, blurb: '32×32 bytes. The GPU pattern shader fills it.' }),
]);

export function macCycles(n) { return 3 * n - 2; }

export function sysName(funct) { return F_NAME[funct] || 'SYS?'; }

export function isForgeOp(op, funct) {
  if (op === OP.HALT) return funct === FUNCT_HALT;
  if (op >= OP.ADD && op <= OP.SLT) return funct === FUNCT_OP;
  return false;
}

export { FUNCT_HALT, FUNCT_OP, OP };

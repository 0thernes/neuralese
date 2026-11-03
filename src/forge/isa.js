// ForgeISA/1 — Neuralese-original machine. Not a port of any published weight-baked CPU.
// 8 registers (r0 hardwired 0), 256-word ROM, 256-word RAM, 32-bit two's-complement words.
// PC is a word index in 0..255. Branch and jump offsets are signed 16-bit words, then masked to 8 bits.

export const ISA_VERSION = 'ForgeISA/1';
export const NESTLANG_VERSION = 'NestLang/1';
export const ROM_WORDS = 256;
export const RAM_WORDS = 256;
export const NREG = 8;
export const WORD_BITS = 32;
export const STEP_LIMIT = 4096;

export const OP = Object.freeze({
  HALT: 0, ADD: 1, SUB: 2, AND: 3, OR: 4, XOR: 5, ADDI: 6, LW: 7,
  SW: 8, BEQ: 9, BNE: 10, BLT: 11, LUI: 12, JAL: 13, SLT: 14,
});
export const OP_NAME = Object.freeze(Object.fromEntries(Object.entries(OP).map(([k, v]) => [v, k])));
export const FUNCT_OP = 0;
export const FUNCT_HALT = 1;

// [3:0] op  [6:4] rd  [9:7] rs1  [12:10] rs2  [15:13] funct  [31:16] imm16
export function enc(op, rd = 0, rs1 = 0, rs2 = 0, imm = 0, funct = FUNCT_OP) {
  const imm16 = imm & 0xffff;
  return ((imm16 << 16) | ((funct & 7) << 13) | ((rs2 & 7) << 10) | ((rs1 & 7) << 7) | ((rd & 7) << 4) | (op & 15)) >>> 0;
}

export function dec(word) {
  const w = word >>> 0;
  const imm = (w >>> 16) & 0xffff;
  const op = w & 15;
  return {
    op, rd: (w >>> 4) & 7, rs1: (w >>> 7) & 7, rs2: (w >>> 10) & 7, funct: (w >>> 13) & 7,
    imm, simm: (imm << 16) >> 16, name: OP_NAME[op] || 'ILL', word: w,
  };
}

export function padRom(words) {
  const rom = words.slice(0, ROM_WORDS);
  while (rom.length < ROM_WORDS) rom.push(0);
  return rom;
}

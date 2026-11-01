// Independent JS reference interpreter (same machine model as e1_riscv/rv.py) used ONLY for the live agreement badge.
window.RefRV = class {
  constructor(rom, ram) { this.rom = rom.concat(Array(64 - rom.length).fill(0)); this.ram = ram.slice(); this.x = Array(8).fill(0); this.pc = 0; }
  step() {
    const sx = (v, b) => (v << (32 - b)) >> (32 - b), w = this.rom[(this.pc >>> 2) & 63] >>> 0, o = w & 127, rd = (w >>> 7) & 7, f3 = (w >>> 12) & 7, f7 = w >>> 25;
    const a = this.x[(w >>> 15) & 7] >>> 0, b = this.x[(w >>> 20) & 7] >>> 0, iI = sx(w >>> 20, 12);
    let npc = (this.pc + 4) >>> 0, r = null;
    if (o === 0x33 && [0, 2, 4, 6, 7].includes(f3) && (f7 === 0 || (f7 === 32 && f3 === 0))) r = f3 === 0 ? (f7 ? a - b : a + b) : f3 === 2 ? +((a | 0) < (b | 0)) : f3 === 4 ? a ^ b : f3 === 6 ? a | b : a & b;
    else if (o === 0x13 && [0, 2, 4, 6, 7].includes(f3)) r = f3 === 0 ? a + iI : f3 === 2 ? +((a | 0) < iI) : f3 === 4 ? a ^ iI : f3 === 6 ? a | iI : a & iI;
    else if (o === 0x37) r = w & 0xFFFFF000;
    else if (o === 0x03 && f3 === 2) r = this.ram[((a + iI) >>> 2) & 31];
    else if (o === 0x23 && f3 === 2) this.ram[((a + sx(((w >>> 25) << 5) | ((w >>> 7) & 31), 12)) >>> 2) & 31] = b;
    else if (o === 0x63 && f3 < 2) { if ((a === b) === (f3 === 0)) npc = (this.pc + sx((((w >>> 31) & 1) << 12) | (((w >>> 7) & 1) << 11) | (((w >>> 25) & 63) << 5) | (((w >>> 8) & 15) << 1), 13)) >>> 0; }
    else if (o === 0x6F) { r = this.pc + 4; npc = (this.pc + sx((((w >>> 31) & 1) << 20) | (((w >>> 12) & 255) << 12) | (((w >>> 20) & 1) << 11) | (((w >>> 21) & 1023) << 1), 21)) >>> 0; }
    if (r !== null && rd) this.x[rd] = r >>> 0; this.pc = npc;
  }
};

// Binary gadgets for the Forge weight engine.
// Every input that reaches these functions is 0 or 1. The combinations below are integers
// float32 can hold exactly (they sit far below 2^24). This is not a bf16 claim.

export function checkBit(x, faults, tag) {
  if (x !== 0 && x !== 1) faults.push(`${tag}:${x}`);
  return x;
}

export function and2(a, b) {
  const s = a + b - 1;
  return s > 0 ? s : 0;
}

export function not(a) { return 1 - a; }

export function xor2(a, b) { return a + b - 2 * and2(a, b); }

export function or2(a, b) { return a + b - and2(a, b); }

export function mux(sel, a, b) { return sel * a + (1 - sel) * b; }

export function orN(xs) {
  let a = 0;
  for (const x of xs) a = or2(a, x);
  return a;
}

export function oneHot(bits, n, faults, tag) {
  const N = 1 << n;
  const oh = new bits.constructor(N);
  let sum = 0;
  for (let a = 0; a < N; a++) {
    let m = 1;
    for (let k = 0; k < n; k++) {
      const want = (a >>> k) & 1;
      const bit = want ? bits[k] : not(bits[k]);
      m = and2(m, bit);
    }
    oh[a] = m;
    sum += m;
    checkBit(m, faults, tag);
  }
  if (sum !== 1) faults.push(`${tag}:sum=${sum}`);
  return oh;
}

export function addBits(a, b, cin, width, faults, tag) {
  const out = new a.constructor(width);
  let c = cin;
  for (let i = 0; i < width; i++) {
    const x = xor2(a[i], b[i]);
    out[i] = checkBit(xor2(x, c), faults, tag);
    c = checkBit(or2(and2(a[i], b[i]), and2(x, c)), faults, tag);
  }
  return { out, cout: c };
}

export function sltBit(a, b, faults) {
  const nb = new a.constructor(a.length);
  for (let i = 0; i < a.length; i++) nb[i] = not(b[i]);
  const { out } = addBits(a, nb, 1, a.length, faults, 'slt');
  const signsDiffer = xor2(a[31], b[31]);
  const ovf = and2(signsDiffer, xor2(out[31], a[31]));
  return checkBit(xor2(out[31], ovf), faults, 'slt');
}

export function bitsToUint(bits, n) {
  let u = 0;
  for (let k = 0; k < n; k++) {
    if (bits[k] === 1) u += 2 ** k;
    else if (bits[k] !== 0) return null;
  }
  return u;
}

export function bitsToInt32(bits) {
  const u = bitsToUint(bits, 32);
  return u === null ? null : (u | 0);
}

export function writeBits(dst, base, value, n) {
  const u = value >>> 0;
  for (let k = 0; k < n; k++) dst[base + k] = (u >>> k) & 1;
}

export function muxBank(oh, bank, width, faults, tag) {
  const out = new oh.constructor(width);
  const n = oh.length;
  for (let k = 0; k < width; k++) {
    let s = 0;
    for (let a = 0; a < n; a++) s += oh[a] * bank[a * width + k];
    out[k] = s;
    checkBit(s, faults, tag);
  }
  return out;
}

export function writeBank(oh, bank, data, enable, width) {
  const n = oh.length;
  for (let a = 0; a < n; a++) {
    const sel = enable * oh[a];
    const row = a * width;
    for (let k = 0; k < width; k++) bank[row + k] = sel * data[k] + (1 - sel) * bank[row + k];
  }
}

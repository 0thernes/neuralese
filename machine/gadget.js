// Weight gadgets. A gadget is a fixed net of linear combinations, ReLU gates, and hard attention.
// Inputs that reach the bit ops are 0 or 1. float32 holds those integers exactly. This is not a bf16 claim.
// The host wires gadgets together and steps them. It does not replace a gadget with a hidden multiply.

import { addBits, and2, bitsToInt32, bitsToUint, checkBit, muxBank, not, oneHot, or2, writeBank, writeBits, xor2 } from '../forge/bits.js';

export const AND_LAYER = Object.freeze({
  kind: 'gated-linear',
  name: 'and2',
  W: Object.freeze([1, 1]),
  b: -1,
  act: 'relu',
  note: 'AND is the gated linear unit relu(1·x0 + 1·x1 − 1). Those two weights and the bias are the gadget.',
});

export const NOT_LAYER = Object.freeze({
  kind: 'linear',
  name: 'not',
  W: Object.freeze([-1]),
  b: 1,
  act: 'identity',
  note: 'NOT is the linear map 1 − x. No gate.',
});

export function applyAndLayer(x0, x1) {
  const z = AND_LAYER.W[0] * x0 + AND_LAYER.W[1] * x1 + AND_LAYER.b;
  return z > 0 ? z : 0;
}

export function applyNotLayer(x) {
  return NOT_LAYER.W[0] * x + NOT_LAYER.b;
}

export function zeros(T, n) {
  return new T(n);
}

export function intBits(T, value, n) {
  const out = new T(n);
  writeBits(out, 0, value | 0, n);
  return out;
}

export function sliceBits(src, lo, n) {
  const out = new src.constructor(n);
  for (let i = 0; i < n; i++) out[i] = src[lo + i];
  return out;
}

export function copyBits(dst, lo, src) {
  for (let i = 0; i < src.length; i++) dst[lo + i] = src[i];
}

// Hard attention: address bits are the query, the one-hot is the attention, the bank is V.
// It is the zero-temperature limit of softmax attention on a one-hot match, computed exactly
// with AND gates rather than a softmax. A softmax is not run.
export function attentionRead(addrBits, bank, width, faults, tag) {
  const oh = oneHot(addrBits, addrBits.length, faults, tag);
  const value = muxBank(oh, bank, width, faults, tag);
  return { scores: oh, value };
}

// Delta rule with step size 1 on the selected row: v <- v + alpha * (data - v), alpha in {0,1}.
// alpha = enable * one-hot. That is the writeBank update.
export function deltaWrite(addrBits, bank, data, enable, width, faults, tag) {
  const oh = oneHot(addrBits, addrBits.length, faults, tag);
  writeBank(oh, bank, data, enable, width);
  return oh;
}

export function readWord(bank, index, width, faults, tag) {
  const n = Math.round(Math.log2(bank.length / width));
  const addr = intBits(bank.constructor, index, n);
  return attentionRead(addr, bank, width, faults, tag).value;
}

export function writeWord(bank, index, value, width, faults, tag) {
  const n = Math.round(Math.log2(bank.length / width));
  const addr = intBits(bank.constructor, index, n);
  const data = typeof value === 'number' ? intBits(bank.constructor, value, width) : value;
  deltaWrite(addr, bank, data, 1, width, faults, tag);
}

// Page bank is (pages * pageWords) rows. Selecting a page is attention over the page index,
// then the word slot inside that page.
export function readPaged(bank, page, index, pages, pageWords, width, faults, tag) {
  const bits = Math.round(Math.log2(pages));
  const addr = intBits(bank.constructor, page, bits);
  const oh = oneHot(addr, bits, faults, tag);
  const out = new bank.constructor(width);
  for (let k = 0; k < width; k++) {
    let s = 0;
    for (let p = 0; p < pages; p++) s += oh[p] * bank[(p * pageWords + index) * width + k];
    out[k] = checkBit(s, faults, tag);
  }
  return out;
}

export function writePaged(bank, page, index, data, pages, pageWords, width, faults, tag) {
  const bits = Math.round(Math.log2(pages));
  const addr = intBits(bank.constructor, page, bits);
  const oh = oneHot(addr, bits, faults, tag);
  const rowData = typeof data === 'number' ? intBits(bank.constructor, data, width) : data;
  for (let p = 0; p < pages; p++) {
    const sel = oh[p];
    const row = (p * pageWords + index) * width;
    for (let k = 0; k < width; k++) bank[row + k] = sel * rowData[k] + (1 - sel) * bank[row + k];
  }
}

export function mulUnsignedBits(a, b, width, faults, tag) {
  const T = a.constructor;
  const n = width * 2;
  let acc = new T(n);
  for (let i = 0; i < width; i++) {
    const partial = new T(n);
    for (let j = 0; j < width; j++) partial[i + j] = and2(a[j], b[i]);
    acc = addBits(acc, partial, 0, n, faults, tag + i).out;
  }
  return acc;
}

// int8 product via the unsigned array multiply and the usual sign correction, mod 2^16,
// then sign-extended to 32 bits. (-128)*(-128) = 16384, which fits in signed 16 bits.
export function mul8signedBits(a, b, faults, tag) {
  const prod = mulUnsignedBits(a, b, 8, faults, tag);
  const T = a.constructor;
  const sub1 = new T(16);
  const sub2 = new T(16);
  for (let i = 0; i < 8; i++) {
    sub1[i + 8] = and2(a[7], b[i]);
    sub2[i + 8] = and2(b[7], a[i]);
  }
  const n1 = new T(16);
  for (let i = 0; i < 16; i++) n1[i] = not(sub1[i]);
  let out = addBits(prod, n1, 1, 16, faults, tag + 's1').out;
  const n2 = new T(16);
  for (let i = 0; i < 16; i++) n2[i] = not(sub2[i]);
  out = addBits(out, n2, 1, 16, faults, tag + 's2').out;
  const full = new T(32);
  for (let i = 0; i < 16; i++) full[i] = out[i];
  for (let i = 16; i < 32; i++) full[i] = out[15];
  for (let i = 0; i < 32; i++) checkBit(full[i], faults, tag + 'sx');
  return full;
}

export function reluBits(word, faults, tag) {
  const neg = word[word.length - 1];
  const out = new word.constructor(word.length);
  const keep = not(neg);
  for (let i = 0; i < word.length; i++) out[i] = checkBit(and2(word[i], keep), faults, tag);
  return out;
}

// Round-robin grant. reqBits[k] is 1 if master k wants the bus.
// The winner is the first requesting master at or after rr, wrapped. The scan is AND/OR gates.
export function grantBits(reqBits, rr, faults) {
  const n = reqBits.length;
  const win = new reqBits.constructor(n);
  let seen = 0;
  for (let i = 0; i < n; i++) {
    const k = (rr + i) % n;
    win[k] = checkBit(and2(reqBits[k], not(seen)), faults, 'grant');
    seen = or2(seen, reqBits[k]);
  }
  let index = -1;
  let sum = 0;
  for (let k = 0; k < n; k++) {
    sum += win[k];
    if (win[k] === 1) index = k;
  }
  if (sum !== 0 && sum !== 1) faults.push('grant:sum=' + sum);
  return { index: sum === 1 ? index : -1, win, any: seen };
}

// One-hot route: dest bits select the port that receives the payload. Other ports get 0.
export function routeBits(destBits, dataBits, nPorts, faults, tag) {
  const oh = oneHot(destBits, destBits.length, faults, tag);
  const ports = [];
  for (let p = 0; p < nPorts; p++) {
    const row = new dataBits.constructor(dataBits.length);
    const sel = p < oh.length ? oh[p] : 0;
    for (let k = 0; k < dataBits.length; k++) row[k] = checkBit(sel * dataBits[k], faults, tag);
    ports.push(row);
  }
  return { scores: oh, ports };
}

export function wordOf(bits) {
  const n = bitsToInt32(bits);
  return n === null ? null : n;
}

export function uOf(bits) {
  return bitsToUint(bits, bits.length);
}

export function xorWord(a, b, faults, tag) {
  const out = new a.constructor(a.length);
  for (let i = 0; i < a.length; i++) out[i] = checkBit(xor2(a[i], b[i]), faults, tag);
  return out;
}

export { addBits, and2, bitsToInt32, bitsToUint, checkBit, not, oneHot, or2, xor2 };

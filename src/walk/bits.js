// IEEE-754 binary32 field view. The engine stores weights and activations as float32.
// A JavaScript number that already holds a float32 value is shown by rounding into a Float32Array first.

export function f32bits(x) {
  const f = new Float32Array(1);
  f[0] = x;
  const u = new Uint32Array(f.buffer)[0] >>> 0;
  const sign = u >>> 31;
  const exp = (u >>> 23) & 255;
  const frac = u & 0x7fffff;
  let kind = 'normal';
  if (exp === 0) kind = frac === 0 ? 'zero' : 'denormal';
  else if (exp === 255) kind = frac === 0 ? 'inf' : 'nan';
  return { u, sign, exp, frac, kind, f32: f[0] };
}

export function f32hex(x) {
  return '0x' + f32bits(x).u.toString(16).padStart(8, '0');
}

export function bitString(u) {
  return (u >>> 0).toString(2).padStart(32, '0');
}

// Mutates one float32 element. mode is 'flip', 'stuck0', or 'stuck1' on a single bit 0..31.
// Returns the before/after bit patterns. The caller decides which tensor this array is.
export function faultFloatBit(vec, index, bit, mode) {
  if (!Number.isInteger(bit) || bit < 0 || bit > 31) throw new Error('bit ' + bit);
  if (!Number.isInteger(index) || index < 0 || index >= vec.length) throw new Error('index ' + index);
  const u = new Uint32Array(vec.buffer, vec.byteOffset, vec.length);
  const before = u[index] >>> 0;
  const mask = 1 << bit;
  let after;
  if (mode === 'stuck0') after = before & ~mask;
  else if (mode === 'stuck1') after = before | mask;
  else if (mode === 'flip') after = before ^ mask;
  else throw new Error('mode ' + mode);
  u[index] = after >>> 0;
  return { index, bit, mode, before, after: after >>> 0, value: vec[index] };
}

export function applyFaults(vec, spec) {
  const out = [];
  const mode = spec.mode || 'flip';
  for (const index of spec.indices) out.push(faultFloatBit(vec, index, spec.bit, mode));
  return out;
}

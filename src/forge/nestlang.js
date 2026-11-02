// NestLang/1 — Neuralese-original surface language for ForgeISA.
// Unmarked and `once` bindings are affine (one syntactic read). `dup` may be read any number of times.
// `rec n` is the only loop. `n` must be nat, the body may not mention `n`, and the compiler decrements it.
// RAM word 255 is compiler scratch. Named values use r1–r5. r0 is zero. r6 and r7 are temps.

import { FUNCT_HALT, OP, dec, enc } from './isa.js';

const TYPES = new Set(['i32', 'nat', 'bool']);

function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '=' && src[i + 1] === '=') { toks.push({ k: '==' }); i += 2; continue; }
    if ('=+-<>{}()'.includes(c)) { toks.push({ k: c }); i++; continue; }
    if (/[0-9]/.test(c)) {
      let n = 0;
      while (i < src.length && /[0-9]/.test(src[i])) { n = n * 10 + (src.charCodeAt(i) - 48); i++; }
      if (src[i] === 'n') { i++; toks.push({ k: 'nat', v: n }); }
      else toks.push({ k: 'num', v: n });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let id = '';
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) id += src[i++];
      if (id === 'true' || id === 'false') toks.push({ k: 'bool', v: id === 'true' ? 1 : 0 });
      else toks.push({ k: 'id', v: id });
      continue;
    }
    const err = new Error('bad character ' + JSON.stringify(c)); err.code = 'syntax'; throw err;
  }
  return toks;
}

export function parse(src) {
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i];
  const eat = (k) => { const t = peek(); if (!t || t.k !== k) return null; i++; return t; };
  const eatId = (v) => { const t = peek(); if (t && t.k === 'id' && t.v === v) { i++; return t; } return null; };
  const need = (k) => { const t = eat(k); if (!t) { const err = new Error('expected ' + k); err.code = 'syntax'; throw err; } return t; };
  const parseExpr = () => parseCmp();
  function parseCmp() {
    const left = parseAdd();
    const t = peek();
    if (t && (t.k === '==' || t.k === '<')) { i++; return { k: 'bin', op: t.k, a: left, b: parseAdd() }; }
    return left;
  }
  function parseAdd() {
    let left = parseUnary();
    while (peek() && (peek().k === '+' || peek().k === '-')) { const op = peek().k; i++; left = { k: 'bin', op, a: left, b: parseUnary() }; }
    return left;
  }
  function parseUnary() { return eat('-') ? { k: 'neg', a: parseUnary() } : parsePrimary(); }
  function parsePrimary() {
    const t = peek();
    if (!t) { const err = new Error('expected expression'); err.code = 'syntax'; throw err; }
    if (t.k === 'num' || t.k === 'nat' || t.k === 'bool') { i++; return { k: t.k, v: t.v }; }
    if (t.k === 'id') { i++; return { k: 'name', name: t.v }; }
    if (eat('(')) { const e = parseExpr(); need(')'); return e; }
    const err = new Error('expected expression'); err.code = 'syntax'; throw err;
  }
  function parseBlock() {
    need('{');
    const body = [];
    while (peek() && peek().k !== '}') body.push(parseStmt());
    need('}');
    return body;
  }
  function parseStmt() {
    if (eatId('halt')) return { k: 'halt', expr: parseExpr() };
    if (eatId('rec')) { const id = need('id'); return { k: 'rec', name: id.v, body: parseBlock() }; }
    if (eatId('if')) { const cond = parseExpr(); const then = parseBlock(); if (!eatId('else')) { const err = new Error('if needs else'); err.code = 'syntax'; throw err; } return { k: 'if', cond, then, else: parseBlock() }; }
    let aff = 'once';
    if (eatId('dup')) aff = 'dup'; else if (eatId('once')) aff = 'once';
    const type = ['i32', 'nat', 'bool'].find((ty) => eatId(ty));
    if (type) { const name = need('id'); need('='); return { k: 'let', aff, type, name: name.v, rhs: parseExpr() }; }
    const name = need('id'); need('='); return { k: 'assign', name: name.v, rhs: parseExpr() };
  }
  const stmts = [];
  while (i < toks.length) stmts.push(parseStmt());
  return stmts;
}

function mentions(expr, name) {
  if (!expr) return false;
  if (expr.k === 'name') return expr.name === name;
  if (expr.k === 'neg') return mentions(expr.a, name);
  if (expr.k === 'bin') return mentions(expr.a, name) || mentions(expr.b, name);
  return false;
}
function stmtMentions(s, name) {
  if (s.k === 'let') return s.name === name || mentions(s.rhs, name);
  if (s.k === 'assign') return s.name === name || mentions(s.rhs, name);
  if (s.k === 'halt') return mentions(s.expr, name);
  if (s.k === 'if') return mentions(s.cond, name) || s.then.some((x) => stmtMentions(x, name)) || s.else.some((x) => stmtMentions(x, name));
  if (s.k === 'rec') return s.body.some((x) => stmtMentions(x, name));
  return false;
}

function fitsI32(v) { return Number.isInteger(v) && v >= -2147483648 && v <= 2147483647; }

export function typecheck(ast) {
  const errors = [];
  const env = new Map();
  const err = (code, msg) => errors.push({ code, msg });
  function touch(name) {
    const e = env.get(name);
    if (!e) { err('name', 'unknown ' + name); return null; }
    e.used += 1;
    if (e.used > e.budget) err('affine', name + ' used more than once');
    return e.type;
  }
  function exprType(ex) {
    if (ex.k === 'num') { if (!fitsI32(ex.v)) err('type', 'i32 literal out of range'); return 'i32'; }
    if (ex.k === 'nat') { if (!fitsI32(ex.v) || ex.v < 0) err('type', 'nat literal out of range'); return 'nat'; }
    if (ex.k === 'bool') return 'bool';
    if (ex.k === 'name') return touch(ex.name);
    if (ex.k === 'neg') {
      if (ex.a.k === 'num') { if (!fitsI32(-ex.a.v)) err('type', 'i32 literal out of range'); return 'i32'; }
      const t = exprType(ex.a); if (t && t !== 'i32') err('type', 'negation needs i32'); return 'i32';
    }
    if (ex.k === 'bin') {
      const ta = exprType(ex.a), tb = exprType(ex.b);
      if (ex.op === '+' || ex.op === '-') { if (ta && ta !== 'i32') err('type', ex.op + ' needs i32'); if (tb && tb !== 'i32') err('type', ex.op + ' needs i32'); return 'i32'; }
      if (ta && tb && ta !== tb) err('type', ex.op + ' types differ');
      if (ex.op === '<' && ta && ta === 'bool') err('type', '< needs i32 or nat');
      return 'bool';
    }
    err('type', 'bad expression'); return null;
  }
  function walk(stmts, binder) {
    let halted = false;
    for (const s of stmts) {
      if (halted) { err('termination', 'code after halt'); break; }
      if (binder && stmtMentions(s, binder)) err('termination', 'rec binder ' + binder + ' is mentioned in its body');
      if (s.k === 'let') {
        if (!TYPES.has(s.type)) err('type', s.type);
        if (env.has(s.name)) err('name', 'redeclared ' + s.name);
        const t = exprType(s.rhs);
        if (t && t !== s.type) err('type', s.name + ' is ' + s.type + ' but the value is ' + t);
        env.set(s.name, { type: s.type, budget: s.aff === 'dup' ? Infinity : 1, used: 0 });
      } else if (s.k === 'assign') {
        const e = env.get(s.name);
        if (!e) err('name', 'unknown ' + s.name);
        const t = exprType(s.rhs);
        if (e && t && e.type !== t) err('type', s.name + ' is ' + e.type + ' but the value is ' + t);
      } else if (s.k === 'halt') {
        const t = exprType(s.expr);
        if (t === 'bool') err('type', 'halt needs i32 or nat');
        halted = true;
      } else if (s.k === 'if') {
        const t = exprType(s.cond);
        if (t && t !== 'bool') err('type', 'if needs bool');
        const a = walk(s.then, binder), b = walk(s.else, binder);
        if (a !== b) err('termination', 'if branches must both halt or both continue');
        halted = a;
      } else if (s.k === 'rec') {
        const e = env.get(s.name);
        if (!e) err('name', 'unknown ' + s.name);
        else if (e.type !== 'nat') err('termination', 'rec binder ' + s.name + ' must be nat');
        else { e.used += 1; if (e.used > e.budget) err('affine', s.name + ' used more than once'); }
        if (walk(s.body, s.name)) err('termination', 'halt inside rec');
      }
    }
    return halted;
  }
  if (!walk(ast, null)) err('termination', 'not every path halts');
  return { ok: errors.length === 0, errors };
}

function emit(ast) {
  const rom = [];
  const regOf = new Map();
  let next = 1;
  const reg = (name) => {
    if (!regOf.has(name)) { if (next > 5) { const err = new Error('more than 5 named values'); err.code = 'syntax'; throw err; } regOf.set(name, next++); }
    return regOf.get(name);
  };
  const put = (op, rd = 0, rs1 = 0, rs2 = 0, imm = 0, funct = 0) => { rom.push(enc(op, rd, rs1, rs2, imm, funct)); return rom.length - 1; };
  const patch = (at, imm) => {
    if (imm < -32768 || imm > 32767) { const err = new Error('branch out of range'); err.code = 'syntax'; throw err; }
    const d = dec(rom[at]); rom[at] = enc(d.op, d.rd, d.rs1, d.rs2, imm, d.funct);
  };
  function emitI32(dest, v) {
    v |= 0;
    if (v >= -32768 && v <= 32767) { put(OP.ADDI, dest, 0, 0, v & 0xffff); return; }
    if (dest >= 6) { const err = new Error('wide constant into scratch'); err.code = 'syntax'; throw err; }
    const hi = (v >>> 16) & 0xffff, lo = v & 0xffff;
    put(OP.LUI, dest, 0, 0, hi);
    if (lo === 0) return;
    if (lo <= 32767) put(OP.ADDI, 6, 0, 0, lo);
    else { put(OP.ADDI, 6, 0, 0, (lo - 65536) & 0xffff); put(OP.LUI, 7, 0, 0, 1); put(OP.ADD, 6, 6, 7); }
    put(OP.OR, dest, dest, 6);
  }
  function operands(ex) {
    if (ex.a.k !== 'name' && ex.b.k !== 'name') { evalTo(ex.b, 7); put(OP.SW, 0, 0, 7, 255); evalTo(ex.a, 6); put(OP.LW, 7, 0, 0, 255); return [6, 7]; }
    if (ex.a.k !== 'name') { evalTo(ex.a, 6); return [6, reg(ex.b.name)]; }
    if (ex.b.k !== 'name') { evalTo(ex.b, 7); return [reg(ex.a.name), 7]; }
    return [reg(ex.a.name), reg(ex.b.name)];
  }
  function evalTo(ex, dest) {
    if (ex.k === 'num') { emitI32(dest, ex.v); return; }
    if (ex.k === 'nat') { emitI32(dest, ex.v); return; }
    if (ex.k === 'bool') { put(OP.ADDI, dest, 0, 0, ex.v); return; }
    if (ex.k === 'name') { if (reg(ex.name) !== dest) put(OP.ADDI, dest, reg(ex.name), 0, 0); return; }
    if (ex.k === 'neg') { if (ex.a.k === 'num') { emitI32(dest, -ex.a.v); return; } evalTo(ex.a, 6); put(OP.SUB, dest, 0, 6); return; }
    if (ex.op === '==') {
      const [ra, rb] = operands(ex);
      put(OP.XOR, 6, ra, rb); put(OP.SLT, 7, 0, 6); put(OP.SLT, 6, 6, 0); put(OP.OR, 6, 6, 7); put(OP.ADDI, 7, 0, 0, 1); put(OP.XOR, dest, 6, 7);
      return;
    }
    if (ex.op === '<') { const [ra, rb] = operands(ex); put(OP.SLT, dest, ra, rb); return; }
    const [ra, rb] = operands(ex);
    put(ex.op === '+' ? OP.ADD : OP.SUB, dest, ra, rb);
  }
  function emitStmts(stmts) {
    for (const s of stmts) {
      if (s.k === 'let' || s.k === 'assign') evalTo(s.rhs, s.k === 'let' ? reg(s.name) : reg(s.name));
      else if (s.k === 'halt') {
        if (s.expr.k === 'name') put(OP.HALT, reg(s.expr.name), 0, 0, 0, FUNCT_HALT);
        else { evalTo(s.expr, 6); put(OP.HALT, 6, 0, 0, 0, FUNCT_HALT); }
      } else if (s.k === 'rec') {
        const n = reg(s.name), loop = rom.length;
        const beqAt = put(OP.BEQ, 0, n, 0, 0);
        emitStmts(s.body);
        put(OP.ADDI, n, n, 0, (-1) & 0xffff);
        const jalAt = put(OP.JAL, 0, 0, 0, 0);
        patch(beqAt, rom.length - beqAt);
        patch(jalAt, loop - jalAt);
      } else if (s.k === 'if') {
        evalTo(s.cond, 6);
        const beqAt = put(OP.BEQ, 0, 6, 0, 0);
        emitStmts(s.then);
        const jalAt = put(OP.JAL, 0, 0, 0, 0);
        patch(beqAt, rom.length - beqAt);
        emitStmts(s.else);
        patch(jalAt, rom.length - jalAt);
      }
    }
  }
  emitStmts(ast);
  return rom;
}

export function compile(src) {
  try {
    const ast = parse(src);
    const checked = typecheck(ast);
    if (!checked.ok) return { ok: false, errors: checked.errors, rom: null, ast };
    return { ok: true, errors: [], rom: emit(ast), ast };
  } catch (e) {
    return { ok: false, errors: [{ code: e.code || 'syntax', msg: e.message }], rom: null, ast: null };
  }
}

// One Forge run: language-model tokens, then the delimiter, then one engine token group per clock.
// The int32 VM is ground truth. The float32 engine is the shipped weight-constructed path.
// float64 gadgets are a cross-check. bf16 is not run.

import { canonical, sha256Hex } from '../prereg.js';
import { CELLS, CRITERIA, DEMO_SOURCE, programFor } from './cells.js';
import { PRECISION, runEngine, runEngineAsync } from './engine.js';
import { ISA_VERSION, NESTLANG_VERSION, STEP_LIMIT } from './isa.js';
import { hostExec, propose } from './mdcc.js';
import { compile } from './nestlang.js';
import { runVM, runVMAsync } from './vm.js';

export const DELIMITER = '⟦forge⟧';
export const HELP = 'Exact ≠ the right program. A clocked engine spends one step per instruction, so it is slow on purpose. NestLang here is a few named values, 256 ROM words and 256 RAM words. bf16 bit-exactness is not claimed.';

export function tracesEqual(vm, eng) {
  if (!vm || !eng) return false;
  if (vm.trace.length !== eng.trace.length) return false;
  if (vm.fail !== eng.fail) return false;
  if (vm.result !== eng.result) return false;
  if ((eng.faults || []).length) return false;
  for (let i = 0; i < vm.trace.length; i++) {
    const a = vm.trace[i], b = eng.trace[i];
    if (a.pc !== b.pc || a.op !== b.op || a.result !== b.result || a.halted !== b.halted || a.fail !== b.fail) return false;
    const am = a.mem, bm = b.mem;
    if (!am !== !bm) return false;
    if (am && (am.addr !== bm.addr || am.value !== bm.value)) return false;
  }
  return true;
}

export function firstDiff(vm, eng) {
  if (!vm || !eng) return { i: -1, why: 'missing' };
  if ((eng.faults || []).length) return { i: -1, why: 'precision fault', faults: eng.faults.slice(0, 4) };
  const n = Math.min(vm.trace.length, eng.trace.length);
  for (let i = 0; i < n; i++) {
    const a = vm.trace[i], b = eng.trace[i];
    if (a.pc !== b.pc || a.op !== b.op || a.result !== b.result || a.halted !== b.halted || a.fail !== b.fail) return { i, vm: a, engine: b };
  }
  if (vm.trace.length !== eng.trace.length || vm.result !== eng.result || vm.fail !== eng.fail) return { i: n, why: 'tail', vm: { result: vm.result, fail: vm.fail, n: vm.trace.length }, engine: { result: eng.result, fail: eng.fail, n: eng.trace.length } };
  return null;
}

function engineTokens(trace, fail) {
  const tokens = [];
  for (const step of trace) {
    tokens.push({ lane: 'engine', kind: 'INS', pc: step.pc, op: step.op, result: step.result, text: `INS pc=${step.pc} ${step.name}` });
    const v = step.result | 0;
    for (let b = 0; b < 4; b++) {
      const byte = (v >>> (8 * b)) & 255;
      tokens.push({ lane: 'engine', kind: 'VAL', byte, text: `VAL b${b}=${byte}` });
    }
    if (step.halted) tokens.push({ lane: 'engine', kind: 'HALT', pc: step.pc, result: step.result, text: `HALT ${step.result}` });
  }
  tokens.push({ lane: 'engine', kind: fail ? 'FAIL' : 'END', text: fail ? 'FAIL ' + fail : 'END' });
  return tokens;
}

export function openRun(source, { lmTokens = [], seed = 1 } = {}) {
  const compiled = compile(source);
  const lm = lmTokens.map((text) => ({ lane: 'lm', kind: 'LM', text: String(text) }));
  if (!compiled.ok) {
    return {
      ok: false, source, seed, errors: compiled.errors, compiled, vm: null, engine: null, engine64: null,
      eq32: false, eq64: false, diff32: { why: 'typecheck' }, tokens: [...lm, { lane: 'engine', kind: 'FAIL', text: 'FAIL ' + compiled.errors.map((e) => e.code + ': ' + e.msg).join('; ') }],
    };
  }
  const vm = runVM(compiled.rom);
  const engine = runEngine(compiled.rom, Float32Array);
  const engine64 = runEngine(compiled.rom, Float64Array);
  const eq32 = tracesEqual(vm, engine);
  const eq64 = tracesEqual(vm, engine64);
  return {
    ok: true, source, seed, errors: [], compiled, vm, engine, engine64, eq32, eq64,
    diff32: eq32 ? null : firstDiff(vm, engine),
    tokens: [...lm, ...engineTokens(engine.trace, engine.fail || (eq32 ? null : 'trace-mismatch'))],
    result: vm.result,
  };
}

export async function openRunAsync(source, { lmTokens = [], seed = 1 } = {}, shouldStop = () => false) {
  const compiled = compile(source);
  const lm = lmTokens.map((text) => ({ lane: 'lm', kind: 'LM', text: String(text) }));
  if (!compiled.ok) {
    return {
      ok: false, source, seed, errors: compiled.errors, compiled, vm: null, engine: null, engine64: null,
      eq32: false, eq64: false, diff32: { why: 'typecheck' }, tokens: [...lm, { lane: 'engine', kind: 'FAIL', text: 'FAIL ' + compiled.errors.map((e) => e.code + ': ' + e.msg).join('; ') }],
    };
  }
  const vm = await runVMAsync(compiled.rom, STEP_LIMIT, shouldStop);
  if (shouldStop()) throw new Error('cancelled');
  const engine = await runEngineAsync(compiled.rom, Float32Array, STEP_LIMIT, shouldStop);
  if (shouldStop()) throw new Error('cancelled');
  const engine64 = await runEngineAsync(compiled.rom, Float64Array, STEP_LIMIT, shouldStop);
  const eq32 = tracesEqual(vm, engine);
  const eq64 = tracesEqual(vm, engine64);
  return {
    ok: true, source, seed, errors: [], compiled, vm, engine, engine64, eq32, eq64,
    diff32: eq32 ? null : firstDiff(vm, engine),
    tokens: [...lm, ...engineTokens(engine.trace, engine.fail || (eq32 ? null : 'trace-mismatch'))],
    result: vm.result,
  };
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function weightRow(c, run) {
  const hit = run.ok && run.vm.fail == null && run.vm.result === c.expect && run.eq32 && run.eq64;
  return {
    hit, match: run.eq32 && run.eq64, tokens: run.tokens.filter((t) => t.lane === 'engine').length,
    row: { id: c.id, expect: c.expect, got: run.vm ? run.vm.result : null, eq32: run.eq32, eq64: run.eq64, faults: run.engine ? run.engine.faults.length : null, ok: hit },
  };
}
function mdccRowsOf(cells) {
  let correct = 0, tokens = 0;
  const rows = [];
  for (const c of cells) {
    const plan = propose(c.task);
    let got = null, ok = false;
    if (plan.op) {
      got = hostExec(plan);
      ok = got === BigInt(c.expect) && plan.op === c.op && plan.a === c.a && plan.b === c.b;
      tokens += plan.tokens + 1;
    }
    if (ok) correct += 1;
    rows.push({ id: c.id, ok, got: got === null ? null : got.toString() });
  }
  return { correct, tokens, rows };
}
function packLanes(cells, scored, msW, mdcc, msM) {
  const n = cells.length;
  const correct = scored.filter((s) => s.hit).length;
  const match = scored.filter((s) => s.match).length;
  const tokens = scored.reduce((a, s) => a + s.tokens, 0);
  return {
    criteria: CRITERIA,
    weightcpu: { correct, n, accuracy: correct / n, ms: msW, tokens, memoryWords: 256, engineMatch: match / n },
    mdcc: { correct: mdcc.correct, n, accuracy: mdcc.correct / n, ms: msM, tokens: mdcc.tokens, memoryWords: 0 },
    weightRows: scored.map((s) => s.row),
    mdccRows: mdcc.rows,
  };
}
export function runLanes(cells = CELLS) {
  const tW = now();
  const scored = cells.map((c) => weightRow(c, openRun(programFor(c), { lmTokens: [c.task, DELIMITER], seed: 1 })));
  const msW = now() - tW;
  const tM = now();
  const mdcc = mdccRowsOf(cells);
  return packLanes(cells, scored, msW, mdcc, now() - tM);
}
export async function runLanesAsync(cells = CELLS, shouldStop = () => false, onProgress = () => {}) {
  const tW = now();
  const scored = [];
  for (let i = 0; i < cells.length; i++) {
    if (shouldStop()) throw new Error('cancelled');
    onProgress(cells[i].id, (i + 1) / cells.length);
    scored.push(weightRow(cells[i], await openRunAsync(programFor(cells[i]), { lmTokens: [cells[i].task, DELIMITER], seed: 1 }, shouldStop)));
  }
  const msW = now() - tW;
  const tM = now();
  const mdcc = mdccRowsOf(cells);
  return packLanes(cells, scored, msW, mdcc, now() - tM);
}

export async function reproBundle(run, extra = {}) {
  const b = {
    kind: 'neuralese-forge-repro',
    version: 1,
    isa: ISA_VERSION,
    nestlang: NESTLANG_VERSION,
    seed: run.seed ?? 0,
    program: run.source,
    precision: PRECISION,
    criteria: CRITERIA,
    equality: { f32: !!run.eq32, f64: !!run.eq64, bf16: 'not-run' },
    result: run.vm ? run.vm.result : null,
    fail: run.vm ? run.vm.fail : (run.errors || []).map((e) => e.code + ': ' + e.msg),
    faults: run.engine ? run.engine.faults : [],
    trace: run.vm ? run.vm.trace.map((s) => ({ pc: s.pc, op: s.op, name: s.name, result: s.result, halted: s.halted, fail: s.fail, mem: s.mem })) : [],
    lanes: extra.lanes || null,
    demo: run.source === DEMO_SOURCE,
  };
  b.bundle_sha256 = await sha256Hex(canonical(b));
  return b;
}

export async function verifyForgeBundle(b) {
  const { bundle_sha256, ...rest } = b;
  const problems = [];
  if ((await sha256Hex(canonical(rest))) !== bundle_sha256) problems.push('bundle_sha256 does not match contents');
  if (rest.kind !== 'neuralese-forge-repro') problems.push('kind');
  if (rest.precision && rest.precision.bf16 !== 'not-run') problems.push('bf16 was claimed');
  return { ok: problems.length === 0, problems };
}

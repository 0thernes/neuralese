// Machine and Forge compute. The page sends a job and renders the plain result.
// Cancel is a message; long loops notice it between steps. Nothing here touches the DOM.
import { measure, runMachinePaced } from './machine/machine.js?v=170';
import { openRunAsync, reproBundle, runLanesAsync } from './forge/session.js?v=170';
import { lowerForge } from './walk/forgealu.js?v=170';
import { spectral } from './labcore.js?v=170';

const stop = new Set();
const machines = new Map();
const forges = new Map();
const stopped = (id) => stop.has(id);

function frameView(f) {
  if (!f) return null;
  return {
    cycle: f.cycle, pc: f.pc, regs: f.regs, console: f.console, halted: f.halted,
    fail: f.fail, result: f.result, ei: f.ei, irq: f.irq, busy: f.busy, eq: f.eq, fb: f.fb,
  };
}
function slimMachine(id, run) {
  machines.set(id, run);
  const n = run.frames?.length || 0;
  const ws = run.weightState;
  return {
    id, program: run.program, exact: run.exact, packetExact: run.packetExact, precisionOk: run.precisionOk, rate: run.rate,
    cycles: run.cycles, refCycles: run.refCycles, matched: run.matched, compared: run.compared,
    faults: run.faults, injected: run.injected, diverge: run.diverge, packets: run.packets,
    frameCount: n, shown: frameView(run.frames?.[n - 1]), shownIndex: Math.max(0, n - 1), frames: [],
    weightState: ws ? { ramB: Array.from(ws.ramB || []), ssdB: Array.from(ws.ssdB || []) } : null,
  };
}

function lightStep(s) {
  return { pc: s.pc, op: s.op, name: s.name, rd: s.rd, result: s.result, halted: s.halted, fail: s.fail, mem: s.mem || null, regs: s.regs };
}

function slimForge(id, run) {
  forges.set(id, run);
  const trace = run.vm ? run.vm.trace.map(lightStep) : null;
  const rom = run.compiled?.rom;
  return {
    id, ok: run.ok, source: run.source, seed: run.seed, errors: run.errors || [],
    eq32: !!run.eq32, eq64: !!run.eq64, result: run.result ?? null, diff32: run.diff32 || null,
    tokens: run.tokens || [],
    compiled: rom ? { rom: Array.from(rom) } : undefined,
    vm: run.vm ? {
      result: run.vm.result, fail: run.vm.fail, halted: run.vm.halted, pc: run.vm.pc,
      regs: run.vm.regs, ram: run.vm.ram, trace,
    } : null,
    engine: run.engine ? { faults: run.engine.faults || [], kind: run.engine.kind, result: run.engine.result } : null,
  };
}

function moeCloud(sample) {
  return fetch(new URL('./nested/moe/routing.json', import.meta.url)).then(async (r) => {
    if (!r.ok) throw new Error('moe/routing.json: HTTP ' + r.status);
    const data = await r.json();
    const s = data.samples[sample];
    if (!s) throw new Error('no sample');
    const n = s.layers.reduce((a, L) => a + L.e.length, 0);
    const pos = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const hue = [0x38bdf8, 0xf472b6, 0xfbbf24, 0x34d399];
    let k = 0;
    s.layers.forEach((L, li) => L.e.forEach((e, t) => {
      const g = L.g[t] ?? 0, p = L.pg[t] ?? 0, hex = hue[e % 4];
      pos[k] = (t - L.e.length / 2) * 0.35; pos[k + 1] = li * 3 + p * 1.5; pos[k + 2] = (g - 1.5) * 2.2;
      colors[k] = ((hex >> 16) & 255) / 255; colors[k + 1] = ((hex >> 8) & 255) / 255; colors[k + 2] = (hex & 255) / 255;
      k += 3;
    }));
    return {
      pos, colors,
      center: [0, s.layers.length * 1.5, 0], dist: 30,
      info: `MoE-in-MoE routing for “${s.text.slice(0, 60)}…”: ${s.layers.length} layers × ${s.layers[0]?.e.length ?? 0} tokens; depth = group, colour = expert, height = group gate probability.`,
    };
  });
}

self.onmessage = async (e) => {
  const m = e.data;
  if (!m || typeof m !== 'object') return;
  if (m.op === 'cancel') { stop.add(m.id); return; }
  const id = m.id;
  const progress = (label, frac) => { if (!stopped(id)) self.postMessage({ id, type: 'progress', label, frac }); };
  let transfer = [];
  try {
    let result;
    if (m.op === 'ping') result = { ok: true };
    else if (m.op === 'measure') {
      result = await measure(m.opts || {}, { cancelled: () => stopped(id), onProgress: progress });
    } else if (m.op === 'machine') {
      progress('stepping the weight machine and the int32 reference…', 0);
      const run = await runMachinePaced({
        program: m.program, pipeline: !!m.pipeline, fault: m.fault || null, limit: m.limit, trace: true,
        shouldStop: () => stopped(id),
        onProgress: (c, n) => { if ((c & 255) === 0) progress(`cycle ${c} / ${n}`, n ? c / n : 0); },
      });
      if (stopped(id)) throw new Error('cancelled');
      result = slimMachine(id, run);
    } else if (m.op === 'machineFrame') {
      const run = machines.get(m.runId);
      result = frameView(run?.frames?.[m.index]);
    } else if (m.op === 'forge') {
      progress('typecheck, then clock the engine…', 0);
      const run = await openRunAsync(m.source, { lmTokens: m.lmTokens || [], seed: m.seed ?? 1 }, () => stopped(id));
      if (stopped(id)) throw new Error('cancelled');
      progress('writing the REPRO bundle…', 1);
      const bundle = await reproBundle(run);
      result = { run: slimForge(id, run), bundle: JSON.stringify(bundle, null, 2) };
    } else if (m.op === 'forgeStep') {
      const run = forges.get(m.runId);
      const step = run?.vm?.trace?.[m.index];
      result = step ? { ...lightStep(step), ram: step.ram } : null;
    } else if (m.op === 'lower') {
      result = lowerForge(m.name, m.a | 0, m.b | 0, m.opts || {});
    } else if (m.op === 'lanes') {
      result = await runLanesAsync(undefined, () => stopped(id), (label, frac) => progress(label, frac));
    } else if (m.op === 'moe') {
      const cloud = await moeCloud(m.sample || 0);
      result = cloud;
      transfer = [cloud.pos.buffer, cloud.colors.buffer];
    } else if (m.op === 'spectral') {
      result = spectral(m.a, m.rows, m.cols);
    } else throw new Error('unknown job ' + m.op);
    if (stopped(id)) { self.postMessage({ id, type: 'done', result: { cancelled: true } }); return; }
    self.postMessage({ id, type: 'done', result }, transfer);
  } catch (err) {
    if (stopped(id) || String(err?.message || err) === 'cancelled') self.postMessage({ id, type: 'done', result: { cancelled: true } });
    else self.postMessage({ id, type: 'error', error: String(err?.message || err) });
  } finally {
    stop.delete(id);
  }
};

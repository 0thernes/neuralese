// Local experiment launcher. Remote is optional and never invents a result.
import { runMachine } from '../machine/machine.js';
import { openRun } from '../forge/session.js';
import { DEMO_SOURCE } from '../forge/cells.js';

export function launchLocal(spec) {
  const kind = spec.kind || 'machine';
  if (kind === 'machine' || kind === 'fault') {
    const program = spec.program || 'hello';
    const t0 = performance.now();
    const run = runMachine({ program, pipeline: !!spec.pipeline, trace: false, fault: spec.fault || null, limit: spec.limit });
    return {
      ok: true,
      project: spec.fault ? 'fault' : 'machine',
      name: program,
      seed: spec.seed ?? null,
      config: { program, pipeline: !!spec.pipeline, fault: spec.fault ? JSON.stringify(spec.fault) : null },
      metrics: {
        exact: run.exact ? 1 : 0,
        packetExact: run.packetExact ? 1 : 0,
        cycles: run.cycles,
        rate: run.rate,
        faults: run.faults.length,
        ms: Math.round((performance.now() - t0) * 1000) / 1000,
      },
    };
  }
  if (kind === 'forge') {
    const source = spec.source || DEMO_SOURCE;
    const run = openRun(source, { seed: spec.seed ?? 1, lmTokens: spec.lmTokens || ['agent'] });
    return {
      ok: !!run.ok,
      project: 'forge',
      name: 'nestlang',
      seed: run.seed,
      config: { sourceBytes: source.length },
      metrics: { ok: run.ok ? 1 : 0, eq32: run.eq32 ? 1 : 0, eq64: run.eq64 ? 1 : 0, result: run.result ?? null },
    };
  }
  if (kind === 'walk' || kind === 'adversary') {
    return { ok: false, error: kind + ' needs the loaded TinyStories weights in the browser lab. No metric was fabricated.' };
  }
  return { ok: false, error: 'unknown experiment kind ' + kind };
}

export async function submit(spec, env = process.env, fetchImpl = globalThis.fetch) {
  if ((spec.target || 'local') !== 'remote') return launchLocal(spec);
  const url = spec.url || env.NEURALESE_VPS_URL || '';
  if (!url) return { ok: false, error: 'remote job requested but NEURALESE_VPS_URL is empty. Nothing ran.' };
  const res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...spec, solo: true }) });
  if (!res.ok) return { ok: false, error: 'remote status ' + res.status };
  const body = await res.json();
  if (!body || body.ok !== true || !body.metrics) return { ok: false, error: 'remote reply had no metrics' };
  return { ok: true, project: body.project || spec.kind || 'remote', name: body.name || 'remote', seed: body.seed ?? null, config: spec, metrics: body.metrics, target: 'remote', remote: { url, status: 'ok' } };
}

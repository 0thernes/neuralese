// Tool handlers an agent calls. Reads do not invent runs. Mutations log the experiment
// and the caller logs a separate agent run (see callTool).
import { renderReport } from './schema.js';
import { submit } from './launch.js';
import { spectrum } from '../analytics.js';

async function launch(lab, args, env, fetchImpl) {
  const spec = { ...args, kind: args.kind || 'machine' };
  const out = await submit(spec, env, fetchImpl);
  if (!out.ok) return { ok: false, error: out.error };
  const run = lab.logRun({
    project: out.project, name: out.name, seed: out.seed ?? null, config: out.config, metrics: out.metrics,
    target: out.target || 'local', remote: out.remote ?? null, gitSha: args.gitSha ?? null,
  });
  const body = JSON.stringify({ config: run.config, metrics: run.metrics });
  const art = await lab.putArtifact(run.id, { name: 'metrics.json', text: body });
  return { ok: true, runId: run.id, metrics: run.metrics, artifactId: art.id };
}

async function sweep(lab, args) {
  const programs = args.programs?.length ? args.programs : ['hello'];
  const pipes = args.pipeline?.length ? args.pipeline : [false];
  const parent = lab.logRun({
    project: 'sweep', name: args.name || 'machine-sweep', seed: null,
    config: { programs, pipeline: pipes }, metrics: {}, gitSha: args.gitSha ?? null,
  });
  const trials = [];
  for (const program of programs) {
    for (const pipeline of pipes) {
      const one = await launch(lab, { kind: 'machine', program, pipeline, gitSha: args.gitSha ?? null }, process.env, globalThis.fetch);
      if (!one.ok) { trials.push(one); continue; }
      lab.patchRun(one.runId, { parentId: parent.id, sweepId: parent.id });
      trials.push(one);
    }
  }
  const exact = trials.filter((t) => t.ok && t.metrics.exact === 1).length;
  lab.patchRun(parent.id, { metrics: { trials: trials.length, exact } });
  return { ok: true, runId: parent.id, trials: trials.length, exact };
}

async function report(lab, args) {
  const ids = args.runIds?.length ? args.runIds : lab.listRuns({ includeAgent: false }).map((r) => r.id);
  const runs = ids.map((id) => lab.getRun(id)).filter(Boolean);
  const md = renderReport(args.title || 'Lab report', runs);
  const rec = lab.logRun({
    project: 'report', name: args.title || 'report', seed: null, config: { runIds: ids },
    metrics: { runs: runs.length, chars: md.length }, gitSha: args.gitSha ?? null,
  });
  const art = await lab.putArtifact(rec.id, { name: 'report.md', text: md });
  return { ok: true, runId: rec.id, artifactId: art.id, markdown: md };
}

export function makeHandlers(env = process.env, fetchImpl = globalThis.fetch) {
  return {
    list_runs: async (lab, args) => ({ ok: true, runs: lab.listRuns(args || {}) }),
    get_run: async (lab, args) => { const run = lab.getRun(args.id); return run ? { ok: true, run } : { ok: false, error: 'no run ' + args.id }; },
    lineage: async (lab, args) => ({ ok: true, runs: lab.lineage(args.id) }),
    launch_experiment: (lab, args) => launch(lab, args, env, fetchImpl),
    start_sweep: (lab, args) => sweep(lab, args),
    write_report: (lab, args) => report(lab, args),
    analyze_spectrum: async (_lab, args) => {
      if (!Array.isArray(args.values) || args.values.length !== args.rows * args.cols) return { ok: false, error: 'values length must equal rows*cols' };
      return { ok: true, spectrum: spectrum(Float64Array.from(args.values), args.rows, args.cols) };
    },
  };
}

const MUTATING = new Set(['launch_experiment', 'start_sweep', 'write_report', 'analyze_spectrum']);

export async function callTool(lab, name, args = {}, opts = {}) {
  const handlers = opts.handlers ?? makeHandlers(opts.env, opts.fetchImpl);
  const fn = handlers[name];
  if (!fn) return { ok: false, error: 'unknown tool ' + name };
  const t0 = performance.now();
  const out = await fn(lab, args);
  if (MUTATING.has(name)) {
    const agent = lab.logRun({
      project: 'agent', name, seed: null, parentId: out.runId ?? null, gitSha: args.gitSha ?? null,
      agent: { tool: name },
      config: { kind: args.kind ?? null, program: args.program ?? null },
      metrics: { ok: out.ok ? 1 : 0, ms: Math.round((performance.now() - t0) * 1000) / 1000 },
    });
    out.agentRunId = agent.id;
  }
  return out;
}

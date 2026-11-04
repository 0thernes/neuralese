// Solo, local-first lab store. No orgs, roles, approvals, or shared registries.
// A run is one experiment, sweep, report, or agent tool call. Artifacts are bytes plus a sha256.

const BANNED = ['org', 'orgId', 'acl', 'approval', 'permissions', 'members', 'role'];

export function newId(prefix) {
  const rnd = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2);
  return prefix + rnd.replace(/-/g, '').slice(0, 12);
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function solo(row) {
  for (const k of BANNED) if (k in row) throw new Error('this lab is single-user and does not store ' + k);
  return row;
}

export function createLab(persist) {
  let state = persist.load() ?? { runs: [], artifacts: [] };
  const save = () => persist.save(state);
  function logRun(input) {
    const run = solo({
      id: input.id ?? newId('r'),
      project: input.project,
      name: input.name,
      created: input.created ?? new Date().toISOString(),
      gitSha: input.gitSha ?? null,
      seed: input.seed ?? null,
      config: input.config ?? {},
      metrics: input.metrics ?? {},
      parentId: input.parentId ?? null,
      sweepId: input.sweepId ?? null,
      agent: input.agent ?? null,
      target: input.target ?? 'local',
      remote: input.remote ?? null,
      artifactIds: [],
    });
    state.runs.push(run);
    save();
    return run;
  }
  function patchRun(id, patch) {
    const run = state.runs.find((r) => r.id === id);
    if (!run) throw new Error('no run ' + id);
    if (patch.metrics) run.metrics = { ...run.metrics, ...patch.metrics };
    if (patch.remote) run.remote = patch.remote;
    if ('parentId' in patch) run.parentId = patch.parentId;
    if ('sweepId' in patch) run.sweepId = patch.sweepId;
    save();
    return run;
  }
  function listRuns(filter = {}) {
    return state.runs.filter((r) => {
      if (!filter.includeAgent && r.project === 'agent') return false;
      if (filter.project && r.project !== filter.project) return false;
      if (filter.sweepId && r.sweepId !== filter.sweepId) return false;
      if (filter.name && !r.name.includes(filter.name)) return false;
      return true;
    });
  }
  function getRun(id) { return state.runs.find((r) => r.id === id) ?? null; }
  function lineage(id) {
    const out = [];
    let cur = getRun(id);
    const seen = new Set();
    while (cur && !seen.has(cur.id)) { seen.add(cur.id); out.push(cur); cur = cur.parentId ? getRun(cur.parentId) : null; }
    return out;
  }
  async function putArtifact(runId, { name, text, parent = null }) {
    const run = getRun(runId);
    if (!run) throw new Error('no run ' + runId);
    const art = solo({ id: newId('a'), runId, name, sha256: await sha256Hex(text), bytes: text.length, parent, text });
    state.artifacts.push(art);
    run.artifactIds.push(art.id);
    save();
    return { id: art.id, runId, name, sha256: art.sha256, bytes: art.bytes, parent };
  }
  function getArtifact(id) {
    const art = state.artifacts.find((a) => a.id === id);
    if (!art) return null;
    const { text: _t, ...meta } = art;
    return { ...meta, text: art.text };
  }
  function dump() { return JSON.parse(JSON.stringify(state)); }
  function importState(dumpIn) {
    const rows = Array.isArray(dumpIn) ? dumpIn.map(fromTracker) : (dumpIn?.runs || (dumpIn?.tracker || []).map(fromTracker));
    for (const r of rows) {
      if (!r || !r.id || state.runs.some((x) => x.id === r.id)) continue;
      state.runs.push(solo({ artifactIds: [], gitSha: null, seed: null, config: {}, metrics: {}, parentId: null, sweepId: null, agent: null, target: 'local', remote: null, ...r }));
    }
    for (const a of dumpIn?.artifacts || []) { if (a && a.id && !state.artifacts.some((x) => x.id === a.id)) state.artifacts.push(a); }
    save();
    return state.runs.length;
  }
  return { logRun, patchRun, listRuns, getRun, lineage, putArtifact, getArtifact, dump, importState };
}

export function fromTracker(r) {
  if (r && r.project && r.created) return r;
  return { id: r.id, project: r.kind || 'page', name: r.label || r.kind || 'run', created: r.t || new Date().toISOString(), config: r, metrics: r.metrics || {} };
}

export function createMemoryLab() {
  const box = { runs: [], artifacts: [] };
  return createLab({ load: () => box, save: () => {} });
}

export function renderReport(title, runs) {
  const lines = [`# ${title}`, '', `Runs in this report: ${runs.length}. Single user. No approval step.`, ''];
  for (const r of runs) {
    lines.push(`## ${r.project} / ${r.name}`);
    lines.push(`- id: \`${r.id}\``);
    lines.push(`- created: ${r.created}`);
    lines.push(`- git: ${r.gitSha ?? 'not recorded'}`);
    lines.push(`- seed: ${r.seed ?? 'none'}`);
    lines.push(`- target: ${r.target}`);
    const keys = Object.keys(r.metrics);
    if (!keys.length) lines.push('- metrics: none');
    for (const k of keys) lines.push(`- ${k}: ${r.metrics[k]}`);
    if (r.parentId) lines.push(`- parent: \`${r.parentId}\``);
    lines.push('');
  }
  return lines.join('\n');
}

export const TOOLS = [
  { name: 'list_runs', description: 'List experiment runs. Agent bookkeeping runs are omitted unless includeAgent is true.', inputSchema: { type: 'object', properties: { project: { type: 'string' }, includeAgent: { type: 'boolean' }, name: { type: 'string' } } } },
  { name: 'get_run', description: 'Fetch one run, its metrics, and its artifact ids.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'lineage', description: 'Walk parent links from a run back to the root.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'launch_experiment', description: 'Run a local machine program or a Forge NestLang source. Walk and Adversary need loaded weights and refuse instead of inventing a result. Set target to remote only with a VPS URL.', inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['machine', 'forge', 'walk', 'adversary'] }, program: { type: 'string' }, pipeline: { type: 'boolean' }, source: { type: 'string' }, seed: { type: 'number' }, target: { type: 'string', enum: ['local', 'remote'] }, url: { type: 'string' } }, required: ['kind'] } },
  { name: 'start_sweep', description: 'Cartesian sweep of machine programs by pipeline flag. Each cell is a real runMachine call.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, programs: { type: 'array', items: { type: 'string' } }, pipeline: { type: 'array', items: { type: 'boolean' } } }, required: ['programs'] } },
  { name: 'write_report', description: 'Write a markdown report from existing runs and store it as an artifact.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, runIds: { type: 'array', items: { type: 'string' } } }, required: ['title'] } },
  { name: 'analyze_spectrum', description: 'Jacobi SVD spectrum of a row-major matrix supplied by the caller. Returns entropy, effective rank, condition number, and a log-log slope.', inputSchema: { type: 'object', properties: { rows: { type: 'number' }, cols: { type: 'number' }, values: { type: 'array', items: { type: 'number' } } }, required: ['rows', 'cols', 'values'] } },
];

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryLab } from '../src/agent/schema.js';
import { callTool } from '../src/agent/tools.js';
import { handleMessage } from '../src/agent/mcp.js';
import { TOOLS } from '../src/agent/schema.js';

const BANNED = ['org', 'orgId', 'acl', 'approval', 'permissions', 'members'];

test('agent launch runs the real hello program and logs the tool call', async () => {
  const lab = createMemoryLab();
  const out = await callTool(lab, 'launch_experiment', { kind: 'machine', program: 'hello' });
  assert.equal(out.ok, true);
  assert.equal(out.metrics.exact, 1);
  assert.ok(out.metrics.cycles > 0);
  const run = lab.getRun(out.runId);
  for (const k of BANNED) assert.equal(k in run, false);
  const agent = lab.listRuns({ includeAgent: true }).filter((r) => r.project === 'agent');
  assert.equal(agent.length, 1);
  assert.equal(agent[0].name, 'launch_experiment');
  assert.equal(agent[0].parentId, out.runId);
  assert.equal(lab.listRuns().some((r) => r.project === 'agent'), false);
});

test('sweep is two real pipeline settings, and a report quotes their metrics', async () => {
  const lab = createMemoryLab();
  const sw = await callTool(lab, 'start_sweep', { name: 'pipe', programs: ['hello'], pipeline: [false, true] });
  assert.equal(sw.ok, true);
  assert.equal(sw.trials, 2);
  assert.equal(sw.exact, 2);
  const kids = lab.listRuns({ sweepId: sw.runId });
  assert.equal(kids.length, 2);
  const rep = await callTool(lab, 'write_report', { title: 'pipe report', runIds: [sw.runId, ...kids.map((k) => k.id)] });
  assert.match(rep.markdown, /exact: 1/);
  assert.match(rep.markdown, /pipe report/);
  const art = lab.getArtifact(rep.artifactId);
  assert.equal(art.bytes, rep.markdown.length);
  assert.equal(art.sha256.length, 64);
});

test('forge demo is exact on both float widths', async () => {
  const lab = createMemoryLab();
  const out = await callTool(lab, 'launch_experiment', { kind: 'forge' });
  assert.equal(out.ok, true);
  assert.equal(out.metrics.eq32, 1);
  assert.equal(out.metrics.eq64, 1);
});

test('walk and remote jobs refuse instead of inventing numbers', async () => {
  const lab = createMemoryLab();
  const walk = await callTool(lab, 'launch_experiment', { kind: 'walk' });
  assert.equal(walk.ok, false);
  assert.match(walk.error, /TinyStories/);
  const remote = await callTool(lab, 'launch_experiment', { kind: 'machine', program: 'hello', target: 'remote' }, { env: {} });
  assert.equal(remote.ok, false);
  assert.match(remote.error, /NEURALESE_VPS_URL/);
  assert.equal(lab.listRuns({ project: 'machine' }).length, 0);
});

test('MCP lists the solo tools and can call a spectrum', async () => {
  const lab = createMemoryLab();
  const listed = await handleMessage(lab, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const names = listed.result.tools.map((t) => t.name);
  assert.deepEqual(names, TOOLS.map((t) => t.name));
  assert.ok(!names.some((n) => /org|approve|permission/i.test(n)));
  const spec = await handleMessage(lab, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'analyze_spectrum', arguments: { rows: 2, cols: 2, values: [4, 0, 0, 2] } } });
  const body = spec.result.structured.spectrum;
  assert.ok(Math.abs(body.singularValues[0] - 4) < 1e-6);
  assert.ok(Math.abs(body.singularValues[1] - 2) < 1e-6);
  assert.ok(Math.abs(body.conditionNumber - 2) < 1e-6);
});

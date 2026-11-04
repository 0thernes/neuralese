// Solo agent CLI. Usage:
//   node tools/agent.mjs --lab DIR list
//   node tools/agent.mjs --lab DIR launch --kind machine --program hello
//   node tools/agent.mjs --lab DIR sweep --programs hello,irq
//   node tools/agent.mjs --lab DIR report --title "notes"
//   node tools/agent.mjs --lab DIR call launch_experiment '{"kind":"machine","program":"hello"}'
//   node tools/agent.mjs --lab DIR mcp     # JSON-RPC on stdin, one message per line
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createLab } from '../src/agent/schema.js';
import { callTool } from '../src/agent/tools.js';
import { handleMessage } from '../src/agent/mcp.js';
import { TOOLS } from '../src/agent/schema.js';

function fileLab(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'lab.json');
  return createLab({
    load() { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { runs: [], artifacts: [] }; } },
    save(state) { fs.writeFileSync(file, JSON.stringify(state)); },
  });
}
function arg(name, fallback = '') {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const dir = arg('--lab', path.join(process.cwd(), '.neuralese'));
const lab = fileLab(dir);
const cmd = process.argv.find((a) => ['list', 'launch', 'sweep', 'report', 'call', 'mcp', 'tools'].includes(a));
if (!cmd || cmd === 'tools') {
  console.log(JSON.stringify(TOOLS, null, 2));
  if (!cmd) console.error('commands: list | launch | sweep | report | call | mcp | tools');
  process.exit(cmd ? 0 : 1);
}
if (cmd === 'list') {
  console.log(JSON.stringify(lab.listRuns({ includeAgent: process.argv.includes('--agent'), project: arg('--project') || undefined }), null, 2));
} else if (cmd === 'launch') {
  const out = await callTool(lab, 'launch_experiment', { kind: arg('--kind', 'machine'), program: arg('--program', 'hello'), pipeline: process.argv.includes('--pipeline'), source: arg('--source') || undefined, target: arg('--target', 'local'), url: arg('--url') || undefined });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
} else if (cmd === 'sweep') {
  const programs = arg('--programs', 'hello').split(',').filter(Boolean);
  const out = await callTool(lab, 'start_sweep', { name: arg('--name', 'sweep'), programs, pipeline: [false, true] });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
} else if (cmd === 'report') {
  const out = await callTool(lab, 'write_report', { title: arg('--title', 'Lab report') });
  console.log(out.markdown ?? JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
} else if (cmd === 'call') {
  const name = process.argv[process.argv.indexOf('call') + 1];
  const raw = process.argv[process.argv.indexOf('call') + 2] || '{}';
  const out = await callTool(lab, name, JSON.parse(raw));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
} else if (cmd === 'mcp') {
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const res = await handleMessage(lab, JSON.parse(line));
    process.stdout.write(JSON.stringify(res) + '\n');
  }
}

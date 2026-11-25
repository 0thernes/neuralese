// Line-delimited JSON-RPC for the tools an agent needs. Not a multi-user server.
import { TOOLS } from './schema.js';
import { callTool } from './tools.js';

export function handleMessage(lab, msg, opts = {}) {
  const id = msg.id ?? null;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
  if (msg.method === 'initialize') {
    return reply({ protocolVersion: '2024-11-05', serverInfo: { name: 'neuralese-lab', version: 'solo' }, capabilities: { tools: {} }, instructions: 'Single user. No orgs or approvals. Local experiments are real; remote jobs need NEURALESE_VPS_URL.' });
  }
  if (msg.method === 'tools/list') return reply({ tools: TOOLS });
  if (msg.method === 'tools/call') {
    const name = msg.params?.name;
    const args = msg.params?.arguments ?? {};
    return callTool(lab, name, args, opts).then((out) => reply({ content: [{ type: 'text', text: JSON.stringify(out) }], isError: out.ok === false, structured: out }));
  }
  return fail(-32601, 'method not found');
}

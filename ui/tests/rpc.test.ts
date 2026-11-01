import { describe, expect, test } from 'bun:test';
import { createRpcClient, serveRpc, RpcError, type Endpoint } from '../src/core/rpc';
import type { EngineApi } from '../src/core/engine-api';
type Api = { add: [{ a: number; b: number }, number]; boom: [{}, never]; slow: [{}, number] };
const pair = (): [Endpoint, Endpoint] => { const c = new MessageChannel(); c.port1.start(); c.port2.start(); return [c.port1 as unknown as Endpoint, c.port2 as unknown as Endpoint]; };
describe('rpc', () => {
  test('round trip and concurrent calls resolve to their own ids', async () => {
    const [a, b] = pair(); serveRpc<Api>(b, { add: ({ a, b }) => a + b, boom: () => { throw new Error('bad'); }, slow: () => new Promise((r) => setTimeout(() => r(7), 30)) });
    const c = createRpcClient<Api>(a);
    const [x, y, z] = await Promise.all([c.call('slow', {}), c.call('add', { a: 2, b: 3 }), c.call('add', { a: -1, b: 1 })]);
    expect([x, y, z]).toEqual([7, 5, 0]); expect(c.pending()).toBe(0);
  });
  test('worker errors become RpcError with the op name', async () => {
    const [a, b] = pair(); serveRpc<Api>(b, { add: () => 0, boom: () => { throw new Error('bad'); }, slow: () => 0 });
    const c = createRpcClient<Api>(a);
    const e = await c.call('boom', {}).catch((x: unknown) => x); expect(e).toBeInstanceOf(RpcError); expect((e as Error).message).toBe('boom: bad');
  });
  test('unknown op and timeout', async () => {
    const [a, b] = pair(); serveRpc<Api>(b, { add: () => 0, boom: () => 0 as never, slow: () => new Promise((r) => setTimeout(() => r(1), 200)) });
    const c = createRpcClient<Api>(a, { timeoutMs: 50 });
    expect(((await (c as unknown as { call(o: string, a: object): Promise<unknown> }).call('nope', {}).catch((x: Error) => x)) as Error).message).toContain('unknown op nope');
    expect(((await c.call('slow', {}).catch((x: Error) => x)) as Error).message).toContain('timed out'); expect(c.pending()).toBe(0);
  });
  test('dispose rejects pending calls', async () => {
    const [a] = pair(); const c = createRpcClient<Api>(a); const p = c.call('add', { a: 1, b: 1 }); c.dispose();
    expect(((await p.catch((x: Error) => x)) as Error).message).toContain('disposed');
  });
  test('speaks the legacy engine-worker wire format ({id, op, ...args} → {id, out})', async () => {
    const [a, b] = pair(); const seen: unknown[] = [];
    b.addEventListener('message', (e) => { seen.push(e.data); const m = e.data as { id: number }; b.postMessage({ id: m.id, out: { sid: 4 } }); });
    const c = createRpcClient<EngineApi>(a); const r = await c.call('seq', { key: 'main', nPrompt: 3 });
    expect(r.sid).toBe(4); expect(seen[0]).toEqual({ id: 1, op: 'seq', key: 'main', nPrompt: 3 });
  });
});

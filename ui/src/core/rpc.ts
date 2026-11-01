// Typed request/response RPC over any postMessage endpoint (Worker, MessagePort, DedicatedWorkerGlobalScope).
// Wire format matches the existing engine/encoder workers: request {id, op, ...args} → reply {id, out} | {id, err}.
// The API map is purely a type: Api[op] = [args, result]. Nothing about the verified engine math changes.
export interface Endpoint {
  postMessage(msg: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', fn: (e: MessageEvent) => void): void;
  removeEventListener(type: 'message', fn: (e: MessageEvent) => void): void;
}
export type ApiMap = Record<string, [args: object, result: unknown]>;
export interface RpcOptions { timeoutMs?: number }
export class RpcError extends Error { constructor(public op: string, message: string) { super(`${op}: ${message}`); this.name = 'RpcError'; } }
export interface RpcClient<A extends ApiMap> {
  call<K extends keyof A & string>(op: K, args: A[K][0], transfer?: Transferable[]): Promise<A[K][1]>;
  pending(): number;
  dispose(): void;
}
export function createRpcClient<A extends ApiMap>(ep: Endpoint, opts: RpcOptions = {}): RpcClient<A> {
  let next = 0;
  const pend = new Map<number, { op: string; res: (v: unknown) => void; rej: (e: Error) => void; t?: ReturnType<typeof setTimeout> }>();
  const onMsg = (e: MessageEvent): void => {
    const m = e.data as { id?: number; out?: unknown; err?: string } | null;
    if (!m || typeof m.id !== 'number') return;
    const p = pend.get(m.id); if (!p) return;
    pend.delete(m.id); if (p.t) clearTimeout(p.t);
    if (m.err != null) p.rej(new RpcError(p.op, m.err)); else p.res(m.out);
  };
  ep.addEventListener('message', onMsg);
  return {
    call(op, args, transfer = []) {
      const id = ++next;
      return new Promise((res, rej) => {
        const entry: { op: string; res: (v: unknown) => void; rej: (e: Error) => void; t?: ReturnType<typeof setTimeout> } = { op, res: res as (v: unknown) => void, rej };
        if (opts.timeoutMs) entry.t = setTimeout(() => { pend.delete(id); rej(new RpcError(op, `timed out after ${opts.timeoutMs} ms`)); }, opts.timeoutMs);
        pend.set(id, entry);
        ep.postMessage({ id, op, ...args }, transfer);
      });
    },
    pending: () => pend.size,
    dispose() { ep.removeEventListener('message', onMsg); for (const p of pend.values()) { if (p.t) clearTimeout(p.t); p.rej(new RpcError(p.op, 'client disposed')); } pend.clear(); },
  };
}
// Server side (used by tests and by any new TS worker): dispatch {id, op} to typed handlers.
export type Handlers<A extends ApiMap> = { [K in keyof A]: (args: A[K][0]) => A[K][1] | Promise<A[K][1]> };
export function serveRpc<A extends ApiMap>(ep: Endpoint, h: Handlers<A>): () => void {
  const onMsg = async (e: MessageEvent): Promise<void> => {
    const { id, op, ...args } = e.data as { id: number; op: string } & Record<string, unknown>;
    const fn = (h as Record<string, ((a: unknown) => unknown) | undefined>)[op];
    try { if (!fn) throw new Error(`unknown op ${op}`); ep.postMessage({ id, out: await fn(args) }); }
    catch (err) { ep.postMessage({ id, err: err instanceof Error ? err.message : String(err) }); }
  };
  const l = (e: MessageEvent): void => { void onMsg(e); };
  ep.addEventListener('message', l);
  return () => ep.removeEventListener('message', l);
}

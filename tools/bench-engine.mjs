// Engine throughput benchmark (Node, CPU, single thread). Usage: node tools/bench-engine.mjs [engineDir] [nGen]
// Reports: (a) greedy generation with the in-sequence KV cache, (b) the same with NO cache (full recompute of the
// whole context for every new token), (c) repeated run() on a shared prompt prefix with and without the prefix cache.
import fs from 'node:fs'; import path from 'node:path';
const dir = path.resolve(process.argv[2] || '.'), N = +(process.argv[3] || 48);
const { buildWeights, parseSafetensors } = await import(dir + '/model.js'); const { Engine, defaultRuntime } = await import(dir + '/engine.js');
const buf = fs.readFileSync('model/model.safetensors'), n = Number(buf.readBigUInt64LE(0)), hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
const W = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr));
const P = [7454, 2402, 257, 640, 11, 612, 373, 257, 1310, 2576, 3706, 20037, 13];
const argmax = (l) => { let b = 0; for (let i = 1; i < l.length; i++) if (l[i] > l[b]) b = i; return b; }, now = () => performance.now();
const e = new Engine(W, defaultRuntime());
for (let w = 0; w < 2; w++) e.run(P); // warm-up
let t0 = now(), s = e.newSeq(P.length), r; for (const t of P) r = e.step(s, t); const pre = now() - t0; t0 = now(); const out = [];
for (let i = 0; i < N; i++) { const id = argmax(e.logits(r.h)); out.push(id); r = e.step(s, id); } const kv = now() - t0;
const Nn = Math.min(N, 24); t0 = now(); let ctx = P.slice(); for (let i = 0; i < Nn; i++) { const id = argmax(e.logits(e.run(ctx).last.h)); ctx.push(id); } const nc = now() - t0;
const res = { engineDir: dir, promptTok: P.length, prefillMs: +pre.toFixed(1), kvTokS: +(N / (kv / 1000)).toFixed(1), noCacheTokS: +(Nn / (nc / 1000)).toFixed(1), noCacheTokens: Nn };
const reps = 6, long = [...P, ...out.slice(0, 32)];
t0 = now(); for (let i = 0; i < reps; i++) e.run([...long, 100 + i]); res.repeatedRunNoPrefixMs = +((now() - t0) / reps).toFixed(1);
if ('invalidate' in e) { e.prefixCache = true; e.run(long); t0 = now(); for (let i = 0; i < reps; i++) e.run([...long, 100 + i]); res.repeatedRunPrefixCacheMs = +((now() - t0) / reps).toFixed(1); }
console.log(JSON.stringify(res));

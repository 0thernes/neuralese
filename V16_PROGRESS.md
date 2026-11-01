# v15.3 / v16 progress log (resumable)
Baseline: v15.2.0 @ bdf67a7. 162/162 node tests pass (98 s). eslint: 1 error (nested/riscv/cpu.js:64 `module`), 73 warnings; lint script pointed at nonexistent `site/`.

Finding: engine.js ALREADY has an incremental per-sequence KV cache (Seq.K/V; step() processes one token). The audit's "probably no KV cache" is wrong.
Upgrade (2) therefore = (a) an independent full-recompute reference forward + equality test, (b) a cross-call prefix KV cache for run()
with invalidation on runtime/weights/hook changes, (c) honest benchmarks.

## Phase A (v15.3.0)
- [x] 1 lint + CI (code done, uncommitted)
- [x] 2 KV (code done, uncommitted)
- [x] 3 worker (code done, uncommitted)
- [x] 8 CSP / swiftshader (code done, uncommitted)
- [x] honesty wording (code done, uncommitted)
- [x] 7 restructure (code done, uncommitted)
- [ ] release v15.3.0
## Phase B (v16.0.0)
- [ ] 4 Arch  - [ ] 5 WebGPU  - [ ] 6 hygiene  - [ ] 9 prereg  - [ ] 10 hub interp  - [ ] release

## Status 2026-11-01 15:35
- Uncommitted working tree contains all Phase A code. Lint 0 err. KV test + bench done (old 42.2 tok/s KV gen, new 43.9; prefix-cache repeat run 258.9ms->9.1ms).
- (resolved) was: in headless Chrome the initial generate() never sets NEURALESE_LAST (worker path suspected). Smoke test/smoke/engine-worker.smoke.mjs timed out.
- Fixed: worker JSON-cloned R (typed arrays -> plain objects); worker creation race (memoized promise); batched prefill op 'steps' + concurrent per-token steps. Smoke OK: worker==main tokens, 0 CSP violations/73 tabs, notebook OK. Headless softGL: worker 2.5 tok/s vs main 4.4; long tasks 3 vs 15.
- npm test 167/167, lint 0 errors/75 warnings. CI test job: npm ci, lint, test, smoke.

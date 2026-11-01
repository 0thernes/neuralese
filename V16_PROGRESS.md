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

## v15.3.0 RELEASED (commit c0f9c96, tag v15.3.0) — https://github.com/0thernes/neuralese/releases/tag/v15.3.0
All 8 assets incl. SHA256SUMS; CI test job (lint + 167 tests + headless smoke) green. pages.yml dispatched 16:2x.

## Phase B progress (uncommitted)
- [x] 4 Arch: src/arch/arch.js + test/arch.test.mjs; vs HF float64: gpt_neo 3.9e-6, gpt2 3.8e-13, llama(SmolLM-135M) 7.9e-6, qwen2(Qwen2.5-0.5B) 4.3e-5. Lab engine itself still GPT-Neo-8M-specialised (partial).
- [x] 5 WebGPU: src/gpu/webgpu-engine.js + test/smoke/webgpu.smoke.mjs; gate max|dlogit| 3.1e-5; corrupted weights rejected; swiftshader 1.46 tok/s vs JS 34 tok/s.
- [x] 9 prereg: src/prereg.js, docs/prereg.schema.json, tools/prereg-run.mjs, REPRO-tab UI, test/prereg-enforced.test.mjs (4); build.json commit stamp in build-www.
- [ ] 10 hub interp: own JS encoders (ViT, CLIP-vision, Whisper-enc) from HF safetensors in progress (ONNX exports lack hidden states/attentions)
- [ ] 6 hygiene  - [ ] UI new-features  - [ ] release

## Item 10 progress (2026-11-01)
- test/ref/ref_encoder.py -> ref_encoder.json; test/encoder.test.mjs 4/4 pass (70 s):
  vit |Δlogit| 2.6e-7 hidden 2.4e-6 attn 1.2e-7; clip |Δemb| 9.6e-9 hidden 1.1e-7; whisper hidden 1.2e-14 attn 6.9e-9. Lens, rollout, probe exercised.
- NEXT: UI tab for HUB interp, item 6, WebGPU opt-in UI, what's-new, release.
- DONE (uncommitted): whisperLogMel (6.4e-6 vs HF), remote.js range loader, encoder-worker.js, lab-v16.js (H-INTERP + NEW v16 tabs, WebGPU gate+bench button), fetch-arch-models.mjs (rev+sha pinned), exact dep pins, Android conditional release signing (no secrets API access: token 404 on actions/secrets -> debug APK), VERSION_CODE, bump 16.0.0, ?v=160, release-hygiene test. Full suite 184 tests.
- NEXT: browser smoke of new tabs, docs, commit/tag.
- v16 smoke OK (www build, port 18766): NEW tab, WebGPU gate 2.7e-5 (swiftshader 0.96 vs JS 30.2 tok/s), prereg refuse+bundle, Whisper H-INTERP in browser 37.8 s, probe 0.99 vs maj 0.93. Full suite 184/184, lint 0 errors.
- Docs written. NEXT: amend single commit, push, tag v16.0.0, CI, pages.

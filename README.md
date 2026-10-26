# NEURALESE v11: interpretability and weight-surgery lab (TinyStories-8M, 100% in-browser) — ⚛ Powered by Tsotchke

Live: https://0thernes.github.io/neuralese/ · Audit: [AUDIT.md](AUDIT.md) · Tsotchke analysis: [docs/TSOTCHKE.md](docs/TSOTCHKE.md) · Claims & evidence: [docs/CLAIMS.md](docs/CLAIMS.md) · Stack and versions: [docs/STACK.md](docs/STACK.md)

## What's new in v11 — FRONTIER, pre-registered

A FRONTIER tab group runs 14 hypotheses about consciousness-science proxies (Butlin/Long indicator scorecard, PCI-style complexity, ignition), introspection (injected-concept detection, privileged self-prediction vs TinyStories-3M/1M), a gated self-improvement loop, self-distillation, test-time training, grokking with a Fourier check, and an exhaustive exact causal atlas (P6: still running at release, H6a/H6b results pending; 12 decided hypotheses: 5 supported, 7 not). Thresholds were frozen in [docs/PREREG-v11.md](docs/PREREG-v11.md) and committed before any run; several hypotheses failed and are reported as failures. Nothing here claims the model is conscious, sentient or superintelligent. Write-up: [docs/FRONTIER.md](docs/FRONTIER.md).

## What's new in v10 — cross-checks against Tsotchke's own code
- Moonlab's native QGT (compiled to WASM) agrees with our Fubini–Study metric to ≈ 2e-8 (`qgtcheck` in the terminal).
- Eshkol's compiled Taylor kernels agree with `taylor.js` to 9.7e-16; Eshkol's AD tape reproduces our full backward pass (1.2e-7).
- Eshkol's soft-unify (`neurosymbolic.esk`) is ported and matches a real `eshkol-run` trace to 2.2e-16 (`unify a b` in the terminal).
- **Negative result:** natural gradient beats Adam on training loss but loses on held-out loss (95% CIs, 8 seeds).
- Known result: the QRNG byte difference between glibc and WASM comes from libm, not SIMD.
- 18 live claims. Details in docs/TSOTCHKE.md and docs/CLAIMS.md.

## What's new in v9 — Eshkol types and QGTL run in the browser
- **TYPES tab / `typecheck`:** Eshkol's own type layer (`lib/types/dependent.cpp`, `hott_types.cpp`), compiled to WebAssembly, checks 73 judgments about the live model graph. The same checker rejects deliberately broken graphs.
- **QGTL compiled to WebAssembly:** QGTL's `qgt_geometric_measure_fidelity` now measures every Q-GEOMETRY position next to Moonlab; they agree to about 1e-7. QGTL's metric routine and its tensor-network QGT were tested too. Their limits are documented in [docs/TSOTCHKE.md](docs/TSOTCHKE.md).
- **Correction:** v8 said Tsotchke's repos had no HoTT work. That was wrong, and TSOTCHKE.md now cites the type system with links.

## v8 — the TSOTCHKE group (press 8)
v8 adds components built on the MIT-licensed open-source work of [Tsotchke](https://github.com/tsotchke). Only these components carry the **⚛ Powered by Tsotchke** badge. Each claim comes with a check that could refute it.

| tab | Tsotchke project (commit) | what it does here | evidence |
|---|---|---|---|
| **QRNG** | [quantum_rng](https://github.com/tsotchke/quantum_rng) 1.1.0 (`1a77e77`), compiled by us to WASM | research seeds with provenance, SP 800-90B health tests + SP 800-22 subset, simulated CHSH; `qseed apply` puts the seed into the manifest | deterministic and identical in Node and Chrome; health tests catch a stuck source; NIST worked examples reproduced |
| **Q-GEOMETRY** | [Moonlab](https://github.com/tsotchke/moonlab) 1.2.1 (WASM) + [QGTL](https://github.com/tsotchke/quantum_geometric_tensor) metric (`770994a`) | Fubini–Study angle between clean and edited next-token distributions (ψ = √p, 16 qubits), and the QGT = Fisher/4 check | Moonlab fidelity = direct sum to 1e-16; s(ε)/ε → √Fisher/2; Fisher = jet g″ = PyTorch |
| **TAYLOR** | [Eshkol](https://github.com/tsotchke/eshkol) 1.3.6 (`341ac81`), port of `taylor_recurrences.def` | exact Taylor jets of the loss along a weight direction, compared live with the true loss | closed forms to 5e-15; PyTorch float64 to ~1e-6 |
| **TYPES** | [Eshkol](https://github.com/tsotchke/eshkol) type layer (`dependent.cpp`, `hott_types.cpp`) compiled to WASM | 73 dimension / path / bounds / universe-subtyping judgments over the live model graph, decided by Eshkol | 73/73 hold; truncated, miswired and out-of-vocab graphs are rejected |
| **CLAIMS** | all of the above | the Claims & Evidence page: every claim, what would refute it, and the result computed now | `test/tsotchke.test.mjs` (15 tests incl. mutation tests) |

Honest limits:
- quantum_rng is a *classical simulation*. Its randomness comes only from the `crypto.getRandomValues` seed, and its CHSH value shows the simulator is correct, not that the bits are quantum.
- Eshkol's HoTT-style type layer is used as a dimension and subtype checker. It is gradual and has no univalence, so we claim no HoTT proofs. No tensor-logic artifact by Tsotchke was found; none is claimed.
- Eshkol's compiler is not run in the browser. Its type layer is, and so is QGTL's geometric-measure core (fidelity). QGTL's tensor-network QGT returned an all-zero state in our WASM build and is not used.
- Moonlab's ESM chunk carries a documented 4-line browser patch; its WASM is unmodified.

See [docs/TSOTCHKE.md](docs/TSOTCHKE.md) for the per-repo findings and what was not usable.

## What's new in v7 (new RESEARCH group: press 7)
- **REPRO**: SHA-256 of the original and current weights (also in the top bar), a downloadable experiment manifest (version, model id + hash, edits, runtime, prompt, decoding, seed, environment), and replay that re-applies the edits from clean weights and checks the hash bit for bit.
- **STATS**: per-head zero-ablation significance on per-document CE (paired sign-flip permutation test, Cohen's d_z, bootstrap CI, Holm + Benjamini–Hochberg), and a general two-sample/paired test. Verified against scipy and statsmodels.
- **ACDC**: node-level ACDC-style circuit discovery (128 heads + 8 MLPs, τ slider, faithfulness) and causal scrubbing-lite for your own node hypotheses. Edge-level pruning is not implemented.
- **PROBES**: softmax-regression probes on the residual stream from word lists, split by word type, with a Hewitt–Liang control task and selectivity, swept over layers.
- **DATA**: upload or paste your own corpus. It stays in the browser, and the docs-based tools (drill, gradients, geometry, landscape, neuron atlas, stats, probes, eval) use it.
- **EVAL**: a clean-vs-current scoreboard covering perplexity, 12 cloze facts, distinct-1/2 and repeated 4-grams.
- **NOTEBOOK**: JavaScript cells against the lab API with inline plots, exportable as .md or .ipynb.
- **REPORT**: a self-contained HTML report with methods, results, figures and the manifest. Print it to get a PDF.
- **LOG**: JSONL export of the run log, a field-by-field diff of two runs, and full lab-state import/export.
- **Hardening** (see AUDIT.md):
  - Edit + undo is bitwise exact (fixed a drill restore bug).
  - three.js is vendored and pinned, and a Content-Security-Policy is set.
  - Weight downloads retry with backoff, and there is a retry button.
  - Long computations are chunked.
  - axe-core reports 0 WCAG 2 A/AA violations.
  - Terminal: hash, manifest, stats, acdc, scrub, probe, evalh, dataset, report, state.
- Learning: 19 new glossary terms, 5 Bible sections (including safety and ethics), and lessons 13–14 with quizzes.

## Safety and ethics
TinyStories-8M is a tiny model trained on synthetic children's stories, so findings may not transfer to larger models. Edited models produce unfiltered text. Notebook cells execute arbitrary JavaScript in the page, so only run code you trust. Uploaded data never leaves the browser. The only network access is to huggingface.co, for the public weights and tokenizer.

## What's new in v6
- **SCIENCE › DRILL**: hierarchical inspector model → layer → sublayer → matrix → head/neuron → row/col → weight (paths like `L3.attn.q.H5.r2.w17`), with moments, sparsity, norms, full SVD metrics (effective/stable rank, condition number, Hill α), gradient norm, empirical Fisher, saliency, an analytic-vs-finite-difference check, zero-ablation ΔCE with token provenance, direct logit effect, and undoable edits at every level. The breadcrumb and the 3D selection stay in sync.
- **SCIENCE › GRADIENTS**: an exact backward pass (verified against PyTorch autograd), grad×input, integrated gradients with a completeness check, attribution patching validated against activation patching of all 128 heads (Pearson r ≈ 0.99), Fisher diagonal, and the top Hessian eigenvalue from HVPs.
- **SCIENCE › CIRCUITS / GEOMETRY / LANDSCAPE**:
  - OV/QK eigenvalue copying scores, Q/K/V composition, and induction/previous-token scores with bootstrap CIs.
  - CKA, TwoNN intrinsic dimension, anisotropy, logit-lens KL, and superposition interference.
  - 1-D/2-D loss slices.
- **VIEW › 3D MODES**: morphing layer stack, instanced voxel weight field (LOD), loss surface, residual manifold (PCA-3), attention graph, and circuit graph, with lighting, viridis/diverging metric colors, and camera presets with tweened transitions.
- **TOOLS**:
  - WebGPU unembedding matvec, verified against CPU (max relative error ~1e-7), with a tok/s benchmark for both.
  - Model zoo (TinyStories 1M/3M/8M, streamed with HTTP Range) with a comparison table.
  - Weight diff (orig/snapshot/current).
  - Share URLs (`#x=` compressed edits + runtime + prompt).
- **CLI**: `node cli.mjs [--model DIR] <command>` (or an interactive prompt) on the same core: gen, drill, attrib, atp, eigen, comp, induct, geom, superpos, land, hess, zoo, diff.
- Charts redraw on theme switch. 22 new glossary terms, 6 Bible sections, and lessons 11–12 with quizzes.
- **Honest findings**:
  - TinyStories-8M has only weak random-token induction (max ≈ 0.05), confirmed with HF.
  - On software (SwiftShader) WebGPU the GPU path is ~40× slower than CPU, so generation keeps the CPU path.

## What's new in v5
- **28 tabs in 7 groups**: RUN (gen, steer, control, audio) · MODEL (arch, params, weights) · INTERPRET (analyze, attention, residual, circuit, neurons, embed, SAE, SAE dash) · INTERVENE (causal, surgery, runtime, sweep, ops) · EVALUATE (timeline, calibration, impact, profiler, runs) · VIEW (3D) · TOOLS (terminal, learn). Every chart exports PNG, SVG or CSV.
- **Advanced steering**: add, norm-preserving add, directional ablation and clamp at any hook site (resid, attn_out, mlp_out, z, q, k, v), with head slices, token masks and time schedules. Also logit bias and h-steering.
- **Sweeps and batch runs** (edit strength α, steer coef, head temperature, neuron clamp, logit bias, window, h-steer), plus an experiment tracker (RUNS).
- **Terminal** with about 40 commands, Tab completion, history and scripts.
- **Learning center**: Bible manual, 129-term glossary, index and search, and a 10-lesson course with labs and quizzes. Also available as `docs/BIBLE.md`, `docs/GLOSSARY.md` and `docs/COURSE.md`, generated by `node tools/gendocs.mjs`.
- **UI**: light and dark themes, resizable dock, keyboard shortcuts (`?`), ARIA roles, and a visible version label. Assets are cache-busted with `?v=5`.
- **Fixes**:
  - The first generation now records the timeline even when audio is off.
  - The root label shows the note and octave, matching the MIDI note.
  - Clamp no longer acts on unscheduled layers.
  - The head-ablation mode name now matches what the engine supports.


Live: https://0thernes.github.io/neuralese/

The app loads [roneneldan/TinyStories-8M](https://huggingface.co/roneneldan/TinyStories-8M) (GPT-Neo, 8 layers, 16 heads, d=256, 1024 MLP neurons) straight from Hugging Face. HTTP Range requests fetch only the 78.8 MB of fp32 tensors and skip the bool mask buffers. A from-scratch JS forward pass with hooks at `resid_pre, z, attn_out, mlp_act, mlp_out, resid_post` then runs everything on the CPU in f32.

## Modules
| file | what |
|---|---|
| engine.js | GPT-Neo forward pass, KV cache, traces, hooks. Runtime controls: layer program (dup/delete/skip/reorder), per-head temperature and zero/mean/resample ablation, attention-mask modes, positional remap, steering stack (site, per-layer schedule, token mask), SAE clamps, neuron overrides |
| analysis.js | corpus stats, logit lens, tuned lens (ridge affine per layer), exact DLA (embed/heads/neurons/biases/other), residual and head patching, path patching head→logits, ablation sweeps, control vectors (mean-diff / PCA), vector arithmetic, token stats |
| surgery.js | replayable edit stack: elementwise ops, SVD (top-k/drop/scale/flatten), low-rank noise, int8/4/2 quantization, layer interpolation/transplant, LayerNorm γ/β, wpe tampering, ROME rank-one, chaos; safetensors export |
| rome.js | ROME: u = C⁻¹k*/(k*ᵀC⁻¹k*) from the corpus MLP-activation second moment; v* optimised (direction ascent + SPSA/Adam) through the real forward pass |
| sae.js | ReLU SAE with L1, unit-norm decoder, Adam, trained in the browser |
| decode.js | temperature, top-k/p, min-p, typical, repetition/frequency/presence penalties, logit bias, beam search, contrastive decoding, CFG |
| linalg.js | one-sided Jacobi SVD, Cholesky solve, PCA |

## Verification
- v10: `npm test` runs **92 tests** (+10: `test/v10.test.mjs` A1–A3, C1, F1, N1–N2; `eshkol-taylor` E1; `eshkol-ad` D1–D2). `node smoke-v10.mjs <url> <prefix>` checks 18 claims, the terminal commands, CSP and console errors.
- v9: `npm test` runs **82 tests** (+7 in `test/hott.test.mjs`: H1–H4 Eshkol type checks with mutations, H5–H7 QGTL). `node smoke-v9.mjs` adds TYPES and QGTL checks.
- v8: `npm test` runs **75 tests** (59 earlier + 15 in `test/tsotchke.test.mjs`). `node smoke-v8.mjs` runs the TSOTCHKE group in headless Chrome: every live claim, WASM loading under the CSP, golden QRNG bytes, and FS angle after an edit.
- v7: `npm test` runs **59 tests** in one go (about 100 s). New tests cover bitwise undo exactness for every edit kind, stats against scipy/statsmodels, the weights hash, ACDC/scrubbing consistency, probe selectivity, and the eval harness. `node smoke-v7.mjs <url>` covers every tab, every RESEARCH tool and terminal command, CSP violations, a leak test (500 tokens plus 8 tab cycles), long tasks, and a 390 px layout. `node tools/netfail.mjs` checks retry and failure handling. `node tools/a11y.mjs` runs an axe WCAG 2 A/AA audit of every tab. `npm run lint` runs eslint.
- `node --test test/` runs 32 tests (18 against PyTorch references produced by `ref.py` (HF transformers): forward logits, logit lens, DLA, resid/head/path patching, SVD vs numpy, ROME flip, quantization ordering, SAE, decoding, and the safetensors round-trip; 7 audio tests; 7 v5 lab tests covering steering ops, schedules, labcore, the terminal, and learning-data integrity). v6 adds grad/science/zoo/drill/cli tests (52 total, PyTorch/HF-verified). `node smoke-v6.mjs <url>` (superset of v5) and `node smoke-v5.mjs <url>` opens every tab, runs every terminal command, and answers every quiz in headless Chrome.
- `node smoke.mjs` runs a headless-Chrome end-to-end check of the UI.

## Repo layout
`main` holds the source, tests, and PyTorch reference script. `gh-pages` holds the deployed static site (same JS files). To run the tests you need a local copy of the weights in `model/` (`model.safetensors`, `vocab.json`, `merges.txt`). Then run `python ref.py` (torch + transformers) followed by `node --test test/`.

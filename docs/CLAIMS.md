# Claims & Evidence (v10–v12)

Each claim names the check that would **refute** it. Every row is executed by `test/tsotchke.test.mjs` (Node), and rows
marked ● also run live in the browser (TSOTCHKE › CLAIMS, or `claims` in the terminal). Numbers are from the run on
2026-10-25 (America/Los_Angeles).

| id | claim | refuted if | evidence |
|---|---|---|---|
| C1a ● | The JS port of Eshkol's `taylor_recurrences.def` is correct to order 8 | any closed-form / identity error ≥ 1e-12 | max error 5.3e-15 (12 functions, 8 identities) |
| C1b | C1a can fail | a broken exp recurrence (÷(k+1) instead of ÷k) passes | broken version error > 1e-3 → rejected |
| C1c | The CE Taylor jet along an ln_f direction equals PyTorch float64 autograd | rel. error > 1e-4 (g′, g″), > 1e-3 (g‴) | g′ 1.369704e-3 vs 1.369705e-3; g″ 3.48221e-4 vs 3.482215e-4; g‴ 1.15767e-5 vs 1.15767e-5; `grad.js` g′ agrees to < 1e-4 |
| C2a ● | Moonlab fidelity of √p-states equals the Bhattacharyya coefficient² | \|ΔF\| ≥ 1e-12 | ΔF = 0 to 2e-16 on real model distributions |
| C2b | Fubini–Study metric (QGT real part) of ψ=√p equals Fisher/4 | s(ε)/ε misses √Fisher/2 by > 1e-3 at ε=1e-2, or the error does not shrink with ε | rel. error 1.7e-3 (ε=0.1) → 1.7e-4 (ε=0.01) |
| C2c | Three independent routes agree: mean Fisher = jet g″(0) = PyTorch | rel. difference > 1e-6 (JS↔JS) or > 1e-4 (vs torch) | 3.4822116e-4 / 3.4822116e-4 / 3.4822151e-4 |
| C2d ● | Moonlab's QWZ Chern numbers are correct | mismatch with independent FHS lattice computation (modulo orientation sign) for m ∈ {±0.5, ±1, ±1.5, ±3} | all match; Moonlab orientation = −FHS |
| C2e ● | Moonlab simulates a Bell state correctly | P ≠ [½,0,0,½], S ≤ 2 + 10σ, or \|S − 2√2\| > 4σ | S = 2.84 ± 0.014 (n = 20 000) |
| C3a ● | Seeded quantum_rng WASM is deterministic, and identical in Node and Chrome | bytes differ between runs or runtimes | golden prefix `52d659a0…93fe` for seed "neuralese-v8" in both |
| C3b ● | Upstream SP 800-90B health tests detect failure | generator output fails, or 2000 zero bytes pass | output 0 (pass), zeros −1 (RCT fail) |
| C3c | Output passes our SP 800-22 subset at the NIST proportion | any test fails > 1 of 20 seeds × 1 Mbit at α = 0.01; or a biased stream passes monobit | pass; biased control rejected |
| C3d | quantum_rng's simulated CHSH exceeds 2 | S ≤ 2.6 | S = 2.82 (n = 20 000). **This shows the simulator is correct, not that bits are quantum.** |
| C4 ● | `nist.js` matches the SP 800-22 rev1a worked examples | any p-value off by ≥ 5e-7 | 0.527089, 0.801252, 0.147232, 0.109599, 0.706438, 0.500798, 0.219194: all match |
| C5a ● | edit ; undo ≡ identity | weights hash after undo ≠ before | bitwise equal |
| C5b | Disjoint edits commute; overlapping non-linear ones do not | disjoint pair differs, or noise∘SVD = SVD∘noise | as claimed (the check is capable of failing) |
| C2f ● | QGTL's own `qgt_geometric_measure_fidelity` (WASM) agrees with Moonlab | \|ΔF\| ≥ 2e-6 (synthetic) or ≥ 1e-5 (real 50 257-way distributions) | 8.4e-10 (synthetic); ≤ 1.1e-7 across prompt positions in Chrome |
| C2g ● | QGTL's `qgt_geometric_compute_metric` is only diag(1 − \|ψ_i\|²) (an upstream limitation, recorded so a fix upstream would show up) | any entry deviates by ≥ 1e-6 | max deviation 4.5e-8 |
| C6a ● | Eshkol's type layer (`dependent.cpp`, `hott_types.cpp`, WASM) accepts all 73 judgments of the live model graph: reshape paths Id_Nat(rows·cols, len), matmul compatibility, head split, residual adds, token bounds, Float32 <: Real, promotion to Float64 | any judgment rejected | 73/73 |
| C6b ● | The same checker rejects broken graphs | a truncated `h3.fc`, ff = 1000, token 50257, or a non-Float32 tensor is accepted | each rejected; e.g. "Dimension mismatch: 262144 != 262143" (tests H1–H4) |
| C1d ● | Eshkol's compiled Taylor kernels (`runtime_taylor.c`) equal `taylor.js` to order 15 | any of 44 cases differs by ≥ 1e-12 | worst 9.7e-16 (tan, k = 15) |
| C2h ● | Moonlab's native `qgt_metric_at` equals our fidelity-angle Fubini–Study metric (QWZ) | \|Δg\| > 1e-6 at any k, m; or a 4× metric passes | ≈ 2e-8; 4× rejected |
| C3e ● | The glibc/WASM QRNG difference is caused by libm, not SIMD | musl native ≠ WASM, or glibc SSE3 ≠ glibc scalar | musl (SSE3 and scalar) = WASM `52d659a0…`; glibc (both) `e5f60b0d…` |
| C7a ● | Natural gradient beats Adam on the training loss but not on held-out loss (ln_f fine-tune, 8 eval seeds) | a 95% CI includes 0 | train Δ −0.166 [−0.232, −0.099]; held-out Δ +59.1 [18.5, 99.6] (train-selected) / +0.247 [0.155, 0.339] (held-out-selected). **Negative for NG on generalisation.** |
| C8a ● | Eshkol's AD tape (`vm_autodiff.c`) and `grad.js` give the same full GPT-Neo backward pass | max \|Δg\| > 1e-5·max\|g\| | 1.19e-7 vs 0.425 (1320 gradients) |
| C9a ● | `neurosym.js` reproduces a real `eshkol-run` trace of `neurosymbolic.esk` soft-unify | any of 58 values differs by ≥ 1e-12 | 2.2e-16 |

## v11 FRONTIER — pre-registered hypotheses (PREREG-v11.md, sha256 8b923ab4…, commit 2a2b3ef)

Verdict ● supported · ○ not supported. Details and caveats: [FRONTIER.md](FRONTIER.md). Live: FRONTIER → F-CLAIMS; Node: `test/v11.test.mjs`.

| id | claim (frozen threshold) | result | verdict |
|---|---|---|---|
| H1a | PCI(trained) > random-init and shuffled | +0.0069 [0.0010, 0.0131]; +0.100 [0.090, 0.110] | ● (negligible vs random-init) |
| H2a | ignition: median Hill n ≥ 2 | 3.00 | ● |
| H2b | sharper than random-init | +1.31 [−0.21, 2.65] | ○ |
| H3a | injected-concept detection AUC ≥ .75, +.10 over null | .700 vs .533 | ○ |
| H3b | privileged self-prediction vs 3M/1M | self−3M +0.031 [−0.003, 0.072] | ○ |
| H4a | gated self-edit loop improves test CE | −0.0051 [−0.0076, −0.0027] | ● |
| H4b | random control accepted ≤ 10% | 0/30 | ● |
| H4c | self-distillation does not help | −0.0118 [−0.0154, −0.0085] | ○ (falsified) |
| H4d | test-time training helps | −0.0012 [−0.0035, 0.0012] | ○ |
| H5a | grokking within 6000 steps | test 0.62 max | ○ |
| H5b | ≥ 80% Fourier neurons | 70.7% | ○ |
| H5c | wd=0 fails to generalise | 1.9% | ● |
| H6a | AtP ranks units like exact ablation (ρ ≥ .5) | ρ neurons 0.982, heads 0.560 | ● |
| H6b | top 1% neurons ≥ 25% of \|ΔCE\| | 5.8% | ○ |

## v12 HUB — model hub, modalities, fine-tuning

Each row is checked by `test/v12.test.mjs` (Node) and/or `smoke-v12.mjs` (headless Chrome running the real models). ● = also a
self-test button in the app. Numbers: local headless run, 2026-10-26 (PT); the live-site run is reported in V12_PROGRESS.md.

| id | claim | refuted if | evidence |
|---|---|---|---|
| H1 ● | MiniLM embeddings separate a paraphrase from an unrelated sentence | cos(paraphrase) < cos(unrelated) + 0.20 | 0.808 vs −0.069 |
| H2 ● | TTS → Whisper round trip preserves a known sentence | word error rate > 0.25 | “The quick brown fox jumps over the lazy dog.” → identical, WER 0 |
| H3 ● | TrOCR reads a rendered printed line | character error rate > 0.10 | “NEURALESE LAB 2026” → identical, CER 0 |
| H4 ● | CLIP classifies a drawn red circle correctly zero-shot | top label ≠ “a red circle” (4 labels) | 98.8% “a red circle” |
| H5 | Captioning and GPT-2-family generation run locally | no caption ≥ 3 words / no continuation | caption “a blue and white photo of a blue and white wall” for a blue/green two-band image (a weak caption — the claim is only that it runs); DistilGPT-2 continues the prompt |
| H6 ● | Fine-tuning 1,536 params of TinyStories-8M on user text lowers **held-out** CE | 95% bootstrap CI of held-out ΔCE includes 0 or is > 0 | Node, 6 steps: 4.634 → 4.030, Δ −0.604 [−0.724, −0.473]; test (3 steps) and browser (3 steps) also pass |
| H7 | The fine-tune weight edit is exact and undoable | CE of edited weights ≠ CE of (θ on clean weights) by ≥ 1e-4, or undo does not restore ln_f bit-for-bit | equal to < 1e-4; undo bit-exact (V12-10) |
| H8 | The runtime is pinned | the worker imports a transformers.js or runs an ORT binary whose SHA-256 ≠ pin | V12-2 (pins + verify-before-import in source); worker aborts on mismatch |
| H9 | Only the TinyStories zoo is white-box | any HUB ONNX model exposes activations to the interpretability tools | by construction: HUB models return only pipeline outputs (TOOL_MATRIX in `site/hub/models.js`) |

Caveat: the H6 text is repetitive and in-distribution for TinyStories; a held-out gain shows the 1,536-parameter adapter
generalises to unseen chunks of the **same** text, not that the model learned new facts.

## Errata and caveats found while testing
- **NIST cumulative-sums 10-bit example.** SP 800-22 rev1a prints P = 0.4116588 for ε = 1011010111. Our code and an
  independent scipy computation both give 0.4115847. We believe the printed value is a rounding erratum. The test uses
  the 100-bit example (0.219194), which matches exactly.
- **Cross-libm determinism (known result, v10).** Seeded quantum_rng output depends on the C math library: glibc 2.41 gives `e5f60b0d…`, musl 1.2.5 and WASM give `52d659a0…`, with or without SSE3 (C3e). Seeded streams are reproducible only within one libm.
- **Fubini–Study floor.** With no edits, the measured angle is ~2e-7 rad, not 0. This is the float64 rounding floor of
  arccos near 1, and is expected.
- **Not claimed:** quantum randomness, quantum speed-up, HoTT proofs (Eshkol's checker is gradual and has no univalence), tensor-logic semantics, or any capability of the
  Tsotchke projects beyond what is listed above.

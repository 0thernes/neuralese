# NEURALESE — The Bible

Reference manual for every tab and control. Also in the app: TOOLS › LEARN › Bible.

## Contents
- [Overview](#overview)
- [RUN › GEN](#run--gen)
- [RUN › STEER](#run--steer)
- [RUN › CONTROL (advanced steering)](#run--control-advanced-steering)
- [RUN › AUDIO](#run--audio)
- [MODEL › ARCH](#model--arch)
- [MODEL › PARAMS](#model--params)
- [MODEL › WEIGHTS](#model--weights)
- [INTERPRET › ANALYZE](#interpret--analyze)
- [INTERPRET › ATTENTION](#interpret--attention)
- [INTERPRET › RESIDUAL](#interpret--residual)
- [INTERPRET › CIRCUIT](#interpret--circuit)
- [INTERPRET › NEURONS](#interpret--neurons)
- [INTERPRET › EMBED](#interpret--embed)
- [INTERPRET › SAE / SAE DASH](#interpret--sae--sae-dash)
- [INTERVENE › CAUSAL](#intervene--causal)
- [INTERVENE › SURGERY](#intervene--surgery)
- [INTERVENE › RUNTIME](#intervene--runtime)
- [INTERVENE › SWEEP](#intervene--sweep)
- [INTERVENE › OPS](#intervene--ops)
- [EVALUATE › TIMELINE](#evaluate--timeline)
- [EVALUATE › CALIBRATION](#evaluate--calibration)
- [EVALUATE › IMPACT](#evaluate--impact)
- [EVALUATE › PROFILER](#evaluate--profiler)
- [EVALUATE › RUNS](#evaluate--runs)
- [VIEW › 3D](#view--3d)
- [TOOLS › TERMINAL](#tools--terminal)
- [TOOLS › LEARN](#tools--learn)
- [Export](#export)
- [Honest limits](#honest-limits)
- [SCIENCE › DRILL](#science--drill)
- [SCIENCE › GRADIENTS](#science--gradients)
- [SCIENCE › CIRCUITS](#science--circuits)
- [SCIENCE › GEOMETRY + LANDSCAPE](#science--geometry--landscape)
- [VIEW › 3D MODES](#view--3d-modes)
- [TOOLS › WEBGPU, ZOO, SHARE, CLI](#tools--webgpu-zoo-share-cli)
- [RESEARCH › REPRO, STATS, LOG](#research--repro-stats-log)
- [RESEARCH › ACDC + SCRUBBING](#research--acdc--scrubbing)
- [RESEARCH › PROBES, DATA, EVAL](#research--probes-data-eval)
- [RESEARCH › NOTEBOOK + REPORT](#research--notebook--report)
- [TSOTCHKE › overview and attribution](#tsotchke--overview-and-attribution)
- [TSOTCHKE › QRNG](#tsotchke--qrng)
- [TSOTCHKE › Q-GEOMETRY](#tsotchke--q-geometry)
- [TSOTCHKE › TAYLOR](#tsotchke--taylor)
- [TSOTCHKE › TYPES](#tsotchke--types)
- [TSOTCHKE › v10 cross-checks](#tsotchke--v10-cross-checks)
- [TSOTCHKE › CLAIMS (Claims & Evidence)](#tsotchke--claims-claims--evidence)
- [FRONTIER: consciousness proxies, introspection, self-improvement, grokking, causal atlas](#frontier-consciousness-proxies-introspection-self-improvement-grokking-causal-atlas)
- [HUB: model hub, embeddings, speech, vision, LM swap, fine-tuning (v12)](#hub-model-hub-embeddings-speech-vision-lm-swap-fine-tuning-v12)
- [Safety, ethics and limits](#safety-ethics-and-limits)

## Overview

Neuralese is a browser laboratory for the real TinyStories-8M (GPT-Neo, 8 layers, d=256, 16 heads, 19.7 M parameters). Everything shown is computed from the live weights on your CPU in float32 JavaScript; nothing is mocked. You can edit weights (SURGERY), change the forward pass at runtime (RUNTIME, CONTROL, STEER), measure the consequences (EVALUATE group) and inspect internals (INTERPRET group). Every change goes through one undo/redo stack.

Layout: top bar (version, HUD, theme), left 3D view, right dock with grouped tabs (drag the splitter to resize). Keyboard: Ctrl/⌘+Enter generate · Ctrl/⌘+Z / Shift+Z undo/redo · ` focus terminal · ? shortcuts · 1–9, 0 jump to tab groups.

## RUN › GEN

Prompt, decoding options and output. Modes: sample, greedy, beam, contrastive (hacked expert vs clean amateur, or reversed), CFG (negative prompt). Options: temperature, top-k, top-p, min-p, typical-p, repetition/frequency/presence penalties, logit bias (token:value,…), seed. "compare" shows the clean model side by side and marks the first divergence. Hover tokens for post-filter probabilities and the top-10. Every generated token is logged to the TIMELINE (p, entropy, surprisal, rank).

## RUN › STEER

Classic activation steering: build a vector from contrast prompts (mean difference of residuals, optional PCA), arithmetic on vectors, per-layer schedule, token masks. Vectors can be exported/imported as JSON. The readout projects each generated token's residual on a chosen vector.

## RUN › CONTROL (advanced steering)

Op-based steering. Source: token difference, an existing vector, neuron output weights, SAE decoder row, random (control). Site: resid_pre/post, attn_out, mlp_out, z (per-head output, mapped through W_O), q/k/v (mapped through W_Q/W_K/W_V). Op: add, addnorm (norm-preserving), ablate (remove projection), clamp (set projection). Head slice, layer range, token mask and time schedule (const, ramp, decay, pulse, window). Logit-space: logit biases and h-steering (add c·W_U[token] after ln_f).

## RUN › AUDIO

Calm, data-driven sonification. Harmony from the final residual; token pitch from log-probability and rank; pad brightness from entropy; per-layer choir from residual norms; a consonant voice for KL(hacked‖clean). Volume per stem, styles, mute. Audio never affects computation.

## MODEL › ARCH

Interactive schematic of the network: embeddings, 8 blocks (attention local/global, MLP), ln_f, tied unembedding, with tensor shapes and per-block parameter counts. Click a block to select that layer everywhere (3D, WEIGHTS, ATTENTION).

## MODEL › PARAMS

Treemap and table of every parameter tensor with counts, share of total, and FLOPs per token at a chosen context length. CSV export.

## MODEL › WEIGHTS

Per matrix: value histogram, singular values (original vs current), eigenvalue spectral density with power-law α fit (Clauset MLE), stable/effective rank, Frobenius/spectral norm, kurtosis, heatmap and Δ heatmap vs the original. "WW scan" computes α for every matrix and logs a run.

## INTERPRET › ANALYZE

Logit lens and tuned lens grids, direct logit attribution for a target token, top tokens per slot. Requires reference statistics (computed once from the corpus).

## INTERPRET › ATTENTION

All 128 head patterns as small multiples, a selected head enlarged, attention rollout and head-to-head flow. Head classification heatmap (previous-token, duplicate, induction, sink) on synthetic repeated sequences.

## INTERPRET › RESIDUAL

Residual norm heatmap (token × slot), slot-to-slot cosine similarity, PCA trajectories of each token through depth.

## INTERPRET › CIRCUIT

Graph of the strongest direct-logit contributors (heads, MLPs) for the predicted or chosen token, with Q/K/V composition edges between heads (‖W_QK·W_OV‖ style scores). Click nodes to select.

## INTERPRET › NEURONS

Neuron atlas of a layer over the corpus: max activation, firing frequency, polysemanticity exp(H) of top-token identities; scatter and grid views; click a neuron for top contexts and output-weight logits.

## INTERPRET › EMBED

Nearest neighbours of a token by cosine in the embedding matrix and a 2-D PCA map of frequent tokens.

## INTERPRET › SAE / SAE DASH

Train a sparse autoencoder on one layer's residual (in-browser), clamp features during generation. The dashboard shows feature density, dead-feature count, and per-feature top contexts and logit effects.

## INTERVENE › CAUSAL

Activation patching (residual, heads), path patching heads→logits, ablation sweeps. Clean/corrupted prompts and a logit-difference metric.

## INTERVENE › SURGERY

Persistent weight edits (undoable): element ops (scale, zero, invert, add, noise) on matrices/heads/neurons/embeddings, SVD (top-k, flatten, drop, scale), low-rank update, quantization (bits, layers, matrices), interpolation between layers, LayerNorm edits, ROME rank-one fact editing, positional embedding edits, chaos. Export modified safetensors.

## INTERVENE › RUNTIME

Non-destructive forward-pass control: layer program (skip/repeat/reorder slots), per-head temperature and ablation (zero/mean/resample), attention masks (window), neuron ablation/clamp.

## INTERVENE › SWEEP

Vary one parameter over a range and plot perplexity, KL(clean‖current) and p(target): edit blend α, steering coefficient, head temperature, neuron clamp, logit bias, attention window, h-steer. Batch box runs terminal lines. Results go to RUNS.

## INTERVENE › OPS

List of all edits and runtime ops, undo/redo history, snapshot export/import (JSON with edits + runtime).

## EVALUATE › TIMELINE

Per generated token: probability, entropy, surprisal; hover to read the token. CSV export.

## EVALUATE › CALIBRATION

Perplexity, top-1 accuracy and expected calibration error with reliability diagrams for clean vs current, on N corpus tokens.

## EVALUATE › IMPACT

KL per slot (logit lens of current vs clean), KL per position, biggest probability shifts, greedy continuation clean vs hacked.

## EVALUATE › PROFILER

Per-operation timing (embed, attention, MLP, ln_f+unembed) and tokens/s on this machine.

## EVALUATE › RUNS

Experiment tracker (localStorage). Every calibration, sweep, WW scan is logged with its state summary. Tick runs to compare a metric; export CSV/JSON; delete.

## VIEW › 3D

Three.js view of the network: layers as stacked planes, heads and neurons as instanced cells, activation glow during generation. Height/colour modes and weight Δ mode; the background follows the light/dark theme. Selection is linked to the panels.

## TOOLS › TERMINAL

Command line for everything: type help. Tab completes commands, ↑/↓ history, scripts with ";" or the script box.

## TOOLS › LEARN

This manual, the glossary, a searchable index and a 10-lesson course with labs and quizzes. Progress is saved locally.

## Export

Every chart has PNG export; SVG charts export SVG; charts with data export CSV. Runs export CSV/JSON; snapshots and steering vectors export JSON; weights export safetensors.

## Honest limits

CPU float32 by default (optional WebGPU unembedding; the KV-cache step stays on CPU); ~10–40 tok/s depending on the machine. The reference corpus is 40 stories sampled from the clean model, so perplexity is relative. Power-law fits on 256 eigenvalues are noisy. Rollout and DLA are approximations (rollout ignores MLPs; DLA freezes the LayerNorm scale). Head classes are scores, not labels.

## SCIENCE › DRILL

Hierarchy model → layer → sublayer (ln1, attn, ln2, mlp) → matrix → head/neuron → row/column → single weight. Paths look like L3.attn.q.H5.r2.w17 and are shareable via the terminal (`drill <path>`). The inspector computes, for the exact index set: mean, std, skew, excess kurtosis, sparsity, L1/L2/L∞; for 2-D blocks the full SVD (spectral, Frobenius, nuclear norm, effective and stable rank, condition number, Hill α); loss gradient norm, empirical Fisher trace, saliency; the analytic directional derivative checked against a central finite difference; zero-ablation ΔCE and the tokens it moves most (provenance); and the direct logit effect of heads and neurons. Any level can be edited (scale, zero, noise, add, invert) as an undoable edit. Selecting a node syncs the 3D selection.

## SCIENCE › GRADIENTS

A hand-written reverse-mode backward pass for GPT-Neo (verified against PyTorch autograd: loss, weight gradients and input gradients agree to float32 precision). Gradient×input, integrated gradients (with the completeness check printed), attribution patching validated against true activation patching of all 128 heads (Pearson r reported; ~0.99 on the default prompt pair), empirical diagonal Fisher per matrix, and top Hessian eigenvalue by power iteration on finite-difference HVPs.

## SCIENCE › CIRCUITS

OV and QK eigenvalue scores for every head through the embedding, Q/K/V composition scores between all head pairs (also shown as a 3D circuit graph), and induction / previous-token scores on repeated random tokens with bootstrap CIs. Finding: TinyStories-8M has strong previous-token heads but only weak random-token induction (max ≈ 0.05–0.06, cross-checked with HF transformers).

## SCIENCE › GEOMETRY + LANDSCAPE

Per residual slot: linear CKA matrix, TwoNN intrinsic dimension, anisotropy and logit-lens KL with bootstrap CIs; neuron superposition geometry. LANDSCAPE evaluates 1-D/2-D loss slices along filter-normalised random or top-singular directions of one matrix and renders the 2-D grid as a 3D surface.

## VIEW › 3D MODES

Morphing views: layer stack, instanced weight voxel field (LOD), loss surface, residual manifold (PCA-3 of the residual stream at every layer), attention graph for one head and a circuit graph from composition scores. Camera presets with smooth transitions. Colors use viridis (sequential) and a blue-white-red diverging scale mapped to the metric.

## TOOLS › WEBGPU, ZOO, SHARE, CLI

WEBGPU uploads the unembedding, verifies the GPU result against CPU and benchmarks both (tok/s). On software adapters the GPU path is slower; on real GPUs it may be faster. ZOO streams TinyStories-1M/3M by HTTP Range (F32 tensors only) and compares loss, stable rank and induction; DIFF compares orig, snapshot and current weights tensor by tensor. SHARE encodes the edits, runtime and prompt into a compressed #x= URL. `node cli.mjs` is a terminal tool on the same core (inspect, attribution, eigen, induction, landscape).

## RESEARCH › REPRO, STATS, LOG

REPRO hashes the original and current weights with SHA-256 (also shown in the top bar), downloads a manifest (version, model id + hash, edits, runtime, prompt, decoding, seed, environment) and replays one from the clean weights, checking the resulting hash bit for bit. Edit + undo restores weights exactly (unit-tested for every edit kind). STATS zero-ablates each head of a layer and compares per-document CE to the unablated model with a paired sign-flip permutation test, Cohen's d_z and a bootstrap CI, then applies Holm and Benjamini–Hochberg corrections; a second panel tests any two lists of numbers. LOG exports every logged run as JSONL and diffs two runs field by field; the lab-state file bundles edits, runtime, prompt, notebook, run log and user dataset.

## RESEARCH › ACDC + SCRUBBING

ACDC (node-level) treats the 128 heads (their z slice) and 8 MLPs (mlp_out) as nodes. Going from the last layer back, each node is replaced with its activation on the corrupt prompt; if the logit-difference metric moves by less than τ times the clean–corrupt gap, it stays replaced. The result lists the kept nodes and their faithfulness. Edge-level pruning, as in the original paper, is not implemented. Causal scrubbing-lite keeps your listed nodes clean, resamples all others from the corrupt prompt and reports faithfulness; scrubbing the ACDC circuit reproduces its faithfulness exactly (tested).

## RESEARCH › PROBES, DATA, EVAL

PROBES trains a softmax-regression probe on standardised residual vectors at tokens from your word lists (single-token words only). Train/test is split by word type, and a control task with random per-type labels gives selectivity. DATA swaps the built-in corpus for pasted or uploaded text (blank-line separated, max 500 docs); drill, gradients, geometry, landscape, neuron atlas, stats, probes and eval all use it, and it never leaves the browser. EVAL compares clean vs current on perplexity, 12 TinyStories cloze facts, distinct-1/2 and repeated 4-grams of greedy generations.

## RESEARCH › NOTEBOOK + REPORT

NOTEBOOK cells are async JavaScript bodies with lab, research, docs(n,T), print and plot in scope; cells persist in localStorage and export as Markdown or .ipynb (JSON, javascript kernel name). Cells run with full page privileges, which is why the CSP allows 'unsafe-eval'. REPORT builds a self-contained HTML file with the manifest, every RESEARCH result computed this session with its method text, and the charts as PNGs; print it to PDF from the browser.

## TSOTCHKE › overview and attribution

The TSOTCHKE group (key 8) holds the components built on Tsotchke's MIT-licensed open-source work: Eshkol (Taylor-mode AD recurrences, ported to JS), Moonlab (quantum simulator, upstream WASM), QGTL (the quantum geometric tensor definition) and quantum_rng (compiled to WASM). The overview tab lists each project with the exact commit, license, what is used, where its evidence is, and what was not used and why. Only these tabs carry the ⚛ Powered by Tsotchke badge. The language model itself is ordinary TinyStories-8M in JavaScript; nothing here makes it a quantum model. Full write-up: docs/TSOTCHKE.md, docs/CLAIMS.md, docs/STACK.md.

## TSOTCHKE › QRNG

Draw seed runs tsotchke/quantum_rng (WASM) seeded with 16 bytes from crypto.getRandomValues, then the upstream NIST SP 800-90B health tests and our SP 800-22 subset (monobit, block frequency, runs, cumulative sums) on 64 KiB of the same stream. The provenance block (generator commit, entropy source, seed hex, test results) can be replayed by pasting the seed hex. 'use as decoding seed' writes the 32-bit seed into the generation seed, so it lands in the REPRO manifest. Honest label: this is a classical simulation of quantum measurement; the only real entropy is the browser CSPRNG seed. The CHSH panel shows S ≈ 2.83 > 2, which proves the simulator implements quantum mechanics correctly, not that the bits are quantum. Terminal: qseed, qseed apply.

## TSOTCHKE › Q-GEOMETRY

Embeds each next-token distribution p as the real 16-qubit state ψ = √p and asks Moonlab for the fidelity F = |⟨ψ_clean|ψ_edit⟩|². The Fubini–Study angle arccos √F (0 to π/2 rad) is a true metric between the clean and the edited model's predictions at every prompt position. QGTL's own qgt_geometric_measure_fidelity, compiled to WebAssembly (v9), measures every position as well and agrees with Moonlab to ~1e-7 (single-precision amplitudes). A direct JS sum cross-checks every fidelity (|ΔF| ~1e-16). With no edits the angle is ~2e-7 rad, the float64 floor of arccos near 1. The second panel tests a prediction of QGTL's metric: along a final-LayerNorm direction, s(ε)/ε → √Fisher/2 as ε → 0. Terminal: fsdist.

## TSOTCHKE › TAYLOR

A JS port of Eshkol's Taylor recurrences propagates truncated power series (jets) through exp, log, trig, powers and the softmax cross-entropy. The self-test compares every recurrence with closed-form derivatives and identities (errors ~1e-15). The jet panel expands the current model's mean CE along a random final-LayerNorm direction to order K in one pass, then compares the Taylor polynomial with the loss recomputed at several ε. Agreement within ε^(K+1) is a prediction that can visibly fail. The same jet is checked against PyTorch float64 autograd in the test suite.

## TSOTCHKE › TYPES

Eshkol's own compile-time type layer (lib/types/dependent.cpp and hott_types.cpp, compiled to WebAssembly) decides 73 judgments about the live model graph. For each weight it checks that the flat length equals rows·cols, a path/identity judgment Id_Nat(rows·cols, len) computed by CTValue::mul. It also checks that every matmul is dimension-compatible (q, k, v, o, fc, proj, unembedding), that H·hd = d, that residual adds match, that prompt tokens are below V, and that Float32 <: Real in the universe hierarchy. Edits change values, not shapes, so every judgment should hold. The second button truncates h3.fc by one element, and Eshkol rejects exactly that node ("Dimension mismatch: 262144 != 262143"). Eshkol's checker is gradual and has no univalence, so this is dimension and type checking, not a HoTT proof.

## TSOTCHKE › v10 cross-checks

v10 checks NEURALESE against Tsotchke's own code, run unmodified. Moonlab's native qgt_metric_at, compiled to WASM, matches our Fubini–Study metric to about 2e-8 (terminal: qgtcheck m). Eshkol's compiled Taylor kernels match taylor.js to 9.7e-16, and Eshkol's AD tape reproduces our full GPT-Neo backward pass on a tiny model (1.2e-7). Eshkol's soft-unify from neurosymbolic.esk is ported and matches a real eshkol-run trace to 2.2e-16 (terminal: unify cat kitten rock — raw embeddings, so scores near 0.5 mean nothing logical). Negative result: natural gradient (Fisher = 4 × Fubini–Study) beats Adam on the training loss but loses on held-out loss, with 95% confidence intervals over 8 seeds. Known result: seeded quantum_rng bytes depend on libm (glibc vs musl), not on SIMD. All of these are live claims C1d, C2h, C3e, C7a, C8a, C9a.

## TSOTCHKE › CLAIMS (Claims & Evidence)

Every claim made about a Tsotchke-powered component is listed with the observation that would refute it, and is checked now in your browser: recurrence accuracy, Moonlab fidelity vs direct sum, QWZ Chern numbers vs an independent lattice computation, Bell/CHSH, QRNG determinism (same golden bytes as Node), health tests detecting a stuck source, NIST worked examples, and edit/undo identity. The Node suite adds PyTorch cross-checks and mutation tests that show the checks can fail. Not claimed: quantum randomness, quantum speed-up, HoTT proofs or tensor-logic semantics. Terminal: claims.

## FRONTIER: consciousness proxies, introspection, self-improvement, grokking, causal atlas

The FRONTIER group (v11) runs 14 hypotheses that were frozen in docs/PREREG-v11.md before any experiment (sha256 checked live in F-CLAIMS). FRONTIER lists every hypothesis with its verdict; SCORECARD applies Butlin, Long et al.'s consciousness indicators (present / partial / absent / untestable, each justified); MIND shows the PCI-style perturbational-complexity test against random-init and shuffled nulls, the ignition dose–response (Hill fit) and two introspection tests (injected-concept detection; privileged self-prediction against TinyStories-3M and -1M); SELF-IMPROVE shows a propose/select/test loop with a random-edit control, self-distillation and test-time training; GROKKING shows the pre-registered modular-addition run with a Fourier check and lets you train the same network live; ATLAS shows exact ablation of all 128 heads and 8192 neurons against attribution patching. Several hypotheses failed and are reported as failures. None of these tests can show that the model is or is not conscious; they measure operational proxies. Results: 6 of 14 hypotheses supported, 8 not (atlas: AtP ranks units like exact ablation, ρ .98 neurons / .56 heads; top 1% of neurons hold only 5.8% of the effect). Terminal: frontier, scorecard, pci, grok [steps], fclaims.

## HUB: model hub, embeddings, speech, vision, LM swap, fine-tuning (v12)

HUB runs public ONNX models from the Hugging Face Hub with transformers.js 4.3.1 (pinned and SHA-256-checked) in a Web Worker; the 28 MB ONNX Runtime WASM binary comes from jsDelivr at a pinned version and is SHA-256-checked before use. Everything runs locally; models download once (8-bit, 22–245 MB) and are cached. HUB lists the models, loads them, picks CPU (WASM) or WebGPU, and shows which lab tools work on which model: only the TinyStories zoo is white-box. EMBED: all-MiniLM-L6-v2 sentence embeddings, nearest neighbours, semantic search, and a rotatable 3D PCA map (Three.js); self-test: paraphrase cosine ≥ unrelated + 0.20. SPEECH: Whisper tiny.en from the microphone or a file, MMS-TTS with WAV download, and a speech-to-speech chain (record → Whisper → transform → TTS); self-test: TTS → Whisper word error rate ≤ 0.25. VISION: upload an image or render a test card; TrOCR reads one printed line (self-test CER ≤ 0.10), ViT-GPT2 captions, CLIP classifies zero-shot (self-test: a drawn red circle → “a red circle”). LM SWAP: DistilGPT-2 / GPT-2 greedy generation only — no activations. FINE-TUNE: Adam on 1,536 parameters of TinyStories-8M (ln_f + layer-7 neuron gains) on your text; every 3rd chunk is held out; pass = 95% bootstrap CI of held-out CE change below 0; “apply” adds an undoable, replayable weight edit. Terminal: hub, embed, tts, s2s, ocrtest, hgen. Roadmap of 100 items: docs/ROADMAP-v12.md.

## Safety, ethics and limits

TinyStories-8M is a tiny model trained on synthetic children's stories; findings may not transfer to larger models, and nothing here is evidence about frontier-model safety. Weight edits can make the model produce nonsense or unexpected text; outputs are not filtered. Uploaded datasets and notebook code stay in your browser, but notebook cells execute arbitrary JavaScript in the page — only run code you trust. Interpretability claims need controls: use corrupted baselines, control tasks, multiple-comparison correction and confidence intervals, and report negative results. The only network access is to huggingface.co for the public weights and tokenizer.

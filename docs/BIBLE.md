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
- [Safety, ethics and limits](#safety-ethics-and-limits)

## Overview

Neuralese is a browser laboratory for the real TinyStories-8M (GPT-Neo, 8 layers, d=256, 16 heads, 19.7 M parameters). Everything shown is computed from the live weights on your CPU in float32 JavaScript; nothing is mocked. You can edit weights (SURGERY), change the forward pass at runtime (RUNTIME, CONTROL, STEER), measure the consequences (EVALUATE group) and inspect internals (INTERPRET group). Every change goes through one undo/redo stack.

Layout: top bar (version, HUD, theme), left 3D view, right dock with grouped tabs (drag the splitter to resize). Keyboard: Ctrl/⌘+Enter generate · Ctrl/⌘+Z / Shift+Z undo/redo · ` focus terminal · ? shortcuts · 1–9 jump to tab groups.

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

## Safety, ethics and limits

TinyStories-8M is a tiny model trained on synthetic children's stories; findings may not transfer to larger models, and nothing here is evidence about frontier-model safety. Weight edits can make the model produce nonsense or unexpected text; outputs are not filtered. Uploaded datasets and notebook code stay in your browser, but notebook cells execute arbitrary JavaScript in the page — only run code you trust. Interpretability claims need controls: use corrupted baselines, control tasks, multiple-comparison correction and confidence intervals, and report negative results. The only network access is to huggingface.co for the public weights and tokenizer.

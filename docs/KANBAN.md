# Kanban

Solo board. No assignees, no approvals. An item moves only when the named check is green.

## Done

- Dock the legacy WebGL stage (`#gl`) into the viz and 3D-modes panels, and size it from the panel. `src/viz.js`, `src/viz3d.js`, `ui/src/panels/Panels.tsx`.
- Never-subtract manifest. `features.json`, `features/releases/`, `tools/check-features.mjs`.
- Solo agent API: local runs, sweeps, reports, spectrum tool, CLI, JSON-RPC. `src/agent/`, `tools/agent.mjs`. No orgs.

## Review

- Shell rebuild and a browser pass of the docked stage, the command palette, and a machine hello logged from the page. The agent tests cover the CLI, not the pixels.

## In progress

- Finish list still open: live bug list with causes, Playwright click-all on the preview URL, parity restores, redesign screenshots, engineering docs, ten scored passes, Runs workspace, verified Deep Analytics views. P0 table stakes do not start until that list is evidenced.

## Ready

- Wire the page's Machine, Forge, Walk, Adversary, and fault buttons to `createLab`, so a click and a CLI launch land in one store.
- Browser e2e that opens every `features.json` route and fails on a page error. CI stays tag or manual dispatch.

## Backlog

P0 table stakes from `docs/roadmap/TABLE_STAKES_100.md`. Not started. Alex’s “have” mark is noted and was not re-audited here.

- TS-P0-01 Named hook points on every module (#1, partial).
- TS-P0-02 run_with_cache (#2, partial).
- TS-P0-03 Hook interventions add/replace/zero (#3, partial).
- TS-P0-04 Unified HF loader (#5, partial).
- TS-P0-05 Arch adapters GPT-2/Llama/Qwen/Pythia (#6, partial).
- TS-P0-06 Batched inference with padding masks (#8, partial).
- TS-P0-07 Deterministic seeds (#9, partial).
- TS-P0-08 Sharded activation store (#10, partial).
- TS-P0-09 Dataset streaming and tokenization (#11, partial).
- TS-P0-10 Logit lens (#14, yes).
- TS-P0-11 Tuned lens (#15, yes).
- TS-P0-12 Direct logit attribution (#16, partial).
- TS-P0-13 Activation patching (#17, yes).
- TS-P0-14 Linear probes with a split (#25, yes).
- TS-P0-15 Attention pattern viewer (#30, partial).
- TS-P0-16 Neuron activation viewer (#32, partial).
- TS-P0-17 Feature dashboards (#33, partial).
- TS-P0-18 SAE training ReLU/TopK/JumpReLU (#34, yes).
- TS-P0-19 SAE eval metrics (#35, partial).
- TS-P0-20 CAA steering (#41, yes).
- TS-P0-21 ActAdd (#42, yes).
- TS-P0-22 Ablation sweeps zero/mean/resample (#44, partial).
- TS-P0-23 Experiment tracker (#46, yes).
- TS-P0-24 Artifact versioning (#47, partial).
- TS-P0-25 Run comparison (#49, partial).
- TS-P0-26 Checkpoint resume (#53, partial).
- TS-P0-27 Grad accumulation and clipping (#54, partial).
- TS-P0-28 LR schedulers and warmup (#55, partial).
- TS-P0-29 Tiny-model recipes (#57, yes).
- TS-P0-30 Benchmark harness (#61, no).
- TS-P0-31 Held-out perplexity (#63, yes).
- TS-P0-32 Stats tests and CIs (#68, partial).
- TS-P0-33 Random and shuffled controls (#69, yes).
- TS-P0-34 Notebook integration (#71, partial).
- TS-P0-35 Prompt playground with token probs (#72, partial).
- TS-P0-36 Token probability heatmap (#73, partial).
- TS-P0-37 Per-layer profiler, FLOPs and latency (#80, partial).
- TS-P0-38 Hub download and caching (#83, partial).
- TS-P0-39 CLI for all experiments (#86, partial).
- TS-P0-40 Hook tests against a reference (#88, partial).
- TS-P0-41 Golden-output regression tests (#89, partial).
- TS-P0-42 Head-ablation importance table (#98, partial).
- TS-P0-43 Safetensors IO (#100, partial).

Research tracks. Hypothesis, metric, ladder, and dependencies are in `docs/engineering/RESEARCH_TRACKS.md`. None of these are implemented as specified.

- RT-01 Model surgery and stitching.
- RT-02 Circuit discovery with a random-ablation check.
- RT-03 Training microscope, every step.
- RT-04 Diff before and after fine-tune.
- RT-05 Steering dose-response and side effects.
- RT-06 ROME ripple tests, then MEMIT only if ROME fails paraphrases.
- RT-07 Superposition toy model against the random cosine baseline.
- RT-08 int8 versus int4, magnitude prune versus random prune.
- RT-09 Merge of two fine-tunes, then debate entropy.
- RT-10 Self-modification sandbox, accept only if held-out loss drops.
- RT-11 Effective-rank scaling across 1M, 3M, 8M.
- RT-12 SAE feature browser over a real trained feature.
- RT-13 Crosscoder 3M against 8M, versus a shuffled pairing.
- RT-14 Activation cosine across training checkpoints.
- RT-15 Attention sinks and a repeated massive residual coordinate.
- RT-16 Cross-lingual numeral direction. English TinyStories is the expected miss.
- RT-17 Truth probe versus majority baseline.
- RT-18 Canaries versus unseen nonsense strings.
- RT-19 Influence of one training document, 1M only.
- RT-20 One residual dimension versus a position shift.
- RT-21 Planted trigger `⟦z⟧` → `xyzzy`, detector rank.
- RT-22 ELK-style probe after partialing out the output bit.
- RT-23 Chain-of-thought truncation versus a random suffix.
- RT-24 Sandbagging prompt on modular addition.
- RT-25 Distillation KL and CKA, 8M teacher, 1M student.
- RT-26 Othello board probe on a toy net.
- RT-27 Fourier ratio of the modular-addition net at the grokking step.
- RT-28 Lottery ticket at 20% sparsity, 1M.
- RT-29 Dead MLP neurons and their output-column norms.
- RT-30 Forgetting versus replay on a frozen holdout.
- RT-31 Loss spikes versus gradient norm, from-scratch 1M.
- RT-32 Nested MoE expert share and mask cost.
- RT-33 Leading-space tokenization versus the other TinyStories tokenizer.
- RT-34 Temperature and top-p versus greedy distinct-1.
- RT-35 Bit-flip KL versus the CMOS noise margin. The voltage model must not be asked to predict the KL order unless a pre-registration says so.
- RT-36 Research autopilot. Calls only `src/agent` tools. Report table must match a replay. Not built here.

Also later, and not research tracks:

- UMAP and t-SNE of the residual stream. No tested implementation in the tree.
- Live loss-landscape slices and integrated-gradient heatmaps inside a new panel. The legacy LAND and GRADIENTS tabs remain.
- Per-op flame chart and a FLOP counter.
- W&B-style remote queue beyond the `NEURALESE_VPS_URL` POST. Unset URL must keep failing closed.

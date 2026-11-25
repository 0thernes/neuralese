# Audit index

Coverage record for the hardening audit on `cursor/never-subtract-features-54d2`. A file is **reviewed** only after a pass in [`AUDIT_LOG.md`](AUDIT_LOG.md) reads it. **Indexed** means the file is in this table and has not been reviewed yet. Nothing here is a claim that the file is correct.

| | |
|---|---|
| Files | 505 |
| Reviewed (passes 23–51) | 129 |
| Indexed, not reviewed | 376 |
| Coverage | 25.5% |


## `/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `.gitignore` | file | repo root | none mapped | reviewed, passes 31–36 |
| `AUDIT.md` | documentation | repo root | none mapped | reviewed, passes 31–36 |
| `CONTRIBUTING.md` | documentation | repo root | none mapped | reviewed, passes 31–36 |
| `PARITY.md` | documentation | repo root | none mapped | reviewed, passes 31–36 |
| `README.md` | documentation | repo root | none mapped | reviewed, passes 31–36 |
| `RELEASE_NOTES.md` | documentation | repo root | none mapped | reviewed, passes 31–36 |
| `V16_PROGRESS.md` | documentation | repo root | none mapped | reviewed, passes 41–42 |
| `V17_1_PROGRESS.md` | documentation | repo root | none mapped | reviewed, passes 39–40 |
| `V17_2_PROGRESS.md` | documentation | repo root | none mapped | reviewed, passes 39–40 |
| `V17_3_PROGRESS.md` | documentation | repo root | none mapped | reviewed, passes 39–40 |
| `V17_PROGRESS.md` | documentation | repo root | none mapped | reviewed, passes 39–40 |
| `capacitor.config.json` | json | repo root | none mapped | reviewed, passes 31–36 |
| `eslint.config.js` | flat config: recommended correctness rules only (style is not enforced); vendored three.js is excluded. | repo root | none mapped | reviewed, passes 31–36 |
| `features.json` | json | repo root | none mapped | indexed |
| `package-lock.json` | json | repo root | none mapped | indexed |
| `package.json` | json | repo root | none mapped | reviewed, passes 23–30 |
| `playwright.config.mjs` | mjs | repo root | none mapped | reviewed, passes 31–36 |

## `.github/workflows/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `pages.yml` | yml | ci | none mapped | reviewed, passes 31–36 |
| `release.yml` | yml | ci | none mapped | reviewed, passes 31–36 |

## `desktop/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `.gitignore` | file | electron | none mapped | reviewed, passes 41–42 |
| `main.cjs` | Electron desktop shell. Serves the bundled web app from app://local/ (a privileged, secure custom scheme) so f | electron | none mapped | reviewed, passes 23–30 |
| `package-lock.json` | json | electron | none mapped | indexed |
| `package.json` | json | electron | none mapped | reviewed, passes 41–42 |
| `prep.cjs` | Builds www/ for packaging from the repo root with the same file set as gh-pages (tools/build-www.mjs). | electron | none mapped | reviewed, passes 31–36 |
| `safe-path.cjs` | Resolve a request path under the app root. Bad escapes and odd encodings are rejected. | electron | test/desktop-path.test.mjs | reviewed, passes 23–30 |
| `smoke.cjs` | Desktop smoke: launch the packaged app (linux-unpacked) with a CDP port, wait for the web app to finish loadin | electron | none mapped | reviewed, passes 31–36 |

## `docs/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `ADVERSARY.md` | documentation | docs | none mapped | reviewed, passes 41–42 |
| `BIBLE.md` | documentation | docs | none mapped | indexed |
| `CLAIMS-v14.md` | documentation | docs | none mapped | reviewed, passes 41–42 |
| `CLAIMS-v14x.md` | documentation | docs | none mapped | reviewed, passes 41–42 |
| `CLAIMS.md` | documentation | docs | none mapped | reviewed, passes 39–40 |
| `COURSE.md` | documentation | docs | none mapped | indexed |
| `DEEP_WALKTHROUGH.md` | documentation | docs | none mapped | indexed |
| `FRONTIER.md` | documentation | docs | none mapped | reviewed, passes 43–44 |
| `GLOSSARY.md` | documentation | docs | none mapped | indexed |
| `KANBAN.md` | documentation | docs | none mapped | indexed |
| `NEST_CPU.md` | documentation | docs | none mapped | reviewed, passes 47–49 |
| `NEURON_LENS_METHOD.md` | documentation | docs | none mapped | reviewed, passes 43–44 |
| `PREREG-v11.md` | documentation | docs | none mapped | reviewed, passes 47–49 |
| `PREREG-v14.md` | documentation | docs | none mapped | reviewed, passes 41–42 |
| `PREREG-v14x.md` | documentation | docs | none mapped | reviewed, passes 47–49 |
| `REPORT-v14.md` | documentation | docs | none mapped | reviewed, passes 41–42 |
| `ROADMAP-v12.md` | documentation | docs | none mapped | indexed |
| `ROADMAP-v14.md` | documentation | docs | none mapped | reviewed, passes 41–42 |
| `STACK.md` | documentation | docs | none mapped | reviewed, passes 41–42 |
| `STEERING_GUIDE.md` | documentation | docs | none mapped | reviewed, passes 47–49 |
| `TSOTCHKE.md` | documentation | docs | none mapped | indexed |
| `WEIGHT_MACHINE.md` | documentation | docs | none mapped | reviewed, passes 47–49 |
| `prereg.schema.json` | json | docs | none mapped | indexed |

## `docs/engineering/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `AUDIT_INDEX.md` | documentation | docs | none mapped | reviewed, passes 23–30 |
| `AUDIT_LOG.md` | documentation | docs | none mapped | reviewed, passes 23–30 |
| `BUGS.md` | documentation | docs | none mapped | reviewed, passes 43–44 |
| `FEATURE_PARITY.md` | documentation | docs | none mapped | reviewed, passes 43–44 |
| `PASSES.md` | documentation | docs | none mapped | reviewed, passes 23–30 |
| `RESEARCH_TRACKS.md` | documentation | docs | none mapped | indexed |
| `SOP.md` | documentation | docs | none mapped | reviewed, passes 41–42 |
| `WANDB_PARITY.md` | documentation | docs | none mapped | reviewed, passes 47–49 |

## `docs/progress/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `V12_PROGRESS.md` | documentation | docs | none mapped | reviewed, passes 47–49 |
| `V13_PROGRESS.md` | documentation | docs | none mapped | reviewed, passes 47–49 |
| `V14_PROGRESS.md` | documentation | docs | none mapped | reviewed, passes 47–49 |
| `V15_2_PROGRESS.md` | documentation | docs | none mapped | reviewed, passes 47–49 |
| `V15_PROGRESS.md` | documentation | docs | none mapped | reviewed, passes 47–49 |

## `docs/roadmap/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `FRONTIER_100.md` | documentation | docs | none mapped | reviewed, passes 47–49 |
| `README.md` | documentation | docs | none mapped | reviewed, passes 47–49 |
| `TABLE_STAKES_100.md` | documentation | docs | none mapped | indexed |

## `features/releases/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `v12.1.0.json` | json | repo root | test/features.test.mjs | indexed |
| `v13.0.1.json` | json | repo root | test/features.test.mjs | indexed |
| `v14.0.0.json` | json | repo root | test/features.test.mjs | indexed |
| `v14.9.0.json` | json | repo root | test/features.test.mjs | indexed |
| `v15.3.0.json` | json | repo root | test/features.test.mjs | indexed |
| `v16.0.1.json` | json | repo root | test/features.test.mjs | indexed |
| `v17.0.0.json` | json | repo root | test/features.test.mjs | indexed |
| `v17.1.0.json` | json | repo root | test/features.test.mjs | indexed |
| `v17.2.0.json` | json | repo root | test/features.test.mjs | indexed |
| `v17.3.0.json` | json | repo root | test/features.test.mjs | indexed |

## `src/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `analysis.js` | Interpretability toolkit: corpus statistics, logit/tuned lens, DLA, activation & path patching, control vector | lab core | none mapped | reviewed, passes 31–36 |
| `analytics.js` | Small spectral and scoring helpers. Tested against hand-computed values in test/analytics.test.mjs. | lab core | test/analytics.test.mjs | reviewed, passes 23–30 |
| `app.js` | NEURALESE v2 — UI wiring. All numerics live in engine/analysis/surgery/decode/sae/rome (unit-tested vs PyTorch | lab core | none mapped | reviewed, passes 23–30 |
| `audio.js` | NEURALESE audio: calm, data-driven lab-instrument sonification (Web Audio). Everything is synthesized; no samp | lab core | test/audio.test.mjs | reviewed, passes 23–30 |
| `build.json` | json | lab core | none mapped | indexed |
| `bytes.js` | Copy byte chunks without one set() of the whole buffer. | lab core | test/audit-hardening.test.mjs | reviewed, passes 23–30 |
| `charts.js` | Canvas charts (v15): HiDPI, axes + gridlines + nice ticks, legends, colorbars, perceptual colormaps, hover cro | lab core | test/audit-hardening.test.mjs | reviewed, passes 23–30 |
| `cli.mjs` | !/usr/bin/env node | lab core | none mapped | reviewed, passes 31–36 |
| `coop.js` | Keep a long compute off a single animation frame. slice() returns a promise only when 32ms | lab core | none mapped | reviewed, passes 31–36 |
| `corpus.js` | Reference corpus: 40 stories sampled from clean TinyStories-8M (T=0.8, top-k 40, seed 7), 2558 tokens. | lab core | none mapped | reviewed, passes 31–36 |
| `dataset.js` | shared dataset: built-in TinyStories-style corpus, or a user-uploaded corpus used by every docs-based tool. | lab core | none mapped | reviewed, passes 31–36 |
| `decode.js` | Decoding: logit processors, samplers, contrastive decoding, CFG, beam search. | lab core | none mapped | reviewed, passes 31–36 |
| `drill.js` | Drill-down hierarchy: model → layer → sublayer → matrix → unit (head / neuron) → row/col → weight. | lab core | none mapped | reviewed, passes 31–36 |
| `engine-client.js` | v15.3 main-thread client for engine-worker.js. RemoteEngine mirrors the Engine calls used by generation, but a | lab core | none mapped | reviewed, passes 39–40 |
| `engine-worker.js` | v15.3 engine worker: runs the GPT-Neo forward pass (Engine) off the UI thread. Protocol (all messages {id, op, | lab core | none mapped | reviewed, passes 31–36 |
| `engine.js` | NEURALESE engine: GPT-Neo forward pass with a full intervention/hook system. | lab core | test/engine-kv.test.mjs | reviewed, passes 37–38 |
| `export-worker.js` | Chart CSV/PNG assembly off the main thread. The page posts small strings or bitmaps. | lab core | none mapped | reviewed, passes 23–30 |
| `gpu.js` | WebGPU compute backend: matrix–vector / matrix–matrix products in WGSL (f32), with CPU fallback and a verifica | lab core | none mapped | reviewed, passes 31–36 |
| `grad.js` | Analytic reverse-mode autodiff for GPT-Neo (TinyStories-8M family): full-sequence forward with stored activati | lab core | test/grad.test.mjs | reviewed, passes 23–30 |
| `guide.js` | v12.1 guided path through the 65 tabs: ten stops that build on each other, each with one concrete thing to try | lab core | none mapped | reviewed, passes 31–36 |
| `heavy.js` | Jobs the engine worker runs so the page thread only paints progress. | lab core | none mapped | reviewed, passes 31–36 |
| `hero.js` | v15.1 overview hero: a stylised 3D network (8 layer rings × 16 instanced head nodes + MLP dust, sparse inter-l | lab core | none mapped | reviewed, passes 39–40 |
| `index.html` | html | lab core | none mapped | indexed |
| `lab-eval.js` | EVALUATE group: token timeline, calibration, edit impact, profiler, experiment tracker. | lab core | none mapped | reviewed, passes 31–36 |
| `lab-frontier.js` | v11 FRONTIER group — consciousness-science proxies, introspection, a self-improvement loop, grokking and a com | lab core | none mapped | reviewed, passes 37–38 |
| `lab-hub.js` | v12 HUB group — a model hub on transformers.js (pinned 4.3.1, hash-checked, ONNX Runtime Web, in a Web Worker) | lab core | none mapped | reviewed, passes 39–40 |
| `lab-interpret.js` | INTERPRET group: attention grid/rollout/head classes, residual geometry, circuit graph, neuron atlas, embeddin | lab core | none mapped | indexed |
| `lab-intervene.js` | INTERVENE/RUN extras: parameter sweeps, batch experiments, advanced steering controls (all act on the real eng | lab core | none mapped | reviewed, passes 39–40 |
| `lab-lens.js` | v14 NEURON LENS group: browsable, searchable DB of every TinyStories-8M MLP neuron and attention head read thr | lab core | none mapped | indexed |
| `lab-model.js` | MODEL group: architecture schematic, parameter/FLOP breakdown, weight statistics (live tensors). | lab core | none mapped | reviewed, passes 39–40 |
| `lab-nested.js` | v14.7 / v14.8 NESTED group: a RISC-V CPU baked into transformer weights, a language model baked into a languag | lab core | none mapped | indexed |
| `lab-research.js` | v7 RESEARCH group: reproducibility (hashes, manifests, replay), hypothesis tests, ACDC-style circuit discovery | lab core | none mapped | reviewed, passes 47–49 |
| `lab-science.js` | v6 SCIENCE group: drill-down inspector, gradients & attribution, head circuits, representation geometry, loss  | lab core | none mapped | reviewed, passes 37–38 |
| `lab-tsotchke.js` | v8 TSOTCHKE group — components that genuinely use the open-source work of Tsotchke (github.com/tsotchke, MIT): | lab core | none mapped | reviewed, passes 23–30 |
| `lab-ui.js` | Shared helpers for the v5 research tabs (markup builders, export, run tracker). | lab core | test/audit-hardening.test.mjs | reviewed, passes 23–30 |
| `lab-v16.js` | v16 tabs: HUB interpretability (logit lens / CLIP embedding lens, attention rollout, linear probes on ViT, CLI | lab core | none mapped | indexed |
| `labcore.js` | NEURALESE lab core: pure, testable research computations behind every v5 visualization. | lab core | test/lab.test.mjs | reviewed, passes 37–38 |
| `lens-worker.js` | Neuron Lens in-browser refit: fits one document's R-lens and S-lens on the current weights (same code path as  | lab core | none mapped | reviewed, passes 41–42 |
| `linalg.js` | Small dense linear algebra kit (Float64, row-major unless noted). | lab core | none mapped | reviewed, passes 31–36 |
| `mf-client.js` | Page-side handle for mf-worker.js. The worker runs machine and Forge compute. | lab core | none mapped | reviewed, passes 41–42 |
| `mf-worker.js` | Machine and Forge compute. The page sends a job and renders the plain result. | lab core | none mapped | indexed |
| `model.js` | Tiny GPT-Neo forward pass in plain JS. Weights are mutable Float32Arrays. | lab core | test/core.test.mjs | reviewed, passes 23–30 |
| `nestedlens.js` | Neuralese v14.7 — float32-weight forward pass + finite-difference R-lens for the nested char LMs (guest, emula | lab core | none mapped | reviewed, passes 41–42 |
| `neuronlens.js` | NEURALESE v14 Neuron Lens: R-lens, S-lens and their mid targets for GPT-Neo (TinyStories-8M). | lab core | none mapped | reviewed, passes 39–40 |
| `notebook-worker.js` | Notebook cells run here, not on the page. They get the research functions and a copy of the | lab core | none mapped | indexed |
| `post.js` | v15.1 post-processing chain (no addons): scene → half-float MSAA target with depth; bloom = soft-threshold bri | lab core | none mapped | reviewed, passes 31–36 |
| `prereg.js` | v16 enforced pre-registration. A run is described by a JSON document that must validate against PREREG_SCHEMA, | lab core | none mapped | reviewed, passes 31–36 |
| `provenance.js` | v12.1: provenance banners. Every panel that shows results says where they come from, so stored author results  | lab core | none mapped | reviewed, passes 31–36 |
| `research.js` | v7 research core (DOM-free, tested in Node): hypothesis tests, ACDC-style circuit discovery, causal scrubbing- | lab core | test/research.test.mjs | reviewed, passes 23–30 |
| `rome.js` | ROME-style rank-one fact edit on an MLP output matrix (c_proj). | lab core | none mapped | reviewed, passes 31–36 |
| `sae.js` | Sparse autoencoder trained in-browser on residual activations (ReLU SAE, L1 penalty, unit-norm decoder, Adam). | lab core | none mapped | reviewed, passes 31–36 |
| `science.js` | Quantitative analyses for NEURALESE v6. Every function is deterministic given a seed and documented with its d | lab core | test/science.test.mjs | reviewed, passes 23–30 |
| `style.css` | gl{position: | lab core | none mapped | indexed |
| `surgery.js` | Weight surgery: a replayable list of edit ops applied to a fresh copy of the original weights. | lab core | none mapped | reviewed, passes 31–36 |
| `term-util.js` | js | lab core | none mapped | reviewed, passes 39–40 |
| `term.js` | In-app terminal: a small, safe command language over the real app API (no eval). Shared by the batch runner. | lab core | none mapped | reviewed, passes 31–36 |
| `tokenizer.js` | Minimal GPT-2 byte-level BPE tokenizer (vocab.json + merges.txt) | lab core | test/audit-hardening.test.mjs | reviewed, passes 23–30 |
| `trace-remote.js` | The page binds the engine worker here. Lab tools call steppedRun, which uses it when present. | lab core | none mapped | reviewed, passes 31–36 |
| `ui15.js` | v15.1 front-end layer: inline SVG icon set, per-section accent colours, overview dashboard (live stats + hero  | lab core | none mapped | indexed |
| `ui152.js` | v15.2 polish helpers (original Neuralese code): GPU tiering for the 3D default quality, persisted adaptive qua | lab core | none mapped | indexed |
| `v5.js` | v5 shell: grouped tabs, module install, theme, resizable dock, export bar, shortcuts, terminal + learning cent | lab core | none mapped | indexed |
| `viz.js` | 3D view: layer stack (heads, neurons, residual stream) + real weight matrix as height-field / point cloud. | lab core | none mapped | indexed |
| `viz3d.js` | v6 3D modes on top of the base Viz scene: weight voxel field (instanced + LOD), loss surface, residual manifol | lab core | none mapped | indexed |
| `zoo.js` | Model zoo: other TinyStories GPT-Neo checkpoints (same tokenizer, same 8-layer local/global layout), loaded by | lab core | none mapped | reviewed, passes 31–36 |

## `src/adversary/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `campaign.js` | Condition runner: equal-length system prompts, dual-phase key geometry, FWL, logistic AUROC. | adversary | none mapped | indexed |
| `geometry.js` | Key-cache geometry (Lyra Technique, Edrington, Watson & Wilkes, Liberation Labs, 2026). | adversary | none mapped | indexed |
| `measured-tinystories.json` | json | adversary | none mapped | indexed |
| `neurons.js` | MLP-unit search and a steering-vs-random comparison. | adversary | none mapped | indexed |
| `prereg.js` | Adversary Lab pre-registration. Separate from src/prereg.js, whose schema rejects extra fields. | adversary | none mapped | indexed |
| `prompts.d.ts` | ts | adversary | none mapped | reviewed, passes 50–51 |
| `prompts.js` | Same-user-prompt bank. Only the system string changes. Length is equalized by appending a | adversary | none mapped | indexed |

## `src/agent/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `launch.js` | Local experiment launcher. Remote is optional and never invents a result. | agent | none mapped | indexed |
| `mcp.js` | Line-delimited JSON-RPC for the tools an agent needs. Not a multi-user server. | agent | none mapped | indexed |
| `schema.js` | Solo, local-first lab store. No orgs, roles, approvals, or shared registries. | agent | none mapped | indexed |
| `tools.js` | Tool handlers an agent calls. Reads do not invent runs. Mutations log the experiment | agent | none mapped | reviewed, passes 31–36 |

## `src/arch/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `arch.js` | v16 Arch interface: one decoder-only transformer forward for several HF families, replacing the single hard-wi | arch | none mapped | indexed |
| `encoder-worker.js` | v16 HUB interpretability worker: loads a revision-pinned HF safetensors checkpoint (ViT, CLIP vision tower, Wh | arch | none mapped | indexed |
| `encoder.js` | v16 encoder forwards for the HUB families, written from the HF reference implementations so that hidden states | arch | none mapped | indexed |
| `remote.js` | v16: read only the tensors you need from a remote .safetensors with HTTP Range requests (e.g. the CLIP vision  | arch | none mapped | indexed |

## `src/forge/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `bits.js` | Binary gadgets for the Forge weight engine. | forge | none mapped | indexed |
| `cells.d.ts` | ts | forge | none mapped | indexed |
| `cells.js` | Frozen arithmetic cells for the WeightCPU / MDCC comparison. | forge | none mapped | indexed |
| `engine.d.ts` | ts | forge | none mapped | indexed |
| `engine.js` | Weight-constructed Forge engine. One step is one clock: fetch, decode, ALU, writeback. | forge | none mapped | indexed |
| `host.d.ts` | ts | forge | none mapped | indexed |
| `host.js` | Host attachment. The Forge subspace is a separate 64-wide stamp. | forge | none mapped | indexed |
| `isa.js` | ForgeISA/1 — Neuralese-original machine. Not a port of any published weight-baked CPU. | forge | none mapped | indexed |
| `mdcc.js` | MDCC lane: a deterministic proposer reads the task string, then the host computes with bigint. | forge | none mapped | indexed |
| `nestlang.js` | NestLang/1 — Neuralese-original surface language for ForgeISA. | forge | none mapped | indexed |
| `session.d.ts` | ts | forge | none mapped | indexed |
| `session.js` | One Forge run: language-model tokens, then the delimiter, then one engine token group per clock. | forge | none mapped | indexed |
| `vm.js` | Integer reference VM for ForgeISA/1. Ground truth. Words are int32. No float rounding. | forge | none mapped | indexed |

## `src/frontier/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `cites.js` | v11 FRONTIER citations. Every entry was checked against its arXiv abstract page or its DOI record (Crossref) o | frontier | none mapped | indexed |
| `core.js` | v11 FRONTIER shared core: null models, cross-entropy, statistics, LZ76 complexity. Pure ES module (Node + brow | frontier | none mapped | indexed |
| `grok.js` | v11 P5: grokking on a + b mod p (Power et al. 2022; MLP construction after Gromov 2023), trainable in the brow | frontier | none mapped | reviewed, passes 37–38 |
| `mind.js` | v11 consciousness-science PROXIES (operational definitions only — see docs/FRONTIER.md for what they cannot sh | frontier | none mapped | indexed |
| `rsi.js` | v11 P4: a closed self-improvement loop on TinyStories-8M. Editable θ = ln_f gain/bias (512) + output gains γ o | frontier | none mapped | indexed |

## `src/frontier/data/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `PREREG-v11.md` | documentation | frontier | none mapped | indexed |
| `atlas.json` | shipped numeric result or fixture | frontier | none mapped | indexed |
| `concepts.json` | shipped numeric result or fixture | frontier | none mapped | indexed |
| `grok.json` | shipped numeric result or fixture | frontier | none mapped | indexed |
| `p1.json` | shipped numeric result or fixture | frontier | none mapped | indexed |
| `p2.json` | shipped numeric result or fixture | frontier | none mapped | indexed |
| `p3a.json` | shipped numeric result or fixture | frontier | none mapped | indexed |
| `p3b.json` | shipped numeric result or fixture | frontier | none mapped | indexed |
| `prereg.json` | shipped numeric result or fixture | frontier | none mapped | indexed |
| `rsi-distill.json` | shipped numeric result or fixture | frontier | none mapped | indexed |
| `rsi-loop.json` | shipped numeric result or fixture | frontier | none mapped | indexed |
| `rsi-ttt.json` | shipped numeric result or fixture | frontier | none mapped | indexed |
| `scorecard.json` | shipped numeric result or fixture | frontier | none mapped | indexed |

## `src/gpu/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `webgpu-engine.js` | v16 WebGPU forward path (WGSL) for the GPT-Neo-8M engine — the clean path only: default runtime R, no hooks, s | gpu | none mapped | indexed |

## `src/hub/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `finetune.js` | v12 in-browser fine-tuning of TinyStories-8M on the user's own text. Honest scope: parameter-efficient, 1,536  | hub | none mapped | indexed |
| `ft-worker.js` | v12: runs the fine-tune off the main thread (the exact-gradient loop costs ~10 s per Adam step on CPU). | hub | none mapped | reviewed, passes 50–51 |
| `models.js` | v12 MODEL HUB registry. Every entry is a real, public ONNX repo on the Hugging Face Hub, run by transformers.j | hub | none mapped | reviewed, passes 39–40 |
| `worker.js` | v12 MODEL HUB worker: runs transformers.js pipelines off the main thread. Messages: {id, op:'load'/'run'/'info | hub | none mapped | indexed |

## `src/hub/vendor/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `LICENSE-transformers.txt` | txt | hub | none mapped | indexed |
| `ort-wasm-simd-threaded.jsep.mjs` | mjs | hub | none mapped | indexed |

## `src/learn/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `bible.js` | The Bible: reference manual, one section per area/tab. Plain data so docs/*.md can be generated from it. | learn | none mapped | indexed |
| `course.js` | Course: beginner → advanced. Each lesson = lecture (markdown-lite), diagram (SVG), hands-on lab (terminal comm | learn | none mapped | indexed |
| `glossary.js` | Glossary: [term, definition, related terms]. Source of truth for the in-app glossary and docs/GLOSSARY.md. | learn | none mapped | indexed |
| `learn.js` | Learning center UI: Bible, Glossary, Index, Course (lectures, diagrams, labs, quizzes). Progress in localStora | learn | none mapped | indexed |

## `src/lens/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `v14x-c1.json` | json | lens | none mapped | indexed |
| `v14x-match.json` | json | lens | none mapped | indexed |
| `v14x-splithalf.json` | json | lens | none mapped | indexed |

## `src/lens/ext/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `ATTRIBUTION.md` | documentation | lens | none mapped | indexed |
| `neuron-lens-sample.json` | json | lens | none mapped | indexed |

## `src/lens/ts1m/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `drivers.json` | json | lens | none mapped | indexed |
| `lenses.f32` | f32 | lens | none mapped | indexed |
| `manifest.json` | json | lens | none mapped | indexed |
| `v14x-browserfit.json` | json | lens | none mapped | indexed |
| `validation.json` | json | lens | none mapped | indexed |

## `src/lens/ts3m/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `drivers.json` | json | lens | none mapped | indexed |
| `lenses.f32` | f32 | lens | none mapped | indexed |
| `manifest.json` | json | lens | none mapped | indexed |
| `validation.json` | json | lens | none mapped | indexed |

## `src/lens/ts8m/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `db-manifest.json` | json | lens | none mapped | indexed |
| `drivers.json` | json | lens | none mapped | indexed |
| `lenses.f32` | f32 | lens | none mapped | indexed |
| `manifest.json` | json | lens | none mapped | indexed |
| `v14x-heads.json` | json | lens | none mapped | indexed |
| `v14x-labels.json` | json | lens | none mapped | indexed |
| `v14x-sae.json` | json | lens | none mapped | indexed |
| `v14x-taylor-delta0.01-exploratory.json` | json | lens | none mapped | indexed |
| `v14x-taylor.json` | json | lens | none mapped | indexed |
| `v14x-testA64.json` | json | lens | none mapped | indexed |
| `validation.json` | json | lens | none mapped | indexed |

## `src/lens/ts8m/db/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `L0.json` | json | lens | none mapped | indexed |
| `L1.json` | json | lens | none mapped | indexed |
| `L2.json` | json | lens | none mapped | indexed |
| `L3.json` | json | lens | none mapped | indexed |
| `L4.json` | json | lens | none mapped | indexed |
| `L5.json` | json | lens | none mapped | indexed |
| `L6.json` | json | lens | none mapped | indexed |
| `L7.json` | json | lens | none mapped | indexed |
| `tokens.json` | json | lens | none mapped | indexed |

## `src/machine/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `gadget.js` | Weight gadgets. A gadget is a fixed net of linear combinations, ReLU gates, and hard attention. | machine | none mapped | indexed |
| `isa.js` | Weight-Machine / WM-ISA. ForgeISA/1 plus a SYS opcode for the devices around it. | machine | none mapped | indexed |
| `machine.d.ts` | ts | machine | none mapped | indexed |
| `machine.js` | Host stepper. The weight machine and the int32 reference run the same program. | machine | none mapped | indexed |
| `programs.js` | Demo programs for WM-ISA. They are assembled here, not borrowed from another machine. | machine | none mapped | indexed |
| `ref.js` | Integer reference machine. Ground truth for Weight-Machine. Words are int32. No float rounding. | machine | none mapped | indexed |
| `weight.js` | Weight-Machine datapath. Same phase order as ref.js. ALU, memory, MAC, lanes, grant, and | machine | none mapped | indexed |
| `zoom.js` | Deep Walk chain for one Weight-Machine component: gadget weights, then a Boolean | machine | none mapped | indexed |

## `src/nested/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `v14x-nested.json` | json | nested | none mapped | indexed |

## `src/nested/moe/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `index.html` | html | nested | none mapped | indexed |
| `routing.json` | json | nested | none mapped | indexed |

## `src/nested/riscv/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `cpu.js` | Browser/Node runtime for the hand-compiled RV32I transformer (artifacts/riscv_spec.json). | nested | none mapped | indexed |
| `index.html` | html | nested | none mapped | indexed |
| `programs.json` | json | nested | none mapped | indexed |
| `ref.js` | Independent JS reference interpreter (same machine model as e1_riscv/rv.py) used ONLY for the live agreement b | nested | none mapped | indexed |
| `riscv_spec.json` | json | nested | none mapped | indexed |

## `src/nested/shared/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `iso.js` | Tiny original isometric renderer: stacked layer slabs with glowing cells (no external libs). | nested | none mapped | indexed |
| `lab.css` | css | nested | none mapped | indexed |

## `src/nested/slm/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `index.html` | html | nested | none mapped | indexed |
| `lens.json` | json | nested | none mapped | indexed |
| `lm.js` | Norm-free causal transformer forward pass (Float64), mirrors e2_slm/model.py. Returns logits + residual of las | nested | none mapped | indexed |
| `models.f32` | f32 | nested | none mapped | indexed |
| `models.index.json` | json | nested | none mapped | indexed |

## `src/shell/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `shell.css` | ! tailwindcss v4.3.3 / MIT License / https://tailwindcss.com | ui shell build | none mapped | indexed |
| `shell.js` | js | ui shell build | none mapped | reviewed, passes 23–30 |

## `src/shell/chunks/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `cosmos-Bnq9Z3e3.js` | js | ui shell build | none mapped | indexed |
| `machine-mpNBL3kO.js` | js | ui shell build | none mapped | indexed |
| `nested-BqQujNrg.js` | js | ui shell build | none mapped | indexed |
| `stage-CI8fgHFM.js` | js | ui shell build | none mapped | reviewed, passes 23–30 |
| `three.core-Ddzflq5I.js` | js | ui shell build | none mapped | indexed |
| `walk-ByIfsdVf.js` | js | ui shell build | none mapped | indexed |

## `src/tsotchke/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `ARTIFACTS.sha256` | sha256 | tsotchke | none mapped | indexed |
| `LICENSE-eshkol` | file | tsotchke | none mapped | indexed |
| `LICENSE-qgtl` | file | tsotchke | none mapped | indexed |
| `LICENSE-quantum_rng` | file | tsotchke | none mapped | indexed |
| `adcheck.js` | Tiny GPT-Neo config + seeded weights shared by the Eshkol AD cross-check (tools/eshkol-ad-crosscheck.mjs write | tsotchke | none mapped | indexed |
| `eshkol_types.mjs` | mjs | tsotchke | none mapped | indexed |
| `eshkol_types.wasm.b64` | b64 | tsotchke | none mapped | indexed |
| `geometry.js` | Information geometry of next-token distributions, after the quantum geometric tensor of tsotchke/quantum_geome | tsotchke | none mapped | indexed |
| `moonlab_qgt.mjs` | mjs | tsotchke | none mapped | indexed |
| `moonlab_qgt.wasm.b64` | b64 | tsotchke | none mapped | indexed |
| `moonlabqgt.js` | Moonlab's native quantum-geometry module (tsotchke/moonlab@cd3b234, MIT: src/algorithms/quantum_geometry/qgt.c | tsotchke | none mapped | indexed |
| `neurosym.js` | Port of Eshkol's lib/core/ml/neurosymbolic.esk (tsotchke/eshkol@341ac81, MIT): differentiable symbol embedding | tsotchke | none mapped | indexed |
| `nist.js` | NIST SP 800-22 rev1a statistical tests (subset): 2.1 frequency (monobit), 2.2 block frequency, 2.3 runs, | tsotchke | none mapped | indexed |
| `qgtl.js` | QGTL (tsotchke/quantum_geometric_tensor@770994a, MIT) geometric-measure core, compiled to WebAssembly by us | tsotchke | none mapped | indexed |
| `qgtl.mjs` | mjs | tsotchke | none mapped | indexed |
| `qgtl.wasm.b64` | b64 | tsotchke | none mapped | indexed |
| `qrng.js` | Browser/Node wrapper over tsotchke/quantum_rng (commit 1a77e77, MIT, © 2024 Tsotchke) compiled to WebAssembly  | tsotchke | none mapped | indexed |
| `qrng.mjs` | mjs | tsotchke | none mapped | indexed |
| `qrng.wasm.b64` | b64 | tsotchke | none mapped | indexed |
| `taylor.js` | Univariate truncated-Taylor ("jet") arithmetic to order K — a faithful JavaScript port of the recurrence table | tsotchke | none mapped | reviewed, passes 47–49 |
| `types.js` | Type-checks the real NEURALESE computation graph with Eshkol's own compile-time type layer, compiled to WebAss | tsotchke | none mapped | indexed |
| `wasmb64.js` | The deploy pipeline for this site (GitHub contents API via text-only tooling) cannot carry raw binary files, s | tsotchke | none mapped | indexed |

## `src/tsotchke/data/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `eshkol_ad_golden.json` | shipped numeric result or fixture | tsotchke | none mapped | indexed |
| `eshkol_neurosym_golden.txt` | txt | tsotchke | none mapped | indexed |
| `eshkol_taylor_golden.json` | shipped numeric result or fixture | tsotchke | none mapped | indexed |
| `ngvsadam-heldout.json` | shipped numeric result or fixture | tsotchke | none mapped | indexed |
| `ngvsadam.json` | shipped numeric result or fixture | tsotchke | none mapped | indexed |
| `qrng_libm.json` | shipped numeric result or fixture | tsotchke | none mapped | indexed |

## `src/vendor/fonts/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `LICENSE-Inter-OFL.txt` | txt | vendor | none mapped | indexed |
| `LICENSE-JetBrainsMono-OFL.txt` | txt | vendor | none mapped | indexed |
| `inter-var.woff2` | binary asset | vendor | none mapped | indexed |
| `jbmono-var.woff2` | binary asset | vendor | none mapped | indexed |

## `src/vendor/moonlab/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `LICENSE` | file | vendor | none mapped | indexed |
| `PATCHES.md` | documentation | vendor | none mapped | indexed |
| `moonlab-browser.patch` | patch | vendor | none mapped | indexed |
| `package.json` | json | vendor | none mapped | indexed |

## `src/vendor/moonlab/dist/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `chunk-NLN6PXJW.mjs` | src/control-plane.ts | vendor | none mapped | indexed |
| `index.mjs` | mjs | vendor | none mapped | indexed |
| `moonlab.js` | This code implements the `-sMODULARIZE` settings by taking the generated | vendor | none mapped | indexed |
| `moonlab.wasm` | wasm binary | vendor | none mapped | indexed |
| `moonlab.wasm.b64` | b64 | vendor | none mapped | indexed |

## `src/vendor/three/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `three.module.min.js` | js | vendor | none mapped | indexed |

## `src/vendor/three/addons/controls/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `OrbitControls.js` | OrbitControls performs orbiting, dollying (zooming), and panning. | vendor | none mapped | indexed |

## `src/walk/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `archwalk.js` | Walk an Arch forward (src/arch/arch.js) when that model is actually loaded. | walk | none mapped | indexed |
| `bits.js` | IEEE-754 binary32 field view. The engine stores weights and activations as float32. | walk | none mapped | indexed |
| `chapters.d.ts` | ts | walk | none mapped | indexed |
| `chapters.js` | Original narration for the deep walk. The idea of stepping through a transformer as blocks | walk | none mapped | indexed |
| `cmos.d.ts` | ts | walk | none mapped | indexed |
| `cmos.js` | Teaching CMOS model. Square-law Shichman–Hodges (the SPICE level-1 MOSFET), matched | walk | none mapped | indexed |
| `explain.js` | How one recorded cell was computed. The arithmetic matches the engine's loops, including the four-lane matvec. | walk | none mapped | indexed |
| `fault.js` | Real bit faults in a real forward. The mask is deterministic for a fixed seed. | walk | none mapped | indexed |
| `forgealu.d.ts` | ts | walk | none mapped | indexed |
| `forgealu.js` | Lower a ForgeISA arithmetic op to the gate netlist, or say when the op is wiring or memory. | walk | none mapped | indexed |
| `gates.js` | Gate netlist. Every gate is AND, OR, XOR, or NOT, plus constant 0/1 sources. | walk | none mapped | indexed |
| `record.js` | One real forward, with the engine's own tensors copied out. Logits are Engine.matvec on the final hidden state | walk | none mapped | indexed |
| `sample.js` | Display sampling. The stored tensor is complete. The picture shows a capped window and says so. | walk | none mapped | indexed |
| `session.js` | Worker and main-thread entry for a walk. The last session stays here so a cell query can explain it. | walk | none mapped | indexed |

## `src/walk/data/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `dw-fault-1.json` | shipped numeric result or fixture | walk | none mapped | indexed |

## `test/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `_paths.mjs` | v15.3 repo layout: the web app lives in src/. rp('engine.js') → '../src/engine.js'; rp('docs/x.md') → '../docs | tests | self | reviewed, passes 50–51 |
| `adversary.test.mjs` | Adversary Lab: key-cache geometry, FWL, padding, detector, neuron rule, prereg lock. | tests | self | indexed |
| `agent.test.mjs` | mjs | tests | self | indexed |
| `analytics.test.mjs` | mjs | tests | self | indexed |
| `arch.test.mjs` | v16 Arch interface: GPT-Neo, GPT-2 and Llama/Qwen-style blocks match HF transformers (float64 reference, test/ | tests | self | indexed |
| `audio.test.mjs` | mjs | tests | self | indexed |
| `audit-hardening.test.mjs` | mjs | tests | self | reviewed, passes 23–30 |
| `audit-regressions.test.mjs` | v12.1.0 regression tests, one per fix from the 26 Oct 2026 65-tab exploration audit (audit-inputs/codex-65tab- | tests | self | indexed |
| `cli.test.mjs` | mjs | tests | self | reviewed, passes 31–36 |
| `core.test.mjs` | mjs | tests | self | indexed |
| `design-system.test.mjs` | v15 visual overhaul: design tokens, self-hosted fonts with licences, perceptual colormaps, sidebar nav wiring, | tests | self | indexed |
| `desktop-path.test.mjs` | mjs | tests | self | indexed |
| `drill.test.mjs` | mjs | tests | self | indexed |
| `encoder.test.mjs` | v16 HUB-model interpretability: our JS ViT / CLIP-vision / Whisper-encoder forwards reproduce HF (float64) log | tests | self | indexed |
| `engine-kv.test.mjs` | KV-cache correctness: logits from the incremental (KV-cached) engine must equal an independent, cache-free, fu | tests | self | indexed |
| `eshkol-ad.test.mjs` | v10 (d): every weight gradient of site/grad.js's analytic backward pass vs Eshkol's reverse-mode tape | tests | self | indexed |
| `eshkol-taylor.test.mjs` | v10 (b): site/tsotchke/taylor.js vs Eshkol's REAL Taylor kernels (tr_* in lib/core/runtime_taylor.c @341ac81,  | tests | self | indexed |
| `exact.test.mjs` | mjs | tests | self | indexed |
| `features.test.mjs` | mjs | tests | self | reviewed, passes 50–51 |
| `forge.test.mjs` | mjs | tests | self | indexed |
| `frontier.test.mjs` | v11 FRONTIER: statistics code against known values, analytic gradients against finite differences, and every p | tests | self | indexed |
| `grad.test.mjs` | mjs | tests | self | indexed |
| `hott.test.mjs` | v9: Eshkol's compile-time type layer (WASM) checks the real model graph; QGTL (WASM) fidelity cross-checks Moo | tests | self | indexed |
| `hub.test.mjs` | v12 MODEL HUB + fine-tune tests. The in-browser model runs (Whisper, MMS-TTS, MiniLM, TrOCR, CLIP, ViT-GPT2, D | tests | self | indexed |
| `lab-store.test.mjs` | mjs | tests | self | indexed |
| `lab.test.mjs` | mjs | tests | self | indexed |
| `machine.test.mjs` | mjs | tests | self | indexed |
| `neuron-lens.test.mjs` | v14.0.0 Neuron Lens: lens math (vs finite differences of the RelP-patched primal), database integrity, validat | tests | self | indexed |
| `overview-ui.test.mjs` | v15.1 polish: overview dashboard, icon set, accents, shortcut overlay, post-processing chain, arc diagram + to | tests | self | indexed |
| `packaging.test.mjs` | v13.0.0: packaging. One version everywhere; the app bundle (www/) is exactly the gh-pages file set; model pins | tests | self | reviewed, passes 31–36 |
| `prereg-enforced.test.mjs` | v16 enforced pre-registration: schema, hash freeze, commit pinning, REPRO bundle round-trip and tamper detecti | tests | self | indexed |
| `prereg-nested.test.mjs` | v14.1 – v14.9: pre-registration pin, result provenance, nested float32 models + finite-difference lens, head a | tests | self | indexed |
| `release-hygiene.test.mjs` | v16 release hygiene: exact dependency pins, npm ci only, hash-pinned model downloads, Android signing path, ve | tests | self | indexed |
| `repo-layout.test.mjs` | v15.3 repo layout: web root in src/, feature-named suites, no root-level smoke/version files, one copy of each | tests | self | indexed |
| `research.test.mjs` | mjs | tests | self | indexed |
| `science.test.mjs` | mjs | tests | self | reviewed, passes 31–36 |
| `tsotchke-crosscheck.test.mjs` | v10 cross-checks: (a) Fubini–Study vs Moonlab's native qgt_metric_at, (c) the natural-gradient vs Adam artifac | tests | self | indexed |
| `tsotchke.test.mjs` | Claims & Evidence for the Tsotchke-powered components (see docs/CLAIMS.md). Every test here can fail; the | tests | self | indexed |
| `ui-refinement.test.mjs` | v15.2 polish: GPU tiering + quality ladder, theme default, busy/error states, sidebar wrapping, atlas skeleton | tests | self | indexed |
| `walk.test.mjs` | mjs | tests | self | indexed |
| `worker-messages.test.mjs` | mjs | tests | self | indexed |
| `zoo.test.mjs` | mjs | tests | self | reviewed, passes 31–36 |

## `test/e2e/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `attribution.md` | documentation | tests | none mapped | indexed |
| `click-all-output.json` | json | tests | none mapped | indexed |
| `click-all.spec.mjs` | mjs | tests | self | indexed |

## `test/ref/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `ref.json` | json | tests | none mapped | indexed |
| `ref.py` | PyTorch reference for NEURALESE numerical tests (transformers GPTNeo, no TransformerLens available offline). | tests | none mapped | indexed |
| `ref_arch.json` | json | tests | none mapped | indexed |
| `ref_arch.py` | Reference logits for the v16 Arch interface (test/arch.test.mjs). For each small real HF model (local copy und | tests | none mapped | indexed |
| `ref_encoder.json` | json | tests | none mapped | indexed |
| `ref_encoder.py` | Float64 HF references for src/arch/encoder.js (test/encoder.test.mjs). Inputs are deterministic closed-form ar | tests | none mapped | indexed |
| `ref_grad.json` | json | tests | none mapped | indexed |
| `ref_grad.py` | PyTorch autograd reference for grad.js | tests | none mapped | indexed |
| `ref_mel.json` | json | tests | none mapped | indexed |
| `ref_mel.py` | HF WhisperFeatureExtractor reference for whisperLogMel (test/encoder.test.mjs): 2 s chirp + tone, deterministi | tests | none mapped | indexed |
| `ref_sci.json` | json | tests | none mapped | indexed |
| `ref_sci.py` | py | tests | none mapped | indexed |
| `ref_stats.json` | json | tests | none mapped | indexed |
| `ref_taylor.json` | json | tests | none mapped | indexed |
| `ref_taylor.py` | PyTorch reference for the Taylor-jet (Eshkol-style) cross-check in site/tsotchke/taylor.js. | tests | none mapped | indexed |
| `ref_zoo.json` | json | tests | none mapped | indexed |

## `test/smoke/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `_gpu.mjs` | mjs | tests | self | reviewed, passes 50–51 |
| `audio.smoke.mjs` | mjs | tests | self | indexed |
| `audit-regressions.smoke.mjs` | v12.1 smoke at the audit viewport (1240x700): one check per audit fix, screenshots of each, no console errors. | tests | self | indexed |
| `core-ui.smoke.mjs` | mjs | tests | self | indexed |
| `design-system.smoke.mjs` | v15 smoke: every tab renders with 0 console errors at 1440×900, 1240×700 and 390×844; sidebar search/collapse  | tests | self | indexed |
| `engine-worker.smoke.mjs` | v15.3 smoke: generation runs in the engine Web Worker and produces exactly the main-thread (?noworker) tokens; | tests | self | indexed |
| `frontier.smoke.mjs` | v11 smoke: FRONTIER group — every tab renders and loads its data, every live check holds, live grokking and li | tests | self | indexed |
| `hub.smoke.mjs` | v12 smoke: HUB group — each tab renders, every model actually runs in the worker, each self-test meets its thr | tests | self | indexed |
| `lab-quiz.smoke.mjs` | mjs | tests | self | indexed |
| `lab-v5.smoke.mjs` | mjs | tests | self | indexed |
| `neuron-lens.smoke.mjs` | v14 smoke: NEURON LENS tabs load the hash-checked DB, search, open a neuron, steer-test, render validation and | tests | self | indexed |
| `overview-ui.smoke.mjs` | global MouseEvent, PointerEvent | tests | self | indexed |
| `research-leak.smoke.mjs` | v7 smoke: every tab, every RESEARCH tool, CSP violations, leak test (500-token generation + repeated tab cycli | tests | self | indexed |
| `tsotchke-types.smoke.mjs` | v9 smoke: TSOTCHKE group — every tab renders, every live claim holds, WASM (quantum_rng + Moonlab) loads under | tests | self | indexed |
| `tsotchke-v8.smoke.mjs` | v8 smoke: TSOTCHKE group — every tab renders, every live claim holds, WASM (quantum_rng + Moonlab) loads under | tests | self | indexed |
| `tsotchke.smoke.mjs` | v10 smoke: TSOTCHKE group — every tab renders, every live claim holds, WASM (quantum_rng + Moonlab) loads unde | tests | self | indexed |
| `ui-refinement.smoke.mjs` | global MouseEvent, PointerEvent | tests | self | indexed |
| `v16-before.mjs` | mjs | tests | self | indexed |
| `v16.smoke.mjs` | v16 smoke on the built www/ (has build.json): NEW v16 tab renders; WebGPU gate+bench button (SwiftShader softw | tests | self | indexed |
| `v17-workspaces.smoke.mjs` | global CSS, InputEvent | tests | self | indexed |
| `webgpu.smoke.mjs` | v16 smoke: the WGSL forward path passes the logits-match gate against the JS Engine (clean weights, default ru | tests | self | indexed |

## `tools/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `_fload.mjs` | Shared loader for v11 FRONTIER tools: reads the local safetensors (8M, plus 3M/1M from the model zoo). | tooling | none mapped | reviewed, passes 50–51 |
| `a11y.mjs` | WCAG 2 A/AA audit of every tab with axe-core (npm i --no-save axe-core@4; node tools/a11y.mjs [url]). | tooling | none mapped | reviewed, passes 50–51 |
| `adversary-measure.mjs` | One honest TinyStories-8M pass of the Adversary Lab defaults. | tooling | none mapped | indexed |
| `agent.mjs` | Solo agent CLI. Usage: | tooling | none mapped | indexed |
| `bench-engine.mjs` | Engine throughput benchmark (Node, CPU, single thread). Usage: node tools/bench-engine.mjs [engineDir] [nGen] | tooling | none mapped | indexed |
| `build-features.mjs` | Rebuild features.json and features/releases/*.json from the source tree. | tooling | none mapped | indexed |
| `build-www.mjs` | Assembles the deployable web app into www/: exactly the file set served on gh-pages. | tooling | none mapped | reviewed, passes 31–36 |
| `bump-version.mjs` | Sets one version everywhere: package.json, package-lock.json, desktop/package.json, src/term.js, src/index.htm | tooling | none mapped | reviewed, passes 31–36 |
| `check-features.mjs` | Never-subtract gate. Fails if the current manifest drops a feature that any | tooling | none mapped | reviewed, passes 31–36 |
| `eshkol-ad-crosscheck.mjs` | v10 (d): full backward pass of site/grad.js vs Eshkol's reverse-mode tape (wasm/eshkol_ad, build with its buil | tooling | none mapped | indexed |
| `fetch-arch-models.mjs` | v16: downloads the HF checkpoints used by test/arch.test.mjs and test/encoder.test.mjs into model/arch/<name>/ | tooling | none mapped | indexed |
| `fetch-model.mjs` | Downloads the TinyStories weights the tests use into model/ (not in git: ~230 MB) and verifies pinned SHA-256s | tooling | none mapped | reviewed, passes 31–36 |
| `frontier-atlas.mjs` | v11 P6: complete single-unit causal atlas of TinyStories-8M. Exact zero-ablation of all 128 heads and 8192 MLP | tooling | none mapped | indexed |
| `frontier-grok.mjs` | v11 P5: runs the pre-registered grokking config and the weight-decay-0 control. Usage: node tools/frontier-gro | tooling | none mapped | reviewed, passes 50–51 |
| `frontier-mind.mjs` | v11 P1–P3: consciousness-science proxies with null models. Usage: node tools/frontier-mind.mjs <P1/P2/P3a/P3b> | tooling | none mapped | indexed |
| `frontier-rsi.mjs` | v11 P4 (H4a/H4b loop, H4c self-distillation, H4d test-time training). Usage: node tools/frontier-rsi.mjs [loop | tooling | none mapped | indexed |
| `gendocs.mjs` | Generates docs/BIBLE.md, docs/GLOSSARY.md, docs/COURSE.md from the in-app learning data. | tooling | none mapped | indexed |
| `mkcorpus.mjs` | mjs | tooling | none mapped | indexed |
| `nested-convert.mjs` | Convert neuralese-nested's float64 models.json into one Float32 binary + a JSON index (v14.7). Original Neural | tooling | none mapped | reviewed, passes 50–51 |
| `netfail.mjs` | Network-failure check: the first two weight requests fail (HTTP 503, then an aborted connection); the loader m | tooling | none mapped | reviewed, passes 50–51 |
| `ngvsadam.mjs` | v10 (c): natural gradient (Fisher = 4 × Fubini–Study metric of √p) vs Adam, equal step counts, seeded, with 95 | tooling | none mapped | indexed |
| `nlens-common.mjs` | Shared Node helpers for the v14 Neuron Lens pipeline (fit, database, validation). | tooling | none mapped | indexed |
| `nlens-db.mjs` | Builds the Neuron Lens database for TinyStories-8M: every MLP neuron's input/output reads through every lens a | tooling | none mapped | indexed |
| `nlens-fit.mjs` | Fits the R-lens and S-lens (out and mid targets) of TinyStories-8M offline, the neuron-lens recipe | tooling | none mapped | indexed |
| `nlens-validate.mjs` | Pre-registered validation of Neuron Lens reads on TinyStories-8M (docs/PREREG-v14.md; its sha256 is recorded i | tooling | none mapped | indexed |
| `nlens-verdicts.mjs` | Applies the frozen predictions P1–P5 of docs/PREREG-v14.md to validation.json (point estimates, as the prereg  | tooling | none mapped | indexed |
| `prereg-run.mjs` | v16 enforced pre-registered run (Node). Refuses to start unless the pre-registration validates, hashes to the  | tooling | none mapped | indexed |
| `serve.mjs` | Minimal static server for the web root (src/) used by the headless smoke tests and local dev. Usage: node tool | tooling | none mapped | reviewed, passes 31–36 |
| `v14x-browserfit.mjs` | v14.9 C9a — fit the full TS-1M lens in headless Chrome through lens-worker.js and compare with the Node fit (l | tooling | none mapped | indexed |
| `v14x-c1.mjs` | v14.1 C1a / C1c / C2 verdicts from the validation outputs (PREREG-v14x §14.1–14.2). Original Neuralese code. | tooling | none mapped | indexed |
| `v14x-heads.mjs` | v14.3 — lens attribution of attention heads vs zero-ablation ground truth (PREREG-v14x §14.3). Original Neural | tooling | none mapped | indexed |
| `v14x-labels.mjs` | v14.4 — auto-labels from S.mid reads, scored against exact drivers, with a calibrated confidence (PREREG-v14x  | tooling | none mapped | indexed |
| `v14x-lib.mjs` | Shared harness pieces for the v14.1–v14.9 experiments (docs/PREREG-v14x.md). Original Neuralese code. | tooling | none mapped | indexed |
| `v14x-match.mjs` | v14.5 — cross-model neuron matching TS-3M ↔ TS-8M (PREREG-v14x §14.5). Original Neuralese code. | tooling | none mapped | indexed |
| `v14x-nested.mjs` | v14.7 + v14.8 — lens tests on the nested char LMs (PREREG-v14x §14.7, §14.8). Original Neuralese code. | tooling | none mapped | indexed |
| `v14x-sae.mjs` | v14.2 — SAE features vs MLP neurons through the R-lens (PREREG-v14x §14.2). Usage: node tools/v14x-sae.mjs [-- | tooling | none mapped | indexed |
| `v14x-splithalf.mjs` | v14.1 C1b — cosine between even/odd half-fits for every lens block, from the fit's per-document job cache. Ori | tooling | none mapped | indexed |
| `v14x-taylor.mjs` | v14.6 — Taylor check of the RelP linearisation on TS-8M (PREREG-v14x §14.6). Original Neuralese code. | tooling | none mapped | indexed |
| `v14x-worker.mjs` | Worker for tools/v14x-lib.mjs steerDeltas: Δ mean log-prob (rows 16..63, kept vocab) from adding vec at layer  | tooling | none mapped | indexed |
| `walk-shots.mjs` | Headless shots of the Deep Walk zoom ladder. Not part of CI. | tooling | none mapped | indexed |

## `ui/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `.gitignore` | dependencies (bun install) | v17 shell | none mapped | indexed |
| `bun.lock` | lock | v17 shell | none mapped | indexed |
| `package-lock.json` | json | v17 shell | none mapped | indexed |
| `package.json` | json | v17 shell | none mapped | indexed |
| `tsconfig.json` | json | v17 shell | none mapped | indexed |
| `vite.config.ts` | The shell is built into src/shell/ (the legacy web root), so gh-p | v17 shell | none mapped | indexed |

## `ui/src/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `App.tsx` | tsx | v17 shell | none mapped | indexed |
| `Dock.tsx` | Renders a layout tree: splits with keyboard-resizable separators, tab groups with ARIA tabs; tabs can be split | v17 shell | none mapped | indexed |
| `Palette.tsx` | Command palette (Ctrl/⌘+K, also "/"): the main way to navigate. Fuzzy search across workspaces, every panel | v17 shell | none mapped | indexed |
| `Tour.tsx` | tsx | v17 shell | none mapped | indexed |
| `main.tsx` | Mount after the legacy app has built its panes (they are adopted into the v17 dock). | v17 shell | none mapped | indexed |
| `styles.css` | Design tokens: v17 maps onto the legacy palette (src/style.css) so both layers theme together. AA-checked pair | v17 shell | none mapped | indexed |

## `ui/src/core/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `adv.ts` | Shared Adversary Lab state. The math lives in src/adversary and runs through the legacy bridge. | v17 shell | none mapped | indexed |
| `bridge.ts` | Typed view of the legacy app (src/app.js publishes window.NEURALESE and fires neuralese:ready / neuralese:sel) | v17 shell | none mapped | indexed |
| `cosmos-data.ts` | Derives what the model cosmos draws from real engine traces (Engine.step(…, {trace:true}) records). | v17 shell | none mapped | indexed |
| `engine-api.ts` | Types for the existing worker protocols in src/ (engine-worker.js, arch/encoder-worker.js, lens-worker.js). | v17 shell | none mapped | indexed |
| `forge.ts` | Shared Forge workspace state. The machine lives in src/forge. | v17 shell | none mapped | indexed |
| `layout.ts` | Dockable, splittable panel layout as an immutable tree. Pure functions → unit-tested; persisted per workspace. | v17 shell | none mapped | indexed |
| `machine.ts` | Signals for the Machine Room. The gadgets live in src/machine. | v17 shell | none mapped | indexed |
| `motion.ts` | Spring motion that respects prefers-reduced-motion (then it snaps), and View Transitions with a plain fallback | v17 shell | none mapped | indexed |
| `notebook.ts` | Notebook / report documents. Cells hold *recipes* (which live data source to chart), never baked numbers, so a | v17 shell | none mapped | indexed |
| `rpc.ts` | Typed request/response RPC over any postMessage endpoint (Worker, MessagePort, DedicatedWorkerGlobalScope). | v17 shell | none mapped | indexed |
| `selection.ts` | Global typed selection: one source of truth that every panel reads. Framework-agnostic core (unit-tested); | v17 shell | none mapped | indexed |
| `store.ts` | Solid binding for the selection store + app-level UI state; mirrors to/from the legacy app. | v17 shell | none mapped | indexed |
| `walk.ts` | Signals for the Deep Walk workspace. The tensors themselves stay in the engine; | v17 shell | none mapped | indexed |
| `workspaces.ts` | The 75 v16 tabs stay in the original 9 workspaces. Every legacy tab key appears exactly once. | v17 shell | none mapped | indexed |

## `ui/src/design-system/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `tokens.css` | Shell tokens. The legacy stylesheet keeps its own variables; the v17 shell reads these. | v17 shell | none mapped | indexed |

## `ui/src/panels/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `Adversary.tsx` | tsx | v17 shell | none mapped | indexed |
| `Chart.tsx` | uPlot line chart (canvas). Series come straight from the caller; nothing is interpolated or invented. | v17 shell | none mapped | indexed |
| `Forge.tsx` | tsx | v17 shell | none mapped | indexed |
| `Machine.tsx` | tsx | v17 shell | none mapped | indexed |
| `Panels.tsx` | tsx | v17 shell | none mapped | indexed |
| `VirtualTable.tsx` | Virtualized table: renders only the visible rows (fixed row height), keyboard-scrollable, ARIA grid semantics. | v17 shell | none mapped | indexed |
| `Walk.tsx` | tsx | v17 shell | none mapped | indexed |

## `ui/src/three/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `cosmos.ts` | Model cosmos: layers as strata, neurons (32×32 grid per layer) and heads (ring) as instanced particles whose h | v17 shell | none mapped | indexed |
| `machine.ts` | Machine Room board. Blocks are the components. Small spheres are bus packets. | v17 shell | none mapped | indexed |
| `nested.ts` | 3D views of the three nested experiments, built only from their shipped artifacts in src/nested/: | v17 shell | none mapped | indexed |
| `stage.ts` | Shared three.js stage: WebGPURenderer (WebGPU backend when available, WebGL2 fallback otherwise), orbit-ish | v17 shell | none mapped | reviewed, passes 23–30 |
| `walk.ts` | Deep-walk stage. Instanced blocks for tensors, bits, and gates. The voltage curve is the same | v17 shell | none mapped | indexed |

## `ui/tests/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `cosmos-data.test.ts` | ts | v17 shell | none mapped | indexed |
| `layout.test.ts` | ts | v17 shell | none mapped | indexed |
| `notebook.test.ts` | ts | v17 shell | none mapped | indexed |
| `rpc.test.ts` | ts | v17 shell | none mapped | indexed |
| `store.test.ts` | ts | v17 shell | none mapped | indexed |

## `wasm/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `build-eshkol-types.sh` | Builds Eshkol's type checker core (tsotchke/eshkol) to WebAssembly. Usage: ESHKOL=/path/to/eshkol ./build-eshk | wasm build | none mapped | indexed |
| `build-moonlab-qgt.sh` | Builds Moonlab's native QGT module (tsotchke/moonlab@cd3b234: src/algorithms/quantum_geometry/qgt.c + src/util | wasm build | none mapped | indexed |
| `build-qgtl.sh` | Builds the QGTL (tsotchke/quantum_geometric_tensor@770994a, MIT) geometric-measure core to WebAssembly. | wasm build | none mapped | indexed |
| `build-qrng.sh` | !/usr/bin/env bash | wasm build | none mapped | indexed |
| `eshkol_types_shim.c++` | NEURALESE shim over Eshkol's own compile-time type layer (lib/types/{dependent,hott_types,type_relation}.cpp, | wasm build | none mapped | indexed |
| `moonlab_qgt_shim.c` | NEURALESE shim over Moonlab's native quantum-geometry module (tsotchke/moonlab@cd3b234, MIT): | wasm build | none mapped | indexed |
| `qgtl_qgt_repro.c` | REPRODUCER (not shipped): drives QGTL tensor-network QGT path compute_quantum_geometric_tensor at 770994a. | wasm build | none mapped | indexed |
| `qgtl_shim.c` | NEURALESE shim over QGTL (tsotchke/quantum_geometric_tensor@770994a, MIT): the verdicts come from QGTL's own | wasm build | none mapped | indexed |
| `qgtl_stubs.c` | Link glue for the WASM build of QGTL core (770994a). geometric_initialize() in quantum_geometric_operations.c | wasm build | none mapped | indexed |
| `qrng_shim.c` | NEURALESE shim over tsotchke/quantum_rng (MIT). Thin C wrappers so JS can call | wasm build | none mapped | indexed |

## `wasm/eshkol_ad/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `build.sh` | Builds Eshkol's reverse-mode tape (tsotchke/eshkol@341ac81 lib/backend/vm_autodiff.c, unmodified) + harness.c  | wasm build | none mapped | indexed |
| `harness.c` | Full GPT-Neo forward + mean next-token CE recorded on Eshkol's REAL reverse-mode tape (tsotchke/eshkol@341ac81 | wasm build | none mapped | indexed |

## `wasm/eshkol_neurosym/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `golden.esk` | esk | wasm build | none mapped | indexed |
| `golden.txt` | txt | wasm build | none mapped | indexed |
| `run.sh` | v10 (e): regenerates site/tsotchke/data/eshkol_neurosym_golden.txt by running golden.esk with a REAL eshkol-ru | wasm build | none mapped | indexed |

## `wasm/eshkol_taylor/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `build.sh` | Compiles Eshkol's REAL Taylor-recurrence kernels natively and dumps golden coefficients for test/eshkol-taylor | wasm build | none mapped | indexed |
| `harness.c` | Calls Eshkol's tr_* kernels on fixed input series and prints JSON. N = 17 coefficients (K = 16, taylor.js K_MA | wasm build | none mapped | indexed |

## `wasm/qrng_native/`

| File | Purpose | Owner | Tests | Status |
|---|---|---|---|---|
| `build.sh` | !/usr/bin/env bash | wasm build | none mapped | indexed |
| `main.c` | Native driver for the cross-libm determinism finding (v10 (f)). Same upstream sources and the same qw_bytes sh | wasm build | none mapped | indexed |
| `simd_scalar.c` | Compiles upstream simd_ops.c with its x86 SIMD branches disabled, so it takes the same scalar code the WASM bu | wasm build | none mapped | indexed |

# NEURALESE ROADMAP v12 — 100 capabilities, each with a test that can fail

Written 2026-10-26 (PT) with v12.0.0. **Status**: `shipped` = in the deployed site and covered by a test or smoke check
(the test is named); `v12.x` = next, feasible in-browser with known libraries, not built yet; `later` = needs a server, much
larger downloads, or research first. Nothing marked `v12.x` or `later` exists in the app today.

Feasibility notes use measured sizes where we have them (8-bit ONNX from the HF Hub file tree, 2026-10-26). Browser limits
that drive the calls: WASM is single-threaded on GitHub Pages (no COOP/COEP headers → no SharedArrayBuffer); a tab can
practically hold ~1–2 GB of weights; WebGPU is available in Chrome/Edge (not in headless CI here); GitHub Pages files ≤ 100 MB.

Libraries referenced: **transformers.js** (`@huggingface/transformers`, ONNX Runtime Web underneath), **onnxruntime-web**,
**WebLLM** (MLC, WebGPU-only, q4 LLMs), **wllama** (llama.cpp → WASM, GGUF), **Three.js**, **Kokoro.js** (TTS).

## A. Model hub, swapping, installing (10)
| # | capability | feasibility in-browser | status | falsifiable acceptance test |
|---|---|---|---|---|
| A1 | Hub tab: list, load, cache ONNX models in a Web Worker | transformers.js 4.3.1 (pinned, hash-checked); worker keeps UI responsive | **shipped v12** | smoke-v12 `embedTest…hgen` run every model; V12-1 registry |
| A2 | Pinned, hash-verified runtime | 586 KB transformers.js + 28 MB ORT WASM from jsDelivr at pinned versions, both SHA-256 checked before use | **shipped v12** | V12-2: hash ≠ pin → test fails; worker throws on mismatch |
| A3 | Swap white-box model among TinyStories 1M/3M/8M | range-requested safetensors, same layout | **shipped v9** (TOOLS › ZOO) | zoo.test: logits match PyTorch reference |
| A4 | Generation-only LM swap: DistilGPT-2 (84 MB), GPT-2 (128 MB) | transformers.js text-generation | **shipped v12** | smoke `hgen`: continuation starts with prompt, > 25 chars |
| A5 | Tool-compatibility matrix per model | static table + guards | **shipped v12** | V12-1/H9: matrix lists every hub model; ONNX models expose no activations |
| A6 | White-box GPT-2 small (124M) in the JS engine | port GPT-2 blocks (all-global attention, no local window) to engine.js; 500 MB f32 | v12.x | logits within 1e-3 of transformers (PyTorch) on 5 prompts |
| A7 | Pin hub models by commit SHA, verify file hashes | HF API `?revision=<sha>`, LFS sha256 in tree API | v12.x | tampered/mismatched file → load refused |
| A8 | “Install from URL”: any HF repo id with ONNX + task | transformers.js `pipeline(task, repo)` with validation | v12.x | 3 unseen repo ids load and run; malformed id gives clear error |
| A9 | WebLLM chat models (SmolLM2-360M, Qwen2.5-0.5B, Llama-3.2-1B q4) | WebGPU only, 300 MB–900 MB | later | tokens/s and MMLU-mini accuracy reported; refuses cleanly without WebGPU |
| A10 | GGUF models via wllama (CPU) | llama.cpp WASM, ≤ 1 GB q4 | later | same prompts give same greedy output as llama.cpp CLI |

## B. Modalities (14)
| # | capability | feasibility | status | test |
|---|---|---|---|---|
| B1 | Sentence embeddings (all-MiniLM-L6-v2, 22 MB) | transformers.js feature-extraction | **shipped v12** | H1: cos(paraphrase) ≥ cos(unrelated) + 0.20 (got .808 vs −.069) |
| B2 | 3D embedding map (PCA → Three.js) | pca3 in `hub/models.js` | **shipped v12** | V12-6: planted 3D structure recovered (> 99.9% variance) |
| B3 | Semantic search over user text | cosine ranking | **shipped v12** | smoke `embedSearch`: “a small cat napping” ranks a cat/kitten line first; v12.x: recall@1 on 20 labelled pairs ≥ 0.8 |
| B4 | Speech recognition, mic + file (whisper-tiny.en, 40 MB) | transformers.js ASR, 16 kHz resample | **shipped v12** | H2: TTS→ASR WER ≤ 0.25 (got 0) |
| B5 | Text-to-speech (MMS-TTS eng, 38 MB) + WAV export | VITS ONNX | **shipped v12** | H2 + V12-4 WAV header bytes |
| B6 | Speech-to-speech chain (ASR → transform → TTS) | composition of B4/B5 | **shipped v12** | H2 round-trip self-test; V12-7 deterministic transforms |
| B7 | OCR, single printed line (TrOCR small, 63 MB) | image-to-text | **shipped v12** | H3: CER ≤ 0.10 on rendered card (got 0) |
| B8 | Image captioning (ViT-GPT2, 245 MB) | image-to-text | **shipped v12** | H5: ≥ 3-word caption (quality NOT claimed) |
| B9 | CLIP zero-shot classification (153 MB) | zero-shot-image-classification | **shipped v12** | H4: drawn red circle → “a red circle” (98.8%) |
| B10 | Multi-line / document OCR (Florence-2-base or line detection + TrOCR) | Florence-2 ONNX ~230 MB q8 | v12.x | CER ≤ 0.05 on 3 rendered paragraphs |
| B11 | Better TTS voices (Kokoro-82M, ~90 MB q8) | Kokoro.js | v12.x | Whisper round-trip WER ≤ 0.10 on 10 sentences |
| B12 | Multilingual ASR (whisper-base, 77 MB q8) | transformers.js | v12.x | WER ≤ 0.3 on FLEURS 10-clip subset per language |
| B13 | Vision-language chat (SmolVLM-256M) | transformers.js, ~250 MB, WebGPU strongly preferred | later | VQA-v2 50-item accuracy reported vs published |
| B14 | Voice activity detection + streaming ASR (Silero VAD 2 MB) | onnxruntime-web | v12.x | latency from end of speech to text < 2 s on laptop |

## C. Training & fine-tuning (10)
| # | capability | feasibility | status | test |
|---|---|---|---|---|
| C1 | Fine-tune TinyStories-8M on user text (1,536 params, exact grads, Adam) | ~10 s/step CPU in a worker | **shipped v12** | H6/V12-9: held-out ΔCE 95% CI < 0 |
| C2 | Apply fine-tune as undoable, replayable weight edit | surgery.js `ft` edit | **shipped v12** | H7/V12-10: exact CE equivalence, bit-exact undo |
| C3 | Grokking net trained live | frontier/grok.js | **shipped v11** | F3 gradient vs finite differences |
| C4 | LoRA rank-r on all attention/MLP matrices of 8M | needs full backward through all layers (grad.js has it); ~1–3 min/step CPU → WebGPU needed | v12.x | held-out CE CI < 0 and beats C1 at equal steps |
| C5 | WebGPU training kernels (matmul, softmax-CE backward) | WGSL; 8M fits easily | v12.x | GPU grads equal CPU grads to 1e-4 rel |
| C6 | Train a tiny GPT from scratch on user corpus (1–3M params) | CPU/WebGPU, minutes | v12.x | val CE falls below unigram baseline; reproducible with seed |
| C7 | Sparse autoencoder training at scale (8× dict on all layers) | existing SAE trainer, longer runs in worker | v12.x | FVU ≤ 0.2 at L0 ≤ 32 on held-out tokens |
| C8 | Knowledge distillation 8M → 3M | both models in JS | later | student CE gap closes ≥ 20% vs untrained student fine-tune |
| C9 | Training checkpoints + resumable runs (IndexedDB) | IDB stores Float32 blobs | v12.x | resume after reload gives identical loss curve (seeded) |
| C10 | Export fine-tuned weights as safetensors + HF model card | toSafetensors exists | v12.x | exported file loads in PyTorch and reproduces browser CE to 1e-4 |

## D. Interpretability (14)
| # | capability | feasibility | status | test |
|---|---|---|---|---|
| D1 | Logit / tuned lens, activation & path patching, DLA | JS engine | **shipped ≤ v7** | core/lab tests vs PyTorch refs |
| D2 | SAE, ROME, steering vectors, ACDC (node-level), probes | JS | **shipped ≤ v7** | research.test, lab.test |
| D3 | Complete causal atlas (128 heads + 8192 neurons) | offline + viewer | **shipped v11** | F7 / H6a, H6b |
| D4 | Edge-level ACDC | many more patches; worker + caching | v12.x | recovers IOI-style planted circuit in a toy model |
| D5 | Embedding-model interp: attention/neuron view of MiniLM | needs MiniLM white-box in JS (BERT blocks) | later | JS logits/embeddings equal ONNX to 1e-4 |
| D6 | Whisper encoder interp (which frames drive a token) | white-box port of whisper-tiny encoder | later | attribution sums to logit diff (completeness) within 1% |
| D7 | CLIP neuron/feature visualisation | white-box ViT-B/32 port or ONNX intermediate outputs | later | top-activating images reproducible across runs |
| D8 | Cross-model embedding comparison (CKA between 8M residual and MiniLM) | both embeddings available | v12.x | CKA(identical inputs, same model) = 1; random-init baseline lower |
| D9 | Attribution graphs / transcoders (Anthropic-style) | transcoder training on 8M | later | graph pruning keeps ≥ 80% of logit effect |
| D10 | Automated neuron explanations with an LLM judge | needs a capable LLM (WebLLM) | later | explanation scores beat shuffled-explanation baseline |
| D11 | Steering vectors from embeddings (MiniLM text → 8M residual direction) | linear map fit on paired data | v12.x | held-out cosine of mapped vs true > random baseline |
| D12 | Fine-tune diff viewer (which neurons the C1 adapter changed most) | γ vector already available | v12.x | top-k γ changes match top-k attribution on train text (ρ > 0) |
| D13 | Probing the hub ASR transcripts with 8M (surprisal of transcripts) | composition | v12.x | surprisal higher for shuffled-word transcripts |
| D14 | Head-type classifier across zoo sizes | headScores exists | v12.x | induction heads found in 3M/8M, not random-init |

## E. Evaluation & benchmarks (10)
| # | capability | feasibility | status | test |
|---|---|---|---|---|
| E1 | Clean-vs-edited scoreboard (perplexity, cloze, diversity) | JS | **shipped v7** | lab tests |
| E2 | Pre-registered hypothesis framework with hashes | prereg.json + checks | **shipped v11** | F0 hash check |
| E3 | Built-in modality self-tests with thresholds | HUB buttons | **shipped v12** | H1–H4 |
| E4 | Benchmark runner: per-model latency, throughput, memory | performance.now + `performance.measureUserAgentSpecificMemory` | v12.x | repeat runs vary < 15% |
| E5 | ASR WER on a bundled 20-clip LibriSpeech test-clean subset | ~3 MB audio | v12.x | WER within ±3 pts of published whisper-tiny.en |
| E6 | MTEB-lite (STS-B 200 pairs) for embedding models | 30 KB data | v12.x | Spearman within ±0.03 of published |
| E7 | OCR benchmark on 50 rendered lines, 5 fonts | canvas-generated | v12.x | CER table per font; fails if any font CER > 0.2 |
| E8 | TinyStories eval set CE for every zoo + hub LM | shared tokenizer for GPT-2 family | v12.x | 8M CE equals PyTorch to 1e-3 |
| E9 | Leaderboard export (JSON + markdown) | client-side | v12.x | schema-validated; re-import reproduces table |
| E10 | Statistical comparison of two models (paired bootstrap) | core.js bootCI exists | v12.x | identical models → CI contains 0 in ≥ 95% of seeds |

## F. Infrastructure & performance (10)
| # | capability | feasibility | status | test |
|---|---|---|---|---|
| F1 | Web Worker for hub inference and fine-tuning | module workers | **shipped v12** | smoke `finetune` runs in `ft-worker.js`; v12.x: measure main-thread long tasks during runs |
| F2 | WebGPU option for hub models | transformers.js `device:'webgpu'` | **shipped v12 (selector)**; untested in CI (no GPU) | on a WebGPU machine: same outputs as WASM within tolerance |
| F3 | Optional WebGPU unembedding for 8M | gpu.js | **shipped v8** | GPU vs CPU logits test |
| F4 | Move the 8M JS engine into a worker | transfer weights once, message-based API | v12.x | main-thread long tasks during generation < 50 ms |
| F5 | Multi-threaded WASM via COOP/COEP service worker (coi-serviceworker) | works on Pages with SW header shim | v12.x | `crossOriginIsolated === true`, ≥ 1.8× ASR speed-up |
| F6 | OPFS model cache with size accounting + eviction UI | Origin Private File System | v12.x | cache survives reload; delete frees reported bytes |
| F7 | Offline mode (service worker precache app shell) | SW | v12.x | site loads with network disabled after first visit |
| F8 | WASM SIMD kernels for the 8M engine (Rust/C → WASM) | | later | ≥ 2× tokens/s, logits identical to 1e-5 |
| F9 | Float16 / int8 weights for the JS engine | quantize() exists for edits | v12.x | CE change < 0.01 on eval set |
| F10 | Streaming token output for hub LMs | transformers.js TextStreamer | v12.x | first token visible before generation ends |

## G. UX / frontend (10)
| # | capability | feasibility | status | test |
|---|---|---|---|---|
| G1 | Command palette, terminal, keyboard shortcuts | | **shipped ≤ v8** | lab.test terminal table |
| G2 | Terminal commands for hub (`hub`, `embed`, `tts`, `s2s`, `ocrtest`, `hgen`) | | **shipped v12** | smoke `term` |
| G3 | 3D embedding explorer with drag-rotate and labels | Three.js | **shipped v12** | smoke: canvas present after embed |
| G4 | Download progress per file with bytes | progress_callback | **shipped v12** (percent) | v12.x: bytes total matches file tree size ±1% |
| G5 | Drag-and-drop audio/image anywhere in HUB | | v12.x | dropped file produces same result as file picker |
| G6 | Live microphone waveform + spectrogram | AnalyserNode | v12.x | 440 Hz tone peaks in correct FFT bin |
| G7 | Mobile layout for HUB tabs | CSS | v12.x | axe 0 violations; no horizontal scroll at 390 px |
| G8 | Shareable hub results (URL-encoded state) | share tab exists | v12.x | opening link reproduces inputs |
| G9 | Guided tour for new users | | later | task-completion study n ≥ 5 |
| G10 | Accessibility audit of new tabs (axe-core) | tools/a11y.mjs | v12.x | 0 WCAG A/AA violations on 6 HUB tabs |

## H. Backend & collaboration (8)
| # | capability | feasibility | status | test |
|---|---|---|---|---|
| H1 | Experiment manifest + replay (hash-verified) | | **shipped v7** | repro tests |
| H2 | Notebook and HTML report export | | **shipped v7** | lab tests |
| H3 | Optional sync of runs to a GitHub Gist (user token, client-side) | Gist API | later | round-trip identical JSON |
| H4 | Real-time collaboration (shared session via WebRTC) | Yjs + y-webrtc | later | two clients converge on same edit list |
| H5 | Server GPU offload for big models (opt-in) | needs paid backend | later | identical outputs to local for small models |
| H6 | Public results registry for pre-registered experiments | static JSON in repo + PR flow | later | every entry's hash matches its prereg |
| H7 | CLI parity for hub models in Node (`cli.mjs hub …`) | transformers.js node build | v12.x | Node and browser embeddings agree to 1e-4 |
| H8 | CI that runs smoke-v12 against the live URL nightly | GitHub Actions + Chrome | v12.x | job fails when any self-test fails |

## I. Safety & honesty (7)
| # | capability | feasibility | status | test |
|---|---|---|---|---|
| I1 | CLAIMS table: every claim names its refutation | | **shipped v10** | tsotchke/v11/v12 tests |
| I2 | CSP, no third-party scripts in the page | meta CSP | **shipped v7** (v12 adds HF/jsDelivr connect only) | smoke: 0 CSP violations |
| I3 | Local-only processing of mic, images, text | worker, no upload endpoints | **shipped v12** | smoke `network`: every request during the hub run is a GET to self, huggingface.co/*.hf.co, or jsDelivr |
| I4 | License display per hub model (MMS-TTS is CC-BY-NC-4.0) | static | v12.x | every model row shows a license |
| I5 | Voice-clone guardrails (no speaker cloning offered) | design choice | **shipped (by omission)** | no speaker-embedding input exists |
| I6 | Fine-tune data stays in-tab; clear button wipes it | | v12.x | IndexedDB empty after clear |
| I7 | Model-card risk notes shown before loading | | v12.x | load button disabled until note is shown once |

## J. Tsotchke stack (7)
| # | capability | feasibility | status | test |
|---|---|---|---|---|
| J1 | QRNG WASM, NIST subset | | **shipped v8–v10** | tsotchke.test |
| J2 | QGTL geometry + Moonlab fidelity | | **shipped v9–v10** | C2a etc. |
| J3 | Eshkol HoTT type layer + Taylor AD | | **shipped v10** | hott/eshkol tests |
| J4 | QRNG-seeded fine-tune data shuffling (C1) | swap rng | v12.x | same QRNG seed → identical run; different seeds → CI overlap |
| J5 | QGT of the fine-tune parameter manifold (Fubini–Study on output distribution) | qgeom exists | v12.x | metric PSD; matches Fisher diag on ln_f |
| J6 | Eshkol-typed model-hub manifests (task/IO types checked) | type layer exists | later | ill-typed chain (e.g. TTS→OCR) rejected before running |
| J7 | Moonlab quantum-kernel embedding baseline vs MiniLM | small qubit counts only | later | reports STS Spearman; must state it loses if it loses |

**Count:** A10 + B14 + C10 + D14 + E10 + F10 + G10 + H8 + I7 + J7 = **100**. Shipped in v12.0.0 (new): A1, A2, A4, A5,
B1–B9, C1, C2, E3, F1, F2 (selector only), G2–G4, I3 = 22 items. Shipped earlier: 17. Remaining 61 are roadmap.

# Stack — exact versions (v12.0.0, 2026-10-26)

## Runtime (what the deployed page uses)
| component | version | origin | license |
|---|---|---|---|
| NEURALESE app | 12.0.0 | this repo, plain ES2022 modules, no bundler, no framework | MIT |
| Language model | `roneneldan/TinyStories-8M` @ `refs/pr/1` (safetensors, fp32; GPT-Neo, 8 layers, d = 256, V = 50 257) | Hugging Face, fetched at runtime | per model card |
| Inference / gradients / analysis | hand-written JavaScript (`engine.js`, `grad.js`, `analysis.js`, …), Float32 CPU; optional WebGPU unembedding | this repo | MIT |
| three.js | r160 (`site/vendor/three/three.module.min.js` + `addons/controls`), vendored and pinned | three.js authors | MIT |
| **Moonlab** (⚛ Tsotchke) | npm `@tsotchkecorp/moonlab` 1.2.1: Emscripten WASM 1.48 MB + JS glue (unmodified), ESM bindings (one 4-line browser patch) | `site/vendor/moonlab/` | MIT |
| **quantum_rng** (⚛ Tsotchke) | 1.1.0 @ `1a77e77`, compiled by us with emscripten 4.0.23 `-O2`: `qrng.wasm` 42 KB (sha256 `a82a9b44…6e`), `qrng.mjs` 10 KB | `site/tsotchke/`, built by `wasm/build-qrng.sh` | MIT |
| **Eshkol Taylor recurrences** (⚛ Tsotchke) | port of `lib/core/taylor_recurrences.def` @ `341ac81` (Eshkol 1.3.6) | `site/tsotchke/taylor.js` | MIT |
| **QGTL definition** (⚛ Tsotchke) | QGT / Fubini–Study metric @ `770994a` (v0.777 Beta) | `site/tsotchke/geometry.js` | MIT |
| **Eshkol type layer** (⚛ Tsotchke) | `lib/types/{dependent,hott_types,type_relation}.cpp` @ `341ac81`, compiled by us (emscripten 4.0.23, C++17): `eshkol_types.wasm` (sha256 `555920a7…26a7`) | `site/tsotchke/types.js`, built by `wasm/build-eshkol-types.sh` | MIT |
| **QGTL core** (⚛ Tsotchke) | 6 files of `src/quantum_geometric/core` @ `770994a`, compiled by us (emscripten 4.0.23 `-O2`): `qgtl.wasm` 29.7 KB (sha256 `2c56f678…371d`) | `site/tsotchke/qgtl.js`, built by `wasm/build-qgtl.sh` | MIT |
| NIST SP 800-22 subset | our implementation of rev1a §2.1, 2.2, 2.3, 2.13 | `site/tsotchke/nist.js` | MIT |
| **transformers.js** (v12 HUB) | `@huggingface/transformers` 4.3.1, `dist/transformers.min.js` fetched unmodified from jsDelivr at the pinned version, SHA-256 checked (`8d6716d9…e743`) before it is imported from a blob URL. It is not vendored because GitHub secret scanning flags the class name `Mistral3ForConditionalGeneration` in the minified file as a Mistral API key, a false positive. Also vendored: + `ort-wasm-simd-threaded.jsep.mjs` (sha256 `c2f80e91…2c99`) | `site/hub/vendor/`, run in a module Web Worker (`site/hub/worker.js`) | Apache-2.0 |
| **ONNX Runtime Web** WASM (v12 HUB) | `onnxruntime-web@1.31.0-dev.20260914-8d85527a0`, `ort-wasm-simd-threaded.jsep.wasm` 28.35 MB, sha256 `62ff86b2…ac06`; too large to vendor, fetched from jsDelivr at the pinned version and hash-checked in the worker before it is used (`wasmBinary`) | cdn.jsdelivr.net | MIT |
| Hub models (v12) | `Xenova/all-MiniLM-L6-v2`, `Xenova/whisper-tiny.en`, `Xenova/mms-tts-eng`, `Xenova/trocr-small-printed`, `Xenova/vit-gpt2-image-captioning`, `Xenova/clip-vit-base-patch32`, `Xenova/distilgpt2`, `Xenova/gpt2` — 8-bit (q8) ONNX, `main` revision, fetched at runtime and cached by the browser. Not hash-pinned (the Hub serves `main`); see ROADMAP-v12 item M7 | Hugging Face | per model card (Apache-2.0 / MIT / CC-BY-NC-4.0 for MMS-TTS) |
| Hosting | GitHub Pages (`gh-pages` branch), CSP `script-src 'self' <hash> 'unsafe-eval'`, `connect-src` adds huggingface.co / *.hf.co / cdn.jsdelivr.net (`unsafe-eval` is needed for WebAssembly compilation) | | |

Languages in the shipped page: JavaScript (ES modules), WebAssembly (compiled from C: quantum_rng, Moonlab, QGTL; from C++: Eshkol type layer), HTML, CSS.

## Development and verification
| tool | version | used for |
|---|---|---|
| Node.js | 20.19.2 | `npm test` (node:test), CLI, doc generation |
| puppeteer-core | 24.43.1 | headless smoke tests (`smoke*.mjs`) |
| Google Chrome | 156.0.8078.47 | smoke-test browser |
| axe-core | 4.14.0 (`npm i --no-save axe-core@4`) | accessibility audit (`tools/a11y.mjs`) |
| ESLint | 9.39.5 (`npm run lint`) | lint |
| Emscripten (emsdk) | 4.0.23 (`7a5d93b5`) | building the quantum_rng WASM |
| gcc (native cross-check) | 14.2.0, glibc 2.41 | native quantum_rng; Eshkol Taylor kernels and AD tape harnesses (v10 b, d) |
| musl-gcc | musl 1.2.5 (Debian musl-tools) | v10 (f) libm grid |
| LLVM / clang | 21 (apt.llvm.org) | building `eshkol-run` @ `341ac81` for v10 (e) |
| Moonlab QGT WASM | `qgt.c` + `matrix_math.c`, emscripten 4.0.23 → `moonlab_qgt.wasm` (sha256 `96d92eb7…9598`) | v10 (a), shipped in the page |
| Python | 3.13.5 (`.venv`) | PyTorch reference scripts `ref*.py` |
| PyTorch | 2.14.1+cpu | autograd references (`test/ref_*.json`) |
| transformers | 5.20.2 | reference GPT-Neo forward |
| numpy / scipy | 2.5.4 / 1.18.1 | SVD, statistics and special-function references |
| statsmodels | 0.15.0 | multiple-comparison references |
| safetensors | 0.8.0 | weight loading in Python |

## Tsotchke sources inspected
| repo | commit | commit date |
|---|---|---|
| tsotchke/eshkol | `341ac812ed600fd9d27c28e9509d66ab71363947` | 2026-10-17 |
| tsotchke/moonlab | `cd3b2347e3739327548708073d7e4ac710cc6a6c` | 2026-09-11 |
| tsotchke/quantum_geometric_tensor | `770994aa8ddd858e6bb16eebb25250a7b9f67c96` | 2026-01-09 |
| tsotchke/quantum_rng | `1a77e77f803c63883349b658361c06401cd8ceb7` | 2026-07-11 |

See [TSOTCHKE.md](TSOTCHKE.md) for the analysis and [CLAIMS.md](CLAIMS.md) for the evidence.


## Binary storage and integrity

The repository is deployed through a text-only channel, so both WebAssembly binaries are committed as base64 text: `site/tsotchke/qrng.wasm.b64` and `site/vendor/moonlab/dist/moonlab.wasm.b64`. `site/tsotchke/wasmb64.js` decodes them and checks SHA-256 before instantiation. If the hash does not match, loading throws:

- qrng.wasm: `a82a9b44efcdb5d0177c0eb6bc63b76910fefdc97482ce014d846dcd19fba86e` (reproducible with `wasm/build-qrng.sh`)
- moonlab.wasm: `fef4f0192641af2299b097bb1ccb535cd76f2d5d10f731c5723fe6e3f71229c1`. This is the byte-identical upstream `@moonlab/quantum-core` binary. Check it with `base64 -d moonlab.wasm.b64 | sha256sum`.

Test C3z checks that both pins hold and that a changed pin gets rejected. The browser hands the verified bytes to the unmodified Emscripten glue through `wasmBinary`. In Node, the test materialises `dist/moonlab.wasm` from the verified base64 first.

## v11 FRONTIER
`site/frontier/` (core.js stats/nulls/LZ76/exact t-test, mind.js PCI/ignition/probes/ridge, rsi.js self-edit loop with exact post-layer-7 gradient, grok.js modular-addition net, cites.js) · `site/lab-frontier.js` UI · `tools/frontier-{mind,rsi,grok,atlas}.mjs` offline runs (Node 20, worker_threads) · results in `site/frontier/data/*.json`, hash-linked to `docs/PREREG-v11.md` · tests `test/v11.test.mjs`.

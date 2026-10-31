# Neuralese v15.0.0: visual overhaul

A front-end redesign. Models, maths and data are unchanged, and every provenance/honesty banner is kept.

- **Design system:** a dark "research lab" look built from CSS tokens: surfaces, text, accent palette, type scale, spacing, radii, elevation, focus rings and motion. Inter and JetBrains Mono are self-hosted (variable WOFF2, SIL OFL licences in `vendor/fonts/`), with no font CDN. There is a matching light theme, and `prefers-reduced-motion` turns off all animation.
- **Navigation:** the 72-tab wall is replaced by a grouped, collapsible sidebar.
  - Live search (press `/`); tabs are labelled with their descriptive titles.
  - A sticky pane header shows the group, the tab and its title.
  - On phones the sidebar is a drawer behind ☰. The ⌘K command palette is restyled.
- **Components:** panels are cards. Buttons, inputs, selects, checkboxes, radios and sliders, sticky-header tables, tooltips, toasts, chips and scrollbars are restyled. Charts that have not been rendered yet show an empty-state pattern, and there is a shimmer for busy elements.
- **Charts (`charts.js`, rewritten, same API):**
  - Crisp HiDPI rendering with nice-number ticks, gridlines, axes and legends.
  - Hover crosshairs and markers; area fills and soft glow on lines; rounded gradient bars with hover; scatter plots with gridlines and glow.
  - Heatmaps use perceptual colormaps (viridis and magma, plus a dark-centred blue→orange diverging map) and draw a colorbar.
- **3D:**
  - ACES tone mapping with key, rim and fill lights and a gradient backdrop.
  - Additive glow halos on attention heads scale with ‖z_h‖, and MLP neurons are drawn as soft round points.
  - Glass layer slabs with edge outlines, layer labels and a ground grid.
  - Fit-to-view ignores the grid and accounts for the taller header. The heightfield uses the diverging palette.
- **Tests:**
  - `test/v15.test.mjs` adds 4 tests, for a total of 149.
  - `smoke-v15.mjs` opens every tab at 1440×900, 1240×700 and 390×844. It asserts each pane and header renders, the page never overflows horizontally, and there are 0 console errors. It also checks the sidebar search and collapse, the mobile drawer and that the fonts load.
- **Cache busting:** cache busters are now `?v=15`.

# Neuralese v14.9.0

All 14.x criteria were pre-registered in docs/PREREG-v14x.md (sha256 7f864197…93a1, pinned by test V14X-1) before any data. Results: docs/CLAIMS-v14x.md; failures: docs/REPORT-v14.md.

## 14.9.0
- Headless-Chrome fit of the full TS-1M lens through lens-worker.js: cosine 1.000000 with the Node fit for all 31 blocks (C9a supported). Scope: CPU Web Workers, not WebGPU.
- docs/REPORT-v14.md lists every failed prediction from 14.0–14.8; test V14X-7 enforces it (C9b).
- test/v14x.test.mjs (8 tests); smoke-v14 covers the NESTED tabs. 145/145 tests, SMOKE OK.

## 14.8.0
- Host × nested cross-read. C8a not supported, as predicted: host-head reads of baked-guest units are exactly 0.
- C8b supported: the emulator's mode-0 and mode-1 reads of the same unit agree (median r 0.888 vs τ99 0.637).

## 14.7.0
- New NESTED group with four tabs:
  - RISC-V IN WEIGHTS, SLM IN SLM and MoE IN MoE, integrated from the neuralese-nested workstream (nested/).
  - NESTED LENS, with results and a unit reader.
- The nested SLM weights ship as float32 (nested/slm/models.f32, 1.5 MB, sha256-checked) instead of 6.2 MB of float64 JSON. Max KL against float64 is 2.4e-16.
- nestedlens.js adds a finite-difference R-lens. R.out passes the steering null on the composite (384/384) and the emulator (243/249). C7 supported.

## 14.6.0
- Taylor check of the RelP linearisation on TS-8M. C6 not supported at all 7 layers, as predicted.
- The pre-registered δ=1e-4 finite difference is float32-noise-limited. An exploratory δ=1e-2 rerun is included and labelled as such.

## 14.5.0
- Hungarian matching of TS-3M ↔ TS-8M neurons on out·R top-50 Jaccard. C5 not supported: 11/48 = 22.9% of pairs exceed τ99, against the ≥30% criterion.

## 14.4.0
- Auto-labels from S.mid reads.
- C4a supported: hit rate 12.95% vs 0.16% shuffled, McNemar p≈2e-295.
- C4b supported: logistic-z confidence is calibrated within 0.033 in every bin.

## 14.3.0
- Head attribution through the lens vs zero-ablation (node level; scope change). C3 not supported:
  - induction: recall 0.31, AUROC 0.63
  - IOI: recall 0.18, AUROC 0.48
  - the logit baseline is equally poor.
- `forward` gains `ablate` and `zs` options.

## 14.2.0
- SAE features (sae.js, m=1024, L3) through R.out pass 64/64, matching neurons at 64/64. C2 supported, but at ceiling, and the SAE is weakly sparse.

## 14.1.0
- TS-1M and TS-3M lenses (lens/ts1m, lens/ts3m; scope change from distilgpt2/GPT-2).
- C1a supported: R.out beats the logit lens at 7/7 layers on both models, null 0.011.
- C1b supported: split-half cosine ≥0.9927 for every block of 1M/3M/8M.
- C1c supported: the 8M rerun at 64 neurons per layer gives narrower CIs at 7/7 layers.
- Weak-spot fix: the NEURON LENS steer demo now averages Δ over positions and ranks only DB-vocabulary tokens.

## 14.0.0
- Neuron Lens: original JS implementation of R/S/mid lenses (RelP tape, forward/reverse doc Jacobians) for TinyStories-8M; prior-art credit in docs/NEURON_LENS_METHOD.md.
- lens/ts8m: lenses.f32 (sha256 6a668f3e…7636), validation.json, drivers.json, per-layer neuron/head DB with db-manifest sha256s.
- New tabs NEURON LENS / LENS VALID / LENS CATALOG; Web Worker refit.
- Pre-registered validation (docs/PREREG-v14.md + Amendment 1): P1, P2, P5 supported; P3, P4 not supported (docs/CLAIMS-v14.md).
- Attributed CC BY 4.0 sample of stdlogits/neuron-lens dataset in lens/ext (no contexts).
- ROADMAP-v14 for v14.1–v14.9.

## 13.0.1
- Electron 38 → 42.11.16 and puppeteer-core 24 → 25.16.0 (Dependabot security updates, PR #2).
- Electron 42 no longer falls back to software WebGL by itself, so on machines without a usable GPU the lab stopped at "Error creating WebGL context". `desktop/main.cjs` now enables the SwiftShader fallback.


**Live:** https://0thernes.github.io/neuralese/

v13 packages the v12.1 lab as native apps. The lab itself is unchanged. It is the same in-browser interpretability and weight-surgery lab for TinyStories-8M.

## Downloads
| platform | file | notes |
|---|---|---|
| Windows x64 | `Neuralese-Setup-13.0.1-x64.exe` | NSIS installer. Unsigned, so SmartScreen will warn: More info → Run anyway |
| Windows x64 | `Neuralese-13.0.1-x64-portable.exe` | runs without installing. Unsigned |
| Linux x64 | `Neuralese-13.0.1-x86_64.AppImage` | `chmod +x`, then run. Some distros need `libfuse2` |
| Linux x64 | `Neuralese-13.0.1-amd64.deb` | `sudo apt install ./Neuralese-13.0.1-amd64.deb` |
| Android | `Neuralese-13.0.1-debug.apk` | debug build. Allow "install unknown apps" |
| iOS device | `Neuralese-13.0.1-unsigned.ipa` | unsigned. Re-sign with AltStore or Sideloadly |
| iOS Simulator | `Neuralese-13.0.1-simulator.app.zip` | unzip, then `xcrun simctl install booted App.app` |

`SHA256SUMS.txt` lists the hash of every file.

## Honest limitations
- None of the builds is code-signed: Windows SmartScreen, macOS-style Gatekeeper prompts on Linux desktops, and an unsigned iOS IPA. There is no auto-update.
- On first run the model (~112 MB) and any HUB models download from Hugging Face, so the apps need internet then. After that, the browser cache serves them.
- Mobile performance: the lab is heavy. Some tabs (3D, HUB ONNX models, long sweeps) are slow or memory-limited on phones.
- The Android build is a debug APK, not a Play Store release.

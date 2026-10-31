# Neuralese v14.0.0

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

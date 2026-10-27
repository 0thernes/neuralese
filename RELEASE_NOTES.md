# Neuralese v13.0.0

**Live:** https://0thernes.github.io/neuralese/

v13 packages the v12.1 lab as native apps. The lab itself is unchanged. It is the same in-browser interpretability and weight-surgery lab for TinyStories-8M.

## Downloads
| platform | file | notes |
|---|---|---|
| Windows x64 | `Neuralese-Setup-13.0.0-x64.exe` | NSIS installer. Unsigned, so SmartScreen will warn: More info → Run anyway |
| Windows x64 | `Neuralese-13.0.0-x64-portable.exe` | runs without installing. Unsigned |
| Linux x64 | `Neuralese-13.0.0-x86_64.AppImage` | `chmod +x`, then run. Some distros need `libfuse2` |
| Linux x64 | `Neuralese-13.0.0-amd64.deb` | `sudo apt install ./Neuralese-13.0.0-amd64.deb` |
| Android | `Neuralese-13.0.0-debug.apk` | debug build. Allow "install unknown apps" |
| iOS device | `Neuralese-13.0.0-unsigned.ipa` | unsigned. Re-sign with AltStore or Sideloadly |
| iOS Simulator | `Neuralese-13.0.0-simulator.app.zip` | unzip, then `xcrun simctl install booted App.app` |

`SHA256SUMS.txt` lists the hash of every file.

## Honest limitations
- None of the builds is code-signed: Windows SmartScreen, macOS-style Gatekeeper prompts on Linux desktops, and an unsigned iOS IPA. There is no auto-update.
- On first run the model (~112 MB) and any HUB models download from Hugging Face, so the apps need internet then. After that, the browser cache serves them.
- Mobile performance: the lab is heavy. Some tabs (3D, HUB ONNX models, long sweeps) are slow or memory-limited on phones.
- The Android build is a debug APK, not a Play Store release.

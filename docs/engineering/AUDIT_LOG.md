# Audit log

Findings from the hardening audit. A row is a defect or a check that closed without a defect. Severity: **high** is a wrong result, a security exposure, or an application script that misses the 200 ms / 100 ms gate. **medium** is a user-facing defect below that bar. **low** is maintainability. **info** is a check with no defect.

Passes 1–22 are the earlier engineering log in [PASSES.md](PASSES.md). This file starts at pass 23.

| ID | Pass | File:line | Severity | Finding | Fix commit | Test |
|---|---|---|---|---|---|---|
| AUD-023 | 23 | `src/lab-ui.js` `exportFor` | high | CSV export built one `Blob` from the whole string (chart `_csv` also grew that string with `out +=`). The preview click suite measured 1068 ms and 1264 ms of application script on that path. | `8c549a8` | `test/audit-hardening.test.mjs` |
| AUD-024 | 24 | `src/research.js` `acdcAsync` | high | After each yielded forward, `objective()` still did a synchronous full-vocab score. The preview suite recorded a 1685–1696 ms script whose handler was `out.acdc`. | `8c549a8` | `test/audit-hardening.test.mjs` |
| AUD-025 | 25 | `src/app.js` `fetchRange` (~line 50) | high | The weight-range continuation copied every chunk into one `Uint8Array`, then `loadModel` ran `parseSafetensors` and `new GPT2Tokenizer` in the same turn. Mobile's preview script was `app.js` `Promise.resolve`, 549 ms, source offset 4495, which is this copy. | `8c549a8` | `test/audit-hardening.test.mjs` |
| AUD-026 | 26 | `ui/src/three/stage.ts` `createStage` | medium | `new WebGPURenderer` ran in the microtask of the shell's layout `setTimeout`, so a workspace change was one long application script. `dispose()` did the same on the way out. | `8c549a8` | Shell rebuild (`stage-CI8fgHFM.js`). The click suite is the check and has not been re-run. |
| AUD-027 | 27 | `src/science.js` `superposition`; `src/lab-tsotchke.js` `out.chsh`; `src/audio.js` `start` | medium | Superposition built all 1024 projection columns before its first yield, and then yielded only every 32 neurons. CHSH called wasm in blocks of 4000. The impulse response filled both channels before the first timer. | `8c549a8` | No new numeric assertion (the model file is not in this checkout). |
| AUD-028 | 28 | `src/analytics.js:57` | info | `kl` matches the definition: 0 on a distribution with itself, `ln 2` for a point mass against a fair coin, infinity when `q` is 0 on support of `p`. | No code change. | `test/audit-hardening.test.mjs` |
| AUD-029 | 29 | `desktop/main.cjs:26`, `desktop/safe-path.cjs` | info | `contextIsolation`, `sandbox`, and `nodeIntegration: false` are set. `safeAppPath` still rejects `..` and a bad `%`. `npm audit` reports 0 vulnerabilities. | No code change. | `test/desktop-path.test.mjs`; `npm audit` |
| AUD-030 | 30 | `features/` | info | `node tools/check-features.mjs`: 138 features, 10 releases. No feature was removed. | No code change. | `test/features.test.mjs` |

## Open

- The 3-width preview click suite has not been run on this commit. The last measured gate is still the `ec18eeb` table in [PASSES.md](PASSES.md): app-script max 549 / 1068 / 1696 ms. That run is not evidence for passes 23–27.
- `test/science.test.mjs` does not start in this checkout: `model/model.safetensors` is absent. That is an environment gap, not a new defect.
- About 4% of [AUDIT_INDEX.md](AUDIT_INDEX.md) is reviewed. The rest is indexed only.

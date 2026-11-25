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

| AUD-031 | 31 | `.github/workflows/pages.yml:16` | high | `workflow_dispatch` published `./www` as the whole `gh-pages` branch, which would replace the pinned root (`2527d67`) and delete `/preview`. | `e6229d6` | `test/audit-hardening.test.mjs` |
| AUD-032 | 32 | `test/science.test.mjs:9` | medium | The file `readFileSync`s `model/model.safetensors` at import time. A checkout without that file died with ENOENT before any assertion. CI already runs `tools/fetch-model.mjs`; a direct `node --test` did not. | `e6229d6` | The test now runs `tools/fetch-model.mjs` (pinned SHA-256) and throws if the file is still missing. It does not skip. `test/science.test.mjs` passed 8/8 after the download. |
| AUD-033 | 33 | `src/cli.mjs:13` | low | The CLI reported `v6.0.0` while `package.json` and the terminal are `17.3.0`. `tools/bump-version.mjs` did not update the CLI. | `e6229d6` | `test/cli.test.mjs`, `test/packaging.test.mjs` |
| AUD-034 | 34 | `src/decode.js:25` | medium | `filterDist` with `minp` above 1 dropped every candidate. `pick` then returned `undefined` in greedy mode. | `e6229d6` | `test/audit-hardening.test.mjs` |
| AUD-037 | 37 | `src/nested/slm/index.html:28`, `src/nested/riscv/index.html:17`, `src/gpu/webgpu-engine.js` `upload` | high | The preview suite on `bf3199a` still had application scripts of 223 ms (mobile, fcGo) and 215 ms (tablet, fxGo): `Response.arrayBuffer.then` from the nested iframes. WebGPU weight upload and the audio graph sat between 100 and 150 ms, which fails p95 when fewer than 20 frames are at least 50 ms. | `ac42754` | Iframe fetch/hash/JSON runs in `json-worker.js`. RISC-V `prepAsync` yields. WebGPU `writeBuffer` is 1 MB per paint. The audio graph yields a paint before the impulse response. |
| AUD-038 | 38 | `src/engine.js` `step`; `src/tokenizer.js` `GPT2Tokenizer.create` | high | The preview of `b895908` still failed the gate. Tablet app max 333 ms was the merge-table continuation inside `GPT2Tokenizer.create` (yield every 512 lines). Mobile app max 283 ms was one traced `Engine.step` inside `editImpact`. Desktop app max 201 ms was the first `exportFor` continuation (`createImageBitmap` of a 64-row strip). | `2f7c5e3` | `test/engine-kv.test.mjs` (budgeted step matches a full step). Tokenizer yield is every 64 keys and every 64 merge lines. `step({ budget: true })` returns after each slot and resumes. PNG strips are 8 rows. |
| AUD-039 | 39 | `docs/CLAIMS.md` H9 | low | H9 pointed at `site/hub/models.js`. That path is not in the tree. The registry is `src/hub/models.js`, and its `TOOL_MATRIX` still says hub ONNX models expose no activations. | `22af700` | `test/audit-hardening.test.mjs` |
| AUD-040 | 40 | `src/neuronlens.js` `forward` | medium | The lens forward was full causal on every layer. The engine uses a local window (default 256) on odd layers. A document longer than the window got attention mass the model cannot produce. Sequences of length 21, which the existing lens tests use, never reached the window, so they stayed green. | `22af700` | `test/neuron-lens.test.mjs` |
| AUD-041 | 41 | `docs/STACK.md:3` | low | The v13 stack page still described `site/` paths and called the app 12.0.0. Those files are under `src/` now, and `package.json` is 17.3.0. The pin table stays as the v13 record. | `c7c0edc` | `test/audit-hardening.test.mjs` |
| AUD-042 | 42 | `docs/CLAIMS-v14.md`, `docs/REPORT-v14.md`, `docs/CLAIMS-v14x.md` | info | The v14 write-ups report the failed predictions (P3, P4, C3, C5, C6, C8a) with the same numbers in the claims tables and the report. No rewrite. | no code change | existing `test/neuron-lens.test.mjs` V14-6 and V14-7 pin the pre-registration and the validation rows |
| AUD-043 | 43 | `docs/FRONTIER.md:1` | low | The frontier write-up pointed at `site/frontier/data/`. The result files are `src/frontier/data/`. The scores themselves match `docs/CLAIMS.md`. | `00cd131` | `test/audit-hardening.test.mjs` |
| AUD-044 | 44 | `docs/NEURON_LENS_METHOD.md:68` | low | The method page still said distilgpt2 and GPT-2 were planned for v14.1. That release fitted TinyStories-1M and 3M instead, and the report already said so. | `00cd131` | `test/audit-hardening.test.mjs` |
| AUD-045 | 45 | `src/frontier/grok.js` `step` | high | One live grokking step was still a single script (104 ms on the desktop preview of `3a62a0d`). The training pass now yields every 32 examples. The Adam update matches a full step. | `f16a77b` | `test/audit-hardening.test.mjs` |
| AUD-046 | 46 | `src/style.css` header; `ui/src/Dock.tsx` panel; `ui/src/styles.css` `.cosmos-hud` | medium | At 768×1024, axe reported contrast on `#bTheme`, `#bPal`, and `.cosmos-hud`, and a scrollable `#panel-cosmos` that could not take focus. The header was translucent. The hud had no background. The panel had no tabindex. | `f16a77b` | the click-all axe gate |
| AUD-047 | 47 | `src/lab-tsotchke.js` `taylorJet`; `src/lab-research.js` `statsHeads`; `src/model.js` `copyWeightsIntoYield` | high | On preview `3d36ace`, mobile app max was 628 ms and tablet 621 ms. The scripts were `forwardAsync` and `ceJetLnf` inside the Taylor jet, `docCE` inside the head study, and a 262144-float weight copy. | this commit | `test/audit-hardening.test.mjs`. The jet and the head study run in `engine-worker.js` and return the coefficients or the CE vectors. Main-thread copies are 8192 floats. |
| AUD-048 | 48 | `.github/workflows/release.yml` | medium | The TinyStories cache key was `tinystories-model-v1`, so a pin change could reuse the wrong files. The key is now the pinned `model.safetensors` SHA-256. `fetch-model.mjs` still runs, and `test/science.test.mjs` still throws if the file is missing. | this commit | `test/audit-hardening.test.mjs` |
| AUD-049 | 49 | `docs/STEERING_GUIDE.md` | low | The beginner guide said the weight download is about 80 MB. The pinned file is 112377544 bytes. | this commit | `test/audit-hardening.test.mjs` |
| AUD-035 | 35 | `src/linalg.js:21` | info | One-sided Jacobi SVD of a 3×3 matrix reconstructs it within 1e-8 and returns singular values in descending order. | no code change | `test/audit-hardening.test.mjs` |
| AUD-036 | 36 | `src/` first-party scripts | info | `eval` and `new Function` appear only under `src/vendor` and `src/hub/vendor`. | no code change | `test/audit-hardening.test.mjs` |

## Open

- Preview of `fa80009` (one 3-width run, workers 1, 0 console errors) failed the gate. Axe on every width: `color-contrast` on `.logo > span` (`ESE`), 4.47:1 in the light theme (`#0b7d70` on `#eef2f8`). App script max was about 1 s. The long scripts were the edit-impact unembed, `taylorJet`, and a weight copy, all between yields. `d8a8a6f` chunks that unembed (1024 rows) and sets the light-theme logo to `#085e54`. It is not in this table.

| Width | Clicked | Disabled | Console | Axe | Cosmos | #gl | Raw max | Raw p95 | Paint/GL max | App max | App p95 | Worst |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 390×844 | 514 | 9 | 0 | logo contrast | 390×658 | 390×478 | 1018 | 563 | 748 | 1016 | 563 | editImpact unembed |
| 768×1024 | 489 | 9 | 0 | logo contrast | 388×426 | 373×572 | 1147 | 515 | 1147 | 1038 | 524 | same family, ~1 s |
| 1440×900 | 515 | 8 | 0 | logo contrast ×7 | 737×369 | 709×490 | 1396 | 442 | 1396 | 1062 | 533 | same family, ~1 s |

- Preview of `3a62a0d` (one 3-width run, workers 1, 0 console errors, 514 clicked, 9 disabled) failed the gate. Mobile axe was clean. Tablet and desktop axe failed contrast and scrollable-region focus.

| Width | Clicked | Disabled | Console | Axe | Cosmos | #gl | Raw max | Raw p95 | Paint/GL max | App max | App p95 | Worst |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 390×844 | 514 | 9 | 0 | none | 390×658 | 390×478 | 816 | 434 | 816 | 179 | 104 | exportFor @Lower to gates |
| 768×1024 | 514 | 9 | 0 | contrast 5, scrollable 1 | 388×426 | 373×572 | 1305 | 416 | 951 | 299 | 186 | GPT2Tokenizer.create |
| 1440×900 | 514 | 9 | 0 | contrast 6, scrollable 1 | 737×369 | 709×490 | 1203 | 349 | 1006 | 342 | 342 | GPT2Tokenizer.create |

- Preview of `b895908` (gh-pages `bb6d56e`), one 3-width run, workers 1, failed the gate. Console errors were not reported. Tablet axe: `color-contrast:5, scrollable-region-focusable:1`. Desktop and mobile axe were clean on that run.

| Width | App max | App p95 | n≥50 | Worst |
|---|---|---|---|---|
| 390×844 | 283 | 178 | 21 | `editImpact` traced `Engine.step` @Measure a small batch |
| 768×1024 | 333 | 333 | 18 | `GPT2Tokenizer.create` merges @load |
| 1440×900 | 201 | 201 | 13 | `exportFor` @Lower to gates |

Raw / paint (not gated): mobile raw max 684 p95 460, paint/GL 684, gl-init 684. Tablet raw 1230 / 379, paint 906, gl-init 618. Desktop raw 1129 / 365, paint 1129, gl-init 1129. Scripts still between 100 and 200 ms on that run, which fails p95 whenever fewer than 20 frames are at least 50 ms: mobile dot-product tour 178, `lab-v16.js` import 137, weight snapshot 102; tablet SVG export 187, grok live 114.

- `test/science.test.mjs` fetches the pinned TinyStories-8M files when they are missing and fails if that download fails. It passed 8/8 after `node tools/fetch-model.mjs`.
- 104 of 505 files in [AUDIT_INDEX.md](AUDIT_INDEX.md) are reviewed (20.6%).

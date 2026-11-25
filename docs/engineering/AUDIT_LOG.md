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
| AUD-047 | 47 | `src/lab-tsotchke.js` `taylorJet`; `src/lab-research.js` `statsHeads`; `src/model.js` `copyWeightsIntoYield` | high | On preview `3d36ace`, mobile app max was 628 ms and tablet 621 ms. The scripts were `forwardAsync` and `ceJetLnf` inside the Taylor jet, `docCE` inside the head study, and a 262144-float weight copy. | `d81bc83` | `test/audit-hardening.test.mjs`. The jet and the head study run in `engine-worker.js` and return the coefficients or the CE vectors. Main-thread copies are 8192 floats. |
| AUD-048 | 48 | `.github/workflows/release.yml` | medium | The TinyStories cache key was `tinystories-model-v1`, so a pin change could reuse the wrong files. The key is now the pinned `model.safetensors` SHA-256. `fetch-model.mjs` still runs, and `test/science.test.mjs` still throws if the file is missing. | `d81bc83` | `test/audit-hardening.test.mjs` |
| AUD-049 | 49 | `docs/STEERING_GUIDE.md` | low | The beginner guide said the weight download is about 80 MB. The pinned file is 112377544 bytes. | `d81bc83` | `test/audit-hardening.test.mjs` |
| AUD-050 | 50 | `tools/a11y.mjs:3` | low | The axe helper only read `/workspace/neuralese/node_modules/axe-core/axe.min.js`, a path from an old checkout. It now uses this repo's `node_modules` and still accepts that older path. | `ba651a9` | the file throws a clear error when axe-core is absent |
| AUD-051 | 52 | `src/tokenizer.js` `create`; `src/app.js` boot | high | Building the merge Map on the main thread was a 354–361 ms script, and yielding every line kept the shell from mounting within 240 s. The page now loads a precomputed rank table (`src/bpe-ranks.bin`, 50,000 unsigned pair keys). The v17 shell mounts before the weights, with a loading line, and adopts the panes when `neuralese:ready` fires. | `12f4fbc` | `test/audit-hardening.test.mjs` encodes the same sentence from the binary and from `merges.txt` |
| AUD-052 | 52 | `src/style.css` `header#top button` | high | In the light theme the button text and the button fill were both `#0b1220` (contrast 1:1). The dark id rule beat the grouped light-theme shorthand. Header buttons now set color and background-color separately. Settled contrast is 17.9:1 dark and 18.7:1 light, including dense layout, at 768 and 1440. | `12f4fbc` | computed style after the color transition |
| AUD-053 | 54 | `src/tokenizer.js` inverse vocab; worker `onmessage` handlers | high | The page built the inverse vocab in a worker and the `onmessage` handler materialized the tables. The inverse now ships as `src/vocab-inv.bin` (offset table plus token bytes). The page keeps the typed-array views and decodes a token string into a 48-entry cache when it is asked for. Engine steps, chart export, the lens JSON loader, and the MoE cloud already transfer buffers. The notebook and fine-tune handlers receive short prints or a 1,536-number theta. | `1abdd5a` | `test/audit-hardening.test.mjs` |
| AUD-054 | 54 | `ui/src/panels/Walk.tsx` Voltage; `src/walk/cmos.js` | high | Clicking Voltage ran the transfer curve and the 3D update in the click. The curve now yields every 8 points, and the stage places 8 blocks per frame. A yielded curve matches one full curve. | `1abdd5a` | `test/audit-hardening.test.mjs` |
| AUD-055 | 63 | `src/coop.js` `runBudgeted` | high | Fixed slice sizes (32768 floats, every 8 curve points, every 128 vocab keys, every 1024 unembed rows) still left a script over 200 ms on a slower device, because the slice was a count. `runBudgeted(iter, {budgetMs: 8})` reads `performance.now()` and yields with `scheduler.yield()`, then `MessageChannel`, then `requestAnimationFrame`. Startup, weight fill, the TPU stepper, gate export, Voltage, vocab, ACDC, and the other sliced loops call it. | this change | `test/budget.test.mjs` |
| AUD-056 | 56 | `src/agent/schema.js`, `src/agent/launch.js` | info | The lab store rejects org, acl, and role fields. A remote launch with an empty URL returns an error and does not invent metrics. Walk and adversary jobs say the weights are not loaded instead of returning a fake score. | no code change | existing agent tests |
| AUD-057 | 57 | `src/forge/bits.js`, `src/forge/host.js` | info | Gadget arithmetic stays on 0/1 combinations. `forwardOnce` times a host step and does not write those bits into the residual. The greedy sample says the model is not trained to emit NestLang. | no code change | `test/forge.test.mjs` |
| AUD-058 | 58 | `src/arch/remote.js` | info | A range response that is not 206 is sliced back to the requested bytes, so a full GET does not become the tensor. | no code change | no new test |
| AUD-059 | 59 | `src/gpu/webgpu-engine.js` `uploadYield` | medium | The yielded upload wrote 262144 floats per `writeBuffer`. That count is now one float per step, and `runBudgeted` decides the pause. | this change | `test/budget.test.mjs` covers the scheduler. The GPU upload itself is not asserted. |
| AUD-060 | 60 | `src/notebook-worker.js` | info | The cell worker accepts weight chunks and a run. It throws if the cell asks for the editor, the tokenizer, a commit, or a tab change. Printed typed arrays are capped at 64 elements. | no code change | no new test |
| AUD-061 | 61 | `src/ui152.js` | info | `classifyGpu` maps software renderers to low. `initialTheme` keeps a saved light or dark choice and otherwise follows the OS. | no code change | existing UI tests if present |
| AUD-062 | 62 | `src/forge/isa.js` | info | The encoding is 4-bit op, 3-bit registers, 3-bit funct, 16-bit immediate. `padRom` stops at 256 words. | no code change | `test/forge.test.mjs` |
| AUD-065 | 65 | `docs/KANBAN.md` | info | The board is still a solo list. The in-progress item is the live bug list and the preview click-all, which this change is part of. | no code change | no new test |
| AUD-066 | 66 | `src/forge/cells.js` | info | The eight frozen cells and the five bad programs are the comparison set. `programFor` emits NestLang for mul, add, and sub and throws on any other op. | no code change | `test/forge.test.mjs` |
| AUD-067 | 67 | `src/frontier/core.js` | info | `randomInit` uses N(0, 0.02²) with LayerNorm gain 1 and bias 0. `bootCI` is a percentile interval. `tLess` uses the regularized incomplete beta, not a normal tail. | no code change | frontier tests |
| AUD-068 | 68 | `src/adversary/prereg.js` | info | A locked adversary pre-registration is frozen. `revise` returns a new version. The hash omits `sha256`, `locked`, and `locked_at`. | no code change | adversary tests |
| AUD-069 | 69 | `src/forge/nestlang.js` | info | Unmarked bindings are affine. `rec` is the only loop and its counter must be `nat`. RAM word 255 is compiler scratch. | no code change | `test/forge.test.mjs` |
| AUD-070 | 70 | `src/frontier/mind.js` | info | PCI, ignition, and the Hill fit are operational proxies. The file says they are not a consciousness claim. | no code change | frontier tests |
| AUD-035 | 35 | `src/linalg.js:21` | info | One-sided Jacobi SVD of a 3×3 matrix reconstructs it within 1e-8 and returns singular values in descending order. | no code change | `test/audit-hardening.test.mjs` |
| AUD-036 | 36 | `src/` first-party scripts | info | `eval` and `new Function` appear only under `src/vendor` and `src/hub/vendor`. | no code change | `test/audit-hardening.test.mjs` |

## Open

- Preview of `a592537` shares one 8 ms frame budget and waits for the next paint with `requestAnimationFrame`, then a `MessageChannel` post. Workers 1. A separate load check found every manifest panel in all 13 workspaces. The click sweep still missed panels on mobile, so that width clicked 198. Tablet and desktop screenshots succeeded. Console errors 0. Axe was not in the failure list. App max is 218 / 247 / 228. That is under `e7c4f7e` on mobile (305) and over it on tablet (220) and desktop (223). p95 is 72 / 80 / 79.

| Width | Clicked | Disabled | Console | Axe | Cosmos | #gl | Raw max | Raw p95 | Paint/GL max | App max | App p95 | Worst |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 390×844 | 198 | 11 | 0 | none in the failure list | 390×657 | 390×477 | 609 | 289 | 609 | 218 | 72 | Index, `setTimeout` handler, 191 ms |
| 768×1024 | 231 | 11 | 0 | none in the failure list | 388×425 | 373×571 | 1210 | 306 | 1210 | 247 | 80 | Attention scores, `setTimeout` handler, 188 ms |
| 1440×900 | 231 | 11 | 0 | none in the failure list | 737×368 | 709×489 | 1347 | 476 | 1347 | 228 | 79 | Logits, `setTimeout` handler, 181 ms |

- Preview of `aca26b0` is the run with `runBudgeted`. Workers 1. The model becomes ready. The gate does not pass. `scheduler.yield()` continuations still share a frame, so the frame sum is far above one 8 ms slice. Mobile also lost panels while those continuations were in flight, so the click count is 25. Tablet died on a screenshot before it recorded a frame table. Console errors were 0 on the widths that recorded. Axe was not in the failure list.

| Width | Clicked | Disabled | Console | Axe | Cosmos | #gl | Raw max | Raw p95 | Paint/GL max | App max | App p95 | Worst |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 390×844 | 25 | 0 | 0 | none in the failure list | 390×607 | 390×478 | 4486 | 135 | 4486 | 1753 | 264 | batch runner, `Scheduler.yield` continuation, 1660 ms |
| 768×1024 | — | — | — | — | — | — | — | — | — | — | — | screenshot threw before the frame table |
| 1440×900 | 246 | 5 | 0 | none in the failure list | 737×350 | 709×490 | 1522 | 497 | 1389 | 1277 | 482 | attention button, many `Scheduler.yield` continuations in one frame |

- Preview of `e7c4f7e` is the latest finished 3-width run. Workers 1. Console errors 0. Axe is clean. The inverse vocab is a binary and the Voltage curve yields. The gate still fails. The worst script is the startup continuation after the weight copy (305 ms mobile). Tablet and desktop are 220 and 223 ms, an export while a zoom button is current.

| Width | Clicked | Disabled | Console | Axe | Cosmos | #gl | Raw max | Raw p95 | Paint/GL max | App max | App p95 | Worst |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 390×844 | 514 | 9 | 0 | none | 390×607 | 390×445 | 741 | 456 | 741 | 305 | 305 | startup after the weight copy |
| 768×1024 | 489 | 9 | 0 | none | 388×407 | 373×551 | 1166 | 471 | 1166 | 220 | 220 | @TPU MAC stuck-at |
| 1440×900 | 514 | 9 | 0 | none | 737×350 | 709×469 | 1748 | 482 | 1748 | 223 | 223 | export @Lower to gates |

- Preview of `a81f36c` is the latest finished 3-width run. Workers 1. Console errors 0. Axe is clean at all three widths. The shell is on screen in under a second, before the weights. The gate still fails on application script. The worst script is the worker message that delivers the inverse vocab (315 ms mobile, 328 ms desktop). Tablet's worst is 183 ms. With only 3–7 frames at or above 50 ms, p95 is the same as the max.

| Width | Clicked | Disabled | Console | Axe | Cosmos | #gl | Raw max | Raw p95 | Paint/GL max | App max | App p95 | Worst |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 390×844 | 514 | 9 | 0 | none | 390×607 | 390×445 | 743 | 462 | 743 | 315 | 315 | vocab worker message |
| 768×1024 | 514 | 9 | 0 | none | 388×407 | 373×551 | 1109 | 452 | 1109 | 183 | 183 | @Voltage |
| 1440×900 | 514 | 9 | 0 | none | 737×350 | 709×469 | 2321 | 464 | 2321 | 328 | 328 | vocab worker message |

- Preview of `ab1361d` was the run before the rank table. Workers 1. Console errors 0. 514 clicked, 9 disabled. Mobile passed the script gate and axe. Tablet and desktop did not. The long script is one merge-table chunk inside `GPT2Tokenizer.create` (354 ms tablet, 361 ms desktop). Axe is `color-contrast` on `#bTheme` (tablet) and `#bDense` (desktop). Yielding every merge line kept the shell from mounting within 240 s, so the yield is every 8 lines again.

| Width | Clicked | Disabled | Console | Axe | Cosmos | #gl | Raw max | Raw p95 | Paint/GL max | App max | App p95 | Worst |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 390×844 | 514 | 9 | 0 | none | 390×658 | 390×478 | 713 | 361 | 713 | 178 | 81 | export @Voltage |
| 768×1024 | 514 | 9 | 0 | contrast 5, `#bTheme` | 388×426 | 373×572 | 1618 | 384 | 1618 | 354 | 99 | tokenizer merges |
| 1440×900 | 514 | 9 | 0 | contrast 6, `#bDense` | 737×369 | 709×490 | 1594 | 367 | 1594 | 361 | 116 | tokenizer merges |

- Preview of `3d36ace` finished, workers 1, 0 console errors, 514 clicked and 9 disabled at each width. It failed. App max 628 / 621 / 624 ms. Mobile and desktop axe were clean. Tablet axe was `color-contrast:5`, first node `#bTheme`. The long scripts were the Taylor jet, the head-study loss, and the weight copy. `d81bc83` moves the jet and the study into the engine worker.

| Width | Clicked | Disabled | Console | Axe | Cosmos | #gl | Raw max | Raw p95 | Paint/GL max | App max | App p95 | Worst |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 390×844 | 514 | 9 | 0 | none | 390×658 | 390×478 | 646 | 527 | 646 | 628 | 535 | taylorJet forwardAsync |
| 768×1024 | 514 | 9 | 0 | contrast 5, first `#bTheme` | 388×426 | 373×572 | 1344 | 519 | 1194 | 621 | 547 | taylorJet forwardAsync |
| 1440×900 | 514 | 9 | 0 | none | 737×369 | 709×490 | 1137 | 385 | 1137 | 624 | 514 | taylorJet forwardAsync |

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
- 158 of 505 files in [AUDIT_INDEX.md](AUDIT_INDEX.md) are reviewed (31.3%). Passes 68–70 read the adversary pre-registration, NestLang, and the frontier proxies.

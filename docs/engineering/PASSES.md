# Passes

Ten audit passes on the existing app. No new workspaces. Counts are bugs found and fixed in that pass. The click-everything suite is run once on the redeployed preview after these fixes, not ten times: one full run is long enough that repeating it between every one-line fix would not change the evidence.

| Pass | Area | Found | Fixed | What |
|---|---|---|---|---|
| 1 | Front end, 3D | 1 | 1 | v17.1 and v17.2 both set `body.v17-on #gl { visibility: hidden }` and cover the page with `#v17`, so the bloom / depth-of-field stage never showed. `#gl` is docked into the viz and 3D-modes panel and resized from that box. |
| 2 | Front end | 1 | 1 | The header is 44px and the shell started at 34px, so the header covered the top of the workspace bar. `#v17` now starts at 44px. |
| 3 | Front end | 1 | 1 | `preserveDrawingBuffer` is on for the legacy WebGL renderer, so a pixel read after a frame is not a cleared buffer. |
| 4 | Front end | 1 | 1 | Clearing the layer box produced `NaN` and a thrown `RangeError` from the selection store. Non-integers are ignored. Head and neuron already treated an empty box as null; that path now also ignores junk. |
| 5 | Front end, accessibility | 3 | 3 | Undo, redo, and dense were icon-only. They have accessible names. |
| 6 | Front end | 1 | 1 | `guard` logged caught, already-toasted failures with `console.error`, so a normal "nothing to export yet" looked like a crash. It warns and yields once first. |
| 7 | Engine / worker | 4 | 4 | A non-object worker message crashed the handler. `step`/`steps`/`beam`/`kvgeom` on a missing sequence or engine threw a raw TypeError. `steps` with an empty token list did the same. `free` without `sids` threw. Each now returns `{id, err}` or no-ops. |
| 8 | Engine client | 1 | 1 | `onmessage` read `.id` before checking the payload. A non-object message (the worker's `{ready:true}` is an object, a stray value is not) threw and could drop later replies. Non-replies are ignored. |
| 9 | Data, server, Electron packaging | 6 | 6 | `decodeURIComponent` on a bad `%` rejected the protocol handler and the dev server. `path.join` plus `startsWith(ROOT)` treats `/app/www-evil` (reachable as `/%2e%2e%2fwww-evil`) as inside `/app/www`. `safeAppPath` rejects both, and the static server uses it. A `Range` that starts past the file made the read stream error. A corrupt `neuralese.term.hist` threw while building the terminal, and a full `localStorage` threw on the next command. Both are ignored. |
| 10 | Visual | 2 | 2 | The page background was a radial gradient and the loader bar glowed. Both are flat now. Tokens, fonts, and the 3D stage stay. |

While the click-everything run was failing on the Model workspace, one more bug turned up. `document.startViewTransition` throws if a transition is already running, and workspace changes go through that API. A second click (a legacy `showTab` while the bar is still animating) threw and the workspace did not change. `viewTransition` now runs the update anyway.

The suite was run once, on the preview, after these fixes. It was not repeated between each pass: one pass is a few lines, and one full click of every control takes about 36 minutes. Result of `PREVIEW_URL=https://0thernes.github.io/neuralese/preview/?notour npx playwright test` on 4 Nov 2026: **1 passed (35.9m)**. Each of mobile 390×844, tablet 768×1024, and desktop 1440×900 clicked 580 enabled controls, left 10 disabled controls alone, had an empty console-error list, and a fresh load showed a non-blank cosmos (658px, 455px, 398px tall) and a non-blank docked `#gl`. Output: `test/e2e/click-all-output.json`.

## Further passes

| Pass | Area | Found | Fixed | What |
|---|---|---|---|---|
| 11 | Engine / worker | 5 | 5 | Analyze, SAE training, residual patching, head patching, and ROME ran as long synchronous stretches. They now run in the engine worker (`heavy` op) with progress messages and cancel (`Stop` and the SAE stop button). The main-thread fallback, SVD, and the patch loops return to the event loop every 32ms via `slice()`. |
| 12 | Data, packaging | 2 | 2 | The page tracker (`neuralese.runs.v5`) and the CLI lab (`lab.json`) were different shapes. New page runs are mirrored into `createLab` (`neuralese.lab.v1`). Export lab store downloads that file. `node tools/agent.mjs --lab DIR import --file neuralese-lab.json` loads it. The first preview of that import 404'd, because `src/agent/` was not in the static file set. `agent` is now copied with the rest of the web root. |
| 13 | Tests | 1 | 1 | `test/zoo.test.mjs` threw ENOENT when `model/ts1M.safetensors` was absent. It now runs `tools/fetch-model.mjs` and, if that does not produce the file, skips with that reason. |
| 14 | Security | 1 | 1 | Notebook cells were page-origin modules with the full lab API. They now run in `notebook-worker.js` with weight copies, `research`, `docs`, `print`, and `plot`. No DOM, no editor, no `commit`. |
| 15 | 3D, accessibility | 6 | 6 | Cosmos and the nested view could finish `createStage` after unmount and leak the context. Nested `scene.clear()` dropped geometries without `dispose()`. Axe reported a prohibited `aria-label`, separator values, a tablist whose tabs were wrapped, and contrast on the version badge, the weight hash, and the HACKED chip. |
| 16 | Visual | 3 | 3 | Panels, tables, and buttons did not share one size or tabular figures. The docked stage was capped so the controls took 46% of the panel. Fieldsets, tables, and buttons now use the same tokens, and the stage host is at least 320px with controls capped at 34%. Bloom and depth of field stay on the legacy renderer; adaptive quality still drops them when the GPU tier is low. |

Screenshots of overview, the model stage, and the lens, before this pass and after, are in the pull request. The before set is the previous preview. The after set is this build.

The sharded preview run after passes 11–16 did not stay at 100%. Three Playwright workers against https://0thernes.github.io/neuralese/preview/?notour crashed the desktop target, left `legacy:land` and the model tabs inactive at check time, and recorded main-thread tasks of 500–1000 ms.

| Pass | Area | Found | Fixed | What |
|---|---|---|---|---|
| 17 | Main thread, navigation, tests, dependencies | 8 | 7 | The weight checksum was one 205 ms scan. Embedding Gram, composition, the loss slice, and superposition were single tasks of 2 s, 82 s, 3 s, and 5 s. Fisher was one 9 s task. The neuron hunt and the geometry run were one traced `eng.run`. Chart heatmaps above 4096 cells now paint through an OffscreenCanvas in 16 ms slices. Notebook weights are copied in 256 KB slices and transferred. `npm audit` (no `--force`) is 0 vulnerabilities. |

`showTab` from a control is supposed to open that tab. The shell was applying the workspace change inside `startViewTransition`, whose callback runs on a later frame, so at check time the dock still showed the previous panel (`legacy:land` inactive, model tabs not active) even though the click had asked for them. That was a stale update, not the product behavior. `viewTransition` now applies the workspace and panel immediately. The click suite also opens the intended panel and clicks its controls in the same turn, and it yields between controls so one panel is not a single task. Playwright `workers` is 1: three SwiftShader browsers were what crashed the desktop target. This run used one browser and finished all three widths.

One `npx playwright test` on https://0thernes.github.io/neuralese/preview/?notour (commit `654a4cf`, 4 Nov 2026), workers 1:

| Width | Clicked | Disabled | Console errors | Axe serious/critical | Cosmos | `#gl` | Long-task max | p95 (of tasks ≥ 50 ms) | n ≥ 50 ms |
|---|---|---|---|---|---|---|---|---|---|
| Mobile 390×844 | 582 | 9 | 0 | none | 390×658 | 390×478 | 1970 ms | 728 ms | 1011 |
| Tablet 768×1024 | 582 | 9 | 0 | none | 388×426 | 373×572 | 4823 ms | 773 ms | 1112 |
| Desktop 1440×900 | 582 | 9 | 0 | none | 737×369 | 709×490 | 2126 ms | 804 ms | 1280 |

The run did not pass. The gate is no task of 200 ms or more. 50 ms is still the goal, and the p95 of tasks that already last at least 50 ms is 728–804 ms. Isolated checks after the yields: attention 69 ms, analyze 77 ms, composition 127 ms, Fisher 122 ms, the hunt and the geometry run 0 tasks ≥ 200 ms. The suite still records 200–1400 ms tasks on chart export, hub model load, calibration, the parameter sweep, and safetensors-sized copies, and one task per width of 2–5 s. The root site was not replaced (`/` still serves `2527d67`). No tag and no release.

Remaining after that run: chart export, hub loads, calibration, the parameter sweep, large copies, and one 2–5 s task per width.

| Pass | Area | Found | Fixed | What |
|---|---|---|---|---|
| 18 | Main thread | 6 | 5 | Long Animation Frames named the 2–5 s task. It was not one function. `slice()` used `setTimeout(0)`, and Chrome ran the whole chain before the next paint, so a calibration or a sweep was one frame (tablet raw max 4823 ms) whose scripts were `coop.js` `TimerHandler:setTimeout`. `scheduler.yield()` still packed several of those continuations into one frame. `slice()` now waits for a paint, and only one continuation is queued per paint. The weight hash streams SHA-256 instead of copying every tensor into one buffer. The sweep blend, the attention CSV, and the fine-tune copy yield between slices. Calibration, the sweep, and the attention CSV then stayed under 200 ms of application script in an isolated check (calibration p95 88 ms, sweep max 81 ms). |

The same click suite, one browser, on https://0thernes.github.io/neuralese/preview/?notour (commit `1dbea11`, 4 Nov 2026). The gate was not raised. A frame is excluded only when its application script is under 50 ms, which is a SwiftShader paint or a WebGL render callback (`viz.js` `loop`, or `shell.js` `import.then` next to a stage frame callback — renderer init). Those frames are still printed. Everything else is gated: application-script max under 200 ms and p95 under 100 ms. If Long Animation Frames were missing, the gate would fall back to raw long tasks and say paint could not be separated.

| Width | Clicked | Disabled | Console errors | Axe serious/critical | Cosmos | `#gl` | Raw max | Raw p95 | Paint/GL max | App max | App p95 | Worst application script |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mobile 390×844 | 582 | 9 | 0 | none | 390×658 | 390×478 | 2050 ms | 862 ms | 646 ms | 2035 ms | 1215 ms | `measure` · Measure a small batch |
| Tablet 768×1024 | 582 | 9 | 0 | none | 388×426 | 373×572 | 2367 ms | 549 ms | 948 ms | 2365 ms | 1225 ms | `measure` · Measure a small batch |
| Desktop 1440×900 | 582 | 9 | 0 | none | 737×369 | 709×490 | 2815 ms | 548 ms | 1358 ms | 2811 ms | 1012 ms | `measure` · Measure a small batch |

The run did not pass. The 2–5 s offender, on every width, is the Machine Room button **Measure a small batch** (`measure` in `src/machine/machine.js`). The Long Animation Frames entry is an anonymous `TimerHandler:setTimeout` of 2035 / 2365 / 2811 ms, and the control recorded on that frame is that button. The same run's next scripts are Run, MoE-in-MoE, Lower to gates, the terminal Run, and a Forge trace step. Paint/GL max is the SwiftShader stage (`shell.js` `import.then` up to 874 ms on desktop, and `viz.js` `loop` 343 ms on mobile) and is not in the app columns. The root site was not replaced (`/` still serves `2527d67`). No tag and no release.

| Pass | Area | Found | Fixed | What |
|---|---|---|---|---|
| 19 | Main thread | 6 | 6 | Measure, machine Run, Forge Run, lane contrast, Lower to gates, and the MoE point cloud run in `mf-worker.js`. The page gets a structured clone (MoE positions are transferred) plus progress and cancel. A Forge trace step asks the worker for that step's RAM instead of keeping every image on the page. The trace list shows the steps around the cursor. Spectral reports for one matrix go through the same worker. |

One `npx playwright test`, workers 1, on https://0thernes.github.io/neuralese/preview/?notour (commit `f71474c`, 4 Nov 2026). Same gate as pass 18: application-script max under 200 ms and p95 under 100 ms. Paint/GL frames (application script under 50 ms, including a stage `import.then` next to a render callback) are printed and not gated. Root site still `2527d67`. No tag and no release.

| Width | Clicked | Disabled | Console errors | Axe serious/critical | Cosmos | `#gl` | Raw max | Raw p95 | Paint/GL max | App max | App p95 | Worst application script |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mobile 390×844 | 515 | 8 | 1 cache write | none | 390×658 | 390×478 | 2432 ms | 835 ms | 473 ms | 2424 ms | 1175 ms | Measure a small batch |
| Tablet 768×1024 | 514 | 9 | 0 | none | 388×426 | 373×572 | 2354 ms | 466 ms | 887 ms | 2353 ms | 899 ms | Measure a small batch |
| Desktop 1440×900 | 515 | 8 | 0 | none | 737×369 | 709×490 | 2200 ms | 512 ms | 890 ms | 2199 ms | 1085 ms | Measure a small batch |

The run did not pass. An isolated click of Measure a small batch, after the worker was warm, did not produce an application script over 50 ms (the 2.6 s of compute stayed in the worker). In the full suite the longest frame is still labeled Measure a small batch: an anonymous `TimerHandler:setTimeout` of 2424 / 2353 / 2199 ms. The next names in that run are fmLive, Clock one, Bible, Index, terminal Run, Run contrast, and the camera presets. Mobile also logged one `net::ERR_CACHE_WRITE_FAILURE`. Axe stayed clean.

| Pass | Area | Found | Fixed | Notes |
|---|---|---|---|---|
| 20 | Main thread | 6 | 5 | The 2.2 s Measure frame is the suite's empty-URL `setTimeout` continuation, not the worker. Cold `new Worker()` was 0–1 ms at load, and `postMessage` does not block while the worker is busy. `el.click()` itself stayed under 60 ms. PCI (including random-init), one host forward, and the greedy sample now run in the engine worker. The weight hash yields every 512 KB. Undoing the claim's edit copies weights in slices. Course, Bible, glossary, and the index append across paints. Camera presets use a cached viewport and do not walk instanced meshes. The hub embedding renderer is created on a frame callback. |

One `npx playwright test`, workers 1, on https://0thernes.github.io/neuralese/preview/?notour (commit `3b22ec7`, 5 Nov 2026). Same gate. Root site still `2527d67`. No tag and no release.

| Width | Clicked | Disabled | Console errors | Axe serious/critical | Cosmos | `#gl` | Raw max | Raw p95 | Paint/GL max | App max | App p95 | Worst application script |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mobile 390×844 | 514 | 9 | 0 | none | 390×658 | 390×478 | 1349 ms | 828 ms | 828 ms | 1348 ms | 1097 ms | Measure a small batch |
| Tablet 768×1024 | 489 | 9 | 0 | none | 388×426 | 373×572 | 1346 ms | 594 ms | 1346 ms | 1170 ms | 1095 ms | Measure a small batch |
| Desktop 1440×900 | 515 | 8 | 0 | none | 737×369 | 709×490 | 1184 ms | 661 ms | 1184 ms | 1086 ms | 1022 ms | clGo |

The run did not pass. Application-script max is about half of pass 19 (1348 / 1170 / 1086 ms, down from 2424 / 2353 / 2199 ms) and is still over 200 ms. p95 of frames with application script ≥ 50 ms is still about 1 s. On mobile and tablet the longest script is still an anonymous `TimerHandler:setTimeout` labeled Measure a small batch (1348 ms and 1170 ms). Desktop's longest is the same kind of timer labeled clGo (1086 ms), with Measure at 1022 ms in that run's top. Layout and pause inside those scripts were 0. Axe stayed clean and there were no console errors. fmLive, Clock one, Bible, Index, and terminal Run are no longer the top names. MoE-in-MoE, camera presets, csv, and png still appear above 200 ms.

| Pass | Area | Found | Fixed | What |
|---|---|---|---|---|
| 21 | Main thread | 8 | 6 | Empty-URL `setTimeout` entries were mapped with `sourceURL`, `sourceFunctionName`, `sourceCharPosition`, `invoker`, a yield stack, and a mark around each click. The long continuations were `exportFor`, `embedGram`, `fsdist` / `qgMetric`, the WeightWatcher SVD, composition precompute, SVD drop/scale, quantize, `evalSuite`'s unembedding, nearest-token search, and the hub test-card readback. Those yield or run in a worker. The table is `test/e2e/attribution.md`. |

One `npx playwright test`, workers 1, on https://0thernes.github.io/neuralese/preview/?notour (commit `b1704d0`, 5 Nov 2026). Same gate. Root site still `2527d67`. No tag and no release.

| Width | Clicked | Disabled | Console errors | Axe serious/critical | Cosmos | `#gl` | Raw max | Raw p95 | Paint/GL max | App max | App p95 | Worst application script |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mobile 390×844 | 514 | 9 | 0 | none | 390×658 | 390×478 | 701 ms | 428 ms | 701 ms | 418 ms | 418 ms | `learn.js` `import.then` |
| Tablet 768×1024 | 489 | 9 | 0 | none | 388×426 | 373×572 | 1342 ms | 539 ms | 1342 ms | 286 ms | 286 ms | `Response.arrayBuffer.then` @clGo |
| Desktop 1440×900 | 514 | 9 | 0 | none | 737×369 | 709×490 | 1049 ms | 460 ms | 1049 ms | 319 ms | 319 ms | `TimerHandler:setTimeout` @Neuron Lens |

The run did not pass. Application-script max is 418 / 286 / 319 ms, down from 1348 / 1170 / 1086 ms. p95 equals that max because only 13–16 frames have application script ≥ 50 ms, and `ceil(0.95*n)-1` is the last index when n is under 20. Mobile's 418 ms script is evaluating `learn/learn.js` (`import.then`), and that frame has no GL callback, so it stays in the app column. Tablet's 286 ms script is a fetch body continuation labeled clGo. Desktop's 319 ms script is an empty-URL `setTimeout` labeled Neuron Lens. Axe stayed clean and there were no console errors.

Edge-level ACDC, MEMIT, UMAP, and t-SNE were never shipped tabs. The 43 P0 cards are not implemented. Electron and Capacitor release builds were not packed here. `contextIsolation` is already on in `desktop/main.cjs`.

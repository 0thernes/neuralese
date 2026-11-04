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

Remaining: those long tasks. Edge-level ACDC, MEMIT, UMAP, and t-SNE were never shipped tabs. The 43 P0 cards are not implemented. Electron and Capacitor release builds were not packed here. `contextIsolation` is already on in `desktop/main.cjs`.

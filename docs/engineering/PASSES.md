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

`npm audit` reports 7 moderate vulnerabilities and no high or critical ones. They are in the existing dependency tree. This pass did not run `npm audit fix --force`.

The sharded preview run after these passes did not stay at 100%. Three Playwright workers against https://0thernes.github.io/neuralese/preview/?notour :

- An earlier tablet shard on this same preview passed: 582 controls clicked, 9 disabled, 0 console errors, 0 long tasks, cosmos 388×426, docked `#gl` 373×572. Axe ran before the clicks and did not report a serious or critical violation.
- The last three-shard run failed. Desktop still clicked 580 controls with 0 console errors and non-blank cosmos (737×369) and `#gl` (709×490), and recorded main-thread tasks of 92, 852, 572, 857, 521, 238, 76, and 869 ms. Mobile's longest sampled tasks included 1026 ms. One circuits tab (`legacy:land`) and the model tabs were not the active panel when the check ran, because a control had called `showTab` and the shell was on surgery or geometry. One desktop target crashed in an earlier parallel attempt.

Remaining: some chart draws and a single forward still exceed 50 ms on the main thread when three browsers share the machine. Edge-level ACDC, MEMIT, UMAP, and t-SNE were never shipped tabs. Copying weights into the notebook worker can be a long task. The 43 P0 cards are not implemented. `npm audit` reports 7 moderate advisories and no high or critical ones. Electron and Capacitor release builds were not packed here. `contextIsolation` is already on in `desktop/main.cjs`.

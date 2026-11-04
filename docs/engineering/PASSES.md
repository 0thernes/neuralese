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

Remaining, not fixed in these passes: long CPU buttons (analyze, SAE train, the fault study) still block the main thread after the first yield, so a click-everything run is slow. Edge-level ACDC, MEMIT, UMAP, and t-SNE were never in v12–v17.3. The page lab and the CLI lab are still two stores. Notebook cells still run arbitrary JS by design.

# Click-suite attribution

Long Animation Frame script entries for application script over 50ms. Button text is the control the suite had reached when the frame ended. The function is the yield stack recorded at `frame()` / `slice()`, or the click handler that resumed in that window. Empty `sourceURL` and `TimerHandler:setTimeout` are the native resolver passed to `setTimeout`: the duration is the promise continuation, not the timer callback (`timerMs` 0).

## What the long timers were

| Continuation | Why the button label was wrong | What changed |
|---|---|---|
| `exportFor` in the document click listener (`v5.js`) | CSV / PNG / SVG export keeps running after the suite has moved on | Chart `_csv` builders yield while they format rows. PNG `toBlob` runs inside `requestAnimationFrame`. A large attention grid returns chunk strings and the download `Blob` is built from those parts. |
| `embedGram` from `out.eigen` / `out.mode('circuit')` | The frame was labeled with a later button (`fcGo`) | The Gram accumulator yields every 32 tokens instead of every 512. |
| `out.fsdist`, `out.qgMetric` | Labeled Measure. Two synchronous `forward`s, then a full-vocabulary logit matvec, ran before the first yield | `forwardAsync`, and the unembedding matvec yields every 1024 rows. |
| `out.ww` (`C.spectral`) | Labeled csv | The WeightWatcher scan calls the existing spectral worker. |
| `compositionScores` | Labeled fmLive | Head precompute yields per head. |
| SVD drop / scale `weightEdit` → `ed.push` | The synchronous Jacobi SVD and reconstruct | `commitAsync` + `pushAsync`, reconstruct yields every 4 singular components. |
| Quantize preview | One loop over every selected matrix | Yields after each matrix. |
| `evalSuite` → `tokenCE` / `logitsAt` / `greedy` | Labeled Measure. One document's unembedding, or one 40-step greedy run, was a single continuation | `logitsAtAsync` yields every 1024 rows. Generations yield every step. |
| `nearestTokens` / `pcaK` (`out.embed`, `out.embmap`) | Full-vocabulary scan and the covariance, uninterrupted | Async copies yield through the scan and the covariance. |
| `out.hubInterp` `pixels` | `getImageData` of the test card | The test card is drawn and normalized in a worker. |
| OCR / CLIP test cards | `fillText` / arc on the main thread | Drawn on an `OffscreenCanvas` in a worker. |
| Frontier `Response.json` | Labeled fxGo. Cached fetches continued in one checkpoint, and the atlas render followed the parse | Files are read in chunks with a paint yield, then parsed. |
| `models.f32` (`nxRead`) | One `arrayBuffer` of the 1.5MB weight file | HTTP Range reads of 64KB. |
| `audio.start` | `AudioContext` plus the impulse response | Yields after the impulse and after the pad oscillators. |
| Workspace quick buttons (Neuron Lens, Nested, Attention) | Labels on a `setTimeout` from the suite's paint helper. `showTab` itself returns in a few milliseconds. The long script is the shell update that follows the click, and it has no source URL | Panels adopt their legacy DOM on a later timer so one click does not reparent every pane. |

## Latest local desktop run

`E2E_VIEW=desktop` against `http://127.0.0.1:8765/?notour`, one worker, SwiftShader. Gate unchanged: app-script max under 200ms, app-script p95 under 100ms. p95 is `sorted[min(n-1, ceil(0.95*n)-1)]` over frames whose application script is at least 50ms. With n under 20 that index is the max, so every app script has to be under 100ms.

| | |
|---|---|
| Raw frame | max 1510ms, p95 472ms, n 285 |
| Paint / GL | max 1510ms, n 270. gl-init max 576ms (`stage-Y_8XXUk9.js` FrameRequestCallback) |
| App script | max 309ms, p95 309ms, n 15. **Fails the gate.** |

App scripts still at or over 100ms in that run:

| ms | Invoker | Click label when the frame ended | Named continuation |
|---|---|---|---|
| 304 | `TimerHandler:setTimeout` | Nested quick button | No yield stack. Handler window matched the export listener; the timer was the suite paint helper. |
| 242 | `TimerHandler:setTimeout` | Neuron Lens quick button | Same shape as the row above. |
| 198 | `Response.arrayBuffer.then` | fxGo | Fetch body continuation. Source URL `index.html`, no function name. |

Everything else in that run was under 100ms (audio start 94ms, weight snapshot 74ms).

## Preview, three widths

One `npx playwright test`, workers 1, on https://0thernes.github.io/neuralese/preview/?notour at commit `b1704d0`. Same gate. Root site still `2527d67`.

| Width | Clicked | Disabled | Console | Axe | Cosmos | #gl | Raw max | Raw p95 | Paint/GL max | App max | App p95 | Worst |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 390×844 | 514 | 9 | 0 | none | 390×658 | 390×478 | 701 | 428 | 701 | 418 | 418 | `learn.js` `import.then` 418 ms |
| 768×1024 | 489 | 9 | 0 | none | 388×426 | 373×572 | 1342 | 539 | 1342 | 286 | 286 | `Response.arrayBuffer.then` labeled clGo, 286 ms |
| 1440×900 | 514 | 9 | 0 | none | 737×369 | 709×490 | 1049 | 460 | 1049 | 319 | 319 | `TimerHandler:setTimeout` labeled Neuron Lens, 319 ms |

The run did not pass. With 13–16 frames of application script ≥ 50 ms, p95 is the max. The mobile 418 ms script is the learning-center module evaluation (`learn/learn.js` `import.then`), which is not a paint frame because that frame has no GL callback. Tablet's 286 ms script is a fetch body continuation recorded while clGo was the label. Desktop's 319 ms script is an empty-URL `setTimeout` recorded while the Neuron Lens quick button was the label; the handler window also matched the export listener.

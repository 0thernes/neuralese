# Deep Walkthrough progress

Original workspace on the v17 shell, branched from Forge (`cursor/forge-nest-cpu-35bd`). The pull request is against that branch so the diff is the walk, not Forge itself.

## Implemented
- Workspace **Deep Walk** (no Alt digit). Panels: the 3D stage, narration and transport, cell arithmetic, zoom ladder, fault study, Forge-to-gates, and the shared selection inspector.
- One real TinyStories-8M forward, copied out of `Engine` (worker op `walk` when the worker is up). Cell hover recomputes the stored float32 with the engine’s loops. Large tensors are sampled and the caption says so.
- Zoom from the model down through a dot product, float32 fields, an AND/OR/XOR/NOT netlist, and a square-law CMOS simulation. The voltage view is labeled as a simulation. It does not undervolt hardware.
- A Forge ALU op lowers to that netlist and is checked against integer arithmetic. `LUI` is wiring. Memory ops expand the address add only.
- Pre-registered activation bit-flip study `DW-FAULT-1`. The flips are real. The write-up is `docs/DEEP_WALKTHROUGH.md`.

## Measured
Prompt `Once upon a time`, TinyStories-8M, layer-3 `resid_post`, 12 paired trials, `p = 0.05`, seed `1729 + trial + 1`.

| bit | mean KL (nats) | greedy-token change rate |
|---|---|---|
| 23 (exponent LSB) | 0.028322474748366442 | 0 |
| 0 (mantissa LSB) | 3.892656443094806e-9 | 0 |

The KL prediction holds. The greedy token did not change in any trial (id 11, `,`). Both rates are zero, so there is no token-change difference to report. `test/walk.test.mjs` re-runs the study and requires these values. Spec hash `286cfe8e0117d8e51ccf6537af52edd01b0d12b1e5299e7d86203f098fae0163`.

## Checks
`node --test test/walk.test.mjs`: pass. The existing forward-pass check against the PyTorch logits still passes. `cd ui && bun run typecheck && bun test tests`: pass.

## Not done
No tag and no release. CI stays tag and manual dispatch. Arch checkpoints are walked only when registered; the shell does not load one on its own. The CMOS model is level-1 square law, not a foundry deck and not Sakurai’s alpha-power law.

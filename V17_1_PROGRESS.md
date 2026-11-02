# v17.1 progress

Adversary Lab on the v17 shell. Branch `cursor/adversary-lab-1ffa`.

## Implemented
- Workspace **Adversary** (Alt+0) with Live geometry, Condition runner, Detector results, Neuron hunt, Steering compare, and Prereg & REPRO. Selection is shared with the rest of the shell. The 75 legacy tabs are still in the original nine workspaces.
- Key-cache SVD features, equal-length token-id padding, FWL (including a second covariate when system lengths differ), logistic AUROC, permutation p, encoding-phase leakage check, leave-one-prompt-out.
- Worker `kvgeom` on the GPT-Neo engine, cadence 8, plus prompt end and generation end. Arch forwards can return keys when asked.
- Neuron rank, random-pair steering, frozen pre-registration, REPRO bundle, notebook pin.
- Tests in `test/adversary.test.mjs`. Method write-up in `docs/ADVERSARY.md`.

## Measured
TinyStories-8M only, via `tools/adversary-measure.mjs`, about 15 seconds. Summary file `src/adversary/measured-tinystories.json`.

| check | result |
|---|---|
| Geometry verdict | leakage |
| Encoding AUROC | 1.00 (add-one p 0.015) |
| Delta in-sample AUROC | 0.953 (p 0.179) |
| Leave-one-prompt-out | 0.766 |
| Neuron rule | fail (0 vs 0, 0, 0, 0) |
| Qwen / Llama / paper-scale models | not run |

Encoding-phase separation means the system text is already visible in the prompt cache. That blocks a generation-phase claim. The neuron push did not beat random pairs on the local rubric. Both outcomes are reported as they are.

## Not done from this VM
Multi-platform installers, the tag, and the Pages deploy. Steps are in `RELEASE_NOTES.md`. CI is still tag and manual dispatch only.

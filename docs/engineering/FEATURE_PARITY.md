# Feature parity

Compared by reading `GROUPS` in `lab-ui.js` at v12.1.0 (`ffdba38`), v13.0.1, v14.9.0, v15.3.0, v16.0.1, v17.0.0, and v17.3.0.

Every tab key that appears in an older release is still a key in v17.3.0. The count grew: 65 (v12) → 72 (v14.9) → 73 (v15.3, Overview) → 75 (v16, architecture tab and encoder interp) → 75 legacy tabs plus native panels through v17.3.

| Feature | Last version that introduced it | On main | Evidence |
|---|---|---|---|
| 65-tab lab (generate through hub, frontier, Tsotchke, 3D) | v12.1.0 | present | `src/lab-ui.js` `GROUPS` |
| Neuron Lens R, S, mid, logit | v14.0.0 | present | `src/lab-lens.js` `READS`, `LENS_ORDER` |
| Nested RISC-V, SLM, MoE | v14.9.0 | present | keys `nriscv`, `nslm`, `nmoe`, `nxlens` |
| Overview home dashboard | v15.0.0 | present | key `home` |
| Encoder interpretability | v16.0.1 | present | key `hinterp` |
| Adversary, Forge, Deep Walk, Machine Room | v17.1–v17.3 | present | `ui/src/core/workspaces.ts` |
| Adaptive 3D stage (bloom, depth of field, GPU tier) | v15.1 | regressed in the v17 shell, restored by docking `#gl` | `src/viz.js` `classList.contains('docked')`, `ui/src/panels/Panels.tsx` |
| Consciousness-indicator scorecard, PCI, self-improvement | v12 (frontier) | present | keys `fsc`, `fmind`, `frsi` |
| Speech, vision, swappable LM | v12 hub | present | keys `hspeech`, `hvision`, `hgen` |
| Diffusion as a product feature | none | not a shipped feature | Moonlab's `grover_diffusion` WASM export is unused by a tab. It was not removed. |
| UMAP, t-SNE | none | missing, not previously shipped | Backlog in `docs/KANBAN.md` |

The machine-readable list is `features.json`. `node tools/check-features.mjs` fails if a release file names an id the current file dropped, or if a source tab has no id.

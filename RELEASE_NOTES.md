# Neuralese v17.1.0: Adversary Lab

Experimental cognitive-geometry and neuron tooling inside the v17 shell. Not a detector, and not a reproduction of published large-model AUROCs.

## What shipped in the app
- **Adversary** workspace (Alt+0). The original nine workspaces and all 75 legacy tabs stay where they were. The phone bar still scrolls; those nine labels are unchanged.
- Panels: Live geometry, Condition runner, Detector results, Neuron hunt, Steering compare, Prereg & REPRO, plus the shared selection inspector. Command palette entries for the workspace, the panels, and two run actions.
- Key-cache features from the paper’s flatten `(KV heads × tokens) × head dim`: spectral entropy, effective rank, top singular-value ratio, rank-10, key norm, norm per token, layer-norm entropy, layer variance. Encoding snapshot, generation snapshot, delta. FWL residualization. Logistic AUROC with an add-one permutation p, an encoding-phase leakage check, and leave-one-prompt-out from three prompts up.
- Worker op `kvgeom`, also computed on the main-thread fallback. Sampled at prompt end, every 8 generated tokens, and at the end. Beam search does not extend that sequence.
- Arch `forward(..., { keys: true })` returns the same kind of key vectors for GPT-Neo, GPT-2, Llama, and Qwen2. The campaign runner uses the GPT-Neo engine, which is the path that already keeps a KV cache in the worker.
- Neuron ranking by Cohen’s d, then a push of the top pair against random pairs. The judge is a fixed word list plus a coherence check. Pass means strictly more rubric-positive coherent completions than every random set. Activation is not treated as intent.
- Pre-registration locks before the forwards. Mutation throws. A changed plan is a new version. REPRO bundles hash themselves. A notebook pin writes a markdown cell.

## What TinyStories-8M actually did
`node tools/adversary-measure.mjs` (8 prompts, honest vs deceptive, 8 generated tokens, 200 permutations). Recorded in `src/adversary/measured-tinystories.json` and shown in the workspace as a shipped measurement, separate from a live run.

- **Geometry: leakage.** Encoding AUROC 1.00 (p 0.015). The prompt cache already separates the system lines. Delta in-sample AUROC 0.953 does not clear the permutation bar (p 0.179). Leave-one-prompt-out AUROC 0.766.
- **Neuron rule: fail.** Top pair L2 N776 and L6 N373. Steered rubric count 0, and every random pair was 0.
- No 0.5B–70B model was loaded. The paper’s AUROC range is not a result of this lab.

## Checks run here
- `npm test`: 196 passing (the previous 184 plus the adversary file).
- `cd ui && bun run typecheck && bun test tests`: clean, 17 passing.
- A full `eslint` run is part of the release workflow. This branch does not turn CI on for every push. `.github/workflows/release.yml` stays `workflow_dispatch` and tag `v*` only.

## Release steps still open
This VM did not build the installers. After review, and only if you want the GitHub release:

1. Tag `v17.1.0` on the merged commit (do not force-push). The tag triggers `.github/workflows/release.yml` (`VER` 17.1.0, `VERSION_CODE` 1710): tests, Linux AppImage and `.deb`, Windows NSIS and portable, Android APK (release-signed only if the keystore secrets exist, otherwise the debug-signed APK), unsigned iOS IPA and Simulator zip, then `SHA256SUMS`.
2. Run the Pages workflow (`.github/workflows/pages.yml`, `workflow_dispatch`) so the site picks up the shell.
3. Confirm the release assets match `RELEASE_NOTES` before describing the APK as release-signed.

# Neuralese v17.0.0: new front-end shell (workspaces, dock, command palette, 3D model cosmos)

v17 is a front-end re-architecture. The engine, lab maths, workers and every v16 tool are unchanged and reused; the new shell wraps them. Every claim below has a test or smoke behind it. Where something is partial, it says so.

## What changed
- **New shell** (`ui/`, Solid + TypeScript strict + Vite + Tailwind v4, Kobalte dialog), built into `src/shell/` and loaded after the legacy app. No eval; the CSP is unchanged.
- **9 workspaces instead of 75 tabs:** Overview, Model, Lens, Circuits, Interventions, Experiments, Hub, Nested & Frontier, Learn. All 75 v16 tabs live in them as dock panels (see `PARITY.md`: 75/75 verified by smoke at three viewports).
- **Dockable, splittable panels** with drag, keyboard resize and saved layouts per workspace (localStorage).
- **Command palette** (Ctrl/⌘+K or /) as main navigation; Alt+1..9 switch workspaces.
- **Global typed selection store** (layer, head, neuron, token) kept in sync with the legacy inspector both ways.
- **Typed worker RPC** (`ui/src/core/rpc.ts`) over the existing engine worker wire protocol, with timeouts and typed errors.
- **3D model cosmos** (three.js WebGPURenderer, falls back to WebGL2): one stratum per layer, instanced neurons coloured by real MLP activations of the last generation, heads ring, residual ribbons per token, semantic zoom labels. Click picks a layer/neuron into the selection store.
- **3D nested views** of the RISC-V-in-a-transformer, SLM-in-SLM and MoE-in-MoE experiments, drawn from the shipped artifacts (no synthetic data).
- **Notebook / report mode** tied to pre-registration: markdown, chart, table and REPRO cells; REPRO bundles verified with the existing `prereg.js` hashing; export to HTML.
- **Polish:** View Transitions, spring camera (disabled under prefers-reduced-motion), first-run tour, light/dark sync, keyboard navigation, compact phone layout (one tab group + bottom workspace bar under 760 px).
- Low GPU tier (existing tier logic) forces the WebGL backend and lighter rendering.

## Verification
- 184 existing node tests pass; 17 new bun tests (RPC, selection store, layouts, cosmos data, notebook); `tsc --noEmit` clean; eslint 0 errors.
- Puppeteer smoke (`test/smoke/v17-workspaces.smoke.mjs`) at 1440x900, 1240x700, 390x844: every workspace and every panel opened, 0 console errors, 0 CSP violations.

## Size and load (headless Chrome, software GL, local server)
Initial shell adds shell.js 137 kB (53 kB gzip) + shell.css 14 kB (4 kB gzip). three.js (stage 614 kB / 170 kB gzip, core 223 kB / 57 kB gzip) loads only when a 3D panel opens.

| viewport | FCP v16 | FCP v17 | model ready v16 | model ready v17 |
|---|---|---|---|---|
| 1440x900 | 1524 ms | 1956 ms | 14829 ms | 21311 ms |
| 1240x700 | 392 ms | 448 ms | 10691 ms | 12733 ms |
| 390x844 | 424 ms | 328 ms | 14204 ms | 11049 ms |

## Honest caveats
- The legacy panes are re-parented into the dock, not rewritten as Solid components; their internals look as in v16.
- The shell bundles three 0.187 for the new 3D views while legacy 3D tabs keep vendor three r160, so two copies load if you use both (three logs a warning).
- WebGPU is used when the browser exposes it; in our CI and headless runs only the WebGL2 path was exercised.
- Workspace labels in the phone bottom bar are truncated at 390 px.
- No React island and no Capacitor-specific native code were needed; mobile uses the responsive compact layout.
- Load numbers come from a software-rendered headless browser and are noisy; treat them as rough.

---


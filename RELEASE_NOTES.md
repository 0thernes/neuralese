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


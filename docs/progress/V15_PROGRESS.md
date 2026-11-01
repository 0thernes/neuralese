# V15 progress (visual overhaul)
- 14:50 start: audit screenshots -> /workspace/neuralese-v15/before
- 15:20 design system (style.css v15 layer, self-hosted Inter/JetBrains Mono OFL), sidebar nav+search+drawer, charts.js rewrite (axes/ticks/legend/colorbar/viridis/magma/diverging/hover), viz.js 3D (ACES, rim lights, halos, soft points, labels, grid, edges), version 15.0.0 + ?v=15. 145/145 tests, smoke-v15 OK (72 tabs x 3 sizes, 0 errors), smoke-v14 OK. Next: after shots, comparisons, commit, ship.

## 15:19 — ship
npm test 149/149; smoke-v15 OK. Committing + tagging v15.0.0.

## v15.1: designer critique of the v15.0 screenshots (weakest issues per tab → what 15.1 did)
- **Landing / Gen:** the app opened on a dense, form-first decoding grid with no "what am I looking at". → A new Overview landing with a hero, live stats and quick links. The Gen output gains a surprisal strip synced with the text.
- **3D:** the slabs were dim, there was no sense of flow, nothing was clickable to explain itself, and camera moves jumped. → Instanced heads, flow particles, a hover card, an eased fly-to, and bloom/DoF with adaptive quality.
- **Attention:** the grids had tiny tiles and only one view, and the panels were not linked. → An arc diagram, a received-attention strip, and row/column cross-highlighting across the selected-head map, rollout, arcs and strip.
- **Neuron Lens:** the empty 3D atlas looked broken and the hierarchy was weak. → Empty-canvas states, legend/heading hierarchy, and the per-section accent. (Atlas content still needs the DB load.)
- **Analyze:** the charts were static, with no zoom and no links between them. → Animated transitions, brush zoom on line charts, and synced highlighting on heatmaps.
- **Lab / Intervene:** every button had the same weight. → Primary-button styling, ripple and focus rings, plus the accent per group.
- **Nested:** the embedded panels felt detached from the shell. → The group icon and accent carry into the pane header. The embedded content is unchanged (it is the nested repo's own UI).
- **Global:** truncated sidebar labels, no shortcut discoverability, low-contrast muted text. → Icons, a `?` overlay, and `--m2` raised to AA.
- **Still open:** sidebar label truncation for very long titles (they show in full in the header and in search); the Neuron Lens atlas needs a nicer pre-load placeholder; fps on real mid-range GPUs has not been measured (the box only has the SwiftShader software renderer).

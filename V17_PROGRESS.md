# V17 progress log (resumable)
Branch: v17-rearch (from main ef54968). Push to main only once as a squash.
Architecture: `ui/` = Solid+TS+Vite+Tailwind v4 shell, built into `src/shell/` (committed). Legacy engine/lab in src/ untouched (wrapped via typed bridge + typed worker RPC). Legacy panes are re-parented into 8 workspaces / dock panels.
## Log
- [x] baseline: 184/184 tests pass on v16.0.1
- [x] ui/ scaffold: Solid+TS+Vite+Tailwind4; core rpc/selection/layout/workspaces + 15 bun tests; app.js bridge (neuralese:ready/sel)
- [x] shell: Dock/Palette/Tour/App, cosmos + nested 3D, notebook, panels; tsc clean, 17 bun tests
- [x] v17 smoke OK at 1440x900, 1240x700, 390x844 (75 tabs, 0 console errors, 0 CSP); after shots in /workspace/neuralese-v17/compare/after, v16 before shots + perf in compare/before
- [x] 184/184 node tests, lint 0 errors, tsc clean, bump 17.0.0, CI bun step, PARITY.md, notes
- [ ] squash/push/tag/release/pages

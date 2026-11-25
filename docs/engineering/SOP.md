# SOP

## Develop

Branch from `main`. Keep `npm test` green, including `tools/check-features.mjs`. The UI shell, when you change it, is `cd ui && bun install && bun run typecheck && bun test tests && bun run build`, which writes `src/shell/`.

## Review

Read the diff for a dropped tab, a new `org` / `acl` / `approval` field, or a metric that does not come from `runMachine`, `openRun`, or `spectrum`. Those are grounds to stop.

## Release

Tags `v*` and manual dispatch run `.github/workflows/release.yml`. Do not add a push trigger. Do not tag from a docs-only pass unless the version changed on purpose.

## Incident

If a published number disagrees with `test/*.test.mjs`, the test is the record. Correct the doc or the code, and log a run whose artifact is the new output. Do not edit a frozen `features/releases` file to hide a removal.

## Research tracks

`docs/engineering/RESEARCH_TRACKS.md` is the queue. `docs/KANBAN.md` mirrors it. Building a track means running its falsifier, not scaffolding a panel that returns a constant.

# Contributing

One maintainer. There is no org, review committee, or permission model.

## Never subtract

`features.json` lists every tab, native panel, workspace, and action. `features/releases/v*.json` are frozen lists. `node tools/check-features.mjs` fails the test run if a current id, route, or test id disappears, or if `src/lab-ui.js` grows a tab that is not listed.

Adding a feature is allowed. Give it a `since` newer than every frozen release if it was not in that release, then run `node tools/build-features.mjs` and commit both the source and the JSON. Do not delete an id from a release file.

## Experiments

Agent-facing runs go through `node tools/agent.mjs` or `src/agent/mcp.js`. Do not add accounts, roles, or approval flags to a run record. A remote job must fail when `NEURALESE_VPS_URL` is unset.

## Checks

`npm test` includes the feature gate, `test/agent.test.mjs`, and `test/analytics.test.mjs`. The release workflow stays on tags and manual dispatch.

Research tracks in `docs/engineering/RESEARCH_TRACKS.md` are not implemented by editing their Kanban line to Done. A track is done only when its falsifier has been run and the log is a real run.

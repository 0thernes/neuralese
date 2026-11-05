# Experiment tracking, for one person

Neuralese does not grow orgs, roles, approval gates, or a multi-user model registry. Those are out of scope. The tracking layer is a local lab an agent can drive.

| Capability | This PR | Later |
|---|---|---|
| Run, with config, metrics, seed, git SHA | `createLab` in `src/agent/schema.js`. CLI `node tools/agent.mjs --lab DIR launch`. | Page buttons writing into the same file. |
| Sweeps | `start_sweep` runs `runMachine` on each program × pipeline cell. | Decode and learning-rate grids (RT-34, RT-08). |
| Artifacts and lineage | `putArtifact` stores text, sha256, byte length, optional parent. `lineage` walks `parentId`. | Weight files as artifacts. The bytes are not copied in this PR, only JSON metrics. |
| Reports | `write_report` emits markdown from the runs you name and stores it. | Live charts embedded in the page. |
| Agent tools | `TOOLS` plus JSON-RPC `initialize`, `tools/list`, `tools/call` in `src/agent/mcp.js`. Every mutating call logs `project: "agent"`. | The RT-36 loop. |
| Remote job | `target: "remote"` POSTs the spec to `NEURALESE_VPS_URL` or `url`. Empty URL returns an error and does not run. | A worker on a VPS. |
| Tables, model registry, Weave traces, Launch queues, permissions | Not built. | Only the single-user versions, if a track needs them. No ACLs. |

The legacy RUNS tab in the Overview workspace is unchanged.

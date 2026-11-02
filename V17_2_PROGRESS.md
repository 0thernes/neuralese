# v17.2 progress

Forge, an original in-weight CPU track, on the v17 shell. Branch `cursor/forge-nest-cpu-35bd`.

## Implemented
- Workspace **Forge** (no Alt digit; the bar and the command palette open it). Panels: NestLang, Forge CPU, Memory, Token lanes, WeightCPU / MDCC, Forge REPRO, plus the shared selection inspector. The ten earlier workspaces and all 75 legacy tabs stay where they were.
- ForgeISA/1 and NestLang/1, both Neuralese-original. An int32 reference VM. A float32 weight-constructed engine (float64 gadgets as a cross-check) in an isolated bit bank. The TinyStories residual is not written. bf16 is not claimed.
- Type, affine, and termination checks. A bad program ends in FAIL and does not run.
- Clocked tokens: language-model text, the delimiter `⟦forge⟧`, then one instruction plus four value bytes per step. Host sampling, when the model is loaded, is labeled as a real greedy sample that did not write the program.
- MDCC lane on the same eight cells: a deterministic proposer and host `bigint`.
- REPRO bundles. Method write-up in `docs/NEST_CPU.md`.

## Measured
One `runLanes()` on this machine. The test locks accuracies, trace equality, and the token gap. The milliseconds are this run only.

| lane | accuracy | time | tokens | memory |
|---|---|---|---|---|
| WeightCPU | 8/8 | 99 ms | 756 | 256 words |
| MDCC | 8/8 | 0.25 ms | 32 | 0 |

Demo `22 × 35` halts at 770. 93 instructions, 467 engine tokens, float32 faults 0, float32 and float64 traces equal the VM. The known-bad programs are rejected.

## Checks
`npm test`: 197 pass, 0 fail, 7 skipped (GPT-2 / Llama / Qwen / encoder weights not fetched). `cd ui && bun run typecheck && bun test tests`: 17 pass. Shell rebuilt into `src/shell/`.

## Not done from this VM
Multi-platform installers, the tag, and the Pages deploy. `RELEASE_NOTES.md` has the steps. CI is still tag and manual dispatch only. The engine is not a bf16 SwiGLU or gated-delta memory inside the host residual; that limit is stated in the doc and in the panel.

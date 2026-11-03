# v17 feature parity checklist

Every v16 tab (75) is mounted as a dock panel in a v17 workspace. Generated from the puppeteer smoke report (`test/smoke/v17-workspaces.smoke.mjs`), which opens every panel at 1440x900, 1240x700 and 390x844 and checks it is visible and non-empty.

Result: 75/75 legacy tabs OK, 80/80 panels OK including new native panels, in the v17.0 smoke.

v17.1 adds the Adversary workspace (Alt+0) and six native panels (`adv-live`, `adv-run`, `adv-det`, `adv-hunt`, `adv-steer`, `adv-repro`) plus the shared selection panel. No legacy tab moved. Those panels are covered by the shell unit test that every workspace layout contains its panels. The three-viewport puppeteer smoke was not re-run for v17.1; see `V17_1_PROGRESS.md`.

v17.2 adds the Forge workspace (no Alt digit) and six native panels (`forge-prog`, `forge-cpu`, `forge-mem`, `forge-trace`, `forge-mdcc`, `forge-repro`) plus the shared selection panel. No legacy tab moved. The shell unit test checks that the default layout contains every Forge panel. The three-viewport puppeteer smoke was not re-run for v17.2; see `V17_2_PROGRESS.md`.

| panel | workspace | verified |
|---|---|---|
| `cosmos` | model | yes |
| `selection` | circuits | yes |
| `output` | overview | yes |
| `legacy:home` | overview | yes |
| `legacy:v16` | overview | yes |
| `legacy:gen` | overview | yes |
| `legacy:ctrl` | overview | yes |
| `legacy:audio` | overview | yes |
| `legacy:timeline` | overview | yes |
| `legacy:runs` | overview | yes |
| `legacy:arch` | model | yes |
| `legacy:params` | model | yes |
| `legacy:weights` | model | yes |
| `legacy:embed` | model | yes |
| `legacy:gpu` | model | yes |
| `legacy:zoo` | model | yes |
| `legacy:prof` | model | yes |
| `legacy:viz` | model | yes |
| `legacy:v3d` | model | yes |
| `legacy:an` | lens | yes |
| `legacy:resid` | lens | yes |
| `legacy:neurons` | lens | yes |
| `legacy:nlens` | lens | yes |
| `legacy:nlval` | lens | yes |
| `legacy:nlext` | lens | yes |
| `legacy:sae` | lens | yes |
| `legacy:saed` | lens | yes |
| `legacy:attn` | circuits | yes |
| `legacy:circuit` | circuits | yes |
| `legacy:heads` | circuits | yes |
| `legacy:acdc` | circuits | yes |
| `legacy:probe` | circuits | yes |
| `legacy:geom` | circuits | yes |
| `legacy:land` | circuits | yes |
| `legacy:steer` | interventions | yes |
| `legacy:causal` | interventions | yes |
| `legacy:surg` | interventions | yes |
| `legacy:rt` | interventions | yes |
| `legacy:sweep` | interventions | yes |
| `legacy:ops` | interventions | yes |
| `legacy:impact` | interventions | yes |
| `legacy:calib` | interventions | yes |
| `legacy:grad` | interventions | yes |
| `legacy:drill` | interventions | yes |
| `notebook` | experiments | yes |
| `legacy:repro` | experiments | yes |
| `legacy:stats` | experiments | yes |
| `legacy:data` | experiments | yes |
| `legacy:evalh` | experiments | yes |
| `legacy:nb` | experiments | yes |
| `legacy:report` | experiments | yes |
| `legacy:log` | experiments | yes |
| `legacy:share` | experiments | yes |
| `legacy:hub` | hub | yes |
| `legacy:hinterp` | hub | yes |
| `legacy:hemb` | hub | yes |
| `legacy:hspeech` | hub | yes |
| `legacy:hvision` | hub | yes |
| `legacy:hgen` | hub | yes |
| `legacy:hft` | hub | yes |
| `nested3d` | frontier | yes |
| `legacy:nriscv` | frontier | yes |
| `legacy:nslm` | frontier | yes |
| `legacy:nmoe` | frontier | yes |
| `legacy:nxlens` | frontier | yes |
| `legacy:fx` | frontier | yes |
| `legacy:fsc` | frontier | yes |
| `legacy:fmind` | frontier | yes |
| `legacy:frsi` | frontier | yes |
| `legacy:fgrok` | frontier | yes |
| `legacy:fatlas` | frontier | yes |
| `legacy:fclaims` | frontier | yes |
| `legacy:tsk` | frontier | yes |
| `legacy:qrng` | frontier | yes |
| `legacy:qgeom` | frontier | yes |
| `legacy:types` | frontier | yes |
| `legacy:taylor` | frontier | yes |
| `legacy:claims` | frontier | yes |
| `legacy:learn` | learn | yes |
| `legacy:term` | learn | yes |

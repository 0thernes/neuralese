# CLAIMS — v14.0.0 (Neuron Lens for TinyStories-8M)

Every number below comes from `lens/ts8m/validation.json`, which `tools/nlens-validate.mjs` produced against the hash-pinned lens (`lenses.f32` sha256 `6a668f3e…7636`) under the pre-registration in `docs/PREREG-v14.md` (sha256 `299a8ec6…3590`, which includes Amendment 1). To recompute the verdicts, run `node tools/nlens-verdicts.mjs`. The method is credited as prior art in `docs/NEURON_LENS_METHOD.md`. The implementation is original.

**Random baseline:** each test is scored against a mismatched-neuron τ99 null, so a random direction has a pass rate of ≈0.01 by construction (`nullPassRate` in the JSON). The other baselines are the logit lens (raw unembedding) and a tuned lens (a ridge-fit affine map to the final residual).

## Pre-registered verdicts
- **P1 SUPPORTED.** R.out has a higher median r than the logit lens at 7/7 layers (L0–6).
- **P2 SUPPORTED.** R.out top-10 rise is ≥ 0.90 at 6/6 of L1–6.
- **P3 NOT SUPPORTED.** The prediction was that S.mid beats R.mid early and R.mid wins late. S.mid actually beats R.mid for driver ρ at every layer, including L7 (0.37 vs 0.07). On this tiny model the S/R crossover never appears.
- **P4 NOT SUPPORTED.** The mid-lenses do not beat the out-lenses of L−1 at most layers: S.mid wins at 1/7 and R.mid at 3/7. On TinyStories-8M the "mid" advantage reported for 8B/12B models does not reproduce.
- **P5 SUPPORTED.** Every lens clears the null (pass-rate CI lower bound > 0.01) at a majority of layers.

### Test A — median Pearson r (95% bootstrap CI), steer 4×p99

| layer | logit | tuned | R.mid | S.out | S.mid | R.out |
|---|---|---|---|---|---|---|
| L0 | 0.30 [0.25,0.35] | 0.27 [0.22,0.30] | 0.25 [0.14,0.43] | 0.35 [0.29,0.41] | 0.24 [0.21,0.30] | 0.79 [0.73,0.80] |
| L1 | 0.39 [0.31,0.43] | 0.32 [0.28,0.36] | 0.67 [0.64,0.70] | 0.34 [0.29,0.39] | 0.39 [0.30,0.43] | 0.80 [0.78,0.83] |
| L2 | 0.37 [0.34,0.44] | 0.37 [0.33,0.40] | 0.67 [0.63,0.72] | 0.27 [0.22,0.36] | 0.28 [0.22,0.37] | 0.83 [0.82,0.86] |
| L3 | 0.40 [0.35,0.44] | 0.42 [0.36,0.45] | 0.70 [0.68,0.73] | 0.33 [0.30,0.36] | 0.33 [0.27,0.37] | 0.85 [0.84,0.87] |
| L4 | 0.46 [0.43,0.51] | 0.49 [0.45,0.53] | 0.76 [0.73,0.78] | 0.32 [0.25,0.38] | 0.30 [0.26,0.35] | 0.89 [0.88,0.90] |
| L5 | 0.57 [0.52,0.60] | 0.60 [0.57,0.65] | 0.75 [0.69,0.77] | 0.28 [0.24,0.34] | 0.28 [0.22,0.33] | 0.91 [0.90,0.92] |
| L6 | 0.65 [0.62,0.68] | 0.70 [0.68,0.73] | 0.73 [0.72,0.77] | 0.21 [0.18,0.28] | 0.24 [0.21,0.26] | 0.96 [0.94,0.96] |
| L7 | 0.99 [0.99,1.00] | 0.99 [0.99,1.00] | 0.69 [0.65,0.72] | 0.26 [0.21,0.29] | 0.24 [0.16,0.29] | — |

### Test A — top-10 rise rate (Wilson CI)

| layer | logit | tuned | R.mid | S.out | S.mid | R.out |
|---|---|---|---|---|---|---|
| L0 | 0.96 [0.80,0.99] | 1.00 [0.86,1.00] | 0.79 [0.60,0.91] | 0.88 [0.69,0.96] | 0.88 [0.69,0.96] | 1.00 [0.86,1.00] |
| L1 | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] |
| L2 | 1.00 [0.86,1.00] | 0.96 [0.80,0.99] | 1.00 [0.86,1.00] | 0.96 [0.80,0.99] | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] |
| L3 | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] | 0.83 [0.64,0.93] | 0.92 [0.74,0.98] | 1.00 [0.86,1.00] |
| L4 | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] | 0.96 [0.80,0.99] | 0.92 [0.74,0.98] | 1.00 [0.86,1.00] |
| L5 | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] | 0.92 [0.74,0.98] | 0.96 [0.80,0.99] | 1.00 [0.86,1.00] |
| L6 | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] | 0.83 [0.64,0.93] | 0.96 [0.80,0.99] | 1.00 [0.86,1.00] |
| L7 | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] | 1.00 [0.86,1.00] | 0.88 [0.69,0.96] | 0.88 [0.69,0.96] | — |

### Test B — driver pass rate vs τ99 null (Wilson CI); median ρ in validation.json

| layer | S.mid | R.mid | logit | S.out[L-1] | R.out[L-1] |
|---|---|---|---|---|---|
| L0 | 0.99 [0.98,1.00] | 0.38 [0.35,0.41] | 0.99 [0.99,1.00] | 0.99 [0.99,1.00] | — |
| L1 | 0.71 [0.68,0.74] | 0.37 [0.34,0.40] | 0.42 [0.39,0.45] | 0.72 [0.69,0.75] | 0.37 [0.34,0.40] |
| L2 | 0.74 [0.71,0.76] | 0.33 [0.30,0.36] | 0.26 [0.23,0.28] | 0.74 [0.72,0.77] | 0.30 [0.28,0.33] |
| L3 | 0.78 [0.75,0.80] | 0.35 [0.32,0.38] | 0.28 [0.26,0.31] | 0.78 [0.75,0.80] | 0.37 [0.34,0.40] |
| L4 | 0.80 [0.77,0.82] | 0.33 [0.30,0.36] | 0.16 [0.14,0.18] | 0.81 [0.79,0.83] | 0.29 [0.27,0.32] |
| L5 | 0.71 [0.68,0.73] | 0.26 [0.24,0.29] | 0.06 [0.05,0.08] | 0.69 [0.66,0.72] | 0.22 [0.19,0.24] |
| L6 | 0.69 [0.66,0.72] | 0.24 [0.22,0.27] | 0.08 [0.06,0.09] | 0.66 [0.63,0.69] | 0.22 [0.19,0.25] |
| L7 | 0.66 [0.63,0.69] | 0.09 [0.07,0.10] | 0.10 [0.08,0.12] | 0.54 [0.51,0.57] | 0.30 [0.28,0.33] |

## Honest reading
- At every layer the R-lens on neuron output projections is the strongest predictor of steering (r 0.79–0.96). That is clearly better than the logit and tuned lenses below L7. At L7 the logit lens is trivially exact.
- The S-lenses have weak steering correlation (r ≈ 0.2–0.35), even though their top-10 rise is often > 0.8. They are good at the *input* side (drivers), not the output side. This matches the claim that the S-lens is "early-layer accurate" only in the reading-inputs sense.
- At L0 the logit lens and S.out[L−1] (the embedding) match S.mid for drivers. Near the embedding, the S-lens adds nothing.
- Scale: n = 24 neurons per layer for Test A, 1024 for Test B, 16 eval docs and 64 fit docs. The CIs on Test A are wide.
- This is a single model with 8M parameters. Nothing here licenses claims about the 8B/12B results of the prior work.

# Claims — Neuralese v14.1 – v14.9 (pre-registered in docs/PREREG-v14x.md, sha256 7f864197…93a1)

Every number below comes from a result file that records the pre-registration hash. "Not supported" results are reported as they came out.

| ver | criterion | result | verdict | file |
|---|---|---|---|---|
| 14.1 | C1a TS-1M: R.out beats logit at ≥5/7 layers, null ≤0.02 | 7/7 layers (R.out median r 0.74–0.91 vs logit 0.39–0.70), null 0.0109 | supported | lens/ts1m/validation.json, lens/v14x-c1.json |
| 14.1 | C1a TS-3M | 7/7 layers (0.81–0.94 vs 0.36–0.70), null 0.0109 | supported | lens/ts3m/validation.json |
| 14.1 | C1b split-half cosine ≥0.9 for every block | min cosine 0.9978 (1M), 0.9960 (3M), 0.9927 (8M) | supported | lens/v14x-splithalf.json |
| 14.1 | C1c 8M, n=64: CI narrower at ≥6/7 layers, R.out > logit at ≥6/7 | narrower at 7/7 (L4 only barely: 0.0150 vs 0.0151); R.out beats logit at 7/7 | supported | lens/ts8m/v14x-testA64.json |
| 14.2 | C2 SAE feature pass rate ≥ neuron pass rate at L3 | 64/64 vs 64/64 (both 1.0; R.out median r 0.875 vs logit 0.445) | supported (at ceiling, so it doesn't separate the two) | lens/ts8m/v14x-sae.json |
| 14.3 | C3 top-20 lens heads recover ≥50% of kept heads, AUROC >0.7, both tasks | induction recall 0.31, AUROC 0.63; IOI recall 0.18, AUROC 0.48 | not supported | lens/ts8m/v14x-heads.json |
| 14.4 | C4a S.mid labels hit the top driver more often than shuffled labels (McNemar p<0.01) | 12.95% vs 0.16%, p≈2e-295 | supported | lens/ts8m/v14x-labels.json |
| 14.4 | C4b calibration within ±0.1 in all 5 bins | max gap 0.033 | supported | lens/ts8m/v14x-labels.json |
| 14.5 | C5 ≥30% of 48 matched 3M↔8M pairs exceed τ99 | 11/48 = 22.9% (Wilson 13–37%) | not supported | lens/v14x-match.json |
| 14.6 | C6 RelP-linear is first-order accurate (e_exact/e_RelP ≥1 at all layers, ε=1e-3) | fails at all 7 layers (e_RelP 0.29–0.73 vs e_exact 0.05–0.19) | not supported (as predicted) | lens/ts8m/v14x-taylor.json |
| 14.7 | C7 float32 fidelity KL<1e-5, R.out beats the null on ≥1 nested model | KL 2.4e-16; composite R.out passes 384/384 (logit 74%), emulator 243/249 (logit 51%) | supported | nested/v14x-nested.json |
| 14.8 | C8a host-head reads of guest units overlap host units | overlap exactly 0 (read norm 0) vs τ99 0.67 | not supported (as predicted: the host doesn't see the guest) | nested/v14x-nested.json |
| 14.8 | C8b emulator mode-0 vs mode-1 reads of the same unit | median r 0.888 vs τ99 0.637; lens cosine 0.92 | supported | nested/v14x-nested.json |
| 14.9 | C9a headless-Chrome TS-1M fit reproduces the Node fit, cosine ≥0.99 | cosine 1.000000 for all 31 blocks (64 docs, 111 s, 2 workers) | supported | lens/ts1m/v14x-browserfit.json |
| 14.9 | C9b REPORT lists every failure | docs/REPORT-v14.md; enforced by test V14X-7 | supported | — |

## Caveats
- **14.2:** at l1 = 3e-3, all 1024 SAE features are alive and dense (each fires on ≥0.5% of rows; FVU 0.065), so this SAE is weakly sparse. Both arms hit the ceiling, so C2 doesn't separate them.
- **14.3:** the 8M model barely does induction on random-token repeats (mean log-prob −10.4), and 42 and 65 heads clear the 0.05 ablation threshold. "Kept" is a broad set. None of the lenses, the logit baseline included, rank heads well. R.mid (exploratory) is slightly better on induction (AUROC 0.72).
- **14.4:** the label hits only 13% of the time in absolute terms. It is far above chance, but most labels miss the neuron's top driver.
- **14.6:** the pre-registered δ = 1e-4 central difference is limited by float32 noise. e_exact is flat at about 0.19 across ε, which is a noise floor, not curvature. An exploratory rerun with δ = 1e-2 (lens/ts8m/v14x-taylor-delta0.01-exploratory.json, not pre-registered) gives e_exact 0.009–0.038, and RelP still loses at every layer. RelP's frozen-LN and φ·g rules are an attribution rule, not the true Jacobian. Its error doesn't shrink with ε (0.29–0.73).
- **14.7:** the float32 weights reproduce float64 almost exactly (KL 2e-16), because the nested models were trained in float32.

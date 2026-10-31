# Neuralese v14 report: Neuron Lens, 14.0 – 14.9

The 14.0 predictions are in docs/PREREG-v14.md (sha 299a8ec6…) and 14.1–14.9 in docs/PREREG-v14x.md (sha 7f864197…). Full tables are in docs/CLAIMS-v14.md and docs/CLAIMS-v14x.md.

## Every failed prediction
| id | what was predicted | what happened |
|---|---|---|
| P3 (14.0) | S.mid beats R.mid early, R.mid wins late | S.mid wins at every layer; no crossover on TinyStories-8M |
| P4 (14.0) | mid-lenses beat the L−1 out-lenses | S.mid wins at 1/7 layers, R.mid at 3/7 |
| C3 (14.3) | lens head scores recover ablation-important heads (recall ≥50%, AUROC >0.7) | induction 0.31 / 0.63, IOI 0.18 / 0.48; the logit-lens baseline is equally poor |
| C5 (14.5) | ≥30% of Jaccard-matched 3M↔8M neuron pairs steer alike | 22.9% (11/48) |
| C6 (14.6) | RelP linearisation is first-order accurate | fails at all 7 layers; failure was predicted |
| C8a (14.8) | host-head reads of the baked guest overlap host units | exactly zero; failure was predicted (block-diagonal composite) |

## Scope changes (declared before data, not counted as passes)
- **14.1:** TS-1M/3M stand in for distilgpt2/GPT-2, because a d=768 fit is infeasible on the 8-core CPU box.
- **14.3:** head attribution is node-level, not edges.
- **14.9:** the browser fit uses CPU Web Workers, not WebGPU, and runs at 64 docs × 65 tokens, not 1000 × 128.

## What holds
- The R.out lens predicts steering effects far better than the logit lens on all three TinyStories models, the SAE features, and both nested models. The null pass rate is 0.01.
- Lenses are stable across half-fits (cosine ≥0.99).
- Auto-labels are calibrated.
- The browser fit is numerically identical to the Node fit.

## Limits
- All models are tiny: 1M–8M parameters, plus char-level nested models.
- Test A uses 16 eval docs.
- The 14.6 δ choice was noise-limited (see CLAIMS-v14x).
- The SAE is weakly sparse.

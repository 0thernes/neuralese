# Neuralese v14.0 pre-registration: do Neuron Lens reads predict steering and drivers in TinyStories-8M?

Written 2026-10-31 11:05 PT, after the lenses were fitted and before any validation number was computed.
Its SHA-256 is pinned in `test/v14.test.mjs` and recorded in every `lens/ts8m/validation.json`; editing this file breaks the test.
The harness is `tools/nlens-validate.mjs`. Whatever it outputs is reported in CLAIMS-v14.md, including failures.

## Model, lenses, data
- Model: roneneldan/TinyStories-8M (GPT-Neo, 8 layers, d=256, 1024 MLP neurons and 16 heads per layer).
- Lenses (`lens/ts8m/lenses.f32`, hash in manifest): R.out (L0-L6), R.mid (L0-L7), S.mid (L0-L7), S.out (L0-L7), fitted on 64 documents
  (TinyStories-valid stories 0.., first 65 tokens), valid positions [16, 64).
- Baselines: logit lens (J = I); a tuned-lens-style affine translator per layer (least squares from the layer's residual to h_final on the
  same 64 fit documents; its linear part reads directions); and a random-token / mismatched-neuron null.
- Held-out evaluation documents: 16 stories starting at story index 20000 (first 64 tokens), disjoint from the fit set.
- Token mask ("kept"): tokens seen at least 5 times in the first 20000 stories.

## Test A: write side (steering)
- Sample: 24 neurons per layer, drawn without replacement by mulberry32(14000 + layer).
- Dose: alpha = 4 × the neuron's 99th-percentile activation over the 16 evaluation documents (floor 0.05).
- Steering: add alpha · W_proj[:, n] to that layer's MLP output at positions 16..63 of each evaluation document.
- Effect: Δ = mean over positions 16..63 and documents of the change in log-softmax (full vocabulary), restricted to kept tokens.
- Reads compared for the write w: logit lens, tuned, R.out (layers 0-6), R.mid, S.out, S.mid.
- Score 1 (correlation): Pearson r over kept tokens between Δ and the read's scores. A neuron passes for a lens if r exceeds the 99th
  percentile of that lens's mismatched pairs in the same layer (read of neuron i against Δ of neuron j ≠ i).
- Score 2 (top tokens rise): the mean Δ of the read's top-10 kept tokens minus the mean Δ of 10 random kept tokens (mulberry32(7+n)).
  A neuron passes if that difference is > 0.
- Report per layer and lens: pass rate with Wilson 95% CI for both scores, median r with bootstrap 95% CI (2000 resamples).

## Test B: input side (exact drivers)
- Truth: for every kept token among the 3000 most frequent, substitute it at position 24 of 2 documents (stories 40000.., first 25 tokens)
  and record every MLP neuron's activation at position 24; average over the 2 documents.
- Reads of the neuron's input direction c = C(γ2 ⊙ W_fc[n]): in·S via S.mid[L] (mid) and via S.out[L−1] (out; L0: the embedding),
  in·R via R.mid[L] and R.out[L−1] (L ≥ 1), and the logit-lens read of c.
- Score: Spearman ρ over the 3000 tokens between the read and the truth. Pass if ρ exceeds the 99th percentile of mismatched pairs.
- All 1024 neurons of every layer are scored. Report pass rate with Wilson 95% CI and median ρ.

## Predictions (each can fail)
- P1. On the write side, R.out beats the logit lens in median r at a majority of layers 0-6.
- P2. R.out's top-10-rise pass rate is ≥ 0.90 at a majority of layers 1-6 (neuron-lens reports > 90% qualitative steering agreement).
- P3. On the input side, in·S (mid) beats in·R (mid) in median ρ at layers 0-1, and in·R (mid) beats in·S (mid) at layer 7.
- P4. Mid lenses read MLP inputs better than out lenses: S.mid beats S.out[L−1] and R.mid beats R.out[L−1] in median ρ at a majority of layers 1-7.
- P5. Every real lens beats its mismatched null (pass rate CI lower bound > 0.01) at a majority of layers.
A prediction is "supported" only if its condition holds on the point estimates; it is "robust" if it also holds with non-overlapping CIs.

## Amendment 1 (2026-10-31, before any validation run on a fitted lens)

The original text of this file (sha256 `19757b3855e82e8b88faab28211ef550f4129b6889636cf2da16a5a8f90c7bfd`) named stories 40000.. for the exact-driver documents. The pinned corpus (TinyStories-valid.txt) has only 21,989 stories, so that range is empty. A smoke run of the harness on an *identity* lens (not a fitted lens) exposed this: every Test B correlation came out as 0. The only change is that driver documents now come from stories **21000..** (disjoint from the fit set 0.., the eval set 20000..20015 and the DB context set 21200..). The predictions, metrics, thresholds and baselines are unchanged.

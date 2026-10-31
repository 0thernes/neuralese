# Pre-registration — Neuralese v14.1 – v14.9

Written 2026-10-31 13:20 PT, before any 14.x harness ran on data. The sha256 of this file is pinned in `test/v14x.test.mjs` and recorded in every `lens/**/v14x-*.json` result. Protocols reuse v14.0's (`docs/PREREG-v14.md`) unless a point says otherwise:
- **Test A:** steer at 4×p99, 16 eval docs from story 20000 on, the Δ mean log-prob over the kept vocabulary, Pearson r against the mismatched-pair τ99 null.
- **Test B:** exact drivers.

**Scope changes from ROADMAP-v14 are declared here, before data.** Each one is reported as a scope change, not as a pass.

## 14.1 More models + tighter v14.0 CIs
- **Scope change:** TinyStories-1M (d=64) and TinyStories-3M (d=128) replace distilgpt2 and GPT-2 small. A d=768 RelP fit is infeasible on the 8-core CPU box (v14.0's d=256 fit already took 58 min). Both lenses were fitted with `tools/nlens-fit.mjs` on the same 64 docs × T=65. That fit came before this file, but it is a fit, not a test.
- **C1a:** for each of 1M and 3M, R.out median r > logit lens at ≥ 5 of the 7 non-final layers. The R.out null pass rate must be ≤ 0.02 at every layer.
- **C1b:** the cosine between the two half-fits is ≥ 0.9 for every block of every model (1M, 3M, 8M).
- **C1c (8M weak spot):** rerun Test A on 8M with 64 neurons per layer (v14.0 had 24; the sample is a superset prefix of the same seeded shuffle). The R.out median-r 95% CI is narrower than v14.0's at ≥ 6 of 7 layers, and the R.out median r stays > logit at ≥ 6 of 7.

## 14.2 SAE features vs neurons
- Use the in-app `sae.js` SAE (m = 1024, l1 3e-3, 3 epochs) on TS-8M residual outputs of layer 3 (`outs[3]`), at 64 fit docs × positions 16..63.
- Sample 64 alive features (firing on ≥ 0.5% of training rows), seeded.
- Steer vector = decoder row × 4 × p99(feature activation on the eval docs), added at layer 3. Read it with R.out[3].
- **C2:** the SAE-feature Test A pass rate ≥ the neuron pass rate at L3 (14.1 C1c run). Reported either way. Logit-lens pass rates are reported for both.

## 14.3 Lens attribution of heads (node level)
- **Scope change:** this is per-head nodes, not edges. Edge path patching is too costly here.
- **Tasks:**
  - Induction: 24 prompts, each a random sequence of 12 frequent tokens repeated twice. The objective is mean log-prob of the correct repeated token on the second half.
  - IOI-style: 24 TinyStories prompts of the form "A and B went to the park. A gave the ball to". The objective is logit(B) − logit(A).
- **Ground truth:** zero-ablate each of the 128 heads. A head is "kept" if ablating it reduces the objective by > 0.05, and at least the top 5 heads by effect are always kept.
- **Lens score:** |Σ_t (u_target − u_baseline)·(γ_f ⊙ C(J_l · o_{h,t}))/σ_t|, where J_l is R.out[l] (the identity at L7), o_{h,t} is the head's write, and σ_t is the final-LN scale. The logit-lens baseline uses J = I.
- **C3:** top-20 lens heads recover ≥ 50% of the kept heads, and AUROC (lens score vs kept) > 0.7, on each task.

## 14.4 Auto-labels with confidence
- **Label:** the top-3 tokens of the S.mid read over the v14.0 driver candidate set (3000 frequent tokens).
- **Simulator hit:** the neuron's exact top-1 driver (`drivers.json`) is in the label.
- **Shuffled control:** the label of the neuron n' = (n + 517) mod 1024 in the same layer.
- **C4a:** the hit rate with true labels > shuffled, by a paired exact McNemar test with p < 0.01 over all 8192 neurons.
- **C4b:** confidence = logistic(a·z + b), where z is the top-1 read's z-score among candidates. Fit on even n, evaluate on odd n in 5 equal-count bins. Every bin satisfies |acc − mean conf| ≤ 0.1.

## 14.5 Cross-model neuron matching
- Match 3M ↔ 8M neurons at layers 2 and 5 by the Jaccard index of their out·R top-50 token sets (R.out lens of each model, kept vocab). Use the Hungarian algorithm (3M side 512 rows, 8M side 1024 columns).
- Take the top 24 matched pairs per layer by Jaccard. Steer each neuron in its own model (Test A dose) and correlate the Δ vectors.
- The null is τ99 of the correlations of the 24 × 23 mismatched pairs.
- **C5:** ≥ 30% of the 48 matched pairs exceed τ99.

## 14.6 Taylor check of the RelP linearisation
- Per layer l = 0..6 of 8M, on 4 docs, with 3 random unit directions v scaled to ε·rms(h) for ε ∈ {1e-3, 1e-2, 1e-1}:
  - Δ = h_final(steered at all valid rows) − h_final.
  - e_RelP = ‖Δ − ε J_RelP v‖ / ‖Δ‖, via the `jvp` chain.
  - e_exact = ‖Δ − ε J_fd v‖ / ‖Δ‖, with J_fd a central difference at δ = 1e-4.
  - The second-order residual ‖Δ − ε J_fd v‖ / ε² is reported too.
- **C6 (roadmap wording):** "RelP-linear is first-order accurate" fails if e_exact / e_RelP < 1 at any layer, at ε = 1e-3.
- **Prediction recorded now:** it fails, because the frozen-LN and φ·g rules are not the true Jacobian.

## 14.7 Nested models (neuralese-nested E2/E3, integrated as tabs)
- The nested SLM weights are converted to float32. Fidelity gate: the float32 composite reproduces the float64 guest logits with max KL < 1e-5 on 20 prompts.
- **Lens:** a finite-difference R.out lens (central difference, δ = 1e-3, all positions perturbed together, mean over target positions) for the composite (L0 → final) and the emulator (L0 → final, mode 1). Fit on 32 char docs (stories 0..) with T = 64.
- **Test A analog:** steer each MLP hidden unit of layer 0 (dose 4 × p99 of its activation) on 8 eval docs (stories 20000..). Δ = mean log-prob over the 62 chars from the model's output head (composite: guest head for guest units, host head for host units). Predict with the out·R read vs the logit-lens read, using the mismatched τ99 null.
- **C7:** R.out passes the null for ≥ 1 model (pass-rate Wilson lower bound > null rate), and all tests pass.

## 14.8 Host × nested cross-read
- **(a) Baked composite:** host-head reads of guest-unit writes. The overlap is the max |Pearson| between a guest unit's host-head read and any host unit's host-head read.
- **(b) Emulator:** fit the lens separately for mode 0 (host task) and mode 1 (guest emulation). The overlap is the Pearson between the same unit's mode-0 and mode-1 out·R reads.
- **Null:** shuffled-unit pairs, τ99.
- **C8:** the median overlap exceeds τ99, reported separately for (a) and (b).
- **Prediction recorded now:** (a) fails, because the block-diagonal composite makes host-head reads of guest units exactly 0 ("the host does not see the nested model"). (b) is open.

## 14.9 In-browser fit + report
- **Scope change:** this is a CPU Web-Worker fit, not WebGPU, and not the authors' 1000 × 128 scale.
- **C9a:** a headless-Chrome fit of the full TS-1M lens (64 docs × T=65, through `lens-worker.js`) reproduces the Node-fitted `lens/ts1m` with cosine ≥ 0.99 for every block.
- **C9b:** `docs/REPORT-v14.md` lists every failed prediction from 14.0 – 14.8.

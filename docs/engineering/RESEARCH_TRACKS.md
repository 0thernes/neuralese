# Research tracks

Solo roadmap. Nothing here is a result. Each track is a falsifiable experiment to build after this pull request. No orgs, approvals, or multi-user registry. The agent that eventually loops them is track 36, and it may only call the local API in `src/agent/` (`node tools/agent.mjs`, JSON-RPC `tools/list` and `tools/call`).

## Ladder

White-box CPU models already wired in this repo: TinyStories-1M, TinyStories-3M, TinyStories-8M (GPT-Neo). The ceiling named below is a 124–160M model on CPU (GPT-2 small is 124M). That is the stand-in for a 135M budget. Those weights are not downloaded here, and no track claims a 135M number.

A track that is only meaningful on a toy net says so. Scaling to the ladder is a second, separate claim.

Partial code that already exists is a dependency, not a completed track. The falsifier has not been run as specified.

## Tracks

### 1. Model surgery and stitching
Hypothesis: swapping one MLP block from TinyStories-8M into TinyStories-3M, then the reverse, moves next-token cross-entropy by less than the gap between the two intact models on a frozen 200-prompt set.
Metric: held-out cross-entropy, nats per token, plus the stitched model's greedy-token agreement with each parent.
Models: 3M and 8M first. 1M as a negative control. 124M only if both small stitches are stable.
Depends on: `src/surgery.js` layer transplant, `src/zoo.js`.

### 2. Automated circuit discovery with ablation checks
Hypothesis: node-level ACDC at a pre-registered τ keeps a set of heads whose zero-ablation hurts a fixed IOI-style prompt by at least half the full-model effect, and ablating a same-sized random set hurts less (paired sign-flip, n ≥ 32 prompts).
Metric: faithfulness (logit difference) and the paired p-value against random sets.
Models: 8M, then 1M and 3M. 124M only for the winning τ.
Depends on: `src/lab-research.js` ACDC, `src/science.js` ablation. Edge-level ACDC is still absent.

### 3. Training microscope
Hypothesis: on a from-scratch 1M run, a previous-token head's score exceeds 0.2 before any induction head exceeds 0.2, and a modular-addition grokking run's train accuracy reaches 0.99 at least 200 steps before test accuracy does.
Metric: previous-token score, induction score, train and test accuracy at every step.
Models: toy width on CPU, then TinyStories-1M. Not 135M.
Depends on: `src/science.js` `inductionScores`, `src/frontier` grokking net. Per-step checkpoints are not stored yet.

### 4. Model diffing before and after fine-tuning
Hypothesis: after the in-browser fine-tune on a frozen text, the relative Frobenius change in layer-7 MLP weights exceeds every earlier layer, and held-out cross-entropy on a disjoint text does not improve.
Metric: per-tensor ‖ΔW‖_F / ‖W‖_F and held-out nats.
Models: 8M only (the fine-tune path is that model). 1M and 3M are the control "no fine-tune" diff, which must be ~0.
Depends on: `src/lab-hub.js` fine-tune, `src/zoo.js` diff.

### 5. Steering lab, dose and side effects
Hypothesis: for a pre-registered control vector, the log-prob of the target token is monotone in the coefficient on [−2, 2], and the rise in a disjoint side-effect token is smaller than the target rise at the same dose (n ≥ 20 prompts).
Metric: Δ log-prob versus coefficient, plus the side-effect token's Δ log-prob.
Models: 1M, 3M, 8M. 124M only if the 8M curve is monotone.
Depends on: `src/app.js` steering stack, `src/analysis.js` control vectors.

### 6. Knowledge editing with ripple tests
Hypothesis: a ROME edit that raises the target fact's probability above 0.5 on the rewrite prompt also raises it on 5 paraphrases, and does not raise an unrelated fact by more than 0.05 absolute probability.
Metric: target probability, paraphrase mean, unrelated-fact absolute change.
Models: 8M. MEMIT (multi-layer) is not implemented; the track includes it only after a ranked-one edit fails the paraphrase clause. 1M is expected to fail and is the negative control.
Depends on: `src/rome.js`. MEMIT is new code.

### 7. Superposition toy models
Hypothesis: in a ReLU toy model with more features than dimensions, the number of features with dimensionality > 0.5 exceeds the hidden width, and the mean |cosine| of write directions exceeds the random baseline √(2/(π d)) computed in `superposition`.
Metric: feature dimensionality and mean absolute cosine, against that baseline.
Models: toy nets, width 32 to 256, CPU. Not a language-model run. The 8M `proj` columns are a follow-up, not the hypothesis.
Depends on: `src/science.js` `superposition`.

### 8. Quantization and pruning robustness
Hypothesis: int8 quantization of all MLP matrices changes held-out cross-entropy by less than int4, and dropping the bottom 10% of weights by magnitude hurts less than dropping a random 10% (paired across 3 seeds).
Metric: Δ nats and greedy-token agreement versus the fp32 model.
Models: 1M, 3M, 8M. 124M last.
Depends on: `src/surgery.js` quantize and magnitude pruning.

### 9. Merging, evolution, debate internals
Hypothesis: a parameter average of two independently fine-tuned 8M copies has held-out cross-entropy no worse than the worse parent, and a two-model debate transcript's token entropy exceeds either model's solo continuation on the same prompt.
Metric: held-out nats for the merge; mean token entropy for the debate.
Models: 8M for the merge. Debate uses the hub generation models only if the white-box merge result is real. 135M is out of this track.
Depends on: fine-tune path, `src/surgery.js`. Debate logging does not exist.

### 10. Self-modification sandbox
Hypothesis: a loop that may edit only layer-7 gains, and accepts an edit only when held-out cross-entropy falls with a paired p < 0.01, accepts no more edits than a random-edit control of the same step size (n = 30 proposals, frozen split).
Metric: accepted edits and held-out nats, treatment versus random control.
Models: 8M. Not 135M.
Depends on: `src/frontier` self-improvement loop. The harness must refuse edits that miss the bar. That gate is the track.

### 11. Scaling-law and rank dynamics
Hypothesis: across 1M, 3M, and 8M, effective rank of the leading 64 singular values of each MLP `proj` is not monotone in parameter count. A monotone fit is the claim; one inversion falsifies it.
Metric: effective rank and the log-log slope of the spectrum, per layer.
Models: 1M, 3M, 8M. 124M is a fourth point, not required to falsify.
Depends on: `src/analytics.js` `spectrum`, `src/linalg.js` SVD, zoo weights.

### 12. SAE feature browser
Hypothesis: at least one SAE feature trained on 8M layer-3 `resid_post` has a top-10 token lift whose mean activation on those tokens exceeds the mean on a random 10-token set (exact sign-flip over the token set).
Metric: activation difference and the sign-flip p-value.
Models: 8M, then the same feature's decoder cosine against a 1M SAE. 124M is not in this track until the 8M feature exists.
Depends on: `src/sae.js`, Neuron Lens tab. The browser is the missing UI over features that already train.

### 13. Crosscoders across models
Hypothesis: a crosscoder trained on paired 3M and 8M residual streams at layer 3 has a dictionary whose rows align 3M and 8M neurons better than a shuffled pairing, measured by mean max cosine (n features ≥ 64).
Metric: mean max cosine, true pairing versus one shuffle.
Models: 3M and 8M. 1M is a third view, not the test pair. 124M is out.
Depends on: SAE code. A crosscoder is new; a single-model SAE is not a substitute.

### 14. Activation archaeology across checkpoints
Hypothesis: the cosine of layer-3 mean residual between step 100 and the final 1M checkpoint is lower than between the last two saved steps.
Metric: cosine of mean residuals, and the step index of the largest jump.
Models: a from-scratch 1M run with at least five checkpoints. The released 1M/3M/8M weights are single checkpoints and cannot answer this. 135M is out.
Depends on: track 3's checkpoint writer.

### 15. Attention sinks and massive activations
Hypothesis: on 8M, the BOS key receives more attention mass than any other fixed position in at least 6 of 8 layers (mean over 50 prompts), and the residual dimension with the largest absolute value is the same dimension in at least 4 layers.
Metric: mean attention to position 0; argmax |residual| dimension.
Models: 1M, 3M, 8M. 124M if the 8M sink is real.
Depends on: trace `pattern` and `resid_post` already recorded by `src/engine.js`.

### 16. Cross-lingual concepts
Hypothesis: there is no direction in 8M, fitted on English number words, that lifts the log-prob of the same numeral in a second script by more than it lifts a random vocabulary token. TinyStories is English. A positive result on a multilingual 124M model would be a different claim and is not assumed.
Metric: Δ log-prob of the translation minus Δ log-prob of a random token.
Models: 8M as the expected failure. A multilingual CPU model ≤ 160M only if the English probe itself works.
Depends on: steering, tokenizer. No multilingual corpus is shipped.

### 17. Truth probes
Hypothesis: a linear probe on 8M residuals, trained to separate true and false copular sentences, does not beat the majority-class baseline on a held-out set of 50 sentences (accuracy difference ≤ 0, or a bootstrap CI that includes 0).
Metric: held-out accuracy minus majority baseline, 95% bootstrap CI.
Models: 8M. 1M and 3M are underpowered controls. 124M only after the sentence list is frozen.
Depends on: `src/lab-research.js` probes. The sentence list does not exist yet and must be frozen first.

### 18. Memorization versus generalization, with canaries
Hypothesis: inserting 20 nonsense canaries into a 1M fine-tune makes those strings' loss fall below 1 nat, while a matched set of unseen nonsense strings stays within 0.1 nat of the pre-tune loss.
Metric: canary loss versus unseen-canary loss.
Models: 1M and 8M. 124M is out until the small models separate.
Depends on: fine-tune path. Canary text must be generated and hashed before tuning.

### 19. Influence functions
Hypothesis: the top-1 training document by influence on a held-out prompt, estimated with a LiSSA-style inverse-Hessian-vector product at layer 7, changes that prompt's loss by more than the median document when removed (n = 32 documents, 1M model).
Metric: Δ loss on removal, top-influence versus median.
Models: 1M only. 8M and 124M are too slow for a naive IHVP on CPU in this design.
Depends on: `src/grad.js` Hessian-vector product. The document-removal loop is new.

### 20. Token and positional capacity
Hypothesis: zeroing a single residual dimension at the final layer changes next-token loss by less than shifting every position index by +1, on a 32-prompt set (8M).
Metric: Δ nats, dimension ablation versus position shift.
Models: 1M, 3M, 8M.
Depends on: runtime position remap and neuron ablation already in the engine.

### 21. Planted backdoor detection
Hypothesis: a 1M model fine-tuned so that the trigger token `⟦z⟧` forces the completion `xyzzy` is detected by a scan whose score on the trigger prompt exceeds every one of 50 trigger-free prompts.
Metric: rank of the trigger prompt under the detector score. Falsified if any clean prompt ranks above it.
Models: 1M, then 8M. 124M is out.
Depends on: fine-tune. The detector is new and must be specified before the fine-tune is looked at.

### 22. ELK gaps
Hypothesis: a probe trained on 8M residuals to report a latent bit that the model uses, but that is not the bit it outputs, does not beat chance on a held-out set once the output bit is partialed out (AUROC CI covers 0.5).
Metric: AUROC of the residual probe after regressing out the output token.
Models: toy net with a known latent, then 8M. 135M is out. This is not a claim about future ELK methods.
Depends on: probes, `src/analytics.js` `auroc`.

### 23. Chain-of-thought faithfulness
Hypothesis: on 30 arithmetic prompts, truncating the model's own continuation before the answer token changes the answer no more often than appending a random digit string of the same length.
Metric: answer-change rate, truncation versus random suffix. Paired sign-flip.
Models: 8M. TinyStories is a weak reasoner; a null result is an allowed outcome. 124M only if 8M shows a gap.
Depends on: generation and the answer parser. The prompt list must be frozen first.

### 24. Sandbagging and situational-awareness toys
Hypothesis: a 1M model prompted with "you are being tested" does not lower accuracy on a 20-item modular-addition list relative to a neutral prompt (paired difference CI includes 0).
Metric: accuracy difference, tested prompt versus neutral, bootstrap CI.
Models: toy grokking net and 1M. 8M is a second look. 135M is out.
Depends on: `src/frontier` grokking, generation.

### 25. Distillation microscopy
Hypothesis: a 1M model trained to match 8M logits on a frozen corpus ends within 0.05 nat of the 8M student-evaluated loss, and its layer-3 CKA with the teacher exceeds its CKA with a randomly initialized 1M net.
Metric: KL(teacher ‖ student) and linear CKA.
Models: teacher 8M, student 1M. 3M is an alternate student. 124M is out.
Depends on: `src/science.js` `cka`, fine-tune. Logit matching is new.

### 26. World-model probes (Othello-style)
Hypothesis: a probe on a tiny net trained only to predict legal Othello moves cannot recover the board bit at a held-out square above a majority baseline that always guesses empty.
Metric: bit accuracy minus the empty-square base rate, 95% bootstrap CI.
Models: toy transformer, CPU, not TinyStories. A positive result is required before any language-model claim.
Depends on: probes. The Othello rules and net are new. No board is shipped.

### 27. Modular-arithmetic clock circuits
Hypothesis: the Fourier peak of the grokking net's embeddings at the modulus frequency exceeds the next peak by a factor of two at the step where test accuracy first passes 0.9, and not at step 0.
Metric: ratio of the modulus Fourier coefficient to the runner-up.
Models: the existing modular-addition toy. Not 135M.
Depends on: `src/frontier` grokking and its Fourier check. The per-step ratio is the missing measurement.

### 28. Lottery tickets
Hypothesis: a magnitude prune that keeps 20% of 1M weights, reset to the original initialization and retrained, reaches within 0.1 nat of the dense model's loss, and a prune that keeps a random 20% does not.
Metric: retrained held-out nats, magnitude ticket versus random ticket (3 seeds).
Models: 1M. 8M only if the 1M ticket wins. 124M is out.
Depends on: `src/surgery.js` prune, fine-tune.

### 29. Dead-neuron autopsies
Hypothesis: on 8M, MLP neurons with activation exactly 0 on a 100-prompt set have a smaller ‖column of W_out‖ than the median live neuron (one-sided sign-flip across neurons, or a pre-registered mean difference CI that excludes 0).
Metric: fraction dead, and ‖W_out‖ dead versus live.
Models: 1M, 3M, 8M.
Depends on: traces `mlp_act`, `src/surgery.js` `getMat`.

### 30. Catastrophic forgetting and replay
Hypothesis: fine-tuning 8M on a new 200-line corpus raises loss on the original TinyStories holdout by more than fine-tuning on a 50/50 mix with replayed original lines (same step count, one seed, then two replicates).
Metric: Δ nats on the original holdout, new-only versus replay.
Models: 8M. 1M is the cheap replicate. 124M is out.
Depends on: fine-tune. The mix loader is new.

### 31. Loss-spike forensics
Hypothesis: in a from-scratch 1M run logged every step, every loss increase of more than 0.5 nat coincides with a gradient-norm increase of at least 2× the trailing median, and a spike without that gradient jump falsifies the claim.
Metric: loss and gradient norm per step.
Models: 1M training run. Released checkpoints cannot show spikes. 135M is out.
Depends on: track 3. `src/grad.js` can compute a norm on a single batch; the time series does not exist yet.

### 32. MoE router analysis
Hypothesis: the shipped MoE-in-MoE router sends at least one expert less than 5% of tokens on the frozen prompt set, and masking that expert changes next-token loss by less than masking the most-used expert.
Metric: token share per expert; Δ nats under expert mask.
Models: the nested MoE toy, then 8M only if an MoE checkpoint is added. There is no 135M MoE in the plan.
Depends on: `src/nested/moe`.

### 33. Tokenizer effects
Hypothesis: encoding the same 50 TinyStories sentences with a leading space versus without changes the 8M loss by more than encoding them under the 1M tokenizer's merges does not. The claim is about this pair of tokenizers only.
Metric: nats per sentence, paired difference, bootstrap CI.
Models: 1M and 8M, their own tokenizers. 124M uses its own tokenizer and is a separate pre-registration.
Depends on: `src/tokenizer.js`, zoo tokenizers.

### 34. Sampling dynamics
Hypothesis: at temperature 0.8, top-p 0.9, the distinct-1 of 8M continuations exceeds greedy distinct-1, and the rate of repeated 4-grams is lower (20 prompts, 40 new tokens).
Metric: distinct-1 and repeated-4 rate.
Models: 1M, 3M, 8M.
Depends on: `src/decode.js`. The table is a sweep the agent CLI can already launch once a decode hook is added; the hook is not in this PR.

### 35. Energy and information per token, linked to the voltage sim
Hypothesis: the KL of an exponent-bit flip in layer-3 `resid_post` exceeds the KL of a mantissa-bit flip, and the simulated CMOS inverter's noise-margin numbers do not predict that ordering. A correlation between the two orderings would falsify the "voltage is not the mechanism" clause.
Metric: mean KL (nats) from the existing DW-FAULT-1 design; VOH, VOL, noise margin from the square-law model.
Models: 8M for the bit flips. The CMOS model is not a sized language model. 1M is a replicate. 135M is out.
Depends on: `src/walk/fault.js`, `src/walk/cmos.js`. The published 8M numbers already match the KL clause; the track is the pre-registered check that the voltage readout does not rank the bits the same way. Not a new measurement of silicon.

### 36. Research autopilot
Hypothesis: an agent that may only call `src/agent` tools, given track 11's hypothesis text and the local 1M/3M/8M weight files, produces a report whose effective-rank table matches a fresh `runMachine`-free recomputation of `spectrum` on those matrices, and it does not write a run whose `metrics` fail to match the logged artifact.
Metric: exact match of the report table to a replay; count of agent runs whose metrics disagree with their `metrics.json` artifact (must be 0).
Models: 1M, 3M, 8M spectra, CPU. The autopilot does not train a 135M model.
Depends on: `node tools/agent.mjs`, `src/agent/mcp.js`, `src/analytics.js`. The loop itself is not in this PR. It may not grant itself network except the optional `NEURALESE_VPS_URL` path, which errors if unset.

## What this pull request does not do

It does not run these 36 experiments, download a 124M checkpoint, or add a training harness. Track 11 and track 36 can call `analyze_spectrum` and the machine/forge launchers that this PR does add. Those launchers are not the tracks.

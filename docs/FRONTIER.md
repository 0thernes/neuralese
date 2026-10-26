# FRONTIER (v11): consciousness-science proxies, introspection, self-improvement, grokking and a causal atlas — tested honestly

**What this is not.** Nothing here shows, or claims, that TinyStories-8M is conscious, sentient, introspective in a human sense, or superintelligent. Each module turns a frontier question into an *operational proxy* with an explicit definition, a *null model*, and a *pass/fail threshold that was frozen before any experiment ran*: [`PREREG-v11.md`](PREREG-v11.md), sha256 `8b923ab4…ddbec93`, committed to `main` at `2a2b3ef` (frozen 2026-10-26 00:16:32 PT). Every result file in `site/frontier/data/` cites that hash; `test/v11.test.mjs` re-scores each file against the frozen rule.

**Scorecard: 14 pre-registered hypotheses — 6 supported (H1a, H2a, H4a, H4b, H5c, H6a), 8 not supported (H2b, H3a, H3b, H4c, H4d, H5a, H5b, H6b; H4c is a prediction falsified in the "good" direction).**

| test | hypothesis (frozen threshold) | result | verdict |
|---|---|---|---|
| P1 H1a | PCI(trained) > random-init and > shuffled, CIs exclude 0 | means .971 / .964 / .871; trained−random +0.0069 [+0.0010, +0.0131]; trained−shuffled +0.100 [+0.090, +0.110] | **supported** (but tiny vs random-init; near ceiling) |
| P2 H2a | median Hill n ≥ 2 for concept-injection dose–response | median n = 3.00 (104/104 fits) | **supported** |
| P2 H2b | n(trained) − n(random-init) CI > 0 | +1.31 [−0.21, +2.65] (random-init: 79/104 fits) | **not supported** |
| P3a H3a | held-out-concept injection-detection AUC ≥ .75 and ≥ +.10 over random-init | .700 vs .533 | **not supported** (beats null, misses the .75 bar) |
| P3b H3b | own activations predict own entropy better than 3M and 1M models' activations | R² self .428; 3M→8M .397; 1M→8M .308; self−3M +0.031 [−0.003, +0.072]; symmetric 3M check reversed (−0.038 [−0.082, −0.001]) | **not supported** — no privileged self-access |
| P4 H4a | 30-iteration propose/select/test loop improves test CE, CI excludes 0 | 1.3623 → 1.3572; Δ −0.0051 [−0.0076, −0.0027]; 3 gradient edits accepted, then 27 rejections (stalled) | **supported** (small) |
| P4 H4b | random-edit control passes the gate ≤ 10% | 0 / 30 | **supported** |
| P4b H4c | self-distillation does NOT improve test CE | 1.3619 → 1.3500; Δ −0.0118 [−0.0154, −0.0085] | **prediction falsified** (it did improve) |
| P4c H4d | test-time training improves continuation CE | lr 1e-3 (chosen on select); Δ −0.0012 [−0.0035, +0.0012] | **not supported** |
| P5 H5a | grokking: test ≥ 95% at ≥ 2× the step train hits 99% | train 99% at 1050; test reached only 0.62 by 6000 | **not supported** (partial, slow generalisation) |
| P5 H5b | ≥ 80% Fourier-concentrated neurons after, ≤ 20% at init | 0.4% → 70.7% | **not supported** (strong rise, below bar) |
| P5 H5c | weight decay 0 → test acc < 50% | 1.9% | **supported** |
| P6 H6a | Spearman(AtP, exact) ≥ .5 for neurons and heads | ρ neurons 0.982, heads 0.560 | **supported** |
| P6 H6b | top 1% neurons hold ≥ 25% of \|ΔCE\| | 5.8% | **not supported** |

CIs are 95% document-bootstrap (2000 resamples), splits propose 0–13 / select 14–26 / test 27–39 of the 40-doc corpus.

## Methods (summary — exact specs in PREREG-v11.md)
- **Nulls.** random-init (N(0, 0.02²), LN gain 1, biases 0, seed 1); shuffled (each tensor permuted, seed 1); TinyStories-3M and -1M as cross-model readers; a same-norm random edit in the loop.
- **P1 PCI-style** (Casali et al. 2013; LZ76, Lempel & Ziv 1976): kick layer-0 residual at position 8 with a random direction of residual norm, binarise |Δ resid_post| > 0.1·layer RMS over all later positions and layers, LZ76 normalised by n·log2 n / H. 10 directions × 13 test docs × 48 tokens.
- **P2 ignition** (Dehaene & Changeux 2011; injection à la Turner et al. 2023): add α·e_concept at layer 0, pos 4, 16 α log-spaced 0.05–20; response Δlog p(concept) at the last position; Hill fit by grid search.
- **P3a injected-concept detection** (scaled-down analogue of Lindsey 2025): inject at layer 2 pos 6, logistic probe on layer-6 resid at the last position, 16 train / 16 held-out concepts.
- **P3b privileged self-prediction** (Binder et al. 2024): ridge from mid-layer resid → the 8M's own next-token entropy; λ on select docs, R² on test docs; compare 8M, 3M, 1M, random-init readers; symmetric check on 3M.
- **P4 loop** (cf. STaR, SEAL, Darwin Gödel Machine for the propose/validate pattern): θ = ln_f (512) + layer-7 neuron gains (1024). Proposals: (A) own gradient, ‖Δ‖=0.05; (B) zero the neuron with the best attribution-patching estimate (Syed et al. 2023); (C) random, same norm. Accept the best candidate only if one-sided paired t-test on select-doc positions gives p < 0.01. Test docs never influence decisions. **P4b** self-distillation (cf. Shumailov et al. 2023): 28 sampled stories (T=0.8), keep 14 lowest own-perplexity, Adam 20 steps lr 1e-3 on θ. **P4c** TTT (Sun et al. 2019): Adam on first 32 tokens, 5 steps.
- **P5 grokking** (Power et al. 2022; Gromov 2023 x² net; Nanda et al. 2023 Fourier check; Liu et al. 2022 weight decay): p=31, 256 hidden, AdamW lr 3e-3, wd 1, 50% split, 6000 steps, seed 1; control wd=0.
- **P6 causal atlas**: exact zero-ablation of all 128 heads and 8192 MLP neurons, one at a time, re-running from the ablated layer; 4 test docs × 48 targets; vs attribution patching (−act·grad).

## Reading the results honestly
- **P1** passes the letter of the rule but the trained-vs-random-init gap (+0.007 on a ~0.97 scale) is negligible: a random network's perturbation response is already near-incompressible. PCI here mostly measures *noise-like spreading*, not integration. Shuffled weights (which keep the weight distribution but scramble structure) score lower; that is the more informative contrast.
- **P2** the trained model's response *is* switch-like (n≈3), but random-init is not reliably different (CI includes 0, and 25 random-init curves were unfittable). Sigmoidal dose–response is expected from softmax saturation alone; it is not ignition in the GWT sense. The mean curve is also non-monotonic (it peaks near α≈3 and falls at large α as the injection swamps the residual stream), so a Hill model fits only its rising part.
- **P3** no privileged self-knowledge at 8M parameters: a 3M model's activations predict the 8M's uncertainty about as well as the 8M's own, and the 8M reads the 3M's entropy better than the 3M does. Injected-concept detection generalises above chance (AUC .70) but below the bar.
- **P4** the "self-improvement" loop gains 0.005 nats from three gradient steps on 1 536 parameters and then stalls: proposals A/B are deterministic given θ, so once rejected they repeat. Self-distillation *helped* (−0.012 nats), contrary to our prediction; the most plausible reading is calibration of ln_f/gains to the in-distribution sampled text, not new knowledge — but we did not pre-register a test of that explanation, so it remains a hypothesis. TTT gave no reliable gain.
- **P5** the network memorises by step 1050 and then generalises slowly to 62% test accuracy by 6000 steps; Fourier concentration rises from 0.4% to 71% of neurons. This is the grokking trajectory in progress, not a completed grok, under the pre-registered budget. Without weight decay it stays at chance (1.9%). An exploratory longer run was *not* performed for this release.
- **P6** attribution patching (one forward + one backward pass) ranks the 8192 neurons almost exactly like exact ablation (Spearman ρ 0.982) but heads only moderately (ρ 0.560, just over the .5 bar): AtP is a first-order estimate and heads have larger, more nonlinear effects. Causal mass is spread out, not concentrated: the top 1% of neurons (82) hold only 5.8% of total |ΔCE| (bar 25%), so H6b fails. Exact run: 8320 units × 4 test docs × 48 targets, 8714 s on 6 CPU workers; baseline CE 1.507.

## Novelty assessment (cautious)
Individually every method here is published (citations below). We did **not** run a systematic literature search for prior combinations, so novelty is unverified. What we are not aware of is the *combination*: a fully in-browser, pre-registered battery that applies consciousness-science indicator proxies, introspection tests with cross-model baselines, a gated self-improvement loop, a grokking replication and an exhaustive exact single-unit causal atlas to one released LM, with every result file hash-linked to a public pre-registration and live re-checkable in the page. That is a claim about packaging and rigour, not about a new phenomenon. Exhaustive exact ablation of every neuron of a small LM is feasible and has likely been done privately; we claim no priority.

## Limits
One tiny model; 40 short documents; 13 test docs (wide CIs); proxies borrowed from neuroscience whose validity even in brains is debated; the indicator framework assumes computational functionalism; random-init and shuffled nulls are not the only sensible nulls; the loop edits only 1 536 parameters; grokking used one seed and one budget.

## Deviations from the pre-registration
- **D1** P3b and P4c assumed every document has ≥ 48 / ≥ 34 tokens; several select docs are shorter (22–44 tokens). P3b now uses each doc's own length; TTT lr selection skips docs < 34 tokens. Both were re-run; the first P3b run (all-NaN) and the first TTT run (NaN) are discarded. Found after seeing NaN output, before seeing any valid numbers.
- **D2** `core.js` lgamma: an eslint-disable comment only; no numeric change.
- **D3** `rsi-*.json` lacked the `prereg` hash field (runs started before the tool wrote it); added at copy time and marked `preregNote`.
- **D4** PREREG P5 text says "lr 3e-3? decided by the first config"; the first config is lr 3e-3, which was used. Wording left unchanged in the frozen file.
- **D5** Concept list: 32 single-token nouns chosen before P2/P3a ran (`site/frontier/data/concepts.json`); the prereg named the counts but not the words.
- **D6** v11.0.0 shipped (2026-10-26 ~02:50 PT) showing P6 as "running / results pending"; the full-scope atlas had in fact finished at 02:43 PT, unnoticed. v11.0.1 publishes its verdicts unchanged against the frozen thresholds (H6a supported, H6b not). Scope was not reduced.

## Citations (each verified against arXiv or the DOI record, 2026-10-26)
- Consciousness in Artificial Intelligence: Insights from the Science of Consciousness — Butlin, Long, Elmoznino, Bengio, Birch, Constant, Deane, Fleming, Frith, Ji, Kanai, Klein, Lindsay, Michel, Mudrik, Peters, Schwitzgebel, Simon, VanRullen — arXiv:2308.08708 (scorecard)
- Identifying indicators of consciousness in AI systems — Butlin, Long, Bayne, Bengio, Birch, Chalmers et al. (Trends in Cognitive Sciences) — doi:10.1016/j.tics.2025.10.011 (scorecard)
- A Theoretically Based Index of Consciousness Independent of Sensory Processing and Behavior — Casali, Gosseries, Rosanova et al. (Sci Transl Med 2013) — doi:10.1126/scitranslmed.3006294 (P1 PCI)
- On the Complexity of Finite Sequences — Lempel, Ziv (IEEE Trans Inf Theory 1976) — doi:10.1109/TIT.1976.1055501 (P1 LZ76)
- Measuring Integrated Information from the Decoding Perspective — Oizumi, Amari, Yanagawa, Fujii, Tsuchiya (PLoS Comput Biol 2016) — doi:10.1371/journal.pcbi.1004654 (background (Φ*; not computed))
- Practical Measures of Integrated Information for Time-Series Data — Barrett, Seth (PLoS Comput Biol 2011) — doi:10.1371/journal.pcbi.1001052 (background (Φ proxies))
- Experimental and Theoretical Approaches to Conscious Processing — Dehaene, Changeux (Neuron 2011) — doi:10.1016/j.neuron.2011.03.018 (P2 ignition)
- A Case for AI Consciousness: Language Agents and Global Workspace Theory — Goldstein, Kirk-Giannini — arXiv:2410.11407 (scorecard (GWT))
- Transformer Dynamics: A neuroscientific approach to interpretability of large language models — Fernando, Guitchounts — arXiv:2502.12131 (P1/P2 framing)
- Emergent Introspective Awareness in Large Language Models — Lindsey — arXiv:2601.01828 (P3a concept injection)
- Looking Inward: Language Models Can Learn About Themselves by Introspection — Binder, Chua, Korbak, Sleight, Hughes, Long, Perez, Turpin, Evans — arXiv:2410.13787 (P3b cross-model self-prediction)
- Steering Language Models With Activation Engineering — Turner, Thiergart, Leech, Udell, Vazquez, Mini, MacDiarmid — arXiv:2308.10248 (P2/P3a injection)
- Discovering Latent Knowledge in Language Models Without Supervision — Burns, Ye, Klein, Steinhardt — arXiv:2212.03827 (P3a probing)
- Attribution Patching Outperforms Automated Circuit Discovery — Syed, Rager, Conmy — arXiv:2310.10348 (P4 proposal B, P6 AtP)
- Test-Time Training with Self-Supervision for Generalization under Distribution Shifts — Sun, Wang, Liu, Miller, Efros, Hardt — arXiv:1909.13231 (P4c TTT)
- Learning to (Learn at Test Time): RNNs with Expressive Hidden States — Sun, Li, Dalal et al. — arXiv:2407.04620 (P4c TTT)
- STaR: Bootstrapping Reasoning With Reasoning — Zelikman, Wu, Mu, Goodman — arXiv:2203.14465 (P4b self-training)
- The Curse of Recursion: Training on Generated Data Makes Models Forget — Shumailov, Shumaylov, Zhao, Gal, Papernot, Anderson — arXiv:2305.17493 (P4b prediction)
- Self-Adapting Language Models — Zweiger, Pari, Guo, Akyürek, Kim, Agrawal — arXiv:2506.10943 (P4 context (SEAL))
- Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents — Zhang, Hu, Lu, Lange, Clune — arXiv:2505.22954 (P4 context (archive + empirical validation))
- Absolute Zero: Reinforced Self-play Reasoning with Zero Data — Zhao, Wu, Yue et al. — arXiv:2505.03335 (P4 context)
- Grokking: Generalization Beyond Overfitting on Small Algorithmic Datasets — Power, Burda, Edwards, Babuschkin, Misra — arXiv:2201.02177 (P5)
- Progress measures for grokking via mechanistic interpretability — Nanda, Chan, Lieberum, Smith, Steinhardt — arXiv:2301.05217 (P5 Fourier)
- Grokking modular arithmetic — Gromov — arXiv:2301.02679 (P5 architecture (x² net))
- Omnigrok: Grokking Beyond Algorithmic Data — Liu, Michaud, Tegmark — arXiv:2210.01117 (P5 weight decay)
- Grokking at the Edge of Numerical Stability — Prieto, Barsbey, Mediano, Birdal — arXiv:2501.04697 (P5 context)
- TinyStories: How Small Can Language Models Be and Still Speak Coherent English? — Eldan, Li — arXiv:2305.07759 (the model)

# NEURALESE v11 — pre-registration (written before any v11 experiment was run)

Written 2026-10-26 00:40 America/Los_Angeles. The SHA-256 of this file is recorded in `site/frontier/data/prereg.json`
together with the time it was frozen; every result file records the same hash. Thresholds below are not changed after
seeing data. If an analysis had to change, the change and the reason are listed in FRONTIER.md under "Deviations".

General rules: the model is `roneneldan/TinyStories-8M` (fp32). Text = the 40 documents of `site/corpus.js`
(TinyStories validation stories). Doc splits: **propose** 0–13, **select** 14–26, **test** 27–39 (test is never used to
choose anything). Null models: **random-init** (same architecture, GPT-Neo init N(0, 0.02²), LayerNorm gain 1, bias 0,
seed 1), **shuffled** (each weight tensor of the trained model independently permuted, seed 1; preserves every
tensor's value distribution, destroys structure). CIs are 95%; bootstrap CIs use 2000 resamples over documents.
**None of these tests can show that the model is or is not conscious, sentient or superintelligent.** They test
operational, theory-derived proxies only.

## P1 — Perturbational complexity (PCI-analog)
Perturb the residual stream at layer 0, position 8, with a random direction of norm equal to that position's residual
norm (10 directions per doc, docs 27–39, first 48 tokens). Response matrix: |Δ resid_post| for every layer × position ≥ 8 ×
dimension; binarised at > 0.1 × the per-layer RMS of the unperturbed residual. PCI = LZ76 complexity of the binary
sequence (layer-major), normalised by L·log2(L)/H(p) as in Casali et al. 2013.
- **H1a:** PCI(trained) > PCI(random-init) and > PCI(shuffled); the doc-bootstrap CI of each difference excludes 0.
- Reported either way; a pass would show structured, differentiated propagation, not consciousness.

## P2 — Ignition (global-workspace proxy)
Inject α·u at layer 0, position 4 (u = unit embedding of a concept token, 8 concepts × docs 27–39), α on a 16-point log
grid from 0.05 to 20 residual-norms. Response = increase in log-prob of the concept token at the last position (≥ 20
tokens later). Fit a Hill curve R(α) = R_max·αⁿ/(αⁿ + Kⁿ) (grid search).
- **H2a ("ignition"):** median Hill exponent n ≥ 2 for the trained model (an all-or-none, threshold-like response).
- **H2b:** median n(trained) − median n(random-init) > 0 with bootstrap CI excluding 0.

## P3 — Introspection proxies
**P3a, injection detection (Lindsey 2025-style, adapted: an 8M model cannot verbally report).** Inject a concept vector at
layer 2, position 6 (norm = 1 residual-norm), concepts split into 16 train / 16 held-out concepts. A logistic probe reads
layer-6 resid_post at the LAST position (≥ 10 tokens later) and must say injected vs not.
- **H3a:** held-out-concept AUC ≥ 0.75 for the trained model **and** AUC(trained) − AUC(random-init) ≥ 0.10.
**P3b, self-prediction (Binder et al. 2024 cross-prediction design).** Ridge probes (λ chosen on select docs) read layer-L/2
resid_post of a model and predict the 8M model's next-token entropy; train on propose docs, report R² on test docs.
Compared readers: 8M itself, TinyStories-3M, TinyStories-1M (both trained on the same data), random-init 8M.
- **H3b:** R²(8M reads 8M) − R²(3M reads 8M) > 0 and − R²(1M reads 8M) > 0, doc-bootstrap CI excluding 0 ("privileged
  access" in Binder's sense). Symmetric check: 3M predicting its own entropy beats 8M predicting 3M's.

## P4 — Recursive self-improvement loop
Editable parameters: ln_f gain/bias (512) + per-neuron output gains of layer-7 MLP (1024). Each iteration the model's own
analyses propose 3 edits: (A) its own gradient on propose docs (step 0.05·‖g‖-normalised), (B) zero the layer-7 neuron
whose attribution-patching estimate predicts the largest propose-loss reduction, (C) a **random** edit with the same norm
as A (control). The candidate with the best select-CE is accepted only if a one-sided paired t-test over select positions
gives p < 0.01 and mean ΔCE < 0. 30 iterations; every iteration is logged with propose/select/test CE, edit L2,
predictive entropy (diversity).
- **H4a:** test CE after 30 iterations < initial test CE, doc-bootstrap CI of the difference excluding 0.
- **H4b (gate works):** the random control (C) is accepted in ≤ 10% of iterations.
**P4b, self-distillation:** the model generates 28 stories (temperature 0.8, 64 tokens, seed 1), keeps the 14 with the lowest
own-perplexity, fine-tunes the same parameters (Adam, 20 steps, lr 1e-3) on them.
- **H4c:** test CE does **not** improve (CI of improvement includes 0 or is worse) — the model-collapse prediction.
**P4c, test-time training on the prompt:** for each test doc, Adam on the first 32 tokens (k = 5 steps, lr from {1e-3, 3e-3,
1e-2} chosen on select docs), evaluate CE on the rest of the doc.
- **H4d:** TTT improves continuation CE, doc-bootstrap CI excluding 0.

## P5 — Grokking (modular addition, in-browser trainable)
Task a + b mod 31, 2-layer MLP (Gromov 2023: one-hot inputs → 256 hidden, x² activation → 31), AdamW (lr 3e-3? decided by
the first config listed in `grok.js`, weight decay 1.0), 50% train split, seed 1, full-batch, 6000 steps.
- **H5a:** delayed generalisation: step(test acc ≥ 95%) ≥ 2 × step(train acc ≥ 99%).
- **H5b:** Fourier mechanism: after training, ≥ 80% of hidden neurons have ≥ 50% of their (non-DC) input-weight power in one
  frequency; at initialisation, ≤ 20% do.
- **H5c (control):** with weight decay 0, test acc stays < 50% at 6000 steps.

## P6 — Complete single-unit causal atlas
Exact zero-ablation of every attention head (128) and every MLP neuron (8192) of the 8M model on 4 test docs (48 tokens),
measured as ΔCE, compared with the one-pass attribution-patching (AtP) estimate (Syed et al. 2023).
- **H6a:** Spearman ρ(AtP, exact) ≥ 0.5 over neurons, and ≥ 0.5 over heads.
- **H6b:** effects are sparse: the top 1% of neurons account for ≥ 25% of the total |ΔCE| mass.

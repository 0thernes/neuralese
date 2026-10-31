# Neuron Lens in Neuralese (v14): method, sources, deviations

## Prior art and credit
The method is **neuron-lens** by **a9lim** ([@_a9lim](https://x.com/_a9lim)) and **treetown** ([@treetowntree](https://x.com/treetowntree)), written with Claude (Anthropic), 2026:
code at https://github.com/stdlogits/neuron-lens (we read commit `44867947`), catalog at https://huggingface.co/datasets/stdlogits/neuron-lens (CC BY 4.0, revision `b5bf11a`), site at https://neuron-lens.com.
It builds on:
- the **J-lens** (Gurnee et al., 2026), which is the R-lens here;
- the **K-lens** (Theia Vogel), which is the S-lens here;
- **RelP** relevance propagation (Rezaei Jafari et al., 2025, arXiv:2508.21258), whose LN, identity and half rules define the linearisation;
- the RelP rule set as used by camilablank, Agam Bhatia and Neel Nanda (2026).

**Implementation status: original.** Every line of `neuronlens.js`, `lens-worker.js`, `lab-lens.js` and `tools/nlens-*.mjs` was written from scratch for Neuralese in JavaScript. We read the authors' repository and design notes to understand the method, and we copied no code. Function names, data layout and algorithms (batched dim-seeded JVP/VJP, worker pool, batched token reads, the covariance trick for head z-scores) are our own. Where our results can be compared with theirs, we compare numbers rather than code.

The only third-party data we redistribute is `lens/ext/neuron-lens-sample.json`, an attributed subset of their CC BY 4.0 catalog. `lens/ext/ATTRIBUTION.md` records the source, revision, license and changes.

## What a lens is here
TinyStories-8M is GPT-Neo: d=256, 8 layers, 16 heads of 16 dims, ff=1024, GELU-tanh, LayerNorm, tied embeddings, and no 1/√hd attention scale. We linearise the model around a document, so each layer's residual update becomes a linear map of its tangent, and then average per-position Jacobians:

- **R-lens** ("what does this direction do downstream"): J_L = mean_t Σ_{t'≥t} ∂h_final(t')/∂h_L(t), computed by reverse-mode products (`vjp`, `docJacobianR`). A direction w at layer L reads as logits W_U · LNdir(J_L w).
- **S-lens** ("which input tokens produce this direction"): K_L = mean_t Σ_{s≤t} ∂h_L(t)/∂e(s), computed by forward-mode products (`jvp`, `docJacobianS`). Token v scores w · K_L (W_E[v] − ē).
- **Targets.** `out` is the layer output: R.out at L0–L6 (L7.out is the final state, read by the logit lens) and S.out at L0–L7. `mid` is the post-attention, pre-MLP point (R.mid and S.mid at L0–L7). MLP **inputs** and attention **outputs** live at mid; MLP **outputs** and attention **inputs** live at out.
- **Linearisation rules (RelP).** Each LayerNorm keeps its centring but holds 1/σ fixed. GELU g·φ(g) passes the tangent as φ(g)·dg. Attention keeps its exact derivative, softmax included. GPT-Neo has no gated MLP, so the half rule never applies.
- **Positions.** The first 16 tokens are skipped (SKIP_FIRST=16) as attention-sink warm-up, and so is the last token. The primal pass runs on ids[:-1].

## Fit (tools/nlens-fit.mjs)
- Corpus: TinyStories-valid.txt, sha256-pinned in `tools/nlens-common.mjs`. Stories 0.. whose length is ≥ T tokens.
- Size: **64 documents × T=65 tokens**, giving 48 valid positions per document. We average one R and one S estimate per document; jobs are cached on disk, so the fit can resume.
- Split-half: even documents are fitted against odd ones, and `manifest.json` reports the agreement for every target and layer.
- Output: `lens/ts8m/lenses.f32` (31 blocks of 256×256 float32), sha256-pinned in `manifest.json`.

The authors fitted Qwen3-8B on 1000 × 128-token documents. We use 64 × 65 because a CPU-only JavaScript fit on a shared machine took about an hour at that size. The split-half numbers say how much this costs.

## Reads (tools/nlens-db.mjs → lens/ts8m/db)
For neuron n at layer l, the input direction is c = C(γ₂ ⊙ W_fc[n]) (LN-centred and γ-scaled) and the output direction is w = W_proj[:, n].
- `in_S` = S.mid read of c: the tokens that drive it.
- `in_R` = R.mid read of c.
- `out_R` = R.out read of w: the tokens it promotes. At L7 this is the logit lens.
- `out_S` = S.out read of w: its write footprint in embedding space.
- `out_logit` = the logit-lens baseline.
- `out_R_neg` = the tokens it suppresses most.
- `drivers` = exact drivers, measured by substituting each of 3000 frequent tokens at position 24 of 2 held-out stories.
- `ctx` = the top-firing context over 64 held-out stories.

Only tokens seen at least 5 times in stories 0–19999 are used (7.4k of the 50k vocabulary).

For head h at layer l, we LN-shape each token's input footprint through ln_1 (the embedding at L0; S.out[l−1] above that) and push it through Q, K, V:
- `ov_R` and `ov_S` = diagonal copy z-scores: how much the OV circuit promotes the same token it reads, standardised with the head's 16×16 covariance.
- `writes_R` = the R read of the frequency-weighted mean write.
- `qk_S` = the keys the mean query seeks.
- `qk_self` = the tokens that seek themselves.
- `attn_prev/first/self` = attention mass measured on 64 stories.

## Validation (docs/PREREG-v14.md, tools/nlens-validate.mjs)
The hash of the pre-registration is pinned in `test/v14.test.mjs`. One documented amendment fixed an empty document range; it was made before any fitted-lens run.

- **Test A (lens predicts steering).** Add 4·p99·w to neuron n's output at every position of 16 held-out stories. Then compute the Pearson r between the mean Δlog-prob over kept tokens and each lens's read of w.
  - Lenses compared: R.out, R.mid, S.out, S.mid, the logit lens, and a tuned lens (a least-squares affine translator from layer L to the final layer, fitted on the fit documents).
  - Null: τ99 of r over mismatched (neuron, other neuron's read) pairs.
  - Also reported: the top-10 rise rate against random tokens, Wilson CIs and bootstrap CIs.
- **Test B (input reads predict drivers).** Spearman ρ between the exact-driver activation profile and each input read.

## Deviations from the authors' setup (all intentional, all stated)
1. LayerNorm instead of RMSNorm. We keep centring; reads use LNdir (centre, unit RMS, ⊙γ) without the bias.
2. 64 docs × 65 tokens instead of 1000 × 128.
3. The causal check uses one dose (4× the 99th-percentile activation, + pole only) instead of 1× and 4×.
4. The tuned-lens baseline is fitted by least squares, not KL.
5. Head footprints use a frequency-weighted mean query.
6. Only TinyStories-8M is fitted in v14.0. distilgpt2 and GPT-2 are planned for v14.1 (docs/ROADMAP-v14.md).

# Course: TinyStories-8M from zero to interpretability research

14 lessons, beginner → advanced. Each has a lecture, a diagram (in the app), a lab you run with the in-app terminal, and a quiz. Answers are at the end.

## 1 · What a language model computes
*Beginner · 15 min*

A causal language model maps a sequence of token ids to a probability distribution over the **next** token. TinyStories-8M has a 50 257-token vocabulary, a 256-dimensional residual stream and 8 transformer layers (≈19.7 M parameters, 12.9 M of them in the tied embedding matrix).

Generation is a loop: run the prompt, turn the final vector into **logits** (one score per vocabulary token), apply softmax to get probabilities, choose a token (greedy or sampled), append it and repeat. A **KV cache** stores each layer's keys and values so every new token costs one forward step.

Two numbers describe each step: the **entropy** of the distribution (uncertainty, in nats) and the **surprisal** −ln p of the chosen token. The TIMELINE tab plots both for every generated token.

### Lab
```
version
params
gen 30 Once upon a time
tab timeline
```
After the lab, press "refresh" in TIMELINE: tokens with high surprisal are where the model was surprised by its own sample.

### Quiz
1. What does the model output at each step?
   a) One token id
   b) A probability distribution over the vocabulary
   c) A 256-d embedding
2. Where is most of TinyStories-8M's parameter count?
   a) MLP weights
   b) Attention weights
   c) The token embedding matrix
3. Surprisal of a token with p = 0.5 is about…
   a) 0.69 nats
   b) 0.5 nats
   c) 2 nats

## 2 · Decoding: temperature, top-k, top-p
*Beginner · 15 min*

Decoding turns probabilities into a choice. **Greedy** takes the argmax. **Temperature** divides logits by T before softmax: T<1 sharpens, T>1 flattens. **Top-k** keeps the k best tokens; **top-p** (nucleus) keeps the smallest set whose mass ≥ p; **min-p** keeps tokens with p ≥ min_p·p_max. Repetition/frequency/presence penalties discourage loops.

Advanced modes in GEN: **beam search** keeps B hypotheses; **contrastive decoding** subtracts the clean (amateur) model's log-probs from the hacked (expert) one; **CFG** extrapolates away from a negative prompt.

### Lab
```
set mode greedy
gen 20 The little dog
set mode sample
set temp 1.5
gen 20 The little dog
set temp 0.8
```
Compare the greedy and T=1.5 outputs; then open TIMELINE: entropy is a property of the model, but surprisal of the chosen token rises with temperature.

### Quiz
1. Temperature 0.5 makes the distribution…
   a) flatter
   b) sharper
   c) unchanged
2. Top-p = 0.9 keeps…
   a) the 90% most frequent words
   b) the smallest set of tokens with total probability ≥ 0.9
   c) tokens with p ≥ 0.9

## 3 · Architecture of TinyStories-8M
*Beginner · 20 min*

GPT-Neo is a **pre-LN decoder**: each block computes x ← x + Attn(LN₁(x)) and x ← x + MLP(LN₂(x)). The vector x that flows through is the **residual stream**.

Specifics you can verify in ARCH and PARAMS: 16 heads × 16 dims; MLP 256→1024→256 with GELU; **even layers use global attention, odd layers local attention with a 256-token window**; GPT-Neo does **not** divide attention scores by √d_head; q/k/v projections have no bias; the unembedding is the transpose of the token embedding (tied).

FLOPs per token ≈ 2·(parameters touched): about 0.79 M FLOPs per layer for the dense matmuls plus 2·T·d per layer for attention, plus 25.7 M for the 50 257×256 unembedding — the unembedding dominates, which the PROFILER confirms.

### Lab
```
tab arch
params
flops 128
profile 16
```
In ARCH press render; in PARAMS press compute to see the treemap. Profile shows lnf+unembed as the slowest op.

### Quiz
1. Which layers of TinyStories-8M use local (windowed) attention?
   a) all
   b) odd-numbered layers
   c) none
2. In a pre-LN transformer the residual stream itself is…
   a) normalised after every block
   b) not normalised; LayerNorm is applied to the input of each sub-block
   c) quantized
3. Which op dominates per-token compute here?
   a) attention scores
   b) MLP
   c) unembedding (256×50 257)

## 4 · Attention heads and their jobs
*Intermediate · 25 min*

Each head computes scores q_t·k_s for s ≤ t, softmaxes them into an **attention pattern**, and adds Σ_s a_ts·W_O W_V x_s to the residual. The **QK circuit** decides *where* to look; the **OV circuit** decides *what* to copy.

Behavioural classes measured in ATTENTION → head classification: **previous-token** (attend t→t−1), **duplicate-token** (attend to earlier copies of the same token), **induction** (on a repeated random sequence, attend to the token *after* the earlier copy), and **sink/positional** (attend to position 0). Small models often have few clean induction heads; the scores tell you how strong each behaviour is, they are not a binary truth.

**Rollout** multiplies head-averaged attention (plus ½·identity for the residual path) through the layers to approximate end-to-end token influence. It ignores MLPs and value norms, so treat it as a heuristic.

### Lab
```
heads
attn
sel 5 4
```
Switch the metric selector to "prev" and "induction". Click a tile in the all-heads grid to enlarge one head.

### Quiz
1. An induction head on "…A B … A" attends from the second A to…
   a) the first A
   b) the B that followed the first A
   c) the BOS token
2. The OV circuit of a head determines…
   a) which positions it attends to
   b) what information it writes once it attends
   c) its layer index
3. Attention rollout ignores…
   a) the residual connection
   b) MLPs and value-vector magnitudes
   c) the causal mask

## 5 · Residual stream geometry and the logit lens
*Intermediate · 20 min*

Because every component *adds* to the residual stream, you can read it at any depth. The **logit lens** applies ln_f and the unembedding to an intermediate residual; the **tuned lens** first applies a learned per-layer affine map (fit in ANALYZE).

RESIDUAL shows norms per token × slot (norms grow with depth in pre-LN models), the cosine similarity between slots (adjacent layers are similar; the embedding is far from later layers) and **PCA trajectories**: every token is a path from its embedding through each slot's output.

**Direct logit attribution** (CIRCUIT / ANALYZE) decomposes the final logit of a target token into additive contributions of heads, neurons and biases — exact up to the frozen LayerNorm scale.

### Lab
```
tab resid
tab circuit
circuit
```
In RESIDUAL press run, switch axes to PC2/PC3. In CIRCUIT, hover edges to read Q/K/V composition scores.

### Quiz
1. The logit lens reads an intermediate residual by…
   a) training a new probe
   b) applying the final LayerNorm and unembedding
   c) running the remaining layers
2. Why can DLA add up contributions?
   a) softmax is linear
   b) the residual stream is a sum and the unembedding is linear (with frozen LN scale)
   c) heads are independent

## 6 · Weights as matrices: spectra and power laws
*Intermediate · 25 min*

A weight matrix W has an SVD UΣVᵀ. Its singular values tell you gain per direction; **stable rank** ‖W‖_F²/σ₁² and **effective rank** exp(H(σ/Σσ)) summarise how many directions matter.

**WeightWatcher**-style analysis fits a power law ρ(λ) ∝ λ^(−α) to the tail of the eigenvalue spectrum of WᵀW/N (the ESD), using the Clauset–Shalizi–Newman MLE with the KS-optimal xmin. Martin & Mahoney report α≈2–4 for well-trained layers. With matrices this small (256 eigenvalues) the fit is noisy: compare α before and after an edit rather than reading absolute values.

Edits change these numbers in predictable ways: noise pushes the spectrum toward Marchenko–Pastur (α grows), SVD truncation removes the tail, quantization adds small broadband noise.

### Lab
```
spectrum 3 fc
edit chaos 30
spectrum 3 fc
undo
```
Compare α and stable rank before and after chaos. The WEIGHTS tab overlays original (teal) and current (pink).

### Quiz
1. Stable rank is defined as…
   a) number of non-zero singular values
   b) ‖W‖_F² / σ₁²
   c) trace(W)
2. Adding large Gaussian noise to a trained matrix tends to…
   a) decrease α
   b) increase α (lighter tail, more random-like)
   c) leave the spectrum unchanged

## 7 · Causal interventions: ablation and patching
*Intermediate · 25 min*

Correlation (attention patterns, activations) is not causation. To test a component, **intervene**: **zero/mean/resample ablation** of heads and neurons (RUNTIME / terminal `ablate`), **activation patching** of the residual stream or head outputs between a clean and a corrupted prompt (CAUSAL), and **path patching** of head → logit paths.

Mean ablation is gentler than zeroing because it keeps the activation on-distribution. Always measure the effect with a metric — logit difference, KL vs clean, perplexity — and compare against a baseline. The IMPACT tab shows KL per slot via the logit lens, per-position KL and the biggest probability shifts.

### Lab
```
impact
ablate head 5 4 zero
impact
undo
calib 80
```
L5H4 is the strongest previous-token head in this model; compare final KL with and without ablating it.

### Quiz
1. Why prefer mean ablation over zero ablation?
   a) it is faster
   b) it keeps activations closer to their natural distribution
   c) it removes more information
2. Activation patching copies an activation from…
   a) one run into another run at the same site
   b) the weights into the cache
   c) the tokenizer

## 8 · Steering: additions, ablation, clamping, logit space
*Advanced · 30 min*

Many concepts appear to be linear directions. **Activation addition** adds c·û at chosen layers; **norm-preserving addition** rescales afterwards so ‖x‖ is unchanged; **directional ablation** removes the projection x·û; **clamping** sets that projection to a value.

In CONTROL you choose the direction source (token embedding difference, an existing steering vector, a neuron's output weights, an SAE decoder row, or random as a control), the **site** (resid_pre/post, attn_out, mlp_out, z, q, k, v — for q/k/v the direction is mapped through W_Q/W_K/W_V, so "key steering" changes what positions advertise), an optional **head** slice, layers, a token mask and a **time schedule** (ramp, decay, pulse, window).

**Logit-space steering** acts after the network: logit biases, or adding a direction to the normalised final vector h. Always run a random-direction control with the same norm to separate a specific effect from generic damage.

### Lab
```
steer happy sad 6 resid_pre 2-5 add
gen 30 The girl felt
undo
steer happy sad 6 resid_pre 2-5 addnorm
gen 30 The girl felt
undo
bias dog:4
gen 20 She saw a
bias clear
```
Compare add vs addnorm outputs. In SWEEP choose "steering coef" to plot perplexity and KL as functions of coef.

### Quiz
1. Directional ablation with unit vector û maps x to…
   a) x + û
   b) x − (x·û)û
   c) ‖x‖·û
2. A random-direction control is useful because…
   a) it is faster
   b) it shows how much change any perturbation of that size causes
   c) it trains the SAE

## 9 · Features: neurons, superposition and SAEs
*Advanced · 30 min*

Neurons are often **polysemantic**: one neuron responds to several unrelated inputs, consistent with **superposition** (more features than dimensions). NEURONS builds an atlas: max activation, firing frequency and a polysemanticity score exp(H) over token identities of the top activations (1 = always the same token).

A **sparse autoencoder** (SAE tab) learns an overcomplete dictionary f = ReLU(W_enc(x−b_dec)+b_enc), x̂ = W_dec f + b_dec with an L1 penalty. Good SAEs have low reconstruction error, low L0 and few **dead features**. SAE DASH shows the density histogram and per-feature top contexts and logit effects. Clamping a feature (SAE tab) or steering along its decoder row (CONTROL) tests causality.

### Lab
```
neurons 3 300
tab sae
```
Train an SAE in the SAE tab (layer 3, 1024 features), then open SAE DASH → compute densities and inspect a few features.

### Quiz
1. Superposition means…
   a) two layers share weights
   b) more features are represented than there are dimensions, using nearly orthogonal directions
   c) attention heads overlap
2. A dead SAE feature is one that…
   a) never activates on the data
   b) activates on every token
   c) has negative weights

## 10 · Rigour: evaluation, calibration, sweeps and tracking
*Advanced · 30 min*

Every edit needs a quantitative story. CALIBRATION computes perplexity, top-1 accuracy and **ECE** with a reliability diagram for the clean and current model on the reference corpus (which was sampled from the clean model, so use it comparatively). IMPACT gives KL per layer and position. SWEEP varies one parameter — edit strength α (blending W + α·ΔW), steering coefficient, head temperature, neuron clamp, logit bias, attention window — and plots perplexity, KL and p(target). Every result is logged to RUNS; tick runs to compare them and export CSV/JSON.

Good practice: change one thing at a time, include a control, report effect sizes with the metric's baseline, and save a snapshot (OPS) so others can reproduce the exact state.

### Lab
```
reset
calib 80
edit quant 3
calib 80
sweep blend 0 1 5
runs
undo
```
Open RUNS and choose the metric "ppl" to compare the two calibration runs; the sweep curve appears in the lower chart.

### Quiz
1. ECE measures…
   a) average |accuracy − confidence| across confidence bins, weighted by bin size
   b) perplexity
   c) KL to the clean model
2. Edit strength α = 0 in the blend sweep corresponds to…
   a) the original weights
   b) the fully edited weights
   c) zero weights

## 11 · Gradients, attribution and curvature
*Research · 30 min*

The backward pass gives ∂m/∂(everything). **Gradient × input** is a first-order attribution; **integrated gradients** integrate the gradient along a path from a baseline and satisfy completeness (attributions sum to m(x) − m(x′)). **Attribution patching** estimates the effect of patching every head from one backward pass; always validate it against true activation patching, as GRADIENTS does (Pearson r).

The **empirical Fisher** (mean squared gradient) and the **saliency** Σ|θ·g| rank parameters by local sensitivity; the top **Hessian eigenvalue** measures sharpness. The DRILL inspector checks the analytic directional derivative against a finite difference for any selection.

### Lab
```
attrib gxi
attrib ig play dance
atp
fisher 2
drill L3.attn.q.H5
```
Compare the IG completeness error with grad×input, and the AtP scatter with the y = x line.

### Quiz
1. Integrated gradients attributions sum to…
   a) m(x) − m(baseline)
   b) zero
   c) the gradient norm
2. Attribution patching is…
   a) a first-order Taylor estimate of activation patching
   b) exact activation patching
   c) a training method

## 12 · Circuits and geometry
*Research · 30 min*

A head's **OV circuit** W_U·W_O·W_V·W_E maps tokens to logits; positive eigenvalues mean copying. **Composition scores** measure how much a later head reads (via Q, K or V) what an earlier head wrote. **Induction heads** attend to the token after an earlier copy of the current one; TinyStories-8M has strong previous-token heads but only weak induction, which is a real finding, not a bug.

Representation geometry: **CKA** compares layers, **TwoNN** estimates intrinsic dimension, **anisotropy** measures a shared direction, **logit-lens KL** shows how far each layer is from the final prediction. Loss-landscape slices and **superposition** interference complete the picture.

### Lab
```
eigen
comp
induct
geom 2
land 2d 3 q svd
mode surface
```
Open 3D MODES → circuit graph to see the strongest compositions; the loss surface opens automatically after the 2-D slice.

### Quiz
1. A positive OV copying score means the head…
   a) tends to increase the logit of the token it attends to
   b) ignores the token
   c) attends to the previous position
2. CKA = 1 between two layers means…
   a) identical representation geometry up to rotation and scale
   b) identical weights
   c) zero loss

## 13 · Statistics for interpretability
*Research · 25 min*

A single ablation number is an anecdote. **STATS** turns it into a test: for each head, per-document losses with and without the head form paired samples; a **sign-flip permutation test** asks how often random sign flips of the differences give a mean as large as observed. Report the **effect size** (Cohen's d_z) and a **bootstrap CI**, not just p.

Testing 16 heads means 16 chances of a false positive. **Holm** controls the chance of *any* false positive; **Benjamini–Hochberg** controls the expected *fraction* of false discoveries. With 12 documents the smallest possible paired p is 2/4096 — tiny samples cap how significant anything can be.

### Lab
```
stats 0 12 2000
stats 7 12 2000
```
Compare layer 0 and layer 7: how many heads survive Holm vs BH? Do confidence intervals that exclude 0 match the corrected p-values?

### Quiz
1. A paired sign-flip permutation test assumes, under the null…
   a) each per-document difference is equally likely to be positive or negative
   b) the data are normal
   c) the two models have equal weights
2. Benjamini–Hochberg controls…
   a) the expected false discovery rate
   b) the probability of any false positive
   c) the effect size
3. Why report Cohen’s d next to p?
   a) p depends on sample size; d measures magnitude
   b) d replaces the test
   c) p is always wrong

## 14 · Circuits, probes and reproducible evals
*Research · 35 min*

**ACDC** automates circuit finding: replace components by their activations on a corrupt prompt, keep only those whose replacement moves the metric by more than τ of the clean–corrupt gap. Check the result with **faithfulness** and test your own hypotheses with **causal scrubbing**. Raising τ gives smaller, less faithful circuits.

A **linear probe** asks whether a property is linearly decodable; the **control task** asks whether the probe could have memorised it anyway. Report **selectivity**. Decodable does not mean used — follow up with interventions.

Finally make it reproducible: the **weights hash** and **manifest** pin exactly what was run, **EVAL** checks the edit did not silently break the model, and **REPORT** packages methods, numbers and figures.

### Lab
```
acdc 0.02
acdc 0.1
scrub L6H9 L7H3 L7MLP
probe all
evalh 8
hash
manifest
```
Compare circuit size and faithfulness at τ = 0.02 and 0.1. Which layers make noun vs verb most decodable, and is selectivity high there?

### Quiz
1. Faithfulness of 100% means the circuit…
   a) recovers the full clean–corrupt metric gap
   b) contains every node
   c) has zero loss
2. High probe accuracy but low selectivity suggests…
   a) the probe memorises word identities
   b) the feature is causally used
   c) the model is broken
3. Two runs have identical weights if…
   a) their SHA-256 weight hashes match
   b) their perplexities match
   c) they used the same prompt

## Answer key

- **1 · What a language model computes**: 1b — The forward pass ends in 50 257 logits; softmax turns them into a distribution which a decoding rule turns into a token.; 2c — 50 257 × 256 ≈ 12.9 M of ≈19.7 M parameters are in wte (shared with the unembedding).; 3a — −ln 0.5 = ln 2 ≈ 0.693.
- **2 · Decoding: temperature, top-k, top-p**: 1b — Dividing logits by 0.5 doubles their differences.; 2b — Nucleus sampling truncates by cumulative mass.
- **3 · Architecture of TinyStories-8M**: 1b — GPT-Neo alternates global (even) and local (odd, window 256).; 2b — That is why residual norms grow with depth (RESIDUAL tab).; 3c — 2·256·50 257 ≈ 25.7 M FLOPs vs ≈6.3 M for all 8 layers' dense matmuls.
- **4 · Attention heads and their jobs**: 1b — It looks one past the previous occurrence and copies that token.; 2b — QK = where, OV = what.; 3b — Rollout only multiplies attention weights (with ½I for the residual).
- **5 · Residual stream geometry and the logit lens**: 1b — It reuses the model's own readout.; 2b — Linearity after freezing the LN scale.
- **6 · Weights as matrices: spectra and power laws**: 1b — Sum of squared singular values over the largest squared.; 2b — Random matrices follow Marchenko–Pastur with no heavy tail.
- **7 · Causal interventions: ablation and patching**: 1b — Zero can be far outside the range the next layers expect.; 2a — It swaps one internal value between runs and measures the effect.
- **8 · Steering: additions, ablation, clamping, logit space**: 1b — Removes the component along û.; 2b — Specific effects must exceed generic damage.
- **9 · Features: neurons, superposition and SAEs**: 1b — It explains polysemantic neurons.; 2a — Dead features waste dictionary capacity.
- **10 · Rigour: evaluation, calibration, sweeps and tracking**: 1a — Expected calibration error.; 2a — W + 0·(M − W) = W.
- **11 · Gradients, attribution and curvature**: 1a — Completeness axiom.; 2a — (a_corrupt − a_clean)·∂m/∂a.
- **12 · Circuits and geometry**: 1a — Positive eigenvalues of the token→logit map.; 2a — CKA is invariant to orthogonal transforms and isotropic scaling.
- **13 · Statistics for interpretability**: 1a — Symmetry of the paired differences around zero.; 2a — Holm controls the family-wise error rate; BH the FDR.; 3a — Large samples make tiny effects significant.
- **14 · Circuits, probes and reproducible evals**: 1a — (m_circuit − m_corrupt)/(m_clean − m_corrupt).; 2a — The control task scores just as well.; 3a — The hash covers every bit of every tensor.

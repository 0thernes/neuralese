# Glossary (193 terms)

### Ablation
Removing a component's contribution (setting it to zero, its mean, or a resampled value) to measure how much the output depends on it.

*See:* [Zero ablation](#zero-ablation), [Mean ablation](#mean-ablation), [Resample ablation](#resample-ablation)

### Activation
Any intermediate value computed during a forward pass, e.g. a residual vector, attention pattern or MLP neuron output.

*See:* [Residual stream](#residual-stream), [Neuron](#neuron)

### Activation addition
Steering by adding a fixed vector to an activation at chosen layers and positions (ActAdd, Turner et al. 2023).

*See:* [Steering vector](#steering-vector), [Norm-preserving addition](#norm-preserving-addition)

### Activation patching
Running a corrupted input but replacing one activation with its value from a clean run (or vice versa) to locate where information that changes the output lives.

*See:* [Causal tracing](#causal-tracing), [Path patching](#path-patching)

### Alpha (power-law exponent)
Exponent α of a power-law fit p(λ) ∝ λ^(−α) to the tail of a weight matrix's eigenvalue spectrum; used by WeightWatcher as a training-quality heuristic.

*See:* [ESD](#esd), [Heavy-tailed self-regularization](#heavy-tailed-self-regularization), [WeightWatcher](#weightwatcher)

### Attention head
One of H parallel attention mechanisms in a layer, each with its own Q, K, V projections of dimension d_head and a slice of the output matrix O.

*See:* [Query](#query), [Key](#key), [Value](#value), [OV circuit](#ov-circuit), [QK circuit](#qk-circuit)

### Attention pattern
The T×T lower-triangular matrix of softmax weights a head assigns from each query position to earlier key positions.

*See:* [Softmax](#softmax), [Causal mask](#causal-mask)

### Attention rollout
Approximate information flow obtained by multiplying per-layer head-averaged attention matrices (with ½ identity added for the residual) through the stack (Abnar & Zuidema 2020).

*See:* [Attention flow](#attention-flow), [Attention pattern](#attention-pattern)

### Attention flow
Graph view of how much each input token can influence a position through attention; in this app shown as last-row rollout.

*See:* [Attention rollout](#attention-rollout)

### Attention sink
A head (or behaviour) that puts most attention weight on the first token, often used as a no-op.

*See:* [BOS token](#bos-token), [Positional head](#positional-head)

### Autoregressive
Generating one token at a time, each conditioned on all previous tokens.

*See:* [Causal mask](#causal-mask), [KV cache](#kv-cache)

### Beam search
Decoding that keeps the B highest-scoring partial sequences at each step instead of sampling.

*See:* [Greedy decoding](#greedy-decoding), [Length penalty](#length-penalty)

### BOS token
Beginning-of-sequence token. GPT-2-family tokenizers use <|endoftext|> (id 50256) for both BOS and EOS.

*See:* [Attention sink](#attention-sink), [Tokenizer](#tokenizer)

### BPE
Byte-pair encoding: a tokenizer that greedily merges frequent byte pairs; GPT-2/GPT-Neo use a 50257-token byte-level BPE.

*See:* [Tokenizer](#tokenizer), [Token](#token)

### Calibration
Agreement between predicted confidence and observed accuracy. A calibrated model is right 70% of the time when 70% confident.

*See:* [ECE](#ece), [Reliability diagram](#reliability-diagram)

### Causal mask
Mask that prevents a position from attending to later positions, making the model autoregressive.

*See:* [Attention pattern](#attention-pattern), [Local attention](#local-attention)

### Causal tracing
Activation patching applied systematically across layers and positions to map where a fact is processed (Meng et al. 2022).

*See:* [Activation patching](#activation-patching), [ROME](#rome)

### Circuit
A subgraph of components (heads, neurons, paths) that together implement a specific behaviour.

*See:* [Composition](#composition), [Path patching](#path-patching), [Induction head](#induction-head)

### Clamping
Forcing an activation (a neuron, SAE feature, or projection onto a direction) to a fixed value.

*See:* [Directional ablation](#directional-ablation), [SAE](#sae)

### Classifier-free guidance (CFG)
Decoding that extrapolates from a negative/unconditional prompt's logits toward the conditional ones: l = l_neg + g·(l_pos − l_neg).

*See:* [Contrastive decoding](#contrastive-decoding), [Logit](#logit)

### Composition
When a later head reads information written by an earlier head. Q-, K- and V-composition depend on which input of the later head is affected (Elhage et al. 2021).

*See:* [Composition score](#composition-score), [Induction head](#induction-head)

### Composition score
‖W_B·W_A‖_F / (‖W_B‖_F·‖W_A‖_F) for the relevant pair of matrices (e.g. W_Q of head B and W_OV of head A); measures how much of B's input subspace A writes to.

*See:* [Composition](#composition), [OV circuit](#ov-circuit), [QK circuit](#qk-circuit)

### Contrastive decoding
Scoring tokens by the difference between an expert model's and an amateur model's log-probabilities, restricted to plausible tokens.

*See:* [Classifier-free guidance (CFG)](#classifier-free-guidance-cfg), [Logit](#logit)

### Corpus
Reference text used for statistics. Here: 40 stories (2558 tokens) sampled from the clean model.

*See:* [Perplexity](#perplexity), [Mean ablation](#mean-ablation)

### Cosine similarity
u·v / (‖u‖‖v‖); 1 = same direction, 0 = orthogonal, −1 = opposite.

*See:* [Residual stream](#residual-stream), [Embedding](#embedding)

### d_model
Width of the residual stream (256 for TinyStories-8M).

*See:* [Residual stream](#residual-stream), [d_head](#dhead)

### d_head
Dimension of each attention head's query/key/value vectors (16 here; 16 heads × 16 = 256).

*See:* [Attention head](#attention-head), [d_model](#dmodel)

### d_ff
Hidden width of the MLP block (1024 here = 4·d_model).

*See:* [MLP](#mlp), [Neuron](#neuron)

### Dead feature
An SAE feature that never activates on the evaluation data.

*See:* [SAE](#sae), [Feature density](#feature-density)

### Decoder (SAE)
The matrix W_dec whose rows are feature directions in activation space; reconstruction = Σ f_i·W_dec[i] + b_dec.

*See:* [SAE](#sae), [Feature](#feature)

### Direct logit attribution (DLA)
Decomposing a final logit into additive contributions from each head, neuron and bias by projecting their outputs onto the target's unembedding direction (through the frozen final LayerNorm scale).

*See:* [Logit lens](#logit-lens), [Unembedding](#unembedding)

### Directional ablation
Removing the component of an activation along a direction û: x ← x − (x·û)û. Used e.g. to remove refusal directions (Arditi et al. 2024).

*See:* [Steering vector](#steering-vector), [Clamping](#clamping)

### Duplicate-token head
A head that attends from a token to earlier occurrences of the same token.

*See:* [Induction head](#induction-head), [Head classification](#head-classification)

### ECE
Expected calibration error: Σ_bins (n_b/N)·|acc_b − conf_b|.

*See:* [Calibration](#calibration), [Reliability diagram](#reliability-diagram)

### Effective rank
exp of the Shannon entropy of the normalised singular values; a smooth count of how many directions a matrix uses.

*See:* [Stable rank](#stable-rank), [SVD](#svd)

### Embedding
The learned vector for each token (rows of W_E/wte, 256-dim here).

*See:* [Unembedding](#unembedding), [Tied embeddings](#tied-embeddings), [Positional embedding](#positional-embedding)

### Entropy
H(p) = −Σ p log p of the next-token distribution, in nats. Low = confident, high = uncertain.

*See:* [Surprisal](#surprisal), [Perplexity](#perplexity)

### ESD
Empirical spectral density: the histogram of eigenvalues of WᵀW/N for a weight matrix W.

*See:* [Alpha (power-law exponent)](#alpha-power-law-exponent), [SVD](#svd)

### Feature
A direction in activation space that corresponds to an interpretable property of the input; SAEs try to recover them.

*See:* [SAE](#sae), [Superposition](#superposition), [Polysemanticity](#polysemanticity)

### Feature density
Fraction of tokens on which an SAE feature is non-zero.

*See:* [Dead feature](#dead-feature), [SAE](#sae)

### FLOP
Floating-point operation. A multiply-add counts as 2 FLOPs; a d×d matrix-vector product costs 2d².

*See:* [Profiler](#profiler)

### Frobenius norm
‖A‖_F = sqrt(Σ a_ij²) = sqrt(Σ σ_i²).

*See:* [SVD](#svd), [Stable rank](#stable-rank)

### GELU
Gaussian error linear unit, x·Φ(x); GPT-Neo uses the tanh approximation.

*See:* [MLP](#mlp), [Neuron](#neuron)

### GPT-Neo
EleutherAI's GPT-style decoder architecture; alternates global and local (windowed) attention and does not scale attention scores by 1/√d_head.

*See:* [Local attention](#local-attention), [TinyStories](#tinystories)

### Greedy decoding
Always choosing the highest-probability next token.

*See:* [Sampling](#sampling), [Beam search](#beam-search)

### Head classification
Labelling heads by behavioural scores (previous-token, induction, duplicate, sink) measured on probe inputs.

*See:* [Induction head](#induction-head), [Previous-token head](#previous-token-head)

### Head temperature
This app's per-head divisor τ on attention scores before softmax: τ<1 sharpens, τ>1 flattens.

*See:* [Softmax](#softmax), [Attention pattern](#attention-pattern)

### Heavy-tailed self-regularization
Martin & Mahoney's theory that well-trained layers develop power-law ESD tails with smaller α.

*See:* [Alpha (power-law exponent)](#alpha-power-law-exponent), [ESD](#esd)

### Hook
A callback at a named site of the forward pass that can read or overwrite the activation.

*See:* [Hook site](#hook-site), [Activation patching](#activation-patching)

### Hook site
Named activation location. Here: resid_pre, q, k, v, z, attn_out, mlp_act, mlp_out, resid_post.

*See:* [Hook](#hook), [Residual stream](#residual-stream)

### Induction head
A head that, at the second occurrence of token A, attends to the token that followed the first A and copies it (A B … A → B). Requires K-composition with a previous-token head.

*See:* [Previous-token head](#previous-token-head), [Composition](#composition), [In-context learning](#in-context-learning)

### In-context learning
Using information in the prompt to improve predictions without weight updates.

*See:* [Induction head](#induction-head)

### Interpolation (layer)
Weight edit that replaces a layer's parameters with a blend of itself and another layer.

*See:* [Weight edit](#weight-edit)

### KL divergence
KL(P‖Q) = Σ P log(P/Q): extra nats needed to code samples from P with a code for Q. Used here as hacked-vs-clean distance.

*See:* [Total variation](#total-variation), [Logit](#logit)

### Key
Vector k = W_K·x that a position offers to be matched by queries.

*See:* [Query](#query), [QK circuit](#qk-circuit)

### Kurtosis
Fourth standardised moment minus 3; positive = heavier tails than Gaussian. Outlier-heavy weights have high kurtosis.

*See:* [Alpha (power-law exponent)](#alpha-power-law-exponent)

### KV cache
Stored keys and values of previous positions so each new token costs O(T) attention instead of recomputing the prefix.

*See:* [Autoregressive](#autoregressive)

### LayerNorm
Normalisation x ← γ⊙(x−μ)/σ + β applied before attention, before the MLP and at the end (ln_f).

*See:* [Pre-LN](#pre-ln), [Logit lens](#logit-lens)

### Length penalty
Beam-search score normalisation by sequence length^α to avoid favouring short outputs.

*See:* [Beam search](#beam-search)

### Linear representation hypothesis
The hypothesis that many concepts are represented as directions in activation space.

*See:* [Feature](#feature), [Steering vector](#steering-vector)

### Local attention
Attention restricted to the previous w tokens (w=256 on odd layers of GPT-Neo).

*See:* [GPT-Neo](#gpt-neo), [Causal mask](#causal-mask)

### Logit
Unnormalised score for a token; softmax of logits gives probabilities.

*See:* [Softmax](#softmax), [Unembedding](#unembedding)

### Logit bias
Adding a constant to chosen token logits before softmax.

*See:* [Logit-space steering](#logit-space-steering)

### Logit lens
Applying the final LayerNorm and unembedding to an intermediate residual vector to read what the model "would predict" at that layer.

*See:* [Tuned lens](#tuned-lens), [Unembedding](#unembedding)

### Logit-space steering
Interventions applied at or after the unembedding: logit biases or adding a direction to the final normalised vector h.

*See:* [Logit bias](#logit-bias), [Unembedding](#unembedding)

### Low-rank update
A weight edit ΔW = u·vᵀ (or rank-r sum); ROME uses a rank-one update to an MLP output matrix.

*See:* [ROME](#rome), [SVD](#svd)

### Mean ablation
Replacing an activation with its mean over a reference corpus; less off-distribution than zeroing.

*See:* [Ablation](#ablation), [Corpus](#corpus)

### MLP
The feed-forward block: x → W_out·GELU(W_in·LN(x)+b_in)+b_out.

*See:* [Neuron](#neuron), [d_ff](#dff), [GELU](#gelu)

### Monosemantic
A unit (neuron or feature) that responds to a single interpretable property.

*See:* [Polysemanticity](#polysemanticity), [SAE](#sae)

### Nats
Units of information using natural log; 1 nat ≈ 1.443 bits.

*See:* [Entropy](#entropy), [KL divergence](#kl-divergence)

### Nearest neighbours (embedding)
Tokens whose embedding vectors have the highest cosine similarity to a query token's embedding.

*See:* [Embedding](#embedding), [Cosine similarity](#cosine-similarity)

### Neuron
One of the d_ff hidden units of an MLP; its input weights are a row of W_in and its output weights a column of W_out.

*See:* [MLP](#mlp), [Polysemanticity](#polysemanticity)

### Norm-preserving addition
Steering that adds a vector then rescales the activation back to its original norm, limiting off-distribution drift.

*See:* [Activation addition](#activation-addition)

### OV circuit
W_O·W_V for one head: what information the head moves from the attended position into the residual stream.

*See:* [QK circuit](#qk-circuit), [Composition](#composition)

### Path patching
Patching only the effect that flows along a specific path (e.g. head → logits) rather than a whole activation.

*See:* [Activation patching](#activation-patching), [Circuit](#circuit)

### PCA
Principal component analysis: orthogonal directions of maximal variance; used to project residual trajectories and embeddings to 2-D/3-D.

*See:* [Explained variance](#explained-variance)

### Explained variance
Fraction of total variance captured by each principal component.

*See:* [PCA](#pca)

### Perplexity
exp(mean negative log-likelihood) on held text. Lower is better; it is the effective branching factor.

*See:* [Surprisal](#surprisal), [Entropy](#entropy)

### Polysemanticity
A neuron responding to several unrelated features. Here measured as exp(entropy of token identities among its top activations).

*See:* [Superposition](#superposition), [Monosemantic](#monosemantic)

### Positional embedding
Learned vector added per position (wpe, 2048×256 in GPT-Neo).

*See:* [Embedding](#embedding)

### Positional head
A head whose attention depends mainly on position (e.g. always the first token).

*See:* [Attention sink](#attention-sink)

### Pre-LN
Architecture where LayerNorm is applied at the input of each sub-block, leaving the residual stream un-normalised.

*See:* [LayerNorm](#layernorm), [Residual stream](#residual-stream)

### Previous-token head
A head that attends mostly from position t to t−1.

*See:* [Induction head](#induction-head), [Head classification](#head-classification)

### Probability margin
p(top-1) − p(top-2): small margins mark decision points.

*See:* [Entropy](#entropy)

### Profiler
Tool that measures wall time per operation of the forward pass.

*See:* [FLOP](#flop)

### QK circuit
W_Qᵀ·W_K for one head: which query/key pairs produce high attention scores.

*See:* [OV circuit](#ov-circuit), [Composition](#composition)

### Quantization
Representing weights with fewer bits (e.g. int4 with a per-row scale); introduces rounding error.

*See:* [Weight edit](#weight-edit)

### Query
Vector q = W_Q·x a position uses to score keys.

*See:* [Key](#key), [QK circuit](#qk-circuit)

### Reliability diagram
Plot of accuracy versus confidence per bin; the diagonal is perfect calibration.

*See:* [Calibration](#calibration), [ECE](#ece)

### Resample ablation
Replacing an activation with its value on a different random input.

*See:* [Ablation](#ablation)

### Residual stream
The running sum of embeddings plus every attention and MLP output; all components read from it and write to it.

*See:* [Pre-LN](#pre-ln), [Logit lens](#logit-lens)

### ROME
Rank-One Model Editing (Meng et al. 2022): a closed-form rank-one update to an MLP output matrix that rewrites one factual association.

*See:* [Low-rank update](#low-rank-update), [Causal tracing](#causal-tracing)

### SAE
Sparse autoencoder trained to reconstruct activations as a sparse non-negative combination of learned feature directions.

*See:* [Feature](#feature), [Dead feature](#dead-feature), [Decoder (SAE)](#decoder-sae)

### Sampling
Drawing the next token from the (possibly filtered) probability distribution.

*See:* [Temperature](#temperature), [Top-k](#top-k), [Top-p](#top-p)

### Singular value
σ_i in W = UΣVᵀ; gains along orthogonal input/output direction pairs.

*See:* [SVD](#svd)

### Softmax
p_i = exp(z_i)/Σ exp(z_j).

*See:* [Logit](#logit), [Temperature](#temperature)

### Spectral norm
Largest singular value σ₁: maximum gain of a matrix.

*See:* [SVD](#svd), [Stable rank](#stable-rank)

### Stable rank
‖W‖_F² / σ₁²; a robust lower bound on rank.

*See:* [Effective rank](#effective-rank), [Spectral norm](#spectral-norm)

### Steering vector
A direction added to activations to change behaviour, e.g. the mean difference between activations on contrasting prompts.

*See:* [Activation addition](#activation-addition), [Linear representation hypothesis](#linear-representation-hypothesis)

### Superposition
Representing more features than dimensions by using nearly orthogonal directions, which causes polysemantic neurons.

*See:* [Polysemanticity](#polysemanticity), [SAE](#sae)

### Surprisal
−ln p(token): information content of the observed token in nats.

*See:* [Perplexity](#perplexity), [Entropy](#entropy)

### SVD
Singular value decomposition W = UΣVᵀ.

*See:* [Singular value](#singular-value), [Low-rank update](#low-rank-update)

### Temperature
Divisor of logits before softmax during sampling: <1 sharper, >1 flatter.

*See:* [Sampling](#sampling), [Head temperature](#head-temperature)

### Tied embeddings
Using the same matrix for token embedding and unembedding (logits = h·W_Eᵀ). True for TinyStories-8M.

*See:* [Embedding](#embedding), [Unembedding](#unembedding)

### Time schedule
This app's multiplier s(t) for steering strength over generated-token index: const, ramp, decay, pulse, window.

*See:* [Steering vector](#steering-vector)

### TinyStories
Synthetic dataset of simple children's stories (Eldan & Li 2023) and the small models trained on it; this lab uses TinyStories-8M.

*See:* [GPT-Neo](#gpt-neo)

### Token
Unit of text the model reads and writes (a BPE piece, often with a leading space).

*See:* [BPE](#bpe), [Tokenizer](#tokenizer)

### Tokenizer
Maps text to token ids and back.

*See:* [BPE](#bpe), [Token](#token)

### Top-k
Sampling filter keeping only the k most probable tokens.

*See:* [Top-p](#top-p), [Sampling](#sampling)

### Top-p
Nucleus sampling: keep the smallest set of tokens whose probability sum ≥ p.

*See:* [Top-k](#top-k), [Min-p](#min-p)

### Min-p
Filter keeping tokens with p ≥ min_p·p_max.

*See:* [Top-p](#top-p)

### Typical sampling
Keep tokens whose surprisal is closest to the distribution's entropy until mass τ is reached.

*See:* [Entropy](#entropy), [Sampling](#sampling)

### Repetition penalty
Down-weighting logits of tokens already generated (divide positive / multiply negative logits).

*See:* [Sampling](#sampling)

### Total variation
TV(P,Q) = ½ Σ |P−Q|, the largest probability difference on any event.

*See:* [KL divergence](#kl-divergence)

### Tuned lens
Logit lens with a learned affine translator per layer, fit to match final predictions (Belrose et al. 2023).

*See:* [Logit lens](#logit-lens)

### Unembedding
Final projection from residual space to vocabulary logits (here W_Eᵀ after ln_f).

*See:* [Logit](#logit), [Tied embeddings](#tied-embeddings)

### Value
Vector v = W_V·x that is copied (weighted by attention) from the attended position.

*See:* [OV circuit](#ov-circuit)

### Weight edit
Any permanent modification of parameters (noise, scaling, SVD truncation, quantization, ROME, interpolation). Recorded in the edit log and undoable.

*See:* [Runtime intervention](#runtime-intervention)

### Runtime intervention
A change applied during the forward pass without touching weights (ablation, steering, masks, temperatures).

*See:* [Weight edit](#weight-edit), [Hook](#hook)

### WeightWatcher
Tool/methodology that fits power laws to layer ESDs to diagnose training quality without data (Martin & Mahoney).

*See:* [Alpha (power-law exponent)](#alpha-power-law-exponent), [ESD](#esd)

### Z (head output)
Concatenated per-head attention outputs before the O projection (site z, shape H×d_head).

*See:* [Hook site](#hook-site), [OV circuit](#ov-circuit)

### Zero ablation
Setting an activation to zero; simple but can push the model off-distribution.

*See:* [Ablation](#ablation), [Mean ablation](#mean-ablation)

### Window (attention)
Maximum lookback of local attention; this app can override it per layer.

*See:* [Local attention](#local-attention)

### Snapshot
JSON export of all weight edits and runtime state so an experiment can be reproduced.

*See:* [Weight edit](#weight-edit), [Runtime intervention](#runtime-intervention)

### Safetensors
Simple tensor file format (JSON header + raw data); the app streams the fp32 tensors with HTTP Range requests and can export edited weights.

### Kolmogorov–Smirnov distance
Maximum gap between empirical and fitted CDFs; used to choose xmin and judge the power-law fit.

*See:* [Alpha (power-law exponent)](#alpha-power-law-exponent)

### Linked selection
Selecting a layer/head/neuron in any chart updates the 3D view, inspector and other panels.

### Experiment tracker
The RUNS tab: every evaluation, sweep and profile is logged with metrics for comparison.

*See:* [Sweep](#sweep)

### Sweep
Varying one parameter over a range and measuring metrics at each value.

*See:* [Experiment tracker](#experiment-tracker)

### Integrated gradients
Attribution that averages gradients along a straight path from a baseline input to the real input and multiplies by (input − baseline). Satisfies completeness: attributions sum to m(x) − m(baseline).

*See:* [Gradient × input](#gradient--input), [Attribution patching](#attribution-patching)

### Gradient × input
First-order attribution: the gradient of the metric with respect to an input embedding, dotted with that embedding.

*See:* [Integrated gradients](#integrated-gradients)

### Attribution patching
AtP: a linear (first-order Taylor) estimate of activation patching, (a_corrupt − a_clean)·∂m/∂a, computed for every head from one forward and one backward pass.

*See:* [Activation patching](#activation-patching), [Integrated gradients](#integrated-gradients)

### Fisher information
Here the empirical diagonal Fisher: the mean over documents of the squared loss gradient for each parameter. A local measure of how sensitive the loss is to that parameter.

*See:* [Saliency](#saliency), [Hessian-vector product](#hessian-vector-product)

### Saliency
Σ|θ·∂L/∂θ| over a parameter set: a first-order estimate of the loss change if the set were zeroed.

*See:* [Fisher information](#fisher-information), [Ablation](#ablation)

### Hessian-vector product
H·v, computed here by central differences of exact gradients; power iteration on HVPs gives the top Hessian eigenvalue (local sharpness).

*See:* [Fisher information](#fisher-information)

### Condition number
σ_max / σ_min of a matrix; large values mean some input directions are nearly annihilated.

*See:* [Effective rank](#effective-rank)

### Heavy-tail exponent α
Hill estimator of the power-law tail of the eigenvalue spectrum of WᵀW (top 50% of σ²). Lower α suggests more strongly trained correlations (Martin & Mahoney).

*See:* [Stable rank](#stable-rank)

### OV copying score
Σ Re(λ)/Σ|λ| over the eigenvalues λ of W_U·W_O·W_V·W_E: positive means the head tends to copy the attended token to the output.

*See:* [QK circuit](#qk-circuit), [Composition score](#composition-score)

### CKA
Centered kernel alignment (linear): a similarity of two representation matrices invariant to rotation and isotropic scaling; 1 = identical geometry.

*See:* [Intrinsic dimension](#intrinsic-dimension)

### Intrinsic dimension
The TwoNN estimate of the dimension of the manifold the residual vectors lie on, from ratios of first and second nearest-neighbour distances.

*See:* [CKA](#cka), [Anisotropy](#anisotropy)

### Anisotropy
Mean cosine similarity between random pairs of representation vectors; near 0 is isotropic, near 1 means all vectors share a dominant direction.

*See:* [Intrinsic dimension](#intrinsic-dimension)

### Logit-lens KL
KL(final distribution ‖ distribution obtained by decoding an intermediate residual with the final LN + unembedding).

*See:* [Logit lens](#logit-lens)

### Loss landscape slice
CE evaluated at θ + α·d₁ (+ β·d₂) for filter-normalised random or singular-vector directions d.

*See:* [Hessian-vector product](#hessian-vector-product)

### Bootstrap CI
Confidence interval from resampling the data with replacement and taking percentiles of the recomputed statistic.

*See:* [Experiment tracker](#experiment-tracker)

### WebGPU
The browser GPU compute API. Neuralese can run the 50257×256 unembedding as a WGSL matvec; it is verified against the CPU path to ~1e-7 relative error.

### Permutation test
Nonparametric significance test: recompute the statistic under random relabelings (or sign flips for paired data) allowed by the null hypothesis; the p-value is the fraction at least as extreme, (count+1)/(B+1).

*See:* [Hypothesis test](#hypothesis-test), [p-value](#p-value)

### Hypothesis test
A procedure that decides whether data are surprising under a null hypothesis (e.g. 'ablating this head does not change loss'). STATS runs one per head.

*See:* [Permutation test](#permutation-test), [p-value](#p-value)

### p-value
Probability, under the null hypothesis, of a statistic at least as extreme as observed. Not the probability that the null is true.

*See:* [Hypothesis test](#hypothesis-test), [Multiple comparisons](#multiple-comparisons)

### Effect size
Magnitude of an effect independent of sample size. NEURALESE reports Cohen's d (pooled SD) and d_z (mean paired difference / SD of differences).

*See:* [Cohen's d](#cohens-d)

### Cohen's d
Standardised mean difference: (mean A − mean B) / pooled SD; d_z is the paired version. Rough guide: 0.2 small, 0.5 medium, 0.8 large.

*See:* [Effect size](#effect-size)

### Multiple comparisons
Testing many hypotheses at once inflates false positives; correct with Holm (family-wise error) or Benjamini–Hochberg (false discovery rate).

*See:* [Holm correction](#holm-correction), [Benjamini–Hochberg](#benjaminihochberg)

### Holm correction
Step-down Bonferroni: sort p-values, multiply the k-th smallest by (m−k+1), enforce monotonicity. Controls the family-wise error rate.

*See:* [Multiple comparisons](#multiple-comparisons)

### Benjamini–Hochberg
FDR control: q_(k) = min over j≥k of p_(j)·m/j. Less conservative than Holm; controls the expected proportion of false discoveries.

*See:* [Multiple comparisons](#multiple-comparisons)

### ACDC
Automatic Circuit DisCovery (Conmy et al. 2023): greedily remove components whose replacement by corrupted activations changes the metric less than a threshold τ. NEURALESE implements a node-level (heads + MLPs) variant.

*See:* [Faithfulness](#faithfulness), [Interchange intervention](#interchange-intervention)

### Faithfulness
How much of the clean-vs-corrupt metric gap a circuit recovers: (m_circuit − m_corrupt)/(m_clean − m_corrupt). 100% = fully explains; values above 100% mean the pruned parts were working against the behaviour.

*See:* [ACDC](#acdc), [Causal scrubbing](#causal-scrubbing)

### Interchange intervention
Running the model on one input while replacing some activations with their values from another input; the basic move of activation patching, ACDC and causal scrubbing.

*See:* [ACDC](#acdc), [Causal scrubbing](#causal-scrubbing)

### Causal scrubbing
Testing a hypothesis by resampling every activation the hypothesis says is irrelevant and checking that behaviour is preserved. NEURALESE's 'scrubbing-lite' resamples non-hypothesis nodes from one corrupt prompt.

*See:* [Faithfulness](#faithfulness), [Interchange intervention](#interchange-intervention)

### Linear probe
A linear classifier trained on frozen activations to test whether a property is linearly decodable there. Decodable ≠ used by the model.

*See:* [Control task](#control-task), [Selectivity](#selectivity)

### Control task
Hewitt & Liang (2019): the same probe trained on random per-word-type labels. Measures how much a probe can memorise rather than read off a feature.

*See:* [Linear probe](#linear-probe), [Selectivity](#selectivity)

### Selectivity
Probe accuracy on the real task minus accuracy on the control task; high selectivity means the representation, not the probe's capacity, carries the information.

*See:* [Control task](#control-task)

### Distinct-n
Fraction of n-grams in generated text that are unique; low values signal repetitive degenerate output.

*See:* [Perplexity](#perplexity)

### Weights hash
SHA-256 over every fp32 tensor in a fixed order. Equal hashes mean bit-identical weights; NEURALESE shows it in the top bar and in manifests.

*See:* [Experiment manifest](#experiment-manifest)

### Experiment manifest
JSON record of app version, model id and hash, edits, runtime interventions, prompt, decoding, seed and environment, sufficient to replay and verify an experiment.

*See:* [Weights hash](#weights-hash)

### Content Security Policy
Browser policy restricting where a page may load scripts, styles and data from. NEURALESE allows scripts only from itself (plus its hashed import map) and network access only to Hugging Face.

### Taylor-mode AD
Automatic differentiation that propagates a truncated power series (a jet) through every operation using recurrences, giving all derivatives up to order K along one direction in a single pass. NEURALESE ports Eshkol's recurrences.

*See:* [Jet](#jet), [Eshkol](#eshkol)

### Jet
A truncated Taylor series c₀ + c₁ε + … + c_Kε^K of a quantity along a direction, with c_k = f^(k)(0)/k!.

*See:* [Taylor-mode AD](#taylor-mode-ad)

### Eshkol
Tsotchke's compiled, differentiable Scheme-family language (C++/LLVM, MIT). NEURALESE uses a JS port of its Taylor recurrences, not the compiler.

*See:* [Taylor-mode AD](#taylor-mode-ad), [Tsotchke](#tsotchke)

### Moonlab
Tsotchke's quantum circuit simulator (C → WebAssembly, MIT). NEURALESE uses its state fidelity, CHSH test and QWZ Chern numbers.

*See:* [Fidelity](#fidelity), [CHSH inequality](#chsh-inequality)

### Quantum geometric tensor
Q_μν = ⟨∂μψ|∂νψ⟩ − ⟨∂μψ|ψ⟩⟨ψ|∂νψ⟩. Its real part is the Fubini–Study metric and its imaginary part gives Berry curvature. For a real state ψ = √p, the real part is ¼ of the Fisher information. Reference library: Tsotchke's QGTL.

*See:* [Fubini–Study distance](#fubinistudy-distance), [Fisher information](#fisher-information)

### Fubini–Study distance
The angle arccos |⟨ψ|φ⟩| between two normalised states. For ψ = √p, φ = √q it equals arccos of the Bhattacharyya coefficient: a true metric in [0, π/2].

*See:* [Fidelity](#fidelity), [Quantum geometric tensor](#quantum-geometric-tensor)

### Fidelity
|⟨ψ|φ⟩|² for pure states; for √p-embedded distributions it is the squared Bhattacharyya coefficient.

*See:* [Fubini–Study distance](#fubinistudy-distance)

### CHSH inequality
A Bell inequality: local hidden-variable models obey |S| ≤ 2, and quantum mechanics reaches 2√2 (Tsirelson's bound). A simulator reaching 2√2 shows correct simulation, not physical non-locality.

*See:* [Moonlab](#moonlab)

### Chern number
An integer topological invariant: the Berry curvature integrated over the Brillouin zone. NEURALESE checks Moonlab's Qi–Wu–Zhang values against an independent Fukui–Hatsugai–Suzuki lattice computation.

*See:* [Quantum geometric tensor](#quantum-geometric-tensor)

### SP 800-90B health tests
NIST's continuous Repetition Count and Adaptive Proportion tests, which catch a stuck or heavily biased entropy source. quantum_rng implements them.

*See:* [SP 800-22](#sp-800-22)

### SP 800-22
NIST's statistical test suite for random bit sequences. NEURALESE implements monobit, block frequency, runs and cumulative sums, verified against the document's worked examples.

*See:* [SP 800-90B health tests](#sp-800-90b-health-tests)

### Tsotchke
Developer of Eshkol, Moonlab, QGTL, quantum_rng and other MIT-licensed projects (github.com/tsotchke). Components using this work carry the ⚛ Powered by Tsotchke badge.

*See:* [Eshkol](#eshkol), [Moonlab](#moonlab)

### Pre-registration
Writing down hypotheses, methods, nulls and pass/fail thresholds before running an experiment, and timestamping them (v11: a public commit) so results cannot quietly move the goalposts.

*See:* [Null model](#null-model), [Negative result](#negative-result)

### Null model
A version of the system with the property of interest destroyed — random-init weights, shuffled weights, a smaller model, a random edit — run through the identical test. A result only counts if it beats the null.

*See:* [Pre-registration](#pre-registration)

### Negative result
A pre-registered hypothesis the data did not support. Reported with the same prominence as positives; v11 has several.

*See:* [Pre-registration](#pre-registration)

### Consciousness indicators
Butlin, Long et al.'s list of computational properties (recurrence, global workspace, metacognition, agency…) derived from scientific theories of consciousness. A heuristic for weighing evidence under computational functionalism, not a test.

*See:* [Global workspace](#global-workspace), [PCI](#pci)

### PCI
Perturbational Complexity Index (Casali et al. 2013): perturb a system, binarise the spatiotemporal response and measure its Lempel–Ziv compressibility. v11 applies an analogue to the residual stream; high values can arise from noise, so nulls are essential.

*See:* [Lempel–Ziv complexity](#lempelziv-complexity), [Consciousness indicators](#consciousness-indicators)

### Lempel–Ziv complexity
LZ76: the number of new phrases met when parsing a sequence left to right; normalised by n·log2(n)/H so random strings score ≈ 1.

*See:* [PCI](#pci)

### Ignition
In global-workspace theory, a sudden non-linear, all-or-none amplification of a representation. v11 operationalises it as a Hill coefficient n ≥ 2 in the dose–response to concept injection.

*See:* [Hill coefficient](#hill-coefficient), [Global workspace](#global-workspace)

### Hill coefficient
The exponent n in y = R·xⁿ/(Kⁿ + xⁿ). n = 1 is graded; n ≥ 2 is switch-like.

*See:* [Ignition](#ignition)

### Global workspace
A theory (Baars; Dehaene & Changeux) in which specialised processors compete for a limited-capacity workspace whose contents are broadcast globally.

*See:* [Ignition](#ignition), [Consciousness indicators](#consciousness-indicators)

### Concept injection
Adding a concept's direction (here its token embedding) into an activation and asking whether something downstream can detect it — the method of Lindsey's introspection experiments, scaled down.

*See:* [Activation addition](#activation-addition), [Introspection (operational)](#introspection-operational)

### Introspection (operational)
Privileged access: a model predicts facts about its own behaviour better than an equally informed different model can (Binder et al. 2024). Not a claim about experience.

*See:* [Concept injection](#concept-injection)

### Recursive self-improvement loop
A system proposing changes to itself, keeping those that pass a held-out test, and repeating. v11's loop edits 1 536 parameters with a select set for decisions and an untouched test set for reporting.

*See:* [Test-time training](#test-time-training), [Self-distillation](#self-distillation)

### Self-distillation
Fine-tuning a model on its own (filtered) generations. Without new information it should not improve held-out loss, and can degrade it (model collapse, Shumailov et al.).

*See:* [Recursive self-improvement loop](#recursive-self-improvement-loop)

### Test-time training
Briefly updating some parameters on the start of an input before predicting the rest (Sun et al. 2019).

*See:* [Recursive self-improvement loop](#recursive-self-improvement-loop)

### Grokking
Delayed generalisation: test accuracy jumps long after training accuracy saturates (Power et al. 2022); linked to weight decay and Fourier-feature circuits in modular arithmetic (Nanda et al. 2023).

*See:* [Fourier features](#fourier-features)

### Fourier features
In modular-addition networks, neurons whose input weights are dominated by one frequency k (cos/sin of 2πka/p); the mechanism by which grokked nets compute (a+b) mod p.

*See:* [Grokking](#grokking)

### Causal atlas
v11's exhaustive table of the exact loss change from zero-ablating each of the 128 heads and 8 192 MLP neurons, compared with attribution patching.

*See:* [Attribution patching](#attribution-patching), [Ablation](#ablation)

// Course: beginner → advanced. Each lesson = lecture (markdown-lite), diagram (SVG), hands-on lab (terminal commands run in the live app), quiz.
const box = (x, y, w, h, t, c = '#14213a') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${c}" stroke="#5eead4" stroke-opacity=".5"/><text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle">${t}</text>`;
const arrow = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" marker-end="url(#ar)"/>`;
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px;font:11px monospace;fill:#e2e8f0"><defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="#94a3b8"/></marker></defs><rect width="${w}" height="${h}" fill="#0b1020"/>${body}</svg>`;

export const COURSE = [
{ id: 'l1', level: 'Beginner', title: '1 · What a language model computes', minutes: 15,
  lecture: `A causal language model maps a sequence of token ids to a probability distribution over the **next** token. TinyStories-8M has a 50 257-token vocabulary, a 256-dimensional residual stream and 8 transformer layers (≈19.7 M parameters, 12.9 M of them in the tied embedding matrix).

Generation is a loop: run the prompt, turn the final vector into **logits** (one score per vocabulary token), apply softmax to get probabilities, choose a token (greedy or sampled), append it and repeat. A **KV cache** stores each layer's keys and values so every new token costs one forward step.

Two numbers describe each step: the **entropy** of the distribution (uncertainty, in nats) and the **surprisal** −ln p of the chosen token. The TIMELINE tab plots both for every generated token.`,
  diagram: svg(520, 120, box(10, 40, 90, 40, 'token ids') + arrow(100, 60, 130, 60) + box(130, 40, 110, 40, 'embed + pos') + arrow(240, 60, 270, 60) + box(270, 40, 100, 40, '8 blocks') + arrow(370, 60, 400, 60) + box(400, 40, 110, 40, 'ln_f · Wᵀ → logits') + `<text x="455" y="105" text-anchor="middle">softmax → p(next)</text>`),
  lab: ['version', 'params', 'gen 30 Once upon a time', 'tab timeline'],
  labNotes: 'After the lab, press "refresh" in TIMELINE: tokens with high surprisal are where the model was surprised by its own sample.',
  quiz: [
    { q: 'What does the model output at each step?', options: ['One token id', 'A probability distribution over the vocabulary', 'A 256-d embedding'], a: 1, why: 'The forward pass ends in 50 257 logits; softmax turns them into a distribution which a decoding rule turns into a token.' },
    { q: 'Where is most of TinyStories-8M\'s parameter count?', options: ['MLP weights', 'Attention weights', 'The token embedding matrix'], a: 2, why: '50 257 × 256 ≈ 12.9 M of ≈19.7 M parameters are in wte (shared with the unembedding).' },
    { q: 'Surprisal of a token with p = 0.5 is about…', options: ['0.69 nats', '0.5 nats', '2 nats'], a: 0, why: '−ln 0.5 = ln 2 ≈ 0.693.' } ] },
{ id: 'l2', level: 'Beginner', title: '2 · Decoding: temperature, top-k, top-p', minutes: 15,
  lecture: `Decoding turns probabilities into a choice. **Greedy** takes the argmax. **Temperature** divides logits by T before softmax: T<1 sharpens, T>1 flattens. **Top-k** keeps the k best tokens; **top-p** (nucleus) keeps the smallest set whose mass ≥ p; **min-p** keeps tokens with p ≥ min_p·p_max. Repetition/frequency/presence penalties discourage loops.

Advanced modes in GEN: **beam search** keeps B hypotheses; **contrastive decoding** subtracts the clean (amateur) model's log-probs from the hacked (expert) one; **CFG** extrapolates away from a negative prompt.`,
  diagram: svg(520, 130, [0.42, 0.21, 0.12, 0.08, 0.06, 0.05, 0.03, 0.02, 0.01].map((p, i) => `<rect x="${20 + i * 52}" y="${110 - p * 220}" width="40" height="${p * 220}" fill="${i < 3 ? '#5eead4' : '#334155'}"/>`).join('') + '<text x="360" y="20">teal = kept by top-p 0.75</text>'),
  lab: ['set mode greedy', 'gen 20 The little dog', 'set mode sample', 'set temp 1.5', 'gen 20 The little dog', 'set temp 0.8'],
  labNotes: 'Compare the greedy and T=1.5 outputs; then open TIMELINE: entropy is a property of the model, but surprisal of the chosen token rises with temperature.',
  quiz: [
    { q: 'Temperature 0.5 makes the distribution…', options: ['flatter', 'sharper', 'unchanged'], a: 1, why: 'Dividing logits by 0.5 doubles their differences.' },
    { q: 'Top-p = 0.9 keeps…', options: ['the 90% most frequent words', 'the smallest set of tokens with total probability ≥ 0.9', 'tokens with p ≥ 0.9'], a: 1, why: 'Nucleus sampling truncates by cumulative mass.' } ] },
{ id: 'l3', level: 'Beginner', title: '3 · Architecture of TinyStories-8M', minutes: 20,
  lecture: `GPT-Neo is a **pre-LN decoder**: each block computes x ← x + Attn(LN₁(x)) and x ← x + MLP(LN₂(x)). The vector x that flows through is the **residual stream**.

Specifics you can verify in ARCH and PARAMS: 16 heads × 16 dims; MLP 256→1024→256 with GELU; **even layers use global attention, odd layers local attention with a 256-token window**; GPT-Neo does **not** divide attention scores by √d_head; q/k/v projections have no bias; the unembedding is the transpose of the token embedding (tied).

FLOPs per token ≈ 2·(parameters touched): about 0.79 M FLOPs per layer for the dense matmuls plus 2·T·d per layer for attention, plus 25.7 M for the 50 257×256 unembedding — the unembedding dominates, which the PROFILER confirms.`,
  diagram: svg(520, 200, box(20, 10, 480, 30, 'residual stream x (256)') + box(40, 60, 200, 40, 'LN₁ → 16 heads → O', '#0f2433') + box(280, 60, 200, 40, 'LN₂ → fc 1024 → GELU → proj', '#22162e') + arrow(140, 40, 140, 60) + arrow(140, 100, 140, 150) + arrow(380, 40, 380, 60) + arrow(380, 100, 380, 150) + box(20, 150, 480, 30, 'x + attn_out + mlp_out → next block')),
  lab: ['tab arch', 'params', 'flops 128', 'profile 16'],
  labNotes: 'In ARCH press render; in PARAMS press compute to see the treemap. Profile shows lnf+unembed as the slowest op.',
  quiz: [
    { q: 'Which layers of TinyStories-8M use local (windowed) attention?', options: ['all', 'odd-numbered layers', 'none'], a: 1, why: 'GPT-Neo alternates global (even) and local (odd, window 256).' },
    { q: 'In a pre-LN transformer the residual stream itself is…', options: ['normalised after every block', 'not normalised; LayerNorm is applied to the input of each sub-block', 'quantized'], a: 1, why: 'That is why residual norms grow with depth (RESIDUAL tab).' },
    { q: 'Which op dominates per-token compute here?', options: ['attention scores', 'MLP', 'unembedding (256×50 257)'], a: 2, why: '2·256·50 257 ≈ 25.7 M FLOPs vs ≈6.3 M for all 8 layers\' dense matmuls.' } ] },
{ id: 'l4', level: 'Intermediate', title: '4 · Attention heads and their jobs', minutes: 25,
  lecture: `Each head computes scores q_t·k_s for s ≤ t, softmaxes them into an **attention pattern**, and adds Σ_s a_ts·W_O W_V x_s to the residual. The **QK circuit** decides *where* to look; the **OV circuit** decides *what* to copy.

Behavioural classes measured in ATTENTION → head classification: **previous-token** (attend t→t−1), **duplicate-token** (attend to earlier copies of the same token), **induction** (on a repeated random sequence, attend to the token *after* the earlier copy), and **sink/positional** (attend to position 0). Small models often have few clean induction heads; the scores tell you how strong each behaviour is, they are not a binary truth.

**Rollout** multiplies head-averaged attention (plus ½·identity for the residual path) through the layers to approximate end-to-end token influence. It ignores MLPs and value norms, so treat it as a heuristic.`,
  diagram: svg(520, 140, ['A', 'B', 'C', 'D', 'A', 'B'].map((t, i) => `<text x="${40 + i * 80}" y="120" text-anchor="middle">${t}</text>`).join('') + `<path d="M360,105 C320,40 160,40 120,105" stroke="#f472b6" fill="none" marker-end="url(#ar)"/><text x="240" y="35" text-anchor="middle" fill="#f472b6">induction: second A attends to B (after first A)</text><path d="M440,105 C430,80 370,80 360,105" stroke="#60a5fa" fill="none" marker-end="url(#ar)"/>`),
  lab: ['heads', 'attn', 'sel 5 4'],
  labNotes: 'Switch the metric selector to "prev" and "induction". Click a tile in the all-heads grid to enlarge one head.',
  quiz: [
    { q: 'An induction head on "…A B … A" attends from the second A to…', options: ['the first A', 'the B that followed the first A', 'the BOS token'], a: 1, why: 'It looks one past the previous occurrence and copies that token.' },
    { q: 'The OV circuit of a head determines…', options: ['which positions it attends to', 'what information it writes once it attends', 'its layer index'], a: 1, why: 'QK = where, OV = what.' },
    { q: 'Attention rollout ignores…', options: ['the residual connection', 'MLPs and value-vector magnitudes', 'the causal mask'], a: 1, why: 'Rollout only multiplies attention weights (with ½I for the residual).' } ] },
{ id: 'l5', level: 'Intermediate', title: '5 · Residual stream geometry and the logit lens', minutes: 20,
  lecture: `Because every component *adds* to the residual stream, you can read it at any depth. The **logit lens** applies ln_f and the unembedding to an intermediate residual; the **tuned lens** first applies a learned per-layer affine map (fit in ANALYZE).

RESIDUAL shows norms per token × slot (norms grow with depth in pre-LN models), the cosine similarity between slots (adjacent layers are similar; the embedding is far from later layers) and **PCA trajectories**: every token is a path from its embedding through each slot's output.

**Direct logit attribution** (CIRCUIT / ANALYZE) decomposes the final logit of a target token into additive contributions of heads, neurons and biases — exact up to the frozen LayerNorm scale.`,
  diagram: svg(520, 120, [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<circle cx="${30 + i * 58}" cy="${90 - i * i * 0.9}" r="5" fill="${['#94a3b8', '#5eead4', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c', '#4ade80', '#e879f9'][i]}"/>`).join('') + '<text x="20" y="20">one token\'s trajectory through slots (PCA)</text>'),
  lab: ['tab resid', 'tab circuit', 'circuit'],
  labNotes: 'In RESIDUAL press run, switch axes to PC2/PC3. In CIRCUIT, hover edges to read Q/K/V composition scores.',
  quiz: [
    { q: 'The logit lens reads an intermediate residual by…', options: ['training a new probe', 'applying the final LayerNorm and unembedding', 'running the remaining layers'], a: 1, why: 'It reuses the model\'s own readout.' },
    { q: 'Why can DLA add up contributions?', options: ['softmax is linear', 'the residual stream is a sum and the unembedding is linear (with frozen LN scale)', 'heads are independent'], a: 1, why: 'Linearity after freezing the LN scale.' } ] },
{ id: 'l6', level: 'Intermediate', title: '6 · Weights as matrices: spectra and power laws', minutes: 25,
  lecture: `A weight matrix W has an SVD UΣVᵀ. Its singular values tell you gain per direction; **stable rank** ‖W‖_F²/σ₁² and **effective rank** exp(H(σ/Σσ)) summarise how many directions matter.

**WeightWatcher**-style analysis fits a power law ρ(λ) ∝ λ^(−α) to the tail of the eigenvalue spectrum of WᵀW/N (the ESD), using the Clauset–Shalizi–Newman MLE with the KS-optimal xmin. Martin & Mahoney report α≈2–4 for well-trained layers. With matrices this small (256 eigenvalues) the fit is noisy: compare α before and after an edit rather than reading absolute values.

Edits change these numbers in predictable ways: noise pushes the spectrum toward Marchenko–Pastur (α grows), SVD truncation removes the tail, quantization adds small broadband noise.`,
  diagram: svg(520, 140, Array.from({ length: 40 }, (_, i) => `<rect x="${20 + i * 12}" y="${120 - 100 / (1 + i * 0.35)}" width="9" height="${100 / (1 + i * 0.35)}" fill="#a78bfa"/>`).join('') + '<text x="300" y="30">singular values decay → heavy tail</text>'),
  lab: ['spectrum 3 fc', 'edit chaos 30', 'spectrum 3 fc', 'undo'],
  labNotes: 'Compare α and stable rank before and after chaos. The WEIGHTS tab overlays original (teal) and current (pink).',
  quiz: [
    { q: 'Stable rank is defined as…', options: ['number of non-zero singular values', '‖W‖_F² / σ₁²', 'trace(W)'], a: 1, why: 'Sum of squared singular values over the largest squared.' },
    { q: 'Adding large Gaussian noise to a trained matrix tends to…', options: ['decrease α', 'increase α (lighter tail, more random-like)', 'leave the spectrum unchanged'], a: 1, why: 'Random matrices follow Marchenko–Pastur with no heavy tail.' } ] },
{ id: 'l7', level: 'Intermediate', title: '7 · Causal interventions: ablation and patching', minutes: 25,
  lecture: `Correlation (attention patterns, activations) is not causation. To test a component, **intervene**: **zero/mean/resample ablation** of heads and neurons (RUNTIME / terminal \`ablate\`), **activation patching** of the residual stream or head outputs between a clean and a corrupted prompt (CAUSAL), and **path patching** of head → logit paths.

Mean ablation is gentler than zeroing because it keeps the activation on-distribution. Always measure the effect with a metric — logit difference, KL vs clean, perplexity — and compare against a baseline. The IMPACT tab shows KL per slot via the logit lens, per-position KL and the biggest probability shifts.`,
  diagram: svg(520, 110, box(10, 10, 150, 34, 'clean run') + box(10, 64, 150, 34, 'corrupted run') + arrow(160, 27, 250, 70) + box(250, 52, 120, 40, 'patch activation') + arrow(370, 72, 420, 72) + box(420, 52, 90, 40, 'metric Δ')),
  lab: ['impact', 'ablate head 5 4 zero', 'impact', 'undo', 'calib 80'],
  labNotes: 'L5H4 is the strongest previous-token head in this model; compare final KL with and without ablating it.',
  quiz: [
    { q: 'Why prefer mean ablation over zero ablation?', options: ['it is faster', 'it keeps activations closer to their natural distribution', 'it removes more information'], a: 1, why: 'Zero can be far outside the range the next layers expect.' },
    { q: 'Activation patching copies an activation from…', options: ['one run into another run at the same site', 'the weights into the cache', 'the tokenizer'], a: 0, why: 'It swaps one internal value between runs and measures the effect.' } ] },
{ id: 'l8', level: 'Advanced', title: '8 · Steering: additions, ablation, clamping, logit space', minutes: 30,
  lecture: `Many concepts appear to be linear directions. **Activation addition** adds c·û at chosen layers; **norm-preserving addition** rescales afterwards so ‖x‖ is unchanged; **directional ablation** removes the projection x·û; **clamping** sets that projection to a value.

In CONTROL you choose the direction source (token embedding difference, an existing steering vector, a neuron's output weights, an SAE decoder row, or random as a control), the **site** (resid_pre/post, attn_out, mlp_out, z, q, k, v — for q/k/v the direction is mapped through W_Q/W_K/W_V, so "key steering" changes what positions advertise), an optional **head** slice, layers, a token mask and a **time schedule** (ramp, decay, pulse, window).

**Logit-space steering** acts after the network: logit biases, or adding a direction to the normalised final vector h. Always run a random-direction control with the same norm to separate a specific effect from generic damage.`,
  diagram: svg(520, 120, `<line x1="60" y1="100" x2="460" y2="100" stroke="#334155"/><line x1="100" y1="100" x2="300" y2="30" stroke="#5eead4" marker-end="url(#ar)"/><line x1="300" y1="30" x2="420" y2="30" stroke="#f472b6" marker-end="url(#ar)"/><text x="160" y="55">x</text><text x="340" y="22" fill="#f472b6">+ c·û</text>`),
  lab: ['steer happy sad 6 resid_pre 2-5 add', 'gen 30 The girl felt', 'undo', 'steer happy sad 6 resid_pre 2-5 addnorm', 'gen 30 The girl felt', 'undo', 'bias dog:4', 'gen 20 She saw a', 'bias clear'],
  labNotes: 'Compare add vs addnorm outputs. In SWEEP choose "steering coef" to plot perplexity and KL as functions of coef.',
  quiz: [
    { q: 'Directional ablation with unit vector û maps x to…', options: ['x + û', 'x − (x·û)û', '‖x‖·û'], a: 1, why: 'Removes the component along û.' },
    { q: 'A random-direction control is useful because…', options: ['it is faster', 'it shows how much change any perturbation of that size causes', 'it trains the SAE'], a: 1, why: 'Specific effects must exceed generic damage.' } ] },
{ id: 'l9', level: 'Advanced', title: '9 · Features: neurons, superposition and SAEs', minutes: 30,
  lecture: `Neurons are often **polysemantic**: one neuron responds to several unrelated inputs, consistent with **superposition** (more features than dimensions). NEURONS builds an atlas: max activation, firing frequency and a polysemanticity score exp(H) over token identities of the top activations (1 = always the same token).

A **sparse autoencoder** (SAE tab) learns an overcomplete dictionary f = ReLU(W_enc(x−b_dec)+b_enc), x̂ = W_dec f + b_dec with an L1 penalty. Good SAEs have low reconstruction error, low L0 and few **dead features**. SAE DASH shows the density histogram and per-feature top contexts and logit effects. Clamping a feature (SAE tab) or steering along its decoder row (CONTROL) tests causality.`,
  diagram: svg(520, 120, box(10, 40, 80, 40, 'x (256)') + arrow(90, 60, 140, 60) + box(140, 30, 120, 60, 'ReLU(W_enc x) m', '#22162e') + arrow(260, 60, 310, 60) + box(310, 40, 90, 40, 'W_dec f') + arrow(400, 60, 440, 60) + box(440, 40, 70, 40, 'x̂')),
  lab: ['neurons 3 300', 'tab sae'],
  labNotes: 'Train an SAE in the SAE tab (layer 3, 1024 features), then open SAE DASH → compute densities and inspect a few features.',
  quiz: [
    { q: 'Superposition means…', options: ['two layers share weights', 'more features are represented than there are dimensions, using nearly orthogonal directions', 'attention heads overlap'], a: 1, why: 'It explains polysemantic neurons.' },
    { q: 'A dead SAE feature is one that…', options: ['never activates on the data', 'activates on every token', 'has negative weights'], a: 0, why: 'Dead features waste dictionary capacity.' } ] },
{ id: 'l10', level: 'Advanced', title: '10 · Rigour: evaluation, calibration, sweeps and tracking', minutes: 30,
  lecture: `Every edit needs a quantitative story. CALIBRATION computes perplexity, top-1 accuracy and **ECE** with a reliability diagram for the clean and current model on the reference corpus (which was sampled from the clean model, so use it comparatively). IMPACT gives KL per layer and position. SWEEP varies one parameter — edit strength α (blending W + α·ΔW), steering coefficient, head temperature, neuron clamp, logit bias, attention window — and plots perplexity, KL and p(target). Every result is logged to RUNS; tick runs to compare them and export CSV/JSON.

Good practice: change one thing at a time, include a control, report effect sizes with the metric's baseline, and save a snapshot (OPS) so others can reproduce the exact state.`,
  diagram: svg(520, 120, `<polyline points="30,100 90,95 150,88 210,75 270,55 330,40 390,30 450,26" fill="none" stroke="#5eead4"/><text x="40" y="20">perplexity vs edit strength α</text><line x1="30" y1="105" x2="480" y2="105" stroke="#334155"/>`),
  lab: ['reset', 'calib 80', 'edit quant 3', 'calib 80', 'sweep blend 0 1 5', 'runs', 'undo'],
  labNotes: 'Open RUNS and choose the metric "ppl" to compare the two calibration runs; the sweep curve appears in the lower chart.',
  quiz: [
    { q: 'ECE measures…', options: ['average |accuracy − confidence| across confidence bins, weighted by bin size', 'perplexity', 'KL to the clean model'], a: 0, why: 'Expected calibration error.' },
    { q: 'Edit strength α = 0 in the blend sweep corresponds to…', options: ['the original weights', 'the fully edited weights', 'zero weights'], a: 0, why: 'W + 0·(M − W) = W.' } ] },
{ id: 'l11', level: 'Research', title: '11 · Gradients, attribution and curvature', minutes: 30,
  lecture: `The backward pass gives ∂m/∂(everything). **Gradient × input** is a first-order attribution; **integrated gradients** integrate the gradient along a path from a baseline and satisfy completeness (attributions sum to m(x) − m(x′)). **Attribution patching** estimates the effect of patching every head from one backward pass; always validate it against true activation patching, as GRADIENTS does (Pearson r).

The **empirical Fisher** (mean squared gradient) and the **saliency** Σ|θ·g| rank parameters by local sensitivity; the top **Hessian eigenvalue** measures sharpness. The DRILL inspector checks the analytic directional derivative against a finite difference for any selection.`,
  diagram: svg(520, 120, `<line x1="30" y1="100" x2="480" y2="20" stroke="#5eead4"/><circle cx="30" cy="100" r="4" fill="#f472b6"/><circle cx="480" cy="20" r="4" fill="#f472b6"/><text x="36" y="114">baseline x′</text><text x="420" y="14">input x</text><text x="180" y="50">∫ ∇m along the path</text>`),
  lab: ['attrib gxi', 'attrib ig play dance', 'atp', 'fisher 2', 'drill L3.attn.q.H5'],
  labNotes: 'Compare the IG completeness error with grad×input, and the AtP scatter with the y = x line.',
  quiz: [
    { q: 'Integrated gradients attributions sum to…', options: ['m(x) − m(baseline)', 'zero', 'the gradient norm'], a: 0, why: 'Completeness axiom.' },
    { q: 'Attribution patching is…', options: ['a first-order Taylor estimate of activation patching', 'exact activation patching', 'a training method'], a: 0, why: '(a_corrupt − a_clean)·∂m/∂a.' } ] },
{ id: 'l12', level: 'Research', title: '12 · Circuits and geometry', minutes: 30,
  lecture: `A head's **OV circuit** W_U·W_O·W_V·W_E maps tokens to logits; positive eigenvalues mean copying. **Composition scores** measure how much a later head reads (via Q, K or V) what an earlier head wrote. **Induction heads** attend to the token after an earlier copy of the current one; TinyStories-8M has strong previous-token heads but only weak induction, which is a real finding, not a bug.

Representation geometry: **CKA** compares layers, **TwoNN** estimates intrinsic dimension, **anisotropy** measures a shared direction, **logit-lens KL** shows how far each layer is from the final prediction. Loss-landscape slices and **superposition** interference complete the picture.`,
  diagram: svg(520, 120, `<circle cx="80" cy="60" r="18" fill="none" stroke="#5eead4"/><circle cx="260" cy="60" r="18" fill="none" stroke="#5eead4"/><circle cx="440" cy="60" r="18" fill="none" stroke="#5eead4"/><line x1="98" y1="60" x2="242" y2="60" stroke="#f472b6"/><line x1="278" y1="60" x2="422" y2="60" stroke="#f472b6"/><text x="140" y="50">K-comp</text><text x="320" y="50">V-comp</text>`),
  lab: ['eigen', 'comp', 'induct', 'geom 2', 'land 2d 3 q svd', 'mode surface'],
  labNotes: 'Open 3D MODES → circuit graph to see the strongest compositions; the loss surface opens automatically after the 2-D slice.',
  quiz: [
    { q: 'A positive OV copying score means the head…', options: ['tends to increase the logit of the token it attends to', 'ignores the token', 'attends to the previous position'], a: 0, why: 'Positive eigenvalues of the token→logit map.' },
    { q: 'CKA = 1 between two layers means…', options: ['identical representation geometry up to rotation and scale', 'identical weights', 'zero loss'], a: 0, why: 'CKA is invariant to orthogonal transforms and isotropic scaling.' } ] },
];

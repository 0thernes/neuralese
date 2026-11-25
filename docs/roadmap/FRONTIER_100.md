# Frontier 100

Approved idea list from Alex. Nothing here was run for this document.

Novelty classes, in his words:

- **A** — none found in his limited searches. That is not a proof of novelty. Verify the search before anyone claims the idea is new.
- **B** — one to three recent papers. Citations are on Alex’s page. They are not copied here, and none were invented.
- **C** — known, and this repo does not ship a tool for it.

Difficulty and fun are his 1–5 scores. The falsifiable test is the bar he wrote. A pass still has to be pre-registered and logged. This file does not record a pass.

Cheap wins to attempt first, after the open finish list and after P0 table stakes, are the rows with difficulty 1 or 2. Flagships are difficulty 4–5. The rest wait.

| # | Name | Category | Class | Difficulty | Fun | Falsifiable test |
|---|---|---|---|---|---|---|
| 1 | RG flow of residual stream | Physics | B | 4 | 5 | coupling drift <5% after layer k vs shuffled |
| 2 | Critical exponents of sampling temperature | Physics | B | 3 | 5 | data collapse residual <0.1 across 4 sizes |
| 3 | Landauer ledger per token | Physics | A | 3 | 5 | energy/Landauer ratio vs token entropy Spearman>0.3 |
| 4 | Free-energy layer accounting | Physics | A | 3 | 4 | F decreasing with depth, trained vs random |
| 5 | Hysteresis in steering | Physics | A | 2 | 5 | loop area >0 vs random direction |
| 6 | Spin-glass overlap of seeds | Physics | A | 3 | 4 | bimodal overlap vs Gaussian null |
| 7 | Feature avalanche statistics | Physics | A | 3 | 4 | power law beats exponential (Vuong p<0.05) |
| 8 | Analog crossbar emulator | Hardware | C | 3 | 4 | head importance vs drift rank-correlation |
| 9 | Stochastic-computing transformer | Hardware | B | 3 | 4 | perplexity vs bitstream length knee |
| 10 | Photonic MZI mesh sim | Hardware | A | 4 | 5 | phase-noise threshold per head |
| 11 | Spiking conversion audit | Hardware | C | 4 | 4 | circuit faithfulness vs timesteps |
| 12 | Approximate multiplier zoo | Hardware | C | 2 | 3 | per-layer KL<0.05 tolerance map |
| 13 | Thermal-throttle timing side channel | Hardware | A | 2 | 4 | MI(token, latency)>0 |
| 14 | DRAM weight-decay half-life | Hardware | A | 2 | 4 | time to 1% loss, which features die first |
| 15 | Circuit watermark | Crypto | B | 3 | 5 | detection AUC after finetune and pruning |
| 16 | Residual covert-channel detector | Crypto | B | 3 | 4 | TPR at 1% FPR |
| 17 | Weights as one-time pad | Crypto | C | 1 | 3 | bits/param at KL<0.01 |
| 18 | Homomorphic toy forward | Crypto | C | 4 | 3 | max logit error per layer |
| 19 | Hash commitments for interp claims | Crypto | A | 1 | 3 | replication survival rate |
| 20 | Trapdoor feature vs SAEs | Crypto | B | 3 | 4 | SAE recall vs key entropy |
| 21 | Activation immune system | Biology | A | 2 | 4 | AUROC vs Mahalanobis |
| 22 | Developmental lineage of neurons | Biology | A | 3 | 5 | lineage tree stable across seeds |
| 23 | Sleep replay consolidation | Biology | C | 2 | 3 | forgetting reduction |
| 24 | Synaptic scaling homeostasis | Biology | C | 3 | 3 | bit-flip recovery time |
| 25 | Lesion-recovery plasticity | Biology | B | 2 | 4 | takeover heads consistent across seeds |
| 26 | Morphogen positional field | Biology | A | 2 | 4 | Fourier peak vs shuffled |
| 27 | Evolutionary fossil record of merges | Biology | A | 3 | 4 | tree recovers merge history |
| 28 | SMT-proved circuit property | Formal | B | 4 | 5 | proof or counterexample, length<=6 |
| 29 | CEGAR circuit discovery | Formal | A | 4 | 5 | iterations to 100% faithfulness |
| 30 | IBP bounds on features | Formal | B | 3 | 3 | bound tightness |
| 31 | Lean-checked toy model mod 7 | Formal | B | 5 | 5 | proof compiles, fails on perturbed weights |
| 32 | Abstract interpretation of attention | Formal | C | 4 | 3 | proven bound |
| 33 | Persistent homology across layers | Topology | B | 2 | 4 | H1 bar >3x noise for cyclic concepts |
| 34 | Topological steering at 135M | Topology | B | 2 | 3 | vs mean-diff at equal norm |
| 35 | Mapper of training trajectory | Topology | A | 3 | 4 | branches coincide with loss spikes |
| 36 | Sheaf consistency of features | Topology | A | 5 | 5 | H1 predicts polysemanticity |
| 37 | Fisher-Rao geodesic between checkpoints | InfoGeom | A | 4 | 4 | speed peaks precede capability jumps |
| 38 | Curvature of steering directions | InfoGeom | A | 3 | 4 | curvature predicts collapse r>0.6 |
| 39 | Natural-gradient probes | InfoGeom | C | 3 | 3 | cross-seed transfer |
| 40 | Heads as Nash players | GameTheory | B | 3 | 4 | fraction with no improving deviation |
| 41 | Head Shapley interactions | GameTheory | B | 3 | 3 | predicts double-ablation r>0.7 |
| 42 | Auction-routed MoE | GameTheory | A | 3 | 4 | specialization entropy |
| 43 | Compile looped DSL to weights | Compilers | B | 5 | 5 | exact on 1000 programs |
| 44 | Decompile weights to RASP | Compilers | B | 4 | 5 | 99% agreement incl. longer lengths |
| 45 | Optimizing compiler for compiled weights | Compilers | A | 3 | 4 | param shrink, same outputs |
| 46 | Weight linker | Compilers | A | 4 | 5 | composed program 100% |
| 47 | Decompile-recompile roundtrip | Compilers | A | 5 | 5 | behavioral agreement |
| 48 | Residual-stream type checker | Compilers | A | 4 | 5 | violations predict errors OR>2 |
| 49 | Granger causality between heads | Time | A | 2 | 3 | agrees with patching Jaccard>0.5 |
| 50 | Lookahead planning probes | Time | C | 2 | 4 | t+3 accuracy above n-gram baseline |
| 51 | Time-reversed twin diff | Time | B | 3 | 4 | crosscoder shared fraction |
| 52 | Self-recognition of own activations | Introspection | A | 3 | 5 | >60% vs sibling control |
| 53 | Concept injection at tiny scale | Introspection | B | 2 | 5 | detection vs false positives |
| 54 | Self-prediction of entropy | Introspection | C | 2 | 3 | Spearman |
| 55 | Quine model | SelfRef | A | 4 | 5 | bits reproduced vs size |
| 56 | Model reads own weights | SelfRef | A | 4 | 5 | above-chance head labeling |
| 57 | Fixed-point prompts | SelfRef | A | 2 | 4 | attractor count and basins |
| 58 | Prereg-calibrated agent notebook | Automation | A | 2 | 4 | Brier over 100 experiments |
| 59 | Adversarial reviewer agent | Automation | C | 2 | 4 | retraction rate |
| 60 | Experiment genome evolution | Automation | A | 3 | 4 | surprise per CPU-hour |
| 61 | Curiosity-driven probe search | Automation | A | 3 | 3 | bits per probe |
| 62 | Activation sonification | Viz | B | 2 | 5 | blind detection of induction firing |
| 63 | Forward-pass breakpoints debugger | Viz | C | 3 | 5 | time to localize planted bug |
| 64 | Time-travel training debugger | Viz | A | 3 | 5 | butterfly divergence exponent |
| 65 | Git for weights, semantic diff | Viz | B | 3 | 4 | diff accuracy on planted edits |
| 66 | Haptic attention | Viz | A | 2 | 4 | blind sink detection |
| 67 | VR residual walk | Viz | C | 3 | 4 | faster outlier finding |
| 68 | Activation glyphs | Viz | A | 1 | 3 | anomaly scan speed |
| 69 | Model as music score | Art | B | 2 | 5 | motifs align with circuits |
| 70 | Aesthetic gradient | Art | A | 2 | 4 | loss penalty vs symmetry |
| 71 | L-system circuit plants | Art | A | 1 | 4 | classifier distinguishes circuits |
| 72 | Dream decoding | Art | A | 1 | 4 | dream vs train KL |
| 73 | Model ecology | MadSci | A | 3 | 5 | niche specialization MI |
| 74 | Model parasitism | MadSci | A | 3 | 5 | parasite accuracy vs host KL |
| 75 | Weight radioactive dating | MadSci | A | 2 | 4 | step MAE |
| 76 | Corrupted-model archaeology | MadSci | A | 3 | 4 | recovered accuracy |
| 77 | Rule 110 compiled then eroded | MadSci | B | 3 | 5 | steps until violation |
| 78 | Life in attention | MadSci | A | 3 | 5 | rule-fit accuracy |
| 79 | Entropy production rate | Physics | A | 3 | 4 | irreversibility peaks at circuits |
| 80 | Gauge symmetry finder | Physics | B | 4 | 4 | diff noise -50% |
| 81 | EFT of tiny MLP | Physics | C | 3 | 3 | error vs scale |
| 82 | Diffractive optical sim | Hardware | C | 4 | 3 | accuracy vs pixel noise |
| 83 | Event-driven delta attention | Hardware | C | 3 | 3 | compute saved vs KL |
| 84 | Error-correcting residual stream | Hardware | A | 3 | 5 | flip recovery rate |
| 85 | Bit-plane interpretability | Hardware | A | 2 | 4 | faithfulness per bit plane |
| 86 | Avalanche/hash circuits | Crypto | A | 2 | 4 | avalanche ratio vs SHA |
| 87 | ZK circuit claim (ezkl) | Crypto | B | 5 | 5 | verifies; fails on fake claim |
| 88 | Apoptosis neurons | Biology | C | 2 | 3 | loss at equal sparsity |
| 89 | Boolean gene-network MLPs | Biology | A | 3 | 4 | attractors vs tasks |
| 90 | Circuit equivalence checking | Formal | C | 3 | 3 | proof or counterexample |
| 91 | Head contracts | Formal | A | 3 | 4 | violations predict errors |
| 92 | Discrete Morse loss landscape | Topology | C | 3 | 3 | critical index distribution |
| 93 | OT between layers | InfoGeom | C | 2 | 3 | cost spikes at boundaries |
| 94 | Head coalition formation | GameTheory | A | 3 | 4 | stable coalitions |
| 95 | Superoptimizer | Compilers | C | 4 | 4 | min params |
| 96 | Counterfactual trajectory tree | Time | C | 2 | 3 | divergence vs intervention |
| 97 | Overnight hypothesis harvester | Automation | C | 2 | 3 | confirmed per week |
| 98 | Activation timelapse movie | Viz | C | 1 | 4 | viewer finds phase change |
| 99 | Interactive circuit Lego | Viz | A | 4 | 5 | assembled model passes task |
| 100 | Model horoscope | Art | A | 1 | 3 | trait ICC>0.7 |

Difficulty 1–2, in his numbering: 5, 12, 13, 14, 17, 19, 21, 23, 25, 26, 33, 34, 49, 50, 53, 54, 57, 58, 59, 62, 66, 68, 69, 70, 71, 72, 75, 85, 86, 88, 93, 96, 97, 98, 100.

Class B rows point at Alex’s page for citations. No paper was added from memory.

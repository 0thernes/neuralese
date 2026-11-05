# Table stakes (100)

Approved inventory from Alex. The **have** column is his mark (`yes`, `partial`, `no`), not a fresh audit of this tree. Priority is his. Nothing in the P0 set was implemented for this list.

Build order is in [README.md](README.md). P0 cards are `TS-P0-xx` on the Kanban. There are 43 of them.

| # | Capability | Reference | Have | Priority | Area | Card |
|---|---|---|---|---|---|---|
| 1 | Named hook points on every module | TransformerLens | partial | P0 | Core | TS-P0-01 |
| 2 | run_with_cache | TransformerLens | partial | P0 | Core | TS-P0-02 |
| 3 | Hook interventions add/replace/zero | TransformerLens; nnsight | partial | P0 | Core | TS-P0-03 |
| 4 | Lazy/remote tracing API | nnsight | no | P2 | Core | |
| 5 | Unified HF loader | transformers | partial | P0 | Core | TS-P0-04 |
| 6 | Arch adapters GPT-2/Llama/Qwen/Pythia | TransformerLens | partial | P0 | Core | TS-P0-05 |
| 7 | Fold LayerNorm/center weights | TransformerLens | no | P1 | Core | |
| 8 | Batched inference with padding masks | transformers | partial | P0 | Core | TS-P0-06 |
| 9 | Deterministic seeds | PyTorch | partial | P0 | Core | TS-P0-07 |
| 10 | Sharded activation store | SAELens | partial | P0 | Data | TS-P0-08 |
| 11 | Dataset streaming and tokenization | HF datasets | partial | P0 | Data | TS-P0-09 |
| 12 | Prompt and contrast-pair datasets | pyvene | partial | P1 | Data | |
| 13 | Checkpoint registry | HF Hub; MLflow | partial | P1 | Data | |
| 14 | Logit lens | TransformerLens | yes | P0 | Analysis | TS-P0-10 |
| 15 | Tuned lens | EleutherAI | yes | P0 | Analysis | TS-P0-11 |
| 16 | Direct logit attribution | TransformerLens | partial | P0 | Analysis | TS-P0-12 |
| 17 | Activation patching | TransformerLens | yes | P0 | Analysis | TS-P0-13 |
| 18 | Path patching | IOI | partial | P1 | Analysis | |
| 19 | Attribution patching | Nanda | no | P1 | Analysis | |
| 20 | ACDC | ACDC | partial | P1 | Analysis | |
| 21 | Edge attribution patching | EAP-IG | no | P1 | Analysis | |
| 22 | Attribution graphs and transcoders | circuit-tracer | no | P1 | Analysis | |
| 23 | Causal tracing | ROME | yes | P1 | Analysis | |
| 24 | Interchange intervention and DAS | pyvene | no | P1 | Analysis | |
| 25 | Linear probes with a split | common | yes | P0 | Analysis | TS-P0-14 |
| 26 | Probe control tasks | Hewitt and Liang | no | P1 | Analysis | |
| 27 | Integrated gradients | Captum | no | P1 | Attribution | |
| 28 | Saliency and grad × input | Captum; ecco | no | P1 | Attribution | |
| 29 | Layer conductance | Captum | no | P2 | Attribution | |
| 30 | Attention pattern viewer | bertviz; CircuitsVis | partial | P0 | Viz | TS-P0-15 |
| 31 | Head and model view | bertviz | partial | P1 | Viz | |
| 32 | Neuron activation viewer | ecco | partial | P0 | Viz | TS-P0-16 |
| 33 | Feature dashboards | SAELens; Neuronpedia | partial | P0 | SAE | TS-P0-17 |
| 34 | SAE training ReLU/TopK/JumpReLU | SAELens | yes | P0 | SAE | TS-P0-18 |
| 35 | SAE eval metrics | SAEBench | partial | P0 | SAE | TS-P0-19 |
| 36 | Feature autointerp | Neuronpedia | no | P1 | SAE | |
| 37 | Feature text search | Neuronpedia | no | P1 | SAE | |
| 38 | SAE feature steering | Goodfire | partial | P1 | SAE | |
| 39 | Transcoders | SAELens | no | P2 | SAE | |
| 40 | Pretrained SAE loading | SAELens | no | P2 | SAE | |
| 41 | CAA steering | repeng | yes | P0 | Control | TS-P0-20 |
| 42 | ActAdd | Turner et al. | yes | P0 | Control | TS-P0-21 |
| 43 | RepE readers | repe | partial | P1 | Control | |
| 44 | Ablation sweeps zero/mean/resample | TransformerLens | partial | P0 | Control | TS-P0-22 |
| 45 | ROME/MEMIT | EasyEdit | yes | P1 | Control | |
| 46 | Experiment tracker | W&B; MLflow | yes | P0 | Tracking | TS-P0-23 |
| 47 | Artifact versioning | W&B | partial | P0 | Tracking | TS-P0-24 |
| 48 | Sweeps | Optuna | partial | P1 | Tracking | |
| 49 | Run comparison | W&B | partial | P0 | Tracking | TS-P0-25 |
| 50 | System metrics | W&B | partial | P1 | Tracking | |
| 51 | Lineage graph | MLflow | no | P1 | Tracking | |
| 52 | Config management | Hydra | partial | P1 | Tracking | |
| 53 | Checkpoint resume | Lightning | partial | P0 | Training | TS-P0-26 |
| 54 | Grad accumulation and clipping | HF Trainer | partial | P0 | Training | TS-P0-27 |
| 55 | LR schedulers and warmup | HF Trainer | partial | P0 | Training | TS-P0-28 |
| 56 | bf16 on CPU | PyTorch | no | P2 | Training | |
| 57 | Tiny-model recipes | nanoGPT | yes | P0 | Training | TS-P0-29 |
| 58 | LoRA/PEFT | peft | partial | P1 | Training | |
| 59 | DPO small-scale | TRL | no | P2 | Training | |
| 60 | Log-spaced checkpoints | Pythia | partial | P1 | Training | |
| 61 | Benchmark harness | lm-eval-harness | no | P0 | Eval | TS-P0-30 |
| 62 | Task eval framework with logs | Inspect | no | P1 | Eval | |
| 63 | Held-out perplexity | lm-eval | yes | P0 | Eval | TS-P0-31 |
| 64 | YAML eval tasks | lm-eval | no | P1 | Eval | |
| 65 | Eval log viewer | Inspect | no | P1 | Eval | |
| 66 | Model-graded evals | Inspect | no | P2 | Eval | |
| 67 | n-gram contamination check | common | no | P2 | Eval | |
| 68 | Stats tests and CIs | common | partial | P0 | Eval | TS-P0-32 |
| 69 | Random and shuffled controls | steering literature | yes | P0 | Eval | TS-P0-33 |
| 70 | Interactive demo UI | Gradio | partial | P1 | UI | |
| 71 | Notebook integration | Jupyter | partial | P0 | UI | TS-P0-34 |
| 72 | Prompt playground with token probs | Garcon | partial | P0 | UI | TS-P0-35 |
| 73 | Token probability heatmap | ecco | partial | P0 | UI | TS-P0-36 |
| 74 | Side-by-side model compare | Neuronpedia | partial | P1 | UI | |
| 75 | Functional inspection | Penzai | no | P2 | UI | |
| 76 | Tensor pretty-printer | Treescope | no | P2 | UI | |
| 77 | int8/int4 inference | llama.cpp | yes | P1 | Efficiency | |
| 78 | GGUF export | llama.cpp | no | P2 | Efficiency | |
| 79 | ONNX export | ONNX | no | P2 | Efficiency | |
| 80 | Per-layer profiler, FLOPs and latency | torch.profiler | partial | P0 | Efficiency | TS-P0-37 |
| 81 | Memory estimator | accelerate | no | P2 | Efficiency | |
| 82 | KV-cache management | transformers | yes | P1 | Efficiency | |
| 83 | Hub download and caching | huggingface_hub | partial | P0 | Infra | TS-P0-38 |
| 84 | VPS job runner | Modal; SkyPilot | partial | P1 | Infra | |
| 85 | Background job queue | Ray | partial | P1 | Infra | |
| 86 | CLI for all experiments | lm-eval CLI | partial | P0 | Infra | TS-P0-39 |
| 87 | API docs and examples | TransformerLens | partial | P1 | Infra | |
| 88 | Hook tests against a reference | TransformerLens | partial | P0 | Infra | TS-P0-40 |
| 89 | Golden-output regression tests | common | partial | P0 | Infra | TS-P0-41 |
| 90 | Plugin system | Inspect | no | P2 | Infra | |
| 91 | HTML reports | W&B Reports | partial | P1 | Report | |
| 92 | SVG and PDF figure export | matplotlib | partial | P1 | Report | |
| 93 | Write-up templates | W&B | no | P2 | Report | |
| 94 | Dataset viewer | HF | no | P2 | Data | |
| 95 | Embedding projector | TensorBoard | partial | P1 | Viz | |
| 96 | Weight histograms over training | TensorBoard | partial | P1 | Viz | |
| 97 | Loss landscape slices | loss-landscapes | no | P2 | Viz | |
| 98 | Head-ablation importance table | TransformerLens | partial | P0 | Analysis | TS-P0-42 |
| 99 | Model card generation | HF Hub | no | P2 | Report | |
| 100 | Safetensors IO | safetensors | partial | P0 | Infra | TS-P0-43 |

Counts from this table: P0 43, P1 36, P2 21. A row marked `yes` is still not a promise that the reference tool’s full behavior is present.

# NEURALESE v2: interpretability and weight-surgery lab (TinyStories-8M, 100% in-browser)

Live: https://0thernes.github.io/neuralese/

The app loads [roneneldan/TinyStories-8M](https://huggingface.co/roneneldan/TinyStories-8M) (GPT-Neo, 8 layers, 16 heads, d=256, 1024 MLP neurons) straight from Hugging Face. HTTP Range requests fetch only the 78.8 MB of fp32 tensors and skip the bool mask buffers. A from-scratch JS forward pass with hooks at `resid_pre, z, attn_out, mlp_act, mlp_out, resid_post` then runs everything on the CPU in f32.

## Modules
| file | what |
|---|---|
| engine.js | GPT-Neo forward pass, KV cache, traces, hooks. Runtime controls: layer program (dup/delete/skip/reorder), per-head temperature and zero/mean/resample ablation, attention-mask modes, positional remap, steering stack (site, per-layer schedule, token mask), SAE clamps, neuron overrides |
| analysis.js | corpus stats, logit lens, tuned lens (ridge affine per layer), exact DLA (embed/heads/neurons/biases/other), residual and head patching, path patching head→logits, ablation sweeps, control vectors (mean-diff / PCA), vector arithmetic, token stats |
| surgery.js | replayable edit stack: elementwise ops, SVD (top-k/drop/scale/flatten), low-rank noise, int8/4/2 quantization, layer interpolation/transplant, LayerNorm γ/β, wpe tampering, ROME rank-one, chaos; safetensors export |
| rome.js | ROME: u = C⁻¹k*/(k*ᵀC⁻¹k*) from the corpus MLP-activation second moment; v* optimised (direction ascent + SPSA/Adam) through the real forward pass |
| sae.js | ReLU SAE with L1, unit-norm decoder, Adam, trained in the browser |
| decode.js | temperature, top-k/p, min-p, typical, repetition/frequency/presence penalties, logit bias, beam search, contrastive decoding, CFG |
| linalg.js | one-sided Jacobi SVD, Cholesky solve, PCA |

## Verification
- `node --test test/` runs 18 tests against PyTorch references produced by `ref.py` (HF transformers): forward logits, logit lens, DLA, resid/head/path patching, SVD vs numpy, ROME flip, quantization ordering, SAE, decoding, and the safetensors round-trip.
- `node smoke.mjs` runs a headless-Chrome end-to-end check of the UI.

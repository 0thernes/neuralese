# NEURALESE 🧠⚡

Live, in-browser weight hacking of a tiny open language model, in 3D.

- **Model:** [roneneldan/TinyStories-8M](https://huggingface.co/roneneldan/TinyStories-8M) (GPT-Neo, 8 layers × 16 heads, d=256, ~19.7M params, ~79 MB fp32). Weights stream straight from the Hugging Face CDN (safetensors, HTTP range request) into mutable `Float32Array`s.
- **Inference:** hand-written JS GPT-Neo forward pass (`model.js`) + GPT-2 BPE tokenizer (`tokenizer.js`). Greedy output matches PyTorch/transformers token-for-token.
- **3D:** Three.js + bloom. Layers are glowing discs, the 16 heads ring each layer, and the 1024 MLP neurons sit in a 32×32 grid that lights up as each token is generated. Click anything to inspect it. The inspector shows a neuron's logit-lens tokens and a head's live attention heatmap.

## Hacks
scale / zero / invert / noise on a head, a neuron, a whole layer, or an embedding row · head ablation · activation steering (ActAdd: resid(A) − resid(B) injected after layer N) · swap or shuffle layers · global chaos slider · presets · reset · original vs hacked side by side with the same seed (divergent tokens glow pink).

No build step: just serve the folder statically.

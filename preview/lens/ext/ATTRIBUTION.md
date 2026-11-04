# neuron-lens catalog sample — attribution

`neuron-lens-sample.json` is a subset of the **neuron-lens** catalog
(https://huggingface.co/datasets/stdlogits/neuron-lens, revision `b5bf11a2b9e35c9100a0fa0995ff7a4e57f5b777`),
by [@_a9lim](https://x.com/_a9lim) and [@treetowntree](https://x.com/treetowntree) with Claude (Anthropic), 2026-10-31.
Code: https://github.com/stdlogits/neuron-lens.

License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Derived from Qwen/Qwen3-8B and google/gemma-4-12B (both Apache 2.0).

Changes made by Neuralese: we took a subset (all head labels and legibility rows, plus the 300 layer-8 neuron poles per model with the highest `writes_conf`, joined to their legibility rows) and rounded floats to 3 dp; NaN values (undefined metrics) are stored as null. No label text was edited. We left out the `contexts` excerpts, which quote third-party corpora under their own terms. sha256 of each source parquet is recorded in the JSON `files` field.
Labels were written by a model and are not ground truth. Use the confidences the authors give.

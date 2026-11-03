# Deep Walkthrough

An original Neuralese workspace. It steps through one forward pass as blocks of numbers, then keeps going down through a single product, a gate netlist, and a simulated CMOS circuit.

The idea of walking a transformer by watching the arithmetic is inspired by Brendan Bycroft’s [LLM Visualization](https://bbycroft.net/llm). Nothing else is taken from that page: not its text, layout, shaders, camera path, or assets. The pictures here are a Solid + three.js panel on the v17 shell, and the numbers are this repository’s engine.

## What is real

TinyStories-8M is the model the lab loads. **Deep Walk → Run forward** encodes the prompt with the page’s tokenizer and runs `Engine` on the clean weights (the edited copy is not the default). The same path the worker uses is preferred: `engine-worker.js` ops `walk`, `walkCell`, and `walkStudy`. If the worker is down, the main-thread `Engine` runs the same functions.

For the selected token the engine copies the tensors it actually writes:

- token row, position row, and their sum
- each layer’s residual, both layer norms, Q, K, V, attention scores, softmax weights, mixed values, attention projection, MLP pre-activation, GELU, MLP projection, and the residual adds
- final layer norm and the logits

Hovering a cell recomputes it with the same loops the engine uses, including the four-lane matvec. The stored value is the float32 write. Tests require the recomputation to land within `1e-5` of the stored value, and the walk’s logits to land within `1e-5` of `Engine.logits`. On the checked prompt the gaps are 0.

A block longer than the display cap (48, or 32 on a narrow screen) is sampled. The caption says how: a stride, with the focused index kept, or, for logits, the largest entries rather than a stride. The full vector is still what the arithmetic uses.

Other Arch models are walked only when something has registered one (`registerArchModel`). The lab does not load GPT-2, Llama, or Qwen weights into the shell by default, and this workspace does not pretend they are loaded. An Arch walk shows what `arch.forward` returns: embeddings, the residual after each block, attention weights, the final norm, and logits. It does not invent a QKV tape that call did not return. The per-head score tape is the TinyStories engine path.

The shared selection store is updated with the model, the prompt, the token, and the layer or head of the operation on screen. Changing the head in the selection panel filters the scrubber to that head.

## Zoom

| Level | What you see |
|---|---|
| Model | One slab per layer. The layer of the current operation is marked. |
| Layer | The operations of that layer, as blocks. |
| Head / neuron | The selected head’s row, or the sampled cells of the current tensor. |
| Matmul | The sampled outputs of the current linear map. Height and color are the value. |
| Dot product | The largest products inside the selected output, not every term. The sum still uses every term, and the caption says how many were listed. |
| Float | Sign, exponent, and fraction bits of the float32 rounding of the selected product. The engine’s matvec accumulator is a JavaScript number (float64), not a float32 fused multiply-add. |
| Gates | AND / OR / XOR / NOT with unit delay. A normal float32 product opens as a 24-bit significand multiply (hidden 1 included). A Forge instruction opens as that opcode’s ALU. |
| Voltage | A simulated inverter transfer curve. |

Play, pause, step, and the scrubber move along operations. The camera eases to the group on screen. `prefers-reduced-motion` snaps the camera instead.

## Gates, and Forge

`src/walk/gates.js` is a Boolean netlist. A ripple adder and an array multiplier are built only from AND, OR, XOR, NOT, and constant 0/1. Tests check them against integer products and sums on random inputs, including 8-bit multiplies and the Forge demo’s ALU ops.

ForgeISA arithmetic lowers as follows:

- `ADD`, `ADDI`: ripple-carry add
- `SUB`: add with inverted subtrahend and carry-in 1
- `AND`, `OR`, `XOR`: one gate per bit
- `SLT`, `BLT`: the signed compare described in `docs/NEST_CPU.md` (sign of the difference, corrected on overflow)
- `BEQ`, `BNE`: equality by OR of bitwise XOR, inverted for `BEQ`
- `LUI`: a wire shift, not an arithmetic gate
- `LW`, `SW`: the address adder only. RAM is not drawn as gates
- `JAL`: the PC add. The link value is `PC+1` and is not an ALU gate

Sampling the netlist before its unit-delay depth finishes returns the wrong integer. A stuck-at on the sum’s least bit changes the sum. Both are tested. This netlist is not the float32 gadget net in `src/forge/engine.js`. The gadget net is still checked against the int32 VM on its own. The gate view is a second, Boolean, model of the same opcode.

## Voltage is a simulation

The banner in the zoom panel is the claim:

> Simulated circuit. Square-law Shichman–Hodges (SPICE level-1), matched CMOS, long-channel, no leakage. Not a foundry deck, and not the voltage of the CPU or GPU running this page.

Parameters, all of them knobs on that model: `VDD` (default 1.0 V), `Vth0` (0.25 V at 300 K), temperature with `dVth = −1 mV/K` and mobility scaled by `(T/T0)^−1.5`, and a load used only for the `Cload·VDD/Idsat` full-swing delay estimate. That delay is not a 50% measurement and not silicon.

Logic thresholds used everywhere in this view: a valid high is at least 70% of `VDD`, a valid low is at most 30%. At the nominal point the inverter and the NAND2 truth table meet those levels, the matched inverter switches near `VDD/2`, and both noise margins are positive. When `VDD` is at or below `Vth`, a rail input leaves both devices off in this model (no leakage), and the report says the output is not a valid logic level. That is the documented failure. It is not an undervolt of the user’s GPU.

Sakurai and Newton’s alpha-power law is the short-channel model this file does **not** implement. Level-1 square law overstates current as the channel shortens. The panel says so by naming the model.

## Faults that are real, and faults that are not

Two different things share the word “fault”:

1. **Simulated.** Gate stuck-at, a short unit-delay sample, a lower `VDD`, threshold, temperature, or input noise. These change the Boolean or analog model only.
2. **Measured.** If the simulated inverter is outside a valid logic level, or the noise draw produced an invalid rail output, the button **Inject one real bit flip** flips bit 23 (least-significant exponent bit) of one `resid_post` element at the selected layer and reruns `Engine`. The panel states the site, layer, index, and bit. Weights are not modified. The KL against the clean logits and the greedy-token comparison are from those two forwards.

Pre-registered study `DW-FAULT-1` (`src/walk/fault.js`, measurement in `src/walk/data/dw-fault-1.json`):

- Model: TinyStories-8M, clean weights, prompt `Once upon a time` (token ids from the repo tokenizer).
- Site: `resid_post`, layer 3, last prompt token.
- Twelve paired trials. Trial `i` draws a Bernoulli(`p = 0.05`) mask over the 256 channels with `mulberry32(1729 + i + 1)`. The same indices are flipped at bit 23 and, separately, at bit 0.
- Metric: mean KL(clean ‖ faulty) in nats, and the fraction of trials whose greedy token changes.
- Scored prediction, frozen with the spec hash: mean KL for bit 23 is greater than mean KL for bit 0.

Measured on this tree (the test re-runs the study and requires the same numbers):

| bit | mean KL (nats) | greedy-token change rate |
|---|---|---|
| 23 (exponent LSB) | 0.028322474748366442 | 0 |
| 0 (mantissa LSB) | 3.892656443094806e-9 | 0 |

The KL prediction holds. The greedy token stayed id 11 (`,`) on every trial, so the hypothesis clause about token changes is not a demonstrated difference: both rates are zero. That is the result, not a failure of the runner. `spec_sha256` of the frozen spec is `286cfe8e0117d8e51ccf6537af52edd01b0d12b1e5299e7d86203f098fae0163`.

## Citations

- Brendan Bycroft. LLM Visualization. https://bbycroft.net/llm — inspiration for stepping through a model as arithmetic, as above.
- Sanghyun Hong, Pietro Frigo, Yiğitcan Kaya, Cristiano Giuffrida, Tudor Dumitraș. Terminal Brain Damage: Exposing the Graceless Degradation in Deep Neural Networks Under Hardware Fault Attacks. USENIX Security 2019. https://www.usenix.org/conference/usenixsecurity19/presentation/hong — exponent flips are far more damaging than mantissa flips. The study asks that question of this model and this prompt.
- Adnan Siraj Rakin, Zhezhi He, Deliang Fan. Bit-Flip Attack: Crushing Neural Network with Progressive Bit Search. ICCV 2019. https://arxiv.org/abs/1903.12269 — a few weight bit flips can collapse accuracy. This study flips activations, not weights.
- Guanpeng Li, Siva Kumar Sastry Hari, Michael Sullivan, Timothy Tsai, Karthik Pattabiraman, Joel Emer, Stephen W. Keckler. Understanding Error Propagation in Deep Learning Neural Network (DNN) Accelerators and Applications. SC 2017. https://doi.org/10.1145/3126908.3126964
- Jingwen Leng, Yazhou Zu, Minsoo Rhu, Meeta S. Gupta, Vijay Janapa Reddi. GPUVolt: Modeling and Characterizing Voltage Noise in GPU Architectures. ISLPED 2014. https://doi.org/10.1145/2627369.2627605 — supply noise on a real GPU. Not what the voltage panel computes.
- H. Shichman, D. A. Hodges. Modeling and simulation of insulated-gate field-effect transistor switching circuits. IEEE JSSC 1968. https://doi.org/10.1109/JSSC.1968.1049902 — the square-law device equation used here.
- Takayasu Sakurai, A. Richard Newton. Alpha-power law MOSFET model and its applications to CMOS inverter delay and other formulas. IEEE JSSC 1990. The short-channel model this simulator does not use.

## Code map

| Path | Role |
|---|---|
| `src/walk/record.js` | Copy one engine forward into a session and a sampled view |
| `src/walk/explain.js` | Recompute one cell |
| `src/walk/gates.js`, `forgealu.js` | Netlist, Forge ALU, significand multiply |
| `src/walk/cmos.js` | Level-1 CMOS inverter and NAND2 |
| `src/walk/fault.js` | Real activation faults and `DW-FAULT-1` |
| `src/walk/archwalk.js` | Arch residuals and logits, when a model is registered |
| `src/engine.js` | Optional `detail` copies. No change to the arithmetic when `detail` is absent. Prefix-KV reuse stays off for a detailed call |
| `src/engine-worker.js` | `walk`, `walkCell`, `walkStudy`, `walkForge`, `walkVoltage` |
| `ui/src/panels/Walk.tsx`, `ui/src/three/walk.ts` | Workspace and instanced blocks |
| `test/walk.test.mjs` | Logits, cells, gates, CMOS, Forge ALU, and the stored study |

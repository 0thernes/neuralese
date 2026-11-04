# Weight-Machine

Weight-Machine is a small computer whose parts are weight gadgets. The host wires the parts together and steps them one cycle at a time. An int32 reference machine, in `src/machine/ref.js`, is the ground truth. The float32 gadget machine in `src/machine/weight.js` is checked against it. This is the same arrangement as Forge: exact means the traces match, not that a program was the right answer to a question.

It is not a release. The version in `package.json` stays 17.2.0. Nothing here is tagged.

## What is claimed

On `test/machine.test.mjs`, and on the one timing run recorded below:

- Every clean demo matches the reference on registers, RAM, SSD words, the framebuffer, the console, the PC, halt, and the IRQ count. The packet log matches too. Precision faults are zero.
- Randomized CPU, RAM, SSD, GPU, TPU, bus-grant, and MLP trials match. The MLP also matches `matvec` from `src/engine.js` on the same integers.
- A RAM bit flip, a dropped console packet, and a stuck TPU accumulator bit each make the weight machine disagree with the clean reference, in the component that was hit.
- An SSD page written by the weight machine, saved, and loaded into a new machine reads back the same word after a reboot.
- NestLang `7 + 13` halts at 20, and the Forge demo `22 × 35` halts at 770, the same results as the Forge int32 VM. Memory operations take bus cycles, so the Forge trace is not cycle-identical.
- The voltage panel is the Deep Walk square-law CMOS model. It is simulated. It is not a measurement of the CPU or GPU running the page.
- bf16 was not run. A softmax is not used.

## Gadgets

A gadget is a fixed network. The weights are chosen, not trained.

| piece | what it is |
|---|---|
| AND | `relu(1·x0 + 1·x1 − 1)`. Two weights and a bias. |
| NOT | the linear map `1 − x` |
| add, XOR, OR | the Forge bit gadgets in `src/forge/bits.js` |
| RAM read | hard attention. The address one-hot is the score vector. The bit rows are V. This is the zero-temperature limit of attention on a one-hot match, computed with AND gates. |
| RAM write | a delta rule with step size 1 on the selected row: `v ← v + α(data − v)`, `α` in `{0,1}` |
| SSD | the same attention and delta rule, indexed by a 5-bit page and a word slot |
| int8 multiply | an array of AND partial products, then the usual sign correction, sign-extended to 32 bits |
| MAC | that multiply, added into a 32-bit accumulator |
| grant | a round-robin scan of AND/OR gates over the master request bits |
| route | a one-hot that delivers a payload to one port |

float32 holds these 0/1 integers exactly. They sit far below `2^24`. If a bit leaves `{0,1}`, the step records a precision fault and the comparison fails. float64 is a cross-check on hello, not a second claim. The TinyStories residual is not the carrier.

The host is allowed to sequence cycles, move a packet from a gadget output to the next gadget input, and decode a one-hot back to an integer for the packet list. It does not replace a multiply or a memory read with a hidden integer operation on the weight path.

## The board

WM-ISA/1 is ForgeISA/1 plus opcode 15, `SYS`.

| funct | instruction | effect |
|---|---|---|
| 0 | `OUT rs1` | low 8 bits of `rs1` go to the console |
| 1 | `DLD rd, dev` | device status into `rd` |
| 2 | `SSD rs1, rs2, write` | page `rs1`, RAM base `rs2`. The CPU does not wait. |
| 3 | `GPU shader, rs1, rs2, dest` | shader 1 fills the framebuffer. Shader 0 adds 16 lanes. The CPU waits. |
| 4 | `TPU rs1, rs2, imm` | 8×8 matmul. A at `rs1`, B at `rs2`, C at `imm`. The CPU waits. |
| 5 | `EI imm` | bit 0 enables the one IRQ line |
| 6 | `IRET` | return to `epc` |

`r0` is hardwired to 0. RAM is 256 words of 32 bits. The SSD is larger and slower: 32 pages of 16 words, 512 words. The framebuffer is 32×32 bytes. The GPU has 16 lanes. The TPU is an 8×8 output-stationary array. A cell `(r, c)` at time `t` multiplies `A[r][t−r−c]` by `B[t−r−c][c]` when that index is in range. The array runs for `3·8 − 2 = 22` cycles. int8 products of an 8-term dot product fit in the float32 mantissa, which is why the MLP comparison with `matvec` can be exact. The host MLP in TinyStories is GELU. That activation was not compared. The TPU layer is integer ReLU, `max(y, 0)`.

The serial bus grants one master per cycle, round-robin across CPU, TPU, GPU, and SSD, and delivers two cycles later (`BUS_LAT = 2`). The TPU's load of A and B, and the GPU's lane reads, are wide ports into the RAM gadget: one logged transfer, not 128 serial beats. The log marks those `port: "wide"`. Serial packets are `port: "bus"`.

A two-stage pipeline is optional. The first cycle is a fetch bubble. A taken branch or a stalling instruction flushes the prefetch, so the next instruction fetches again. Straight-line ALU code costs one extra cycle. Final state still matches the reference.

The IRQ line rises when an SSD transfer finishes. If interrupts are enabled and the CPU is not already in the handler, the next execute cycle saves the PC in `epc` and jumps to word 200. The irq demo does that and halts at 7.

## Programs

| id | what it does | result on the timing run |
|---|---|---|
| `hello` | writes `hello world\n` | console matches, 49 cycles |
| `memtest` | stores `3·i+1` in 32 words and reads them back | halt 1, 613 cycles |
| `gpu-pattern` | 16 lanes paint a checker from the low bit of `x xor y` | framebuffer matches, 132 cycles |
| `gpu-vec` | 16-wide add of two RAM regions | each lane matches `a+b` |
| `tpu` | identity times identity | halt 1, which is `C[0,0]`, 32 cycles |
| `storage-write` / `storage-read` | store 4242, save the bit bank, new machine, read it back | halt 4242 both times |
| `multi` | `7+6`, store the 13, copy the page, print `M` | halt 13, packets visit RAM, SSD, and the console |
| `irq` | SSD write, enable IRQ, spin, handler sets 7 | halt 7, one interrupt |

The SSD file is `neuralese-wm-ssd-v1`. `bits` is the float32 page bank, four bits per hex digit, low bit first. `words` is the int32 image. Load fails if the bits do not decode to the words. Reboot clears the CPU and RAM. The page bank is what survives.

## Faults

Faults are applied only on the weight machine. The reference stays clean.

| fault | what changes | what the test sees |
|---|---|---|
| RAM bit rot | one bit of one word flips at a chosen cycle | the RAM field disagrees, then the load returns the bad word. Bits stay in `{0,1}`, so this is not a precision fault. |
| packet drop | a bus packet to a chosen device is retired without its write | hello's console loses bytes. The CPU does not spin; the packet is marked `drop`. |
| TPU stuck-at | one accumulator bit of one MAC cell is forced to 0 or 1 | identity's `C[0,0]` becomes 0 instead of 1 |

## Timing

One Node run of `measure({ seed: 11, cpu: 24, ram: 40, ssd: 20, gpu: 8, tpu: 4, bus: 64, mlp: 2 })` on this machine. The test locks the exact counts, not the milliseconds. Ratios against a reference under a millisecond move around from run to run. They are here so the cost is visible, in the same spirit as the Forge MDCC contrast.

Component clocks do not include building the ROM bank. Program clocks do not either: both machines are constructed, then stepped.

| component | exact | weight | reference | weight / reference |
|---|---|---|---|---|
| CPU, 24 short ALU programs, 96 cycles | 24/24 | 6.03 ms | 0.87 ms | 7.0× |
| RAM, 40 attention write+read | 40/40 | 1.75 ms | 0.006 ms | about 300× |
| SSD, 20 paged write+read | 20/20 | 2.85 ms | 0.006 ms | about 500× |
| GPU, 8 vecadds, 64 cycles | 8/8 | 11.0 ms | 0.50 ms | 22× |
| TPU, 4 random int8 matmuls, 88 cycles | 4/4 | 12.1 ms | 0.31 ms | 39× |
| Bus grant and route, 64 masks | 64/64 | 0.30 ms | 0.039 ms | 7.6× |
| MLP, 2 layers, also `engine.matvec` | 2/2 | 5.58 ms for the gadget, the integer matmul, and `matvec` together | | |

| program | cycles (both) | weight | reference | weight / reference |
|---|---|---|---|---|
| hello | 49 | 0.72 ms | 0.087 ms | 8.2× |
| memtest | 613 | 13.8 ms | 1.28 ms | 11× |
| gpu-pattern | 132 | 0.47 ms | 0.20 ms | 2.4× |
| tpu | 32 | 6.31 ms | 0.12 ms | 52× |
| multi | 81 | 1.50 ms | 0.15 ms | 9.7× |
| irq | 43 | 1.38 ms | 0.047 ms | 29× |

The TPU program is the expensive one because each active cell runs the int8 multiply network. The checker shader is a XOR and a mux, so once the ROM is installed it is only a small factor over the reference. RAM and SSD look large because one reference store is a single integer write, and one weight store is a 256-way or 32-way one-hot.

## Machine Room

The v17 shell has a Machine Room workspace, with no Alt digit. The 3D board shows the seven blocks and the packets on the bus. Step, run, and playback use the weight trace. Clicking a block selects it and opens the Deep Walk chain for that block: the gadget weights, then a Boolean gate netlist (`src/walk/gates.js`), then the simulated CMOS inverter and NAND (`src/walk/cmos.js`). The voltage banner is the Deep Walk banner, including the word simulated.

The gate netlist is a real Boolean simulation of a small slice (an adder, a 4-bit multiply, a mux, or an XOR), not a drawing of the whole TPU. The whole TPU is the bit gadget, checked against the integer matmul.

## Ideas that were not copied

Two public ideas suggested the shape of the board. No schematic, save file, texture, or sentence was taken from either.

- Minecraft redstone computers. A computer built by placing primitive components, with the wiring visible. The wiki page that describes that hobby is [Tutorials/Redstone computers](https://minecraft.wiki/w/Tutorials/Redstone_computers). Weight-Machine's components are linear layers, gates, and hard attention, not redstone dust.
- Cisco Packet Tracer. A lab where a packet is something you can watch cross a link. The product page is [Cisco Packet Tracer](https://www.netacad.com/cisco-packet-tracer). The packet list and the moving markers are an original view of this bus. They are not a Packet Tracer topology.

Forge's own inspirations stay in `docs/NEST_CPU.md`. Weight-Machine calls the Forge ALU and the Forge integer VM. It does not call the older nested RISC-V net.

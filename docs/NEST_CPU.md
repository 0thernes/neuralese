# Forge — a Neuralese CPU beside the language model

Forge is an original Neuralese research track in the v17 shell. It is not QwenBend, not Qwenputer, and not a rename of either. No source, weights, or firmware from those projects is in this repository. The public idea is the inspiration: a small model can hand a short program to a weight-constructed machine, and each later token can be one clock of that machine. The implementation, the instruction set, the surface language, and the numbers below are Neuralese's.

The older NESTED tab (`nriscv`) is a different artifact: an RV32I net compiled in the neuralese-nested work. Forge does not call it and does not replace it.

## What is claimed

On the programs in `test/forge.test.mjs` and on the eight frozen arithmetic cells in `src/forge/cells.js`:

- The int32 reference VM is ground truth.
- The shipped weight engine is a float32 bit-gadget net. Its trace matches the VM, and it records zero precision faults.
- The same gadgets in float64 match the VM as well.
- NestLang's checker rejects the known-bad programs (affine, type, termination).
- The MDCC lane, a deterministic proposer plus host `bigint`, is exact on those eight cells.

bf16 was not run. Bit-exact bf16 parity is not claimed. Exact execution of a program is not evidence that the program was the right one for a question.

## Instruction set (ForgeISA/1)

Eight registers. `r0` is hardwired to 0; writes to it are discarded. ROM and RAM are 256 words each. Words are 32-bit two's complement. The PC is a word index in `0..255`. Branch and jump offsets are signed 16-bit word offsets, then the sum is masked to 8 bits.

A word is laid out as:

| bits | field |
|---|---|
| 3:0 | opcode |
| 6:4 | rd |
| 9:7 | rs1 |
| 12:10 | rs2 |
| 15:13 | funct |
| 31:16 | imm16 |

| opcode | funct | mnemonic | effect |
|---|---|---|---|
| 0 | 1 | `HALT rd` | stop and report `x[rd]` |
| 1 | 0 | `ADD rd, rs1, rs2` | |
| 2 | 0 | `SUB` | |
| 3 | 0 | `AND` | |
| 4 | 0 | `OR` | |
| 5 | 0 | `XOR` | |
| 6 | 0 | `ADDI rd, rs1, simm16` | |
| 7 | 0 | `LW rd, simm16(rs1)` | RAM only, address masked to 8 bits |
| 8 | 0 | `SW rs2, simm16(rs1)` | |
| 9 | 0 | `BEQ rs1, rs2, simm16` | PC-relative |
| 10 | 0 | `BNE` | |
| 11 | 0 | `BLT` | signed |
| 12 | 0 | `LUI rd, imm16` | `rd = imm16 << 16` |
| 13 | 0 | `JAL rd, simm16` | link is `pc+1`, then PC-relative |
| 14 | 0 | `SLT rd, rs1, rs2` | 1 if signed `rs1 < rs2` |

An all-zero word is illegal (`funct` 0, opcode 0). The VM and the engine stop with `fail: "illegal"` and do not report a halt. A run that neither halts nor fails inside 4096 steps is `step-limit`.

Signed less-than is a subtract plus an overflow correction: the sign of the difference, flipped when the operand signs differ and the result sign disagrees with `rs1`. That is what makes `min_int < 1` true and `max_int < -1` false.

## Where the state lives

TinyStories-8M has a residual width of 256. Forge does not append an engine subspace onto that vector, and it does not write engine bits into it. A test copies a host residual, runs the engine, and requires the copy to be unchanged.

The engine's own state is three bit banks, float32 on the shipped path (float64 is the cross-check):

- ROM, 256 × 32 bits, loaded once from the program
- RAM, 256 × 32 bits
- 8 registers × 32 bits, plus an 8-bit PC

A 64-wide stamp (`SUBSPACE` in `src/forge/engine.js`) is what a future widened host could read. It is not part of the GPT-Neo forward.

| dims | contents |
|---|---|
| 0–7 | token kind, one-hot (LM, INS, VAL, FAIL, HALT, END, other) |
| 8–23 | opcode, one-hot |
| 24–55 | value bits |
| 56–63 | PC bits |

One clock fetches with a one-hot of the PC, decodes with one-hots of the opcode fields, and computes with binary gadgets: AND is a saturated sum (`relu(a+b-1)`), XOR and OR are integer combinations of that, add is a ripple carry. Every bit is required to stay in `{0, 1}`. float32 can represent those integers exactly; they never approach `2^24`. If a bit leaves `{0, 1}`, the engine records a fault and the trace comparison fails. That is the precision story. It is not a claim about bf16, SwiGLU, or a gated-delta memory inside the host model. Those constructions are what the public demos use. This path does not.

## NestLang/1

The surface language is original. A program is a sequence of lets, assignments, `if`/`else`, `rec`, and `halt`.

```
dup i32 acc = 0
dup i32 y = 35
nat n = 22n
rec n {
  acc = acc + y
}
halt acc
```

- Types are `i32`, `nat`, and `bool`. `22` is i32. `22n` is nat. `true` and `false` are bool.
- Unmarked and `once` names may be read once in the source. `dup` may be read any number of times. This count is syntactic, not a dynamic borrow.
- `rec n` is the only loop. `n` must be nat. The body may not mention `n`. The compiler emits a decrement and a branch, so the binder shrinks by one each iteration and the loop stops at zero. A missing `halt`, a `halt` inside `rec`, or an `if` whose branches disagree about halting is a termination failure.
- `+` and `-` require i32. `<` and `==` produce bool. `halt` accepts i32 or nat.
- Names live in `r1`–`r5`. `r6` and `r7` are temporaries. RAM word 255 is compiler scratch. More than five names is a compile error.

The checker returns `FAIL` and the VM does not run. The known-bad set is in `BAD_PROGRAMS`.

## Clock

Generation in the Forge workspace is two lanes of tokens, split by the delimiter `⟦forge⟧`.

1. Language-model tokens. The demo line is scripted. If the TinyStories weights are loaded, "Sample host, then hand off" draws eight greedy tokens from the real model and then still clocks the program in the editor. TinyStories-8M is not trained to write NestLang. The panel says so. A sample is not a claim that the model chose the program.
2. Engine tokens. Each instruction emits `INS`, four little-endian value bytes, and the run ends with `HALT` or `FAIL` and then `END`.

"Clock one" advances the register and memory view by one instruction. If the model is loaded it also times one real host forward beside that clock, so the cost of "one instruction, one forward" is visible. That forward does not feed the ALU.

The help line in the workspace is the limit: exact is not the same as true, a clocked engine is slow on purpose, and the memory is 256 words.

## MDCC, as a measurement

The same eight cells run two ways.

- **WeightCPU.** NestLang is compiled and clocked. Score is whether the VM result equals the cell, and whether both gadget widths match the VM with no faults.
- **MDCC.** A small parser reads the task string (`sum of 22 copies of 35`, `7 + 13`, `100 - 37`) and proposes an operation and two operands. The host evaluates that plan with `bigint`. The parser is not a language model. The lane measures host arithmetic once a plan exists.

Pre-registered bar, frozen in `CRITERIA` before a run is treated as evidence: MDCC accuracy 1, VM accuracy 1, engine trace match 1, every bad program rejected, bf16 not claimed.

One Node run of `runLanes()` on this tree (timings are this machine, not a benchmark; the test locks the accuracies and that WeightCPU spends more tokens):

| lane | correct | time | tokens | memory |
|---|---|---|---|---|
| WeightCPU | 8/8 | 99 ms | 756 | 256 words |
| MDCC | 8/8 | 0.25 ms | 32 | 0 |

The demo program, 22 copies of 35, halts at 770 after 93 instructions and 467 engine tokens, with no float32 faults. The host-decimal lane answers the same cell in one `bigint` multiply. That gap is the point of the contrast: an in-weight clock shows where the arithmetic happened; host code is the practical way to get the number.

## REPRO

Every workspace run builds a `neuralese-forge-repro` bundle: program, ISA version, NestLang version, seed, VM trace, equality against float32 and float64, the fault list, the precision note, and lane numbers when the contrast has been run. `bundle_sha256` is the SHA-256 of the canonical body. A bundle that marks bf16 as anything other than `not-run` fails verification.

## Inspiration, and what was not taken

Public concept, used as an idea only:

- @rifeash, "Meet QwenBend", https://x.com/rifeash/status/2116978948894773418 — a model writes a program, then type-checks and runs it inside the forward pass, one instruction per token, with no external interpreter. The how-it-works steps posted with that announcement (tokens, then a lexer, then a static check, then evaluation) are the shape Forge's clock copies at the product level.
- The QwenBend model card, https://huggingface.co/voidash/qwenbend — separate engine weights set by construction, static rules, and the explicit limit that a correct trace does not mean the program matched the question.
- The concept note attached for this work (`HOW_IT_WORKS`): one sequence, a delimiter, engine tokens that are instructions and value bytes, an isolated residual for the engine, and the sentence "exact ≠ true".

@CostaMio's MDCC argument, as given for this track: welding a virtual CPU into the weights is evidence that small models plus deterministic arithmetic can beat a giant scratchpad, and the practical next step is "model decides, code computes" — the host does the decimal arithmetic. A stable URL for that post was not resolved while writing this page, so the citation is the argument itself. The contrast lane is that argument, measured, not a reply to the person.

Nothing here was copied from those repositories. ForgeISA is not their ISA. NestLang is not Bend. The gadgets are a float32 ripple-carry and one-hot decode written for this file, checked against an integer VM, with the precision limit stated above.

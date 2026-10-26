# Tsotchke × NEURALESE — what was studied, what is used, what is not

NEURALESE v8 adds a **TSOTCHKE** tab group (keyboard **8**) built on open-source work by Tsotchke
([github.com/tsotchke](https://github.com/tsotchke), [@tsotchke on X](https://x.com/tsotchke), [eshkol.ai](https://eshkol.ai)).
This page records what each project is, what we checked, and what we took. The rule throughout: a component is labelled
**⚛ Powered by Tsotchke** only if it runs Tsotchke code (compiled or vendored) or a faithful, attributed port of it, and
every claim about it has a test that can fail ([CLAIMS.md](CLAIMS.md)).

Research date: 2026-10-25. All four projects are MIT-licensed; their LICENSE files ship with the site
(`site/tsotchke/LICENSE-*`, `site/vendor/moonlab/LICENSE`).

## Summary

| project | language | version · commit inspected | license | used in NEURALESE | how |
|---|---|---|---|---|---|
| [Eshkol](https://github.com/tsotchke/eshkol) | C++ / LLVM (Scheme-family language) | 1.3.6 (CMakeLists) · [`341ac81`](https://github.com/tsotchke/eshkol/tree/341ac812ed600fd9d27c28e9509d66ab71363947) | MIT | **yes** — TAYLOR tab | JS port of `lib/core/taylor_recurrences.def` |
| [Moonlab](https://github.com/tsotchke/moonlab) | C (+ TS bindings, WASM) | 1.2.1 · [`cd3b234`](https://github.com/tsotchke/moonlab/tree/cd3b2347e3739327548708073d7e4ac710cc6a6c); npm `@tsotchkecorp/moonlab@1.2.1` | MIT | **yes** — Q-GEOMETRY, CLAIMS | upstream WASM vendored (one documented 4-line patch to a JS chunk, see `site/vendor/moonlab/PATCHES.md`) |
| [QGTL — quantum_geometric_tensor](https://github.com/tsotchke/quantum_geometric_tensor) | C | 0.777 Beta · [`770994a`](https://github.com/tsotchke/quantum_geometric_tensor/tree/770994aa8ddd858e6bb16eebb25250a7b9f67c96) | MIT | **yes (the definition)** — Q-GEOMETRY | QGT / Fubini–Study metric applied to ψ = √p |
| [quantum_rng](https://github.com/tsotchke/quantum_rng) | C | 1.1.0 (`qrng_version`) · [`1a77e77`](https://github.com/tsotchke/quantum_rng/tree/1a77e77f803c63883349b658361c06401cd8ceb7) | MIT | **yes** — QRNG tab, `qseed` | compiled by us to WASM (`wasm/build-qrng.sh`, bit-reproducible) |

## Eshkol

**What it is (verified from the repo).** A compiled Scheme-family language (C++/LLVM back end, REPL with JIT, bytecode VM)
whose headline feature is built-in automatic differentiation. The AD guide
[`docs/guide/AUTOMATIC_DIFFERENTIATION.md`](https://github.com/tsotchke/eshkol/blob/341ac812ed600fd9d27c28e9509d66ab71363947/docs/guide/AUTOMATIC_DIFFERENTIATION.md)
documents forward, reverse and Taylor-mode AD. The Taylor-tower design note
[`docs/design/AD_TAYLOR_TOWER.md`](https://github.com/tsotchke/eshkol/blob/341ac812ed600fd9d27c28e9509d66ab71363947/docs/design/AD_TAYLOR_TOWER.md)
is marked "proposal + Phase-0 POC"; the recurrences themselves are in
[`lib/core/taylor_recurrences.def`](https://github.com/tsotchke/eshkol/blob/341ac812ed600fd9d27c28e9509d66ab71363947/lib/core/taylor_recurrences.def).

**Author's public statements (X).** "programming language for high performance differential computing and AI based on
Scheme" ([post](https://x.com/tsotchke/status/2105493632300253390)); "fully differentiable … Prolog-like logic engine …
AOT … JIT … bytecode VM" ([post](https://x.com/tsotchke/status/2105498951873163399)); "full exact Taylor AD tower"
([post](https://x.com/tsotchke/status/2113635270159429726)); install via Homebrew ([post](https://x.com/tsotchke/status/2104425532754477163)).
Performance claims ([post](https://x.com/tsotchke/status/2112197451545215016)) were **not** benchmarked by us.

**HoTT and type theory — correction (v9).** v8 said the only HoTT reference was `docs/FAQ.md:89`. That was wrong. The
Eshkol [README](https://github.com/tsotchke/eshkol/blob/341ac812ed600fd9d27c28e9509d66ab71363947/README.md) says "Built on Homotopy Type Theory foundations" (line 9) and lists a "HoTT type checker"
(line 226), and HoTT also appears in `docs/README.md`, `docs/platform/*` and `docs/TEST_COVERAGE.md`. The same README
(line 65) states that "no proof obligation is currently discharged by the compiler" and that `areEquivalent` is
identity-only. So HoTT is a design foundation, not a discharged proof system. The type layer itself is real C++ code. Eshkol ships a real HoTT-flavoured type system in C++:
- [`docs/breakdown/TYPE_SYSTEM.md`](https://github.com/tsotchke/eshkol/blob/341ac812ed600fd9d27c28e9509d66ab71363947/docs/breakdown/TYPE_SYSTEM.md): universe hierarchy U0 ⊂ U1 ⊂ U2 ⊂ UΩ, Π and Σ types, path types, subtyping, numeric promotion.
- [`inc/eshkol/types/hott_types.h`](https://github.com/tsotchke/eshkol/blob/341ac812ed600fd9d27c28e9509d66ab71363947/inc/eshkol/types/hott_types.h), [`lib/types/hott_types.cpp`](https://github.com/tsotchke/eshkol/blob/341ac812ed600fd9d27c28e9509d66ab71363947/lib/types/hott_types.cpp): `TypeEnvironment` (universe levels, `isSubtype`, `promoteForArithmetic`).
- [`lib/types/dependent.cpp`](https://github.com/tsotchke/eshkol/blob/341ac812ed600fd9d27c28e9509d66ab71363947/lib/types/dependent.cpp): `CTValue` (compile-time naturals with `mul`, i.e. type-level arithmetic) and `DimensionChecker` (`checkMatMulDimensions`, `checkDimensionsEqual`, `checkBounds`).
- Homotopy-theory example programs: [`examples/mathematics_homotopy_colimits_grothendieck.esk`](https://github.com/tsotchke/eshkol/blob/341ac812ed600fd9d27c28e9509d66ab71363947/examples/mathematics_homotopy_colimits_grothendieck.esk), [`examples/mathematics_kan_complexes_horns.esk`](https://github.com/tsotchke/eshkol/blob/341ac812ed600fd9d27c28e9509d66ab71363947/examples/mathematics_kan_complexes_horns.esk).

Honest scope, from Eshkol's own docs: the checker is *gradual* (it warns rather than rejects at compile time), and
`FEATURE_MATRIX.md` (≈ line 845) plans to retire the "HoTT-inspired" label in favour of a Lean export. It does not
implement univalence or higher inductive types. So we use it for what it is: a dependent-dimension and universe/subtype
checker.

**What we now run (v9).** We compiled `dependent.cpp`, `hott_types.cpp` and `type_relation.cpp` to WebAssembly
(`wasm/build-eshkol-types.sh`, `wasm/eshkol_types_shim.c++`; sha256 `555920a7…26a7`). `site/tsotchke/types.js` asks
Eshkol to decide 73 judgments about the live model: every weight's flat length equals rows·cols (a path/identity judgment
`Id_Nat(rows·cols, len)` computed by `CTValue::mul`), every matmul in the graph (q/k/v/o, fc, proj, unembedding) is
dimension-compatible, H·hd = d, residual adds match, prompt tokens are < V, `Float32 <: Real`, and the accumulator
promotes to Float64. Every verdict string comes from Eshkol (e.g. "Dimension mismatch: 262144 != 262143"). Mutation
tests show the same checker rejects a truncated `h3.fc`, a miswired MLP width, an out-of-vocabulary token and a
non-Float32 tensor (test H4, live C6b).

**Tensor logic.** A GitHub code search for "tensor logic" under `user:tsotchke` returns nothing (eshkol, moonlab, QGTL; `tensorcore` is Apple-Silicon GEMM kernels). The "Prolog-like logic engine" appears only in an X post. The nearest artifact is
Eshkol's neurosymbolic library ([`lib/core/ml/neurosymbolic.esk`](https://github.com/tsotchke/eshkol/blob/341ac812ed600fd9d27c28e9509d66ab71363947/lib/core/ml/neurosymbolic.esk),
[`docs/reference/stdlib/ml_neurosymbolic.md`](https://github.com/tsotchke/eshkol/blob/341ac812ed600fd9d27c28e9509d66ab71363947/docs/reference/stdlib/ml_neurosymbolic.md)): `soft-unify` = σ(⟨e_a, e_b⟩/√dim),
`kb-attention`, `kb-retrieve`. We have not integrated it; we make no tensor-logic claim.

**Edit-stack path laws.** The CLAIMS tab still includes property tests on the edit stack (edit;undo = identity, disjoint
edits commute, overlapping non-linear edits do not). These are ordinary bitwise tests, not type-theoretic proofs.

**What we use.** `site/tsotchke/taylor.js` ports the recurrences for exp, log, sin/cos, tan, constant power, sqrt,
sinh/cosh/tanh, sigmoid, atan, asin, the Cauchy product and the quotient. We use it to compute the exact Taylor jet
(g, g′, g″, g‴, …) of the model's mean cross-entropy along a final-LayerNorm weight direction.

**Not used, and why.** The compiler cannot run in a static page. Eshkol's web REPL (`web/eshkol-repl.js`) sends code to a
remote compile server, and shipping LLVM is out of scope. We did not run Eshkol programs.

**Evidence.** The port matches closed forms and identities to ≤ 5.3e-15 (C1a). A deliberately broken recurrence is rejected
(C1b). Jet derivatives match PyTorch float64 autograd to ~1e-6 relative, and g′ matches our own reverse-mode `grad.js` (C1c).

## Moonlab

**What it is (verified).** A C quantum-circuit simulator (state vector, plus tensor-network/MPS, DMRG and other modules) with
TypeScript bindings and a prebuilt Emscripten WASM published as `@tsotchkecorp/moonlab` 1.2.1 (`moonlab.wasm` 1.48 MB).
Announced on X ([post](https://x.com/tsotchke/status/2105710103672267147); see also
[this post](https://x.com/tsotchke/status/2107865001868534082)).

**Verified by us in Node and Chrome.** The Bell state has probabilities [½, 0, 0, ½]. `chshTest` gives S ≈ 2.83 ± 0.014.
`QuantumState.fidelity` on 16-qubit states equals our direct sum to < 1e-12 (often exactly). `qwzChern` returns the
Qi–Wu–Zhang Chern numbers ±1 / 0, equal in magnitude to an independent Fukui–Hatsugai–Suzuki computation. Moonlab's
orientation convention gives the **opposite sign**; we record this as a convention difference, not an error.

**What we use.** Fidelity between √p-embedded next-token distributions (Q-GEOMETRY tab: Fubini–Study angle between clean and
edited model, per position), CHSH and QWZ Chern numbers as live self-checks.

**Patch.** The npm ESM chunk statically imports Node built-ins (`net`, `tls`, `fs`, `crypto`), which are used only by its
network control-plane client. We replaced those four imports with `null` constants so the module loads in a browser. The
WASM and the Emscripten glue are byte-identical to the tarball. See `site/vendor/moonlab/PATCHES.md`, which includes the
upstream SHA-256 and the diff.

**Not used.** DMRG/MPS, VQE/QAOA, the control plane. Nothing in an 8M-parameter transformer maps onto them honestly.

## QGTL (quantum_geometric_tensor)

**What it is (verified).** A C library around the quantum geometric tensor. Its README defines
Q_μν = ⟨∂μψ|∂νψ⟩ − ⟨∂μψ|ψ⟩⟨ψ|∂νψ⟩, whose real part is the Fubini–Study metric and whose imaginary part is, in our convention (the README does not state the factor), −½ times the Berry
curvature. The implementation is in `src/quantum_geometric/core/quantum_geometric_metric.c`
(`geometric_compute_fubini_study_element`). Version string 0.777 Beta.

**Unverified.** The README describes IBM/Rigetti/D-Wave hardware back ends and large performance figures. We did not test
these, and we do not repeat them as facts.

**What we use.** The definition, applied to ψ = √p for the model's softmax output p(θ). For real ψ the Berry curvature
vanishes and Re Q = ¼ Fisher information (standard; Amari & Nagaoka 2000, Bengtsson & Życzkowski 2006). This gives
falsifiable predictions, which we test:
- Fubini–Study distance measured with Moonlab, s(ε)/ε, converges to √Fisher/2 (C2b).
- Mean Fisher along a direction = g″(0) from the Eshkol-port jet = PyTorch autograd (C2c). These are three independent routes.

**The C library itself (v9: compiled and used).** Correction: v8 said we did not compile QGTL. We now compile its
geometric-measure core to WebAssembly (`wasm/build-qgtl.sh`: [`qgt_context.c`](https://github.com/tsotchke/quantum_geometric_tensor/blob/770994aa8ddd858e6bb16eebb25250a7b9f67c96/src/quantum_geometric/core/qgt_context.c),
`quantum_geometric_operations.c`, `memory_pool.c`, `quantum_geometric_hardware.c`, `quantum_geometric_error.c`,
`quantum_geometric_logging.c`; 29.7 KB, sha256 `2c56f678…371d`). One link fix was needed: core calls
`cleanup_memory_pool(MemoryPool*)` but never defines it (only `ai/quantum_llm_core.c` defines a same-named function for
another type), so `wasm/qgtl_stubs.c` forwards it to core's own `destroy_memory_pool`.
- **Used live:** `qgt_geometric_measure_fidelity` (|⟨ψ|φ⟩|²). In the Q-GEOMETRY tab every position is measured by both
  Moonlab and QGTL. They agree to ≈1e-7 (QGTL stores amplitudes as single-precision `ComplexFloat`). Tests H5, H6, live C2f.
- **Tested and documented as a limitation:** `qgt_geometric_compute_metric` returns only diag(1 − |ψ_i|²), which is not the
  Fubini–Study metric of the state (the file calls these "simple implementations"). Test H7 / live C2g pins this behaviour.
- **Tried and not used:** the tensor-network QGT (`compute_quantum_geometric_tensor` in
  [`quantum_geometric_tensor_network.c`](https://github.com/tsotchke/quantum_geometric_tensor/blob/770994aa8ddd858e6bb16eebb25250a7b9f67c96/src/quantum_geometric/core/quantum_geometric_tensor_network.c)). We compiled
  82 core files (11 GPU/OS-specific ones did not build under emcc). For a 1-qubit RY(0.7)·RZ(0.3) circuit the gate matrices
  were correct, but `get_quantum_state` returned an all-zero state and `compute_shifted_states` failed with "Invalid tensor
  network state", followed by an out-of-bounds trap. Reproducer: `wasm/qgtl_qgt_repro.c`. We did not rule out that a native
  build behaves differently (a native link needs LAPACK and more modules). Also noted: upstream
  `tests/test_quantum_geometric_minimal.c` compares a `bool` return against `NUMERICAL_SUCCESS`.

## quantum_rng

**What it is (verified).** A C library that *simulates* quantum measurement on a state vector, with a CHSH Bell test and
NIST SP 800-90B Repetition-Count / Adaptive-Proportion health tests. In seeded mode the output is a pure function of the seed.

**An honest correction to the upstream README.** The README presents S ≈ 2.83 as something "a classical process cannot
produce". The simulator *is* a classical process, so its S > 2 shows that the simulator implements quantum mechanics
correctly. It does not show that the bits are quantum. NEURALESE labels it accordingly: the only real entropy is the
16-byte seed from `crypto.getRandomValues`.

**What we use.** A WASM build (`wasm/qrng_shim.c` + `wasm/build-qrng.sh`, emscripten 4.0.23, `-O2`; rebuilding gives the
identical SHA-256 `a82a9b44…`). It provides research seeds with provenance: generator commit, entropy source, seed hex
(replayable), health-test result and our SP 800-22 subset p-values. `qseed apply` writes the seed into the decoding seed,
and from there into the REPRO manifest.

**Finding: cross-platform determinism.** The same seed gives identical bytes in Node and in Chrome (both WASM; golden prefix
`52d659a0`, C3a and the smoke test). A native glibc build gives *different* bytes (`e5f60b0d…`) because `sin`/`cos` from
musl (compiled into the WASM) and glibc differ in the last bits. Seeded output is therefore reproducible per libm, not
across them. Pin the WASM if you need replay.

**Not done.** No hardware entropy and no claim of quantum randomness. Our SP 800-22 subset covers four tests (monobit,
block frequency, runs, cumulative sums) and is not the full suite.

## Searches (v9)
- **Websites:** the live site is [tsotchke.org](https://tsotchke.org/technology/); [QGTL page](https://tsotchke.org/technology/qgtl.html)
  describes it as the stack's foundation. Its performance figures (e.g. "10–1000× parameter efficiency") are marketing and unverified by us.
  tsotchke.net is reachable and shows only "TSOTCHKE CORPORATION".
- **X:** @tsotchke is protected for our account and `from:tsotchke` returns no results, so the v8 post links are the only
  first-party posts we cite. Third-party posts mention Eshkol's knowledge base / global workspace and "Grothendieckian resonant
  HoTT" ([LGr8tz](https://x.com/LGr8tz/status/2114527879853998110)) and Moonlab/QGTL ([0thernes_ai](https://x.com/0thernes_ai/status/2112965027603071230)).
- **Papers:** web searches for Tsotchke on arXiv, Zenodo and ResearchGate found no paper. QGTL's README asks to be cited as
  software (`@software{QGTL2026}`). The ResearchGate QGT paper that comes up ("When Less is More", Shokry, Santini, Vicentini 2025) is by other authors.
- **Repos relevant to the next step, not integrated:** [libirrep](https://github.com/tsotchke/libirrep) (SO(3)/SU(2)/O(3)/SE(3)
  representations for equivariant networks; an 8M-parameter text model has no rotation symmetry to test honestly),
  [rosette-wire](https://github.com/tsotchke/rosette-wire) (verifiable replay across Eshkol and Moonlab).

## Moonlab's native QGT (not yet used)
Moonlab has its own Provost–Vallée QGT and Berry curvature in C (`src/algorithms/quantum_geometry/qgt.{h,c}`). 1.2.1 exposes
VQE Berry curvature and natural gradient (ABI 0.7.0). NEURALESE uses Moonlab's state fidelity only. Mirrors:
github.com/t-sotchke, org github.com/Tsotchke-Corporation (not inspected in depth).

## Other repositories seen (not integrated)

libirrep, rosette-wire, spin_based_neural_network, classical_rng, tensorcore and others in
[github.com/tsotchke](https://github.com/tsotchke?tab=repositories). We did not integrate them: either they had no
browser-usable artifact, or we found no honest mapping onto a language-model lab in the time available. The website
`tsotchke.net` did not respond on 2026-10-25.

## Reproduce

```
npm test                              # includes test/tsotchke.test.mjs (15 claims, PyTorch cross-checks, mutation tests)
.venv/bin/python ref_taylor.py        # regenerates test/ref_taylor.json (torch 2.14.1, float64)
wasm/build-qrng.sh                    # rebuilds the quantum_rng WASM (emscripten 4.0.23)
node smoke-v8.mjs http://localhost:8765/   # headless Chrome: claims, CSP, WASM loading, golden bytes
```


## Binary storage and integrity

The repository is deployed through a text-only channel, so both WebAssembly binaries are committed as base64 text: `site/tsotchke/qrng.wasm.b64` and `site/vendor/moonlab/dist/moonlab.wasm.b64`. `site/tsotchke/wasmb64.js` decodes them and checks SHA-256 before instantiation. If the hash does not match, loading throws:

- qrng.wasm: `a82a9b44efcdb5d0177c0eb6bc63b76910fefdc97482ce014d846dcd19fba86e` (reproducible with `wasm/build-qrng.sh`)
- moonlab.wasm: `fef4f0192641af2299b097bb1ccb535cd76f2d5d10f731c5723fe6e3f71229c1`. This is the byte-identical binary shipped in npm `@tsotchkecorp/moonlab@1.2.1` (the name of `bindings/javascript/packages/core/package.json` in the repo; the workspace root there is `moonlab-javascript`). Check it with `base64 -d moonlab.wasm.b64 | sha256sum`.

Test C3z checks that both pins hold and that a changed pin gets rejected. The browser hands the verified bytes to the unmodified Emscripten glue through `wasmBinary`. In Node, the test materialises `dist/moonlab.wasm` from the verified base64 first.

# Claims & Evidence (v8)

Each claim names the check that would **refute** it. Every row is executed by `test/tsotchke.test.mjs` (Node), and rows
marked ● also run live in the browser (TSOTCHKE › CLAIMS, or `claims` in the terminal). Numbers are from the run on
2026-10-25 (America/Los_Angeles).

| id | claim | refuted if | evidence |
|---|---|---|---|
| C1a ● | The JS port of Eshkol's `taylor_recurrences.def` is correct to order 8 | any closed-form / identity error ≥ 1e-12 | max error 5.3e-15 (12 functions, 8 identities) |
| C1b | C1a can fail | a broken exp recurrence (÷(k+1) instead of ÷k) passes | broken version error > 1e-3 → rejected |
| C1c | The CE Taylor jet along an ln_f direction equals PyTorch float64 autograd | rel. error > 1e-4 (g′, g″), > 1e-3 (g‴) | g′ 1.369704e-3 vs 1.369705e-3; g″ 3.48221e-4 vs 3.482215e-4; g‴ 1.15767e-5 vs 1.15767e-5; `grad.js` g′ agrees to < 1e-4 |
| C2a ● | Moonlab fidelity of √p-states equals the Bhattacharyya coefficient² | \|ΔF\| ≥ 1e-12 | ΔF = 0 to 2e-16 on real model distributions |
| C2b | Fubini–Study metric (QGT real part) of ψ=√p equals Fisher/4 | s(ε)/ε misses √Fisher/2 by > 1e-3 at ε=1e-2, or the error does not shrink with ε | rel. error 1.7e-3 (ε=0.1) → 1.7e-4 (ε=0.01) |
| C2c | Three independent routes agree: mean Fisher = jet g″(0) = PyTorch | rel. difference > 1e-6 (JS↔JS) or > 1e-4 (vs torch) | 3.4822116e-4 / 3.4822116e-4 / 3.4822151e-4 |
| C2d ● | Moonlab's QWZ Chern numbers are correct | mismatch with independent FHS lattice computation (modulo orientation sign) for m ∈ {±0.5, ±1, ±1.5, ±3} | all match; Moonlab orientation = −FHS |
| C2e ● | Moonlab simulates a Bell state correctly | P ≠ [½,0,0,½], S ≤ 2 + 10σ, or \|S − 2√2\| > 4σ | S = 2.84 ± 0.014 (n = 20 000) |
| C3a ● | Seeded quantum_rng WASM is deterministic, and identical in Node and Chrome | bytes differ between runs or runtimes | golden prefix `52d659a0…93fe` for seed "neuralese-v8" in both |
| C3b ● | Upstream SP 800-90B health tests detect failure | generator output fails, or 2000 zero bytes pass | output 0 (pass), zeros −1 (RCT fail) |
| C3c | Output passes our SP 800-22 subset at the NIST proportion | any test fails > 1 of 20 seeds × 1 Mbit at α = 0.01; or a biased stream passes monobit | pass; biased control rejected |
| C3d | quantum_rng's simulated CHSH exceeds 2 | S ≤ 2.6 | S = 2.82 (n = 20 000). **This shows the simulator is correct, not that bits are quantum.** |
| C4 ● | `nist.js` matches the SP 800-22 rev1a worked examples | any p-value off by ≥ 5e-7 | 0.527089, 0.801252, 0.147232, 0.109599, 0.706438, 0.500798, 0.219194: all match |
| C5a ● | edit ; undo ≡ identity | weights hash after undo ≠ before | bitwise equal |
| C5b | Disjoint edits commute; overlapping non-linear ones do not | disjoint pair differs, or noise∘SVD = SVD∘noise | as claimed (the check is capable of failing) |

## Errata and caveats found while testing
- **NIST cumulative-sums 10-bit example.** SP 800-22 rev1a prints P = 0.4116588 for ε = 1011010111. Our code and an
  independent scipy computation both give 0.4115847. We believe the printed value is a rounding erratum. The test uses
  the 100-bit example (0.219194), which matches exactly.
- **Cross-libm determinism.** Native quantum_rng (glibc) and WASM (musl) give different bytes for the same seed. See TSOTCHKE.md.
- **Fubini–Study floor.** With no edits, the measured angle is ~2e-7 rad, not 0. This is the float64 rounding floor of
  arccos near 1, and is expected.
- **Not claimed:** quantum randomness, quantum speed-up, HoTT proofs, tensor-logic semantics, or any capability of the
  Tsotchke projects beyond what is listed above.

#!/usr/bin/env bash
# v10 (f): isolates WHY native quantum_rng@1a77e77 bytes differ from the WASM build for the same seed ("neuralese-v8").
# Two possible causes: (1) libm (glibc vs musl, which emscripten's libc is derived from), (2) the x86 SIMD paths in
# simd_ops.c (WASM is built without SIMD, so it takes the scalar branches). We build a 2×2 grid:
#   {glibc via gcc, musl via musl-gcc} × {SSE3 paths, scalar paths (simd_scalar.c: x86 SIMD macros undefined for simd_ops.c only)}
# and print each one's 64 bytes. Requires gcc and musl-gcc (Debian: musl-tools).
set -euo pipefail; HERE="$(cd "$(dirname "$0")" && pwd)"; SRC="${1:-/tmp/quantum_rng}"; cd "$SRC"; T=$(mktemp -d)
F="src/quantum_rng/quantum_rng.c src/quantum_rng/quantum_state.c src/quantum_rng/quantum_gates.c src/quantum_rng/bell_test.c src/quantum_rng/matrix_math.c src/health/health_tests.c $HERE/../qrng_shim.c $HERE/main.c"
for CC in gcc musl-gcc; do for MODE in sse3 scalar; do
  if [ $MODE = sse3 ]; then $CC -O2 -w -I. -msse3 -c src/quantum_rng/simd_ops.c -o $T/simd.o; else $CC -O2 -w -I. -c $HERE/simd_scalar.c -o $T/simd.o; fi
  $CC -O2 -w -I. $([ $CC = musl-gcc ] && echo -static) $F $T/simd.o -lm -o $T/q
  printf '%-9s %-7s %s\n' "$CC" "$MODE" "$($T/q)"; done; done

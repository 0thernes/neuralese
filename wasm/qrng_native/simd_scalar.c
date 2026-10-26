/* Compiles upstream simd_ops.c with its x86 SIMD branches disabled, so it takes the same scalar code the WASM build
 * takes. System headers are included first (they need the real target macros), then the SIMD macros are undefined. */
#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <complex.h>
#include <stdio.h>
#undef __SSE2__
#undef __SSE3__
#undef __AVX2__
#undef __x86_64__
#include "src/quantum_rng/simd_ops.c"

#!/bin/bash
# Compiles Eshkol's REAL Taylor-recurrence kernels natively and dumps golden coefficients for test/eshkol-taylor.test.mjs.
# The kernels (tr_* in lib/core/runtime_taylor.c) are pure double-array functions; we extract that span verbatim
# (lines located by marker, not edited) plus the op-code enums generated from lib/core/taylor_recurrences.def.
# The arena argument is only touched when n > ESH_TAYLOR_STACKN (64); we use n = 17, so a malloc stub suffices.
# Usage: ESHKOL=/path/to/eshkol ./build.sh   (tsotchke/eshkol@341ac81)
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); E=${ESHKOL:-/tmp/eshkol}; C=$E/lib/core
a=$(grep -n '^static inline double zfma(' $C/runtime_taylor.c | cut -d: -f1); b=$(grep -n '^static void tre_add(' $C/runtime_taylor.c | cut -d: -f1)
{ echo '#include <math.h>'; echo '#include <stdint.h>'; echo '#include <string.h>'; echo '#include <stdlib.h>'; echo 'typedef struct arena arena_t; static void* arena_allocate(arena_t* a, size_t n){(void)a; return malloc(n);}'
  echo "enum {"; echo '#define TAYLOR_BIN(name, opcode, sexpr) ESH_TAYLOR_OP_##name = (opcode),'; echo "#include \"$C/taylor_recurrences.def\""; echo "};"
  echo "enum {"; echo '#define TAYLOR_UN(name, opcode, sexpr, testfn, x0) ESH_TAYLOR_UOP_##name = (opcode),'; echo "#include \"$C/taylor_recurrences.def\""; echo "};"
  echo "/* ---- verbatim: $C/runtime_taylor.c lines $a..$((b-1)) ---- */"; sed -n "${a},$((b-1))p" $C/runtime_taylor.c; } > "$HERE/kernels.gen.c"
gcc -O2 -std=gnu11 -ffp-contract=off -o "$HERE/golden" "$HERE/harness.c" -lm
"$HERE/golden" > "$HERE/../../tsotchke/data/eshkol_taylor_golden.json"; echo "lines $a..$((b-1)); $(wc -c < "$HERE/../../tsotchke/data/eshkol_taylor_golden.json") bytes"

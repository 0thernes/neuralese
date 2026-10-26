#!/bin/bash
# v10 (e): regenerates site/tsotchke/data/eshkol_neurosym_golden.txt by running golden.esk with a REAL eshkol-run built from
# tsotchke/eshkol@341ac81 (needs LLVM 21: cmake -DLLVM_DIR=/usr/lib/llvm-21/lib/cmake/llvm .. && make eshkol-run).
# Takes ~2 minutes (JIT). Usage: ESHKOL=/path/to/eshkol ./run.sh
set -euo pipefail; HERE=$(cd "$(dirname "$0")" && pwd); E=${ESHKOL:-/tmp/eshkol}
(cd "$E" && ./build/eshkol-run -r "$HERE/golden.esk") > "$HERE/golden.txt"; cp "$HERE/golden.txt" "$HERE/../../tsotchke/data/eshkol_neurosym_golden.txt"; cat "$HERE/golden.txt"

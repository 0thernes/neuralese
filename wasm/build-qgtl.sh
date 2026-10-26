#!/bin/bash
# Builds the QGTL (tsotchke/quantum_geometric_tensor@770994a, MIT) geometric-measure core to WebAssembly.
# Link closure (found by symbol resolution): qgt_context.c + quantum_geometric_operations.c + memory_pool.c +
# quantum_geometric_hardware.c + quantum_geometric_error.c + quantum_geometric_logging.c, plus qgtl_shim.c / qgtl_stubs.c.
# Usage: QGTL=/path/to/quantum_geometric_tensor ./build-qgtl.sh
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); QGTL=${QGTL:-/tmp/quantum_geometric_tensor}; DEST=${DEST:-$HERE/../site/tsotchke}; C=$QGTL/src/quantum_geometric/core
emcc -O2 -I"$QGTL/include" -I"$QGTL/src" -w $C/qgt_context.c $C/quantum_geometric_operations.c $C/memory_pool.c \
  $C/quantum_geometric_hardware.c $C/quantum_geometric_error.c $C/quantum_geometric_logging.c "$HERE/qgtl_shim.c" "$HERE/qgtl_stubs.c" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,node -sALLOW_MEMORY_GROWTH=1 -sEXPORT_NAME=QGTL \
  -sEXPORTED_FUNCTIONS=_qgtl_init,_qgtl_fidelity,_qgtl_metric,_malloc,_free -sEXPORTED_RUNTIME_METHODS=HEAPF64 -o "$HERE/qgtl.mjs"
base64 -w0 "$HERE/qgtl.wasm" > "$HERE/qgtl.wasm.b64"; cp "$HERE/qgtl.mjs" "$HERE/qgtl.wasm.b64" "$DEST/"; sha256sum "$HERE/qgtl.wasm"

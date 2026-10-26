#!/bin/bash
# Builds Moonlab's native QGT module (tsotchke/moonlab@cd3b234: src/algorithms/quantum_geometry/qgt.c + src/utils/matrix_math.c)
# to WebAssembly. Usage: MOONLAB=/path/to/moonlab ./build-moonlab-qgt.sh
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); ML=${MOONLAB:-/tmp/moonlab}; DEST=${DEST:-$HERE/../tsotchke}
emcc -O2 -w -I"$ML/src" "$ML/src/algorithms/quantum_geometry/qgt.c" "$ML/src/utils/matrix_math.c" "$HERE/moonlab_qgt_shim.c" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,node -sALLOW_MEMORY_GROWTH=1 -sEXPORT_NAME=MoonlabQGT \
  -sEXPORTED_FUNCTIONS=_mlq_metric_qwz,_mlq_curv_qwz,_malloc,_free -sEXPORTED_RUNTIME_METHODS=HEAPF64 -o "$HERE/moonlab_qgt.mjs"
base64 -w0 "$HERE/moonlab_qgt.wasm" > "$HERE/moonlab_qgt.wasm.b64"; cp "$HERE/moonlab_qgt.mjs" "$HERE/moonlab_qgt.wasm.b64" "$DEST/"; sha256sum "$HERE/moonlab_qgt.wasm"

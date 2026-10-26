#!/bin/bash
# Builds Eshkol's type checker core (tsotchke/eshkol) to WebAssembly. Usage: ESHKOL=/path/to/eshkol ./build-eshkol-types.sh
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); ESHKOL=${ESHKOL:-/tmp/eshkol}; DEST=${DEST:-$HERE/../site/tsotchke}
em++ -std=c++20 -O2 -I"$ESHKOL/inc" "$ESHKOL"/lib/types/{dependent,hott_types,type_relation}.cpp "$HERE/eshkol_types_shim.c++" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,node -sALLOW_MEMORY_GROWTH=1 -sEXPORT_NAME=EshkolTypes \
  -sEXPORTED_FUNCTIONS=_malloc,_free -sEXPORTED_RUNTIME_METHODS=ccall,UTF8ToString -fno-exceptions -o "$HERE/eshkol_types.mjs" 2>&1 || \
em++ -std=c++20 -O2 -I"$ESHKOL/inc" "$ESHKOL"/lib/types/{dependent,hott_types,type_relation}.cpp "$HERE/eshkol_types_shim.c++" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,node -sALLOW_MEMORY_GROWTH=1 -sEXPORT_NAME=EshkolTypes \
  -sEXPORTED_FUNCTIONS=_malloc,_free -sEXPORTED_RUNTIME_METHODS=ccall,UTF8ToString -o "$HERE/eshkol_types.mjs"
base64 -w0 "$HERE/eshkol_types.wasm" > "$HERE/eshkol_types.wasm.b64"
cp "$HERE/eshkol_types.mjs" "$HERE/eshkol_types.wasm.b64" "$DEST/"
sha256sum "$HERE/eshkol_types.wasm"

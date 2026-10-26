#!/usr/bin/env bash
# Reproducible build of site/tsotchke/qrng.{mjs,wasm} from tsotchke/quantum_rng (MIT).
# Requires emsdk 4.0.23 (`./emsdk install 4.0.23 && ./emsdk activate 4.0.23 && source ./emsdk_env.sh`).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; SRC="${1:-/tmp/quantum_rng}"; COMMIT=1a77e77f803c63883349b658361c06401cd8ceb7
[ -d "$SRC" ] || git clone https://github.com/tsotchke/quantum_rng "$SRC"
git -C "$SRC" checkout -q "$COMMIT"
cd "$SRC"
emcc -O2 -I. src/quantum_rng/{quantum_rng,quantum_state,quantum_gates,bell_test,matrix_math,simd_ops}.c src/health/health_tests.c "$HERE/qrng_shim.c" \
  -o "$HERE/qrng.mjs" -sMODULARIZE -sEXPORT_ES6 -sEXPORT_NAME=QRNG -sENVIRONMENT=web,node -sALLOW_MEMORY_GROWTH \
  -sEXPORTED_FUNCTIONS=_qw_bytes,_qw_chsh,_qw_health,_qw_version,_malloc,_free -sEXPORTED_RUNTIME_METHODS=HEAPU8,HEAPF64,UTF8ToString
DEST="$HERE/../site/tsotchke"; [ -d "$HERE/../site" ] || DEST="$HERE/../tsotchke"   # source tree (main has the site at the repo root)
base64 -w0 "$HERE/qrng.wasm" > "$HERE/qrng.wasm.b64"   # stored as text; site/tsotchke/wasmb64.js verifies the pinned sha256 below
cp "$HERE/qrng.mjs" "$HERE/qrng.wasm.b64" "$DEST/"
sha256sum "$HERE/qrng.wasm"   # expected a82a9b44efcdb5d0177c0eb6bc63b76910fefdc97482ce014d846dcd19fba86e

#!/bin/bash
# Builds Eshkol's reverse-mode tape (tsotchke/eshkol@341ac81 lib/backend/vm_autodiff.c, unmodified) + harness.c natively.
# Usage: ESHKOL=/path/to/eshkol ./build.sh ; then: node tools/eshkol-ad-crosscheck.mjs
set -euo pipefail; HERE=$(cd "$(dirname "$0")" && pwd); E=${ESHKOL:-/tmp/eshkol}
gcc -O2 -I"$E/lib/backend" -I"$E/inc" "$E/lib/backend/vm_autodiff.c" "$HERE/harness.c" -lm -o "$HERE/eshkol_ad"

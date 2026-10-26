// Native driver for the cross-libm determinism finding (v10 (f)). Same upstream sources and the same qw_bytes shim as the
// WASM build; prints 64 bytes for seed "neuralese-v8" as hex.
#include <stdio.h>
#include <string.h>
#include <stdint.h>
int qw_bytes(const uint8_t *seed, int seed_len, uint8_t *out, int n);
int main(void) { const char* s = "neuralese-v8"; uint8_t o[64]; if (qw_bytes((const uint8_t*)s, (int)strlen(s), o, 64)) return 1; for (int i = 0; i < 64; i++) printf("%02x", o[i]); printf("\n"); return 0; }

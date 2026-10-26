/* NEURALESE shim over tsotchke/quantum_rng (MIT). Thin C wrappers so JS can call
 * the library through a flat ABI. No algorithm here; all logic is upstream. */
#include <stdlib.h>
#include <string.h>
#include "src/quantum_rng/quantum_rng.h"
#include "src/quantum_rng/quantum_state.h"
#include "src/quantum_rng/bell_test.h"
#include "src/health/health_tests.h"

static int ent_cb(void *u, uint8_t *buf, size_t n){ return qrng_bytes((qrng_ctx*)u, buf, n)==QRNG_SUCCESS?0:-1; }

/* Deterministic mode: output is a pure function of seed (upstream contract). */
int qw_bytes(const uint8_t *seed, int seed_len, uint8_t *out, int n){
  qrng_ctx *c=0; if(qrng_init(&c, seed, (size_t)seed_len)!=QRNG_SUCCESS) return -1;
  int r = qrng_bytes(c, out, (size_t)n); qrng_free(c); return r;
}
/* CHSH on a simulated Phi+ pair; measurement randomness from a seeded qrng ctx.
 * out[0]=S, out[1]=stderr, out[2..5]=E(a,b),E(a,b'),E(a',b),E(a',b') */
int qw_chsh(const uint8_t *seed, int seed_len, int n, double *out){
  qrng_ctx *c=0; if(qrng_init(&c, seed, (size_t)seed_len)!=QRNG_SUCCESS) return -1;
  quantum_entropy_ctx_t e; quantum_entropy_init(&e, ent_cb, c);
  quantum_state_t s; if(quantum_state_init(&s,2)!=QS_SUCCESS){qrng_free(c);return -2;}
  bell_test_result_t r = bell_test_chsh(&s,0,1,(size_t)n,NULL,&e);
  out[0]=r.chsh_value; out[1]=r.standard_error; out[2]=r.correlation_ab; out[3]=r.correlation_ab_prime;
  out[4]=r.correlation_a_prime_b; out[5]=r.correlation_a_prime_b_prime;
  quantum_state_free(&s); qrng_free(c); return 0;
}
/* NIST SP 800-90B RCT+APT over a byte stream; returns upstream health_error_t. */
int qw_health(const uint8_t *buf, int n){
  health_test_ctx_t h; if(health_tests_init(&h)!=HEALTH_SUCCESS) return -5;
  int r = health_tests_run_batch(&h, buf, (size_t)n); health_tests_free(&h); return r;
}
const char* qw_version(void){ return qrng_version(); }

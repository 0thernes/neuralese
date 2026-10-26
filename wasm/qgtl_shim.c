// NEURALESE shim over QGTL (tsotchke/quantum_geometric_tensor@770994a, MIT): the verdicts come from QGTL's own
// qgt_context.c functions qgt_geometric_measure_fidelity (|<psi1|psi2>|^2) and qgt_geometric_compute_metric.
// The shim only copies amplitudes into QGTL's quantum_state_t (ComplexFloat = single precision).
#include "quantum_geometric/core/qgt_context.h"
#include "quantum_geometric/core/quantum_types.h"
#include <emscripten/emscripten.h>
#include <stdlib.h>
#include <string.h>
static qgt_context_t* C = 0;
static quantum_state_t* mk(int n, const double* re_im) {
  quantum_state_t* s = calloc(1, sizeof(quantum_state_t)); s->dimension = (size_t)n; s->coordinates = calloc((size_t)n, sizeof(ComplexFloat));
  for (int k = 0; k < n; k++) { s->coordinates[k].real = (float)re_im[2 * k]; s->coordinates[k].imag = (float)re_im[2 * k + 1]; }
  s->is_normalized = true; return s;
}
static void rm(quantum_state_t* s) { free(s->coordinates); free(s); }
EMSCRIPTEN_KEEPALIVE int qgtl_init(void) { return C ? 0 : (int)qgt_create_context(&C); }
EMSCRIPTEN_KEEPALIVE double qgtl_fidelity(int n, const double* a, const double* b) {
  if (qgtl_init()) return -1; quantum_state_t *x = mk(n, a), *y = mk(n, b); double f = -1;
  if (qgt_geometric_measure_fidelity(C, x, y, &f) != QGT_SUCCESS) f = -1; rm(x); rm(y); return f;
}
// QGTL's qgt_geometric_compute_metric: writes dim x dim (only the diagonal 1-|psi_i|^2 is populated upstream).
EMSCRIPTEN_KEEPALIVE int qgtl_metric(int n, const double* a, double* out) {
  if (qgtl_init()) return -1; quantum_state_t* x = mk(n, a); int e = (int)qgt_geometric_compute_metric(C, x, out); rm(x); return e;
}

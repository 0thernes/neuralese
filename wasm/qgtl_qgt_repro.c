// REPRODUCER (not shipped): drives QGTL tensor-network QGT path compute_quantum_geometric_tensor at 770994a.
// Observed in WASM: get_quantum_state returns an all-zero state and compute_shifted_states fails ("Invalid tensor network state").
#include "quantum_geometric/core/quantum_geometric_tensor_network.h"
#include "quantum_geometric/core/quantum_gate_operations.h"
#include "quantum_geometric/core/numerical_backend.h"
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif
#include <stdio.h>
#include <stdlib.h>
static quantum_geometric_tensor_network_t* G = 0;
// types: 0=RX 1=RY 2=RZ 3=H 4=CNOT(q, q2)
EMSCRIPTEN_KEEPALIVE int qgtl_circuit(int nq, int ng, const int* type, const int* q, const int* q2, const double* theta) {
  numerical_config_t cfg = { .type = NUMERICAL_BACKEND_CPU, .max_threads = 1 };
  initialize_numerical_backend(&cfg);
  if (G) destroy_quantum_geometric_tensor_network(G);
  G = create_quantum_geometric_tensor_network(nq, 1, false, false); if (!G) return -1;
  for (int k = 0; k < ng; k++) {
    size_t qs[2] = { (size_t)q[k], (size_t)q2[k] }; quantum_gate_t* g;
    switch (type[k]) {
      case 0: g = create_quantum_gate(GATE_TYPE_RX, qs, 1, &theta[k], 1); break;
      case 1: g = create_quantum_gate(GATE_TYPE_RY, qs, 1, &theta[k], 1); break;
      case 2: g = create_quantum_gate(GATE_TYPE_RZ, qs, 1, &theta[k], 1); break;
      case 3: g = create_quantum_gate(GATE_TYPE_H, qs, 1, 0, 0); break;
      default: g = create_quantum_gate(GATE_TYPE_CNOT, qs, 2, 0, 0); break;
    }
    if (!g) return -2;
    if (!apply_quantum_gate(G, g, qs, type[k] == 4 ? 2 : 1)) return -3;
  }
  return 0;
}
EMSCRIPTEN_KEEPALIVE int qgtl_qgt(int i, int j, double* out) {
  ComplexFloat r; if (!G || !compute_quantum_geometric_tensor(G, i, j, &r)) return -1; out[0] = r.real; out[1] = r.imag; return 0;
}
EMSCRIPTEN_KEEPALIVE int qgtl_state(double* out, int max) {
  ComplexFloat* s; size_t d; if (!G || !get_quantum_state(G, &s, &d)) return -1;
  for (size_t k = 0; k < d && (int)k < max; k++) { out[2*k] = s[k].real; out[2*k+1] = s[k].imag; } free(s); return (int)d;
}
#ifndef __EMSCRIPTEN__
#include <math.h>
int main(void) {
  int t[2] = {1, 2}, q[2] = {0, 0}, q2[2] = {0, 0}; double th[2] = {0.7, 0.3}, o[2], s[8];
  printf("circ %d\n", qgtl_circuit(1, 2, t, q, q2, th));
  int d = qgtl_state(s, 4); printf("dim %d  %f%+fi %f%+fi\n", d, s[0], s[1], s[2], s[3]);
  for (int i = 0; i < 2; i++) for (int j = 0; j < 2; j++) { int e = qgtl_qgt(i, j, o); printf("Q[%d%d]=%d %.6f %+.6f\n", i, j, e, o[0], o[1]); }
  printf("exact g00=0.25 g11=sin^2(a)/4=%.6f |Omega01|=sin(a)/4=%.6f\n", pow(sin(0.7), 2) / 4, sin(0.7) / 4);
}
#endif

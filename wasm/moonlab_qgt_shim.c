// NEURALESE shim over Moonlab's native quantum-geometry module (tsotchke/moonlab@cd3b234, MIT):
// src/algorithms/quantum_geometry/qgt.c. Every number comes from Moonlab: qgt_metric_at (Fubini–Study metric by
// centred finite differences of the lower-band projector) and qgt_dsigma_metric_curvature (closed form, Provost–Vallée).
#include "algorithms/quantum_geometry/qgt.h"
#include <emscripten/emscripten.h>
EMSCRIPTEN_KEEPALIVE int mlq_metric_qwz(double m, double kx, double ky, double dk, double* g) {
  qgt_system_t* s = qgt_model_qwz(m); if (!s) return -1; double k[2] = { kx, ky }; int r = qgt_metric_at(s, k, dk, g); qgt_free(s); return r; }
EMSCRIPTEN_KEEPALIVE int mlq_curv_qwz(double m, double kx, double ky, double dk, double* g, double* om) {
  qgt_system_t* s = qgt_model_qwz(m); if (!s) return -1; double k[2] = { kx, ky }; int r = qgt_curvature_at(s, k, dk, g, om); qgt_free(s); return r; }

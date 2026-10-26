// Calls Eshkol's tr_* kernels on fixed input series and prints JSON. N = 17 coefficients (K = 16, taylor.js K_MAX).
#include <stdio.h>
#include "kernels.gen.c"
#define N 17
static void pr(const char* name, const double* u, const double* w, const double* s, int first) {
  printf("%s{\"op\":\"%s\",\"u\":[", first ? "" : ",\n", name); for (int k = 0; k < N; k++) printf("%s%.17g", k ? "," : "", u[k]);
  printf("],\"w\":["); if (w) for (int k = 0; k < N; k++) printf("%s%.17g", k ? "," : "", w[k]);
  printf("],\"s\":["); for (int k = 0; k < N; k++) printf("%s%.17g", k ? "," : "", s[k]); printf("]}"); }
int main(void) {
  double U[3][N], Wd[N]; double x0[3] = { 0.7, 1.3, 0.3 };
  for (int c = 0; c < 3; c++) for (int k = 0; k < N; k++) U[c][k] = k == 0 ? x0[c] : (k == 1 ? 1.0 : (c == 0 ? 0.0 : 0.37 / (k * k) * ((k & 1) ? 1 : -1)));
  for (int k = 0; k < N; k++) Wd[k] = k == 0 ? 2.1 : 0.5 / (k + 1) * ((k % 3) ? 1 : -1);
  printf("{\"source\":\"tsotchke/eshkol@341ac81 lib/core/runtime_taylor.c tr_* (driven by taylor_recurrences.def op-codes)\",\"n\":%d,\"cases\":[\n", N);
  int first = 1; double s[N], s2[N], d[N], m[N];
  for (int c = 0; c < 3; c++) { const double* u = U[c]; char nm[32];
#define OUT(NAME) do { snprintf(nm, sizeof nm, "%s", NAME); pr(nm, u, 0, s, first); first = 0; } while (0)
    tr_exp(s, u, N); OUT("exp");
    tr_log(s, u, N); OUT("log");
    tr_sincos(s, s2, u, N); OUT("sin"); memcpy(s, s2, sizeof s); OUT("cos");
    tr_sincos(s2, d, u, N); tr_div(s, s2, d, N); OUT("tan");
    tr_pow_const(s, u, 0.5, N); OUT("sqrt");
    for (int k = 0; k < N; k++) m[k] = -u[k]; tr_exp(s2, u, N); tr_exp(d, m, N); for (int k = 0; k < N; k++) s[k] = 0.5 * (s2[k] - d[k]); OUT("sinh");
    for (int k = 0; k < N; k++) s[k] = 0.5 * (s2[k] + d[k]); OUT("cosh");
    tr_tanh(s, u, N, 0); OUT("tanh");
    tr_sigmoid(s, u, N, 0); OUT("sigmoid");
    tr_ext_unary(ESH_TAYLOR_UOP_atan, s, d, u, N, 0); OUT("atan");
    if (fabs(u[0]) < 1) { tr_ext_unary(ESH_TAYLOR_UOP_asin, s, d, u, N, 0); OUT("asin"); } /* asin needs |u0| < 1 */
    tr_relu(s, u, N); OUT("relu");
    tr_mul(s, u, Wd, N); pr("mul", u, Wd, s, 0);
    tr_div(s, u, Wd, N); pr("div", u, Wd, s, 0);
  }
  printf("\n]}\n"); return 0; }

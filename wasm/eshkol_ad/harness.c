// Full GPT-Neo forward + mean next-token CE recorded on Eshkol's REAL reverse-mode tape (tsotchke/eshkol@341ac81,
// lib/backend/vm_autodiff.c: ad_var/ad_add/ad_mul/ad_div/ad_exp/ad_log/ad_sqrt/ad_tanh + ad_backward), then every weight
// gradient is read back with ad_gradient. The forward semantics mirror site/grad.js (LayerNorm eps, unscaled causal
// attention, GELU-tanh, tied unembedding); the gradients are Eshkol's. Reads params on stdin, prints JSON.
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include "vm_arena.h"
typedef struct AdTape AdTape;
AdTape* ad_tape_new(VmRegionStack* rs); int ad_const(AdTape*, double); int ad_var(AdTape*, double);
int ad_add(AdTape*, int, int); int ad_sub(AdTape*, int, int); int ad_mul(AdTape*, int, int); int ad_div(AdTape*, int, int);
int ad_exp(AdTape*, int); int ad_log(AdTape*, int); int ad_sqrt(AdTape*, int); int ad_tanh(AdTape*, int);
void ad_backward(AdTape*, int); double ad_gradient(const AdTape*, int); double ad_value(const AdTape*, int); int ad_tape_length(const AdTape*);
/* unused arena hooks referenced by the owned-tape factory in vm_autodiff.c */
void* arena_allocate(void* a, size_t n) { (void)a; return malloc(n); } void arena_push_scope(void* a) { (void)a; } void arena_pop_scope(void* a) { (void)a; } void* get_global_arena(void) { return 0; }
static AdTape* tp; static int C(double x) { return ad_const(tp, x); }
#define ADD(a,b) ad_add(tp,a,b)
#define SUB(a,b) ad_sub(tp,a,b)
#define MUL(a,b) ad_mul(tp,a,b)
static int D, H, HD, L, FF, V, T, *ids; static double EPS;
typedef struct { int n; int* node; } P; static P rd(int n) { P p = { n, malloc(sizeof(int) * n) }; for (int i = 0; i < n; i++) { double x; if (scanf("%lf", &x) != 1) exit(2); p.node[i] = ad_var(tp, x); } return p; }
static void ln(const int* X, const P w, const P b, int* Y) { for (int t = 0; t < T; t++) { const int* x = X + t * D; int m = C(0); for (int i = 0; i < D; i++) m = ADD(m, x[i]); m = ad_div(tp, m, C(D));
    int v = C(0); int* q = malloc(sizeof(int) * D); for (int i = 0; i < D; i++) { q[i] = SUB(x[i], m); v = ADD(v, MUL(q[i], q[i])); } v = ad_div(tp, v, C(D)); int r = ad_div(tp, C(1), ad_sqrt(tp, ADD(v, C(EPS))));
    for (int i = 0; i < D; i++) Y[t * D + i] = ADD(MUL(MUL(q[i], r), w.node[i]), b.node[i]); free(q); } }
static void mm(const int* X, const P W, int nOut, int nIn, const P* b, int* Y) { for (int t = 0; t < T; t++) for (int o = 0; o < nOut; o++) { int s = b ? b->node[o] : C(0); for (int i = 0; i < nIn; i++) s = ADD(s, MUL(W.node[o * nIn + i], X[t * nIn + i])); Y[t * nOut + o] = s; } }
static int gelu(int x) { int x3 = MUL(MUL(x, x), x); int t = ad_tanh(tp, MUL(C(0.7978845608028654), ADD(x, MUL(C(0.044715), x3)))); return MUL(MUL(C(0.5), x), ADD(C(1), t)); }
int main(void) {
  static VmRegionStack rs; vm_region_stack_init(&rs); tp = ad_tape_new(&rs);
  if (scanf("%d %d %d %d %d %d %d %lf", &D, &H, &HD, &L, &FF, &V, &T, &EPS) != 8) return 2; ids = malloc(sizeof(int) * T); for (int t = 0; t < T; t++) if (scanf("%d", &ids[t]) != 1) return 2;
  P wte = rd(V * D), wpe = rd(T * D), lnfW = rd(D), lnfB = rd(D); P* lay = malloc(sizeof(P) * 13 * L);
  int sz[13] = { D, D, D * D, D * D, D * D, D * D, D, D, D, FF * D, FF, D * FF, D };
  for (int l = 0; l < L; l++) for (int k = 0; k < 13; k++) lay[l * 13 + k] = rd(sz[k]);
  int* X = malloc(sizeof(int) * T * D); for (int t = 0; t < T; t++) for (int i = 0; i < D; i++) X[t * D + i] = ADD(wte.node[ids[t] * D + i], wpe.node[t * D + i]);
  int *Y = malloc(sizeof(int) * T * D), *Q = malloc(sizeof(int) * T * D), *K = malloc(sizeof(int) * T * D), *Vv = malloc(sizeof(int) * T * D), *Z = malloc(sizeof(int) * T * D), *AO = malloc(sizeof(int) * T * D), *Pre = malloc(sizeof(int) * T * FF);
  for (int l = 0; l < L; l++) { P* p = lay + l * 13; ln(X, p[0], p[1], Y); mm(Y, p[2], D, D, 0, Q); mm(Y, p[3], D, D, 0, K); mm(Y, p[4], D, D, 0, Vv);
    for (int h = 0; h < H; h++) { int off = h * HD; for (int t = 0; t < T; t++) { int* s = malloc(sizeof(int) * (t + 1)); double mx = -INFINITY;
        for (int j = 0; j <= t; j++) { int a = C(0); for (int i = 0; i < HD; i++) a = ADD(a, MUL(Q[t * D + off + i], K[j * D + off + i])); s[j] = a; if (ad_value(tp, a) > mx) mx = ad_value(tp, a); }
        int sum = C(0); for (int j = 0; j <= t; j++) { s[j] = ad_exp(tp, SUB(s[j], C(mx))); sum = ADD(sum, s[j]); }
        for (int i = 0; i < HD; i++) { int z = C(0); for (int j = 0; j <= t; j++) z = ADD(z, MUL(ad_div(tp, s[j], sum), Vv[j * D + off + i])); Z[t * D + off + i] = z; } free(s); } }
    mm(Z, p[5], D, D, &p[6], AO); for (int i = 0; i < T * D; i++) X[i] = ADD(X[i], AO[i]);
    ln(X, p[7], p[8], Y); mm(Y, p[9], FF, D, &p[10], Pre); for (int i = 0; i < T * FF; i++) Pre[i] = gelu(Pre[i]); mm(Pre, p[11], D, FF, &p[12], AO); for (int i = 0; i < T * D; i++) X[i] = ADD(X[i], AO[i]); }
  ln(X, lnfW, lnfB, Y); int loss = C(0);
  for (int t = 0; t < T - 1; t++) { int* lg = malloc(sizeof(int) * V); double mx = -INFINITY; for (int v = 0; v < V; v++) { int s = C(0); for (int i = 0; i < D; i++) s = ADD(s, MUL(wte.node[v * D + i], Y[t * D + i])); lg[v] = s; if (ad_value(tp, s) > mx) mx = ad_value(tp, s); }
    int z = C(0); for (int v = 0; v < V; v++) z = ADD(z, ad_exp(tp, SUB(lg[v], C(mx)))); loss = ADD(loss, SUB(ADD(ad_log(tp, z), C(mx)), lg[ids[t + 1]])); free(lg); }
  loss = ad_div(tp, loss, C(T - 1)); ad_backward(tp, loss);
  printf("{\"loss\":%.17g,\"tape\":%d,\"grads\":[", ad_value(tp, loss), ad_tape_length(tp)); int first = 1;
#define DUMP(p) for (int i = 0; i < (p).n; i++) { printf(first ? "%.17g" : ",%.17g", ad_gradient(tp, (p).node[i])); first = 0; }
  DUMP(wte) DUMP(wpe) DUMP(lnfW) DUMP(lnfB) for (int l = 0; l < L; l++) for (int k = 0; k < 13; k++) DUMP(lay[l * 13 + k]) printf("]}\n"); return 0; }

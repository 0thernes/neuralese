// NEURALESE shim over Eshkol's own compile-time type layer (lib/types/{dependent,hott_types,type_relation}.cpp,
// tsotchke/eshkol, MIT). The shim only marshals arguments; every verdict comes from Eshkol code.
#include "eshkol/types/dependent.h"
#include "eshkol/types/hott_types.h"
#include <emscripten/emscripten.h>
#include <string>
using namespace eshkol::hott;
static std::string g_msg;
static TypeEnvironment& env() { static TypeEnvironment e; return e; }
static int put(const DimensionChecker::Result& r) { g_msg = r.error_message; return r.valid ? 1 : 0; }
static CTValue nat(double v) { return v < 0 ? CTValue::makeUnknown() : CTValue::makeNat((uint64_t)v); }
extern "C" {
EMSCRIPTEN_KEEPALIVE const char* esk_msg() { return g_msg.c_str(); }
// (m x n) * (n2 x p): DimensionChecker::checkMatMulDimensions. A negative dim = statically unknown.
EMSCRIPTEN_KEEPALIVE int esk_matmul(double m, double n, double n2, double p) {
  DependentType L(BuiltinTypes::Tensor, {BuiltinTypes::Float32}, {nat(m), nat(n)});
  DependentType R(BuiltinTypes::Tensor, {BuiltinTypes::Float32}, {nat(n2), nat(p)});
  return put(DimensionChecker::checkMatMulDimensions(L, R, "matmul"));
}
EMSCRIPTEN_KEEPALIVE int esk_dot(double a, double b) {
  DependentType L(BuiltinTypes::Vector, {BuiltinTypes::Float32}, {nat(a)}), R(BuiltinTypes::Vector, {BuiltinTypes::Float32}, {nat(b)});
  return put(DimensionChecker::checkDotProductDimensions(L, R, "dot"));
}
// Path/identity type Id_Nat(rows*cols, len): the product is computed by CTValue::mul (type-level arithmetic).
EMSCRIPTEN_KEEPALIVE int esk_reshape(double rows, double cols, double len) {
  return put(DimensionChecker::checkDimensionsEqual(nat(rows).mul(nat(cols)), nat(len), "reshape"));
}
EMSCRIPTEN_KEEPALIVE int esk_eq(double a, double b) { return put(DimensionChecker::checkDimensionsEqual(nat(a), nat(b), "eq")); }
EMSCRIPTEN_KEEPALIVE int esk_bounds(double i, double n) { return put(DimensionChecker::checkBounds(nat(i), nat(n), "index")); }
// Universe-hierarchy subtyping and numeric promotion (TypeEnvironment, hott_types.cpp).
EMSCRIPTEN_KEEPALIVE int esk_subtype(const char* a, const char* b) {
  auto A = env().lookupType(a), B = env().lookupType(b); if (!A || !B) { g_msg = "unknown type"; return -1; }
  g_msg = ""; return env().isSubtype(*A, *B) ? 1 : 0;
}
EMSCRIPTEN_KEEPALIVE const char* esk_promote(const char* a, const char* b) {
  auto A = env().lookupType(a), B = env().lookupType(b); if (!A || !B) { g_msg = "?"; return g_msg.c_str(); }
  g_msg = env().getTypeName(env().promoteForArithmetic(*A, *B)); return g_msg.c_str();
}
EMSCRIPTEN_KEEPALIVE int esk_universe(const char* a) { auto A = env().lookupType(a); return A ? (int)A->level : -1; }
}

# Vendored Moonlab — provenance and patches

Source: npm `@tsotchkecorp/moonlab@1.2.1` (MIT, © Tsotchke Corporation — see `LICENSE`), corresponding to
https://github.com/tsotchke/moonlab (VERSION 1.2.1; repository HEAD inspected: `cd3b2347e3739327548708073d7e4ac710cc6a6c`).

Files in `dist/` are byte-identical to the npm tarball **except** `dist/chunk-NLN6PXJW.mjs`:

| file | upstream sha256 | change |
|---|---|---|
| `dist/chunk-NLN6PXJW.mjs` | `5f2a96385081fffa8b747c8b8b512cee48b1393707b3a0e41035491cda016c49` | 4 static `import … from "net"/"tls"/"fs"/"crypto"` replaced by `null` constants (diff: `moonlab-browser.patch`). They are only used by the control-plane network client, which NEURALESE never calls. Without the patch the ES module cannot load in a browser. |

`dist/moonlab.wasm` and `dist/moonlab.js` (the Emscripten-compiled simulator) are unmodified. `package.json` is the upstream
one, kept so Node treats `dist/moonlab.js` as CommonJS (used by the test suite).


## Binary storage and integrity

The repository is deployed through a text-only channel, so both WebAssembly binaries are committed as base64 text: `site/tsotchke/qrng.wasm.b64` and `site/vendor/moonlab/dist/moonlab.wasm.b64`. `site/tsotchke/wasmb64.js` decodes them and checks SHA-256 before instantiation. If the hash does not match, loading throws:

- qrng.wasm: `a82a9b44efcdb5d0177c0eb6bc63b76910fefdc97482ce014d846dcd19fba86e` (reproducible with `wasm/build-qrng.sh`)
- moonlab.wasm: `fef4f0192641af2299b097bb1ccb535cd76f2d5d10f731c5723fe6e3f71229c1`. This is the byte-identical binary shipped in npm `@tsotchkecorp/moonlab@1.2.1` (the name of `bindings/javascript/packages/core/package.json` in the repo; the workspace root there is `moonlab-javascript`). Check it with `base64 -d moonlab.wasm.b64 | sha256sum`.

Test C3z checks that both pins hold and that a changed pin gets rejected. The browser hands the verified bytes to the unmodified Emscripten glue through `wasmBinary`. In Node, the test materialises `dist/moonlab.wasm` from the verified base64 first.

import {
  ControlPlaneError,
  MOONLAB_CONTROL_AUTH_BAD,
  MOONLAB_CONTROL_AUTH_REQUIRED,
  MOONLAB_CONTROL_BAD_ARG,
  MOONLAB_CONTROL_IO_ERROR,
  MOONLAB_CONTROL_OK,
  MOONLAB_CONTROL_OOM,
  MOONLAB_CONTROL_RATE_LIMITED,
  MOONLAB_CONTROL_REJECTED,
  MOONLAB_CONTROL_SERVER_BUSY,
  __export,
  submitCircuit,
  submitHealth,
  submitMetrics,
  submitShots,
  submitShotsWithSeed
} from "./chunk-NLN6PXJW.mjs";

// src/memory.ts
var WasmMemory = class {
  constructor(module) {
    this.allocations = /* @__PURE__ */ new Map();
    this.module = module;
  }
  /**
   * Allocate raw bytes
   */
  alloc(bytes) {
    const ptr = this.module._malloc(bytes);
    if (ptr === 0) {
      throw new Error(`WASM memory allocation failed: ${bytes} bytes`);
    }
    this.allocations.set(ptr, { size: bytes, type: "raw" });
    return ptr;
  }
  /**
   * Allocate memory for complex array (interleaved real/imag)
   * Each complex number is 16 bytes (2 × Float64)
   */
  allocComplexArray(length) {
    const bytes = length * 16;
    const ptr = this.alloc(bytes);
    this.allocations.set(ptr, { size: bytes, type: "complex[]" });
    return ptr;
  }
  /**
   * Allocate memory for Float64 array
   */
  allocFloat64Array(length) {
    const bytes = length * 8;
    const ptr = this.alloc(bytes);
    this.allocations.set(ptr, { size: bytes, type: "f64[]" });
    return ptr;
  }
  /**
   * Allocate memory for Int32 array
   */
  allocInt32Array(length) {
    const bytes = length * 4;
    const ptr = this.alloc(bytes);
    this.allocations.set(ptr, { size: bytes, type: "i32[]" });
    return ptr;
  }
  /**
   * Free allocated memory
   */
  free(ptr) {
    if (this.allocations.has(ptr)) {
      this.module._free(ptr);
      this.allocations.delete(ptr);
    }
  }
  /**
   * Free all tracked allocations
   */
  freeAll() {
    for (const ptr of this.allocations.keys()) {
      this.module._free(ptr);
    }
    this.allocations.clear();
  }
  /**
   * Get allocation info for debugging
   */
  getAllocations() {
    return new Map(this.allocations);
  }
  /**
   * Read complex array from WASM memory
   */
  readComplexArray(ptr, length) {
    const result = [];
    const heap = this.module.HEAPF64;
    const offset = ptr / 8;
    for (let i = 0; i < length; i++) {
      result.push({
        real: heap[offset + i * 2],
        imag: heap[offset + i * 2 + 1]
      });
    }
    return result;
  }
  /**
   * Write complex array to WASM memory
   */
  writeComplexArray(ptr, data) {
    const heap = this.module.HEAPF64;
    const offset = ptr / 8;
    for (let i = 0; i < data.length; i++) {
      heap[offset + i * 2] = data[i].real;
      heap[offset + i * 2 + 1] = data[i].imag;
    }
  }
  /**
   * Read Float64 array from WASM memory (returns a copy)
   */
  readFloat64Array(ptr, length) {
    const offset = ptr / 8;
    return new Float64Array(this.module.HEAPF64.buffer, offset * 8, length).slice();
  }
  /**
   * Write Float64 array to WASM memory
   */
  writeFloat64Array(ptr, data) {
    const heap = this.module.HEAPF64;
    const offset = ptr / 8;
    for (let i = 0; i < data.length; i++) {
      heap[offset + i] = data[i];
    }
  }
  /**
   * Read Int32 array from WASM memory
   */
  readInt32Array(ptr, length) {
    const offset = ptr / 4;
    return new Int32Array(this.module.HEAP32.buffer, offset * 4, length).slice();
  }
  /**
   * Write Int32 array to WASM memory
   */
  writeInt32Array(ptr, data) {
    const heap = this.module.HEAP32;
    const offset = ptr / 4;
    for (let i = 0; i < data.length; i++) {
      heap[offset + i] = data[i];
    }
  }
  /**
   * Read a single Float64 value
   */
  readFloat64(ptr) {
    return this.module.HEAPF64[ptr / 8];
  }
  /**
   * Write a single Float64 value
   */
  writeFloat64(ptr, value) {
    this.module.HEAPF64[ptr / 8] = value;
  }
  /**
   * Read a single Int32 value
   */
  readInt32(ptr) {
    return this.module.HEAP32[ptr / 4];
  }
  /**
   * Write a single Int32 value
   */
  writeInt32(ptr, value) {
    this.module.HEAP32[ptr / 4] = value;
  }
  /**
   * Read a pointer value (depends on pointer size)
   */
  readPointer(ptr) {
    return this.module.HEAP32[ptr / 4];
  }
  /**
   * Copy bytes within WASM memory
   */
  copy(dest, src, bytes) {
    const destArr = new Uint8Array(this.module.HEAP8.buffer, dest, bytes);
    const srcArr = new Uint8Array(this.module.HEAP8.buffer, src, bytes);
    destArr.set(srcArr);
  }
  /**
   * Zero out memory region
   */
  zero(ptr, bytes) {
    const arr = new Uint8Array(this.module.HEAP8.buffer, ptr, bytes);
    arr.fill(0);
  }
};

// src/wasm-loader.ts
var modulePromise = null;
var moduleInstance = null;
var globalScope = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : {};
async function getModule(options) {
  if (globalScope.__moonlabModuleInstance && typeof globalScope.__moonlabModuleInstance === "object") {
    return globalScope.__moonlabModuleInstance;
  }
  if (moduleInstance) {
    return moduleInstance;
  }
  if (globalScope.__moonlabModulePromise instanceof Promise) {
    modulePromise = globalScope.__moonlabModulePromise;
  }
  if (!modulePromise) {
    modulePromise = loadModule(options);
    globalScope.__moonlabModulePromise = modulePromise;
  }
  moduleInstance = await modulePromise;
  globalScope.__moonlabModuleInstance = moduleInstance;
  return moduleInstance;
}
function isLoaded() {
  return moduleInstance !== null;
}
function resetModule() {
  moduleInstance = null;
  modulePromise = null;
  delete globalScope.__moonlabModuleInstance;
  delete globalScope.__moonlabModulePromise;
}
async function loadModule(options) {
  const isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
  const isDeno = isDenoRuntime();
  if (isNode || isDeno) {
    return loadServerModule(options);
  } else {
    return loadBrowserModule(options);
  }
}
async function loadServerModule(_options) {
  const candidates = [];
  const metaUrl = typeof import.meta.url === "string" ? import.meta.url : null;
  if (metaUrl) {
    candidates.push(new URL("../dist/moonlab.js", metaUrl).href);
    candidates.push(new URL("../emscripten/build/moonlab.js", metaUrl).href);
  }
  if (typeof __dirname === "string") {
    const path = await import("path");
    const url = await import("url");
    candidates.push(url.pathToFileURL(path.resolve(__dirname, "moonlab.js")).href);
    candidates.push(url.pathToFileURL(path.resolve(__dirname, "../emscripten/build/moonlab.js")).href);
  }
  let lastError = null;
  for (const candidate of candidates) {
    try {
      const imported = await import(
        /* @vite-ignore */
        candidate
      );
      let MoonlabModuleFactory = getMoonlabFactory(imported);
      if (!MoonlabModuleFactory && isDenoRuntime()) {
        MoonlabModuleFactory = await loadDenoCommonJsFactory(candidate);
      }
      if (typeof MoonlabModuleFactory !== "function") {
        throw new Error(`Module factory missing in ${candidate}`);
      }
      const module = await MoonlabModuleFactory();
      await module.ready;
      return module;
    } catch (error) {
      lastError = error;
    }
  }
  const tried = candidates.join(", ");
  throw new Error(
    `Failed to load Moonlab WASM module in server runtime. Tried: ${tried}. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}
function isDenoRuntime() {
  return typeof globalThis !== "undefined" && "Deno" in globalThis;
}
function getMoonlabFactory(imported) {
  const factory = imported.default ?? imported.MoonlabModule ?? (typeof imported === "function" ? imported : void 0);
  return typeof factory === "function" ? factory : null;
}
async function loadDenoCommonJsFactory(candidate) {
  const url = await import("url");
  const path = await import("path");
  const fs = await import("fs/promises");
  const moduleApi = await import("module");
  const processModule = await import("process");
  const modulePath = candidate.startsWith("file:") ? url.fileURLToPath(candidate) : candidate;
  const source = await fs.readFile(modulePath, "utf8");
  const moduleShim = { exports: {} };
  const exportsShim = moduleShim.exports;
  const require2 = moduleApi.createRequire(url.pathToFileURL(modulePath).href);
  const globalRecord = globalThis;
  const previousProcess = globalRecord.process;
  globalRecord.process = processModule.default ?? processModule;
  try {
    const evaluator = new Function(
      "module",
      "exports",
      "require",
      "__filename",
      "__dirname",
      source
    );
    evaluator(moduleShim, exportsShim, require2, modulePath, path.dirname(modulePath));
  } finally {
    if (typeof previousProcess === "undefined") {
      delete globalRecord.process;
    } else {
      globalRecord.process = previousProcess;
    }
  }
  if (typeof moduleShim.exports === "function") {
    return moduleShim.exports;
  }
  if (moduleShim.exports && typeof moduleShim.exports === "object") {
    const fromDefault = moduleShim.exports.default;
    if (typeof fromDefault === "function") {
      return fromDefault;
    }
  }
  return null;
}
async function loadBrowserModule(options) {
  try {
    if (globalScope.__moonlabModuleInstance && typeof globalScope.__moonlabModuleInstance === "object") {
      return globalScope.__moonlabModuleInstance;
    }
    if (globalScope.__moonlabModulePromise instanceof Promise) {
      const cached = await globalScope.__moonlabModulePromise;
      globalScope.__moonlabModuleInstance = cached;
      return cached;
    }
    let MoonlabModuleFactory;
    if (typeof window !== "undefined" && window.MoonlabModule) {
      MoonlabModuleFactory = window.MoonlabModule;
    } else if (options?.jsPath) {
      MoonlabModuleFactory = await loadScript(options.jsPath);
    } else {
      const baseUrl = getBaseUrl();
      const jsUrl = `${baseUrl}/moonlab.js`;
      MoonlabModuleFactory = await loadScript(jsUrl);
    }
    const moduleConfig = {};
    moduleConfig.locateFile = (file, scriptDirectory) => {
      if (file.endsWith(".wasm")) {
        if (options?.wasmPath) {
          return options.wasmPath;
        }
        if (scriptDirectory) {
          return scriptDirectory + file;
        }
        return getBaseUrl() + "/" + file;
      }
      return scriptDirectory + file;
    };
    if (typeof MoonlabModuleFactory !== "function") {
      throw new Error("MoonlabModuleFactory is not available");
    }
    const loadingPromise = MoonlabModuleFactory(moduleConfig);
    globalScope.__moonlabModulePromise = loadingPromise;
    const module = await loadingPromise;
    await module.ready;
    globalScope.__moonlabModuleInstance = module;
    return module;
  } catch (error) {
    throw new Error(
      `Failed to load Moonlab WASM module in browser: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
function getBaseUrl() {
  if (typeof document !== "undefined") {
    const scripts = document.getElementsByTagName("script");
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = scripts[i].src;
      if (src.includes("moonlab")) {
        return src.substring(0, src.lastIndexOf("/"));
      }
    }
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return ".";
}
async function loadScript(url) {
  if (typeof window !== "undefined" && window.MoonlabModule) {
    return window.MoonlabModule;
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => {
      if (window.MoonlabModule) {
        resolve(window.MoonlabModule);
      } else {
        reject(new Error("MoonlabModule not found after script load"));
      }
    };
    script.onerror = () => {
      reject(new Error(`Failed to load script: ${url}`));
    };
    document.head.appendChild(script);
  });
}
function preload(options) {
  return getModule(options);
}

// src/quantum-state.ts
var STATE_STRUCT_SIZE = 256;
var AMPLITUDES_OFFSET = 8;
var QuantumState = class _QuantumState {
  /**
   * Private constructor - use QuantumState.create() instead
   */
  constructor(module, memory, statePtr, numQubits) {
    this._disposed = false;
    this.module = module;
    this.memory = memory;
    this.statePtr = statePtr;
    this._numQubits = numQubits;
  }
  /**
   * Create a new quantum state
   */
  static async create(options) {
    if (options.numQubits < 1 || options.numQubits > 30) {
      throw new Error("numQubits must be between 1 and 30");
    }
    const module = await getModule();
    const memory = new WasmMemory(module);
    const statePtr = memory.alloc(STATE_STRUCT_SIZE);
    const result = module._quantum_state_init(statePtr, options.numQubits);
    if (result !== 0) {
      memory.free(statePtr);
      throw new Error(`Failed to initialize quantum state: error ${result}`);
    }
    const state = new _QuantumState(module, memory, statePtr, options.numQubits);
    if (options.amplitudes) {
      state.setAmplitudes(options.amplitudes);
    }
    return state;
  }
  // =========================================================================
  // Properties
  // =========================================================================
  /**
   * Number of qubits in this state
   */
  get numQubits() {
    return this._numQubits;
  }
  /**
   * Internal: WASM heap pointer of the underlying `quantum_state_t`.
   * Used by sibling modules (`noise.ts`, `entanglement.ts`) to call
   * the C ABI directly without needing the QuantumState class to host
   * every wrapper method.  Not part of the public API contract --
   * the underlying `statePtr` is owned and freed by this class.
   */
  _internal_state_pointer() {
    if (this._disposed) {
      throw new Error("QuantumState is disposed");
    }
    return this.statePtr;
  }
  /** Internal: WASM module handle.  See `_internal_state_pointer`. */
  _internal_module() {
    return this.module;
  }
  /**
   * Dimension of state space (2^n)
   */
  get stateDim() {
    return 1 << this._numQubits;
  }
  /**
   * Check if the state has been disposed
   */
  get isDisposed() {
    return this._disposed;
  }
  // =========================================================================
  // State Operations
  // =========================================================================
  /**
   * Reset to |0...0⟩ state
   */
  reset() {
    this.checkDisposed();
    this.module._quantum_state_reset(this.statePtr);
    return this;
  }
  /**
   * Clone this state
   */
  async clone() {
    this.checkDisposed();
    return _QuantumState.create({
      numQubits: this._numQubits,
      amplitudes: this.getAmplitudes()
    });
  }
  /**
   * Normalize the state vector
   */
  normalize() {
    this.checkDisposed();
    this.module._quantum_state_normalize(this.statePtr);
    return this;
  }
  // =========================================================================
  // Single-Qubit Gates
  // =========================================================================
  /**
   * Hadamard gate - creates superposition
   * H|0⟩ = (|0⟩ + |1⟩)/√2
   */
  h(qubit) {
    this.checkDisposed();
    this.checkQubit(qubit);
    this.module._gate_hadamard(this.statePtr, qubit);
    return this;
  }
  /**
   * Pauli-X gate (NOT gate)
   * X|0⟩ = |1⟩, X|1⟩ = |0⟩
   */
  x(qubit) {
    this.checkDisposed();
    this.checkQubit(qubit);
    this.module._gate_pauli_x(this.statePtr, qubit);
    return this;
  }
  /**
   * Pauli-Y gate
   * Y|0⟩ = i|1⟩, Y|1⟩ = -i|0⟩
   */
  y(qubit) {
    this.checkDisposed();
    this.checkQubit(qubit);
    this.module._gate_pauli_y(this.statePtr, qubit);
    return this;
  }
  /**
   * Pauli-Z gate (phase flip)
   * Z|0⟩ = |0⟩, Z|1⟩ = -|1⟩
   */
  z(qubit) {
    this.checkDisposed();
    this.checkQubit(qubit);
    this.module._gate_pauli_z(this.statePtr, qubit);
    return this;
  }
  /**
   * S gate (√Z, phase gate)
   * S|0⟩ = |0⟩, S|1⟩ = i|1⟩
   */
  s(qubit) {
    this.checkDisposed();
    this.checkQubit(qubit);
    this.module._gate_s(this.statePtr, qubit);
    return this;
  }
  /**
   * S-dagger gate (S†)
   */
  sdg(qubit) {
    this.checkDisposed();
    this.checkQubit(qubit);
    this.module._gate_s_dagger(this.statePtr, qubit);
    return this;
  }
  /**
   * T gate (√S, π/8 gate)
   */
  t(qubit) {
    this.checkDisposed();
    this.checkQubit(qubit);
    this.module._gate_t(this.statePtr, qubit);
    return this;
  }
  /**
   * T-dagger gate (T†)
   */
  tdg(qubit) {
    this.checkDisposed();
    this.checkQubit(qubit);
    this.module._gate_t_dagger(this.statePtr, qubit);
    return this;
  }
  /**
   * Rotation around X-axis
   * Rx(θ) = exp(-iθX/2)
   */
  rx(qubit, angle) {
    this.checkDisposed();
    this.checkQubit(qubit);
    this.module._gate_rx(this.statePtr, qubit, angle);
    return this;
  }
  /**
   * Rotation around Y-axis
   * Ry(θ) = exp(-iθY/2)
   */
  ry(qubit, angle) {
    this.checkDisposed();
    this.checkQubit(qubit);
    this.module._gate_ry(this.statePtr, qubit, angle);
    return this;
  }
  /**
   * Rotation around Z-axis
   * Rz(θ) = exp(-iθZ/2)
   */
  rz(qubit, angle) {
    this.checkDisposed();
    this.checkQubit(qubit);
    this.module._gate_rz(this.statePtr, qubit, angle);
    return this;
  }
  /**
   * Phase gate P(θ)
   * P(θ)|0⟩ = |0⟩, P(θ)|1⟩ = e^(iθ)|1⟩
   */
  phase(qubit, angle) {
    this.checkDisposed();
    this.checkQubit(qubit);
    this.module._gate_phase(this.statePtr, qubit, angle);
    return this;
  }
  /**
   * General single-qubit unitary U3(θ, φ, λ)
   */
  u3(qubit, theta, phi, lambda) {
    this.checkDisposed();
    this.checkQubit(qubit);
    this.module._gate_u3(this.statePtr, qubit, theta, phi, lambda);
    return this;
  }
  // =========================================================================
  // Two-Qubit Gates
  // =========================================================================
  /**
   * Controlled-NOT (CNOT) gate
   * Flips target if control is |1⟩
   */
  cnot(control, target) {
    this.checkDisposed();
    this.checkQubit(control);
    this.checkQubit(target);
    if (control === target) {
      throw new Error("Control and target must be different qubits");
    }
    this.module._gate_cnot(this.statePtr, control, target);
    return this;
  }
  /**
   * Alias for CNOT
   */
  cx(control, target) {
    return this.cnot(control, target);
  }
  /**
   * Controlled-Z gate
   */
  cz(control, target) {
    this.checkDisposed();
    this.checkQubit(control);
    this.checkQubit(target);
    if (control === target) {
      throw new Error("Control and target must be different qubits");
    }
    this.module._gate_cz(this.statePtr, control, target);
    return this;
  }
  /**
   * Controlled-Y gate
   */
  cy(control, target) {
    this.checkDisposed();
    this.checkQubit(control);
    this.checkQubit(target);
    if (control === target) {
      throw new Error("Control and target must be different qubits");
    }
    this.module._gate_cy(this.statePtr, control, target);
    return this;
  }
  /**
   * SWAP gate - exchanges two qubits
   */
  swap(qubit1, qubit2) {
    this.checkDisposed();
    this.checkQubit(qubit1);
    this.checkQubit(qubit2);
    if (qubit1 === qubit2) {
      return this;
    }
    this.module._gate_swap(this.statePtr, qubit1, qubit2);
    return this;
  }
  /**
   * Controlled phase gate CP(θ)
   */
  cphase(control, target, angle) {
    this.checkDisposed();
    this.checkQubit(control);
    this.checkQubit(target);
    if (control === target) {
      throw new Error("Control and target must be different qubits");
    }
    this.module._gate_cphase(this.statePtr, control, target, angle);
    return this;
  }
  /**
   * Controlled Rx gate
   */
  crx(control, target, angle) {
    this.checkDisposed();
    this.checkQubit(control);
    this.checkQubit(target);
    if (control === target) {
      throw new Error("Control and target must be different qubits");
    }
    this.module._gate_crx(this.statePtr, control, target, angle);
    return this;
  }
  /**
   * Controlled Ry gate
   */
  cry(control, target, angle) {
    this.checkDisposed();
    this.checkQubit(control);
    this.checkQubit(target);
    if (control === target) {
      throw new Error("Control and target must be different qubits");
    }
    this.module._gate_cry(this.statePtr, control, target, angle);
    return this;
  }
  /**
   * Controlled Rz gate
   */
  crz(control, target, angle) {
    this.checkDisposed();
    this.checkQubit(control);
    this.checkQubit(target);
    if (control === target) {
      throw new Error("Control and target must be different qubits");
    }
    this.module._gate_crz(this.statePtr, control, target, angle);
    return this;
  }
  // =========================================================================
  // Three-Qubit Gates
  // =========================================================================
  /**
   * Toffoli gate (CCNOT)
   * Flips target if both controls are |1⟩
   */
  toffoli(control1, control2, target) {
    this.checkDisposed();
    this.checkQubit(control1);
    this.checkQubit(control2);
    this.checkQubit(target);
    if (control1 === control2 || control1 === target || control2 === target) {
      throw new Error("All qubits must be different");
    }
    this.module._gate_toffoli(this.statePtr, control1, control2, target);
    return this;
  }
  /**
   * Alias for Toffoli
   */
  ccx(control1, control2, target) {
    return this.toffoli(control1, control2, target);
  }
  /**
   * Fredkin gate (CSWAP)
   * Swaps targets if control is |1⟩
   */
  fredkin(control, target1, target2) {
    this.checkDisposed();
    this.checkQubit(control);
    this.checkQubit(target1);
    this.checkQubit(target2);
    if (control === target1 || control === target2 || target1 === target2) {
      throw new Error("All qubits must be different");
    }
    this.module._gate_fredkin(this.statePtr, control, target1, target2);
    return this;
  }
  /**
   * Alias for Fredkin
   */
  cswap(control, target1, target2) {
    return this.fredkin(control, target1, target2);
  }
  // =========================================================================
  // Multi-Qubit Operations
  // =========================================================================
  /**
   * Quantum Fourier Transform on specified qubits
   */
  qft(qubits) {
    this.checkDisposed();
    for (const q of qubits) {
      this.checkQubit(q);
    }
    const ptr = this.memory.allocInt32Array(qubits.length);
    this.memory.writeInt32Array(ptr, qubits);
    this.module._gate_qft(this.statePtr, ptr, qubits.length);
    this.memory.free(ptr);
    return this;
  }
  /**
   * Inverse Quantum Fourier Transform
   */
  iqft(qubits) {
    this.checkDisposed();
    for (const q of qubits) {
      this.checkQubit(q);
    }
    const ptr = this.memory.allocInt32Array(qubits.length);
    this.memory.writeInt32Array(ptr, qubits);
    this.module._gate_iqft(this.statePtr, ptr, qubits.length);
    this.memory.free(ptr);
    return this;
  }
  // =========================================================================
  // State Queries
  // =========================================================================
  /**
   * Get all amplitudes as complex numbers
   */
  getAmplitudes() {
    this.checkDisposed();
    const amplitudesPtr = this.memory.readPointer(
      this.statePtr + AMPLITUDES_OFFSET
    );
    return this.memory.readComplexArray(amplitudesPtr, this.stateDim);
  }
  /**
   * Set amplitudes (must have correct dimension)
   */
  setAmplitudes(amplitudes) {
    this.checkDisposed();
    if (amplitudes.length !== this.stateDim) {
      throw new Error(
        `Expected ${this.stateDim} amplitudes, got ${amplitudes.length}`
      );
    }
    const amplitudesPtr = this.memory.readPointer(
      this.statePtr + AMPLITUDES_OFFSET
    );
    this.memory.writeComplexArray(amplitudesPtr, amplitudes);
    return this;
  }
  /**
   * Get probability distribution for all basis states
   */
  getProbabilities() {
    this.checkDisposed();
    const ptr = this.memory.allocFloat64Array(this.stateDim);
    this.module._measurement_probability_distribution(this.statePtr, ptr);
    const probs = this.memory.readFloat64Array(ptr, this.stateDim);
    this.memory.free(ptr);
    return probs;
  }
  /**
   * Get probability of a specific basis state
   */
  probability(basisState) {
    this.checkDisposed();
    if (basisState < 0 || basisState >= this.stateDim) {
      throw new Error(`Basis state must be between 0 and ${this.stateDim - 1}`);
    }
    return this.module._quantum_state_get_probability(this.statePtr, basisState);
  }
  // =========================================================================
  // Measurement
  // =========================================================================
  /**
   * Measure a single qubit (collapses state)
   * @returns 0 or 1
   */
  measure(qubit) {
    this.checkDisposed();
    this.checkQubit(qubit);
    const randomValue = Math.random();
    return this.module._measurement_single_qubit(
      this.statePtr,
      qubit,
      randomValue
    );
  }
  /**
   * Measure all qubits (collapses state)
   * @returns Basis state index (0 to 2^n - 1)
   */
  measureAll() {
    this.checkDisposed();
    const randomValue = Math.random();
    const measured = this.module._measurement_all_qubits(this.statePtr, randomValue);
    if (typeof measured === "bigint") {
      if (measured < 0n || measured > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(`Measured basis state ${measured.toString()} exceeds JS safe integer range`);
      }
      return Number(measured);
    }
    return measured;
  }
  /**
   * Get probability of measuring |0⟩ on a qubit (non-destructive)
   */
  probabilityZero(qubit) {
    this.checkDisposed();
    this.checkQubit(qubit);
    return this.module._measurement_probability_zero(this.statePtr, qubit);
  }
  /**
   * Get probability of measuring |1⟩ on a qubit (non-destructive)
   */
  probabilityOne(qubit) {
    this.checkDisposed();
    this.checkQubit(qubit);
    return this.module._measurement_probability_one(this.statePtr, qubit);
  }
  // =========================================================================
  // Expectation Values
  // =========================================================================
  /**
   * Expectation value of Z operator on a qubit
   * ⟨Z⟩ = P(0) - P(1)
   */
  expectationZ(qubit) {
    this.checkDisposed();
    this.checkQubit(qubit);
    return this.module._measurement_expectation_z(this.statePtr, qubit);
  }
  /**
   * Expectation value of X operator on a qubit
   */
  expectationX(qubit) {
    this.checkDisposed();
    this.checkQubit(qubit);
    return this.module._measurement_expectation_x(this.statePtr, qubit);
  }
  /**
   * Expectation value of Y operator on a qubit
   */
  expectationY(qubit) {
    this.checkDisposed();
    this.checkQubit(qubit);
    return this.module._measurement_expectation_y(this.statePtr, qubit);
  }
  /**
   * Two-qubit ZZ correlation ⟨Z_i Z_j⟩
   */
  correlationZZ(qubit1, qubit2) {
    this.checkDisposed();
    this.checkQubit(qubit1);
    this.checkQubit(qubit2);
    return this.module._measurement_correlation_zz(
      this.statePtr,
      qubit1,
      qubit2
    );
  }
  // =========================================================================
  // State Properties
  // =========================================================================
  /**
   * Von Neumann entropy of the state
   */
  entropy() {
    this.checkDisposed();
    return this.module._quantum_state_entropy(this.statePtr);
  }
  /**
   * Purity of the state (1 for pure states)
   */
  purity() {
    this.checkDisposed();
    return this.module._quantum_state_purity(this.statePtr);
  }
  /**
   * Fidelity with another state
   * F = |⟨ψ|φ⟩|²
   */
  fidelity(other) {
    this.checkDisposed();
    other.checkDisposed();
    if (this._numQubits !== other._numQubits) {
      throw new Error("States must have same number of qubits");
    }
    return this.module._quantum_state_fidelity(this.statePtr, other.statePtr);
  }
  // =========================================================================
  // Cleanup
  // =========================================================================
  /**
   * Dispose of the state and free memory
   * Must be called when done with the state
   */
  dispose() {
    if (!this._disposed) {
      this.module._quantum_state_free(this.statePtr);
      this.memory.free(this.statePtr);
      this._disposed = true;
    }
  }
  // =========================================================================
  // Internal Helpers
  // =========================================================================
  checkDisposed() {
    if (this._disposed) {
      throw new Error("QuantumState has been disposed");
    }
  }
  checkQubit(qubit) {
    if (qubit < 0 || qubit >= this._numQubits) {
      throw new Error(
        `Qubit index ${qubit} out of range [0, ${this._numQubits - 1}]`
      );
    }
  }
  /**
   * Get the internal pointer (for advanced usage)
   * @internal
   */
  get _ptr() {
    return this.statePtr;
  }
};

// src/ca-mps.ts
var _cachedModule = null;
async function _resolveModule() {
  if (_cachedModule) return _cachedModule;
  _cachedModule = await getModule();
  return _cachedModule;
}
var Warmstart = /* @__PURE__ */ ((Warmstart2) => {
  Warmstart2[Warmstart2["Identity"] = 0] = "Identity";
  Warmstart2[Warmstart2["HAll"] = 1] = "HAll";
  Warmstart2[Warmstart2["DualTfim"] = 2] = "DualTfim";
  Warmstart2[Warmstart2["FerroTfim"] = 3] = "FerroTfim";
  Warmstart2[Warmstart2["StabilizerSubgroup"] = 4] = "StabilizerSubgroup";
  return Warmstart2;
})(Warmstart || {});
var StatusModule = /* @__PURE__ */ ((StatusModule2) => {
  StatusModule2[StatusModule2["Generic"] = 0] = "Generic";
  StatusModule2[StatusModule2["CaMps"] = 1] = "CaMps";
  StatusModule2[StatusModule2["CaMpsVarD"] = 2] = "CaMpsVarD";
  StatusModule2[StatusModule2["CaMpsStabWarmstart"] = 3] = "CaMpsStabWarmstart";
  StatusModule2[StatusModule2["CaPeps"] = 4] = "CaPeps";
  StatusModule2[StatusModule2["TnState"] = 5] = "TnState";
  StatusModule2[StatusModule2["TnGate"] = 6] = "TnGate";
  StatusModule2[StatusModule2["TnMeasure"] = 7] = "TnMeasure";
  StatusModule2[StatusModule2["Tensor"] = 8] = "Tensor";
  StatusModule2[StatusModule2["Contract"] = 9] = "Contract";
  StatusModule2[StatusModule2["SvdCompress"] = 10] = "SvdCompress";
  StatusModule2[StatusModule2["Clifford"] = 11] = "Clifford";
  StatusModule2[StatusModule2["Partition"] = 12] = "Partition";
  StatusModule2[StatusModule2["DistGate"] = 13] = "DistGate";
  StatusModule2[StatusModule2["MpiBridge"] = 14] = "MpiBridge";
  return StatusModule2;
})(StatusModule || {});
var CaMps = class _CaMps {
  /** Internal: use {@link CaMps.create} instead. */
  constructor(handle, mod) {
    this.freed = false;
    this.handle = handle;
    this.mod = mod;
  }
  /** Allocate a CA-MPS state on `numQubits` with the given truncation
   * cap. */
  static async create(numQubits, maxBondDim = 32) {
    const mod = await _resolveModule();
    const h2 = mod._moonlab_ca_mps_create(numQubits, maxBondDim);
    if (!h2) throw new Error("moonlab_ca_mps_create returned NULL");
    return new _CaMps(h2, mod);
  }
  /** Release the underlying WASM allocation. */
  dispose() {
    if (this.freed) return;
    this.mod._moonlab_ca_mps_free(this.handle);
    this.freed = true;
  }
  get numQubits() {
    return this.mod._moonlab_ca_mps_num_qubits(this.handle);
  }
  get bondDim() {
    return this.mod._moonlab_ca_mps_current_bond_dim(this.handle);
  }
  get norm() {
    return this.mod._moonlab_ca_mps_norm(this.handle);
  }
  // --- Clifford gates: tableau-only, no MPS cost. ---
  h(q) {
    this.call1q("h", q);
    return this;
  }
  s(q) {
    this.call1q("s", q);
    return this;
  }
  sdag(q) {
    this.call1q("sdag", q);
    return this;
  }
  x(q) {
    this.call1q("x", q);
    return this;
  }
  y(q) {
    this.call1q("y", q);
    return this;
  }
  z(q) {
    this.call1q("z", q);
    return this;
  }
  cnot(c, t) {
    this.call2q("cnot", c, t);
    return this;
  }
  cz(a, b) {
    this.call2q("cz", a, b);
    return this;
  }
  swap(a, b) {
    this.call2q("swap", a, b);
    return this;
  }
  // --- Non-Clifford rotations: pushed into the MPS factor. ---
  rx(q, theta) {
    this.call1qParam("rx", q, theta);
    return this;
  }
  ry(q, theta) {
    this.call1qParam("ry", q, theta);
    return this;
  }
  rz(q, theta) {
    this.call1qParam("rz", q, theta);
    return this;
  }
  tGate(q) {
    this.call1q("t_gate", q);
    return this;
  }
  tDagger(q) {
    this.call1q("t_dagger", q);
    return this;
  }
  phase(q, theta) {
    this.call1qParam("phase", q, theta);
    return this;
  }
  /** Renormalise after non-unitary evolution (e.g. imag-time). */
  normalize() {
    const fn = `_moonlab_ca_mps_normalize`;
    const m = this.mod;
    const rc = m[fn](this.handle);
    if (rc !== 0) {
      throw new Error(
        `moonlab_ca_mps_normalize -> ${statusString(1 /* CaMps */, rc)}`
      );
    }
    return this;
  }
  /** Born-rule sequential sampler over the Z basis.
   *
   * Wires directly to `moonlab_ca_mps_sample_z` (since v0.10.0 on the C
   * side, JS parity since v1.0).  Caller supplies `numSamples * n`
   * uniform reals in `[0, 1)` — these are consumed in row-major order
   * `(sample, qubit)` so deterministic seeds give reproducible bit
   * strings.  Returns a `Uint8Array` of length `numSamples * n` where
   * `out[s * n + i]` is the i-th bit of the s-th sample.
   *
   * Note: the underlying MPS factor is mutated by the sequential
   * projection-and-renormalise loop; if you want to sample multiple
   * batches from the same `|psi>` snapshot, sample once or clone the
   * state ahead of time (the C API documents the same caveat).
   */
  sampleZ(numSamples, randomValues) {
    const n = this.numQubits;
    const need = numSamples * n;
    if (randomValues.length !== need) {
      throw new Error(
        `sampleZ: randomValues.length=${randomValues.length} must equal numSamples*n=${need}`
      );
    }
    if (numSamples === 0) {
      return new Uint8Array(0);
    }
    const m = this.mod;
    const rPtr = m._malloc(need * 8);
    const bPtr = m._malloc(need);
    try {
      m.HEAPF64.set(randomValues, rPtr >>> 3);
      const rc = m._moonlab_ca_mps_sample_z(this.handle, numSamples, rPtr, bPtr);
      if (rc !== 0) {
        throw new Error(
          `moonlab_ca_mps_sample_z -> ${statusString(1 /* CaMps */, rc)}`
        );
      }
      return new Uint8Array(m.HEAPU8.buffer, bPtr, need).slice();
    } finally {
      m._free(rPtr);
      m._free(bPtr);
    }
  }
  /** Apply the gauge-aware warmstart Clifford in place.  See
   * {@link gaugeWarmstart}. */
  gaugeWarmstart(paulis, numGens) {
    if (paulis.length !== this.numQubits * numGens) {
      throw new Error(
        `gaugeWarmstart: paulis.length=${paulis.length} != numGens*numQubits=${this.numQubits * numGens}`
      );
    }
    const m = this.mod;
    const ptr = m._malloc(paulis.length);
    try {
      m.HEAPU8.set(paulis, ptr);
      const rc = m._moonlab_ca_mps_apply_stab_subgroup_warmstart(
        this.handle,
        ptr,
        numGens
      );
      if (rc !== 0) {
        throw new Error(
          `gaugeWarmstart -> ${statusString(3 /* CaMpsStabWarmstart */, rc)}`
        );
      }
    } finally {
      m._free(ptr);
    }
    return this;
  }
  // --- Internal helpers ---
  call1q(name, q) {
    const fn = `_moonlab_ca_mps_${name}`;
    const m = this.mod;
    const rc = m[fn](this.handle, q);
    if (rc !== 0) {
      throw new Error(
        `moonlab_ca_mps_${name}(${q}) -> ${statusString(1 /* CaMps */, rc)}`
      );
    }
  }
  call2q(name, a, b) {
    const fn = `_moonlab_ca_mps_${name}`;
    const m = this.mod;
    const rc = m[fn](this.handle, a, b);
    if (rc !== 0) {
      throw new Error(
        `moonlab_ca_mps_${name}(${a},${b}) -> ${statusString(1 /* CaMps */, rc)}`
      );
    }
  }
  call1qParam(name, q, theta) {
    const fn = `_moonlab_ca_mps_${name}`;
    const m = this.mod;
    const rc = m[fn](this.handle, q, theta);
    if (rc !== 0) {
      throw new Error(
        `moonlab_ca_mps_${name}(${q},${theta}) -> ${statusString(1 /* CaMps */, rc)}`
      );
    }
  }
  /** Used by free functions in this module to access the WASM module. */
  _internal_module() {
    return this.mod;
  }
  _internal_handle() {
    return this.handle;
  }
};
var VAR_D_ALT_CONFIG_BYTES = 56;
var VAR_D_ALT_RESULT_BYTES = 48;
async function varDRun(state, paulis, coeffs, numTerms, cfg = {}) {
  const n = state.numQubits;
  if (paulis.length !== n * numTerms || coeffs.length !== numTerms) {
    throw new Error(
      `varDRun: paulis.length=${paulis.length} or coeffs.length=${coeffs.length} does not match num_terms=${numTerms} * num_qubits=${n}`
    );
  }
  const m = state._internal_module();
  const paulisPtr = m._malloc(paulis.length);
  const coeffsPtr = m._malloc(coeffs.length * 8);
  const configPtr = m._malloc(VAR_D_ALT_CONFIG_BYTES);
  const resultPtr = m._malloc(VAR_D_ALT_RESULT_BYTES);
  let stabPaulisPtr = 0;
  const wantStab = cfg.warmstart === 4 /* StabilizerSubgroup */;
  const stabBytes = wantStab && cfg.stabPaulis ? cfg.stabPaulis.length : 0;
  if (wantStab && (!cfg.stabPaulis || cfg.stabNumGens === void 0)) {
    m._free(paulisPtr);
    m._free(coeffsPtr);
    m._free(configPtr);
    m._free(resultPtr);
    throw new Error(
      "varDRun: warmstart=StabilizerSubgroup requires stabPaulis + stabNumGens"
    );
  }
  if (stabBytes) {
    stabPaulisPtr = m._malloc(stabBytes);
  }
  try {
    m.HEAPU8.set(paulis, paulisPtr);
    m.HEAPF64.set(coeffs, coeffsPtr / 8);
    if (stabPaulisPtr) {
      m.HEAPU8.set(cfg.stabPaulis, stabPaulisPtr);
    }
    const i32 = m.HEAP32;
    const u32 = m.HEAPU32;
    const f64 = m.HEAPF64;
    const cfg32 = configPtr >>> 2;
    const cfgF64 = configPtr >>> 3;
    m.HEAPU8.fill(0, configPtr, configPtr + VAR_D_ALT_CONFIG_BYTES);
    i32[cfg32 + 0] = cfg.maxOuterIters ?? 30;
    f64[cfgF64 + 1] = cfg.imagTimeDtau ?? 0.1;
    i32[cfg32 + 4] = cfg.imagTimeStepsPerOuter ?? 5;
    i32[cfg32 + 5] = cfg.cliffordPassesPerOuter ?? 10;
    f64[cfgF64 + 3] = 1e-7;
    i32[cfg32 + 8] = 1;
    i32[cfg32 + 9] = cfg.composite2gate ? 1 : 0;
    i32[cfg32 + 10] = cfg.warmstart ?? 0 /* Identity */;
    u32[cfg32 + 11] = stabPaulisPtr;
    u32[cfg32 + 12] = wantStab ? cfg.stabNumGens ?? 0 : 0;
    i32[cfg32 + 13] = 0;
    m.HEAPU8.fill(0, resultPtr, resultPtr + VAR_D_ALT_RESULT_BYTES);
    const rc = m._moonlab_ca_mps_optimize_var_d_alternating(
      state._internal_handle(),
      paulisPtr,
      coeffsPtr,
      numTerms,
      configPtr,
      resultPtr
    );
    if (rc !== 0) {
      throw new Error(
        `varDRun (optimize_var_d_alternating) -> ${statusString(2 /* CaMpsVarD */, rc)}`
      );
    }
    const resF64 = resultPtr >>> 3;
    const res32 = resultPtr >>> 2;
    return {
      initialEnergy: f64[resF64 + 0],
      finalEnergy: f64[resF64 + 1],
      initialPhiEntropy: f64[resF64 + 2],
      finalPhiEntropy: f64[resF64 + 3],
      totalGatesAdded: i32[res32 + 8],
      outerIterations: i32[res32 + 9],
      converged: i32[res32 + 10] !== 0
    };
  } finally {
    m._free(paulisPtr);
    m._free(coeffsPtr);
    m._free(configPtr);
    m._free(resultPtr);
    if (stabPaulisPtr) m._free(stabPaulisPtr);
  }
}
function gaugeWarmstart(state, paulis, numGens) {
  state.gaugeWarmstart(paulis, numGens);
}
var Z2_LGT_CONFIG_BYTES = 40;
function fillZ2Config(m, numMatterSites, tHop, hLink, mass, gaussPenalty) {
  const ptr = m._malloc(Z2_LGT_CONFIG_BYTES);
  m.HEAPU8.fill(0, ptr, ptr + Z2_LGT_CONFIG_BYTES);
  m.HEAPU32[(ptr >>> 2) + 0] = numMatterSites;
  const f64 = ptr >>> 3;
  m.HEAPF64[f64 + 1] = tHop;
  m.HEAPF64[f64 + 2] = hLink;
  m.HEAPF64[f64 + 3] = mass;
  m.HEAPF64[f64 + 4] = gaussPenalty;
  return ptr;
}
async function z2Lgt1dBuild(numMatterSites, tHop = 1, hLink = 1, mass = 0, gaussPenalty = 0) {
  const mod = await _resolveModule();
  const m = mod;
  const cfgPtr = fillZ2Config(m, numMatterSites, tHop, hLink, mass, gaussPenalty);
  const outPP = m._malloc(4);
  const outCC = m._malloc(4);
  const outT = m._malloc(4);
  const outQ = m._malloc(4);
  try {
    const rc = m._z2_lgt_1d_build_pauli_sum(cfgPtr, outPP, outCC, outT, outQ);
    if (rc !== 0) {
      throw new Error(`z2_lgt_1d_build_pauli_sum returned ${rc}`);
    }
    const pPtr = m.HEAPU32[outPP / 4];
    const cPtr = m.HEAPU32[outCC / 4];
    const T = m.HEAPU32[outT / 4];
    const Q = m.HEAPU32[outQ / 4];
    const total = T * Q;
    const paulis = new Uint8Array(m.HEAPU8.buffer, pPtr, total).slice();
    const coeffs = new Float64Array(m.HEAPF64.buffer, cPtr, T).slice();
    m._free(pPtr);
    m._free(cPtr);
    return { paulis, coeffs, numQubits: Q, numTerms: T };
  } finally {
    m._free(cfgPtr);
    m._free(outPP);
    m._free(outCC);
    m._free(outT);
    m._free(outQ);
  }
}
async function z2Lgt1dGaussLaw(numMatterSites, siteX) {
  const mod = await _resolveModule();
  const nq = 2 * numMatterSites - 1;
  const m = mod;
  const cfgPtr = fillZ2Config(m, numMatterSites, 0, 0, 0, 0);
  const ptr = m._malloc(nq);
  try {
    const rc = m._z2_lgt_1d_gauss_law_pauli(cfgPtr, siteX, ptr);
    if (rc !== 0) {
      throw new Error(
        `z2_lgt_1d_gauss_law_pauli(N=${numMatterSites}, x=${siteX}) returned ${rc}`
      );
    }
    return new Uint8Array(m.HEAPU8.buffer, ptr, nq).slice();
  } finally {
    m._free(ptr);
    m._free(cfgPtr);
  }
}
function statusString(module, status) {
  try {
    const cached = _cachedModule;
    if (cached?._moonlab_status_to_string && cached.UTF8ToString) {
      const p = cached._moonlab_status_to_string(module, status);
      return cached.UTF8ToString(p);
    }
  } catch {
  }
  return `<module=${module} status=${status}>`;
}

// src/noise.ts
var noise_exports = {};
__export(noise_exports, {
  DeviceNoiseModel: () => DeviceNoiseModel,
  amplitudeDamping: () => amplitudeDamping,
  bitFlip: () => bitFlip,
  bitPhaseFlip: () => bitPhaseFlip,
  depolarizing: () => depolarizing,
  depolarizing2: () => depolarizing2,
  phaseDamping: () => phaseDamping,
  phaseFlip: () => phaseFlip,
  pureDephasing: () => pureDephasing,
  readoutError: () => readoutError,
  thermalRelaxation: () => thermalRelaxation
});
function modAndPtr(state) {
  const mod = state._internal_module();
  const ptr = state._internal_state_pointer();
  return { mod, ptr };
}
function cryptoUniform() {
  const buf = new Uint32Array(2);
  globalThis.crypto.getRandomValues(buf);
  return ((buf[0] >>> 6) * 134217728 + (buf[1] >>> 5)) / 9007199254740992;
}
var defaultRng = cryptoUniform;
function draw(rv) {
  return rv === void 0 ? defaultRng() : rv;
}
function normalDraw() {
  let u = defaultRng();
  if (u <= 0) u = Number.MIN_VALUE;
  const v = defaultRng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function depolarizing(state, qubit, p, randomValue) {
  const { mod, ptr } = modAndPtr(state);
  mod._noise_depolarizing_single(ptr, qubit, p, draw(randomValue));
}
function depolarizing2(state, qubit1, qubit2, p, randomValue) {
  const { mod, ptr } = modAndPtr(state);
  mod._noise_depolarizing_two_qubit(ptr, qubit1, qubit2, p, draw(randomValue));
}
function amplitudeDamping(state, qubit, gamma, randomValue) {
  const { mod, ptr } = modAndPtr(state);
  mod._noise_amplitude_damping(ptr, qubit, gamma, draw(randomValue));
}
function phaseDamping(state, qubit, gamma, randomValue) {
  const { mod, ptr } = modAndPtr(state);
  mod._noise_phase_damping(ptr, qubit, gamma, draw(randomValue));
}
function pureDephasing(state, qubit, sigma, randomPhase) {
  const { mod, ptr } = modAndPtr(state);
  mod._noise_pure_dephasing(
    ptr,
    qubit,
    sigma,
    randomPhase === void 0 ? normalDraw() : randomPhase
  );
}
function bitFlip(state, qubit, p, randomValue) {
  const { mod, ptr } = modAndPtr(state);
  mod._noise_bit_flip(ptr, qubit, p, draw(randomValue));
}
function phaseFlip(state, qubit, p, randomValue) {
  const { mod, ptr } = modAndPtr(state);
  mod._noise_phase_flip(ptr, qubit, p, draw(randomValue));
}
function bitPhaseFlip(state, qubit, p, randomValue) {
  const { mod, ptr } = modAndPtr(state);
  mod._noise_bit_phase_flip(ptr, qubit, p, draw(randomValue));
}
function thermalRelaxation(state, qubit, t1, t2, duration, randomValues) {
  const { mod, ptr } = modAndPtr(state);
  const rvs = randomValues ?? [defaultRng(), defaultRng()];
  const rvsPtr = mod._malloc(16);
  try {
    mod.HEAPF64[rvsPtr >> 3] = rvs[0];
    mod.HEAPF64[(rvsPtr >> 3) + 1] = rvs[1];
    mod._noise_thermal_relaxation(ptr, qubit, t1, t2, duration, rvsPtr);
  } finally {
    mod._free(rvsPtr);
  }
}
async function readoutError(outcome, error0to1, error1to0, randomValue) {
  const mod = await getModule();
  return mod._noise_readout_error(outcome, error0to1, error1to0, draw(randomValue));
}
var DeviceNoiseModel = class _DeviceNoiseModel {
  constructor(ptr, mod, rng) {
    this.freed = false;
    this.ptr = ptr;
    this.mod = mod;
    this.rng = rng;
  }
  /** Build a model from explicit per-channel rates. */
  static async create(options = {}) {
    const mod = await getModule();
    const ptr = mod._noise_model_create();
    if (!ptr) throw new Error("noise_model_create returned NULL");
    const m = new _DeviceNoiseModel(ptr, mod, options.rng ?? defaultRng);
    if (options.depolarizingRate !== void 0) {
      mod._noise_model_set_depolarizing(ptr, options.depolarizingRate);
    }
    if (options.amplitudeDampingRate !== void 0) {
      mod._noise_model_set_amplitude_damping(ptr, options.amplitudeDampingRate);
    }
    if (options.phaseDampingRate !== void 0) {
      mod._noise_model_set_phase_damping(ptr, options.phaseDampingRate);
    }
    if (options.t1 !== void 0 && options.t2 !== void 0) {
      mod._noise_model_set_thermal(ptr, options.t1, options.t2);
    }
    if (options.gateTime !== void 0) {
      mod._noise_model_set_gate_time(ptr, options.gateTime);
    }
    if (options.readoutError !== void 0) {
      mod._noise_model_set_readout_error(
        ptr,
        options.readoutError[0],
        options.readoutError[1]
      );
    }
    return m;
  }
  /** Build a model from device-style figures of merit: T1/T2 in
   *  microseconds, a per-gate error rate, and a readout error
   *  probability (`noise_model_create_realistic`). */
  static async realistic(t1Us, t2Us, gateError, readoutErrorProb, rng) {
    const mod = await getModule();
    const ptr = mod._noise_model_create_realistic(t1Us, t2Us, gateError, readoutErrorProb);
    if (!ptr) throw new Error("noise_model_create_realistic returned NULL");
    return new _DeviceNoiseModel(ptr, mod, rng ?? defaultRng);
  }
  /** Internal: WASM pointer to the underlying `noise_model_t`. */
  _internal_ptr() {
    if (this.freed) throw new Error("DeviceNoiseModel disposed");
    return this.ptr;
  }
  /** Enable / disable the model (disabled models are no-ops). */
  setEnabled(enabled) {
    this.mod._noise_model_set_enabled(this._internal_ptr(), enabled ? 1 : 0);
  }
  applyWithDraws(stateFn, numDraws, randomValues) {
    const mod = this.mod;
    const rvsPtr = mod._malloc(numDraws * 8);
    try {
      for (let i = 0; i < numDraws; i++) {
        mod.HEAPF64[(rvsPtr >> 3) + i] = randomValues !== void 0 && i < randomValues.length ? randomValues[i] : this.rng();
      }
      stateFn(rvsPtr);
    } finally {
      mod._free(rvsPtr);
    }
  }
  /** Apply one noise trajectory to `qubit` (call after a single-qubit
   *  gate).  Consumes up to 6 uniform draws. */
  applySingle(state, qubit, randomValues) {
    const ptr = this._internal_ptr();
    const { mod, ptr: statePtr } = modAndPtr(state);
    this.applyWithDraws(
      (rvsPtr) => mod._noise_apply_model(statePtr, qubit, ptr, rvsPtr),
      6,
      randomValues
    );
  }
  /** Apply one noise trajectory to a two-qubit gate on `qubitA`,
   *  `qubitB`.  Consumes up to 10 uniform draws. */
  applyTwo(state, qubitA, qubitB, randomValues) {
    const ptr = this._internal_ptr();
    const { mod, ptr: statePtr } = modAndPtr(state);
    this.applyWithDraws(
      (rvsPtr) => mod._noise_apply_model_two_qubit(statePtr, qubitA, qubitB, ptr, rvsPtr),
      10,
      randomValues
    );
  }
  /** Release the underlying C allocation. */
  dispose() {
    if (this.freed) return;
    this.mod._noise_model_destroy(this.ptr);
    this.freed = true;
  }
};

// src/pauli-frame.ts
var pauli_frame_exports = {};
__export(pauli_frame_exports, {
  PfOpKind: () => PfOpKind,
  cnot: () => cnot,
  cz: () => cz,
  depolarize1: () => depolarize1,
  depolarize2: () => depolarize2,
  h: () => h,
  measure: () => measure,
  measureNoisy: () => measureNoisy,
  numMeasurements: () => numMeasurements,
  reset: () => reset,
  s: () => s,
  sampleCircuit: () => sampleCircuit,
  sampleDetectors: () => sampleDetectors,
  sdag: () => sdag,
  simdBackend: () => simdBackend,
  simdLanes: () => simdLanes,
  swap: () => swap,
  x: () => x,
  xError: () => xError,
  y: () => y,
  yError: () => yError,
  z: () => z,
  zError: () => zError
});
var PfOpKind = /* @__PURE__ */ ((PfOpKind2) => {
  PfOpKind2[PfOpKind2["H"] = 0] = "H";
  PfOpKind2[PfOpKind2["S"] = 1] = "S";
  PfOpKind2[PfOpKind2["SDag"] = 2] = "SDag";
  PfOpKind2[PfOpKind2["X"] = 3] = "X";
  PfOpKind2[PfOpKind2["Y"] = 4] = "Y";
  PfOpKind2[PfOpKind2["Z"] = 5] = "Z";
  PfOpKind2[PfOpKind2["Cnot"] = 6] = "Cnot";
  PfOpKind2[PfOpKind2["Cz"] = 7] = "Cz";
  PfOpKind2[PfOpKind2["Swap"] = 8] = "Swap";
  PfOpKind2[PfOpKind2["Reset"] = 9] = "Reset";
  PfOpKind2[PfOpKind2["Measure"] = 10] = "Measure";
  PfOpKind2[PfOpKind2["XError"] = 11] = "XError";
  PfOpKind2[PfOpKind2["ZError"] = 12] = "ZError";
  PfOpKind2[PfOpKind2["YError"] = 13] = "YError";
  PfOpKind2[PfOpKind2["Depolarize1"] = 14] = "Depolarize1";
  PfOpKind2[PfOpKind2["Depolarize2"] = 15] = "Depolarize2";
  PfOpKind2[PfOpKind2["MeasureNoisy"] = 16] = "MeasureNoisy";
  return PfOpKind2;
})(PfOpKind || {});
function h(q) {
  return { kind: 0 /* H */, q0: q };
}
function s(q) {
  return { kind: 1 /* S */, q0: q };
}
function sdag(q) {
  return { kind: 2 /* SDag */, q0: q };
}
function x(q) {
  return { kind: 3 /* X */, q0: q };
}
function y(q) {
  return { kind: 4 /* Y */, q0: q };
}
function z(q) {
  return { kind: 5 /* Z */, q0: q };
}
function cnot(c, t) {
  return { kind: 6 /* Cnot */, q0: c, q1: t };
}
function cz(a, b) {
  return { kind: 7 /* Cz */, q0: a, q1: b };
}
function swap(a, b) {
  return { kind: 8 /* Swap */, q0: a, q1: b };
}
function reset(q) {
  return { kind: 9 /* Reset */, q0: q };
}
function measure(q) {
  return { kind: 10 /* Measure */, q0: q };
}
function xError(q, p) {
  return { kind: 11 /* XError */, q0: q, p };
}
function zError(q, p) {
  return { kind: 12 /* ZError */, q0: q, p };
}
function yError(q, p) {
  return { kind: 13 /* YError */, q0: q, p };
}
function depolarize1(q, p) {
  return { kind: 14 /* Depolarize1 */, q0: q, p };
}
function depolarize2(a, b, p) {
  return { kind: 15 /* Depolarize2 */, q0: a, q1: b, p };
}
function measureNoisy(q, p) {
  return { kind: 16 /* MeasureNoisy */, q0: q, p };
}
var OP_SIZE = 24;
function marshalOps(mod, ops) {
  const ptr = mod._malloc(Math.max(ops.length, 1) * OP_SIZE);
  mod.HEAPU8.fill(0, ptr, ptr + ops.length * OP_SIZE);
  for (let i = 0; i < ops.length; i++) {
    const base = ptr + i * OP_SIZE;
    mod.HEAPU8[base] = ops[i].kind;
    mod.HEAPU32[base + 4 >> 2] = ops[i].q0 >>> 0;
    mod.HEAPU32[base + 8 >> 2] = (ops[i].q1 ?? 0) >>> 0;
    mod.HEAPF64[base + 16 >> 3] = ops[i].p ?? 0;
  }
  return ptr;
}
async function numMeasurements(ops) {
  const mod = await getModule();
  const opsPtr = marshalOps(mod, ops);
  try {
    return mod._pauli_frame_circuit_num_measurements(opsPtr, ops.length);
  } finally {
    mod._free(opsPtr);
  }
}
async function sampleCircuit(numQubits, ops, numShots, options = {}) {
  const mod = await getModule();
  const opsPtr = marshalOps(mod, ops);
  let outPtr = 0;
  try {
    const nMeas = mod._pauli_frame_circuit_num_measurements(opsPtr, ops.length);
    outPtr = mod._malloc(Math.max(nMeas * numShots, 1));
    const rc = mod._pauli_frame_batch_sample_circuit(
      numQubits,
      opsPtr,
      ops.length,
      numShots,
      BigInt(options.seed ?? 0),
      options.numThreads ?? 1,
      outPtr
    );
    if (rc < 0) {
      throw new Error(`pauli_frame_batch_sample_circuit failed (rc=${rc})`);
    }
    return {
      numMeasurements: rc,
      samples: mod.HEAPU8.slice(outPtr, outPtr + rc * numShots)
    };
  } finally {
    if (outPtr) mod._free(outPtr);
    mod._free(opsPtr);
  }
}
async function sampleDetectors(numQubits, ops, detectors, numShots, options = {}) {
  const mod = await getModule();
  const numDetectors = detectors.length;
  const totalIndices = detectors.reduce((acc, d) => acc + d.length, 0);
  const opsPtr = marshalOps(mod, ops);
  const offsetsPtr = mod._malloc((numDetectors + 1) * 4);
  const indicesPtr = mod._malloc(Math.max(totalIndices, 1) * 4);
  const outPtr = mod._malloc(Math.max(numDetectors * numShots, 1));
  try {
    let cursor = 0;
    for (let d = 0; d < numDetectors; d++) {
      mod.HEAPU32[(offsetsPtr >> 2) + d] = cursor;
      for (const m of detectors[d]) {
        mod.HEAPU32[(indicesPtr >> 2) + cursor] = m >>> 0;
        cursor++;
      }
    }
    mod.HEAPU32[(offsetsPtr >> 2) + numDetectors] = cursor;
    const rc = mod._pauli_frame_batch_sample_detectors(
      numQubits,
      opsPtr,
      ops.length,
      offsetsPtr,
      indicesPtr,
      numDetectors,
      numShots,
      BigInt(options.seed ?? 0),
      options.numThreads ?? 1,
      outPtr
    );
    if (rc < 0) {
      throw new Error(`pauli_frame_batch_sample_detectors failed (rc=${rc})`);
    }
    return mod.HEAPU8.slice(outPtr, outPtr + numDetectors * numShots);
  } finally {
    mod._free(outPtr);
    mod._free(indicesPtr);
    mod._free(offsetsPtr);
    mod._free(opsPtr);
  }
}
async function simdBackend() {
  const mod = await getModule();
  return mod.UTF8ToString(mod._pauli_frame_simd_backend());
}
async function simdLanes() {
  const mod = await getModule();
  return mod._pauli_frame_simd_lanes();
}

// src/uf-decoder.ts
var UF_BOUNDARY = 4294967295;
var UfDecoder = class _UfDecoder {
  constructor(ptr, mod, numDetectors, numObservables) {
    this.freed = false;
    this.ptr = ptr;
    this.mod = mod;
    this.nDetectors = numDetectors;
    this.nObservables = numObservables;
  }
  /**
   * Build a decoder from a detector error model in edge-list form
   * (`moonlab_uf_decoder_new`).
   *
   * @param numDetectors   number of detector nodes.
   * @param numObservables number of logical observables (<= 64).
   * @param edges          error mechanisms; see {@link UfEdge}.
   */
  static async create(numDetectors, numObservables, edges) {
    const mod = await getModule();
    const n = edges.length;
    if (n === 0) throw new Error("UfDecoder requires at least one edge");
    const weighted = edges.some((e) => e.weight !== void 0);
    const edgeAPtr = mod._malloc(n * 4);
    const edgeBPtr = mod._malloc(n * 4);
    const edgeObsPtr = mod._malloc(n * 8);
    const edgeWeightPtr = weighted ? mod._malloc(n * 8) : 0;
    try {
      for (let i = 0; i < n; i++) {
        mod.HEAPU32[(edgeAPtr >> 2) + i] = edges[i].a >>> 0;
        mod.HEAPU32[(edgeBPtr >> 2) + i] = edges[i].b >>> 0;
        const obs = BigInt(edges[i].observables ?? 0);
        mod.HEAPU32[(edgeObsPtr >> 2) + 2 * i] = Number(obs & 0xffffffffn);
        mod.HEAPU32[(edgeObsPtr >> 2) + 2 * i + 1] = Number(obs >> 32n & 0xffffffffn);
        if (weighted) {
          mod.HEAPF64[(edgeWeightPtr >> 3) + i] = edges[i].weight ?? 1;
        }
      }
      const ptr = mod._moonlab_uf_decoder_new(
        numDetectors,
        numObservables,
        edgeAPtr,
        edgeBPtr,
        edgeWeightPtr,
        edgeObsPtr,
        n
      );
      if (!ptr) {
        throw new Error("moonlab_uf_decoder_new returned NULL (invalid model?)");
      }
      return new _UfDecoder(ptr, mod, numDetectors, numObservables);
    } finally {
      if (edgeWeightPtr) mod._free(edgeWeightPtr);
      mod._free(edgeObsPtr);
      mod._free(edgeBPtr);
      mod._free(edgeAPtr);
    }
  }
  /** Number of detector nodes the decoder was built with. */
  get numDetectors() {
    return this.nDetectors;
  }
  /** Number of logical observables the decoder was built with. */
  get numObservables() {
    return this.nObservables;
  }
  /** Number of edges the decoder was built with. */
  get numEdges() {
    if (this.freed) throw new Error("UfDecoder disposed");
    return this.mod._moonlab_uf_decoder_num_edges(this.ptr);
  }
  /**
   * Decode a batch of shots (`moonlab_uf_decode_batch`).
   *
   * @param detectorData detector-major bytes: detector `i` of shot `s`
   *   at `detectorData[i * numShots + s]` -- the layout
   *   `pauliFrame.sampleDetectors` writes.  Must hold
   *   `numDetectors * numShots` bytes.
   * @param numShots     number of shots in the batch.
   * @param numThreads   <= 0 selects all cores (single-threaded on
   *   wasm32 where OpenMP is unavailable).
   * @returns observable-major bytes: observable `o` of shot `s` at
   *   `out[o * numShots + s]`, `numObservables * numShots` total.
   */
  decodeBatch(detectorData, numShots, numThreads = 1) {
    if (this.freed) throw new Error("UfDecoder disposed");
    const expected = this.nDetectors * numShots;
    if (detectorData.length !== expected) {
      throw new Error(
        `detectorData length ${detectorData.length} != numDetectors * numShots = ${expected}`
      );
    }
    const mod = this.mod;
    const detPtr = mod._malloc(Math.max(expected, 1));
    const outLen = this.nObservables * numShots;
    const outPtr = mod._malloc(Math.max(outLen, 1));
    try {
      mod.HEAPU8.set(detectorData, detPtr);
      const rc = mod._moonlab_uf_decode_batch(
        this.ptr,
        detPtr,
        numShots,
        numThreads,
        outPtr
      );
      if (rc !== numShots) {
        throw new Error(`moonlab_uf_decode_batch failed (rc=${rc})`);
      }
      return mod.HEAPU8.slice(outPtr, outPtr + outLen);
    } finally {
      mod._free(outPtr);
      mod._free(detPtr);
    }
  }
  /** Release the underlying C allocation. */
  dispose() {
    if (this.freed) return;
    this.mod._moonlab_uf_decoder_free(this.ptr);
    this.freed = true;
  }
};

// src/entanglement.ts
var entanglement_exports = {};
__export(entanglement_exports, {
  concurrence2Qubit: () => concurrence2Qubit,
  mutualInformation: () => mutualInformation,
  negativity2Qubit: () => negativity2Qubit,
  vonNeumannEntropy: () => vonNeumannEntropy
});
function withInt32Array(mod, arr, body) {
  const ptr = mod._malloc(arr.length * 4);
  try {
    const off = ptr >>> 2;
    for (let i = 0; i < arr.length; i++) mod.HEAP32[off + i] = arr[i] | 0;
    return body(ptr, arr.length);
  } finally {
    mod._free(ptr);
  }
}
function modAndPtr2(state) {
  const mod = state._internal_module();
  const ptr = state._internal_state_pointer();
  return { mod, ptr };
}
function vonNeumannEntropy(state, qubitsB) {
  const { mod, ptr } = modAndPtr2(state);
  return withInt32Array(
    mod,
    qubitsB,
    (qPtr, n) => mod._entanglement_entropy_bipartition(ptr, qPtr, n)
  );
}
function mutualInformation(state, qubitsA, qubitsB) {
  const { mod, ptr } = modAndPtr2(state);
  return withInt32Array(
    mod,
    qubitsA,
    (aPtr, na) => withInt32Array(
      mod,
      qubitsB,
      (bPtr, nb) => mod._entanglement_mutual_information(
        ptr,
        aPtr,
        na,
        bPtr,
        nb
      )
    )
  );
}
function concurrence2Qubit(state) {
  const { mod, ptr } = modAndPtr2(state);
  return mod._entanglement_concurrence_2qubit(ptr);
}
function negativity2Qubit(state) {
  const { mod, ptr } = modAndPtr2(state);
  return mod._entanglement_negativity_2qubit(ptr);
}

// src/circuit.ts
var Circuit = class _Circuit {
  /**
   * Create a new circuit
   * @param numQubits Number of qubits in the circuit
   * @param name Optional name for the circuit
   */
  constructor(numQubits, name) {
    this._gates = [];
    if (numQubits < 1 || numQubits > 30) {
      throw new Error("numQubits must be between 1 and 30");
    }
    this._numQubits = numQubits;
    this._name = name;
  }
  // =========================================================================
  // Properties
  // =========================================================================
  /**
   * Number of qubits in the circuit
   */
  get numQubits() {
    return this._numQubits;
  }
  /**
   * Circuit name
   */
  get name() {
    return this._name;
  }
  /**
   * Get all gates in the circuit
   */
  get gates() {
    return this._gates;
  }
  /**
   * Number of gates in the circuit
   */
  get length() {
    return this._gates.length;
  }
  // =========================================================================
  // Single-Qubit Gates
  // =========================================================================
  /**
   * Hadamard gate
   */
  h(qubit) {
    this.validateQubit(qubit);
    this._gates.push({ type: "h", qubit });
    return this;
  }
  /**
   * Pauli-X gate (NOT)
   */
  x(qubit) {
    this.validateQubit(qubit);
    this._gates.push({ type: "x", qubit });
    return this;
  }
  /**
   * Pauli-Y gate
   */
  y(qubit) {
    this.validateQubit(qubit);
    this._gates.push({ type: "y", qubit });
    return this;
  }
  /**
   * Pauli-Z gate
   */
  z(qubit) {
    this.validateQubit(qubit);
    this._gates.push({ type: "z", qubit });
    return this;
  }
  /**
   * S gate (sqrt Z)
   */
  s(qubit) {
    this.validateQubit(qubit);
    this._gates.push({ type: "s", qubit });
    return this;
  }
  /**
   * S-dagger gate
   */
  sdg(qubit) {
    this.validateQubit(qubit);
    this._gates.push({ type: "sdg", qubit });
    return this;
  }
  /**
   * T gate (sqrt S)
   */
  t(qubit) {
    this.validateQubit(qubit);
    this._gates.push({ type: "t", qubit });
    return this;
  }
  /**
   * T-dagger gate
   */
  tdg(qubit) {
    this.validateQubit(qubit);
    this._gates.push({ type: "tdg", qubit });
    return this;
  }
  // =========================================================================
  // Parameterized Single-Qubit Gates
  // =========================================================================
  /**
   * Rotation around X-axis
   */
  rx(qubit, angle) {
    this.validateQubit(qubit);
    this._gates.push({ type: "rx", qubit, params: [angle] });
    return this;
  }
  /**
   * Rotation around Y-axis
   */
  ry(qubit, angle) {
    this.validateQubit(qubit);
    this._gates.push({ type: "ry", qubit, params: [angle] });
    return this;
  }
  /**
   * Rotation around Z-axis
   */
  rz(qubit, angle) {
    this.validateQubit(qubit);
    this._gates.push({ type: "rz", qubit, params: [angle] });
    return this;
  }
  /**
   * Phase gate P(angle)
   */
  phase(qubit, angle) {
    this.validateQubit(qubit);
    this._gates.push({ type: "phase", qubit, params: [angle] });
    return this;
  }
  /**
   * General single-qubit unitary U3(theta, phi, lambda)
   */
  u3(qubit, theta, phi, lambda) {
    this.validateQubit(qubit);
    this._gates.push({ type: "u3", qubit, params: [theta, phi, lambda] });
    return this;
  }
  // =========================================================================
  // Two-Qubit Gates
  // =========================================================================
  /**
   * Controlled-NOT gate
   */
  cnot(control, target) {
    this.validateQubit(control);
    this.validateQubit(target);
    this.validateDifferent(control, target);
    this._gates.push({ type: "cnot", control, target });
    return this;
  }
  /**
   * Alias for CNOT
   */
  cx(control, target) {
    return this.cnot(control, target);
  }
  /**
   * Controlled-Z gate
   */
  cz(control, target) {
    this.validateQubit(control);
    this.validateQubit(target);
    this.validateDifferent(control, target);
    this._gates.push({ type: "cz", control, target });
    return this;
  }
  /**
   * Controlled-Y gate
   */
  cy(control, target) {
    this.validateQubit(control);
    this.validateQubit(target);
    this.validateDifferent(control, target);
    this._gates.push({ type: "cy", control, target });
    return this;
  }
  /**
   * SWAP gate
   */
  swap(qubit1, qubit2) {
    this.validateQubit(qubit1);
    this.validateQubit(qubit2);
    this._gates.push({ type: "swap", control: qubit1, target: qubit2 });
    return this;
  }
  /**
   * Controlled phase gate
   */
  cphase(control, target, angle) {
    this.validateQubit(control);
    this.validateQubit(target);
    this.validateDifferent(control, target);
    this._gates.push({ type: "cphase", control, target, param: angle });
    return this;
  }
  /**
   * Controlled Rx gate
   */
  crx(control, target, angle) {
    this.validateQubit(control);
    this.validateQubit(target);
    this.validateDifferent(control, target);
    this._gates.push({ type: "crx", control, target, param: angle });
    return this;
  }
  /**
   * Controlled Ry gate
   */
  cry(control, target, angle) {
    this.validateQubit(control);
    this.validateQubit(target);
    this.validateDifferent(control, target);
    this._gates.push({ type: "cry", control, target, param: angle });
    return this;
  }
  /**
   * Controlled Rz gate
   */
  crz(control, target, angle) {
    this.validateQubit(control);
    this.validateQubit(target);
    this.validateDifferent(control, target);
    this._gates.push({ type: "crz", control, target, param: angle });
    return this;
  }
  // =========================================================================
  // Three-Qubit Gates
  // =========================================================================
  /**
   * Toffoli gate (CCNOT)
   */
  toffoli(control1, control2, target) {
    this.validateQubit(control1);
    this.validateQubit(control2);
    this.validateQubit(target);
    this.validateAllDifferent([control1, control2, target]);
    this._gates.push({ type: "toffoli", qubits: [control1, control2, target] });
    return this;
  }
  /**
   * Alias for Toffoli
   */
  ccx(control1, control2, target) {
    return this.toffoli(control1, control2, target);
  }
  /**
   * Fredkin gate (CSWAP)
   */
  fredkin(control, target1, target2) {
    this.validateQubit(control);
    this.validateQubit(target1);
    this.validateQubit(target2);
    this.validateAllDifferent([control, target1, target2]);
    this._gates.push({ type: "fredkin", qubits: [control, target1, target2] });
    return this;
  }
  /**
   * Alias for Fredkin
   */
  cswap(control, target1, target2) {
    return this.fredkin(control, target1, target2);
  }
  // =========================================================================
  // Multi-Qubit Gates
  // =========================================================================
  /**
   * Quantum Fourier Transform
   */
  qft(qubits) {
    for (const q of qubits) {
      this.validateQubit(q);
    }
    this._gates.push({ type: "qft", qubits: [...qubits] });
    return this;
  }
  /**
   * Inverse Quantum Fourier Transform
   */
  iqft(qubits) {
    for (const q of qubits) {
      this.validateQubit(q);
    }
    this._gates.push({ type: "iqft", qubits: [...qubits] });
    return this;
  }
  // =========================================================================
  // Special Operations
  // =========================================================================
  /**
   * Add a barrier (for visualization, no effect on state)
   */
  barrier(qubits) {
    const qs = qubits ?? Array.from({ length: this._numQubits }, (_, i) => i);
    for (const q of qs) {
      this.validateQubit(q);
    }
    this._gates.push({ type: "barrier", qubits: qs });
    return this;
  }
  /**
   * Measure a qubit
   */
  measure(qubit, classicalBit) {
    this.validateQubit(qubit);
    this._gates.push({ type: "measure", qubit, classicalBit });
    return this;
  }
  /**
   * Measure all qubits
   */
  measureAll() {
    for (let i = 0; i < this._numQubits; i++) {
      this._gates.push({ type: "measure", qubit: i, classicalBit: i });
    }
    return this;
  }
  // =========================================================================
  // Circuit Composition
  // =========================================================================
  /**
   * Append another circuit to this one
   * @param other Circuit to append
   * @param offset Qubit offset for the appended circuit
   */
  append(other, offset = 0) {
    if (offset + other.numQubits > this._numQubits) {
      throw new Error(
        `Cannot append ${other.numQubits}-qubit circuit at offset ${offset} to ${this._numQubits}-qubit circuit`
      );
    }
    for (const gate of other._gates) {
      this._gates.push(this.offsetGate(gate, offset));
    }
    return this;
  }
  /**
   * Repeat the circuit n times
   */
  repeat(n) {
    if (n < 1) {
      throw new Error("Repeat count must be at least 1");
    }
    const originalGates = [...this._gates];
    for (let i = 1; i < n; i++) {
      this._gates.push(...originalGates.map((g) => ({ ...g })));
    }
    return this;
  }
  /**
   * Create inverse (dagger) of the circuit
   */
  inverse() {
    const inverse = new _Circuit(this._numQubits, `${this._name ?? "circuit"}\u2020`);
    for (let i = this._gates.length - 1; i >= 0; i--) {
      const gate = this._gates[i];
      inverse._gates.push(this.invertGate(gate));
    }
    return inverse;
  }
  // =========================================================================
  // Application
  // =========================================================================
  /**
   * Apply this circuit to a quantum state
   */
  apply(state) {
    if (state.numQubits !== this._numQubits) {
      throw new Error(
        `Circuit has ${this._numQubits} qubits but state has ${state.numQubits}`
      );
    }
    for (const gate of this._gates) {
      this.applyGate(state, gate);
    }
    return state;
  }
  // =========================================================================
  // Statistics
  // =========================================================================
  /**
   * Get circuit statistics
   */
  getStats() {
    const gateBreakdown = {};
    let singleQubitGates = 0;
    let twoQubitGates = 0;
    let threeQubitGates = 0;
    let measurements = 0;
    for (const gate of this._gates) {
      gateBreakdown[gate.type] = (gateBreakdown[gate.type] || 0) + 1;
      if (gate.type === "measure") {
        measurements++;
      } else if (gate.type === "barrier") {
      } else if (this.isSingleQubitGate(gate)) {
        singleQubitGates++;
      } else if (this.isTwoQubitGate(gate)) {
        twoQubitGates++;
      } else if (this.isThreeQubitGate(gate)) {
        threeQubitGates++;
      }
    }
    return {
      numQubits: this._numQubits,
      depth: this.calculateDepth(),
      totalGates: singleQubitGates + twoQubitGates + threeQubitGates + measurements,
      singleQubitGates,
      twoQubitGates,
      threeQubitGates,
      measurements,
      gateBreakdown
    };
  }
  /**
   * Calculate circuit depth
   */
  calculateDepth() {
    const qubitDepths = new Array(this._numQubits).fill(0);
    for (const gate of this._gates) {
      if (gate.type === "barrier" || gate.type === "measure") continue;
      const qubits = this.getGateQubits(gate);
      const maxDepth = Math.max(...qubits.map((q) => qubitDepths[q]));
      for (const q of qubits) {
        qubitDepths[q] = maxDepth + 1;
      }
    }
    return Math.max(...qubitDepths);
  }
  // =========================================================================
  // Serialization
  // =========================================================================
  /**
   * Convert circuit to JSON
   */
  toJSON() {
    return {
      numQubits: this._numQubits,
      name: this._name,
      gates: this._gates
    };
  }
  /**
   * Create circuit from JSON
   */
  static fromJSON(json) {
    const circuit = new _Circuit(json.numQubits, json.name);
    circuit._gates = json.gates;
    return circuit;
  }
  /**
   * Convert to OpenQASM 2.0 string
   */
  toQASM() {
    const lines = [
      "OPENQASM 2.0;",
      'include "qelib1.inc";',
      `qreg q[${this._numQubits}];`,
      `creg c[${this._numQubits}];`,
      ""
    ];
    for (const gate of this._gates) {
      lines.push(this.gateToQASM(gate));
    }
    return lines.join("\n");
  }
  // =========================================================================
  // Private Helpers
  // =========================================================================
  validateQubit(qubit) {
    if (qubit < 0 || qubit >= this._numQubits) {
      throw new Error(
        `Qubit ${qubit} out of range [0, ${this._numQubits - 1}]`
      );
    }
  }
  validateDifferent(q1, q2) {
    if (q1 === q2) {
      throw new Error("Control and target must be different qubits");
    }
  }
  validateAllDifferent(qubits) {
    const unique = new Set(qubits);
    if (unique.size !== qubits.length) {
      throw new Error("All qubits must be different");
    }
  }
  isSingleQubitGate(gate) {
    return "qubit" in gate && !("control" in gate) && gate.type !== "measure";
  }
  isTwoQubitGate(gate) {
    return "control" in gate && "target" in gate;
  }
  isThreeQubitGate(gate) {
    return "qubits" in gate && Array.isArray(gate.qubits) && gate.qubits.length === 3 && (gate.type === "toffoli" || gate.type === "ccx" || gate.type === "fredkin" || gate.type === "cswap");
  }
  getGateQubits(gate) {
    if ("qubit" in gate) {
      return [gate.qubit];
    }
    if ("control" in gate && "target" in gate) {
      return [gate.control, gate.target];
    }
    if ("qubits" in gate) {
      return gate.qubits;
    }
    return [];
  }
  offsetGate(gate, offset) {
    if ("qubit" in gate) {
      return { ...gate, qubit: gate.qubit + offset };
    }
    if ("control" in gate && "target" in gate) {
      return {
        ...gate,
        control: gate.control + offset,
        target: gate.target + offset
      };
    }
    if ("qubits" in gate) {
      const offsetQubits = gate.qubits.map((q) => q + offset);
      return { ...gate, qubits: offsetQubits };
    }
    return gate;
  }
  invertGate(gate) {
    switch (gate.type) {
      case "s":
        return { ...gate, type: "sdg" };
      case "sdg":
        return { ...gate, type: "s" };
      case "t":
        return { ...gate, type: "tdg" };
      case "tdg":
        return { ...gate, type: "t" };
      case "rx":
      case "ry":
      case "rz":
      case "phase":
        return {
          ...gate,
          params: [gate.params[0] * -1]
        };
      case "u3": {
        const [theta, phi, lambda] = gate.params;
        return {
          ...gate,
          params: [-theta, -lambda, -phi]
        };
      }
      case "cphase":
      case "crx":
      case "cry":
      case "crz":
        return {
          ...gate,
          param: -gate.param
        };
      default:
        return { ...gate };
    }
  }
  applyGate(state, gate) {
    switch (gate.type) {
      // Single-qubit gates
      case "h":
        state.h(gate.qubit);
        break;
      case "x":
        state.x(gate.qubit);
        break;
      case "y":
        state.y(gate.qubit);
        break;
      case "z":
        state.z(gate.qubit);
        break;
      case "s":
        state.s(gate.qubit);
        break;
      case "sdg":
        state.sdg(gate.qubit);
        break;
      case "t":
        state.t(gate.qubit);
        break;
      case "tdg":
        state.tdg(gate.qubit);
        break;
      // Parameterized single-qubit gates
      case "rx":
        state.rx(
          gate.qubit,
          gate.params[0]
        );
        break;
      case "ry":
        state.ry(
          gate.qubit,
          gate.params[0]
        );
        break;
      case "rz":
        state.rz(
          gate.qubit,
          gate.params[0]
        );
        break;
      case "phase":
        state.phase(
          gate.qubit,
          gate.params[0]
        );
        break;
      case "u3": {
        const p = gate.params;
        state.u3(gate.qubit, p[0], p[1], p[2]);
        break;
      }
      // Two-qubit gates
      case "cnot":
      case "cx":
        state.cnot(
          gate.control,
          gate.target
        );
        break;
      case "cz":
        state.cz(gate.control, gate.target);
        break;
      case "cy":
        state.cy(gate.control, gate.target);
        break;
      case "swap":
        state.swap(
          gate.control,
          gate.target
        );
        break;
      case "cphase":
        state.cphase(
          gate.control,
          gate.target,
          gate.param
        );
        break;
      case "crx":
        state.crx(
          gate.control,
          gate.target,
          gate.param
        );
        break;
      case "cry":
        state.cry(
          gate.control,
          gate.target,
          gate.param
        );
        break;
      case "crz":
        state.crz(
          gate.control,
          gate.target,
          gate.param
        );
        break;
      // Three-qubit gates
      case "toffoli":
      case "ccx": {
        const [c1, c2, t] = gate.qubits;
        state.toffoli(c1, c2, t);
        break;
      }
      case "fredkin":
      case "cswap": {
        const [c, t1, t2] = gate.qubits;
        state.fredkin(c, t1, t2);
        break;
      }
      // Multi-qubit gates
      case "qft":
        state.qft(gate.qubits);
        break;
      case "iqft":
        state.iqft(gate.qubits);
        break;
      // Measurement
      case "measure":
        state.measure(gate.qubit);
        break;
      // Barrier - no-op
      case "barrier":
        break;
    }
  }
  gateToQASM(gate) {
    switch (gate.type) {
      case "h":
        return `h q[${gate.qubit}];`;
      case "x":
        return `x q[${gate.qubit}];`;
      case "y":
        return `y q[${gate.qubit}];`;
      case "z":
        return `z q[${gate.qubit}];`;
      case "s":
        return `s q[${gate.qubit}];`;
      case "sdg":
        return `sdg q[${gate.qubit}];`;
      case "t":
        return `t q[${gate.qubit}];`;
      case "tdg":
        return `tdg q[${gate.qubit}];`;
      case "rx":
        return `rx(${gate.params[0]}) q[${gate.qubit}];`;
      case "ry":
        return `ry(${gate.params[0]}) q[${gate.qubit}];`;
      case "rz":
        return `rz(${gate.params[0]}) q[${gate.qubit}];`;
      case "phase":
        return `u1(${gate.params[0]}) q[${gate.qubit}];`;
      case "u3": {
        const p = gate.params;
        return `u3(${p[0]},${p[1]},${p[2]}) q[${gate.qubit}];`;
      }
      case "cnot":
      case "cx":
        return `cx q[${gate.control}],q[${gate.target}];`;
      case "cz":
        return `cz q[${gate.control}],q[${gate.target}];`;
      case "cy":
        return `cy q[${gate.control}],q[${gate.target}];`;
      case "swap":
        return `swap q[${gate.control}],q[${gate.target}];`;
      case "cphase":
        return `cu1(${gate.param}) q[${gate.control}],q[${gate.target}];`;
      case "crx":
        return `crx(${gate.param}) q[${gate.control}],q[${gate.target}];`;
      case "cry":
        return `cry(${gate.param}) q[${gate.control}],q[${gate.target}];`;
      case "crz":
        return `crz(${gate.param}) q[${gate.control}],q[${gate.target}];`;
      case "toffoli":
      case "ccx": {
        const [c1, c2, t] = gate.qubits;
        return `ccx q[${c1}],q[${c2}],q[${t}];`;
      }
      case "fredkin":
      case "cswap": {
        const [c, t1, t2] = gate.qubits;
        return `cswap q[${c}],q[${t1}],q[${t2}];`;
      }
      case "barrier": {
        const qs = gate.qubits.map((q) => `q[${q}]`).join(",");
        return `barrier ${qs};`;
      }
      case "measure": {
        const m = gate;
        const cbit = m.classicalBit ?? m.qubit;
        return `measure q[${m.qubit}] -> c[${cbit}];`;
      }
      default:
        return `// Unknown gate: ${gate.type}`;
    }
  }
};

// src/complex.ts
function complex(real, imag = 0) {
  return { real, imag };
}
var ZERO = { real: 0, imag: 0 };
var ONE = { real: 1, imag: 0 };
var I = { real: 0, imag: 1 };
function magnitude(c) {
  return Math.sqrt(c.real * c.real + c.imag * c.imag);
}
function magnitudeSquared(c) {
  return c.real * c.real + c.imag * c.imag;
}
function phase(c) {
  return Math.atan2(c.imag, c.real);
}
function conjugate(c) {
  return { real: c.real, imag: c.imag === 0 ? 0 : -c.imag };
}
function add(a, b) {
  return {
    real: a.real + b.real,
    imag: a.imag + b.imag
  };
}
function subtract(a, b) {
  return {
    real: a.real - b.real,
    imag: a.imag - b.imag
  };
}
function multiply(a, b) {
  return {
    real: a.real * b.real - a.imag * b.imag,
    imag: a.real * b.imag + a.imag * b.real
  };
}
function scale(c, s2) {
  return {
    real: c.real * s2,
    imag: c.imag * s2
  };
}
function divide(a, b) {
  const denom = b.real * b.real + b.imag * b.imag;
  if (denom === 0) {
    throw new Error("Division by zero");
  }
  return {
    real: (a.real * b.real + a.imag * b.imag) / denom,
    imag: (a.imag * b.real - a.real * b.imag) / denom
  };
}
function exp(theta) {
  return {
    real: Math.cos(theta),
    imag: Math.sin(theta)
  };
}
function fromPolar(r, theta) {
  return {
    real: r * Math.cos(theta),
    imag: r * Math.sin(theta)
  };
}
function toPolar(c) {
  return [magnitude(c), phase(c)];
}
function equals(a, b, tolerance = 1e-10) {
  return Math.abs(a.real - b.real) < tolerance && Math.abs(a.imag - b.imag) < tolerance;
}
function toString(c, precision = 4) {
  const r = c.real.toFixed(precision);
  const i = Math.abs(c.imag).toFixed(precision);
  const sign = c.imag >= 0 ? "+" : "-";
  return `${r} ${sign} ${i}i`;
}
function fromInterleaved(arr) {
  const result = [];
  for (let i = 0; i < arr.length; i += 2) {
    result.push({ real: arr[i], imag: arr[i + 1] });
  }
  return result;
}
function toInterleaved(complexArray) {
  const result = new Float64Array(complexArray.length * 2);
  for (let i = 0; i < complexArray.length; i++) {
    result[i * 2] = complexArray[i].real;
    result[i * 2 + 1] = complexArray[i].imag;
  }
  return result;
}
function innerProduct(a, b) {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same length");
  }
  let result = ZERO;
  for (let i = 0; i < a.length; i++) {
    result = add(result, multiply(conjugate(a[i]), b[i]));
  }
  return result;
}
function norm(v) {
  let sum = 0;
  for (const c of v) {
    sum += magnitudeSquared(c);
  }
  return Math.sqrt(sum);
}
function normalize(v) {
  const n = norm(v);
  if (n === 0) {
    throw new Error("Cannot normalize zero vector");
  }
  return v.map((c) => scale(c, 1 / n));
}

// src/tensor-network.ts
var TensorNetworkState = class _TensorNetworkState {
  constructor(module, memory, ptr, numQubits) {
    this.disposed = false;
    this.module = module;
    this.memory = memory;
    this.ptr = ptr;
    this._numQubits = numQubits;
  }
  /**
   * Create from an existing native pointer (internal use).
   */
  static fromPointer(module, memory, ptr, numQubits) {
    return new _TensorNetworkState(module, memory, ptr, numQubits);
  }
  /**
   * Create |00..0> tensor-network state
   */
  static async create(options) {
    if (options.numQubits < 1) {
      throw new Error("numQubits must be >= 1");
    }
    const module = await getModule();
    const memory = new WasmMemory(module);
    const ptr = module._tn_mps_create_zero(options.numQubits, 0);
    if (!ptr) {
      throw new Error("tn_mps_create_zero failed");
    }
    return new _TensorNetworkState(module, memory, ptr, options.numQubits);
  }
  /**
   * Create from computational basis integer
   */
  static async fromBasis(numQubits, basisState) {
    const module = await getModule();
    const memory = new WasmMemory(module);
    const ptr = module._tn_mps_create_basis(numQubits, basisState, 0);
    if (!ptr) {
      throw new Error("tn_mps_create_basis failed");
    }
    return new _TensorNetworkState(module, memory, ptr, numQubits);
  }
  /**
   * Number of qubits
   */
  get numQubits() {
    return this._numQubits;
  }
  /**
   * Dispose the underlying MPS
   */
  dispose() {
    if (!this.disposed && this.ptr) {
      this.module._tn_mps_free(this.ptr);
      this.memory.freeAll();
      this.disposed = true;
    }
  }
  // =========================================================================
  // Gates (subset)
  // =========================================================================
  h(qubit) {
    this.checkQubit(qubit);
    this.module._tn_apply_h(this.ptr, qubit);
    return this;
  }
  x(qubit) {
    this.checkQubit(qubit);
    this.module._tn_apply_x(this.ptr, qubit);
    return this;
  }
  y(qubit) {
    this.checkQubit(qubit);
    this.module._tn_apply_y(this.ptr, qubit);
    return this;
  }
  z(qubit) {
    this.checkQubit(qubit);
    this.module._tn_apply_z(this.ptr, qubit);
    return this;
  }
  rx(qubit, theta) {
    this.checkQubit(qubit);
    this.module._tn_apply_rx(this.ptr, qubit, theta);
    return this;
  }
  ry(qubit, theta) {
    this.checkQubit(qubit);
    this.module._tn_apply_ry(this.ptr, qubit, theta);
    return this;
  }
  rz(qubit, theta) {
    this.checkQubit(qubit);
    this.module._tn_apply_rz(this.ptr, qubit, theta);
    return this;
  }
  cnot(control, target) {
    this.checkQubit(control);
    this.checkQubit(target);
    this.module._tn_apply_cnot(this.ptr, control, target);
    return this;
  }
  cz(control, target) {
    this.checkQubit(control);
    this.checkQubit(target);
    this.module._tn_apply_cz(this.ptr, control, target);
    return this;
  }
  swap(q1, q2) {
    this.checkQubit(q1);
    this.checkQubit(q2);
    this.module._tn_apply_swap(this.ptr, q1, q2);
    return this;
  }
  rzz(q1, q2, theta) {
    this.checkQubit(q1);
    this.checkQubit(q2);
    this.module._tn_apply_rzz(this.ptr, q1, q2, theta);
    return this;
  }
  /**
   * Normalize MPS
   */
  normalize() {
    this.module._tn_mps_normalize(this.ptr);
    return this;
  }
  // =========================================================================
  // Measurement / inspection
  // =========================================================================
  /**
   * Probability of bitstring (returns exact value without collapse)
   */
  bitstringProbability(bitstring) {
    return this.module._tn_measure_bitstring_probability(this.ptr, bitstring);
  }
  /**
   * Convert to full statevector (only feasible for small n)
   */
  toStateVector(maxQubits = 24) {
    if (this._numQubits > maxQubits) {
      throw new Error(`Refusing to materialize statevector for ${this._numQubits} qubits (max ${maxQubits})`);
    }
    const dim = 1 << this._numQubits;
    const outPtr = this.memory.allocComplexArray(dim);
    const rc = this.module._tn_mps_to_statevector(this.ptr, outPtr);
    if (rc !== 0) {
      this.memory.free(outPtr);
      throw new Error(`tn_mps_to_statevector failed with code ${rc}`);
    }
    const amps = this.memory.readComplexArray(outPtr, dim);
    this.memory.free(outPtr);
    return amps;
  }
  // =========================================================================
  // Internals
  // =========================================================================
  /** WASM pointer (internal use) */
  get pointer() {
    return this.ptr;
  }
  checkQubit(q) {
    if (q < 0 || q >= this._numQubits) {
      throw new Error(`Invalid qubit index ${q}`);
    }
  }
};
async function dmrgTFIMGroundState(options) {
  const module = await getModule();
  const memory = new WasmMemory(module);
  if (options.numSites < 2) {
    throw new Error("numSites must be >= 2");
  }
  const resultPtrPtr = memory.alloc(4);
  memory.writeInt32(resultPtrPtr, 0);
  const mpsPtr = module._dmrg_tfim_ground_state(options.numSites, options.g, 0, resultPtrPtr);
  if (!mpsPtr) {
    memory.free(resultPtrPtr);
    throw new Error("dmrg_tfim_ground_state failed (null MPS pointer)");
  }
  const tnState = TensorNetworkState.fromPointer(module, memory, mpsPtr, options.numSites);
  const resultStructPtr = memory.readPointer(resultPtrPtr);
  let energy;
  let variance;
  let numSweeps;
  let converged;
  if (resultStructPtr) {
    const base = resultStructPtr / 8;
    energy = module.HEAPF64[base + 0];
    variance = module.HEAPF64[base + 1];
    numSweeps = module.HEAP32[resultStructPtr + 16 >> 2];
    const convergedByte = module.HEAP8[resultStructPtr + 32];
    converged = !!convergedByte;
    module._dmrg_result_free(resultStructPtr);
  }
  memory.free(resultPtrPtr);
  return {
    state: tnState,
    energy,
    energyVariance: variance,
    numSweeps,
    converged
  };
}

// src/tdvp.ts
var EvolutionType = /* @__PURE__ */ ((EvolutionType2) => {
  EvolutionType2[EvolutionType2["RealTime"] = 0] = "RealTime";
  EvolutionType2[EvolutionType2["ImaginaryTime"] = 1] = "ImaginaryTime";
  return EvolutionType2;
})(EvolutionType || {});
var TdvpEngine = class _TdvpEngine {
  constructor(handle, mod, numBonds) {
    this.freed = false;
    this.handle = handle;
    this.mod = mod;
    this.nb = numBonds;
  }
  /** Build an adaptive-bond TDVP engine on a Heisenberg-XXZ chain
   *
   *   H = J * sum_i (X X + Y Y + Delta Z Z) - h * sum_i Z
   */
  static async createHeisenberg(opts) {
    return _TdvpEngine._build(opts, async (mod) => {
      const m = mod;
      return m._moonlab_tdvp_create_heisenberg(
        opts.numSites,
        opts.J ?? 1,
        opts.Delta ?? 1,
        opts.h ?? 0,
        opts.initialBondDim ?? 8,
        opts.maxBondDim ?? 32,
        opts.dt ?? 0.05,
        opts.evolution === 1 /* ImaginaryTime */ ? 1 : 0,
        opts.adaptiveTargetEntropy ?? 0
      );
    });
  }
  /** Build an adaptive-bond TDVP engine on a transverse-field Ising chain
   *
   *   H = -J * sum_i Z_i Z_{i+1} - h * sum_i X_i
   */
  static async createTfim(opts) {
    return _TdvpEngine._build(opts, async (mod) => {
      const m = mod;
      return m._moonlab_tdvp_create_tfim(
        opts.numSites,
        opts.J ?? 1,
        opts.h ?? 1,
        opts.initialBondDim ?? 8,
        opts.maxBondDim ?? 32,
        opts.dt ?? 0.05,
        opts.evolution === 1 /* ImaginaryTime */ ? 1 : 0,
        opts.adaptiveTargetEntropy ?? 0
      );
    });
  }
  /** Internal: shared construction path for both convenience builders. */
  static async _build(opts, spawn) {
    if (opts.numSites < 2) throw new Error("numSites must be >= 2");
    const mod = await getModule();
    const handle = await spawn(mod);
    if (!handle) throw new Error("moonlab_tdvp_create_* returned NULL");
    const numBonds = mod._moonlab_tdvp_num_bonds(handle);
    return new _TdvpEngine(handle, mod, numBonds);
  }
  /** Release the underlying WASM allocation.  Safe to call twice. */
  dispose() {
    if (this.freed) return;
    this.mod._moonlab_tdvp_engine_free(this.handle);
    this.freed = true;
  }
  /** Advance the engine by one TDVP step. */
  step() {
    const rc = this.mod._moonlab_tdvp_step(this.handle);
    if (rc !== 0) throw new Error(`moonlab_tdvp_step rc=${rc}`);
  }
  /** Advance until the engine's clock reaches @p targetTime. */
  evolveTo(targetTime) {
    const rc = this.mod._moonlab_tdvp_evolve_to(this.handle, targetTime);
    if (rc !== 0) throw new Error(`moonlab_tdvp_evolve_to rc=${rc}`);
  }
  /** Current accumulated evolution time. */
  get currentTime() {
    return this.mod._moonlab_tdvp_current_time(this.handle);
  }
  /** Current variational energy `<psi|H|psi>`. */
  get currentEnergy() {
    return this.mod._moonlab_tdvp_current_energy(this.handle);
  }
  /** Current MPS norm `<psi|psi>^{1/2}`. */
  get currentNorm() {
    return this.mod._moonlab_tdvp_current_norm(this.handle);
  }
  /** Peak bond dimension across the MPS factor. */
  get currentMaxBondDim() {
    return this.mod._moonlab_tdvp_current_max_bond_dim(this.handle);
  }
  /** Number of inter-site bonds (`numSites - 1`). */
  get numBonds() {
    return this.nb;
  }
  /** PID-selected chi for bond @p bond, or 0 when the adaptive
   *  controller is disabled. */
  bondChi(bond) {
    if (bond < 0 || bond >= this.nb) {
      throw new RangeError(`bond ${bond} out of [0, ${this.nb})`);
    }
    return this.mod._moonlab_tdvp_bond_chi(this.handle, bond);
  }
  /** Number of steps recorded in the engine's history. */
  get historyNumSteps() {
    return this.mod._moonlab_tdvp_history_num_steps(this.handle);
  }
  /** Read step @p step from the engine's history. */
  historyStep(step) {
    if (step < 0 || step >= this.historyNumSteps) {
      throw new RangeError(`step ${step} out of [0, ${this.historyNumSteps})`);
    }
    const m = this.mod;
    const tPtr = m._malloc(8);
    const ePtr = m._malloc(8);
    const nPtr = m._malloc(8);
    try {
      const rc = m._moonlab_tdvp_history_get_step(
        this.handle,
        step,
        tPtr,
        ePtr,
        nPtr
      );
      if (rc !== 0) {
        throw new Error(`moonlab_tdvp_history_get_step rc=${rc}`);
      }
      return {
        time: m.HEAPF64[tPtr >> 3],
        energy: m.HEAPF64[ePtr >> 3],
        norm: m.HEAPF64[nPtr >> 3]
      };
    } finally {
      m._free(tPtr);
      m._free(ePtr);
      m._free(nPtr);
    }
  }
  /** Read the per-bond chi snapshot for step @p step.  Returns a
   *  fresh `Uint32Array` of length `numBonds`. */
  historyBondChi(step) {
    if (step < 0 || step >= this.historyNumSteps) {
      throw new RangeError(`step ${step} out of [0, ${this.historyNumSteps})`);
    }
    const m = this.mod;
    const bytes = this.nb * 4;
    const buf = m._malloc(bytes);
    try {
      const rc = m._moonlab_tdvp_history_get_bond_chi(
        this.handle,
        step,
        buf,
        this.nb
      );
      if (rc !== 0) {
        throw new Error(`moonlab_tdvp_history_get_bond_chi rc=${rc}`);
      }
      return new Uint32Array(m.HEAPU32.buffer, buf, this.nb).slice();
    } finally {
      m._free(buf);
    }
  }
};

// src/clifford.ts
var CliffordTableau = class _CliffordTableau {
  constructor(handle, mod, numQubits) {
    this.freed = false;
    this.handle = handle;
    this.mod = mod;
    this.nq = numQubits;
    const hi = BigInt(Math.floor(Math.random() * 4294967296));
    const lo = BigInt(Math.floor(Math.random() * 4294967296));
    this.rngState = hi << 32n ^ lo ^ 1n;
  }
  /** Allocate a fresh tableau in |0..0> on ``numQubits`` qubits. */
  static async create(numQubits) {
    if (numQubits < 1) {
      throw new RangeError(`numQubits must be >= 1, got ${numQubits}`);
    }
    const mod = await getModule();
    const h2 = mod._clifford_tableau_create(numQubits);
    if (!h2) throw new Error("clifford_tableau_create returned NULL");
    return new _CliffordTableau(h2, mod, numQubits);
  }
  /** Release the underlying WASM allocation. */
  dispose() {
    if (this.freed) return;
    this.mod._clifford_tableau_free(this.handle);
    this.freed = true;
  }
  /** Number of qubits the tableau was created for. */
  get numQubits() {
    return this.nq;
  }
  /** Override the splitmix64 RNG state used by ``measure`` /
   *  ``sampleAll``.  Both calls advance the state in place; this
   *  setter lets the caller pin it for reproducibility. */
  setRngSeed(seed) {
    this.rngState = seed === 0n ? 1n : seed;
    return this;
  }
  // ---- Single-qubit Clifford gates --------------------------------------
  h(q) {
    this._call1("clifford_h", q);
    return this;
  }
  s(q) {
    this._call1("clifford_s", q);
    return this;
  }
  sdag(q) {
    this._call1("clifford_s_dag", q);
    return this;
  }
  x(q) {
    this._call1("clifford_x", q);
    return this;
  }
  y(q) {
    this._call1("clifford_y", q);
    return this;
  }
  z(q) {
    this._call1("clifford_z", q);
    return this;
  }
  // ---- Two-qubit Clifford gates -----------------------------------------
  cnot(ctrl, tgt) {
    this._call2("clifford_cnot", ctrl, tgt);
    return this;
  }
  cz(a, b) {
    this._call2("clifford_cz", a, b);
    return this;
  }
  swap(a, b) {
    this._call2("clifford_swap", a, b);
    return this;
  }
  /** Z-basis measurement on qubit ``q``.  Mutates the tableau and
   *  advances the internal RNG state. */
  measure(q) {
    if (q < 0 || q >= this.nq) {
      throw new RangeError(`qubit ${q} out of [0, ${this.nq})`);
    }
    const m = this.mod;
    const rngPtr = m._malloc(8);
    const outPtr = m._malloc(4);
    const kindPtr = m._malloc(4);
    try {
      const idx32 = rngPtr >> 2;
      m.HEAPU32[idx32] = Number(this.rngState & 0xffffffffn);
      m.HEAPU32[idx32 + 1] = Number(this.rngState >> 32n & 0xffffffffn);
      const rc = m._clifford_measure(
        this.handle,
        q,
        rngPtr,
        outPtr,
        kindPtr
      );
      if (rc !== 0) {
        throw new Error(`clifford_measure rc=${rc}`);
      }
      const lo = BigInt(m.HEAPU32[idx32]);
      const hi = BigInt(m.HEAPU32[idx32 + 1]);
      this.rngState = hi << 32n | lo;
      const outcomeRaw = m.HEAP32[outPtr >> 2];
      const kindRaw = m.HEAP32[kindPtr >> 2];
      return {
        outcome: outcomeRaw === 0 ? 0 : 1,
        outcomeKind: kindRaw === 0 ? "deterministic" : "random"
      };
    } finally {
      m._free(rngPtr);
      m._free(outPtr);
      m._free(kindPtr);
    }
  }
  /** Draw an n-bit computational-basis sample.  Mutates the
   *  tableau and advances the RNG state.  Caps at 64 qubits because
   *  the C entry point returns a single ``uint64_t``. */
  sampleAll() {
    if (this.nq > 64) {
      throw new RangeError(
        `sampleAll() supports up to 64 qubits; got ${this.nq}.  Use measure(q) in a loop for wider tableaus.`
      );
    }
    const m = this.mod;
    const rngPtr = m._malloc(8);
    const resultPtr = m._malloc(8);
    try {
      const rngIdx = rngPtr >> 2;
      m.HEAPU32[rngIdx] = Number(this.rngState & 0xffffffffn);
      m.HEAPU32[rngIdx + 1] = Number(this.rngState >> 32n & 0xffffffffn);
      const rc = m._clifford_sample_all(this.handle, rngPtr, resultPtr);
      if (rc !== 0) {
        throw new Error(`clifford_sample_all rc=${rc}`);
      }
      const rngLo = BigInt(m.HEAPU32[rngIdx]);
      const rngHi = BigInt(m.HEAPU32[rngIdx + 1]);
      this.rngState = rngHi << 32n | rngLo;
      const resIdx = resultPtr >> 2;
      const lo = BigInt(m.HEAPU32[resIdx]);
      const hi = BigInt(m.HEAPU32[resIdx + 1]);
      return { bits: hi << 32n | lo };
    } finally {
      m._free(rngPtr);
      m._free(resultPtr);
    }
  }
  // ---- Internal helpers --------------------------------------------------
  _call1(fnName, q) {
    if (q < 0 || q >= this.nq) {
      throw new RangeError(`qubit ${q} out of [0, ${this.nq})`);
    }
    const m = this.mod;
    const rc = m[`_${fnName}`](this.handle, q);
    if (rc !== 0) throw new Error(`${fnName}(${q}) rc=${rc}`);
  }
  _call2(fnName, a, b) {
    if (a < 0 || a >= this.nq || b < 0 || b >= this.nq) {
      throw new RangeError(`qubits ${a},${b} out of [0, ${this.nq})`);
    }
    const m = this.mod;
    const rc = m[`_${fnName}`](this.handle, a, b);
    if (rc !== 0) throw new Error(`${fnName}(${a},${b}) rc=${rc}`);
  }
};

// src/fusion.ts
var FusedCircuit = class _FusedCircuit {
  constructor(handle, mod, numQubits) {
    this.freed = false;
    this.handle = handle;
    this.mod = mod;
    this.nq = numQubits;
  }
  /** Allocate an empty fusion circuit on ``numQubits`` qubits. */
  static async create(numQubits) {
    if (numQubits < 1) {
      throw new RangeError(`numQubits must be >= 1, got ${numQubits}`);
    }
    const mod = await getModule();
    const h2 = mod._fuse_circuit_create(numQubits);
    if (!h2) throw new Error("fuse_circuit_create returned NULL");
    return new _FusedCircuit(h2, mod, numQubits);
  }
  /** Release the underlying WASM allocation. */
  dispose() {
    if (this.freed) return;
    this.mod._fuse_circuit_free(this.handle);
    this.freed = true;
  }
  /** Number of qubits the circuit was created for. */
  get numQubits() {
    return this.nq;
  }
  /** Number of symbolic gates currently in the circuit. */
  get length() {
    return this.mod._fuse_circuit_len(this.handle);
  }
  // ---- Single-qubit gates (fluent) --------------------------------------
  h(q) {
    this._call1("fuse_append_h", q);
    return this;
  }
  x(q) {
    this._call1("fuse_append_x", q);
    return this;
  }
  y(q) {
    this._call1("fuse_append_y", q);
    return this;
  }
  z(q) {
    this._call1("fuse_append_z", q);
    return this;
  }
  s(q) {
    this._call1("fuse_append_s", q);
    return this;
  }
  sdg(q) {
    this._call1("fuse_append_sdg", q);
    return this;
  }
  t(q) {
    this._call1("fuse_append_t", q);
    return this;
  }
  tdg(q) {
    this._call1("fuse_append_tdg", q);
    return this;
  }
  phase(q, theta) {
    this._call1p("fuse_append_phase", q, theta);
    return this;
  }
  rx(q, theta) {
    this._call1p("fuse_append_rx", q, theta);
    return this;
  }
  ry(q, theta) {
    this._call1p("fuse_append_ry", q, theta);
    return this;
  }
  rz(q, theta) {
    this._call1p("fuse_append_rz", q, theta);
    return this;
  }
  u3(q, theta, phi, lambda) {
    this._guard1(q);
    const rc = this.mod._fuse_append_u3(this.handle, q, theta, phi, lambda);
    if (rc !== 0) throw new Error(`fuse_append_u3 rc=${rc}`);
    return this;
  }
  // ---- Two-qubit gates (fluent) -----------------------------------------
  cnot(ctrl, tgt) {
    this._call2("fuse_append_cnot", ctrl, tgt);
    return this;
  }
  cz(ctrl, tgt) {
    this._call2("fuse_append_cz", ctrl, tgt);
    return this;
  }
  cy(ctrl, tgt) {
    this._call2("fuse_append_cy", ctrl, tgt);
    return this;
  }
  swap(a, b) {
    this._call2("fuse_append_swap", a, b);
    return this;
  }
  cphase(ctrl, tgt, theta) {
    this._call2p("fuse_append_cphase", ctrl, tgt, theta);
    return this;
  }
  crx(ctrl, tgt, theta) {
    this._call2p("fuse_append_crx", ctrl, tgt, theta);
    return this;
  }
  cry(ctrl, tgt, theta) {
    this._call2p("fuse_append_cry", ctrl, tgt, theta);
    return this;
  }
  crz(ctrl, tgt, theta) {
    this._call2p("fuse_append_crz", ctrl, tgt, theta);
    return this;
  }
  // ---- Compile + execute -------------------------------------------------
  /** Run the run-length single-qubit fuser.  Returns an owned new
   *  {@link FusedCircuit} (caller must `dispose()`) plus a
   *  {@link FuseStats} summary. */
  compile() {
    const STATS_BYTES = 12;
    const statsPtr = this.mod._malloc(STATS_BYTES);
    try {
      const h2 = this.mod._fuse_compile(this.handle, statsPtr);
      if (!h2) throw new Error("fuse_compile returned NULL");
      const idx = statsPtr >> 2;
      const stats = {
        originalGates: this.mod.HEAPU32[idx],
        fusedGates: this.mod.HEAPU32[idx + 1],
        mergesApplied: this.mod.HEAPU32[idx + 2]
      };
      return { fused: new _FusedCircuit(h2, this.mod, this.nq), stats };
    } finally {
      this.mod._free(statsPtr);
    }
  }
  /** Apply this circuit to ``state`` in place.  Works on both fused
   *  and unfused circuits. */
  execute(state) {
    const statePtr = state._internal_state_pointer();
    const rc = this.mod._fuse_execute(this.handle, statePtr);
    if (rc !== 0) throw new Error(`fuse_execute rc=${rc}`);
  }
  // ---- Internal helpers --------------------------------------------------
  _guard1(q) {
    if (this.freed) throw new Error("FusedCircuit is disposed");
    if (q < 0 || q >= this.nq) {
      throw new RangeError(`qubit ${q} out of [0, ${this.nq})`);
    }
  }
  _guard2(a, b) {
    if (this.freed) throw new Error("FusedCircuit is disposed");
    if (a < 0 || a >= this.nq || b < 0 || b >= this.nq) {
      throw new RangeError(`qubits ${a},${b} out of [0, ${this.nq})`);
    }
  }
  _call1(fnName, q) {
    this._guard1(q);
    const rc = this.mod[`_${fnName}`](this.handle, q);
    if (rc !== 0) throw new Error(`${fnName}(${q}) rc=${rc}`);
  }
  _call1p(fnName, q, theta) {
    this._guard1(q);
    const rc = this.mod[`_${fnName}`](this.handle, q, theta);
    if (rc !== 0) throw new Error(`${fnName}(${q},${theta}) rc=${rc}`);
  }
  _call2(fnName, a, b) {
    this._guard2(a, b);
    const rc = this.mod[`_${fnName}`](this.handle, a, b);
    if (rc !== 0) throw new Error(`${fnName}(${a},${b}) rc=${rc}`);
  }
  _call2p(fnName, a, b, theta) {
    this._guard2(a, b);
    const rc = this.mod[`_${fnName}`](this.handle, a, b, theta);
    if (rc !== 0) throw new Error(`${fnName}(${a},${b},${theta}) rc=${rc}`);
  }
};

// src/mpdo.ts
var PauliCode = /* @__PURE__ */ ((PauliCode2) => {
  PauliCode2[PauliCode2["I"] = 0] = "I";
  PauliCode2[PauliCode2["X"] = 1] = "X";
  PauliCode2[PauliCode2["Y"] = 2] = "Y";
  PauliCode2[PauliCode2["Z"] = 3] = "Z";
  return PauliCode2;
})(PauliCode || {});
var Mpdo = class _Mpdo {
  constructor(handle, mod, numQubits, maxBondDim) {
    this.freed = false;
    this.handle = handle;
    this.mod = mod;
    this.nq = numQubits;
    this.chiMax = maxBondDim;
  }
  /** Allocate a product-state MPDO on ``numQubits`` qubits with
   *  bond-dimension cap ``maxBondDim``.  The initial state is
   *  `|0...0> <0...0|`. */
  static async create(numQubits, maxBondDim) {
    if (numQubits < 1) {
      throw new RangeError(`numQubits must be >= 1, got ${numQubits}`);
    }
    if (maxBondDim < 1) {
      throw new RangeError(`maxBondDim must be >= 1, got ${maxBondDim}`);
    }
    const mod = await getModule();
    const h2 = mod._moonlab_mpdo_create(numQubits, maxBondDim);
    if (!h2) throw new Error("moonlab_mpdo_create returned NULL");
    return new _Mpdo(h2, mod, numQubits, maxBondDim);
  }
  /** Release the underlying WASM allocation. */
  dispose() {
    if (this.freed) return;
    this.mod._moonlab_mpdo_free(this.handle);
    this.freed = true;
  }
  /** Deep copy of this MPDO.  Caller owns the returned handle. */
  clone() {
    this._guardLive();
    const h2 = this.mod._moonlab_mpdo_clone(this.handle);
    if (!h2) throw new Error("moonlab_mpdo_clone returned NULL");
    return new _Mpdo(h2, this.mod, this.nq, this.chiMax);
  }
  /** Number of qubits in the MPDO. */
  get numQubits() {
    return this.nq;
  }
  /** Bond-dimension cap configured at construction. */
  get maxBondDim() {
    return this.chiMax;
  }
  /** Current maximum bond dimension across all bonds.  Grows as
   *  channels are applied, capped by {@link maxBondDim}. */
  get currentBondDim() {
    this._guardLive();
    return this.mod._moonlab_mpdo_current_bond_dim(this.handle);
  }
  /** Trace of the density matrix, Tr(rho).  Should be 1 for a
   *  properly normalised state; deviations indicate truncation
   *  error. */
  trace() {
    this._guardLive();
    return this.mod._moonlab_mpdo_trace(this.handle);
  }
  // ---- Named single-qubit channels -------------------------------------
  /** Single-qubit depolarising channel,
   *  `rho |-> (1-p) rho + (p/3) (X rho X + Y rho Y + Z rho Z)`. */
  applyDepolarizing(qubit, probability) {
    this._guardQubit(qubit);
    this._check(
      this.mod._moonlab_mpdo_apply_depolarizing_1q(this.handle, qubit, probability),
      "apply_depolarizing_1q"
    );
    return this;
  }
  /** Amplitude damping (T1 relaxation) with parameter ``gamma``. */
  applyAmplitudeDamping(qubit, gamma) {
    this._guardQubit(qubit);
    this._check(
      this.mod._moonlab_mpdo_apply_amplitude_damping_1q(this.handle, qubit, gamma),
      "apply_amplitude_damping_1q"
    );
    return this;
  }
  /** Phase damping (pure dephasing) with parameter ``lambda``. */
  applyPhaseDamping(qubit, lambda) {
    this._guardQubit(qubit);
    this._check(
      this.mod._moonlab_mpdo_apply_phase_damping_1q(this.handle, qubit, lambda),
      "apply_phase_damping_1q"
    );
    return this;
  }
  /** Bit-flip channel `(1-p) I + p X`. */
  applyBitFlip(qubit, probability) {
    this._guardQubit(qubit);
    this._check(
      this.mod._moonlab_mpdo_apply_bit_flip_1q(this.handle, qubit, probability),
      "apply_bit_flip_1q"
    );
    return this;
  }
  /** Phase-flip channel `(1-p) I + p Z`. */
  applyPhaseFlip(qubit, probability) {
    this._guardQubit(qubit);
    this._check(
      this.mod._moonlab_mpdo_apply_phase_flip_1q(this.handle, qubit, probability),
      "apply_phase_flip_1q"
    );
    return this;
  }
  /** Bit-phase-flip channel `(1-p) I + p Y`. */
  applyBitPhaseFlip(qubit, probability) {
    this._guardQubit(qubit);
    this._check(
      this.mod._moonlab_mpdo_apply_bit_phase_flip_1q(this.handle, qubit, probability),
      "apply_bit_phase_flip_1q"
    );
    return this;
  }
  /** Apply an arbitrary single-qubit Kraus channel.  ``kraus`` is a
   *  flat row-major interleaved-complex array of length
   *  ``numKraus * 4 * 2`` (4 entries per 2x2 matrix, 2 doubles per
   *  complex). */
  applyKraus(qubit, kraus, numKraus) {
    this._guardQubit(qubit);
    if (kraus.length !== numKraus * 4 * 2) {
      throw new RangeError(
        `kraus.length=${kraus.length} mismatches numKraus * 4 * 2 = ${numKraus * 4 * 2}`
      );
    }
    const bytes = kraus.length * 8;
    const ptr = this.mod._malloc(bytes);
    try {
      const idx = ptr >> 3;
      for (let i = 0; i < kraus.length; i++) {
        this.mod.HEAPF64[idx + i] = kraus[i];
      }
      this._check(
        this.mod._moonlab_mpdo_apply_kraus_1q(this.handle, qubit, ptr, numKraus),
        "apply_kraus_1q"
      );
    } finally {
      this.mod._free(ptr);
    }
    return this;
  }
  // ---- Observables -----------------------------------------------------
  /** Single-site Pauli expectation `Tr(rho * P_q)` where ``P`` is
   *  one of `{I, X, Y, Z}` on qubit ``qubit`` and identity
   *  elsewhere. */
  expectPauli(qubit, pauli) {
    this._guardQubit(qubit);
    const outPtr = this.mod._malloc(8);
    try {
      this._check(
        this.mod._moonlab_mpdo_expect_pauli_1q(
          this.handle,
          qubit,
          pauli,
          outPtr
        ),
        "expect_pauli_1q"
      );
      return this.mod.HEAPF64[outPtr >> 3];
    } finally {
      this.mod._free(outPtr);
    }
  }
  // ---- Internal helpers ------------------------------------------------
  _guardLive() {
    if (this.freed) throw new Error("Mpdo is disposed");
  }
  _guardQubit(q) {
    this._guardLive();
    if (q < 0 || q >= this.nq) {
      throw new RangeError(`qubit ${q} out of [0, ${this.nq})`);
    }
  }
  _check(rc, fn) {
    if (rc !== 0) throw new Error(`moonlab_mpdo_${fn} rc=${rc}`);
  }
};

// src/ca-peps.ts
var CaPeps = class _CaPeps {
  constructor(handle, mod) {
    this.freed = false;
    this.handle = handle;
    this.mod = mod;
  }
  /** Allocate a CA-PEPS on `Lx x Ly` with per-bond chi cap
   *  `chiBond`.  Initial state `|0...0>` with `D = I`. */
  static async create(lx, ly, chiBond) {
    if (lx < 1 || ly < 1) {
      throw new RangeError(`lx=${lx}, ly=${ly}: both must be >= 1`);
    }
    if (chiBond < 1) {
      throw new RangeError(`chiBond must be >= 1, got ${chiBond}`);
    }
    const mod = await getModule();
    const h2 = mod._moonlab_ca_peps_create(lx, ly, chiBond);
    if (!h2) throw new Error("moonlab_ca_peps_create returned NULL");
    return new _CaPeps(h2, mod);
  }
  /** Release the underlying WASM allocation. */
  dispose() {
    if (this.freed) return;
    this.mod._moonlab_ca_peps_free(this.handle);
    this.freed = true;
  }
  /** Deep copy. */
  clone() {
    this._guardLive();
    const h2 = this.mod._moonlab_ca_peps_clone(this.handle);
    if (!h2) throw new Error("moonlab_ca_peps_clone returned NULL");
    return new _CaPeps(h2, this.mod);
  }
  get lx() {
    this._guardLive();
    return this.mod._moonlab_ca_peps_lx(this.handle);
  }
  get ly() {
    this._guardLive();
    return this.mod._moonlab_ca_peps_ly(this.handle);
  }
  get numQubits() {
    this._guardLive();
    return this.mod._moonlab_ca_peps_num_qubits(this.handle);
  }
  get maxBondDim() {
    this._guardLive();
    return this.mod._moonlab_ca_peps_max_bond_dim(this.handle);
  }
  get currentBondDim() {
    this._guardLive();
    return this.mod._moonlab_ca_peps_current_bond_dim(this.handle);
  }
  /** `<phi | phi>` of the physical factor; ~1 modulo truncation. */
  get norm() {
    this._guardLive();
    return this.mod._moonlab_ca_peps_norm(this.handle);
  }
  /** Maximum half-cut von Neumann entanglement entropy of `|phi>`
   *  across all bipartitions, in nats. */
  get maxHalfCutEntropy() {
    this._guardLive();
    return this.mod._moonlab_ca_peps_max_half_cut_entropy(this.handle);
  }
  normalize() {
    this._check(
      this.mod._moonlab_ca_peps_normalize(this.handle),
      "normalize"
    );
    return this;
  }
  // ---- Clifford gates ---------------------------------------------------
  h(q) {
    return this._call1("h", q);
  }
  s(q) {
    return this._call1("s", q);
  }
  sdag(q) {
    return this._call1("sdag", q);
  }
  x(q) {
    return this._call1("x", q);
  }
  y(q) {
    return this._call1("y", q);
  }
  z(q) {
    return this._call1("z", q);
  }
  cnot(control, target) {
    return this._call2("cnot", control, target);
  }
  cz(a, b) {
    return this._call2("cz", a, b);
  }
  // ---- Non-Clifford gates ----------------------------------------------
  rx(q, theta) {
    return this._call1p("rx", q, theta);
  }
  ry(q, theta) {
    return this._call1p("ry", q, theta);
  }
  rz(q, theta) {
    return this._call1p("rz", q, theta);
  }
  t(q) {
    return this._call1("t_gate", q);
  }
  tdg(q) {
    return this._call1("t_dagger", q);
  }
  phase(q, theta) {
    return this._call1p("phase", q, theta);
  }
  // ---- Observables -----------------------------------------------------
  /** Marginal `P(Z_q = +1)`. */
  probZ(q) {
    this._guardQubit(q);
    const out = this.mod._malloc(8);
    try {
      this._check(
        this.mod._moonlab_ca_peps_prob_z(this.handle, q, out),
        "prob_z"
      );
      return this.mod.HEAPF64[out >> 3];
    } finally {
      this.mod._free(out);
    }
  }
  /** `<psi | P | psi>` for an n-qubit Pauli string.  Entry per
   *  qubit is `PauliCode` (0=I, 1=X, 2=Y, 3=Z).  Length must equal
   *  `numQubits`.  Returns `[re, im]` of the complex expectation. */
  expectPauli(pauli) {
    this._guardLive();
    const n = this.numQubits;
    if (pauli.length !== n) {
      throw new RangeError(
        `pauli.length=${pauli.length} != numQubits=${n}`
      );
    }
    const pauliPtr = this.mod._malloc(n);
    const outPtr = this.mod._malloc(16);
    try {
      for (let i = 0; i < n; i++) {
        this.mod.HEAPU8[pauliPtr + i] = pauli[i];
      }
      this._check(
        this.mod._moonlab_ca_peps_expect_pauli(this.handle, pauliPtr, outPtr),
        "expect_pauli"
      );
      const idx = outPtr >> 3;
      return [this.mod.HEAPF64[idx], this.mod.HEAPF64[idx + 1]];
    } finally {
      this.mod._free(pauliPtr);
      this.mod._free(outPtr);
    }
  }
  /** `<psi | P_q | psi>` for a single-site Pauli on qubit `q`,
   *  identity elsewhere.  Returns the real part only (single-site
   *  Pauli expectations are real up to roundoff). */
  expectPauliSingle(q, pauli) {
    this._guardQubit(q);
    const n = this.numQubits;
    const ops = new Uint8Array(n);
    ops[q] = pauli;
    return this.expectPauli(ops)[0];
  }
  // ---- Internal helpers ------------------------------------------------
  _guardLive() {
    if (this.freed) throw new Error("CaPeps is disposed");
  }
  _guardQubit(q) {
    this._guardLive();
    const n = this.numQubits;
    if (q < 0 || q >= n) {
      throw new RangeError(`qubit ${q} out of [0, ${n})`);
    }
  }
  _call1(name, q) {
    this._guardQubit(q);
    const m = this.mod;
    this._check(m[`_moonlab_ca_peps_${name}`](this.handle, q), name);
    return this;
  }
  _call1p(name, q, theta) {
    this._guardQubit(q);
    const m = this.mod;
    this._check(m[`_moonlab_ca_peps_${name}`](this.handle, q, theta), name);
    return this;
  }
  _call2(name, a, b) {
    this._guardQubit(a);
    this._guardQubit(b);
    const m = this.mod;
    this._check(m[`_moonlab_ca_peps_${name}`](this.handle, a, b), name);
    return this;
  }
  _check(rc, fn) {
    if (rc !== 0) throw new Error(`moonlab_ca_peps_${fn} rc=${rc}`);
  }
};

// src/bell.ts
var BellState = /* @__PURE__ */ ((BellState2) => {
  BellState2[BellState2["PhiPlus"] = 0] = "PhiPlus";
  BellState2[BellState2["PhiMinus"] = 1] = "PhiMinus";
  BellState2[BellState2["PsiPlus"] = 2] = "PsiPlus";
  BellState2[BellState2["PsiMinus"] = 3] = "PsiMinus";
  return BellState2;
})(BellState || {});
function readBellResult(m, resultPtr) {
  const idx = resultPtr >> 3;
  const d = m.HEAPF64;
  const i32 = resultPtr >> 2;
  return {
    chshValue: d[idx + 0],
    correlationAB: d[idx + 1],
    correlationABprime: d[idx + 2],
    correlationAprimeB: d[idx + 3],
    correlationAprimeBprime: d[idx + 4],
    classicalBound: d[idx + 5],
    quantumBound: d[idx + 6],
    pValue: d[idx + 7],
    standardError: d[idx + 8],
    measurements: m.HEAP32[i32 + 18],
    // byte 72 / 4
    violatesClassical: m.HEAP32[i32 + 19] !== 0,
    confirmsQuantum: m.HEAP32[i32 + 20] !== 0,
    statisticallySignificant: m.HEAP32[i32 + 21] !== 0
  };
}
async function withEntropy(fn) {
  const m = await getModule();
  const entropy = m._quantum_entropy_ctx_create_hw();
  if (!entropy) throw new Error("quantum_entropy_ctx_create_hw returned NULL");
  try {
    return fn(m, entropy);
  } finally {
    m._quantum_entropy_ctx_destroy(entropy);
  }
}
async function createBellState(state, qubit1, qubit2, type) {
  const m = await getModule();
  const rc = m._create_bell_state(
    state._internal_state_pointer(),
    qubit1,
    qubit2,
    type
  );
  if (rc !== 0) throw new Error(`create_bell_state rc=${rc}`);
}
async function chshTest(state, qubitA, qubitB, numMeasurements2) {
  return withEntropy((m, entropy) => {
    const settingsPtr = m._malloc(32);
    const resultPtr = m._malloc(128);
    try {
      m._bell_get_optimal_settings(settingsPtr);
      m._bell_test_chsh(
        resultPtr,
        state._internal_state_pointer(),
        qubitA,
        qubitB,
        numMeasurements2,
        settingsPtr,
        entropy
      );
      return readBellResult(m, resultPtr);
    } finally {
      m._free(resultPtr);
      m._free(settingsPtr);
    }
  });
}
async function merminGhzTest(state, qubitA, qubitB, qubitC, numMeasurements2) {
  return withEntropy((m, entropy) => {
    const resultPtr = m._malloc(128);
    try {
      m._bell_test_mermin_ghz(
        resultPtr,
        state._internal_state_pointer(),
        qubitA,
        qubitB,
        qubitC,
        numMeasurements2,
        entropy
      );
      return readBellResult(m, resultPtr);
    } finally {
      m._free(resultPtr);
    }
  });
}
async function merminKlyshkoTest(state, numQubits, numMeasurements2) {
  return withEntropy((m, entropy) => {
    return m._bell_test_mermin_klyshko(
      state._internal_state_pointer(),
      numQubits,
      numMeasurements2,
      entropy
    );
  });
}

// src/grover.ts
async function groverOptimalIterations(numQubits) {
  const m = await getModule();
  return m._grover_optimal_iterations(numQubits);
}
async function groverSearch(state, markedState, numIterations) {
  const m = await getModule();
  const entropy = m._quantum_entropy_ctx_create_hw();
  if (!entropy) throw new Error("quantum_entropy_ctx_create_hw returned NULL");
  const configPtr = m._malloc(24);
  const resultPtr = m._malloc(40);
  try {
    const numQubits = state.numQubits;
    const useOptimal = numIterations === void 0 ? 1 : 0;
    const iters = numIterations ?? 0;
    m.HEAPU32[configPtr >> 2] = numQubits;
    m.HEAPU32[configPtr + 8 >> 2] = Number(markedState & 0xffffffffn);
    m.HEAPU32[configPtr + 12 >> 2] = Number(markedState >> 32n & 0xffffffffn);
    m.HEAPU32[configPtr + 16 >> 2] = iters;
    m.HEAP32[configPtr + 20 >> 2] = useOptimal;
    m._grover_search(resultPtr, state._internal_state_pointer(), configPtr, entropy);
    const foundLo = BigInt(m.HEAPU32[resultPtr >> 2]);
    const foundHi = BigInt(m.HEAPU32[resultPtr + 4 >> 2]);
    const foundState = foundHi << 32n | foundLo;
    const successProbability = m.HEAPF64[resultPtr + 8 >> 3];
    const oracleCalls = m.HEAPU32[resultPtr + 16 >> 2];
    const iterationsPerformed = m.HEAPU32[resultPtr + 20 >> 2];
    const fidelity = m.HEAPF64[resultPtr + 24 >> 3];
    const foundMarkedState = m.HEAP32[resultPtr + 32 >> 2] !== 0;
    return {
      foundState,
      successProbability,
      oracleCalls,
      iterationsPerformed,
      fidelity,
      foundMarkedState
    };
  } finally {
    m._free(resultPtr);
    m._free(configPtr);
    m._quantum_entropy_ctx_destroy(entropy);
  }
}

// src/vqe.ts
var OptimizerType = /* @__PURE__ */ ((OptimizerType2) => {
  OptimizerType2[OptimizerType2["Cobyla"] = 0] = "Cobyla";
  OptimizerType2[OptimizerType2["Lbfgs"] = 1] = "Lbfgs";
  OptimizerType2[OptimizerType2["Adam"] = 2] = "Adam";
  OptimizerType2[OptimizerType2["GradientDescent"] = 3] = "GradientDescent";
  OptimizerType2[OptimizerType2["Qng"] = 4] = "Qng";
  return OptimizerType2;
})(OptimizerType || {});
var OPTIMIZER_NAMES = {
  cobyla: 0 /* Cobyla */,
  lbfgs: 1 /* Lbfgs */,
  adam: 2 /* Adam */,
  gradient_descent: 3 /* GradientDescent */,
  "gradient-descent": 3 /* GradientDescent */,
  qng: 4 /* Qng */,
  natural_gradient: 4 /* Qng */,
  "natural-gradient": 4 /* Qng */
};
function resolveOptimizer(spec) {
  if (typeof spec === "number") return spec;
  const resolved2 = OPTIMIZER_NAMES[spec.trim().toLowerCase()];
  if (resolved2 === void 0) {
    throw new Error(
      `Unknown optimizer '${spec}'. Valid: ${Object.keys(OPTIMIZER_NAMES).join(", ")}`
    );
  }
  return resolved2;
}
var OPT_OFF_MAX_ITERATIONS = 4;
var OPT_OFF_TOLERANCE = 8;
var ANSATZ_OFF_NUM_PARAMETERS = 12;
var PauliHamiltonian = class _PauliHamiltonian {
  constructor(ptr, mod) {
    this.freed = false;
    this.ptr = ptr;
    this.mod = mod;
  }
  /** Internal: WASM pointer to the underlying ``pauli_hamiltonian_t``. */
  _internal_ptr() {
    if (this.freed) throw new Error("PauliHamiltonian disposed");
    return this.ptr;
  }
  /** H2 molecule Hamiltonian in the STO-3G basis under Jordan-Wigner. */
  static async h2(bondDistance) {
    const mod = await getModule();
    const ptr = mod._vqe_create_h2_hamiltonian(bondDistance);
    if (!ptr) throw new Error("vqe_create_h2_hamiltonian returned NULL");
    return new _PauliHamiltonian(ptr, mod);
  }
  /** LiH molecule Hamiltonian (4 qubits) at the given bond distance. */
  static async lih(bondDistance) {
    const mod = await getModule();
    const ptr = mod._vqe_create_lih_hamiltonian(bondDistance);
    if (!ptr) throw new Error("vqe_create_lih_hamiltonian returned NULL");
    return new _PauliHamiltonian(ptr, mod);
  }
  /** H2O molecule Hamiltonian at its equilibrium geometry. */
  static async h2o() {
    const mod = await getModule();
    const ptr = mod._vqe_create_h2o_hamiltonian();
    if (!ptr) throw new Error("vqe_create_h2o_hamiltonian returned NULL");
    return new _PauliHamiltonian(ptr, mod);
  }
  /** Open a fluent builder for a custom Pauli-sum Hamiltonian. */
  static async builder(numQubits, numTerms) {
    const mod = await getModule();
    const ptr = mod._pauli_hamiltonian_create(numQubits, numTerms);
    if (!ptr) throw new Error("pauli_hamiltonian_create returned NULL");
    return new PauliHamiltonianBuilder(ptr, mod, numTerms);
  }
  /** Read `num_qubits` from the underlying struct.  size_t at byte 0. */
  get numQubits() {
    if (this.freed) throw new Error("PauliHamiltonian disposed");
    return this.mod.HEAPU32[this.ptr >> 2];
  }
  /** Read `num_terms` from the underlying struct.  size_t at byte 4. */
  get numTerms() {
    if (this.freed) throw new Error("PauliHamiltonian disposed");
    return this.mod.HEAPU32[this.ptr + 4 >> 2];
  }
  /** Exact ground-state energy by direct diagonalisation
   *  (O(4^n)).  Intended for small (n <= 10) Hamiltonians as a
   *  reference value for VQE convergence checks.  Returns `NaN`
   *  on internal failure. */
  exactGroundStateEnergy() {
    if (this.freed) throw new Error("PauliHamiltonian disposed");
    return this.mod._vqe_exact_ground_state_energy(this.ptr);
  }
  /** Release the underlying allocation. */
  dispose() {
    if (this.freed) return;
    this.mod._pauli_hamiltonian_free(this.ptr);
    this.freed = true;
  }
};
var PauliHamiltonianBuilder = class {
  /** @internal */
  constructor(ptr, mod, capacity) {
    this.next = 0;
    this.dropped = false;
    this.ptr = ptr;
    this.mod = mod;
    this.capacity = capacity;
  }
  /** Append one Pauli-string term `coefficient * P` where `pauli` is a
   *  string over `{I, X, Y, Z}` of length `numQubits`. */
  addTerm(coefficient, pauli) {
    if (this.next >= this.capacity) {
      throw new Error(`Hamiltonian capacity ${this.capacity} exceeded`);
    }
    const len = pauli.length + 1;
    const strPtr = this.mod._malloc(len);
    try {
      this.mod.stringToUTF8(pauli, strPtr, len);
      const rc = this.mod._pauli_hamiltonian_add_term(
        this.ptr,
        coefficient,
        strPtr,
        this.next
      );
      if (rc !== 0) throw new Error(`pauli_hamiltonian_add_term rc=${rc}`);
      this.next++;
    } finally {
      this.mod._free(strPtr);
    }
    return this;
  }
  /** Consume the builder and return the finished Hamiltonian. */
  build() {
    if (this.dropped) throw new Error("Builder already consumed");
    this.dropped = true;
    return Object.assign(Object.create(PauliHamiltonian.prototype), {
      ptr: this.ptr,
      mod: this.mod,
      freed: false
    });
  }
};
var VqeSolver = class _VqeSolver {
  constructor(solver, ansatz, optimizer, entropy, hamiltonian, mod) {
    this.freed = false;
    this.solver = solver;
    this.ansatz = ansatz;
    this.optimizer = optimizer;
    this.entropy = entropy;
    this.hamiltonian = hamiltonian;
    this.mod = mod;
  }
  /** Construct a VQE solver over `hamiltonian`.
   *
   *  Preferred form: `VqeSolver.create(h, options)` with the
   *  {@link VqeSolverOptions} bag (ansatz family, optimizer by string
   *  or enum, hyperparameters).  The legacy positional form
   *  `VqeSolver.create(h, numLayers, optimizerType)` remains
   *  supported.
   *
   *  The solver takes shared ownership of `hamiltonian` for its
   *  lifetime; the caller can dispose `hamiltonian` after the solver
   *  is disposed. */
  static async create(hamiltonian, optionsOrNumLayers, legacyOptimizerType) {
    const options = typeof optionsOrNumLayers === "number" ? { numLayers: optionsOrNumLayers, optimizer: legacyOptimizerType ?? 2 /* Adam */ } : { ...optionsOrNumLayers ?? {} };
    const mod = await getModule();
    const numQubits = hamiltonian.numQubits;
    const optimizerType = resolveOptimizer(options.optimizer ?? 2 /* Adam */);
    const entropy = mod._quantum_entropy_ctx_create_hw();
    if (!entropy) throw new Error("quantum_entropy_ctx_create_hw returned NULL");
    const ansatzName = (options.ansatz ?? "hardware_efficient").trim().toLowerCase();
    let ansatz;
    if (ansatzName === "uccsd") {
      const numElectrons = options.numElectrons ?? Math.floor(numQubits / 2);
      ansatz = mod._vqe_create_uccsd_ansatz(numQubits, numElectrons);
      if (!ansatz) {
        mod._quantum_entropy_ctx_destroy(entropy);
        throw new Error("vqe_create_uccsd_ansatz returned NULL");
      }
    } else if (ansatzName === "hardware_efficient" || ansatzName === "hardware-efficient" || ansatzName === "hea") {
      ansatz = mod._vqe_create_hardware_efficient_ansatz(
        numQubits,
        options.numLayers ?? 2
      );
      if (!ansatz) {
        mod._quantum_entropy_ctx_destroy(entropy);
        throw new Error("vqe_create_hardware_efficient_ansatz returned NULL");
      }
    } else {
      mod._quantum_entropy_ctx_destroy(entropy);
      throw new Error(
        `Unknown ansatz '${options.ansatz}'. Valid: 'hardware_efficient', 'uccsd'`
      );
    }
    const optimizer = mod._vqe_optimizer_create(optimizerType);
    if (!optimizer) {
      mod._vqe_ansatz_free(ansatz);
      mod._quantum_entropy_ctx_destroy(entropy);
      throw new Error("vqe_optimizer_create returned NULL");
    }
    if (options.learningRate !== void 0 || options.beta1 !== void 0 || options.beta2 !== void 0 || options.epsilon !== void 0 || options.qngRegularization !== void 0) {
      mod._vqe_optimizer_set_hyperparams(
        optimizer,
        options.learningRate ?? NaN,
        options.beta1 ?? NaN,
        options.beta2 ?? NaN,
        options.epsilon ?? NaN,
        options.qngRegularization ?? NaN
      );
    }
    if (options.maxIterations !== void 0) {
      mod.HEAPU32[optimizer + OPT_OFF_MAX_ITERATIONS >> 2] = options.maxIterations;
    }
    if (options.tolerance !== void 0) {
      mod.HEAPF64[optimizer + OPT_OFF_TOLERANCE >> 3] = options.tolerance;
    }
    const solver = mod._vqe_solver_create(
      hamiltonian._internal_ptr(),
      ansatz,
      optimizer,
      entropy
    );
    if (!solver) {
      mod._vqe_optimizer_free(optimizer);
      mod._vqe_ansatz_free(ansatz);
      mod._quantum_entropy_ctx_destroy(entropy);
      throw new Error("vqe_solver_create returned NULL");
    }
    return new _VqeSolver(solver, ansatz, optimizer, entropy, hamiltonian, mod);
  }
  /** Number of variational parameters in the underlying ansatz. */
  get numParameters() {
    if (this.freed) throw new Error("VqeSolver disposed");
    return this.mod.HEAPU32[this.ansatz + ANSATZ_OFF_NUM_PARAMETERS >> 2];
  }
  /** Run the classical-quantum optimisation loop to convergence. */
  solve() {
    if (this.freed) throw new Error("VqeSolver disposed");
    const resultPtr = this.mod._malloc(64);
    try {
      this.mod._vqe_solve(resultPtr, this.solver);
      const groundStateEnergy = this.mod.HEAPF64[resultPtr + 0 >> 3];
      const paramsArrPtr = this.mod.HEAPU32[resultPtr + 8 >> 2];
      const numParameters = this.mod.HEAPU32[resultPtr + 12 >> 2];
      const iterations = this.mod.HEAPU32[resultPtr + 16 >> 2];
      const convergenceTolerance = this.mod.HEAPF64[resultPtr + 24 >> 3];
      const converged = this.mod.HEAP32[resultPtr + 32 >> 2] !== 0;
      const params = paramsArrPtr && numParameters > 0 ? new Float64Array(
        this.mod.HEAPF64.buffer,
        paramsArrPtr,
        numParameters
      ).slice() : new Float64Array(0);
      const eKcalMol = this.mod._vqe_hartree_to_kcalmol(groundStateEnergy);
      return {
        groundStateEnergy,
        groundStateEnergyKcalMol: eKcalMol,
        optimalParameters: params,
        iterations,
        convergenceTolerance,
        converged
      };
    } finally {
      this.mod._vqe_result_free(resultPtr);
      this.mod._free(resultPtr);
    }
  }
  /** Compute `E(theta) = <psi(theta) | H | psi(theta)>` at an
   *  arbitrary parameter vector. */
  computeEnergy(parameters) {
    if (this.freed) throw new Error("VqeSolver disposed");
    const bytes = parameters.length * 8;
    const ptr = this.mod._malloc(bytes);
    try {
      const idx = ptr >> 3;
      for (let i = 0; i < parameters.length; i++) {
        this.mod.HEAPF64[idx + i] = parameters[i];
      }
      return this.mod._vqe_compute_energy(this.solver, ptr);
    } finally {
      this.mod._free(ptr);
    }
  }
  /** Number of qubits the underlying Hamiltonian acts on. */
  get numQubits() {
    return this.hamiltonian.numQubits;
  }
  /** Release every C-side allocation owned by this solver. */
  dispose() {
    if (this.freed) return;
    this.mod._vqe_solver_free(this.solver);
    this.mod._vqe_optimizer_free(this.optimizer);
    this.mod._vqe_ansatz_free(this.ansatz);
    this.mod._quantum_entropy_ctx_destroy(this.entropy);
    this.freed = true;
  }
};

// src/qaoa.ts
var Graph = class _Graph {
  constructor(ptr, mod) {
    this.freed = false;
    this.ptr = ptr;
    this.mod = mod;
  }
  /** @internal */
  _internal_ptr() {
    if (this.freed) throw new Error("Graph disposed");
    return this.ptr;
  }
  /** Build a graph on `numVertices` vertices with the given
   *  weighted edges `[u, v, weight]`. */
  static async create(numVertices, edges) {
    const mod = await getModule();
    const ptr = mod._graph_create(numVertices, edges.length);
    if (!ptr) throw new Error("graph_create returned NULL");
    for (let i = 0; i < edges.length; i++) {
      const [u, v, w] = edges[i];
      const rc = mod._graph_add_edge(ptr, i, u, v, w);
      if (rc !== 0) {
        mod._graph_free(ptr);
        throw new Error(`graph_add_edge(idx=${i}, u=${u}, v=${v}) rc=${rc}`);
      }
    }
    return new _Graph(ptr, mod);
  }
  /** Release the underlying allocation. */
  dispose() {
    if (this.freed) return;
    this.mod._graph_free(this.ptr);
    this.freed = true;
  }
};
var IsingModel = class _IsingModel {
  constructor(ptr, mod) {
    this.freed = false;
    this.ptr = ptr;
    this.mod = mod;
  }
  /** @internal */
  _internal_ptr() {
    if (this.freed) throw new Error("IsingModel disposed");
    return this.ptr;
  }
  /** Empty Ising model on `numQubits` spins.  Add couplings / fields
   *  via {@link setCoupling} / {@link setField}. */
  static async create(numQubits) {
    const mod = await getModule();
    const ptr = mod._ising_model_create(numQubits);
    if (!ptr) throw new Error("ising_model_create returned NULL");
    return new _IsingModel(ptr, mod);
  }
  /** Encode a MaxCut problem on `graph` as the equivalent Ising
   *  model: `H = sum_{(i,j) in E} w_{ij} (1 - s_i s_j) / 2`. */
  static async fromMaxcut(graph) {
    const mod = await getModule();
    const ptr = mod._ising_encode_maxcut(graph._internal_ptr());
    if (!ptr) throw new Error("ising_encode_maxcut returned NULL");
    return new _IsingModel(ptr, mod);
  }
  /** Set the symmetric coupling `J_{ij}`. */
  setCoupling(i, j, value) {
    if (this.freed) throw new Error("IsingModel disposed");
    const rc = this.mod._ising_model_set_coupling(this.ptr, i, j, value);
    if (rc !== 0) throw new Error(`ising_model_set_coupling(${i},${j}) rc=${rc}`);
    return this;
  }
  /** Set the on-site field `h_i`. */
  setField(i, value) {
    if (this.freed) throw new Error("IsingModel disposed");
    const rc = this.mod._ising_model_set_field(this.ptr, i, value);
    if (rc !== 0) throw new Error(`ising_model_set_field(${i}) rc=${rc}`);
    return this;
  }
  /** Evaluate the classical Ising energy on the bitstring
   *  `bits[i] = (bitstring >> i) & 1`. */
  evaluate(bitstring) {
    if (this.freed) throw new Error("IsingModel disposed");
    return this.mod._ising_model_evaluate(this.ptr, bitstring);
  }
  /** Release the underlying allocation. */
  dispose() {
    if (this.freed) return;
    this.mod._ising_model_free(this.ptr);
    this.freed = true;
  }
};
var QaoaSolver = class _QaoaSolver {
  constructor(solver, entropy, ising, mod) {
    this.freed = false;
    this.solver = solver;
    this.entropy = entropy;
    this.ising = ising;
    this.mod = mod;
  }
  /** Build a QAOA solver at depth `numLayers` over `ising`. */
  static async create(ising, numLayers) {
    if (numLayers < 1) throw new RangeError("numLayers must be >= 1");
    const mod = await getModule();
    const entropy = mod._quantum_entropy_ctx_create_hw();
    if (!entropy) throw new Error("quantum_entropy_ctx_create_hw returned NULL");
    const solver = mod._qaoa_solver_create(
      ising._internal_ptr(),
      numLayers,
      entropy
    );
    if (!solver) {
      mod._quantum_entropy_ctx_destroy(entropy);
      throw new Error("qaoa_solver_create returned NULL");
    }
    return new _QaoaSolver(solver, entropy, ising, mod);
  }
  /** Run the QAOA optimisation loop to convergence. */
  solve() {
    if (this.freed) throw new Error("QaoaSolver disposed");
    const resultPtr = this.mod._malloc(64);
    try {
      this.mod._qaoa_solve(resultPtr, this.solver);
      const bitLo = BigInt(this.mod.HEAPU32[resultPtr >> 2]);
      const bitHi = BigInt(this.mod.HEAPU32[resultPtr + 4 >> 2]);
      const bestBitstring = bitHi << 32n | bitLo;
      const bestEnergy = this.mod.HEAPF64[resultPtr + 8 >> 3];
      const numIterations = this.mod.HEAPU32[resultPtr + 20 >> 2];
      const converged = this.mod.HEAP32[resultPtr + 24 >> 2] !== 0;
      const approximationRatio = this.mod.HEAPF64[resultPtr + 32 >> 3];
      const gammaPtr = this.mod.HEAPU32[resultPtr + 40 >> 2];
      const betaPtr = this.mod.HEAPU32[resultPtr + 44 >> 2];
      const numLayers = this.mod.HEAPU32[resultPtr + 48 >> 2];
      const totalMeasurements = this.mod.HEAPU32[resultPtr + 52 >> 2];
      const copyOut = (ptr, n) => ptr && n > 0 ? new Float64Array(this.mod.HEAPF64.buffer, ptr, n).slice() : new Float64Array(0);
      return {
        bestBitstring,
        bestEnergy,
        numIterations,
        converged,
        approximationRatio,
        optimalGamma: copyOut(gammaPtr, numLayers),
        optimalBeta: copyOut(betaPtr, numLayers),
        numLayers,
        totalMeasurements
      };
    } finally {
      this.mod._free(resultPtr);
    }
  }
  /** Evaluate `<H_C>(gamma, beta)` at the given angles without
   *  running the optimiser. */
  computeExpectation(gamma, beta) {
    if (this.freed) throw new Error("QaoaSolver disposed");
    const gPtr = this.mod._malloc(gamma.length * 8);
    const bPtr = this.mod._malloc(beta.length * 8);
    try {
      for (let i = 0; i < gamma.length; i++) {
        this.mod.HEAPF64[(gPtr >> 3) + i] = gamma[i];
      }
      for (let i = 0; i < beta.length; i++) {
        this.mod.HEAPF64[(bPtr >> 3) + i] = beta[i];
      }
      return this.mod._qaoa_compute_expectation(this.solver, gPtr, bPtr);
    } finally {
      this.mod._free(gPtr);
      this.mod._free(bPtr);
    }
  }
  /** Release every C-side allocation owned by this solver. */
  dispose() {
    if (this.freed) return;
    this.mod._qaoa_solver_free(this.solver);
    this.mod._quantum_entropy_ctx_destroy(this.entropy);
    this.freed = true;
  }
};

// src/annealing.ts
var SUMMARY_BYTES = 96;
var scheduleCode = {
  linear: 0,
  quadratic: 1,
  cosine: 2
};
function resolved(config = {}) {
  const result = {
    totalTime: config.totalTime ?? 10,
    numSteps: config.numSteps ?? 1e3,
    numSamples: config.numSamples ?? 1024,
    seed: config.seed ?? 0n,
    schedule: scheduleCode[config.schedule ?? "cosine"],
    driverStrength: config.driverStrength ?? 1,
    problemStrength: config.problemStrength ?? 1,
    secondOrder: config.secondOrder ?? true
  };
  if (!(result.totalTime > 0) || !Number.isInteger(result.numSteps) || result.numSteps < 1 || result.numSteps > 1e7 || !Number.isInteger(result.numSamples) || result.numSamples < 1 || result.numSamples > 1e7 || !Number.isInteger(result.schedule) || result.seed < 0n || result.seed > 0xffffffffffffffffn || !(result.driverStrength > 0) || !(result.problemStrength > 0)) {
    throw new RangeError("invalid annealing configuration");
  }
  return result;
}
function squareDimension(matrix) {
  const n = Math.sqrt(matrix.length);
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError("matrix must be non-empty and square");
  }
  return n;
}
function writeF64(mod, values) {
  const ptr = mod._malloc(values.length * 8);
  if (!ptr) throw new Error("Moonlab WASM allocation failed");
  mod.HEAPF64.set(values, ptr >>> 3);
  return ptr;
}
function parseResult(mod, summary, samplesPtr, energiesPtr, n, count) {
  const view = new DataView(mod.HEAPU8.buffer);
  const u64 = (offset) => view.getBigUint64(summary + offset, true);
  const f64 = (offset) => view.getFloat64(summary + offset, true);
  const samples = [];
  const sampleEnergies = [];
  for (let i = 0; i < count; i++) {
    samples.push(view.getBigUint64(samplesPtr + i * 8, true));
    sampleEnergies.push(view.getFloat64(energiesPtr + i * 8, true));
  }
  return {
    numQubits: n,
    effectiveSeed: u64(0),
    bestBitstring: u64(8),
    mostLikelyBitstring: u64(16),
    groundBitstring: u64(24),
    groundDegeneracy: view.getUint32(summary + 32, true),
    bestEnergy: f64(40),
    groundEnergy: f64(48),
    expectedEnergy: f64(56),
    successProbability: f64(64),
    residualEnergy: f64(72),
    problemGap: f64(80),
    finalNorm: f64(88),
    samples,
    sampleEnergies
  };
}
function buffers(mod, count) {
  const summary = mod._malloc(SUMMARY_BYTES);
  const samples = mod._malloc(count * 8);
  const energies = mod._malloc(count * 8);
  if (!summary || !samples || !energies) {
    if (summary) mod._free(summary);
    if (samples) mod._free(samples);
    if (energies) mod._free(energies);
    throw new Error("Moonlab WASM allocation failed");
  }
  return { summary, samples, energies };
}
async function annealIsing(fields, couplings, offset = 0, config = {}) {
  return annealIsingWithModule(
    await getModule(),
    fields,
    couplings,
    offset,
    config
  );
}
function annealIsingWithModule(mod, fields, couplings, offset = 0, config = {}) {
  const n = squareDimension(couplings);
  if (fields.length !== n) throw new RangeError("fields length must match matrix");
  const c = resolved(config);
  const h2 = writeF64(mod, fields), j = writeF64(mod, couplings);
  const out = buffers(mod, c.numSamples);
  try {
    const rc = mod._moonlab_anneal_ising_v1(
      n,
      h2,
      j,
      offset,
      c.totalTime,
      c.numSteps,
      c.numSamples,
      c.seed,
      c.schedule,
      c.driverStrength,
      c.problemStrength,
      c.secondOrder ? 1 : 0,
      out.summary,
      out.samples,
      out.energies
    );
    if (rc !== 0) throw new Error(`moonlab_anneal_ising_v1 failed: ${rc}`);
    return parseResult(mod, out.summary, out.samples, out.energies, n, c.numSamples);
  } finally {
    mod._free(h2);
    mod._free(j);
    mod._free(out.summary);
    mod._free(out.samples);
    mod._free(out.energies);
  }
}
async function annealQubo(qubo, offset = 0, config = {}) {
  return annealQuboWithModule(
    await getModule(),
    qubo,
    offset,
    config
  );
}
function annealQuboWithModule(mod, qubo, offset = 0, config = {}) {
  const n = squareDimension(qubo);
  const c = resolved(config);
  const q = writeF64(mod, qubo);
  const out = buffers(mod, c.numSamples);
  try {
    const rc = mod._moonlab_anneal_qubo_v1(
      n,
      q,
      offset,
      c.totalTime,
      c.numSteps,
      c.numSamples,
      c.seed,
      c.schedule,
      c.driverStrength,
      c.problemStrength,
      c.secondOrder ? 1 : 0,
      out.summary,
      out.samples,
      out.energies
    );
    if (rc !== 0) throw new Error(`moonlab_anneal_qubo_v1 failed: ${rc}`);
    return parseResult(mod, out.summary, out.samples, out.energies, n, c.numSamples);
  } finally {
    mod._free(q);
    mod._free(out.summary);
    mod._free(out.samples);
    mod._free(out.energies);
  }
}

// src/topology.ts
var INT_MIN = -2147483648;
function check(value, label) {
  if (value === INT_MIN) {
    throw new Error(`${label} failed (returned INT_MIN sentinel)`);
  }
  return value;
}
async function qwzChern(opts) {
  const mod = await getModule();
  const n = opts.n ?? 16;
  return check(mod._moonlab_qwz_chern(opts.m, n, 0), "qwzChern");
}
async function chernQwzProj(opts) {
  const mod = await getModule();
  const n = opts.n ?? 16;
  return check(mod._moonlab_chern_qwz_proj(opts.m, n), "chernQwzProj");
}
async function chernQwzParallelTransport(opts) {
  const mod = await getModule();
  const n = opts.n ?? 16;
  return check(mod._moonlab_chern_qwz_pt(opts.m, n), "chernQwzParallelTransport");
}
async function sshWinding(opts) {
  const mod = await getModule();
  const n = opts.n ?? 64;
  return check(mod._moonlab_ssh_winding(opts.t1, opts.t2, n), "sshWinding");
}
async function kitaevChainZ2(opts) {
  const mod = await getModule();
  return check(
    mod._moonlab_kitaev_chain_z2(opts.t ?? 1, opts.mu, opts.delta ?? 1),
    "kitaevChainZ2"
  );
}
async function kaneMeleZ2(opts) {
  const mod = await getModule();
  const n = opts.n ?? 8;
  return check(
    mod._moonlab_kane_mele_z2(
      opts.t ?? 1,
      opts.lambdaSo,
      opts.lambdaR ?? 0,
      opts.lambdaV,
      n
    ),
    "kaneMeleZ2"
  );
}
async function bhzZ2(opts) {
  const mod = await getModule();
  const n = opts.n ?? 8;
  return check(mod._moonlab_bhz_z2(opts.A, opts.B, opts.M, n), "bhzZ2");
}
async function hofstadterChern(opts) {
  const mod = await getModule();
  const nOcc = opts.nOccupied ?? 1;
  const n = opts.n ?? 16;
  return check(
    mod._moonlab_hofstadter_chern(opts.t ?? 1, opts.p, opts.q, nOcc, n),
    "hofstadterChern"
  );
}

// src/surface-code.ts
var SurfaceCode = class _SurfaceCode {
  constructor(handle, mod, distance) {
    this.freed = false;
    this.handle = handle;
    this.mod = mod;
    this._distance = distance;
  }
  /** Allocate a rotated surface code.  `distance` must be odd and
   *  `>= 3`; the C side rejects even or trivial distances.
   *  `rngSeed` is a splitmix64 state for ancilla-mediated
   *  measurement; pass a fixed seed for reproducibility. */
  static async create(distance, rngSeed = 0n) {
    if (distance < 3 || distance % 2 === 0) {
      throw new RangeError(
        `surface code distance must be odd and >= 3, got ${distance}`
      );
    }
    const mod = await getModule();
    const h2 = mod._surface_code_clifford_create(distance, rngSeed);
    if (!h2) throw new Error("surface_code_clifford_create returned NULL");
    return new _SurfaceCode(h2, mod, distance);
  }
  /** Release the underlying allocation. */
  dispose() {
    if (this.freed) return;
    this.mod._surface_code_clifford_free(this.handle);
    this.freed = true;
  }
  /** Code distance `d`. */
  get distance() {
    return this._distance;
  }
  /** Number of physical data qubits = `d^2`. */
  get numDataQubits() {
    return this._distance * this._distance;
  }
  /** Number of ancillas in each parity sector = `(d - 1)^2`.
   *  Total ancillas across both sectors = `2 (d - 1)^2`. */
  get numAncillasPerSector() {
    const m = this._distance - 1;
    return m * m;
  }
  /** Linear data-qubit index from `(row, col)` in `[0, d)`. */
  dataIndex(row, col) {
    this._guardLive();
    if (row < 0 || row >= this._distance || col < 0 || col >= this._distance) {
      throw new RangeError(
        `(row, col) = (${row}, ${col}) out of [0, ${this._distance})`
      );
    }
    return this.mod._surface_code_clifford_data_index(this.handle, row, col);
  }
  /** Apply a single-qubit Pauli error on data qubit `qubit`. */
  applyError(qubit, errorType) {
    this._guardLive();
    if (qubit < 0 || qubit >= this.numDataQubits) {
      throw new RangeError(
        `data qubit ${qubit} out of [0, ${this.numDataQubits})`
      );
    }
    if (errorType !== "X" && errorType !== "Y" && errorType !== "Z") {
      throw new TypeError(
        `errorType must be 'X', 'Y', or 'Z', got ${errorType}`
      );
    }
    const rc = this.mod._surface_code_clifford_apply_error(
      this.handle,
      qubit,
      errorType.charCodeAt(0)
    );
    if (rc !== 0) throw new Error(`apply_error rc=${rc}`);
  }
  /** Measure all `(d - 1)^2` Z-type stabilisers (ZZZZ on four
   *  data qubits around each interior vertex). */
  measureZSyndromes() {
    this._guardLive();
    const rc = this.mod._surface_code_clifford_measure_z_syndromes(this.handle);
    if (rc !== 0) throw new Error(`measure_z_syndromes rc=${rc}`);
  }
  /** Measure all `(d - 1)^2` X-type stabilisers (XXXX on four
   *  data qubits around each interior face). */
  measureXSyndromes() {
    this._guardLive();
    const rc = this.mod._surface_code_clifford_measure_x_syndromes(this.handle);
    if (rc !== 0) throw new Error(`measure_x_syndromes rc=${rc}`);
  }
  /** Set-bit count across both X and Z syndromes (diagnostic).
   *  Zero on a logical-zero start; non-zero after an undetectable
   *  Pauli error. */
  get syndromeWeight() {
    this._guardLive();
    return this.mod._surface_code_clifford_syndrome_weight(this.handle);
  }
  _guardLive() {
    if (this.freed) throw new Error("SurfaceCode is disposed");
  }
};

// src/libirrep-qec.ts
var MOONLAB_LIBIRREP_OK = 0;
var MOONLAB_LIBIRREP_NOT_BUILT = -201;
var MOONLAB_LIBIRREP_BAD_ARG = -202;
var MOONLAB_LIBIRREP_INTERNAL = -203;
var MOONLAB_LIBIRREP_OOM = -204;
var LibirrepError = class extends Error {
  constructor(message, rc) {
    super(message);
    this.name = "LibirrepError";
    this.rc = rc;
  }
};
var LibirrepNotBuiltError = class extends LibirrepError {
  constructor(ctx) {
    super(
      `${ctx}: moonlab was compiled without libirrep (rebuild with -DQSIM_ENABLE_LIBIRREP=ON).`,
      MOONLAB_LIBIRREP_NOT_BUILT
    );
    this.name = "LibirrepNotBuiltError";
  }
};
function _raiseFor(rc, ctx) {
  if (rc === MOONLAB_LIBIRREP_OK) return;
  if (rc === MOONLAB_LIBIRREP_NOT_BUILT) throw new LibirrepNotBuiltError(ctx);
  throw new LibirrepError(`${ctx}: rc=${rc}`, rc);
}
var LibirrepQecCode = class _LibirrepQecCode {
  constructor(handle, mod) {
    this.freed = false;
    this.handle = handle;
    this.mod = mod;
  }
  /** Whether the WASM build was linked with libirrep (the default
   *  WASM build is NOT linked). */
  static async isAvailable() {
    const mod = await getModule();
    return mod._moonlab_libirrep_available() === 1;
  }
  static async _factory(builder, ctx) {
    const mod = await getModule();
    const outPtr = mod._malloc(4);
    try {
      const rc = builder(mod, outPtr);
      _raiseFor(rc, ctx);
      const handle = mod.HEAP32[outPtr >> 2];
      if (!handle) throw new LibirrepError(`${ctx}: handle is NULL`, MOONLAB_LIBIRREP_INTERNAL);
      return new _LibirrepQecCode(handle, mod);
    } finally {
      mod._free(outPtr);
    }
  }
  /** Rotated surface code at the given (odd) distance, `>= 2`. */
  static async surface(distance) {
    return _LibirrepQecCode._factory(
      (mod, outPtr) => mod._moonlab_libirrep_surface_code_new(distance, outPtr),
      `surface(distance=${distance})`
    );
  }
  /** Kitaev 2D toric code on the `Lx x Ly` torus. */
  static async toric(lx, ly) {
    return _LibirrepQecCode._factory(
      (mod, outPtr) => mod._moonlab_libirrep_toric_code_new(lx, ly, outPtr),
      `toric(Lx=${lx}, Ly=${ly})`
    );
  }
  /** Steane [[7, 1, 3]] 2D color code. */
  static async steane() {
    return _LibirrepQecCode._factory(
      (mod, outPtr) => mod._moonlab_libirrep_color_steane_new(outPtr),
      "steane()"
    );
  }
  /** [[15, 7, 3]] Hamming-based CSS code. */
  static async hamming15_7_3() {
    return _LibirrepQecCode._factory(
      (mod, outPtr) => mod._moonlab_libirrep_color_hamming_15_7_3_new(outPtr),
      "hamming15_7_3()"
    );
  }
  /** IBM Gross-72 bivariate-bicycle qLDPC code [[72, 12, 6]]. */
  static async bb72_12_6() {
    return _LibirrepQecCode._factory(
      (mod, outPtr) => mod._moonlab_libirrep_bb_72_12_6_new(outPtr),
      "bb72_12_6()"
    );
  }
  /** IBM Gross-144 bivariate-bicycle qLDPC code [[144, 12, 12]]. */
  static async bb144_12_12() {
    return _LibirrepQecCode._factory(
      (mod, outPtr) => mod._moonlab_libirrep_bb_144_12_12_new(outPtr),
      "bb144_12_12()"
    );
  }
  /** IBM Gross-288 bivariate-bicycle qLDPC code [[288, 12, 18]]. */
  static async bb288_12_18() {
    return _LibirrepQecCode._factory(
      (mod, outPtr) => mod._moonlab_libirrep_bb_288_12_18_new(outPtr),
      "bb288_12_18()"
    );
  }
  /** Tillich-Zemor hypergraph product of two `[d, 1, d]` repetition
   *  codes.  Only `d in {3, 4, 5}` is supported. */
  static async hgpRepetition(d) {
    return _LibirrepQecCode._factory(
      (mod, outPtr) => mod._moonlab_libirrep_hgp_repetition_new(d, outPtr),
      `hgpRepetition(d=${d})`
    );
  }
  /** Release the underlying C handle. */
  dispose() {
    if (this.freed) return;
    this.mod._moonlab_libirrep_qec_free(this.handle);
    this.freed = true;
  }
  _guardLive() {
    if (this.freed) throw new Error("LibirrepQecCode is disposed");
  }
  /** Number of physical qubits `n`. */
  get numQubits() {
    this._guardLive();
    return this.mod._moonlab_libirrep_qec_n_qubits(this.handle);
  }
  /** Number of X-stabiliser generators. */
  get numXStabs() {
    this._guardLive();
    return this.mod._moonlab_libirrep_qec_n_x_stabs(this.handle);
  }
  /** Number of Z-stabiliser generators. */
  get numZStabs() {
    this._guardLive();
    return this.mod._moonlab_libirrep_qec_n_z_stabs(this.handle);
  }
  /** Number of logical qubits `k = n - rank(H_X) - rank(H_Z)`. */
  get logicalQubits() {
    this._guardLive();
    return this.mod._moonlab_libirrep_qec_logical_qubits(this.handle);
  }
  /** Brute-force code distance.  Memoised by the C bridge after the
   *  first call.  Only tractable up to `n ~ 25, d <= 5`. */
  get distance() {
    this._guardLive();
    return this.mod._moonlab_libirrep_qec_distance(this.handle);
  }
  /** Length-`numQubits` `0/1` support vector of the X-stabiliser
   *  at the given row. */
  xCheckRow(row) {
    this._guardLive();
    const n = this.numQubits;
    const buf = this.mod._malloc(n);
    try {
      const rc = this.mod._moonlab_libirrep_qec_get_x_check_row(
        this.handle,
        row,
        buf
      );
      _raiseFor(rc, `xCheckRow(${row})`);
      return new Uint8Array(this.mod.HEAPU8.subarray(buf, buf + n));
    } finally {
      this.mod._free(buf);
    }
  }
  /** Length-`numQubits` `0/1` support vector of the Z-stabiliser
   *  at the given row. */
  zCheckRow(row) {
    this._guardLive();
    const n = this.numQubits;
    const buf = this.mod._malloc(n);
    try {
      const rc = this.mod._moonlab_libirrep_qec_get_z_check_row(
        this.handle,
        row,
        buf
      );
      _raiseFor(rc, `zCheckRow(${row})`);
      return new Uint8Array(this.mod.HEAPU8.subarray(buf, buf + n));
    } finally {
      this.mod._free(buf);
    }
  }
};

// src/qgtl.ts
var GateType = /* @__PURE__ */ ((GateType2) => {
  GateType2[GateType2["I"] = 0] = "I";
  GateType2[GateType2["X"] = 1] = "X";
  GateType2[GateType2["Y"] = 2] = "Y";
  GateType2[GateType2["Z"] = 3] = "Z";
  GateType2[GateType2["H"] = 4] = "H";
  GateType2[GateType2["S"] = 5] = "S";
  GateType2[GateType2["T"] = 6] = "T";
  GateType2[GateType2["RX"] = 7] = "RX";
  GateType2[GateType2["RY"] = 8] = "RY";
  GateType2[GateType2["RZ"] = 9] = "RZ";
  GateType2[GateType2["CNOT"] = 10] = "CNOT";
  GateType2[GateType2["CY"] = 11] = "CY";
  GateType2[GateType2["CZ"] = 12] = "CZ";
  GateType2[GateType2["SWAP"] = 13] = "SWAP";
  return GateType2;
})(GateType || {});
var MOONLAB_QGTL_OK = 0;
var MOONLAB_QGTL_BAD_ARG = -301;
var MOONLAB_QGTL_OOM = -302;
var MOONLAB_QGTL_UNSUPPORTED = -303;
var MOONLAB_QGTL_INTERNAL = -304;
var QgtlError = class extends Error {
  constructor(message, rc) {
    super(message);
    this.name = "QgtlError";
    this.rc = rc;
  }
};
var QgtlCircuit = class _QgtlCircuit {
  constructor(handle, mod, numQubits) {
    this.freed = false;
    this.handle = handle;
    this.mod = mod;
    this._n = numQubits;
  }
  static async create(numQubits) {
    const mod = await getModule();
    const h2 = mod._moonlab_qgtl_circuit_create(numQubits);
    if (!h2) {
      throw new QgtlError(
        `circuit_create(${numQubits}) returned NULL (num_qubits must be in [1, 32])`,
        MOONLAB_QGTL_BAD_ARG
      );
    }
    return new _QgtlCircuit(h2, mod, numQubits);
  }
  dispose() {
    if (this.freed) return;
    this.mod._moonlab_qgtl_circuit_free(this.handle);
    this.freed = true;
  }
  get numQubits() {
    return this._n;
  }
  get numGates() {
    return this.mod._moonlab_qgtl_circuit_num_gates(this.handle);
  }
  addGate(type, target, control = -1, params = []) {
    let paramsPtr = 0;
    if (params.length > 0) {
      paramsPtr = this.mod._malloc(8 * params.length);
      const view = this.mod.HEAPF64;
      for (let i = 0; i < params.length; i++) {
        view[(paramsPtr >> 3) + i] = params[i];
      }
    }
    try {
      const rc = this.mod._moonlab_qgtl_add_gate(this.handle, type, target, control, paramsPtr);
      if (rc !== 0) {
        throw new QgtlError(
          `addGate(${GateType[type]}, target=${target}, control=${control}): rc=${rc}`,
          rc
        );
      }
    } finally {
      if (paramsPtr) this.mod._free(paramsPtr);
    }
    return this;
  }
  async execute(opts = {}) {
    const numShots = opts.numShots ?? 0;
    const rngSeed = opts.rngSeed ?? 0n;
    const returnProbs = opts.returnProbabilities ?? false;
    const optsPtr = this.mod._malloc(24);
    const resPtr = this.mod._malloc(24);
    try {
      this.mod.HEAP32[optsPtr >> 2] = numShots;
      this.mod.HEAPU32[(optsPtr >> 2) + 2] = Number(rngSeed & 0xFFFFFFFFn);
      this.mod.HEAPU32[(optsPtr >> 2) + 3] = Number(rngSeed >> 32n & 0xFFFFFFFFn);
      this.mod.HEAP32[(optsPtr >> 2) + 4] = returnProbs ? 1 : 0;
      for (let i = 0; i < 6; i++) this.mod.HEAP32[(resPtr >> 2) + i] = 0;
      const rc = this.mod._moonlab_qgtl_execute(this.handle, optsPtr, resPtr);
      if (rc !== 0) throw new QgtlError(`execute: rc=${rc}`, rc);
      const numQubits = this.mod.HEAP32[resPtr >> 2];
      const numShotsOut = this.mod.HEAP32[(resPtr >> 2) + 1];
      const outcomesPtr = this.mod.HEAPU32[(resPtr >> 2) + 2];
      const probsPtr = this.mod.HEAPU32[(resPtr >> 2) + 3];
      let outcomes = null;
      if (numShotsOut > 0 && outcomesPtr) {
        outcomes = new BigUint64Array(numShotsOut);
        for (let i = 0; i < numShotsOut; i++) {
          const lo = BigInt(this.mod.HEAPU32[(outcomesPtr >> 2) + 2 * i]);
          const hi = BigInt(this.mod.HEAPU32[(outcomesPtr >> 2) + 2 * i + 1]);
          outcomes[i] = lo | hi << 32n;
        }
      }
      let probabilities = null;
      if (returnProbs && probsPtr) {
        const dim = 1 << numQubits;
        probabilities = new Float64Array(
          this.mod.HEAPF64.subarray(probsPtr >> 3, (probsPtr >> 3) + dim)
        );
      }
      this.mod._moonlab_qgtl_results_free(resPtr);
      return { numQubits, numShots: numShotsOut, outcomes, probabilities };
    } finally {
      this.mod._free(optsPtr);
      this.mod._free(resPtr);
    }
  }
  // ---- v0.8.6: portable circuit serialization ----
  /** Serialize the circuit to a portable text string (moonlab-circuit v1).
   *  Throws QgtlError if libquantumsim predates v0.8.3 (WASM built before
   *  the serialization surface). */
  serialize() {
    if (!this.mod._moonlab_qgtl_circuit_serialize) {
      throw new QgtlError(
        "moonlab_qgtl_circuit_serialize unavailable -- WASM build predates libquantumsim v0.8.3",
        MOONLAB_QGTL_UNSUPPORTED
      );
    }
    const sizePtr = this.mod._malloc(8);
    try {
      this.mod.HEAPU32[sizePtr >> 2] = 0;
      this.mod.HEAPU32[(sizePtr >> 2) + 1] = 0;
      let rc = this.mod._moonlab_qgtl_circuit_serialize(this.handle, 0, 0, sizePtr);
      if (rc !== 0) {
        throw new QgtlError(`serialize size-query: rc=${rc}`, rc);
      }
      const needed = this.mod.HEAPU32[sizePtr >> 2];
      if (needed === 0) return "";
      const bufPtr = this.mod._malloc(needed + 1);
      try {
        rc = this.mod._moonlab_qgtl_circuit_serialize(this.handle, bufPtr, needed + 1, 0);
        if (rc !== 0) {
          throw new QgtlError(`serialize: rc=${rc}`, rc);
        }
        if (this.mod.UTF8ToString) {
          return this.mod.UTF8ToString(bufPtr, needed + 1);
        }
        const bytes = this.mod.HEAPU8.subarray(bufPtr, bufPtr + needed);
        return new TextDecoder("utf-8").decode(bytes);
      } finally {
        this.mod._free(bufPtr);
      }
    } finally {
      this.mod._free(sizePtr);
    }
  }
  /** Reconstruct a QgtlCircuit from a serialized text string. */
  static async deserialize(text) {
    const mod = await getModule();
    if (!mod._moonlab_qgtl_circuit_deserialize) {
      throw new QgtlError(
        "moonlab_qgtl_circuit_deserialize unavailable -- WASM build predates libquantumsim v0.8.3",
        MOONLAB_QGTL_UNSUPPORTED
      );
    }
    const encoded = new TextEncoder().encode(text);
    const bufPtr = mod._malloc(encoded.length);
    const statusPtr = mod._malloc(4);
    try {
      mod.HEAPU8.set(encoded, bufPtr);
      mod.HEAP32[statusPtr >> 2] = 0;
      const handle = mod._moonlab_qgtl_circuit_deserialize(bufPtr, encoded.length, statusPtr);
      if (!handle) {
        const status = mod.HEAP32[statusPtr >> 2];
        throw new QgtlError(`deserialize: status=${status}`, status);
      }
      const n = mod._moonlab_qgtl_circuit_num_qubits(handle);
      return new _QgtlCircuit(handle, mod, n);
    } finally {
      mod._free(bufPtr);
      mod._free(statusPtr);
    }
  }
};

// src/scheduler.ts
var MOONLAB_SCHED_OK = 0;
var MOONLAB_SCHED_BAD_ARG = -501;
var MOONLAB_SCHED_OOM = -502;
var MOONLAB_SCHED_INTERNAL = -503;
var MOONLAB_SCHED_BUFFER_TOO_SMALL = -504;
var SchedulerError = class extends Error {
  constructor(message, rc) {
    super(message);
    this.name = "SchedulerError";
    this.rc = rc;
  }
};
function _check(rc, ctx) {
  if (rc !== MOONLAB_SCHED_OK) {
    throw new SchedulerError(`${ctx}: rc=${rc}`, rc);
  }
}
var Job = class _Job {
  constructor(handle, mod, n) {
    this.freed = false;
    this.handle = handle;
    this.mod = mod;
    this._n = n;
  }
  static async create(numQubits) {
    const mod = await getModule();
    const h2 = mod._moonlab_job_create(numQubits);
    if (!h2) {
      throw new SchedulerError(
        `job_create(${numQubits}): NULL (num_qubits must be in [1, 32])`,
        MOONLAB_SCHED_BAD_ARG
      );
    }
    return new _Job(h2, mod, numQubits);
  }
  dispose() {
    if (this.freed) return;
    this.mod._moonlab_job_free(this.handle);
    this.freed = true;
  }
  get numQubits() {
    return this._n;
  }
  get numGates() {
    return this.mod._moonlab_job_num_gates(this.handle);
  }
  get numShots() {
    return this.mod._moonlab_job_num_shots(this.handle);
  }
  get numWorkers() {
    return this.mod._moonlab_job_num_workers(this.handle);
  }
  addGate(type, target, control = -1, params = []) {
    let paramsPtr = 0;
    if (params.length > 0) {
      paramsPtr = this.mod._malloc(8 * params.length);
      for (let i = 0; i < params.length; i++) {
        this.mod.HEAPF64[(paramsPtr >> 3) + i] = params[i];
      }
    }
    try {
      _check(
        this.mod._moonlab_job_add_gate(this.handle, type, target, control, paramsPtr),
        `addGate(${GateType[type]}, target=${target}, control=${control})`
      );
    } finally {
      if (paramsPtr) this.mod._free(paramsPtr);
    }
    return this;
  }
  setNumShots(n) {
    _check(
      this.mod._moonlab_job_set_num_shots(this.handle, n),
      `setNumShots(${n})`
    );
    return this;
  }
  setNumWorkers(n) {
    _check(
      this.mod._moonlab_job_set_num_workers(this.handle, n),
      `setNumWorkers(${n})`
    );
    return this;
  }
  setRngSeed(seed) {
    _check(
      this.mod._moonlab_job_set_rng_seed(this.handle, seed),
      `setRngSeed`
    );
    return this;
  }
  async execute() {
    const resPtr = this.mod._malloc(24);
    try {
      for (let i = 0; i < 6; i++) this.mod.HEAP32[(resPtr >> 2) + i] = 0;
      _check(this.mod._moonlab_scheduler_run(this.handle, resPtr), "scheduler_run");
      const numQubits = this.mod.HEAP32[resPtr >> 2];
      const totalShots = this.mod.HEAP32[(resPtr >> 2) + 1];
      const outcomesPtr = this.mod.HEAPU32[(resPtr >> 2) + 2];
      const numWorkersUsed = this.mod.HEAP32[(resPtr >> 2) + 3];
      const workerSecondsPtr = this.mod.HEAPU32[(resPtr >> 2) + 4];
      const outcomes = new BigUint64Array(totalShots);
      for (let i = 0; i < totalShots; i++) {
        const lo = BigInt(this.mod.HEAPU32[(outcomesPtr >> 2) + 2 * i]);
        const hi = BigInt(this.mod.HEAPU32[(outcomesPtr >> 2) + 2 * i + 1]);
        outcomes[i] = lo | hi << 32n;
      }
      const workerSeconds = new Float64Array(
        this.mod.HEAPF64.subarray(
          workerSecondsPtr >> 3,
          (workerSecondsPtr >> 3) + numWorkersUsed
        )
      );
      this.mod._moonlab_job_results_free(resPtr);
      return { numQubits, totalShots, outcomes, numWorkersUsed, workerSeconds };
    } finally {
      this.mod._free(resPtr);
    }
  }
  async toJson() {
    const needed = this.mod._moonlab_job_to_json(this.handle, 0, 0);
    if (needed < 0) {
      throw new SchedulerError(`to_json size-probe: rc=${needed}`, needed);
    }
    const cap = needed + 1;
    const buf = this.mod._malloc(cap);
    try {
      const written = this.mod._moonlab_job_to_json(this.handle, buf, cap);
      if (written < 0) {
        throw new SchedulerError(`to_json: rc=${written}`, written);
      }
      return new TextDecoder("utf-8").decode(
        this.mod.HEAPU8.subarray(buf, buf + written)
      );
    } finally {
      this.mod._free(buf);
    }
  }
};
function jsStringToHeapSched(mod, s2) {
  if (!s2) return 0;
  const len = new TextEncoder().encode(s2).length + 1;
  const ptr = mod._malloc(len);
  mod.stringToUTF8(s2, ptr, len);
  return ptr;
}
async function vendorNoiseProfileRegistryAvailable() {
  const mod = await getModule();
  return typeof mod._moonlab_register_vendor_noise_profile === "function";
}
async function registerVendorNoiseProfile(name, profile) {
  const mod = await getModule();
  if (!mod._moonlab_register_vendor_noise_profile) {
    throw new SchedulerError(
      "WASM build lacks the v1.0.3 vendor-noise profile registry",
      MOONLAB_SCHED_BAD_ARG
    );
  }
  const profPtr = mod._malloc(32);
  const namePtr = jsStringToHeapSched(mod, name);
  const descPtr = jsStringToHeapSched(mod, profile.description);
  try {
    mod.HEAPF64[profPtr >> 3] = profile.pGate1q;
    mod.HEAPF64[(profPtr >> 3) + 1] = profile.pGate2q;
    mod.HEAPF64[(profPtr >> 3) + 2] = profile.pReadout;
    mod.HEAPU32[(profPtr >> 2) + 6] = descPtr;
    const rc = mod._moonlab_register_vendor_noise_profile(namePtr, profPtr);
    if (rc !== MOONLAB_SCHED_OK) {
      throw new SchedulerError(
        `register_vendor_noise_profile(${name}): rc=${rc}`,
        rc
      );
    }
  } finally {
    mod._free(profPtr);
    mod._free(namePtr);
    if (descPtr) mod._free(descPtr);
  }
}
async function unregisterVendorNoiseProfile(name) {
  const mod = await getModule();
  if (!mod._moonlab_unregister_vendor_noise_profile) return;
  const namePtr = jsStringToHeapSched(mod, name);
  try {
    const rc = mod._moonlab_unregister_vendor_noise_profile(namePtr);
    if (rc !== MOONLAB_SCHED_OK) {
      throw new SchedulerError(
        `unregister_vendor_noise_profile(${name}): rc=${rc}`,
        rc
      );
    }
  } finally {
    mod._free(namePtr);
  }
}
async function lookupVendorNoiseProfile(name) {
  const mod = await getModule();
  if (!mod._moonlab_lookup_vendor_noise_profile) return null;
  const namePtr = jsStringToHeapSched(mod, name);
  try {
    const p = mod._moonlab_lookup_vendor_noise_profile(namePtr);
    if (p === 0) return null;
    const pf64 = p >> 3;
    const descPtr = mod.HEAPU32[(p >> 2) + 6];
    return {
      pGate1q: mod.HEAPF64[pf64],
      pGate2q: mod.HEAPF64[pf64 + 1],
      pReadout: mod.HEAPF64[pf64 + 2],
      description: descPtr ? mod.UTF8ToString(descPtr) : ""
    };
  } finally {
    mod._free(namePtr);
  }
}
async function listVendorNoiseProfiles() {
  const mod = await getModule();
  if (!mod._moonlab_num_vendor_noise_profiles || !mod._moonlab_list_vendor_noise_profiles) return [];
  const n = mod._moonlab_num_vendor_noise_profiles();
  if (n <= 0) return [];
  const buf = mod._malloc(n * 4);
  try {
    const written = mod._moonlab_list_vendor_noise_profiles(buf, n);
    const names = [];
    for (let i = 0; i < written; i++) {
      const ptr = mod.HEAPU32[(buf >> 2) + i];
      if (ptr) names.push(mod.UTF8ToString(ptr));
    }
    return names;
  } finally {
    mod._free(buf);
  }
}
var activeHookFnPtr = null;
var activeCallback = null;
async function setCompletionHook(callback) {
  const mod = await getModule();
  if (!mod._moonlab_scheduler_set_completion_hook) {
    throw new SchedulerError(
      "WASM build lacks the v1.0.3 scheduler completion hook",
      MOONLAB_SCHED_BAD_ARG
    );
  }
  if (activeHookFnPtr !== null) {
    mod.removeFunction?.(activeHookFnPtr);
    activeHookFnPtr = null;
    activeCallback = null;
  }
  if (callback === null) {
    const rc2 = mod._moonlab_scheduler_set_completion_hook(0, 0);
    if (rc2 !== MOONLAB_SCHED_OK) {
      throw new SchedulerError(`clear_completion_hook: rc=${rc2}`, rc2);
    }
    return;
  }
  if (!mod.addFunction) {
    throw new SchedulerError(
      "WASM build lacks addFunction; rebuild with ALLOW_TABLE_GROWTH=1",
      MOONLAB_SCHED_BAD_ARG
    );
  }
  const trampoline = (_jobPtr, resultsPtr, backendNamePtr, _ctx) => {
    try {
      if (!activeCallback || resultsPtr === 0) return;
      const r32 = resultsPtr >> 2;
      const info = {
        numQubits: mod.HEAP32[r32],
        totalShots: mod.HEAP32[r32 + 1],
        backendName: backendNamePtr ? mod.UTF8ToString(backendNamePtr) : null
      };
      activeCallback(info);
    } catch (e) {
      console.error("JS completion hook threw:", e);
    }
  };
  activeHookFnPtr = mod.addFunction(trampoline, "viiii");
  activeCallback = callback;
  const rc = mod._moonlab_scheduler_set_completion_hook(activeHookFnPtr, 0);
  if (rc !== MOONLAB_SCHED_OK) {
    mod.removeFunction?.(activeHookFnPtr);
    activeHookFnPtr = null;
    activeCallback = null;
    throw new SchedulerError(`set_completion_hook: rc=${rc}`, rc);
  }
}
async function clearCompletionHook() {
  return setCompletionHook(null);
}

// src/decoder.ts
var DecoderSlot = /* @__PURE__ */ ((DecoderSlot2) => {
  DecoderSlot2[DecoderSlot2["GREEDY"] = 0] = "GREEDY";
  DecoderSlot2[DecoderSlot2["MWPM_EXACT"] = 1] = "MWPM_EXACT";
  DecoderSlot2[DecoderSlot2["SBNN"] = 2] = "SBNN";
  DecoderSlot2[DecoderSlot2["LIBIRREP_SS"] = 3] = "LIBIRREP_SS";
  DecoderSlot2[DecoderSlot2["PYMATCHING"] = 4] = "PYMATCHING";
  return DecoderSlot2;
})(DecoderSlot || {});
var MOONLAB_DECODER_OK = 0;
var MOONLAB_DECODER_NOT_BUILT = -401;
var MOONLAB_DECODER_BAD_ARG = -402;
var MOONLAB_DECODER_INFEASIBLE = -403;
var MOONLAB_DECODER_OOM = -404;
var DecoderError = class extends Error {
  constructor(message, rc) {
    super(message);
    this.name = "DecoderError";
    this.rc = rc;
  }
};
var DecoderNotBuiltError = class extends DecoderError {
  constructor(slot) {
    super(`decoder slot ${DecoderSlot[slot]} not built`, MOONLAB_DECODER_NOT_BUILT);
    this.name = "DecoderNotBuiltError";
  }
};
async function slotAvailable(slot) {
  const mod = await getModule();
  return mod._moonlab_decoder_slot_available(slot) === 1;
}
async function slotName(slot) {
  const mod = await getModule();
  const ptr = mod._moonlab_decoder_slot_name(slot);
  return mod.UTF8ToString(ptr);
}
async function decode(slot, code, syndromes, rngSeed = 0n) {
  const mod = await getModule();
  const codePtr = mod._malloc(12);
  const inputPtr = mod._malloc(32);
  const sLen = syndromes.length;
  const synPtr = mod._malloc(sLen);
  const corrPtr = mod._malloc(code.numQubits);
  try {
    mod.HEAP32[codePtr >> 2] = code.distance;
    mod.HEAP32[(codePtr >> 2) + 1] = code.numQubits;
    mod.HEAP32[(codePtr >> 2) + 2] = code.isToric ? 1 : 0;
    mod.HEAPU8.set(syndromes, synPtr);
    mod.HEAPU8.fill(0, corrPtr, corrPtr + code.numQubits);
    mod.HEAP32[inputPtr >> 2] = codePtr;
    mod.HEAP32[(inputPtr >> 2) + 1] = synPtr;
    mod.HEAP32[(inputPtr >> 2) + 2] = corrPtr;
    mod.HEAP32[(inputPtr >> 2) + 3] = sLen;
    mod.HEAP32[(inputPtr >> 2) + 4] = Number(rngSeed & 0xFFFFFFFFn);
    mod.HEAP32[(inputPtr >> 2) + 5] = Number(rngSeed >> 32n & 0xFFFFFFFFn);
    const rc = mod._moonlab_decoder_decode(slot, inputPtr);
    if (rc === MOONLAB_DECODER_NOT_BUILT) throw new DecoderNotBuiltError(slot);
    if (rc !== MOONLAB_DECODER_OK) {
      throw new DecoderError(`decode(${DecoderSlot[slot]}): rc=${rc}`, rc);
    }
    return new Uint8Array(mod.HEAPU8.subarray(corrPtr, corrPtr + code.numQubits));
  } finally {
    mod._free(codePtr);
    mod._free(inputPtr);
    mod._free(synPtr);
    mod._free(corrPtr);
  }
}
function jsStringToHeap(mod, s2) {
  if (!s2) return 0;
  const len = new TextEncoder().encode(s2).length + 1;
  const ptr = mod._malloc(len);
  mod.stringToUTF8(s2, ptr, len);
  return ptr;
}
async function decoderRegistryAvailable() {
  const mod = await getModule();
  return typeof mod._moonlab_num_decoders === "function";
}
async function numDecoders() {
  const mod = await getModule();
  if (!mod._moonlab_num_decoders) return 0;
  return mod._moonlab_num_decoders();
}
async function listDecoders() {
  const mod = await getModule();
  if (!mod._moonlab_num_decoders || !mod._moonlab_list_decoders) return [];
  const n = mod._moonlab_num_decoders();
  if (n <= 0) return [];
  const buf = mod._malloc(n * 4);
  try {
    const written = mod._moonlab_list_decoders(buf, n);
    const names = [];
    for (let i = 0; i < written; i++) {
      const namePtr = mod.HEAPU32[(buf >> 2) + i];
      if (namePtr) names.push(mod.UTF8ToString(namePtr));
    }
    return names;
  } finally {
    mod._free(buf);
  }
}
async function lookupDecoder(name) {
  const mod = await getModule();
  if (!mod._moonlab_lookup_decoder) return null;
  const namePtr = jsStringToHeap(mod, name);
  try {
    const entryPtr = mod._moonlab_lookup_decoder(namePtr);
    if (entryPtr === 0) return null;
    const ep32 = entryPtr >> 2;
    const namePtr2 = mod.HEAPU32[ep32];
    const descPtr = mod.HEAPU32[ep32 + 3];
    return {
      name: namePtr2 ? mod.UTF8ToString(namePtr2) : "",
      description: descPtr ? mod.UTF8ToString(descPtr) : ""
    };
  } finally {
    mod._free(namePtr);
  }
}
var registeredDecoders = /* @__PURE__ */ new Map();
async function registerDecoder(name, callback, description = "") {
  const mod = await getModule();
  if (!mod._moonlab_register_decoder || !mod.addFunction) {
    throw new DecoderError(
      "WASM build lacks the v1.0.3 decoder registry or addFunction; rebuild with ALLOW_TABLE_GROWTH=1 and addFunction exported",
      MOONLAB_DECODER_BAD_ARG
    );
  }
  const trampoline = (inputPtr, _ctx) => {
    try {
      const ip32 = inputPtr >> 2;
      const codePtr = mod.HEAPU32[ip32];
      const synPtr = mod.HEAPU32[ip32 + 1];
      const corrPtr = mod.HEAPU32[ip32 + 2];
      const nStabilisers = mod.HEAP32[ip32 + 3];
      const rngLo = mod.HEAPU32[ip32 + 4];
      const rngHi = mod.HEAPU32[ip32 + 5];
      const cp32 = codePtr >> 2;
      const code = {
        distance: mod.HEAP32[cp32],
        numQubits: mod.HEAP32[cp32 + 1],
        isToric: mod.HEAP32[cp32 + 2] !== 0
      };
      const syndromes = new Uint8Array(
        mod.HEAPU8.subarray(synPtr, synPtr + nStabilisers)
      );
      const rngSeed = BigInt(rngHi) << 32n | BigInt(rngLo);
      const corr = callback(code, syndromes, rngSeed);
      if (corr.length < code.numQubits) return MOONLAB_DECODER_OOM;
      for (let q = 0; q < code.numQubits; q++) {
        mod.HEAPU8[corrPtr + q] = corr[q];
      }
      return MOONLAB_DECODER_OK;
    } catch (e) {
      console.error("JS decoder threw:", e);
      return MOONLAB_DECODER_OOM;
    }
  };
  const fnPtr = mod.addFunction(trampoline, "iii");
  const namePtr = jsStringToHeap(mod, name);
  const descPtr = jsStringToHeap(mod, description);
  try {
    const rc = mod._moonlab_register_decoder(namePtr, fnPtr, 0, descPtr);
    if (rc !== MOONLAB_DECODER_OK) {
      mod.removeFunction?.(fnPtr);
      throw new DecoderError(`register_decoder(${name}): rc=${rc}`, rc);
    }
    const prior = registeredDecoders.get(name);
    if (prior) mod.removeFunction?.(prior.fnPtr);
    registeredDecoders.set(name, { fnPtr, cb: callback });
  } finally {
    mod._free(namePtr);
    if (descPtr) mod._free(descPtr);
  }
}
async function unregisterDecoder(name) {
  const mod = await getModule();
  if (!mod._moonlab_unregister_decoder) return;
  const namePtr = jsStringToHeap(mod, name);
  try {
    const rc = mod._moonlab_unregister_decoder(namePtr);
    const slot = registeredDecoders.get(name);
    if (slot) {
      mod.removeFunction?.(slot.fnPtr);
      registeredDecoders.delete(name);
    }
    if (rc !== MOONLAB_DECODER_OK) {
      throw new DecoderError(`unregister_decoder(${name}): rc=${rc}`, rc);
    }
  } finally {
    mod._free(namePtr);
  }
}
async function decodeByName(name, code, syndromes, rngSeed = 0n) {
  const mod = await getModule();
  if (!mod._moonlab_decoder_decode_by_name) {
    throw new DecoderError(
      "WASM build lacks decode_by_name; rebuild with v1.0.3 exports",
      MOONLAB_DECODER_BAD_ARG
    );
  }
  const codePtr = mod._malloc(12);
  const inputPtr = mod._malloc(32);
  const sLen = syndromes.length;
  const synPtr = mod._malloc(sLen);
  const corrPtr = mod._malloc(code.numQubits);
  const namePtr = jsStringToHeap(mod, name);
  try {
    mod.HEAP32[codePtr >> 2] = code.distance;
    mod.HEAP32[(codePtr >> 2) + 1] = code.numQubits;
    mod.HEAP32[(codePtr >> 2) + 2] = code.isToric ? 1 : 0;
    mod.HEAPU8.set(syndromes, synPtr);
    mod.HEAPU8.fill(0, corrPtr, corrPtr + code.numQubits);
    mod.HEAP32[inputPtr >> 2] = codePtr;
    mod.HEAP32[(inputPtr >> 2) + 1] = synPtr;
    mod.HEAP32[(inputPtr >> 2) + 2] = corrPtr;
    mod.HEAP32[(inputPtr >> 2) + 3] = sLen;
    mod.HEAP32[(inputPtr >> 2) + 4] = Number(rngSeed & 0xFFFFFFFFn);
    mod.HEAP32[(inputPtr >> 2) + 5] = Number(rngSeed >> 32n & 0xFFFFFFFFn);
    const rc = mod._moonlab_decoder_decode_by_name(namePtr, inputPtr);
    if (rc !== MOONLAB_DECODER_OK) {
      throw new DecoderError(`decode_by_name(${name}): rc=${rc}`, rc);
    }
    return new Uint8Array(mod.HEAPU8.subarray(corrPtr, corrPtr + code.numQubits));
  } finally {
    mod._free(codePtr);
    mod._free(inputPtr);
    mod._free(synPtr);
    mod._free(corrPtr);
    mod._free(namePtr);
  }
}

// src/webgpu.ts
var BACKEND_NAMES = {
  0: "none",
  1: "metal",
  2: "cuda",
  3: "webgpu"
};
function runtimeWebGPUSupported() {
  if (typeof navigator === "undefined") {
    return false;
  }
  const nav = navigator;
  return typeof nav.gpu !== "undefined";
}
function tensorBackendFromCode(code) {
  return BACKEND_NAMES[code] ?? "unknown";
}
function canQueryBackend(module) {
  return typeof module._tensor_gpu_backend_type === "function";
}
async function isWebGPUAvailable() {
  const module = await getModule();
  if (typeof module._tensor_gpu_get_context === "function" && canQueryBackend(module)) {
    const ctxPtr = module._tensor_gpu_get_context();
    if (!ctxPtr) {
      return false;
    }
    return module._tensor_gpu_backend_type(ctxPtr) === 3;
  }
  if (typeof module._tensor_gpu_webgpu_available === "function") {
    return module._tensor_gpu_webgpu_available() !== 0;
  }
  return runtimeWebGPUSupported();
}
async function initializeWebGPUBackend() {
  const module = await getModule();
  if (typeof module._tensor_gpu_get_context !== "function" || !canQueryBackend(module)) {
    return false;
  }
  const ctxPtr = module._tensor_gpu_get_context();
  if (!ctxPtr) {
    return false;
  }
  return module._tensor_gpu_backend_type(ctxPtr) === 3;
}
async function getActiveTensorGPUBackend() {
  const module = await getModule();
  if (!canQueryBackend(module)) {
    return "unknown";
  }
  const backendCode = module._tensor_gpu_backend_type(0);
  return tensorBackendFromCode(backendCode);
}
async function isTensorGPUAvailable() {
  const module = await getModule();
  if (typeof module._tensor_gpu_available !== "function") {
    return false;
  }
  return module._tensor_gpu_available() !== 0;
}

// src/gpu-backend.ts
var GPU_BACKEND_NONE = 0;
var GPU_BACKEND_METAL = 1;
var GPU_BACKEND_WEBGPU = 2;
var GPU_BACKEND_OPENCL = 3;
var GPU_BACKEND_VULKAN = 4;
var GPU_BACKEND_CUDA = 5;
var GPU_BACKEND_CUQUANTUM = 6;
var GPU_BACKEND_AUTO = 7;
function backendTypeName(code) {
  switch (code) {
    case GPU_BACKEND_NONE:
      return "none";
    case GPU_BACKEND_METAL:
      return "metal";
    case GPU_BACKEND_WEBGPU:
      return "webgpu";
    case GPU_BACKEND_OPENCL:
      return "opencl";
    case GPU_BACKEND_VULKAN:
      return "vulkan";
    case GPU_BACKEND_CUDA:
      return "cuda";
    case GPU_BACKEND_CUQUANTUM:
      return "cuquantum";
    case GPU_BACKEND_AUTO:
      return "auto";
    default:
      return "unknown";
  }
}
async function isUnifiedGPUApiAvailable() {
  const module = await getModule();
  return typeof module._gpu_compute_init === "function" && typeof module._gpu_compute_free === "function" && typeof module._gpu_get_backend_type === "function" && typeof module._gpu_buffer_create_from_data === "function" && typeof module._gpu_buffer_read === "function" && typeof module._gpu_buffer_write === "function";
}
var GPUBackendSession = class _GPUBackendSession {
  constructor(module, ctxPtr) {
    this.disposed = false;
    this.module = module;
    this.memory = new WasmMemory(module);
    this.ctxPtr = ctxPtr;
  }
  static async create(preferred = GPU_BACKEND_AUTO) {
    const module = await getModule();
    if (typeof module._gpu_compute_init !== "function") {
      return null;
    }
    const ctxPtr = module._gpu_compute_init(preferred);
    if (!ctxPtr) {
      return null;
    }
    return new _GPUBackendSession(module, ctxPtr);
  }
  get pointer() {
    return this.ctxPtr;
  }
  get backendType() {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_get_backend_type !== "function") {
      return GPU_BACKEND_NONE;
    }
    return this.module._gpu_get_backend_type(this.ctxPtr);
  }
  get backendName() {
    return backendTypeName(this.backendType);
  }
  get nativeAccelerated() {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_is_native_accelerated !== "function") {
      return false;
    }
    return this.module._gpu_is_native_accelerated(this.ctxPtr) !== 0;
  }
  createBufferFromInterleaved(data) {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_buffer_create_from_data !== "function") {
      throw new Error("Unified GPU buffer API not available");
    }
    const bytes = data.byteLength;
    const ptr = this.memory.alloc(bytes);
    this.memory.writeFloat64Array(ptr, data);
    const bufferPtr = this.module._gpu_buffer_create_from_data(this.ctxPtr, ptr, bytes);
    this.memory.free(ptr);
    if (!bufferPtr) {
      throw new Error("gpu_buffer_create_from_data failed");
    }
    return bufferPtr;
  }
  createBufferFromComplex(data) {
    const interleaved = new Float64Array(data.length * 2);
    for (let i = 0; i < data.length; i++) {
      interleaved[i * 2] = data[i].real;
      interleaved[i * 2 + 1] = data[i].imag;
    }
    return this.createBufferFromInterleaved(interleaved);
  }
  readInterleavedBuffer(bufferPtr, complexCount) {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_buffer_read !== "function") {
      throw new Error("Unified GPU buffer read API not available");
    }
    const bytes = complexCount * 16;
    const outPtr = this.memory.alloc(bytes);
    const rc = this.module._gpu_buffer_read(bufferPtr, outPtr, bytes, 0);
    if (rc !== 0) {
      this.memory.free(outPtr);
      throw new Error(`gpu_buffer_read failed: ${rc}`);
    }
    const out = this.memory.readFloat64Array(outPtr, complexCount * 2);
    this.memory.free(outPtr);
    return out;
  }
  readComplexBuffer(bufferPtr, complexCount) {
    const interleaved = this.readInterleavedBuffer(bufferPtr, complexCount);
    const out = [];
    for (let i = 0; i < complexCount; i++) {
      out.push({
        real: interleaved[i * 2],
        imag: interleaved[i * 2 + 1]
      });
    }
    return out;
  }
  freeBuffer(bufferPtr) {
    if (typeof this.module._gpu_buffer_free === "function" && bufferPtr) {
      this.module._gpu_buffer_free(bufferPtr);
    }
  }
  hadamard(bufferPtr, qubit, stateDim) {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_hadamard_u32 === "function") {
      return this.module._gpu_hadamard_u32(this.ctxPtr, bufferPtr, qubit, stateDim >>> 0);
    }
    if (typeof this.module._gpu_hadamard !== "function") return -7;
    return this.module._gpu_hadamard(this.ctxPtr, bufferPtr, qubit, BigInt(stateDim));
  }
  hadamardAll(bufferPtr, numQubits, stateDim) {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_hadamard_all_u32 === "function") {
      return this.module._gpu_hadamard_all_u32(this.ctxPtr, bufferPtr, numQubits, stateDim >>> 0);
    }
    if (typeof this.module._gpu_hadamard_all !== "function") return -7;
    return this.module._gpu_hadamard_all(this.ctxPtr, bufferPtr, numQubits, BigInt(stateDim));
  }
  pauliX(bufferPtr, qubit, stateDim) {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_pauli_x_u32 === "function") {
      return this.module._gpu_pauli_x_u32(this.ctxPtr, bufferPtr, qubit, stateDim >>> 0);
    }
    if (typeof this.module._gpu_pauli_x !== "function") return -7;
    return this.module._gpu_pauli_x(this.ctxPtr, bufferPtr, qubit, BigInt(stateDim));
  }
  pauliZ(bufferPtr, qubit, stateDim) {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_pauli_z_u32 === "function") {
      return this.module._gpu_pauli_z_u32(this.ctxPtr, bufferPtr, qubit, stateDim >>> 0);
    }
    if (typeof this.module._gpu_pauli_z !== "function") return -7;
    return this.module._gpu_pauli_z(this.ctxPtr, bufferPtr, qubit, BigInt(stateDim));
  }
  phase(bufferPtr, qubit, theta, stateDim) {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_phase_u32 === "function") {
      return this.module._gpu_phase_u32(this.ctxPtr, bufferPtr, qubit, theta, stateDim >>> 0);
    }
    if (typeof this.module._gpu_phase !== "function") return -7;
    return this.module._gpu_phase(this.ctxPtr, bufferPtr, qubit, theta, BigInt(stateDim));
  }
  cnot(bufferPtr, control, target, stateDim) {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_cnot_u32 === "function") {
      return this.module._gpu_cnot_u32(this.ctxPtr, bufferPtr, control, target, stateDim >>> 0);
    }
    if (typeof this.module._gpu_cnot !== "function") return -7;
    return this.module._gpu_cnot(this.ctxPtr, bufferPtr, control, target, BigInt(stateDim));
  }
  rz(bufferPtr, qubit, theta, stateDim) {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_rz_u32 === "function") {
      return this.module._gpu_rz_u32(this.ctxPtr, bufferPtr, qubit, theta, stateDim >>> 0);
    }
    if (typeof this.module._gpu_rz !== "function") return -7;
    return this.module._gpu_rz(this.ctxPtr, bufferPtr, qubit, theta, BigInt(stateDim));
  }
  cz(bufferPtr, control, target, stateDim) {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_cz_u32 === "function") {
      return this.module._gpu_cz_u32(this.ctxPtr, bufferPtr, control, target, stateDim >>> 0);
    }
    if (typeof this.module._gpu_cz !== "function") return -7;
    return this.module._gpu_cz(this.ctxPtr, bufferPtr, control, target, BigInt(stateDim));
  }
  swap(bufferPtr, qubitA, qubitB, stateDim) {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_swap_u32 === "function") {
      return this.module._gpu_swap_u32(this.ctxPtr, bufferPtr, qubitA, qubitB, stateDim >>> 0);
    }
    if (typeof this.module._gpu_swap !== "function") return -7;
    return this.module._gpu_swap(this.ctxPtr, bufferPtr, qubitA, qubitB, BigInt(stateDim));
  }
  computeProbabilities(amplitudesBufferPtr, stateDim) {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_buffer_create !== "function" || typeof this.module._gpu_compute_probabilities !== "function" || typeof this.module._gpu_buffer_read !== "function") {
      throw new Error("Unified GPU probability API not available");
    }
    const probabilitiesBuffer = this.module._gpu_buffer_create(this.ctxPtr, stateDim * 8);
    if (!probabilitiesBuffer) {
      throw new Error("gpu_buffer_create failed for probabilities");
    }
    try {
      const rc = typeof this.module._gpu_compute_probabilities_u32 === "function" ? this.module._gpu_compute_probabilities_u32(
        this.ctxPtr,
        amplitudesBufferPtr,
        probabilitiesBuffer,
        stateDim >>> 0
      ) : this.module._gpu_compute_probabilities(
        this.ctxPtr,
        amplitudesBufferPtr,
        probabilitiesBuffer,
        BigInt(stateDim)
      );
      if (rc !== 0) {
        throw new Error(`gpu_compute_probabilities failed: ${rc}`);
      }
      const outPtr = this.memory.alloc(stateDim * 8);
      const readRc = this.module._gpu_buffer_read(probabilitiesBuffer, outPtr, stateDim * 8, 0);
      if (readRc !== 0) {
        this.memory.free(outPtr);
        throw new Error(`gpu_buffer_read probabilities failed: ${readRc}`);
      }
      const out = this.memory.readFloat64Array(outPtr, stateDim);
      this.memory.free(outPtr);
      return out;
    } finally {
      this.freeBuffer(probabilitiesBuffer);
    }
  }
  sumSquaredMagnitudes(amplitudesBufferPtr, stateDim) {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_sum_squared_magnitudes !== "function") {
      throw new Error("gpu_sum_squared_magnitudes not available");
    }
    const outPtr = this.memory.allocFloat64Array(1);
    const rc = typeof this.module._gpu_sum_squared_magnitudes_u32 === "function" ? this.module._gpu_sum_squared_magnitudes_u32(
      this.ctxPtr,
      amplitudesBufferPtr,
      stateDim >>> 0,
      outPtr
    ) : this.module._gpu_sum_squared_magnitudes(
      this.ctxPtr,
      amplitudesBufferPtr,
      BigInt(stateDim),
      outPtr
    );
    if (rc !== 0) {
      this.memory.free(outPtr);
      throw new Error(`gpu_sum_squared_magnitudes failed: ${rc}`);
    }
    const result = this.memory.readFloat64(outPtr);
    this.memory.free(outPtr);
    return result;
  }
  normalize(amplitudesBufferPtr, norm2, stateDim) {
    this.ensureNotDisposed();
    if (typeof this.module._gpu_normalize_u32 === "function") {
      return this.module._gpu_normalize_u32(this.ctxPtr, amplitudesBufferPtr, norm2, stateDim >>> 0);
    }
    if (typeof this.module._gpu_normalize !== "function") return -7;
    return this.module._gpu_normalize(this.ctxPtr, amplitudesBufferPtr, norm2, BigInt(stateDim));
  }
  dispose() {
    if (this.disposed) return;
    if (typeof this.module._gpu_compute_free === "function" && this.ctxPtr) {
      this.module._gpu_compute_free(this.ctxPtr);
    }
    this.memory.freeAll();
    this.disposed = true;
  }
  ensureNotDisposed() {
    if (this.disposed) {
      throw new Error("GPUBackendSession has been disposed");
    }
  }
};

// src/index.ts
var VERSION = "1.2.1";
export {
  BellState,
  CaMps,
  CaPeps,
  Circuit,
  CliffordTableau,
  ControlPlaneError,
  DecoderError,
  DecoderNotBuiltError,
  DecoderSlot,
  EvolutionType,
  FusedCircuit,
  GPUBackendSession,
  GPU_BACKEND_AUTO,
  GPU_BACKEND_CUDA,
  GPU_BACKEND_CUQUANTUM,
  GPU_BACKEND_METAL,
  GPU_BACKEND_NONE,
  GPU_BACKEND_OPENCL,
  GPU_BACKEND_VULKAN,
  GPU_BACKEND_WEBGPU,
  Graph,
  I,
  IsingModel,
  Job,
  LibirrepError,
  LibirrepNotBuiltError,
  LibirrepQecCode,
  MOONLAB_CONTROL_AUTH_BAD,
  MOONLAB_CONTROL_AUTH_REQUIRED,
  MOONLAB_CONTROL_BAD_ARG,
  MOONLAB_CONTROL_IO_ERROR,
  MOONLAB_CONTROL_OK,
  MOONLAB_CONTROL_OOM,
  MOONLAB_CONTROL_RATE_LIMITED,
  MOONLAB_CONTROL_REJECTED,
  MOONLAB_CONTROL_SERVER_BUSY,
  MOONLAB_DECODER_BAD_ARG,
  MOONLAB_DECODER_INFEASIBLE,
  MOONLAB_DECODER_NOT_BUILT,
  MOONLAB_DECODER_OK,
  MOONLAB_DECODER_OOM,
  MOONLAB_LIBIRREP_BAD_ARG,
  MOONLAB_LIBIRREP_INTERNAL,
  MOONLAB_LIBIRREP_NOT_BUILT,
  MOONLAB_LIBIRREP_OK,
  MOONLAB_LIBIRREP_OOM,
  MOONLAB_QGTL_BAD_ARG,
  MOONLAB_QGTL_INTERNAL,
  MOONLAB_QGTL_OK,
  MOONLAB_QGTL_OOM,
  MOONLAB_QGTL_UNSUPPORTED,
  MOONLAB_SCHED_BAD_ARG,
  MOONLAB_SCHED_BUFFER_TOO_SMALL,
  MOONLAB_SCHED_INTERNAL,
  MOONLAB_SCHED_OK,
  MOONLAB_SCHED_OOM,
  Mpdo,
  ONE,
  OptimizerType,
  PauliCode,
  PauliHamiltonian,
  PauliHamiltonianBuilder,
  PfOpKind,
  QaoaSolver,
  QgtlCircuit,
  QgtlError,
  GateType as QgtlGateType,
  QuantumState,
  SchedulerError,
  StatusModule,
  SurfaceCode,
  TdvpEngine,
  TensorNetworkState,
  UF_BOUNDARY,
  UfDecoder,
  VERSION,
  VqeSolver,
  Warmstart,
  WasmMemory,
  ZERO,
  add,
  annealIsing,
  annealIsingWithModule,
  annealQubo,
  annealQuboWithModule,
  backendTypeName,
  bhzZ2,
  chernQwzParallelTransport,
  chernQwzProj,
  chshTest,
  clearCompletionHook,
  complex,
  conjugate,
  submitCircuit as controlPlaneSubmitCircuit,
  submitHealth as controlPlaneSubmitHealth,
  submitMetrics as controlPlaneSubmitMetrics,
  submitShots as controlPlaneSubmitShots,
  submitShotsWithSeed as controlPlaneSubmitShotsWithSeed,
  createBellState,
  decodeByName,
  decode as decoderDecode,
  decoderRegistryAvailable,
  slotAvailable as decoderSlotAvailable,
  slotName as decoderSlotName,
  divide,
  dmrgTFIMGroundState,
  entanglement_exports as entanglement,
  equals,
  exp,
  fromInterleaved,
  fromPolar,
  gaugeWarmstart,
  getActiveTensorGPUBackend,
  getModule,
  groverOptimalIterations,
  groverSearch,
  hofstadterChern,
  initializeWebGPUBackend,
  innerProduct,
  isLoaded,
  isTensorGPUAvailable,
  isUnifiedGPUApiAvailable,
  isWebGPUAvailable,
  kaneMeleZ2,
  kitaevChainZ2,
  listDecoders,
  listVendorNoiseProfiles,
  lookupDecoder,
  lookupVendorNoiseProfile,
  magnitude,
  magnitudeSquared,
  merminGhzTest,
  merminKlyshkoTest,
  multiply,
  noise_exports as noise,
  norm,
  normalize,
  numDecoders,
  pauli_frame_exports as pauliFrame,
  phase,
  preload,
  qwzChern,
  registerDecoder,
  registerVendorNoiseProfile,
  resetModule,
  resolveOptimizer,
  scale,
  setCompletionHook,
  sshWinding,
  statusString,
  subtract,
  toInterleaved,
  toPolar,
  toString,
  unregisterDecoder,
  unregisterVendorNoiseProfile,
  varDRun,
  vendorNoiseProfileRegistryAvailable,
  z2Lgt1dBuild,
  z2Lgt1dGaussLaw
};

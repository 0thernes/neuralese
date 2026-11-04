var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/control-plane.ts
// NEURALESE patch (see ../PATCHES.md): the four Node-only imports below are used solely by the Moonlab
// control-plane TCP/TLS client, which NEURALESE never calls; static imports of Node built-ins break browser loading.
const net = null, tls = null, fs = null, crypto = null;
var MOONLAB_CONTROL_OK = 0;
var MOONLAB_CONTROL_BAD_ARG = -400;
var MOONLAB_CONTROL_AUTH_REQUIRED = -401;
var MOONLAB_CONTROL_AUTH_BAD = -402;
var MOONLAB_CONTROL_IO_ERROR = -403;
var MOONLAB_CONTROL_REJECTED = -405;
var MOONLAB_CONTROL_OOM = -407;
var MOONLAB_CONTROL_RATE_LIMITED = -408;
var MOONLAB_CONTROL_SERVER_BUSY = -409;
var ControlPlaneError = class extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "ControlPlaneError";
    this.statusCode = statusCode;
  }
};
function openSocket(args) {
  return new Promise((resolve, reject) => {
    const { host, port, timeoutMs } = args;
    let sock;
    if (args.tls) {
      const opts = {
        host,
        port,
        timeout: timeoutMs
      };
      const serverName = args.tls.serverName ?? (net.isIP(host) === 0 ? host : void 0);
      if (serverName) {
        opts.servername = serverName;
      }
      if (args.tls.caPath) {
        opts.ca = fs.readFileSync(args.tls.caPath);
      }
      if (args.tls.clientCertPath && args.tls.clientKeyPath) {
        opts.cert = fs.readFileSync(args.tls.clientCertPath);
        opts.key = fs.readFileSync(args.tls.clientKeyPath);
      }
      if (args.tls.insecure) {
        opts.rejectUnauthorized = false;
        opts.checkServerIdentity = () => void 0;
      }
      const tlsSock = tls.connect(opts, () => {
        tlsSock.setNoDelay(true);
        resolve(tlsSock);
      });
      tlsSock.once("error", reject);
      tlsSock.once("timeout", () => {
        tlsSock.destroy();
        reject(new Error(`control-plane TLS connect timeout (${timeoutMs}ms)`));
      });
      sock = tlsSock;
    } else {
      sock = net.connect({ host, port, timeout: timeoutMs }, () => {
        sock.setNoDelay(true);
        resolve(sock);
      });
      sock.once("error", reject);
      sock.once("timeout", () => {
        sock.destroy();
        reject(new Error(`control-plane connect timeout (${timeoutMs}ms)`));
      });
    }
  });
}
function closeSocket(sock, timeoutMs) {
  if (sock.destroyed) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sock.removeListener("finish", onFinish);
      sock.removeListener("error", onError);
      if (error) reject(error);
      else resolve();
    };
    const onFinish = () => finish();
    const onError = (error) => finish(error);
    const timer = setTimeout(() => {
      const error = new Error(
        `control-plane socket shutdown timeout (${timeoutMs}ms)`
      );
      sock.destroy(error);
      finish(error);
    }, timeoutMs);
    timer.unref();
    sock.once("finish", onFinish);
    sock.once("error", onError);
    sock.resume();
    sock.end();
  });
}
function readUntilNewline(sock, timeoutMs, maxHeaderBytes = 4096) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const nl = buf.indexOf(10);
      if (nl >= 0) {
        sock.removeListener("data", onData);
        sock.removeListener("error", onError);
        sock.removeListener("end", onEnd);
        const line = buf.subarray(0, nl);
        const rest = buf.subarray(nl + 1);
        resolve({ line, rest });
        return;
      }
      if (buf.length > maxHeaderBytes) {
        sock.removeListener("data", onData);
        sock.removeListener("error", onError);
        sock.removeListener("end", onEnd);
        reject(new Error(
          `control-plane header exceeds ${maxHeaderBytes} bytes`
        ));
      }
    };
    const onError = (e) => {
      sock.removeListener("data", onData);
      sock.removeListener("end", onEnd);
      reject(e);
    };
    const onEnd = () => {
      sock.removeListener("data", onData);
      sock.removeListener("error", onError);
      reject(new Error("control-plane closed during header read"));
    };
    sock.on("data", onData);
    sock.once("error", onError);
    sock.once("end", onEnd);
    sock.setTimeout(timeoutMs, () => {
      sock.removeListener("data", onData);
      sock.removeListener("error", onError);
      sock.removeListener("end", onEnd);
      reject(new Error(`control-plane header read timeout (${timeoutMs}ms)`));
    });
  });
}
function recvExact(sock, want, seed, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buf = seed;
    if (buf.length >= want) {
      resolve(buf.subarray(0, want));
      return;
    }
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (buf.length >= want) {
        sock.removeListener("data", onData);
        sock.removeListener("error", onError);
        sock.removeListener("end", onEnd);
        resolve(buf.subarray(0, want));
      }
    };
    const onError = (e) => {
      sock.removeListener("data", onData);
      sock.removeListener("end", onEnd);
      reject(e);
    };
    const onEnd = () => {
      sock.removeListener("data", onData);
      sock.removeListener("error", onError);
      reject(new Error(
        `control-plane closed during body read (${buf.length}/${want} bytes)`
      ));
    };
    sock.on("data", onData);
    sock.once("error", onError);
    sock.once("end", onEnd);
    sock.setTimeout(timeoutMs, () => {
      sock.removeListener("data", onData);
      sock.removeListener("error", onError);
      sock.removeListener("end", onEnd);
      reject(new Error(`control-plane body read timeout (${timeoutMs}ms)`));
    });
  });
}
function parseHeader(line, rest) {
  const text = line.toString("ascii");
  const sp = text.indexOf(" ");
  if (sp < 0) {
    return { verb: text, numField: -1, remainder: "", bodySeed: rest };
  }
  const verb = text.slice(0, sp);
  const remainder = text.slice(sp + 1);
  const n = parseInt(remainder, 10);
  return {
    verb,
    numField: Number.isFinite(n) && n >= 0 ? n : -1,
    remainder,
    bodySeed: rest
  };
}
function authPrelude(secret, verbLine, tenantId) {
  const key = typeof secret === "string" ? Buffer.from(secret, "utf-8") : secret;
  const h = crypto.createHmac("sha3-256", key);
  h.update(verbLine);
  const hex = h.digest("hex");
  if (tenantId) {
    return Buffer.from(`AUTH ${tenantId}:${hex}
`, "ascii");
  }
  return Buffer.from(`AUTH ${hex}
`, "ascii");
}
var TENANT_ID_RE = /^[A-Za-z0-9_.-]{1,63}$/;
function validateTenantId(tenantId, secret) {
  if (secret === void 0) {
    throw new ControlPlaneError(
      "tenantId requires secret; the server uses HMAC to authenticate the request regardless of tenant identity",
      MOONLAB_CONTROL_BAD_ARG
    );
  }
  if (!TENANT_ID_RE.test(tenantId)) {
    throw new ControlPlaneError(
      `tenantId ${JSON.stringify(tenantId)} must match [A-Za-z0-9_.-]{1,63}`,
      MOONLAB_CONTROL_BAD_ARG
    );
  }
}
function rejectionFromErr(remainder) {
  const sp = remainder.indexOf(" ");
  const codeStr = sp >= 0 ? remainder.slice(0, sp) : remainder;
  const msg = sp >= 0 ? remainder.slice(sp + 1) : "";
  const code = parseInt(codeStr, 10);
  if (!Number.isFinite(code)) {
    return new ControlPlaneError(
      `server rejected: ${remainder}`,
      MOONLAB_CONTROL_REJECTED
    );
  }
  return new ControlPlaneError(`server rejected: ${msg || codeStr}`, code);
}
async function submitCircuit(args) {
  const timeoutMs = args.timeoutMs ?? 3e4;
  const sock = await openSocket({ ...args, timeoutMs });
  try {
    if (args.tenantId !== void 0) validateTenantId(args.tenantId, args.secret);
    const body = Buffer.from(args.circuitText, "utf-8");
    const verbLine = Buffer.from(`CIRCUIT ${body.length}
`, "ascii");
    if (args.secret) {
      sock.write(authPrelude(args.secret, verbLine, args.tenantId));
    }
    sock.write(verbLine);
    sock.write(body);
    const { line, rest } = await readUntilNewline(sock, timeoutMs);
    const fr = parseHeader(line, rest);
    if (fr.verb === "ERR") throw rejectionFromErr(fr.remainder);
    if (fr.verb !== "OK" || fr.numField < 0) {
      throw new ControlPlaneError(
        `unexpected framing: ${line.toString("ascii")}`,
        MOONLAB_CONTROL_IO_ERROR
      );
    }
    const num = fr.numField;
    const raw = await recvExact(sock, num * 8, fr.bodySeed, timeoutMs);
    const out = new Array(num);
    for (let i = 0; i < num; i++) {
      out[i] = raw.readDoubleLE(i * 8);
    }
    return out;
  } finally {
    await closeSocket(sock, timeoutMs);
  }
}
async function submitShots(args) {
  const result = await submitShotsFull(args, args.seed !== void 0);
  return result.outcomes;
}
async function submitShotsWithSeed(args) {
  return submitShotsFull(args, true);
}
async function submitShotsFull(args, requireSeedReply) {
  const timeoutMs = args.timeoutMs ?? 3e4;
  if (args.seed !== void 0 && (args.seed <= 0n || args.seed > 0xffffffffffffffffn)) {
    throw new ControlPlaneError(
      `seed ${args.seed} out of range [1, 2^64-1]`,
      MOONLAB_CONTROL_BAD_ARG
    );
  }
  const sock = await openSocket({ ...args, timeoutMs });
  try {
    if (args.tenantId !== void 0) validateTenantId(args.tenantId, args.secret);
    const body = Buffer.from(args.circuitText, "utf-8");
    const seedToken = args.seed === void 0 ? "" : ` seed=${args.seed.toString(16).padStart(16, "0")}`;
    const verbLine = Buffer.from(
      `SHOTS ${args.numShots} ${body.length}${seedToken}
`,
      "ascii"
    );
    if (args.secret) {
      sock.write(authPrelude(args.secret, verbLine, args.tenantId));
    }
    sock.write(verbLine);
    sock.write(body);
    const { line, rest } = await readUntilNewline(sock, timeoutMs);
    const fr = parseHeader(line, rest);
    if (fr.verb === "ERR") throw rejectionFromErr(fr.remainder);
    if (fr.verb !== "SAMPLES" || fr.numField < 0) {
      throw new ControlPlaneError(
        `unexpected framing: ${line.toString("ascii")}`,
        MOONLAB_CONTROL_IO_ERROR
      );
    }
    const fields = fr.remainder.trim().split(/\s+/);
    if (fields.length < 1 || fields.length > 2) {
      throw new ControlPlaneError(
        `malformed SAMPLES metadata: ${fr.remainder}`,
        MOONLAB_CONTROL_IO_ERROR
      );
    }
    let effectiveSeed = 0n;
    if (fields.length === 2) {
      const match = /^seed=([0-9a-fA-F]{16})$/.exec(fields[1]);
      if (!match) {
        throw new ControlPlaneError(
          `malformed SAMPLES seed: ${fields[1]}`,
          MOONLAB_CONTROL_IO_ERROR
        );
      }
      effectiveSeed = BigInt(`0x${match[1]}`);
      if (effectiveSeed === 0n) {
        throw new ControlPlaneError(
          "server returned a zero effective seed",
          MOONLAB_CONTROL_IO_ERROR
        );
      }
    }
    if (requireSeedReply && effectiveSeed === 0n) {
      throw new ControlPlaneError(
        "server omitted the effective SHOTS seed",
        MOONLAB_CONTROL_IO_ERROR
      );
    }
    if (args.seed !== void 0 && effectiveSeed !== args.seed) {
      throw new ControlPlaneError(
        `server seed mismatch: requested ${args.seed.toString(16)}, received ${effectiveSeed.toString(16)}`,
        MOONLAB_CONTROL_IO_ERROR
      );
    }
    const num = fr.numField;
    const raw = await recvExact(sock, num * 8, fr.bodySeed, timeoutMs);
    const out = new Array(num);
    for (let i = 0; i < num; i++) {
      out[i] = Number(raw.readBigUInt64LE(i * 8));
    }
    return { outcomes: out, effectiveSeed };
  } finally {
    await closeSocket(sock, timeoutMs);
  }
}
async function submitHealth(args) {
  const timeoutMs = args.timeoutMs ?? 5e3;
  const sock = await openSocket({ ...args, timeoutMs });
  try {
    sock.write("HEALTH\n");
    const { line } = await readUntilNewline(sock, timeoutMs);
    const fr = parseHeader(line, Buffer.alloc(0));
    if (fr.verb === "OK") return;
    if (fr.verb === "ERR") throw rejectionFromErr(fr.remainder);
    throw new ControlPlaneError(
      `unexpected framing: ${line.toString("ascii")}`,
      MOONLAB_CONTROL_IO_ERROR
    );
  } finally {
    await closeSocket(sock, timeoutMs);
  }
}
async function submitMetrics(args) {
  const timeoutMs = args.timeoutMs ?? 5e3;
  const sock = await openSocket({ ...args, timeoutMs });
  try {
    sock.write("METRICS\n");
    const { line, rest } = await readUntilNewline(sock, timeoutMs);
    const fr = parseHeader(line, rest);
    if (fr.verb === "ERR") throw rejectionFromErr(fr.remainder);
    if (fr.verb !== "METRICS" || fr.numField < 0) {
      throw new ControlPlaneError(
        `unexpected framing: ${line.toString("ascii")}`,
        MOONLAB_CONTROL_IO_ERROR
      );
    }
    const raw = await recvExact(sock, fr.numField, fr.bodySeed, timeoutMs);
    return raw.toString("utf-8");
  } finally {
    await closeSocket(sock, timeoutMs);
  }
}

export {
  __export,
  MOONLAB_CONTROL_OK,
  MOONLAB_CONTROL_BAD_ARG,
  MOONLAB_CONTROL_AUTH_REQUIRED,
  MOONLAB_CONTROL_AUTH_BAD,
  MOONLAB_CONTROL_IO_ERROR,
  MOONLAB_CONTROL_REJECTED,
  MOONLAB_CONTROL_OOM,
  MOONLAB_CONTROL_RATE_LIMITED,
  MOONLAB_CONTROL_SERVER_BUSY,
  ControlPlaneError,
  submitCircuit,
  submitShots,
  submitShotsWithSeed,
  submitHealth,
  submitMetrics
};

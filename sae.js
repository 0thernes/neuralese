// Sparse autoencoder trained in-browser on residual activations (ReLU SAE, L1 penalty, unit-norm decoder, Adam).
import { CFG, mulberry32, gauss } from './model.js?v=7';
const { d } = CFG;
export class SAE {
  constructor(layer, m, seed = 1) {
    this.layer = layer; this.m = m; const rng = mulberry32(seed);
    this.Wdec = new Float32Array(m * d); for (let i = 0; i < m * d; i++) this.Wdec[i] = gauss(rng);
    this.normDec(); this.Wenc = Float32Array.from(this.Wdec); this.benc = new Float32Array(m); this.bdec = new Float32Array(d);
    this.hist = [];
  }
  normDec() { for (let f = 0; f < this.m; f++) { let n = 0; const o = f * d; for (let i = 0; i < d; i++) n += this.Wdec[o + i] ** 2; n = Math.sqrt(n) || 1; for (let i = 0; i < d; i++) this.Wdec[o + i] /= n; } }
  encode(x, out) {
    const { m, Wenc, benc, bdec } = this; out = out || new Float32Array(m);
    for (let f = 0; f < m; f++) { let s = benc[f]; const o = f * d; for (let i = 0; i < d; i++) s += Wenc[o + i] * (x[i] - bdec[i]); out[f] = s > 0 ? s : 0; }
    return out;
  }
  decode(f, out) { out = out || new Float32Array(d); out.set(this.bdec); for (let k = 0; k < this.m; k++) { const a = f[k]; if (!a) continue; const o = k * d; for (let i = 0; i < d; i++) out[i] += a * this.Wdec[o + i]; } return out; }
  async train(X, N, { epochs = 3, lr = 2e-3, l1 = 3e-3, batch = 32, onp = () => {}, shouldStop = () => false } = {}) {
    const { m } = this; const P = [this.Wenc, this.benc, this.Wdec, this.bdec];
    const mom = P.map((p) => new Float32Array(p.length)), vel = P.map((p) => new Float32Array(p.length)), G = P.map((p) => new Float32Array(p.length));
    // init decoder bias to data mean
    this.bdec.fill(0); for (let i = 0; i < N; i++) for (let j = 0; j < d; j++) this.bdec[j] += X[i * d + j] / N;
    let scale = 0; for (let i = 0; i < N * d; i++) scale += X[i] * X[i]; scale /= N; // mean squared norm, for normalised MSE
    const rng = mulberry32(99), order = Array.from({ length: N }, (_, i) => i); let step = 0;
    const pre = new Float32Array(m), f = new Float32Array(m), xh = new Float32Array(d), xc = new Float32Array(d), e = new Float32Array(d), df = new Float32Array(m);
    for (let ep = 0; ep < epochs; ep++) {
      for (let i = N - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      let lossAcc = 0, mseAcc = 0, l0Acc = 0, cnt = 0;
      for (let b0 = 0; b0 < N; b0 += batch) {
        G.forEach((g) => g.fill(0)); const B = Math.min(batch, N - b0);
        for (let bi = 0; bi < B; bi++) {
          const xo = order[b0 + bi] * d;
          for (let i = 0; i < d; i++) xc[i] = X[xo + i] - this.bdec[i];
          let l0 = 0, l1s = 0;
          for (let k = 0; k < m; k++) { let s = this.benc[k]; const o = k * d; for (let i = 0; i < d; i++) s += this.Wenc[o + i] * xc[i]; pre[k] = s; f[k] = s > 0 ? s : 0; if (s > 0) { l0++; l1s += s; } }
          xh.set(this.bdec); for (let k = 0; k < m; k++) { const a = f[k]; if (!a) continue; const o = k * d; for (let i = 0; i < d; i++) xh[i] += a * this.Wdec[o + i]; }
          let mse = 0; for (let i = 0; i < d; i++) { e[i] = xh[i] - X[xo + i]; mse += e[i] * e[i]; }
          mse /= scale; lossAcc += mse + l1 * l1s; mseAcc += mse; l0Acc += l0; cnt++;
          const g = 2 / scale / B;
          for (let i = 0; i < d; i++) G[3][i] += g * e[i];
          for (let k = 0; k < m; k++) {
            if (!(pre[k] > 0)) { df[k] = 0; continue; }
            const o = k * d; let s = 0; for (let i = 0; i < d; i++) { s += this.Wdec[o + i] * e[i]; G[2][o + i] += g * f[k] * e[i]; }
            df[k] = g * s + l1 / B;
            G[1][k] += df[k]; for (let i = 0; i < d; i++) { G[0][o + i] += df[k] * xc[i]; G[3][i] -= df[k] * this.Wenc[o + i]; }
          }
        }
        step++; const b1 = 0.9, b2 = 0.999, c1 = 1 - b1 ** step, c2 = 1 - b2 ** step;
        P.forEach((p, pi) => { const g = G[pi], mm = mom[pi], vv = vel[pi]; for (let i = 0; i < p.length; i++) { mm[i] = b1 * mm[i] + (1 - b1) * g[i]; vv[i] = b2 * vv[i] + (1 - b2) * g[i] * g[i]; p[i] -= (lr * mm[i] / c1) / (Math.sqrt(vv[i] / c2) + 1e-8); } });
        this.normDec();
        if (step % 8 === 0) { onp({ ep, frac: (ep + (b0 + B) / N) / epochs, loss: lossAcc / cnt, mse: mseAcc / cnt, l0: l0Acc / cnt }); await new Promise((r) => setTimeout(r, 0)); if (shouldStop()) return this.hist; }
      }
      this.hist.push({ ep, loss: lossAcc / cnt, mse: mseAcc / cnt, l0: l0Acc / cnt });
    }
    return this.hist;
  }
  // feature statistics over the corpus activations
  analyse(X, N, k = 8) {
    const { m } = this, f = new Float32Array(m); const dens = new Float32Array(m), mx = new Float32Array(m), tops = Array.from({ length: m }, () => []);
    let mseSum = 0, varSum = 0; const mu = new Float32Array(d); for (let i = 0; i < N; i++) for (let j = 0; j < d; j++) mu[j] += X[i * d + j] / N;
    for (let i = 0; i < N; i++) {
      const x = X.subarray(i * d, i * d + d); this.encode(x, f); const xh = this.decode(f);
      for (let j = 0; j < d; j++) { mseSum += (xh[j] - x[j]) ** 2; varSum += (x[j] - mu[j]) ** 2; }
      for (let q = 0; q < m; q++) { const a = f[q]; if (!a) continue; dens[q]++; if (a > mx[q]) mx[q] = a; const t = tops[q]; if (t.length < k || a > t[t.length - 1][0]) { t.push([a, i]); t.sort((u, v) => v[0] - u[0]); if (t.length > k) t.pop(); } }
    }
    for (let q = 0; q < m; q++) dens[q] /= N;
    return { dens, mx, tops, fvu: mseSum / varSum, alive: dens.filter((x) => x > 0).length };
  }
}

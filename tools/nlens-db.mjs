// Builds the Neuron Lens database for TinyStories-8M: every MLP neuron's input/output reads through every lens and every
// head's OV/QK readouts (original implementation of the neuron-lens read/head-readout ideas; prior art credited in docs/NEURON_LENS_METHOD.md).
// Usage: node tools/nlens-db.mjs [--out lens/ts8m]  → lens/ts8m/db/L{l}.json, tokens.json, db-manifest.json (sha256 per file)
import fs from 'node:fs';
import { loadModel, tokenizer, corpusText, stories, docsFrom, sha256 } from './nlens-common.mjs';
import * as NL from '../neuronlens.js';
const arg = (k, v) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : v; };
const outDir = arg('out', 'lens/ts8m'), model = arg('model', 'model'), K = 10, r3 = (x) => +x.toPrecision(3);
const M = loadModel(model), { d, L, ff, H, hd, V } = M.cfg, man = JSON.parse(fs.readFileSync(`${outDir}/manifest.json`, 'utf8')), lb = fs.readFileSync(`${outDir}/lenses.f32`);
if (sha256(lb) !== man.sha256) throw new Error('lens hash mismatch');
const Z = NL.unpackLenses(new Float32Array(lb.buffer.slice(lb.byteOffset, lb.byteOffset + lb.length)), man);
const tok = tokenizer(model), st = stories(await corpusText(`${model}/TinyStories-valid.txt`)), cnt = new Uint32Array(V);
for (let i = 0; i < 20000; i++) for (const t of tok.encode(st[i])) cnt[t]++;
const kept = []; for (let v = 0; v < V; v++) if (cnt[v] >= 5) kept.push(v); const Vk = kept.length, keptI = Int32Array.from(kept), used = new Set();
const pick = (scores, k = K, neg = false) => { const ix = NL.topK(Float32Array.from(keptI, (v) => scores[v]), k, null, neg); ix.forEach((i) => used.add(kept[i])); return [ix.map((i) => kept[i]), ix.map((i) => r3(scores[kept[i]]))]; };
const pickK = (row, k = K, neg = false) => { const ix = NL.topK(row, k, null, neg); ix.forEach((i) => used.add(kept[i])); return [ix.map((i) => kept[i]), ix.map((i) => r3(row[i]))]; };
const drivers = fs.existsSync(`${outDir}/drivers.json`) ? JSON.parse(fs.readFileSync(`${outDir}/drivers.json`, 'utf8')).drivers : null;
// activation statistics and top contexts from 64 documents disjoint from fit (stories 30000..)
const actDocs = docsFrom(tok, st, 21200, 64, 64).map((x) => x.ids), top = Array.from({ length: L }, () => Array.from({ length: ff }, () => ({ a: -Infinity, doc: 0, t: 0 }))), sumPos = Array.from({ length: L }, () => new Float64Array(ff)), cntAct = Array.from({ length: L }, () => new Float64Array(ff));
const attn = Array.from({ length: L }, () => Array.from({ length: H }, () => ({ prev: 0, first: 0, self: 0, n: 0 })));
actDocs.forEach((ids, di) => { const f = NL.forward(M, ids, { acts: true, record: true }); const T = ids.length;
  for (let l = 0; l < L; l++) { const A = f.acts[l]; for (let t = 1; t < T; t++) for (let n = 0; n < ff; n++) { const a = A[t * ff + n]; if (a > 0.1) cntAct[l][n]++; sumPos[l][n] += Math.max(0, a); if (a > top[l][n].a) top[l][n] = { a, doc: di, t }; }
    const P = f.rec[l].P; for (let h = 0; h < H; h++) for (let t = 4; t < T; t++) { const row = (h * T + t) * T, s = attn[l][h]; s.prev += P[row + t - 1]; s.first += P[row]; s.self += P[row + t]; s.n++; } } });
const ctx = (di, t) => [tok.decode(actDocs[di].slice(Math.max(0, t - 8), t)), tok.decode([actDocs[di][t]])];
const E = M.W.wte, eb = NL.embMean(M), Ec = new Float32Array(Vk * d); kept.forEach((v, k) => { for (let i = 0; i < d; i++) Ec[k * d + i] = E[v * d + i] - eb[i]; });
const ET = NL.tokMatT(M, kept, false), EcT = NL.tokMatT(M, kept, true);
const fw = Float64Array.from(kept, (v) => cnt[v]), fsum = fw.reduce((a, b) => a + b);
const files = {};
for (let l = 0; l < L; l++) {
  const neurons = [], Cs = new Float32Array(ff * d), Ws = new Float32Array(ff * d);
  for (let n = 0; n < ff; n++) { const { c, w } = NL.neuronDirs(M, l, n); Cs.set(c, n * d); Ws.set(w, n * d); }
  const Jout = l < L - 1 ? Z.R.out[l] : null, rd = { in_S: NL.readsS(M, Cs, ff, Z.S.mid[l], kept, EcT), in_R: NL.readsR(M, Cs, ff, Z.R.mid[l], kept, ET), out_R: NL.readsR(M, Ws, ff, Jout, kept, ET), out_S: NL.readsS(M, Ws, ff, Z.S.out[l], kept, EcT), out_logit: NL.readsR(M, Ws, ff, null, kept, ET) };
  for (let n = 0; n < ff; n++) { const w = Ws.subarray(n * d, n * d + d); let wn = 0; for (const x of w) wn += x * x; const row = (k) => rd[k].subarray(n * Vk, (n + 1) * Vk);
    const rec = { n, w_norm: r3(Math.sqrt(wn)), act_max: r3(top[l][n].a), rate: r3(cntAct[l][n] / (actDocs.length * 63)), ctx: ctx(top[l][n].doc, top[l][n].t) };
    for (const k of Object.keys(rd)) rec[k] = pickK(row(k)); rec.out_R_neg = pickK(row('out_R'), 5, true);
    if (drivers) { rec.drivers = drivers[l][n]; drivers[l][n].forEach((v) => used.add(v)); } neurons.push(rec); }
  // heads: input footprints X_v = K^out_{l-1}(E_v − ē) (embedding at L0), LayerNorm-shaped by ln_1 (no bias)
  const Kin = l ? Z.S.out[l - 1] : null, X = new Float32Array(Vk * d); if (Kin) NL.mm(Ec, NL.transpose(Kin, d, d), X, Vk, d, d); else X.set(Ec);
  const P = M.layers[l]; for (let k = 0; k < Vk; k++) { const nv = NL.lnDir(X.subarray(k * d, k * d + d), P.ln1w); X.set(nv, k * d); }
  const Qa = NL.mm(X, P.qT, new Float32Array(Vk * d), Vk, d, d), Ka = NL.mm(X, P.kT, new Float32Array(Vk * d), Vk, d, d), Va = NL.mm(X, P.vT, new Float32Array(Vk * d), Vk, d, d);
  const wteC = new Float32Array(Vk * d); kept.forEach((v, k) => { let m = 0; for (let i = 0; i < d; i++) { wteC[k * d + i] = E[v * d + i] * M.W.lnfW[i]; m += wteC[k * d + i]; } m /= d; for (let i = 0; i < d; i++) wteC[k * d + i] -= m; });
  const JW = NL.mm(wteC, Z.R.mid[l], new Float32Array(Vk * d), Vk, d, d); // rows: (C(γ⊙w_u))ᵀ J  → B = JW · Wo_h
  const SW = NL.mm(Ec, NL.transpose(Z.S.mid[l], d, d), new Float32Array(Vk * d), Vk, d, d); // rows: (E_u−ē)ᵀ Kᵀ → Bs = SW · Wo_h
  const heads = [];
  for (let h = 0; h < H; h++) { const sl = (A, k) => A.subarray(k * d + h * hd, k * d + h * hd + hd), Wo = new Float32Array(d * hd); for (let i = 0; i < d; i++) for (let e = 0; e < hd; e++) Wo[i * hd + e] = P.o[i * d + h * hd + e];
    const B = NL.mm(JW, Wo, new Float32Array(Vk * hd), Vk, d, hd), Bs = NL.mm(SW, Wo, new Float32Array(Vk * hd), Vk, d, hd);
    const diagZ = (Bm, Q) => { const mu = new Float64Array(hd), C = new Float64Array(hd * hd); for (let k = 0; k < Vk; k++) for (let e = 0; e < hd; e++) mu[e] += Bm[k * hd + e] / Vk;
      for (let k = 0; k < Vk; k++) for (let a = 0; a < hd; a++) { const xa = Bm[k * hd + a] - mu[a]; for (let b = 0; b < hd; b++) C[a * hd + b] += xa * (Bm[k * hd + b] - mu[b]) / Vk; }
      const z = new Float32Array(V); for (let k = 0; k < Vk; k++) { const q = Q(k); let num = 0, vq = 0; for (let a = 0; a < hd; a++) { num += (Bm[k * hd + a] - mu[a]) * q[a]; let s = 0; for (let b = 0; b < hd; b++) s += C[a * hd + b] * q[b]; vq += q[a] * s; } z[kept[k]] = num / Math.sqrt(vq || 1e-30); } return z; };
    const zR = diagZ(B, (k) => sl(Va, k)), zS = diagZ(Bs, (k) => sl(Va, k));
    const qbar = new Float64Array(hd), kbar = new Float64Array(hd); for (let k = 0; k < Vk; k++) for (let e = 0; e < hd; e++) { qbar[e] += sl(Qa, k)[e] * fw[k] / fsum; kbar[e] += sl(Ka, k)[e] / Vk; }
    const qkS = new Float32Array(V), qkSelf = new Float32Array(V), CK = new Float64Array(hd * hd);
    for (let k = 0; k < Vk; k++) { const kk = sl(Ka, k); for (let a = 0; a < hd; a++) for (let b = 0; b < hd; b++) CK[a * hd + b] += (kk[a] - kbar[a]) * (kk[b] - kbar[b]) / Vk; let s = 0; for (let e = 0; e < hd; e++) s += qbar[e] * kk[e]; qkS[kept[k]] = s; }
    for (let k = 0; k < Vk; k++) { const q = sl(Qa, k), kk = sl(Ka, k); let num = 0, vq = 0; for (let a = 0; a < hd; a++) { num += q[a] * (kk[a] - kbar[a]); let s = 0; for (let b = 0; b < hd; b++) s += CK[a * hd + b] * q[b]; vq += q[a] * s; } qkSelf[kept[k]] = num / Math.sqrt(vq || 1e-30); }
    const selfArr = Float32Array.from(keptI, (v) => qkSelf[v]).sort(), zRk = Float32Array.from(keptI, (v) => zR[v]);
    const vbar = new Float32Array(hd); for (let k = 0; k < Vk; k++) for (let e = 0; e < hd; e++) vbar[e] += sl(Va, k)[e] * fw[k] / fsum; const obar = new Float32Array(d); for (let i = 0; i < d; i++) for (let e = 0; e < hd; e++) obar[i] += Wo[i * hd + e] * vbar[e];
    const a = attn[l][h];
    heads.push({ h, ov_R: pick(zR), ov_S: pick(zS), ov_R_neg: pick(zR, 5, true), writes_R: pick(NL.rRead(M, obar, Z.R.mid[l])), qk_S: pick(qkS), qk_self: pick(qkSelf), qk_self_median: r3(selfArr[selfArr.length >> 1]), copy_frac: r3(zRk.filter((x) => x > 2.326).length / Vk),
      attn_prev: r3(a.prev / a.n), attn_first: r3(a.first / a.n), attn_self: r3(a.self / a.n) }); }
  const f = `db/L${l}.json`; fs.mkdirSync(`${outDir}/db`, { recursive: true }); const body = JSON.stringify({ layer: l, neurons, heads }); fs.writeFileSync(`${outDir}/${f}`, body); files[f] = sha256(body); console.log('layer', l, (body.length / 1e6).toFixed(2), 'MB');
}
const tokens = {}; for (const v of [...used].sort((a, b) => a - b)) tokens[v] = tok.decode([v]); const tb = JSON.stringify(tokens); fs.writeFileSync(`${outDir}/db/tokens.json`, tb); files['db/tokens.json'] = sha256(tb);
fs.writeFileSync(`${outDir}/db-manifest.json`, JSON.stringify({ format: 'neuralese-neuron-lens-db-v1', model: man.model, lens_sha256: man.sha256, kept: Vk, topK: K, layers: L, neurons: ff, heads: H, files,
  fields: { neuron: 'in_S=S.mid read of the input direction; in_R=R.mid read; out_R=R.out read of the write (L7: logit lens); out_S=S.out footprint of the write; out_logit=logit lens; out_R_neg=most suppressed; drivers=exact drivers; ctx=top firing [context, token] over 64 stories (21200..)', head: 'ov_R/ov_S=diagonal-z copy reads (R.mid / S.mid); writes_R=R.mid read of the head\'s frequency-weighted mean write; qk_S=key tokens under the mean query; qk_self=tokens that seek themselves; attn_*=measured attention mass on previous/first/self token over 64 stories' } }, null, 1));
console.log('done', Object.keys(files).length, 'files');

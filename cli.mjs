#!/usr/bin/env node
// NEURALESE v6 CLI / TUI — same core modules as the browser lab (model, tokenizer, grad, science, drill, zoo).
// usage: node cli.mjs [--model DIR] [command args…]   (no command → interactive prompt; DIR default: download to ~/.cache/neuralese)
import fs from 'fs'; import os from 'os'; import path from 'path'; import readline from 'readline';
import { buildWeights, parseSafetensors } from './model.js?v=6';
import { GPT2Tokenizer } from './tokenizer.js?v=6';
import { Engine, defaultRuntime } from './engine.js?v=6';
import * as G from './grad.js?v=6';
import * as S from './science.js?v=6';
import * as D from './drill.js?v=6';
import { ZOO, loadZoo, httpRange, weightDiff } from './zoo.js?v=6';
import { CORPUS } from './corpus.js?v=6';
const VERSION = '6.0.0', REPO = 'https://huggingface.co/roneneldan/TinyStories-8M/resolve';
const argv = process.argv.slice(2); let dir = null; const mi = argv.indexOf('--model'); if (mi >= 0) { dir = argv[mi + 1]; argv.splice(mi, 2); }
const C = { b: (s) => `\x1b[1m${s}\x1b[0m`, c: (s) => `\x1b[36m${s}\x1b[0m`, m: (s) => `\x1b[35m${s}\x1b[0m`, d: (s) => `\x1b[2m${s}\x1b[0m` };
async function ensureModel() {
  dir = dir || path.join(os.homedir(), '.cache', 'neuralese'); fs.mkdirSync(dir, { recursive: true });
  for (const [f, u] of [['model.safetensors', `${REPO}/refs%2Fpr%2F1/model.safetensors`], ['vocab.json', `${REPO}/main/vocab.json`], ['merges.txt', `${REPO}/main/merges.txt`]]) {
    const p = path.join(dir, f); if (fs.existsSync(p)) continue; process.stderr.write(C.d(`downloading ${f}…\n`)); const r = await fetch(u); if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); fs.writeFileSync(p, Buffer.from(await r.arrayBuffer())); }
  const buf = fs.readFileSync(path.join(dir, 'model.safetensors')), n = Number(buf.readBigUInt64LE(0)), hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
  return { W: buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr)), tok: new GPT2Tokenizer(JSON.parse(fs.readFileSync(path.join(dir, 'vocab.json'))), fs.readFileSync(path.join(dir, 'merges.txt'), 'utf8')) };
}
const bar = (v, mx, w = 24) => { const k = Math.round((Math.abs(v) / (mx || 1)) * w); return (v < 0 ? '\x1b[34m' : '\x1b[35m') + '█'.repeat(k) + '\x1b[0m' + ' '.repeat(w - k); };
const shade = (v, mx) => ' ░▒▓█'[Math.min(4, Math.round((Math.abs(v) / (mx || 1)) * 4))];
const grid = (Mx, title) => { const mx = Math.max(...Mx.flat().map(Math.abs)); return `${title}\n     ${Mx[0].map((_, h) => String(h).padStart(2)).join('')}\n` + Mx.map((r, l) => `L${l}   ` + r.map((v) => ' ' + shade(v, mx)).join('')).join('\n') + C.d(`\n(max ${mx.toFixed(4)})`); };
const docs = (n, T = 24) => CORPUS.slice(0, n).map((x) => x.slice(0, T));
const HELP = { help: 'this list', version: 'versions', gen: 'gen <n> <prompt…> — greedy continuation', drill: 'drill <path> — inspect any node (L3.attn.q.H5.r2.w17)', attrib: 'attrib gxi|ig "<prompt>" <A> <B> — token attribution of logit(A)−logit(B)',
  atp: 'atp "<clean>" "<corrupt>" <A> <B> — AtP vs activation patching', eigen: 'eigen — OV/QK copying scores', comp: 'comp — top composition scores', induct: 'induct — induction / prev-token scores', geom: 'geom [docs] — CKA diag, ID, anisotropy, logit-lens KL',
  superpos: 'superpos <L>', land: 'land <L> <key> [random|svd] — 1-D loss slice', hess: 'hess <L> <key> — top Hessian eigenvalue', zoo: 'zoo [ids…] — compare TinyStories 1M/3M/8M', diff: 'diff <id> — weight diff 8M vs zoo model (same d only)', quit: 'exit' };
function split(line) { const out = []; line.replace(/"([^"]*)"|(\S+)/g, (_, q, w) => out.push(q ?? w)); return out; }
async function run(ctx, line) { const [cmd, ...a] = split(line); const { W, tok } = ctx; const id1 = (s) => tok.encode(' ' + s)[0];
  switch (cmd) {
    case undefined: return '';
    case 'help': return Object.entries(HELP).map(([k, v]) => `${C.c(k.padEnd(9))} ${v}`).join('\n');
    case 'version': return `NEURALESE CLI v${VERSION} · TinyStories-8M (GPT-Neo 8×256) · same core as the web lab · node ${process.version}`;
    case 'gen': { const n = +a[0] || 16, ids = tok.encode(a.slice(1).join(' ') || 'Once upon a time'), e = new Engine(W, defaultRuntime()), sq = e.newSeq(ids.length), o = [...ids]; let h; for (const t of ids) h = e.step(sq, t).h; for (let i = 0; i < n; i++) { const lg = e.logits(h); let b = 0; for (let j = 1; j < lg.length; j++) if (lg[j] > lg[b]) b = j; o.push(b); h = e.step(sq, b).h; } return C.b(tok.decode(ids)) + tok.decode(o.slice(ids.length)); }
    case 'drill': { const r = D.inspect(W, D.fromPath(a[0] || 'model'), docs(3, 16), { tok }); const s = r.stats, sp = r.spectral, g = r.grad;
      return [`${C.b(r.path)} ${C.d(r.level + ' · ' + r.count + ' params')}`, `mean ${s.mean.toExponential(3)}  std ${s.std.toExponential(3)}  skew ${s.skew.toFixed(3)}  kurt ${s.kurt.toFixed(3)}  sparsity ${(100 * s.sparsity).toFixed(2)}%`,
        sp ? `σ1 ${sp.spec.toFixed(4)}  ‖·‖F ${sp.frob.toFixed(4)}  effRank ${sp.effRank.toFixed(2)}  stableRank ${sp.stableRank.toFixed(2)}  cond ${sp.cond.toFixed(2)}  α ${sp.alpha.toFixed(2)}` : C.d('(no 2-D spectrum)'),
        `loss ${g.loss.toFixed(4)}  ‖∇‖ ${g.gradNorm.toExponential(3)}  Fisher ${g.fisherTrace.toExponential(3)}  saliency ${g.saliency.toExponential(3)}`, `dL/dθ̂ analytic ${g.dirDeriv.toExponential(4)} vs finite-diff ${g.finiteDiff.toExponential(4)} (rel err ${(100 * g.fdRelErr).toFixed(2)}%)`,
        `zero-ablation ΔCE ${r.ablation.dLoss.toFixed(5)}`, 'children: ' + D.children(W, D.fromPath(a[0] || 'model')).slice(0, 16).map((k) => D.toPath(k)).join(' ')].join('\n'); }
    case 'attrib': { const ids = tok.encode(a[1] || 'Lily and Tom went to the park. Lily gave the ball to'), ob = { kind: 'logitdiff', a: id1(a[2] || 'Tom'), b: id1(a[3] || 'Lily') }, r = a[0] === 'ig' ? G.integratedGradients(W, ids, ob, 24) : G.gradXInput(W, ids, ob), mx = Math.max(...r.scores.map(Math.abs));
      return ids.map((t, i) => `${JSON.stringify(tok.decode([t])).padEnd(14)} ${bar(r.scores[i], mx)} ${r.scores[i].toFixed(4)}`).join('\n') + (r.delta != null ? `\nΣ ${r.sum.toFixed(4)} vs m(x)−m(x′) ${r.delta.toFixed(4)}` : ''); }
    case 'atp': { const c = tok.encode(a[0] || 'Lily and Tom went to the park. Lily gave the ball to'), x = tok.encode(a[1] || 'Lily and Tom went to the park. Tom gave the ball to'); if (c.length !== x.length) throw new Error('prompts must tokenize to equal length');
      const ob = { kind: 'logitdiff', a: id1(a[2] || 'Tom'), b: id1(a[3] || 'Lily') }, e = G.attributionPatching(W, c, x, ob), t = G.activationPatchingHeads(W, c, x, ob), fe = e.est.flat(), ft = t.flat(), n = fe.length, ma = fe.reduce((s, v) => s + v, 0) / n, mb = ft.reduce((s, v) => s + v, 0) / n;
      let ab = 0, aa = 0, bb = 0; for (let i = 0; i < n; i++) { ab += (fe[i] - ma) * (ft[i] - mb); aa += (fe[i] - ma) ** 2; bb += (ft[i] - mb) ** 2; } return grid(e.est, 'AtP estimate') + '\n' + grid(t, 'true activation patching') + `\nPearson r = ${C.b((ab / Math.sqrt(aa * bb)).toFixed(3))}`; }
    case 'eigen': { const s = S.headEigenScores(W, S.embedGram(W)); return grid(s.map((r) => r.map((x) => x.ov)), 'OV copying score') + '\n' + grid(s.map((r) => r.map((x) => x.qk)), 'QK same-token score'); }
    case 'comp': { const c = S.compositionScores(W); return ['Q', 'K', 'V'].map((k) => `${k}: ` + c[k].slice(0, 6).map((e) => `L${e.from[0]}H${e.from[1]}→L${e.to[0]}H${e.to[1]} ${e.s.toFixed(4)}`).join('  ')).join('\n'); }
    case 'induct': { const I = S.inductionScores(W, { n: 20, reps: 4 }); return grid(I.map((r) => r.map((x) => x.ind.est)), 'induction') + '\n' + grid(I.map((r) => r.map((x) => x.prev.est)), 'previous-token'); }
    case 'geom': { const R = S.residuals(W, docs(+a[0] || 2, 32), 32), kl = S.logitLensKL(W, docs(2, 24), 24); return R.map((X, i) => `slot ${i}  ID ${S.twoNN(X.slice(0, 400)).toFixed(2).padStart(6)}  anisotropy ${S.anisotropy(X, 1000).est.toFixed(3)}  CKA(prev) ${i ? S.cka(R[i - 1], X).toFixed(3) : '  –  '}  lens KL ${kl[i] ? kl[i].est.toFixed(3) : '–'}`).join('\n'); }
    case 'superpos': { const g = S.superposition(W, +a[0] || 0), mx = Math.max(...g.hist); return g.hist.map((h, i) => `|cos| ${(i / 20).toFixed(2)} ${bar(h, mx, 30)} ${h}`).join('\n') + `\nmean |cos| ${g.meanAbsCos.toFixed(4)} vs random ${g.randomBaselineCos.toFixed(4)} · ΣD ${g.sumD.toFixed(1)}`; }
    case 'land': { const r = S.lossSlice(W, docs(1, 16), { mats: [[+a[0] || 3, a[1] || 'fc']], dir: a[2] || 'random', n: 21, span: 1, maxT: 16 }), ys = r.grid[0], lo = Math.min(...ys), hi = Math.max(...ys); return ys.map((y, i) => `α ${r.ax[i].toFixed(2).padStart(5)} ${bar(y - lo, hi - lo, 40)} ${y.toFixed(4)}`).join('\n'); }
    case 'hess': { const r = G.topHessianEig(W, tok.encode('Once upon a time there was a little girl'), +a[0] || 7, a[1] || 'ob', 6); return `λ_max ≈ ${r.lambda.toExponential(4)}`; }
    case 'zoo': case 'diff': { const want = cmd === 'diff' ? [a[0] || '1M'] : a.length ? a : ['1M', '3M']; const out = []; ctx.zoo = ctx.zoo || {};
      for (const id of want) { const z = ZOO.find((x) => x.id === id); if (!z) throw new Error('unknown ' + id); const Wz = id === '8M' ? W : ctx.zoo[id] || (ctx.zoo[id] = (await loadZoo(z.url, httpRange)).W);
        if (cmd === 'diff') { if (Wz.lnfW.length !== W.lnfW.length) return `cannot diff ${id} (d=${Wz.lnfW.length}) with 8M (d=${W.lnfW.length}): different shapes`; return weightDiff(W, Wz).slice(0, 12).map((x) => `${x.name} rel ${x.rel.toExponential(3)}`).join('\n'); }
        let ce = 0, nt = 0; for (const d0 of docs(4, 24)) { ce += G.grad(Wz, d0, { kind: 'ce' }).value * (d0.length - 1); nt += d0.length - 1; } out.push(`${id.padEnd(3)} d=${Wz.lnfW.length}  CE ${(ce / nt).toFixed(4)}  ppl ${Math.exp(ce / nt).toFixed(3)}`); }
      return out.join('\n'); }
    case 'quit': case 'exit': process.exit(0);
    default: throw new Error(`unknown command "${cmd}" — try help`);
  } }
const ctx = await ensureModel();
if (argv.length) { try { console.log(await run(ctx, argv.map((x) => (/\s/.test(x) ? `"${x}"` : x)).join(' '))); } catch (e) { console.error('✖ ' + e.message); process.exit(1); } }
else { console.log(C.m(C.b('NEURALESE')) + ` CLI v${VERSION} — type help`); const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: C.c('neuralese› ') }); rl.prompt();
  rl.on('line', async (l) => { rl.pause(); try { const t0 = Date.now(), o = await run(ctx, l.trim()); if (o) console.log(o); console.log(C.d(`(${Date.now() - t0} ms)`)); } catch (e) { console.log('✖ ' + e.message); } rl.resume(); rl.prompt(); }); }

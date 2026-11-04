// Jobs the engine worker runs so the page thread only paints progress.
import { patchResid, patchHeads, pathPatchHeadsToLogits, ablationSweep } from './analysis.js?v=170';
import { computeRome } from './rome.js?v=170';
import { SAE } from './sae.js?v=170';
import { cancelled, resetCancel } from './coop.js?v=170';

export async function dispatchHeavy(eng, m, onp) {
  resetCancel();
  if (!eng) throw new Error('no engine ' + m.key);
  const stop = () => { if (cancelled()) throw new Error('cancelled'); };
  const note = (frac) => { stop(); onp(typeof frac === 'number' ? frac : frac?.frac ?? 0, frac); };
  if (m.kind === 'patchResid') return patchResid(eng, m.clean, m.corr, m.ans, m.wrong, note);
  if (m.kind === 'patchHeads') return patchHeads(eng, m.clean, m.corr, m.ans, m.wrong, note);
  if (m.kind === 'path') return pathPatchHeadsToLogits(eng, m.clean, m.corr, m.ans, m.wrong);
  if (m.kind === 'ablate') return ablationSweep(eng, m.ids, m.ans, m.wrong, m.type, note);
  if (m.kind === 'rome') return computeRome(eng, null, m.C, m, (p) => { stop(); onp(Math.min(1, (p.it || 0) / 150), p); });
  if (m.kind === 'sae') {
    const s = new SAE(m.layer, m.m, 1);
    const hist = await s.train(m.X, m.N, { epochs: m.epochs, lr: m.lr, l1: m.l1, onp: (p) => { stop(); onp(p.frac, p); }, shouldStop: cancelled });
    const analysis = s.analyse(m.X, m.N, 10);
    return { layer: s.layer, m: s.m, Wenc: s.Wenc, benc: s.benc, Wdec: s.Wdec, bdec: s.bdec, hist, analysis };
  }
  throw new Error('unknown heavy job ' + m.kind);
}

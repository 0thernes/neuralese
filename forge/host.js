// Host attachment. The Forge subspace is a separate 64-wide stamp.
// Sampling the loaded TinyStories engine, when the shell has one, records real LM tokens.
// Those tokens are not NestLang. Demo mode says so. A host forward timed beside a clock
// does not write engine bits into the residual.

import { DELIMITER } from './session.js';
import { stampSubspace } from './engine.js';

export function scriptedPrompt(task) {
  return [task, DELIMITER];
}

export function greedyTokens(eng, tok, prompt, n) {
  const ids = tok.encode(prompt);
  if (!ids || !ids.length) return { tokens: [], note: 'empty prompt' };
  const seq = eng.newSeq(ids.length);
  let r;
  for (const id of ids) r = eng.step(seq, id, { trace: false });
  const tokens = [];
  for (let i = 0; i < n; i++) {
    const logits = eng.logits(r.h);
    let id = 0, best = -Infinity;
    for (let j = 0; j < logits.length; j++) if (logits[j] > best) { best = logits[j]; id = j; }
    if (id === 50256) break;
    tokens.push(tok.tokenStr(id));
    r = eng.step(seq, id, { trace: false });
  }
  return { tokens, note: 'greedy TinyStories sample. This model is not trained to emit NestLang. The editor program is the one that is checked and clocked.' };
}

export function forwardOnce(eng, tok) {
  const ids = tok.encode('Forge.');
  const seq = eng.newSeq(ids.length || 1);
  let r = eng.step(seq, ids[0] || 0, { trace: false });
  const before = Float32Array.from(r.h);
  const t0 = performance.now();
  r = eng.step(seq, ids[0] || 0, { trace: false });
  const ms = performance.now() - t0;
  let same = before.length === r.h.length;
  for (let i = 0; i < before.length && same; i++) if (before[i] !== r.h[i]) same = false;
  return { ms, residualCopied: true, sameLength: before.length === r.h.length, width: r.h.length };
}

export function stampFor(step) { return stampSubspace(step); }

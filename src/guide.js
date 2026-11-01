// v12.1 guided path through the 65 tabs: ten stops that build on each other, each with one concrete thing to try.
export const GUIDE = [
  ['gen', 'Generate', 'Press ▶ generate. The top text is the (possibly edited) model, the faint text the clean model. Same seed → same output.'],
  ['an', 'Look inside', 'Run analyze on the default Lily/Tom prompt: which heads write the predicted name (direct logit attribution)?'],
  ['attn', 'Attention', 'Run the maps and the head classifier: previous-token, induction and diffuse heads.'],
  ['embed', 'Embedding space', 'Search “ dog” (leading space = the word as it appears mid-sentence) and look at its nearest tokens.'],
  ['steer', 'Steer', 'Build the default contrast vector and generate at coefficient −0.5, then −8: gentle change vs collapse.'],
  ['causal', 'Causal tests', 'Patch the residual stream between the clean and corrupted prompt: where does the answer get decided?'],
  ['surg', 'Edit weights', 'Quantise L3 q/k to 2 bits, then check IMPACT. Undo (Ctrl+Z) restores bit-identical weights.'],
  ['impact', 'Measure the edit', 'Measure KL and the greedy-output change caused by your edit.'],
  ['v3d', 'See it in 3D', 'Pick a mode, then ⤢ fit to view if anything looks cropped.'],
  ['hub', 'Other models', 'The model hub runs speech, vision and embedding models locally; their results are labelled per model.'],
];
export function installGuide(api, $ = (id) => document.getElementById(id)) {
  const tb = document.querySelector('#top .tb'); if (!tb || $('bGuide')) return;
  const b = document.createElement('button'); b.id = 'bGuide'; b.title = 'Guided path: 10 tabs in a sensible order'; b.textContent = '🧭 guide'; tb.prepend(b);
  const box = document.createElement('div'); box.id = 'guide'; box.className = 'hidden'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'guided path'); document.body.append(box);
  let i = Math.max(0, Math.min(GUIDE.length - 1, +localStorage.getItem('neuralese.guide') || 0));
  const show = () => { const [k, t, d] = GUIDE[i]; localStorage.setItem('neuralese.guide', i); api.showTab(k);
    box.innerHTML = `<div class="r"><b>${i + 1}/${GUIDE.length} · ${t}</b><span class="sp"></span><button id="gX" aria-label="close guide">×</button></div><div class="sm">${d}</div><div class="r"><button id="gP" ${i ? '' : 'disabled'}>← back</button><button id="gN" class="pri" ${i < GUIDE.length - 1 ? '' : 'disabled'}>next →</button></div>`;
    $('gX').onclick = () => box.classList.add('hidden'); $('gP').onclick = () => { i--; show(); }; $('gN').onclick = () => { i++; show(); }; };
  b.addEventListener('click', () => { const h = box.classList.toggle('hidden'); if (!h) show(); });
  return { open: (n = 0) => { i = n; box.classList.remove('hidden'); show(); return GUIDE[i][0]; } };
}

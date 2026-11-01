// v12.1: provenance banners. Every panel that shows results says where they come from, so stored author results are never
// mistaken for experiments rerun in this browser, and "quantum" components are never mistaken for quantum hardware.
export const KINDS = {
  stored: ['STORED AUTHOR RESULTS', 'precomputed offline by the authors and shipped as JSON; displayed, not rerun in this browser'],
  mixed: ['STORED + LIVE', 'tables marked “stored” are author results shipped as JSON; only the buttons labelled “live” recompute anything here'],
  checks: ['LIVE CONSISTENCY CHECKS', 'recomputed in this browser, but they check that stored results load, hash and score as reported — they do not rerun the experiments, and a “holds” row is not a supported hypothesis'],
  sim: ['CLASSICAL SIMULATION', 'quantum-inspired mathematics computed on an ordinary CPU (state vectors / Born-rule sampling in WebAssembly); no quantum hardware or physical quantum randomness is involved'],
};
export const PROVENANCE = {
  fx: ['stored', 'The hypothesis table (6 supported / 8 unsupported) is the authors’ pre-registered result set.'],
  fsc: ['stored', 'Indicator statuses are the authors’ assessment; neither passing nor failing shows consciousness.'],
  fmind: ['mixed', 'PCI / ignition / introspection tables are stored; “run live PCI” is a single live sample, not a pre-registered test.'],
  frsi: ['stored', 'No live loop runs in this panel; the 30-iteration self-improvement results are stored.'],
  fgrok: ['mixed', 'The pre-registered 1500-step run is stored; “train live” is a short live run that may not grok.'],
  fatlas: ['stored', 'The exhaustive 8192-neuron / 128-head ablation atlas is stored, not rerun here.'],
  fclaims: ['checks', ''],
  tsk: ['sim', ''], qrng: ['sim', 'Seeds come from a simulated measurement driven by the browser CSPRNG; there is no physical QRNG.'], qgeom: ['sim', 'Fubini–Study / fidelity are computed classically on next-token distributions.'],
  claims: ['mixed', 'Some rows compare against shipped offline goldens rather than rerunning the original computation.'],
};
export function banner(k) { const p = PROVENANCE[k]; if (!p) return ''; const [lab, txt] = KINDS[p[0]]; return `<div class="prov prov-${p[0]}" role="note" data-prov="${p[0]}"><b>${lab}</b> — ${txt}.${p[1] ? ' ' + p[1] : ''}</div>`; }

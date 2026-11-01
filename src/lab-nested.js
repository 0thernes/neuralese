// v14.7 / v14.8 NESTED group: a RISC-V CPU baked into transformer weights, a language model baked into a language model,
// a mixture-of-experts inside an expert, and the lens results on those nested models. The three demos come from the
// neuralese-nested workstream (nested/*, self-contained pages, framed so their ids never collide with the lab's).
import * as N from './nestedlens.js?v=170';
import { $, esc, fmt, tipq } from './lab-ui.js?v=170';
const frame = (src, h = 760) => `<iframe class="nestfr" loading="lazy" src="${src}" style="width:100%;height:${h}px;border:1px solid var(--line,#243049);border-radius:10px;background:#07090f"></iframe>`;
export const markup = {
  nriscv: ['RISC-V IN WEIGHTS', 'A RISC-V CPU compiled into transformer weights', `<fieldset><legend>RV32I in weights ${tipq('Each forward pass of a hand-compiled transformer executes one RV32I instruction; the page checks every step against a plain-JS reference interpreter.')}</legend>${frame('nested/riscv/index.html')}</fieldset>`],
  nslm: ['SLM IN SLM', 'A language model baked into another language model', `<fieldset><legend>guest LM inside a host LM ${tipq('Weights are a float32 binary (nested/slm/models.f32, sha256-checked on load). The baked composite reproduces the standalone guest to KL ≈ 1e-16 nats.')}</legend>${frame('nested/slm/index.html')}</fieldset>`],
  nmoe: ['MoE IN MoE', 'A mixture-of-experts nested inside an expert', `<fieldset><legend>MoE within an MoE</legend>${frame('nested/moe/index.html', 640)}</fieldset>`],
  nxlens: ['NESTED LENS', 'Neuron Lens on the nested models (v14.7 / v14.8, pre-registered)', `<fieldset><legend>pre-registered results ${tipq('docs/PREREG-v14x.md §14.7–14.8. Finite-difference R.out lens from block 0 to the final residual; Test A analog on every layer-0 MLP unit.')}</legend>
<div class="r"><button class="pri" id="nxLoad">load models + results</button><span id="nxInfo" class="sm">~1.5 MB float32 weights</span></div><div id="nxRes" class="sm"></div></fieldset>
<fieldset><legend>unit reader ${tipq('Pick a layer-0 MLP unit; its write is read through the fitted lens and the chosen output head. Composite units 0–255 are the host, 256–383 the baked guest.')}</legend>
<div class="r"><label>model</label><select id="nxM"><option value="composite">baked composite</option><option value="emu1">emulator · mode 1</option><option value="emu0">emulator · mode 0</option></select><label>unit</label><input type="number" id="nxU" value="260" min="0" max="383" style="width:70px"/><label>head</label><select id="nxH"><option value="out_g">guest</option><option value="out_h">host</option></select><button id="nxRead">read</button></div>
<div id="nxOut" class="sm"></div></fieldset>`],
};
export function install(A) {
  const S = {};
  async function load() { if (S.Z) return; $('nxInfo').textContent = 'fetching…';
    const ix = await (await fetch('nested/slm/models.index.json')).json(), b = await (await fetch('nested/slm/models.f32')).arrayBuffer();
    const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map((x) => x.toString(16).padStart(2, '0')).join(''); if (h !== ix.sha256) throw new Error('models.f32 sha256 mismatch');
    S.Z = N.loadNested(ix, new Float32Array(b)); S.lens = await (await fetch('nested/slm/lens.json')).json(); S.res = await (await fetch('nested/v14x-nested.json')).json();
    const r = S.res, row = (k, x) => `<tr><td>${k}</td><td>${x.n}</td><td>${fmt(x['R.out'].medianR)}</td><td>${fmt(x['R.out'].passRate)} [${x['R.out'].passCI.map((v) => v.toFixed(3)).join(', ')}]</td><td>${fmt(x.logit.medianR)}</td><td>${fmt(x.logit.passRate)}</td><td>${x['R.out'].pass ? '✓' : '✗'}</td></tr>`;
    $('nxRes').innerHTML = `<div>float32 fidelity: max KL ${r.fidelity.maxKL.toExponential(2)} over ${r.fidelity.prompts} prompts ${r.fidelity.pass ? '✓' : '✗'}</div>
<table><tr><th>model</th><th>live units</th><th>R.out median r</th><th>R.out pass [95% CI]</th><th>logit median r</th><th>logit pass</th><th>beats null</th></tr>${row('composite', { n: r.testA.composite['R.out'].n, ...r.testA.composite })}${row('emulator mode 1', { n: r.testA.emulator_mode1['R.out'].n, ...r.testA.emulator_mode1 })}</table>
<div>C7 ${esc(r.C7.verdict)} · C8a host-sees-guest overlap ${fmt(r.C8a.medianOverlap)} vs τ99 ${fmt(r.C8a.tau99)} → ${esc(r.C8a.verdict)} · C8b emulator mode overlap ${fmt(r.C8b.medianOverlap)} vs τ99 ${fmt(r.C8b.tau99)} → ${esc(r.C8b.verdict)}</div>`;
    $('nxInfo').textContent = `✓ sha256 ${h.slice(0, 12)}…`; }
  A.on('nxLoad', 'click', () => load().catch((e) => ($('nxInfo').textContent = 'failed: ' + e.message)));
  A.on('nxRead', 'click', async () => { await load(); const k = $('nxM').value, m = S.Z.models[k === 'composite' ? 'composite' : 'emu'], J = Float64Array.from(S.lens[k === 'composite' ? 'composite' : k === 'emu1' ? 'emu_mode1' : 'emu_mode0']);
    const u = Math.min(m.cfg.dm - 1, Math.max(0, +$('nxU').value | 0)), hd = N.head(m, k === 'composite' ? $('nxH').value : null), w = N.unitWrite(m, 0, u);
    const top = (r) => [...r.keys()].sort((a, b) => r[b] - r[a]).slice(0, 8).map((i) => `<span class="chip">${esc(JSON.stringify(S.Z.vocab[i]).slice(1, -1))} ${fmt(r[i])}</span>`).join(' ');
    $('nxOut').innerHTML = `<div>out·R (lens): ${top(N.read(m, w, J, hd))}</div><div>logit lens: ${top(N.read(m, w, null, hd))}</div>`; });
}

import { createEffect, createSignal, For, onCleanup, onMount, Show, type JSX } from 'solid-js';
import { legacy } from '../core/bridge';
import { HELP, bundle, busy, err, geo, kvPoints, neu, plan, setBundle, setBusy, setErr, setGeo, setNeu, setPlan, setSyn, syn, type Plan } from '../core/adv';
import { sel, selection } from '../core/store';
import { newId, newNotebook, type Notebook } from '../core/notebook';
import { LineChart } from './Chart';
import { CONDITIONS } from '../../../src/adversary/prompts.js';

declare const __APP_VERSION__: string;
const NB_KEY = 'neuralese.v17.notebooks';
const ALL = CONDITIONS as readonly string[];

function api() { return legacy()?.adversary ?? null; }
function dl(name: string, body: string, type: string): void {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function num(x: number | null | undefined, d = 3): string { return typeof x === 'number' && Number.isFinite(x) ? x.toFixed(d) : '—'; }

function useChecks() {
  const [on, setOn] = createSignal<Record<string, boolean>>({ honest: true, deceptive: true });
  const [genTokens, setGen] = createSignal(8);
  const [nPerm, setPerm] = createSignal(200);
  const [nPairs, setPairs] = createSignal(8);
  const [magnitude, setMag] = createSignal(5);
  const chosen = (): string[] => ALL.filter((c) => c === 'honest' || on()[c]);
  const positive = (): string[] => chosen().filter((c) => c !== 'honest');
  const opts = () => ({ conditions: chosen(), positive: positive(), genTokens: genTokens(), nPerm: nPerm(), nPairs: nPairs(), magnitude: magnitude(), previous: plan()?.prereg });
  return { on, setOn, genTokens, setGen, nPerm, setPerm, nPairs, setPairs, magnitude, setMag, chosen, positive, opts };
}
const controls = useChecks();

async function lockPlan(): Promise<Plan> {
  const a = api(); if (!a) throw new Error('model bridge is not ready');
  const p = await a.plan(controls.opts());
  setPlan(p); return p;
}
async function publish(g = geo(), n = neu()): Promise<void> {
  const a = api(); const p = plan(); if (!a || !p) return;
  setBundle(await a.finish(p.prereg, g, n));
}

function Bar(p: { children: JSX.Element }): JSX.Element {
  return <div class="adv-row">{p.children}<Show when={busy()}><span class="hint">{busy()}</span></Show><Show when={err()}><span class="warn">{err()}</span></Show></div>;
}

export function AdversaryPanel(p: { id: string }): JSX.Element {
  return <div class="adv">
    <Show when={p.id === 'adv-live'}><Live /></Show>
    <Show when={p.id === 'adv-run'}><Runner /></Show>
    <Show when={p.id === 'adv-det'}><Detector /></Show>
    <Show when={p.id === 'adv-hunt'}><Hunt /></Show>
    <Show when={p.id === 'adv-steer'}><Steer /></Show>
    <Show when={p.id === 'adv-repro'}><Repro /></Show>
  </div>;
}

function Live(): JSX.Element {
  const pts = () => kvPoints();
  const a = api();
  return <>
    <h3>Live geometry</h3>
    <p class="hint">{HELP}</p>
    <p class="hint">Sampling cadence is every {a?.KV_CADENCE ?? 8} generated tokens, plus the end of the prompt and the end of generation. Beam search does not extend this sequence’s cache. The chart is the sampling path’s key cache, not a score of misalignment.</p>
    <Shipped />
    <Show when={pts().length} fallback={<p class="hint">Generate text (Ctrl/⌘+Enter). The strip fills from the engine’s key cache. Until then there is nothing to plot.</p>}>
      <LineChart title="Mean spectral entropy, effective rank, and norm per token" xLabel="cache length (tokens)" xs={pts().map((p) => p.T)} series={[
        { label: 'spectral entropy', color: '#2dd4bf', ys: pts().map((p) => p.spectral_entropy) },
        { label: 'effective rank', color: '#fbbf24', ys: pts().map((p) => p.effective_rank) },
        { label: 'norm / token', color: '#f472b6', ys: pts().map((p) => p.norm_per_token) },
      ]} />
      <p class="hint">Last point: {pts().at(-1)?.phase} · T={pts().at(-1)?.T} · entropy {num(pts().at(-1)?.spectral_entropy)} · eff. rank {num(pts().at(-1)?.effective_rank)} · norm/token {num(pts().at(-1)?.norm_per_token)}</p>
    </Show>
    <button onClick={() => { const s = api()?.synthetic(); if (s) setSyn(s); }}>Run synthetic self-test</button>
    <Show when={syn()}><p class="hint">{syn()!.note} Separable AUROC {num(syn()!.separableAuroc)}. Tied AUROC {num(syn()!.tiedAuroc)}.</p></Show>
  </>;
}

function Runner(): JSX.Element {
  onMount(() => {
    const go = (): void => { void run(); };
    document.addEventListener('neuralese:adv-run', go);
    onCleanup(() => document.removeEventListener('neuralese:adv-run', go));
  });
  const run = async (): Promise<void> => {
    setErr(''); setBusy('locking pre-registration…');
    try {
      const p = await lockPlan();
      setBusy(`running ${p.trials.length} trials on the clean TinyStories weights…`);
      const g = await api()!.runGeometry(p);
      setGeo(g); setNeu(null); await publish(g, null);
      setBusy('');
    } catch (e) { setBusy(''); setErr((e as Error).message); }
  };
  return <>
    <h3>Condition runner</h3>
    <p class="hint">Same user prompt in every arm. System lines are tokenized, then padded with one token id to equal length, and the lengths are checked again. The run uses the clean weight copy, not the hacked runtime. Default arms are honest and deceptive.</p>
    <Bar>
      <For each={ALL}>{(c) => <label class="chk"><input type="checkbox" checked={c === 'honest' || !!controls.on()[c]} disabled={c === 'honest'} onChange={(e) => controls.setOn({ ...controls.on(), [c]: e.currentTarget.checked })} />{c}</label>}</For>
    </Bar>
    <div class="adv-row">
      <label>generated tokens <input type="number" min="1" max="32" value={controls.genTokens()} onChange={(e) => controls.setGen(+e.currentTarget.value)} /></label>
      <label>permutations <input type="number" min="19" max="1000" value={controls.nPerm()} onChange={(e) => controls.setPerm(+e.currentTarget.value)} /></label>
      <button class="pri" disabled={!!busy()} onClick={() => void run()}>Lock and run</button>
    </div>
    <Show when={plan()}>{(p) => <p class="hint">Locked v{p().prereg.version} · {p().prereg.sha256.slice(0, 16)}… · {p().trials.length} trials · system length {p().trials[0]?.systemLen} tokens · full prompt {p().trials[0]?.totalLen} · FWL {p().fwl.join(', ') || 'intercept only'}</p>}</Show>
    <Show when={geo()}><p class={geo()!.verdict.label === 'null' ? 'warn' : 'hint'}><b>{geo()!.verdict.label}</b> — {geo()!.verdict.text}</p></Show>
  </>;
}

function Shipped(): JSX.Element {
  const [row, setRow] = createSignal<{ geometry?: { verdict: { label: string; text: string }; detector: { delta: { auroc: number; p: number }; encoding: { auroc: number; p: number }; lopo: { auroc: number | null } } }; neurons?: { verdict: { pass: boolean; candidateCount: number; randomCounts: number[] } }; settings?: { gen_tokens: number; n_permutations: number; prompts: number } } | null>(null);
  onMount(() => { void fetch(new URL('adversary/measured-tinystories.json', document.baseURI).href).then((r) => (r.ok ? r.json() : null)).then(setRow).catch(() => setRow(null)); });
  return <Show when={row()}>{(r) => <p class="hint">Shipped TinyStories-8M measurement (not a live recompute): geometry <b>{r().geometry?.verdict.label}</b>, in-sample delta AUROC {num(r().geometry?.detector.delta.auroc)} (p {num(r().geometry?.detector.delta.p)}), encoding AUROC {num(r().geometry?.detector.encoding.auroc)} (p {num(r().geometry?.detector.encoding.p)}), leave-one-prompt-out {num(r().geometry?.detector.lopo.auroc)}. Neuron rule {r().neurons?.verdict.pass ? 'pass' : 'fail'} ({r().neurons?.verdict.candidateCount} vs {r().neurons?.verdict.randomCounts.join(', ')}). {r().settings?.prompts} prompts, {r().settings?.gen_tokens} generated tokens, {r().settings?.n_permutations} permutations.</p>}</Show>;
}
function Detector(): JSX.Element {
  return <>
    <h3>Detector results</h3>
    <Show when={geo()} fallback={<><p class="hint">No run yet. The condition runner fills this panel. Numbers below are from this model and this prompt set only.</p><Shipped /></>}>
      {(g) => <>
        <p class={g().verdict.label === 'above-chance' ? 'hint' : 'warn'}><b>{g().verdict.label}</b> — {g().verdict.text}</p>
        <table>
          <thead><tr><th>readout</th><th>AUROC</th><th>add-one p</th><th>paper fraction</th></tr></thead>
          <tbody>
            <tr><td>delta features (in-sample)</td><td>{num(g().detector.delta.auroc)}</td><td>{num(g().detector.delta.p)}</td><td>{num(g().detector.delta.p_paper)}</td></tr>
            <tr><td>encoding phase (leakage check)</td><td>{num(g().detector.encoding.auroc)}</td><td>{num(g().detector.encoding.p)}</td><td>{num(g().detector.encoding.p_paper)}</td></tr>
            <tr><td>leave-one-prompt-out</td><td>{num(g().detector.lopo.auroc)}</td><td colSpan={2}>{g().detector.lopo.reason ?? `${g().detector.lopo.n} scored trials`}</td></tr>
          </tbody>
        </table>
        <p class="hint">FWL covariates requested: {g().fwl.names.join(', ') || 'none'}. Dropped because they did not vary: {g().fwl.droppedConstant}. Kept column indexes (0 is the first covariate, intercept is always fit): {g().fwl.kept.join(', ') || 'none'}.</p>
        <p class="hint">{g().compliance.note}</p>
        <For each={g().caveats}>{(c) => <p class="hint">{c}</p>}</For>
        <table>
          <thead><tr><th>prompt</th><th>condition</th><th>T</th><th>gen</th><th>completion</th></tr></thead>
          <tbody><For each={g().rows}>{(r) => <tr><td>{r.promptId}</td><td>{r.condition}</td><td>{r.T}</td><td>{r.T_gen}</td><td>{r.text || '—'}</td></tr>}</For></tbody>
        </table>
      </>}
    </Show>
  </>;
}

function Hunt(): JSX.Element {
  onMount(() => {
    const go = (): void => { void run(); };
    document.addEventListener('neuralese:adv-hunt', go);
    onCleanup(() => document.removeEventListener('neuralese:adv-hunt', go));
  });
  const run = async (): Promise<void> => {
    setErr(''); setBusy('ranking units on the clean model…');
    try {
      const prev = plan()?.prereg.sha256;
      const p = await lockPlan();
      const g = prev === p.prereg.sha256 ? geo() : null;
      if (g === null) setGeo(null);
      const n = await api()!.runNeurons(p);
      setNeu(n);
      const top = n.top[0]; if (top) { try { selection.set({ layer: top.layer, neuron: top.neuron }); } catch { /* out of the shell bounds */ } }
      await publish(g, n);
      setBusy('');
    } catch (e) { setBusy(''); setErr((e as Error).message); }
  };
  const selected = (layer: number, neuron: number): boolean => sel().layer === layer && sel().neuron === neuron;
  return <>
    <h3>Neuron hunt</h3>
    <p class="hint">Mean MLP activation on the equal-length prompts. Score is Cohen’s d of the positive arms minus honest. Click a row to select that unit everywhere else. {neu()?.caveat ?? 'Activation is not intent.'}</p>
    <Bar>
      <label>random sets <input type="number" min="2" max="20" value={controls.nPairs()} onChange={(e) => controls.setPairs(+e.currentTarget.value)} /></label>
      <label>push <input type="number" step="0.5" value={controls.magnitude()} onChange={(e) => controls.setMag(+e.currentTarget.value)} /></label>
      <button class="pri" disabled={!!busy()} onClick={() => void run()}>Hunt and steer</button>
    </Bar>
    <Show when={neu()} fallback={<p class="hint">No hunt yet. This also runs the steering comparison, because the pass rule needs the random sets.</p>}>
      {(n) => <table>
        <thead><tr><th></th><th>layer</th><th>neuron</th><th>d</th><th>mean +</th><th>mean honest</th></tr></thead>
        <tbody><For each={n().top}>{(u) => <tr classList={{ on: selected(u.layer, u.neuron) }} onClick={() => { try { selection.set({ layer: u.layer, neuron: u.neuron }); } catch (e) { setErr((e as Error).message); } }}>
          <td>{n().candidate.some((c) => c.layer === u.layer && c.neuron === u.neuron) ? 'pair' : ''}</td>
          <td>{u.layer}</td><td>{u.neuron}</td><td>{num(u.d, 2)}</td><td>{num(u.meanPos, 2)}</td><td>{num(u.meanNeg, 2)}</td>
        </tr>}</For></tbody>
      </table>}
    </Show>
  </>;
}

function Steer(): JSX.Element {
  return <>
    <h3>Steering compare</h3>
    <p class="hint">The candidate is the two units with the largest positive d. Each arm adds the same amount to those activations while the clean model writes a short greedy continuation of the user line. A pass requires more word-list hits that are also coherent than every random pair. Coherence is length, variety, and not looping. This does not measure intent.</p>
    <Show when={neu()} fallback={<p class="hint">Run the neuron hunt. The comparison is stored with it.</p>}>
      {(n) => <>
        <p class={n().verdict.pass ? 'hint' : 'warn'}><b>{n().verdict.pass ? 'pass' : 'fail'}</b> — {n().verdict.text}</p>
        <p class="hint">Candidate L{n().candidate.map((u) => `${u.layer}.${u.neuron}`).join(' + L')} · push {n().magnitude} · evil+coherent {n().verdict.candidateCount} of {n().verdict.n}</p>
        <table>
          <thead><tr><th>arm</th><th>units</th><th>evil+coherent</th></tr></thead>
          <tbody>
            <tr><td>candidate</td><td>{n().candidate.map((u) => `L${u.layer}N${u.neuron}`).join(', ')}</td><td>{n().verdict.candidateCount}</td></tr>
            <For each={n().random}>{(r, i) => <tr><td>random {i() + 1}</td><td>{r.units.map((u) => `L${u.layer}N${u.neuron}`).join(', ')}</td><td>{r.evilCoherent}</td></tr>}</For>
          </tbody>
        </table>
      </>}
    </Show>
  </>;
}

function Repro(): JSX.Element {
  const [msg, setMsg] = createSignal('');
  createEffect(() => { bundle(); setMsg(''); });
  const pin = (): void => {
    const b = bundle(); if (!b?.notebook_markdown) { setMsg('Run a campaign first.'); return; }
    try {
      const nb: Notebook = { ...newNotebook('Adversary Lab', { app: __APP_VERSION__, commit: null, weightsSha256: null, preregSha256: b.prereg_sha256, bundleSha256: b.bundle_sha256, prompt: '' }), cells: [{ id: newId(), kind: 'md', text: b.notebook_markdown }, { id: newId(), kind: 'repro' }] };
      const prev = JSON.parse(localStorage.getItem(NB_KEY) ?? '[]') as string[];
      prev.push(JSON.stringify(nb)); localStorage.setItem(NB_KEY, JSON.stringify(prev));
      setMsg('Pinned a notebook. Open Experiments → Notebook.');
    } catch (e) { setMsg((e as Error).message); }
  };
  return <>
    <h3>Prereg and REPRO</h3>
    <p class="hint">The lock happens before the forward passes. Editing the options and running again keeps the lock when the plan is unchanged, and opens a new version when it is not. Assignment into a locked object throws.</p>
    <Show when={plan()} fallback={<p class="hint">No lock yet.</p>}>
      {(p) => <>
        <p class="hint">v{p().prereg.version} · {p().prereg.sha256}</p>
        <pre class="repro">{p().prereg.hypothesis}</pre>
        <div class="adv-row">
          <button onClick={() => dl('adversary-prereg.json', JSON.stringify(p().prereg, null, 2), 'application/json')}>Download prereg JSON</button>
          <button onClick={() => dl('adversary-prereg.yaml', p().yaml, 'application/yaml')}>Download prereg YAML</button>
        </div>
      </>}
    </Show>
    <Show when={bundle()}>{(b) => <div class="adv-row">
      <button onClick={() => dl('adversary-repro.json', JSON.stringify(b(), null, 2), 'application/json')}>Download REPRO bundle</button>
      <button onClick={pin}>Pin to notebook</button>
      <span class="hint">bundle {b().bundle_sha256.slice(0, 16)}…</span>
    </div>}</Show>
    <Show when={msg()}><p class="hint">{msg()}</p></Show>
    <Show when={geo()?.caveats}>{(c) => <For each={c()}>{(line) => <p class="hint">{line}</p>}</For>}</Show>
  </>;
}

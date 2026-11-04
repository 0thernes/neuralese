import { createEffect, createMemo, createSignal, For, getOwner, onCleanup, onMount, runWithOwner, Show, type JSX } from 'solid-js';
import { legacy } from '../core/bridge';
import { sel, selection, traceTick, theme } from '../core/store';
import { cosmosData, topNeurons, type CosmosData } from '../core/cosmos-data';
import { newNotebook, parseNotebook, drift, toHTML, newId, type Notebook, type Cell, type Fingerprint, type Source } from '../core/notebook';
import { LineChart } from './Chart';
import { VirtualTable } from './VirtualTable';

const $ = (id: string): HTMLElement | null => document.getElementById(id);
export const activeLegacy = new Set<string>();
// Re-parent an existing legacy DOM subtree into this panel; it goes back to a hidden parking lot on unmount so its
// event handlers and state survive layout changes.
function Adopt(p: { id: string; onShow?: () => void; class?: string }): JSX.Element {
  let host!: HTMLDivElement;
  onMount(() => { const el = $(p.id); if (el) { host.appendChild(el); p.onShow?.(); } });
  onCleanup(() => { const el = $(p.id); if (el && host.contains(el)) $('v17-park')?.appendChild(el); });
  return <div class={p.class ?? 'adopt'} ref={host} />;
}
const STAGE_TABS = new Set(['viz', 'v3d']);
// The pre-v17 WebGL stage (bloom, depth of field, adaptive tier) draws on #gl. The v17 shell used to
// hide that canvas. While a 3D tab is mounted, the canvas fills the panel and resizes with it.
function dockStage(host: HTMLDivElement): () => void {
  const gl = document.getElementById('gl');
  if (!gl) return () => {};
  host.appendChild(gl);
  gl.classList.add('docked');
  const fit = (): void => { window.dispatchEvent(new Event('resize')); };
  const ro = new ResizeObserver(fit);
  ro.observe(host);
  fit();
  return () => { ro.disconnect(); gl.classList.remove('docked'); const park = $('v17-park'); if (park) park.appendChild(gl); };
}
export function LegacyPanel(p: { k: string }): JSX.Element {
  let stage!: HTMLDivElement;
  onMount(() => { activeLegacy.add(p.k); });
  onCleanup(() => { activeLegacy.delete(p.k); });
  onMount(() => { if (STAGE_TABS.has(p.k) && stage) { const undock = dockStage(stage); onCleanup(undock); } });
  return <div class="legacy-stack" classList={{ stage: STAGE_TABS.has(p.k) }}>
    <Show when={STAGE_TABS.has(p.k)}><div class="stage-host" ref={stage} data-feature="feature-view-stage" /></Show>
    <Adopt id={`pane_${p.k}`} class="adopt legacy-pane" onShow={() => showLegacy(p.k)} />
  </div>;
}
// legacy showTab(k) runs the tab's lazy renderers but makes k the only `.on` pane; restore every visible panel after.
let showing = false;
export function showLegacy(k: string): void {
  const lg = legacy(); if (!lg) return; showing = true;
  try { lg.showTab(k); } catch (e) { console.warn(e); } finally { showing = false; }
  for (const a of activeLegacy) $(`pane_${a}`)?.classList.add('on');
}
export const isShowing = (): boolean => showing;
export function OutputPanel(): JSX.Element { return <Adopt id="out" class="adopt out-host" />; }

export function SelectionPanel(): JSX.Element {
  const lg = legacy(); const c = lg?.cfg ?? { L: 8, H: 16, ff: 1024 };
  const set = (patch: Parameters<typeof selection.set>[0]): void => { try { selection.set(patch); } catch (e) { console.warn(e); } };
  const toks = createMemo(() => { traceTick(); return legacy()?.lastIds ?? []; });
  return (
    <div class="selp">
      <div class="selrow">
        <label>layer <input type="number" min="0" max={c.L - 1} value={sel().layer} onChange={(e) => { const n = +e.currentTarget.value; if (Number.isInteger(n)) set({ layer: n }); }} /></label>
        <label>head <input type="number" min="0" max={c.H - 1} value={sel().head ?? ''} placeholder="–" onChange={(e) => { if (e.currentTarget.value === '') { set({ head: null }); return; } const n = +e.currentTarget.value; if (Number.isInteger(n)) set({ head: n }); }} /></label>
        <label>neuron <input type="number" min="0" max={c.ff - 1} value={sel().neuron ?? ''} placeholder="–" onChange={(e) => { if (e.currentTarget.value === '') { set({ neuron: null }); return; } const n = +e.currentTarget.value; if (Number.isInteger(n)) set({ neuron: n }); }} /></label>
        <label>token <select value={sel().token ?? ''} onChange={(e) => set({ token: e.currentTarget.value === '' ? null : +e.currentTarget.value })}><option value="">last</option><For each={toks()}>{(id, i) => <option value={i()}>{i()}: {JSON.stringify(legacy()?.tok?.tokenStr(id) ?? String(id))}</option>}</For></select></label>
      </div>
      <p class="hint">One selection drives every panel (cosmos, inspector, lens, attention). Model: {sel().model}.</p>
      <Adopt id="dock2" class="adopt insp-host" />
    </div>
  );
}

const cssVar = (n: string): string => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#0b0f14';
export function CosmosPanel(): JSX.Element {
  let host!: HTMLDivElement; const [status, setStatus] = createSignal('starting renderer…'); const [lod, setLod] = createSignal(''); const [hover, setHover] = createSignal('');
  const [data, setData] = createSignal<CosmosData | null>(null);
  const owner = getOwner();
  onMount(async () => {
    try {
      const [{ createStage }, { createCosmos }] = await Promise.all([import('../three/stage'), import('../three/cosmos')]);
      const st = await createStage(host, () => cssVar('--c-bg')); const cfg = legacy()?.cfg ?? { L: 8, H: 16, ff: 1024, d: 256 };
      const cos = createCosmos(st, cfg.L, cfg.H, cfg.ff); st.focus({ x: 0, y: cfg.L * 2, z: 0 } as never, 46);
      runWithOwner(owner, () => {
      const refresh = (): void => { const tr = legacy()?.lastTraces ?? []; const c = cosmosData(tr, { L: cfg.L, H: cfg.H, ff: cfg.ff, d: cfg.d }, sel().token ?? tr.length - 1); setData(c); cos.update(c, theme() === 'light'); };
      createEffect(() => { traceTick(); theme(); sel().token; refresh(); });
      createEffect(() => { const s = sel(); cos.select(s.layer, s.head, s.neuron, true); });
      st.onFrame(() => setLod(cos.lod()));
      const cv = st.renderer.domElement;
      cv.addEventListener('click', (e) => { const hit = st.pick(e as PointerEvent, cos.pickables()); if (!hit) return; const tk = (hit.object.userData as { token?: number }).token; if (tk != null) { selection.set({ token: tk }); return; } const d = cos.decode(hit); if (d) selection.set({ layer: d.layer, head: d.head ?? null, neuron: d.neuron ?? null }); });
      cv.addEventListener('pointermove', (e) => { const hit = st.pick(e, cos.pickables()); const d = hit && cos.decode(hit); const c = data(); setHover(d && c ? (d.neuron != null ? `L${d.layer} N${d.neuron} act ${c.neurons[d.layer * c.ff + d.neuron]!.toFixed(3)}` : `L${d.layer} H${d.head} ‖z‖ ${c.heads[d.layer * c.H + d.head!]!.toFixed(3)}`) : ''); });
      setStatus(`${st.backend} · GPU tier ${st.tier}`);
      onCleanup(() => st.dispose());
      });
    } catch (e) { console.warn(e); setStatus('3D unavailable: ' + (e as Error).message); }
  });
  return (
    <div class="cosmos">
      <div class="cosmos-stage" ref={host} aria-label="model cosmos: drag to orbit, wheel or +/- to zoom, click a unit to select it" />
      <div class="cosmos-hud" aria-live="polite"><b>Model cosmos</b> · {status()} · zoom: {lod()}<Show when={hover()}> · {hover()}</Show>
        <Show when={data()} fallback={<div class="warn">No trace yet: generate text (Ctrl/⌘+Enter) and the strata fill with that run's real activations.</div>}>
          {(c) => <div>token {c().token + 1}/{c().T} · neurons (grid): MLP activation · heads (ring): ‖head output‖ · ribbons: ‖residual‖ per token (gold = selected)</div>}
        </Show>
      </div>
    </div>
  );
}

export function NestedPanel(): JSX.Element {
  let host!: HTMLDivElement; const [info, setInfo] = createSignal('choose an experiment'); const [which, setWhich] = createSignal<'riscv' | 'slm' | 'moe'>('moe');
  const owner = getOwner();
  onMount(async () => {
    try {
      const [{ createStage }, N] = await Promise.all([import('../three/stage'), import('../three/nested')]);
      const st = await createStage(host, () => cssVar('--c-bg'));
      runWithOwner(owner, () => createEffect(async () => { const w = which(); setInfo('loading ' + w + '…'); try { const r = w === 'riscv' ? await N.riscv() : w === 'slm' ? await N.slm() : await N.moe(); N.mount(st, r); setInfo(r.info); } catch (e) { setInfo('✖ ' + (e as Error).message); } }));
      runWithOwner(owner, () => onCleanup(() => st.dispose()));
    } catch (e) { setInfo('3D unavailable: ' + (e as Error).message); }
  });
  return (
    <div class="cosmos">
      <div class="seg" role="radiogroup" aria-label="nested experiment">
        <For each={[['riscv', 'RISC-V in a transformer'], ['slm', 'SLM-in-SLM'], ['moe', 'MoE-in-MoE']] as const}>{([k, t]) => <button role="radio" aria-checked={which() === k} classList={{ on: which() === k }} onClick={() => setWhich(k)}>{t}</button>}</For>
      </div>
      <div class="cosmos-stage" ref={host} aria-label="nested experiment 3D view" />
      <div class="cosmos-hud" aria-live="polite">{info()}</div>
    </div>
  );
}

const NB_KEY = 'neuralese.v17.notebooks';
async function fingerprint(): Promise<Fingerprint> {
  let commit: string | null = null; try { commit = ((await (await fetch(new URL('build.json', document.baseURI))).json()) as { commit: string | null }).commit; } catch { /* dev */ }
  const w = ($('wHash')?.textContent ?? '').match(/[0-9a-f]{16,}/)?.[0] ?? null;
  return { app: __APP_VERSION__, commit, weightsSha256: w, preregSha256: null, bundleSha256: null, prompt: ($('prompt') as HTMLTextAreaElement | null)?.value ?? '' };
}
declare const __APP_VERSION__: string;
export function NotebookPanel(): JSX.Element {
  const load = (): Notebook[] => { try { return (JSON.parse(localStorage.getItem(NB_KEY) ?? '[]') as string[]).map((s) => parseNotebook(s)); } catch { return []; } };
  const [books, setBooks] = createSignal<Notebook[]>(load()); const [cur, setCur] = createSignal(0); const [now, setNow] = createSignal<Fingerprint | null>(null); const [msg, setMsg] = createSignal('');
  const save = (b: Notebook[]): void => { setBooks(b); try { localStorage.setItem(NB_KEY, JSON.stringify(b.map((x) => JSON.stringify(x)))); } catch { /* quota */ } };
  const nb = (): Notebook | undefined => books()[cur()];
  const edit = (f: (n: Notebook) => Notebook): void => { const b = books().slice(); const n = b[cur()]; if (!n) return; b[cur()] = f(n); save(b); };
  onMount(async () => setNow(await fingerprint()));
  const data = createMemo(() => { traceTick(); const tr = legacy()?.lastTraces ?? []; const cfg = legacy()?.cfg; return cfg ? cosmosData(tr, cfg, sel().token ?? tr.length - 1) : null; });
  const canv: Record<string, HTMLCanvasElement | null> = {};
  const chartOf = (c: Extract<Cell, { kind: 'chart' }>): JSX.Element => {
    const d = data(); if (!d) return <p class="warn">No trace yet: generate text first; this cell recomputes from the live run.</p>;
    if (c.source === 'resid') return <LineChart title="‖residual‖ per token (embed → each layer)" xLabel="token" xs={[...Array(d.T).keys()]} series={[...Array(d.L + 1).keys()].map((r) => ({ label: r ? `L${r - 1} out` : 'embed', color: `hsl(${(r * 40) % 360} 70% 55%)`, ys: [...Array(d.T).keys()].map((t) => d.resid[r * d.T + t]!) }))} ref={(x) => (canv[c.id] = x)} />;
    if (c.source === 'heads') return <LineChart title={`‖head output‖ per head, layer ${c.layer}, token ${d.token}`} xLabel="head" xs={[...Array(d.H).keys()]} series={[{ label: `L${c.layer}`, color: '#f59e0b', ys: [...Array(d.H).keys()].map((h) => d.heads[c.layer * d.H + h]!) }]} ref={(x) => (canv[c.id] = x)} />;
    return <LineChart title={`MLP activation per neuron, layer ${c.layer}, token ${d.token}`} xLabel="neuron" xs={[...Array(d.ff).keys()]} series={[{ label: `L${c.layer}`, color: '#22d3ee', ys: Array.from(d.neurons.subarray(c.layer * d.ff, (c.layer + 1) * d.ff)) }]} ref={(x) => (canv[c.id] = x)} />;
  };
  const dl = (name: string, body: string, type: string): void => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
  const attachBundle = async (f: File): Promise<void> => {
    try { const b = JSON.parse(await f.text()) as { bundle_sha256?: string; prereg_sha256?: string }; const P = (await import(/* @vite-ignore */ new URL('prereg.js', document.baseURI).href)) as { verifyBundle(b: unknown): Promise<{ ok: boolean; problems: string[] }> };
      const v = await P.verifyBundle(b); edit((n) => ({ ...n, pin: { ...n.pin, bundleSha256: b.bundle_sha256 ?? null, preregSha256: b.prereg_sha256 ?? null } })); setMsg(v.ok ? '✔ REPRO bundle verified and pinned' : '✖ bundle failed verification: ' + v.problems.join('; '));
    } catch (e) { setMsg('✖ ' + (e as Error).message); }
  };
  return (
    <div class="nb">
      <div class="nbbar">
        <select aria-label="notebook" value={cur()} onChange={(e) => setCur(+e.currentTarget.value)}><For each={books()}>{(b, i) => <option value={i()}>{b.title}</option>}</For></select>
        <button onClick={async () => { save([...books(), newNotebook(`Experiment ${books().length + 1}`, await fingerprint())]); setCur(books().length - 1); }}>+ new notebook</button>
        <Show when={nb()}>{(n) => <>
          <button onClick={() => edit((x) => ({ ...x, cells: [...x.cells, { id: newId(), kind: 'md', text: '' }] }))}>+ text</button>
          <button onClick={() => edit((x) => ({ ...x, cells: [...x.cells, { id: newId(), kind: 'chart', source: 'heads', layer: sel().layer }] }))}>+ chart</button>
          <button onClick={() => edit((x) => ({ ...x, cells: [...x.cells, { id: newId(), kind: 'table', layer: sel().layer }] }))}>+ table</button>
          <label class="file">attach REPRO bundle<input type="file" accept=".json" onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) void attachBundle(f); }} /></label>
          <button onClick={() => dl(`${n().title}.notebook.json`, JSON.stringify(n(), null, 2), 'application/json')}>export .json</button>
          <button onClick={() => { const im: Record<string, string> = {}; for (const [k, c] of Object.entries(canv)) if (c) im[k] = c.toDataURL('image/png'); dl(`${n().title}.html`, toHTML(n(), im), 'text/html'); }}>export report</button>
        </>}</Show>
        <label class="file">import<input type="file" accept=".json" onChange={async (e) => { const f = e.currentTarget.files?.[0]; if (!f) return; try { save([...books(), parseNotebook(await f.text())]); setCur(books().length - 1); } catch (x) { setMsg('✖ ' + (x as Error).message); } }} /></label>
      </div>
      <Show when={msg()}><p class="hint" role="status">{msg()}</p></Show>
      <Show when={nb()} fallback={<p class="hint">Notebooks turn an experiment into a reproducible document: text, live charts and tables computed from the current run, pinned to the weights hash, app version and commit, optionally tied to a pre-registration REPRO bundle.</p>}>{(n) => <>
        <input class="nbtitle" aria-label="notebook title" value={n().title} onChange={(e) => edit((x) => ({ ...x, title: e.currentTarget.value }))} />
        <Show when={now() && drift(n().pin, now()!).length}><p class="warn">⚠ {drift(n().pin, now()!).join(' · ')}: charts show the current state, not the pinned one.</p></Show>
        <For each={n().cells}>{(c) => (
          <section class="cell">
            <div class="cellbar"><span>{c.kind}</span>
              <Show when={c.kind === 'chart' || c.kind === 'table'}><label>layer <input type="number" min="0" max="7" value={(c as { layer: number }).layer} onChange={(e) => edit((x) => ({ ...x, cells: x.cells.map((y) => (y.id === c.id ? { ...y, layer: +e.currentTarget.value } as Cell : y)) }))} /></label></Show>
              <Show when={c.kind === 'chart'}><select aria-label="chart source" value={(c as { source: Source }).source} onChange={(e) => edit((x) => ({ ...x, cells: x.cells.map((y) => (y.id === c.id ? { ...y, source: e.currentTarget.value as Source } as Cell : y)) }))}><option value="resid">residual norms</option><option value="heads">head outputs</option><option value="neurons">neuron activations</option></select></Show>
              <button aria-label="delete cell" onClick={() => edit((x) => ({ ...x, cells: x.cells.filter((y) => y.id !== c.id) }))}>✕</button></div>
            {c.kind === 'md' ? <textarea aria-label="text cell" value={c.text} onChange={(e) => edit((x) => ({ ...x, cells: x.cells.map((y) => (y.id === c.id ? { ...y, text: e.currentTarget.value } : y)) }))} />
              : c.kind === 'chart' ? chartOf(c)
              : c.kind === 'table' ? (data() ? <VirtualTable label={`neurons of layer ${c.layer} by |activation|`} rows={topNeurons(data()!, c.layer)} cols={[{ h: 'neuron', f: (r) => r.n }, { h: 'activation', f: (r) => r.v.toFixed(4) }]} onRow={(r) => selection.set({ layer: c.layer, neuron: r.n })} /> : <p class="warn">No trace yet.</p>)
              : <pre class="repro">{JSON.stringify(n().pin, null, 2)}</pre>}
          </section>)}</For>
      </>}</Show>
    </div>
  );
}

import { createEffect, createMemo, createSignal, For, getOwner, onCleanup, onMount, runWithOwner, Show, type JSX } from 'solid-js';
import { CHAPTERS } from '../../../src/walk/chapters.js';
import { CMOS_BANNER, assessInverter, cmosParams, type CmosParams, type InverterReport } from '../../../src/walk/cmos.js';
import { lowerForge, significandProduct, vmOperands, type ForgeGate, type SigProduct } from '../../../src/walk/forgealu.js';
import { legacy } from '../core/bridge';
import { forgeCursor, forgeRun } from '../core/forge';
import { sel, selection, theme } from '../core/store';
import { faultReport, opAt, setFaultReport, setWalkBusy, setWalkCell, setWalkCurve, setWalkErr, setWalkHead, setWalkOp, setWalkPlaying, setWalkPrompt, setWalkView, setWalkZoom, visibleOps, walkBusy, walkCell, walkCurve, walkErr, walkHead, walkOp, walkPlaying, walkPrompt, walkView, walkZoom, ZOOMS, type WalkCell, type Zoom } from '../core/walk';

const ZOOM_LABEL: Record<Zoom, string> = {
  model: 'Model', layer: 'Layer', unit: 'Head / neuron', matmul: 'Matmul', dot: 'Dot product', float: 'Float', gates: 'Gates', voltage: 'Voltage',
};

function fmtDelay(s: number | null): string { return s == null ? '—' : (s * 1e12).toFixed(1) + ' ps'; }
function num(v: number | null | undefined, d = 4): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e4)) return v.toExponential(2);
  return v.toFixed(d);
}

async function runForward(fault?: { site: string; layer: number; bit: number; mode: string; indices: number[] }): Promise<void> {
  const lg = legacy();
  if (!lg?.deepWalk) { setWalkErr('The engine is not on the page yet.'); return; }
  setWalkErr(''); setWalkBusy(fault ? 'flipping the stated bits and running the forward again…' : 'running one forward on the clean TinyStories weights…');
  try {
    const cap = innerWidth < 760 ? 32 : 48;
    const token = sel().token;
    const view = await lg.deepWalk(walkPrompt(), { token, cap, fault: fault ?? null, edited: false });
    setWalkView(view);
    setWalkOp(0);
    try { selection.set({ model: view.model, prompt: walkPrompt(), token: view.token }); } catch { /* bounds */ }
  } catch (e) { setWalkErr((e as Error).message); }
  finally { setWalkBusy(''); }
}

export function WalkPanel(p: { id: string }): JSX.Element {
  return <div class="adv walk">
    <Show when={p.id === 'walk-stage'}><Stage /></Show>
    <Show when={p.id === 'walk-read'}><Read /></Show>
    <Show when={p.id === 'walk-cell'}><Cell /></Show>
    <Show when={p.id === 'walk-zoom'}><ZoomPanel /></Show>
    <Show when={p.id === 'walk-fault'}><Fault /></Show>
    <Show when={p.id === 'walk-forge'}><ForgeLink /></Show>
  </div>;
}

function Stage(): JSX.Element {
  let host!: HTMLDivElement;
  const [hud, setHud] = createSignal('starting renderer…');
  const op = createMemo(() => opAt(walkView(), walkHead(), walkOp()));
  const owner = getOwner();
  onMount(() => {
    let sig = '';
    void (async () => {
      try {
        const [{ createStage }, { createWalk }] = await Promise.all([import('../three/stage'), import('../three/walk')]);
        const st = await createStage(host, () => getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim() || '#070a12');
        const scene = createWalk(st);
        if (owner) runWithOwner(owner, () => {
          createEffect(() => {
            const view = walkView();
            if (!view) return;
            const current = op();
            const zoom = walkZoom();
            const cell = walkCell();
            const curve = walkCurve();
            const gates = zoom === 'gates' ? gateBoxes(cell) : null;
            scene.show(view, zoom, current, cell, gates, zoom === 'voltage' ? curve : null, theme() === 'light');
            const aim = scene.aim();
            const next = `${zoom}:${current?.id}:${cell?.opId}:${cell?.index}:${gates?.length ?? 0}:${curve?.length ?? 0}`;
            if (next !== sig) { sig = next; st.focus(aim.at, aim.dist); }
            setHud(`${st.backend} · ${ZOOM_LABEL[zoom]} · ${current ? `${current.title} · ${current.note}` : 'model'}`);
          });
          onCleanup(() => { scene.dispose(); st.dispose(); });
        });
        st.renderer.domElement.addEventListener('pointermove', (e) => {
          const hit = st.pick(e, scene.pickables());
          const d = hit && scene.decode(hit);
          const current = op();
          if (!d || !current) return;
          if (walkZoom() === 'matmul' || walkZoom() === 'unit' || walkZoom() === 'dot') {
            void legacy()?.deepCell?.(current.id, d.index, walkZoom() === 'dot' ? d.index : null)?.then((c) => { if (c) setWalkCell(c); });
          }
        });
        setHud(`${st.backend} · drag to orbit, wheel to zoom`);
      } catch (e) { setHud('3D unavailable: ' + (e as Error).message); }
    })();
  });
  return <div class="cosmos">
    <div class="cosmos-stage" ref={host} aria-label="deep walk: drag to orbit, wheel to zoom, hover a block for its arithmetic" />
    <div class="cosmos-hud" aria-live="polite"><b>Deep walk</b> · {hud()}
      <Show when={walkView()} fallback={<div>Type a prompt and run one forward. The blocks are that run’s tensors.</div>}>
        {(v) => <div>{v().model} · {v().where || 'engine'} · token {v().token + 1}/{v().ids.length} {v().pieces?.[v().token] ?? ''} · greedy next {v().greedy ?? v().argmax} · logits {v().logitCount}{v().logitGap ? ` · CPU matvec vs Engine.logits max |Δ| ${num(v().logitGap, 2)}` : ''}</div>}
      </Show>
    </div>
  </div>;
}

function gateBoxes(cell: WalkCell | null): { id: number; op: string; y: number }[] | null {
  if (cell?.term) {
    const sig = significandProduct(cell.term.w, cell.term.x, { limit: 48 });
    if (sig.ok && sig.shown && sig.shown.length) return sig.shown;
  }
  return lowerForge('ADD', 3, 5, { limit: 48 }).shown ?? null;
}

function Read(): JSX.Element {
  const ops = createMemo(() => visibleOps(walkView(), walkHead()));
  const current = createMemo(() => opAt(walkView(), walkHead(), walkOp()));
  const chapter = createMemo(() => CHAPTERS.find((c) => c.id === (current()?.chapter || (walkZoom() === 'float' ? 'float' : walkZoom() === 'gates' ? 'gates' : walkZoom() === 'voltage' ? 'voltage' : 'embed'))) || CHAPTERS[0]!);
  onMount(() => {
    const go = (): void => { void runForward(); };
    document.addEventListener('neuralese:walk-run', go);
    const id = setInterval(() => {
      if (!walkPlaying()) return;
      const n = visibleOps(walkView(), walkHead()).length;
      if (n) setWalkOp((walkOp() + 1) % n);
    }, 1500);
    onCleanup(() => { clearInterval(id); document.removeEventListener('neuralese:walk-run', go); });
  });
  createEffect(() => {
    const op = current();
    const head = sel().head;
    if (head != null && head !== walkHead()) setWalkHead(head);
    if (!op) return;
    const index = op.indices[Math.min(op.indices.length - 1, Math.max(0, op.indices.indexOf(sel().neuron ?? -1) >= 0 ? (sel().neuron as number) : op.indices[0]!))] ?? op.indices[0] ?? 0;
    void legacy()?.deepCell?.(op.id, index, null)?.then((c) => { if (c) setWalkCell(c); });
    if (op.layer != null && op.layer !== sel().layer) {
      try { selection.set({ layer: op.layer, head: op.head ?? sel().head }); } catch { /* */ }
    }
  });
  return <>
    <h3>Walk</h3>
    <p class="hint">One forward pass of the loaded model. Every block is a tensor from that pass. Large blocks are sampled, and the line under the picture says so.</p>
    <label class="hint">prompt <input aria-label="walk prompt" value={walkPrompt()} onInput={(e) => setWalkPrompt(e.currentTarget.value)} /></label>
    <div class="adv-row">
      <button class="pri" disabled={!!walkBusy()} onClick={() => void runForward()}>Run forward</button>
      <button disabled={!ops().length} onClick={() => setWalkPlaying(!walkPlaying())}>{walkPlaying() ? 'Pause' : 'Play'}</button>
      <button disabled={!ops().length} onClick={() => setWalkOp((walkOp() + ops().length - 1) % ops().length)}>Step back</button>
      <button disabled={!ops().length} onClick={() => setWalkOp((walkOp() + 1) % ops().length)}>Step</button>
    </div>
    <Show when={ops().length}>
      <label class="hint">operation
        <input type="range" min="0" max={Math.max(0, ops().length - 1)} value={Math.min(walkOp(), ops().length - 1)} onInput={(e) => { setWalkPlaying(false); setWalkOp(+e.currentTarget.value); }} />
        {Math.min(walkOp(), ops().length - 1) + 1}/{ops().length}
      </label>
    </Show>
    <Show when={walkBusy()}><p class="hint">{walkBusy()}</p></Show>
    <Show when={walkErr()}><p class="warn">{walkErr()}</p></Show>
    <article>
      <h3>{chapter().title}</h3>
      <p>{chapter().text}</p>
      <Show when={current()}>{(o) => <p class="hint">{o().title} · shape [{o().length}] · {o().note}{o().head != null ? ` · head ${o().head}` : ''}</p>}</Show>
    </article>
    <div class="adv-row">
      <For each={CHAPTERS.slice(0, 9)}>{(c) => <button onClick={() => { const i = ops().findIndex((o) => o.chapter === c.id && (o.layer == null || o.layer === sel().layer)); if (i >= 0) { setWalkPlaying(false); setWalkOp(i); } }}>{c.title}</button>}</For>
    </div>
    <Show when={walkView()?.archNote}><p class="hint">{walkView()!.archNote}</p></Show>
  </>;
}

function Cell(): JSX.Element {
  const c = walkCell;
  return <>
    <h3>Cell</h3>
    <Show when={c()} fallback={<p class="hint">Run a forward, then hover a block or step to an operation. The lines are the arithmetic that produced the stored float32 value.</p>}>
      {(cell) => <>
        <p class="hint">{cell().opId}[{cell().index}] · recorded {num(cell().recorded)} · recomputed {num(cell().value)}{cell().gap != null ? ` · |Δ| ${num(cell().gap, 3)}` : ''}</p>
        <p><b>{cell().formula}</b></p>
        <For each={cell().lines}>{(line) => <p class="hint">{line}</p>}</For>
        <Show when={cell().terms.length}>
          <table>
            <thead><tr><th>j</th><th>weight</th><th>input</th><th>product</th></tr></thead>
            <tbody><For each={cell().terms}>{(t) => <tr classList={{ on: cell().term?.j === t.j }}><td>{t.j}</td><td>{num(t.w)}</td><td>{num(t.x)}</td><td>{num(t.prod)}</td></tr>}</For></tbody>
          </table>
          <p class="hint">{cell().termsShown ?? cell().terms.length} terms listed{cell().nTerms ? ` of ${cell().nTerms}` : ''}. The sum uses every term.</p>
        </Show>
        <Show when={cell().float}>{(f) => <p class="hint">float32 product {f().prod.hex} · {f().prod.kind} · sign {f().prod.sign} exp {f().prod.exp} frac {f().prod.frac}. {f().note}</p>}</Show>
      </>}
    </Show>
  </>;
}

function ZoomPanel(): JSX.Element {
  const [vdd, setVdd] = createSignal(1);
  const [vth, setVth] = createSignal(0.25);
  const [temp, setTemp] = createSignal(300);
  const [noise, setNoise] = createSignal(0);
  const report = createMemo(() => assessInverter(cmosParams({ VDD: vdd(), Vth0: vth(), T: temp() }), { noiseSigma: noise(), noiseDraws: noise() > 0 ? 32 : 0, seed: 1729, steps: 41 }));
  createEffect(() => setWalkCurve(report().curve));
  return <>
    <h3>Zoom</h3>
    <div class="zoomladder">
      <For each={ZOOMS}>{(z) => <button classList={{ pri: walkZoom() === z }} onClick={() => setWalkZoom(z)}>{ZOOM_LABEL[z]}</button>}</For>
    </div>
    <Show when={walkZoom() === 'voltage'}>
      <p class="warn">{CMOS_BANNER}</p>
      <p class="hint">Model id {report().model}. {report().reason}</p>
      <label class="hint">VDD {vdd().toFixed(2)} V <input type="range" min="0.05" max="1.2" step="0.01" value={vdd()} onInput={(e) => setVdd(+e.currentTarget.value)} /></label>
      <label class="hint">Vth {vth().toFixed(2)} V <input type="range" min="0.05" max="0.8" step="0.01" value={vth()} onInput={(e) => setVth(+e.currentTarget.value)} /></label>
      <label class="hint">T {temp().toFixed(0)} K <input type="range" min="250" max="400" step="1" value={temp()} onInput={(e) => setTemp(+e.currentTarget.value)} /></label>
      <label class="hint">input noise σ {noise().toFixed(3)} V <input type="range" min="0" max="0.4" step="0.005" value={noise()} onInput={(e) => setNoise(+e.currentTarget.value)} /></label>
      <VoltageReadout r={report()} p={cmosParams({ VDD: vdd(), Vth0: vth(), T: temp() })} />
    </Show>
    <Show when={walkZoom() === 'gates'}><p class="hint">Gate zoom draws the significand multiplier of the selected product when both factors are normal float32. A Forge instruction’s ALU is in the Forge link panel. Neither netlist is what the engine executed.</p></Show>
    <Show when={walkZoom() === 'float'}><p class="hint">Bit cells are the float32 rounding of the JavaScript product. Sign, exponent, and fraction are separate colors. The accumulator in the matvec is float64.</p></Show>
  </>;
}

function VoltageReadout(p: { r: InverterReport; p: CmosParams }): JSX.Element {
  const r = () => p.r;
  const inject = async (): Promise<void> => {
    const index = sel().neuron ?? 0;
    await runForward({ site: 'resid_post', layer: sel().layer, bit: 23, mode: 'flip', indices: [index] });
  };
  return <>
    <table>
      <tbody>
        <tr><td>VOH / VOL</td><td>{num(r().voh, 3)} / {num(r().vol, 3)}</td></tr>
        <tr><td>NML / NMH</td><td>{num(r().nml, 3)} / {num(r().nmh, 3)}</td></tr>
        <tr><td>valid high / low</td><td>{r().validHigh ? 'yes' : 'no'} / {r().validLow ? 'yes' : 'no'}</td></tr>
        <tr><td>rise / fall estimate</td><td>{fmtDelay(r().delay.rise_s)} / {fmtDelay(r().delay.fall_s)}</td></tr>
        <tr><td>noise errors</td><td>{r().noiseDraws ? `${r().noiseErrors} / ${r().noiseDraws} draws at Vin = VDD` : 'off'}</td></tr>
      </tbody>
    </table>
    <p class="hint">{r().delay.note} Delay numbers are this model’s estimate, not a measurement of the machine.</p>
    <button class="pri" disabled={!r().failed && r().noiseErrors === 0} onClick={() => void inject()}>Inject one real bit flip from this failure</button>
    <p class="hint">When the simulated inverter is outside a valid logic level, or noise made a rail input invalid, this flips bit 23 of resid_post at the selected layer and neuron (or index 0) and reruns the real forward. The sliders do not undervolt hardware.</p>
  </>;
}

function Fault(): JSX.Element {
  const [meta, setMeta] = createSignal<{ hypothesis?: string; citations?: { id: string; claim: string; cite: string; url: string }[] } | null>(null);
  onMount(() => { const m = legacy()?.deepMeta?.(); if (m) setMeta(m); });
  const run = async (): Promise<void> => {
    setWalkErr(''); setWalkBusy('running the pre-registered study on TinyStories-8M…');
    try {
      const report = await legacy()?.deepFault?.();
      if (report) setFaultReport(report);
    } catch (e) { setWalkErr((e as Error).message); }
    finally { setWalkBusy(''); }
  };
  return <>
    <h3>Fault study</h3>
    <p class="hint">The flips below are real writes into activation floats, then a real forward. Weights are not edited. This is not a voltage change on the GPU.</p>
    <Show when={meta()?.hypothesis}><p>{meta()!.hypothesis}</p></Show>
    <button class="pri" disabled={!!walkBusy()} onClick={() => void run()}>Run DW-FAULT-1</button>
    <Show when={walkBusy()}><p class="hint">{walkBusy()}</p></Show>
    <Show when={faultReport()}>{(r) => <>
      <p class={r().predictionHolds ? 'hint' : 'warn'}>KL exponent {num(r().meanKlExponent, 6)} · KL mantissa {num(r().meanKlMantissa, 6)} · prediction {r().predictionHolds ? 'holds on this run' : 'does not hold on this run'}</p>
      <p class="hint">greedy-token change rate, exponent {num(r().rateExponent, 3)} · mantissa {num(r().rateMantissa, 3)}. {r().whatFlipped}</p>
      <table>
        <thead><tr><th>#</th><th>flips</th><th>KL exp</th><th>KL man</th><th>token exp</th><th>token man</th></tr></thead>
        <tbody><For each={r().rows}>{(row) => <tr><td>{row.trial}</td><td>{row.nFlip}</td><td>{num(row.klExponent, 4)}</td><td>{num(row.klMantissa, 4)}</td><td>{row.exponentChanged ? 'changed' : 'same'}</td><td>{row.mantissaChanged ? 'changed' : 'same'}</td></tr>}</For></tbody>
      </table>
    </>}</Show>
    <Show when={meta()?.citations}>
      <h3>Citations</h3>
      <For each={meta()!.citations}>{(c) => <p class="hint"><a href={c.url}>{c.cite}</a> {c.claim}</p>}</For>
    </Show>
  </>;
}

function ForgeLink(): JSX.Element {
  const [name, setName] = createSignal('ADD');
  const [a, setA] = createSignal(22);
  const [b, setB] = createSignal(35);
  const [gate, setGate] = createSignal<ForgeGate | null>(null);
  const [sig, setSig] = createSignal<SigProduct | null>(null);
  const take = (): void => {
    const run = forgeRun();
    const rom = run?.compiled?.rom;
    if (!rom) { setWalkErr('Run a Forge program first, or type the op below.'); return; }
    const op = vmOperands(rom, Math.min(forgeCursor(), Math.max(0, rom.length - 1)));
    setName(op.name); setA(op.a); setB(op.b);
    setGate(lowerForge(op.name, op.a, op.b));
    setWalkZoom('gates');
  };
  return <>
    <h3>Forge instruction → gates</h3>
    <p class="hint">The netlist is this workspace’s AND/OR/XOR/NOT model of the ALU op. It is checked against integer arithmetic. The weight-engine gadgets are a different implementation; this view does not claim to be those gadgets.</p>
    <div class="adv-row">
      <button onClick={take}>Use the Forge cursor</button>
      <label class="hint">op <input aria-label="alu op" value={name()} onInput={(e) => setName(e.currentTarget.value.toUpperCase())} /></label>
      <label class="hint">a <input type="number" value={a()} onInput={(e) => setA(+e.currentTarget.value)} /></label>
      <label class="hint">b <input type="number" value={b()} onInput={(e) => setB(+e.currentTarget.value)} /></label>
      <button class="pri" onClick={() => { setGate(lowerForge(name(), a(), b())); setWalkZoom('gates'); }}>Lower to gates</button>
    </div>
    <Show when={gate()}>{(g) => <p class={g().match ? 'hint' : 'warn'}>{g().note}</p>}</Show>
    <Show when={walkCell()?.term}>
      <button onClick={() => { const t = walkCell()!.term!; setSig(significandProduct(t.w, t.x)); setWalkZoom('gates'); }}>Significand multiply of the selected term</button>
    </Show>
    <Show when={sig()}>{(s) => <p class={s().match === false ? 'warn' : 'hint'}>{s().note}</p>}</Show>
  </>;
}

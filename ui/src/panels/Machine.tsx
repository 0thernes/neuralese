import { createEffect, createMemo, createSignal, For, getOwner, onCleanup, onMount, runWithOwner, Show, type JSX } from 'solid-js';
import { COMPONENTS, LIMITS, measure, packetStatusAt, PRECISION, PROGRAMS, saveStorage, zoomView, type WmMeasure, type WmPacket, type ZoomView } from '../../../src/machine/machine.js';
import { launch, setWmBusy, setWmCursor, setWmErr, setWmPipe, setWmPlaying, setWmProgram, setWmRun, setWmSelected, setWmZoom, WM_HELP, wmBusy, wmCursor, wmErr, wmPipe, wmPlaying, wmProgram, wmRun, wmSelected, wmZoom } from '../core/machine';
import { theme } from '../core/store';

const ZOOMS = ['board', 'weights', 'gates', 'voltage'] as const;

function num(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 100) return v.toFixed(0);
  return v.toFixed(d);
}

function frameOf() {
  const run = wmRun();
  if (!run?.frames.length) return null;
  return run.frames[Math.min(wmCursor(), run.frames.length - 1)] ?? null;
}

function go(id: string, fault: object | null = null): void {
  setWmErr(''); setWmBusy('stepping the weight machine and the int32 reference…'); setWmPlaying(false);
  setWmProgram(id);
  queueMicrotask(() => {
    void (async () => {
    try {
      const run = await launch(id, { pipeline: wmPipe(), fault });
      setWmRun(run);
      setWmCursor(Math.max(0, run.frames.length - 1));
      if (!run.exact) setWmErr(spreadText(run));
    } catch (e) { setWmErr((e as Error).message); }
    finally { setWmBusy(''); }
    })();
  });
}

function spreadText(run: NonNullable<ReturnType<typeof wmRun>>): string {
  const d = run.diverge;
  if (!d) return run.faults.length ? 'precision fault: ' + run.faults[0] : 'the weight trace differs';
  const where = d.index == null ? d.field : `${d.field}[${d.index}]`;
  return `Diverged at cycle ${d.cycle} in ${where}. Weight ${String(d.weight)}, reference ${String(d.ref)}. Injected: ${run.injected.map((e) => e.kind).join(', ') || 'none'}.`;
}

let booted = false;
export function MachinePanel(p: { id: string }): JSX.Element {
  onMount(() => {
    if (!booted) { booted = true; go('hello'); }
    if (p.id === 'wm-control') {
      const hello = (): void => go('hello');
      document.addEventListener('neuralese:wm-hello', hello);
      onCleanup(() => document.removeEventListener('neuralese:wm-hello', hello));
    }
  });
  return <div class="adv wm">
    <Show when={p.id === 'wm-room'}><Room /></Show>
    <Show when={p.id === 'wm-control'}><Control /></Show>
    <Show when={p.id === 'wm-io'}><Io /></Show>
    <Show when={p.id === 'wm-packets'}><Packets /></Show>
    <Show when={p.id === 'wm-zoom'}><Zoom /></Show>
    <Show when={p.id === 'wm-report'}><Report /></Show>
  </div>;
}

function Room(): JSX.Element {
  let host!: HTMLDivElement;
  const [hud, setHud] = createSignal('starting renderer…');
  const owner = getOwner();
  const cubes = createMemo(() => zoomCubes(wmSelected(), wmZoom(), wmRun()?.weightState ?? null));
  const marks = createMemo(() => {
    const run = wmRun(); const fr = frameOf(); if (!run || !fr) return [];
    const byId = Object.fromEntries(COMPONENTS.map((c) => [c.id, c]));
    const visible = run.packets.filter((p) => {
      const st = packetStatusAt(p, fr.cycle);
      return st === 'inflight' || st === 'drop' || st === 'done';
    }).slice(-10);
    return visible.map((p, i) => {
      const st = packetStatusAt(p, fr.cycle);
      const a = byId[p.src]; const b = byId[p.dst];
      if (!a || !b) return null;
      const span = Math.max(1, (p.arrive ?? fr.cycle) - p.issue);
      const along = st === 'inflight' ? Math.min(1, (fr.cycle - p.issue) / span) : st === 'drop' ? 0.5 : 0.25 + (i / Math.max(1, visible.length - 1)) * 0.7;
      return { id: p.id, x: a.x + (b.x - a.x) * along, y: 1.15, z: a.z + (b.z - a.z) * along, drop: st === 'drop', live: st === 'inflight' || st === 'done' };
    }).filter((p): p is { id: number; x: number; y: number; z: number; drop: boolean; live: boolean } => p != null);
  });
  onMount(() => {
    void (async () => {
      try {
        const [{ createStage }, { createMachine }] = await Promise.all([import('../three/stage'), import('../three/machine')]);
        const st = await createStage(host, () => getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim() || '#070a12');
        const scene = createMachine(st, COMPONENTS.map((c) => ({ ...c })));
        const aim = scene.aim();
        st.focus(aim.at, aim.dist);
        if (owner) runWithOwner(owner, () => {
          createEffect(() => {
            const sel = wmSelected(); const zoom = wmZoom(); const fr = frameOf();
            scene.show(sel, marks(), fr?.fb ?? null, cubes());
            const block = COMPONENTS.find((c) => c.id === sel);
            setHud(`${st.backend} · ${block?.name ?? 'board'} · ${zoom} · cycle ${fr?.cycle ?? 0} · ${marks().length} packets on the bus`);
          });
          onCleanup(() => { scene.dispose(); st.dispose(); });
        });
        st.renderer.domElement.addEventListener('click', (e) => {
          const hit = st.pick(e, scene.pickables());
          const d = hit && scene.decode(hit);
          if (!d) return;
          if (d.component !== wmSelected()) { setWmSelected(d.component); setWmZoom('weights'); }
          else setWmZoom(ZOOMS[(ZOOMS.indexOf(wmZoom()) + 1) % ZOOMS.length] ?? 'board');
        });
        setHud((h) => h.startsWith('starting') ? `${st.backend} · drag to orbit, click a block` : h);
      } catch (e) { setHud('3D unavailable: ' + (e as Error).message); }
    })();
  });
  return <div class="cosmos">
    <div class="cosmos-stage" ref={host} role="img" aria-label="Machine Room board. Drag to orbit. Click a component to zoom into its gadget." />
    <div class="cosmos-hud" aria-live="polite"><b>Machine Room</b> · {hud()}</div>
  </div>;
}

function zoomCubes(id: string, level: string, state: object | null): { x: number; y: number; z: number; color: number }[] {
  if (level === 'board') return [];
  const view = zoomView(id, level, state);
  const anchor = COMPONENTS.find((c) => c.id === id) ?? COMPONENTS[0]!;
  if (level === 'weights' && view.values) {
    const cubes: { x: number; y: number; z: number; color: number }[] = [];
    view.values.forEach((row, r) => row.forEach((v, c) => {
      cubes.push({ x: anchor.x + (c - row.length / 2) * 0.28, y: 2.2 + r * 0.28, z: anchor.z, color: v ? 0x2dd4bf : 0x1e293b });
    }));
    return cubes;
  }
  if (level === 'gates' && view.gates) {
    return view.gates.slice(0, 48).map((g, i) => ({
      x: anchor.x + ((i % 12) - 6) * 0.32, y: 2.1, z: anchor.z + (Math.floor(i / 12) - 1) * 0.32,
      color: g.op === 'AND' ? 0x2dd4bf : g.op === 'XOR' ? 0x38bdf8 : g.op === 'OR' ? 0xfbbf24 : 0xfb7185,
    }));
  }
  if (level === 'voltage' && view.curve) {
    return view.curve.filter((p) => p.vout != null).map((p, i, arr) => ({
      x: anchor.x + (i / Math.max(1, arr.length - 1) - 0.5) * 3.2,
      y: 1.6 + (p.vout ?? 0) * 1.6,
      z: anchor.z,
      color: 0xfbbf24,
    }));
  }
  return [];
}

function Control(): JSX.Element {
  const ids = Object.keys(PROGRAMS);
  const run = createMemo(() => wmRun());
  const fr = createMemo(() => frameOf());
  let timer = 0;
  const play = (): void => {
    if (wmPlaying()) { setWmPlaying(false); window.clearInterval(timer); return; }
    setWmPlaying(true);
    timer = window.setInterval(() => {
      const n = wmRun()?.frames.length ?? 0;
      if (!n) return;
      const next = wmCursor() + 1;
      if (next >= n) { setWmPlaying(false); window.clearInterval(timer); return; }
      setWmCursor(next);
    }, 80);
  };
  onCleanup(() => window.clearInterval(timer));
  const fault = (kind: string): void => {
    if (kind === 'ram') {
      void (async () => {
        const clean = await launch('rot-probe', { fault: null });
        const store = clean.packets.find((p) => p.op === 'write' && p.dst === 'ram');
        const at = (store?.arrive ?? 4) + 1;
        setWmProgram('rot-probe');
        setWmRun(clean);
        const bad = await launch('rot-probe', { fault: { kind: 'ram-bit', word: store?.addr ?? 3, bit: 0, atCycle: at } });
        setWmRun(bad); setWmCursor(Math.max(0, bad.frames.length - 1));
        setWmErr(spreadText(bad));
      })();
      return;
    }
    if (kind === 'drop') { go('hello', { kind: 'drop', dst: 'console' }); return; }
    go('tpu', { kind: 'tpu-stuck', r: 0, c: 0, bit: 0, value: 0 });
  };
  return <>
    <h3>Cycle</h3>
    <p class="hint">{WM_HELP}</p>
    <label class="hint">Program <select aria-label="demo program" value={wmProgram()} onChange={(e) => go(e.currentTarget.value)}>
      <For each={ids}>{(id) => <option value={id}>{PROGRAMS[id]!.title}</option>}</For>
    </select></label>
    <p class="hint">{PROGRAMS[wmProgram()]?.blurb}</p>
    <div class="adv-row">
      <button class="pri" disabled={!!wmBusy()} onClick={() => go(wmProgram())}>Run</button>
      <button disabled={!run()?.frames.length} onClick={() => setWmCursor(Math.max(0, wmCursor() - 1))}>Step back</button>
      <button disabled={!run()?.frames.length} onClick={() => setWmCursor(Math.min((run()?.frames.length ?? 1) - 1, wmCursor() + 1))}>Step</button>
      <button disabled={!run()?.frames.length} onClick={play}>{wmPlaying() ? 'Pause' : 'Play'}</button>
      <label class="chk"><input type="checkbox" checked={wmPipe()} onChange={(e) => { setWmPipe(e.currentTarget.checked); go(wmProgram()); }} /> pipeline</label>
    </div>
    <div class="adv-row">
      <button onClick={() => fault('ram')}>RAM bit rot</button>
      <button onClick={() => fault('drop')}>Drop console packet</button>
      <button onClick={() => fault('tpu')}>TPU MAC stuck-at</button>
    </div>
    <Show when={wmBusy()}><p class="hint">{wmBusy()}</p></Show>
    <Show when={wmErr()}><p class="warn">{wmErr()}</p></Show>
    <Show when={fr()} fallback={<p class="hint">Run a program. The trace is the weight machine, checked against the reference.</p>}>
      {(f) => <p class="hint">cycle {f().cycle} / {run()?.cycles} · PC {f().pc} · {f().halted ? 'halted ' + f().result : f().fail ? 'FAIL ' + f().fail : 'running'} · SSD {f().busy.ssd} · GPU {f().busy.gpu} · TPU {f().busy.tpu} · {run()?.exact ? 'exact match' : 'DIFFERS from the reference'} · packets {run()?.packetExact ? 'match' : 'differ'} · faults {run()?.faults.length}</p>}
    </Show>
    <Show when={fr()?.regs}>
      <table>
        <thead><tr><th>reg</th><th>value</th></tr></thead>
        <tbody><For each={fr()!.regs}>{(v, i) => <tr><td>r{i()}</td><td>{v}</td></tr>}</For></tbody>
      </table>
    </Show>
  </>;
}

function Io(): JSX.Element {
  let cv: HTMLCanvasElement | undefined;
  const paint = (): void => {
    const canvas = cv; const fb = frameOf()?.fb; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx || !fb) return;
    const img = ctx.createImageData(LIMITS.FB_W, LIMITS.FB_H);
    for (let i = 0; i < fb.length && i < LIMITS.FB_W * LIMITS.FB_H; i++) {
      const v = fb[i] ?? 0;
      img.data[i * 4] = v; img.data[i * 4 + 1] = Math.min(255, (v + 40) | 0); img.data[i * 4 + 2] = 56; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };
  createEffect(paint);
  onMount(paint);
  const save = (): void => {
    const state = wmRun()?.weightState; if (!state) return;
    const file = saveStorage(state);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
    a.download = 'wm-ssd.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  return <>
    <h3>Console and framebuffer</h3>
    <p class="hint">The console is bytes the CPU stored. The framebuffer is 32×32, scaled up. Both are the weight machine at this cycle.</p>
    <pre class="repro" aria-label="console">{frameOf()?.console || '—'}</pre>
    <canvas ref={cv} class="heat" width={LIMITS.FB_W} height={LIMITS.FB_H} aria-label="Framebuffer" />
    <div class="adv-row"><button onClick={save} disabled={!wmRun()}>Save SSD state</button></div>
  </>;
}

function Packets(): JSX.Element {
  const rows = createMemo(() => {
    const run = wmRun(); const fr = frameOf(); if (!run || !fr) return [] as (WmPacket & { now: string })[];
    return run.packets.map((p) => ({ ...p, now: packetStatusAt(p, fr.cycle) })).filter((p) => p.now !== 'future');
  });
  return <>
    <h3>Packets</h3>
    <p class="hint">One grant per cycle, delivery {LIMITS.BUS_LAT} cycles later. Wide-port rows are a RAM bundle, not a serial beat. A drop is red in the board view and stays listed.</p>
    <div class="vt" style={{ 'max-height': '280px' }}>
      <table>
        <thead><tr><th>id</th><th>src</th><th>dst</th><th>op</th><th>addr</th><th>data</th><th>port</th><th>at</th><th>now</th></tr></thead>
        <tbody><For each={rows()}>{(p) => <tr classList={{ on: p.now === 'inflight' }}><td>{p.id}</td><td>{p.src}</td><td>{p.dst}</td><td>{p.op}</td><td>{p.addr}</td><td>{p.data ?? '—'}</td><td>{p.port}</td><td>{p.issue}→{p.arrive ?? '—'}</td><td>{p.now}</td></tr>}</For></tbody>
      </table>
    </div>
  </>;
}

function Zoom(): JSX.Element {
  const view = createMemo<ZoomView>(() => zoomView(wmSelected(), wmZoom() === 'board' ? 'weights' : wmZoom(), wmRun()?.weightState ?? null));
  const block = createMemo(() => COMPONENTS.find((c) => c.id === wmSelected()));
  return <>
    <h3>{block()?.name ?? 'Component'}</h3>
    <p class="hint">{block()?.blurb}</p>
    <div class="seg">
      <For each={ZOOMS}>{(z) => <button classList={{ on: wmZoom() === z }} onClick={() => setWmZoom(z)}>{z}</button>}</For>
    </div>
    <Show when={wmZoom() === 'board'}><p class="hint">The board is the whole machine. Pick weights, gates, or voltage, or click the block again.</p></Show>
    <Show when={wmZoom() === 'weights'}>
      <p class="hint">{view().note}</p>
      <p class="hint">{view().and?.note} Check: {view().and?.check ? 'relu(1,1)=1 and relu(1,0)=0' : 'failed'}</p>
    </Show>
    <Show when={wmZoom() === 'gates'}>
      <p class="hint">{view().banner} Sample {view().sample}. Logic gates {view().logic}, depth {view().depth}, showing {view().gates?.length ?? 0}{view().hidden ? `, ${view().hidden} not drawn` : ''}.</p>
      <p class="hint">Netlist output {(() => { const o = view().out; if (o?.y != null) return String(o.y); if (o?.p != null) return String(o.p); return '—'; })()}{view().expect != null ? `, integer expect ${view().expect}` : ''}.</p>
    </Show>
    <Show when={wmZoom() === 'voltage'}>
      <p class="warn">{view().banner}</p>
      <p class="hint">{view().note} VOL {num(view().vol, 3)} · VOH {num(view().voh, 3)} · valid low {String(view().validLow)} · valid high {String(view().validHigh)}. NAND rows {view().nand?.filter((r) => r.ok).length}/{view().nand?.length}.</p>
    </Show>
    <p class="hint">{PRECISION.note}</p>
  </>;
}

function Report(): JSX.Element {
  const [table, setTable] = createSignal<WmMeasure | null>(null);
  const [busy, setBusy] = createSignal('');
  const runMeasure = (): void => {
    setBusy('timing a small exact-match batch…');
    void (async () => {
      try { setTable(await measure({ seed: 11, cpu: 8, ram: 8, ssd: 4, gpu: 2, tpu: 2, bus: 16, mlp: 1 })); }
      catch (e) { setWmErr((e as Error).message); }
      finally { setBusy(''); }
    })();
  };
  const run = createMemo(() => wmRun());
  return <>
    <h3>Exact match</h3>
    <p class="hint">This page’s last program, then a fresh batch if you ask for one. Milliseconds are this browser, not a benchmark. {PRECISION.voltage === 'simulated' ? 'Voltage stays simulated.' : ''}</p>
    <Show when={run()} fallback={<p class="hint">Run a program from Cycle.</p>}>
      {(r) => <p class={r().exact ? 'hint' : 'warn'}>{r().program} · {r().exact ? 'exact' : 'not exact'} · rate {r().rate.toFixed(3)} · cycles {r().cycles} = reference {r().refCycles} · packet log {r().packetExact ? 'matches' : 'differs'} · precision faults {r().faults.length}</p>}
    </Show>
    <div class="adv-row"><button disabled={!!busy()} onClick={runMeasure}>Measure a small batch</button><Show when={busy()}><span class="hint">{busy()}</span></Show></div>
    <Show when={table()}>
      {(t) => <table>
        <thead><tr><th>component</th><th>exact</th><th>weight ms</th><th>reference ms</th><th>ratio</th></tr></thead>
        <tbody>
          <For each={t().rows}>{(row) => <tr><td>{row.component}</td><td>{row.exact}/{row.trials}</td><td>{num(row.msWeight)}</td><td>{num(row.msRef, 3)}</td><td>{row.overhead == null ? '—' : num(row.overhead, 1) + '×'}</td></tr>}</For>
          <For each={t().programs}>{(row) => <tr><td>{row.id}</td><td>{row.exact ? 'yes' : 'no'}</td><td>{num(row.msWeight)}</td><td>{num(row.msRef, 3)}</td><td>{row.overhead == null ? '—' : num(row.overhead, 1) + '×'}</td></tr>}</For>
        </tbody>
      </table>}
    </Show>
    <p class="hint">Theme sample {theme()} does not change the numbers. bf16: {PRECISION.bf16}.</p>
  </>;
}

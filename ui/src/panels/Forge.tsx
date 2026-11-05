import { createEffect, createSignal, For, onCleanup, onMount, Show, type JSX } from 'solid-js';
import { legacy } from '../core/bridge';
import { DEMO, FORGE_HELP, forgeBusy, forgeBundle, forgeClockMs, forgeCursor, forgeErr, forgeHost, forgeLanes, forgeRun, forgeSource, setForgeBundle, setForgeBusy, setForgeClockMs, setForgeCursor, setForgeErr, setForgeHost, setForgeLanes, setForgeRun, setForgeSource, type ForgeRun, type LaneReport } from '../core/forge';
import { sel, selection } from '../core/store';
import { PRECISION } from '../../../src/forge/engine.js';
import { forwardOnce, greedyTokens, scriptedPrompt } from '../../../src/forge/host.js';

function dl(name: string, body: string): void {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function num(x: number | null | undefined, d = 3): string { return typeof x === 'number' && Number.isFinite(x) ? (Number.isInteger(x) ? String(x) : x.toFixed(d)) : '—'; }

async function execute(src: string, lm: string[]): Promise<void> {
  const mf = legacy()?.mf;
  if (!mf) { setForgeErr('forge worker is not ready'); return; }
  setForgeErr(''); setForgeBusy('typecheck, then clock the engine…');
  try {
    const out = await mf.forge({ source: src, lmTokens: lm, seed: 1 }, (p) => { if (p.label) setForgeBusy(p.label); });
    if ((out as { cancelled?: boolean }).cancelled || !out.run) return;
    const run = out.run as ForgeRun;
    setForgeRun(run); setForgeCursor(0);
    setForgeBundle(out.bundle);
    setForgeBusy('');
    if (!run.ok) setForgeErr(run.errors.map((e) => `${e.code}: ${e.msg}`).join(' · '));
    else if (!run.eq32) setForgeErr('float32 engine trace does not match the int32 VM');
  } catch (e) { setForgeBusy(''); if ((e as Error).message !== 'cancelled') setForgeErr((e as Error).message); }
}

function Bar(): JSX.Element {
  return <div class="adv-row"><Show when={forgeBusy()}><span class="hint">{forgeBusy()}</span></Show><Show when={forgeErr()}><span class="warn">{forgeErr()}</span></Show></div>;
}

export function ForgePanel(p: { id: string }): JSX.Element {
  return <div class="adv forge">
    <Show when={p.id === 'forge-prog'}><Program /></Show>
    <Show when={p.id === 'forge-cpu'}><Cpu /></Show>
    <Show when={p.id === 'forge-mem'}><Mem /></Show>
    <Show when={p.id === 'forge-trace'}><Tokens /></Show>
    <Show when={p.id === 'forge-mdcc'}><Lanes /></Show>
    <Show when={p.id === 'forge-repro'}><Repro /></Show>
  </div>;
}

function Program(): JSX.Element {
  onMount(() => {
    const go = (): void => { setForgeSource(DEMO); void execute(DEMO, scriptedPrompt('sum of 22 copies of 35')); };
    document.addEventListener('neuralese:forge-demo', go);
    onCleanup(() => document.removeEventListener('neuralese:forge-demo', go));
  });
  const sample = async (): Promise<void> => {
    const lg = legacy();
    if (!lg?.eng || !lg.tok) { setForgeHost('Demo mode: the host model is not loaded. The scripted line is not a model sample.'); void execute(forgeSource(), scriptedPrompt('sum of 22 copies of 35')); return; }
    setForgeBusy('sampling 8 greedy tokens from the loaded model…');
    try {
      const remote = await lg.hostGreedy?.('Sum 22 copies of 35.', 8);
      const s = remote?.ids ? { tokens: remote.ids.map((id) => lg.tok!.tokenStr(id)), note: 'greedy TinyStories sample. This model is not trained to emit NestLang. The editor program is the one that is checked and clocked.' } : greedyTokens(lg.eng, lg.tok, 'Sum 22 copies of 35.', 8);
      setForgeHost(s.note + ' Tokens: ' + (s.tokens.join(' ') || '(none)'));
      await execute(forgeSource(), [...s.tokens, '⟦forge⟧']);
    } catch (e) { setForgeBusy(''); setForgeErr((e as Error).message); }
  };
  return <>
    <h3>NestLang</h3>
    <p class="hint">{FORGE_HELP}</p>
    <textarea aria-label="NestLang program" spellcheck={false} value={forgeSource()} onInput={(e) => setForgeSource(e.currentTarget.value)} />
    <div class="adv-row">
      <button class="pri" onClick={() => void execute(forgeSource(), scriptedPrompt('editor program'))}>Run program</button>
      <button onClick={() => { setForgeSource(DEMO); void execute(DEMO, scriptedPrompt('sum of 22 copies of 35')); }}>Demo: 22 × 35</button>
      <button onClick={() => void sample()}>Sample host, then hand off</button>
    </div>
    <Bar />
    <Show when={forgeHost()}><p class="hint">{forgeHost()}</p></Show>
    <Show when={forgeRun()}>{(r) => <p class={r().ok && r().eq32 ? 'hint' : 'warn'}>{r().ok ? `typecheck pass · VM result ${num(r().vm?.result)} · float32 trace ${r().eq32 ? 'matches' : 'DIFFERS'} · float64 trace ${r().eq64 ? 'matches' : 'DIFFERS'} · faults ${r().engine?.faults.length ?? 0}` : 'typecheck FAIL'}</p>}</Show>
  </>;
}

function stepOf(run: ForgeRun | null) { const t = run?.vm?.trace; if (!t?.length) return null; return t[Math.min(forgeCursor(), t.length - 1)] ?? null; }

function Cpu(): JSX.Element {
  createEffect(() => {
    const t = sel().token; const n = forgeRun()?.vm?.trace.length ?? 0;
    if (t != null && t >= 0 && t < n) setForgeCursor(t);
  });
  const clock = (): void => {
    const run = forgeRun(); const n = run?.vm?.trace.length ?? 0;
    if (n) setForgeCursor(Math.min(forgeCursor() + 1, n - 1));
    const lg = legacy();
    if (!lg?.eng || !lg.tok) { setForgeClockMs(null); return; }
    const remote = lg.hostForward?.();
    if (remote) { void remote.then((r) => { if (r) setForgeClockMs(r.ms); else setForgeClockMs(forwardOnce(lg.eng!, lg.tok!).ms); }).catch((e: Error) => setForgeErr(e.message)); return; }
    try { setForgeClockMs(forwardOnce(lg.eng, lg.tok).ms); } catch (e) { setForgeErr((e as Error).message); }
  };
  return <>
    <h3>Forge CPU</h3>
    <p class="hint">{PRECISION.note}</p>
    <div class="adv-row">
      <button disabled={!forgeRun()?.vm} onClick={clock}>Clock one</button>
      <Show when={forgeClockMs() != null}><span class="hint">one host forward beside this clock: {num(forgeClockMs(), 2)} ms. The residual is the model’s, not the ALU.</span></Show>
    </div>
    <Show when={stepOf(forgeRun())} fallback={<p class="hint">Run a program. Registers fill from the int32 reference trace. The float32 engine is checked against that trace.</p>}>
      {(s) => <>
        <p class="hint">PC {s().pc} · {s().name} · rd r{s().rd} · result {s().result} · {s().halted ? 'halted' : s().fail ? 'FAIL ' + s().fail : 'running'} · step {forgeCursor() + 1}/{forgeRun()?.vm?.trace.length}</p>
        <table>
          <thead><tr><th>reg</th><th>value</th></tr></thead>
          <tbody><For each={s().regs}>{(v, i) => <tr classList={{ on: i() === s().rd }}><td>r{i()}</td><td>{v}</td></tr>}</For></tbody>
        </table>
      </>}
    </Show>
  </>;
}

function Mem(): JSX.Element {
  let cv: HTMLCanvasElement | undefined;
  const [ramNow, setRamNow] = createSignal<number[] | null>(null);
  createEffect(() => {
    const run = forgeRun(); const i = forgeCursor();
    const local = run?.vm?.trace[i]?.ram;
    if (local) { setRamNow(local); return; }
    if (run?.id == null) { setRamNow(run?.vm?.ram ?? null); return; }
    void legacy()?.mf?.forgeStep(run.id, i).then((s) => { if (s?.ram) setRamNow(s.ram); });
  });
  const paint = (): void => {
    const canvas = cv; if (!canvas) return;
    const ram = ramNow() ?? forgeRun()?.vm?.ram;
    const ctx = canvas.getContext('2d'); if (!ctx || !ram) { ctx?.clearRect(0, 0, canvas.width, canvas.height); return; }
    const n = 16, cell = canvas.width / n;
    for (let i = 0; i < 256; i++) {
      const v = ram[i] ?? 0; const t = Math.max(-1, Math.min(1, v / 64));
      const mag = Math.abs(t);
      ctx.fillStyle = t >= 0 ? `rgba(45,212,191,${0.12 + mag * 0.88})` : `rgba(244,114,182,${0.12 + mag * 0.88})`;
      ctx.fillRect((i % n) * cell, Math.floor(i / n) * cell, cell - 1, cell - 1);
    }
  };
  createEffect(paint);
  onMount(paint);
  return <>
    <h3>Memory</h3>
    <p class="hint">256 RAM words at the selected step. Teal is positive, pink is negative, scaled by 64. Word 255 is NestLang scratch. ROM is the program, not this map.</p>
    <canvas ref={cv} class="heat" width="256" height="256" aria-label="RAM heatmap" />
    <Show when={stepOf(forgeRun())?.mem}>{(m) => <p class="hint">store this step: word {m().addr} = {m().value}</p>}</Show>
  </>;
}

function Tokens(): JSX.Element {
  const pick = (i: number): void => { const n = forgeRun()?.vm?.trace.length ?? 0; const k = Math.max(0, Math.min(n - 1, i | 0)); setForgeCursor(k); try { selection.set({ token: k, prompt: forgeSource().slice(0, 80) }); } catch { /* token index is still shown here */ } };
  const windowed = () => {
    const t = forgeRun()?.vm?.trace ?? [];
    const c = forgeCursor();
    const a = Math.max(0, Math.min(c - 12, Math.max(0, t.length - 25)));
    return t.slice(a, a + 25).map((s, k) => ({ s, i: a + k }));
  };
  return <>
    <h3>LM tokens and engine tokens</h3>
    <p class="hint">Left: tokens before the handoff. Right: one instruction and four value bytes per clock, then HALT or FAIL, then END. Selecting a row sets the shared token index (step {sel().token ?? '—'}). The list shows the steps around the cursor; the number box reaches any step.</p>
    <div class="cols">
      <div>
        <b>LM</b>
        <For each={forgeRun()?.tokens.filter((t) => t.lane === 'lm') ?? []}>{(t) => <div class="tok">{t.text}</div>}</For>
        <Show when={!forgeRun()?.tokens.some((t) => t.lane === 'lm')}><p class="hint">No language-model tokens yet.</p></Show>
      </div>
      <div>
        <b>Engine</b>
        <label class="hint">step <input type="number" min={0} aria-label="engine step" value={forgeCursor()} onInput={(e) => pick(+e.currentTarget.value)} /> / {forgeRun()?.vm?.trace.length ?? 0}</label>
        <For each={windowed()}>{(row) => <button class="tok" classList={{ on: row.i === forgeCursor() }} onClick={() => pick(row.i)}>pc {row.s.pc} {row.s.name} → {row.s.result}</button>}</For>
      </div>
    </div>
  </>;
}

function Lanes(): JSX.Element {
  const go = async (): Promise<void> => {
    const mf = legacy()?.mf;
    if (!mf) { setForgeErr('forge worker is not ready'); return; }
    setForgeErr(''); setForgeBusy('running both lanes on the frozen cell set…');
    try { setForgeLanes(await mf.lanes((p) => { if (p.label) setForgeBusy(p.label); }) as LaneReport); setForgeBusy(''); } catch (e) { setForgeBusy(''); if ((e as Error).message !== 'cancelled') setForgeErr((e as Error).message); }
  };
  return <>
    <h3>WeightCPU and MDCC</h3>
    <p class="hint">Same eight arithmetic cells. WeightCPU compiles NestLang and clocks Forge. MDCC is a deterministic proposer plus host bigint. The proposer is not the language model. Pre-registered bar: both lanes exact, engine trace equal to the VM, bf16 not claimed.</p>
    <button class="pri" onClick={() => void go()}>Run contrast</button>
    <Bar />
    <Show when={forgeLanes()}>{(L) => <>
      <table>
        <thead><tr><th>lane</th><th>accuracy</th><th>ms</th><th>tokens</th><th>memory words</th></tr></thead>
        <tbody>
          <tr><td>WeightCPU</td><td>{L().weightcpu.correct}/{L().weightcpu.n}</td><td>{num(L().weightcpu.ms, 1)}</td><td>{L().weightcpu.tokens}</td><td>{L().weightcpu.memoryWords}</td></tr>
          <tr><td>MDCC</td><td>{L().mdcc.correct}/{L().mdcc.n}</td><td>{num(L().mdcc.ms, 2)}</td><td>{L().mdcc.tokens}</td><td>{L().mdcc.memoryWords}</td></tr>
        </tbody>
      </table>
      <p class="hint">Engine traces matched the VM on {num(L().weightcpu.engineMatch, 2)} of the WeightCPU runs. bf16 claimed: {L().criteria.bf16Claimed ? 'yes' : 'no'}.</p>
      <table>
        <thead><tr><th>cell</th><th>WeightCPU</th><th>MDCC</th></tr></thead>
        <tbody><For each={L().weightRows}>{(row, i) => <tr><td>{row.id}</td><td>{row.ok ? row.got : 'miss ' + row.got}</td><td>{L().mdccRows[i()]?.ok ? L().mdccRows[i()]?.got : 'miss'}</td></tr>}</For></tbody>
      </table>
    </>}</Show>
  </>;
}

function Repro(): JSX.Element {
  return <>
    <h3>REPRO</h3>
    <p class="hint">The bundle stores the program, ForgeISA/1, both traces’ equality flags, precision limits, and the lane numbers if you ran them. The hash covers the body. bf16 is recorded as not-run.</p>
    <Show when={forgeBundle()} fallback={<p class="hint">Run a program to write a bundle.</p>}>
      <button onClick={() => dl('forge-repro.json', forgeBundle())}>Download REPRO bundle</button>
      <pre class="hint">{forgeBundle().slice(0, 1400)}{forgeBundle().length > 1400 ? '…' : ''}</pre>
    </Show>
  </>;
}

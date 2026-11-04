import { createSignal, For, onCleanup, onMount, Show, type JSX } from 'solid-js';
import { WORKSPACES, NATIVE_PANELS, panelsOf, workspaceOfLegacy, type Workspace } from '@app/core/workspaces';
import { deserialize, ensurePanels, serialize, panels, activate, addPanel, tabs, type Node } from './core/layout';
import { legacy } from './core/bridge';
import { viewTransition } from './core/motion';
import { setThemeSig, theme } from './core/store';
import { Dock, panelTitle } from './Dock';
import { Palette, type Cmd } from './Palette';
import { Tour, TOUR_KEY } from './Tour';
import { activeLegacy, isShowing, showLegacy } from './panels/Panels';
const LK = (w: string): string => `neuralese.v17.layout.${w}`;
const store = { get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* */ } } };
function loadLayout(w: Workspace): Node { const known = new Set(panelsOf(w)); const saved = deserialize(store.get(LK(w.id)), known); return saved ? ensurePanels(saved, panelsOf(w)) : w.layout(); }
// phones: one tab group per workspace (a split tree does not fit 390 px)
const flatten = (w: Workspace, n: Node): Node => {
  if (n.kind === 'tabs' && n.panels.length) return n;
  const ps = panels(n).length ? panels(n) : panelsOf(w); const first = n.kind === 'split' ? n.children[0] : undefined;
  const act = first && first.kind === 'tabs' ? ps.indexOf(first.panels[first.active] ?? '') : 0;
  return { ...tabs(ps, Math.max(0, act)), id: 'compact' };
};
export function App(): JSX.Element {
  const initial = WORKSPACES.find((w) => w.id === (store.get('neuralese.v17.ws') ?? '')) ?? WORKSPACES[0]!;
  const [ws, setWs] = createSignal<Workspace>(initial); const [layout, setLayoutSig] = createSignal<Node>(loadLayout(initial));
  const [compact, setCompact] = createSignal(innerWidth < 760); const [pal, setPal] = createSignal(false); const [tour, setTour] = createSignal(false);
  const setLayout = (n: Node): void => { setLayoutSig(n); store.set(LK(ws().id), serialize(n)); };
  const go = (w: Workspace, panel?: string): void => {
    viewTransition(() => { if (w.id !== ws().id) { setWs(w); setLayoutSig(loadLayout(w)); store.set('neuralese.v17.ws', w.id); } if (panel) setLayout(activate(addPanel(layout(), panel), panel)); });
    if (panel?.startsWith('legacy:')) setTimeout(() => showLegacy(panel.slice(7)), 0);
  };
  const cmds = (): Cmd[] => [
    ...WORKSPACES.map((w) => ({ id: 'ws-' + w.id, title: `${w.title} workspace`, hint: w.blurb, run: () => go(w) })),
    ...WORKSPACES.flatMap((w) => panelsOf(w).map((p) => ({ id: 'p-' + w.id + p, title: panelTitle(p), hint: `${w.title} · ${p.startsWith('legacy:') ? 'v16 tab ' + p.slice(7) : 'v17 panel'}`, run: () => go(w, p) }))),
    { id: 'a-gen', title: 'Generate', hint: 'run the model on the prompt (Ctrl/⌘+Enter)', run: () => void legacy()?.generate() },
    { id: 'a-theme', title: 'Toggle light / dark theme', hint: 'appearance', run: () => document.getElementById('bTheme')?.click() },
    { id: 'a-reset', title: 'Reset this workspace layout', hint: 'restore the default panel arrangement', run: () => setLayout(ws().layout()) },
    { id: 'a-tour', title: 'Show the tour', hint: 'first-run introduction', run: () => setTour(true) },
    { id: 'a-legacy', title: 'Legacy v16 command list', hint: 'the original palette of lab commands', run: () => { const p = document.getElementById('pal'); p?.classList.remove('hidden'); (document.getElementById('palIn') as HTMLInputElement | null)?.focus(); } },
    { id: 'adv-run', title: 'Adversary Lab: run honest vs deceptive', hint: 'equal-length system prompts, then residualized AUROC', run: () => { const w = WORKSPACES.find((x) => x.id === 'adversary'); if (w) go(w, 'adv-run'); document.dispatchEvent(new CustomEvent('neuralese:adv-run')); } },
    { id: 'adv-hunt', title: 'Adversary Lab: neuron hunt', hint: 'rank MLP units, then compare a push with random sets', run: () => { const w = WORKSPACES.find((x) => x.id === 'adversary'); if (w) go(w, 'adv-hunt'); document.dispatchEvent(new CustomEvent('neuralese:adv-hunt')); } },
    { id: 'forge-demo', title: 'Forge: run the 22×35 demo', hint: 'NestLang handoff, then one clock per instruction', run: () => { const w = WORKSPACES.find((x) => x.id === 'forge'); if (w) go(w, 'forge-prog'); document.dispatchEvent(new CustomEvent('neuralese:forge-demo')); } },
    { id: 'walk-run', title: 'Deep Walk: run the prompt', hint: 'one real forward, then the zoom ladder', run: () => { const w = WORKSPACES.find((x) => x.id === 'walk'); if (w) go(w, 'walk-read'); document.dispatchEvent(new CustomEvent('neuralese:walk-run')); } },
    { id: 'wm-run', title: 'Machine Room: run hello', hint: 'weight gadgets checked against the int32 reference', run: () => { const w = WORKSPACES.find((x) => x.id === 'machine'); if (w) go(w, 'wm-room'); document.dispatchEvent(new CustomEvent('neuralese:wm-hello')); } },
  ];
  onMount(() => {
    const onKey = (e: KeyboardEvent): void => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement | null)?.tagName ?? '');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopImmediatePropagation(); setPal(true); return; }
      if (!typing && e.key === '/' ) { e.preventDefault(); e.stopImmediatePropagation(); setPal(true); return; }
      if (e.altKey && /^[0-9]$/.test(e.key)) { const w = WORKSPACES.find((x) => x.key === e.key); if (w) { e.preventDefault(); go(w); } }
    };
    addEventListener('keydown', onKey, true); onCleanup(() => removeEventListener('keydown', onKey, true));
    const onR = (): void => { setCompact(innerWidth < 760); }; addEventListener('resize', onR);
    // follow the legacy theme switch (documentElement[data-theme])
    const syncTheme = (): void => { setThemeSig(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'); }; syncTheme();
    new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    // legacy code that calls showTab(k) on its own (links, terminal, quiz) → bring that tab's workspace forward
    document.addEventListener('neuralese:tab', (e) => { if (isShowing()) return; const k = (e as CustomEvent<string>).detail; if (activeLegacy.has(k)) return; const w = workspaceOfLegacy(k); if (w) go(w, 'legacy:' + k); });
    if (!store.get(TOUR_KEY) && !/notour/.test(location.search)) setTour(true);
  });
  return <div class="v17" classList={{ compact: compact() }} data-theme={theme()}>
    <nav class="wsbar" aria-label="workspaces">
      <For each={WORKSPACES}>{(w) => <button classList={{ on: w.id === ws().id }} aria-current={w.id === ws().id ? 'page' : undefined} title={`${w.blurb}${/^[0-9]$/.test(w.key) ? ` (Alt+${w.key})` : ''}`} data-ws={w.id} data-feature={`feature-ws-${w.id}`} onClick={() => go(w)}>{w.title}</button>}</For>
      <span class="sp" />
      <button class="palbtn" data-feature="feature-action-palette" onClick={() => setPal(true)} aria-label="open command palette" title="Command palette (Ctrl/⌘+K)">⌘K search</button>
    </nav>
    <main class="dock" aria-label={`${ws().title} workspace`}>
      <Show when={compact()} fallback={<Dock node={layout()} set={setLayout} root={layout()} compact={false} />}>
        <Dock node={flatten(ws(), layout())} set={(n) => setLayout(n)} root={flatten(ws(), layout())} compact />
      </Show>
    </main>
    <Palette open={pal()} setOpen={setPal} cmds={cmds} />
    <Tour open={tour()} setOpen={setTour} />
    <span class="sr-only" aria-live="polite">{ws().title} workspace, {panels(layout()).length} panels{Object.keys(NATIVE_PANELS).length ? '' : ''}</span>
  </div>;
}

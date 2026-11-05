// Renders a layout tree: splits with keyboard-resizable separators, tab groups with ARIA tabs; tabs can be split
// right/down, closed, or dragged onto another group. Panels stay mounted only while visible.
import { createMemo, For, Match, Show, Switch, untrack, type JSX } from 'solid-js';
import { closePanel, movePanel, resize, splitPanel, activate, type Node } from './core/layout';
import { NATIVE_PANELS } from './core/workspaces';
import { legacy } from './core/bridge';
import { CosmosPanel, LegacyPanel, NestedPanel, NotebookPanel, OutputPanel, SelectionPanel } from './panels/Panels';
import { AdversaryPanel } from './panels/Adversary';
import { ForgePanel } from './panels/Forge';
import { WalkPanel } from './panels/Walk';
import { MachinePanel } from './panels/Machine';
export function panelTitle(id: string): string { if (id.startsWith('legacy:')) { const k = id.slice(7); const lg = legacy(); return lg?.long[k] ?? lg?.order.find((o) => o[0] === k)?.[1] ?? k; } return NATIVE_PANELS[id] ?? id; }
function Panel(p: { id: string }): JSX.Element {
  return <Switch fallback={<LegacyPanel k={p.id.slice(7)} />}>
    <Match when={p.id === 'cosmos'}><CosmosPanel /></Match><Match when={p.id === 'nested3d'}><NestedPanel /></Match>
    <Match when={p.id === 'notebook'}><NotebookPanel /></Match><Match when={p.id === 'selection'}><SelectionPanel /></Match><Match when={p.id === 'output'}><OutputPanel /></Match>
    <Match when={p.id.startsWith('adv-')}><AdversaryPanel id={p.id} /></Match>
    <Match when={p.id.startsWith('forge-')}><ForgePanel id={p.id} /></Match>
    <Match when={p.id.startsWith('walk-')}><WalkPanel id={p.id} /></Match>
    <Match when={p.id.startsWith('wm-')}><MachinePanel id={p.id} /></Match>
  </Switch>;
}
// Structural key: a subtree is re-created only when its shape changes, never on resize or tab activation, so heavy
// panels (3D, adopted legacy panes) are not remounted while dragging a gutter.
const structKey = (n: Node): string => (n.kind === 'tabs' ? `t:${n.id}:${n.panels.join(',')}` : `s:${n.id}:${n.dir}(${n.children.map(structKey).join('|')})`);
export function Dock(p: { node: Node; set: (n: Node) => void; root: Node; compact: boolean }): JSX.Element {
  const key = createMemo(() => structKey(p.node));
  return <Show when={key()} keyed>{(_k: string) => untrack(() => DockInner(p))}</Show>;
}
function DockInner(p: { node: Node; set: (n: Node) => void; root: Node; compact: boolean }): JSX.Element {
  const n = p.node;
  if (n.kind === 'split') {
    const sp = (): Extract<Node, { kind: 'split' }> => p.node as Extract<Node, { kind: 'split' }>;
    return <div class="split" classList={{ col: n.dir === 'col' }}>
      <For each={n.children}>{(c, i) => <>
        {i() > 0 && <div class="gutter" role="separator" tabindex="0" aria-orientation={n.dir === 'row' ? 'vertical' : 'horizontal'} aria-label="resize panels" aria-valuemin={8} aria-valuemax={92} aria-valuenow={Math.round((sp().sizes[i() - 1] ?? 0.5) * 100)}
          onKeyDown={(e) => { const d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -0.04 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 0.04 : 0; if (!d) return; e.preventDefault(); const s = sp().sizes.slice(); s[i() - 1]! += d; s[i()]! -= d; p.set(resize(p.root, n.id, s)); }}
          onPointerDown={(e) => { const par = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); const tot = n.dir === 'row' ? par.width : par.height; const s0 = sp().sizes.slice(), x0 = n.dir === 'row' ? e.clientX : e.clientY; e.currentTarget.setPointerCapture(e.pointerId);
            const mv = (ev: PointerEvent): void => { const dd = ((n.dir === 'row' ? ev.clientX : ev.clientY) - x0) / tot; const s = s0.slice(); s[i() - 1] = s0[i() - 1]! + dd; s[i()] = s0[i()]! - dd; p.set(resize(p.root, n.id, s)); };
            const up = (): void => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); }} />}
        <div class="cell-wrap" style={{ flex: `${sp().sizes[i()] ?? 1} 1 0` }}><Dock node={sp().children[i()] ?? c} set={p.set} root={p.root} compact={p.compact} /></div>
      </>}</For>
    </div>;
  }
  const g = (): Extract<Node, { kind: 'tabs' }> => p.node as Extract<Node, { kind: 'tabs' }>;
  const act = (): string => g().panels[Math.min(g().active, g().panels.length - 1)] ?? '';
  return <div class="group" data-group={n.id} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer?.getData('text/x-panel'); if (id) p.set(movePanel(p.root, id, n.id)); }}>
    <div class="tabstrip" role="tablist" aria-label="panels">
      <For each={n.panels}>{(id) =>
        <button role="tab" class="tab" classList={{ on: id === act() }} id={`tab-${id}`} aria-selected={id === act()} aria-controls={`panel-${id}`} draggable="true" data-panel={id} data-feature={id.startsWith('legacy:') ? `feature-tab-${id.slice(7)}` : `feature-panel-${id}`}
          onDragStart={(e) => e.dataTransfer?.setData('text/x-panel', id)}
          onClick={() => p.set(activate(p.root, id))}
          onKeyDown={(e) => { const j = n.panels.indexOf(id) + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0); if (j !== n.panels.indexOf(id) && n.panels[j]) { e.preventDefault(); p.set(activate(p.root, n.panels[j]!)); queueMicrotask(() => document.getElementById(`tab-${n.panels[j]}`)?.focus()); } }}>{panelTitle(id)}</button>
      }</For>
    </div>
    <Show when={!p.compact}>
      <div class="tabtools">
        <For each={n.panels}>{(id) => <>
          {n.panels.length > 1 && <><button class="tx" title="split right" aria-label={`split ${panelTitle(id)} to the right`} onClick={() => p.set(splitPanel(p.root, n.id, id, 'right'))}>◫</button><button class="tx" title="split down" aria-label={`split ${panelTitle(id)} down`} onClick={() => p.set(splitPanel(p.root, n.id, id, 'bottom'))}>⬓</button></>}
          <button class="tx" title="close (reopen from the palette)" aria-label={`close ${panelTitle(id)}`} onClick={() => { const r = closePanel(p.root, id); if (r) p.set(r); }}>×</button>
        </>}</For>
      </div>
    </Show>
    <div class="panel" role="tabpanel" id={`panel-${act()}`} aria-labelledby={`tab-${act()}`} data-panel={act()}>
      <For each={[act()]}>{(id) => <Panel id={id} />}</For>
    </div>
  </div>;
}

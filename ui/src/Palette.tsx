// Command palette (Ctrl/⌘+K, also "/"): the main way to navigate. Fuzzy search across workspaces, every panel
// (all 75 legacy tabs + v17 panels) and app actions. Built on Kobalte's accessible Dialog.
import { Dialog } from '@kobalte/core/dialog';
import { createMemo, createSignal, For, type JSX } from 'solid-js';
export interface Cmd { id: string; title: string; hint: string; run: () => void }
export function score(q: string, s: string): number { // subsequence match; contiguous and word-start hits score higher
  if (!q) return 1; q = q.toLowerCase(); s = s.toLowerCase(); const at = s.indexOf(q); if (at >= 0) return 100 - at + (at === 0 || s[at - 1] === ' ' ? 50 : 0);
  let j = 0, sc = 0; for (let i = 0; i < s.length && j < q.length; i++) if (s[i] === q[j]) { sc += 1; j++; } return j === q.length ? sc : 0;
}
export function Palette(p: { open: boolean; setOpen: (b: boolean) => void; cmds: () => Cmd[] }): JSX.Element {
  const [q, setQ] = createSignal(''); const [i, setI] = createSignal(0);
  const list = createMemo(() => p.cmds().map((c) => ({ c, s: Math.max(score(q(), c.title), score(q(), c.hint) * 0.5) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 60).map((x) => x.c));
  const go = (c: Cmd | undefined): void => { if (!c) return; p.setOpen(false); setQ(''); setI(0); c.run(); };
  return <Dialog open={p.open} onOpenChange={p.setOpen}>
    <Dialog.Portal><Dialog.Overlay class="pal-ov" /><div class="pal-pos"><Dialog.Content class="pal" aria-label="command palette">
      <Dialog.Title class="sr-only">Command palette</Dialog.Title>
      <input class="pal-in" placeholder="Go to workspace, panel or action…" value={q()} aria-controls="pal-list" aria-activedescendant={list()[i()] ? `pc-${list()[i()]!.id}` : undefined}
        onInput={(e) => { setQ(e.currentTarget.value); setI(0); }}
        onKeyDown={(e) => { if (e.key === 'ArrowDown') { setI(Math.min(list().length - 1, i() + 1)); e.preventDefault(); } else if (e.key === 'ArrowUp') { setI(Math.max(0, i() - 1)); e.preventDefault(); } else if (e.key === 'Enter') go(list()[i()]); }} />
      <div id="pal-list" role="listbox" class="pal-list"><For each={list()}>{(c, k) => <div role="option" id={`pc-${c.id}`} aria-selected={k() === i()} classList={{ on: k() === i() }} onMouseEnter={() => setI(k())} onClick={() => go(c)}><b>{c.title}</b><span>{c.hint}</span></div>}</For>
        {!list().length && <div class="pal-empty">no match</div>}</div>
    </Dialog.Content></div></Dialog.Portal>
  </Dialog>;
}

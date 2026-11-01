// Virtualized table: renders only the visible rows (fixed row height), keyboard-scrollable, ARIA grid semantics.
import { createSignal, For, type JSX } from 'solid-js';
export function VirtualTable<T>(p: { rows: T[]; cols: { h: string; f: (r: T) => JSX.Element }[]; rowH?: number; height?: number; label: string; onRow?: (r: T) => void }): JSX.Element {
  const rh = p.rowH ?? 24, H = p.height ?? 260; const [top, setTop] = createSignal(0);
  const first = (): number => Math.max(0, Math.floor(top() / rh) - 4), last = (): number => Math.min(p.rows.length, Math.ceil((top() + H) / rh) + 4);
  return (
    <div class="vt" role="grid" aria-label={p.label} aria-rowcount={p.rows.length} tabindex="0" style={{ height: `${H}px` }} onScroll={(e) => setTop(e.currentTarget.scrollTop)}>
      <div class="vt-head" role="row"><For each={p.cols}>{(c) => <span role="columnheader">{c.h}</span>}</For></div>
      <div style={{ height: `${p.rows.length * rh}px`, position: 'relative' }}>
        <For each={p.rows.slice(first(), last())}>{(r, i) => (
          <div class="vt-row" role="row" aria-rowindex={first() + i() + 1} style={{ top: `${(first() + i()) * rh}px`, height: `${rh}px` }} onClick={() => p.onRow?.(r)}>
            <For each={p.cols}>{(c) => <span role="gridcell">{c.f(r)}</span>}</For>
          </div>)}</For>
      </div>
    </div>
  );
}

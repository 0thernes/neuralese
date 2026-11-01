// uPlot line chart (canvas). Series come straight from the caller; nothing is interpolated or invented.
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { createEffect, onCleanup, type JSX } from 'solid-js';
export interface Series { label: string; ys: number[]; color: string }
export function LineChart(p: { xs: number[]; series: Series[]; title: string; xLabel: string; height?: number; ref?: (c: HTMLCanvasElement | null) => void }): JSX.Element {
  let host!: HTMLDivElement; let plot: uPlot | null = null;
  createEffect(() => {
    const xs = p.xs, ss = p.series; plot?.destroy(); if (!xs.length) return;
    plot = new uPlot({ width: Math.max(240, host.clientWidth || 480), height: p.height ?? 200, title: p.title, scales: { x: { time: false } }, axes: [{ label: p.xLabel, stroke: 'currentColor' }, { stroke: 'currentColor' }], series: [{}, ...ss.map((s) => ({ label: s.label, stroke: s.color, width: 1.5 }))] }, [xs, ...ss.map((s) => s.ys)], host);
    p.ref?.(host.querySelector('canvas'));
  });
  const ro = new ResizeObserver(() => plot?.setSize({ width: Math.max(240, host.clientWidth), height: p.height ?? 200 }));
  createEffect(() => ro.observe(host));
  onCleanup(() => { ro.disconnect(); plot?.destroy(); });
  return <div class="chart" ref={host} role="img" aria-label={p.title} />;
}

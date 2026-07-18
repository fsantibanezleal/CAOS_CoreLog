import { useCallback, useMemo } from 'react';
import type uPlot from 'uplot';
import { LITHO_INFO, LITHOLOGIES, type Lithology } from '../cv/types.ts';
import { UPlotChart, themeColors } from './UPlotChart.tsx';

export interface ScatterPoint { x: number; y: number; litho?: Lithology; real?: boolean; label: string; }

/** A 2D PCA scatter of colour/texture features, INTERACTIVE (uPlot Tier-A): the synthetic lithology clouds
 * (rock-coloured points, one series per class, toggle/solo from the legend) plus the real DCID patch windows
 * (their own series). When the real points land away from every synthetic cloud, that gap IS the
 * out-of-distribution story. Crosshair + live PC1/PC2 readout, drag-zoom, double-click reset, theme-aware.
 * All points share one sorted-x axis; each series carries nulls outside its own points (uPlot aligned data). */
export function LatentScatter({ points, lang = 'en', height = 340 }: { points: ScatterPoint[]; lang?: 'en' | 'es'; height?: number }) {
  const es = lang === 'es';

  const data = useMemo(() => {
    const sorted = [...points].sort((a, b) => a.x - b.x);
    const xs = sorted.map((p) => p.x);
    const cols: (number | null)[][] = [];
    for (const l of LITHOLOGIES) cols.push(sorted.map((p) => (!p.real && p.litho === l ? p.y : null)));
    cols.push(sorted.map((p) => (p.real ? p.y : null)));            // the real DCID series, last
    return [xs, ...cols] as uPlot.AlignedData;
  }, [points]);

  const build = useCallback((width: number, h: number): uPlot.Options => {
    const c = themeColors();
    const fmt = (v: number | null) => (v == null ? '--' : v.toFixed(2));
    return {
      width, height: h,
      scales: { x: { time: false } },
      axes: [
        { stroke: c.subtle, grid: { stroke: c.border }, ticks: { stroke: c.border }, label: 'PC1', labelSize: 12 },
        { stroke: c.subtle, grid: { stroke: c.border }, ticks: { stroke: c.border }, label: 'PC2', labelSize: 12 },
      ],
      series: [
        { label: 'PC1', value: (_u, v) => fmt(v) },
        ...LITHOLOGIES.map((l) => {
          const [r, g, b] = LITHO_INFO[l].rgb;
          const col = `rgb(${r},${g},${b})`;
          return {
            label: es ? LITHO_INFO[l].es : LITHO_INFO[l].en,
            stroke: col, width: 0, paths: () => null,
            points: { show: true, size: 6, fill: col, stroke: col },
            value: (_u: uPlot, v: number | null) => fmt(v),
          };
        }),
        {
          label: es ? 'parche real (DCID)' : 'real patch (DCID)',
          stroke: c.fg, width: 0, paths: () => null,
          points: { show: true, size: 8, fill: 'transparent', stroke: c.fg, width: 1.8 },
          value: (_u: uPlot, v: number | null) => fmt(v),
        },
      ],
      cursor: { drag: { x: true, y: true } },
      legend: { live: true },
    };
  }, [es]);

  return (
    <div className="cl-scatter">
      <UPlotChart data={data} build={build} height={height} />
      <p className="pf-cap pf-muted" style={{ marginTop: '0.2rem' }}>
        {es
          ? 'Un punto por parche en el plano PC1/PC2. Clic en la leyenda para aislar una clase; arrastra para hacer zoom; doble clic para restablecer.'
          : 'One point per patch on the PC1/PC2 plane. Click a legend entry to isolate a class; drag to zoom; double-click to reset.'}
      </p>
    </div>
  );
}

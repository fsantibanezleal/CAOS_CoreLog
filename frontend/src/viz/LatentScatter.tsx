import { useMemo, useState } from 'react';
import { LITHO_INFO, LITHOLOGIES, type Lithology } from '../cv/types.ts';

export interface ScatterPoint { x: number; y: number; litho?: Lithology; real?: boolean; label: string; }

/** A 2D PCA scatter of colour/texture features: the synthetic lithology clouds (filled dots, rock-coloured) plus the
 * real DCID patch windows (hollow diamonds). When the real points land away from every synthetic cloud, that gap IS
 * the out-of-distribution story. Pure SVG, theme-aware via currentColor, hover readout. */
export function LatentScatter({ points, lang = 'en', height = 340 }: { points: ScatterPoint[]; lang?: 'en' | 'es'; height?: number }) {
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const W = 560;
  const H = height;
  const pad = 26;

  const { sx, sy } = useMemo(() => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const x0 = Math.min(...xs); const x1 = Math.max(...xs);
    const y0 = Math.min(...ys); const y1 = Math.max(...ys);
    const sx = (x: number) => pad + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * pad);
    const sy = (y: number) => H - pad - ((y - y0) / (y1 - y0 || 1)) * (H - 2 * pad);
    return { sx, sy };
  }, [points, H]);

  return (
    <div className="cl-scatter" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={lang === 'es' ? 'dispersion latente' : 'latent scatter'}>
        <rect x={0} y={0} width={W} height={H} fill="none" stroke="var(--color-border)" rx={8} />
        <text x={pad} y={H - 6} fontSize={11} fill="var(--color-fg-subtle)">PC1</text>
        <text x={6} y={pad} fontSize={11} fill="var(--color-fg-subtle)">PC2</text>
        {points.map((p, i) => {
          const cx = sx(p.x); const cy = sy(p.y);
          const onEnter = (e: React.MouseEvent) => setHover({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, text: p.label });
          if (p.real) {
            return <path key={i} d={`M ${cx} ${cy - 5} L ${cx + 5} ${cy} L ${cx} ${cy + 5} L ${cx - 5} ${cy} Z`}
              fill="none" stroke="var(--color-fg)" strokeWidth={1.8} onMouseEnter={onEnter} onMouseLeave={() => setHover(null)} />;
          }
          const [r, g, b] = LITHO_INFO[p.litho as Lithology].rgb;
          return <circle key={i} cx={cx} cy={cy} r={3.2} fill={`rgb(${r},${g},${b})`} fillOpacity={0.75}
            onMouseEnter={onEnter} onMouseLeave={() => setHover(null)} />;
        })}
      </svg>
      <div className="cl-scatter-legend">
        {LITHOLOGIES.map((l) => (
          <span key={l} className="cl-scatter-key">
            <span className="cl-sw" style={{ background: `rgb(${LITHO_INFO[l].rgb.join(',')})` }} />
            {lang === 'es' ? LITHO_INFO[l].es : LITHO_INFO[l].en}
          </span>
        ))}
        <span className="cl-scatter-key"><span className="cl-sw cl-sw-real" /> {lang === 'es' ? 'parche real (DCID)' : 'real patch (DCID)'}</span>
      </div>
      {hover && <div className="heatmap-readout" style={{ left: Math.min(hover.x + 10, W - 60), top: hover.y + 10 }}>{hover.text}</div>}
    </div>
  );
}

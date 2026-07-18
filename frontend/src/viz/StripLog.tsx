import { useMemo, useState } from 'react';
import { LITHO_INFO, type Lithology } from '../cv/types.ts';

export interface StripBand { depthFrom: number; depthTo: number; litho: string; conf: number; ood: boolean }

/** A geologist's depth strip-log: a vertical column with depth increasing downward, coloured by lithology, confidence
 * shown as opacity, OOD bands hatched. Hover reads depth + lithology + confidence. SVG (crisp + accessible). */
export function StripLog({ bands, depthFrom, depthTo, height = 360, lang = 'en' }: {
  bands: StripBand[]; depthFrom: number; depthTo: number; height?: number; lang?: 'en' | 'es';
}) {
  const [hover, setHover] = useState<StripBand | null>(null);
  const span = Math.max(1e-6, depthTo - depthFrom);
  const y = (d: number) => ((d - depthFrom) / span) * height;
  // merge consecutive same-lithology bands for a cleaner column
  const merged = useMemo(() => {
    const out: StripBand[] = [];
    for (const b of [...bands].sort((a, z) => a.depthFrom - z.depthFrom)) {
      const last = out[out.length - 1];
      if (last && last.litho === b.litho && Math.abs(last.depthTo - b.depthFrom) < 1e-6 && last.ood === b.ood) {
        last.depthTo = b.depthTo;
        last.conf = (last.conf + b.conf) / 2;
      } else out.push({ ...b });
    }
    return out;
  }, [bands]);
  const ticks = useMemo(() => {
    const t: number[] = [];
    const step = span <= 1 ? 0.1 : 0.25;
    for (let d = Math.ceil(depthFrom / step) * step; d <= depthTo + 1e-9; d += step) t.push(Math.round(d * 100) / 100);
    return t;
  }, [depthFrom, depthTo, span]);

  return (
    <div className="cl-strip" style={{ display: 'flex', gap: '0.6rem' }}>
      <svg width="56" height={height} style={{ overflow: 'visible', flex: '0 0 auto' }}>
        {ticks.map((d) => (
          <g key={d}>
            <line x1={48} x2={56} y1={y(d)} y2={y(d)} stroke="var(--color-fg-faint)" />
            <text x={44} y={y(d) + 3} textAnchor="end" fontSize="9" fill="var(--color-fg-subtle)">{d.toFixed(2)}</text>
          </g>
        ))}
        <text x={4} y={height / 2} fontSize="9" fill="var(--color-fg-faint)" transform={`rotate(-90 8 ${height / 2})`}>
          {lang === 'es' ? 'profundidad (m)' : 'depth (m)'}
        </text>
      </svg>
      <svg width="44" height={height} style={{ border: '1px solid var(--color-border)', borderRadius: 4 }}
           onMouseLeave={() => setHover(null)}>
        {merged.map((b, i) => {
          const [r, g, bl] = LITHO_INFO[b.litho as Lithology].rgb;
          const yy = y(b.depthFrom);
          const hh = Math.max(1, y(b.depthTo) - yy);
          return (
            <g key={i} onMouseEnter={() => setHover(b)}>
              <rect x={0} y={yy} width={44} height={hh} fill={`rgb(${r},${g},${bl})`} opacity={0.55 + 0.45 * b.conf} />
              {b.ood && <rect x={0} y={yy} width={44} height={hh} fill="url(#hatch)" />}
            </g>
          );
        })}
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(248,81,73,0.8)" strokeWidth="1.5" />
          </pattern>
        </defs>
      </svg>
      <div className="cl-strip-read">
        {hover ? (
          <>
            <b>{lang === 'es' ? LITHO_INFO[hover.litho as Lithology].es : LITHO_INFO[hover.litho as Lithology].en}</b>
            <div className="pf-cap">{hover.depthFrom.toFixed(2)}–{hover.depthTo.toFixed(2)} m · {(hover.conf * 100).toFixed(0)}%{hover.ood ? (lang === 'es' ? ' · incierto' : ' · uncertain') : ''}</div>
          </>
        ) : <div className="pf-cap pf-muted">{lang === 'es' ? 'cursor sobre el log' : 'hover the log'}</div>}
      </div>
    </div>
  );
}

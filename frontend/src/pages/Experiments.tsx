import { useEffect, useState } from 'react';
import { Callout, useShellLang } from '@fasl-work/caos-app-shell';
import { loadCaseResults } from '../lib/artifacts.ts';
import type { CaseResultsFile } from '../lib/contract.types.ts';

export default function Experiments() {
  const es = useShellLang() === 'es';
  const [data, setData] = useState<CaseResultsFile | null>(null);
  useEffect(() => { loadCaseResults().then(setData).catch(() => setData(null)); }, []);

  return (
    <article className="pf-doc">
      <h1>{es ? 'Experimentos' : 'Experiments'}</h1>
      <p className="pf-lead">{es
        ? 'Cada caso es un experimento con un ancla de validación: una propiedad que el resultado DEBE cumplir. Todas se chequean en el horneado (frontend/test/contract.test.ts).'
        : 'Each case is an experiment with a validation anchor: a property the result MUST satisfy. They are all checked in the bake (frontend/test/contract.test.ts).'}</p>

      {!data ? <p className="pf-note">{es ? 'cargando casos…' : 'loading cases…'}</p> : (
        <div className="pf-exp-grid">
          {Object.entries(data.cases).map(([id, c]) => (
            <div key={id} className="pf-card">
              <div className="pf-exp-h"><b>{id}</b> <span>{c.name}</span></div>
              <div className="pf-cap pf-muted">{c.category.split(' (')[0]}</div>
              <div className="pf-kpis">
                <div className="pf-kpi"><div className="pf-kpi-v">{(c.baseline.pixelAccuracy * 100).toFixed(0)}%</div><div className="pf-kpi-l">{es ? 'baseline acc' : 'baseline acc'}</div></div>
                <div className="pf-kpi"><div className="pf-kpi-v">{c.truth.length}</div><div className="pf-kpi-l">{es ? 'segmentos' : 'segments'}</div></div>
                <div className="pf-kpi"><div className="pf-kpi-v">{c.spec.nChannels}</div><div className="pf-kpi-l">{es ? 'canales' : 'channels'}</div></div>
              </div>
              <div className="pf-anchor">⚓ {c.validationAnchor}</div>
              <div className="pf-cap">{c.expectedBand}</div>
            </div>
          ))}
        </div>
      )}

      <Callout variant="strong" title={es ? 'Los oráculos' : 'The oracles'}>
        {es
          ? 'C-UNIFORM es una bandeja de una sola litología (caliza) → el clasificador debe acertar ~todo (>0.85). C-SHARP tiene dos litologías con un límite agudo conocido → la segmentación run-merge debe recuperar ese límite (±20 px). Son las anclas de exactitud del pipeline.'
          : 'C-UNIFORM is a single-lithology tray (limestone) → the classifier must get ~everything right (>0.85). C-SHARP has two lithologies with a known sharp boundary → the run-merge segmentation must recover it (±20 px). These are the pipeline’s exactness anchors.'}
      </Callout>
    </article>
  );
}

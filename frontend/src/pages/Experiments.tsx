import { useEffect, useState } from 'react';
import { Callout, InlineMath, Refs, useShellLang } from '@fasl-work/caos-app-shell';
import { loadCaseResults, loadOodBench, type OodBenchFile } from '../lib/artifacts.ts';
import type { CaseResultsFile } from '../lib/contract.types.ts';

export default function Experiments() {
  const es = useShellLang() === 'es';
  const [data, setData] = useState<CaseResultsFile | null>(null);
  const [ood, setOod] = useState<OodBenchFile | null>(null);
  useEffect(() => { loadCaseResults().then(setData).catch(() => setData(null)); }, []);
  useEffect(() => { loadOodBench().then(setOod).catch(() => setOod(null)); }, []);

  return (
    <article className="page-body prose">
      <h1>{es ? 'Experimentos' : 'Experiments'}</h1>
      <p className="lede">{es
        ? 'Cada caso es un experimento con un ancla de validación: una propiedad que el resultado debe cumplir. Todas se chequean en el precálculo (frontend/test/contract.test.ts).'
        : 'Each case is an experiment with a validation anchor: a property the result must satisfy. They are all checked in the bake (frontend/test/contract.test.ts).'}</p>

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
          ? 'C-UNIFORM es una bandeja de una sola litología (caliza) · el clasificador debe acertar ~todo (>0.85). C-SHARP tiene dos litologías con un límite agudo conocido · la segmentación run-merge debe recuperar ese límite (±20 px). Son las anclas de exactitud del pipeline.'
          : 'C-UNIFORM is a single-lithology tray (limestone) · the classifier must get ~everything right (>0.85). C-SHARP has two lithologies with a known sharp boundary · the run-merge segmentation must recover it (±20 px). These are the pipeline’s exactness anchors.'}
      </Callout>

      <h2>{es ? 'Protocolo OOD: split seguro ante fugas, dedupe y control nulo' : 'OOD protocol: leakage-safe split, dedupe and null control'}</h2>
      <p>{es
        ? 'La contribución de features-OOD + cabeza real se mide offline (data-pipeline/cllab/science/ood_bench.py) sobre DCID-7 completo, no sobre los pocos parches embarcados. El protocolo evita las fugas que inflarían la exactitud.'
        : 'The feature-OOD + real-head contribution is measured offline (data-pipeline/cllab/science/ood_bench.py) over the full DCID-7, not the few shipped patches. The protocol avoids the leakage that would inflate accuracy.'}</p>
      <ul className="pf-list">
        <li><b>{es ? 'Split seguro ante fugas' : 'Leakage-safe split'}</b>: {es
          ? 'se usa el split train/test propio de DCID (imágenes fuente distintas), más deduplicación por hash perceptual entre lados para eliminar casi-duplicados. Las carpetas de aumentación RWDA (noise-*) se excluyen por completo.'
          : 'DCID\'s OWN train/test split (distinct source images) plus a perceptual-hash dedupe across sides to drop near-duplicates. The RWDA augmentation folders (noise-*) are excluded entirely.'}</li>
        <li><b>{es ? 'Espacio nativo DCID-7' : 'Native DCID-7 space'}</b>: {es
          ? 'la cabeza real se evalúa en las 7 clases nativas de DCID (sin mapeo), para que la confusión no sea artefacto del mapeo a 6 clases de CoreLog.'
          : 'the real head is evaluated in DCID\'s 7 native classes (no mapping), so the confusion is not an artefact of the mapping to CoreLog\'s 6 classes.'}</li>
        <li><b>{es ? 'Resolución controlada' : 'Controlled resolution'}</b>: {es
          ? 'para el OOD, ambas fuentes pasan por 24 px (la resolución de ventana en vivo), así ningún backbone separa por desenfoque en vez de por dominio.'
          : 'for OOD, both sources funnel through 24 px (the live window resolution), so no backbone separates on blur instead of domain.'}</li>
      </ul>
      {ood ? (
        <>
          <p className="mono">{es ? 'Datos' : 'Data'}: synth {ood.data.synthTrain}+{ood.data.synthIdEval} · DCID train {ood.data.dcidTrain} · DCID test {ood.data.dcidTest} · {es ? 'dedupe eliminó' : 'dedupe dropped'} {ood.data.dedupeDropped}</p>
          <Callout variant={ood.controls.nullCollapsedToChance ? 'strong' : 'honest'} title={es ? 'Control nulo por permutación de etiquetas' : 'Label-permutation null control'}>
            {es
              ? `Al permutar las etiquetas de entrenamiento de DCID-7 y reentrenar la cabeza, la exactitud debe colapsar al azar (1/7 = ${(ood.controls.chance * 100).toFixed(1)}%). Medido: ${(ood.controls.labelPermutationNullTop1 * 100).toFixed(1)}%. ${ood.controls.nullCollapsedToChance ? 'Colapsa, no hay fuga.' : 'No colapsa, revisar fuga.'} Con etiquetas verdaderas la cabeza real logra top-1 ${((ood.realHead.candidates[ood.realHead.shipped]?.top1 ?? 0) * 100).toFixed(1)}% sobre el split real retenido.`
              : `Permuting the DCID-7 training labels and retraining the head, accuracy must collapse to chance (1/7 = ${(ood.controls.chance * 100).toFixed(1)}%). Measured: ${(ood.controls.labelPermutationNullTop1 * 100).toFixed(1)}%. ${ood.controls.nullCollapsedToChance ? 'It collapses, so there is no leakage.' : 'It does not collapse, check for leakage.'} With true labels the real head reaches top-1 ${((ood.realHead.candidates[ood.realHead.shipped]?.top1 ?? 0) * 100).toFixed(1)}% on the held-out real split.`}
          </Callout>
          <p>{es ? 'Métricas OOD: ' : 'OOD metrics: '}<InlineMath tex="\mathrm{AUROC}" />{es ? ' (área bajo ROC), ' : ' (area under ROC), '}<InlineMath tex="\mathrm{AUPR}" />{es ? ' (precision-recall) y ' : ' (precision-recall) and '}<InlineMath tex="\mathrm{FPR}@95\mathrm{TPR}" />{es ? ' (falsos positivos cuando se detecta 95% de OOD). La tabla completa de detectores está en Benchmark.' : ' (false positives when 95% of OOD is caught). The full detector table is on Benchmark.'}</p>
          <Refs ids={['lee2018', 'sun2022', 'liu2020', 'hendrycks2017', 'li2025dcid']} label={es ? 'Refs' : 'Refs'} />
        </>
      ) : <p className="pf-note">{es ? 'ood-bench.json no cargó (ejecutar ood_bench.py).' : 'ood-bench.json not loaded (run ood_bench.py).'}</p>}
    </article>
  );
}

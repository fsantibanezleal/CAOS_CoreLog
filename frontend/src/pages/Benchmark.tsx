import { useEffect, useState } from 'react';
import { Callout, useShellLang } from '@fasl-work/caos-app-shell';
import { loadCaseResults, loadLearned, type LearnedFile } from '../lib/artifacts.ts';
import type { CaseResultsFile } from '../lib/contract.types.ts';
import { ConfusionMatrix } from '../viz/ConfusionMatrix.tsx';
import { LITHOLOGIES } from '../cv/types.ts';

export default function Benchmark() {
  const es = useShellLang() === 'es';
  const [data, setData] = useState<CaseResultsFile | null>(null);
  const [learned, setLearned] = useState<LearnedFile | null>(null);
  useEffect(() => { loadCaseResults().then(setData).catch(() => setData(null)); }, []);
  useEffect(() => { loadLearned().then(setLearned).catch(() => setLearned(null)); }, []);

  // aggregate confusion across all cases (the cross-case view that does NOT belong in the App)
  const agg = (() => {
    if (!data) return null;
    const K = LITHOLOGIES.length;
    const m = Array.from({ length: K }, () => new Array(K).fill(0));
    for (const c of Object.values(data.cases)) {
      for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) m[i][j] += c.baseline.confusion[i][j];
    }
    return m;
  })();

  return (
    <article className="page-body prose">
      <h1>Benchmark</h1>
      <p className="lede">{es
        ? 'Comparaciones cruzadas — las que NO dependen de un solo caso van aquí (no en la App). Todas salen del horneado del engine TS.'
        : 'Cross-case comparisons — the ones that do NOT depend on a single case live here (not in the App). All come from the TS-engine bake.'}</p>

      {!data ? <p className="pf-note">{es ? 'cargando…' : 'loading…'}</p> : (
        <>
          <h2>{es ? 'Precisión del baseline por caso' : 'Baseline accuracy by case'}</h2>
          <table className="cmp-table">
            <thead><tr><th>{es ? 'caso' : 'case'}</th><th>{es ? 'categoría' : 'category'}</th><th>{es ? 'precisión' : 'accuracy'}</th><th>{es ? 'segmentos' : 'segments'}</th></tr></thead>
            <tbody>
              {Object.entries(data.cases).map(([id, c]) => (
                <tr key={id}>
                  <td><b>{id}</b></td><td>{c.category.split(' (')[0]}</td>
                  <td>{(c.baseline.pixelAccuracy * 100).toFixed(1)}%</td><td>{c.truth.length}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>{es ? 'Robustez a la calidad de imagen' : 'Image-quality robustness'}</h2>
          <p>{es ? 'Mismo pórfido, distinta calidad — la precisión del baseline cae con la iluminación:' : 'Same porphyry, different quality — baseline accuracy drops with lighting:'}</p>
          <p className="mono">
            clean {(data.cases['Q-CLEAN'].baseline.pixelAccuracy * 100).toFixed(1)}% ≥
            shadow {(data.cases['Q-SHADOW'].baseline.pixelAccuracy * 100).toFixed(1)}% ≥
            wet {(data.cases['Q-WET'].baseline.pixelAccuracy * 100).toFixed(1)}%
          </p>

          {agg && (
            <>
              <h2>{es ? 'Matriz de confusión agregada (baseline, todos los casos)' : 'Aggregate confusion matrix (baseline, all cases)'}</h2>
              <ConfusionMatrix confusion={agg} lang={es ? 'es' : 'en'} />
            </>
          )}
        </>
      )}

      <h2>{es ? 'CNN vs baseline' : 'CNN vs baseline'}</h2>
      {learned ? (
        <table className="cmp-table">
          <thead><tr><th>{es ? 'modelo' : 'model'}</th><th>{es ? 'métrica' : 'metric'}</th><th>{es ? 'aprendido' : 'learned'}</th><th>{es ? 'baseline' : 'baseline'}</th></tr></thead>
          <tbody>
            <tr><td>lithology-cnn</td><td>{es ? 'precisión' : 'accuracy'}</td><td><b>{(learned.lithoCNN.acc * 100).toFixed(1)}%</b></td><td>{(learned.lithoCNN.acc_baseline * 100).toFixed(1)}%</td></tr>
            <tr><td>core-ood</td><td>AUC</td><td><b>{learned.ood.auc.toFixed(3)}</b></td><td>—</td></tr>
          </tbody>
        </table>
      ) : (
        <Callout variant="honest" title={es ? 'CNN no entrenado todavía' : 'CNN not trained yet'}>
          {es
            ? 'El benchmark CNN-vs-baseline (accuracy held-out) y el AUC del OOD aparecen aquí una vez entrenados los modelos (commit posterior). El ground-truth del generador es siempre la verdad de terreno.'
            : 'The CNN-vs-baseline benchmark (held-out accuracy) and the OOD AUC appear here once the models are trained (a later commit). The generator ground truth is always the authority.'}
        </Callout>
      )}
    </article>
  );
}

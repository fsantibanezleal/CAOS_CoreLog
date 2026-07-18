import { useEffect, useState } from 'react';
import { Callout, useShellLang } from '@fasl-work/caos-app-shell';
import { loadCaseResults, loadLearned, loadOodBench, type LearnedFile, type OodBenchFile } from '../lib/artifacts.ts';
import type { CaseResultsFile } from '../lib/contract.types.ts';
import { ConfusionMatrix } from '../viz/ConfusionMatrix.tsx';
import { OodComparison } from '../viz/OodComparison.tsx';
import { LITHOLOGIES } from '../cv/types.ts';

export default function Benchmark() {
  const es = useShellLang() === 'es';
  const [data, setData] = useState<CaseResultsFile | null>(null);
  const [learned, setLearned] = useState<LearnedFile | null>(null);
  const [ood, setOod] = useState<OodBenchFile | null>(null);
  useEffect(() => { loadCaseResults().then(setData).catch(() => setData(null)); }, []);
  useEffect(() => { loadLearned().then(setLearned).catch(() => setLearned(null)); }, []);
  useEffect(() => { loadOodBench().then(setOod).catch(() => setOod(null)); }, []);

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
        ? 'Comparaciones cruzadas, las que NO dependen de un solo caso van aquí (no en la App). Todas salen del precálculo del engine TS.'
        : 'Cross-case comparisons, the ones that do NOT depend on a single case live here (not in the App). All come from the TS-engine bake.'}</p>

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
          <p>{es ? 'Mismo pórfido, distinta calidad, la precisión del baseline cae con la iluminación:' : 'Same porphyry, different quality, baseline accuracy drops with lighting:'}</p>
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
        <>
          <table className="cmp-table">
            <thead><tr><th>{es ? 'modelo' : 'model'}</th><th>{es ? 'métrica' : 'metric'}</th><th>{es ? 'aprendido' : 'learned'}</th><th>{es ? 'baseline' : 'baseline'}</th></tr></thead>
            <tbody>
              <tr><td>lithology-cnn</td><td>{es ? 'precisión' : 'accuracy'}</td><td><b>{(learned.lithoCNN.acc * 100).toFixed(1)}%</b></td><td>{(learned.lithoCNN.acc_baseline * 100).toFixed(1)}%</td></tr>
              <tr><td>core-ood</td><td>AUC</td><td><b>{learned.ood.auc.toFixed(3)}</b></td><td>, </td></tr>
            </tbody>
          </table>
          <p className="pf-note">{es
            ? `Protocolo: split AGRUPADO POR HOYO sintético (suite+seed), ${learned.lithoCNN.split ?? 'grouped-by-hole'}: los hoyos de test nunca se ven en entrenamiento, a ninguna calidad, así que las ventanas deslizantes solapadas de una bandeja no pueden filtrar entre train y test (issue #14, la corrección del split aleatorio por parche). La accuracy se mantiene alta porque las clases litológicas sintéticas son texturalmente separables, no por memorización, evaluada sobre ${learned.lithoCNN.nEval} parches de hoyos retenidos. El ground-truth del generador es la autoridad.`
            : `Protocol: split GROUPED BY synthetic HOLE (suite+seed), ${learned.lithoCNN.split ?? 'grouped-by-hole'}: test holes are never seen in training, at any quality, so overlapping sliding windows from a tray cannot leak between train and test (issue #14, the fix for the random patch split). The accuracy stays high because the synthetic lithology classes are texturally separable, not through memorisation, evaluated on ${learned.lithoCNN.nEval} patches from held-out holes. The generator ground truth is the authority.`}</p>
        </>
      ) : (
        <Callout variant="honest" title={es ? 'Métricas aprendidas no disponibles' : 'Learned metrics unavailable'}>
          {es
            ? 'cl-learned.json no cargó en esta sesión, los modelos entrenados (torch · ONNX) vienen versionados con el build; corre `python -m cllab.pipeline all --retrain` para regenerarlos. El ground-truth del generador es siempre la verdad de terreno.'
            : 'cl-learned.json did not load in this session, the trained models (torch · ONNX) ship committed with the build; run `python -m cllab.pipeline all --retrain` to regenerate them. The generator ground truth is always the authority.'}
        </Callout>
      )}

      <OodComparison ood={ood} es={es} />

      <h2>{es ? 'Lane de muestra real (DCID)' : 'Real-sample lane (DCID)'}</h2>
      <p>{es
        ? 'La App tiene un selector de fuente Sintetico | Muestra real. La muestra real usa el Drill Core Image Dataset (DCID-7, Li et al. 2025, CC BY-NC 4.0): parches RGB 512x512 de roca real, verbatim, con atribucion. La MISMA tuberia (ventanas + baseline + lithology-CNN + core-ood) corre en vivo sobre los pixeles reales.'
        : 'The App has a Synthetic | Real-sample source selector. The real sample uses the Drill Core Image Dataset (DCID-7, Li et al. 2025, CC BY-NC 4.0): verbatim 512x512 RGB patches of real rock, with attribution. The SAME pipeline (windows + baseline + lithology-CNN + core-ood) runs live on the real pixels.'}</p>
      <Callout variant="honest" title={es ? 'Fuera de distribución, por diseño' : 'Out-of-distribution, by design'}>
        {es
          ? 'El CNN y el OOD se entrenaron con el generador SINTETICO, así que un parche DCID real es fuera de distribución: la clase predicha es indicativa. La brecha de dominio se ve en la baja confianza del clasificador y en la separacion latente; el detector OOD por reconstrucción se reporta con su razon de novedad medida (y decimos cuando es debil, no un "dispara siempre"). La matriz de confusion real se acumula por sesion en la App y mide desalineacion de dominio, no la habilidad del modelo. DCID-7 tiene 7 clases (arenisca roja/clara, limolita gris, lutita, granito, basalto, marmol) mapeadas a las 6 litologias de CoreLog como verdad de accuracy; ver la nota de mapeo en attribution.json.'
          : 'The CNN and OOD were trained on the SYNTHETIC generator, so a real DCID patch is out-of-distribution: the predicted class is indicative. The domain gap shows in the low classifier confidence and the latent separation; the reconstruction-based OOD detector is reported with its measured novelty ratio (and we say when it is weak, not a blanket "always fires"). The real confusion matrix accumulates per session in the App and measures domain mismatch, not model skill. DCID-7 has 7 classes (red/light sandstone, gray siltstone, mudstone, granite, basalt, marble) mapped to CoreLog\'s 6 lithologies as the accuracy truth; see the mapping note in attribution.json.'}
      </Callout>
    </article>
  );
}

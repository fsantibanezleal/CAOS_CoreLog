import { Callout, Tabs, useShellLang } from '@fasl-work/caos-app-shell';

export default function Implementation() {
  const es = useShellLang() === 'es';
  return (
    <article className="page-body prose">
      <h1>{es ? 'Implementación' : 'Implementation'}</h1>
      <p className="lede">{es
        ? 'CoreLog está instanciado sobre el arquetipo de repo-producto CAOS (ADR-0057): dos contratos de datos, un pipeline por etapas, el gate de lane, y un frontend SPA que corre la CV en vivo.'
        : 'CoreLog is instantiated on the CAOS product-repo archetype (ADR-0057): two data contracts, a staged pipeline, the lane gate, and a frontend SPA that runs the CV live.'}</p>

      <Tabs ariaLabel={es ? 'implementación' : 'implementation'} tabs={[
        {
          id: 'lanes', label: 'Lanes',
          content: (
            <div className="pf-doc-sec">
              <ul className="pf-list">
                <li><b>{es ? 'Live (cliente)' : 'Live (client)'}</b> — {es ? 'el generador de bandejas + la segmentación run-merge en TypeScript (frontend/src/cv/) + el CNN vía onnxruntime-web; re-segmenta al mover el caso o el umbral de confianza.' : 'the tray generator + run-merge segmentation in TypeScript (frontend/src/cv/) + the CNN via onnxruntime-web; re-segments as the case or the confidence threshold change.'}</li>
                <li><b>{es ? 'Offline (precompute)' : 'Offline (precompute)'}</b> — {es ? 'un horneado Node corre el MISMO engine TS sobre los casos → data/derived/case-results.json; torch entrena el CNN + el AE OOD → ONNX.' : 'a Node bake runs the SAME TS engine over the cases → data/derived/case-results.json; torch trains the CNN + the OOD AE → ONNX.'}</li>
                <li><b>{es ? 'Replay (liviano)' : 'Replay (light)'}</b> — {es ? 'el pipeline Python numpy-only reformatea el horneado en trazas + manifiestos por caso (CONTRATO 2). Sin torch ni Node → CI/verificación rápida.' : 'the numpy-only Python pipeline reshapes the bake into per-case traces + manifests (CONTRACT 2). No torch/Node → fast CI/verify.'}</li>
              </ul>
              <Callout variant="note" title={es ? 'El gate decide el lane' : 'The gate decides the lane'}>
                {es ? 'LIVE si es client-side, runtimes ⊆ {ts-cv, onnxruntime-web} y la segmentación + la traza caben en presupuesto. A escala didáctica todo pasa a LIVE.' : 'LIVE if client-side, runtimes ⊆ {ts-cv, onnxruntime-web} and the segmentation + trace fit budget. At teaching scale everything is LIVE.'}
              </Callout>
            </div>
          ),
        },
        {
          id: 'contracts', label: es ? 'Dos contratos' : 'Two contracts',
          content: (
            <div className="pf-doc-sec">
              <p><b>{es ? 'Contrato 1 (ingesta)' : 'Contract 1 (ingestion)'}</b> — {es ? 'io/contract.py valida descriptores de bandeja y la metadata de una imagen de bandeja (lado Python): rechaza dimensiones no-positivas, profundidad invertida y 0 canales; marca aspecto inusual y resolución gruesa. La app aún no tiene carga de bandejas propias.' : 'io/contract.py validates tray descriptors and a tray image’s metadata (Python-side): rejects non-positive dimensions, inverted depth and zero channels; flags unusual aspect + coarse resolution. The app itself has no tray upload yet.'}</p>
              <p><b>{es ? 'Contrato 2 (artefacto)' : 'Contract 2 (artifact)'}</b> — {es ? 'core/{trace,manifest}.py (corelog.trace/v1 + manifest/v2). El frontend tiene un espejo TS (lib/contract.types.ts) — una deriva rompe el build con tsc.' : 'core/{trace,manifest}.py (corelog.trace/v1 + manifest/v2). The frontend has a TS mirror (lib/contract.types.ts) — a drift breaks the build via tsc.'}</p>
            </div>
          ),
        },
        {
          id: 'learned', label: es ? 'Modelos aprendidos' : 'Learned models',
          content: (
            <Callout variant="honest" title={es ? 'Dos modelos honestos' : 'Two honest models'}>
              {es
                ? '(1) lithology-cnn: clasificador CNN por parche vs el baseline clásico color/textura (accuracy + confusión sobre el mismo split de test). (2) core-ood: un autoencoder de parche cuyo MSE de reconstrucción marca parches fuera de distribución (entrenado/evaluado separando el frame de la bandeja del core; AUC 0.790). Ambos están ENTRENADOS y versionados en este build (torch → ONNX en data/derived/) y corren en vivo (onnxruntime-web) — activa el toggle CNN en la App. El split actual es aleatorio por parche y filtra ventanas solapadas entre train y test, así que la accuracy titular del CNN está en re-evaluación (issue #14). El ground-truth del generador es la autoridad.'
                : '(1) lithology-cnn: a per-patch CNN classifier vs the classical colour/texture baseline (accuracy + confusion on the same test split). (2) core-ood: a patch autoencoder whose reconstruction MSE flags out-of-distribution patches (trained/evaluated separating the tray frame from core; AUC 0.790). Both are TRAINED and committed in this build (torch → ONNX in data/derived/) and run live (onnxruntime-web) — flip the CNN toggle in the App. The current split is patch-level random and leaks overlapping windows between train and test, so the headline CNN accuracy is under re-evaluation (issue #14). The generator ground truth is the authority.'}
            </Callout>
          ),
        },
        {
          id: 'verify', label: es ? 'Verificado corriendo' : 'Verified running',
          content: (
            <div className="pf-doc-sec">
              <pre className="codeblock">{`# light .venv-pipeline (numpy only)
ruff check data-pipeline tests          # clean
pytest                                  # 9 passed
python -m cllab.pipeline all            # 8 cases → traces + manifests
python scripts/check_artifacts.py       # CONTRACT 2 OK
# byte-identical re-run → deterministic
cd frontend && npm test                 # cv 4 + contract 5 = 9 passed
npm run build                           # tsc + vite green`}</pre>
            </div>
          ),
        },
      ]} />
    </article>
  );
}

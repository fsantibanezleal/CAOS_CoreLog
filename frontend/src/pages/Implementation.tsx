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
              <p><b>{es ? 'Contrato 1 (ingesta)' : 'Contract 1 (ingestion)'}</b> — {es ? 'io/contract.py valida descriptores de bandeja y la metadata de una imagen real soltada: rechaza dimensiones no-positivas, profundidad invertida y 0 canales; marca aspecto inusual y resolución gruesa. Es la puerta para loguear TU bandeja.' : 'io/contract.py validates tray descriptors and a real dropped image’s metadata: rejects non-positive dimensions, inverted depth and zero channels; flags unusual aspect + coarse resolution. The gate to log YOUR tray.'}</p>
              <p><b>{es ? 'Contrato 2 (artefacto)' : 'Contract 2 (artifact)'}</b> — {es ? 'core/{trace,manifest}.py (corelog.trace/v1 + manifest/v2). El frontend tiene un espejo TS (lib/contract.types.ts) — una deriva rompe el build con tsc.' : 'core/{trace,manifest}.py (corelog.trace/v1 + manifest/v2). The frontend has a TS mirror (lib/contract.types.ts) — a drift breaks the build via tsc.'}</p>
            </div>
          ),
        },
        {
          id: 'learned', label: es ? 'Modelos aprendidos' : 'Learned models',
          content: (
            <Callout variant="honest" title={es ? 'Dos modelos honestos' : 'Two honest models'}>
              {es
                ? '(1) lithology-cnn: clasificador CNN por parche vs el baseline clásico color/textura (accuracy + confusión held-out). (2) core-ood: un autoencoder de parche cuyo MSE de reconstrucción detecta core fuera de distribución / sin recuperación (AUC). Ambos entrenan offline (torch → ONNX) y corren en vivo (onnxruntime-web). El ground-truth del generador es la autoridad. En este build están PENDIENTES de entrenamiento (la app usa el baseline y lo dice).'
                : '(1) lithology-cnn: a per-patch CNN classifier vs the classical colour/texture baseline (held-out accuracy + confusion). (2) core-ood: a patch autoencoder whose reconstruction MSE flags out-of-distribution / no-recovery core (AUC). Both train offline (torch → ONNX) and run live (onnxruntime-web). The generator ground truth is the authority. In this build they are PENDING training (the app uses the baseline and says so).'}
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

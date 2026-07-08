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
                <li><b>{es ? 'Live (cliente)' : 'Live (client)'}</b>, {es ? 'el generador de bandejas + la segmentación run-merge en TypeScript (frontend/src/cv/) + el CNN vía onnxruntime-web; re-segmenta al mover el caso o el umbral de confianza.' : 'the tray generator + run-merge segmentation in TypeScript (frontend/src/cv/) + the CNN via onnxruntime-web; re-segments as the case or the confidence threshold change.'}</li>
                <li><b>{es ? 'Offline (precompute)' : 'Offline (precompute)'}</b>, {es ? 'un horneado Node corre el MISMO engine TS sobre los casos → data/derived/case-results.json; torch entrena el CNN + el AE OOD → ONNX.' : 'a Node bake runs the SAME TS engine over the cases → data/derived/case-results.json; torch trains the CNN + the OOD AE → ONNX.'}</li>
                <li><b>{es ? 'Replay (liviano)' : 'Replay (light)'}</b>, {es ? 'el pipeline Python numpy-only reformatea el horneado en trazas + manifiestos por caso (CONTRATO 2). Sin torch ni Node → CI/verificación rápida.' : 'the numpy-only Python pipeline reshapes the bake into per-case traces + manifests (CONTRACT 2). No torch/Node → fast CI/verify.'}</li>
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
              <p><b>{es ? 'Contrato 1 (ingesta)' : 'Contract 1 (ingestion)'}</b>, {es ? 'io/contract.py valida descriptores de bandeja y la metadata de una imagen de bandeja (lado Python): rechaza dimensiones no-positivas, profundidad invertida y 0 canales; marca aspecto inusual y resolución gruesa. La app aún no tiene carga de bandejas propias.' : 'io/contract.py validates tray descriptors and a tray image’s metadata (Python-side): rejects non-positive dimensions, inverted depth and zero channels; flags unusual aspect + coarse resolution. The app itself has no tray upload yet.'}</p>
              <p><b>{es ? 'Contrato 2 (artefacto)' : 'Contract 2 (artifact)'}</b>, {es ? 'core/{trace,manifest}.py (corelog.trace/v1 + manifest/v2). El frontend tiene un espejo TS (lib/contract.types.ts), una deriva rompe el build con tsc.' : 'core/{trace,manifest}.py (corelog.trace/v1 + manifest/v2). The frontend has a TS mirror (lib/contract.types.ts), a drift breaks the build via tsc.'}</p>
              <p className="pf-cap">{es
                ? 'El manifiesto por caso lleva el veredicto del gate (lane + runtimes + bytes de traza); scripts/check_artifacts.py valida en CI que cada manifiesto y su artefacto no derivan (CONTRATO 2). Esta metadata operativa vive en los manifiestos/docs, no como una pestaña de la App.'
                : 'The per-case manifest carries the gate verdict (lane + runtimes + trace bytes); scripts/check_artifacts.py validates in CI that every manifest and its artifact do not drift (CONTRACT 2). This operational metadata lives in the manifests/docs, not as an App tab.'}</p>
            </div>
          ),
        },
        {
          id: 'learned', label: es ? 'Modelos aprendidos' : 'Learned models',
          content: (
            <Callout variant="honest" title={es ? 'Dos modelos honestos' : 'Two honest models'}>
              {es
                ? '(1) lithology-cnn: clasificador CNN por parche vs el baseline clásico color/textura (accuracy + confusión sobre hoyos de test retenidos). (2) core-ood: un autoencoder de parche cuyo MSE de reconstrucción marca parches fuera de distribución (entrenado/evaluado separando el frame de la bandeja del core; AUC 0.729). Ambos están ENTRENADOS y versionados en este build (torch → ONNX en data/derived/) y corren en vivo (onnxruntime-web), activa el toggle CNN en la App. El split es AGRUPADO POR HOYO sintético (suite+seed): los hoyos de test nunca se ven en entrenamiento a ninguna calidad, así que las ventanas deslizantes solapadas de una bandeja no filtran entre train y test (issue #14, la corrección del split aleatorio por parche). El ground-truth del generador es la autoridad.'
                : '(1) lithology-cnn: a per-patch CNN classifier vs the classical colour/texture baseline (accuracy + confusion on held-out test holes). (2) core-ood: a patch autoencoder whose reconstruction MSE flags out-of-distribution patches (trained/evaluated separating the tray frame from core; AUC 0.729). Both are TRAINED and committed in this build (torch → ONNX in data/derived/) and run live (onnxruntime-web), flip the CNN toggle in the App. The split is GROUPED BY synthetic HOLE (suite+seed): test holes are never seen in training at any quality, so overlapping sliding windows from a tray do not leak between train and test (issue #14, the fix for the random patch split). The generator ground truth is the authority.'}
            </Callout>
          ),
        },
        {
          id: 'oodhead', label: es ? 'OOD + cabeza real' : 'OOD + real head',
          content: (
            <div className="pf-doc-sec">
              <p>{es
                ? 'El detector OOD en espacio de features y la cabeza real DCID-7 se hornean offline (data-pipeline/cllab/science/ood_bench.py, .venv-precompute + torch) y embarcan como artefactos compactos. El contrato es: backbone congelado -> embedding -> {estadisticos de Mahalanobis, banco kNN, cabeza lineal}.'
                : 'The feature-space OOD detector and the DCID-7 real head are baked offline (data-pipeline/cllab/science/ood_bench.py, .venv-precompute + torch) and shipped as compact artifacts. The contract is: frozen backbone -> embedding -> {Mahalanobis statistics, kNN bank, linear head}.'}</p>
              <ul className="pf-list">
                <li><b>lithology-cnn.onnx</b> (~0.31 MB), {es ? 'ahora con DOS salidas' : 'now with TWO outputs'}: <code>p</code> (softmax 6) + <code>f</code> ({es ? 'embedding de 64-d que alimenta el Mahalanobis en vivo por ventana' : 'the 64-d embedding feeding the live per-window Mahalanobis'}).</li>
                <li><b>ood-detector.json</b> (~0.6 MB): {es ? 'centroides por clase mu_c, la inversa de covarianza compartida Sigma^-1 (64x64), el banco kNN (400x64) y los cuantiles de umbral del ID sintetico.' : 'the class centroids mu_c, the shared inverse covariance Sigma^-1 (64x64), the kNN bank (400x64) and the synthetic-ID threshold quantiles.'}</li>
                <li><b>real-litho-cnn.onnx</b> (~3.7 MB): {es ? 'MobileNetV3-Small congelado (ImageNet) + cabeza lineal, entrada 224 px, salida softmax DCID-7. Una inferencia por parche real (sin bomba de computo).' : 'frozen MobileNetV3-Small (ImageNet) + a linear head, 224 px input, DCID-7 softmax output. One inference per real patch (no compute bomb).'}</li>
                <li><b>ood-bench.json</b> (~14 KB): {es ? 'la tabla completa de detectores, curvas ROC, histogramas, controles negativos y la confusion de la cabeza, que lee la pagina Benchmark.' : 'the full detector table, ROC curves, histograms, negative controls and the head confusion, read by the Benchmark page.'}</li>
              </ul>
              <Callout variant="note" title={es ? 'Por que se precomputan los embeddings' : 'Why the embeddings are precomputed'}>
                {es
                  ? 'DINOv2/MAE son el techo SOTA pero demasiado pesados para el navegador; se documentan, no se embarcan. Solo se embarcan estadisticos OOD compactos + la cabeza pequena. El backbone MobileNet (~3.7 MB) si cabe y se carga bajo demanda solo en el carril Real.'
                  : 'DINOv2/MAE are the SOTA ceiling but too heavy for the browser; they are documented, not shipped. Only the compact OOD statistics + the small head ship. The MobileNet backbone (~3.7 MB) does fit and loads on demand only in the Real lane.'}
              </Callout>
            </div>
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

// In-app Architecture / "How it works" modal config (ADR-0058) for CoreLog Vision.
// Passed to <AppShell config={{ ...config, architecture }}>. The ⓘ header button
// (provided by @fasl-work/caos-app-shell >= 0.1.2) opens the modal. Each tab pairs
// one hand-authored THEMED SVG (frontend/public/svg/tech/, shell CSS-var tokens →
// repaints with the active theme, fetched + inlined) with a bilingual ES/EN body.
import type { ArchitectureConfig } from '@fasl-work/caos-app-shell';

export const architecture: ArchitectureConfig = {
  tabs: [
    {
      id: 'app',
      en: 'The app',
      es: 'La app',
      svg: 'svg/tech/01-the-app.svg',
      body_en:
        'CoreLog Vision automates drill-core lithology logging: pick a synthetic tray case and a ' +
        'per-patch CNN + run-merge segmentation give a depth strip-log of lithology + confidence, answering "which ' +
        'lithology is each metre of core?". You change the case, the confidence threshold or the classifier and the ' +
        'whole tray re-segments live. A first-level Source selector switches between the synthetic generator and a ' +
        'REAL-sample lane (DCID drill-core photos, Li et al. 2025, CC BY-NC 4.0), and the Real lane also accepts your own ' +
        'uploaded core photo, decoded and classified in the browser.\n\n' +
        'It is a real system, not a demo. The CV engine (frontend/src/cv/) re-segments in the browser on every control; ' +
        'the segmentation emerges from a sliding patch classifier (3-tap smoothing + run-merge), so there is no ' +
        'separate heavy segmenter. A lithology CNN and an OOD autoencoder (AUC 0.729) run client-side as ONNX. The ' +
        'CNN-vs-baseline accuracy uses a leakage-safe grouped-by-hole split (issue #14, fixed): ~0.99 on held-out ' +
        'synthetic holes. On real DCID photos the models are out-of-distribution, so predictions are indicative; the ' +
        'domain gap shows in low classifier confidence, the latent-space separation and the OOD reconstruction ratio ' +
        '(reported with its measured value, called weak when it is). Low-confidence core is flagged, not forced.',
      body_es:
        'CoreLog Vision automatiza el logueo de litología de testigos: elige un caso sintético de bandeja y un CNN por ' +
        'parche + segmentación run-merge dan un strip-log de profundidad de litología + ' +
        'confianza, respondiendo "¿qué litología es cada metro de testigo?". Cambias el caso, el umbral de confianza o ' +
        'el clasificador y toda la bandeja se re-segmenta en vivo. Un selector de Fuente de primer nivel alterna entre el ' +
        'generador sintético y un carril de MUESTRA real (fotos de core DCID, Li et al. 2025, CC BY-NC 4.0), y el carril ' +
        'Real también acepta tu propia foto de core, decodificada y clasificada en el navegador.\n\n' +
        'Es un sistema real, no un demo. El motor CV (frontend/src/cv/) re-segmenta en el navegador con cada control; la ' +
        'segmentación emerge de un clasificador de parches deslizante (suavizado de 3 taps + run-merge), así que no hay ' +
        'un segmentador pesado aparte. Un CNN de litología y un autoencoder OOD (AUC 0.729) corren en el cliente como ' +
        'ONNX. La accuracy CNN-vs-baseline usa un split agrupado por hoyo, seguro ante fugas (issue #14, corregido): ~0.99 ' +
        'sobre hoyos sintéticos retenidos. Sobre fotos reales DCID los modelos quedan fuera de distribución, así que las ' +
        'predicciones son indicativas; la brecha se ve en la baja confianza del clasificador, la separación latente y la ' +
        'razón de reconstrucción OOD (reportada con su valor medido, llamada débil cuando lo es). El testigo de baja ' +
        'confianza se marca, no se fuerza.',
    },
    {
      id: 'lanes',
      en: 'Lanes, web / offline / compute',
      es: 'Carriles, web / offline / cómputo',
      svg: 'svg/tech/02-lanes.svg',
      body_en:
        'Three lanes, and the split is the point. WEB (live, in the browser): the TypeScript CV engine ' +
        '(frontend/src/cv/) re-segments on every control and onnxruntime-web runs lithology-cnn.onnx + core-ood.onnx, ' +
        'no server. OFFLINE / COMPUTE (your machine, isolated .venv): the Python pipeline bakes the canonical case ' +
        'artifacts (the segmentations + metrics) and the heavy lane (--retrain, .venv-precompute, torch) trains the ' +
        'lithology CNN + the OOD autoencoder and exports them to ONNX. REPLAY: the small, committed artifacts in ' +
        'data/derived are overlaid into the SPA by copy-data.mjs and loaded live; the typed mirror (contract.types.ts) ' +
        'fails the build if the web and the pipeline shapes ever diverge.',
      body_es:
        'Tres carriles, y la división es lo central. WEB (en vivo, en el navegador): el motor CV en TypeScript ' +
        '(frontend/src/cv/) re-segmenta con cada control y onnxruntime-web ejecuta lithology-cnn.onnx + core-ood.onnx, ' +
        'sin servidor. OFFLINE / CÓMPUTO (tu máquina, .venv aislado): el pipeline Python hornea los artefactos canónicos ' +
        'por caso (las segmentaciones + métricas) y el carril pesado (--retrain, .venv-precompute, torch) entrena el CNN ' +
        'de litología + el autoencoder OOD y los exporta a ONNX. REPLAY: los artefactos pequeños y versionados en ' +
        'data/derived se superponen al SPA con copy-data.mjs y se cargan en vivo; el espejo tipado (contract.types.ts) ' +
        'rompe el build si la web y el pipeline divergen.',
    },
    {
      id: 'web-flow',
      en: 'Web-app flow',
      es: 'Flujo de la web',
      svg: 'svg/tech/03-web-flow.svg',
      body_en:
        'The App page recomputes live: inputs (the case selector plus the confidence-threshold and ' +
        'classifier controls) feed the TypeScript CV engine and the onnxruntime-web inference, which feed the ' +
        'interactive viz, the tray canvas + segmentation overlay, the depth strip-log, the confusion matrix and the ' +
        'per-channel view, each reading values back on hover. The six sibling pages (App · Introduction · Methodology · ' +
        'Implementation · Experiments · Benchmark) are identical across every CAOS product. The build is gated by the ' +
        'contract-type mirror, the artifacts are overlaid by copy-data, vite builds the static output, and GitHub Pages ' +
        'serves it at corelog.fasl-work.com.',
      body_es:
        'La página App recalcula en vivo: las entradas (el selector de casos, más los controles de ' +
        'umbral de confianza y clasificador) alimentan el motor CV en TypeScript y la inferencia onnxruntime-web, que ' +
        'alimentan la visualización interactiva, la bandeja en canvas + overlay de segmentación, el strip-log de ' +
        'profundidad, la matriz de confusión y la vista por canal, cada uno devolviendo valores al pasar el cursor. Las ' +
        'seis páginas hermanas (App · Introducción · Metodología · Implementación · Experimentos · Benchmark) son ' +
        'idénticas en todos los productos CAOS. El build lo controla el espejo de tipos del contrato, los artefactos los ' +
        'superpone copy-data, vite construye el estático y GitHub Pages lo sirve en corelog.fasl-work.com.',
    },
    {
      id: 'science',
      en: 'The science',
      es: 'La ciencia',
      svg: 'svg/tech/04-the-science.svg',
      body_en:
        'The pipeline, step by step: ① the tray generator paints procedural per-lithology textures (colour + grain + ' +
        'banding/veining) and emits the ground-truth segments; ② per patch it computes colour moments, luma variance ' +
        'and gradient anisotropy (which captures bedding/foliation); ③ a classifier, the classical nearest-centroid ' +
        'baseline OR the lithology CNN, predicts a 6-way softmax; ④ 3-tap smoothing + run-merge turn the per-position ' +
        'predictions into segments (the depth boundaries EMERGE where the class changes); ⑤ the segments order by depth ' +
        'into the strip-log with confidence shading.\n\n' +
        'The classical baseline is always on and transparent, the honest reference the CNN is measured against. The ' +
        'learned lane: a lithology CNN (RGB patch → 6-way softmax; accuracy ~0.99 vs the baseline on a leakage-safe ' +
        'grouped-by-hole split, issue #14 fixed) and an ' +
        'OOD autoencoder (reconstruction MSE = anomaly, AUC 0.729); both run client-side as ONNX, reported whichever way ' +
        'the numbers land, never as a black box. The generator ground truth is always the authority; on real DCID photos ' +
        'both models are out-of-distribution and say so.',
      body_es:
        'El pipeline, paso a paso: ① el generador de bandejas pinta texturas procedurales por litología (color + grano ' +
        '+ bandeamiento/vetas) y emite los segmentos verdaderos; ② por parche computa momentos de color, varianza de ' +
        'luma y anisotropía de gradiente (que captura bedding/foliación); ③ un clasificador, el baseline clásico de ' +
        'centroide más cercano O el CNN de litología, predice un softmax de 6 clases; ④ suavizado de 3 taps + run-merge ' +
        'convierten las predicciones por posición en segmentos (los límites de profundidad EMERGEN donde cambia la ' +
        'clase); ⑤ los segmentos se ordenan por profundidad en el strip-log con sombreado por confianza.\n\n' +
        'El baseline clásico está siempre activo y es transparente, la referencia honesta contra la que se mide el CNN. ' +
        'El carril aprendido: un CNN de litología (parche RGB → softmax de 6 clases; accuracy ~0.99 vs el baseline en un ' +
        'split agrupado por hoyo, seguro ante fugas, issue #14 corregido) y un autoencoder OOD (MSE de ' +
        'reconstrucción = anomalía, AUC 0.729); ambos corren en el cliente ' +
        'como ONNX, reportados como caigan los números, nunca como caja negra. La verdad del generador es siempre la ' +
        'autoridad; sobre fotos reales DCID ambos modelos quedan fuera de distribución y lo dicen.',
    },
    {
      id: 'design',
      en: 'Data contracts / design',
      es: 'Contratos de datos / diseño',
      svg: 'svg/tech/05-data-contracts.svg',
      body_en:
        'Two validated data contracts bracket the pipeline. Contract 1 (ingestion) defines a valid tray descriptor, ' +
        'the channel count, pixel dimensions, depth interval and mm/px scale, with range/NaN guards, validated in the ' +
        'Python pipeline today (the app itself has no tray upload yet). Contract 2 (artifact) defines the output the web reads (the ' +
        'per-case segments + pixel-accuracy + confusion, the depth strip-log, the learned metrics, the model index), ' +
        'mirrored exactly by contract.types.ts. Between them the staged, deterministic pipeline runs the lane gate ' +
        '(numpy-light by default, --retrain for the heavy torch lane) and writes a provenance manifest, so every result ' +
        'is reproducible and the web can never silently drift.',
      body_es:
        'Dos contratos de datos validados encierran el pipeline. El Contrato 1 (ingesta) define un descriptor de bandeja ' +
        'válido, el número de canales, dimensiones en píxeles, intervalo de profundidad y escala mm/px, con guardas de ' +
        'rango/NaN, validado hoy en el pipeline Python (la app aún no tiene carga de bandejas). El Contrato 2 (artefacto) define la ' +
        'salida que lee la web (los segmentos por caso + pixel-accuracy + confusión, el strip-log de profundidad, las ' +
        'métricas aprendidas, el índice de modelos), espejada exactamente por contract.types.ts. Entre ambos, el ' +
        'pipeline por etapas y determinista corre el lane gate (numpy-light por defecto, --retrain para el carril pesado ' +
        'de torch) y escribe un manifest de procedencia, de modo que cada resultado es reproducible y la web nunca ' +
        'diverge en silencio.',
    },
  ],
};

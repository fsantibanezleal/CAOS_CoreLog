import { Callout, Cite, Tabs, useShellLang } from '@fasl-work/caos-app-shell';

export default function Introduction() {
  const es = useShellLang() === 'es';
  return (
    <article className="page-body prose">
      <h1>{es ? 'Introducción' : 'Introduction'}</h1>
      <p className="lede">{es
        ? 'CoreLog Vision automatiza el logueo litológico de testigos de sondaje: toma la imagen de una bandeja de testigos (sintética en este build), segmenta el core, clasifica la litología de cada segmento con una confianza, y arma un strip-log continuo por profundidad.'
        : 'CoreLog Vision automates drill-core lithology logging: it takes a core-tray image (synthetic in this build), segments the core, classifies each segment’s lithology with a confidence, and assembles a continuous depth strip-log.'}</p>

      <Callout variant="strong" title={es ? 'Toda la CV corre EN VIVO en tu browser' : 'All the CV runs LIVE in your browser'}>
        {es
          ? 'El generador de bandejas, la segmentación run-merge y el clasificador corren en TypeScript en el browser; el CNN de litología corre vía onnxruntime-web. Elige un caso y la segmentación se recalcula al instante. (La carga de tu propia bandeja en la app aún no está implementada.)'
          : 'The tray generator, the run-merge segmentation and the classifier run in TypeScript in the browser; the lithology CNN runs via onnxruntime-web. Pick a case and the segmentation re-computes instantly. (In-app upload of your own tray is not implemented yet.)'}
      </Callout>

      <Tabs ariaLabel={es ? 'introducción' : 'introduction'} tabs={[
        {
          id: 'what', label: es ? 'Qué es' : 'What it is',
          content: (
            <div className="pf-doc-sec">
              <p>{es
                ? 'Una bandeja de testigos contiene varios canales paralelos de roca recuperada, cada uno cubriendo un intervalo de profundidad. El geólogo loguea la litología segmento por segmento. CoreLog lo hace con CV: clasifica parches a lo largo de cada canal con un CNN, fusiona los parches del mismo tipo en segmentos, y mapea a profundidad · un strip-log.'
                : 'A core tray holds several parallel channels of recovered rock, each covering a depth interval. A geologist logs lithology segment by segment. CoreLog does it with CV: it classifies patches along each channel with a CNN, merges same-class patches into segments, and maps to depth · a strip-log.'}</p>
              <p>{es
                ? 'Incluye 6 litologías (granito, basalto, arenisca, caliza, esquisto, mineral), 3 secuencias (pórfido, sedimentaria, volcánica), escenarios de calidad de imagen, y controles oráculo verificables a mano.'
                : 'It ships 6 lithologies (granite, basalt, sandstone, limestone, schist, ore), 3 sequences (porphyry, sedimentary, volcanic), image-quality scenarios, and hand-verifiable oracle controls.'}</p>
            </div>
          ),
        },
        {
          id: 'why', label: es ? 'Por qué importa' : 'Why it matters',
          content: (
            <div className="pf-doc-sec">
              <p>{es
                ? 'El logueo de testigos es lento, subjetivo y un cuello de botella de la exploración. La clasificación de litología por CNN sobre imágenes de core es un área de investigación real ('
                : 'Core logging is slow, subjective and an exploration bottleneck. CNN lithology classification on core images is a real research area ('}
                <Cite id="baraboshkin2020" paren />, <Cite id="alzubaidi2021" paren />{es ? '). CoreLog es un didáctico honesto de ese pipeline: un CNN medido contra un baseline clásico color/textura, con la verdad de terreno del generador como autoridad.' : '). CoreLog is an honest teaching build of that pipeline: a CNN measured against a classical colour/texture baseline, with the generator ground truth as the authority.'}</p>
            </div>
          ),
        },
        {
          id: 'honesty', label: es ? 'Honestidad' : 'Honesty',
          content: (
            <Callout variant="honest" title={es ? 'Qué es real y qué es sintético' : 'What is real and what is synthetic'}>
              {es
                ? 'Las bandejas del carril Sintético son SINTÉTICAS (texturas procedurales por litología); el carril Muestra real usa fotos de core REALES del dataset DCID (Li et al. 2025, CC BY-NC 4.0), verbatim y con atribución. La segmentación y la métrica son reales: en Sintético se puntúan contra el ground-truth del generador (los controles UNIFORM/SHARP tienen respuesta cerrada). El CNN se compara SIEMPRE contra el baseline clásico sobre los mismos parches de test, con un split AGRUPADO POR HOYO seguro ante fugas (issue #14, corregido): ~0.99 en hoyos sintéticos retenidos. Sobre fotos DCID reales el CNN y el OOD quedan FUERA DE DISTRIBUCIÓN: la predicción es indicativa; la brecha se ve en la baja confianza, la separación latente y la razón de reconstrucción OOD (reportada con su valor, dicha débil cuando lo es).'
                : 'The Synthetic-lane trays are SYNTHETIC (procedural per-lithology textures); the Real-sample lane uses REAL core photos from the DCID dataset (Li et al. 2025, CC BY-NC 4.0), verbatim and attributed. The segmentation + metrics are real: in Synthetic they are scored against the generator ground truth (the UNIFORM/SHARP controls are closed-form). The CNN is ALWAYS compared against the classical baseline on the same test patches, with a leakage-safe GROUPED-BY-HOLE split (issue #14, fixed): ~0.99 on held-out synthetic holes. On real DCID photos the CNN and OOD are OUT-OF-DISTRIBUTION: the prediction is indicative; the gap shows in the low confidence, the latent separation and the OOD reconstruction ratio (reported with its value, called weak when it is).'}
            </Callout>
          ),
        },
      ]} />
    </article>
  );
}

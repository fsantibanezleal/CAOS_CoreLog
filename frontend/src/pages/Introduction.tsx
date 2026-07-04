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
                ? 'Una bandeja de testigos contiene varios canales paralelos de roca recuperada, cada uno cubriendo un intervalo de profundidad. El geólogo loguea la litología segmento por segmento. CoreLog lo hace con CV: clasifica parches a lo largo de cada canal con un CNN, fusiona los parches del mismo tipo en segmentos, y mapea a profundidad → un strip-log.'
                : 'A core tray holds several parallel channels of recovered rock, each covering a depth interval. A geologist logs lithology segment by segment. CoreLog does it with CV: it classifies patches along each channel with a CNN, merges same-class patches into segments, and maps to depth → a strip-log.'}</p>
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
                ? 'Las imágenes de bandeja son SINTÉTICAS (texturas procedurales por litología), no hay fotos reales de core. La segmentación y la métrica son reales: se puntúan contra el ground-truth del generador. Los controles UNIFORM/SHARP tienen respuesta cerrada. El CNN se compara SIEMPRE contra el baseline clásico sobre los mismos parches de test; el protocolo actual (split aleatorio por parche) filtra ventanas solapadas entre train y test, así que la accuracy titular está en re-evaluación con un split agrupado (issue #14).'
                : 'The tray images are SYNTHETIC (procedural per-lithology textures), there are no real core photos. The segmentation + metrics are real: scored against the generator ground truth. The UNIFORM/SHARP controls are closed-form. The CNN is ALWAYS compared against the classical baseline on the same test patches; the current protocol (random patch-level split) leaks overlapping windows between train and test, so the headline accuracy is under re-evaluation with a grouped split (issue #14).'}
            </Callout>
          ),
        },
      ]} />
    </article>
  );
}

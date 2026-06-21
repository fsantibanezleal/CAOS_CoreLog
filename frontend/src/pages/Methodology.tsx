import { Callout, Cite, Equation, InlineMath, ReferenceList, Tabs, useShellLang } from '@fasl-work/caos-app-shell';

export default function Methodology() {
  const es = useShellLang() === 'es';
  return (
    <article className="pf-doc">
      <h1>{es ? 'Metodología' : 'Methodology'}</h1>
      <p className="pf-lead">{es
        ? 'Generación sintética → clasificación por parche → segmentación run-merge → estiba por profundidad. La segmentación EMERGE del clasificador de parches, así que no hay un segmentador pesado aparte.'
        : 'Synthetic generation → per-patch classification → run-merge segmentation → depth stitching. The segmentation EMERGES from the patch classifier, so there is no separate heavy segmenter.'}</p>

      <Tabs ariaLabel={es ? 'metodología' : 'methodology'} tabs={[
        {
          id: 'gen', label: es ? 'Generación' : 'Generation',
          content: (
            <div className="pf-doc-sec">
              <p>{es ? 'Cada litología tiene una textura procedural — color base + grano + bandeo/veteo — modulada por ruido de valor semillado. La bandeja apila N canales; cada canal es una secuencia de runs de core de distintas litologías a lo largo de x, con su intervalo de profundidad. El generador entrega la imagen RGBA y los segmentos ground-truth (gratis), lo que permite puntuar la segmentación.'
                : 'Each lithology has a procedural texture — base colour + grain + banding/veining — modulated by seeded value noise. The tray stacks N channels; each channel is a sequence of core runs of different lithologies along x, with its depth interval. The generator yields the RGBA image AND the ground-truth segments (free), which lets us score the segmentation.'}</p>
            </div>
          ),
        },
        {
          id: 'cls', label: es ? 'Clasificación' : 'Classification',
          content: (
            <div className="pf-doc-sec">
              <p>{es ? 'Se desliza una ventana de ' : 'Slide a '}<InlineMath tex="P\times P" />{es ? ' a lo largo del canal; un CNN clasifica cada parche → softmax de 6 clases. El CNN ' : ' window along the channel; a CNN classifies each patch → a 6-class softmax. The CNN '}<Cite id="lecun2015" paren />{es ? ' se compara contra un baseline clásico: momentos de color + features de textura (' : ' is compared against a classical baseline: colour moments + texture features ('}<Cite id="haralick1973" paren />, <Cite id="ojala2002" paren />{es ? ') + nearest-centroid.' : ') + nearest-centroid.'}</p>
              <Equation tex="\hat{y}(x) = \arg\max_c\ \mathrm{softmax}\big(\,\mathrm{CNN}(\text{patch}_x)\big)_c" caption={es ? 'la clase predicha en la posición x es el argmax del softmax del CNN' : 'the predicted class at position x is the argmax of the CNN softmax'} />
            </div>
          ),
        },
        {
          id: 'seg', label: es ? 'Segmentación' : 'Segmentation',
          content: (
            <div className="pf-doc-sec">
              <p>{es ? 'Las predicciones por posición se suavizan (filtro de mayoría de 3 taps) y luego se fusionan los runs contiguos de la misma clase en SEGMENTOS, con confianza media. La profundidad de cada segmento sale del mapeo lineal x → profundidad dentro del slice del canal.'
                : 'The per-position predictions are smoothed (a 3-tap majority filter) and adjacent same-class runs are merged into SEGMENTS, with a mean confidence. Each segment’s depth comes from the linear x → depth map within the channel’s slice.'}</p>
              <Callout variant="note" title={es ? 'Incertidumbre / no-recovery' : 'Uncertainty / no-recovery'}>
                {es ? 'Un autoencoder de parche (OOD) reconstruye mal el frame de la bandeja, el rubble y los huecos; su MSE alto, o una confianza media bajo el umbral, marca el segmento como “incierto” en vez de forzar una clase '
                : 'A patch autoencoder (OOD) reconstructs the tray frame, rubble and gaps poorly; a high MSE, or a mean confidence below the threshold, flags the segment as “uncertain” instead of forcing a class '}<Cite id="hendrycks2017" paren />.
              </Callout>
            </div>
          ),
        },
        {
          id: 'depth', label: es ? 'Strip-log' : 'Strip log',
          content: (
            <div className="pf-doc-sec">
              <p>{es ? 'Los canales se leen de arriba a abajo con profundidad creciente; cada canal cubre un slice de profundidad igual del intervalo total. Los segmentos de todos los canales se ordenan por profundidad → un strip-log vertical coloreado por litología, con la confianza como opacidad y los segmentos inciertos rayados.'
                : 'Channels read top-to-bottom with increasing depth; each channel covers an equal depth slice of the total interval. Segments from all channels are ordered by depth → a vertical strip-log coloured by lithology, confidence as opacity, uncertain segments hatched.'}</p>
            </div>
          ),
        },
      ]} />

      <ReferenceList heading={es ? 'Referencias' : 'References'} />
    </article>
  );
}

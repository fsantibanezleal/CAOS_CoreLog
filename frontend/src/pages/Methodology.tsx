import { Callout, Cite, Equation, InlineMath, ReferenceList, Refs, Tabs, useShellLang } from '@fasl-work/caos-app-shell';

export default function Methodology() {
  const es = useShellLang() === 'es';
  return (
    <article className="page-body prose">
      <h1>{es ? 'Metodología' : 'Methodology'}</h1>
      <p className="lede">{es
        ? 'Generación sintética → clasificación por parche → segmentación run-merge → estiba por profundidad. La segmentación emerge del clasificador de parches, así que no hay un segmentador pesado aparte.'
        : 'Synthetic generation → per-patch classification → run-merge segmentation → depth stitching. The segmentation emerges from the patch classifier, so there is no separate heavy segmenter.'}</p>

      <Tabs ariaLabel={es ? 'metodología' : 'methodology'} tabs={[
        {
          id: 'gen', label: es ? 'Generación' : 'Generation',
          content: (
            <div className="pf-doc-sec">
              <p>{es ? 'Cada litología tiene una textura procedural, color base + grano + bandeo/veteo, modulada por ruido de valor semillado. La bandeja apila N canales; cada canal es una secuencia de runs de core de distintas litologías a lo largo de x, con su intervalo de profundidad. El generador entrega la imagen RGBA y los segmentos ground-truth (gratis), lo que permite puntuar la segmentación.'
                : 'Each lithology has a procedural texture, base colour + grain + banding/veining, modulated by seeded value noise. The tray stacks N channels; each channel is a sequence of core runs of different lithologies along x, with its depth interval. The generator yields the RGBA image and the ground-truth segments (free), which lets us score the segmentation.'}</p>
            </div>
          ),
        },
        {
          id: 'cls', label: es ? 'Clasificación' : 'Classification',
          content: (
            <div className="pf-doc-sec">
              <p>{es ? 'Se desliza una ventana de ' : 'Slide a '}<InlineMath tex="P\times P" />{es ? ' a lo largo del canal; un CNN clasifica cada parche → softmax de 6 clases. El CNN ' : ' window along the channel; a CNN classifies each patch → a 6-class softmax. The CNN '}<Cite id="lecun2015" paren />{es ? ' se compara contra un baseline clásico: momentos de color + estadísticas de gradiente de primer orden + nearest-centroid. Las features de textura clásicas GLCM (' : ' is compared against a classical baseline: colour moments + first-order gradient statistics + nearest-centroid. The classical GLCM ('}<Cite id="haralick1973" paren />{es ? ') y LBP (' : ') and LBP ('}<Cite id="ojala2002" paren />{es ? ') no están implementadas en este build.' : ') texture features are not implemented in this build.'}</p>
              <Equation tex="\hat{y}(x) = \arg\max_c\ \mathrm{softmax}\big(\,\mathrm{CNN}(\text{patch}_x)\big)_c" caption={es ? 'la clase predicha en la posición x es el argmax del softmax del CNN' : 'the predicted class at position x is the argmax of the CNN softmax'} />
            </div>
          ),
        },
        {
          id: 'seg', label: es ? 'Segmentación' : 'Segmentation',
          content: (
            <div className="pf-doc-sec">
              <p>{es ? 'Las predicciones por posición se suavizan (filtro de mayoría de 3 taps) y luego se fusionan los runs contiguos de la misma clase en segmentos, con confianza media. La profundidad de cada segmento sale del mapeo lineal x → profundidad dentro del slice del canal.'
                : 'The per-position predictions are smoothed (a 3-tap majority filter) and adjacent same-class runs are merged into segments, with a mean confidence. Each segment’s depth comes from the linear x → depth map within the channel’s slice.'}</p>
              <Callout variant="note" title={es ? 'Incertidumbre / no-recovery' : 'Uncertainty / no-recovery'}>
                {es ? 'Un autoencoder de parche (OOD), entrenado con parches de core en distribución, reconstruye mal el frame de la bandeja (el generador actual no produce rubble ni huecos de core-loss, así que eso no está evaluado); su MSE alto, o una confianza media bajo el umbral, marca el segmento como “incierto” en vez de forzar una clase '
                : 'A patch autoencoder (OOD), trained on in-distribution core patches, reconstructs the tray frame poorly (the current generator produces no rubble or core-loss gaps, so those are not evaluated); a high MSE, or a mean confidence below the threshold, flags the segment as “uncertain” instead of forcing a class '}<Cite id="hendrycks2017" paren />.
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
        {
          id: 'ood', label: es ? 'OOD y cambio de dominio' : 'OOD & domain shift',
          content: (
            <div className="pf-doc-sec">
              <p>{es
                ? 'El clasificador se entrena con textura sintética, pero el core real es de otro dominio. Un patch fuera de distribución (OOD) debe marcarse, no forzarse a una clase. Se parte de la incertidumbre del softmax y se sube a puntajes en el espacio de features, que la literatura muestra superiores a la reconstrucción.'
                : 'The classifier is trained on synthetic texture, but real core is another domain. An out-of-distribution (OOD) patch must be flagged, not forced into a class. It starts from softmax uncertainty and moves up to feature-space scores, which the literature shows beat reconstruction error.'}</p>
              <Equation tex="p_c = \frac{e^{z_c}}{\sum_j e^{z_j}}, \qquad H(x) = -\sum_c p_c \log p_c" caption={es ? 'softmax y entropía predictiva: alta entropía = predicción insegura' : 'softmax and predictive entropy: high entropy = an unsure prediction'} />
              <p>{es ? 'El baseline de máxima probabilidad softmax (MSP, ' : 'The maximum-softmax-probability baseline (MSP, '}<Cite id="hendrycks2017" paren />{es ? ') marca como novedoso cuando ' : ') flags novelty when '}<InlineMath tex="1-\max_c p_c" />{es ? ' es alto. El puntaje de energía ' : ' is high. The energy score '}<Cite id="liu2020" paren />{es ? ' usa los logits crudos:' : ' uses the raw logits:'}</p>
              <Equation tex="E(x) = -T \cdot \log \sum_c e^{z_c/T}" caption={es ? 'energía: el core en distribución tiene energía baja; un patch OOD la sube' : 'energy: in-distribution core has low energy; an OOD patch raises it'} />
              <p>{es ? 'La medición se hace en el espacio de features. La distancia de Mahalanobis ' : 'The measurement is done in feature space. The Mahalanobis distance '}<Cite id="lee2018" paren />{es ? ' ajusta una Gaussiana por clase con covarianza compartida sobre los embeddings de entrenamiento:' : ' fits a class-conditional Gaussian with shared covariance over the training embeddings:'}</p>
              <Equation tex="M(x) = \min_c\ \big(f(x)-\mu_c\big)^{\top}\,\Sigma^{-1}\,\big(f(x)-\mu_c\big)" caption={es ? 'f(x) es el embedding de 64-d del CNN; mu_c y Sigma se estiman sobre patches sintéticos' : 'f(x) is the CNN 64-d embedding; mu_c and Sigma are estimated over synthetic patches'} />
              <p>{es ? 'El puntaje kNN ' : 'The kNN score '}<Cite id="sun2022" paren />{es ? ' es no paramétrico: la distancia al k-ésimo vecino más cercano en un banco de embeddings en distribución (normalizados L2). Ambos, Mahalanobis y kNN, se comparan contra la reconstrucción de base y contra energía/MSP en la página Benchmark.'
                : ' is non-parametric: the distance to the k-th nearest neighbour in an in-distribution embedding bank (L2-normalized). Both Mahalanobis and kNN are compared against the incumbent reconstruction score and against energy/MSP on the Benchmark page.'}</p>
              <Callout variant="note" title={es ? 'Adaptación de dominio (mapa SOTA, no ejecutado aún)' : 'Domain adaptation (SOTA map, not yet run)'}>
                <p>{es ? 'Para cerrar la brecha (no solo detectarla), Deep CORAL ' : 'To close the gap (not only detect it), Deep CORAL '}<Cite id="sun2016coral" paren />{es ? ' alinea los estadísticos de segundo orden de origen y destino, ' : ' aligns the second-order statistics of source and target, '}<InlineMath tex="\ell_{\mathrm{CORAL}} = \tfrac{1}{4d^2}\lVert C_s - C_t \rVert_F^2" />{es ? '; DANN ' : '; DANN '}<Cite id="ganin2016" paren />{es ? ' usa reversión de gradiente para features invariantes al dominio. CoreLog aún no aplica adaptación; aquí se documenta el mapa. La contribución de este build es entrenar una cabeza sobre DCID real (ver Implementación) y elegir el puntaje OOD que de verdad separa la brecha.'
                  : ' uses gradient reversal for domain-invariant features. CoreLog does not yet apply adaptation; this documents the map. This build\'s contribution is training a head on real DCID (see Implementation) and selecting the OOD score that actually separates the gap.'}</p>
              </Callout>
              <Refs ids={['hendrycks2017', 'liu2020', 'lee2018', 'sun2022', 'sun2016coral', 'ganin2016']} label={es ? 'Refs' : 'Refs'} />
            </div>
          ),
        },
        {
          id: 'ssl', label: es ? 'Representaciones auto-supervisadas' : 'Self-supervised representations',
          content: (
            <div className="pf-doc-sec">
              <p>{es
                ? 'La calidad del puntaje OOD y de la cabeza real depende del espacio de embedding. Un backbone congelado y bien entrenado da features donde el core real y el sintético se separan de forma lineal. Las familias auto-supervisadas y pre-entrenadas son las candidatas.'
                : 'The quality of the OOD score and of the real head depends on the embedding space. A well-trained frozen backbone gives features where real and synthetic core separate linearly. Self-supervised and pretrained families are the candidates.'}</p>
              <p>{es ? 'SimCLR ' : 'SimCLR '}<Cite id="chen2020simclr" paren />{es ? ' aprende por contraste con la pérdida NT-Xent sobre pares aumentados:' : ' learns by contrast with the NT-Xent loss over augmented pairs:'}</p>
              <Equation tex="\ell_{i,j} = -\log \frac{\exp(\mathrm{sim}(z_i,z_j)/\tau)}{\sum_{k\neq i}\exp(\mathrm{sim}(z_i,z_k)/\tau)}" caption={es ? 'sim = coseno; tau = temperatura; acerca vistas del mismo patch, aleja las demás' : 'sim = cosine; tau = temperature; pulls together views of the same patch, pushes the rest apart'} />
              <p>{es ? 'DINO ' : 'DINO '}<Cite id="caron2021dino" paren />{es ? ' destila un ViT sin etiquetas (student-teacher con centrado + sharpening); DINOv2 ' : ' self-distills a ViT with no labels (student-teacher with centering + sharpening); DINOv2 '}<Cite id="oquab2023dinov2" paren />{es ? ' escala esto a un backbone de features de propósito general. MAE ' : ' scales this to a general-purpose feature backbone. MAE '}<Cite id="he2022mae" paren />{es ? ' enmascara ~75% de los parches y reconstruye lo faltante, un pre-entrenamiento generativo fuerte.'
                : ' masks ~75% of patches and reconstructs the missing content, a strong generative pretraining.'}</p>
              <Callout variant="honest" title={es ? 'Qué se ejecutó de verdad' : 'What was actually run'}>
                <p>{es ? 'El benchmark de este build usa el embedding de 64-d del propio CNN de litología (congelado) para el puntaje OOD en vivo, y compara backbones ImageNet congelados (MobileNetV3-Small ' : 'This build\'s benchmark uses the lithology CNN\'s own frozen 64-d embedding for the live OOD score, and compares frozen ImageNet backbones (MobileNetV3-Small '}<Cite id="howard2019mobilenetv3" paren />{es ? ', ResNet18 ' : ', ResNet18 '}<Cite id="he2016resnet" paren />{es ? ') para la cabeza real DCID, todo controlando la resolución. DINOv2/MAE son la referencia SOTA del techo, demasiado pesados para el navegador; se documentan, no se embarcan. Los números medidos están en Benchmark y Experimentos.'
                  : ') for the real DCID head, all with the resolution controlled. DINOv2/MAE are the ceiling SOTA reference, too heavy for the browser; they are documented, not shipped. The measured numbers are on Benchmark and Experiments.'}</p>
              </Callout>
              <Refs ids={['chen2020simclr', 'caron2021dino', 'oquab2023dinov2', 'he2022mae', 'howard2019mobilenetv3', 'he2016resnet']} label={es ? 'Refs' : 'Refs'} />
            </div>
          ),
        },
      ]} />

      <ReferenceList heading={es ? 'Referencias' : 'References'} />
    </article>
  );
}
